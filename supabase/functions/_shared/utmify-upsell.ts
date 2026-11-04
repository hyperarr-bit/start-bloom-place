/**
 * A UTMify do UPSELL no pix-reconcile (crítica r1, 31/10). O reconcile nunca mandou a UTMify (painel secundário), mas o
 * upsell (u2027, pv149) NÃO manda Purchase pra Meta (_shared/pix-upsell.ts META_PURCHASE_UPSELL): quando o reconcile é
 * quem salva a venda, a trava `capi` dele fica tomada e o check/webhook não mandam mais nada — a venda sumia do painel.
 * O mesmo payload do asaas-webhook (UTMs do último evento da conta ou da sessão anônima). Nunca lança.
 */
import { nomeDoProduto, planoUtmify } from "./email-venda.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

const carimbo = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

export function payloadUtmifyUpsell(a: {
  orderId: string; offer: string; amountCents: number; email: string | null; utm: Record<string, string | null>; agora?: Date;
}): Record<string, unknown> {
  const t = carimbo(a.agora ?? new Date());
  return {
    orderId: a.orderId, platform: "Asaas", paymentMethod: "pix", status: "paid", createdAt: t, approvedDate: t, refundedAt: null,
    customer: { name: a.email?.split("@")[0] || "Cliente", email: a.email || "", phone: null, document: null, country: "BR" },
    products: [{ id: a.offer, name: nomeDoProduto({ offer: a.offer }), planId: null, planName: planoUtmify(a.offer), quantity: 1, priceInCents: a.amountCents }],
    trackingParameters: { src: null, sck: null, ...a.utm },
    commission: { totalPriceInCents: a.amountCents, gatewayFeeInCents: 0, userCommissionInCents: a.amountCents },
    isTest: false,
  };
}

export async function utmifyUpsell(admin: ClienteMin, a: {
  token: string | null | undefined; userId: string; email: string | null; orderId: string; offer: string; amountCents: number;
  enviar?: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;
}): Promise<string> {
  if (!a.token) return "sem_token";
  try {
    const pick = (d: Record<string, string> | null | undefined) => ({
      utm_source: d?.utm_source || null, utm_medium: d?.utm_medium || null, utm_campaign: d?.utm_campaign || null, utm_content: d?.utm_content || null, utm_term: d?.utm_term || null,
    });
    const { data: rows } = await admin.from("analytics_events").select("event_data, session_id").eq("user_id", a.userId).order("created_at", { ascending: false }).limit(60);
    const mine = (rows ?? []) as Array<{ event_data: Record<string, string>; session_id: string | null }>;
    const hit = mine.find((r) => r.event_data?.utm_campaign) ?? mine.find((r) => r.event_data?.utm_source);
    const corpo = payloadUtmifyUpsell({ orderId: a.orderId, offer: a.offer, amountCents: a.amountCents, email: a.email, utm: pick(hit?.event_data) });
    const enviar = a.enviar ?? ((url, init) => fetch(url, init));
    const r = await enviar("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-token": a.token }, body: JSON.stringify(corpo),
    });
    return r.ok ? "utmify_ok" : `utmify_${r.status}`;
  } catch { return "utmify_falhou"; }
}
