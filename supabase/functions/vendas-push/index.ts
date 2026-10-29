/**
 * VENDAS-PUSH (29/10) — os aparelhos do dono que recebem o aviso de venda. Só conta ADMIN (user_roles, a mesma
 * checagem do /admin e do meta-insights), pelo JWT da sessão.
 *
 *   POST { acao: "chave" }                                → { publica }  (chave pública VAPID, se o front não tiver)
 *   POST { acao: "inscrever", endpoint, p256dh, auth }    → { ok }
 *   POST { acao: "desinscrever", endpoint }               → { ok }
 *   POST { acao: "estado", endpoint }                     → { inscrito, aparelhos }
 *   POST { acao: "teste" }                                → { ok, enviados }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { dadosPush } from "../_shared/aviso-venda.ts";
import { chavesVapidDoAmbiente, mandarParaTodos } from "../_shared/push-dono.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const ENDPOINT_OK = /^https:\/\/[a-z0-9.-]+(:\d+)?\//i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: auth } = await anon.auth.getUser(token);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: papel } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (!papel) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const acao = String(body?.acao ?? "");
    const endpoint = String(body?.endpoint ?? "").slice(0, 1000);

    if (acao === "chave") return json({ publica: Deno.env.get("VAPID_PUBLIC_KEY") ?? null });

    if (acao === "inscrever") {
      const p256dh = String(body?.p256dh ?? "").slice(0, 200), chave = String(body?.auth ?? "").slice(0, 100);
      if (!ENDPOINT_OK.test(endpoint) || !p256dh || !chave) return json({ error: "inscricao_invalida" }, 400);
      const { error } = await admin.from("push_dono").upsert({ endpoint, p256dh, auth: chave, user_id: uid, falhas: 0 }, { onConflict: "endpoint" });
      if (error) return json({ error: "falhou" }, 500);
      return json({ ok: true });
    }
    if (acao === "desinscrever") {
      if (endpoint) await admin.from("push_dono").delete().eq("endpoint", endpoint);
      return json({ ok: true });
    }
    if (acao === "estado") {
      const { data } = await admin.from("push_dono").select("endpoint");
      const lista = (data ?? []) as Array<{ endpoint: string }>;
      return json({ inscrito: !!endpoint && lista.some((l) => l.endpoint === endpoint), aparelhos: lista.length });
    }
    if (acao === "teste") {
      const enviados = await mandarParaTodos(admin, chavesVapidDoAmbiente(), dadosPush("💰 Venda · R$ 97,90 · Apple anual", "Aviso de teste — é assim que a venda vai chegar.", "teste"));
      return json({ ok: enviados > 0, enviados });
    }
    return json({ error: "acao" }, 400);
  } catch (e) {
    console.log(`[VENDAS-PUSH] erro ${String(e).slice(0, 160)}`);
    return json({ error: "erro" }, 500);
  }
});
