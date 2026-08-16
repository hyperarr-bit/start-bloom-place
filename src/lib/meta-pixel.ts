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

import { fireTikTokEvent } from "@/lib/tiktok-pixel";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type MetaEvent = "ViewContent" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";

/**
 * Dispara um evento padrão do Meta Pixel — E DO TIKTOK JUNTO (16/08).
 *
 * O TikTok entra AQUI DENTRO, e não como chamada separada em cada tela, de
 * propósito: são 8 call-sites espalhados por 6 funis, e o custo de esquecer
 * um é invisível (a campanha simplesmente otimiza pior, sem erro nenhum na
 * tela). Um ponto só de disparo garante que os dois pixels vejam exatamente
 * os mesmos eventos, com o mesmo eventID — que é o que faz a deduplicação
 * funcionar dos dois lados quando o servidor manda a mesma compra.
 *
 * O nome da função ficou impreciso e eu preferi isso a renomear em 8
 * arquivos no meio de campanha rodando. Quem chegar aqui depois: `fireAdEvent`
 * abaixo é o alias com o nome certo — use ele em código novo.
 */
export const fireMetaEvent = (
  event: MetaEvent,
  params: Record<string, unknown> = {},
  eventID?: string,
) => {
  // TikTok primeiro: se o fbq não existir (bloqueador, rede), o return
  // adiantado do Meta não pode levar o TikTok junto.
  fireTikTokEvent(event, params, eventID);
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    if (eventID) window.fbq("track", event, params, { eventID });
    else window.fbq("track", event, params);
  } catch {
    /* swallow */
  }
};

/** Nome honesto pro que a função faz. Use este em código novo. */
export const fireAdEvent = fireMetaEvent;
