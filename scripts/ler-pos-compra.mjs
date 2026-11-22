#!/usr/bin/env node
/**
 * Leitura do PÓS-COMPRA QUE LEVA PRO APP (POS_COMPRA_APP, /oferta, 22/11). SÓ LÊ produção (helper _h.mjs). Sai só contagem:
 * nenhum e-mail, id, PI ou IP é impresso.
 *
 *   node scripts/ler-pos-compra.mjs <desde ISO> [até ISO] [--virada=<ISO do deploy>]
 *
 * 1) Funil do pós-compra (analytics_events, SEMPRE por event_name e em janelas de no máximo 1 dia):
 *    landing_stripe_pago (pagou na /oferta, navegador) → pos_compra_view → pos_compra_loja (ios/android) → copiar / navegador / ajuda.
 * 2) Compra DUPLA: comprador da web (subscriptions pix/stripe) que compra de novo NA LOJA (play_store = Apple e Google, via RevenueCat), mesma conta, em ≤ 24 h.
 *    Com --virada, separa ANTES × DEPOIS do deploy (a régua: hoje ~1,7% dos compradores da web — memória compra_dupla_web_app_16_11).
 */
import { db } from "/Users/joao/core/ferramentas-sessao/metricas/_h.mjs";

const args = process.argv.slice(2);
const virada = (args.find((a) => a.startsWith("--virada=")) || "").slice(9) || null;
const pos = args.filter((a) => !a.startsWith("--"));
const desde = pos[0], ate = pos[1] ?? new Date().toISOString();
if (!desde) { console.log("uso: node scripts/ler-pos-compra.mjs <desde ISO> [até ISO] [--virada=ISO]"); process.exit(1); }
const t0 = new Date(desde).getTime(), t1 = new Date(ate).getTime(), tv = virada ? new Date(virada).getTime() : null;
const iso = (t) => new Date(t).toISOString();

/* ── 1) os eventos, dia a dia (janela ≤ 1 dia, filtrado por event_name) ── */
const NOMES = ["landing_stripe_pago", "pos_compra_view", "pos_compra_loja", "pos_compra_copiar_email", "pos_compra_navegador", "pos_compra_ajuda", "pos_compra_aba"];
const DIA = 24 * 3600e3;
const ev = Object.fromEntries(NOMES.map((n) => [n, []]));
for (let a = t0; a < t1; a += DIA) {
  const b = Math.min(a + DIA, t1);
  const janela = `created_at=gte.${encodeURIComponent(iso(a))}&created_at=lt.${encodeURIComponent(iso(b))}`;
  const lotes = await Promise.all(NOMES.map((n) => db(`analytics_events?event_name=eq.${n}&${janela}&select=created_at,sid:event_data->>landing_session_id,dev:event_data->>landing_device_id,pagina:event_data->>pagina,loja:event_data->>loja,aparelho:event_data->>aparelho,via:event_data->>via,aba:event_data->>aba`)));
  NOMES.forEach((n, i) => ev[n].push(...lotes[i]));
}
const lado = (e) => (tv === null ? "tudo" : new Date(e.created_at).getTime() < tv ? "antes" : "depois");
const aparelhos = (lista, filtro = () => true) => new Set(lista.filter(filtro).map((e) => e.dev || e.sid)).size;
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");

console.log(`\nPÓS-COMPRA DA /oferta  ${desde} → ${ate}${virada ? `  (virada ${virada})` : ""}`);
for (const l of tv === null ? ["tudo"] : ["antes", "depois"]) {
  const f = (e) => lado(e) === l;
  const pagos = aparelhos(ev.landing_stripe_pago, (e) => f(e) && (e.pagina ?? "oferta") === "oferta");
  const viu = aparelhos(ev.pos_compra_view, f);
  console.log(`\n[${l}] pagaram na /oferta (aparelhos): ${pagos}`);
  console.log(`  viu o passo a passo: ${viu} (${pct(viu, pagos)}) · por aparelho: ${JSON.stringify(Object.fromEntries(["ios", "android", "computador"].map((k) => [k, aparelhos(ev.pos_compra_view, (e) => f(e) && e.aparelho === k)])))} · via recarga/faixa: ${aparelhos(ev.pos_compra_view, (e) => f(e) && e.via !== "pago")}`);
  const ios = aparelhos(ev.pos_compra_loja, (e) => f(e) && e.loja === "ios"), and = aparelhos(ev.pos_compra_loja, (e) => f(e) && e.loja === "android");
  console.log(`  tocou na loja: App Store ${ios} · Google Play ${and} (${pct(aparelhos(ev.pos_compra_loja, f), viu)} de quem viu)`);
  console.log(`  copiou o e-mail ${aparelhos(ev.pos_compra_copiar_email, f)} · navegador ${aparelhos(ev.pos_compra_navegador, f)} · ajuda ${aparelhos(ev.pos_compra_ajuda, f)} · trocou de aba ${aparelhos(ev.pos_compra_aba, f)}`);
}

/* ── 2) compra dupla: web → loja em ≤ 24 h, mesma conta ── */
const web = await db(`subscriptions?select=user_id,created_at,payment_method&payment_method=in.(pix,stripe)&created_at=gte.${encodeURIComponent(iso(t0))}&created_at=lt.${encodeURIComponent(iso(t1))}&order=created_at.asc`);
// as compras das lojas (RevenueCat) ficam TODAS em payment_method=play_store; a loja vem do id (…Aap… = Apple, …Gps… = Google)
const loja = await db(`subscriptions?select=user_id,created_at,payment_method,revenuecat_subscription_id&payment_method=eq.play_store&created_at=gte.${encodeURIComponent(iso(t0))}&created_at=lt.${encodeURIComponent(iso(t1 + DIA))}&order=created_at.asc`);
const lojaPorConta = {};
for (const s of loja) if (s.user_id) (lojaPorConta[s.user_id] ??= []).push(s);
const novo = () => ({ n: 0, dupla: 0, min: [], apple: 0, google: 0 });
const conta = { antes: novo(), depois: novo(), tudo: novo() };
const vistos = new Set();
for (const s of web) {
  if (!s.user_id || vistos.has(s.user_id)) continue; // 1 comprador = 1 vez (a 1ª compra da web na janela)
  vistos.add(s.user_id);
  const tw = new Date(s.created_at).getTime();
  const c = conta[tv === null ? "tudo" : tw < tv ? "antes" : "depois"];
  c.n += 1;
  const d = (lojaPorConta[s.user_id] ?? []).map((x) => ({ dt: new Date(x.created_at).getTime() - tw, apple: /Aap/.test(x.revenuecat_subscription_id ?? "") })).filter((x) => x.dt >= 0 && x.dt <= DIA);
  if (d.length) { c.dupla += 1; c.min.push(Math.round(Math.min(...d.map((x) => x.dt)) / 60e3)); if (d.some((x) => x.apple)) c.apple += 1; else c.google += 1; }
}
console.log("\nCOMPRA DUPLA (comprou na web e de novo na loja em ≤ 24 h, mesma conta)");
for (const l of tv === null ? ["tudo"] : ["antes", "depois"]) {
  const c = conta[l];
  const med = c.min.length ? c.min.sort((a, b) => a - b)[Math.floor(c.min.length / 2)] : null;
  console.log(`  [${l}] ${c.dupla} de ${c.n} compradores da web (${pct(c.dupla, c.n)}; iPhone ${c.apple} · Android ${c.google})${med !== null ? ` · mediana ${med} min depois` : ""}`);
}
console.log("\nObs.: a loja leva até ~1 dia pra cair em subscriptions (RevenueCat); a última janela pode subir depois.");
