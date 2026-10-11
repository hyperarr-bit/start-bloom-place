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
import { ASSUNTO_PORTA, ehEmailDeTeste, htmlPorta } from "../_shared/email-porta.ts";
import {
  VALIDADE_MS, codigoValido, dentroDoLimite, gerarCodigo, hashCodigo, ipDoPedido, normalizarCodigo,
} from "../_shared/porta-handoff.ts";

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
