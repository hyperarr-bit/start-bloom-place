import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { alternarLimpeza, feitoNoPeriodo, periodoDaSecao, type ItemLimpeza } from "@/components/casa/rotina-limpeza";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { cn, localDayKey } from "@/lib/utils";
import {
  CHAVE_TAREFAS_CARREIRA, CHAVE_TAREFAS_ROTINA, avisoDaTarefa, avisoJaPassou, detalhesDaTarefa, horaDaTarefa, horaDoAviso, ordenarPorHora,
  type TarefaDoDia,
} from "@/lib/tarefas";
import { COR_DO_DIA, textoDoDia, tomDoDia } from "@/components/treino/planner";
import {
  CabecalhoDaTabela, FichaDaTarefa, FolhaNovaTarefa, LinhaDeTarefa, LinhaNovaTarefa, diaCurto, nomeDoDiaDeHoje, useTarefasDoDia,
  type FichaAberta, type LinhaVisivel,
} from "@/components/tarefas/tarefas-do-dia";

/**
 * TAREFAS DE HOJE na Home (22/09). Chamado marcado como erro: "as tarefas
 * criadas em CARREIRA - ROTINA - CASA, qualquer lugar, não aparecem no
 * dashboard inicial :(". Não era bug — nenhum widget juntava as listas dos
 * módulos. Este junta, LENDO as mesmas chaves que cada tela grava, e o ✓
 * aqui escreve de volta na chave de origem (uma fonte de verdade por lista).
 *
 * Quem entra: Rotina (Urgências, Foco → tarefas, Meu dia → tarefas do dia),
 * Carreira (Meu dia) e Casa (tarefas da rotação e a limpeza diária). Vem no
 * seletor de widgets, opcional — a Home de ninguém muda sozinha.
 *
 * 28/09 — HORÁRIO E DETALHES ("pôr alarme e descrever mais coisas… ali em
 * tarefas de hoje"): a lista virou folha de planner (faixa na cor do dia,
 * tabela HORA | TAREFA | FEITO). Tarefa com horário vem primeiro, na ordem da
 * hora, com 🔔 e a antecedência; tocar no texto abre a ficha (detalhes,
 * editar, apagar) e só o quadradinho marca. "＋ Nova tarefa" cria direto nas
 * tarefas de hoje da Rotina, com horário/aviso/detalhes opcionais. As feitas
 * de hoje ficam riscadas no pé, em vez de sumir no toque.
 */

type Todo = { id: string; text: string; priority?: "alta" | "media" | "baixa"; done: boolean; dueDate?: string };
type Urgencia = { id: string; text: string; done: boolean };
type Chore = { id: string; name: string; currentTurnIndex: number; lastRotation: string; done: boolean };
type Member = { id: string; name: string; emoji: string };
type CleaningSection = { id: string; name: string; color: string; items: { id: string; text: string; done: boolean }[] };

type Linha = LinhaVisivel & { ficha?: Omit<FichaAberta, "texto" | "feito"> };

const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const TasksWidget = () => {
  const navigate = useNavigate();
  const hoje = localDayKey();
  const dia = nomeDoDiaDeHoje();
  const tom = tomDoDia(dia);
  const [todos, setTodos] = usePersistedState<Todo[]>("todo-list", []);
  const rotina = useTarefasDoDia(CHAVE_TAREFAS_ROTINA);
  const carreira = useTarefasDoDia(CHAVE_TAREFAS_CARREIRA);
  const [urgencias, setUrgencias] = usePersistedState<Urgencia[]>("rotina-urgencies", []);
  const [chores] = usePersistedState<Chore[]>("casa-chores", []);
  const [members] = usePersistedState<Member[]>("casa-members", []);
  const [limpeza, setLimpeza] = usePersistedState<CleaningSection[]>("casa-cleaning-routine", []);
  const [criando, setCriando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  /* Urgência e tarefa do Foco não têm dia: feitas de antes não são "de hoje"
     e ficam de fora. As marcadas AGORA continuam na lista, riscadas, até sair
     da Home — senão a linha sumia no toque e o contador nem andava. */
  const [marcadasAgora, setMarcadasAgora] = useState<ReadonlySet<string>>(() => new Set());
  const lembrar = (key: string, feito: boolean) => setMarcadasAgora((prev) => {
    const n = new Set(prev);
    if (feito) n.add(key); else n.delete(key);
    return n;
  });

  const linhas: Linha[] = [];

  /* A tarefa criada pela ação rápida da Home nasce com o MESMO id em
     "rotina-urgencies" e em "todo-list" (26/09: aparecia duas vezes aqui e era
     preciso marcar duas vezes). Mostra uma linha só e marca as duas juntas. */
  const idsUrgencia = new Set(lista<Urgencia>(urgencias).map((u) => u.id));
  lista<Urgencia>(urgencias).forEach((u) => {
    const key = `u-${u.id}`;
    if (u.done && !marcadasAgora.has(key)) return;
    const alternar = () => {
      const feito = !u.done;
      setUrgencias((prev) => lista<Urgencia>(prev).map((x) => (x.id === u.id ? { ...x, done: feito } : x)));
      if (lista<Todo>(todos).some((t) => t.id === u.id)) setTodos((prev) => lista<Todo>(prev).map((x) => (x.id === u.id ? { ...x, done: feito } : x)));
      lembrar(key, feito);
    };
    linhas.push({
      key, origem: "Rotina", detalhe: "urgência", texto: u.text, feito: !!u.done, onAlternar: alternar, onAbrir: () => setAberta(key),
      ficha: { onde: "Rotina · urgência", onAlternar: alternar, abrirModulo: { rotulo: "Abrir na Rotina", ir: () => navigate("/rotina") } },
    });
  });

  // Foco → tarefas: as com prazo até hoje (vencidas primeiro), depois as sem prazo
  const comPrazo = lista<Todo>(todos).filter((t) => t?.dueDate && t.dueDate <= hoje);
  const semPrazo = lista<Todo>(todos).filter((t) => !t?.dueDate);
  [...comPrazo, ...semPrazo].filter((t) => !idsUrgencia.has(t.id)).forEach((t) => {
    const key = `t-${t.id}`;
    if (t.done && !marcadasAgora.has(key)) return;
    const alternar = () => {
      setTodos((prev) => lista<Todo>(prev).map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
      lembrar(key, !t.done);
    };
    const detalhe = t.dueDate && t.dueDate < hoje ? "atrasada" : t.priority === "alta" ? "alta" : undefined;
    linhas.push({
      key, origem: "Rotina", detalhe, texto: t.text, feito: !!t.done, onAlternar: alternar, onAbrir: () => setAberta(key),
      ficha: { onde: `Rotina · foco${detalhe ? ` · ${detalhe}` : ""}`, onAlternar: alternar, abrirModulo: { rotulo: "Abrir na Rotina", ir: () => navigate("/rotina") } },
    });
  });

  // Tarefas de hoje (Rotina e Carreira): as únicas com horário, aviso e detalhes
  const doDia = (fonte: ReturnType<typeof useTarefasDoDia>, prefixo: string, origem: string) =>
    fonte.lista.filter((t): t is TarefaDoDia => !!t && t.dia === hoje && typeof t.texto === "string").forEach((t) => {
      const key = `${prefixo}-${t.id}`;
      linhas.push({
        key, origem, texto: t.texto, feito: !!t.feito,
        hora: horaDaTarefa(t) ?? undefined, aviso: avisoDaTarefa(t), detalhes: detalhesDaTarefa(t),
        onAlternar: () => fonte.alternar(t.id), onAbrir: () => setAberta(key),
        ficha: { onde: origem, tarefa: t, onAlternar: () => fonte.alternar(t.id), onSalvar: (c) => fonte.salvar(t.id, c), onApagar: () => fonte.apagar(t.id) },
      });
    });
  doDia(rotina, "rd", "Rotina");
  doDia(carreira, "cd", "Carreira");

  const membros = lista<Member>(members);
  lista<Chore>(chores).forEach((c) => {
    const vez = membros.length ? membros[c.currentTurnIndex % membros.length] : null;
    linhas.push({ key: `ch-${c.id}`, origem: "Casa", texto: c.name, feito: false, detalhe: vez ? `vez de ${vez.name}` : undefined, onAbrir: () => navigate("/casa") });
  });

  lista<CleaningSection>(limpeza)
    .filter((s) => /di[aá]ri/i.test(String(s?.name ?? "")))
    // "Feito" só vale no dia (26/09): o ✓ de ontem continuava marcado na Home
    // até a pessoa abrir Casa › Rotina — mesma regra do módulo (rotina-limpeza).
    .forEach((s) => lista<CleaningSection["items"][number]>(s.items).forEach((it) => {
      const key = `cl-${s.id}-${it.id}`;
      const alternar = () => setLimpeza((prev) => lista<CleaningSection>(prev).map((sec) => (sec.id !== s.id ? sec : {
        ...sec, items: lista<CleaningSection["items"][number]>(sec.items).map((x) => (x.id === it.id ? alternarLimpeza(x as ItemLimpeza, periodoDaSecao(String(sec.name ?? ""))) : x)),
      })));
      linhas.push({
        key, origem: "Casa", detalhe: "limpeza diária", texto: it.text,
        feito: feitoNoPeriodo(it as ItemLimpeza, periodoDaSecao(String(s.name ?? ""))),
        onAlternar: alternar, onAbrir: () => setAberta(key),
        ficha: { onde: "Casa · limpeza diária", onAlternar: alternar, abrirModulo: { rotulo: "Abrir em Casa", ir: () => navigate("/casa") } },
      });
    }));

  // Folha de planner: as com horário primeiro, pela hora; as feitas riscadas no pé
  const pendentes = ordenarPorHora(linhas.filter((l) => !l.feito));
  const feitas = ordenarPorHora(linhas.filter((l) => l.feito));
  const visiveis = [...pendentes.slice(0, 8), ...feitas.slice(0, 3)];
  const escondidas = pendentes.length - Math.min(8, pendentes.length);
  const pct = linhas.length ? Math.round((feitas.length / linhas.length) * 100) : 0;

  const linhaAberta = aberta ? linhas.find((l) => l.key === aberta) : undefined;
  const ficha: FichaAberta | null = linhaAberta?.ficha ? { texto: linhaAberta.texto, feito: linhaAberta.feito, ...linhaAberta.ficha } : null;

  const criar = (c: Parameters<typeof rotina.adicionar>[0]) => {
    const t = rotina.adicionar(c);
    const aviso = avisoDaTarefa(t);
    const hora = horaDaTarefa(t);
    toast.success("Tarefa anotada", {
      description: hora && aviso >= 0 && !avisoJaPassou(t.dia, hora, aviso) ? `🔔 O aviso toca às ${horaDoAviso(hora, aviso)}` : undefined,
    });
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden" data-testid="tasks-widget">
      {/* faixa do dia: a cor do dia da semana, igual no app todo */}
      <div className={cn(COR_DO_DIA[dia], textoDoDia(dia), "px-4 py-2.5 flex items-center gap-3")}>
        <div className="min-w-0">
          <h4 className="text-[15px] font-extrabold tracking-wide leading-tight">
            {dia} · {diaCurto(hoje)}
          </h4>
          <p className="text-[12px] opacity-90 mt-0.5 inline-flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" aria-hidden="true" /> Tarefas de hoje
          </p>
        </div>
        {linhas.length > 0 && (
          <div className="ml-auto shrink-0 text-right">
            <p className="text-[12.5px] font-bold tabular-nums" data-testid="contagem-tarefas">
              {feitas.length}/{linhas.length} feitas
            </p>
            <div className="mt-1.5 w-20 h-1.5 rounded-full relative overflow-hidden ml-auto" aria-hidden="true">
              <span className="absolute inset-0 bg-current opacity-30" />
              <span className="relative block h-full rounded-full bg-current transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {linhas.length === 0 ? (
        <div className="px-4 py-3 space-y-1">
          <p className="text-[13.5px] font-semibold">Nada pra hoje ainda.</p>
          <button type="button" onClick={() => navigate("/rotina")} className="text-left text-xs text-muted-foreground" data-testid="tasks-vazio">
            Anote aqui embaixo. Com horário, o CORE te avisa na hora. O que você criar em <span className="font-medium text-foreground">Rotina</span> (urgências, tarefas, meu dia),{" "}
            <span className="font-medium text-foreground">Carreira</span> (meu dia) e <span className="font-medium text-foreground">Casa</span> também aparece aqui.
          </button>
        </div>
      ) : (
        <div>
          <CabecalhoDaTabela tom={tom} />
          {visiveis.map((l, i) => <LinhaDeTarefa key={l.key} l={l} tom={tom} primeira={i === 0} />)}
          {pendentes.length === 0 && (
            <p className={cn("px-4 py-2.5 border-t text-[12.5px] font-semibold text-green-700 dark:text-green-300", tom.linha)}>Tudo feito por hoje ✓</p>
          )}
          {escondidas > 0 && (
            <button type="button" onClick={() => navigate("/rotina")} className={cn("w-full px-4 py-2.5 border-t text-left text-[12px] text-muted-foreground", tom.linha)}>
              + {escondidas} pendentes · abrir Rotina
            </button>
          )}
        </div>
      )}

      <LinhaNovaTarefa onAbrir={() => setCriando(true)} linha={tom.linha} />

      <FolhaNovaTarefa aberta={criando} onFechar={() => setCriando(false)} onSalvar={criar} onde="Rotina" />
      <FichaDaTarefa ficha={ficha} onFechar={() => setAberta(null)} />
    </div>
  );
};
