/**
 * STRIPE-CRIAR (04/11) — /oferta: cria (ou atualiza) o PaymentIntent da compra (R$ 67,90, Pix + cartão parcelado) e devolve só o
 * client_secret. Idempotente pela ref da página (Idempotency-Key); o valor é SEMPRE o do servidor. Limite de 20 por IP em 10 min.
 * Regras em ../_shared/stripe-criar.ts. Deploy (NÃO feito): `supabase functions deploy stripe-criar`. Secret: STRIPE_SECRET_KEY
 * (sk_live_… ou chave restrita com escrita em PaymentIntents).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { formUrl, ipPodeCriar, metadataDoPedido, paramsAtualizar, paramsCriar, validarPedidoStripe } from "../_shared/stripe-criar.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const log = (m: string, d: Record<string, unknown> = {}) => console.log(`[STRIPE-CRIAR] ${m} ${JSON.stringify(d)}`);

async function stripe(caminho: string, pares: Array<[string, string]> | null, idem?: string): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: pares ? "POST" : "GET",
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded", ...(idem ? { "Idempotency-Key": idem } : {}) },
    ...(pares ? { body: formUrl(pares) } : {}),
  });
  return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) { log("sem STRIPE_SECRET_KEY"); return json({ ok: false, erro: "indisponivel" }, 503); }
    const p = validarPedidoStripe(await req.json().catch(() => null));
    if (!p) return json({ ok: false }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    let userId: string | null = null;
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token) { const { data } = await admin.auth.getUser(token).catch(() => ({ data: null })); userId = data?.user?.id ?? null; }
    const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0]?.trim() || null;
    const md = metadataDoPedido(p, { userId, ip, ua: req.headers.get("user-agent"), agoraIso: new Date().toISOString() });

    if (p.pi) {
      // atualizar: só o PI desta ref (a página não troca o de outra pessoa) e só o e-mail/sinais — nunca o valor
      const atual = await stripe(`payment_intents/${p.pi}`, null);
      if (!atual.ok || (atual.j.metadata as Record<string, string> | undefined)?.ref !== p.ref) return json({ ok: false }, 404);
      if (["succeeded", "canceled"].includes(String(atual.j.status))) return json({ ok: true, client_secret: atual.j.client_secret, pi: p.pi });
      const up = await stripe(`payment_intents/${p.pi}`, paramsAtualizar(md, p.email));
      if (!up.ok) { log("atualizar falhou", { status: String((up.j.error as Record<string, unknown> | undefined)?.code ?? "") }); return json({ ok: false }, 502); }
      return json({ ok: true, client_secret: up.j.client_secret, pi: p.pi });
    }
    if (!(await ipPodeCriar(admin, ip))) { log("limite por IP"); return json({ ok: false, limite: true }, 429); }
    const r = await stripe("payment_intents", paramsCriar(md, p.email), `oferta-${p.ref}`);
    if (!r.ok || typeof r.j.client_secret !== "string") { log("criar falhou", { code: String((r.j.error as Record<string, unknown> | undefined)?.code ?? "") }); return json({ ok: false }, 502); }
    await admin.from("analytics_events").insert({ event_name: "stripe_order_created", user_id: userId, session_id: p.landing_session_id, event_data: { ref: p.ref, pi: r.j.id, pagina: "oferta", ...(ip ? { client_ip: ip } : {}), ...p.atrib } }).then(() => {}, () => {});
    return json({ ok: true, client_secret: r.j.client_secret, pi: r.j.id });
  } catch (e) {
    log("erro", { msg: String(e).slice(0, 120) });
    return json({ ok: false }, 500);
  }
});
