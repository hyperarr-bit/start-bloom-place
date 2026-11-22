#!/usr/bin/env node
/**
 * Leitura do SORTEIO DE PREÇO da /oferta (AB_PRECO_OFERTA: R$ 27,90 · R$ 47,90 · R$ 67,90). SÓ LEITURA de produção (helper _h.mjs).
 *   node scripts/ler-preco-3.mjs <desde ISO> [até ISO] [custo por visita em R$]
 *   ex.: node scripts/ler-preco-3.mjs 2026-12-04T00:00:00-03:00 2026-12-11T00:00:00-03:00 0.95
 *
 * Regras da casa: analytics_events SEMPRE filtrado por event_name, em janelas de no máximo 1 dia por consulta. Nunca lê user_data.
 * Sai só contagem e dinheiro: nenhum e-mail, nome, id ou IP.
 *
 * A unidade do sorteio é o APARELHO (landing_device_id): "visitas" = aparelhos que abriram a /oferta naquele braço. Fica de fora quem
 * forçou o braço (?preco=, preco_forcado) — a compra de teste do dono sai numa linha à parte.
 * A venda vem do stripe_venda (servidor, só a /oferta): braco_preco nela; sem o campo, o braço vem do aparelho que gerou o Pix/pagou.
 * Reembolso/contestação (linha "canceled" em subscriptions) sai da receita.
 *
 * LUCRO = receita − taxa da Stripe (~5% do bruto) − Simples (15,5% do bruto) = 79,5% do bruto. O anúncio custa o MESMO por visita nos
 * 3 braços (o sorteio é depois do clique), então a comparação justa é LUCRO POR VISITA; com o custo por visita (3º argumento) sai
 * também o lucro por visita já descontado o anúncio.
 */
import { db } from "/Users/joao/core/ferramentas-sessao/metricas/_h.mjs";

const [desdeArg, ateArg, custoArg] = process.argv.slice(2);
if (!desdeArg) { console.log("uso: node scripts/ler-preco-3.mjs <desde ISO> [até ISO] [custo por visita R$]"); process.exit(1); }
const desde = new Date(desdeArg), ate = ateArg ? new Date(ateArg) : new Date();
const custoVisita = custoArg !== undefined ? Number(String(custoArg).replace(",", ".")) : null;
if (!(desde < ate)) { console.log("a janela está vazia (desde >= até)"); process.exit(1); }

const TAXA_STRIPE = 0.05, SIMPLES = 0.155;
const LUCRO_POR_REAL = 1 - TAXA_STRIPE - SIMPLES;
const BRACOS = ["2790", "4790", "6790"];
const DIA_MS = 24 * 3600e3;

/** os pedaços de no máximo 1 dia */
const janelas = [];
for (let t = desde.getTime(); t < ate.getTime(); t += DIA_MS) janelas.push([new Date(t).toISOString(), new Date(Math.min(t + DIA_MS, ate.getTime())).toISOString()]);
const CAMPOS = "select=dev:event_data->>landing_device_id,braco:event_data->>braco_preco,forcado:event_data->>preco_forcado,pi:event_data->>pi,onde:event_data->>onde";
/** um evento da /oferta, dia a dia (sempre por event_name) */
async function ev(nome, extra = "") {
  const out = [];
  for (const [a, b] of janelas) {
    out.push(...await db(`analytics_events?event_name=eq.${nome}&event_data->>pagina=eq.oferta&created_at=gte.${encodeURIComponent(a)}&created_at=lt.${encodeURIComponent(b)}&${CAMPOS}${extra}`));
  }
  return out;
}
async function vendasStripe() {
  const out = [];
  for (const [a, b] of janelas) {
    out.push(...await db(`analytics_events?event_name=eq.stripe_venda&event_data->>pagina=eq.oferta&created_at=gte.${encodeURIComponent(a)}&created_at=lt.${encodeURIComponent(b)}&select=pi:event_data->>pi,valor:event_data->>valor_cents,braco:event_data->>braco_preco,metodo:event_data->>metodo`));
  }
  return out;
}

const html = await ev("landing_html");
const [ctas, abriu, pixGerado, pagoNav, lojas, vendas] = [await ev("landing_cta"), await ev("landing_stripe_aberto"), await ev("landing_stripe_pix_gerado"), await ev("landing_stripe_pago"), await ev("landing_loja"), await vendasStripe()];

// aparelho → braço (o 1º que apareceu; o braço é fixo por aparelho) e os forçados (fora)
const bracoDoDev = {}; const forcados = new Set();
for (const e of [...html, ...ctas, ...abriu, ...pixGerado, ...pagoNav, ...lojas]) {
  if (!e.dev) continue;
  if (e.forcado === "true") { forcados.add(e.dev); continue; }
  if (BRACOS.includes(e.braco) && !bracoDoDev[e.dev]) bracoDoDev[e.dev] = e.braco;
}
const conta = (lista) => { const c = Object.fromEntries(BRACOS.map((b) => [b, new Set()])); for (const e of lista) { const b = bracoDoDev[e.dev]; if (b && !forcados.has(e.dev)) c[b].add(e.dev); } return c; };
const toques = (lista) => { const c = Object.fromEntries(BRACOS.map((b) => [b, 0])); for (const e of lista) { const b = bracoDoDev[e.dev]; if (b && !forcados.has(e.dev)) c[b] += 1; } return c; };
const visitas = conta(html), clicaram = conta(ctas), abriram = conta(abriu), geraramPix = conta(pixGerado), tocaramLoja = conta(lojas);
const nToquesLoja = toques(lojas);

// venda → braço: o campo do servidor; senão o aparelho que gerou o Pix / viu o pago
const bracoDoPi = {}; const piForcado = new Set();
for (const e of [...pixGerado, ...pagoNav]) {
  if (!e.pi) continue;
  if (e.forcado === "true" || forcados.has(e.dev)) piForcado.add(e.pi);
  else if (bracoDoDev[e.dev]) bracoDoPi[e.pi] ??= bracoDoDev[e.dev];
}
const vistos = new Set();
const v = Object.fromEntries([...BRACOS, "sem_braco", "forcadas"].map((k) => [k, []]));
for (const x of vendas) {
  if (!x.pi || vistos.has(x.pi)) continue;
  vistos.add(x.pi);
  const b = piForcado.has(x.pi) ? "forcadas" : BRACOS.includes(x.braco) ? x.braco : bracoDoPi[x.pi] ?? "sem_braco";
  v[b].push(x);
}
// reembolso/contestação: a linha da compra virou "canceled" (só o id do PI é lido)
const pis = [...vistos];
const canceladas = new Set();
for (let i = 0; i < pis.length; i += 100) {
  const l = await db(`subscriptions?payment_method=eq.stripe&status=eq.canceled&abacatepay_billing_id=in.(${pis.slice(i, i + 100).join(",")})&select=abacatepay_billing_id`);
  for (const s of l) canceladas.add(s.abacatepay_billing_id);
}

const R = (n) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1).replace(".", ",")}%` : "–");
console.log(`\nSORTEIO DE PREÇO /oferta · ${desde.toISOString()} → ${ate.toISOString()} (${janelas.length} janela(s) de até 1 dia)`);
console.log(`lucro = bruto × ${LUCRO_POR_REAL.toFixed(3).replace(".", ",")} (Stripe ~5% + Simples 15,5%)${custoVisita !== null ? ` · custo do anúncio por visita: ${R(custoVisita)}` : ""}\n`);
const linhas = [];
for (const b of BRACOS) {
  const n = visitas[b].size;
  const pagas = v[b].filter((x) => !canceladas.has(x.pi));
  const receita = pagas.reduce((s, x) => s + Number(x.valor || 0), 0) / 100;
  const lucro = receita * LUCRO_POR_REAL;
  linhas.push({ b, n, receita, lucro });
  console.log(`R$ ${b.slice(0, 2)},${b.slice(2)}  · visitas (aparelhos) ${n}`);
  console.log(`  tocou no botão (landing_cta) ${clicaram[b].size} (${pct(clicaram[b].size, n)}) · abriu o checkout ${abriram[b].size} (${pct(abriram[b].size, n)}) · gerou Pix ${geraramPix[b].size} (${pct(geraramPix[b].size, n)})`);
  console.log(`  pagaram ${pagas.length} (${pct(pagas.length, n)} das visitas · ${pct(pagas.length, abriram[b].size)} de quem abriu) · reembolso/contestação ${v[b].length - pagas.length}`);
  console.log(`  pix ${pagas.filter((x) => x.metodo === "pix").length} · cartão ${pagas.filter((x) => x.metodo === "card").length}`);
  console.log(`  receita ${R(receita)} · receita/visita ${n ? R(receita / n) : "–"} · LUCRO/visita ${n ? R(lucro / n) : "–"}${custoVisita !== null && n ? ` · lucro/visita − anúncio ${R(lucro / n - custoVisita)}` : ""}`);
  console.log(`  toques em loja (landing_loja) ${nToquesLoja[b]} · aparelhos que tocaram ${tocaramLoja[b].size} · por visita ${n ? (nToquesLoja[b] / n).toFixed(3).replace(".", ",") : "–"}\n`);
}
const melhor = linhas.filter((l) => l.n).sort((a, z) => z.lucro / z.n - a.lucro / a.n)[0];
if (melhor) console.log(`maior lucro por visita até agora: R$ ${melhor.b.slice(0, 2)},${melhor.b.slice(2)} (${R(melhor.lucro / melhor.n)}) — com poucas vendas por braço é ruído; não decidir antes de ~30 vendas no braço mais fraco.`);
// 2 a 2: diferença de venda por visita (orientação; a decisão é por LUCRO por visita)
for (let i = 0; i < BRACOS.length; i++) for (let j = i + 1; j < BRACOS.length; j++) {
  const [a, b] = [BRACOS[i], BRACOS[j]];
  const n1 = visitas[a].size, n2 = visitas[b].size, x1 = v[a].length, x2 = v[b].length;
  if (!n1 || !n2) continue;
  const p = (x1 + x2) / (n1 + n2), z = (x2 / n2 - x1 / n1) / (Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)) || 1);
  console.log(`venda/visita ${b} − ${a}: z ${z.toFixed(2)}`);
}
console.log(`\nvendas sem braço: ${v.sem_braco.length} · aparelhos forçados (fora): ${forcados.size} · vendas forçadas (fora, ex.: compra de teste do dono): ${v.forcadas.length}`);
