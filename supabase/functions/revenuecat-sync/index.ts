/**
 * revenuecat-sync — o cliente pede: "confere na fonte se eu tenho assinatura
 * da Play e grava meu acesso".
 *
 * Por que existe (bug de 25/07): o gate do app (`useAuth().isSubscribed`) só
 * olha a tabela `subscriptions`, e NADA escrevia nela quando alguém assinava
 * pela Play Store. A compra dava certo no RevenueCat e a pessoa continuava
 * trancada. Esta função é o elo que faltava.
 *
 * Chamada com o JWT do usuário (verify_jwt padrão). Não confia em nada que
 * venha do corpo da requisição: o app_user_id é o próprio user.id do token,
 * e o entitlement é lido direto da API do RevenueCat com a chave secreta.
 * Ou seja: ninguém libera acesso mandando um POST forjado.
 *
 * O webhook `revenuecat-webhook` faz a mesma reconciliação do lado do
 * servidor (renovação, cancelamento, reembolso). Este aqui é o reforço
 * imediato pra quem acabou de comprar não ficar esperando.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, d?: unknown) =>
  console.log(`[RC-SYNC] ${step}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const r = await reconciliarRevenueCat(admin, user.id, user.email ?? null);
    log("done", { userId: user.id, ...r });
    return json({ checked: true, ...r });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// ---------------------------------------------------------------------------
// Reconciliação com o RevenueCat (API v2).
//
// v2 e não v1 de propósito: a chave secreta do projeto é "sk_" v2 e a v1
// devolve 403 (code 7723) com ela. A v2 ainda é melhor pro caso — o endpoint
// /subscriptions já entrega `gives_access`, que é o veredito do próprio
// RevenueCat incluindo trial e grace period do Google.
//
// ATENÇÃO: este bloco é cópia fiel entre revenuecat-sync e revenuecat-webhook.
// As edge functions deste projeto são autocontidas (não há pasta _shared);
// ao mexer numa, mexer na outra.
// ---------------------------------------------------------------------------

const RC_API = "https://api.revenuecat.com/v2";
const PROJETO = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "proj1f095041";

/** Preço em centavos por produto — a API não devolve valor em BRL.
 *  Bate com APP_PRECOS em src/lib/native-shell.ts. */
const PRODUTOS: Record<string, { billing: string; cents: number }> = {
  // v53 (16/08): app voltou a ser ASSINATURA — anual 159,90 / mensal 24,90.
  // O pré-pago Pix (downsell 19,90 → 30 dias) vem ANTES do core_mensal de
  // propósito: o match é por startsWith e "core_mensal:coremensalpix"
  // começa com "core_mensal" — na ordem errada, todo downsell Pix entraria
  // na tabela (e no Meta) como 24,90. Mesma armadilha do vitalicio_19.
  // PRÉ-PAGO: 30 dias e acabou, renovação MANUAL. Billing próprio porque
  // "monthly" fazia a tela "Meu acesso" prometer renovação automática
  // pra quem pagou 1 mês avulso no Pix — a pessoa perderia o acesso na
  // data que o app disse que ia renovar sozinho.
  "core_mensal:coremensalpix": { billing: "monthly_prepaid", cents: 1990 },
  // Pivô à vista (23/08): os 3 pré-pagos novos ANTES dos genéricos, senão o
  // startsWith grava o gift de 97,90 como 159,90 e chama à-vista de
  // assinatura recorrente (a MESMA armadilha documentada acima, ×3).
  "core_mensal:coremensalvista": { billing: "monthly_prepaid", cents: 2490 },
  "core_anual:coreanual97": { billing: "annual_prepaid", cents: 9790 },
  "core_anual:coreanualvista": { billing: "annual_prepaid", cents: 15990 },
  core_anual: { billing: "annual", cents: 15990 },
  core_mensal: { billing: "monthly", cents: 2490 },
  // Era do produto único (06-08/08): seguem no mapa pra base vitalícia
  // (restore, reembolso). Downsell 19,90 ANTES do cheio (startsWith).
  core_vitalicio_19: { billing: "lifetime", cents: 1990 },
  core_vitalicio: { billing: "lifetime", cents: 2790 }, // 07/08: 27,90, espelho da web
};

const FIM_VITALICIO = "2126-01-01T00:00:00.000Z";

const sha256 = async (txt: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

async function mandarCompraProMeta(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string | null,
  cents: number,
  txId: string,
  quando: string | null,
) {
  const dataset = Deno.env.get("META_APP_DATASET_ID");
  const token = Deno.env.get("META_APP_CAPI_TOKEN");
  if (!dataset || !token) return;

  // Idempotência: uma compra = um evento, mesmo com o RevenueCat reenviando
  // o webhook (ele reenvia em qualquer 500 nosso).
  const { data: jaFoi, error: erroJaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", "meta_capi_app_enviado")
    .eq("user_id", userId)
    .contains("event_data", { tx: txId })
    .limit(2);
  // maybeSingle() com marcador DUPLICADO devolvia erro (PGRST116) que era
  // ignorado -> data null -> reenvio ETERNO a cada cron (caso real 17-19/08:
  // meta_capi_app_enviado x96/dia). Na duvida (erro OU 1+ marcador), NAO reenvia.
  if (erroJaFoi || (jaFoi?.length ?? 0) > 0) return;

  // Ficha do aparelho que o app deixou gravada (extinfo é obrigatório).
  const { data: dev } = await admin
    .from("analytics_events")
    .select("event_data")
    .eq("event_name", "app_device_info")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let d = ((dev as { event_data?: Record<string, unknown> } | null)?.event_data ?? {}) as Record<string, unknown>;

  /*
   * PELA SESSÃO QUANDO O user_id NÃO ACHA (14/08) — este era o buraco.
   *
   * Desde a v48 a pessoa COMPRA ANTES DE TER CONTA: o app emite a ficha do
   * aparelho enquanto ela ainda é anônima, então a linha fica com user_id
   * NULO. A busca acima, por user_id, não achava nada; o extinfo saía sem
   * versão de SO e a Meta RECUSAVA o evento inteiro
   * ("error_subcode 2804043: informação estendida do dispositivo inválida").
   *
   * Efeito medido em 14/08: das 4 vendas do dia, 2 nunca chegaram na Meta —
   * e eram exatamente as 2 sem ficha encontrada. O cron de 15min também não
   * salvava, porque tentava e era recusado igual. As duas tinham a ficha
   * gravada o tempo todo (Android 16, Samsung, build 49) — só estava
   * pendurada na sessão anônima.
   */
  if (!Object.keys(d).length) {
    const { data: sess } = await admin
      .from("analytics_events").select("session_id").eq("user_id", userId).limit(50);
    const ids = [...new Set(((sess ?? []) as { session_id: string }[]).map((x) => x.session_id).filter(Boolean))];
    if (ids.length) {
      const { data: porSessao } = await admin
        .from("analytics_events")
        .select("event_data")
        .eq("event_name", "app_device_info")
        .in("session_id", ids)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      d = ((porSessao as { event_data?: Record<string, unknown> } | null)?.event_data ?? {}) as Record<string, unknown>;
    }
  }

  if (!Object.keys(d).length) {
    // Quem está em build anterior à v48 não emite app_device_info. O
    // webview_info (que existe desde a v37) carrega o UA — dá SO e modelo,
    // que é o que mais pesa no pareamento.
    const { data: wv } = await admin
      .from("analytics_events")
      .select("event_data")
      .eq("event_name", "webview_info")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ua = String(((wv as { event_data?: Record<string, unknown> } | null)?.event_data ?? {}).ua ?? "");
    const m = /Android (\d+(?:\.\d+)?); ([^)]+?)(?: Build\/[^)]*)?\)/.exec(ua);
    d = m ? { os: m[1], modelo: m[2] } : {};
  }
  const s = (k: string) => String(d[k] ?? "");
  const n = (k: string) => Number(d[k] ?? 0) || 0;
  const extinfo = [
    "a2",                                    // versão do extinfo (Android)
    s("pacote") || "br.com.coreaplicativo.app",
    s("build"),
    s("versao"),
    // A Meta RECUSA o evento inteiro se a versão do SO vier vazia (subcode
    // 2804043). Com a busca por sessão acima isso virou raro, mas quando
    // sobrar sem nada é melhor um SO aproximado do que perder a venda: sem o
    // evento a atribuição é ZERO, e o app é Android por construção.
    s("os") || "13",
    s("modelo") || "Android",
    s("locale") || "pt-BR",
    "",                                      // fuso abreviado: não temos
    "",                                      // operadora: não temos
    n("tela_l"),
    n("tela_a"),
    String(d.densidade ?? ""),
    n("nucleos"),
    0,                                       // disco total
    0,                                       // disco livre
    s("fuso") || "America/Sao_Paulo",
  ];

  const user_data: Record<string, unknown> = { external_id: await sha256(userId) };
  if (email) user_data.em = await sha256(email.trim().toLowerCase());
  // GAID (12/08): a v49 grava o ID de publicidade na ficha app_device_info.
  // Como madid, é o que casa a compra com o CLIQUE no anúncio — e-mail só
  // casa com quem a Meta conhece; o aparelho ela conhece sempre.
  const gaid = s("gaid").toLowerCase();
  if (gaid) user_data.madid = gaid;
  // anon_id (13/08): o id que a PRÓPRIA Meta gerou pro aparelho, capturado do
  // SDK. É o elo mais forte que existe pra evento de app — amarra esta compra
  // ao mesmo aparelho que ela viu clicar no anúncio, e continua valendo pra
  // quem desligou o ID de publicidade (aí o madid vem vazio).
  const anonId = s("anon_id");
  if (anonId) user_data.anon_id = anonId;

  const payload: Record<string, unknown> = {
    data: [{
      event_name: "Purchase",
      // Clamp de 6,5 dias (23/08): a conversão do trial de 7d chega aqui com
      // current_period_start = INÍCIO do trial (≥7d atrás) e a Meta recusa
      // evento com mais de 7 dias — a cobrança real de 159,90 NUNCA entrava.
      // O instante honesto da cobrança ≈ quando o cron a viu (15min de tick);
      // pra linha velha, trava em now-6,5d e o evento entra em vez de sumir.
      event_time: Math.max(
        Math.floor(new Date(quando ?? Date.now()).getTime() / 1000),
        Math.floor(Date.now() / 1000) - Math.floor(6.5 * 86400),
      ),
      event_id: txId,                        // dedup, igual ao padrão da web
      action_source: "app",
      user_data,
      app_data: {
        // Até a v48 NÃO se coletava o ID de publicidade (política de Data
        // Safety). 12/08, decisão do dono: v49 embarca o SDK da Meta e coleta
        // o GAID — quem está em build antigo (ou fez opt-out) segue sem, e o
        // pareamento cai pra e-mail/external_id.
        advertiser_tracking_enabled: !!gaid,
        application_tracking_enabled: true,
        extinfo,
      },
      custom_data: { currency: "BRL", value: cents / 100 },
    }],
  };
  // COMPRA_AVISTA (23/08, pivô à vista): evento NOVO de compra com histórico
  // LIMPO — o Purchase padrão ficou envenenado pelos reenvios ×36-50/venda de
  // 17-22/08 (bug do dedup). A campanha nova otimiza por ELE (promoted_object:
  // custom_event_type OTHER + custom_event_str "compra_avista"); o Purchase
  // segue junto pra painel/ROAS. Mesma tx, event_id próprio pro dedup da Meta.
  {
    // (este sender SÓ manda Purchase — no meta-backfill-app o bloco é gateado
    // por tipo==="purchase"; aqui `tipo` NÃO existe e usar quebraria em runtime)
    const base = (payload.data as Record<string, unknown>[])[0];
    const eventos = payload.data as Record<string, unknown>[];
    // compra_avista = TODAS as vendas, com valor no custom_data — é o evento
    // do conjunto "os 2 juntos": otimização por VALOR (a Meta pesa 159,90
    // contra 24,90 sozinha quando o conjunto maximiza valor de conversão).
    eventos.push({ ...base, event_name: "compra_avista", event_id: `${txId}_av` });
    // Eventos POR PLANO (23/08, pedido do dono): campanha do mensal otimiza
    // por compra_mensal, a do anual por compra_anual — sem depender da Meta
    // separar por valor. Classificação pelo PREÇO do catálogo à vista
    // (mensal 19,90/24,90 · anual 97,90/159,90); valor fora do catálogo
    // (vitalício legado dos APKs antigos) fica só nos eventos de cima.
    const porPlano = cents === 1990 || cents === 2490 ? "compra_mensal"
      : cents === 9790 || cents === 15990 ? "compra_anual" : null;
    if (porPlano) eventos.push({ ...base, event_name: porPlano, event_id: `${txId}_${porPlano === "compra_mensal" ? "m" : "a"}` });
  }
  const teste = Deno.env.get("META_APP_TEST_EVENT_CODE");
  if (teste) payload.test_event_code = teste;

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${dataset}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const corpo = await r.text();
    log("meta capi app", { ok: r.ok, status: r.status, corpo: corpo.slice(0, 200) });
    if (r.ok) {
      await admin.from("analytics_events").insert({
        user_id: userId,
        event_name: "meta_capi_app_enviado",
        event_data: { tx: txId, valor: cents / 100 },
      });
    }
  } catch (e) {
    log("meta capi app ERRO", { msg: String(e).slice(0, 150) });
  }
}

/**
 * TikTok Events API (09/08; GAID 16/08) — mesma ideia do mandarCompraProMeta:
 * manda a compra pro TikTok DEPOIS que o Google confirmou o pagamento. Mesma
 * divisão de trabalho da Meta: o SDK do TikTok embarcado no app (v55) manda
 * SÓ instalação/abertura; a compra sai DAQUI porque pode fechar com o app
 * fechado (folha/Pix paga depois) e porque o dedup por tx vive no servidor.
 *
 * AVISO DE CONFIANÇA: montei este payload cruzando a documentação do TikTok
 * for Business (blog do endpoint consolidado) com integrações de terceiros
 * (Apphud, Stape, Tealium) — o portal oficial (business-api.tiktok.com) é
 * uma SPA que não dá pra ler direto. O endpoint, `event_source`/
 * `event_source_id` e o nome do evento ("CompletePayment") saíram
 * confirmados em mais de uma fonte independente; o formato exato de
 * `user`/`properties` é o melhor palpite seguindo o padrão do Meta CAPI
 * ao lado. Só confia nisso depois de ver UM evento de teste chegar certo
 * no Events Manager — mesma regra do catálogo: causa provada, não suposta.
 */
async function mandarCompraProTikTok(
  admin: ReturnType<typeof createClient>,
  userId: string,
  _email: string | null,
  cents: number,
  txId: string,
  quando: string | null,
  ehTrial = false,
) {
  // CANAL QUE FUNCIONA (provado 19/08 com code 0 — 5 StartTrials reais): o
  // app foi migrado pra rede de autoatribuição (SAN) e NÃO tem token de
  // Events API — a tela Configurações do Events Manager manda "usar o
  // segredo do app para autorizar seu app como origem do evento". Endpoint
  // do SDK (v1.2/app/batch) com Access-Token = SEGREDO do app (o mesmo
  // tiktokAppSecret do key.properties). Caminhos MORTOS, não insistir:
  // v1.3/event/track = 40001 com o token do pixel web, 40105 com o segredo.
  const ttAppId = Deno.env.get("TIKTOK_APP_ID");
  const segredo = Deno.env.get("TIKTOK_APP_SECRET");
  if (!ttAppId || !segredo) return;

  // Dedup SEM filtro de user_id: os 5 StartTrials de 19/08 saíram por script
  // one-off e o marcador deles não tem user_id — filtrar por user_id os
  // ignoraria e reenviaria tudo.
  const marcador = ehTrial ? "tiktok_trial_enviado" : "tiktok_capi_app_enviado";
  const { data: jaFoi, error: erroJaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", marcador)
    .contains("event_data", { tx: txId })
    .limit(2);
  // maybeSingle() com marcador DUPLICADO devolvia erro (PGRST116) que era
  // ignorado -> data null -> reenvio ETERNO a cada cron (caso real 17-19/08:
  // meta_capi_app_enviado x96/dia). Na duvida (erro OU 1+ marcador), NAO reenvia.
  if (erroJaFoi || (jaFoi?.length ?? 0) > 0) return;

  // GAID CRU (≠ Events API, que pedia SHA-256): este canal é o do SDK, e o
  // gaid cru é o que casa o evento com o clique no anúncio. Sem gaid não
  // envia — evento órfão não atribui e só suja o relatório.
  let gaid = "";
  const { data: devTt } = await admin
    .from("analytics_events").select("event_data")
    .eq("event_name", "app_device_info").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  gaid = String(((devTt as { event_data?: Record<string, unknown> } | null)?.event_data ?? {}).gaid ?? "").toLowerCase();
  if (!gaid) {
    const { data: sessTt } = await admin
      .from("analytics_events").select("session_id").eq("user_id", userId).limit(50);
    const idsTt = [...new Set(((sessTt ?? []) as { session_id: string | null }[]).map((x) => x.session_id).filter(Boolean))];
    if (idsTt.length) {
      const { data: porSessaoTt } = await admin
        .from("analytics_events").select("event_data")
        .eq("event_name", "app_device_info").in("session_id", idsTt)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      gaid = String(((porSessaoTt as { event_data?: Record<string, unknown> } | null)?.event_data ?? {}).gaid ?? "").toLowerCase();
    }
  }
  if (!gaid) {
    log("tiktok sem gaid, nao envia", { tx: txId });
    return;
  }

  const payload = {
    app_id: "br.com.coreaplicativo.app",
    tiktok_app_id: ttAppId,
    batch: [{
      type: "track",
      event: ehTrial ? "StartTrial" : "CompletePayment",
      timestamp: new Date(quando ?? Date.now()).toISOString(),
      event_id: txId, // dedup do lado do TikTok (48h) além do marcador acima
      context: {
        app: { id: "br.com.coreaplicativo.app", name: "CORE APP: organize sua vida", namespace: "br.com.coreaplicativo.app", version: "1.0.62" },
        device: { platform: "Android", gaid },
        locale: "pt_BR",
        user_agent: "tiktok-business-android-sdk/1.7.0",
        user: {},
      },
      // StartTrial com o VALOR DO PLANO (20/08): mesmo racional da Meta —
      // valor de evento não é receita no painel, é sinal pra otimização por
      // valor distinguir anual (159,90) de mensal (24,90).
      properties: { currency: "BRL", value: cents / 100 },
    }],
  };

  try {
    const r = await fetch("https://business-api.tiktok.com/open_api/v1.2/app/batch/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": segredo },
      body: JSON.stringify(payload),
    });
    const corpo = await r.text();
    log("tiktok app batch", { ok: r.ok, status: r.status, corpo: corpo.slice(0, 300) });
    // O TikTok pode responder HTTP 200 com `code` de erro no corpo — o
    // marcador só nasce com code:0, senão a venda seria dada como entregue
    // sem nunca ter chegado.
    let codeTt = -1;
    try { codeTt = JSON.parse(corpo)?.code ?? -1; } catch { /* corpo não-JSON */ }
    if (r.ok && codeTt === 0) {
      await admin.from("analytics_events").insert({
        user_id: userId,
        event_name: marcador,
        event_data: { tx: txId, valor: cents / 100, canal: "app_batch_v12" },
      });
    }
  } catch (e) {
    log("tiktok app batch ERRO", { msg: String(e).slice(0, 150) });
  }
}

const infoProduto = (storeId: string | null | undefined) => {
  const id = storeId ?? "";
  const chave = Object.keys(PRODUTOS).find((k) => id.startsWith(k));
  return chave ? PRODUTOS[chave] : { billing: "unknown", cents: null as number | null };
};

async function rcGet(path: string, secret: string): Promise<any | null> {
  const r = await fetch(`${RC_API}/projects/${PROJETO}${path}`, {
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  });
  if (r.status === 404) return null; // cliente que o RevenueCat nunca viu
  if (!r.ok) throw new Error(`RevenueCat ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

// A subscription vem com o id INTERNO do produto (prod…), não com core_anual.
// Cache por instância da function — a lista muda de ano em ano.
let mapaProdutos: Record<string, string> | null = null;
async function storeIdDoProduto(prodId: string, secret: string): Promise<string> {
  if (!mapaProdutos) {
    const lista = await rcGet("/products", secret);
    mapaProdutos = {};
    for (const p of lista?.items ?? []) mapaProdutos[p.id] = p.store_identifier ?? p.display_name ?? "";
  }
  return mapaProdutos[prodId] ?? "";
}

async function reconciliarRevenueCat(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string | null
): Promise<{ subscribed: boolean; reason?: string; product?: string | null; expires?: string | null }> {
  const secret = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  if (!secret) throw new Error("REVENUECAT_SECRET_KEY não configurada");

  const resp = await rcGet(`/customers/${encodeURIComponent(userId)}/subscriptions`, secret);
  const assinaturas: any[] = resp?.items ?? [];

  // gives_access é o veredito do RevenueCat: cobre trial, grace period do
  // Google e cancelamento com período pago ainda em aberto.
  const vivas = assinaturas.filter((s) => s?.gives_access === true);

  // COMPRA ÚNICA (06/08, core_vitalicio): mora em /purchases, não em
  // /subscriptions — sem isto o vitalício pagava e ficava sem acesso.
  const respCompras = await rcGet(`/customers/${encodeURIComponent(userId)}/purchases`, secret).catch(() => null);
  const compras: any[] = (respCompras?.items ?? []).filter(
    (p: any) => !p?.revoked_at && p?.status !== "refunded"
  );
  const vitalicias: { id: string; inicio: string | null; storeId: string }[] = [];
  for (const p of compras) {
    const storeId = await storeIdDoProduto(p.product_id ?? "", secret);
    if (!storeId.startsWith("core_vitalicio")) continue;
    vitalicias.push({
      id: p.id || `rcp:${userId}`,
      inicio: p.purchased_at ? new Date(p.purchased_at).toISOString() : null,
      // 09/08: existe vitalício de 27,90 e de 19,90 (downsell) — o valor da
      // linha sai do produto, não de constante.
      storeId,
    });
  }

  // REGRA DE OURO: esta função só mexe em linha DA LOJA (payment_method =
  // play_store). Vitalício do Pix, Cakto, cortesia — nada disso é problema
  // dela. Sem essa trava, um sync mal-humorado rebaixaria quem pagou na web.
  if (!vivas.length && !vitalicias.length) {
    const { data: linhas } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("payment_method", "play_store")
      .neq("status", "canceled");
    if (linhas?.length) {
      await admin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId)
        .eq("payment_method", "play_store")
        .neq("status", "canceled");
      return { subscribed: false, reason: "expirou" };
    }
    return { subscribed: false, reason: resp ? "sem_entitlement" : "sem_registro" };
  }

  // Grava TODAS as assinaturas vivas, não só a melhor. Uma pessoa pode ter
  // mais de uma ao mesmo tempo no RevenueCat — é o que acontece no upgrade
  // mensal→anual, que abre uma assinatura NOVA e encerra a antiga. Gravando
  // só a melhor, a linha da antiga ficava "active" pra sempre: o acesso até
  // ficava certo (o check-subscription pega a de fim mais distante), mas o
  // /admin contava dois assinantes onde existe um. Visto de verdade em
  // 25/07 — duas assinaturas no RC, só uma renovou na nossa tabela.
  const idsVivos: string[] = [];
  let melhor: { fim: string | null; prod: string } | null = null;

  for (const v of vitalicias) {
    idsVivos.push(v.id);
    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        status: "active",
        plan: "app",
        billing_period: "lifetime",
        payment_method: "play_store",
        customer_email: email,
        amount_cents: infoProduto(v.storeId).cents ?? 2790,
        current_period_start: v.inicio,
        current_period_end: FIM_VITALICIO,
        revenuecat_subscription_id: v.id,
      },
      { onConflict: "revenuecat_subscription_id" }
    );
    if (error) throw new Error(`upsert vitalício falhou: ${error.message}`);
    melhor = { fim: FIM_VITALICIO, prod: v.storeId };
    /*
     * AVISAR A META DAQUI TAMBÉM (11/08) — regressão da v48.
     *
     * Com o cadastro DEPOIS da compra, a pessoa compra ANÔNIMA: o webhook do
     * RevenueCat chega com `$RCAnonymousID:…`, que não é UUID, e ele desiste
     * cedo ("ignored: anonimo") — então `mandarCompraProMeta` nunca rodava.
     * Quem grava a venda nesse caminho é ESTE sync, chamado depois que a
     * conta nasce. Sem esta linha, a Meta só enxergava as compras de quem já
     * estava logado: em 11/08, 2 de 6. Otimização e relatório de criativo em
     * cima de um terço da verdade.
     *
     * A idempotência (marcador `meta_capi_app_enviado` com o tx) impede
     * evento dobrado quando o webhook TAMBÉM roda pro mesmo usuário.
     */
    // BUG CORRIGIDO 16/08: `centsVitalicio` só existia no webhook — aqui era
    // ReferenceError, a function devolvia 500 DEPOIS do upsert e o CAPI do
    // caminho anônimo (exatamente o que este sync cobre) nunca rodava.
    const centsDaCompra = infoProduto(v.storeId).cents ?? 2790;
    await mandarCompraProMeta(admin, userId, email, centsDaCompra, v.id, v.inicio);
    await mandarCompraProTikTok(admin, userId, email, centsDaCompra, v.id, v.inicio);
  }

  for (const s of vivas) {
    const fim: number | null = s.current_period_ends_at ?? s.ends_at ?? null;
    const fimISO = fim ? new Date(fim).toISOString() : null;
    const storeId = await storeIdDoProduto(s.product_id ?? "", secret);
    const { billing, cents } = infoProduto(storeId);
    const rcId = s.id || `rc:${userId}`;
    idsVivos.push(rcId);

    // UPSERT pela chave natural, não insert/update lido antes: o sync do app e
    // o webhook chegam quase juntos (no 1º teste real, 214 ms de diferença) e
    // os dois viam "não existe linha" → duas assinaturas pro mesmo assinante.
    // Com índice único em revenuecat_subscription_id quem resolve a corrida é
    // o Postgres.
    const payload = {
      user_id: userId,
      status: "active",
      plan: "app",
      billing_period: billing,
      payment_method: "play_store",
      customer_email: email,
      amount_cents: cents,
      // starts_at é a data da compra ORIGINAL e não muda em renovação, então
      // pode ser reescrito à vontade sem bagunçar relatório de coorte.
      current_period_start: s.starts_at ? new Date(s.starts_at).toISOString() : null,
      current_period_end: fimISO,
      revenuecat_subscription_id: rcId,
    };
    const { error } = await admin
      .from("subscriptions")
      .upsert(payload, { onConflict: "revenuecat_subscription_id" });
    if (error) throw new Error(`upsert falhou: ${error.message}`);

    if (!melhor || fimISO === null || (melhor.fim !== null && fimISO > melhor.fim)) {
      melhor = { fim: fimISO, prod: storeId || (s.product_id ?? "") };
    }
  }

  // Encerra linha da loja que o RevenueCat não reconhece mais. Só as que já
  // venceram: uma linha com fim no futuro pode ter acabado de ser criada por
  // um sync concorrente que este retrato do RC ainda não enxergava, e
  // cancelá-la tiraria acesso de quem pagou agora.
  const agora = Date.now();
  const { data: sobras } = await admin
    .from("subscriptions")
    .select("id, revenuecat_subscription_id, current_period_end")
    .eq("user_id", userId)
    .eq("payment_method", "play_store")
    .neq("status", "canceled");
  const mortas = (sobras ?? []).filter(
    (l: any) =>
      !idsVivos.includes(l.revenuecat_subscription_id ?? "") &&
      (!l.current_period_end || new Date(l.current_period_end).getTime() <= agora)
  );
  if (mortas.length) {
    await admin
      .from("subscriptions")
      .update({ status: "canceled" })
      .in("id", mortas.map((l: any) => l.id));
    log("linhas obsoletas encerradas", { userId, quantas: mortas.length });
  }

  return { subscribed: true, product: melhor?.prod ?? null, expires: melhor?.fim ?? null };
}
