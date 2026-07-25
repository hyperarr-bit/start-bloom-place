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
  core_mensal: { billing: "monthly", cents: 2990 },
};

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
  let melhor: { fim: number | null; inicio: number | null; prod: string; id: string } | null = null;
  for (const s of assinaturas) {
    if (s?.gives_access !== true) continue;
    const fim: number | null = s.current_period_ends_at ?? s.ends_at ?? null;
    if (!melhor || fim === null || (melhor.fim !== null && fim > melhor.fim)) {
      melhor = { fim, inicio: s.starts_at ?? null, prod: s.product_id ?? "", id: s.id ?? "" };
    }
  }

  // REGRA DE OURO: esta função só mexe em linha DA LOJA (payment_method =
  // play_store). Vitalício do Pix, Cakto, cortesia — nada disso é problema
  // dela. Sem essa trava, um sync mal-humorado rebaixaria quem pagou na web.
  if (!melhor) {
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

  const storeId = await storeIdDoProduto(melhor.prod, secret);
  const { billing, cents } = infoProduto(storeId);
  const fimISO = melhor.fim ? new Date(melhor.fim).toISOString() : null;

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
    current_period_start: melhor.inicio ? new Date(melhor.inicio).toISOString() : null,
    current_period_end: fimISO,
    revenuecat_subscription_id: melhor.id || `rc:${userId}`,
  };
  const { error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "revenuecat_subscription_id" });
  if (error) throw new Error(`upsert falhou: ${error.message}`);

  return { subscribed: true, product: storeId || melhor.prod, expires: fimISO };
}
