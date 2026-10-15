/**
 * RASTREIO DA VENDA (/assinar, 15/10): Meta pixel + CAPI com o MESMO event_id (a Meta deduplica), e a sessão da venda.
 *
 *   · ViewContent (1ª carga da sessão) e InitiateCheckout (toque num plano): eventID `venda_vc_<uuid>` /
 *     `venda_ic_<uuid>` no fbq E na função `venda-capi` (servidor; sem os secrets ela não faz nada);
 *   · Purchase: quem manda pela CAPI é o servidor do pagamento (event_id = id do pedido, regra meta_capi_cakto):
 *       Pix  → asaas-pix "check" / asaas-webhook / pix-reconcile, event_id = id do QR. O navegador dispara pelo
 *              firePixPurchaseOnce (marca + conferência da assinatura, eventID = o MESMO id do QR);
 *       Cartão → cakto-webhook, event_id = id da compra na Cakto. O navegador só fica sabendo esse id quando a
 *              pessoa volta e a assinatura dela tem `abacatepay_billing_id` — aí dispara com ESSE id (aqui).
 *     Valor = o que foi pago (amount_cents da assinatura; sem ele, o preço do plano).
 *   · Nunca pixel na UTMify (regra meta_capi_cakto).
 */
import { supabase } from "@/integrations/supabase/client";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { trackEvent } from "@/lib/analytics";
import { PLANOS, type PlanoVenda } from "./conteudo";

const uuid = (): string => {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
};
export const novoEventId = (tipo: "vc" | "ic"): string => `venda_${tipo}_${uuid()}`;

const cookie = (n: string): string | null => {
  try { return document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1) ?? null; } catch { return null; }
};
export const cookiesDaMeta = () => ({ fbp: cookie("_fbp"), fbc: cookie("_fbc") });

/** Pixel + CAPI do mesmo evento. Nunca lança, nunca espera. */
export function eventoMeta(evento: "ViewContent" | "InitiateCheckout", eventId: string, params: Record<string, unknown>, fbcDaAttr?: string | null): void {
  fireMetaEvent(evento, params, eventId);
  try {
    const c = cookiesDaMeta();
    void supabase.functions.invoke("venda-capi", {
      body: {
        evento, event_id: eventId, url: window.location.href.slice(0, 500),
        fbp: c.fbp, fbc: c.fbc || fbcDaAttr || null,
        valor: typeof params.value === "number" ? params.value : null,
        conteudo: typeof params.content_name === "string" ? params.content_name : null,
      },
    }).catch(() => { /* fica o do navegador */ });
  } catch { /* noop */ }
}

/* ------------------------------------------------ a sessão da venda (separada da Porta) */
export const CHAVE_SESSAO_VENDA = "venda-sessao-v1";
let memoriaSessao: string | null = null;
export function _zerarSessaoVenda(): void { memoriaSessao = null; }
export function sessaoDaVenda(): { id: string; nova: boolean } {
  if (memoriaSessao) return { id: memoriaSessao, nova: false };
  try {
    const s = sessionStorage.getItem(CHAVE_SESSAO_VENDA);
    if (s) { memoriaSessao = s; return { id: s, nova: false }; }
  } catch { /* noop */ }
  memoriaSessao = uuid();
  try { sessionStorage.setItem(CHAVE_SESSAO_VENDA, memoriaSessao); } catch { /* noop */ }
  return { id: memoriaSessao, nova: true };
}

/* ------------------------------------------------ Purchase do cartão (na volta da Cakto) */
const CHAVE_COMPRAS = "venda-compras-disparadas";
const jaDisparadas = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_COMPRAS) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};

type LinhaPaga = { abacatepay_billing_id: string | null; amount_cents: number | null; billing_period: string | null; payment_method: string | null; status: string | null };

/**
 * A assinatura do CARTÃO desta conta (a que o cakto-webhook gravou). Dispara o Purchase 1x com eventID = id da compra
 * na Cakto (o mesmo da CAPI do webhook). Sem a linha (ainda não chegou, ou é outra forma de pagamento), não dispara:
 * a CAPI do servidor cobre sozinha — disparar com id errado faria a Meta contar 2 compras.
 */
export async function dispararCompraCartao(plano: PlanoVenda): Promise<{ disparou: boolean; valor: number | null }> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s?.session?.user?.id;
    if (!uid) return { disparou: false, valor: null };
    // amount_cents existe na tabela (as funções de pagamento gravam), mas não nos tipos gerados
    const { data } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { limit: (n: number) => Promise<{ data: unknown }> } } } })
      .from("subscriptions")
      .select("abacatepay_billing_id, amount_cents, billing_period, payment_method, status")
      .eq("user_id", uid)
      .limit(5);
    const linhas = (Array.isArray(data) ? data : []) as LinhaPaga[];
    const linha = linhas.find((l) => l.payment_method === "card" && l.status === "active" && l.abacatepay_billing_id) ?? null;
    if (!linha?.abacatepay_billing_id) return { disparou: false, valor: null };
    const id = linha.abacatepay_billing_id;
    const valor = linha.amount_cents && linha.amount_cents > 0 ? linha.amount_cents / 100 : PLANOS[plano].valor;
    if (jaDisparadas().includes(id)) return { disparou: false, valor };
    try { localStorage.setItem(CHAVE_COMPRAS, JSON.stringify([...jaDisparadas(), id].slice(-10))); } catch { /* noop */ }
    fireMetaEvent("Purchase", { value: valor, currency: "BRL", content_name: PLANOS[plano].conteudo }, id);
    trackEvent("venda_purchase_pixel", { plano, metodo: "cartao", order_id: id, valor });
    return { disparou: true, valor };
  } catch {
    return { disparou: false, valor: null };
  }
}
