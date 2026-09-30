/**
 * QUIZ CURTO — teste do Dia 1 do plano "ROI 2 em 7 dias" (30/09/2026).
 *
 * O que os dados dizem (scratchpad web-roi2-7dias/quiz.md, 22→29/09, web):
 * de quem vê a 1ª pergunta, 24% não chegam na demo. A 1ª tela do quiz perde
 * 12% (é o "bounce" depois da porta, qualquer que seja a pergunta) e cada
 * tela seguinte perde 2–4%. O quiz de dinheiro tem 5 perguntas + a tela de
 * impacto; as outras trilhas, 4 + impacto. Só DUAS respostas alimentam o
 * resto do funil: `gasto` (tela de impacto + âncora do paywall) e `vitoria`
 * (radar + título do paywall); nas outras trilhas, `consistencia` (impacto)
 * e `vitoria`. "atrapalha", "controle" e "compromisso" não são lidas por
 * nenhuma tela do /inicio.
 *
 * O braço CURTO mantém só as perguntas que personalizam (2) + a tela de
 * impacto, na mesma ordem. Ganho esperado: +5–8% de gente na demo, sem
 * perder personalização. Hipótese a medir, não promessa.
 *
 * DESLIGADO POR PADRÃO: `QUIZ_CURTO = "off"` é o funil de hoje, byte a byte
 * (nenhum evento ganha campo novo). "ab" sorteia na porta (toque na área),
 * 50/50, braço guardado em localStorage e carimbado nos eventos do funil
 * (`quiz: "curto" | "cheio"`), pra ler R$/sessão por braço. "on" = todo
 * mundo no curto. Rollback = "off" + push.
 * QA sem mexer no funil de ninguém: localStorage `quiz-curto-force` = "on" | "off".
 */
import type { AreaKey, QuizQ } from "@/lib/funnel";

export type ModoQuizCurto = "off" | "ab" | "on";
export type BracoQuiz = "curto" | "cheio";

export const QUIZ_CURTO: ModoQuizCurto = "off";
/** Fatia que cai no quiz curto quando QUIZ_CURTO = "ab". */
export const QUIZ_CURTO_FATIA = 0.5;

export const CHAVE_FORCA_QUIZ_CURTO = "quiz-curto-force";
/** O braço sorteado nesta sessão (a volta da demo cai no cadastro, que não passa pelo quiz — mas o admin lê pelos eventos). */
export const CHAVE_BRACO_QUIZ = "funnel-quiz-braco";

/** As perguntas que ficam no braço curto, por trilha — só as que alguma tela lê depois. */
export const PERGUNTAS_CURTAS: Record<AreaKey, readonly string[]> = {
  dinheiro: ["gasto", "vitoria"],
  rotina: ["consistencia", "vitoria"],
  corpo: ["consistencia", "vitoria"],
  saude: ["consistencia", "vitoria"],
  metas: ["consistencia", "vitoria"],
};

export const forcaDoQuizCurto = (): "on" | "off" | null => {
  try {
    const f = localStorage.getItem(CHAVE_FORCA_QUIZ_CURTO);
    return f === "on" || f === "off" ? f : null;
  } catch {
    return null; // storage bloqueado (webview): vale a chave
  }
};

/** Sorteio na porta. `null` = fora do experimento: o quiz de hoje, sem campo novo em evento nenhum. */
export function sortearBracoDoQuiz(modo: ModoQuizCurto = QUIZ_CURTO, sorte: () => number = Math.random): BracoQuiz | null {
  const f = forcaDoQuizCurto();
  if (f === "on") return "curto";
  if (f === "off") return null;
  if (modo === "on") return "curto";
  if (modo === "ab") return sorte() < QUIZ_CURTO_FATIA ? "curto" : "cheio";
  return null;
}

export function guardarBracoDoQuiz(braco: BracoQuiz | null): void {
  try {
    if (braco) localStorage.setItem(CHAVE_BRACO_QUIZ, braco);
    else localStorage.removeItem(CHAVE_BRACO_QUIZ);
  } catch { /* noop */ }
}

/** O braço guardado (recarga no meio do quiz). Só vale se a chave ainda estiver ligada. */
export function bracoGuardadoDoQuiz(modo: ModoQuizCurto = QUIZ_CURTO): BracoQuiz | null {
  const f = forcaDoQuizCurto();
  if (f === "on") return "curto";
  if (f === "off" || modo === "off") return null;
  try {
    const b = localStorage.getItem(CHAVE_BRACO_QUIZ);
    return b === "curto" || b === "cheio" ? b : null;
  } catch {
    return null;
  }
}

/** As perguntas da trilha no braço dado. "cheio"/null = a lista de hoje, o MESMO array. */
export function perguntasDoBraco(track: QuizQ[], area: AreaKey | null, braco: BracoQuiz | null): QuizQ[] {
  if (braco !== "curto" || !area) return track;
  const fica = PERGUNTAS_CURTAS[area];
  const curto = track.filter((q) => fica.includes(q.key));
  // nunca deixa o quiz vazio (trilha sem as chaves esperadas = o quiz de hoje)
  return curto.length ? curto : track;
}
