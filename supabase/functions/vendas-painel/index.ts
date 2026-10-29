/**
 * VENDAS-PAINEL (29/10) — os números das abas do /vendas (Vendas · Turmas · Campanhas · Web), calculados AQUI no
 * servidor. Só conta ADMIN (user_roles), pelo JWT. As contas são as de _shared/vendas-painel.ts (cópia da régua dos
 * scripts de métricas). A resposta não tem e-mail nem id de usuário.
 *
 *   POST { aba: "vendas" | "turmas" | "web" }
 *   POST { aba: "campanhas", periodo: "hoje" | "ontem" | "7d" }
 *
 * Secrets: META_ADS_TOKEN (ads_read nas 2 contas — o mesmo do meta-insights), REVENUECAT_SECRET_KEY (já existe).
 * Opcionais: VENDAS_CONTAS_META ("act_…,act_…"), VENDAS_CAMPANHAS_SITE (ids extras tratados como campanha de site).
 * Cache de 60 s por aba/período (a Graph API e o RevenueCat têm limite); o estado do RevenueCat que já não muda
 * (pagou / expirou) fica 6 h.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { diaBRT, inicioDiaBRT, somaDias, type LinhaSub, type Origem } from "../_shared/aviso-venda.ts";
import {
  desfecho, funilLanding, gastoPorDia, linhaCampanha, montarTurmas, normalizarLoja, roiWeb, vendasDoDia,
  type EstadoRC, type EventoLanding, type InfoCampanha, type InsightMeta,
} from "../_shared/vendas-painel.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const log = (m: string) => console.log(`[VENDAS-PAINEL] ${m}`);
const COLS = "id,user_id,status,plan,billing_period,payment_method,amount_cents,customer_email,current_period_start,current_period_end,created_at,abacatepay_billing_id,revenuecat_subscription_id";
const CONTAS = (Deno.env.get("VENDAS_CONTAS_META") ?? "act_479705244130279,act_1135276065822790").split(",").map((s) => s.trim()).filter(Boolean);
const SITE_EXTRA = (Deno.env.get("VENDAS_CAMPANHAS_SITE") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const NOME_CONTA: Record<string, string> = { act_479705244130279: "antiga", act_1135276065822790: "nova" };

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any };
const cache = new Map<string, { at: number; data: Record<string, unknown> }>();

/* ---------------------------------------------------------------- Meta (só leitura; o token nunca sai daqui) */
async function meta(caminho: string, q: Record<string, unknown>): Promise<{ data?: unknown[]; error?: { message?: string }; paging?: { next?: string } } & Record<string, unknown>> {
  const token = Deno.env.get("META_ADS_TOKEN");
  if (!token) return { error: { message: "sem_token" } };
  const u = new URL(`https://graph.facebook.com/v21.0/${caminho}`);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  u.searchParams.set("access_token", token);
  const r = await fetch(u);
  return await r.json().catch(() => ({ error: { message: `http ${r.status}` } }));
}
async function metaTudo(caminho: string, q: Record<string, unknown>): Promise<{ linhas: unknown[]; erro: string | null }> {
  let j = await meta(caminho, q);
  if (j.error) return { linhas: [], erro: String(j.error.message ?? "erro").replace(/access_token=[^&\s]+/g, "***").slice(0, 160) };
  const linhas = [...(j.data ?? [])];
  for (let n = 0; j.paging?.next && n < 20; n++) {
    j = await (await fetch(j.paging.next)).json();
    if (j.error) break;
    linhas.push(...(j.data ?? []));
  }
  return { linhas, erro: null };
}
async function insightsPorDia(desde: string, ate: string): Promise<{ linhas: InsightMeta[]; erros: string[] }> {
  const linhas: InsightMeta[] = [], erros: string[] = [];
  for (const act of CONTAS) {
    const r = await metaTudo(`${act}/insights`, { level: "campaign", fields: "campaign_id,campaign_name,objective,spend", time_range: { since: desde, until: ate }, time_increment: 1, limit: "500" });
    if (r.erro) erros.push(`${NOME_CONTA[act] ?? act}: ${r.erro}`);
    linhas.push(...(r.linhas as InsightMeta[]));
  }
  return { linhas, erros };
}

/* ---------------------------------------------------------------- RevenueCat (estado de cada assinatura) */
const rcCache = new Map<string, { at: number; ttl: number; itens: Array<{ id?: string; status?: string; auto_renewal_status?: string; total_revenue_in_usd?: { gross?: number } }> }>();
async function estadosRC(uids: string[]): Promise<Map<string, EstadoRC>> {
  const secret = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  const projeto = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "proj1f095041";
  const out = new Map<string, EstadoRC>();
  if (!secret) return out;
  const fila = [...new Set(uids.filter(Boolean))];
  const trabalhador = async () => {
    while (fila.length) {
      const uid = fila.shift()!;
      let c = rcCache.get(uid);
      if (!c || Date.now() - c.at > c.ttl) {
        try {
          const r = await fetch(`https://api.revenuecat.com/v2/projects/${projeto}/customers/${encodeURIComponent(uid)}/subscriptions`, { headers: { Authorization: `Bearer ${secret}` } });
          if (r.ok) {
            const itens = ((await r.json())?.items ?? []) as NonNullable<typeof c>["itens"];
            const final = itens.length > 0 && itens.every((s) => desfecho({ status: s.status ?? null, renova: s.auto_renewal_status ?? null, gross: Number(s.total_revenue_in_usd?.gross ?? 0) }) === "pagou" || s.status === "expired");
            c = { at: Date.now(), ttl: final ? 6 * 3600_000 : 60_000, itens };
            rcCache.set(uid, c);
          }
        } catch { /* sem estado = "?" na turma */ }
      }
      for (const s of c?.itens ?? []) if (s.id) out.set(s.id, { status: s.status ?? null, renova: s.auto_renewal_status ?? null, gross: Number(s.total_revenue_in_usd?.gross ?? 0) });
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabalhador));
  return out;
}

/* ---------------------------------------------------------------- banco */
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < max; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(String((error as { message?: string }).message ?? error).slice(0, 120));
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/* ---------------------------------------------------------------- abas */
async function abaVendas(admin: Admin, hoje: string) {
  const ini = inicioDiaBRT(hoje);
  const pix = await todas<LinhaSub>((a, b) => admin.from("subscriptions").select(COLS).eq("payment_method", "pix").gte("created_at", ini).range(a, b));
  const marcadores = await todas<{ event_name: string; event_data: { tx?: string; valor?: number } | null; created_at: string }>((a, b) =>
    admin.from("analytics_events").select("event_name,event_data,created_at").eq("event_name", "meta_capi_app_enviado").gte("created_at", ini).range(a, b));
  const txs = [...new Set(marcadores.map((m) => String(m.event_data?.tx ?? "")).filter(Boolean))];
  const linhaPorTx = new Map<string, LinhaSub>();
  for (let i = 0; i < txs.length; i += 100) {
    const { data } = await admin.from("subscriptions").select(COLS).in("revenuecat_subscription_id", txs.slice(i, i + 100));
    for (const l of (data ?? []) as LinhaSub[]) if (l.revenuecat_subscription_id) linhaPorTx.set(l.revenuecat_subscription_id, l);
  }
  const { data: renov } = await admin.from("venda_avisada").select("chave,origem,valor_cents,plano,criado_em").eq("renovacao", true).gte("criado_em", ini);
  const r = vendasDoDia(pix, marcadores, linhaPorTx, (renov ?? []) as Array<{ chave: string; origem: Origem; valor_cents: number; plano: string; criado_em: string }>, hoje);
  return { dia: hoje, ...r };
}

async function abaTurmas(admin: Admin, hoje: string) {
  const desde = somaDias(hoje, -3);
  const subs = await todas<LinhaSub>((a, b) => admin.from("subscriptions").select(COLS).eq("payment_method", "play_store").gte("created_at", inicioDiaBRT(desde)).range(a, b));
  const { data: papeis } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const internos = new Set(((papeis ?? []) as Array<{ user_id: string }>).map((p) => p.user_id));
  const linhas = normalizarLoja(subs, internos);
  const doIphone = linhas.filter((l) => l.loja === "apple" && (l.tipo === "teste_anual" || l.billing === "monthly"));
  const rc = await estadosRC(doIphone.map((l) => l.uid));
  const ins = await insightsPorDia(desde, hoje);
  const turmas = montarTurmas(linhas, rc, gastoPorDia(ins.linhas, "app", SITE_EXTRA), hoje);
  return { dia: hoje, turmas, semEstadoRC: doIphone.filter((l) => !rc.has(l.tx)).length, errosMeta: ins.erros };
}

async function abaCampanhas(hoje: string, periodo: string) {
  const desde = periodo === "7d" ? somaDias(hoje, -6) : periodo === "ontem" ? somaDias(hoje, -1) : hoje;
  const ate = periodo === "ontem" ? somaDias(hoje, -1) : hoje;
  const linhas: ReturnType<typeof linhaCampanha>[] = [];
  const erros: string[] = [];
  const fusos: Record<string, string> = {};
  for (const act of CONTAS) {
    const conta = NOME_CONTA[act] ?? act;
    const info = await meta(act, { fields: "timezone_name" });
    if (typeof info.timezone_name === "string") fusos[conta] = info.timezone_name;
    const camps = await metaTudo(`${act}/campaigns`, { fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,bid_strategy", limit: "200" });
    const ins = await metaTudo(`${act}/insights`, { level: "campaign", fields: "campaign_id,campaign_name,objective,spend,impressions,inline_link_clicks,inline_link_click_ctr,actions,conversions,action_values", time_range: { since: desde, until: ate }, limit: "500" });
    if (camps.erro || ins.erro) erros.push(`${conta}: ${camps.erro ?? ins.erro}`);
    const porId = new Map((ins.linhas as InsightMeta[]).map((x) => [x.campaign_id, x]));
    for (const c of camps.linhas as Array<InfoCampanha & { name?: string; objective?: string }>) {
      const x = porId.get(c.id) ?? null;
      if (c.effective_status !== "ACTIVE" && !(x && Number(x.spend ?? 0) > 0)) continue;
      linhas.push(linhaCampanha(x, c, conta, SITE_EXTRA));
    }
  }
  linhas.sort((a, b) => b.gasto - a.gasto);
  const soma = (f: (l: (typeof linhas)[number]) => number, tipo?: string) => linhas.filter((l) => !tipo || l.tipo === tipo).reduce((s, l) => s + f(l), 0);
  const gastoApp = soma((l) => l.gasto, "app"), testes = soma((l) => l.testes, "app");
  return {
    periodo, desde, ate, campanhas: linhas, fusos, errosMeta: erros,
    totais: { gasto: Math.round(soma((l) => l.gasto) * 100) / 100, gastoApp: Math.round(gastoApp * 100) / 100, testes, custoPorTeste: testes ? Math.round((gastoApp / testes) * 100) / 100 : null },
  };
}

async function abaWeb(admin: Admin, hoje: string) {
  const desde = somaDias(hoje, -6);
  const subs = await todas<LinhaSub>((a, b) => admin.from("subscriptions").select(COLS).neq("payment_method", "play_store").gte("created_at", inicioDiaBRT(desde)).range(a, b));
  const ins = await insightsPorDia(desde, hoje);
  const roi = roiWeb(subs, gastoPorDia(ins.linhas, "site", SITE_EXTRA), hoje);
  const eventos = await todas<EventoLanding>((a, b) => admin.from("analytics_events")
    .select("event_name,sid:event_data->>landing_session_id,termo:event_data->>utm_term,simulado:event_data->>simulado,order_id:event_data->>order_id")
    .in("event_name", ["landing_html", "landing_oferta_vista", "landing_pix_gerado", "landing_pix_pago"])
    .gte("created_at", inicioDiaBRT(hoje)).range(a, b), 30000);
  const pagos = new Set(subs.filter((s) => diaBRT(s.created_at ?? "") === hoje && s.abacatepay_billing_id).map((s) => String(s.abacatepay_billing_id)));
  return { dia: hoje, ...roi, landing: funilLanding(eventos, pagos), errosMeta: ins.erros };
}

/* ---------------------------------------------------------------- servidor */
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
    const aba = String(body?.aba ?? "vendas");
    const periodo = ["hoje", "ontem", "7d"].includes(String(body?.periodo)) ? String(body.periodo) : "hoje";
    const forcar = body?.forcar === true;
    const hoje = diaBRT(Date.now());
    const chave = `${aba}|${periodo}|${hoje}`;
    const c = cache.get(chave);
    if (!forcar && c && Date.now() - c.at < 60_000) return json({ ...c.data, cache: true });
    // "forçar" (puxar pra atualizar) ainda respeita 15 s — o botão não vira martelo na Meta
    if (forcar && c && Date.now() - c.at < 15_000) return json({ ...c.data, cache: true });

    let data: Record<string, unknown>;
    if (aba === "turmas") data = await abaTurmas(admin, hoje);
    else if (aba === "campanhas") data = await abaCampanhas(hoje, periodo);
    else if (aba === "web") data = await abaWeb(admin, hoje);
    else data = await abaVendas(admin, hoje);
    data = { ...data, aba, geradoEm: new Date().toISOString() };
    cache.set(chave, { at: Date.now(), data });
    return json(data);
  } catch (e) {
    log(`erro ${String(e).slice(0, 160)}`);
    return json({ error: "erro" }, 500);
  }
});
