/**
 * AVISAR-VENDA (29/10) — manda o push "💰 Venda · R$ 97,90 · Apple anual" pros aparelhos do dono (tabela push_dono).
 *
 * Quem chama: os gatilhos da migração 20261029010000_aviso_venda.sql, via pg_net, com a chave ANON no Authorization
 * (o mesmo padrão dos crons do pix-reconcile / meta-backfill-app). O corpo traz só PONTEIROS:
 *   { fonte: "pix", id }                        → linha de subscriptions (Pix do site)
 *   { fonte: "loja", id }                       → linha de analytics_events (marcador meta_capi_app_enviado)
 *   { fonte: "renovacao", id, fim_antigo }      → linha de subscriptions (loja) cujo fim andou
 * A função RELÊ tudo com a service role e decide pelas regras de _shared/aviso-venda.ts — nunca confia no corpo
 * pra valor/rótulo. Idempotente pela tabela venda_avisada (chave primária = a venda). Com a chave anon, o pior que
 * alguém consegue é fazer o dono receber o aviso de uma venda que de fato aconteceu e ainda não tinha sido avisada.
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT. Sem eles registra a venda e não manda nada.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corpoVenda, dadosPush, diaBRT, inicioDiaBRT, tituloVenda, vendaLoja, vendaPix, vendaRenovacao, type LinhaSub, type Venda } from "../_shared/aviso-venda.ts";
import { chavesVapidDoAmbiente, mandarParaTodos } from "../_shared/push-dono.ts";

const COLS = "id,user_id,status,plan,billing_period,payment_method,amount_cents,customer_email,current_period_start,current_period_end,created_at,abacatepay_billing_id,revenuecat_subscription_id";
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const log = (m: string, d: Record<string, unknown> = {}) => console.log(`[AVISAR-VENDA] ${m} ${JSON.stringify(d)}`);

serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  try {
    const body = await req.json().catch(() => ({}));
    const fonte = String(body?.fonte ?? "");
    const id = String(body?.id ?? "").slice(0, 80);
    if (!id) return json({ ok: false });

    let venda: Venda | null = null;
    if (fonte === "pix" || fonte === "renovacao") {
      const { data } = await admin.from("subscriptions").select(COLS).eq("id", id).maybeSingle();
      if (data) venda = fonte === "pix" ? vendaPix(data as LinhaSub) : vendaRenovacao(data as LinhaSub, body?.fim_antigo ? String(body.fim_antigo) : null);
    } else if (fonte === "loja") {
      const { data: ev } = await admin.from("analytics_events").select("event_name,event_data,created_at").eq("id", id).maybeSingle();
      const tx = String((ev?.event_data as { tx?: string } | null)?.tx ?? "");
      if (ev && tx) {
        const { data: linha } = await admin.from("subscriptions").select(COLS).eq("revenuecat_subscription_id", tx).limit(1).maybeSingle();
        // Exige a linha da loja com esse tx (um marcador solto não vira aviso) e, em assinatura (sub…), a receita no
        // RevenueCat — a mesma pergunta do meta-backfill-app. Sem resposta do RevenueCat, confia no marcador.
        if (linha) venda = vendaLoja(ev as { event_name: string; event_data: { tx?: string; valor?: number } }, linha as LinhaSub);
        if (venda && /^sub/.test(tx) && (await cobrancaConfirmada(String((linha as LinhaSub).user_id ?? ""), tx)) === false) venda = null;
      }
    }
    if (!venda) return json({ ok: true, aviso: "nao_e_venda" });

    // Reserva ANTES de mandar: a chave primária resolve a corrida (webhook + cron gravando o mesmo marcador).
    const titulo = tituloVenda(venda);
    const { error: erroReserva } = await admin.from("venda_avisada").insert({
      chave: venda.chave, origem: venda.origem, valor_cents: venda.valor_cents, plano: venda.plano, renovacao: venda.renovacao, titulo,
    });
    if (erroReserva) return json({ ok: true, aviso: "ja_avisada" });

    const { data: hoje } = await admin.from("venda_avisada").select("valor_cents").gte("criado_em", inicioDiaBRT(diaBRT(Date.now())));
    const total = (hoje ?? []).reduce((s: number, r: { valor_cents: number }) => s + Number(r.valor_cents ?? 0), 0);
    const enviados = await mandarParaTodos(admin, chavesVapidDoAmbiente(), dadosPush(titulo, corpoVenda(total, (hoje ?? []).length), venda.chave));
    await admin.from("venda_avisada").update({ enviados }).eq("chave", venda.chave);
    log("avisada", { origem: venda.origem, valor: venda.valor_cents, enviados });
    return json({ ok: true, enviados });
  } catch (e) {
    log("erro", { msg: String(e).slice(0, 160) });
    return json({ ok: false }, 500);
  }
});

async function cobrancaConfirmada(userId: string, tx: string): Promise<boolean | null> {
  const secret = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  if (!secret || !userId) return null;
  try {
    const projeto = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "proj1f095041";
    const r = await fetch(`https://api.revenuecat.com/v2/projects/${projeto}/customers/${encodeURIComponent(userId)}/subscriptions`, { headers: { Authorization: `Bearer ${secret}` } });
    if (!r.ok) return null;
    const sub = ((await r.json())?.items ?? []).find((x: { id?: string }) => x?.id === tx);
    if (!sub) return null;
    if (sub.status === "trialing") return false;
    return Number(sub?.total_revenue_in_usd?.gross ?? 0) > 0;
  } catch {
    return null;
  }
}
