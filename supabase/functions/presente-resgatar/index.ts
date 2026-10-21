import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  assuntoPresenteRecebido, contaDoComprador, corpoResend, decidirResgate, htmlPresenteRecebido, linkDoPresente,
  mandarLinkPorEmail, nomeNoCartao, normalizarCodigo, presentePorCodigo, presentePorPedido, resgatarPresente, type LinhaMin, type Presente,
} from "../_shared/presente.ts";

/**
 * O PRESENTE DO CORE (21/10) — o lado de quem deu e de quem ganhou. Regras em ../_shared/presente.ts.
 *
 * Uma rota, 5 ações (verify_jwt = false no config.toml: o `ver` é chamado pela página /presente/<código> SEM conta;
 * as outras conferem o JWT aqui dentro):
 *   ver      { codigo }            SEM login → { estado: "livre" | "usado" | "nao_existe", de }   (só o nome do cartão)
 *   meu      { pedido }            quem COMPROU → { codigo, link, de, resgatado }  (a tela do cartão, inclusive recarregada)
 *   nome     { pedido, nome }      quem COMPROU → grava o nome do cartão ("Ana te deu…"), só antes do resgate
 *   email    { pedido }            quem COMPROU → manda o link pro e-mail da conta, 1x por pedido (o /hoje pede depois de
 *                                  salvar o e-mail; no /inicio o check já mandou)
 *   resgatar { codigo }            quem GANHOU (conta com e-mail) → vitalício (linha própria payment_method "presente");
 *                                  já tem o CORE pra sempre → "ja_tem" (o código segue valendo); o próprio comprador →
 *                                  "proprio"; usado → "usado"; quem já resgatou ESTE → "ja_e_seu" (sucesso de novo)
 * NUNCA usa liberar_vitalicio (duplicaria a venda): a linha nasce com o pedido do presente e o valor dele, 1 vez.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
const log = (passo: string, d?: unknown) => console.log(`[PRESENTE] ${passo}${d ? " - " + JSON.stringify(d) : ""}`);

const remetente = () => Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
async function enviarCorpoResend(corpo: Record<string, unknown>): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  }).catch(() => null);
  return !!r?.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const acao = String(body.action ?? "");

    // ------------------------------------------------------------------ VER (sem login)
    if (acao === "ver") {
      const p = await presentePorCodigo(admin, normalizarCodigo(body.codigo));
      if (!p) return json({ ok: true, estado: "nao_existe", de: null });
      return json({ ok: true, estado: p.resgatado_por ? "usado" : "livre", de: p.de_nome ?? null });
    }

    // daqui pra baixo: com login
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: auth } = await anon.auth.getUser(token).catch(() => ({ data: null }));
    const user = auth?.user ?? null;
    if (!user) return json({ ok: false, motivo: "sem_login" }, 401);
    const emailUser = user.email ? user.email.trim().toLowerCase() : null;

    const linhasDe = async (uid: string): Promise<LinhaMin[]> => {
      const { data } = await admin.from("subscriptions").select("status, plan, billing_period, current_period_end, abacatepay_billing_id").eq("user_id", uid);
      return (data ?? []) as LinhaMin[];
    };
    const emailDe = async (uid: string): Promise<string | null> => {
      const { data } = await admin.auth.admin.getUserById(uid);
      return data?.user?.email ?? null;
    };
    /** O presente do pedido, só se esta conta é a de quem comprou. */
    const doDono = async (): Promise<Presente | null> => {
      const pedido = String(body.pedido ?? "").slice(0, 80);
      if (!pedido) return null;
      const p = await presentePorPedido(admin, pedido);
      if (!p) return null;
      const dono = await contaDoComprador(admin, {
        compradorId: p.comprador_id, compradorEmail: p.comprador_id === user.id ? emailUser : await emailDe(p.comprador_id),
        userId: user.id, userEmail: emailUser, linhasDoUsuario: p.comprador_id === user.id ? [] : await linhasDe(user.id),
      });
      return dono ? p : null;
    };

    // ------------------------------------------------------------------ MEU
    if (acao === "meu") {
      const p = await doDono();
      if (!p) return json({ ok: false, motivo: "ainda_nao" });
      return json({ ok: true, codigo: p.codigo, link: linkDoPresente(p.codigo), de: p.de_nome ?? null, resgatado: !!p.resgatado_por });
    }

    // ------------------------------------------------------------------ NOME
    if (acao === "nome") {
      const p = await doDono();
      if (!p) return json({ ok: false, motivo: "pedido" });
      if (p.resgatado_por) return json({ ok: true, de: p.de_nome ?? null, resgatado: true });
      const de = nomeNoCartao(body.nome);
      await admin.from("presentes").update({ de_nome: de }).eq("codigo", p.codigo);
      return json({ ok: true, de });
    }

    // ------------------------------------------------------------------ EMAIL
    if (acao === "email") {
      const p = await doDono();
      if (!p) return json({ ok: false, motivo: "pedido" });
      const r = await mandarLinkPorEmail(admin, { orderId: p.pedido, codigo: p.codigo, para: emailUser, deNome: p.de_nome, de: remetente(), enviar: enviarCorpoResend });
      return json({ ok: r === "enviado" || r === "ja", r });
    }

    // ------------------------------------------------------------------ RESGATAR
    if (acao === "resgatar") {
      const codigo = normalizarCodigo(body.codigo);
      const p = await presentePorCodigo(admin, codigo);
      const linhas = await linhasDe(user.id);
      const doComprador = p
        ? await contaDoComprador(admin, {
          compradorId: p.comprador_id, compradorEmail: p.comprador_id === user.id ? emailUser : await emailDe(p.comprador_id),
          userId: user.id, userEmail: emailUser, linhasDoUsuario: linhas,
        })
        : false;
      const decisao = decidirResgate({ presente: p, userId: user.id, userEmail: emailUser, doComprador, linhas });
      if (decisao === "ja_e_seu") return json({ ok: true, r: "ja_e_seu", de: p?.de_nome ?? null });
      if (decisao !== "ok" || !p) {
        log("Resgate recusado", { motivo: decisao, codigo: codigo.slice(0, 3) });
        return json({ ok: false, motivo: decisao, de: p?.de_nome ?? null });
      }
      const res = await resgatarPresente(admin, { presente: p, userId: user.id, userEmail: emailUser! });
      if (res.r === "usado") return json({ ok: false, motivo: "usado", de: p.de_nome ?? null });
      if (res.r === "erro") { log("Resgate falhou", { msg: res.msg }); return json({ ok: false, motivo: "erro" }); }
      await admin.from("analytics_events").insert({
        user_id: user.id, event_name: "presente_resgatado_servidor",
        event_data: { codigo: p.codigo, pedido: p.pedido, comprador: p.comprador_id, valor_centavos: p.valor_centavos },
      }).then(() => {}, () => {});
      await enviarCorpoResend(corpoResend(remetente(), emailUser!, assuntoPresenteRecebido(), htmlPresenteRecebido({ email: emailUser!, deNome: p.de_nome })));
      log("Presente resgatado", { codigo: codigo.slice(0, 3) });
      return json({ ok: true, r: "ok", de: p.de_nome ?? null, fim: res.fim });
    }

    return json({ ok: false, motivo: "acao" }, 400);
  } catch (e) {
    log("ERRO", { e: String(e).slice(0, 200) });
    return json({ ok: false, motivo: "erro" }, 500);
  }
});
