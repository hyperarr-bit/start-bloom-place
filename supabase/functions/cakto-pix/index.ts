import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/**
 * Pix TRANSPARENTE via API da Cakto (13/07): gera a cobrança e devolve o
 * copia-e-cola + QR pro app renderizar — o comprador nunca sai do CORE.
 *
 * Por quê: dias 12-13 tiveram ~25 cliques no anual e 0 vendas no checkout
 * HOSPEDADO da Cakto (caixa-preta). Aqui a gente vê cada erro no log.
 *
 * Modelo: acesso VITALÍCIO R$27,90 · downsell R$19,90 (pagamento único;
 * o valor cobrado vem da OFERTA na Cakto — 14,90 até 15/07).
 * O preço mora na OFERTA da Cakto (items[0].offerId) — offer IDs e
 * credenciais são secrets, nunca código.
 *
 * Vínculo compra→conta: customer.email = e-mail da CONTA logada (setado
 * aqui, server-side) + metadata.sck = user_id. Zero pagamento órfão.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CAKTO_API = "https://api.cakto.com.br/public_api";

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CAKTO-PIX] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const onlyDigits = (v?: string | null) => (v ?? "").replace(/\D/g, "");

/** Telefone BR em E.164 (5511999999999). Aceita com/sem 55 e com máscara. */
const toE164 = (raw?: string | null): string | null => {
  const d = onlyDigits(raw);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
};

// A API exige phone, mas o dono mandou não pedir do cliente (fricção; mesmo
// padrão do outro SaaS dele). Coringa fixo — testado 13/07, a Cakto aceita.
// O documento que importa (nota) é o CPF.
const DUMMY_PHONE = "5511999999999";

/** Token OAuth da Cakto (JWT ~10h). Cache em memória — instâncias quentes
 *  da edge function reaproveitam; frias pedem outro (barato). */
let tokenCache: { token: string; expiresAt: number } | null = null;
async function getCaktoToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const res = await fetch(`${CAKTO_API}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    logStep("Token error", { status: res.status, body: JSON.stringify(data).slice(0, 300) });
    throw new Error("Falha ao autenticar com o gateway de pagamento");
  }
  // validade conservadora: 8h (doc fala ~10h)
  tokenCache = { token: data.access_token, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const clientId = Deno.env.get("CAKTO_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("CAKTO_CLIENT_SECRET") ?? "";
    const OFFER_IDS: Record<string, string> = {
      lifetime: Deno.env.get("CAKTO_OFFER_LIFETIME") ?? "",
      downsell: Deno.env.get("CAKTO_OFFER_DOWNSELL") ?? "",
      // 31/08: oferta do funil W na web (R$ 97,90, o mesmo preço do app).
      w97: Deno.env.get("CAKTO_OFFER_W97") ?? "",
    };

    if (!clientId || !clientSecret) {
      logStep("Missing CAKTO_CLIENT_ID/SECRET secrets");
      return jsonResponse({ error: "Pagamento indisponível no momento. Tente de novo em instantes." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header missing" }, 401);

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authData?.user?.email) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }
    const user = authData.user;
    logStep("Authenticated", { userId: user.id });

    const RequestSchema = z.object({
      offer: z.enum(["lifetime", "downsell", "w97"]),
      customer: z
        .object({
          name: z.string().max(120).optional(),
          phone: z.string().max(30).optional(),
          docNumber: z.string().max(20).optional(),
        })
        .optional(),
      fingerprint: z.string().max(255).optional(),
      antifraudRef: z.string().max(255).optional(),
      attribution: z
        .object({
          fbclid: z.string().max(500).optional(),
          ttclid: z.string().max(500).optional(),
          gclid: z.string().max(500).optional(),
          utm_source: z.string().max(200).optional(),
          utm_medium: z.string().max(200).optional(),
          utm_campaign: z.string().max(200).optional(),
          utm_content: z.string().max(200).optional(),
        })
        .optional(),
      // Sinais de match da CAPI (10/08) — ver comentário no insert abaixo.
      fbp: z.string().max(200).nullable().optional(),
      fbc: z.string().max(500).nullable().optional(),
      // TikTok (16/08): _ttp é o cookie de navegador deles (par do _fbp).
      ttp: z.string().max(200).nullable().optional(),
      sourceUrl: z.string().max(500).nullable().optional(),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    // WARM-UP (24/07): o create da Cakto leva 5-7s; o front chama {warm:true}
    // na ABERTURA do checkout (enquanto a pessoa digita o CPF) pra aquecer a
    // instância + cachear o token OAuth — o create que ela espera fica só com
    // o POST /payments. Não cria nada, não loga dados.
    if ((rawBody as Record<string, unknown>)?.warm === true) {
      try { await getCaktoToken(clientId, clientSecret); } catch { /* create tenta de novo */ }
      return jsonResponse({ ok: true });
    }
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;

    const offerId = OFFER_IDS[body.offer];
    if (!offerId) {
      logStep("Missing offer id secret", { offer: body.offer });
      return jsonResponse({ error: "Oferta não configurada. Avise o suporte." }, 503);
    }

    // Nome/CPF: body > profiles > fallback. docNumber é OBRIGATÓRIO na API
    // ("docNumber é obrigatório para pagamentos no Brasil" — teste real 13/07;
    // o CPF nem é validado, mas sem ele é 400). Telefone também é obrigatório
    // lá, mas NÃO pedimos do cliente: vai o DUMMY_PHONE (decisão do dono).
    // Erros conhecidos voltam com HTTP 200 + código: o invoke() do supabase-js
    // descarta o body em non-2xx e o front nunca via o motivo.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone, tax_id")
      .eq("id", user.id)
      .maybeSingle();

    const name = (body.customer?.name || profile?.display_name || user.email.split("@")[0]).trim();
    const bodyPhone = toE164(body.customer?.phone);
    const phone = (bodyPhone !== DUMMY_PHONE ? bodyPhone : null) ?? toE164(profile?.phone) ?? DUMMY_PHONE;
    // Form CPF removido (25/07): usa o CPF do body (Pagar.me/legado) ou o
    // tax_id já salvo no perfil; sem nenhum dos dois → "00000000000" =
    // CONSUMIDOR NÃO IDENTIFICADO (a Cakto exige 11 dígitos mas não valida,
    // testado; NÃO fingimos o CPF de uma pessoa real). O zerado nunca é salvo
    // no perfil (o guard abaixo já exige body.customer.docNumber).
    let docNumber = onlyDigits(body.customer?.docNumber) || onlyDigits(profile?.tax_id) || "";
    if (docNumber.length !== 11) docNumber = "00000000000";

    // CPF (e telefone REAL, se algum dia voltar) vão pro profile — próxima
    // compra não pede de novo. O coringa nunca é salvo.
    const profileUpdate: Record<string, string> = {};
    if (phone !== DUMMY_PHONE && phone !== toE164(profile?.phone)) profileUpdate.phone = phone;
    if (body.customer?.docNumber && docNumber !== onlyDigits(profile?.tax_id)) profileUpdate.tax_id = docNumber;
    if (Object.keys(profileUpdate).length) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", user.id);
    }

    const caktoToken = await getCaktoToken(clientId, clientSecret);

    const attribution = body.attribution ?? {};
    const payload = {
      paymentMethod: "pix",
      customer: {
        name,
        email: user.email, // e-mail da CONTA — o vínculo do webhook
        phone,
        // fingerprint é OBRIGATÓRIO (confirmado no teto real 13/07) mas aceita
        // qualquer string não-vazia; antifraudProfilingAttemptReference NÃO
        // existe no contrato público (a doc mentia — 400 se enviado).
        fingerprint: body.fingerprint || crypto.randomUUID(),
        docType: "cpf",
        docNumber,
      },
      items: [{ offerId, quantity: 1, offerType: "main" }],
      metadata: {
        sck: user.id, // rastro extra do vínculo
        ...(attribution.utm_source ? { utm_source: attribution.utm_source } : {}),
        ...(attribution.utm_medium ? { utm_medium: attribution.utm_medium } : {}),
        ...(attribution.utm_campaign ? { utm_campaign: attribution.utm_campaign } : {}),
        ...(attribution.utm_content ? { utm_content: attribution.utm_content } : {}),
        ...(attribution.fbclid ? { fbclid: attribution.fbclid } : {}),
        ...(attribution.ttclid ? { ttclid: attribution.ttclid } : {}),
        ...(attribution.gclid ? { gclid: attribution.gclid } : {}),
      },
    };

    logStep("Creating pix", { offer: body.offer, offerId, hasDoc: !!docNumber });
    const res = await fetch(`${CAKTO_API}/payments/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${caktoToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.pix?.qrCode) {
      // Log completo do erro — a visibilidade que o checkout hospedado nunca deu
      logStep("Cakto payments error", { status: res.status, body: JSON.stringify(data).slice(0, 600) });
      return jsonResponse({
        error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.",
        // diagnóstico opt-in (QA, 17/07 — conta em análise): corpo cru do
        // gateway. Lê do rawBody: o zod STRIPA campos fora do schema.
        ...((rawBody as Record<string, unknown>)?.debug === true
          ? { gw: { status: res.status, body: JSON.stringify(data).slice(0, 400) } }
          : {}),
      }, 502);
    }

    logStep("Pix created", { orderId: data.id, refId: data.refId, amount: data.amount });
    // Registro server-side do create (24/07, padrão dos outros 3 gateways):
    // é o que o pix-reconcile varre — sem ele, cobrança cakto paga com
    // webhook mudo viraria pago-sem-acesso invisível. amount vem em reais.
    /* SINAIS DE MATCH DA META CAPI (10/08). O webhook manda o Purchase server-
     * side, mas só tinha e-mail hasheado pra casar — e a cobertura medida caiu
     * de 100% (05/08) pra 78% (10/08). Como a Meta otimiza (e aplica a trava de
     * ROAS) sobre o que ENXERGA, subcontar vira entrega estrangulada.
     *
     * fbp/fbc vêm do navegador (cookie só existe lá). IP e user-agent só
     * existem AQUI — o webhook é chamado pela Cakto, então lá o IP seria o do
     * servidor deles, não o do comprador. Guardar no create é a única janela.
     *
     * A Meta exige client_ip_address e client_user_agent SEMPRE JUNTOS; um
     * sozinho é descartado. x-forwarded-for pode vir com vários IPs — o
     * primeiro é o do cliente. */
    const ipBruto = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
    const clientIp = ipBruto.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") ?? null;

    await supabaseAdmin.from("analytics_events").insert({
      event_name: "pix_order_created",
      user_id: user.id,
      event_data: {
        order_id: data.id, offer: body.offer, gateway: "cakto",
        amount_cents: Math.round(Number(data.amount ?? 0) * 100) || null,
        ref_id: data.refId ?? null,
        fbp: body.fbp ?? null,
        fbc: body.fbc ?? null,
        ttp: body.ttp ?? null,
        ttclid: attribution.ttclid ?? null,
        client_ip: clientIp,
        user_agent: userAgent ? userAgent.slice(0, 400) : null,
        source_url: body.sourceUrl ?? null,
      },
    });
    return jsonResponse({
      orderId: data.id,
      refId: data.refId,
      amount: data.amount,
      qrCode: data.pix.qrCode,
      qrCodeBase64: data.pix.qrCodeBase64 ?? null,
      expiresAt: data.pix.expiresAt ?? null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
