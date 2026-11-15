/**
 * STRIPE-PRESENTE (15/11) — o presente de R$ 24,90 de quem comprou o CORE pra sempre na /oferta (Stripe). Regras em
 * ../_shared/stripe-presente.ts (testadas em src/test/stripe-presente.test.ts).
 *
 *   corpo { acao: "estado" | "cartao" | "pix" | "nome", ref, pi }   a aba da compra (o pós-pago da /oferta)
 *   corpo { acao: …, t }                                           o token do dia 3 / da página Você (/presente/dar)
 *   nome: + { pedido, nome }
 * Sem token e sem ref/pi que confiram → { ok:false, motivo:"compra" } (a /presente/dar cai no presente de sempre, 14,90 no Pix).
 *
 * Env PRESENTE_STRIPE ("on" liga a porta do token — /presente/dar e a entrada da página Você; padrão off). A porta da aba (ref+pi) não
 * depende dela: só é chamada com a chave UPSELL_OFERTA da página ligada.
 * Deploy (NÃO feito): `supabase functions deploy stripe-presente`. Secret: STRIPE_SECRET_KEY (a mesma do stripe-criar; precisa de
 * escrita em PaymentIntents, Customers e PaymentMethods — a do /funil-app já pede isso).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { formUrl } from "../_shared/stripe-criar.ts";
import { cartaoPresente, compraDoDono, compraPorRef, estadoPresente, nomePresente, pixPresente, presenteStripeLigado, RETORNO_PRESENTE } from "../_shared/stripe-presente.ts";
import { donoDoToken } from "../_shared/presente-dia3.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const log = (m: string, d: Record<string, unknown> = {}) => console.log(`[STRIPE-PRESENTE] ${m} ${JSON.stringify(d)}`);

async function stripe(caminho: string, pares: Array<[string, string]> | null, idem?: string): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: pares ? "POST" : "GET",
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded", ...(idem ? { "Idempotency-Key": idem } : {}) },
    ...(pares ? { body: formUrl(pares) } : {}),
  });
  return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ ok: false, motivo: "indisponivel" }, 503);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const acao = String(b.acao ?? "");
    if (!["estado", "cartao", "pix", "nome"].includes(acao)) return json({ ok: false }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const deps = { admin, stripe, log };
    let compra = null;
    // revisão A1: pelo TOKEN (a URL da /presente/dar pode ser repassada), o cartão salvo só com o JWT do PRÓPRIO dono; sem ele, só Pix
    let quem = { podeCartao: true };
    if (b.t !== undefined) {
      // revisão M1: a porta do token só com a chave do servidor (env PRESENTE_STRIPE=on). Off = a /presente/dar de hoje (14,90)
      if (!presenteStripeLigado(Deno.env.get("PRESENTE_STRIPE"))) return json({ ok: false, motivo: "compra" });
      const dono = await donoDoToken(admin, b.t);
      if (!dono) return json({ ok: false, motivo: "token" });
      compra = await compraDoDono(deps, dono);
      const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      let logado: string | null = null;
      if (jwt) { const { data } = await admin.auth.getUser(jwt).catch(() => ({ data: null })); logado = data?.user?.id ?? null; }
      quem = { podeCartao: logado === dono };
    } else compra = await compraPorRef(deps, b.ref, b.pi);
    if (!compra) return json({ ok: false, motivo: "compra" });
    const retorno = b.t !== undefined ? "https://www.coreaplicativo.com.br/presente/dar" : RETORNO_PRESENTE;
    const r = acao === "estado" ? await estadoPresente(deps, compra, quem)
      : acao === "cartao" ? await cartaoPresente(deps, compra, retorno, quem)
      : acao === "pix" ? await pixPresente(deps, compra)
      : await nomePresente(deps, compra, b.pedido, b.nome);
    return json(r.corpo, r.status);
  } catch (e) {
    log("erro", { msg: String(e).slice(0, 120) });
    return json({ ok: false }, 500);
  }
});
