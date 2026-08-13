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

    /*
     * NÍVEL DE ANÚNCIO (11/08) — "de qual criativo veio a venda?".
     *
     * O install_referrer NÃO responde isso: o anúncio vem dentro de
     * `utm_content.source.data`, criptografado, e só a Meta descriptografa.
     * Quem sabe é a Meta — então a resposta vem daqui, pedindo `level=ad` e
     * o campo `actions`, onde chegam as compras que o nosso CAPI mandou.
     *
     * Ou seja: esta rota só diz a verdade se os eventos de compra estiverem
     * chegando no dataset. Ver mandarCompraProMeta no revenuecat-webhook E
     * no revenuecat-sync (a v48 compra anônimo — sem o sync, 2/3 das vendas
     * ficavam invisíveis pra Meta e este relatório mentiria pra menos).
     */
    const nivel = ["ad", "campanhas", "conjuntos"].includes(String(body?.nivel)) ? String(body?.nivel) : "campaign";

    /* Lista crua de campanhas com OBJETIVO — a pergunta "isso é App Promotion
     * ou Vendas?" não se responde pelo nome, só pelo objective. E App
     * Promotion é o que faz a Meta contar install e otimizar por evento do
     * app; campanha de Vendas apontada pra Play traz gente mas mede errado. */
    /* Conjuntos com `promoted_object` — é ali que a campanha de app declara
     * QUAL app e QUAL dataset de eventos ela usa. Se vier vazio ou apontando
     * pra outro lugar, a Meta não tem como creditar a compra do app à
     * campanha, por mais que o CAPI entregue o evento. Foi a checagem que
     * explicou "70 compras na campanha de web e 0 nas de app" (12/08). */
    if (nivel === "conjuntos") {
      const u = new URL(`https://graph.facebook.com/v21.0/${account}/adsets`);
      u.searchParams.set("fields", "id,name,campaign{name,objective},effective_status,promoted_object,optimization_goal");
      u.searchParams.set("limit", "200");
      u.searchParams.set("access_token", token);
      const r = await fetch(u);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return jsonResponse({ error: "meta_error", detail: d?.error?.message ?? `HTTP ${r.status}` });
      return jsonResponse({ conjuntos: d.data ?? [] });
    }

    if (nivel === "campanhas") {
      const u = new URL(`https://graph.facebook.com/v21.0/${account}/campaigns`);
      u.searchParams.set("fields", "id,name,objective,effective_status,daily_budget,created_time");
      u.searchParams.set("limit", "200");
      u.searchParams.set("access_token", token);
      const r = await fetch(u);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return jsonResponse({ error: "meta_error", detail: d?.error?.message ?? `HTTP ${r.status}` });
      return jsonResponse({ conta: account, campanhas: d.data ?? [] });
    }
    if (nivel === "ad") {
      const adUrl = new URL(`https://graph.facebook.com/v21.0/${account}/insights`);
      adUrl.searchParams.set("level", "ad");
      adUrl.searchParams.set(
        "fields",
        "ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type",
      );
      adUrl.searchParams.set("time_range", JSON.stringify({ since, until }));
      adUrl.searchParams.set("limit", "500");
      adUrl.searchParams.set("access_token", token);
      const r = await fetch(adUrl);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        return jsonResponse({ error: "meta_error", detail: d?.error?.message ?? `HTTP ${r.status}` });
      }
      /*
       * PRIMEIRO RÓTULO QUE EXISTIR — NUNCA A SOMA (corrigido 13/08).
       *
       * A Meta reporta a MESMA conversão sob vários nomes ao mesmo tempo. Uma
       * venda de app aparece como purchase, omni_purchase, onsite_app_purchase,
       * app_custom_event.fb_mobile_purchase… todos com o mesmo valor. Somar
       * três deles triplicava: 3 vendas reais viravam "9 compras" no relatório,
       * e eu quase mandei o dono publicar uma versão nova do app pra consertar
       * uma duplicação que só existia aqui. Instalação tinha o mesmo defeito
       * (mobile_app_install + omni_app_install = o dobro).
       *
       * A ordem abaixo é da métrica mais agregada pra mais específica: omni_*
       * é o total já deduplicado da Meta entre superfícies.
       */
      const acao = (linha: Record<string, unknown>, tipos: string[]) => {
        const lista = (linha.actions ?? []) as { action_type: string; value: string }[];
        for (const t of tipos) {
          const achou = lista.find((a) => a.action_type === t);
          if (achou) return Number(achou.value || 0);
        }
        return 0;
      };
      const anuncios = ((d.data ?? []) as Record<string, unknown>[]).map((l) => ({
        ad_id: l.ad_id,
        criativo: l.ad_name,
        conjunto: l.adset_name,
        campanha: l.campaign_name,
        gasto: Number(l.spend ?? 0),
        impressoes: Number(l.impressions ?? 0),
        cliques: Number(l.clicks ?? 0),
        ctr: Number(l.ctr ?? 0),
        instalacoes: acao(l, ["omni_app_install", "mobile_app_install", "app_install"]),
        compras: acao(l, [
          "omni_purchase", "purchase",
          "app_custom_event.fb_mobile_purchase", "offsite_conversion.fb_pixel_purchase",
        ]),
        // Ações cruas sob demanda: a Meta manda a MESMA conversão em vários
        // rótulos (purchase, omni_purchase, app_custom_event.fb_mobile_purchase),
        // então somar os três triplica. Sem poder olhar o array, um relatório
        // inflado é indistinguível de venda duplicada no app — e a diferença
        // entre os dois é uma versão nova do app à toa.
        ...(body?.bruto ? { acoes: l.actions } : {}),
      }));
      return jsonResponse({ nivel: "ad", since, until, anuncios });
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
