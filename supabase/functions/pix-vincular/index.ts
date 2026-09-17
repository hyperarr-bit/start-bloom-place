import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * VINCULAR COMPRA ANÔNIMA À CONTA DE VERDADE (17/09).
 *
 * O funil da web vende ANTES do cadastro: o Pix nasce numa sessão anônima
 * (ver src/lib/sessao-anonima.ts). Na tela de cadastro depois de pagar, três
 * botões trocam de sessão em vez de batizar a anônima: "Continuar com o
 * Google" (o Google cria/entra em OUTRA conta), "já tenho conta" (senha, link
 * mágico ou código por e-mail) e "esqueci a senha". Resultado: a compra fica
 * presa na anônima e a conta em que a pessoa entrou cai no paywall. Dois
 * casos reais em 55 Pix (05/09 e 17/09), os dois pelo Google.
 *
 * O cliente guarda, ANTES de trocar de sessão, o token da sessão anônima
 * (`guardarCompraAnonima`). Depois do login, manda esse token aqui. Ter o
 * token É a prova de que a pessoa era dona da sessão anônima — ninguém mais
 * tem. A função confere, no servidor, que a anônima não tem e-mail (ou é
 * `is_anonymous`), tem Pix ativo, e a conta nova não tem assinatura — e então
 * MOVE a linha: mesma data, mesmo valor, sem venda duplicada.
 *
 * POST (Bearer = sessão NOVA) { tokenAnonimo, refreshAnonimo? }
 *   → { ok: true, plan, amount_cents }        movida
 *   → { ok: false, motivo }                    nada a fazer (sem erro)
 * Motivos: mesma_conta · token_invalido · origem_tem_email · origem_sem_pix ·
 *          destino_ja_tem_assinatura
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const anon = createClient(url, anonKey);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: quem } = await anon.auth.getUser(bearer);
    const destino = quem?.user;
    if (!destino) return json({ error: "sem_login" }, 401);

    const body = await req.json().catch(() => ({}));
    const tokenAnonimo = String(body.tokenAnonimo ?? "");
    const refreshAnonimo = String(body.refreshAnonimo ?? "");
    if (!tokenAnonimo && !refreshAnonimo) return json({ ok: false, motivo: "token_invalido" });

    // Dono da sessão anônima: pelo access token; se venceu (1 h), pelo refresh.
    let origem = tokenAnonimo ? (await anon.auth.getUser(tokenAnonimo)).data?.user ?? null : null;
    if (!origem && refreshAnonimo) {
      const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshAnonimo }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.access_token) origem = (await anon.auth.getUser(j.access_token)).data?.user ?? null;
    }
    if (!origem) return json({ ok: false, motivo: "token_invalido" });
    if (origem.id === destino.id) return json({ ok: false, motivo: "mesma_conta" });

    const { data: de } = await admin.auth.admin.getUserById(origem.id);
    const origemAnonima = de?.user?.is_anonymous === true || !de?.user?.email;
    if (!origemAnonima) return json({ ok: false, motivo: "origem_tem_email" });

    const { data: subDe } = await admin.from("subscriptions")
      .select("id, plan, billing_period, amount_cents, status, created_at")
      .eq("user_id", origem.id).eq("payment_method", "pix").maybeSingle();
    if (!subDe || subDe.status !== "active") return json({ ok: false, motivo: "origem_sem_pix" });
    const { data: subPara } = await admin.from("subscriptions").select("id, status").eq("user_id", destino.id).maybeSingle();
    if (subPara?.status === "active") return json({ ok: false, motivo: "destino_ja_tem_assinatura" });
    if (subPara?.id) await admin.from("subscriptions").delete().eq("id", subPara.id); // casca expirada dá lugar à paga

    const { error } = await admin.from("subscriptions")
      .update({ user_id: destino.id, customer_email: destino.email ?? null }).eq("id", subDe.id);
    if (error) return json({ error: `update: ${error.message}` }, 500);

    await admin.from("analytics_events").insert({
      user_id: destino.id, event_name: "compra_vinculada",
      event_data: { de: origem.id, plan: subDe.plan, amount_cents: subDe.amount_cents, pago_em: subDe.created_at, via: "funil" },
    }).then(() => {}, () => {});
    console.log(`[PIX-VINCULAR] ${origem.id} -> ${destino.id} (${subDe.plan}, ${subDe.amount_cents})`);
    return json({ ok: true, plan: subDe.plan, billing_period: subDe.billing_period, amount_cents: subDe.amount_cents });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
