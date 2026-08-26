import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * meta-backfill-app — reenvia pra Meta compras do app que ficaram pra trás.
 *
 * POR QUE ISTO EXISTE (11/08): a v48 passou a vender ANTES do cadastro. O
 * webhook do RevenueCat chega com `$RCAnonymousID:…`, não reconhece como
 * usuário e desiste — então a Meta nunca soube. Em 11/08 foram 4 de 6 vendas
 * invisíveis, e campanha otimiza pelo que enxerga. O caminho já foi
 * consertado no `revenuecat-sync`, mas o que passou precisa ser reposto: a
 * Meta aceita evento de até 7 DIAS.
 *
 * Admin-only. Idempotente pelo marcador `meta_capi_app_enviado` + tx — rodar
 * duas vezes não duplica evento (e evento duplicado estraga o CPA no painel).
 *
 * POST { "de": "2026-08-11", "ate": "2026-08-11" }   (datas em BRT)
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" }, status: s });
const log = (p: string, d?: unknown) =>
  console.log(`[META-BACKFILL] ${p}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/** Última recusa da Meta, pra devolver no modo admin (diagnóstico). */
let ultimoErroMeta: string | null = null;
// DIAGNÓSTICO (26/08): quais eventos foram de fato empacotados e o que a Meta
// respondeu. Sem isso, "enviado" só diz que houve HTTP 200 — não diz se o
// compra_anual_97 entrou no pacote nem quantos eventos a Meta contou.
let ultimoPacote: { nomes: string[]; resposta: string } | null = null;
let ultimoErroTikTok: string | null = null;

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
  // "trial" (18/08): manda StartTrial em vez de Purchase — é o evento que a
  // campanha AEO otimiza enquanto a cobrança do dia 3 não existe. Marcador
  // próprio: o MESMO tx manda StartTrial hoje e Purchase quando o Google
  // cobrar (dedup da Meta é por (event_name, event_id), não colide).
  tipo: "purchase" | "trial" = "purchase",
  // família do produto ("monthly_prepaid" etc) — preço sozinho não basta
  billing: string | null = null,
  // MODO FORÇADO (26/08): ignora o marcador e reenvia. Só o caminho ADMIN com
  // lista explícita de tx chega aqui — o cron nunca força. Serve pra estrear
  // evento novo em venda que já saiu (o dedup da Meta é por (nome, event_id),
  // então Purchase e compra_avista são descartados e só o nome inédito entra).
  forcar = false,
) {
  const dataset = Deno.env.get("META_APP_DATASET_ID");
  const token = Deno.env.get("META_APP_CAPI_TOKEN");
  if (!dataset || !token) return;
  const nomeEvento = tipo === "trial" ? "StartTrial" : "Purchase";
  const marcador = tipo === "trial" ? "meta_capi_trial_enviado" : "meta_capi_app_enviado";

  // Idempotência: uma compra = um evento, mesmo com o RevenueCat reenviando
  // o webhook (ele reenvia em qualquer 500 nosso).
  const { data: jaFoi, error: erroJaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", marcador)
    .eq("user_id", userId)
    .contains("event_data", { tx: txId })
    .limit(2);
  // maybeSingle() com marcador DUPLICADO devolvia erro (PGRST116) que era
  // ignorado -> data null -> reenvio ETERNO a cada cron (caso real 17-19/08:
  // meta_capi_app_enviado x96/dia). Na duvida (erro OU 1+ marcador), NAO reenvia.
  if (!forcar && (erroJaFoi || (jaFoi?.length ?? 0) > 0)) return;

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
      event_name: nomeEvento,
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
      // StartTrial LEVA O VALOR DO PLANO (20/08, decisão do dono): receita e
      // ROAS no painel vêm SÓ do Purchase — valor aqui não vira caixa, vira
      // SINAL: com histórico de evento valorado, dá pra otimizar conjunto por
      // "maximizar valor" e a Meta caçar o anual (159,90 pesa 6,4× o mensal)
      // em vez de achar por sorte. O Purchase da cobrança real segue igual.
      custom_data: { currency: "BRL", value: cents / 100 },
    }],
  };
  // COMPRA_AVISTA (23/08, pivô à vista): evento NOVO de compra com histórico
  // LIMPO — o Purchase padrão ficou envenenado pelos reenvios ×36-50/venda de
  // 17-22/08 (bug do dedup). A campanha nova otimiza por ELE (promoted_object:
  // custom_event_type OTHER + custom_event_str "compra_avista"); o Purchase
  // segue junto pra painel/ROAS. Mesma tx, event_id próprio pro dedup da Meta.
  if (tipo === "purchase") {
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
    //
    // UM EVENTO POR PREÇO (26/08). Antes `compra_anual` somava 97,90 E 159,90,
    // e `compra_mensal` somava 19,90 E 24,90 — a Meta via os dois como a mesma
    // conversão e não tinha como lançar mais por um ticket 64% maior. Pior no
    // nosso caso: o presente de 97,90 converte mais fácil, então a campanha
    // aprenderia a caçar quem compra o BARATO. Agora cada preço tem nome
    // próprio e o conjunto escolhe o que quer maximizar.
    //
    // PREÇO SOZINHO NÃO IDENTIFICA O PRODUTO (26/08). O vitalício R$ 19,90 dos
    // APKs antigos tem o MESMO valor do coremensalpix — sem checar o tipo, uma
    // venda vitalícia entrava como `compra_mensal_pix` e envenenava justamente
    // o sinal que a gente está construindo. Por isso o par (cents + billing).
    //
    // E UM COMBINADO POR FAMÍLIA (26/08). Separar por preço deixa cada evento
    // com sinal curto demais: mensal ficou 24 (24,90) e 5 (19,90). O
    // `compra_mensal_geral` dispara nos DOIS e junta os 29 — é ele que um
    // conjunto de anúncios usa pra otimizar "vendeu um mês", sem se importar
    // se foi cheio ou resgate. Os por preço continuam existindo pra leitura.
    const MENSAL_GERAL = { evento: "compra_mensal_geral", sufixo: "mg" };
    const PRECOS: Record<number, { evento: string; sufixo: string; aceita: string[]; junto?: { evento: string; sufixo: string } }> = {
      1990:  { evento: "compra_mensal_pix", sufixo: "mp",  aceita: ["monthly_prepaid"], junto: MENSAL_GERAL },
      2490:  { evento: "compra_mensal",     sufixo: "m",   aceita: ["monthly_prepaid", "monthly"], junto: MENSAL_GERAL },
      9790:  { evento: "compra_anual_97",   sufixo: "a97", aceita: ["annual_prepaid"] },
      15990: { evento: "compra_anual",      sufixo: "a",   aceita: ["annual_prepaid", "annual"] },
    };
    const achado = PRECOS[cents];
    const porPlano = achado && billing && achado.aceita.includes(billing) ? achado : null;
    if (porPlano) {
      eventos.push({ ...base, event_name: porPlano.evento, event_id: `${txId}_${porPlano.sufixo}` });
      if (porPlano.junto) eventos.push({ ...base, event_name: porPlano.junto.evento, event_id: `${txId}_${porPlano.junto.sufixo}` });
    }
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
    ultimoPacote = {
      nomes: (payload.data as Array<{ event_name?: string }>).map((e) => String(e.event_name)),
      resposta: corpo.slice(0, 200),
    };
    log("meta capi app", { ok: r.ok, status: r.status, corpo: corpo.slice(0, 200) });
    // Guarda a recusa: sem isso "falhou" é um número sem causa, e já custou
    // meio dia de hipótese errada sobre duplicação de evento.
    if (!r.ok) ultimoErroMeta = corpo.slice(0, 400);
    if (r.ok) {
      await admin.from("analytics_events").insert({
        user_id: userId,
        event_name: marcador,
        event_data: { tx: txId, valor: cents / 100 },
      });
    }
  } catch (e) {
    log("meta capi app ERRO", { msg: String(e).slice(0, 150) });
  }
}

/**
 * TikTok Events API (16/08) — cópia do enviador do webhook/sync, pendurada
 * AQUI porque este cron de 15min é a única rede que pega TODAS as vendas da
 * loja (o caminho ao vivo só cobre vitalício; assinatura nova cai só aqui).
 * Mesma divisão de trabalho da Meta: o SDK do TikTok embarcado no app (v55)
 * manda SÓ instalação/abertura; a compra sai do servidor, dedup por tx.
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
    } else {
      ultimoErroTikTok = `HTTP ${r.status} ${corpo.slice(0, 300)}`;
    }
  } catch (e) {
    log("tiktok app batch ERRO", { msg: String(e).slice(0, 150) });
    ultimoErroTikTok = String(e).slice(0, 200);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);
    const { data: u } = await anon.auth.getUser(auth.replace("Bearer ", ""));
    const uid = u?.user?.id;
    let ehAdmin = false;
    if (uid) {
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      ehAdmin = !!role;
    }

    const body = await req.json().catch(() => ({}));

    /*
     * MODO CRON (13/08) — sem sessão de admin, roda a varredura dos últimos
     * dias sozinho. É o conserto do vazamento achado hoje: NENHUMA venda do
     * fluxo anônimo (v48+, que virou o padrão) se auto-envia — 5 de 5 falharam,
     * enquanto 3 de 3 de quem já estava logado passaram. A causa provável é a
     * compra ser gravada ANTES da ficha do aparelho existir (19s de diferença
     * na venda da ingrid), e o evento sair sem extinfo. Mas a correção certa
     * não depende de acertar a causa: a Meta aceita evento de até 7 DIAS, então
     * varrer de tempos em tempos recupera o que o caminho ao vivo perder — seja
     * qual for o motivo. Sem isso, campanha de app otimiza pela metade da
     * verdade (foi o que aconteceu em 11/08: 10 de 22 vendas invisíveis).
     *
     * Seguro com chave anônima pela mesma razão do pix-reconcile: não aceita
     * janela do chamador, é idempotente pelo marcador + tx (chamar 100x não
     * duplica evento) e NÃO devolve e-mail de ninguém. O pior que um terceiro
     * consegue é fazer a Meta receber vendas que realmente aconteceram.
     */
    const cron = !ehAdmin;
    if (cron && String(body?.modo ?? "") !== "cron") return json({ error: "forbidden" }, 403);

    /* REENVIO FORÇADO — lista EXPLÍCITA de tx, só pra admin logado. Nunca uma
     * flag "força tudo": o estrago de reenviar a base inteira seria o mesmo
     * bug de 17-22/08 (1.292 Purchase fantasma), e ninguém quer repetir. */
    const forcarTx: string[] = (!cron && Array.isArray(body?.forcarTx))
      ? (body.forcarTx as unknown[]).map(String).slice(0, 50)
      : [];

    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    // Janela do cron: 12 dias pra trás (23/08 — trial do anual virou 7 DIAS,
    // oferta coretrial7). A conversão acontece +7d do created_at e a
    // liquidação Pix/pendência do Google já mostrou +26h de atraso (safra
    // 22/08): 7+3+margem = 12. O filtro é por created_at da LINHA; o
    // event_time que vai pra Meta é o da conversão (recente), então o teto
    // de 7 dias da Meta continua respeitado. Idempotente pelos marcadores.
    const de = cron ? iso(new Date(hoje.getTime() - 12 * 86400_000)) : String(body?.de ?? "").slice(0, 10);
    const ate = cron ? iso(hoje) : String(body?.ate ?? de).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de)) return json({ error: "informe de/ate em YYYY-MM-DD" }, 400);
    // Janela BRT: o dia vai de 03:00Z a 03:00Z do dia seguinte.
    const inicio = `${de}T03:00:00Z`;
    const fim = new Date(Date.parse(`${ate}T03:00:00Z`) + 86400_000).toISOString();

    const { data: vendas } = await admin
      .from("subscriptions")
      .select("user_id,customer_email,amount_cents,revenuecat_subscription_id,current_period_start,current_period_end,created_at,billing_period")
      .eq("payment_method", "play_store")
      .not("revenuecat_subscription_id", "is", null)
      .gte("created_at", inicio)
      .lt("created_at", fim)
      .order("created_at", { ascending: true });

    /* Compra de TESTE não vai pra Meta: ela não veio de anúncio nenhum, então
     * só suja o aprendizado do algoritmo (e o CPA do painel). Já tinha sido
     * excluída à mão num backfill anterior; aqui vira regra. */
    const EH_TESTE = (email?: string | null) =>
      !!email && /(^|[+.])teste|testeghg|jv20101958/i.test(email);

    const feitos: unknown[] = [];
    for (const v of vendas ?? []) {
      if (EH_TESTE(v.customer_email)) {
        feitos.push({ tx: v.revenuecat_subscription_id, email: v.customer_email, resultado: "pulado_teste" });
        continue;
      }
      /* TRIAL NÃO É COMPRA (18/08, coretrial religada): a assinatura em
       * período de teste entra na tabela com amount_cents cheio (159,90) mas
       * NENHUM dinheiro existiu — mandar Purchase agora envenenaria a
       * otimização da Meta/TikTok com receita falsa. Detector: período atual
       * mais curto que 10 dias = trial. ATENÇÃO (23/08): era 5 — com o trial
       * de 7 DIAS (coretrial7) um período de 7d passava batido e virava
       * Purchase de R$ 159,90 SEM dinheiro existir. 10 cobre 7d + a extensão
       * de pendência que o Google aplica (safra 22/08: +26h); nada legítimo
       * dura <10d (prepaid 30d, mensal 30d, anual 365d, vitalício 2126).
       * Quando o Google COBRAR no fim do teste, o sync reescreve a linha com
       * período de 30/365d, o detector deixa passar e o tx (inédito) sobe
       * como Purchase de verdade. */
      const ini = v.current_period_start ? Date.parse(v.current_period_start) : null;
      const fim = v.current_period_end ? Date.parse(v.current_period_end) : null;
      if (ini && fim && fim - ini < 10 * 86400_000 && fim - ini > 0) {
        // Purchase NÃO (dinheiro ainda não existe) — mas StartTrial SIM
        // (18/08): folha aprovada com cartão preso é o sinal de intenção que
        // a campanha AEO otimiza enquanto a cobrança do dia 3 não chega.
        // Idempotente pelo marcador meta_capi_trial_enviado.
        await mandarCompraProMeta(
          admin, v.user_id, v.customer_email, v.amount_cents ?? 15990,
          v.revenuecat_subscription_id, v.current_period_start ?? v.created_at,
          "trial",
        );
        // TikTok recebe o MESMO sinal (StartTrial, com o VALOR do plano) — marcador
        // próprio (tiktok_trial_enviado), dormente sem os secrets.
        await mandarCompraProTikTok(
          admin, v.user_id, v.customer_email, v.amount_cents ?? 15990,
          v.revenuecat_subscription_id, v.current_period_start ?? v.created_at,
          true,
        );
        feitos.push({ tx: v.revenuecat_subscription_id, resultado: "trial_starttrial" });
        continue;
      }
      // TikTok ANTES do `continue` da Meta: os marcadores são separados, e a
      // venda que a Meta já recebeu ainda pode dever o evento pro TikTok
      // (aconteceu com TODAS até 16/08 — o enviador nem existia neste cron).
      // A própria função checa o marcador dela e os secrets; dormente sem eles.
      await mandarCompraProTikTok(
        admin, v.user_id, v.customer_email, v.amount_cents ?? 2790,
        v.revenuecat_subscription_id, v.current_period_start ?? v.created_at,
      );
      const forcarEsta = forcarTx.includes(String(v.revenuecat_subscription_id));
      if (!forcarEsta) {
        const antes = await admin
          .from("analytics_events").select("id")
          .eq("event_name", "meta_capi_app_enviado")
          .eq("user_id", v.user_id)
          .contains("event_data", { tx: v.revenuecat_subscription_id })
          .maybeSingle();
        if (antes.data) { feitos.push({ tx: v.revenuecat_subscription_id, resultado: "ja_enviado" }); continue; }
      }
      await mandarCompraProMeta(
        admin, v.user_id, v.customer_email, v.amount_cents ?? 2790,
        v.revenuecat_subscription_id, v.current_period_start ?? v.created_at,
        "purchase", v.billing_period, forcarEsta,
      );
      // .limit(1), NÃO .maybeSingle(): no reenvio forçado existem 2+ marcadores
      // pro mesmo tx, e maybeSingle() devolve erro PGRST116 nessa situação —
      // o envio dava certo e o relatório dizia "falhou". Mesma armadilha que já
      // tinha derrubado a checagem de idempotência lá em cima.
      const depois = await admin
        .from("analytics_events").select("id")
        .eq("event_name", "meta_capi_app_enviado")
        .eq("user_id", v.user_id)
        .contains("event_data", { tx: v.revenuecat_subscription_id })
        .limit(1);
      feitos.push({
        tx: v.revenuecat_subscription_id,
        email: v.customer_email,
        resultado: depois.data?.length ? "enviado" : "falhou",
        ...(depois.data?.length ? {} : { recusa: ultimoErroMeta }),
        ...(forcarEsta && ultimoPacote ? { pacote: ultimoPacote } : {}),
      });
    }
    log("fim", { de, ate, total: feitos.length, cron });
    if (cron) {
      // Resposta sem e-mail: este caminho é alcançável com chave anônima.
      const conta = (r: string) => feitos.filter((f) => (f as { resultado: string }).resultado === r).length;
      return json({
        modo: "cron", de, ate,
        vendas: (vendas ?? []).length,
        enviados: conta("enviado"),
        ja_enviados: conta("ja_enviado"),
        falhas: conta("falhou"),
      });
    }
    return json({ de, ate, vendas: (vendas ?? []).length, tiktok_ultimo_erro: ultimoErroTikTok, resultados: feitos });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    log("ERRO", { m });
    return json({ error: m }, 500);
  }
});
