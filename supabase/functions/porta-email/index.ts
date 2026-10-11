/**
 * E-MAIL "SEU PLANO ESTÁ SALVO — ENTRE NO CORE" DA PORTA iPHONE — NÃO DEPLOYADO.
 *
 * 10/10 (v2): o envio de verdade saiu daqui. Ele acontece LOGO DEPOIS da conta criada, dentro do
 * `porta-handoff` ("criar", chamado pelo site), com o MESMO código de uso único que o site mostra:
 * botão "Entrar no CORE" → `core://entrar?h=<código>` + link de reserva https + os 3 passos.
 * Sem cron, sem esperar 10 min. O modelo do e-mail mora em ../_shared/email-porta.ts.
 *
 * Esta função ficou só como PRÉ-VISUALIZAÇÃO pro dono: body {preview:"email@x", metodo?} manda um
 * exemplo (código de mentira, não grava nada). Exige a service role no Authorization.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ASSUNTO_PORTA, htmlPorta } from "../_shared/email-porta.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!service || (req.headers.get("Authorization") ?? "") !== `Bearer ${service}`) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const para = String(body?.preview ?? "");
  if (!/\S+@\S+\.\S+/.test(para)) return Response.json({ error: "preview" }, { status: 400 });
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return Response.json({ skipped: "no RESEND_API_KEY" });
  const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM") || Deno.env.get("WELCOME_EMAIL_FROM") || "CORE <onboarding@resend.dev>";
  const from = fromBase.includes("<") ? `CORE <${fromBase.split("<")[1]}` : fromBase;
  const metodo = ["senha", "apple", "google"].includes(String(body?.metodo)) ? String(body.metodo) : "senha";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], subject: `[exemplo] ${ASSUNTO_PORTA}`, html: htmlPorta({ email: para, metodo, codigo: "EXEMPLO234" }) }),
  });
  return Response.json({ preview: r.ok, status: r.status });
});
