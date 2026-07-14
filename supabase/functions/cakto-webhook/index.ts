import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ============================================================================
// Webhook da Cakto — substitui o abacatepay-webhook para novas assinaturas.
//
// Diferenças em relação à AbacatePay:
//   - O secret vem no CORPO do payload (body.secret), não em header.
//   - Não há metadata custom (user_id): a associação compra→usuário é feita
//     pelo e-mail do comprador (data.customer.email). O cakto-checkout
//     pré-preenche o e-mail da conta no link justamente para isso.
//   - O plano (mensal/anual) é inferido pelo ID da oferta comprada.
//
// Eventos tratados: purchase_approved, subscription_renewed,
// subscription_canceled, refund, chargeback. Demais → log e 200.
// ============================================================================

// MANTER EM SINCRONIA com CHECKOUT_LINKS em supabase/functions/cakto-checkout/index.ts.
// Os IDs são os códigos curtos dos links pay.cakto.com.br/<código>.
type OfferCfg = { billing: "monthly" | "annual" | "lifetime"; winback?: boolean };
const CAKTO_OFFERS: Record<string, OfferCfg> = {
  "6g8iiak": { billing: "monthly" },                    // CORE Pro Mensal (legado)
  "37pjpm8": { billing: "monthly" },                    // Oferta limitada mensal (legado)
  "xs9s7ws_914041": { billing: "annual" },              // CORE Pro Anual (legado)
  "xs9s7ws": { billing: "annual" },                     // (variação sem sufixo)
  "6a3owem": { billing: "annual", winback: true },      // Oferta limitada anual (winback legado)
};
// VITALÍCIO (13/07, Pix in-app via cakto-pix): offer IDs vêm de secrets —
// os mesmos que a cakto-pix usa — pra não hardcodar IDs de oferta no repo.
const LIFETIME_OFFER = Deno.env.get("CAKTO_OFFER_LIFETIME") ?? "";
const DOWNSELL_OFFER = Deno.env.get("CAKTO_OFFER_DOWNSELL") ?? "";
if (LIFETIME_OFFER) CAKTO_OFFERS[LIFETIME_OFFER.toLowerCase()] = { billing: "lifetime" };
if (DOWNSELL_OFFER) CAKTO_OFFERS[DOWNSELL_OFFER.toLowerCase()] = { billing: "lifetime" };

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CAKTO-WEBHOOK] ${step}${d}`);
};

// UTMify Orders API: a venda do Pix in-app NÃO passa pelo checkout hospedado,
// então a integração nativa Cakto→UTMify não dispara (nem notificação). Aqui
// mandamos a venda server-side, com a UTM que capturamos no funil — cookie-
// independente e com a campanha certa. Data em UTC "YYYY-MM-DD HH:MM:SS".
const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logStep("CAKTO_WEBHOOK_SECRET not configured — rejecting request");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();

    // SECURITY: a Cakto envia o secret no corpo do payload
    if (!body?.secret || body.secret !== webhookSecret) {
      logStep("Invalid webhook secret");
      return new Response("Unauthorized", { status: 401 });
    }

    const event: string = body.event ?? "";
    const data = body.data || {};
    const customer = data.customer || {};
    const offer = data.offer || {};
    const sub = data.subscription || {};
    const product = data.product || {};

    const purchaseId: string | null = data.id ? String(data.id) : null;
    const subscriptionId: string | null = sub.id ? String(sub.id) : purchaseId;
    const customerEmail: string | null = customer.email || null;
    const offerId: string = String(offer.id ?? "").toLowerCase();

    logStep("Webhook received", { event, purchaseId, offerId, email: customerEmail });

    // SECURITY: idempotência — mesmo purchase id pode aparecer em eventos
    // diferentes (approved → refund), então a chave inclui o evento.
    if (purchaseId) {
      const { error: dupErr } = await supabaseClient
        .from("webhook_events")
        .insert({ id: `${event}:${purchaseId}`, source: "cakto", event });
      if (dupErr) {
        if ((dupErr as { code?: string }).code === "23505") {
          logStep("Duplicate event ignored", { event, purchaseId });
          return jsonResponse({ received: true, duplicate: true });
        }
        logStep("Idempotency insert failed (continuing)", { message: dupErr.message });
      }
    }

    // ---- Plano: pela oferta; fallback por recorrência/preço --------------
    const offerCfg = CAKTO_OFFERS[offerId] || CAKTO_OFFERS[offerId.split("_")[0]];
    let billingPeriod: "monthly" | "annual" | "lifetime";
    if (offerCfg) {
      billingPeriod = offerCfg.billing;
    } else {
      // recurrence_period vem em meses; preço anual é bem maior que o mensal
      const months = Number(sub.recurrence_period ?? 0);
      const price = Number(offer.price ?? data.amount ?? 0);
      billingPeriod = months >= 12 || price >= 30 ? "annual" : "monthly";
      logStep("Unknown offer id — inferred billing period", { offerId, months, price, billingPeriod });
    }
    const isWinback = Boolean(offerCfg?.winback);

    // ---- Método de pagamento ----------------------------------------------
    const rawMethod = String(
      data.paymentMethod || data.payment_method || data.paymentMethodName || ""
    ).toLowerCase();
    const paymentMethod = rawMethod.includes("pix") ? "pix" : "card";

    const now = new Date();

    // ---- Usuário: match por e-mail (paginado) ou por assinatura existente --
    async function resolveUserId(): Promise<string | null> {
      if (customerEmail) {
        const target = customerEmail.toLowerCase();
        for (let page = 1; page <= 20; page++) {
          const { data: usersData, error: listError } = await supabaseClient.auth.admin.listUsers({
            page,
            perPage: 1000,
          });
          if (listError) {
            logStep("Error listing users", { message: listError.message });
            break;
          }
          const matched = usersData.users.find(
            (u: { email?: string }) => u.email?.toLowerCase() === target
          );
          if (matched) {
            logStep("Found user by email", { userId: matched.id });
            return matched.id;
          }
          if (usersData.users.length < 1000) break;
        }
        // fallback: e-mail já registrado numa assinatura anterior
        const { data: subRow } = await supabaseClient
          .from("subscriptions")
          .select("user_id")
          .ilike("customer_email", customerEmail)
          .limit(1)
          .maybeSingle();
        if (subRow?.user_id) {
          logStep("Found user via subscriptions.customer_email", { userId: subRow.user_id });
          return subRow.user_id;
        }
      }
      // fallback: id de assinatura Cakto já salvo (renovações/cancelamentos)
      if (subscriptionId) {
        const { data: subRow } = await supabaseClient
          .from("subscriptions")
          .select("user_id")
          .eq("abacatepay_subscription_id", subscriptionId)
          .limit(1)
          .maybeSingle();
        if (subRow?.user_id) {
          logStep("Found user via subscription id", { userId: subRow.user_id });
          return subRow.user_id;
        }
      }
      logStep("No user found", { email: customerEmail, subscriptionId });
      return null;
    }

    // Indique e ganhe: 1ª compra de um indicado → +30 dias pros dois.
    // referral_rewards tem UNIQUE(referred_id): reprocessar webhook não paga 2x.
    async function applyReferralReward(userId: string) {
      try {
        const { data: me } = await supabaseClient
          .from("profiles").select("referred_by_code").eq("id", userId).maybeSingle();
        const code = (me as any)?.referred_by_code?.trim();
        if (!code) return;

        const { data: referrer } = await supabaseClient
          .from("profiles").select("id").eq("referral_code", code).maybeSingle();
        if (!referrer || (referrer as any).id === userId) return;
        const referrerId = (referrer as any).id as string;

        const { error: rewardErr } = await supabaseClient
          .from("referral_rewards").insert({ referrer_id: referrerId, referred_id: userId });
        if (rewardErr) {
          logStep("Referral reward skipped (already rewarded?)", { message: rewardErr.message });
          return;
        }

        const extend30 = async (uid: string) => {
          const { data: s } = await supabaseClient
            .from("subscriptions")
            .select("id, current_period_end, plan, status")
            .eq("user_id", uid)
            .maybeSingle();
          if (!s?.current_period_end || s.plan === "lifetime") return;
          const base = new Date(s.current_period_end);
          const from = base > new Date() ? base : new Date();
          from.setDate(from.getDate() + 30);
          await supabaseClient
            .from("subscriptions")
            .update({ current_period_end: from.toISOString() })
            .eq("id", s.id);
        };

        await extend30(userId);      // indicado: +30 dias na assinatura nova
        await extend30(referrerId);  // indicador: +30 dias na dele (se tiver)

        await supabaseClient.from("analytics_events").insert({
          user_id: referrerId,
          event_name: "referral_reward",
          event_data: { referred_id: userId, days: 30 },
        });
        logStep("Referral reward applied", { referrer: referrerId, referred: userId });
      } catch (e) {
        logStep("Referral reward failed", { message: (e as Error).message });
      }
    }

    async function saveActiveSubscription(userId: string, emitConversion: boolean) {
      // Fim do período: usa next_payment_date da Cakto quando vier; senão calcula.
      // VITALÍCIO: pagamento único, nada renova — period_end vai pra +100 anos
      // (convenção da base; check-subscription só olha status+period_end).
      let periodEnd = new Date(now);
      const nextPayment = sub.next_payment_date ? new Date(sub.next_payment_date) : null;
      if (billingPeriod === "lifetime") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 100);
      } else if (nextPayment && !isNaN(nextPayment.getTime()) && nextPayment > now) {
        periodEnd = nextPayment;
      } else if (billingPeriod === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // NOTA: as colunas abacatepay_* são legadas — reutilizadas para os IDs da
      // Cakto para não exigir migration (são apenas texto de referência/match).
      const payload = {
        user_id: userId,
        status: "active",
        plan: billingPeriod === "lifetime" ? "lifetime" : "core-pro",
        billing_period: billingPeriod,
        payment_method: paymentMethod,
        abacatepay_billing_id: purchaseId,
        abacatepay_subscription_id: subscriptionId,
        customer_email: customerEmail,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      };

      const { data: updated, error: updateError } = await supabaseClient
        .from("subscriptions")
        .update(payload)
        .eq("user_id", userId)
        .select("id");
      if (updateError) {
        logStep("Update error", { message: updateError.message, userId });
      }
      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabaseClient.from("subscriptions").insert(payload);
        if (insertError) {
          logStep("Insert error", { message: insertError.message, userId });
          return;
        }
      }

      if (emitConversion) {
        try {
          const { data: u } = await supabaseClient.auth.admin.getUserById(userId);
          let trialDay: number | null = null;
          let daysToConvert: number | null = null;
          if (u?.user?.created_at) {
            const ms = Date.now() - new Date(u.user.created_at).getTime();
            trialDay = Math.min(8, Math.max(1, Math.ceil(ms / 86400000)));
            daysToConvert = Math.round(ms / 86400000);
          }
          // Nome legado (dashboards existentes)
          await supabaseClient.from("analytics_events").insert({
            user_id: userId,
            event_name: "subscription_started",
            event_data: { plan: billingPeriod === "lifetime" ? "lifetime" : "core-pro", billing_period: billingPeriod, payment_method: paymentMethod, gateway: "cakto" },
            trial_day: trialDay,
          });
          // Evento canônico de conversão trial → pago
          await supabaseClient.from("analytics_events").insert({
            user_id: userId,
            event_name: "trial_converted",
            event_data: {
              plan: billingPeriod === "lifetime" ? "lifetime" : "core-pro",
              billing_period: billingPeriod,
              payment_method: paymentMethod,
              days_to_convert: daysToConvert,
              gateway: "cakto",
            },
            trial_day: trialDay,
          });
        } catch (e) {
          logStep("Event emit failed", { message: (e as Error).message });
        }

        // Indique e ganhe (só na 1ª compra — renovação não premia de novo)
        await applyReferralReward(userId);
      }

      // Compra da oferta winback → registra uso e marca conversão da tentativa
      if (isWinback) {
        try {
          const { data: existing } = await supabaseClient
            .from("retention_offers_used")
            .select("id")
            .eq("user_id", userId)
            .eq("offer_type", "winback80")
            .maybeSingle();
          if (!existing) {
            await supabaseClient.from("retention_offers_used").insert({
              user_id: userId,
              offer_type: "winback80",
              status: "active",
              metadata: { billing: billingPeriod, gateway: "cakto", offer_id: offerId },
            });
          }
          const { data: attempt } = await supabaseClient
            .from("winback_attempts")
            .select("id")
            .eq("user_id", userId)
            .is("converted_at", null)
            .order("triggered_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (attempt) {
            await supabaseClient
              .from("winback_attempts")
              .update({ converted_at: new Date().toISOString() })
              .eq("id", attempt.id);
            logStep("Winback marked converted", { attemptId: attempt.id });
          }
        } catch (e) {
          logStep("Winback convert update failed", { msg: String(e) });
        }
      }
    }

    // Manda a venda paga pra UTMify (Orders API). Não-bloqueante: qualquer
    // erro só loga — nunca derruba o webhook / o acesso do cliente.
    async function sendToUtmify(userId: string, status: "paid" | "refunded" | "chargedback") {
      const token = Deno.env.get("UTMIFY_API_TOKEN");
      if (!token) return;
      try {
        // UTM: primeiro do metadata do pedido (se a Cakto ecoar), senão do
        // que capturamos no funil (pix_generated / funnel_view guardam utm_*).
        const meta = (data.metadata || {}) as Record<string, string>;
        let utm = {
          utm_source: meta.utm_source || null,
          utm_medium: meta.utm_medium || null,
          utm_campaign: meta.utm_campaign || null,
          utm_content: meta.utm_content || null,
          utm_term: meta.utm_term || null,
        };
        if (!utm.utm_source) {
          const { data: rows } = await supabaseClient
            .from("analytics_events")
            .select("event_data")
            .eq("user_id", userId)
            .in("event_name", ["pix_generated", "pix_checkout_open", "pix_copied", "funnel_view"])
            .order("created_at", { ascending: false })
            .limit(40);
          const hit = (rows as Array<{ event_data: Record<string, string> }> | null)
            ?.find((r) => r.event_data?.utm_source);
          if (hit) {
            const d = hit.event_data;
            utm = {
              utm_source: d.utm_source || null,
              utm_medium: d.utm_medium || null,
              utm_campaign: d.utm_campaign || null,
              utm_content: d.utm_content || null,
              utm_term: d.utm_term || null,
            };
          }
        }

        // Valor: data.amount é a fonte (27.9 lifetime | 14.9 downsell); sem ele,
        // deduz pelo offer id do downsell.
        const amountNum = Number(data.amount ?? offer.price ?? 0);
        const isDownsell = offerId === DOWNSELL_OFFER.toLowerCase();
        const priceInCents = amountNum > 0
          ? Math.round(amountNum * 100)
          : (isDownsell ? 1490 : 2790);

        const nowStamp = utcStamp(new Date());
        const productName = billingPeriod === "lifetime"
          ? (isDownsell || priceInCents <= 1490 ? "CORE Vitalício (oferta)" : "CORE Vitalício")
          : "CORE Pro";

        const payload = {
          orderId: String(purchaseId ?? subscriptionId ?? `${userId}-${Date.now()}`),
          platform: "Cakto",
          paymentMethod: paymentMethod === "pix" ? "pix" : "credit_card",
          status,
          createdAt: nowStamp,
          approvedDate: status === "paid" ? nowStamp : null,
          refundedAt: status === "paid" ? null : nowStamp,
          customer: {
            name: customer.name || customerEmail?.split("@")[0] || "Cliente",
            email: customerEmail || "",
            phone: customer.phone || null,
            document: customer.docNumber || customer.document || null,
            country: "BR",
          },
          products: [{
            id: offerId || String(purchaseId ?? "core"),
            name: productName,
            planId: null,
            planName: billingPeriod,
            quantity: 1,
            priceInCents,
          }],
          trackingParameters: { src: null, sck: null, ...utm },
          commission: {
            totalPriceInCents: priceInCents,
            gatewayFeeInCents: 0,
            userCommissionInCents: priceInCents,
          },
          isTest: false,
        };

        const res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-token": token },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          logStep("UTMify error", { status: res.status, body: txt.slice(0, 300) });
        } else {
          logStep("UTMify order sent", { orderId: payload.orderId, status, priceInCents, utm_source: utm.utm_source });
        }
      } catch (e) {
        logStep("UTMify send failed", { message: (e as Error).message });
      }
    }

    async function updateStatus(userId: string | null, status: string) {
      let query = supabaseClient.from("subscriptions").update({ status });
      if (userId) {
        query = query.eq("user_id", userId);
      } else if (subscriptionId) {
        query = query.eq("abacatepay_subscription_id", subscriptionId);
      } else {
        logStep("Cannot update status — no user/subscription reference", { status });
        return;
      }
      const { error } = await query;
      if (error) logStep("Status update error", { status, message: error.message });
    }

    // ---- Roteamento de eventos ---------------------------------------------
    if (event === "purchase_approved" || event === "subscription_renewed") {
      const userId = await resolveUserId();
      if (!userId) {
        logStep("Cannot associate payment — no user found", { event, purchaseId, customerEmail });
        return jsonResponse({ received: true, warning: "no_user_found" });
      }
      // trial_converted só na 1ª cobrança; renovação não é conversão
      await saveActiveSubscription(userId, event === "purchase_approved");
      // UTMify: só a 1ª compra (renovação não é venda nova no relatório)
      if (event === "purchase_approved") await sendToUtmify(userId, "paid");
      logStep("Subscription activated", { userId, event, billingPeriod });
    } else if (event === "subscription_canceled") {
      const userId = await resolveUserId();
      await updateStatus(userId, "canceled");
      logStep("Marked as canceled", { userId, subscriptionId });
    } else if (event === "refund" || event === "chargeback") {
      const userId = await resolveUserId();
      await updateStatus(userId, "canceled");
      if (userId) await sendToUtmify(userId, event === "chargeback" ? "chargedback" : "refunded");
      logStep("Access revoked", { event, userId, subscriptionId });
    } else {
      // pix_gerado, boleto_gerado, purchase_refused, checkout_abandonment…
      logStep("Unhandled event type", { event });
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
