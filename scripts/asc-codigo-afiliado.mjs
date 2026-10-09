/**
 * CÓDIGO DE AFILIADA NA APP STORE (09/10/2026).
 *
 * Cria, no core_anual_97 (assinatura 6813548543 do app 6806913181), a OFERTA
 * DE CÓDIGO da afiliada — 7 dias grátis (FREE_TRIAL · ONE_WEEK · 1 período),
 * só clientes novos (customerEligibilities NEW), no lugar da oferta
 * introdutória de 3 dias (REPLACE_INTRO_OFFERS) — e um CUSTOM CODE igual ao
 * código dela. A afiliada divulga:
 *   https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=<CODIGO>
 *
 * POR QUE UMA OFERTA POR AFILIADA (e não uma oferta "Afiliados" com vários
 * códigos): a Apple não entrega o custom code na transação. O StoreKit diz
 * (Transaction/offerID): "If the offer type is code, this value contains the
 * REFERENCE NAME of the offer code you set up in App Store Connect". O
 * RevenueCat repassa esse valor como `offer_code`. Então o nome de referência
 * da oferta tem que SER o código da afiliada — é isso que o webhook casa
 * com `afiliados.codigo`. Limite da Apple: 10 ofertas ativas por assinatura
 * (ASC Help, "Set up offer codes") — o script avisa quando chegar perto.
 *
 * Fontes dos nomes de campo (lidos em 09/10/2026 do OpenAPI oficial da ASC,
 * app-store-connect-openapi-specification.zip):
 *   POST /v1/subscriptionOfferCodes  — attributes: name, customerEligibilities
 *     [NEW|EXISTING|EXPIRED], offerEligibility [STACK_WITH_INTRO_OFFERS|
 *     REPLACE_INTRO_OFFERS], duration [THREE_DAYS|ONE_WEEK|…], offerMode
 *     [PAY_AS_YOU_GO|PAY_UP_FRONT|FREE_TRIAL], numberOfPeriods; relationships
 *     subscription + prices (obrigatórios), com `included` de
 *     subscriptionOfferCodePrices (territory [+ subscriptionPricePoint, que o
 *     FREE_TRIAL não tem — igual à oferta introdutória do asc-anual-69.mjs]).
 *   POST /v1/subscriptionOfferCodeCustomCodes — attributes: customCode,
 *     numberOfCodes (= limite de resgates, até 25.000), expirationDate (date,
 *     nullable → sem fim); relationship offerCode.
 *   GET  /v1/subscriptions/{id}/offerCodes · GET /v1/subscriptionOfferCodes/{id}/customCodes
 *
 * USO (padrão = ENSAIO, nada é criado):
 *   node scripts/asc-codigo-afiliado.mjs BIA               ← mostra o que faria
 *   node scripts/asc-codigo-afiliado.mjs BIA --executar    ← cria de verdade (só com o dono)
 *   node scripts/asc-codigo-afiliado.mjs --listar          ← ofertas de código que já existem
 *   flags: --limite 5000 (resgates do custom code; padrão 5000) · --sub <id> (outra assinatura)
 *
 * Credenciais: ASC_KEY_ID / ASC_ISSUER_ID no .env.local; a .p8 em
 * ~/.appstoreconnect (fora do repo, que é público). Nada de chave é impresso.
 */
import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const APP = "6806913181";
const SUB_PADRAO = "6813548543"; // core_anual_97
const LIMITE_OFERTAS_ATIVAS = 10;

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const executar = process.argv.includes("--executar");
const listar = process.argv.includes("--listar");
const SUB = arg("sub") ?? SUB_PADRAO;
const LIMITE_RESGATES = Math.min(25_000, Math.max(1, Number(arg("limite") ?? 5000) || 5000));

const posicionais = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) { if (["sub", "limite", "key-id", "issuer-id", "p8"].includes(process.argv[i].slice(2))) i++; continue; }
  posicionais.push(process.argv[i]);
}
const CODIGO = String(posicionais[0] ?? "").trim().toUpperCase();

if (!listar && !/^[A-Z0-9]{3,64}$/.test(CODIGO)) {
  console.error("\n✗ Código inválido: 3 a 64 letras/números, sem acento, espaço ou símbolo (a Apple recusa).\n  uso: node scripts/asc-codigo-afiliado.mjs BIA [--executar] | --listar\n");
  process.exit(1);
}

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

async function api(metodo, caminho, body, { tolerar = false } = {}) {
  const escreve = metodo !== "GET";
  if (escreve && !executar) {
    console.log(`  [ensaio] ${metodo} ${caminho}`);
    console.log("           " + JSON.stringify(body).slice(0, 700) + (JSON.stringify(body).length > 700 ? "…" : ""));
    return { ensaio: true, data: { id: "ENSAIO", attributes: {} } };
  }
  const url = caminho.startsWith("http") ? caminho : `https://api.appstoreconnect.apple.com${caminho}`;
  const r = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* sem corpo */ }
  if (!r.ok) {
    const msg = `HTTP ${r.status} em ${metodo} ${caminho}: ${JSON.stringify(j?.errors?.map((e) => e.detail ?? e.title) ?? t).slice(0, 500)}`;
    if (tolerar) { console.warn("  ! " + msg); return null; }
    throw new Error(msg);
  }
  return j;
}
async function todos(caminho) {
  let url = caminho; const out = [];
  while (url) { const j = await api("GET", url); out.push(...(j?.data ?? [])); url = j?.links?.next ?? null; }
  return out;
}

const linkResgate = (codigo) => `https://apps.apple.com/redeem?ctx=offercodes&id=${APP}&code=${encodeURIComponent(codigo)}`;

async function ofertasDaAssinatura() {
  return todos(`/v1/subscriptions/${SUB}/offerCodes?limit=200`);
}

async function listarTudo() {
  const sub = (await api("GET", `/v1/subscriptions/${SUB}`)).data;
  console.log(`\nAssinatura ${SUB} (${sub.attributes.productId}) — ofertas de código:\n`);
  const ofertas = await ofertasDaAssinatura();
  if (!ofertas.length) console.log("  (nenhuma)");
  for (const o of ofertas) {
    const a = o.attributes;
    const custom = await todos(`/v1/subscriptionOfferCodes/${o.id}/customCodes?limit=200`);
    console.log(`  • ${a.name}  ${a.active ? "ATIVA" : "inativa"}  ${a.offerMode} ${a.duration} ×${a.numberOfPeriods}  elegível: ${(a.customerEligibilities ?? []).join("/")} · ${a.offerEligibility}`);
    for (const c of custom) {
      const ca = c.attributes;
      console.log(`      custom code ${ca.customCode}  ${ca.active ? "ativo" : "inativo"}  resgates ${ca.numberOfCodes}  expira ${ca.expirationDate ?? "nunca"}  → ${linkResgate(ca.customCode)}`);
    }
  }
  const ativas = ofertas.filter((o) => o.attributes.active).length;
  console.log(`\n  ${ativas}/${LIMITE_OFERTAS_ATIVAS} ofertas ativas (limite da Apple por assinatura).\n`);
}

async function criar() {
  console.log(executar ? `\n⚠ EXECUTANDO de verdade no App Store Connect — código ${CODIGO}.\n` : `\n[ENSAIO] nada será criado — código ${CODIGO}. Rode com --executar quando o dono autorizar.\n`);

  const sub = (await api("GET", `/v1/subscriptions/${SUB}`)).data;
  console.log(`assinatura ${SUB}: ${sub.attributes.productId} (${sub.attributes.state})`);
  if (sub.attributes.productId !== "core_anual_97" && SUB === SUB_PADRAO) { console.error("✗ a assinatura 6813548543 não é mais o core_anual_97 — pare e confira."); process.exit(1); }

  // territórios onde a assinatura está disponível: a oferta precisa de um preço (FREE_TRIAL → só território) em cada um
  const disp = await api("GET", `/v1/subscriptions/${SUB}/subscriptionAvailability`, undefined, { tolerar: true });
  const territorios = disp ? (await todos(`/v1/subscriptionAvailabilities/${SUB}/availableTerritories?limit=200`)).map((t) => t.id) : [];
  if (!territorios.length) { console.error("✗ não achei os territórios disponíveis da assinatura"); process.exit(1); }
  console.log(`territórios disponíveis: ${territorios.length}`);

  // 1) a oferta de código com nome de referência = CÓDIGO
  console.log(`\n1) oferta de código "${CODIGO}" — FREE_TRIAL · ONE_WEEK · NEW · REPLACE_INTRO_OFFERS`);
  const ofertas = await ofertasDaAssinatura();
  const ativas = ofertas.filter((o) => o.attributes.active).length;
  let oferta = ofertas.find((o) => String(o.attributes.name ?? "").toUpperCase() === CODIGO) ?? null;
  if (oferta) console.log(`   já existe: ${oferta.id} (${oferta.attributes.active ? "ativa" : "INATIVA — reative no painel"})`);
  else {
    if (ativas >= LIMITE_OFERTAS_ATIVAS) { console.error(`✗ já há ${ativas} ofertas ativas — a Apple permite ${LIMITE_OFERTAS_ATIVAS} por assinatura. Desative uma antes.`); process.exit(1); }
    if (ativas >= LIMITE_OFERTAS_ATIVAS - 2) console.warn(`   ! atenção: ${ativas}/${LIMITE_OFERTAS_ATIVAS} ofertas ativas`);
    // ids temporários no padrão dos "inline creates" da ASC ("${preco-BRA}"): o `included` declara, o relationship aponta
    const precos = territorios.map((t) => ({ type: "subscriptionOfferCodePrices", id: "${preco-" + t + "}", relationships: { territory: { data: { type: "territories", id: t } } } }));
    const corpo = {
      data: {
        type: "subscriptionOfferCodes",
        attributes: {
          name: CODIGO,
          customerEligibilities: ["NEW"],
          offerEligibility: "REPLACE_INTRO_OFFERS",
          duration: "ONE_WEEK",
          offerMode: "FREE_TRIAL",
          numberOfPeriods: 1,
        },
        relationships: {
          subscription: { data: { type: "subscriptions", id: SUB } },
          prices: { data: precos.map((p) => ({ type: p.type, id: p.id })) },
        },
      },
      included: precos,
    };
    const r = await api("POST", "/v1/subscriptionOfferCodes", corpo);
    oferta = r.data;
    console.log(`   criada: ${oferta.id}`);
  }
  const ofertaId = oferta.id;
  const existe = ofertaId !== "ENSAIO";

  // 2) o custom code (= código), sem data de fim, com limite de resgates
  console.log(`\n2) custom code "${CODIGO}" — ${LIMITE_RESGATES} resgates, sem data de fim`);
  const customs = existe ? await todos(`/v1/subscriptionOfferCodes/${ofertaId}/customCodes?limit=200`) : [];
  const custom = customs.find((c) => String(c.attributes.customCode ?? "").toUpperCase() === CODIGO);
  if (custom) console.log(`   já existe: ${custom.id} (${custom.attributes.active ? "ativo" : "INATIVO"}, resgates ${custom.attributes.numberOfCodes})`);
  else {
    await api("POST", "/v1/subscriptionOfferCodeCustomCodes", {
      data: {
        type: "subscriptionOfferCodeCustomCodes",
        attributes: { customCode: CODIGO, numberOfCodes: LIMITE_RESGATES, expirationDate: null },
        relationships: { offerCode: { data: { type: "subscriptionOfferCodes", id: ofertaId } } },
      },
    });
    console.log("   criado");
  }

  // 3) conferência (trava de catálogo: lido de volta, não suposto)
  if (existe && executar) {
    console.log("\n3) conferência (lendo de volta)");
    const o = (await api("GET", `/v1/subscriptionOfferCodes/${ofertaId}`)).data.attributes;
    const checks = [
      ["name = código", o.name === CODIGO],
      ["offerMode FREE_TRIAL", o.offerMode === "FREE_TRIAL"],
      ["duration ONE_WEEK", o.duration === "ONE_WEEK"],
      ["numberOfPeriods 1", o.numberOfPeriods === 1],
      ["customerEligibilities só NEW", JSON.stringify(o.customerEligibilities) === JSON.stringify(["NEW"])],
      ["offerEligibility REPLACE_INTRO_OFFERS", o.offerEligibility === "REPLACE_INTRO_OFFERS"],
      ["active", o.active === true],
    ];
    const precosLidos = await todos(`/v1/subscriptionOfferCodes/${ofertaId}/prices?limit=200`);
    checks.push([`preços/territórios = ${territorios.length}`, precosLidos.length === territorios.length]);
    const cs = await todos(`/v1/subscriptionOfferCodes/${ofertaId}/customCodes?limit=200`);
    checks.push([`custom code ${CODIGO} ativo`, cs.some((c) => c.attributes.customCode === CODIGO && c.attributes.active)]);
    let falhas = 0;
    for (const [nome, ok] of checks) { if (!ok) falhas++; console.log(`   ${ok ? "ok " : "!! "}${nome}`); }
    if (falhas) { console.error(`\n✗ ${falhas} conferência(s) falharam — NÃO entregue o link ainda.`); process.exit(1); }
  }

  console.log(`\n${executar ? "✓ pronto." : "[ensaio terminado]"} Link que a afiliada divulga:\n   ${linkResgate(CODIGO)}\n
Depois (mão do dono):
   a) /admin → Afiliados → "Nova afiliada" com o MESMO código ${CODIGO} (chave Pix, limite semanal) — sem isso o webhook ignora a venda ("codigo_desconhecido").
   b) Teste de ponta a ponta com UM resgate real (sandbox não dispara o webhook de produção): abrir o link no iPhone,
      resgatar, e conferir no /admin que apareceu "em teste" com o código certo. Só então mandar o tutorial pra ela.
   c) A oferta nasce ativa; se a Apple exigir "Adicionar para revisão", é no painel do App Store Connect (Assinaturas → core_anual_97 → Códigos de oferta).`);
}

if (listar) await listarTudo();
else await criar();
