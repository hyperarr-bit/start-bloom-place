import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Gasto por campanha direto da API do Meta Ads — pro painel "Campanhas" do
 * admin cruzar gasto (Meta) x receita (nossa atribuição) e mostrar CAC/ROAS.
 *
 * Admin-only (mesma checagem user_roles do resto do admin). Sem token
 * configurado devolve { error: "token_missing" } — o painel funciona sem a
 * coluna de gasto e mostra como configurar.
 *
 * Secrets: META_ADS_TOKEN (system user, permissão ads_read) e
 * META_AD_ACCOUNT_ID (ex.: act_479705244130279).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

// Cache curto em memória: o painel atualiza a cada 60s; a Graph API tem rate
// limit — instância quente responde do cache.
let cache: { key: string; at: number; data: unknown } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);
    const { data: authData } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    const uid = authData?.user?.id;
    if (!uid) return jsonResponse({ error: "unauthorized" }, 401);

    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (!role) return jsonResponse({ error: "forbidden" }, 403);

    const token = Deno.env.get("META_ADS_TOKEN");
    const account = Deno.env.get("META_AD_ACCOUNT_ID");
    if (!token || !account) return jsonResponse({ error: "token_missing" });

    // Datas no calendário da CONTA (America/Sao_Paulo) — o front manda prontas.
    const body = await req.json().catch(() => ({}));
    const since = String(body?.since ?? "").slice(0, 10);
    const until = String(body?.until ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return jsonResponse({ error: "invalid_range" }, 400);
    }

    const cacheKey = `${since}|${until}`;
    if (cache && cache.key === cacheKey && Date.now() - cache.at < 120_000) {
      return jsonResponse({ cached: true, ...(cache.data as Record<string, unknown>) });
    }

    // 1) Gasto/entrega por campanha no período (só campanhas que rodaram)
    const insUrl = new URL(`https://graph.facebook.com/v21.0/${account}/insights`);
    insUrl.searchParams.set("level", "campaign");
    insUrl.searchParams.set("fields", "campaign_id,campaign_name,spend,impressions,clicks,ctr");
    insUrl.searchParams.set("time_range", JSON.stringify({ since, until }));
    insUrl.searchParams.set("limit", "500");
    insUrl.searchParams.set("access_token", token);

    // 2) TODAS as campanhas (nome + status), inclusive pausadas/sem gasto —
    //    pro painel resolver o nome de qualquer utm_campaign.
    const campUrl = new URL(`https://graph.facebook.com/v21.0/${account}/campaigns`);
    campUrl.searchParams.set("fields", "id,name,effective_status,daily_budget");
    campUrl.searchParams.set("limit", "500");
    campUrl.searchParams.set("access_token", token);

    const [insRes, campRes] = await Promise.all([fetch(insUrl), fetch(campUrl)]);
    const insData = await insRes.json().catch(() => ({}));
    const campData = await campRes.json().catch(() => ({}));
    if (!insRes.ok) {
      console.log("[META-INSIGHTS] insights error", insRes.status, JSON.stringify(insData).slice(0, 400));
      return jsonResponse({ error: "meta_error", detail: insData?.error?.message ?? `HTTP ${insRes.status}` });
    }

    const spend = (insData?.data ?? []).map((r: Record<string, string>) => ({
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
    }));
    // id → nome/status de todas as campanhas (o campRes pode falhar sem derrubar o gasto)
    const campaigns = (campData?.data ?? []).map((c: Record<string, string>) => ({
      id: c.id,
      name: c.name,
      status: c.effective_status, // ACTIVE, PAUSED, ...
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
    }));

    const payload = {
      spend,
      campaigns,
      total_spend: spend.reduce((a: number, r: { spend: number }) => a + r.spend, 0),
    };
    cache = { key: cacheKey, at: Date.now(), data: payload };
    return jsonResponse(payload);
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, 500);
  }
});
