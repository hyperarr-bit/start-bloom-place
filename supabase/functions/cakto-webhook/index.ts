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

// E-mail de boas-vindas (15/07): motivo real de reembolso é "paguei e não
// consegui entrar". O e-mail mostra O e-mail da conta + relembra a senha do
// cadastro e aponta pra /bem-vindo, que repete a instrução na tela.
const APP_URL = "https://www.coreaplicativo.com.br";

const welcomeHtml = (firstName: string | null, email: string, acessarUrl: string, resetUrl: string) => `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f5f2ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Seu acesso ao CORE está liberado — veja como entrar.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#211d18;padding:22px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.02em;">CORE</span>
      </td></tr>
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 6px;font-size:24px;line-height:1.2;color:#211d18;">Pagamento confirmado ✅</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#5c5245;">
          ${firstName ? `${firstName}, seu` : "Seu"} acesso vitalício ao CORE tá liberado. Falta só entrar:
        </p>
      </td></tr>
      <tr><td style="padding:18px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;border-radius:12px;">
          <tr><td style="padding:16px 18px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5c5245;">Como entrar</p>
            <p style="margin:0 0 8px;font-size:14.5px;line-height:1.6;color:#211d18;">
              <strong>1.</strong> Toque no botão verde abaixo.<br>
              <strong>2.</strong> Entre com este e-mail:<br>
              <span style="display:inline-block;margin:6px 0;padding:8px 12px;background:#ffffff;border-radius:8px;font-size:15px;font-weight:700;color:#211d18;">${email}</span><br>
              <strong>3.</strong> Use a <strong>mesma senha que você criou no cadastro</strong>.
            </p>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#5c5245;">
              Criou a conta com o Google? Então é só tocar em <strong>“Continuar com Google”</strong> — sem senha.
            </p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 8px;">
        <a href="${acessarUrl}" style="display:block;background:#1f9d55;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 24px;border-radius:999px;">Acessar o CORE agora →</a>
      </td></tr>
      <tr><td align="center" style="padding:6px 28px 24px;">
        <p style="margin:0;font-size:13px;color:#5c5245;">Esqueceu a senha? <a href="${resetUrl}" style="color:#1f9d55;font-weight:700;">Redefina em 30 segundos</a></p>
      </td></tr>
      <tr><td style="padding:18px 28px 26px;border-top:1px solid #eee7da;">
        <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8a8073;">
          Qualquer dificuldade pra entrar, responde este e-mail que a gente resolve com você — seu acesso é garantido.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

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
      // 15/07: amount_cents = valor REAL pago (fonte da receita no admin; o
      // preço do downsell mudou de 14,90→19,90 e chumbado em SQL quebraria o
      // histórico).
      const paidAmount = Number(data.amount ?? 0);
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
        ...(paidAmount > 0 ? { amount_cents: Math.round(paidAmount * 100) } : {}),
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
        // UTM: metadata do pedido > eventos do usuário > eventos ANÔNIMOS das
        // sessões dele (o clique no anúncio acontece antes do cadastro — caso
        // alinecsouza06/elianefcamargo 14/07). Campanha ganha de source-só.
        const meta = (data.metadata || {}) as Record<string, string>;
        const pick = (d: Record<string, string>) => ({
          utm_source: d.utm_source || null,
          utm_medium: d.utm_medium || null,
          utm_campaign: d.utm_campaign || null,
          utm_content: d.utm_content || null,
          utm_term: d.utm_term || null,
        });
        let utm = pick(meta);
        if (!utm.utm_campaign) {
          const { data: rows } = await supabaseClient
            .from("analytics_events")
            .select("event_data, session_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(60);
          const mine = (rows ?? []) as Array<{ event_data: Record<string, string>; session_id: string | null }>;
          let hit = mine.find((r) => r.event_data?.utm_campaign) ?? mine.find((r) => r.event_data?.utm_source);
          if (!hit?.event_data?.utm_campaign) {
            // varre as sessões dele por eventos anônimos com campanha
            const sessions = [...new Set(mine.map((r) => r.session_id).filter(Boolean))].slice(0, 5) as string[];
            for (const sid of sessions) {
              const { data: anon } = await supabaseClient
                .from("analytics_events")
                .select("event_data")
                .eq("session_id", sid)
                .is("user_id", null)
                .limit(30);
              const anonHit = (anon ?? []).find(
                (r: { event_data: Record<string, string> }) => r.event_data?.utm_campaign,
              );
              if (anonHit) { hit = anonHit as typeof hit; break; }
            }
          }
          if (hit) utm = pick(hit.event_data);
        }

        // Valor: data.amount é a fonte (27.9 lifetime | 19.9 downsell desde
        // 15/07); sem ele, deduz pelo offer id do downsell.
        const amountNum = Number(data.amount ?? offer.price ?? 0);
        const isDownsell = offerId === DOWNSELL_OFFER.toLowerCase();
        const priceInCents = amountNum > 0
          ? Math.round(amountNum * 100)
          : (isDownsell ? 1990 : 2790);

        const nowStamp = utcStamp(new Date());
        const productName = billingPeriod === "lifetime"
          ? (isDownsell || priceInCents < 2790 ? "CORE Vitalício (oferta)" : "CORE Vitalício")
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

    // Boas-vindas via Resend na 1ª compra. Não-bloqueante: falha só loga —
    // nunca derruba o webhook. A idempotência lá de cima garante 1 envio por
    // compra (evento duplicado retorna antes de chegar aqui).
    async function sendWelcomeEmail(userId: string) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) { logStep("Welcome email skipped: no RESEND_API_KEY"); return; }
      try {
        let email = customerEmail;
        if (!email) {
          const { data: u } = await supabaseClient.auth.admin.getUserById(userId);
          email = u?.user?.email ?? null;
        }
        if (!email) { logStep("Welcome email skipped: no email", { userId }); return; }

        const firstName = String(customer.name ?? "").trim().split(/\s+/)[0] || null;
        const from = Deno.env.get("WELCOME_EMAIL_FROM")
          || Deno.env.get("RECOVERY_EMAIL_FROM")
          || "CORE <onboarding@resend.dev>";
        const acessarUrl = `${APP_URL}/bem-vindo?e=${encodeURIComponent(email)}`;
        const resetUrl = `${APP_URL}/reset-password`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [email],
            subject: "Pagamento confirmado ✅ Seu acesso ao CORE tá liberado",
            html: welcomeHtml(firstName, email, acessarUrl, resetUrl),
          }),
        });
        if (!res.ok) {
          const bodyTxt = await res.text().catch(() => "");
          throw new Error(`Resend ${res.status}: ${bodyTxt.slice(0, 200)}`);
        }

        await supabaseClient.from("analytics_events").insert({
          user_id: userId,
          event_name: "welcome_email_sent",
          event_data: { gateway: "cakto", billing_period: billingPeriod, payment_method: paymentMethod },
        });
        logStep("Welcome email sent", { userId });
      } catch (e) {
        logStep("Welcome email failed", { message: (e as Error).message });
      }
    }

    // Meta CAPI (25/07): FALTAVA na Cakto — as vendas iam só pra UTMify e a
    // Meta ficava CEGA (otimizava sem ver Purchase + ROAS do gerenciador
    // subestimado; sintoma: "só chega na UTM"). Espelha a sendMetaCapi da
    // abacate-webhook. event_id = order_id do pix_order_created (o MESMO id
    // que o pixel do navegador usa como eventID) → a Meta deduplica quem
    // voltou pra tela de confirmação. Dormente sem META_PIXEL_ID/TOKEN.
    async function sendMetaCapi(userId: string) {
      const pixelId = Deno.env.get("META_PIXEL_ID");
      const token = Deno.env.get("META_CAPI_TOKEN");
      if (!pixelId || !token) { logStep("Meta CAPI skipped: no secrets"); return; }
      try {
        const sha = async (v: string) => {
          const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
          return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
        };
        const { data: evs } = await supabaseClient.from("analytics_events")
          .select("event_data, created_at, event_name").eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(80);
        const rows = (evs ?? []) as Array<{ event_data: Record<string, string>; created_at: string; event_name: string }>;
        const ordem = rows.find((r) => r.event_name === "pix_order_created" && r.event_data?.gateway === "cakto");
        const eventId = String(ordem?.event_data?.order_id ?? purchaseId ?? `${userId}-${Date.now()}`);
        const offerKind = String(ordem?.event_data?.offer ?? (offerId === DOWNSELL_OFFER.toLowerCase() ? "downsell" : "lifetime"));
        const amountCents = Number(ordem?.event_data?.amount_cents) || Math.round(Number(data.amount ?? 0) * 100) || (offerKind === "downsell" ? 1490 : 2790);
        const fbHit = rows.find((r) => r.event_data?.fbclid);
        const fbc = fbHit ? `fb.1.${new Date(fbHit.created_at).getTime()}.${fbHit.event_data.fbclid}` : null;
        const payload = {
          data: [{
            event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: eventId,
            action_source: "website", event_source_url: APP_URL,
            user_data: { ...(customerEmail ? { em: [await sha(customerEmail)] } : {}), external_id: [await sha(userId)], ...(fbc ? { fbc } : {}) },
            custom_data: { value: amountCents / 100, currency: "BRL", content_name: offerKind === "downsell" ? "CORE Vitalício (oferta)" : "CORE Vitalício" },
          }],
        };
        const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => ({}));
        logStep(res.ok ? "Meta CAPI sent" : "Meta CAPI error", { status: res.status, eventId, body: JSON.stringify(out).slice(0, 160) });
      } catch (e) { logStep("Meta CAPI failed", { message: String(e).slice(0, 150) }); }
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
      // UTMify + Meta CAPI + boas-vindas: só a 1ª compra (renovação não é venda nova)
      if (event === "purchase_approved") {
        await sendToUtmify(userId, "paid");
        await sendMetaCapi(userId);
        await sendWelcomeEmail(userId);
      }
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
