import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Folha } from "@/components/missao-doses/PreFolhaLembrete";
import { areaEscolhidaNoFunil } from "@/components/missao/MissaoDoTrial";
import { useUserData } from "@/hooks/use-user-data";
import { conteudoDoLembrete, conteudoDoModulo, diaDoUso, lerDia2, planejarLembreteDia2, registrarAbertura, rotuloDeMinutos, type ConteudoDia2, type Leitor } from "@/lib/lembrete-dia2";
import { MODULOS, ORDEM_MODULOS, lerMissao, type EstadoMissaoDoses, type ModuloDaMissao } from "@/lib/missao-doses";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import "@/components/missao-doses/missao-doses.css";

/**
 * /dev/dia2 — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). Mostra, como chegariam na tela de
 * bloqueio, os textos do Lembrete do dia 2 em cada cenário (lib/lembrete-dia2):
 * o passo de amanhã da missão, cada módulo COM o número da pessoa e SEM
 * (o fallback), e a pré-folha da permissão.
 *   ?tela=textos (padrão) | prefolha | agora
 * `agora` = o que seria agendado AGORA pra ESTA conta (os dados reais do provedor,
 * a missão e o estado `core-dia2` deste aparelho) — é o que o script de prints
 * fotografa a cada "dia" do ciclo.
 */
function Agora() {
  const { get } = useUserData();
  const hoje = localDayKey();
  const e = lerDia2() ?? registrarAbertura();
  const prefs = lerPrefs(get<unknown>(CHAVE_PREFS, undefined));
  const plano = planejarLembreteDia2(get, e, { ligado: prefs.primeiraSemana, missao: lerMissao(), area: areaEscolhidaNoFunil() });
  const agora = new Date();
  return (
    <div className="min-h-dvh px-4 pb-10" style={{ background: "linear-gradient(180deg,#2a2440 0%,#16121c 100%)", paddingTop: "calc(var(--app-safe-top) + 24px)" }} data-testid="dev-dia2-agora">
      <div className="max-w-[420px] mx-auto space-y-4 text-white">
        <h1 className="text-[20px] font-black tracking-tight">O que fica agendado agora</h1>
        <div className="rounded-2xl bg-white/10 px-4 py-3 text-[13px] leading-relaxed">
          <p>Hoje: <b>{hoje}</b> às <b>{rotuloDeMinutos(agora.getHours() * 60 + agora.getMinutes())}</b> · dia <b>{diaDoUso(e, hoje)}</b> do uso neste aparelho</p>
          <p>1ª abertura de hoje: <b>{e.abertura ? rotuloDeMinutos(e.abertura.min) : "—"}</b> · hora combinada na missão: <b>{e.horaEscolhida === undefined ? "nenhuma" : e.horaEscolhida === "sem" ? "sem aviso" : rotuloDeMinutos(e.horaEscolhida)}</b></p>
          <p>Permissão: <b>{e.permissao ? `${e.permissao.resultado} (${e.permissao.origem}, ${e.permissao.dia})` : "ainda não pedida"}</b> · "Primeira semana" na central: <b>{prefs.primeiraSemana ? "ligada" : "desligada"}</b></p>
          <p>Armado de verdade (core-dia2.ultimo): <b data-testid="dev-dia2-ultimo">{e.ultimo?.quando ? `${new Date(e.ultimo.quando).toLocaleString("pt-BR")} · ${e.ultimo.title}` : e.ultimo?.motivo ?? "nada ainda"}</b></p>
        </div>
        {plano.ok === true ? (
          <Banner c={plano.conteudo} legenda={`${plano.quando.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} às ${rotuloDeMinutos(plano.quando.getHours() * 60 + plano.quando.getMinutes())} · dia ${plano.diaDoUso} do uso · hora ${plano.origemHora === "missao" ? "combinada na missão" : "da 1ª abertura de hoje"}`} />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/30 px-4 py-5 text-center" data-testid="dev-dia2-sem-lembrete">
            <p className="text-[15px] font-extrabold">Nenhum lembrete pra amanhã</p>
            <p className="text-[12.5px] text-white/70 mt-1">{plano.motivo === "fim_da_semana" ? "A primeira semana acabou — parou sozinho no dia 8." : plano.motivo === "sem_aviso" ? "Ela escolheu \"sem aviso\" na missão." : "Desligado na central de notificações."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
const amanha = (() => { const [y, m, d] = somarDias(localDayKey(), 1).split("-").map(Number); return new Date(y, m - 1, d, 19, 0); })();
const DIA = (n: number) => ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][n];

const leitor = (dados: Record<string, unknown>): Leitor => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);

const COM_NUMERO: Record<string, Record<string, unknown>> = {
  financas: { "finance-incomes": [{ value: 3500 }], "finance-expenses": [{ value: 420 }, { value: 80 }], "finance-fixed-expenses": [{ value: 1200 }], "finance-dueDays": [] },
  "financas (conta vence)": { "finance-dueDays": [{ day: amanha.getDate(), bills: [{ name: "Conta de luz", paid: false }] }] },
  rotina: { "rotina-habits": ["Água", "Andar", "Ler"], "core-dias-anotados": [somarDias(localDayKey(), -2), somarDias(localDayKey(), -1), localDayKey()] },
  treino: { "saude-workouts-v2": { [DIA(amanha.getDay())]: { muscles: ["Peito", "Tríceps"], exercises: [{ name: "Supino" }] } }, "treino-active-days": [DIA(amanha.getDay())] },
  saude: { "core-saude-water-goal": 8 },
  dieta: { "core-dieta-meals": [{ name: "Café" }, { name: "Almoço" }, { name: "Lanche" }, { name: "Jantar" }] },
  desenvolvimento: { "goals-board-v2": [{ id: 1, title: "Correr 5 km" }, { id: 2, title: "Guardar R$ 1.000" }] },
  biblioteca: { "lib-books": [{ title: "O Poder do Hábito", status: "lendo", pages: 320, currentPage: 180 }] },
};

const MISSAO: EstadoMissaoDoses = { v: 1, inicio: localDayKey(), modulos: ["financas", "rotina", "saude"], feitos: { 1: { dia: localDayKey(), rotulo: "Café · R$ 12" } }, boasVindas: true, lembrete: "20h" };

function Banner({ c, legenda }: { c: ConteudoDia2; legenda: string }) {
  return (
    <div className="text-left">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/70 mb-1.5">{legenda}</p>
      <div className="rounded-2xl bg-white/95 backdrop-blur px-3.5 py-3 shadow-lg text-[#16121c]" data-testid="dev-dia2-banner" data-modulo={c.modulo} data-numero={c.temNumero ? "" : undefined}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-5 rounded-[6px] grid place-items-center text-[9px] font-black text-white" style={{ background: "#16121c" }}>C</span>
          <span className="text-[11px] font-bold text-black/55 uppercase tracking-wide">CORE</span>
          <span className="ml-auto text-[11px] text-black/45">agora</span>
        </div>
        <p className="text-[14px] font-extrabold leading-snug">{c.title}</p>
        <p className="text-[13px] text-black/70 leading-snug mt-0.5">{c.body}</p>
        <p className="text-[10px] text-black/40 mt-1.5">abre {c.rota} · {c.temNumero ? "com número da pessoa" : "texto genérico"}</p>
      </div>
    </div>
  );
}

const DevDia2 = () => {
  const [params] = useSearchParams();
  const [folha, setFolha] = useState(true);
  const textos = useMemo(() => {
    const out: Array<{ legenda: string; c: ConteudoDia2 }> = [];
    out.push({ legenda: "Missão em doses · amanhã é o passo 2 (Rotina)", c: conteudoDoLembrete(leitor({}), { missao: MISSAO, amanha }) });
    for (const [nome, dados] of Object.entries(COM_NUMERO)) {
      const modulo = nome.split(" ")[0] as ModuloDaMissao;
      out.push({ legenda: `${MODULOS[modulo].nome} · com o dado dela${nome.includes("(") ? " (conta a vencer)" : ""}`, c: conteudoDoModulo(leitor(dados), modulo, amanha) });
    }
    for (const m of ORDEM_MODULOS) out.push({ legenda: `${MODULOS[m].nome} · sem número (fallback)`, c: conteudoDoModulo(leitor({}), m, amanha) });
    return out;
  }, []);

  if (params.get("tela") === "agora") return <Agora />;
  if (params.get("tela") === "prefolha") {
    const c = conteudoDoModulo(leitor(COM_NUMERO.financas), "financas", amanha);
    return (
      <div className="min-h-dvh bg-background">
        <div className="max-w-lg mx-auto px-4 pt-6 text-sm text-muted-foreground">Finanças de fundo (a pessoa acabou de anotar o 1º gasto).</div>
        {folha && <Folha hora="19:00" conteudo={c} aoSim={() => setFolha(false)} aoAgoraNao={() => setFolha(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 pt-6 pb-10" style={{ background: "linear-gradient(180deg,#2a2440 0%,#16121c 100%)", paddingTop: "calc(var(--app-safe-top) + 24px)" }}>
      <div className="max-w-[420px] mx-auto space-y-4">
        <h1 className="text-white text-[20px] font-black tracking-tight">Lembrete do dia 2 — os textos</h1>
        <p className="text-white/70 text-[12.5px] leading-snug">Como chegariam na tela de bloqueio, amanhã ({amanha.toLocaleDateString("pt-BR", { weekday: "long" })}). Um por dia, nos 7 primeiros dias.</p>
        {textos.map((t, i) => <Banner key={i} c={t.c} legenda={t.legenda} />)}
      </div>
    </div>
  );
};

export default DevDia2;
