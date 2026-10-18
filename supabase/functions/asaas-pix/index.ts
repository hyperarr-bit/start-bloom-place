import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { assuntoParceiro, assuntoVenda, ehOfertaHoje, htmlParceiro, htmlVenda, nomeDoProduto, periodoDoEmailVenda, planoUtmify } from "../_shared/email-venda.ts";
import { creditarPedido } from "../_shared/grant-pix.ts";
import { valorCobre } from "../_shared/trava-grant.ts";
import { reservarBoasVindas, soltarBoasVindas } from "../_shared/boas-vindas-hoje.ts";
import { CONCESSAO_HOJE, DESCRICAO_HOJE, PRECOS_HOJE, chaveCapiCasal, chaveParceiro, ehOfertaCasal, ehUpsellHoje } from "../_shared/ofertas-hoje.ts";
import { COLUNAS_DECISAO, linhasProprias, type LinhaAssinatura } from "../_shared/linha-pix.ts";

/**
 * Pix in-app via ASAAS (21/07) — gateway principal, substitui a Pagar.me.
 *
 * DECISÃO DE ROTA (testada ao vivo na API deles, não é leitura de doc):
 * o Pix "dinâmico" do Asaas (/v3/customers → /v3/payments → /pixQrCode) EXIGE
 * CPF — a cobrança devolve "Para criar esta cobrança é necessário preencher o
 * CPF ou CNPJ do cliente". Isso ressuscitaria o formulário que custava ~47%
 * de quem abre o checkout (medição 19/07).
 * Por isso usamos QR CODE ESTÁTICO (/v3/pix/qrCodes/static): é o ÚNICO
 * caminho 100% sem CPF, e ainda por cima aceita expiração em SEGUNDOS
 * (expirationSeconds: 1800 = 30 min exatos, coisa que o dinâmico não faz).
 *
 * Contrato de request/response IDÊNTICO ao abacate-pix/pagarme-pix — o
 * PixCheckout só troca o nome da função.
 *
 * RECONCILIAÇÃO (o ponto delicado do QR estático): não existe customer nosso
 * na cobrança. Quando o Pix cai, o Asaas cria payment+customer sozinho e
 * carimba `pixQrCodeId` nele. Então o elo compra↔conta é o ID do QR, que
 * gravamos em pix_order_created no create. O webhook e o check resolvem por
 * ele. (A doc NÃO garante que externalReference do QR se propague pro
 * payment — por isso não dependemos disso.)
 *
 * Pré-requisito de conta: precisa existir uma CHAVE PIX na conta Asaas. A
 * função busca a chave na API e cacheia; sem chave, devolve 503 explicando.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_API = "https://api.asaas.com/v3";
/* 01/09: entra o w97 — o funil W da web sobe pra R$ 97,90. Motivo medido na
 * 1ª noite: o Pix fechou 33% dos QRs maduros contra 13% da folha do Google,
 * então o preço aguenta mais. O mapa é a ÚNICA fonte do valor: oferta sem
 * preço aqui devolve 503 em vez de cobrar errado. */
/* 03/09 — entra a `w25`: 1 MÊS por R$ 24,90 na web, ao lado do vitalício.
 * Por que existe: o app mede que a 2ª coluna dobra a receita por paywall
 * visto (R$ 3,68 com uma coluna × R$ 7,35 com duas, vitalício em foco) e
 * leva a conversão de quem vê o paywall de 4,7% pra 12% — o mensal traz
 * gente que não compraria, não rouba do vitalício. Na web o Pix não tem
 * débito automático, então isto é PRÉ-PAGO: 30 dias, não renova sozinho, e
 * a tela tem que dizer isso. */
// 06/09: `w47` = vitalício da web a R$ 47,90 (ordem do dono). Chave nova, w97 fica pra QR antigo.
// 15/10: `a97` = o ANUAL da venda da web (/assinar): R$ 97,90, 365 dias (não vitalício). Mesma linha nas 3 funções.
// 16/10: `a69` = o PRESENTE do funil do app na web (/assinatura): o mesmo anual por R$ 69,90, 365 dias. Mesma linha nas 3.
// 18/10: as ofertas do funil web novo (/hoje: h279, h149, h279k, h149k, hv47, hv27, hc199) vêm de _shared/ofertas-hoje.ts —
// a MESMA fonte nas 3 funções. Pix gerado SEM e-mail (sessão anônima); o e-mail vem depois de pagar.
const PRECOS_CENTAVOS: Record<string, number> = { lifetime: 9790, downsell: 1490, w97: 9790, w25: 2490, w47: 4790, w27: 2790, a97: 9790, a69: 6990, ...PRECOS_HOJE };
/* O que cada oferta CONCEDE (04/09). A primeira venda da w25 (07:42) recebeu
 * VITALÍCIO por este caminho: a página faz `check` enquanto o QR está aberto,
 * o check liberava com plan "lifetime" chumbado, e o webhook — que já sabia
 * dar 30 dias — chegou depois, viu vitalício e preservou. Agora os dois usam
 * a mesma tabela. `dias: null` = vitalício. */
const CONCESSAO: Record<string, { plano: string; periodo: string; dias: number | null; linhaNova?: boolean }> = {
  lifetime: { plano: "lifetime", periodo: "lifetime", dias: null },
  downsell: { plano: "lifetime", periodo: "lifetime", dias: null },
  w97: { plano: "lifetime", periodo: "lifetime", dias: null },
  w25: { plano: "web", periodo: "monthly_prepaid", dias: 30 },
  w47: { plano: "lifetime", periodo: "lifetime", dias: null },
  w27: { plano: "lifetime", periodo: "lifetime", dias: null }, // 07/09: vitalício web 27,90
  a97: { plano: "core-pro", periodo: "annual", dias: 365 }, // 15/10: anual da venda da web (/assinar)
  a69: { plano: "core-pro", periodo: "annual", dias: 365 }, // 16/10: presente anual 69,90 do funil do app na web (/assinatura)
  ...CONCESSAO_HOJE, // 18/10: o /hoje (o hc199 fica de fora: quem ganha é a outra conta, pela ação `parceiro`)
};
const DESCRICAO_PIX: Record<string, string> = {
  lifetime: "CORE vitalicio", downsell: "CORE vitalicio (oferta)", w97: "CORE vitalicio", w25: "CORE 1 mes", w47: "CORE vitalicio", w27: "CORE vitalicio", a97: "CORE anual", a69: "CORE anual", ...DESCRICAO_HOJE,
};
const EXPIRA_SEGUNDOS = 1800; // 30 min — mesmo prazo dos outros gateways

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ASAAS-PIX] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

/** Headers do Asaas: access_token próprio (NÃO é Bearer) + User-Agent
 *  obrigatório pra contas criadas depois de 13/06/2024. */
const asaasHeaders = (key: string) => ({
  access_token: key,
  "User-Agent": "CORE/1.0 (Supabase Edge)",
  "Content-Type": "application/json",
});

/** A chave Pix da conta (necessária pro QR estático). Cacheada no módulo —
 *  a instância da edge function vive entre invocações. */
let chavePixCache: string | null = null;
async function obterChavePix(key: string): Promise<string | null> {
  if (chavePixCache) return chavePixCache;
  const envKey = Deno.env.get("ASAAS_PIX_KEY");
  if (envKey) { chavePixCache = envKey; return envKey; }
  try {
    const res = await fetch(`${ASAAS_API}/pix/addressKeys`, { headers: asaasHeaders(key) });
    const out = await res.json().catch(() => ({}));
    const ativa = (out?.data ?? []).find((k: { status?: string }) => k.status === "ACTIVE") ?? (out?.data ?? [])[0];
    if (ativa?.key) { chavePixCache = ativa.key as string; return chavePixCache; }
  } catch (e) {
    logStep("Falha buscando chave Pix", { message: String(e).slice(0, 120) });
  }
  return null;
}

/** "2026-07-21 16:30:00" (horário de Brasília) → ISO com offset, que é o que
 *  o countdown do client entende. Sem isso o QR nasce "já expirado" no fuso. */
const paraIso = (dataAsaas?: string | null): string | null => {
  if (!dataAsaas) return null;
  const t = String(dataAsaas).trim().replace(" ", "T");
  return /Z|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}-03:00`;
};

/** UTMify — espelho do abacate-pix, só muda platform. */
async function sendToUtmify(
  admin: ReturnType<typeof createClient>,
  args: { userId: string; email: string | null; orderId: string; offer: string; amountCents: number; name: string | null },
) {
  const token = Deno.env.get("UTMIFY_API_TOKEN");
  if (!token) { logStep("UTMify skipped: no token"); return; }
  try {
    const pick = (d: Record<string, string>) => ({
      utm_source: d.utm_source || null, utm_medium: d.utm_medium || null,
      utm_campaign: d.utm_campaign || null, utm_content: d.utm_content || null, utm_term: d.utm_term || null,
    });
    let utm = pick({});
    const { data: rows } = await admin.from("analytics_events")
      .select("event_data, session_id").eq("user_id", args.userId)
      .order("created_at", { ascending: false }).limit(60);
    const mine = (rows ?? []) as Array<{ event_data: Record<string, string>; session_id: string | null }>;
    let hit = mine.find((r) => r.event_data?.utm_campaign) ?? mine.find((r) => r.event_data?.utm_source);
    if (!hit?.event_data?.utm_campaign) {
      const sessions = [...new Set(mine.map((r) => r.session_id).filter(Boolean))].slice(0, 5) as string[];
      for (const sid of sessions) {
        const { data: anon } = await admin.from("analytics_events")
          .select("event_data").eq("session_id", sid).is("user_id", null).limit(30);
        const anonHit = (anon ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.utm_campaign);
        if (anonHit) { hit = anonHit as typeof hit; break; }
      }
    }
    if (hit) utm = pick(hit.event_data);
    const nowStamp = utcStamp(new Date());
    const isDownsell = args.offer === "downsell";
    const payload = {
      orderId: args.orderId, platform: "Asaas", paymentMethod: "pix", status: "paid",
      createdAt: nowStamp, approvedDate: nowStamp, refundedAt: null,
      customer: { name: args.name || args.email?.split("@")[0] || "Cliente", email: args.email || "", phone: null, document: null, country: "BR" },
      products: [{ id: args.offer, name: nomeDoProduto({ offer: args.offer, downsell: isDownsell }), planId: null, planName: planoUtmify(args.offer), quantity: 1, priceInCents: args.amountCents }],
      trackingParameters: { src: null, sck: null, ...utm },
      commission: { totalPriceInCents: args.amountCents, gatewayFeeInCents: 0, userCommissionInCents: args.amountCents },
      isTest: false,
    };
    const res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-token": token }, body: JSON.stringify(payload),
    });
    logStep(res.ok ? "UTMify order sent" : "UTMify error", { orderId: args.orderId, status: res.status });
  } catch (e) {
    logStep("UTMify send failed", { message: (e as Error).message });
  }
}

/** Meta CAPI — event_id = orderId (mesmo id do pixel do navegador ⇒ dedup). */
async function sendMetaCapi(
  admin: ReturnType<typeof createClient>,
  args: {
    userId: string; email: string | null; orderId: string; offer: string;
    amountCents: number; req: Request; fbp?: string | null; fbc?: string | null; sourceUrl?: string | null;
  },
) {
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!pixelId || !token) return;
  try {
    const sha = async (v: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    let fbc = args.fbc ?? null;
    if (!fbc) {
      const { data: rows } = await admin.from("analytics_events")
        .select("event_data, created_at").eq("user_id", args.userId)
        .order("created_at", { ascending: false }).limit(60);
      const hit = (rows ?? []).find((r: { event_data: Record<string, string> }) => r.event_data?.fbclid);
      if (hit) fbc = `fb.1.${new Date((hit as { created_at: string }).created_at).getTime()}.${(hit as { event_data: Record<string, string> }).event_data.fbclid}`;
    }
    const ip = (args.req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const ua = args.req.headers.get("user-agent") || null;
    const payload = {
      data: [{
        event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: args.orderId,
        action_source: "website", event_source_url: args.sourceUrl || "https://www.coreaplicativo.com.br",
        user_data: {
          ...(args.email ? { em: [await sha(args.email)] } : {}),
          external_id: [await sha(args.userId)],
          ...(ip ? { client_ip_address: ip } : {}),
          ...(ua ? { client_user_agent: ua } : {}),
          ...(fbc ? { fbc } : {}),
          ...(args.fbp ? { fbp: args.fbp } : {}),
        },
        custom_data: { value: args.amountCents / 100, currency: "BRL", content_name: nomeDoProduto({ offer: args.offer, downsell: args.offer === "downsell" }) },
      }],
    };
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    logStep(res.ok ? "Meta CAPI sent" : "Meta CAPI error", { status: res.status, body: JSON.stringify(out).slice(0, 200) });
  } catch (e) {
    logStep("Meta CAPI failed (non-blocking)", { message: String(e).slice(0, 150) });
  }
}

const welcomeHtml = (firstName: string | null, email: string) => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#211d18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;">
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 12px;font-size:22px;">Bem-vindo ao CORE${firstName ? `, ${firstName}` : ""} 🎉</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Seu acesso vitalício está <b>ativo</b>. Pra entrar, use exatamente:</p>
      <table role="presentation" width="100%" style="background:#f5f2ec;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;">
        <b>E-mail:</b> <span style="display:inline-block;margin:4px 0;padding:6px 10px;background:#fff;border-radius:8px;font-weight:700;">${email}</span><br>
        <b>Senha:</b> a mesma que você criou no cadastro.
      </td></tr></table>
      <a href="https://www.coreaplicativo.com.br/bem-vindo?e=${encodeURIComponent(email)}" style="display:block;margin-top:18px;background:#1f9d55;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 24px;border-radius:999px;text-align:center;">Acessar o CORE agora →</a>
      <p style="font-size:14px;line-height:1.6;margin:18px 0 8px;"><b>O CORE é app de celular também.</b> Baixa na loja e entra com o mesmo e-mail e senha — sua compra já está lá, sem pagar de novo:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;"><tr>
        <td style="padding:0 8px 0 0;"><a href="https://apps.apple.com/br/app/id6806913181" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#63743; App Store</a></td>
        <td><a href="https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_source%3Dweb%26utm_medium%3Demail%26utm_campaign%3Dweb_email" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#9654; Google Play</a></td>
      </tr></table>
      <table role="presentation" width="100%" style="margin:14px 0 6px;background:#fdf2f8;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;color:#211d18;">
      <b style="font-size:14px;">Como entrar no app (1 minuto)</b><br>
      <b>1.</b> Baixe o CORE na App Store ou no Google Play.<br>
      <b>2.</b> Abra e toque em <b>&ldquo;Já tenho conta? Entrar&rdquo;</b> &mdash; <u>não</u> em &ldquo;Começar&rdquo; (ele cria uma conta nova, sem a sua compra).<br>
      <b>3.</b> Entre com <b>${email}</b> e a sua senha. Não lembra? Toque em &ldquo;Entrar sem senha &mdash; receber código por e-mail&rdquo; ou em &ldquo;Esqueci minha senha&rdquo;.
    </td></tr></table>
    <a href="https://www.coreaplicativo.com.br/como-entrar" style="display:inline-block;margin:2px 0 10px;color:#c2185b;font-size:13px;font-weight:700;text-decoration:underline;">Ver o passo a passo com fotos &rarr;</a>
    <p style="font-size:12px;color:#8a8378;margin:0 0 4px;">No computador, é o mesmo CORE em coreaplicativo.com.br.</p>
      <p style="font-size:12px;color:#8a8378;margin:16px 0 0;">Esqueceu a senha? Use "Esqueci minha senha" na tela de entrada, com esse mesmo e-mail.</p>
    </td></tr>
  </table>
</body></html>`;

/** Cobrança PAGA do QR? Lista os payments carimbados com esse pixQrCodeId.
 *  CONFIRMED e RECEIVED contam como pago: em Pix o normal é ir direto pra
 *  RECEIVED, mas conta em análise antifraude pode segurar em CONFIRMED por
 *  até 72h — e o cliente JÁ pagou. Não deixamos ninguém esperando por isso. */
const PAGOS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
async function buscarPagamento(key: string, qrCodeId: string) {
  const res = await fetch(`${ASAAS_API}/payments?pixQrCodeId=${encodeURIComponent(qrCodeId)}&limit=10`, {
    headers: asaasHeaders(key),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, status: res.status, body: out };
  const pago = (out?.data ?? []).find((p: { status?: string }) => PAGOS.has(String(p?.status)));
  return { ok: true as const, pago: pago ?? null, total: out?.totalCount ?? 0, body: out };
}

/** As linhas da conta (pra saber o acesso FINAL depois dos upsells do /hoje). */
async function linhasDaConta(admin: ReturnType<typeof createClient>, userId: string): Promise<LinhaAssinatura[]> {
  const { data } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", userId);
  return (data ?? []) as LinhaAssinatura[];
}
/** O acesso PRÓPRIO mais longo e vivo da conta (a linha da loja não conta): vitalício ou o fim mais distante. */
function acessoFinal(linhas: LinhaAssinatura[]): { vitalicio: boolean; fim: string } | null {
  const vivas = linhasProprias(linhas).filter((l) => l.status === "active" && l.current_period_end);
  if (!vivas.length) return null;
  const vit = vivas.find((l) => l.billing_period === "lifetime" || l.plan === "lifetime");
  if (vit) return { vitalicio: true, fim: String(vit.current_period_end) };
  const maior = vivas.sort((a, b) => Date.parse(String(b.current_period_end)) - Date.parse(String(a.current_period_end)))[0];
  return { vitalicio: false, fim: String(maior.current_period_end) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const apiKey = Deno.env.get("ASAAS_API_KEY") ?? "";

    if (!apiKey) {
      logStep("Missing ASAAS_API_KEY secret");
      return jsonResponse({ error: "Pagamento indisponível no momento. Tente de novo em instantes." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header missing" }, 401);
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !authData?.user) return jsonResponse({ error: "User not authenticated" }, 401);
    const user = authData.user;

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
    const action = String(body.action ?? "create");

    // -------------------------------------------------------------- CREATE
    if (action === "create") {
      const offer = String(body.offer ?? "lifetime");
      const amount = PRECOS_CENTAVOS[offer];
      if (!amount) return jsonResponse({ error: "Oferta não configurada. Avise o suporte." }, 503);

      const chave = await obterChavePix(apiKey);
      if (!chave) {
        logStep("Conta Asaas SEM chave Pix cadastrada");
        return jsonResponse({
          error: "Pagamento indisponível no momento. Tente de novo em instantes.",
          ...(body.debug === true ? { gw: { motivo: "sem_chave_pix" } } : {}),
        }, 503);
      }

      const res = await fetch(`${ASAAS_API}/pix/qrCodes/static`, {
        method: "POST",
        headers: asaasHeaders(apiKey),
        body: JSON.stringify({
          addressKey: chave,
          description: DESCRICAO_PIX[offer] ?? "CORE vitalicio",
          value: amount / 100, // Asaas trabalha em REAIS, não centavos
          format: "ALL",
          expirationSeconds: EXPIRA_SEGUNDOS,
          allowsMultiplePayments: false, // 1 QR = 1 pagamento = 1 pessoa
          externalReference: `${user.id}:${offer}`,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.payload || !out?.id) {
        logStep("Asaas create error", { status: res.status, body: JSON.stringify(out).slice(0, 600) });
        return jsonResponse({
          error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.",
          ...(body.debug === true ? { gw: { status: res.status, body: JSON.stringify(out).slice(0, 400) } } : {}),
        }, 502);
      }
      logStep("Pix criado", { id: out.id, amount });
      // FONTE DA VERDADE oferta↔cobrança E o ÚNICO elo com a conta (o QR
      // estático não carrega customer nosso): sem este registro o webhook
      // não sabe de quem é o pagamento. fbp/fbc/source_url (22/07): sinal do
      // NAVEGADOR capturado na criação — o webhook usa no CAPI pra quem paga
      // no banco e nunca volta (metade das vendas só tinha e-mail no match).
      const { error: pontErr } = await supabaseAdmin.from("analytics_events").insert({
        event_name: "pix_order_created",
        user_id: user.id,
        event_data: {
          order_id: out.id, offer, amount_cents: amount, gateway: "asaas",
          ...(body.fbp ? { fbp: String(body.fbp).slice(0, 120) } : {}),
          ...(body.fbc ? { fbc: String(body.fbc).slice(0, 400) } : {}),
          ...(body.sourceUrl ? { source_url: String(body.sourceUrl).slice(0, 300) } : {}),
        },
      });
      /* Sem a ponte, o QR vira um buraco: o webhook não sabe de quem é o
       * pagamento (devolve no_user e o dinheiro cai no chão), o pix-reconcile
       * pula (`if (!uid || !oid) continue`) e o polling agora rejeita por
       * MISMATCH. Melhor não vender do que entregar um QR que a pessoa paga e
       * ninguém consegue creditar — o erro aqui vira erro na tela dela. */
      if (pontErr) {
        logStep("Ponte pix_order_created FALHOU — abortando", { id: out.id, message: pontErr.message });
        return jsonResponse({ error: "bridge_failed" }, 503);
      }
      const b64 = typeof out.encodedImage === "string" && out.encodedImage.length
        ? (out.encodedImage.startsWith("data:") ? out.encodedImage : `data:image/png;base64,${out.encodedImage}`)
        : null;
      return jsonResponse({
        orderId: out.id,
        amount: (amount / 100).toFixed(2),
        qrCode: out.payload,
        qrCodeBase64: b64,
        expiresAt: paraIso(out.expirationDate),
      });
    }

    // --------------------------------------------------------------- CHECK
    if (action === "check") {
      const id = String(body.id ?? "");
      if (!id) return jsonResponse({ error: "id_required" }, 400);
      const r = await buscarPagamento(apiKey, id);
      if (body.probeOnly === true) {
        return jsonResponse({ probe: true, ok: r.ok, gw: JSON.stringify(r.body).slice(0, 800) });
      }
      if (!r.ok) {
        logStep("Asaas check error", { status: r.status, body: JSON.stringify(r.body).slice(0, 300) });
        return jsonResponse({ paid: false, status: "ERROR" });
      }
      if (!r.pago) return jsonResponse({ paid: false, status: "PENDING" });

      // PAGO → resolve o dono pelo registro do create (o QR estático não
      // carrega o nosso usuário; o elo é o id do QR).
      let offer = "";
      let donoId: string | null = null;
      const { data: reg } = await supabaseAdmin.from("analytics_events")
        .select("user_id, event_data").eq("event_name", "pix_order_created")
        .contains("event_data", { order_id: id }).limit(1);
      if (reg?.[0]) {
        donoId = reg[0].user_id as string;
        const o = (reg[0].event_data as Record<string, string>)?.offer;
        // Por PRESENÇA no mapa, nunca por lista escrita à mão: a versão antiga
        // era `o === "downsell" || o === "lifetime"`, então a oferta w97 (97,90)
        // não era reconhecida, caía no fallback abaixo e virava "lifetime" —
        // gravando 2790 numa venda de 9790 e mandando R$27,90 pro CAPI da Meta.
        // O webhook irmão já usa esta forma; esta função tinha ficado pra trás.
        if (o && o in PRECOS_CENTAVOS) offer = o;
      }
      /* Trava de segurança: só libera para o DONO do pedido.
       *
       * `donoId` nulo agora REJEITA (antes, caía no `if (donoId && …)` e liberava
       * para quem perguntasse). Um QR pago sem registro-ponte não deveria existir
       * — o create abaixo falha em vez de devolver QR sem ponte —, mas os ids do
       * Asaas são quase sequenciais, então um pedido órfão viraria vitalício de
       * graça para quem enumerasse. Sem ponte, quem credita é o pix-reconcile. */
      if (!donoId || donoId !== user.id) {
        logStep("QR/user mismatch", { id, dono: donoId ? donoId.slice(0, 8) : "(sem registro)" });
        return jsonResponse({ paid: false, status: "MISMATCH" });
      }
      if (!offer) {
        // 16/10: oferta desconhecida NUNCA vira vitalício — sem a oferta na tabela, não libera (o reconcile é a rede)
        const declarado = String(body.offer ?? "");
        logStep("Offer via client fallback", { id, declarado });
        if (!(declarado in PRECOS_CENTAVOS)) return jsonResponse({ paid: false, status: "OFERTA_DESCONHECIDA" });
        offer = declarado;
      }
      /* 15/10: o pagamento tem que cobrir o preço da oferta DELE (cada oferta com o seu valor). */
      if (!valorCobre((r.pago as { value?: unknown }).value, PRECOS_CENTAVOS[offer])) {
        logStep("Valor pago menor que a oferta — não libera", { id, offer, valor: (r.pago as { value?: unknown }).value ?? null });
        return jsonResponse({ paid: false, status: "VALOR_MENOR" });
      }

      const now = new Date();
      /* 01/10: TODAS as linhas da pessoa, e a decisão em `decidirGrantPix`
       * (_shared/linha-pix.ts). Antes era maybeSingle + update na linha que
       * houvesse — e pra quem tinha a linha da App Store em carência o update
       * virava ESSA linha em pix/vitalício; o RevenueCat depois a devolvia pra
       * anual pela chave revenuecat_subscription_id e, no fim da carência, quem
       * pagou 97,90 no Pix ficava sem acesso. A linha da loja agora nunca é
       * tocada: o Pix escreve na própria ou insere uma nova. */
      /* 15/10: a decisão + a trava de "1 pedido = 1 crédito" moram em _shared/grant-pix.ts (os 3 caminhos da Asaas
       * — este check, o asaas-webhook e o pix-reconcile — passam por lá). */
      /* 18/10 (/hoje, "vida a dois"): o hc199 não credita quem pagou — a página pede o e-mail da(o) parceira(o) e chama
       * `parceiro`. Aqui só confirma o pagamento e manda o Purchase (1x por pedido, a trava é própria). */
      if (ehOfertaCasal(offer)) {
        const { error: travaCapi } = await supabaseAdmin.from("webhook_events").insert({ id: chaveCapiCasal(id), source: "hoje", event: "casal_capi" });
        if (!travaCapi) {
          await sendToUtmify(supabaseAdmin, { userId: user.id, email: user.email ?? null, orderId: id, offer, amountCents: PRECOS_CENTAVOS[offer], name: null });
          await sendMetaCapi(supabaseAdmin, {
            userId: user.id, email: user.email ?? null, orderId: id, offer, amountCents: PRECOS_CENTAVOS[offer], req,
            fbp: (body.fbp as string | undefined) ?? null, fbc: (body.fbc as string | undefined) ?? null, sourceUrl: (body.sourceUrl as string | undefined) ?? null,
          });
        }
        logStep("Casal pago — esperando o e-mail da(o) parceira(o)", { id });
        return jsonResponse({ paid: true, status: "PAID", casal: true });
      }
      const concessao = CONCESSAO[offer];
      if (!concessao) {
        logStep("Oferta sem concessão — não libera", { id, offer });
        return jsonResponse({ paid: false, status: "OFERTA_DESCONHECIDA" });
      }
      const vitalicio = concessao.dias === null;
      const g = await creditarPedido(supabaseAdmin, {
        userId: user.id, orderId: id, gateway: "asaas", concessao, agora: now, linhaNova: concessao.linhaNova === true,
        montarPayload: (fim) => ({
          user_id: user.id, status: "active",
          plan: vitalicio ? "lifetime" : concessao.plano,
          billing_period: vitalicio ? "lifetime" : concessao.periodo,
          payment_method: "pix", abacatepay_billing_id: id, customer_email: user.email ?? null,
          current_period_start: now.toISOString(), current_period_end: fim,
          amount_cents: PRECOS_CENTAVOS[offer],
        }),
      });
      if (g.r === "preservado") {
        // vitalício pagou o mês: a linha não se toca (sobrescrever gravaria 2490 numa
        // venda de 97,90 e o acesso venceria em 30 dias). Caso de reembolso.
        logStep("Vitalício pagou o mês — linha preservada", { userId: user.id, offer, id });
        return jsonResponse({ paid: true, status: "CONFIRMED", jaVitalicio: true });
      }
      if (g.r === "ja_creditado") {
        // o webhook (ou um check anterior) já creditou ESTE pedido: não escreve, não manda nada
        logStep("Pedido já creditado — nada a fazer", { userId: user.id, offer, id });
        return jsonResponse({ paid: true, status: "PAID", jaCreditado: true });
      }
      if (g.r === "em_andamento") {
        logStep("Pedido sendo creditado por outro caminho — tenta de novo", { userId: user.id, offer, id });
        return jsonResponse({ paid: false, status: "PENDING" });
      }
      if (g.r === "erro") {
        // pagou e não gravou: o polling tenta de novo em 3 s e o pix-reconcile é a rede
        logStep("Grant FALHOU", { userId: user.id, offer, id, message: g.msg });
        return jsonResponse({ paid: false, status: "GRANT_ERROR" });
      }
      const jaLiberado = g.jaLiberado;
      logStep("Access granted", { userId: user.id, offer, id, ate: g.fim, jaLiberado, acao: g.acao });

      if (!jaLiberado) {
        const { data: p } = await supabaseAdmin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        const displayName = (p?.display_name as string | undefined) ?? null;
        await sendToUtmify(supabaseAdmin, {
          userId: user.id, email: user.email ?? null, orderId: id, offer,
          amountCents: PRECOS_CENTAVOS[offer], name: displayName,
        });
        await sendMetaCapi(supabaseAdmin, {
          userId: user.id, email: user.email ?? null, orderId: id, offer,
          amountCents: PRECOS_CENTAVOS[offer], req,
          fbp: (body.fbp as string | undefined) ?? null,
          fbc: (body.fbc as string | undefined) ?? null,
          sourceUrl: (body.sourceUrl as string | undefined) ?? null,
        });
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
          const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
          /* 18/10 (/hoje): a conta quase sempre ainda não tem e-mail aqui (Pix anônimo) — quem manda é a ação
           * `boas_vindas`, depois que a pessoa salva o e-mail. Com e-mail já na conta, manda agora, com a reserva única. */
          if (ehOfertaHoje(offer)) {
            if (resendKey && user.email && await reservarBoasVindas(supabaseAdmin, id)) {
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from, to: [user.email], subject: assuntoVenda(periodoDoEmailVenda(offer)!), html: htmlVenda({ email: user.email, nome: displayName, periodo: periodoDoEmailVenda(offer)!, fim: g.fim, hoje: true }) }),
              }).catch(() => null);
              if (!r?.ok) await soltarBoasVindas(supabaseAdmin, id);
            }
          } else if (ehUpsellHoje(offer)) {
            /* upsell do /hoje: sem e-mail próprio (as boas-vindas do plano já dizem o acesso final) */
          } else if (resendKey && user.email) {
            const firstName = displayName ? displayName.split(" ")[0] : null;
            const periodoVenda = periodoDoEmailVenda(offer);
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              // 15/10: o anual da venda da web (sem senha, 1 ano) tem e-mail próprio; 16/10: o a69 e o mês (w25, 30 dias,
              // sem renovação) também — o antigo dizia "vitalício". O resto segue igual
              body: JSON.stringify(periodoVenda
                ? { from, to: [user.email], subject: assuntoVenda(periodoVenda), html: htmlVenda({ email: user.email, nome: displayName, periodo: periodoVenda, fim: g.fim }) }
                : { from, to: [user.email], subject: vitalicio ? "Seu acesso vitalício ao CORE tá ativo ✅" : "Seu mês de CORE tá ativo ✅", html: welcomeHtml(firstName, user.email) }),
            });
          }
        } catch (e) {
          logStep("Welcome email failed (non-blocking)", { message: String(e).slice(0, 150) });
        }
      }
      return jsonResponse({ paid: true, status: "PAID" });
    }

    // --------------------------------------------------------- BOAS_VINDAS
    /* 18/10 (/hoje): a pessoa pagou SEM e-mail e acabou de salvar o e-mail (ou entrou na conta que já existia, e o
     * pix-vincular trouxe a compra). Manda as boas-vindas UMA vez por pedido e grava o e-mail na linha da assinatura.
     * Só pra pedido do /hoje, só pra linha ATIVA desta conta com esse pedido (a mesma prova do firePixPurchaseOnce). */
    if (action === "boas_vindas") {
      const id = String(body.id ?? "");
      if (!id) return jsonResponse({ error: "id_required" }, 400);
      if (!user.email) return jsonResponse({ ok: false, motivo: "sem_email" });
      const { data: linha } = await supabaseAdmin.from("subscriptions")
        .select("id, status, current_period_end, customer_email")
        .eq("user_id", user.id).eq("abacatepay_billing_id", id).limit(1).maybeSingle();
      if (!linha || linha.status !== "active") return jsonResponse({ ok: false, motivo: "sem_linha" });
      const { data: reg } = await supabaseAdmin.from("analytics_events")
        .select("event_data").eq("event_name", "pix_order_created")
        .contains("event_data", { order_id: id }).limit(1);
      const offer = String((reg?.[0]?.event_data as Record<string, string> | undefined)?.offer ?? "");
      if (!ehOfertaHoje(offer)) return jsonResponse({ ok: false, motivo: "oferta" });
      if (!linha.customer_email) {
        await supabaseAdmin.from("subscriptions").update({ customer_email: user.email }).eq("id", linha.id);
      }
      const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
      if (!resendKey) return jsonResponse({ ok: false, motivo: "sem_resend" });
      if (!(await reservarBoasVindas(supabaseAdmin, id))) return jsonResponse({ ok: true, enviado: false, jaEnviado: true });
      const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
      const { data: p } = await supabaseAdmin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      /* o e-mail diz o acesso FINAL da conta (com o upsell "pra sempre" ou os "+2 anos", não o do plano sozinho) */
      const acesso = acessoFinal(await linhasDaConta(supabaseAdmin, user.id));
      const periodo = acesso?.vitalicio ? "lifetime" : periodoDoEmailVenda(offer)!;
      const fimEmail = acesso?.fim ?? (linha.current_period_end as string | null);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [user.email], subject: assuntoVenda(periodo), html: htmlVenda({ email: user.email, nome: (p?.display_name as string | undefined) ?? null, periodo, fim: fimEmail, hoje: true }) }),
      }).catch(() => null);
      if (!r?.ok) {
        await soltarBoasVindas(supabaseAdmin, id);
        logStep("Boas-vindas do /hoje falhou", { id, status: r?.status ?? null });
        return jsonResponse({ ok: false, motivo: "envio" });
      }
      logStep("Boas-vindas do /hoje enviada", { id });
      return jsonResponse({ ok: true, enviado: true });
    }

    // ------------------------------------------------------------- PARCEIRO
    /* 18/10 (/hoje, "Organize a vida a dois" +R$ 19,90): quem pagou o hc199 manda o e-mail da(o) parceira(o); a conta
     * dela(e) é criada (ou achada, se já existe — nunca 2ª conta) e ganha acesso até o MESMO fim do plano de quem
     * comprou (vitalício se comprou o "pra sempre"). Travas: o pedido é DESTA conta (pix_order_created), está PAGO na
     * Asaas com o valor certo, e libera UMA conta só (webhook_events `hoje-casal:<pedido>`). */
    if (action === "parceiro") {
      const id = String(body.id ?? "");
      const emailParceiro = String(body.email ?? "").trim().toLowerCase();
      if (!id) return jsonResponse({ error: "id_required" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailParceiro)) return jsonResponse({ ok: false, motivo: "email_invalido" });
      if (user.email && user.email.toLowerCase() === emailParceiro) return jsonResponse({ ok: false, motivo: "mesmo_email" });
      const { data: reg } = await supabaseAdmin.from("analytics_events")
        .select("user_id, event_data").eq("event_name", "pix_order_created")
        .contains("event_data", { order_id: id }).limit(1);
      const dono = reg?.[0]?.user_id as string | undefined;
      const offer = String((reg?.[0]?.event_data as Record<string, string> | undefined)?.offer ?? "");
      if (!dono || dono !== user.id || !ehOfertaCasal(offer)) return jsonResponse({ ok: false, motivo: "pedido" });
      const r = await buscarPagamento(apiKey, id);
      if (!r.ok || !r.pago) return jsonResponse({ ok: false, motivo: "nao_pago" });
      if (!valorCobre((r.pago as { value?: unknown }).value, PRECOS_CENTAVOS[offer])) return jsonResponse({ ok: false, motivo: "valor_menor" });
      const acesso = acessoFinal(await linhasDaConta(supabaseAdmin, user.id));
      if (!acesso) return jsonResponse({ ok: false, motivo: "sem_plano" });

      const { error: trava } = await supabaseAdmin.from("webhook_events").insert({ id: chaveParceiro(id), source: "hoje", event: "casal" });
      if (trava) return jsonResponse({ ok: false, motivo: "ja_liberado" });
      const soltar = () => supabaseAdmin.from("webhook_events").delete().eq("id", chaveParceiro(id)).then(() => {}, () => {});

      // a conta da(o) parceira(o): cria já confirmada (entra pelo código do e-mail); se o e-mail já existe, usa ESSA
      let parceiroId: string | null = null;
      const criado = await supabaseAdmin.auth.admin.createUser({ email: emailParceiro, email_confirm: true, user_metadata: { hoje_casal: { de: user.id, pedido: id } } });
      if (criado.data?.user?.id) parceiroId = criado.data.user.id;
      else {
        for (let page = 1; page <= 30 && !parceiroId; page++) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) break;
          const achado = (data?.users ?? []).find((u: { email?: string | null }) => (u.email ?? "").toLowerCase() === emailParceiro);
          if (achado) parceiroId = achado.id;
          if ((data?.users ?? []).length < 1000) break;
        }
      }
      if (!parceiroId) { await soltar(); return jsonResponse({ ok: false, motivo: "conta" }); }
      if (parceiroId === user.id) { await soltar(); return jsonResponse({ ok: false, motivo: "mesmo_email" }); }

      const now = new Date();
      // nunca encurta: se a conta dela(e) já tinha acesso próprio mais longo, fica o mais longo
      const jaTinha = acessoFinal(await linhasDaConta(supabaseAdmin, parceiroId));
      const fimParceiro = new Date(Math.max(Date.parse(acesso.fim), jaTinha ? Date.parse(jaTinha.fim) : 0)).toISOString();
      const g = await creditarPedido(supabaseAdmin, {
        userId: parceiroId, orderId: id, gateway: "asaas-casal", agora: now,
        concessao: { dias: acesso.vitalicio ? null : Math.max(1, Math.ceil((Date.parse(acesso.fim) - now.getTime()) / 86_400_000)) },
        montarPayload: (fim) => ({
          user_id: parceiroId, status: "active",
          plan: acesso.vitalicio ? "lifetime" : "core-pro",
          billing_period: acesso.vitalicio ? "lifetime" : "annual",
          payment_method: "pix", abacatepay_billing_id: id, customer_email: emailParceiro,
          current_period_start: now.toISOString(),
          // o MESMO fim de quem comprou (o fim decidido só vale se a conta dela já tinha prazo maior)
          current_period_end: acesso.vitalicio ? fim : fimParceiro,
          amount_cents: PRECOS_CENTAVOS[offer],
        }),
      });
      if (g.r === "erro" || g.r === "em_andamento") { await soltar(); return jsonResponse({ ok: false, motivo: "grant" }); }
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
        const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: [emailParceiro], subject: assuntoParceiro(), html: htmlParceiro({ email: emailParceiro, fim: acesso.fim, vitalicio: acesso.vitalicio }) }),
          });
        }
      } catch (e) { logStep("E-mail da(o) parceira(o) falhou (não bloqueia)", { message: String(e).slice(0, 120) }); }
      await supabaseAdmin.from("analytics_events").insert({
        user_id: user.id, event_name: "hoje_casal_liberado",
        event_data: { order_id: id, parceiro: parceiroId, nova: !!criado.data?.user?.id, vitalicio: acesso.vitalicio, fim: acesso.fim },
      }).then(() => {}, () => {});
      logStep("Parceira(o) liberada(o)", { id, nova: !!criado.data?.user?.id });
      return jsonResponse({ ok: true, fim: acesso.fim, vitalicio: acesso.vitalicio, contaNova: !!criado.data?.user?.id });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { msg });
    return jsonResponse({ error: msg }, 500);
  }
});
