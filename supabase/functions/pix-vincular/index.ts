import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { COLUNAS_DECISAO, linhasProprias, type LinhaAssinatura } from "../_shared/linha-pix.ts";
import { copiarDadosDaAnonima } from "../_shared/copiar-dados-anonima.ts";

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
 *
 * 18/10 (funil da missão): com a anônima provada (o token), os DADOS dela (user_data — o dia 1 que a convidada montou
 * antes de pagar) vão junto pra conta de destino, só as chaves que o destino não tem ou tem vazias
 * (_shared/copiar-dados-anonima.ts). Acontece em todo veredito depois da prova, até sem Pix pra mover; a resposta
 * leva `dados` (quantas chaves copiou; -1 = falhou).
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

    const dados = await copiarDadosDaAnonima(admin, origem.id, destino.id);
    if (dados !== 0) console.log(`[PIX-VINCULAR] dados ${origem.id} -> ${destino.id}: ${dados}`);

    /* 18/10 (/hoje): a sessão anônima pode ter MAIS de uma linha de Pix — o plano + os upsells (o "pra sempre" e o
     * "+2 anos" ganham linha própria, ver _shared/grant-pix.ts `linhaNova`). Todas vão juntas; a de fim mais distante
     * é a que responde (como antes). */
    const { data: subsDe } = await admin.from("subscriptions")
      .select("id, plan, billing_period, amount_cents, status, created_at")
      .eq("user_id", origem.id).eq("payment_method", "pix").eq("status", "active")
      .order("current_period_end", { ascending: false }).limit(10);
    const todasDe = (subsDe ?? []) as Array<{ id: string; plan: string; billing_period: string; amount_cents: number | null; status: string; created_at: string }>;
    const subDe = todasDe[0];
    if (!subDe || subDe.status !== "active") return json({ ok: false, motivo: "origem_sem_pix", dados });
    /* 01/10: no destino só as linhas PRÓPRIAS contam — a da App Store/Play é do
     * RevenueCat: nem barra o vínculo (carência da Apple + Pix pago) nem pode
     * ser apagada (ver _shared/linha-pix.ts). */
    const { data: todasPara } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", destino.id);
    const propriasPara = linhasProprias((todasPara ?? []) as LinhaAssinatura[]);
    if (propriasPara.some((l) => l.status === "active")) return json({ ok: false, motivo: "destino_ja_tem_assinatura", dados });
    for (const casca of propriasPara) await admin.from("subscriptions").delete().eq("id", casca.id); // casca expirada dá lugar à paga

    const { error } = await admin.from("subscriptions")
      .update({ user_id: destino.id, customer_email: destino.email ?? null }).in("id", todasDe.map((l) => l.id));
    if (error) return json({ error: `update: ${error.message}` }, 500);

    await admin.from("analytics_events").insert({
      user_id: destino.id, event_name: "compra_vinculada",
      event_data: { de: origem.id, plan: subDe.plan, amount_cents: subDe.amount_cents, pago_em: subDe.created_at, via: "funil", linhas: todasDe.length, dados },
    }).then(() => {}, () => {});
    console.log(`[PIX-VINCULAR] ${origem.id} -> ${destino.id} (${subDe.plan}, ${subDe.amount_cents})`);
    return json({ ok: true, plan: subDe.plan, billing_period: subDe.billing_period, amount_cents: subDe.amount_cents, dados });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
