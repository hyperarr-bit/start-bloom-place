import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Régua de recuperação do funil pago — 5 TOQUES (28/07, reforma agressiva).
 * Antes: 2 toques recuperavam 1,7% de 895 pessoas/semana (~R$45/dia).
 * Benchmark aplicado (Cal AI win-back / carrinho BR / Duolingo):
 *   - assunto com NÚMERO específico > urgência vaga
 *   - sem desconto no 1º toque (retém 2,6x mais quem volta sem cupom)
 *   - arco: atenção → oferta → prova social/FOMO → deadline REAL → winback frio
 *   - após o h72 NENHUM e-mail volta a ofertar 19,90 (deadline honesto no canal)
 *
 *   h1  (1-24h)  preço cheio, continuidade — "você esqueceu uma coisa aqui"
 *   h24 (24-48h) oferta 19,90, validade anunciada de 48h
 *   h48 (48-72h) prova social + FOMO — a oferta morre amanhã
 *   h72 (72-96h) última chamada — expira à meia-noite, último e-mail com ds
 *   d7  (7-10d)  winback frio sem oferta, preço cheio
 *
 * MIRA INVERTIDA (30/07): NINGUÉM é pulado. A mira de 28/07 excluía quem
 * gerou QR dos estágios com oferta; a medição de 403 QRs (22-29/07) mostrou
 * que 99,5% de quem não paga no mesmo dia NUNCA paga — logo, aos 24h não há
 * venda cheia a proteger, e esse é o balde de maior intenção do funil.
 * Detalhe do h1: preço CHEIO de propósito — é o único toque que ainda alcança
 * a janela viva (49% dos QRs pagam no mesmo dia) e é de onde saem todas as
 * vendas de 27,90 da régua.
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
const DS_STAGES: Stage[] = ["h24", "h48", "h72"]; // estágios com oferta 19,90

/* ESTÁGIOS QUE REALMENTE SAEM (29/07 — medido, não opinião).
 * Os 3 toques novos rodaram 28-29/07: 799 e-mails, ZERO venda atribuída por
 * clique. Se convertessem como h1/h24 esperaríamos ~5 — a chance de dar zero
 * por azar é <1%. E cada disparo desses gasta reputação do domínio, que é o
 * que faz h1/h24 chegarem na aba Principal.
 * O gargalo real NÃO é quantidade de toque: 2.595 e-mails viraram 9 cliques
 * (0,35%), e desses 9, 5 compraram (56%). Quem vê, compra. O problema é
 * entrega/inbox — e mais volume só piora isso.
 * Pra religar: devolve "h48","h72","d7" aqui. A copy, a migration e o SQL
 * continuam intactos de propósito. */
/* 03/09 (preço único na web, ordem do dono "97,90 em tudo"): o h24 sai do ar.
 * Ele vendia 19,90 contra um cheio de 27,90 (29% off); contra 97,90 vira 80%
 * por e-mail, e a medição do próprio funil diz que saída barata converte quem
 * pagaria cheio. O h1 fica — é dele que saíram todas as vendas da régua, e ele
 * é o único que ainda alcança a janela viva. Devolver = pôr "h24" de volta. */
const ESTAGIOS_ATIVOS: Stage[] = ["h1"];

const checkoutLink = (stage: Stage) => {
  const url = new URL("https://www.coreaplicativo.com.br/planos");
  url.searchParams.set("from", "recovery_email");
  url.searchParams.set("utm_source", "recovery_email");
  url.searchParams.set("utm_content", stage);
  if (DS_STAGES.includes(stage)) url.searchParams.set("oferta", "ds");
  return url.toString();
};

/* ------------------------------------------------------------------ COPY */

const PRECO_CHEIO = `<div style="font-size:28px;font-weight:800;">R$ 97,90<span style="font-size:14px;font-weight:600;color:#888;"> uma vez, seu pra sempre</span></div>`;
const PRECO_DS = `<span style="font-size:16px;font-weight:600;color:#aaa;text-decoration:line-through;">R$ 27,90</span> <span style="font-size:28px;font-weight:800;color:#D22D80;">R$ 19,90</span><span style="font-size:14px;font-weight:600;color:#888;"> uma vez</span>`;

/** Primeiro nome utilizável pro assunto. O SQL faz COALESCE pro prefixo do
 *  e-mail, então metade dos "nomes" é lixo tipo "joao.silva92" — assunto
 *  personalizado com isso é pior que sem. Só passa o que PARECE nome. */
const primeiroNome = (raw: string): string | null => {
  const t = (raw || "").trim().split(/[\s._\-0-9]+/).filter(Boolean)[0] ?? "";
  if (!/^[A-Za-zÀ-ÿ]{2,15}$/.test(t)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

const COPY: Record<Stage, {
  subject: (nome: string | null) => string;
  headline: string;
  intro: (name: string) => string;
  selo: string;
  preco: string;
  cta: string;
  rodape: string;
}> = {
  h1: {
    // PUNK, PREÇO CHEIO (30/07). O h1 é o único toque que ainda pega gente
    // dentro da janela viva de compra (49% dos QRs pagam no mesmo dia, mediana
    // 1min) — é dele que saíram TODAS as vendas de 27,90 da régua. Descontar
    // aqui cortaria a receita pela metade e treinaria a espera.
    // Emoji fora do assunto de propósito: a suspeita nº1 dos 0,35% de clique é
    // aba Promoções, e emoji no assunto é gatilho clássico.
    // NÃO anuncia o desconto de amanhã: avisar que vem desconto é ensinar a
    // esperar — foi o que custou 7 pontos de conversão cheia no paywall.
    subject: (nome) => nome ? `${nome}, seu plano ficou pronto. e você sumiu.` : "seu plano ficou pronto. e você sumiu.",
    headline: "Você parou a 1 Pix de distância",
    intro: (n) => `${n}, direto ao ponto: seu plano tá montado e suas respostas estão salvas. O CORE inteiro — 16 módulos, sua vida num lugar só — tá do outro lado de um Pix de <b>R$ 97,90</b>. Uma vez. Pra sempre. Sem mensalidade, nunca.<br><br>E você já sabe o que acontece se não fizer nada: mais um mês igual ao passado. Conta que vence sem avisar, dinheiro que some sem explicação, aquela meta que você escreveu e não olhou mais.<br><br><b>R$ 97,90 uma vez.</b> Sem mensalidade, nunca — o que você montou fica seu.`,
    selo: "SEU ACESSO VITALÍCIO ESTÁ RESERVADO",
    preco: PRECO_CHEIO,
    cta: "Destravar meu acesso agora →",
    rodape: "1 minuto: entra, gera o Pix, libera na hora. Garantia de 7 dias — não era pra você, devolvo os R$ 97,90.",
  },
  h24: {
    subject: () => "R$ 19,90 hoje. R$ 27,90 amanhã.",
    headline: "R$ 8 a menos. Uma vez na vida.",
    intro: (n) => `${n}, sem enrolação: como é sua primeira semana, sua condição de boas-vindas liberou o CORE vitalício por <b>R$ 19,90 — 29% off, pagamento único</b>. Essa condição vale <b>48 horas</b> e não volta. Depois é R$ 27,90 (que ainda custa menos que uma pizza — só que organiza sua vida inteira).`,
    selo: "🎁 OFERTA DE BOAS-VINDAS — VALE 48 HORAS",
    preco: PRECO_DS,
    cta: "Quero por R$ 19,90 →",
    rodape: "O link já abre com o Pix de R$ 19,90 — paga e libera na hora.",
  },
  h48: {
    subject: () => "ontem, 31 pessoas entraram. você leu o e-mail.",
    headline: "Enquanto você decide, todo mundo entra",
    intro: (n) => `${n}, só ontem 31 pessoas garantiram o acesso vitalício. Uma delas me escreveu essa semana: <i>"finalmente sei pra onde meu dinheiro vai"</i> — 3 dias depois de quase desistir, igual você agora. Sua condição de <b>R$ 19,90 morre amanhã à noite</b>. Depois disso, essa história é de outra pessoa.`,
    selo: "⏳ ÚLTIMO DIA COMPLETO DE OFERTA",
    preco: PRECO_DS,
    cta: "Entrar por R$ 19,90 →",
    rodape: "16 módulos, pagamento único, garantia de 7 dias.",
  },
  h72: {
    subject: () => "à meia-noite isso expira (sem choro)",
    headline: "Última chamada — e é a última mesmo",
    intro: (n) => `${n}, hoje às 23h59 sua condição de <b>R$ 19,90 expira</b> e este é o último e-mail que oferece esse valor. Sem falsa escassez: amanhã o preço é R$ 27,90 e a gente para de escrever sobre isso. Se o CORE não é pra você, tudo certo. Se é — <b>agora ou nunca é agora</b>.`,
    selo: "🚨 EXPIRA HOJE ÀS 23H59",
    preco: PRECO_DS,
    cta: "Última chance: R$ 19,90 →",
    rodape: "Depois da meia-noite este link volta pro preço cheio.",
  },
  d7: {
    subject: () => "a gente parou de escrever. teu plano, não.",
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
            subject: `[${stage}] ${COPY[stage].subject("João")}`,
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

    const { data: todosCandidatos, error: candErr } = await supabase.rpc("recovery_email_candidates");
    if (candErr) throw candErr;
    // O SQL segue devolvendo os 5 estágios; o corte é aqui, numa linha só, pra
    // religar sem migration. Quem for cortado simplesmente não recebe nada e
    // continua elegível se um dia o estágio voltar.
    // display_name nunca vem null: o SQL faz COALESCE pro prefixo do e-mail.
    type Candidato = { user_id: string; email: string; display_name: string; stage: Stage };
    const candidates = ((todosCandidatos ?? []) as Candidato[])
      .filter((c) => ESTAGIOS_ATIVOS.includes(c.stage));
    if (!candidates.length) {
      log("No candidates");
      return Response.json({ sent: 0 });
    }
    log("Candidates", { count: candidates.length, cortados: (todosCandidatos?.length ?? 0) - candidates.length });

    /* MIRA INVERTIDA (30/07) — a de 28/07 estava apontada pro lado errado.
     *
     * Ela pulava quem gerou QR nos estágios com oferta, pra não martelar em
     * dobro com a régua da Cakto. Aí eu medi as 403 pessoas que geraram QR
     * entre 22 e 29/07:
     *     pagaram no mesmo dia (≤12h)   198  (49%)
     *     pagaram no dia seguinte         1  (0,2%)
     *     pagaram depois                  1  (0,2%)
     *     NUNCA pagaram                 203  (50%)
     * Ou seja: quem não paga nas primeiras horas não paga nunca — nem com a
     * régua da Cakto batendo a preço cheio. Aos 24h NÃO EXISTE venda cheia a
     * proteger nesse balde, então o 19,90 ali não canibaliza nada; e é o
     * segmento de MAIOR intenção do funil (chegou até o dinheiro). São ~25
     * pessoas/dia que estavam recebendo nada de nós.
     *
     * Lista vazia = ninguém é pulado. Pra restaurar a mira antiga, devolve
     * ["h24","h48","h72"] aqui — o mecanismo continua inteiro embaixo. */
    const PULAR_QUEM_GEROU_QR: Stage[] = [];
    const idsDs = [...new Set((candidates as Array<{ user_id: string; stage: Stage }>)
      .filter((c) => PULAR_QUEM_GEROU_QR.includes(c.stage)).map((c) => c.user_id))];
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
        if (PULAR_QUEM_GEROU_QR.includes(stage) && comQR.has(String(c.user_id))) {
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
            subject: COPY[stage].subject(primeiroNome(c.display_name)),
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
