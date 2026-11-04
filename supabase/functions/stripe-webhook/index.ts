/**
 * STRIPE-WEBHOOK (04/11) — /oferta. Regras em ../_shared/stripe.ts (testadas no vitest: src/test/stripe-webhook.test.ts).
 * Deploy (NÃO feito): `supabase functions deploy stripe-webhook --no-verify-jwt` (a Stripe não manda JWT; a trava é a
 * assinatura). Secrets: STRIPE_WEBHOOK_SECRET (whsec_…; sem ele tudo volta 401) e STRIPE_SECRET_KEY (ler a cobrança: método e
 * parcelas). Na Stripe: Developers → Webhooks → endpoint https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/stripe-webhook,
 * eventos payment_intent.succeeded, charge.refunded, charge.dispute.created.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { tratarStripe } from "../_shared/stripe.ts";
import type { AdminHotmart } from "../_shared/hotmart.ts";
import { acharConta } from "../_shared/destino-hoje.ts";
import { fetchNosPixels } from "../_shared/meta-pixels.ts";
import { chavesVapidDoAmbiente, mandarParaTodos } from "../_shared/push-dono.ts";
import { dadosPush } from "../_shared/aviso-venda.ts";

const log = (passo: string, d?: Record<string, unknown>) => console.log(`[STRIPE-WEBHOOK] ${passo}${d ? ` - ${JSON.stringify(d)}` : ""}`);
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function enviarResend(para: string, assunto: string, html: string): Promise<boolean> {
  const k = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!k) return false;
  const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [para], subject: assunto, html }) }).catch(() => null);
  return !!r?.ok;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const corpo = await req.text(); // CRU: a assinatura é sobre os bytes exatos
  const r = await tratarStripe({
    admin: admin as unknown as AdminHotmart,
    secret: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? null,
    acharConta: (email) => acharConta(admin as never, email.toLowerCase()),
    enviarEmail: enviarResend,
    mandarCapi: async (c) => { const res = await fetchNosPixels({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) }); return res.ok; },
    avisarVenda: async (id) => { await fetch(`${url}/functions/v1/avisar-venda`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}` }, body: JSON.stringify({ fonte: "pix", id }) }).catch(() => null); },
    avisarDono: async (titulo, c, tag) => { await mandarParaTodos(admin, chavesVapidDoAmbiente(), dadosPush(titulo, c, tag)); },
    buscarCobranca: async (ch) => {
      const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (!sk) return null;
      const res = await fetch(`https://api.stripe.com/v1/charges/${ch}`, { headers: { Authorization: `Bearer ${sk}` } });
      if (!res.ok) return null;
      const j = await res.json() as { billing_details?: { email?: string | null }; payment_method_details?: { type?: string; card?: { installments?: { plan?: { count?: number } | null } | null } } };
      return { metodo: j.payment_method_details?.type ?? null, parcelas: j.payment_method_details?.card?.installments?.plan?.count ?? (j.payment_method_details?.type === "card" ? 1 : null), email: j.billing_details?.email ?? null };
    },
    log,
  }, { assinatura: req.headers.get("stripe-signature"), corpo });
  return json(r.corpo, r.status);
});
