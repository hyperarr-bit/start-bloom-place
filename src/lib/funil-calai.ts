/**
 * FUNIL DO iPHONE ENXUTO NOS PRINCÍPIOS DO CAL AI (10/10/2026, pra 1.0.14) — a chave.
 *
 * O que muda com a chave LIGADA (ComecarW, funil W do app), na ordem:
 *
 *   welcome          → estilo Cal AI: um iPhone no centro com VÍDEO em loop do app
 *                      real (mudo, inline), uma frase, "Começar" (que pede o ATT como
 *                      hoje) e "Já tem conta? Entrar" + rodapé legal. Substitui a
 *                      welcome da grade azul E os 3 quadros de promessa.
 *   porta            → igual ("qual área tá fora de controle").
 *   quiz             → só 2 perguntas: a dor (quiz_1) e o NÚMERO da rota (dinheiro:
 *                      quiz_3 "quanto some por mês"; outras rotas: quiz_2
 *                      "consistência"). Caem "como controla", "topa 5 min" (o
 *                      compromisso vive só no plano) e "vitória em 7 dias".
 *   grafico_com_sem  → NOVO: "sem o CORE × com o CORE" com o número dela
 *                      (lib/funil-numeros), no lugar da prova do gasto.
 *   notif            → o convite de notificação, DEPOIS do gráfico (hoje ele é um
 *                      slide no meio do quiz; passa a ser um passo próprio).
 *   prova → progress → result  → iguais.
 *   central + demo   → CORTADOS (o vídeo da welcome já mostra o app).
 *   plano_3_dias     → (ONBOARDING_1TELA) → offer, como hoje.
 *
 * Por quê (funil do iPhone, 10/10, 2.390 sessões): abre→paywall 62% (meta 75%). A
 * welcome perde 18%, a demo perde 13% e só 33% abrem o 2º módulo; entre a porta e
 * a prova social são 8 telas de pergunta. Cal AI: promessa + demo do momento mágico
 * em 10 s, perguntas só as que personalizam, gráfico no meio, plano, paywall.
 *
 * DESLIGADA POR PADRÃO: `FUNIL_CALAI = "off"` = o funil de hoje byte a byte (mesmas
 * telas, mesmos eventos — travado em src/test/funil-calai.test.tsx). Com a chave
 * ligada os passos que FICAM mantêm o nome de evento de hoje (`funnel_view
 * step=welcome|start|quiz_1|quiz_3|prova_social|progress|result|offer`) — a régua
 * abre→paywall continua comparável; os passos novos têm nome próprio
 * (`grafico_com_sem`, `notif`). Rollback = "off" + build.
 *
 * QA pelo link (web ou shell de teste): `?funil-calai=on|off|auto` — grava no
 * aparelho. A build `VITE_V14_QA=1` (lib/v14-qa) liga.
 */
import { v14Ligada } from "@/lib/v14-qa";
import { modo1012 } from "@/lib/modo-1012";

export type ModoFunilCalai = "off" | "on";
export const FUNIL_CALAI: ModoFunilCalai = "off";

export const PARAM_FUNIL_CALAI = "funil-calai";
export const CHAVE_FORCA_FUNIL_CALAI = "funil-calai-force";

/** O passo novo do funil W (só existe com a chave ligada). */
export const STEP_GRAFICO_COM_SEM = "grafico_com_sem";
/** O convite de notificação como passo próprio (com a chave ligada; hoje é um slide dentro do quiz). */
export const STEP_NOTIF = "notif";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

export function guardarForcaFunilCalai(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try {
    p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
  } catch { return; }
  const v = p.get(PARAM_FUNIL_CALAI);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_FUNIL_CALAI, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_FUNIL_CALAI);
}

export const forcaFunilCalai = (): "on" | "off" | null => {
  const f = ls.get(CHAVE_FORCA_FUNIL_CALAI);
  return f === "on" || f === "off" ? f : null;
};

/** O funil enxuto está ligado AQUI? força de QA > build de QA > chave. */
export function funilCalaiLigado(modo: ModoFunilCalai = FUNIL_CALAI): boolean {
  if (modo1012()) return false; // 1.0.21 modo 1.0.12: o funil antigo, com a demo
  const f = forcaFunilCalai();
  if (f === "on") return true;
  if (f === "off") return false;
  if (v14Ligada()) return true;
  return modo === "on";
}

/**
 * Tradução de um passo GUARDADO (retomada, deep link) pra sequência em vigor —
 * a chave pode ter virado entre a gravação e a leitura (rollback no meio do caminho).
 *
 *   ligada:   promessas → porta (não existe mais); central → compromissos (o plano
 *             vem logo depois do resultado; `passoDoOnboarding` leva pra tela única
 *             quando ONBOARDING_1TELA também está ligada).
 *   desligada: grafico_com_sem e notif → quiz (as respostas ficaram guardadas; o
 *             quiz de hoje reconstrói a partir delas).
 */
export function passoDoFunilCalai(passo: string, ligado: boolean = funilCalaiLigado()): string {
  if (ligado) {
    if (passo === "promessas") return "porta";
    if (passo === "central") return "compromissos";
    return passo;
  }
  if (passo === STEP_GRAFICO_COM_SEM || passo === STEP_NOTIF) return "quiz";
  return passo;
}
