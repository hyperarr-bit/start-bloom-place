/**
 * revenuecat-webhook — a Play Store avisando o que aconteceu com a assinatura
 * (compra, renovação, cancelamento, reembolso, problema de cobrança).
 *
 * Por que existe (bug de 25/07): o gate do app lê a tabela `subscriptions` e
 * nada escrevia nela quando alguém assinava pela loja. Sem este webhook, o
 * acesso só apareceria quando a pessoa abrisse o app (via revenuecat-sync) —
 * e RENOVAÇÃO e CANCELAMENTO nunca chegariam, porque acontecem com o app
 * fechado. É este arquivo que mantém a verdade em dia.
 *
 * Segurança: verify_jwt = false (quem chama é o RevenueCat, não um usuário),
 * então a autenticação é o header Authorization combinado no painel do RC
 * contra REVENUECAT_WEBHOOK_SECRET. Além disso o evento em si NÃO é fonte de
 * verdade: dele só se aproveita o app_user_id; o estado real é lido da API do
 * RevenueCat com a chave secreta. Evento forjado não libera nada.
 *
 * Configurar no painel RevenueCat → Integrations → Webhooks:
 *   URL:  https://<projeto>.supabase.co/functions/v1/revenuecat-webhook
 *   Auth: o mesmo valor de REVENUECAT_WEBHOOK_SECRET
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const log = (step: string, d?: unknown) =>
  console.log(`[RC-WEBHOOK] ${step}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const esperado = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
    const recebido = req.headers.get("Authorization") ?? "";
    if (!esperado || recebido !== esperado) {
      log("unauthorized");
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const ev = body?.event ?? {};
    log("event", { type: ev.type, product: ev.product_id });

    // TEST envia app_user_id fictício — responde 200 pro painel ficar verde.
    if (ev.type === "TEST") return json({ received: true, test: true });

    // Candidatos: o id atual e os aliases (a pessoa pode ter comprado antes
    // do logIn e o RevenueCat mesclou os perfis).
    const candidatos: string[] = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])]
      .filter((x: unknown): x is string => typeof x === "string" && UUID.test(x));

    if (!candidatos.length) {
      // $RCAnonymousID: compra sem conta CORE identificada. Não dá pra saber
      // a quem dar acesso — o revenuecat-sync resolve quando a pessoa abrir
      // o app logada (o RevenueCat mescla os perfis no logIn).
      log("sem user_id utilizável", { app_user_id: String(ev.app_user_id ?? "").slice(0, 24) });
      return json({ received: true, ignored: "anonimo" });
    }

    const resultados: unknown[] = [];
    for (const uid of [...new Set(candidatos)]) {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (!u?.user) { log("user inexistente", { uid }); continue; }
      const r = await reconciliarRevenueCat(admin, uid, u.user.email ?? null);
      log("reconciliado", { uid, ...r });
      resultados.push({ uid, ...r });
    }

    return json({ received: true, resultados });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    // 500 faz o RevenueCat reenviar — é o que a gente quer em falha nossa.
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
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
  "core_mensal:coremensalpix": { billing: "monthly", cents: 1990 },
  core_anual: { billing: "annual", cents: 15990 },
  core_mensal: { billing: "monthly", cents: 2490 },
  // 06/08: era do produto único — compra ÚNICA do Play (não assinatura).
  // Continuam no mapa pra base que comprou vitalício (renovação de acesso,
  // restore, reembolso). 09/08: downsell 19,90 ANTES do cheio (startsWith).
  core_vitalicio_19: { billing: "lifetime", cents: 1990 },
  core_vitalicio: { billing: "lifetime", cents: 2790 }, // 07/08: 27,90, espelho da web
};

// Vitalício não expira; a tabela usa period_end e o acesso compara com agora,
// então "não expira" vira uma data que nenhum de nós vai ver.
const FIM_VITALICIO = "2126-01-01T00:00:00.000Z";

// ---------------------------------------------------------------------------
// CAPI DE APP DA META (08/08).
//
// Por que sai DAQUI e não do celular: a compra do app fecha com o app
// FECHADO. A 1ª compradora real gerou o Pix na folha do Google às 16h23 e
// pagou 7h41 do dia seguinte — evento disparado pelo aparelho teria perdido
// a venda (e todo reembolso também). O servidor é o único lugar que enxerga
// o fato consumado.
//
// Dataset do APP ≠ pixel do site: são fontes de dados separadas no
// Gerenciador de Eventos, de propósito — o dono compara app × web, e juntar
// os dois num dataset só destrói a comparação.
//
// Dormente sem META_APP_DATASET_ID/META_APP_CAPI_TOKEN.
// ---------------------------------------------------------------------------
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
  const { data: jaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", "meta_capi_app_enviado")
    .eq("user_id", userId)
    .contains("event_data", { tx: txId })
    .maybeSingle();
  if (jaFoi) return;

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
      event_time: Math.floor(new Date(quando ?? Date.now()).getTime() / 1000),
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
 * TikTok Events API (09/08) — mesma ideia do mandarCompraProMeta: manda a
 * compra pro TikTok DEPOIS que o Google já confirmou o pagamento (servidor,
 * não SDK no app). Decisão de arquitetura, não só preguiça de escrever Java:
 * este binário tem política deliberada de não embutir rastreador/SDK de
 * anúncio (ver preparar-loja.mjs — é a mesma razão por trás de nunca
 * coletar GAID). Server-side mantém essa política intacta.
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
  email: string | null,
  cents: number,
  txId: string,
  quando: string | null,
) {
  const appId = Deno.env.get("TIKTOK_APP_ID"); // event_source_id, do Events Manager
  const token = Deno.env.get("TIKTOK_ACCESS_TOKEN"); // gerado no Events Manager, NÃO é o "app secret" do SDK
  if (!appId || !token) return;

  const { data: jaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", "tiktok_capi_app_enviado")
    .eq("user_id", userId)
    .contains("event_data", { tx: txId })
    .maybeSingle();
  if (jaFoi) return;

  const payload: Record<string, unknown> = {
    event_source: "app",
    event_source_id: appId,
    data: [{
      event: "CompletePayment",
      event_time: Math.floor(new Date(quando ?? Date.now()).getTime() / 1000),
      event_id: txId, // dedup: mesma chave (event_source_id, event, event_id) por 48h
      user: {
        external_id: await sha256(userId),
        ...(email ? { email: await sha256(email.trim().toLowerCase()) } : {}),
      },
      properties: { currency: "BRL", value: cents / 100 },
    }],
  };
  const teste = Deno.env.get("TIKTOK_TEST_EVENT_CODE");
  if (teste) payload.test_event_code = teste;

  try {
    const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify(payload),
    });
    const corpo = await r.text();
    log("tiktok events api", { ok: r.ok, status: r.status, corpo: corpo.slice(0, 300) });
    if (r.ok) {
      await admin.from("analytics_events").insert({
        user_id: userId,
        event_name: "tiktok_capi_app_enviado",
        event_data: { tx: txId, valor: cents / 100 },
      });
    }
  } catch (e) {
    log("tiktok events api ERRO", { msg: String(e).slice(0, 150) });
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

  /*
   * COMPRA ÚNICA (06/08, core_vitalicio): o RevenueCat NÃO lista compra
   * única em /subscriptions — ela mora em /purchases. Sem este bloco, quem
   * comprasse o vitalício pagava e ficava sem acesso: o sync via zero
   * assinaturas vivas e ainda cairia no ramo que cancela linha da loja.
   */
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
      // 09/08: 27,90 ou 19,90 (downsell) — o valor sai do produto.
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
    const centsVitalicio = infoProduto(v.storeId).cents ?? 2790;
    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        status: "active",
        plan: "app",
        billing_period: "lifetime",
        payment_method: "play_store",
        customer_email: email,
        amount_cents: centsVitalicio,
        current_period_start: v.inicio,
        current_period_end: FIM_VITALICIO,
        revenuecat_subscription_id: v.id,
      },
      { onConflict: "revenuecat_subscription_id" }
    );
    if (error) throw new Error(`upsert vitalício falhou: ${error.message}`);
    melhor = { fim: FIM_VITALICIO, prod: v.storeId };
    await mandarCompraProMeta(admin, userId, email, centsVitalicio, v.id, v.inicio);
    await mandarCompraProTikTok(admin, userId, email, centsVitalicio, v.id, v.inicio);
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
