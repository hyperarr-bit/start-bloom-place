/** Dedicated LP lifetime checkout: /pra-sempre (lp27, R$27.90), /tudo (tudo, R$19.90 since 23/11) and /dia (dia, R$19.90). Prices come from the offers table. */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { criarOuReaproveitar, formUrl, metadataDoPedido, validarPedidoStripe } from "../_shared/stripe-criar.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const log = (m: string, d: Record<string, unknown> = {}) => console.log(`[STRIPE-LP27-CRIAR] ${m} ${JSON.stringify(d)}`);

async function stripe(caminho: string, pares: Array<[string, string]> | null, idem?: string, versao?: string): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: pares ? "POST" : "GET",
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded", ...(idem ? { "Idempotency-Key": idem } : {}), ...(versao ? { "Stripe-Version": versao } : {}) },
    ...(pares ? { body: formUrl(pares) } : {}),
  });
  return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) { log("sem STRIPE_SECRET_KEY"); return json({ ok: false, erro: "indisponivel" }, 503); }
    const corpoCru = await req.json().catch(() => null);
    const p = validarPedidoStripe(corpoCru);
    if (!p) return json({ ok: false }, 400);
    if (p.pagina !== "lp27" && p.pagina !== "tudo" && p.pagina !== "dia") return json({ ok: false }, 400); // 23/11: + a /tudo e a /dia (linhas próprias, 19,90)
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    let userId: string | null = null;
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token) { const { data } = await admin.auth.getUser(token).catch(() => ({ data: null })); userId = data?.user?.id ?? null; }
    const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0]?.trim() || null;
    const md = metadataDoPedido(p, { userId, ip, ua: req.headers.get("user-agent"), agoraIso: new Date().toISOString() });

    const r = await criarOuReaproveitar({ admin, stripe, log }, p, md, { userId, ip });
    return json(r.corpo, r.status);
  } catch (e) {
    log("erro", { msg: String(e).slice(0, 120) });
    return json({ ok: false }, 500);
  }
});
