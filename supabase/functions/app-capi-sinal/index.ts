/**
 * app-capi-sinal — guarda IP + user-agent do aparelho pra CAPI do app.
 *
 * LGPD aprovada em 10/10/2026: o IP fica ~10 dias (a Meta aceita evento por
 * 7, o cron olha 12) e só serve pra mandar client_ip_address JUNTO com
 * client_user_agent. Um sem o outro a Meta descarta.
 *
 * O IP é lido do header desta requisição (x-forwarded-for / cf-connecting-ip),
 * nunca do corpo. Não vai pra analytics_events e não entra no log.
 * O cron `app-capi-sinais-expira` apaga a linha vencida.
 *
 * POST /functions/v1/app-capi-sinal
 * Authorization: Bearer <jwt do app ou chave anon>
 * {"session_id":"<core_session_id>","rc_app_user_id":"$RCAnonymousID:…"}
 *   rc_app_user_id é opcional — o app 1.0.12 pode passar; sem ele o pareamento
 *   do teste anônimo usa só a sessão, e o backfill acha o sinal pelo user_id
 *   quando a pessoa já tem conta.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ehUuid, expiraIp, ipDoCabecalho, parIpUa } from "../_shared/meta-capi-app.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" }, status: s });
const log = (p: string, d?: Record<string, unknown>) =>
  console.log(`[APP-CAPI-SINAL] ${p}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const ip = ipDoCabecalho(req.headers.get("x-forwarded-for"), req.headers.get("cf-connecting-ip"));
  const par = parIpUa(ip, req.headers.get("user-agent"));
  if (!par) return json({ ok: true, guardado: false });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const auth = req.headers.get("Authorization") ?? "";
  let userId: string | null = null;
  if (auth) {
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data } = await anon.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    userId = data?.user?.id ?? null;
  }

  const body = await req.json().catch(() => ({}));
  const sessionBruta = typeof body?.session_id === "string" ? body.session_id : "";
  const session = /^[A-Za-z0-9_-]{8,80}$/.test(sessionBruta) ? sessionBruta : null;
  const rcBruto = typeof body?.rc_app_user_id === "string" ? body.rc_app_user_id.trim() : "";
  const rc = ehUuid(rcBruto) || /^\$RCAnonymousID:[A-Za-z0-9._:-]{4,120}$/.test(rcBruto) ? rcBruto : null;

  const { error } = await admin.from("app_capi_sinais").insert({
    user_id: userId,
    session_id: session,
    rc_app_user_id: rc,
    client_ip: par.client_ip_address,
    user_agent: par.client_user_agent,
    expira_em: expiraIp(),
  });
  if (error) {
    log("nao gravou", { msg: String(error.message ?? "").slice(0, 120) });
    return json({ ok: false, guardado: false }, 500);
  }
  log("gravado", { tem_user: !!userId, tem_sessao: !!session, tem_rc: !!rc });
  return json({ ok: true, guardado: true });
});
