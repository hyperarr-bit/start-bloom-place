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

const ADMIN_EMAILS = ["jv20101958@gmail.com", "hyperarr@gmail.com"];

/* DISJUNTOR DA CAKTO (25/09, dono: "se a cakto falhar mais de 2 vezes a asaas
 * fica como principal dnv, automático, sem vc nem eu mexer").
 * - Toda falha num create de verdade (recusa, erro, mais de 10 s, prazo de
 *   15 s) vira `cakto_falha` — gravado AQUI, pelo servidor.
 * - 3 falhas em 24 h (contadas a partir de VIRADA_CAKTO) → grava
 *   `cakto_disjuntor_aberto` e manda e-mail pro dono. Daí em diante esta função
 *   responde na hora {error:"cakto_desligada"} e o checkout gera pela Asaas (o
 *   front já cai pra Asaas em qualquer falha da Cakto — ninguém fica sem Pix).
 * - Fica desligada até alguém religar: mover VIRADA_CAKTO pra depois do evento
 *   e redeployar. */
const VIRADA_CAKTO = "2026-09-25T03:25:00Z"; // 00:25 BRT de 25/09 — Cakto em 100% na web (o teste do disjuntor, 00:17, fica antes e não conta)
const FALHAS_PRA_DESLIGAR = 3;
const JANELA_FALHAS_MS = 24 * 60 * 60 * 1000;
const CAKTO_LENTA_MS = 10_000;

// deno-lint-ignore no-explicit-any
type Admin = any;

async function disjuntorAberto(admin: Admin): Promise<boolean> {
  const { data } = await admin.from("analytics_events").select("id")
    .eq("event_name", "cakto_disjuntor_aberto").gte("created_at", VIRADA_CAKTO).limit(1);
  return !!data?.length;
}

async function avisarDono(falhas: number, motivo: string, teste = false): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) return false;
  const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
  const para = (Deno.env.get("SUPORTE_AVISO_PARA") || ADMIN_EMAILS.join(",")).split(",").map((e) => e.trim()).filter(Boolean);
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
  const hora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: para,
      subject: `${teste ? "TESTE — " : ""}[CORE] Cakto desligada sozinha — a Asaas voltou a ser a principal`,
      html:
        `<p>A Cakto falhou <b>${falhas} vezes</b> nas últimas 24 h e o checkout da web voltou pra <b>Asaas</b> sozinho às ${hora} (Brasília).</p>` +
        `<p>Nenhuma venda se perde por isso: quem estava pagando recebeu o Pix pela Asaas na hora.</p>` +
        `<p>Última falha: <code>${esc(motivo.slice(0, 300))}</code></p>` +
        `<p>Pra religar a Cakto é preciso mexer no código (VIRADA_CAKTO na função cakto-pix).</p>` +
        (teste ? `<p><b>Isto é um TESTE do disjuntor</b> — nada foi desligado de verdade.</p>` : ""),
    }),
  });
  logStep("aviso do disjuntor", { ok: r.ok, status: r.status });
  return r.ok;
}

/** Grava a falha e, na 3ª em 24 h, abre o disjuntor (e avisa). Nunca lança. */
async function registrarFalha(admin: Admin, userId: string, motivo: string, ms: number, teste = false): Promise<Record<string, unknown>> {
  try {
    await admin.from("analytics_events").insert({ event_name: "cakto_falha", user_id: userId, event_data: { motivo: motivo.slice(0, 300), ms } });
    const desde = new Date(Math.max(Date.parse(VIRADA_CAKTO), Date.now() - JANELA_FALHAS_MS)).toISOString();
    const { count } = await admin.from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event_name", "cakto_falha").gte("created_at", desde);
    logStep("cakto_falha", { motivo: motivo.slice(0, 120), ms, falhas_24h: count });
    if ((count ?? 0) < FALHAS_PRA_DESLIGAR) return { falhas_24h: count, abriu: false };
    if (await disjuntorAberto(admin)) return { falhas_24h: count, abriu: false, ja_aberto: true }; // outra instância já abriu
    await admin.from("analytics_events").insert({ event_name: "cakto_disjuntor_aberto", user_id: userId, event_data: { falhas: count, ultimo_motivo: motivo.slice(0, 300) } });
    logStep("DISJUNTOR ABERTO — Cakto desligada, Asaas principal", { falhas: count });
    const avisou = await avisarDono(count ?? FALHAS_PRA_DESLIGAR, motivo, teste);
    return { falhas_24h: count, abriu: true, avisou };
  } catch (e) {
    logStep("registrarFalha falhou", { message: e instanceof Error ? e.message : String(e) });
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Roda depois da resposta (a pessoa não espera o registro da falha). */
function emSegundoPlano(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else p.catch(() => {});
}

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
      // 06/09 (ordem do dono, "troca pra cakto a web"): as duas colunas da web
      // — 1 mês pré-pago a 24,90 e vitalício a 47,90. Os IDs das ofertas são
      // criados no painel da Cakto e entram como secret; sem secret a oferta
      // responde "não configurada" em vez de cobrar o valor errado.
      w25: Deno.env.get("CAKTO_OFFER_W25") ?? "",
      w47: Deno.env.get("CAKTO_OFFER_W47") ?? "",
      // 07/09: w27 = a oferta de 27,90 de sempre da Cakto (mesmo ID do "lifetime").
      w27: Deno.env.get("CAKTO_OFFER_LIFETIME") ?? "",
    };

    if (!clientId || !clientSecret) {
      logStep("Missing CAKTO_CLIENT_ID/SECRET secrets");
      return jsonResponse({ error: "Pagamento indisponível no momento. Tente de novo em instantes." }, 503);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    // WARM-UP (24/07): o create da Cakto leva 5-7s; o front chama {warm:true}
    // pra aquecer a instância + cachear o token OAuth — o create que ela espera
    // fica só com o POST /payments. Não cria nada, não loga dados.
    /* 25/09: ANTES da autenticação. O aquecimento sai quando o paywall aparece,
     * e ali o comprador da web ainda não tem sessão (a anônima nasce no toque em
     * pagar) — exigir usuário devolvia 401 e não aquecia nada. */
    if ((rawBody as Record<string, unknown>)?.warm === true) {
      // `ativa`: o front pula a Cakto direto pra Asaas quando o disjuntor abriu.
      const [aberto] = await Promise.all([
        disjuntorAberto(supabaseAdmin).catch(() => false),
        getCaktoToken(clientId, clientSecret).catch(() => null), // create tenta de novo
      ]);
      return jsonResponse({ ok: true, ativa: !aberto });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header missing" }, 401);

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);
    /* 06/09: a WEB paga com sessão ANÔNIMA (sem e-mail até o batismo depois do
     * QR). Exigir e-mail aqui derrubava 100% do checkout da web com 401. O
     * vínculo compra→conta é o order_id gravado em pix_order_created (o
     * webhook e o reconcile procuram por ele), não o e-mail. */
    if (authError || !authData?.user) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }
    const user = authData.user;
    logStep("Authenticated", { userId: user.id });

    const RequestSchema = z.object({
      offer: z.enum(["lifetime", "downsell", "w97", "w25", "w47", "w27"]),
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

    /* SONDA DO CPF (25/09, dono: "to pensando em mudar pra cakto, bora testar").
     * A Cakto saiu da web em 16/09 porque exige CPF e recusa o coringa desde
     * 06/09 — o form de CPF derrubou o QR (4 checkouts, 0 QR). Antes de pôr
     * tráfego nela, a pergunta é se voltou a aceitar Pix SEM documento. Só
     * admin; cria cobranças reais NÃO pagas (expiram sozinhas) e devolve o
     * veredito cru. Não grava pix_order_created: o reconcile não as vê. */
    /* SONDA DO DISJUNTOR (25/09, só admin): registra UMA falha de mentira —
     * na 3ª em 24 h o disjuntor abre de verdade e o e-mail sai com "TESTE" no
     * assunto. Testar com VIRADA_CAKTO antes do teste e, depois, mover a virada
     * pra depois dele (as falhas de teste param de contar). */
    if ((rawBody as Record<string, unknown>)?.sonda === "falha") {
      if (!ADMIN_EMAILS.includes(user.email ?? "")) return jsonResponse({ error: "forbidden" }, 403);
      const r = await registrarFalha(supabaseAdmin, user.id, "TESTE do disjuntor (sonda admin)", 0, true);
      return jsonResponse({ ...r, aberto_agora: await disjuntorAberto(supabaseAdmin) });
    }
    if ((rawBody as Record<string, unknown>)?.sonda === "cpf") {
      if (!ADMIN_EMAILS.includes(user.email ?? "")) return jsonResponse({ error: "forbidden" }, 403);
      const tokenSonda = await getCaktoToken(clientId, clientSecret);
      const variantes: Array<[string, Record<string, string>]> = [
        ["coringa", { docType: "cpf", docNumber: "00000000000" }],
        ["sem_doc", {}],
      ];
      // controle: o CPF do próprio admin (se salvo no perfil) — prova que a API
      // está de pé; o número nunca volta na resposta.
      const { data: perfilAdmin } = await supabaseAdmin.from("profiles").select("tax_id").eq("id", user.id).maybeSingle();
      const cpfAdmin = onlyDigits(perfilAdmin?.tax_id);
      if (cpfAdmin.length === 11 && !/^(\d)\1{10}$/.test(cpfAdmin)) variantes.push(["cpf_do_admin", { docType: "cpf", docNumber: cpfAdmin }]);
      const resultado: Record<string, unknown>[] = [];
      for (const [variante, doc] of variantes) {
        const t0 = Date.now();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25_000);
        try {
          const r = await fetch(`${CAKTO_API}/payments/`, {
            method: "POST",
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${tokenSonda}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
            body: JSON.stringify({
              paymentMethod: "pix",
              // e-mail NOVO a cada tentativa: a Cakto guarda o documento por
              // e-mail e o "sem documento" passava em cima do anterior (25/09)
              customer: { name: "Sonda CORE", email: `sonda-${variante}-${crypto.randomUUID().slice(0, 8)}@coreaplicativo.com.br`, phone: DUMMY_PHONE, fingerprint: crypto.randomUUID(), ...doc },
              items: [{ offerId: OFFER_IDS.w27, quantity: 1, offerType: "main" }],
              metadata: { sck: "sonda-cpf" },
            }),
          });
          const d = await r.json().catch(() => ({}));
          resultado.push({
            variante, http: r.status, ms: Date.now() - t0, status: d?.status ?? null,
            qr: !!d?.pix?.qrCode, amount: d?.amount ?? null,
            ...(d?.pix?.qrCode ? {} : { corpo: JSON.stringify(d).slice(0, 400) }),
          });
        } catch (e) {
          resultado.push({ variante, ms: Date.now() - t0, erro: e instanceof Error ? e.message : String(e) });
        } finally {
          clearTimeout(timer);
        }
      }
      logStep("sonda_cpf", { resultado });
      return jsonResponse({ resultado });
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
    const [{ data: profile }, desligada] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name, phone, tax_id").eq("id", user.id).maybeSingle(),
      disjuntorAberto(supabaseAdmin).catch(() => false),
    ]);
    if (desligada) {
      logStep("cakto_desligada (disjuntor aberto) — o checkout vai pela Asaas");
      return jsonResponse({ error: "cakto_desligada" }, 503);
    }

    const name = (body.customer?.name || profile?.display_name || user.email?.split("@")[0] || "Cliente CORE").trim();
    // Anônimo: a Cakto exige um e-mail no cliente. Vai um apelido determinístico
    // no nosso domínio — nunca o e-mail de outra pessoa. O webhook casa pelo order_id.
    const emailCliente = user.email || `pix-${user.id.slice(0, 8)}@coreaplicativo.com.br`;
    const bodyPhone = toE164(body.customer?.phone);
    const phone = (bodyPhone !== DUMMY_PHONE ? bodyPhone : null) ?? toE164(profile?.phone) ?? DUMMY_PHONE;
    // Form CPF removido (25/07): usa o CPF do body (Pagar.me/legado) ou o
    // tax_id já salvo no perfil; sem nenhum dos dois → "00000000000" =
    // CONSUMIDOR NÃO IDENTIFICADO (a Cakto exige 11 dígitos mas não valida,
    // testado; NÃO fingimos o CPF de uma pessoa real). O zerado nunca é salvo
    // no perfil (o guard abaixo já exige body.customer.docNumber).
    const cpfValido = (d: string) => d.length === 11 && !/^(\d)\1{10}$/.test(d);
    const docBody = onlyDigits(body.customer?.docNumber);
    const docPerfil = onlyDigits(profile?.tax_id);
    /* 06/09: o coringa 00000000000 passou a ser RECUSADO pela Cakto e o form de
     * CPF voltou — e derrubou o QR (16/09: 4 checkouts, 0 QR).
     * 25/09: a Cakto voltou a ACEITAR o coringa (sonda com e-mail novo a cada
     * tentativa). Sem documento ela segue recusando cliente novo: 400 "O campo
     * docNumber é obrigatório para pagamentos no Brasil" — na 1ª sonda o "sem
     * documento" só passou porque o e-mail já tinha documento guardado lá.
     * Então: CPF real quando a pessoa já tem (digitado ou salvo no perfil);
     * senão o coringa = CONSUMIDOR NÃO IDENTIFICADO, como em julho/agosto — nunca
     * o CPF de outra pessoa. Se a Cakto recusar, o checkout cai pra Asaas. */
    const CPF_CORINGA = "00000000000";
    const docNumber = cpfValido(docBody) ? docBody : cpfValido(docPerfil) ? docPerfil : CPF_CORINGA;

    // CPF (e telefone REAL, se algum dia voltar) vão pro profile — próxima
    // compra não pede de novo. O coringa nunca é salvo.
    const profileUpdate: Record<string, string> = {};
    if (phone !== DUMMY_PHONE && phone !== toE164(profile?.phone)) profileUpdate.phone = phone;
    if (cpfValido(docBody) && docBody !== docPerfil) profileUpdate.tax_id = docBody;
    if (Object.keys(profileUpdate).length) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", user.id);
    }

    const tCakto = Date.now();
    let caktoToken: string;
    try {
      caktoToken = await getCaktoToken(clientId, clientSecret);
    } catch (e) {
      emSegundoPlano(registrarFalha(supabaseAdmin, user.id, `token: ${e instanceof Error ? e.message : String(e)}`, Date.now() - tCakto));
      return jsonResponse({ error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos." }, 502);
    }

    const attribution = body.attribution ?? {};
    const payload = {
      paymentMethod: "pix",
      customer: {
        name,
        email: emailCliente, // e-mail da conta, ou apelido pro anônimo (vínculo real = order_id)
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

    logStep("Creating pix", { offer: body.offer, offerId, doc: docNumber === CPF_CORINGA ? "coringa" : "cpf" });
    // 25/09: prazo de 15 s — em 06/09 a Cakto chegou a pendurar minutos. O
    // checkout desiste aos 12 s e gera pela Asaas; aqui só evita a função presa.
    let res: Response;
    try {
      res = await fetch(`${CAKTO_API}/payments/`, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${caktoToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      logStep("Cakto payments fetch error", { motivo, ms: Date.now() - tCakto });
      emSegundoPlano(registrarFalha(supabaseAdmin, user.id, `fetch: ${motivo}`, Date.now() - tCakto));
      return jsonResponse({ error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos." }, 502);
    }
    const data = await res.json().catch(() => ({}));
    const msCakto = Date.now() - tCakto;

    if (!res.ok || !data?.pix?.qrCode) {
      // Log completo do erro — a visibilidade que o checkout hospedado nunca deu
      logStep("Cakto payments error", { status: res.status, body: JSON.stringify(data).slice(0, 600) });
      emSegundoPlano(registrarFalha(supabaseAdmin, user.id, `http ${res.status}: ${JSON.stringify(data).slice(0, 250)}`, msCakto));
      return jsonResponse({
        error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.",
        // diagnóstico opt-in (QA, 17/07 — conta em análise): corpo cru do
        // gateway. Lê do rawBody: o zod STRIPA campos fora do schema.
        ...((rawBody as Record<string, unknown>)?.debug === true
          ? { gw: { status: res.status, body: JSON.stringify(data).slice(0, 400) } }
          : {}),
      }, 502);
    }

    logStep("Pix created", { orderId: data.id, refId: data.refId, amount: data.amount, ms: msCakto });
    // Deu QR, mas devagar demais: o checkout desiste aos 12 s — conta como falha.
    if (msCakto > CAKTO_LENTA_MS) emSegundoPlano(registrarFalha(supabaseAdmin, user.id, `lenta: ${msCakto} ms`, msCakto));
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
