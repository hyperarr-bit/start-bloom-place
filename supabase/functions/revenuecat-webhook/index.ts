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
  core_anual: { billing: "annual", cents: 9790 },
  // 19,90 desde 02/08 (preço da Play conferido por API em 05/08); ficou 2990
  // hardcoded e toda mensal entrava na tabela 50% maior.
  core_mensal: { billing: "monthly", cents: 1990 },
  // 06/08: app virou produto único — compra ÚNICA do Play (não assinatura).
  core_vitalicio: { billing: "lifetime", cents: 2790 }, // 07/08: 27,90, espelho da web
};

// Vitalício não expira; a tabela usa period_end e o acesso compara com agora,
// então "não expira" vira uma data que nenhum de nós vai ver.
const FIM_VITALICIO = "2126-01-01T00:00:00.000Z";

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
  const vitalicias: { id: string; inicio: string | null }[] = [];
  for (const p of compras) {
    const storeId = await storeIdDoProduto(p.product_id ?? "", secret);
    if (!storeId.startsWith("core_vitalicio")) continue;
    vitalicias.push({
      id: p.id || `rcp:${userId}`,
      inicio: p.purchased_at ? new Date(p.purchased_at).toISOString() : null,
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
        amount_cents: 2790,
        current_period_start: v.inicio,
        current_period_end: FIM_VITALICIO,
        revenuecat_subscription_id: v.id,
      },
      { onConflict: "revenuecat_subscription_id" }
    );
    if (error) throw new Error(`upsert vitalício falhou: ${error.message}`);
    melhor = { fim: FIM_VITALICIO, prod: "core_vitalicio" };
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
