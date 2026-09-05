/**
 * DEMO GUIADA (v105, 05/09) — os 3 passos do coach-mark por módulo.
 *
 * Medido em 7 dias (2.227 aberturas da demo): 14% saem do app DENTRO da demo
 * (finanças 11%, rotina 20%, treino 18%, metas 23%), mediana de 25s, 36%
 * pulam de módulo, e todo mundo via a mesma dica genérica de 6s. Quem volta
 * da demo toca mais no paywall do que quem nunca a viu — a demo vende; o
 * custo é gente se perdendo nela. O coach aponta, no módulo que a pessoa
 * escolheu, o que vale ver, onde ficam as abas e por onde voltar pro plano.
 *
 * Aqui só conteúdo e funções puras (testáveis sem tela). Os alvos são
 * resolvidos em runtime pelo DemoCoach: seletor estável quando o módulo já
 * tinha um; `data-coach` onde não tinha nenhum.
 */
export interface PassoCoach {
  titulo: string;
  texto: string;
  /** Resolve o elemento alvo na hora — null = sem spotlight, card no centro. */
  alvo: () => Element | null;
}

const porSeletor = (sel: string) => (): Element | null => {
  try { return document.querySelector(sel); } catch { return null; }
};

/** A linha de abas do módulo: os 16 módulos desenham as abas como `.notion-tab`
 *  dentro de uma linha rolável — o pai da 1ª aba é a linha inteira. A barra
 *  do tour usa pílulas próprias, então a 1ª `.notion-tab` é sempre a do módulo. */
const linhaDeAbas = (): Element | null => {
  try { return document.querySelector(".notion-tab")?.parentElement ?? null; } catch { return null; }
};

const abas = (titulo: string, texto: string): PassoCoach => ({ titulo, texto, alvo: linhaDeAbas });

/** 3º passo, igual em todo módulo: a barra do tour com os outros módulos. */
const PASSO_MODULOS: PassoCoach = {
  titulo: "E os outros 15 módulos a um toque",
  texto: "Rotina, treino, dieta, casa… tudo no mesmo app, sem pagar à parte.",
  alvo: porSeletor(".demo-tour-nav"),
};

const PASSOS: Record<string, PassoCoach[]> = {
  financas: [
    {
      titulo: "Seu mês fechado sozinho",
      texto: "Receitas, despesas e o que sobrou — sem planilha, sem conta de cabeça.",
      alvo: porSeletor('[data-coach="resumo"]'),
    },
    abas("Contas que avisam antes do juros", "Na aba Meu financeiro, cada conta tem data e lembrete na véspera."),
    PASSO_MODULOS,
  ],
  rotina: [
    {
      titulo: "Marca o hábito em um toque",
      texto: "Água, treino, leitura: a sequência cresce sozinha e te puxa de volta.",
      alvo: porSeletor('[data-coach="habitos"]'),
    },
    abas("Sua semana hora a hora", "Na aba Minha semana, o dia já vem montado. Você só segue."),
    PASSO_MODULOS,
  ],
  treino: [
    {
      titulo: "Seu treino de hoje, pronto",
      texto: "Séries, cargas e descanso já montados. É só marcar o que fez.",
      alvo: porSeletor('[data-coach="treino-hoje"]'),
    },
    abas("Semana, config e progressão", "Na aba Semana você vê os treinos da semana; em Progressão, a carga subindo."),
    PASSO_MODULOS,
  ],
  saude: [
    {
      titulo: "Água, sono e humor num lugar",
      texto: "Registra em um toque e o CORE te lembra na hora certa.",
      // o 1º card da aba Hoje (hidratação); o wrapper leva o gancho
      alvo: porSeletor('[data-coach="saude-hoje"] > :first-child'),
    },
    abas("Evolução e log médico", "Na aba Evolução, peso e medidas viram gráfico; no Log médico, consultas e exames ficam guardados."),
    PASSO_MODULOS,
  ],
  desenvolvimento: [
    {
      titulo: "Sua meta vira um plano",
      texto: "Passos da semana, não desejos. O progresso aparece toda vez que você abre.",
      alvo: porSeletor('[data-coach="metas"]'),
    },
    abas("Diário, humor e desafio de 30 dias", "Cada aba é uma ferramenta: reflexão do dia, score da semana, respiração guiada."),
    PASSO_MODULOS,
  ],
};

/** Passos do módulo; módulo sem roteiro próprio cai no de finanças. */
export const passosDoCoach = (module: string): PassoCoach[] => PASSOS[module] ?? PASSOS.financas;

/* ── 1× por sessão ─────────────────────────────────────────────────────── */
export const COACH_SESSION_KEY = "core-demo-coach";
export const coachJaVisto = (): boolean => {
  try { return sessionStorage.getItem(COACH_SESSION_KEY) === "1"; } catch { return false; }
};
export const marcarCoachVisto = (): void => {
  try { sessionStorage.setItem(COACH_SESSION_KEY, "1"); } catch { /* modo privado */ }
};

/* ── geometria (pura) ──────────────────────────────────────────────────── */
export interface Retangulo { top: number; left: number; width: number; height: number }

/** Alvo "de verdade" = existe e tem tamanho (elemento escondido mede 0). */
export const alvoVisivel = (r: Retangulo | null | undefined): r is Retangulo =>
  !!r && r.width > 0 && r.height > 0;

/** Folga em volta do alvo e limite pra não sair da tela. */
export const retanguloDoSpotlight = (r: Retangulo, vw: number, vh: number, folga = 6): Retangulo => {
  const left = Math.max(4, r.left - folga);
  const top = Math.max(4, r.top - folga);
  const right = Math.min(vw - 4, r.left + r.width + folga);
  const bottom = Math.min(vh - 4, r.top + r.height + folga);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
};

export type LugarDoCard = "abaixo" | "acima" | "centro";

/**
 * Onde o card pousa: abaixo do spotlight se couber antes do CTA fixo; senão
 * acima, se couber abaixo dos headers grudados; alvo alto demais encosta na
 * base por cima dele. Sem alvo, no meio da tela.
 */
export const posicaoDoCard = (
  spot: Retangulo | null,
  alturaCard: number,
  vh: number,
  reservaTopo: number,
  reservaBase: number,
  vao = 12,
): { lugar: LugarDoCard; top: number } => {
  if (!spot) return { lugar: "centro", top: Math.max(reservaTopo, (vh - alturaCard) / 2) };
  const abaixo = spot.top + spot.height + vao;
  if (abaixo + alturaCard <= vh - reservaBase) return { lugar: "abaixo", top: abaixo };
  const acima = spot.top - vao - alturaCard;
  if (acima >= reservaTopo) return { lugar: "acima", top: acima };
  return { lugar: "abaixo", top: Math.max(reservaTopo, vh - reservaBase - alturaCard) };
};
