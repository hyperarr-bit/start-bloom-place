import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { assuntoEmailPix, htmlEmailPix, textoEmailPix } from "../_shared/email-cobranca-pix.ts";

/**
 * cobranca-recusada — e-mail pra quem quis continuar no CORE e o cartão não
 * passou na App Store (28/09, ordem do dono).
 *
 * Por que: nas turmas do teste grátis do iPhone de 21–24/09, a Apple recusou
 * o cartão de tanta gente quanto pagou (24% × 24%) e ninguém se recuperou —
 * 14 de 22 nem abriram o app depois do fim do teste, então o aviso de dentro
 * do app ("Seu pagamento não passou", 1.0.7) nunca chegou nelas. A carência
 * de 16 dias já está ligada na App Store; faltava avisar FORA do app, e cedo:
 * 40% das recuperações da Apple acontecem nos 3 primeiros dias.
 *
 * Duas portas:
 *  - revenuecat-webhook, no BILLING_ISSUE da App Store (Authorization = a
 *    service role): POST {userId} → um e-mail pra essa pessoa;
 *  - admin logado, o lote de quem JÁ está com o cartão recusado:
 *    POST {dry_run:true} só conta; POST {enviar:true} manda.
 * Nas duas o estado é conferido na API do RevenueCat (o evento não é fonte de
 * verdade).
 *
 * DOIS MODOS do lote (01/10):
 *  - "apple" (padrão, o de 28/09): só manda atualizar o pagamento na App
 *    Store. Marcador `cobranca_recusada_email`, 1 e-mail a cada 20 dias.
 *    Recuperou 0 de 23+ — por isso o modo abaixo.
 *  - "pix" (POST {modo:"pix", dry_run:true} / {modo:"pix", enviar:true}):
 *    oferece ficar no CORE pagando R$ 97,90 UMA VEZ no Pix (oferta `w97`,
 *    vitalícia, Asaas) no lugar dos 97,90/ano da Apple, com link mágico que
 *    cai LOGADO em /planos?oferta=w97 (link vencido → /entrar com o e-mail
 *    preenchido e volta pra oferta). Marcador próprio
 *    `cobranca_recusada_pix_email` {via, com_acesso, oferta, link}, 1 envio
 *    por pessoa, na vida. Texto em _shared/email-cobranca-pix.ts (testado).
 *    POST {modo:"pix", preview:true} manda o e-mail pro PRÓPRIO admin logado,
 *    com link de verdade, sem gravar marcador — é o QA do dono.
 *  Endereços @privaterelay.appleid.com saem contados à parte no dry_run: só
 *  chegam se o domínio de envio estiver registrado na Apple (Sign in with
 *  Apple → "Configure Email Communication").
 */

const log = (step: string, d?: unknown) =>
  console.log(`[COBRANCA-RECUSADA] ${step}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const RC_API = "https://api.revenuecat.com/v2";
const PROJETO = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "proj1f095041";
const ADMIN_EMAILS = ["jv20101958@gmail.com", "hyperarr@gmail.com"];
const MARCADOR = "cobranca_recusada_email";
const MARCADOR_PIX = "cobranca_recusada_pix_email";
const INTERVALO_MS = 20 * 86400_000;
const URL_PAGAMENTO = "https://apps.apple.com/account/billing";
const SITE = "https://www.coreaplicativo.com.br";
// Destino do link: a oferta w97 no /planos (o `from` entra no planos_view)
const DESTINO_PIX = "/planos?oferta=w97&from=cobranca_recusada_pix";
// Cartão recusado com a pessoa ainda querendo continuar: na carência (com
// acesso) ou depois dela, com a Apple ainda tentando (sem acesso).
const RECUSADO = new Set(["in_grace_period", "in_billing_retry"]);
const EH_TESTE = (email?: string | null) => !!email && /(^|[+.])teste|testeghg|jv20101958/i.test(email);
const EH_PRIVATERELAY = (email: string) => /@privaterelay\.appleid\.com$/i.test(email);

type Modo = "apple" | "pix";
type SubRC = { id?: string; status?: string; store?: string; gives_access?: boolean; auto_renewal_status?: string };
type Alvo = { id: string; email: string; nome: string; comAcesso: boolean };

// O id da assinatura no RevenueCat diz a loja: subAap… = App Store,
// subGps… = Google Play (conferido na tabela subscriptions em 28/09).
const daApple = (s: SubRC) =>
  String(s?.id ?? "").startsWith("subAap") || String(s?.store ?? "").toLowerCase() === "app_store";

async function estadoNaApple(userId: string, secret: string): Promise<{ recusada: boolean; comAcesso: boolean }> {
  const r = await fetch(`${RC_API}/projects/${PROJETO}/customers/${encodeURIComponent(userId)}/subscriptions`, {
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  });
  if (!r.ok) return { recusada: false, comAcesso: false };
  const j = await r.json().catch(() => null);
  const s = ((j?.items ?? []) as SubRC[]).find((x) =>
    daApple(x) && RECUSADO.has(String(x?.status)) && x?.auto_renewal_status !== "will_not_renew"
  );
  return { recusada: !!s, comAcesso: !!s?.gives_access };
}

const primeiroNome = (nome?: string | null) => {
  const n = (nome || "").trim().split(/\s+/)[0];
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : "";
};

const assunto = (nome: string) =>
  nome ? `${nome}, o pagamento do seu CORE não passou` : "O pagamento do seu CORE não passou";

const emailHtml = (nome: string, comAcesso: boolean) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 20px;color:#1e2430;line-height:1.6;">
  <p>Oi${nome ? `, ${nome}` : ""}!</p>
  <p>A Apple tentou cobrar a sua assinatura do CORE e o cartão não passou. Acontece bastante: cartão vencido, sem limite naquele dia ou bloqueado pra compra online.</p>
  <p>${comAcesso
    ? "O seu acesso continua liberado por enquanto, e a Apple vai tentar de novo nos próximos dias. Pra não perder nada do que você já organizou, é só atualizar a forma de pagamento:"
    : "Tudo o que você anotou continua guardado. Pra voltar a usar, é só atualizar a forma de pagamento:"}</p>
  <p style="margin:28px 0;">
    <a href="${URL_PAGAMENTO}" style="background:#127A56;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:700;display:inline-block;">Atualizar pagamento na App Store</a>
  </p>
  <p>Ou direto no iPhone: <b>Ajustes → toque no seu nome → Pagamento e Envio</b>.</p>
  <p>Se o cartão continuar recusando, dá pra cadastrar outro (muitos bancos têm cartão virtual no app) ou pôr saldo na sua Conta Apple com um cartão-presente da Apple.</p>
  <p>Depois de atualizar, a Apple cobra sozinha — não precisa fazer mais nada no app.</p>
  <p>Qualquer dúvida, é só responder este e-mail.</p>
  <p>Um abraço,<br/>João, do CORE</p>
</div>`;

async function montarAlvo(supabase: SupabaseClient, uid: string, secret: string): Promise<Alvo | null> {
  const { data: u } = await supabase.auth.admin.getUserById(uid);
  const user = u?.user;
  const email = user?.email;
  if (!user || !email || EH_TESTE(email) || ADMIN_EMAILS.includes(email.toLowerCase())) return null;
  const { data: teste } = await supabase.rpc("is_test_user", { _user_id: uid });
  if (teste) return null;
  const est = await estadoNaApple(uid, secret);
  if (!est.recusada) return null;
  const nome = primeiroNome((user.user_metadata?.display_name || user.user_metadata?.name || "") as string);
  return { id: uid, email, nome, comAcesso: est.comAcesso };
}

/** Quem já recebeu: o marcador do modo. Apple = 1 a cada 20 dias; Pix = 1 na vida. */
async function jaRecebeu(supabase: SupabaseClient, ids: string[], modo: Modo): Promise<Set<string>> {
  if (!ids.length) return new Set();
  let q = supabase
    .from("analytics_events")
    .select("user_id")
    .eq("event_name", modo === "pix" ? MARCADOR_PIX : MARCADOR)
    .in("user_id", ids);
  if (modo === "apple") q = q.gte("created_at", new Date(Date.now() - INTERVALO_MS).toISOString());
  const { data } = await q;
  return new Set((data || []).map((r: { user_id: string }) => r.user_id));
}

async function enviar(supabase: SupabaseClient, a: Alvo, via: string, resendKey: string, from: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [a.email], subject: assunto(a.nome), html: emailHtml(a.nome, a.comAcesso) }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 150)}`);
  await supabase.from("analytics_events").insert({
    user_id: a.id,
    event_name: MARCADOR,
    event_data: { via, loja: "app_store", com_acesso: a.comAcesso },
  });
}

/** Link do e-mail do Pix: mágico (entra logado e cai na oferta) ou, se o
 *  GoTrue falhar, o /entrar com o e-mail preenchido e o mesmo destino. O
 *  callback recebe `next` (só caminho interno — destino-seguro.ts) e `e`. */
async function linkPix(supabase: SupabaseClient, email: string): Promise<{ link: string; tipo: "magic" | "comum" }> {
  const q = new URLSearchParams({ next: DESTINO_PIX, e: email });
  const comum = `${SITE}/entrar?${q.toString()}`;
  try {
    const { data: ml, error } = await supabase.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: `${SITE}/auth/callback?${q.toString()}` },
    });
    if (error) throw error;
    if (ml?.properties?.action_link) return { link: ml.properties.action_link, tipo: "magic" };
  } catch (e) {
    log("magic link falhou, vai o link comum", { msg: String((e as Error)?.message ?? e).slice(0, 120) });
  }
  return { link: comum, tipo: "comum" };
}

async function enviarPix(
  supabase: SupabaseClient, a: Alvo, via: string, resendKey: string, from: string, opts: { gravar: boolean },
) {
  const { link, tipo } = await linkPix(supabase, a.email);
  const dados = { nome: a.nome, comAcesso: a.comAcesso, email: a.email, link };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [a.email], subject: assuntoEmailPix(a.nome), html: htmlEmailPix(dados), text: textoEmailPix(dados) }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 150)}`);
  if (!opts.gravar) return;
  await supabase.from("analytics_events").insert({
    user_id: a.id,
    event_name: MARCADOR_PIX,
    event_data: { via, loja: "app_store", com_acesso: a.comAcesso, oferta: "w97", link: tipo, privaterelay: EH_PRIVATERELAY(a.email) },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("método", { status: 405 });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");

  // Quem chama: o revenuecat-webhook (service role) ou um admin logado.
  const doWebhook = !!serviceKey && jwt === serviceKey;
  let adminEmail: string | null = null;
  if (!doWebhook) {
    const { data: quem } = await supabase.auth.getUser(jwt);
    if (!quem?.user) return Response.json({ error: "não autenticado" }, { status: 401 });
    const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
    if (!ehAdmin && !ADMIN_EMAILS.includes(String(quem.user.email ?? "").toLowerCase())) {
      return Response.json({ error: "não autorizado" }, { status: 403 });
    }
    adminEmail = quem.user.email ?? null;
  }

  const body = await req.json().catch(() => ({}));
  const secret = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!secret || !resendKey) return Response.json({ error: "sem REVENUECAT_SECRET_KEY/RESEND_API_KEY" }, { status: 500 });
  const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM") || Deno.env.get("WELCOME_EMAIL_FROM") || "CORE <onboarding@resend.dev>";
  const from = fromBase.includes("<") ? `João do CORE <${fromBase.split("<")[1]}` : fromBase;
  const modo: Modo = body?.modo === "pix" ? "pix" : "apple";

  try {
    // Porta 1 — o webhook: uma pessoa (sempre o e-mail da Apple; o Pix é o lote).
    if (doWebhook) {
      const uid = String(body?.userId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(uid)) return Response.json({ error: "userId" }, { status: 400 });
      if ((await jaRecebeu(supabase, [uid], "apple")).has(uid)) return Response.json({ enviado: false, motivo: "ja_recebeu" });
      const alvo = await montarAlvo(supabase, uid, secret);
      if (!alvo) return Response.json({ enviado: false, motivo: "fora_do_alvo" });
      await enviar(supabase, alvo, "webhook", resendKey, from);
      log("enviado", { uid: uid.slice(0, 8), comAcesso: alvo.comAcesso });
      return Response.json({ enviado: true });
    }

    // QA do dono: o e-mail do Pix pra ele mesmo, com link de verdade, sem marcador.
    if (modo === "pix" && body?.preview === true) {
      if (!adminEmail) return Response.json({ error: "sem e-mail do admin" }, { status: 400 });
      await enviarPix(supabase, { id: "preview", email: adminEmail, nome: "João", comAcesso: true }, "preview", resendKey, from, { gravar: false });
      log("preview enviado", { para: adminEmail.slice(0, 3) + "***" });
      return Response.json({ preview: true, para: adminEmail });
    }

    // Porta 2 — o lote: toda assinatura da App Store (o prefixo subAap é da
    // Apple), conferida uma a uma no RevenueCat.
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("payment_method", "play_store")
      .like("revenuecat_subscription_id", "subAap%");
    const ids = [...new Set((subs || []).map((r: { user_id: string }) => r.user_id).filter(Boolean))];
    const recebeu = await jaRecebeu(supabase, ids, modo);
    const pendentes = ids.filter((id) => !recebeu.has(id));

    const alvos: Alvo[] = [];
    for (let i = 0; i < pendentes.length; i += 5) {
      const lote = await Promise.all(pendentes.slice(i, i + 5).map((id) => montarAlvo(supabase, id, secret).catch(() => null)));
      for (const a of lote) if (a) alvos.push(a);
    }
    const resumo = {
      modo,
      assinaturas_apple: ids.length,
      ja_receberam: recebeu.size,
      cartao_recusado: alvos.length,
      com_acesso: alvos.filter((a) => a.comAcesso).length,
      sem_acesso: alvos.filter((a) => !a.comAcesso).length,
      // só chegam se o domínio de envio estiver registrado na Apple
      email_privaterelay: alvos.filter((a) => EH_PRIVATERELAY(a.email)).length,
    };
    if (!body?.enviar) {
      log("dry_run", resumo);
      return Response.json({ dry_run: true, ...resumo });
    }

    const via = String(body?.via ?? (modo === "pix" ? "lote_pix_0110" : "lote_2809")).slice(0, 40);
    let enviados = 0;
    const erros: string[] = [];
    for (const a of alvos) {
      try {
        if (modo === "pix") await enviarPix(supabase, a, via, resendKey, from, { gravar: true });
        else await enviar(supabase, a, via, resendKey, from);
        enviados++;
      } catch (e) { erros.push(`${a.id.slice(0, 8)}: ${String(e).slice(0, 120)}`); }
    }
    log("lote", { ...resumo, enviados, erros: erros.length });
    return Response.json({ ...resumo, enviados, erros });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return Response.json({ error: message }, { status: 500 });
  }
});
