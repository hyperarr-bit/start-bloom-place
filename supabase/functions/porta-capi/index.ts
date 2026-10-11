/**
 * CAPI CompleteRegistration da Porta (/comece).
 *
 * O navegador dispara fbq('track','CompleteRegistration') com eventID =
 * user_metadata.porta.event_id. Esta função manda o MESMO evento, com o
 * MESMO event_id, pro pixel da página (PIXEL_PORTA = o fbq init do
 * index.html). A Meta deduplica os dois. Sem isto, quem está no Instagram
 * (o fbevents.js não sai) cria a conta e o Events Manager não vê nada.
 *
 * Quem chama é o próprio navegador, já logado, no instante em que a conta
 * nova nasce. Conta antiga (login) e segundo envio do mesmo usuário não
 * mandam de novo. Dormente sem META_CAPI_TOKEN (o mesmo segredo do
 * asaas-pix / cakto-webhook).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  PIXEL_PORTA,
  codigoTesteMeta,
  contaEhNova,
  eventIdDeRegistro,
  ipDoCliente,
  montarCorpoCapi,
  sha256,
  sinalMeta,
  urlEventosMeta,
} from "../_shared/meta-capi-registro.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PORTA-CAPI] ${step}${d}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!token) return json({ ok: false, skipped: "sem_token" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "sem_auth" }, 401);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: "sem_auth" }, 401);
    const user = userData.user;

    if (!contaEhNova(user.created_at)) return json({ ok: true, skipped: "conta_antiga" });

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const eventId = eventIdDeRegistro(body.event_id);
    if (!eventId) return json({ error: "event_id" }, 400);

    const { data: ja } = await admin.from("analytics_events").select("id")
      .eq("user_id", user.id).eq("event_name", "porta_capi_registro").limit(1);
    if (ja && ja.length) return json({ ok: true, skipped: "ja_enviado" });

    const pixelEnv = (Deno.env.get("META_PIXEL_ID") ?? "").trim();
    if (pixelEnv && pixelEnv !== PIXEL_PORTA) {
      log("META_PIXEL_ID difere do pixel da /comece; o evento vai no pixel da página", { pagina: PIXEL_PORTA });
    }

    const email = user.email?.trim().toLowerCase() || "";
    const payload = montarCorpoCapi({
      eventId,
      eventTime: Math.floor(Date.now() / 1000),
      emailHash: email ? await sha256(email) : null,
      externalIdHash: await sha256(user.id),
      fbp: sinalMeta(body.fbp),
      fbc: sinalMeta(body.fbc),
      ip: ipDoCliente((n) => req.headers.get(n)),
      ua: req.headers.get("user-agent"),
      sourceUrl: typeof body.source_url === "string" ? body.source_url : null,
      testEventCode: codigoTesteMeta(body.test_event_code),
    });

    const res = await fetch(`${urlEventosMeta(PIXEL_PORTA)}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    log(res.ok ? "enviado" : "erro Meta", { status: res.status, eventId, body: JSON.stringify(out).slice(0, 180) });
    if (!res.ok) return json({ ok: false, status: res.status });

    const { error: marcaErr } = await admin.from("analytics_events").insert({
      user_id: user.id,
      event_name: "porta_capi_registro",
      event_data: { event_id: eventId },
    });
    if (marcaErr) log("marcador", { msg: marcaErr.message.slice(0, 120) });
    return json({ ok: true });
  } catch (e) {
    log("ERRO", { msg: String(e instanceof Error ? e.message : e).slice(0, 160) });
    return json({ ok: false }, 500);
  }
});
