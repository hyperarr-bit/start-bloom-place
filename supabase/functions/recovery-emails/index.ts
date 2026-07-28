import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Régua de recuperação do funil pago — 5 TOQUES (28/07, reforma agressiva).
 * Antes: 2 toques recuperavam 1,7% de 895 pessoas/semana (~R$45/dia).
 * Benchmark aplicado (Cal AI win-back / carrinho BR / Duolingo):
 *   - assunto com NÚMERO específico > urgência vaga
 *   - sem desconto no 1º toque (retém 2,6x mais quem volta sem cupom)
 *   - arco: atenção → oferta → prova social/FOMO → deadline REAL → winback frio
 *   - após o h72 NENHUM e-mail volta a ofertar 14,90 (deadline honesto no canal)
 *
 *   h1  (1-24h)  preço cheio, continuidade — "você esqueceu uma coisa aqui"
 *   h24 (24-48h) oferta 14,90, validade anunciada de 48h
 *   h48 (48-72h) prova social + FOMO — a oferta morre amanhã
 *   h72 (72-96h) última chamada — expira à meia-noite, último e-mail com ds
 *   d7  (7-10d)  winback frio sem oferta, preço cheio
 *
 * MIRA (28/07): h24/h48/h72 PULAM quem já gerou QR — a Cakto já martela esses
 * com a régua própria dela ("Pague seu Pix", 5 envios); e-mail duplo = spam.
 * h1 e d7 vão pra todos os candidatos.
 *
 * PREVIEW: POST {preview:"email@x.com"} manda os 5 estágios pra esse endereço
 * sem gravar nada — pro dono aprovar copy no próprio inbox.
 *
 * Idempotente: RPC recovery_email_candidates (janelas fechadas) + unique
 * (user_id, stage). Sem RESEND_API_KEY é no-op.
 */

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECOVERY-EMAILS] ${step}${d}`);
};

type Stage = "h1" | "h24" | "h48" | "h72" | "d7";
const DS_STAGES: Stage[] = ["h24", "h48", "h72"]; // estágios com oferta 14,90

const checkoutLink = (stage: Stage) => {
  const url = new URL("https://www.coreaplicativo.com.br/planos");
  url.searchParams.set("from", "recovery_email");
  url.searchParams.set("utm_source", "recovery_email");
  url.searchParams.set("utm_content", stage);
  if (DS_STAGES.includes(stage)) url.searchParams.set("oferta", "ds");
  return url.toString();
};

/* ------------------------------------------------------------------ COPY */

const PRECO_CHEIO = `<div style="font-size:28px;font-weight:800;">R$ 27,90<span style="font-size:14px;font-weight:600;color:#888;"> uma vez, seu pra sempre</span></div>`;
const PRECO_DS = `<span style="font-size:16px;font-weight:600;color:#aaa;text-decoration:line-through;">R$ 27,90</span> <span style="font-size:28px;font-weight:800;color:#D22D80;">R$ 14,90</span><span style="font-size:14px;font-weight:600;color:#888;"> uma vez</span>`;

const COPY: Record<Stage, {
  subject: string;
  headline: string;
  intro: (name: string) => string;
  selo: string;
  preco: string;
  cta: string;
  rodape: string;
}> = {
  h1: {
    subject: "você esqueceu uma coisa aqui 👀",
    headline: "Seu plano ficou pronto. Você, não.",
    intro: (n) => `${n}, você montou seu plano no CORE e parou bem na portinha. Tá tudo guardado do jeito que você deixou — suas respostas, seu módulo, seu começo. Falta só 1 Pix pra tudo isso ser seu <b>pra sempre</b> (sem mensalidade, nunca).`,
    selo: "SEU ACESSO VITALÍCIO TE ESPERANDO",
    preco: PRECO_CHEIO,
    cta: "Continuar de onde parei →",
    rodape: "Leva 1 minuto: entra, gera o Pix e o acesso libera na hora.",
  },
  h24: {
    subject: "R$ 14,90 hoje. R$ 27,90 amanhã.",
    headline: "Metade do preço. Uma vez na vida.",
    intro: (n) => `${n}, sem enrolação: como é sua primeira semana, sua condição de boas-vindas liberou o CORE vitalício por <b>R$ 14,90 — 46% off, pagamento único</b>. Essa condição vale <b>48 horas</b> e não volta. Depois é R$ 27,90 (que ainda custa menos que uma pizza — só que organiza sua vida inteira).`,
    selo: "🎁 46% OFF — VALE 48 HORAS",
    preco: PRECO_DS,
    cta: "Quero por R$ 14,90 →",
    rodape: "O link já abre com o Pix de R$ 14,90 — paga e libera na hora.",
  },
  h48: {
    subject: "ontem, 31 pessoas entraram. você leu o e-mail.",
    headline: "Enquanto você decide, todo mundo entra",
    intro: (n) => `${n}, só ontem 31 pessoas garantiram o acesso vitalício. Uma delas me escreveu essa semana: <i>"finalmente sei pra onde meu dinheiro vai"</i> — 3 dias depois de quase desistir, igual você agora. Sua condição de <b>R$ 14,90 morre amanhã à noite</b>. Depois disso, essa história é de outra pessoa.`,
    selo: "⏳ ÚLTIMO DIA COMPLETO DE OFERTA",
    preco: PRECO_DS,
    cta: "Entrar por R$ 14,90 →",
    rodape: "16 módulos, pagamento único, garantia de 7 dias.",
  },
  h72: {
    subject: "⏰ à meia-noite isso expira (sem choro)",
    headline: "Última chamada — e é a última mesmo",
    intro: (n) => `${n}, hoje às 23h59 sua condição de <b>R$ 14,90 expira</b> e este é o último e-mail que oferece esse valor. Sem falsa escassez: amanhã o preço é R$ 27,90 e a gente para de escrever sobre isso. Se o CORE não é pra você, tudo certo. Se é — <b>agora ou nunca é agora</b>.`,
    selo: "🚨 EXPIRA HOJE ÀS 23H59",
    preco: PRECO_DS,
    cta: "Última chance: R$ 14,90 →",
    rodape: "Depois da meia-noite este link volta pro preço cheio.",
  },
  d7: {
    subject: "a gente parou de escrever. teu plano, não.",
    headline: "Ainda tá tudo aqui",
    intro: (n) => `${n}, faz uma semana que você montou um plano pra organizar sua vida — e o problema que te trouxe até ele provavelmente continua aí. Sem oferta, sem contagem regressiva: só um lembrete de que sua conta existe e seu plano continua guardado, esperando você voltar.`,
    selo: "ACESSO VITALÍCIO",
    preco: PRECO_CHEIO,
    cta: "Retomar meu plano →",
    rodape: "1 pagamento, teu pra sempre. Garantia de 7 dias.",
  },
};

const emailHtml = (stage: Stage, name: string, ctaUrl: string) => {
  const c = COPY[stage];
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#262626;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:24px;">c<span style="color:#D22D80;">o</span>re</div>
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e8e4de;">
      <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;">${c.headline}</h1>
      <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 20px;">${c.intro(name)}</p>
      <div style="border:2px solid #D22D80;border-radius:14px;padding:18px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:#D22D80;letter-spacing:0.5px;margin-bottom:6px;">${c.selo}</div>
        ${c.preco}
        <div style="font-size:12px;color:#888;margin-top:2px;">Pague 1x no Pix · todos os 16 módulos · sem mensalidade, nunca</div>
        <a href="${ctaUrl}" style="display:block;background:#262626;color:#ffffff;text-align:center;text-decoration:none;font-weight:700;font-size:15px;padding:14px;border-radius:999px;margin-top:14px;">${c.cta}</a>
      </div>
      <p style="font-size:13px;color:#666;text-align:center;margin:0 0 20px;">${c.rodape}</p>
      <p style="font-size:12px;line-height:1.6;color:#888;margin:0;text-align:center;">🛡️ Garantia de 7 dias — não curtiu, devolvemos 100% em 1 mensagem.<br>Pix na hora · pagamento único · sem mensalidade.</p>
    </div>
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:20px 4px 0;text-align:center;">Você recebeu este e-mail porque criou uma conta no CORE.<br>Não quer mais receber? Responda com "sair".</p>
  </div>
</body></html>`;
};

/* ------------------------------------------------------------------ SERVE */

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
    // Remetente: pessoa > marca (padrão que abre mais). Cai no domínio
    // verificado do welcome se RECOVERY_EMAIL_FROM não existir.
    const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM")
      || Deno.env.get("WELCOME_EMAIL_FROM")
      || "CORE <onboarding@resend.dev>";
    const from = fromBase.includes("<") ? `João do CORE <${fromBase.split("<")[1]}` : fromBase;

    // PREVIEW: manda os 5 estágios pro e-mail informado, sem gravar nada.
    const body = await req.json().catch(() => ({}));
    if (body?.preview) {
      const to = String(body.preview);
      for (const stage of ["h1", "h24", "h48", "h72", "d7"] as Stage[]) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from, to: [to],
            subject: `[${stage}] ${COPY[stage].subject}`,
            html: emailHtml(stage, "João", checkoutLink(stage)),
          }),
        });
      }
      log("Preview sent", { to });
      return Response.json({ preview: to, stages: 5 });
    }

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

    // MIRA: nos estágios com oferta, pula quem já gerou QR (a Cakto já manda
    // a régua dela pra esses — "Pague seu Pix" x5; martelar em dobro = spam).
    const idsDs = [...new Set((candidates as Array<{ user_id: string; stage: Stage }>)
      .filter((c) => DS_STAGES.includes(c.stage)).map((c) => c.user_id))];
    const comQR = new Set<string>();
    for (let i = 0; i < idsDs.length; i += 50) {
      const { data: qs } = await supabase
        .from("analytics_events").select("user_id")
        .eq("event_name", "pix_order_created").in("user_id", idsDs.slice(i, i + 50));
      for (const q of qs ?? []) comQR.add(String(q.user_id));
    }

    let sent = 0, failed = 0, skippedQr = 0;
    for (const c of candidates) {
      try {
        const stage = c.stage as Stage;
        if (DS_STAGES.includes(stage) && comQR.has(String(c.user_id))) {
          // marca como "enviado" pra régua não tentar de novo a cada 30min
          await supabase.from("funnel_recovery_emails").insert({ user_id: c.user_id, stage });
          skippedQr++;
          continue;
        }
        const ctaUrl = checkoutLink(stage);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [c.email],
            subject: COPY[stage].subject,
            html: emailHtml(stage, c.display_name, ctaUrl),
          }),
        });
        if (!res.ok) {
          const bodyTxt = await res.text();
          throw new Error(`Resend ${res.status}: ${bodyTxt.slice(0, 200)}`);
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

    log("Done", { sent, failed, skippedQr });
    return Response.json({ sent, failed, skippedQr });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return Response.json({ error: msg }, { status: 500 });
  }
});
