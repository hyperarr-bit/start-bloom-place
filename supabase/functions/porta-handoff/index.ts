/**
 * PORTA → APP JÁ LOGADO (10/10).
 *
 * A Porta iPhone (/comece) cria a conta NO SITE; o app instalado depois abria
 * na welcome e a pessoa tinha que achar o "Entrar" e digitar tudo de novo.
 * Esta função faz a ponte com um CÓDIGO de uso único:
 *
 *   POST { acao: "criar", metodo? }      COM o JWT da conta (o site, logo depois
 *        → { codigo, expira_em,          da conta criada/entrada). 10 caracteres,
 *            email_enviado }             24 h, 1 uso; os anteriores NÃO usados da
 *                                        mesma conta são invalidados. Na 1ª vez de
 *                                        cada conta manda o e-mail "Seu plano está
 *                                        salvo — entre no CORE" com ESTE código no
 *                                        botão (core://entrar?h=…) — ver
 *                                        ../_shared/email-porta.ts. Falhou o e-mail,
 *                                        o código volta igual.
 *   POST { acao: "registro", event_id } COM o JWT: CompleteRegistration na CAPI do pixel do site (1x, conta nova
 *                                        da Porta, mesmo event_id do fbq → a Meta deduplica).
 *   POST { acao: "lembretes", ensaio? }  v4 (12/10), SÓ o cron (header x-cron-secret = PORTA_CRON_SECRET; sem o
 *        → { n1, n2 }                    secret configurado, recusa tudo). E-mail "Seu plano de 3 dias está te
 *                                        esperando" pra conta da Porta (iPhone) criada há 60–120 min (n1) ou
 *                                        ontem (n2, das 9h às 12h de Brasília) que NÃO entrou no app, com um
 *                                        código NOVO no botão (só invalida os antigos DEPOIS do e-mail aceito).
 *                                        1x por lembrete (analytics_events porta_lembrete_enviado {n}).
 *                                        ensaio:true = só conta, não gera código nem manda. Regras puras:
 *                                        ../_shared/porta-lembretes.ts; cron: supabase/cron/porta-lembretes.sql.
 *   POST { acao: "resgatar", codigo }    SEM login (o app, que ainda não tem
 *        → { token_hash, email }         sessão). Confere o hash, não usado, não
 *                                        vencido; marca usado; gera um magic link
 *                                        pelo admin (NÃO manda e-mail) e devolve o
 *                                        hashed_token, que o app troca por sessão
 *                                        com supabase.auth.verifyOtp({ token_hash,
 *                                        type: "magiclink" }).
 *
 * Erro de código é SEMPRE o mesmo ({ erro: "codigo" }): não diz se o código
 * existe, venceu ou já foi usado. Cada resgate que falha conta 1 erro pro IP
 * (porta_handoff_erros, IP em hash); 20 erros na última hora → { erro: "limite" }
 * (429). Em tabela porque as instâncias da edge function não compartilham
 * memória e morrem no cold start — um contador em memória não seguraria nada.
 *
 * verify_jwt = false no config.toml: o "resgatar" é chamado sem sessão. O
 * "criar" confere o JWT aqui dentro (auth.getUser).
 *
 * Partes puras (gerar/validar/hash): ../_shared/porta-handoff.ts (vitest).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ASSUNTO_LEMBRETE, ASSUNTO_PORTA, ehEmailDeTeste, htmlLembrete, htmlPorta } from "../_shared/email-porta.ts";
import {
  VALIDADE_MS, codigoValido, dentroDoLimite, gerarCodigo, hashCodigo, ipDoPedido, normalizarCodigo,
} from "../_shared/porta-handoff.ts";
import {
  EVENTOS_DE_CONTA, EVENTOS_DO_APP, MAX_POR_RODADA, decidirLembrete, filtroBasico, janelaDoLembrete, segredoConfere,
  type NumeroLembrete,
} from "../_shared/porta-lembretes.ts";
import { urlDaPagina } from "../_shared/porta-capi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

const log = (passo: string, d?: unknown) => console.log(`[PORTA-HANDOFF] ${passo}${d ? " - " + JSON.stringify(d) : ""}`);

const VIAS = new Set(["link"]);

/** O e-mail da Porta, 1x por conta (analytics_events porta_email_enviado). Nunca lança. */
async function mandarEmailDaPorta(
  admin: ReturnType<typeof createClient>, user: { id: string; email?: string | null }, codigo: string, metodo: string,
): Promise<boolean> {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const email = user.email ?? null;
    if (!resendKey || !email || ehEmailDeTeste(email)) return false;
    const { data: ja } = await admin.from("analytics_events").select("id").eq("event_name", "porta_email_enviado").eq("user_id", user.id).limit(1);
    if (ja?.length) return false;
    const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM") || Deno.env.get("WELCOME_EMAIL_FROM") || "CORE <onboarding@resend.dev>";
    const from = fromBase.includes("<") ? `CORE <${fromBase.split("<")[1]}` : fromBase;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: ASSUNTO_PORTA, html: htmlPorta({ email, metodo, codigo }) }),
    });
    if (!r.ok) { log("resend recusou", { status: r.status, corpo: (await r.text()).slice(0, 160) }); return false; }
    await admin.from("analytics_events").insert({ user_id: user.id, event_name: "porta_email_enviado", event_data: { metodo, com_codigo: true }, session_id: null });
    return true;
  } catch (e) {
    log("falha no e-mail", { erro: String(e).slice(0, 160) });
    return false;
  }
}

/* CAPI DO CADASTRO (11/10, dono: "quando a conta é criada, CompleteRegistration no pixel 998037194527241; se já
 * existir CAPI no site, manda também"). Mesmo dataset/token da CAPI de compras do Cakto/Asaas (META_PIXEL_ID +
 * META_CAPI_TOKEN). event_id = porta.event_id — o MESMO eventID do fbq do navegador → a Meta deduplica.
 * Só conta NOVA da Porta (porta.event_id bate e a conta tem < 30 min), 1x por conta (analytics_events
 * porta_capi_cr). user_data: e-mail e id em SHA-256 + fbc/fbp do clique; SEM IP/user agent (brief: só com ok
 * do dono). Nunca lança; sem os secrets, não faz nada. */
const sha256 = async (v: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
async function capiCadastro(
  admin: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null; created_at?: string; user_metadata?: Record<string, unknown> },
  eventId: string,
): Promise<{ ok: boolean; motivo: string }> {
  try {
    const pixelId = Deno.env.get("META_PIXEL_ID");
    const token = Deno.env.get("META_CAPI_TOKEN");
    if (!pixelId || !token) return { ok: false, motivo: "sem_secrets" };
    const porta = (user.user_metadata?.porta ?? null) as { event_id?: string; attr?: Record<string, string | undefined> } | null;
    if (!porta || !eventId || porta.event_id !== eventId) return { ok: false, motivo: "sem_porta" };
    if (!user.created_at || Date.now() - Date.parse(user.created_at) > 30 * 60e3) return { ok: false, motivo: "conta_antiga" };
    const { data: ja } = await admin.from("analytics_events").select("id").eq("event_name", "porta_capi_cr").eq("user_id", user.id).limit(1);
    if (ja?.length) return { ok: false, motivo: "ja_enviado" };
    const a = porta.attr ?? {};
    const userData: Record<string, unknown> = { external_id: [await sha256(user.id)] };
    if (user.email) userData.em = [await sha256(user.email)];
    if (a.fbc) userData.fbc = a.fbc;
    if (a.fbp) userData.fbp = a.fbp;
    const evento = {
      event_name: "CompleteRegistration",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      // 12/10: o landing guardado é caminho + query ("/comece?utm…"); a Meta quer a URL inteira
      event_source_url: urlDaPagina(a.landing),
      user_data: userData,
      custom_data: { content_name: "porta_iphone", status: true },
    };
    const r = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [evento] }),
    });
    const ok = r.ok;
    if (!ok) log("capi recusou", { status: r.status, corpo: (await r.text()).slice(0, 160) });
    await admin.from("analytics_events").insert({ user_id: user.id, event_name: "porta_capi_cr", event_data: { ok, event_id: eventId, status: r.status, fbc: !!a.fbc, fbp: !!a.fbp }, session_id: null });
    return { ok, motivo: ok ? "ok" : "meta" };
  } catch (e) {
    log("falha na capi", { erro: String(e).slice(0, 160) });
    return { ok: false, motivo: "erro" };
  }
}

/* ------------------------------------------------------------------ LEMBRETES (v4, 12/10) */
type Admin = ReturnType<typeof createClient>;

/** Entrou no app? Código resgatado no app, assinatura, evento que só o app manda, ou ficha do aparelho numa sessão dela. */
async function temSinalDeApp(admin: Admin, uid: string): Promise<boolean> {
  const { data: h } = await admin.from("porta_handoff").select("id").eq("user_id", uid).like("usado_por", "app:%").limit(1);
  if (h?.length) return true;
  const { data: sub } = await admin.from("subscriptions").select("id").eq("user_id", uid).limit(1);
  if (sub?.length) return true;
  const { data: ev } = await admin.from("analytics_events").select("id").eq("user_id", uid).in("event_name", EVENTOS_DO_APP).limit(1);
  if (ev?.length) return true;
  // a ficha do aparelho costuma nascer ANÔNIMA (antes do login): procura nas sessões em que ela aparece logada
  const { data: ses } = await admin.from("analytics_events").select("session_id").eq("user_id", uid).limit(300);
  const ids = [...new Set(((ses ?? []) as { session_id: string | null }[]).map((x) => x.session_id).filter(Boolean))] as string[];
  for (let i = 0; i < ids.length; i += 80) {
    const { data: nat } = await admin.from("analytics_events").select("id").in("event_name", ["app_device_info", "webview_info"]).in("session_id", ids.slice(i, i + 80)).limit(1);
    if (nat?.length) return true;
  }
  return false;
}

/** iPhone? Só o iPhone pede código (porta_handoff tem linha dela); senão o porta_view da sessão da Porta dela. */
async function ehDoIphone(admin: Admin, uid: string, portaSessao: string | null, criadaEm: string | undefined): Promise<boolean> {
  const { data: h } = await admin.from("porta_handoff").select("id").eq("user_id", uid).limit(1);
  if (h?.length) return true;
  if (!portaSessao) return false;
  const { data: v } = await admin.from("analytics_events").select("event_data").eq("event_name", "porta_view").eq("event_data->>porta_session_id", portaSessao)
    // o porta_view é da mesma visita da conta: recorta o tempo (analytics_events é grande)
    .gte("created_at", new Date(Date.parse(criadaEm ?? "") - 2 * 86_400_000 || 0).toISOString()).limit(1);
  return ((v?.[0] as { event_data?: { plataforma?: string } } | undefined)?.event_data?.plataforma ?? "") === "ios";
}

/** Manda pelo Resend (mesmo remetente do e-mail da Porta). Nunca lança. */
async function enviarEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return false;
    const fromBase = Deno.env.get("RECOVERY_EMAIL_FROM") || Deno.env.get("WELCOME_EMAIL_FROM") || "CORE <onboarding@resend.dev>";
    const from = fromBase.includes("<") ? `CORE <${fromBase.split("<")[1]}` : fromBase;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!r.ok) log("resend recusou (lembrete)", { status: r.status, corpo: (await r.text()).slice(0, 160) });
    return r.ok;
  } catch (e) {
    log("falha no e-mail (lembrete)", { erro: String(e).slice(0, 160) });
    return false;
  }
}

/**
 * Uma rodada de um lembrete. Código novo: grava o novo, manda o e-mail e SÓ ENTÃO invalida os antigos não usados
 * (se o e-mail falha, o novo some e o código do 1º e-mail continua valendo).
 */
async function rodarLembrete(admin: Admin, n: NumeroLembrete, agora: Date, ensaio: boolean): Promise<Record<string, unknown>> {
  const janela = janelaDoLembrete(n, agora);
  if (!janela) return { pulou: "fora_do_horario" };
  const folga = 20 * 60_000;
  const { data: evs, error } = await admin
    .from("analytics_events")
    .select("user_id")
    .in("event_name", EVENTOS_DE_CONTA)
    .not("user_id", "is", null)
    .gte("created_at", new Date(janela.de.getTime() - folga).toISOString())
    .lte("created_at", new Date(janela.ate.getTime() + folga).toISOString())
    .limit(2000);
  if (error) { log("lembrete: falha ao listar", { n, erro: error.message }); return { erro: "listar" }; }
  const uids = [...new Set(((evs ?? []) as { user_id: string }[]).map((x) => x.user_id))];
  const pulados: Record<string, number> = {};
  const pula = (m: string) => { pulados[m] = (pulados[m] ?? 0) + 1; };
  let enviados = 0, enviaria = 0;
  for (const uid of uids.slice(0, MAX_POR_RODADA)) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      const user = u?.user;
      if (!user) { pula("sumiu"); continue; }
      const porta = ((user.user_metadata ?? {}) as { porta?: { porta_session_id?: string; metodo?: string; respostas?: { atrapalha?: string | null } } }).porta ?? null;
      const basico = filtroBasico(janela, { criadaEm: user.created_at, temPorta: !!porta, email: user.email });
      if (!basico.manda) { pula(basico.motivo); continue; }
      const ehIos = await ehDoIphone(admin, uid, porta?.porta_session_id ?? null, user.created_at);
      const temApp = ehIos ? await temSinalDeApp(admin, uid) : false;
      let jaRecebeu = false;
      if (ehIos && !temApp) {
        const { data: ja } = await admin.from("analytics_events").select("id").eq("event_name", "porta_lembrete_enviado").eq("user_id", uid).contains("event_data", { n }).limit(1);
        jaRecebeu = !!ja?.length;
      }
      const d = decidirLembrete(janela, { criadaEm: user.created_at, temPorta: true, email: user.email, ehIos, temApp, jaRecebeu });
      if (!d.manda) { pula(d.motivo); continue; }
      if (ensaio) { enviaria++; continue; }

      const codigo = gerarCodigo();
      const hash = await hashCodigo(codigo);
      const { error: erroCod } = await admin.from("porta_handoff").insert({ codigo_hash: hash, user_id: uid, expira_em: new Date(agora.getTime() + VALIDADE_MS).toISOString() });
      if (erroCod) { log("lembrete: falha no código", { erro: erroCod.message }); pula("codigo"); continue; }
      const metodo = ["senha", "apple", "google", "sessao"].includes(String(porta?.metodo)) ? String(porta?.metodo) : "senha";
      const ok = await enviarEmail(user.email as string, ASSUNTO_LEMBRETE[n], htmlLembrete({ email: user.email as string, metodo, codigo, n, dor: porta?.respostas?.atrapalha ?? null }));
      if (!ok) {
        await admin.from("porta_handoff").delete().eq("codigo_hash", hash);
        pula("email_falhou");
        continue;
      }
      // agora sim: 1 código vivo por conta (o do e-mail novo)
      await admin.from("porta_handoff").update({ usado_em: agora.toISOString(), usado_por: "substituido" }).eq("user_id", uid).is("usado_em", null).neq("codigo_hash", hash);
      await admin.from("analytics_events").insert({ user_id: uid, event_name: "porta_lembrete_enviado", event_data: { n, metodo, com_codigo: true }, session_id: null });
      enviados++;
    } catch (e) {
      log("lembrete: erro numa conta", { n, erro: String(e).slice(0, 160) });
      pula("erro");
    }
  }
  return { janela: { de: janela.de.toISOString(), ate: janela.ate.toISOString() }, candidatos: uids.length, enviados, ...(ensaio ? { enviaria } : {}), pulados };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const acao = String(body?.acao ?? "");

    /* ------------------------------------------------------------ criar */
    if (acao === "criar") {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData } = await anon.auth.getUser(token);
      const user = authData?.user;
      if (!user) return json({ erro: "sem_login" }, 401);
      // conta anônima (sem e-mail) não tem como virar magic link
      if (!user.email) return json({ erro: "sem_email" }, 400);

      const agora = new Date();
      // os anteriores não usados desta conta deixam de valer (1 código vivo por conta)
      const { error: erroInvalidar } = await admin
        .from("porta_handoff")
        .update({ usado_em: agora.toISOString(), usado_por: "substituido" })
        .eq("user_id", user.id)
        .is("usado_em", null);
      if (erroInvalidar) log("falha ao invalidar anteriores", { erro: erroInvalidar.message });

      const expira = new Date(agora.getTime() + VALIDADE_MS).toISOString();
      // colisão de hash em 32^10 é praticamente impossível; 3 tentativas cobrem o improvável
      for (let i = 0; i < 3; i++) {
        const codigo = gerarCodigo();
        const { error } = await admin.from("porta_handoff").insert({
          codigo_hash: await hashCodigo(codigo),
          user_id: user.id,
          expira_em: expira,
        });
        if (!error) {
          log("criado", { user_id: user.id });
          const metodo = ["senha", "apple", "google", "sessao"].includes(String(body?.metodo)) ? String(body.metodo) : "senha";
          const emailEnviado = await mandarEmailDaPorta(admin, user, codigo, metodo);
          return json({ codigo, expira_em: expira, email_enviado: emailEnviado });
        }
        if (error.code !== "23505") {
          log("falha ao gravar", { erro: error.message });
          return json({ erro: "gravar" }, 500);
        }
      }
      return json({ erro: "gravar" }, 500);
    }

    /* ------------------------------------------------------------ registro (CAPI do cadastro) */
    if (acao === "registro") {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData } = await anon.auth.getUser(token);
      const user = authData?.user;
      if (!user) return json({ erro: "sem_login" }, 401);
      const r = await capiCadastro(admin, user, String(body?.event_id ?? ""));
      return json(r);
    }

    /* ------------------------------------------------------------ lembretes (cron) */
    if (acao === "lembretes") {
      if (!segredoConfere(req.headers.get("x-cron-secret") ?? "", Deno.env.get("PORTA_CRON_SECRET") ?? "")) return json({ erro: "proibido" }, 403);
      const agora = new Date();
      const ensaio = body?.ensaio === true;
      const n1 = await rodarLembrete(admin, 1, agora, ensaio);
      const n2 = await rodarLembrete(admin, 2, agora, ensaio);
      log("lembretes", { ensaio, n1, n2 });
      return json({ n1, n2 });
    }

    /* ------------------------------------------------------------ resgatar */
    if (acao === "resgatar") {
      const ipHash = await hashCodigo(`ip:${ipDoPedido(req.headers)}`);
      const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await admin
        .from("porta_handoff_erros")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gt("criado_em", umaHoraAtras);
      if (!dentroDoLimite(count ?? 0)) {
        log("limite", { ip_hash: ipHash.slice(0, 12) });
        return json({ erro: "limite" }, 429);
      }

      const falhou = async (motivo: string) => {
        await admin.from("porta_handoff_erros").insert({ ip_hash: ipHash });
        // faxina: erro com mais de 1 dia não conta pra nada
        await admin.from("porta_handoff_erros").delete().lt("criado_em", new Date(Date.now() - 86400_000).toISOString());
        log("resgate recusado", { motivo });
        return json({ erro: "codigo" }, 400);
      };

      const codigo = normalizarCodigo(body?.codigo);
      if (!codigoValido(codigo)) return await falhou("formato");
      const via = VIAS.has(String(body?.via)) ? String(body.via) : "app";

      // marca usado ATOMICAMENTE: o UPDATE só pega a linha se ainda não usada e
      // não vencida — dois resgates simultâneos do mesmo código, só um ganha.
      const agora = new Date().toISOString();
      const { data: linhas, error } = await admin
        .from("porta_handoff")
        .update({ usado_em: agora, usado_por: `app:${via}` })
        .eq("codigo_hash", await hashCodigo(codigo))
        .is("usado_em", null)
        .gt("expira_em", agora)
        .select("user_id");
      if (error) {
        log("falha ao marcar usado", { erro: error.message });
        return json({ erro: "servidor" }, 500);
      }
      const userId = linhas?.[0]?.user_id as string | undefined;
      if (!userId) return await falhou("inexistente_usado_ou_vencido");

      const { data: u, error: erroUser } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      if (erroUser || !email) {
        log("conta sem e-mail ou sumiu", { user_id: userId, erro: erroUser?.message });
        return json({ erro: "codigo" }, 400);
      }

      // generateLink NÃO envia e-mail: só devolve o link e o hashed_token
      const { data: link, error: erroLink } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const tokenHash = link?.properties?.hashed_token;
      if (erroLink || !tokenHash) {
        log("falha no generateLink", { user_id: userId, erro: erroLink?.message });
        return json({ erro: "servidor" }, 500);
      }
      log("resgatado", { user_id: userId, via });
      return json({ token_hash: tokenHash, email });
    }

    return json({ erro: "acao" }, 400);
  } catch (e) {
    log("erro inesperado", { erro: String(e) });
    return json({ erro: "servidor" }, 500);
  }
});
