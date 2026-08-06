import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Winback ONE-OFF do lançamento do trial (06/08).
 *
 * O público: quem ABRIU a folha de compra do Google no app e cancelou nos
 * dias 04-06/08 — a maioria esbarrou no anual SEM trial (a oferta de 3 dias
 * só ligou na noite de 05/08, e teve gente que tentou 9 vezes). A prova de
 * que o aviso paga: bb0e165b cancelou dia 05 sem trial e assinou dia 06
 * quando o trial apareceu sozinho.
 *
 * Não é régua: dispara uma vez por pessoa (marca `app_winback_email` no
 * analytics e nunca repete), exclui quem já tem QUALQUER linha em
 * subscriptions e quem é conta de teste. Só admin invoca.
 *
 * POST {dry_run:true}  → lista quem receberia, sem enviar
 * POST {preview:"x@y"} → manda a copy pra esse endereço, sem gravar nada
 * POST {}              → envia de verdade
 */

const log = (step: string, details?: unknown) =>
  console.log(`[APP-WINBACK-TRIAL] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const PLAY_URL = "https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app";

const primeiroNome = (nome?: string | null) => {
  const n = (nome || "").trim().split(/\s+/)[0];
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : "";
};

const assunto = (nome: string) =>
  nome ? `${nome}, o CORE agora tem 3 dias grátis` : "O CORE agora tem 3 dias grátis";

const emailHtml = (nome: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 20px;color:#1e2430;line-height:1.6;">
  <p>Oi${nome ? `, ${nome}` : ""}!</p>
  <p>Vi que você chegou a abrir a assinatura do CORE no Google Play e acabou não concluindo — e queria te avisar de uma coisa que mudou <b>depois</b> disso:</p>
  <p style="font-size:17px;"><b>o plano anual agora começa com 3 dias grátis.</b></p>
  <p>Na prática: <b>R$&nbsp;0,00 hoje</b>, você usa tudo, e se não fizer sentido é só cancelar na Play Store em 2 toques antes do fim do teste — não cobra nada.</p>
  <p style="margin:28px 0;">
    <a href="${PLAY_URL}" style="background:#127A56;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:700;display:inline-block;">Abrir o CORE e começar o teste</a>
  </p>
  <p>Qualquer dúvida, responde este e-mail que sou eu que leio.</p>
  <p>— João, do CORE</p>
</div>`;

serve(async (req) => {
  if (req.method !== "POST") return new Response("método", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Só admin dispara (mesmo contrato do painel).
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: quem } = await supabase.auth.getUser(jwt);
  if (!quem?.user) return Response.json({ error: "não autenticado" }, { status: 401 });
  const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
  if (!ehAdmin) return Response.json({ error: "não autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return Response.json({ skipped: "no RESEND_API_KEY" });
  const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM")
    || Deno.env.get("WELCOME_EMAIL_FROM")
    || "CORE <onboarding@resend.dev>";
  const from = fromBase.includes("<") ? `João do CORE <${fromBase.split("<")[1]}` : fromBase;

  if (body?.preview) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [String(body.preview)], subject: `[preview] ${assunto("João")}`, html: emailHtml("João") }),
    });
    return Response.json({ preview: body.preview, ok: r.ok });
  }

  // 1) intenção alta sem conclusão, 04/08 em diante:
  //    - cancelou a folha do Google (app_compra_falhou)
  //    - fechou o painel intermediário da v37 depois de tocar em assinar
  //      (app_sheet_cta sem sucesso — o dia 06 mostrou 5 pessoas morrendo aí)
  const { data: intencao } = await supabase
    .from("analytics_events")
    .select("user_id, event_name, event_data")
    .in("event_name", ["app_compra_falhou", "app_sheet_cta"])
    .gte("created_at", "2026-08-04T00:00:00Z")
    .not("user_id", "is", null);
  const alvo = [...new Set((intencao || []).map((r: { user_id: string }) => r.user_id))];

  // 2) tira quem já tem assinatura (qualquer status: trial conta como dentro)
  const { data: subs } = await supabase.from("subscriptions").select("user_id").in("user_id", alvo);
  const comSub = new Set((subs || []).map((r: { user_id: string }) => r.user_id));

  // 3) tira teste + quem já recebeu este winback
  const { data: jaFoi } = await supabase
    .from("analytics_events")
    .select("user_id")
    .eq("event_name", "app_winback_email")
    .in("user_id", alvo);
  const enviado = new Set((jaFoi || []).map((r: { user_id: string }) => r.user_id));

  const finais: { id: string; email: string; nome: string }[] = [];
  for (const id of alvo) {
    if (comSub.has(id) || enviado.has(id)) continue;
    const { data: teste } = await supabase.rpc("is_test_user", { _user_id: id });
    if (teste) continue;
    const { data: u } = await supabase.auth.admin.getUserById(id);
    const email = u?.user?.email;
    if (!email) continue;
    const nome = primeiroNome(
      (u.user.user_metadata?.display_name || u.user.user_metadata?.name || "") as string,
    );
    finais.push({ id, email, nome });
  }

  if (body?.dry_run) {
    log("dry_run", { total: finais.length });
    return Response.json({
      dry_run: true,
      total: finais.length,
      quem: finais.map((f) => ({ id: f.id.slice(0, 8), email: f.email.replace(/^(..).*(@.*)$/, "$1…$2"), nome: f.nome })),
    });
  }

  let enviados = 0;
  const erros: string[] = [];
  for (const f of finais) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [f.email], subject: assunto(f.nome), html: emailHtml(f.nome) }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 150)}`);
      await supabase.from("analytics_events").insert({
        user_id: f.id,
        event_name: "app_winback_email",
        event_data: { via: "trial_lancado_0608" },
      });
      enviados++;
    } catch (e) {
      erros.push(`${f.id.slice(0, 8)}: ${String(e).slice(0, 120)}`);
    }
  }
  log("done", { enviados, erros: erros.length });
  return Response.json({ enviados, erros });
});
