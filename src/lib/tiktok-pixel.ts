/**
 * Eventos do TikTok Pixel (browser side) — espelho do meta-pixel.ts.
 *
 * Por que existe (16/08): o TikTok já tinha o snippet no index.html desde
 * sempre, mas SÓ com ttq.page() — nenhum evento de conversão. Ou seja: a
 * campanha do TikTok nunca soube quem comprou, exatamente o mesmo buraco que
 * estrangulou a Meta até 10/08. Sem evento de compra o algoritmo otimiza por
 * clique e a verba vira aposta cega.
 *
 * DEDUP: o event_id vai no 3º parâmetro do ttq.track e é o MESMO orderId da
 * Cakto que o Meta usa. O servidor (cakto-webhook) manda o CompletePayment
 * com o mesmo id — a chave de dedup do TikTok é (event_source_id, event,
 * event_id) por 48h. Trocar um dos dois lados quebra a dedup em silêncio e o
 * relatório dobra, como já aconteceu com a Meta em 11/08.
 *
 * NOME DIFERENTE: o evento de compra no TikTok chama "CompletePayment", não
 * "Purchase". Mandar "Purchase" não dá erro — ele entra como evento
 * customizado e NÃO conta como conversão pra otimização. Por isso o mapa
 * abaixo em vez de repassar o nome cru.
 */

declare global {
  interface Window {
    ttq?: {
      track: (event: string, params?: Record<string, unknown>, opts?: Record<string, unknown>) => void;
      identify?: (params: Record<string, unknown>) => void;
      page?: () => void;
    };
  }
}

/** Nomes canônicos do nosso funil (os mesmos do meta-pixel). */
export type AdEvent = "ViewContent" | "CompleteRegistration" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

/** Meta → TikTok. Só o Purchase muda de nome; o resto é idêntico. */
const NOME_TIKTOK: Record<AdEvent, string> = {
  ViewContent: "ViewContent",
  CompleteRegistration: "CompleteRegistration",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  Purchase: "CompletePayment",
};

/** Dispara um evento padrão do TikTok Pixel. No-op se o pixel não carregou. */
export const fireTikTokEvent = (
  event: AdEvent,
  params: Record<string, unknown> = {},
  eventID?: string,
) => {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  try {
    // O TikTok espera content_type junto de value/currency pra tratar como
    // conversão de e-commerce; sem isso o valor entra mas o evento fica magro.
    const corpo: Record<string, unknown> = { ...params };
    if (corpo.value !== undefined && corpo.content_type === undefined) {
      corpo.content_type = "product";
    }
    if (eventID) window.ttq.track(NOME_TIKTOK[event], corpo, { event_id: eventID });
    else window.ttq.track(NOME_TIKTOK[event], corpo);
  } catch {
    /* swallow — telemetria nunca derruba venda */
  }
};

/**
 * Advanced matching do TikTok: liga o e-mail à sessão do navegador. O TikTok
 * hasheia sozinho (o SDK faz SHA-256 antes de mandar), então passamos em
 * texto — é o contrato deles, diferente do CAPI server-side onde o hash é
 * nosso. Chamar no login/cadastro melhora o match de TODOS os eventos
 * seguintes daquela sessão.
 */
export const identifyTikTok = (email: string | null | undefined) => {
  if (typeof window === "undefined" || typeof window.ttq?.identify !== "function") return;
  const limpo = String(email ?? "").trim().toLowerCase();
  if (!limpo || !limpo.includes("@")) return;
  try {
    window.ttq.identify({ email: limpo });
  } catch {
    /* swallow */
  }
};
