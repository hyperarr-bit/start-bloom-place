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
/* 25/09 noite (análise do dia): o disjuntor desligou a Cakto às 14:34 por 1
 * falha de login (06:59) + 2 LENTIDÕES (14,5 s e 10,7 s — e a de 10,7 s ainda
 * virou venda). De 14:40 às 19h a Asaas converteu 20% contra 58% da Cakto.
 * Agora: (1) lentidão NÃO conta — o checkout já cai pra Asaas sozinho aos 12 s;
 * (2) só erro de verdade (login, recusa, sem QR, rede/prazo de 15 s), 3 em 1 h;
 * (3) aberto dura 30 min e fecha sozinho (se a Cakto seguir falhando, reabre).
 * VIRADA_CAKTO: falhas antes dela não contam (religada às 19:25 BRT de 25/09). */
const VIRADA_CAKTO = "2026-09-25T22:25:00Z";
const FALHAS_PRA_DESLIGAR = 3;
const JANELA_FALHAS_MS = 60 * 60 * 1000;
const RESFRIAR_MS = 30 * 60 * 1000;
const CAKTO_LENTA_MS = 10_000; // só pra log: acima disso fica marcado no cronômetro

// deno-lint-ignore no-explicit-any
type Admin = any;

const desdeMs = (ms: number) => new Date(Math.max(Date.parse(VIRADA_CAKTO), Date.now() - ms)).toISOString();
async function disjuntorAberto(admin: Admin): Promise<boolean> {
  const { data } = await admin.from("analytics_events").select("id")
    .eq("event_name", "cakto_disjuntor_aberto").gte("created_at", desdeMs(RESFRIAR_MS)).limit(1);
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
      subject: `${teste ? "TESTE — " : ""}[CORE] Cakto pausada por 30 min — a Asaas assumiu`,
      html:
        `<p>A Cakto deu erro <b>${falhas} vezes</b> na última hora e o checkout da web passou pra <b>Asaas</b> sozinho às ${hora} (Brasília).</p>` +
        `<p>Nenhuma venda se perde por isso: quem estava pagando recebeu o Pix pela Asaas na hora.</p>` +
        `<p>A Cakto volta sozinha em 30 minutos. Se continuar com erro, desliga de novo e chega outro e-mail.</p>` +
        `<p>Último erro: <code>${esc(motivo.slice(0, 300))}</code></p>` +
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
    const { count } = await admin.from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event_name", "cakto_falha").gte("created_at", desdeMs(JANELA_FALHAS_MS));
    logStep("cakto_falha", { motivo: motivo.slice(0, 120), ms, falhas_1h: count });
    if ((count ?? 0) < FALHAS_PRA_DESLIGAR) return { falhas_1h: count, abriu: false };
    if (await disjuntorAberto(admin)) return { falhas_1h: count, abriu: false, ja_aberto: true }; // outra instância já abriu
    await admin.from("analytics_events").insert({ event_name: "cakto_disjuntor_aberto", user_id: userId, event_data: { falhas: count, ultimo_motivo: motivo.slice(0, 300) } });
    logStep("DISJUNTOR ABERTO — Cakto desligada, Asaas principal", { falhas: count });
    const avisou = await avisarDono(count ?? FALHAS_PRA_DESLIGAR, motivo, teste);
    return { falhas_1h: count, abriu: true, avisou };
  } catch (e) {
    logStep("registrarFalha falhou", { message: e instanceof Error ? e.message : String(e) });
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Roda depois da resposta (a pessoa não espera o registro da falha).
 *  25/09 noite: Promise.resolve() de propósito — o builder do supabase-js é
 *  PREGUIÇOSO (só executa no .then()); passado cru pro waitUntil, o upsert do
 *  token nunca rodava (medido: todo aquecimento seguia fazendo login). */
function emSegundoPlano(p: PromiseLike<unknown>) {
  const prom = Promise.resolve(p).then((r) => {
    // deno-lint-ignore no-explicit-any
    const erro = (r as any)?.error;
    if (erro) logStep("segundo plano com erro", { message: String(erro.message ?? erro).slice(0, 200) });
  }).catch((e) => logStep("segundo plano falhou", { message: e instanceof Error ? e.message : String(e) }));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(prom);
}

/* MEDIÇÃO (25/09 noite, dono: "análise detalhada, otimização pesada do tempo de
 * espera"). Idade e nº de pedidos desta instância: mostra se o runtime reusa a
 * instância (token em memória vale) ou sobe uma nova a cada chamada. */
const NASCEU = Date.now();
let pedidosNestaInstancia = 0;

/* TOKEN DA CAKTO (25/09 noite). Medido: o runtime sobe uma instância NOVA a
 * cada chamada (idade da instância ≈ duração do pedido, 1 pedido por
 * instância), então o cache em memória nunca servia — todo Pix fazia login
 * OAuth na Cakto (~1,0 s, de 0,9 a 1,6 s) e toda falha de login virava falha
 * do Pix (a de 06:59). Agora o token (vale 10 h) fica no app_config (só o
 * service role lê): memória → banco (~30 ms) → login, com 2 tentativas. Um login
 * a cada ~8 h em vez de um por Pix. */
const CHAVE_TOKEN = "cakto_token";
let tokenCache: { token: string; expiresAt: number } | null = null;
let ultimaFonteToken = "";
async function loginCakto(clientId: string, clientSecret: string): Promise<{ token: string; expiresAt: number }> {
  let ultimo = "";
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const res = await fetch(`${CAKTO_API}/token/`, {
        method: "POST",
        signal: AbortSignal.timeout(6_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.access_token) {
        const validadeS = Math.min(Number(data.expires_in) || 36_000, 36_000);
        return { token: data.access_token, expiresAt: Date.now() + validadeS * 800 }; // 80% da validade
      }
      ultimo = `http ${res.status}: ${JSON.stringify(data).slice(0, 200)}`;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e);
    }
    logStep("Token error", { tentativa, ultimo });
    if (tentativa === 1) await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Falha ao autenticar com o gateway de pagamento (${ultimo})`);
}
async function getCaktoToken(clientId: string, clientSecret: string, admin?: Admin, forcarNovo = false): Promise<string> {
  if (!forcarNovo && tokenCache && Date.now() < tokenCache.expiresAt) { ultimaFonteToken = "memoria"; return tokenCache.token; }
  if (!forcarNovo && admin) {
    try {
      const { data } = await admin.from("app_config").select("value").eq("key", CHAVE_TOKEN).maybeSingle();
      const v = data?.value as { token?: string; expira_em?: number } | undefined;
      if (v?.token && typeof v.expira_em === "number" && Date.now() < v.expira_em - 5 * 60_000) {
        tokenCache = { token: v.token, expiresAt: v.expira_em };
        ultimaFonteToken = "banco";
        return v.token;
      }
    } catch { /* sem banco: faz login */ }
  }
  const novo = await loginCakto(clientId, clientSecret);
  tokenCache = novo;
  ultimaFonteToken = "oauth";
  if (admin) {
    emSegundoPlano(admin.from("app_config").upsert({ key: CHAVE_TOKEN, value: { token: novo.token, expira_em: novo.expiresAt }, updated_at: new Date().toISOString() }));
  }
  return novo.token;
}

/** `sub`/e-mail do JWT SEM verificar — só pra ADIANTAR as leituras em paralelo.
 *  Nada é gravado nem devolvido antes do getUser confirmar o mesmo usuário. */
function lerJwt(jwt: string): { sub?: string; email?: string } {
  try {
    const p = jwt.split(".")[1];
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((p.length + 3) % 4));
    return JSON.parse(json);
  } catch { return {}; }
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
    pedidosNestaInstancia++;
    if ((rawBody as Record<string, unknown>)?.warm === true) {
      // `ativa`: o front pula a Cakto direto pra Asaas quando o disjuntor abriu.
      const t0 = Date.now();
      let msDisj = 0, msToken = 0;
      const [aberto] = await Promise.all([
        disjuntorAberto(supabaseAdmin).catch(() => false).finally(() => { msDisj = Date.now() - t0; }),
        getCaktoToken(clientId, clientSecret, supabaseAdmin).catch(() => null).finally(() => { msToken = Date.now() - t0; }), // create tenta de novo
      ]);
      return jsonResponse({ ok: true, ativa: !aberto, t: { instancia_ms: Date.now() - NASCEU, pedidos: pedidosNestaInstancia, disjuntor_ms: msDisj, token_ms: msToken, token_fonte: ultimaFonteToken } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization header missing" }, 401);

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.replace("Bearer ", "");
    const tReq = Date.now();
    const T: Record<string, number | string> = { instancia_ms: tReq - NASCEU, pedidos: pedidosNestaInstancia };
    /* 25/09 noite: o getUser (~0,3 s) corre EM PARALELO com perfil, disjuntor e
     * token — leituras adiantadas pelo `sub` do JWT (a gateway da função já
     * confere a assinatura). NADA é gravado nem devolvido antes de o getUser
     * confirmar o MESMO usuário; se não confirmar, o pedido da Cakto fica órfão
     * (não pago, expira) e o checkout cai pra Asaas. */
    const pUser = supabaseAnon.auth.getUser(token).then((r) => { T.auth = Date.now() - tReq; return r; });
    const jwt = lerJwt(token);
    const ehSonda = typeof (rawBody as Record<string, unknown>)?.sonda === "string";
    const adiantar = !ehSonda && !!jwt.sub;
    const pPerfil = adiantar ? supabaseAdmin.from("profiles").select("display_name, phone, tax_id").eq("id", jwt.sub).maybeSingle() : null;
    const pDesligada = adiantar ? disjuntorAberto(supabaseAdmin).catch(() => false) : null;
    const pToken = adiantar
      ? getCaktoToken(clientId, clientSecret, supabaseAdmin).then((tk) => { T.token = Date.now() - tReq; T.token_fonte = ultimaFonteToken; return tk; })
      : null;
    pToken?.catch(() => { /* quem usa trata; isto só evita rejeição solta se sair antes */ });
    /* 06/09: a WEB paga com sessão ANÔNIMA (sem e-mail até o batismo depois do
     * QR). Exigir e-mail aqui derrubava 100% do checkout da web com 401. O
     * vínculo compra→conta é o order_id gravado em pix_order_created (o
     * webhook e o reconcile procuram por ele), não o e-mail. */
    let user: { id: string; email?: string | null };
    if (adiantar) {
      user = { id: String(jwt.sub), email: jwt.email || null };
    } else {
      const { data: authData, error: authError } = await pUser;
      if (authError || !authData?.user) {
        return jsonResponse({ error: "User not authenticated" }, 401);
      }
      user = authData.user;
    }
    logStep("Authenticated", { userId: user.id, confirmado: !adiantar });

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
    /* SONDA DE TEMPO (25/09 noite, só admin): onde vão os ~6 s do Pix da Cakto.
     * Mede o login OAuth (sempre novo, sem cache), 3 consultas ao banco e uma
     * matriz de criações INTERCALADAS: coringa × CPF do admin, e-mail novo ×
     * e-mail repetido (cliente que a Cakto já conhece). Cria cobranças reais NÃO
     * pagas (expiram sozinhas); não grava pix_order_created (o reconcile não vê). */
    if ((rawBody as Record<string, unknown>)?.sonda === "tempo") {
      if (!ADMIN_EMAILS.includes(user.email ?? "")) return jsonResponse({ error: "forbidden" }, 403);
      const rodadas = Math.min(5, Math.max(1, Number((rawBody as Record<string, unknown>)?.rodadas) || 3));
      const med = (xs: number[]) => { const a = [...xs].sort((m, n) => m - n); return a.length ? a[Math.floor(a.length / 2)] : null; };
      const oauth: Array<Record<string, unknown>> = [];
      let tokenSonda = "";
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        try {
          const r = await fetch(`${CAKTO_API}/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }), signal: AbortSignal.timeout(15_000) });
          const d = await r.json().catch(() => ({}));
          if (d?.access_token) tokenSonda = d.access_token;
          oauth.push({ ms: Date.now() - t0, http: r.status, ok: !!d?.access_token, expira_s: d?.expires_in ?? null });
        } catch (e) { oauth.push({ ms: Date.now() - t0, erro: e instanceof Error ? e.message : String(e) }); }
      }
      const banco: number[] = [];
      for (let i = 0; i < 3; i++) { const t0 = Date.now(); await supabaseAdmin.from("app_config").select("key").limit(1); banco.push(Date.now() - t0); }
      if (!tokenSonda) return jsonResponse({ oauth, banco, erro: "sem token" });
      const { data: perfilAdmin } = await supabaseAdmin.from("profiles").select("tax_id").eq("id", user.id).maybeSingle();
      const cpfAdmin = onlyDigits(perfilAdmin?.tax_id);
      const temCpf = cpfAdmin.length === 11 && !/^(\d)\1{10}$/.test(cpfAdmin);
      const sufixo = crypto.randomUUID().slice(0, 6);
      const variantes: Array<[string, string, string]> = [
        ["coringa_email_novo", "00000000000", ""],
        ...(temCpf ? [["cpf_email_novo", cpfAdmin, ""] as [string, string, string]] : []),
        ["coringa_email_repetido", "00000000000", `sonda-rep-coringa-${sufixo}@coreaplicativo.com.br`],
        ...(temCpf ? [["cpf_email_repetido", cpfAdmin, `sonda-rep-cpf-${sufixo}@coreaplicativo.com.br`] as [string, string, string]] : []),
      ];
      const criacoes: Array<Record<string, unknown>> = [];
      for (let r = 0; r < rodadas; r++) {
        for (const [variante, doc, emailFixo] of variantes) {
          const t0 = Date.now();
          try {
            const resp = await fetch(`${CAKTO_API}/payments/`, {
              method: "POST",
              signal: AbortSignal.timeout(25_000),
              headers: { Authorization: `Bearer ${tokenSonda}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
              body: JSON.stringify({
                paymentMethod: "pix",
                customer: { name: "Sonda CORE", email: emailFixo || `sonda-${variante}-${crypto.randomUUID().slice(0, 8)}@coreaplicativo.com.br`, phone: DUMMY_PHONE, fingerprint: crypto.randomUUID(), docType: "cpf", docNumber: doc },
                items: [{ offerId: OFFER_IDS.w27, quantity: 1, offerType: "main" }],
                metadata: { sck: "sonda-tempo" },
              }),
            });
            const d = await resp.json().catch(() => ({}));
            criacoes.push({ rodada: r + 1, variante, ms: Date.now() - t0, http: resp.status, qr: !!d?.pix?.qrCode, ...(d?.pix?.qrCode ? {} : { corpo: JSON.stringify(d).slice(0, 200) }) });
          } catch (e) {
            criacoes.push({ rodada: r + 1, variante, ms: Date.now() - t0, erro: e instanceof Error ? e.message : String(e) });
          }
        }
      }
      const resumo = Object.fromEntries(variantes.map(([v]) => {
        const xs = criacoes.filter((c) => c.variante === v && c.qr).map((c) => Number(c.ms));
        return [v, { ok: xs.length, de: criacoes.filter((c) => c.variante === v).length, mediana_ms: med(xs), min_ms: xs.length ? Math.min(...xs) : null, max_ms: xs.length ? Math.max(...xs) : null }];
      }));
      logStep("sonda_tempo", { resumo, oauth, banco });
      return jsonResponse({ resumo, oauth, banco_ms: banco, auth_ms: T.auth, instancia: { idade_ms: T.instancia_ms, pedidos: T.pedidos }, criacoes, tem_cpf: temCpf });
    }
    if ((rawBody as Record<string, unknown>)?.sonda === "cpf") {
      if (!ADMIN_EMAILS.includes(user.email ?? "")) return jsonResponse({ error: "forbidden" }, 403);
      const tokenSonda = await getCaktoToken(clientId, clientSecret, supabaseAdmin);
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
      pPerfil ?? supabaseAdmin.from("profiles").select("display_name, phone, tax_id").eq("id", user.id).maybeSingle(),
      pDesligada ?? disjuntorAberto(supabaseAdmin).catch(() => false),
    ]);
    T.preparo = Date.now() - tReq;
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
    // (gravado só depois de o getUser confirmar o usuário — lá embaixo)

    const tCakto = Date.now();
    let caktoToken: string;
    try {
      caktoToken = await (pToken ?? getCaktoToken(clientId, clientSecret, supabaseAdmin));
      if (!pToken) { T.token = Date.now() - tCakto; T.token_fonte = ultimaFonteToken; }
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
    const tPost = Date.now();
    const criar = (tk: string, prazoMs: number) => fetch(`${CAKTO_API}/payments/`, {
      method: "POST",
      signal: AbortSignal.timeout(prazoMs),
      headers: {
        Authorization: `Bearer ${tk}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    try {
      res = await criar(caktoToken, 15_000);
      if (res.status === 401) {
        // Token do banco recusado (trocado/expirado antes da hora): login novo e 1 nova tentativa.
        T.token_401 = 1;
        caktoToken = await getCaktoToken(clientId, clientSecret, supabaseAdmin, true);
        res = await criar(caktoToken, Math.max(3_000, 15_000 - (Date.now() - tPost)));
      }
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      logStep("Cakto payments fetch error", { motivo, ms: Date.now() - tCakto });
      emSegundoPlano(registrarFalha(supabaseAdmin, user.id, `fetch: ${motivo}`, Date.now() - tCakto));
      return jsonResponse({ error: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos." }, 502);
    }
    const data = await res.json().catch(() => ({}));
    const msCakto = Date.now() - tCakto;
    T.cakto = Date.now() - tPost; T.doc = docNumber === CPF_CORINGA ? "coringa" : "cpf";

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
    // Deu QR, só que devagar: NÃO é falha (25/09 noite) — o checkout já cai pra Asaas aos 12 s. Fica no cronômetro.
    if (msCakto > CAKTO_LENTA_MS) T.lenta = 1;
    if (adiantar) {
      const { data: authData, error: authError } = await pUser;
      if (authError || !authData?.user || authData.user.id !== user.id) {
        logStep("usuário não confirmado — pedido da Cakto fica órfão (não pago, expira)", { orderId: data.id });
        return jsonResponse({ error: "User not authenticated" }, 401);
      }
    }
    if (Object.keys(profileUpdate).length) emSegundoPlano(supabaseAdmin.from("profiles").update(profileUpdate).eq("id", user.id));
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

    const tGrava = Date.now();
    T.antes_de_gravar = tGrava - tReq;
    await supabaseAdmin.from("analytics_events").insert({
      event_name: "pix_order_created",
      user_id: user.id,
      event_data: {
        t: T, // cronômetro do servidor (25/09 noite) — onde vai a espera
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
    T.gravar = Date.now() - tGrava; T.total = Date.now() - tReq;
    return jsonResponse({
      t: T,
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
