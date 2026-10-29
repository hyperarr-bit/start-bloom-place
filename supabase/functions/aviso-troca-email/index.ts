import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * AVISO NO E-MAIL ANTIGO QUANDO PEDEM A TROCA DO E-MAIL (29/10, telas pages/conta).
 *
 * A troca em si é do Supabase Auth (updateUser({email}) → link de confirmação). Esta função só AVISA o endereço que a
 * conta tem HOJE: "pediram pra trocar o e-mail da sua conta pra n***@dominio; se não foi você, responda". Com o
 * "Secure email change" ligado o Supabase já manda um link pro e-mail antigo também; com ele desligado, sem esta
 * função o dono do e-mail antigo não fica sabendo de nada.
 *
 * Segurança: exige o token da pessoa e só escreve pro e-mail que a PRÓPRIA conta tem no servidor, e só quando existe
 * uma troca pendente (`new_email`) — não aceita destinatário do cliente, não serve pra mandar e-mail pra terceiros.
 * Nunca grava nem loga e-mail. Falha do Resend só vai pro log; a troca segue igual.
 *
 * DEPLOY (não publicado): `supabase functions deploy aviso-troca-email` (verify_jwt padrão = true, nada no config.toml).
 * Usa os secrets que já existem: RESEND_API_KEY e WELCOME_EMAIL_FROM/RECOVERY_EMAIL_FROM.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

const log = (passo: string, d?: Record<string, unknown>) => console.log(`[AVISO-TROCA-EMAIL] ${passo}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/** "maria.silva@gmail.com" → "m***@gmail.com" */
export function mascarar(email: string): string {
  const [nome, dominio] = email.split("@");
  if (!nome || !dominio) return "***";
  return `${nome.slice(0, 1)}***@${dominio}`;
}

export function htmlDoAviso(novoMascarado: string): string {
  return [
    `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1f1f23;max-width:480px">`,
    `<p><b>Pediram pra trocar o e-mail da sua conta do CORE.</b></p>`,
    `<p>O e-mail novo seria <b>${novoMascarado}</b>. A troca só vale depois que alguém tocar no link de confirmação enviado pra ele.</p>`,
    `<p>Foi você? Então está tudo certo, não precisa fazer nada aqui.</p>`,
    `<p>Não foi você? Responda este e-mail que a gente bloqueia a troca.</p>`,
    `<p style="color:#6b6b75;font-size:13px">Seu plano e seus dados continuam na mesma conta.</p>`,
    `</div>`,
  ].join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "nao_autenticado" }, 401);
    const { data: authData } = await anon.auth.getUser(token);
    const id = authData?.user?.id;
    if (!id) return json({ error: "nao_autenticado" }, 401);

    // lido do servidor (nunca do corpo): o e-mail de hoje e a troca pendente
    const { data: u, error } = await admin.auth.admin.getUserById(id);
    if (error || !u?.user) return json({ error: "sem_usuario" }, 404);
    const atual = u.user.email ?? "";
    const novo = (u.user as { new_email?: string | null }).new_email ?? "";
    if (!atual || !novo) { log("sem troca pendente", { userId: id }); return json({ ok: true, enviado: false }); }

    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendKey) { log("sem RESEND_API_KEY"); return json({ ok: true, enviado: false }); }
    const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [atual], reply_to: "contato@coreaplicativo.com.br",
        subject: "Pedido de troca do e-mail da sua conta CORE",
        html: htmlDoAviso(mascarar(novo)),
      }),
    });
    log("aviso enviado", { userId: id, ok: r.ok, status: r.status });
    return json({ ok: true, enviado: r.ok });
  } catch (e) {
    log("ERRO", { msg: e instanceof Error ? e.message : String(e) });
    return json({ error: "falhou" }, 500);
  }
});
