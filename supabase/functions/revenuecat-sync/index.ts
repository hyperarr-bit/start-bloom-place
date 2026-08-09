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
  core_anual: { billing: "annual", cents: 9790 },
  // 19,90 desde 02/08 — o 2990 ficou aqui esquecido quando o webhook foi
  // corrigido (funções autocontidas: mexeu numa, mexe na outra).
  core_mensal: { billing: "monthly", cents: 1990 },
  // 06/08: app virou produto único — compra ÚNICA do Play (não assinatura).
  // 09/08: downsell 19,90 (core_vitalicio_19). ANTES do core_vitalicio de
  // propósito: o infoProduto casa por startsWith e "core_vitalicio_19"
  // começa com "core_vitalicio" — na ordem errada, todo downsell entraria
  // na tabela (e no Meta) como 27,90.
  core_vitalicio_19: { billing: "lifetime", cents: 1990 },
  core_vitalicio: { billing: "lifetime", cents: 2790 }, // 07/08: 27,90, espelho da web
};

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
