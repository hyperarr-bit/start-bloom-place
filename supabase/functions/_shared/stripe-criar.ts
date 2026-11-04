/**
 * /oferta (04/11) — o corpo do stripe-criar → os parâmetros do PaymentIntent (puro; testado em src/test/stripe-webhook.test.ts).
 * O VALOR é SEMPRE o do servidor (STRIPE_PRECO_CENTAVOS): o corpo da página nunca leva preço que vale.
 * Metadata (≤ 500 caracteres cada, só texto): ref, pagina "oferta", e-mail, user_id da sessão, fbp, fbc, fbclid, url, IP, UA,
 * utm/ad e o momento — o webhook usa pra achar a conta e pra CAPI (o webhook é chamado pela Stripe: IP/UA só existem aqui).
 */
import { PAGINA_STRIPE, STRIPE_PRECO_CENTAVOS } from "./stripe.ts";

export type PedidoStripe = {
  ref: string; pi: string | null; email: string | null; fbp: string | null; fbc: string | null; fbclid: string | null; url: string | null;
  landing_session_id: string | null; landing_device_id: string | null; atrib: Record<string, string>;
};
const t = (v: unknown, n: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const ATRIB = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl"];
const SITES = ["https://www.coreaplicativo.com.br/", "https://coreaplicativo.com.br/"];
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarPedidoStripe(body: unknown): PedidoStripe | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const ref = t(b.ref, 64);
  if (!ref || !/^[A-Za-z0-9-]{8,64}$/.test(ref)) return null;
  const pi = t(b.pi, 80);
  const email = t(b.email, 254)?.toLowerCase() ?? null;
  const url = t(b.url, 500);
  const a = (b.atrib && typeof b.atrib === "object" ? b.atrib : {}) as Record<string, unknown>;
  const atrib: Record<string, string> = {};
  for (const k of ATRIB) { const v = t(a[k], 200); if (v) atrib[k] = v; }
  return {
    ref, pi: pi && /^pi_[A-Za-z0-9]+$/.test(pi) ? pi : null, email: email && EMAIL_OK.test(email) ? email : null,
    fbp: t(b.fbp, 120), fbc: t(b.fbc, 400), fbclid: t(b.fbclid, 300), url: url && SITES.some((s) => url.startsWith(s)) ? url : null,
    landing_session_id: t(b.landing_session_id, 64), landing_device_id: t(b.landing_device_id, 64), atrib,
  };
}

/** metadata do PI (só texto, sem chave vazia) */
export function metadataDoPedido(p: PedidoStripe, args: { userId: string | null; ip: string | null; ua: string | null; agoraIso: string }): Record<string, string> {
  const md: Record<string, string | null> = {
    ref: p.ref, pagina: PAGINA_STRIPE, email: p.email, user_id: args.userId, fbp: p.fbp, fbc: p.fbc, fbclid: p.fbclid, url: p.url,
    ip: args.ip && args.ua ? args.ip : null, ua: args.ip && args.ua ? args.ua.slice(0, 450) : null, sessao: p.landing_session_id, aparelho: p.landing_device_id,
    criado_em: args.agoraIso, ...p.atrib,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(md)) if (v) out[k] = String(v).slice(0, 500);
  return out;
}

/** o form-encoded do POST /v1/payment_intents (criar). Pix + cartão; parcelas no cartão (installments BR); Pix vale 30 min. */
export function paramsCriar(md: Record<string, string>, email: string | null): Array<[string, string]> {
  const out: Array<[string, string]> = [
    ["amount", String(STRIPE_PRECO_CENTAVOS)], ["currency", "brl"],
    ["payment_method_types[]", "card"], ["payment_method_types[]", "pix"],
    ["payment_method_options[card][installments][enabled]", "true"],
    ["payment_method_options[pix][expires_after_seconds]", "1800"],
    ["description", "CORE vitalicio"], ["statement_descriptor_suffix", "CORE"],
  ];
  if (email) out.push(["receipt_email", email]);
  for (const [k, v] of Object.entries(md)) out.push([`metadata[${k}]`, v]);
  return out;
}

/** o POST /v1/payment_intents/<id> (atualizar: o e-mail digitado na hora de pagar). O valor NÃO é reenviado. */
export function paramsAtualizar(md: Record<string, string>, email: string | null): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (email) out.push(["receipt_email", email], ["metadata[email]", email]);
  for (const k of ["user_id", "fbp", "fbc"]) if (md[k]) out.push([`metadata[${k}]`, md[k]]);
  return out;
}

export const formUrl = (pares: Array<[string, string]>) => pares.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

/* ───────── limite por IP (como o hotmart-iniciar) ───────── */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };
export const LIMITE_POR_IP = 20;
export const JANELA_IP_MS = 10 * 60_000;
export async function ipPodeCriar(admin: ClienteMin, ip: string | null, agoraMs: number = Date.now()): Promise<boolean> {
  if (!ip) return true;
  try {
    const { count, error } = await admin.from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event_name", "stripe_order_created").eq("event_data->>client_ip", ip)
      .gte("created_at", new Date(agoraMs - JANELA_IP_MS).toISOString());
    if (error || typeof count !== "number") return true;
    return count < LIMITE_POR_IP;
  } catch { return true; }
}

/** stripe-status: o PI é desta ref? Devolve só o que a página precisa. */
export function respostaStatus(pi: { metadata?: Record<string, string> | null; status?: string; latest_charge?: { payment_method_details?: { type?: string } } | string | null } | null, ref: string): { ok: boolean; status?: string; pago?: boolean; metodo?: string | null } {
  if (!pi || pi.metadata?.ref !== ref || pi.metadata?.pagina !== PAGINA_STRIPE) return { ok: false };
  const lc = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  return { ok: true, status: pi.status, pago: pi.status === "succeeded", metodo: lc?.payment_method_details?.type ?? null };
}
