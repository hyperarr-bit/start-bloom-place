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
import { responder, vencimento, type EstadoRevisao, type Resposta, type Revisoes } from "./revisao";

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

/* ───────────────────────── MÉTODO SOCRÁTICO (22/09) ─────────────────────────
 * Pedido de cliente (já tinha aparecido em 11/09) e do dono: "também é
 * sensacional se conseguir inserir". Sem IA: é a escada clássica de perguntas
 * socráticas (clareza → suposições → evidência → outro ponto de vista →
 * consequência → a pergunta que falta), uma de cada vez, que a pessoa responde
 * sozinha sobre um tema. Cada resposta vira um cartão do curso (frente = a
 * pergunta, verso = a resposta) — então o que ela descobriu entra na mesma
 * repetição espaçada dos outros cartões. */
export const PERGUNTAS_SOCRATICAS: { tipo: string; pergunta: (tema: string) => string; dica: string }[] = [
  { tipo: "Clareza", pergunta: (t) => `O que é ${t}, numa frase sua?`, dica: "Sem copiar a definição do material." },
  { tipo: "Suposições", pergunta: (t) => `O que você está assumindo como verdade sobre ${t}?`, dica: "O que precisa ser verdade pra isso funcionar?" },
  { tipo: "Evidência", pergunta: (t) => `Como você sabe disso sobre ${t}? Dê um exemplo.`, dica: "Um caso real, um exercício, um dado." },
  { tipo: "Outro ponto de vista", pergunta: (t) => `Como alguém que discorda explicaria ${t}?`, dica: "Qual a objeção mais forte?" },
  { tipo: "Consequência", pergunta: (t) => `Se isso sobre ${t} é verdade, o que mais precisa ser verdade?`, dica: "Onde isso se aplica? O que muda?" },
  { tipo: "A pergunta que falta", pergunta: (t) => `Que pergunta sobre ${t} você ainda não sabe responder?`, dica: "Essa é a próxima coisa a estudar." },
];

/** Respostas → cartões do curso. Resposta vazia não vira cartão. */
export const cartoesSocraticos = (tema: string, respostas: string[], idBase: string, hoje = localDayKey()): Aprendizado[] => {
  const t = tema.trim();
  return PERGUNTAS_SOCRATICAS.flatMap((p, i) => {
    const r = (respostas[i] ?? "").trim();
    if (!r) return [];
    const ultima = i === PERGUNTAS_SOCRATICAS.length - 1;
    return [{
      id: `${idBase}-${i}`,
      data: hoje,
      referencia: `Socrático · ${p.tipo}`,
      pergunta: ultima ? `Dúvida em aberto sobre ${t}` : p.pergunta(t),
      aprendi: r,
      porque: ultima ? "Pergunta que você levantou — procure a resposta e revise." : undefined,
    }];
  });
};

/* ─────────────── referências aplicadas (22/09, dono: "vê referências") ───────────────
 * Anki mostra, em cada botão de resposta, QUANDO o cartão volta — a pessoa
 * entende a repetição espaçada sem ler explicação. RemNote/Duolingo abrem
 * com UM próximo passo em vez de um menu. */
const diasEntre = (de: string, ate: string) => {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400e3);
};

export const rotuloIntervalo = (dias: number): string =>
  dias <= 1 ? "amanhã"
  : dias < 14 ? `${dias} dias`
  : dias < 30 ? `${Math.round(dias / 7)} sem`
  : dias < 60 ? "1 mês"
  : `${Math.round(dias / 30)} meses`;

/** "volta em …" de cada resposta, calculado pela mesma régua que grava. */
export const intervalosDasRespostas = (atual: EstadoRevisao | undefined, hoje = localDayKey()): Record<Resposta, string> => ({
  nao: rotuloIntervalo(diasEntre(hoje, responder(atual, "nao", hoje).proxima)),
  quase: rotuloIntervalo(diasEntre(hoje, responder(atual, "quase", hoje).proxima)),
  sim: rotuloIntervalo(diasEntre(hoje, responder(atual, "sim", hoje).proxima)),
});

export type ProximoPasso = { acao: "revisao" | "blocos" | "sessao" | "cursos"; texto: string; botao: string };

/** O que fazer agora, em ordem de valor: revisar o que vence > ter horário > estudar. */
export const proximoPasso = (o: { temCurso: boolean; venceHoje: number; blocos: number; sessoesHoje: number }): ProximoPasso => {
  if (!o.temCurso) return { acao: "cursos", texto: "Cadastre o curso ou a matéria que você está estudando.", botao: "Cadastrar curso" };
  if (o.venceHoje > 0) return { acao: "revisao", texto: `${o.venceHoje} ${o.venceHoje === 1 ? "cartão vence" : "cartões vencem"} hoje. Leva ~${Math.max(1, Math.ceil(o.venceHoje / 3))} min.`, botao: "Revisar agora" };
  if (o.blocos === 0) return { acao: "blocos", texto: "Quem estuda com hora marcada estuda mais. Defina seus horários.", botao: "Marcar horário" };
  if (o.sessoesHoje === 0) return { acao: "sessao", texto: "Revisões em dia. Bora estudar: sessão guiada de ~30 min.", botao: "Começar sessão" };
  return { acao: "sessao", texto: "Sessão de hoje feita. Mais uma rodada?", botao: "Nova sessão" };
};
