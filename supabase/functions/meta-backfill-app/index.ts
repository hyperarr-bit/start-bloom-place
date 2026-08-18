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
) {
  const dataset = Deno.env.get("META_APP_DATASET_ID");
  const token = Deno.env.get("META_APP_CAPI_TOKEN");
  if (!dataset || !token) return;
  const nomeEvento = tipo === "trial" ? "StartTrial" : "Purchase";
  const marcador = tipo === "trial" ? "meta_capi_trial_enviado" : "meta_capi_app_enviado";

  // Idempotência: uma compra = um evento, mesmo com o RevenueCat reenviando
  // o webhook (ele reenvia em qualquer 500 nosso).
  const { data: jaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", marcador)
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
      event_name: nomeEvento,
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
      // Trial não tem dinheiro (ainda): valor 0 pra não inventar receita no
      // painel — o Purchase da cobrança real leva o valor cheio depois.
      custom_data: { currency: "BRL", value: tipo === "trial" ? 0 : cents / 100 },
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
    // Guarda a recusa: sem isso "falhou" é um número sem causa, e já custou
    // meio dia de hipótese errada sobre duplicação de evento.
    if (!r.ok) ultimoErroMeta = corpo.slice(0, 400);
    if (r.ok) {
      await admin.from("analytics_events").insert({
        user_id: userId,
        event_name: marcador,
        event_data: { tx: txId, valor: tipo === "trial" ? 0 : cents / 100 },
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
  email: string | null,
  cents: number,
  txId: string,
  quando: string | null,
) {
  const appId = Deno.env.get("TIKTOK_APP_ID"); // event_source_id, do Events Manager
  // Token ESCOPADO POR FONTE (provado 16/08): o token do pixel da web
  // devolve 401 40001 "No permission to operate event source id" pro app.
  // Mesmo padrão da Meta (META_CAPI_TOKEN web ≠ META_APP_CAPI_TOKEN app):
  // gerar o token DENTRO do app no Events Manager. NÃO é o "app secret" do SDK.
  const token = Deno.env.get("TIKTOK_APP_ACCESS_TOKEN") ?? Deno.env.get("TIKTOK_ACCESS_TOKEN");
  if (!appId || !token) return;

  const { data: jaFoi } = await admin
    .from("analytics_events")
    .select("id")
    .eq("event_name", "tiktok_capi_app_enviado")
    .eq("user_id", userId)
    .contains("event_data", { tx: txId })
    .maybeSingle();
  if (jaFoi) return;

  // GAID (16/08): é o que deixa o TikTok casar a compra com o CLIQUE no
  // anúncio — e-mail só acerta quem usa o mesmo e-mail no TikTok. Vai
  // SHA-256 (é como os conectores oficiais mandam; diferente do madid da
  // Meta, que vai cru). Ficha por user_id; se não achar, pela sessão — a
  // compra anônima (v48+) deixa a ficha pendurada em user_id nulo.
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
        ...(gaid ? { gaid: await sha256(gaid) } : {}),
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
    // O TikTok pode responder HTTP 200 com `code` de erro no corpo (ex.:
    // token sem permissão) — marcador só nasce com code:0, senão a venda
    // seria dada como entregue sem nunca ter chegado.
    let codeTt = -1;
    try { codeTt = JSON.parse(corpo)?.code ?? -1; } catch { /* corpo não-JSON */ }
    if (r.ok && codeTt === 0) {
      await admin.from("analytics_events").insert({
        user_id: userId,
        event_name: "tiktok_capi_app_enviado",
        event_data: { tx: txId, valor: cents / 100 },
      });
    } else {
      ultimoErroTikTok = `HTTP ${r.status} ${corpo.slice(0, 300)}`;
    }
  } catch (e) {
    log("tiktok events api ERRO", { msg: String(e).slice(0, 150) });
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

    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    // Janela do cron: 3 dias pra trás (folga confortável dentro do teto de 7
    // dias da Meta, mesmo se o cron ficar horas fora do ar).
    const de = cron ? iso(new Date(hoje.getTime() - 3 * 86400_000)) : String(body?.de ?? "").slice(0, 10);
    const ate = cron ? iso(hoje) : String(body?.ate ?? de).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de)) return json({ error: "informe de/ate em YYYY-MM-DD" }, 400);
    // Janela BRT: o dia vai de 03:00Z a 03:00Z do dia seguinte.
    const inicio = `${de}T03:00:00Z`;
    const fim = new Date(Date.parse(`${ate}T03:00:00Z`) + 86400_000).toISOString();

    const { data: vendas } = await admin
      .from("subscriptions")
      .select("user_id,customer_email,amount_cents,revenuecat_subscription_id,current_period_start,current_period_end,created_at")
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
       * mais curto que 5 dias = trial (anual/mensal reais duram 30-365d;
       * vitalício tem fim em 2126; o prepaid de 30d passa). Quando o Google
       * COBRAR no dia 3, o sync reescreve a linha com período de 1 ano, o
       * detector deixa passar e o tx (inédito) sobe como Purchase de verdade. */
      const ini = v.current_period_start ? Date.parse(v.current_period_start) : null;
      const fim = v.current_period_end ? Date.parse(v.current_period_end) : null;
      if (ini && fim && fim - ini < 5 * 86400_000 && fim - ini > 0) {
        // Purchase NÃO (dinheiro ainda não existe) — mas StartTrial SIM
        // (18/08): folha aprovada com cartão preso é o sinal de intenção que
        // a campanha AEO otimiza enquanto a cobrança do dia 3 não chega.
        // Idempotente pelo marcador meta_capi_trial_enviado.
        await mandarCompraProMeta(
          admin, v.user_id, v.customer_email, v.amount_cents ?? 15990,
          v.revenuecat_subscription_id, v.current_period_start ?? v.created_at,
          "trial",
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
      const antes = await admin
        .from("analytics_events").select("id")
        .eq("event_name", "meta_capi_app_enviado")
        .eq("user_id", v.user_id)
        .contains("event_data", { tx: v.revenuecat_subscription_id })
        .maybeSingle();
      if (antes.data) { feitos.push({ tx: v.revenuecat_subscription_id, resultado: "ja_enviado" }); continue; }
      await mandarCompraProMeta(
        admin, v.user_id, v.customer_email, v.amount_cents ?? 2790,
        v.revenuecat_subscription_id, v.current_period_start ?? v.created_at,
      );
      const depois = await admin
        .from("analytics_events").select("id")
        .eq("event_name", "meta_capi_app_enviado")
        .eq("user_id", v.user_id)
        .contains("event_data", { tx: v.revenuecat_subscription_id })
        .maybeSingle();
      feitos.push({
        tx: v.revenuecat_subscription_id,
        email: v.customer_email,
        resultado: depois.data ? "enviado" : "falhou",
        ...(depois.data ? {} : { recusa: ultimoErroMeta }),
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
