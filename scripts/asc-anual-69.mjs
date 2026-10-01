/**
 * core_anual_69 — o IRMÃO de R$ 69,90 do core_anual_97 na App Store (01/10,
 * teste de preço 97,90 × 69,90 via RevenueCat Experiments).
 *
 * TRAVA DE CATÁLOGO (feedback-catalogo-e-caixa): produto novo criado por API
 * só está "pronto" depois de um diff de TODOS os campos contra o irmão que
 * comprovadamente vende. Este script faz as duas coisas:
 *
 *   node scripts/asc-anual-69.mjs diff              ← só leitura: compara o 69 com o 97, campo a campo
 *   node scripts/asc-anual-69.mjs criar             ← ENSAIO: imprime cada chamada que faria, não cria nada
 *   node scripts/asc-anual-69.mjs criar --executar  ← cria de verdade (DONO decide; nunca rodar sem ele)
 *
 * O que "igual ao 97" quer dizer (lido da API em 01/10, não de memória):
 *   grupo CORE Pro 22349268 · ONE_YEAR · groupLevel 1 · familySharable false
 *   · localização pt-BR "CORE Anual" / "16 módulos. 3 dias grátis, depois renova por ano." (≤ 55 chars)
 *   · preço BRA R$ 97,90 = tier 10269 + equalizações nos outros 174 territórios (175 preços)
 *   · disponível em 175 territórios, availableInNewTerritories true
 *   · oferta introdutória FREE_TRIAL · THREE_DAYS · 1 período · UPFRONT, 1 por território (175)
 *   · screenshot de revisão 1206×2622 (reaproveitado)
 *   · reviewNote citando o preço
 * No 69 muda SÓ: productId, name/reviewNote (texto) e o preço (tier 10227 = R$ 69,90, proceeds 57,34).
 *
 * Credenciais: Key ID / Issuer ID do .env.local (ASC_KEY_ID / ASC_ISSUER_ID) ou
 * --key-id/--issuer-id; a .p8 mora em ~/.appstoreconnect (fora do repo, que é público).
 *
 * Depois de criar (e do diff passar):
 *   1. App Store Connect (painel): Assinaturas → CORE Pro → core_anual_69 →
 *      "Adicionar para revisão" junto com a versão 1.0.9 (vai no mesmo envio).
 *   2. RevenueCat: produto core_anual_69 (App Store) no entitlement "CORE APP Pro";
 *      offering "anual_69" com $rc_annual = core_anual_69 e $rc_monthly = core_mensal;
 *      a offering atual (default) PRECISA ter $rc_annual = core_anual_97 (hoje ele não está em offering nenhuma).
 *   3. TRAVA DE CAIXA: 1 compra REAL do core_anual_69 (sandbox não basta) com a 1.0.9 no ar
 *      — conferir subscriptions.amount_cents = 6990 e o evento compra_anual_69 na Meta — ANTES de ligar o experimento.
 *   4. Experimento 50/50 (default × anual_69), só novos clientes, só app ≥ 1.0.9 (builds antigas compram o 97 por fora).
 */
import { createSign, createPrivateKey, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APP = "6806913181";
const GRUPO = "22349268";
const IRMAO = "6813548543"; // core_anual_97
const NOVO = {
  productId: "core_anual_69",
  name: "CORE Anual 69",
  reviewNote: "Assinatura anual com acesso a todos os 16 modulos do CORE. Oferta introdutoria: 3 dias gratis para novos assinantes, depois R$ 69,90 por ano. Mesmo produto do core_anual_97, so muda o preco (teste de preco).",
  tierBRA: "10227", // R$ 69,90 (customerPrice "69.9", proceeds 57,34) — lido de /pricePoints?filter[territory]=BRA em 01/10
  precoBRA: "69.9",
  localizacao: { locale: "pt-BR", name: "CORE Anual", description: "16 módulos. 3 dias grátis, depois renova por ano." },
};
const ESPERADO_IGUAL = { subscriptionPeriod: "ONE_YEAR", groupLevel: 1, familySharable: false, state: "APPROVED" };

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const doEnv = (n) => env.match(new RegExp(`^\\s*${n}\\s*=\\s*"?([^"\\n]+)"?`, "m"))?.[1];
const keyId = arg("key-id") ?? doEnv("ASC_KEY_ID");
const issuerId = arg("issuer-id") ?? doEnv("ASC_ISSUER_ID");
const p8 = arg("p8") ?? join(homedir(), ".appstoreconnect", `AuthKey_${keyId}.p8`);
if (!keyId || !issuerId || !existsSync(p8)) { console.error("✗ faltam ASC_KEY_ID/ASC_ISSUER_ID ou a .p8 em ~/.appstoreconnect"); process.exit(1); }

const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const token = () => {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }))}.${b64url(JSON.stringify({ iss: issuerId, iat: agora, exp: agora + 900, aud: "appstoreconnect-v1" }))}`;
  const s = createSign("SHA256").update(corpo).sign({ key: createPrivateKey(readFileSync(p8, "utf8")), dsaEncoding: "ieee-p1363" });
  return `${corpo}.${b64url(s)}`;
};
const modo = process.argv[2] ?? "diff";
const executar = process.argv.includes("--executar");
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(metodo, caminho, body, { tolerar = false } = {}) {
  const escreve = metodo !== "GET";
  if (escreve && !executar) { console.log(`  [ensaio] ${metodo} ${caminho} ${body ? JSON.stringify(body).slice(0, 160) + "…" : ""}`); return { ensaio: true, data: { id: "ENSAIO" } }; }
  const url = caminho.startsWith("http") ? caminho : `https://api.appstoreconnect.apple.com${caminho}`;
  const r = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* sem corpo */ }
  if (!r.ok) {
    const msg = `HTTP ${r.status} em ${metodo} ${caminho}: ${JSON.stringify(j?.errors?.map((e) => e.detail ?? e.title) ?? t).slice(0, 400)}`;
    if (tolerar) { console.warn("  ! " + msg); return null; }
    throw new Error(msg);
  }
  return j;
}
async function todos(caminho) {
  let url = caminho; const out = [];
  while (url) { const j = await api("GET", url); out.push(...(j.data ?? [])); url = j.links?.next ?? null; }
  return out;
}
const decodeId = (id) => { try { return JSON.parse(Buffer.from(id, "base64").toString()); } catch { return {}; } };

/* ------------------------------------------------------------ leitura de um produto, inteira */
async function lerProduto(id) {
  const sub = (await api("GET", `/v1/subscriptions/${id}`)).data;
  const locs = (await api("GET", `/v1/subscriptions/${id}/subscriptionLocalizations`)).data ?? [];
  const precos = await todos(`/v1/subscriptions/${id}/prices?include=subscriptionPricePoint,territory&limit=50`);
  const precoBRA = await api("GET", `/v1/subscriptions/${id}/prices?filter[territory]=BRA&include=subscriptionPricePoint&limit=50`);
  const ppBRA = precoBRA.included?.find((i) => i.type === "subscriptionPricePoints");
  const intros = await todos(`/v1/subscriptions/${id}/introductoryOffers?limit=50`);
  const introBRA = (await api("GET", `/v1/subscriptions/${id}/introductoryOffers?filter[territory]=BRA&limit=50`)).data?.[0];
  const disp = await api("GET", `/v1/subscriptions/${id}/subscriptionAvailability`, undefined, { tolerar: true });
  const terr = disp ? await todos(`/v1/subscriptionAvailabilities/${id}/availableTerritories?limit=200`) : [];
  const shot = (await api("GET", `/v1/subscriptions/${id}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data ?? null;
  return {
    id, attrs: sub.attributes, grupo: sub.relationships?.group?.data?.id,
    locs: locs.map((l) => ({ locale: l.attributes.locale, name: l.attributes.name, description: l.attributes.description, state: l.attributes.state })),
    precos: { total: precos.length, territorios: precos.map((p) => p.relationships?.territory?.data?.id).filter(Boolean).sort(), tierBRA: ppBRA ? decodeId(ppBRA.id).p : null, precoBRA: ppBRA?.attributes?.customerPrice ?? null, proceedsBRA: ppBRA?.attributes?.proceeds ?? null, planTypes: [...new Set(precos.map((p) => p.attributes.planType))], preservados: precos.filter((p) => p.attributes.preserved).length },
    intros: { total: intros.length, BRA: introBRA ? { duration: introBRA.attributes.duration, offerMode: introBRA.attributes.offerMode, numberOfPeriods: introBRA.attributes.numberOfPeriods, targetSubscriptionPlanType: introBRA.attributes.targetSubscriptionPlanType, endDate: introBRA.attributes.endDate } : null, modos: [...new Set(intros.map((i) => `${i.attributes.offerMode}/${i.attributes.duration}/${i.attributes.numberOfPeriods}`))] },
    disponibilidade: { availableInNewTerritories: disp?.data?.attributes?.availableInNewTerritories ?? null, total: terr.length, territorios: terr.map((t) => t.id).sort() },
    screenshot: shot ? { state: shot.attributes.assetDeliveryState?.state, w: shot.attributes.imageAsset?.width, h: shot.attributes.imageAsset?.height, fileSize: shot.attributes.fileSize } : null,
  };
}

async function acharNovo() {
  const lista = (await api("GET", `/v1/subscriptionGroups/${GRUPO}/subscriptions?limit=50`)).data ?? [];
  return lista.find((s) => s.attributes.productId === NOVO.productId) ?? null;
}

/* ------------------------------------------------------------ diff campo a campo */
async function diff() {
  const novo = await acharNovo();
  if (!novo) { console.log(`✗ ${NOVO.productId} ainda não existe no grupo ${GRUPO}. Rode "criar" primeiro (com --executar quando o dono mandar).`); process.exit(2); }
  console.log(`lendo ${IRMAO} (core_anual_97) e ${novo.id} (${NOVO.productId})…`);
  const [a, b] = await Promise.all([lerProduto(IRMAO), lerProduto(novo.id)]);
  let falhas = 0;
  const linha = (campo, va, vb, esperadoIgual = true, ok = esperadoIgual ? JSON.stringify(va) === JSON.stringify(vb) : JSON.stringify(va) !== JSON.stringify(vb)) => {
    if (!ok) falhas++;
    console.log(`${ok ? "  ok " : "  !! "}${campo.padEnd(44)} 97: ${JSON.stringify(va)?.slice(0, 60)}   69: ${JSON.stringify(vb)?.slice(0, 60)}${esperadoIgual ? "" : "   (tem que ser diferente)"}`);
  };
  console.log("\n— atributos");
  for (const k of ["subscriptionPeriod", "groupLevel", "familySharable", "multiSeatStatus", "marketSettings"]) linha(`attributes.${k}`, a.attrs[k], b.attrs[k]);
  linha("attributes.productId", a.attrs.productId, b.attrs.productId, false);
  linha("attributes.state (APPROVED só depois da revisão)", a.attrs.state, b.attrs.state, true, ["APPROVED", "WAITING_FOR_REVIEW", "READY_TO_SUBMIT", "IN_REVIEW"].includes(b.attrs.state));
  linha("reviewNote cita o preço certo", /97,90/.test(a.attrs.reviewNote ?? ""), /69,90/.test(b.attrs.reviewNote ?? ""), true, /69,90/.test(b.attrs.reviewNote ?? "") && !/97,90/.test(b.attrs.reviewNote ?? ""));
  linha("grupo", a.grupo, b.grupo);
  console.log("\n— localização");
  linha("locs (locale/name/description)", a.locs.map((l) => [l.locale, l.name, l.description]), b.locs.map((l) => [l.locale, l.name, l.description]));
  console.log("\n— preço");
  linha("preços: nº de territórios", a.precos.total, b.precos.total);
  linha("preços: territórios iguais", a.precos.territorios, b.precos.territorios);
  linha("preços: planType", a.precos.planTypes, b.precos.planTypes);
  linha("preços: preservados (tem que ser 0)", a.precos.preservados, b.precos.preservados);
  linha("preço BRA (tier)", a.precos.tierBRA, b.precos.tierBRA, false);
  linha("preço BRA = 69,90", "97.9", b.precos.precoBRA, true, b.precos.precoBRA === NOVO.precoBRA);
  console.log("\n— oferta introdutória (3 dias grátis)");
  linha("intros: nº de territórios", a.intros.total, b.intros.total);
  linha("intros: modos", a.intros.modos, b.intros.modos);
  linha("intro BRA", a.intros.BRA, b.intros.BRA);
  console.log("\n— disponibilidade");
  linha("availableInNewTerritories", a.disponibilidade.availableInNewTerritories, b.disponibilidade.availableInNewTerritories);
  linha("territórios disponíveis (nº)", a.disponibilidade.total, b.disponibilidade.total);
  linha("territórios disponíveis (lista)", a.disponibilidade.territorios, b.disponibilidade.territorios);
  console.log("\n— screenshot de revisão");
  linha("screenshot (state/w/h)", a.screenshot && { state: a.screenshot.state, w: a.screenshot.w, h: a.screenshot.h }, b.screenshot && { state: b.screenshot.state, w: b.screenshot.w, h: b.screenshot.h });
  console.log(falhas ? `\n✗ ${falhas} diferença(s) fora do esperado — NÃO está pronto (regra: "ACTIVE" ≠ "comprável").\n` : "\n✓ core_anual_69 é cópia fiel do core_anual_97 — só muda id, nome, nota e preço.\n");
  process.exit(falhas ? 1 : 0);
}

/* ------------------------------------------------------------ criação (ensaio por padrão) */
async function criar() {
  if (await acharNovo()) { console.log(`${NOVO.productId} já existe no grupo ${GRUPO} — nada a criar. Rode "diff".`); process.exit(0); }
  console.log(executar ? "\n⚠ EXECUTANDO de verdade no App Store Connect.\n" : "\n[ENSAIO] nada será criado — cada chamada abaixo é só impressa. Rode com --executar quando o dono autorizar.\n");
  console.log("lendo o irmão core_anual_97 pra copiar territórios…");
  const irmao = await lerProduto(IRMAO);
  if (irmao.disponibilidade.total !== 175 || irmao.precos.total !== 175 || irmao.intros.total !== 175) {
    console.error(`✗ o irmão não está como eu esperava (territórios ${irmao.disponibilidade.total}, preços ${irmao.precos.total}, intros ${irmao.intros.total}) — pare e confira antes.`); process.exit(1);
  }

  // 1. a assinatura no grupo
  console.log("\n1) assinatura");
  const sub = await api("POST", "/v1/subscriptions", { data: { type: "subscriptions", attributes: { name: NOVO.name, productId: NOVO.productId, subscriptionPeriod: "ONE_YEAR", familySharable: false, reviewNote: NOVO.reviewNote, groupLevel: 1 }, relationships: { group: { data: { type: "subscriptionGroups", id: GRUPO } } } } });
  const id = sub.data.id;
  console.log("   id:", id);

  // 2. localização pt-BR (descrição ≤ 55 chars — a Apple recusa mais)
  console.log("\n2) localização pt-BR");
  if (NOVO.localizacao.description.length > 55) { console.error("✗ descrição > 55 chars"); process.exit(1); }
  await api("POST", "/v1/subscriptionLocalizations", { data: { type: "subscriptionLocalizations", attributes: NOVO.localizacao, relationships: { subscription: { data: { type: "subscriptions", id } } } } });

  // 3. preço BRA (tier 10227 = R$ 69,90) + equalizações nos outros territórios
  console.log("\n3) preço BRA R$ 69,90 + equalizações");
  let ppBRA = b64url(JSON.stringify({ s: id, t: "BRA", p: NOVO.tierBRA }));
  if (executar) {
    const pps = await todos(`/v1/subscriptions/${id}/pricePoints?filter[territory]=BRA&limit=200`);
    const certo = pps.find((p) => p.attributes.customerPrice === NOVO.precoBRA);
    if (!certo) { console.error("✗ não achei o degrau R$ 69,90 na lista de preços do produto novo"); process.exit(1); }
    ppBRA = certo.id;
    console.log("   price point BRA:", ppBRA, decodeId(ppBRA));
  }
  await api("POST", "/v1/subscriptionPrices", { data: { type: "subscriptionPrices", relationships: { subscription: { data: { type: "subscriptions", id } }, subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: ppBRA } }, territory: { data: { type: "territories", id: "BRA" } } } } });
  const equal = executar ? await todos(`/v1/subscriptionPricePoints/${ppBRA}/equalizations?include=territory&limit=200`) : [];
  console.log(`   equalizações: ${executar ? equal.length : "(ensaio: lidas na execução, ~174)"}`);
  for (const e of equal) {
    const terr = e.relationships?.territory?.data?.id ?? decodeId(e.id).t;
    if (!terr || terr === "BRA") continue;
    await api("POST", "/v1/subscriptionPrices", { data: { type: "subscriptionPrices", relationships: { subscription: { data: { type: "subscriptions", id } }, subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: e.id } }, territory: { data: { type: "territories", id: terr } } } } }, { tolerar: true });
    await dorme(120);
  }

  // 4. disponibilidade: os mesmos 175 territórios do irmão
  console.log("\n4) disponibilidade (175 territórios, availableInNewTerritories true)");
  await api("POST", "/v1/subscriptionAvailabilities", { data: { type: "subscriptionAvailabilities", attributes: { availableInNewTerritories: true }, relationships: { subscription: { data: { type: "subscriptions", id } }, availableTerritories: { data: irmao.disponibilidade.territorios.map((t) => ({ type: "territories", id: t })) } } } });

  // 5. oferta introdutória: 3 dias grátis, 1 POST por território (a API exige territory)
  console.log("\n5) oferta introdutória FREE_TRIAL · THREE_DAYS em cada um dos 175 territórios");
  for (const t of irmao.disponibilidade.territorios) {
    await api("POST", "/v1/subscriptionIntroductoryOffers", { data: { type: "subscriptionIntroductoryOffers", attributes: { duration: "THREE_DAYS", offerMode: "FREE_TRIAL", numberOfPeriods: 1 }, relationships: { subscription: { data: { type: "subscriptions", id } }, territory: { data: { type: "territories", id: t } } } } }, { tolerar: true });
    if (!executar) break; // no ensaio, mostra um só
    await dorme(120);
  }

  // 6. screenshot de revisão: a mesma imagem do irmão (baixa do templateUrl → reserva → PUT → PATCH com md5)
  console.log("\n6) screenshot de revisão (cópia do irmão)");
  const shot = (await api("GET", `/v1/subscriptions/${IRMAO}/appStoreReviewScreenshot`)).data;
  const tpl = shot.attributes.imageAsset.templateUrl; const w = shot.attributes.imageAsset.width; const h = shot.attributes.imageAsset.height;
  const urlImg = tpl.replace("{w}", w).replace("{h}", h).replace("{f}", "png");
  if (executar) {
    const bytes = Buffer.from(await (await fetch(urlImg)).arrayBuffer());
    const criado = await api("POST", "/v1/subscriptionAppStoreReviewScreenshots", { data: { type: "subscriptionAppStoreReviewScreenshots", attributes: { fileSize: bytes.length, fileName: "revisao-core-anual-69.png" }, relationships: { subscription: { data: { type: "subscriptions", id } } } } });
    const op = criado.data.attributes.uploadOperations?.[0];
    const put = await fetch(op.url, { method: op.method, headers: Object.fromEntries((op.requestHeaders ?? []).map((x) => [x.name, x.value])), body: bytes });
    if (!put.ok) { console.error("✗ upload do screenshot falhou", put.status); process.exit(1); }
    const md5 = createHash("md5").update(bytes).digest("hex");
    await api("PATCH", `/v1/subscriptionAppStoreReviewScreenshots/${criado.data.id}`, { data: { type: "subscriptionAppStoreReviewScreenshots", id: criado.data.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  } else {
    console.log("   [ensaio] baixaria", urlImg, "→ POST reserva → PUT bytes → PATCH uploaded+md5");
  }

  console.log(`\n${executar ? "✓ criado." : "[ensaio terminado]"} Próximos passos (mão do dono):
   a) node scripts/asc-anual-69.mjs diff   ← tem que terminar em ✓ (trava de catálogo)
   b) App Store Connect → Assinaturas → CORE Pro → ${NOVO.productId} → "Adicionar para revisão" (vai junto com a 1.0.9)
   c) RevenueCat → Product catalog → produto ${NOVO.productId} (App Store) → anexar ao entitlement "CORE APP Pro"
      → Offerings: "anual_69" com $rc_annual = ${NOVO.productId} (+ $rc_monthly = core_mensal); a default com $rc_annual = core_anual_97
   d) TRAVA DE CAIXA: 1 compra real do ${NOVO.productId} na 1.0.9 (ver cabeçalho) antes de ligar o experimento 50/50.`);
}

if (modo === "diff") await diff();
else if (modo === "criar") await criar();
else { console.error("uso: node scripts/asc-anual-69.mjs diff | criar [--executar]"); process.exit(1); }
