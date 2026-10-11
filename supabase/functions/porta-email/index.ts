/**
 * E-MAIL "ENTRAR NO CORE" DA PORTA iPHONE (10/10) — NÃO DEPLOYADO.
 *
 * Quem cria a conta na /comece (Porta iPhone) e não aparece no app em 10 min
 * recebe UM e-mail com os 3 passos: baixar, tocar em "Entrar" (abaixo do Começar),
 * entrar do mesmo jeito que criou a conta (senha, Apple ou Google). É o caminho que funciona
 * quando o navegador do Instagram não abre a loja, ou quando a pessoa fecha a
 * aba antes de baixar.
 *
 * Cron a cada 10 min (mesmo padrão do pix-pendente-email): body {modo:"cron"}.
 *   · candidatos: analytics_events `porta_conta_criada` com user_id, entre 10 e 120 min atrás;
 *   · pula quem já recebeu (`porta_email_enviado` com o mesmo user_id);
 *   · pula quem já entrou no app (evento do user_id numa sessão com app_device_info/webview_info);
 *   · e-mail lido pelo service role (auth.admin.getUserById); nada de preço; nada de "grátis".
 * Preview: body {preview:"email@x"} manda um exemplo sem gravar nada.
 *
 * Pra ligar (precisa do dono): `npx supabase functions deploy porta-email` + um cron
 * (pg_cron/agendador) chamando a cada 10 min com {modo:"cron"} e a service key.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (m: string, x?: unknown) => console.log(`[porta-email] ${m}`, x ? JSON.stringify(x) : "");
const EH_TESTE = (email?: string | null) => !!email && /(^|[+.])teste|testeghg|jv20101958|revisao\.apple/i.test(email);
const SITE = "https://coreaplicativo.com.br";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function htmlPorta(email: string, metodo: string) {
  const e = esc(email);
  // o passo 3 é o jeito que a conta foi criada na Porta (v2: senha, Apple ou Google; sem código)
  const passo3 = metodo === "google"
    ? `Toque em <b>“Continuar com Google”</b> e escolha <b>${e}</b>.`
    : metodo === "apple"
      ? `Toque em <b>“Continuar com a Apple”</b>.`
      : `Digite <b>${e}</b> e a sua senha e toque em <b>“Entrar no meu CORE”</b>.`;
  const passo = (n: number, t: string) => `<tr><td style="vertical-align:top;padding:0 12px 14px 0;"><div style="width:26px;height:26px;border-radius:13px;background:#d22d80;color:#fff;font-weight:900;font-size:13px;line-height:26px;text-align:center;">${n}</div></td><td style="vertical-align:top;padding:3px 0 14px;font-size:15px;line-height:1.45;color:#16121c;">${t}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#8a838f;text-transform:uppercase;">Seu plano está salvo</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 6px;">Falta só entrar no app.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#5b5560;">Sua conta: <b style="color:#16121c;">${e}</b></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${passo(1, "Baixe o <b>CORE</b> no celular.")}
      ${passo(2, "Abra o app e toque em <b>“Entrar”</b>, logo abaixo do botão Começar. Não toque em “Começar”.")}
      ${passo(3, passo3)}
    </table>
    <a href="${SITE}/baixar?origem=porta_email" style="display:block;text-align:center;background:#16121c;color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px 18px;border-radius:999px;margin:8px 0 12px;">Baixar o CORE</a>
    <p style="font-size:13px;color:#5b5560;line-height:1.5;margin:0;">Quer ver com fotos? <a href="${SITE}/como-entrar" style="color:#d22d80;font-weight:700;">Passo a passo</a></p>
  </div>
  <p style="font-size:11px;color:#8a838f;text-align:center;margin:14px 0 0;">Você recebeu este e-mail porque salvou um plano no CORE agora há pouco.</p>
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
    const from = fromBase.includes("<") ? `CORE <${fromBase.split("<")[1]}` : fromBase;
    const enviar = async (to: string, metodo: string) => {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: "Entrar no CORE: seu plano está te esperando", html: htmlPorta(to, metodo) }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    };
    if (body?.preview) { await enviar(String(body.preview), "senha"); return Response.json({ preview: true }); }

    const agora = Date.now();
    const de = new Date(agora - 120 * 60_000).toISOString(), ate = new Date(agora - 10 * 60_000).toISOString();
    const { data: criadas, error } = await supabase
      .from("analytics_events").select("user_id,created_at,event_data")
      .eq("event_name", "porta_conta_criada").gte("created_at", de).lt("created_at", ate)
      .not("user_id", "is", null).limit(300);
    if (error) throw error;
    const porUser = new Map<string, { metodo: string; t: string }>();
    for (const c of criadas ?? []) if (!porUser.has(String(c.user_id))) porUser.set(String(c.user_id), { metodo: String(c.event_data?.metodo ?? "senha"), t: c.created_at });

    let enviados = 0, jaAvisados = 0, noApp = 0, semEmail = 0, testes = 0, falhas = 0;
    for (const [uid, c] of porUser) {
      try {
        const { data: ja } = await supabase.from("analytics_events").select("id").eq("event_name", "porta_email_enviado").eq("user_id", uid).limit(1);
        if (ja?.length) { jaAvisados++; continue; }
        // já entrou no app? (algum evento dele numa sessão nativa)
        const { data: dele } = await supabase.from("analytics_events").select("session_id").eq("user_id", uid).gte("created_at", c.t).limit(200);
        const sessoes = [...new Set((dele ?? []).map((r) => r.session_id).filter(Boolean))];
        if (sessoes.length) {
          const { data: nat } = await supabase.from("analytics_events").select("id").in("event_name", ["app_device_info", "webview_info"]).in("session_id", sessoes).limit(1);
          if (nat?.length) { noApp++; continue; }
        }
        const { data: u } = await supabase.auth.admin.getUserById(uid);
        const email = u?.user?.email ?? null;
        if (!email) { semEmail++; continue; }
        if (EH_TESTE(email)) { testes++; continue; }
        await enviar(email, c.metodo);
        await supabase.from("analytics_events").insert({ user_id: uid, event_name: "porta_email_enviado", event_data: { metodo: c.metodo }, session_id: null });
        enviados++;
      } catch (e) {
        falhas++;
        log("falha", { msg: String((e as Error)?.message ?? e).slice(0, 160) });
      }
    }
    const res = { candidatos: porUser.size, enviados, jaAvisados, noApp, semEmail, testes, falhas };
    log("ok", res);
    return Response.json(res);
  } catch (e) {
    log("erro", { msg: String((e as Error)?.message ?? e).slice(0, 200) });
    return Response.json({ error: "erro" }, { status: 500 });
  }
});
