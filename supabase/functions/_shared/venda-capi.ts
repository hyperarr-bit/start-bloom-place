/**
 * CAPI DA VENDA DA WEB (/assinar, 15/10) — parte PURA (validação + montagem). A função `venda-capi` só chama isto e
 * manda pro /events do pixel do site (META_PIXEL_ID / META_CAPI_TOKEN, os mesmos das compras).
 *
 * Só ViewContent e InitiateCheckout (o Purchase sai das funções de pagamento, com event_id = id do pedido). O
 * event_id é o MESMO do fbq do navegador (`venda_vc_<uuid>` / `venda_ic_<uuid>`) → a Meta deduplica.
 * user_data: fbp/fbc do clique + o user agent do pedido (a Meta pede pra evento de site). SEM IP (como a CAPI do
 * cadastro da Porta: só com ok do dono). Sem login: a página ainda não tem conta quando estes eventos saem.
 * Testado no vitest (src/test/venda-web-servidor.test.ts).
 */
export const EVENTOS_VENDA = ["ViewContent", "InitiateCheckout"] as const;
export type EventoVenda = (typeof EVENTOS_VENDA)[number];
const PREFIXO: Record<EventoVenda, string> = { ViewContent: "venda_vc_", InitiateCheckout: "venda_ic_" };
const CONTEUDOS = new Set(["venda_web", "core_anual_web", "core_mensal_web"]);
const SITE = "https://coreaplicativo.com.br";

export type PedidoCapiVenda = {
  evento: EventoVenda; event_id: string; url: string; fbp: string | null; fbc: string | null; valor: number | null; conteudo: string | null;
};

const texto = (v: unknown, n: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

/** Puro: o corpo vira pedido válido, ou null (recusa em silêncio). */
export function validarPedido(body: unknown): PedidoCapiVenda | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const evento = b.evento as EventoVenda;
  if (!EVENTOS_VENDA.includes(evento)) return null;
  const id = texto(b.event_id, 80);
  if (!id || !id.startsWith(PREFIXO[evento]) || !/^venda_(vc|ic)_[a-z0-9-]{8,60}$/i.test(id)) return null;
  const urlBruta = texto(b.url, 500) ?? "";
  const url = urlBruta.startsWith(`${SITE}/assinar`) || urlBruta.startsWith("https://www.coreaplicativo.com.br/assinar") ? urlBruta : `${SITE}/assinar`;
  const fbp = texto(b.fbp, 200);
  const fbc = texto(b.fbc, 500);
  const valor = typeof b.valor === "number" && b.valor > 0 && b.valor < 1000 ? Math.round(b.valor * 100) / 100 : null;
  const conteudo = texto(b.conteudo, 40);
  return {
    evento, event_id: id, url,
    fbp: fbp && /^fb\.\d\.\d+\.\d+$/.test(fbp) ? fbp : null,
    fbc: fbc && /^fb\.\d\.\d+\./.test(fbc) ? fbc : null,
    valor, conteudo: conteudo && CONTEUDOS.has(conteudo) ? conteudo : null,
  };
}

/** Puro: o evento que vai pro /events. */
export function montarEventoVenda(p: PedidoCapiVenda, userAgent: string | null, agoraMs = Date.now()): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  if (p.fbp) userData.fbp = p.fbp;
  if (p.fbc) userData.fbc = p.fbc;
  if (userAgent) userData.client_user_agent = userAgent.slice(0, 400);
  const custom: Record<string, unknown> = { currency: "BRL" };
  if (p.conteudo) custom.content_name = p.conteudo;
  if (p.valor != null) custom.value = p.valor;
  return {
    event_name: p.evento,
    event_time: Math.floor(agoraMs / 1000),
    event_id: p.event_id,
    action_source: "website",
    event_source_url: p.url,
    user_data: userData,
    custom_data: custom,
  };
}
