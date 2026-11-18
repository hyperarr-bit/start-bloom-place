/**
 * STRIPE-WEBHOOK (04/11) — /oferta. Regras em ../_shared/stripe.ts (testadas no vitest: src/test/stripe-webhook.test.ts).
 * Deploy (NÃO feito): `supabase functions deploy stripe-webhook --no-verify-jwt` (a Stripe não manda JWT; a trava é a
 * assinatura). Secrets: STRIPE_WEBHOOK_SECRET (whsec_…; sem ele tudo volta 401) e STRIPE_SECRET_KEY (ler a cobrança: método e
 * parcelas). Na Stripe: Developers → Webhooks → endpoint https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/stripe-webhook,
 * eventos payment_intent.succeeded, charge.refunded, charge.dispute.created.
 * 14/11 (mensal do /funil-app): + invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
 * (adicionar no MESMO endpoint na Stripe). A chave precisa de leitura em Subscriptions/Invoices e ESCRITA em Subscriptions
 * (estorno do mensal cancela a assinatura; mensal em dobro ou vitalício por cima cancelam a renovação).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { leitoresFaturaStripe, tratarStripe } from "../_shared/stripe.ts";
import { API_PIX_AUTOMATICO } from "../_shared/stripe-ofertas.ts";
import type { AdminHotmart } from "../_shared/hotmart.ts";
import { acharConta } from "../_shared/destino-hoje.ts";
import { fetchNosPixels } from "../_shared/meta-pixels.ts";
import { chavesVapidDoAmbiente, mandarParaTodos } from "../_shared/push-dono.ts";
import { dadosPush } from "../_shared/aviso-venda.ts";
import { cancelarIndicacaoWeb, registrarIndicacaoWeb, type VendaWeb } from "../_shared/indique.ts";

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
      const j = await res.json() as { billing_details?: { email?: string | null }; payment_method_details?: { type?: string; card?: { fingerprint?: string | null; installments?: { plan?: { count?: number } | null } | null } } };
      return { metodo: j.payment_method_details?.type ?? null, parcelas: j.payment_method_details?.card?.installments?.plan?.count ?? (j.payment_method_details?.type === "card" ? 1 : null), email: j.billing_details?.email ?? null, cartaoFp: j.payment_method_details?.card?.fingerprint ?? null };
    },
    // 14/11 (mensal do /funil-app): a metadata da assinatura quando a fatura não traz (versões da API)
    buscarAssinatura: async (sub) => {
      const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (!sk || !/^sub_[A-Za-z0-9]+$/.test(sub)) return null;
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub}`, { headers: { Authorization: `Bearer ${sk}`, "Stripe-Version": "2024-06-20" } });
      return res.ok ? await res.json() as Record<string, unknown> : null;
    },
    // 14/11 (revisão): a assinatura de um pagamento de fatura (estorno/contestação do mensal, PI de renovação)
    assinaturaDoPagamento: async (pi, invoice) => {
      const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (!sk) return null;
      const h = { Authorization: `Bearer ${sk}`, "Stripe-Version": "2024-06-20" };
      let inv = invoice;
      if (!inv && /^pi_[A-Za-z0-9]+$/.test(pi)) {
        const r = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}`, { headers: h });
        if (!r.ok) throw new Error("pi_ilegivel");
        const j = await r.json() as { invoice?: string | null };
        inv = typeof j.invoice === "string" ? j.invoice : null;
      }
      if (!inv || !/^in_[A-Za-z0-9]+$/.test(inv)) return null;
      const r = await fetch(`https://api.stripe.com/v1/invoices/${inv}`, { headers: h });
      if (!r.ok) throw new Error("fatura_ilegivel");
      const j = await r.json() as { subscription?: string | { id?: string } | null };
      return typeof j.subscription === "string" ? j.subscription : j.subscription?.id ?? null;
    },
    // 18/11 (revisão /escolha): o PI da fatura paga (comissão do mensal) e a fatura de um PI (estorno), nas 2 formas da API
    ...leitoresFaturaStripe(async (caminho, versao) => {
      const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (!sk) return null;
      const r = await fetch(`https://api.stripe.com/v1/${caminho}`, { headers: { Authorization: `Bearer ${sk}`, "Stripe-Version": versao } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`stripe_${r.status}`);
      return await r.json() as Record<string, unknown>;
    }, API_PIX_AUTOMATICO),
    // 14/11 (revisão): cancelar a assinatura na Stripe (estorno = já; mensal em dobro / comprou o vitalício = no fim do período)
    cancelarAssinatura: async (sub, imediato) => {
      const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (!sk || !/^sub_[A-Za-z0-9]+$/.test(sub)) return false;
      const h = { Authorization: `Bearer ${sk}`, "Stripe-Version": "2024-06-20", "Content-Type": "application/x-www-form-urlencoded" };
      const r = imediato
        ? await fetch(`https://api.stripe.com/v1/subscriptions/${sub}`, { method: "DELETE", headers: h })
        : await fetch(`https://api.stripe.com/v1/subscriptions/${sub}`, { method: "POST", headers: h, body: "cancel_at_period_end=true" });
      return r.ok;
    },
    // 23/11 (indique e ganhe, _shared/indique.ts): sem a migração 20261123120000 aplicada, o insert falharia → 500 e a Stripe
    // reenviaria a venda. Por isso só liga com a env INDIQUE_WEB=on (setar DEPOIS da migração). Sem ela = o webhook de hoje.
    ...(Deno.env.get("INDIQUE_WEB") === "on" ? {
      indique: {
        registrar: (indicador: string, venda: VendaWeb) => registrarIndicacaoWeb(admin, indicador, venda, new Date()),
        cancelar: (pi: string, opts?: { parcial?: boolean }) => cancelarIndicacaoWeb(admin, pi, opts),
      },
    } : {}),
    // 17/11: o bloco "Indique e ganhe" no e-mail de acesso da /oferta (as 2 envs; sem elas, o e-mail de hoje)
    indiqueNoEmail: Deno.env.get("INDIQUE_WEB") === "on" && Deno.env.get("INDIQUE_EMAIL") === "on",
    log,
  }, { assinatura: req.headers.get("stripe-signature"), corpo });
  return json(r.corpo, r.status);
});
