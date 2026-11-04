/**
 * HOTMART-INICIAR (04/11) — a /vida, no toque em "Quero organizar minha vida" do braço Hotmart, grava o PEDIDO antes de
 * ir pro checkout: a ref aleatória (volta no `sck` do webhook) + a conta da sessão (se houver: a anônima da demo/compra) +
 * os sinais do navegador pra CAPI (fbp, fbc, fbclid, IP, user agent, URL) + utm/anúncio. Vira 1 linha `hotmart_order_created`
 * em analytics_events (só o servidor grava esse nome depois da migração 20261104120000). O hotmart-webhook lê pela ref.
 * Regras do corpo em ../_shared/hotmart-iniciar.ts (testadas no vitest).
 *
 * Deploy (NÃO feito): `supabase functions deploy hotmart-iniciar` (verify_jwt padrão: a página manda a chave anon ou o JWT
 * da sessão). Sem secret novo.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { linhaDoPedidoHotmart, validarInicio } from "../_shared/hotmart-iniciar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    const pedido = validarInicio(await req.json().catch(() => null));
    if (!pedido) return json({ ok: false }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    // a conta da sessão, se o token for de um usuário (a chave anon não é usuário → null)
    let userId: string | null = null;
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token) { const { data } = await admin.auth.getUser(token).catch(() => ({ data: null })); userId = data?.user?.id ?? null; }
    // a mesma ref 2× (toque duplo / reenvio) = 1 linha só
    const { data: ja } = await admin.from("analytics_events").select("id").eq("event_name", "hotmart_order_created").contains("event_data", { ref: pedido.ref }).limit(1);
    if (Array.isArray(ja) && ja.length) return json({ ok: true, ja: true });
    const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0]?.trim() || null;
    const { error } = await admin.from("analytics_events").insert(linhaDoPedidoHotmart(pedido, { userId, ip, ua: req.headers.get("user-agent") }));
    if (error) { console.log(`[HOTMART-INICIAR] não gravou - ${String(error.message ?? "").slice(0, 120)}`); return json({ ok: false }, 500); }
    return json({ ok: true });
  } catch (e) {
    console.log(`[HOTMART-INICIAR] erro - ${String(e).slice(0, 120)}`);
    return json({ ok: false }, 500);
  }
});
