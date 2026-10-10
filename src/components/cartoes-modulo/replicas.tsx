import { Fragment, type ReactNode } from "react";
import { useUserData } from "@/hooks/use-user-data";

/**
 * RÉPLICAS PRA MINIATURA (1.0.14). Sete módulos desenham a aba essencial INLINE na
 * própria página (Rotina, Treino, Dieta, Estudos, Biblioteca, Carreira, Relações) — não
 * há um componente pra pôr dentro da Miniatura sem puxar a página inteira (e com ela
 * o tracker de analytics, o holofote e os próprios cartões). Estas réplicas copiam o
 * desenho do card real (mesmas cores, mesma hierarquia) e LEEM as mesmas chaves de
 * dado do store de exemplo, via useUserData — a miniatura continua "viva". Onde a
 * página tiver um componente de verdade (Saúde, Metas, Casa, Mente, Detox, Pet,
 * Viagens, Finanças, Beleza), a miniatura usa ele, não uma réplica.
 */

const Caixa = ({ titulo, emoji, cor, children }: { titulo: string; emoji: string; cor: string; children: ReactNode }) => (
  <div className="bg-card rounded-lg border border-border overflow-hidden text-foreground">
    <div className={`${cor} border-b border-border px-4 py-3 flex items-center justify-between`}>
      <span className="font-bold text-sm">{titulo}</span><span>{emoji}</span>
    </div>
    {children}
  </div>
);

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];
const DIAS_LONGOS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];

/** Rotina › MINHA SEMANA — a grade "HÁBITOS DIÁRIOS" (hábito × dia da semana). */
export const MiniHabitos = () => {
  const { get } = useUserData();
  const habitos = get<string[]>("rotina-habits", []).slice(0, 5);
  const marcados = get<Record<string, boolean[]>>("rotina-habits-checked", {});
  return (
    <div className="p-3">
      <Caixa titulo="HÁBITOS DIÁRIOS" emoji="✅" cor="bg-green-100 text-green-900">
        <div className="p-3">
          <div className="grid grid-cols-[1fr_repeat(7,22px)] gap-1 items-center text-[11px]">
            <span />
            {DIAS.map((d, i) => <span key={i} className="text-center font-bold text-muted-foreground">{d}</span>)}
            {habitos.map((h, hi) => (
              <Fragment key={`${h}-${hi}`}>
                <span className="truncate font-medium">{h}</span>
                {DIAS_LONGOS.map((d, di) => {
                  const ok = !!marcados[d]?.[hi];
                  return <span key={`${hi}-${di}`} className={`h-5 w-5 rounded-md border grid place-items-center ${ok ? "bg-green-500 border-green-500 text-white" : "border-border bg-background"}`}>{ok ? "✓" : ""}</span>;
                })}
              </Fragment>
            ))}
          </div>
          <div className="mt-3 flex gap-2"><span className="flex-1 h-8 rounded-md border border-border bg-background text-[11px] px-2 grid items-center text-muted-foreground">Novo hábito…</span><span className="h-8 px-3 rounded-md bg-green-600 text-white text-[11px] grid items-center font-bold">+</span></div>
        </div>
      </Caixa>
    </div>
  );
};

/** Treino › PLANO — a semana com um modelo pronto aplicado (dados de exemplo da réplica). */
export const MiniPlanoDeTreino = () => {
  const plano: Record<string, string> = { SEGUNDA: "Pernas", TERÇA: "Peito + tríceps", QUARTA: "Descanso", QUINTA: "Costas + bíceps", SEXTA: "Ombro + abdômen", SÁBADO: "Cardio leve", DOMINGO: "Descanso" };
  return (
    <div className="p-3">
      <section className="rounded-2xl border border-blue-100 overflow-hidden bg-card text-foreground">
        <div className="px-4 py-3 bg-blue-50 text-blue-900 flex items-center justify-between"><span className="font-bold text-sm">PLANO DA SEMANA</span><span>📋</span></div>
        <div className="p-3 grid grid-cols-7 gap-1.5">
          {DIAS_LONGOS.map((d) => {
            const vazio = plano[d] === "Descanso";
            return (
              <div key={d} className={`rounded-xl border px-1 py-2 text-center ${vazio ? "border-dashed border-border text-muted-foreground" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
                <div className="text-[10px] font-bold">{d.slice(0, 3)}</div>
                <div className="text-[9px] leading-tight mt-1">{plano[d]}</div>
              </div>
            );
          })}
        </div>
        <div className="px-3 pb-3 flex gap-2">
          {["Iniciante 3x", "ABC", "ABCD"].map((m, i) => <span key={m} className={`h-8 px-3 rounded-full text-[11px] font-bold grid items-center ${i === 0 ? "bg-blue-600 text-white" : "border border-border"}`}>{m}</span>)}
        </div>
      </section>
    </div>
  );
};

/** Dieta › CARDÁPIO — o card do dia de hoje, com as refeições (lê `saude-meals`). */
export const MiniCardapio = () => {
  const { get } = useUserData();
  const refeicoes = get<Record<string, Record<string, string>>>("saude-meals", {});
  const hoje = DIAS_LONGOS[(new Date().getDay() + 6) % 7];
  const doDia = refeicoes[hoje] ?? Object.values(refeicoes)[0] ?? {};
  const linhas = Object.entries(doDia).slice(0, 4);
  return (
    <div className="p-3">
      <Caixa titulo={hoje} emoji="🍽️" cor="bg-green-50 text-green-900">
        <div className="p-3 space-y-2">
          {linhas.length ? linhas.map(([nome, texto]) => (
            <div key={nome} className="rounded-lg border border-border px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{nome}</div>
              <div className="text-[11.5px] leading-snug">{texto}</div>
            </div>
          )) : <div className="rounded-lg border border-dashed border-border px-3 py-3 text-[11.5px] text-muted-foreground">Toca numa refeição e escreve o que vai comer.</div>}
        </div>
      </Caixa>
    </div>
  );
};

/** Estudos › ESTUDOS — os cursos em andamento (lê `estudos-cursos-andamento`). */
export const MiniCursos = () => {
  const { get } = useUserData();
  const cursos = get<Array<{ id: string; name: string; notes?: string; aulasFeitas?: number; aulasTotal?: number }>>("estudos-cursos-andamento", []).slice(0, 3);
  return (
    <div className="p-3">
      <Caixa titulo="CURSOS EM ANDAMENTO" emoji="📝" cor="bg-indigo-50 text-indigo-900">
        <div className="p-3 space-y-2">
          {cursos.map((c) => (
            <div key={c.id} className="rounded-lg border border-border px-3 py-2">
              <div className="text-[12px] font-semibold">{c.name}</div>
              {c.notes && <div className="text-[10.5px] text-muted-foreground">{c.notes}</div>}
              {c.aulasTotal ? <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.round(((c.aulasFeitas ?? 0) / c.aulasTotal) * 100)}%` }} /></div> : null}
            </div>
          ))}
          <div className="flex gap-2"><span className="flex-1 h-9 rounded-lg border border-border bg-background text-[11px] px-2 grid items-center text-muted-foreground">Adicionar curso…</span><span className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-[11px] grid items-center font-bold">+</span></div>
        </div>
      </Caixa>
    </div>
  );
};

/** Biblioteca › LENDO AGORA — os livros com progresso (lê `lib-books`). */
export const MiniLendoAgora = () => {
  const { get } = useUserData();
  const livros = get<Array<{ id: string; title: string; author: string; status: string; progress?: number; pages?: number; currentPage?: number }>>("lib-books", []).filter((l) => l.status === "lendo").slice(0, 2);
  return (
    <div className="p-3">
      <Caixa titulo="LENDO AGORA" emoji="📖" cor="bg-orange-50 text-orange-900">
        <div className="p-3 space-y-2">
          <div className="flex gap-2"><span className="flex-1 h-9 rounded-lg border border-border bg-background text-[11px] px-2 grid items-center text-muted-foreground">Cole o link do livro aqui…</span><span className="h-9 px-3 rounded-lg bg-orange-600 text-white text-[11px] grid items-center font-bold">Importar</span></div>
          {livros.map((l) => {
            const pct = l.pages && l.currentPage ? Math.round((l.currentPage / l.pages) * 100) : (l.progress ?? 0);
            return (
              <div key={l.id} className="flex gap-3 rounded-lg border border-border p-2.5">
                <div className="w-9 h-12 rounded-md bg-orange-200 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{l.title}</div>
                  <div className="text-[10.5px] text-muted-foreground truncate">{l.author}</div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </Caixa>
    </div>
  );
};

/** Carreira › MEU DIA — as tarefas do dia e as fases (lê `career-day-tasks` e `career-day-phases`). */
export const MiniMeuDia = () => {
  const { get } = useUserData();
  const tarefas = get<Array<{ id: string; texto: string; feito: boolean }>>("career-day-tasks", []).slice(0, 3);
  const fases = get<Array<{ id: string; nome: string }>>("career-day-phases", []).slice(0, 3);
  return (
    <div className="p-3">
      <Caixa titulo="MEU DIA" emoji="🗓️" cor="bg-slate-100 text-slate-900">
        <div className="p-3 space-y-2">
          {tarefas.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[12px]">
              <span className={`h-4 w-4 rounded border grid place-items-center text-[10px] ${t.feito ? "bg-slate-700 border-slate-700 text-white" : "border-border"}`}>{t.feito ? "✓" : ""}</span>
              <span className={t.feito ? "line-through text-muted-foreground" : ""}>{t.texto}</span>
            </div>
          ))}
          <div className="flex gap-2"><span className="flex-1 h-8 rounded-md border border-border bg-background text-[11px] px-2 grid items-center text-muted-foreground">Nova tarefa do dia…</span><span className="h-8 px-3 rounded-md bg-slate-700 text-white text-[11px] grid items-center font-bold">+</span></div>
          <div className="flex gap-1.5 pt-1">{fases.map((f) => <span key={f.id} className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold">{f.nome}</span>)}</div>
        </div>
      </Caixa>
    </div>
  );
};

/** Relações › PESSOAS — a lista "Minhas pessoas" (lê `rel-people`). */
export const MiniPessoas = () => {
  const { get } = useUserData();
  const pessoas = get<Array<{ id: string; name: string; relation?: string; birthday?: string }>>("rel-people", []).slice(0, 4);
  return (
    <div className="p-3">
      <Caixa titulo="MINHAS PESSOAS" emoji="💌" cor="bg-rose-50 text-rose-900">
        <ul className="divide-y divide-border">
          {pessoas.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="w-9 h-9 rounded-full bg-rose-200 text-rose-900 grid place-items-center font-bold text-[13px]">{p.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold truncate">{p.name}</span><span className="block text-[10.5px] text-muted-foreground truncate">{p.relation ?? ""}{p.birthday ? ` · 🎂 ${p.birthday.slice(8, 10)}/${p.birthday.slice(5, 7)}` : ""}</span></span>
            </li>
          ))}
          <li className="px-3.5 py-2.5"><span className="inline-flex h-9 px-3 items-center rounded-full bg-rose-600 text-white text-[11.5px] font-bold">+ Guardar uma pessoa</span></li>
        </ul>
      </Caixa>
    </div>
  );
};
