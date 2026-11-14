/**
 * 14/11 (/funil-app, pagina "app_web"): também as ações da folha do paywall do app na web — acao "pix" | "cartao" | "assinar"
 * (regras em ../_shared/stripe-app-web.ts). Secrets novos: STRIPE_PRECO_MENSAL_34 (price_… de R$ 34,90/mês). A chave
 * STRIPE_SECRET_KEY precisa de escrita em Customers, Subscriptions e PaymentMethods (e leitura em Prices) pro mensal.
 * STRIPE-CRIAR (04/11) — /oferta: cria (ou atualiza) o PaymentIntent da compra (R$ 67,90, Pix + cartão parcelado) e devolve só o
 * client_secret. Idempotente pela ref da página (Idempotency-Key); o valor é SEMPRE o do servidor. Limite de 20 por IP em 10 min.
 * Regras em ../_shared/stripe-criar.ts. Deploy (NÃO feito): `supabase functions deploy stripe-criar`. Secret: STRIPE_SECRET_KEY
 * (sk_live_… ou chave restrita com escrita em PaymentIntents).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { criarOuReaproveitar, formUrl, metadataDoPedido, validarPedidoStripe } from "../_shared/stripe-criar.ts";
import { assinarAppWeb, cartaoAppWeb, pixAppWeb, RETORNO_APP_WEB, validarAcaoAppWeb } from "../_shared/stripe-app-web.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const log = (m: string, d: Record<string, unknown> = {}) => console.log(`[STRIPE-CRIAR] ${m} ${JSON.stringify(d)}`);

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
    // 14/11 (/funil-app): as ações da folha do paywall do app na web — só com pagina "app_web"
    const acao = p.pagina === "app_web" ? validarAcaoAppWeb(corpoCru) : null;
    if (p.pagina === "app_web" && (corpoCru as Record<string, unknown> | null)?.acao !== undefined && !acao) return json({ ok: false }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    let userId: string | null = null;
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token) { const { data } = await admin.auth.getUser(token).catch(() => ({ data: null })); userId = data?.user?.id ?? null; }
    const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0]?.trim() || null;
    const md = metadataDoPedido(p, { userId, ip, ua: req.headers.get("user-agent"), agoraIso: new Date().toISOString() });

    if (acao) {
      const deps = { admin, stripe, log, precoMensal: Deno.env.get("STRIPE_PRECO_MENSAL_34") ?? null };
      const ctx = { userId, ip };
      const r = acao.acao === "pix" ? await pixAppWeb(deps, p, md, ctx)
        : acao.acao === "cartao" ? await cartaoAppWeb(deps, p, md, ctx, { pm: acao.pm!, parcelas: acao.parcelas, returnUrl: RETORNO_APP_WEB })
        : await assinarAppWeb(deps, p, md, ctx, { pm: acao.pm!, returnUrl: RETORNO_APP_WEB });
      return json(r.corpo, r.status);
    }
    const r = await criarOuReaproveitar({ admin, stripe, log }, p, md, { userId, ip });
    return json(r.corpo, r.status);
  } catch (e) {
    log("erro", { msg: String(e).slice(0, 120) });
    return json({ ok: false }, 500);
  }
});
