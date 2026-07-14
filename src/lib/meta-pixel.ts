/**
 * Eventos do Meta Pixel (browser side) pro funil /comecar.
 *
 * A COMPRA agora dispara AQUI TAMBÉM (PixCheckout, tela de confirmação):
 * com o Pix in-app via API da Cakto (13/07), a venda não passa mais pelo
 * checkout hospedado — a CAPI/pixel da Cakto nunca vê o pedido e as vendas
 * sumiam do gerenciador/UTMify. O comprador está NA tela quando o pagamento
 * confirma, então o browser tem o melhor match possível (_fbc/_fbp).
 * eventID = orderId da Cakto — se um dia uma CAPI server-side entrar, é só
 * usar o mesmo ID que o Meta deduplica.
 *
 * PageView já dispara no index.html (código base do pixel).
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type MetaEvent = "ViewContent" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";

/** Dispara um evento padrão do Meta Pixel. No-op se o pixel não carregou. */
export const fireMetaEvent = (
  event: MetaEvent,
  params: Record<string, unknown> = {},
  eventID?: string,
) => {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    if (eventID) window.fbq("track", event, params, { eventID });
    else window.fbq("track", event, params);
  } catch {
    /* swallow */
  }
};
