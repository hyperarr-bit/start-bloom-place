#!/usr/bin/env node
/**
 * Leitura do A/B da página da /oferta (AB_OFERTA_LP). Só lê produção (helper _h.mjs), por event_name e janela.
 *   node scripts/ler-ab-oferta-lp.mjs 2026-11-06T12:00:00-03:00 [até]
 * A unidade do sorteio é o APARELHO. Métrica principal: R$ bruto por aparelho. Fica de fora quem forçou o braço (?lpo=), e a venda dele também (sai numa linha à parte).
 * A venda vem do stripe_venda (servidor). Sem braco_lp_oferta nela, o braço vem do aparelho/sessão do stripe_order_created.
 * Sai só contagem: nenhum e-mail, id ou IP.
 */
import { db } from "/Users/joao/core/ferramentas-sessao/metricas/_h.mjs";

const desde = process.argv[2], ate = process.argv[3] ?? new Date().toISOString();
if (!desde) { console.log("uso: node scripts/ler-ab-oferta-lp.mjs <desde ISO> [até ISO]"); process.exit(1); }
const janela = `created_at=gte.${encodeURIComponent(new Date(desde).toISOString())}&created_at=lt.${encodeURIComponent(new Date(ate).toISOString())}`;
const campos = "select=session_id,sid:event_data->>landing_session_id,dev:event_data->>landing_device_id,braco:event_data->>braco_lp_oferta,forcado:event_data->>lpo_forcado,bloco:event_data->>bloco,de:event_data->>de,pi:event_data->>pi";
const ev = (nome, extra = "") => db(`analytics_events?event_name=eq.${nome}&event_data->>pagina=eq.oferta&${janela}&${campos}${extra}`);

const [html, abriu, pagar, blocos, ctas, pixGerado, pagoNav, pedidos, vendas] = await Promise.all([
  ev("landing_html"), ev("landing_stripe_aberto"), ev("landing_stripe_pagar"), ev("landing_bloco"), ev("landing_cta"), ev("landing_stripe_pix_gerado"), ev("landing_stripe_pago"),
  db(`analytics_events?event_name=eq.stripe_order_created&${janela}&select=session_id,pi:event_data->>pi`),
  db(`analytics_events?event_name=eq.stripe_venda&${janela}&select=pi:event_data->>pi,valor:event_data->>valor_cents,braco:event_data->>braco_lp_oferta,metodo:event_data->>metodo`),
]);

const BR = ["atual", "nova"];
const devDoBraco = {}; const devDaSessao = {}; const fora = new Set();
for (const e of html) {
  if (e.sid) devDaSessao[e.sid] = e.dev;
  if (e.forcado === "true") { fora.add(e.dev); continue; }
  if (e.dev && BR.includes(e.braco)) devDoBraco[e.dev] = e.braco;
}
const contar = (lista) => { const c = { atual: new Set(), nova: new Set() }; for (const e of lista) { const b = devDoBraco[e.dev]; if (b && !fora.has(e.dev)) c[b].add(e.dev); } return c; };
const aparelhos = contar(html), abriram = contar(abriu), pagaram = contar(pagar);

// venda → braço: campo no stripe_venda; senão o PI visto no navegador; senão a sessão do pedido
const bracoDoPi = {};
for (const e of [...pixGerado, ...pagoNav]) if (e.pi && devDoBraco[e.dev]) bracoDoPi[e.pi] = devDoBraco[e.dev];
for (const p of pedidos) { const dev = devDaSessao[p.session_id]; if (p.pi && dev && devDoBraco[dev] && !bracoDoPi[p.pi]) bracoDoPi[p.pi] = devDoBraco[dev]; }
// compra feita com ?lpo= (a de teste do dono): o braço vai na metadata, mas o aparelho não está no denominador
const piForcado = new Set();
for (const e of [...pixGerado, ...pagoNav]) if (e.pi && (e.forcado === "true" || fora.has(e.dev))) piForcado.add(e.pi);
for (const p of pedidos) if (p.pi && fora.has(devDaSessao[p.session_id])) piForcado.add(p.pi);
const v = { atual: [], nova: [], sem_braco: [], forcadas: [] };
for (const x of vendas) (piForcado.has(x.pi) ? v.forcadas : v[BR.includes(x.braco) ? x.braco : bracoDoPi[x.pi] ?? "sem_braco"]).push(x);

const pis = vendas.map((x) => x.pi).filter(Boolean);
const canceladas = new Set();
for (let i = 0; i < pis.length; i += 100) {
  const l = await db(`subscriptions?payment_method=eq.stripe&status=eq.canceled&abacatepay_billing_id=in.(${pis.slice(i, i + 100).join(",")})&select=abacatepay_billing_id`);
  for (const s of l) canceladas.add(s.abacatepay_billing_id);
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");
const reais = (l) => l.reduce((s, x) => s + Number(x.valor || 0), 0) / 100;
for (const b of BR) {
  const n = aparelhos[b].size, r = reais(v[b]);
  console.log(`\n${b.toUpperCase()}  aparelhos ${n}`);
  console.log(`  R$ bruto/aparelho ${n ? (r / n).toFixed(2) : "–"}  (R$ ${r.toFixed(2)}, ${v[b].length} vendas, ${pct(v[b].length, n)})`);
  console.log(`  abriu o checkout ${abriram[b].size} (${pct(abriram[b].size, n)}) · tocou Pagar ${pagaram[b].size} · paga depois de abrir ${pct(v[b].length, abriram[b].size)}`);
  console.log(`  reembolso/disputa ${v[b].filter((x) => canceladas.has(x.pi)).length} de ${v[b].length}`);
  const porBloco = {};
  for (const e of blocos) if (devDoBraco[e.dev] === b && !fora.has(e.dev)) (porBloco[e.bloco] ??= new Set()).add(e.dev);
  console.log("  chegou no bloco: " + Object.entries(porBloco).sort((x, y) => y[1].size - x[1].size).map(([k, s]) => `${k} ${pct(s.size, n)}`).join(" · "));
  const porBotao = {};
  for (const e of ctas) if (devDoBraco[e.dev] === b && !fora.has(e.dev)) porBotao[e.de ?? "(sem de)"] = (porBotao[e.de ?? "(sem de)"] ?? 0) + 1;
  console.log("  toques: " + JSON.stringify(porBotao));
}
// teste de 2 proporções (venda por aparelho), só pra orientar: a decisão é por R$
const [n1, n2] = BR.map((b) => aparelhos[b].size), [x1, x2] = BR.map((b) => v[b].length);
if (n1 && n2) {
  const p = (x1 + x2) / (n1 + n2), z = (x2 / n2 - x1 / n1) / Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2) || 1);
  const pv = 2 * (1 - 0.5 * (1 + Math.tanh(0.7978845608 * (Math.abs(z) + 0.044715 * Math.abs(z) ** 3))));
  console.log(`\nnova − atual, venda/aparelho: z ${z.toFixed(2)}, p ≈ ${pv.toFixed(3)}`);
}
console.log(`vendas sem braço: ${v.sem_braco.length} · aparelhos forçados (fora): ${fora.size} · vendas forçadas (fora): ${v.forcadas.length}`);
