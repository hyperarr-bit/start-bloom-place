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

// VITALÍCIO (13/07): a compra agora é Pix DENTRO do app (PixCheckout) —
// o e-mail leva pro /planos logado, onde a pessoa gera o Pix em 2 toques.
// h24 (20/07): ?oferta=ds abre DIRETO o Pix de R$ 14,90 (prêmio da roleta) —
// depois de 24h sem comprar a R$ 27,90, o lead frio recuperado a 14,90 é
// receita que não existiria. O /planos ignora o param pra quem já assina.
const checkoutLink = (stage: "h1" | "h24") => {
  const url = new URL("https://www.coreaplicativo.com.br/planos");
  url.searchParams.set("from", "recovery_email");
  url.searchParams.set("utm_source", "recovery_email");
  if (stage === "h24") url.searchParams.set("oferta", "ds");
  return url.toString();
};

const emailHtml = (stage: "h1" | "h24", name: string, ctaUrl: string) => {
  const headline = stage === "h1"
    ? "Seu plano personalizado está pronto 🎉"
    : "Você ganhou: CORE vitalício por R$ 14,90 (só hoje)";
  const intro = stage === "h1"
    ? `Você criou sua conta no CORE e seu plano ficou pronto. Pra começar, sua condição de boas-vindas está ativa:`
    : `Seu plano ainda tá te esperando — e como é sua primeira semana, liberamos a MESMA condição da roleta de boas-vindas: o acesso vitalício pela metade do preço. Depois dessa, acabou.`;
  // h24 = downsell 14,90 (prêmio da roleta): lead que passou 24h sem pagar
  // 27,90 dificilmente paga — 14,90 recuperado é receita que não existiria.
  const preco = stage === "h24"
    ? `<span style="font-size:16px;font-weight:600;color:#aaa;text-decoration:line-through;">R$ 27,90</span> <span style="font-size:28px;font-weight:800;color:#D22D80;">R$ 14,90</span><span style="font-size:14px;font-weight:600;color:#888;"> uma vez</span>`
    : `<div style="font-size:28px;font-weight:800;">R$ 27,90<span style="font-size:14px;font-weight:600;color:#888;"> uma vez</span></div>`;
  const selo = stage === "h24" ? "🎁 46% OFF — SÓ NESTE LINK" : "ACESSO VITALÍCIO";
  const cta = stage === "h24" ? "Garantir por R$ 14,90 →" : "Garantir meu acesso vitalício";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#262626;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:24px;">c<span style="color:#D22D80;">o</span>re</div>
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e8e4de;">
      <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;">${headline}</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 20px;">Oi ${name},<br>${intro}</p>
      <div style="border:2px solid #D22D80;border-radius:14px;padding:18px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:#D22D80;letter-spacing:0.5px;margin-bottom:6px;">${selo}</div>
        ${preco}
        <div style="font-size:12px;color:#888;margin-top:2px;">Pague 1x no Pix · todos os 16 módulos · sem mensalidade, nunca</div>
        <a href="${ctaUrl}" style="display:block;background:#262626;color:#ffffff;text-align:center;text-decoration:none;font-weight:700;font-size:15px;padding:14px;border-radius:999px;margin-top:14px;">${cta}</a>
      </div>
      <p style="font-size:13px;color:#666;text-align:center;margin:0 0 20px;">${stage === "h24" ? "O link já abre com o QR do Pix — paga e o acesso libera na hora." : "Leva 1 minuto: entra no app, toca em gerar Pix e pronto."}</p>
      <p style="font-size:12px;line-height:1.6;color:#888;margin:0;text-align:center;">🛡️ Garantia de 7 dias — não curtiu, devolvemos 100% em 1 mensagem.<br>Pix na hora · pagamento único · sem mensalidade.</p>
    </div>
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:20px 4px 0;text-align:center;">Você recebeu este e-mail porque criou uma conta no CORE.<br>Não quer mais receber? Responda com "sair".</p>
  </div>
</body></html>`;
};

const SUBJECTS: Record<"h1" | "h24", string> = {
  h1: "Seu plano está pronto — CORE vitalício por R$ 27,90, 1x só 🎁",
  h24: "🎁 Só hoje: CORE vitalício por R$ 14,90 (46% OFF, pague 1x)",
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
    // Remetente: cai no WELCOME_EMAIL_FROM (domínio verificado, setado 15/07)
    // se RECOVERY_EMAIL_FROM não existir — onboarding@resend.dev cai em spam.
    const from = Deno.env.get("RECOVERY_EMAIL_FROM")
      || Deno.env.get("WELCOME_EMAIL_FROM")
      || "CORE <onboarding@resend.dev>";

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
        const ctaUrl = checkoutLink(stage);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [c.email],
            subject: SUBJECTS[stage],
            html: emailHtml(stage, c.display_name, ctaUrl),
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
