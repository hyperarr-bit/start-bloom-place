/**
 * MÉTODO DE ESTUDO (22/09) — contas puras, sem React.
 *
 * Pedido do dono: "Se o objetivo for realmente aprender: 1. Time Blocking →
 * define quando estudar. 2. Pomodoro → controla o período de concentração.
 * 3. Active Recall → testa se você realmente aprendeu. 4. Feynman → explica
 * aquilo que ficou difícil. 5. Repetição espaçada → revisa para não esquecer."
 *
 * O módulo já tinha 3 dos 5 como ferramentas soltas (Pomodoro, flashcards
 * com revisão espaçada, caderno). O que entra aqui é a COSTURA: o bloco de
 * tempo vira um compromisso com aviso (lib/compromissos, o mesmo da Rotina),
 * a sessão guiada encadeia recall → pomodoro → Feynman, e a explicação de
 * Feynman vira um cartão novo (aprendizado) — que a repetição espaçada já
 * sabe agendar. Nada de tabela nova pra cartão.
 */
import { localDayKey } from "@/lib/utils";
import type { Compromisso } from "@/lib/compromissos";
import { misturarCursos, type Aprendizado, type AprendizadoComCurso, type AprendizadosPorCurso } from "./aprendizados";
import { vencimento, type Revisoes } from "./revisao";

export const CHAVE_SESSOES = "estudos-sessoes";
export const CHAVE_INTRO_FECHADA = "estudos-metodo-intro-fechada";
export const ORIGEM_ESTUDOS = "estudos";
export const TITULO_REVISAO_DIARIA = "Revisão dos flashcards";
/** Cartões por sessão: recall é aquecimento, não a revisão inteira do dia. */
export const CARTOES_POR_SESSAO = 5;

export interface SessaoEstudo {
  id: string;
  /** dia LOCAL (YYYY-MM-DD) */
  data: string;
  cursoId: string;
  cursoNome: string;
  /** quantos cartões foram respondidos e quantos "lembrei" */
  recall: { feitos: number; acertos: number };
  pomodoros: number;
  /** tema da explicação de Feynman (o que estudou) */
  tema?: string;
  travei?: boolean;
}

export const comoSessoes = (v: unknown): SessaoEstudo[] =>
  (Array.isArray(v) ? v : []).filter(
    (s): s is SessaoEstudo => !!s && typeof s === "object" && typeof (s as SessaoEstudo).id === "string" && typeof (s as SessaoEstudo).data === "string",
  );

/** Próxima data (YYYY-MM-DD) em que cai um dos dias da semana (0=seg…6=dom), contando de hoje. */
export const proximaData = (dias: number[], agora = new Date()): string => {
  const validos = dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!validos.length) return localDayKey(agora);
  for (let i = 0; i < 7; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
    if (validos.includes((d.getDay() + 6) % 7)) return localDayKey(d);
  }
  return localDayKey(agora);
};

/** O bloco de tempo é um compromisso comum da Rotina, etiquetado com o curso. */
export const blocoParaCompromisso = (
  b: { cursoId: string; cursoNome: string; hora: string; dias: number[]; aviso: number },
  id: string,
  agora = new Date(),
): Compromisso => ({
  id,
  titulo: `Estudar ${b.cursoNome}`,
  data: proximaData(b.dias, agora),
  hora: b.hora,
  repete: [...b.dias].sort((a, c) => a - c),
  aviso: b.aviso,
  origem: ORIGEM_ESTUDOS,
  ref: b.cursoId,
});

export const blocosDeEstudo = (lista: Compromisso[]): Compromisso[] =>
  (Array.isArray(lista) ? lista : []).filter((c) => c?.origem === ORIGEM_ESTUDOS && c.ref && c.titulo !== TITULO_REVISAO_DIARIA);

export const lembreteDiario = (lista: Compromisso[]): Compromisso | undefined =>
  (Array.isArray(lista) ? lista : []).find((c) => c?.origem === ORIGEM_ESTUDOS && c.titulo === TITULO_REVISAO_DIARIA);

export const compromissoDeRevisaoDiaria = (hora: string, id: string, agora = new Date()): Compromisso => ({
  id, titulo: TITULO_REVISAO_DIARIA, data: localDayKey(agora), hora, repete: [0, 1, 2, 3, 4, 5, 6], aviso: 0, origem: ORIGEM_ESTUDOS,
});

/**
 * Cartões da sessão de um curso: os vencidos primeiro (mais atrasado no topo),
 * depois os outros mais recentes — no máximo CARTOES_POR_SESSAO. Recall antes
 * de abrir o material: "o que você lembra?".
 */
export const cartoesDaSessao = (mapa: AprendizadosPorCurso, cursoId: string, cursoNome: string, revisoes: Revisoes, hoje = localDayKey(), max = CARTOES_POR_SESSAO): AprendizadoComCurso[] => {
  const todos = misturarCursos({ [cursoId]: mapa[cursoId] ?? [] }, { [cursoId]: cursoNome });
  const com = todos.map((a) => ({ a, vence: vencimento(a, revisoes) }));
  const vencidos = com.filter((x) => x.vence <= hoje).sort((x, y) => x.vence.localeCompare(y.vence));
  const resto = com.filter((x) => x.vence > hoje).sort((x, y) => (y.a.data || "").localeCompare(x.a.data || ""));
  return [...vencidos, ...resto].slice(0, max).map((x) => x.a);
};

/** A explicação de Feynman vira um cartão: frente = "explique X", verso = a própria explicação. */
export const aprendizadoDeFeynman = (tema: string, explicacao: string, travei: boolean, onde: string, id: string, hoje = localDayKey()): Aprendizado => ({
  id,
  data: hoje,
  referencia: "Feynman", // a lista do curso já imprime a data na frente
  aprendi: explicacao.trim(),
  porque: travei && onde.trim() ? `Travei em: ${onde.trim()}` : undefined,
  pergunta: `Explique com suas palavras: ${tema.trim()}`,
});

/** Compromisso de revisão pra amanhã quando a pessoa travou no Feynman. */
export const revisaoDeAmanha = (cursoNome: string, tema: string, hora: string, id: string, agora = new Date()): Compromisso => {
  const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return { id, titulo: `Revisar ${cursoNome}: ${tema.trim()}`.slice(0, 80), data: localDayKey(amanha), hora, aviso: 60, origem: ORIGEM_ESTUDOS };
};

const inicioDaSemana = (agora = new Date()): string => {
  const dow = (agora.getDay() + 6) % 7;
  return localDayKey(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - dow));
};

/** "Esta semana: 3 sessões · 5 pomodoros · 12 cartões (9 lembrados)". */
export const resumoDaSemana = (sessoes: SessaoEstudo[], agora = new Date()) => {
  const desde = inicioDaSemana(agora);
  const semana = comoSessoes(sessoes).filter((s) => s.data >= desde);
  return {
    sessoes: semana.length,
    pomodoros: semana.reduce((n, s) => n + (Number(s.pomodoros) || 0), 0),
    cartoes: semana.reduce((n, s) => n + (Number(s.recall?.feitos) || 0), 0),
    lembrados: semana.reduce((n, s) => n + (Number(s.recall?.acertos) || 0), 0),
  };
};
