/**
 * ONBOARDING → CONTRATO NUMA TELA SÓ (10/10/2026, pra 1.0.14) — a chave.
 *
 * O que muda com a chave LIGADA (ComecarW, funil W do app): depois da demo, os
 * 3 "Claro!" (CompromissosPorRota) + o contrato assinado no dedo (ContratoScreen)
 * viram UMA tela, "Seu plano de 3 dias": os 3 compromissos da rota já marcados
 * (chips com ✓, dá pra desmarcar), 1 linha de contrato ("Eu vou dar 10 min por
 * dia ao meu CORE por 3 dias") e um botão "Fechado". Depois vem o paywall, como
 * hoje. O pedido de notificação NÃO se move (continua no meio do quiz).
 *
 * Por quê (funil do iPhone, 10/10): welcome→começar 84%, →paywall 63%,
 * paywall→toque 43%. Entre a demo e o paywall são 4 telas de "sim" (3 Claro! +
 * assinatura) — cada tela a mais é fuga, e a assinatura é o único passo que
 * exige o dedo trabalhar. Régua do dono (Enxovaly): ≥90% concluem o onboarding.
 *
 * DESLIGADA POR PADRÃO: `ONBOARDING_1TELA = "off"` = o funil de hoje, byte a
 * byte (mesmas telas, mesmos eventos — travado em src/test/onboarding-1tela.test.tsx).
 * Eventos com a chave ligada: `funnel_view step=plano_3_dias` (a tela) e, no
 * "Fechado", os MESMOS `funnel_quiz_answer step=compromisso_N answer=claro|nao`
 * de hoje (um por chip, pela marcação) + `funnel_click cta=contrato_assinou`
 * (a linha do contrato conta como assinada) — as séries antigas seguem
 * comparáveis. Rollback = "off" + build.
 *
 * QA pelo link (web ou shell de teste): `?onboarding-1tela=on|off|auto` — grava
 * no aparelho (a volta da demo é navegação completa, o link não vai junto).
 * A build `VITE_V14_QA=1` (lib/v14-qa) liga.
 */
import { v14Ligada } from "@/lib/v14-qa";

export type ModoOnboarding1Tela = "off" | "on";
export const ONBOARDING_1TELA: ModoOnboarding1Tela = "off";

export const PARAM_ONBOARDING_1TELA = "onboarding-1tela";
export const CHAVE_FORCA_ONBOARDING_1TELA = "onboarding-1tela-force";
/** O passo novo do funil W (só existe com a chave ligada). */
export const STEP_PLANO_3_DIAS = "plano_3_dias";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

export function guardarForcaOnboarding1Tela(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try {
    p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
  } catch { return; }
  const v = p.get(PARAM_ONBOARDING_1TELA);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_ONBOARDING_1TELA, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_ONBOARDING_1TELA);
}

export const forcaOnboarding1Tela = (): "on" | "off" | null => {
  const f = ls.get(CHAVE_FORCA_ONBOARDING_1TELA);
  return f === "on" || f === "off" ? f : null;
};

/** A tela única está ligada AQUI? força de QA > chave. */
export function onboarding1TelaLigado(modo: ModoOnboarding1Tela = ONBOARDING_1TELA): boolean {
  const f = forcaOnboarding1Tela();
  if (f === "on") return true;
  if (f === "off") return false;
  if (v14Ligada()) return true;
  return modo === "on";
}

/** A linha do contrato: com o nome quando ele existe (quem já tem conta), sem ele no funil frio. */
export const textoDoContrato = (nome?: string | null): string => {
  const n = (nome ?? "").trim();
  return n ? `Eu, ${n}, vou dar 10 min por dia ao meu CORE por 3 dias.` : "Eu vou dar 10 min por dia ao meu CORE por 3 dias.";
};

/**
 * Pra onde a volta da demo (`?step=compromissos`) e a retomada caem: com a chave
 * ligada, o passo "compromissos" (e o "contrato") É a tela única; desligada, a
 * tela única guardada vira os compromissos de hoje (rollback no meio do caminho).
 */
export function passoDoOnboarding(passo: string, ligado: boolean = onboarding1TelaLigado()): string {
  if (ligado) return passo === "compromissos" || passo === "contrato" ? STEP_PLANO_3_DIAS : passo;
  return passo === STEP_PLANO_3_DIAS ? "compromissos" : passo;
}
