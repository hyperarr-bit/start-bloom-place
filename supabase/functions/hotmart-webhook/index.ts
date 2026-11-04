/**
 * HOTMART-WEBHOOK (04/11) — Postback 2.0.0 da Hotmart pra venda da /vida (R$ 97,90, vitalício). As regras estão em
 * ../_shared/hotmart.ts (testadas no vitest: src/test/hotmart-webhook.test.ts); aqui só o Deno: o cliente do banco, o
 * Resend, a CAPI nos 2 pixels e o aviso de venda.
 *
 * Deploy (NÃO feito): `supabase functions deploy hotmart-webhook --no-verify-jwt` (a Hotmart não manda JWT; a trava é o
 * hottok). Secrets: HOTMART_HOTTOK (obrigatório — sem ele tudo volta 401), HOTMART_PRODUTO_ID (opcional: só esse produto).
 * Na Hotmart: Ferramentas → Webhook (API e notificações) → URL https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/hotmart-webhook,
 * versão 2.0.0, eventos de compra (aprovada, completa, reembolsada, chargeback, cancelada).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { tratarHotmart, type AdminHotmart } from "../_shared/hotmart.ts";
import { acharConta } from "../_shared/destino-hoje.ts";
import { fetchNosPixels } from "../_shared/meta-pixels.ts";

const log = (passo: string, d?: Record<string, unknown>) => console.log(`[HOTMART-WEBHOOK] ${passo}${d ? ` - ${JSON.stringify(d)}` : ""}`);
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function enviarResend(para: string, assunto: string, html: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) return false;
  const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], subject: assunto, html }),
  }).catch(() => null);
  return !!r?.ok;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const body = await req.json().catch(() => null);
  const r = await tratarHotmart({
    admin: admin as unknown as AdminHotmart,
    secret: Deno.env.get("HOTMART_HOTTOK") ?? null,
    produtoId: Deno.env.get("HOTMART_PRODUTO_ID") ?? null,
    acharConta: (email) => acharConta(admin as never, email.toLowerCase()),
    enviarEmail: enviarResend,
    mandarCapi: async (corpo) => {
      const res = await fetchNosPixels({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      if (!res.ok) log("CAPI recusou", { status: res.status, corpo: (await res.text().catch(() => "")).slice(0, 160) });
      return res.ok;
    },
    avisarVenda: async (linhaId) => {
      // o mesmo ponteiro que o gatilho do banco manda pro Pix (a função relê a linha e decide; venda_avisada evita o 2º aviso)
      await fetch(`${url}/functions/v1/avisar-venda`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}` },
        body: JSON.stringify({ fonte: "pix", id: linhaId }),
      }).catch(() => null);
    },
    log,
  }, { hottok: req.headers.get("x-hotmart-hottok"), body });
  return json(r.corpo, r.status);
});
