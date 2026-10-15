/**
 * VENDA-CAPI (15/10) — ViewContent / InitiateCheckout da venda da web (/assinar) pela CAPI do pixel do site, com o
 * MESMO event_id do fbq (a Meta deduplica). Regras e montagem em ../_shared/venda-capi.ts (puro, testado).
 *
 *   POST { evento, event_id, url, fbp?, fbc?, valor?, conteudo? }  → { ok }
 *
 * verify_jwt = false (config.toml): os dois eventos saem ANTES de existir conta. Sem META_PIXEL_ID/META_CAPI_TOKEN
 * não faz nada. Pedido inválido = { ok: false } com 200 (não ensina nada a quem testa). Nunca grava dado pessoal.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { montarEventoVenda, validarPedido } from "../_shared/venda-capi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    const pixelId = Deno.env.get("META_PIXEL_ID");
    const token = Deno.env.get("META_CAPI_TOKEN");
    if (!pixelId || !token) return json({ ok: false, motivo: "sem_secrets" });
    const pedido = validarPedido(await req.json().catch(() => null));
    if (!pedido) return json({ ok: false });
    const evento = montarEventoVenda(pedido, req.headers.get("user-agent"));
    const r = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [evento] }),
    });
    if (!r.ok) console.log(`[VENDA-CAPI] meta recusou - ${JSON.stringify({ status: r.status, corpo: (await r.text()).slice(0, 160) })}`);
    return json({ ok: r.ok });
  } catch (e) {
    console.log(`[VENDA-CAPI] erro - ${String(e).slice(0, 160)}`);
    return json({ ok: false });
  }
});
