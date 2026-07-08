/**
 * Eventos do Meta Pixel (browser side) pro funil /comecar.
 *
 * A COMPRA não é disparada aqui — ela vem server-side da Cakto (API de
 * Conversões), que é quem enxerga o pagamento aprovado (inclusive Pix pago
 * horas depois). Aqui a gente só manda o topo/meio do funil pro Meta ter
 * sinal de intenção e casar o visitante com o clique do anúncio (_fbc).
 *
 * PageView já dispara no index.html (código base do pixel).
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type MetaEvent = "ViewContent" | "CompleteRegistration" | "InitiateCheckout";

/** Dispara um evento padrão do Meta Pixel. No-op se o pixel não carregou. */
export const fireMetaEvent = (
  event: MetaEvent,
  params: Record<string, unknown> = {},
) => {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq("track", event, params);
  } catch {
    /* swallow */
  }
};
