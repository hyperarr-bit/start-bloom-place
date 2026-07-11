import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * E-mails de recuperação do funil pago: quem criou conta e NÃO assinou.
 * Disparado por pg_cron a cada 30 min (ver migration 20260707160000).
 *
 *   h1  — 1h depois do cadastro: "seu plano tá pronto" + oferta de boas-vindas
 *   h24 — 24h depois: última chamada da condição de boas-vindas
 *
 * Idempotente: a seleção (RPC recovery_email_candidates) exclui quem já
 * recebeu cada estágio, quem tem assinatura, contas de teste e o dono.
 * Sem RESEND_API_KEY configurada, é no-op (retorna skipped).
 */

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECOVERY-EMAILS] ${step}${d}`);
};

// Links da Cakto (mesmos do cakto-checkout). O link direto funciona sem
// login — o webhook casa a compra pelo e-mail pré-preenchido.
// Oferta do e-mail = prêmio de boas-vindas (1º mês do mensal por R$9,90,
// oferta limitada 6a3owem); o anual vai a PREÇO CHEIO — nunca é descontado.
const LIMITED_MONTHLY = "https://pay.cakto.com.br/6a3owem";
const REGULAR_ANNUAL = "https://pay.cakto.com.br/6g8iiak";

const checkoutLink = (base: string, email: string, name: string) => {
  const url = new URL(base);
  url.searchParams.set("email", email);
  url.searchParams.set("confirmEmail", email);
  if (name) url.searchParams.set("name", name);
  url.searchParams.set("utm_source", "recovery_email");
  return url.toString();
};

const emailHtml = (stage: "h1" | "h24", name: string, annualUrl: string, monthlyUrl: string) => {
  const headline = stage === "h1"
    ? "Seu plano personalizado está pronto 🎉"
    : "Última chamada: sua condição de boas-vindas";
  const intro = stage === "h1"
    ? `Você criou sua conta no CORE e seu plano ficou pronto. Pra começar, sua condição de boas-vindas está ativa:`
    : `Sua condição de boas-vindas do CORE ainda está de pé — mas ela é da sua primeira semana. Depois, vale o preço normal (R$ 19,90/mês).`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#262626;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:24px;">c<span style="color:#D22D80;">o</span>re</div>
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e8e4de;">
      <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;">${headline}</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 20px;">Oi ${name},<br>${intro}</p>
      <div style="border:2px solid #D22D80;border-radius:14px;padding:18px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:#D22D80;letter-spacing:0.5px;margin-bottom:6px;">BOAS-VINDAS · 1º MÊS</div>
        <div style="font-size:28px;font-weight:800;">R$ 9,90<span style="font-size:14px;font-weight:600;color:#888;"> no 1º mês</span></div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Depois R$ 19,90/mês · cancele quando quiser</div>
        <a href="${monthlyUrl}" style="display:block;background:#262626;color:#ffffff;text-align:center;text-decoration:none;font-weight:700;font-size:15px;padding:14px;border-radius:999px;margin-top:14px;">Ativar meu 1º mês por R$ 9,90</a>
      </div>
      <p style="font-size:13px;color:#666;text-align:center;margin:0 0 20px;">Quer o melhor preço? <a href="${annualUrl}" style="color:#D22D80;font-weight:600;">Anual: R$ 5,82/mês (R$ 69,90 no ano, em até 12x)</a></p>
      <p style="font-size:12px;line-height:1.6;color:#888;margin:0;text-align:center;">🛡️ Garantia de 7 dias — não curtiu, devolvemos 100% em 1 mensagem.<br>Pix ou cartão · sem fidelidade · cancele quando quiser.</p>
    </div>
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:20px 4px 0;text-align:center;">Você recebeu este e-mail porque criou uma conta no CORE.<br>Não quer mais receber? Responda com "sair".</p>
  </div>
</body></html>`;
};

const SUBJECTS: Record<"h1" | "h24", string> = {
  h1: "Seu plano está pronto — e seu 1º mês sai por R$ 9,90 🎁",
  h24: "Última chamada: 1º mês por R$ 9,90 expira com sua 1ª semana",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      log("Skipped: RESEND_API_KEY not set");
      return Response.json({ skipped: "no RESEND_API_KEY" });
    }
    const from = Deno.env.get("RECOVERY_EMAIL_FROM") || "CORE <onboarding@resend.dev>";

    // Kill switch opcional (mesmo padrão dos trial emails)
    const { data: cfg } = await supabase
      .from("app_config").select("value").eq("key", "recovery_emails_enabled").maybeSingle();
    if (cfg && (cfg.value === false || cfg.value === "false")) {
      log("Paused via app_config");
      return Response.json({ paused: true });
    }

    const { data: candidates, error: candErr } = await supabase.rpc("recovery_email_candidates");
    if (candErr) throw candErr;
    if (!candidates?.length) {
      log("No candidates");
      return Response.json({ sent: 0 });
    }
    log("Candidates", { count: candidates.length });

    let sent = 0, failed = 0;
    for (const c of candidates) {
      try {
        const stage = c.stage as "h1" | "h24";
        const annualUrl = checkoutLink(REGULAR_ANNUAL, c.email, c.display_name);
        const monthlyUrl = checkoutLink(LIMITED_MONTHLY, c.email, c.display_name);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [c.email],
            subject: SUBJECTS[stage],
            html: emailHtml(stage, c.display_name, annualUrl, monthlyUrl),
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
        }

        // Marca como enviado DEPOIS do envio; unique(user_id, stage) segura corrida.
        await supabase.from("funnel_recovery_emails").insert({ user_id: c.user_id, stage });
        await supabase.from("analytics_events").insert({
          user_id: c.user_id,
          event_name: "recovery_email_sent",
          event_data: { stage },
        });
        sent++;
      } catch (e) {
        log("Send failed", { user: c.user_id, err: (e as Error).message });
        failed++;
      }
    }

    log("Done", { sent, failed });
    return Response.json({ sent, failed });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return Response.json({ error: msg }, { status: 500 });
  }
});
