import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * E-MAIL ÚNICO PEDINDO AVALIAÇÃO NA APP STORE (dono 30/10, texto aprovado por ele).
 *
 * Público: vitalício da web ativo (subscriptions plan=lifetime, status=active, payment_method=pix) que JÁ abriu o
 * app no iPhone (analytics_events app_device_info com plataforma=ios desde 01/09) — só quem baixou o app consegue
 * avaliar na App Store. Texto neutro: sem brinde e sem "se gostou" (Apple 5.6.1/5.6.3; pedir só pra quem gostou é
 * proibido). 1 vez por pessoa: o evento `email_avaliacao_ios_enviado` é gravado ANTES do envio (reserva).
 *
 * Só admin (mesma lista do admin-suporte). Body: {modo: "contar" | "preview" | "enviar", limite?: number}.
 *   contar  → quantos receberiam (e quantos já receberam), nada é enviado
 *   preview → manda o e-mail só pra quem chamou
 *   enviar  → manda pros próximos `limite` (padrão 100, teto 150) que ainda não receberam; chamar de novo até 0
 * Nunca loga e-mail. Usa os secrets que já existem: RESEND_API_KEY e WELCOME_EMAIL_FROM/RECOVERY_EMAIL_FROM.
 */

const ADMIN_EMAILS = ["jv20101958@gmail.com", "hyperarr@gmail.com"];
const EVENTO = "email_avaliacao_ios_enviado";
const LINK = "https://apps.apple.com/br/app/id6806913181?action=write-review";
const ASSUNTO = "Uma ajuda rápida pro CORE?";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
const log = (passo: string, d?: Record<string, unknown>) => console.log(`[EMAIL-AVALIACAO-IOS] ${passo}${d ? ` - ${JSON.stringify(d)}` : ""}`);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function htmlDoPedido(): string {
  return [
    `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f1f23;max-width:480px">`,
    `<p>Oi! Você usa o CORE no iPhone, e a gente queria te pedir uma coisa rápida: deixar a sua avaliação na App Store. Leva 30 segundos e ajuda muita gente a achar o app.</p>`,
    `<p style="margin:24px 0"><a href="${LINK}" style="display:inline-block;background:#1f1f23;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px">Avaliar o CORE na App Store</a></p>`,
    `<p>Obrigado por organizar a vida com a gente.<br/>Equipe CORE</p>`,
    `</div>`,
  ].join("");
}
export const textoDoPedido = (): string =>
  `Oi! Você usa o CORE no iPhone, e a gente queria te pedir uma coisa rápida: deixar a sua avaliação na App Store. Leva 30 segundos e ajuda muita gente a achar o app.\n\nAvaliar o CORE na App Store: ${LINK}\n\nObrigado por organizar a vida com a gente.\nEquipe CORE`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: authData } = await anon.auth.getUser(token);
    const caller = authData?.user?.email?.toLowerCase() ?? "";
    if (!ADMIN_EMAILS.includes(caller)) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const modo = String(body.modo ?? "contar");
    const limite = Math.min(150, Math.max(1, Number(body.limite) || 100));

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "CORE <onboarding@resend.dev>";
    const mandar = async (to: string) => {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], reply_to: "contato@coreaplicativo.com.br", subject: ASSUNTO, html: htmlDoPedido(), text: textoDoPedido() }),
      });
      return r.ok;
    };

    if (modo === "preview") {
      if (!resendKey) return json({ error: "sem RESEND_API_KEY" }, 500);
      return json({ preview: await mandar(caller) });
    }

    // o banco devolve no máximo 1000 linhas por consulta: pagina até acabar (31/10: sem isso o público parava em 999)
    // deno-lint-ignore no-explicit-any
    const todas = async (monta: () => any): Promise<Record<string, unknown>[]> => {
      const out: Record<string, unknown>[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await monta().range(de, de + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if ((data ?? []).length < 1000) return out;
      }
    };

    // o público: vitalício da web ativo que já abriu o app no iPhone
    const subs = await todas(() => admin.from("subscriptions")
      .select("user_id, customer_email").eq("plan", "lifetime").eq("status", "active").eq("payment_method", "pix").order("created_at"));
    const emailDe = new Map<string, string | null>();
    for (const s of subs) if (s.user_id && !emailDe.has(s.user_id as string)) emailDe.set(s.user_id as string, (s.customer_email as string) ?? null);
    const ids = [...emailDe.keys()];
    const iphone = new Set<string>();
    const jaRecebeu = new Set<string>();
    for (let i = 0; i < ids.length; i += 50) {
      const ch = ids.slice(i, i + 50);
      const ev = await todas(() => admin.from("analytics_events").select("user_id")
        .eq("event_name", "app_device_info").eq("event_data->>plataforma", "ios").gte("created_at", "2026-09-01").in("user_id", ch).order("created_at"));
      for (const e of ev) iphone.add(e.user_id as string);
      const ja = await todas(() => admin.from("analytics_events").select("user_id").eq("event_name", EVENTO).in("user_id", ch).order("created_at"));
      for (const e of ja) jaRecebeu.add(e.user_id as string);
    }
    const fila = [...iphone].filter((u) => !jaRecebeu.has(u));

    if (modo === "contar") return json({ vitalicio_ativos: ids.length, usam_iphone: iphone.size, ja_receberam: jaRecebeu.size, faltam: fila.length });
    if (modo !== "enviar") return json({ error: "modo inválido" }, 400);
    if (!resendKey) return json({ error: "sem RESEND_API_KEY" }, 500);

    let enviados = 0, falhas = 0, semEmail = 0;
    for (const uid of fila.slice(0, limite)) {
      let to = emailDe.get(uid) ?? null;
      if (!to) { const { data: u } = await admin.auth.admin.getUserById(uid); to = u?.user?.email ?? null; }
      if (!to) { semEmail++; continue; }
      // reserva ANTES de mandar: se cair no meio, ninguém recebe 2×
      const { error: e4 } = await admin.from("analytics_events").insert({ user_id: uid, event_name: EVENTO, event_data: { link: "app_store_write_review" } });
      if (e4) { falhas++; continue; }
      if (await mandar(to)) enviados++; else falhas++;
      await espera(550); // Resend: 2 por segundo
    }
    log("enviar", { enviados, falhas, semEmail, restam: Math.max(0, fila.length - limite) });
    return json({ enviados, falhas, sem_email: semEmail, restam: Math.max(0, fila.length - limite) });
  } catch (e) {
    log("erro", { msg: String((e as Error)?.message ?? e).slice(0, 200) });
    return json({ error: "falhou" }, 500);
  }
});
