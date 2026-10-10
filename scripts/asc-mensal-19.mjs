/**
 * core_mensal_19 — o IRMÃO de R$ 19,90 do core_mensal na App Store (10/10, ofertas
 * de saída da 1.0.14: "prefere ir devagar?" pra quem fechou a folha do mensal,
 * recusou o presente de 69,90 durante o teste, ou perdeu o acesso).
 *
 * TRAVA DE CATÁLOGO (feedback-catalogo-e-caixa): produto novo criado por API só
 * está "pronto" depois de um diff de TODOS os campos contra o irmão que
 * comprovadamente vende. Este script faz as duas coisas:
 *
 *   node scripts/asc-mensal-19.mjs diff              ← só leitura: compara o 19 com o core_mensal, campo a campo
 *   node scripts/asc-mensal-19.mjs criar             ← ENSAIO (padrão): imprime cada chamada que faria, não cria nada
 *   node scripts/asc-mensal-19.mjs criar --executar  ← cria de verdade (DONO decide; nunca rodar sem ele)
 *
 * O que "igual ao core_mensal" quer dizer (lido da API na hora, não de memória):
 *   grupo CORE Pro 22349268 · ONE_MONTH · familySharable false
 *   · localização pt-BR própria ("CORE Mensal", descrição ≤ 55 chars)
 *   · disponível nos MESMOS territórios do irmão ANTES do preço (a API recusa preço sem disponibilidade)
 *   · preço BRA R$ 19,90 (price point lido de /pricePoints?filter[territory]=BRA na execução, customerPrice "19.9")
 *     + equalizações nos outros territórios
 *   · SEM oferta introdutória: o 19,90 é o degrau "sem teste" (quem chega aqui ou já usou o teste,
 *     ou acabou de recusar o teste do anual). O Offer Code INSTA7 continua só no core_mensal.
 *   · screenshot de revisão copiado do irmão
 * O que MUDA de propósito, além de id/nome/nota/preço:
 *   · groupLevel 2 (o core_mensal e os anuais estão no nível 1). É isso que faz anual → core_mensal_19
 *     ser DOWNGRADE na Apple: entra no FIM do período atual (= fim do teste de 3 dias), e é o que o
 *     texto da escada promete ("você continua no teste e só paga 19,90 quando ele acabar").
 *     core_mensal_19 → qualquer nível 1 é UPGRADE (entra na hora, com proporção).
 *
 * Credenciais: Key ID / Issuer ID do .env.local (ASC_KEY_ID / ASC_ISSUER_ID) ou
 * --key-id/--issuer-id; a .p8 mora em ~/.appstoreconnect (fora do repo, que é público).
 * Nunca imprime token nem chave.
 *
 * Depois de criar (e do diff passar) — mão do dono:
 *   1. App Store Connect (painel): Assinaturas → CORE Pro → core_mensal_19 → "Adicionar para
 *      revisão" junto com a versão 1.0.14 (vai no mesmo envio).
 *   2. RevenueCat: Product catalog → produto core_mensal_19 (App Store) → anexar ao entitlement
 *      "CORE APP Pro"; Offerings → nova offering "mensal_19" com $rc_monthly = core_mensal_19
 *      (NÃO mexer na current nem na anual_69). Sem essa offering o app ignora as chaves do 19,90.
 *   3. TRAVA DE CAIXA: 1 compra REAL do core_mensal_19 (sandbox não basta) com a 1.0.14 no ar
 *      — conferir subscriptions.amount_cents = 1990 — ANTES de ligar OFERTA_MENSAL_19 / SAIDA_TESTE_ESCADA.
 */
import { createSign, createPrivateKey, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const GRUPO = "22349268";
const IRMAO_PRODUCT_ID = "core_mensal"; // achado pelo productId no grupo (o id numérico não está anotado em lugar nenhum)
const NOVO = {
  productId: "core_mensal_19",
  name: "CORE Mensal 19",
  reviewNote: "Assinatura mensal com acesso a todos os 16 modulos do CORE, R$ 19,90 por mes, sem periodo gratis. Mesmo produto do core_mensal, so muda o preco (oferta de saida para quem nao assinou o plano anual).",
  precoBRA: "19.9", // customerPrice do price point BRA, lido na execução
  groupLevel: 2,     // abaixo dos anuais e do core_mensal (nível 1): anual → 19,90 é downgrade (fim do período)
  localizacao: { locale: "pt-BR", name: "CORE Mensal", description: "16 módulos. Renova todo mês, cancele quando quiser." },
};

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
  const disp = await api("GET", `/v1/subscriptions/${id}/subscriptionAvailability`, undefined, { tolerar: true });
  const terr = disp ? await todos(`/v1/subscriptionAvailabilities/${id}/availableTerritories?limit=200`) : [];
  const shot = (await api("GET", `/v1/subscriptions/${id}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data ?? null;
  return {
    id, attrs: sub.attributes, grupo: sub.relationships?.group?.data?.id,
    locs: locs.map((l) => ({ locale: l.attributes.locale, name: l.attributes.name, description: l.attributes.description, state: l.attributes.state })),
    precos: { total: precos.length, territorios: precos.map((p) => p.relationships?.territory?.data?.id).filter(Boolean).sort(), tierBRA: ppBRA ? decodeId(ppBRA.id).p : null, precoBRA: ppBRA?.attributes?.customerPrice ?? null, proceedsBRA: ppBRA?.attributes?.proceeds ?? null, planTypes: [...new Set(precos.map((p) => p.attributes.planType))], preservados: precos.filter((p) => p.attributes.preserved).length },
    intros: { total: intros.length, modos: [...new Set(intros.map((i) => `${i.attributes.offerMode}/${i.attributes.duration}/${i.attributes.numberOfPeriods}`))] },
    disponibilidade: { availableInNewTerritories: disp?.data?.attributes?.availableInNewTerritories ?? null, total: terr.length, territorios: terr.map((t) => t.id).sort() },
    screenshot: shot ? { state: shot.attributes.assetDeliveryState?.state, w: shot.attributes.imageAsset?.width, h: shot.attributes.imageAsset?.height, fileSize: shot.attributes.fileSize } : null,
  };
}

async function noGrupo(productId) {
  const lista = (await api("GET", `/v1/subscriptionGroups/${GRUPO}/subscriptions?limit=50`)).data ?? [];
  return lista.find((s) => s.attributes.productId === productId) ?? null;
}
async function acharIrmao() {
  const irmao = await noGrupo(IRMAO_PRODUCT_ID);
  if (!irmao) { console.error(`✗ não achei ${IRMAO_PRODUCT_ID} no grupo ${GRUPO} — pare e confira.`); process.exit(1); }
  return irmao.id;
}

/* ------------------------------------------------------------ diff campo a campo */
async function diff() {
  const novo = await noGrupo(NOVO.productId);
  if (!novo) { console.log(`✗ ${NOVO.productId} ainda não existe no grupo ${GRUPO}. Rode "criar" primeiro (com --executar quando o dono mandar).`); process.exit(2); }
  const irmaoId = await acharIrmao();
  console.log(`lendo ${irmaoId} (${IRMAO_PRODUCT_ID}) e ${novo.id} (${NOVO.productId})…`);
  const [a, b] = await Promise.all([lerProduto(irmaoId), lerProduto(novo.id)]);
  let falhas = 0;
  const linha = (campo, va, vb, esperadoIgual = true, ok = esperadoIgual ? JSON.stringify(va) === JSON.stringify(vb) : JSON.stringify(va) !== JSON.stringify(vb)) => {
    if (!ok) falhas++;
    console.log(`${ok ? "  ok " : "  !! "}${campo.padEnd(44)} mensal: ${JSON.stringify(va)?.slice(0, 60)}   19: ${JSON.stringify(vb)?.slice(0, 60)}${esperadoIgual ? "" : "   (tem que ser diferente)"}`);
  };
  console.log("\n— atributos");
  for (const k of ["subscriptionPeriod", "familySharable", "multiSeatStatus", "marketSettings"]) linha(`attributes.${k}`, a.attrs[k], b.attrs[k]);
  linha("attributes.subscriptionPeriod = ONE_MONTH", "ONE_MONTH", b.attrs.subscriptionPeriod, true, b.attrs.subscriptionPeriod === "ONE_MONTH");
  linha(`attributes.groupLevel = ${NOVO.groupLevel} (downgrade a partir do anual)`, a.attrs.groupLevel, b.attrs.groupLevel, true, b.attrs.groupLevel === NOVO.groupLevel);
  linha("attributes.productId", a.attrs.productId, b.attrs.productId, false);
  linha("attributes.state (APPROVED só depois da revisão)", a.attrs.state, b.attrs.state, true, ["APPROVED", "WAITING_FOR_REVIEW", "READY_TO_SUBMIT", "IN_REVIEW"].includes(b.attrs.state));
  linha("reviewNote cita o preço certo", /24,90/.test(a.attrs.reviewNote ?? ""), /19,90/.test(b.attrs.reviewNote ?? ""), true, /19,90/.test(b.attrs.reviewNote ?? "") && !/24,90/.test(b.attrs.reviewNote ?? ""));
  linha("grupo", a.grupo, b.grupo);
  console.log("\n— localização");
  linha("locs: locales", a.locs.map((l) => l.locale), b.locs.map((l) => l.locale));
  linha("loc pt-BR (name/description)", NOVO.localizacao, b.locs.find((l) => l.locale === "pt-BR") && { locale: "pt-BR", name: b.locs.find((l) => l.locale === "pt-BR").name, description: b.locs.find((l) => l.locale === "pt-BR").description });
  console.log("\n— preço");
  linha("preços: nº de territórios", a.precos.total, b.precos.total);
  linha("preços: territórios iguais", a.precos.territorios, b.precos.territorios);
  linha("preços: planType", a.precos.planTypes, b.precos.planTypes);
  linha("preços: preservados (tem que ser 0)", a.precos.preservados, b.precos.preservados);
  linha("preço BRA (tier)", a.precos.tierBRA, b.precos.tierBRA, false);
  linha("preço BRA = 19,90", a.precos.precoBRA, b.precos.precoBRA, true, b.precos.precoBRA === NOVO.precoBRA);
  console.log("\n— oferta introdutória (o 19 NÃO tem)");
  linha("intros no 19 = 0", a.intros.total, b.intros.total, true, b.intros.total === 0);
  console.log("\n— disponibilidade");
  linha("availableInNewTerritories", a.disponibilidade.availableInNewTerritories, b.disponibilidade.availableInNewTerritories);
  linha("territórios disponíveis (nº)", a.disponibilidade.total, b.disponibilidade.total);
  linha("territórios disponíveis (lista)", a.disponibilidade.territorios, b.disponibilidade.territorios);
  console.log("\n— screenshot de revisão");
  linha("screenshot (state/w/h)", a.screenshot && { state: a.screenshot.state, w: a.screenshot.w, h: a.screenshot.h }, b.screenshot && { state: b.screenshot.state, w: b.screenshot.w, h: b.screenshot.h });
  console.log(falhas ? `\n✗ ${falhas} diferença(s) fora do esperado — NÃO está pronto (regra: "ACTIVE" ≠ "comprável").\n` : `\n✓ ${NOVO.productId} é cópia fiel do ${IRMAO_PRODUCT_ID} — só muda id, nome, nota, preço, nível e (sem) intro.\n`);
  process.exit(falhas ? 1 : 0);
}

/* ------------------------------------------------------------ criação (ensaio por padrão) */
async function criar() {
  console.log(executar ? "\n⚠ EXECUTANDO de verdade no App Store Connect.\n" : "\n[ENSAIO] nada será criado — cada chamada abaixo é só impressa. Rode com --executar quando o dono autorizar.\n");
  const irmaoId = await acharIrmao();
  console.log(`lendo o irmão ${IRMAO_PRODUCT_ID} (${irmaoId}) pra copiar territórios…`);
  const irmao = await lerProduto(irmaoId);
  if (!irmao.disponibilidade.total || irmao.precos.total !== irmao.disponibilidade.total) {
    console.error(`✗ o irmão não está como eu esperava (territórios ${irmao.disponibilidade.total}, preços ${irmao.precos.total}) — pare e confira antes.`); process.exit(1);
  }
  if (irmao.attrs.subscriptionPeriod !== "ONE_MONTH") { console.error(`✗ o irmão não é ONE_MONTH (${irmao.attrs.subscriptionPeriod}) — pare.`); process.exit(1); }
  /* RETOMÁVEL (lição do asc-anual-69, 01/10): cada etapa confere o que já existe antes de
   * criar — a DISPONIBILIDADE tem que vir ANTES do preço (HTTP 409 se inverter). */

  // 1. a assinatura no grupo
  console.log("\n1) assinatura (ONE_MONTH, groupLevel 2, familySharable false)");
  let sub = await noGrupo(NOVO.productId);
  if (sub) console.log("   já existe:", sub.id);
  else {
    sub = (await api("POST", "/v1/subscriptions", { data: { type: "subscriptions", attributes: { name: NOVO.name, productId: NOVO.productId, subscriptionPeriod: "ONE_MONTH", familySharable: false, reviewNote: NOVO.reviewNote, groupLevel: NOVO.groupLevel }, relationships: { group: { data: { type: "subscriptionGroups", id: GRUPO } } } } })).data;
    console.log("   id:", sub.id);
  }
  const id = sub.id;
  const existe = id !== "ENSAIO";

  // 2. localização pt-BR (descrição ≤ 55 chars — a Apple recusa mais)
  console.log("\n2) localização pt-BR");
  if (NOVO.localizacao.description.length > 55) { console.error("✗ descrição > 55 chars"); process.exit(1); }
  const locs = existe ? ((await api("GET", `/v1/subscriptions/${id}/subscriptionLocalizations`)).data ?? []) : [];
  if (locs.some((l) => l.attributes.locale === "pt-BR")) console.log("   já existe");
  else await api("POST", "/v1/subscriptionLocalizations", { data: { type: "subscriptionLocalizations", attributes: NOVO.localizacao, relationships: { subscription: { data: { type: "subscriptions", id } } } } });

  // 3. disponibilidade: os mesmos territórios do irmão (ANTES do preço)
  console.log(`\n3) disponibilidade (${irmao.disponibilidade.total} territórios, availableInNewTerritories ${irmao.disponibilidade.availableInNewTerritories})`);
  const disp = existe ? await api("GET", `/v1/subscriptions/${id}/subscriptionAvailability`, undefined, { tolerar: true }) : null;
  const terrAtuais = disp ? (await todos(`/v1/subscriptionAvailabilities/${id}/availableTerritories?limit=200`)).map((t) => t.id) : [];
  if (terrAtuais.length === irmao.disponibilidade.total) console.log("   já existe:", terrAtuais.length, "territórios");
  else await api("POST", "/v1/subscriptionAvailabilities", { data: { type: "subscriptionAvailabilities", attributes: { availableInNewTerritories: irmao.disponibilidade.availableInNewTerritories !== false }, relationships: { subscription: { data: { type: "subscriptions", id } }, availableTerritories: { data: irmao.disponibilidade.territorios.map((t) => ({ type: "territories", id: t })) } } } });

  // 4. preço BRA R$ 19,90 + equalizações nos outros territórios
  console.log("\n4) preço BRA R$ 19,90 + equalizações");
  const precosAtuais = existe ? await todos(`/v1/subscriptions/${id}/prices?include=territory&limit=50`) : [];
  const terrComPreco = new Set(precosAtuais.map((p) => p.relationships?.territory?.data?.id).filter(Boolean));
  let ppBRA = "ENSAIO_PRICE_POINT_BRA_19_90";
  if (executar) {
    const pps = await todos(`/v1/subscriptions/${id}/pricePoints?filter[territory]=BRA&limit=200`);
    const certo = pps.find((p) => p.attributes.customerPrice === NOVO.precoBRA);
    if (!certo) { console.error("✗ não achei o degrau R$ 19,90 na lista de preços do produto novo"); process.exit(1); }
    ppBRA = certo.id;
    console.log("   price point BRA:", ppBRA, decodeId(ppBRA), "proceeds", certo.attributes.proceeds);
  } else {
    console.log("   [ensaio] price point BRA lido de /pricePoints?filter[territory]=BRA (customerPrice 19.9) na execução");
  }
  if (terrComPreco.has("BRA")) console.log("   BRA já tem preço");
  else await api("POST", "/v1/subscriptionPrices", { data: { type: "subscriptionPrices", relationships: { subscription: { data: { type: "subscriptions", id } }, subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: ppBRA } }, territory: { data: { type: "territories", id: "BRA" } } } } });
  const equal = executar ? await todos(`/v1/subscriptionPricePoints/${ppBRA}/equalizations?include=territory&limit=200`) : [];
  console.log(`   equalizações: ${executar ? equal.length : `(ensaio: lidas na execução, ~${irmao.disponibilidade.total - 1})`}; já com preço: ${terrComPreco.size}`);
  let criados = 0;
  for (const e of equal) {
    const terr = e.relationships?.territory?.data?.id ?? decodeId(e.id).t;
    if (!terr || terr === "BRA" || terrComPreco.has(terr)) continue;
    const r = await api("POST", "/v1/subscriptionPrices", { data: { type: "subscriptionPrices", relationships: { subscription: { data: { type: "subscriptions", id } }, subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: e.id } }, territory: { data: { type: "territories", id: terr } } } } }, { tolerar: true });
    if (r) criados++;
    await dorme(120);
  }
  if (executar) console.log(`   preços criados agora: ${criados}`);

  // 5. SEM oferta introdutória (de propósito — ver cabeçalho)
  console.log("\n5) oferta introdutória: NENHUMA (o 19,90 é o degrau sem teste)");

  // 6. screenshot de revisão: a mesma imagem do irmão (baixa do templateUrl → reserva → PUT → PATCH com md5)
  console.log("\n6) screenshot de revisão (cópia do irmão)");
  const shotAtual = existe ? (await api("GET", `/v1/subscriptions/${id}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data : null;
  const shot = (await api("GET", `/v1/subscriptions/${irmaoId}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data;
  if (!shot) console.log("   ! o irmão não tem screenshot de revisão — anexar pelo painel antes de enviar");
  else {
    const tpl = shot.attributes.imageAsset.templateUrl; const w = shot.attributes.imageAsset.width; const h = shot.attributes.imageAsset.height;
    const urlImg = tpl.replace("{w}", w).replace("{h}", h).replace("{f}", "png");
    if (shotAtual?.attributes?.assetDeliveryState?.state === "COMPLETE") console.log("   já existe (COMPLETE)");
    else if (executar) {
      const bytes = Buffer.from(await (await fetch(urlImg)).arrayBuffer());
      const criado = await api("POST", "/v1/subscriptionAppStoreReviewScreenshots", { data: { type: "subscriptionAppStoreReviewScreenshots", attributes: { fileSize: bytes.length, fileName: "revisao-core-mensal-19.png" }, relationships: { subscription: { data: { type: "subscriptions", id } } } } });
      const op = criado.data.attributes.uploadOperations?.[0];
      const put = await fetch(op.url, { method: op.method, headers: Object.fromEntries((op.requestHeaders ?? []).map((x) => [x.name, x.value])), body: bytes });
      if (!put.ok) { console.error("✗ upload do screenshot falhou", put.status); process.exit(1); }
      const md5 = createHash("md5").update(bytes).digest("hex");
      await api("PATCH", `/v1/subscriptionAppStoreReviewScreenshots/${criado.data.id}`, { data: { type: "subscriptionAppStoreReviewScreenshots", id: criado.data.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
      console.log("   enviado:", bytes.length, "bytes, md5", md5);
    } else {
      console.log("   [ensaio] baixaria", urlImg, "→ POST reserva → PUT bytes → PATCH uploaded+md5");
    }
  }

  console.log(`\n${executar ? "✓ criado/completado." : "[ensaio terminado]"} Próximos passos (mão do dono):
   a) node scripts/asc-mensal-19.mjs diff   ← tem que terminar em ✓ (trava de catálogo)
   b) App Store Connect → Assinaturas → CORE Pro → ${NOVO.productId} → "Adicionar para revisão" (vai junto com a 1.0.14)
   c) RevenueCat → Product catalog → produto ${NOVO.productId} (App Store) → anexar ao entitlement "CORE APP Pro"
      → Offerings: NOVA offering "mensal_19" com $rc_monthly = ${NOVO.productId} (a current e a anual_69 ficam como estão)
   d) TRAVA DE CAIXA: 1 compra real do ${NOVO.productId} na 1.0.14 (amount_cents 1990) antes de ligar OFERTA_MENSAL_19 / SAIDA_TESTE_ESCADA.`);
}

if (modo === "diff") await diff();
else if (modo === "criar") await criar();
else { console.error("uso: node scripts/asc-mensal-19.mjs diff | criar [--executar]"); process.exit(1); }
