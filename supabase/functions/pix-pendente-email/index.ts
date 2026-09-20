/**
 * E-MAIL DE PIX PENDENTE (20/09, ordem do dono).
 *
 * Em 20/09, 19 Pix foram gerados na web e 12 pagos. Quem gera e não paga tem
 * 30 minutos de validade no código do Asaas (expirationSeconds) e nenhuma
 * régua própria — só o e-mail genérico de 1 hora, que até hoje dizia
 * "Pix de R$ 97,90" pra quem gerou um de 27,90.
 *
 * Este cron roda a cada 10 min e, pra cada Pix gerado entre 20 e 90 min atrás
 * que NÃO virou assinatura (order_id do evento ↔ abacatepay_billing_id), manda
 * UM e-mail (um por pessoa a cada 24 h) com o valor certo da oferta e um link
 * mágico: a pessoa volta LOGADA e cai no paywall da web (27,90), onde gera
 * outro Pix em 1 toque. A régua genérica (recovery-emails, h1) passa a pular
 * quem gerou Pix — senão eram dois e-mails em 1 hora.
 *
 * Marcador: analytics_events `pix_pendente_email_enviado {order_id, offer}`.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (m: string, x?: unknown) => console.log(`[pix-pendente-email] ${m}`, x ? JSON.stringify(x) : "");
const PRECOS: Record<string, string> = { w27: "27,90", downsell: "14,90", w25: "24,90", w47: "47,90", w97: "97,90", lifetime: "97,90" };
const EH_TESTE = (email?: string | null) => !!email && /(^|[+.])teste|testeghg|jv20101958/i.test(email);
const primeiroNome = (n?: string | null) => String(n ?? "").trim().split(/\s+/)[0] || "";

function html(nome: string, preco: string, link: string) {
  const oi = nome ? `${nome}, ` : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#262626;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#8a838f;text-transform:uppercase;">Seu Pix ficou esperando</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 8px;">${oi}o Pix de <span style="color:#D22D80;">R$ ${preco}</span> que você gerou vale por 30 minutos.</h1>
    <p style="font-size:15px;line-height:1.55;margin:0 0 14px;">Se ele já venceu, não tem problema: gera outro em 1 toque. O acesso libera na hora, com todos os 16 módulos, e é pagamento único — nada de mensalidade.</p>
    <a href="${link}" style="display:block;text-align:center;background:#2a2a2a;color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px 18px;border-radius:999px;margin:18px 0 12px;">Pegar meu acesso agora →</a>
    <p style="font-size:12.5px;color:#5b5560;line-height:1.5;margin:0;">O link entra direto na sua conta. Garantia de 7 dias: não era pra você, devolvo os R$ ${preco} em 1 mensagem.</p>
  </div>
  <p style="font-size:11px;color:#8a838f;text-align:center;margin:14px 0 0;">Você recebeu este e-mail porque gerou um Pix no CORE há pouco. Se já pagou, pode ignorar.</p>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  try {
    const body = await req.json().catch(() => ({}));
    if (String(body?.modo ?? "") !== "cron" && !body?.preview) return Response.json({ error: "forbidden" }, { status: 403 });
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return Response.json({ skipped: "no RESEND_API_KEY" });
    const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM") || Deno.env.get("WELCOME_EMAIL_FROM") || "CORE <onboarding@resend.dev>";
    const from = fromBase.includes("<") ? `João do CORE <${fromBase.split("<")[1]}` : fromBase;
    const site = "https://www.coreaplicativo.com.br";
    const enviar = async (to: string, nome: string, preco: string, link: string) => {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: `Seu Pix de R$ ${preco} tá esperando`, html: html(nome, preco, link) }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    };
    // PREVIEW: manda pro e-mail informado, sem gravar nada
    if (body?.preview) { await enviar(String(body.preview), "João", "27,90", `${site}/planos?from=pix_pendente_preview`); return Response.json({ preview: true }); }

    const agora = Date.now();
    const de = new Date(agora - 90 * 60_000).toISOString(), ate = new Date(agora - 20 * 60_000).toISOString();
    const { data: gerados, error } = await supabase
      .from("analytics_events").select("user_id,session_id,created_at,event_data")
      .eq("event_name", "pix_generated").gte("created_at", de).lt("created_at", ate)
      .not("user_id", "is", null).order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    // último Pix por pessoa
    const porPessoa = new Map<string, { order_id: string; offer: string; created_at: string }>();
    for (const g of gerados ?? []) {
      const oid = String(g.event_data?.order_id ?? ""); if (!oid) continue;
      if (!porPessoa.has(String(g.user_id))) porPessoa.set(String(g.user_id), { order_id: oid, offer: String(g.event_data?.offer ?? "w27"), created_at: g.created_at });
    }
    let enviados = 0, pagos = 0, jaAvisados = 0, semEmail = 0, falhas = 0, testes = 0;
    for (const [uid, p] of porPessoa) {
      try {
        // pagou (qualquer Pix dessa pessoa depois do gerado)? então não
        const { data: sub } = await supabase.from("subscriptions").select("id").eq("user_id", uid).neq("payment_method", "play_store").gte("created_at", p.created_at).limit(1);
        if (sub?.length) { pagos++; continue; }
        const { data: sub2 } = await supabase.from("subscriptions").select("id").eq("abacatepay_billing_id", p.order_id).limit(1);
        if (sub2?.length) { pagos++; continue; }
        // já avisada nas últimas 24 h? uma vez só
        const { data: marca } = await supabase.from("analytics_events").select("id").eq("event_name", "pix_pendente_email_enviado").eq("user_id", uid).gte("created_at", new Date(agora - 24 * 3600_000).toISOString()).limit(1);
        if (marca?.length) { jaAvisados++; continue; }
        const { data: u } = await supabase.auth.admin.getUserById(uid);
        const email = u?.user?.email ?? null;
        if (!email) { semEmail++; continue; }
        if (EH_TESTE(email)) { testes++; continue; }
        const nome = primeiroNome(u?.user?.user_metadata?.full_name ?? u?.user?.user_metadata?.name);
        // link mágico: volta logada e cai no paywall da web (27,90) sem senha
        let link = `${site}/planos?from=pix_pendente&utm_source=pix_pendente_email`;
        try {
          const { data: ml } = await supabase.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${site}/auth/callback` } });
          if (ml?.properties?.action_link) link = ml.properties.action_link;
        } catch (e) { log("magic link falhou, vai o link comum", { msg: String((e as Error)?.message ?? e).slice(0, 120) }); }
        await enviar(email, nome, PRECOS[p.offer] ?? "27,90", link);
        await supabase.from("analytics_events").insert({ user_id: uid, session_id: null, event_name: "pix_pendente_email_enviado", event_data: { order_id: p.order_id, offer: p.offer } });
        enviados++;
      } catch (e) { falhas++; log("falhou", { msg: String((e as Error)?.message ?? e).slice(0, 160) }); }
    }
    log("fim", { candidatos: porPessoa.size, enviados, pagos, jaAvisados, semEmail, testes, falhas });
    return Response.json({ candidatos: porPessoa.size, enviados, pagos, jaAvisados, semEmail, testes, falhas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return Response.json({ error: msg }, { status: 500 });
  }
});
