/**
 * core_anual_119 — o IRMÃO de R$ 119,90 do core_anual_97 na App Store (17/10, teste de
 * preço 97,90 × 119,90 via RevenueCat Experiments). Mesma receita do core_anual_69
 * (scripts/asc-anual-69.mjs, 01/10), com as lições do scripts/asc-mensal-19.mjs.
 *
 * TRAVA DE CATÁLOGO (feedback-catalogo-e-caixa): produto novo criado por API só está
 * "pronto" depois de um diff de TODOS os campos contra o irmão que comprovadamente vende
 * ("ACTIVE" ≠ "comprável"). Este script faz as duas coisas:
 *
 *   node scripts/asc-anual-119.mjs diff              ← só leitura: o 119 contra o 97, campo a campo
 *                                                      (se o 119 ainda não existe, diz e mostra o 97 de referência)
 *   node scripts/asc-anual-119.mjs criar             ← ENSAIO (padrão): só GETs; imprime cada chamada que faria
 *   node scripts/asc-anual-119.mjs criar --executar  ← cria de verdade (DONO decide; nunca rodar sem ele)
 *
 * O que "igual ao 97" quer dizer — LIDO DO 97 NA HORA, não de memória (o script para se o
 * 97 não estiver como esperado):
 *   grupo CORE Pro 22349268 · ONE_YEAR · groupLevel do 97 (1 — o mesmo do 69 e do
 *   core_mensal) · familySharable do 97
 *   · localizações do 97 copiadas (pt-BR "CORE Anual", descrição ≤ 55 chars)
 *   · disponível nos MESMOS territórios do 97, availableInNewTerritories do 97 — ANTES do
 *     preço (a API recusa preço sem disponibilidade: HTTP 409 na 1ª execução do 69)
 *   · preço BRA R$ 119,90 = price point com customerPrice "119.9" lido de
 *     /pricePoints?filter[territory]=BRA na hora + as equalizações dele nos outros territórios
 *   · oferta introdutória igual à do 97: FREE_TRIAL · THREE_DAYS · 1 período, 1 POST por território
 *   · screenshot de revisão: a mesma imagem do 97
 * No 119 muda SÓ: productId, name, reviewNote (cita 119,90) e o preço.
 *
 * Lido no ensaio de 17/10 (só GET): o grupo tem core_anual_97, core_anual_69 e core_mensal, todos
 * no nível 1 e APPROVED (o core_mensal_19 não foi criado). 97 = 175 territórios / 175 preços /
 * 175 intros FREE_TRIAL·THREE_DAYS·1, screenshot 1206×2622 COMPLETE. BRA "119.9" = tier 10296,
 * líquido R$ 98,35 (o 97 é tier 10269, R$ 80,30); 174 equalizações, todas dentro dos territórios
 * do 97 (USA 19.99 · PRT 22.99 · MEX 399.0 · GBR 19.99).
 *
 * Credenciais: ASC_KEY_ID / ASC_ISSUER_ID por flag (--key-id/--issuer-id), variável de
 * ambiente ou .env.local (o da pasta atual ou o primeiro acima dela — num worktree dentro
 * do checkout acha o do checkout). A .p8 mora em ~/.appstoreconnect (fora do repo, que é
 * público). Nunca imprime token nem chave.
 *
 * ──────────── CHECKLIST DO DONO — depois de criar E do diff terminar em ✓, nesta ordem ────────────
 *
 *  1. DEPLOY PRIMEIRO, antes de qualquer compra: revenuecat-webhook, revenuecat-sync,
 *     meta-backfill-app e prova-social do ramo rc-mapa-19-119 (commit 0e71fbe4; em 17/10 =
 *     origin/main 1fa96b71 + só esse commit). Sem ele o core_anual_119 cai no startsWith
 *     "core_anual" e grava 15990 (R$ 159,90) no banco e na Meta; com ele: 11990 annual →
 *     compra_anual_119 (a119).
 *     ANTES do deploy: o webhook importa _shared/afiliados.ts → conferir que a migration
 *     20261009120000_afiliados.sql está aplicada (tabelas public.afiliados, afiliado_vendas e
 *     afiliado_pagamentos existem). Sem as tabelas o webhook não cai (o registro da afiliada
 *     tem .catch e vira log), mas a venda da afiliada se perde.
 *     0e71fbe4 ainda NÃO está no main nem no v1016: juntar antes de qualquer outro deploy
 *     dessas 4 functions, senão o deploy seguinte volta a gravar 15990.
 *  2. App Store Connect (painel): Assinaturas → CORE Pro → core_anual_119 → "Adicionar para
 *     revisão" junto com a versão 1.0.16 (mesmo envio).
 *  3. RevenueCat:
 *     · Product catalog → produto core_anual_119 (App Store) → entitlement "CORE APP Pro".
 *     · Offerings → NOVA "anual_119": $rc_annual = core_anual_119 e $rc_monthly = o MESMO mensal
 *       da current (hoje core_mensal). Metadata = cópia EXATA da metadata da current: o app lê
 *       as chaves remotas de TODAS as offerings e a current vence — sem a cópia, o braço 119
 *       herda o que estiver na anual_69/mensal_19 e muda mais que o preço. Mudou uma chave na
 *       current durante o teste → mudar igual na anual_119.
 *       Não mexer na current, na anual_69 (presente 69,90) nem na mensal_19 (se existir).
 *     · Experiments → 50/50 current (97,90) × anual_119, como o exp7a4c95d973 (97,90 × 69,90,
 *       02→07/10): tipo Price point, só clientes novos, iOS, App version ≥ 1.0.16, 100%.
 *       O app (v1016) lê o anual da offering current por /^core_anual(_\d+)?$/ → aceita o
 *       core_anual_119; preço sempre do priceString; eventos com oferta "anual_119".
 *  4. TRAVA DE CAIXA (bloqueio, não pendência): 1 compra REAL do core_anual_119 — reembolsar
 *     depois (reportaproblem.apple.com) — e conferir subscriptions.amount_cents = 11990
 *     (billing_period annual) ANTES de ligar o experimento.
 *     · o Apple ID do dono tem o vitalício (o paywall não aparece pra ele): usar outra conta Apple;
 *     · pra essa conta ver o 119 antes do experimento: RevenueCat → perfil do cliente → override
 *       da offering atual = anual_119;
 *     · conta que já usou teste no grupo CORE Pro é cobrada na hora (dinheiro de verdade); conta
 *       nova entra nos 3 dias grátis — a linha já nasce 11990 pelo mapa, mas a cobrança só vem
 *       no fim do teste.
 *  5. LEITURA: por RECEITA POR PAYWALL VISTO (anual + mensal, contando as saídas que cada braço
 *     gerar — presente 69,90; 19,90 se o core_mensal_19 existir), não só por conversão — e só com ≥ 2 turmas de dia útil por braço, já
 *     maduras (passaram da cobrança do fim do teste). Quem está no 119 vê 97,90 e 69,90 na tela
 *     de assinaturas da Apple (mesmo grupo, mesmo nível 1, mesmo nome "CORE Anual") e pode
 *     trocar na hora: somar o que foi cobrado de cada pessoa do braço, não "conversões × 119,90".
 */
import { createSign, createPrivateKey, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const GRUPO = "22349268"; // CORE Pro
const IRMAO_PRODUCT_ID = "core_anual_97"; // id 6813548543 — achado pelo productId no grupo, na hora
const NOVO = {
  productId: "core_anual_119",
  name: "CORE Anual 119",
  reviewNote: "Assinatura anual com acesso a todos os 16 modulos do CORE. Oferta introdutoria: 3 dias gratis para novos assinantes, depois R$ 119,90 por ano. Mesmo produto do core_anual_97, so muda o preco (teste de preco).",
  precoBRA: "119.9", // customerPrice do price point BRA — o id (tier) é lido na hora
};
const NIVEL = 1; // groupLevel dos anuais (97, 69) e do core_mensal — o 119 entra no mesmo
const INTRO = { offerMode: "FREE_TRIAL", duration: "THREE_DAYS", numberOfPeriods: 1 }; // a do 97 — conferida na hora

/* ------------------------------------------------------------ credenciais (nunca impressas) */
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const acharEnvLocal = () => {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const f = join(dir, ".env.local");
    if (existsSync(f)) return f;
    const pai = dirname(dir);
    if (pai === dir) break;
    dir = pai;
  }
  return null;
};
const arqEnv = acharEnvLocal();
const env = arqEnv ? readFileSync(arqEnv, "utf8") : "";
const doEnv = (n) => process.env[n] || env.match(new RegExp(`^\\s*${n}\\s*=\\s*"?([^"\\n]+)"?`, "m"))?.[1];
const keyId = arg("key-id") ?? doEnv("ASC_KEY_ID");
const issuerId = arg("issuer-id") ?? doEnv("ASC_ISSUER_ID");
const p8 = arg("p8") ?? doEnv("ASC_P8") ?? join(homedir(), ".appstoreconnect", `AuthKey_${keyId}.p8`);
if (!keyId || !issuerId || !existsSync(p8)) { console.error("✗ faltam ASC_KEY_ID/ASC_ISSUER_ID (flag, ambiente ou .env.local) ou a .p8 em ~/.appstoreconnect"); process.exit(1); }

const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const token = () => {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }))}.${b64url(JSON.stringify({ iss: issuerId, iat: agora, exp: agora + 900, aud: "appstoreconnect-v1" }))}`;
  const s = createSign("SHA256").update(corpo).sign({ key: createPrivateKey(readFileSync(p8, "utf8")), dsaEncoding: "ieee-p1363" });
  return `${corpo}.${b64url(s)}`;
};
const modo = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "diff";
const executar = modo === "criar" && process.argv.includes("--executar"); // só o "criar" escreve, e só com a flag
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const pare = (msg) => { console.error(`✗ ${msg} — pare e confira antes.`); process.exit(1); };

/* O corpo inteiro de cada escrita, legível: atributos completos, relações pelo id (listas resumidas). */
const resumir = (body) => {
  const d = body?.data ?? {};
  const rel = Object.fromEntries(Object.entries(d.relationships ?? {}).map(([k, v]) => {
    const x = v?.data;
    return [k, Array.isArray(x) ? `[${x.length}: ${x.slice(0, 4).map((i) => i.id).join(", ")}${x.length > 4 ? ", …" : ""}]` : x?.id ?? null];
  }));
  return JSON.stringify({ type: d.type, ...(d.id ? { id: d.id } : {}), ...(d.attributes ? { attributes: d.attributes } : {}), ...(Object.keys(rel).length ? { relationships: rel } : {}) });
};

async function api(metodo, caminho, body, { tolerar = false } = {}) {
  if (metodo !== "GET" && !executar) { console.log(`  [ensaio] ${metodo} ${caminho}${body ? "  " + resumir(body) : ""}`); return { ensaio: true, data: { id: "ENSAIO" } }; }
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
  const sub = (await api("GET", `/v1/subscriptions/${id}?include=group`, undefined, { tolerar: true }) ?? await api("GET", `/v1/subscriptions/${id}`)).data;
  const locs = (await api("GET", `/v1/subscriptions/${id}/subscriptionLocalizations?limit=50`)).data ?? [];
  const precos = await todos(`/v1/subscriptions/${id}/prices?include=subscriptionPricePoint,territory&limit=50`);
  const precoBRA = await api("GET", `/v1/subscriptions/${id}/prices?filter[territory]=BRA&include=subscriptionPricePoint&limit=50`);
  const ppBRA = precoBRA.included?.find((i) => i.type === "subscriptionPricePoints");
  const intros = await todos(`/v1/subscriptions/${id}/introductoryOffers?limit=50`);
  const introBRA = (await api("GET", `/v1/subscriptions/${id}/introductoryOffers?filter[territory]=BRA&limit=50`)).data?.[0];
  const disp = await api("GET", `/v1/subscriptions/${id}/subscriptionAvailability`, undefined, { tolerar: true });
  const terr = disp ? await todos(`/v1/subscriptionAvailabilities/${disp.data?.id ?? id}/availableTerritories?limit=200`) : [];
  const shot = (await api("GET", `/v1/subscriptions/${id}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data ?? null;
  const ppDe = (p) => decodeId(p.relationships?.subscriptionPricePoint?.data?.id ?? "");
  const terrDe = (p) => p.relationships?.territory?.data?.id ?? ppDe(p).t ?? null;
  return {
    id, attrs: sub.attributes ?? {}, grupo: sub.relationships?.group?.data?.id ?? null,
    locs: locs.map((l) => ({ locale: l.attributes.locale, name: l.attributes.name, description: l.attributes.description })).sort((x, y) => x.locale.localeCompare(y.locale)),
    precos: {
      total: precos.length,
      territorios: [...new Set(precos.map(terrDe).filter(Boolean))].sort(),
      tierPorTerritorio: Object.fromEntries(precos.map((p) => [terrDe(p), ppDe(p).p ?? null])),
      ppBRAId: ppBRA?.id ?? null, tierBRA: ppBRA ? decodeId(ppBRA.id).p : null,
      precoBRA: ppBRA?.attributes?.customerPrice ?? null, proceedsBRA: ppBRA?.attributes?.proceeds ?? null,
      preservados: precos.filter((p) => p.attributes?.preserved).length,
    },
    intros: {
      total: intros.length,
      // startDate fica de fora da comparação: é o dia em que cada produto foi criado (97: 2026-09-18, 69: 2026-10-01)
      BRA: introBRA ? { offerMode: introBRA.attributes.offerMode, duration: introBRA.attributes.duration, numberOfPeriods: introBRA.attributes.numberOfPeriods, targetSubscriptionPlanType: introBRA.attributes.targetSubscriptionPlanType ?? null, endDate: introBRA.attributes.endDate ?? null } : null,
      inicioBRA: introBRA?.attributes?.startDate ?? null,
      modos: [...new Set(intros.map((i) => `${i.attributes.offerMode}/${i.attributes.duration}/${i.attributes.numberOfPeriods}${i.attributes.endDate ? `/fim ${i.attributes.endDate}` : ""}`))].sort(),
    },
    disponibilidade: { availableInNewTerritories: disp?.data?.attributes?.availableInNewTerritories ?? null, total: terr.length, territorios: terr.map((t) => t.id).sort() },
    screenshot: shot ? { state: shot.attributes.assetDeliveryState?.state, w: shot.attributes.imageAsset?.width, h: shot.attributes.imageAsset?.height, fileSize: shot.attributes.fileSize } : null,
  };
}

async function doGrupo() { return (await api("GET", `/v1/subscriptionGroups/${GRUPO}/subscriptions?limit=50`)).data ?? []; }
async function noGrupo(productId, lista) { return (lista ?? await doGrupo()).find((s) => s.attributes.productId === productId) ?? null; }
async function acharIrmao(lista) {
  const irmao = await noGrupo(IRMAO_PRODUCT_ID, lista);
  if (!irmao) pare(`não achei ${IRMAO_PRODUCT_ID} no grupo ${GRUPO}`);
  return irmao.id;
}

function mostrarReferencia(a) {
  const nota = a.attrs.reviewNote ?? "";
  console.log(`  ${a.attrs.subscriptionPeriod} · groupLevel ${a.attrs.groupLevel} · familySharable ${a.attrs.familySharable} · state ${a.attrs.state} · grupo ${a.grupo ?? "(sem linkage)"}`);
  console.log(`  localizações: ${a.locs.map((l) => `${l.locale} "${l.name}" / "${l.description}" (${(l.description ?? "").length} chars)`).join(" · ") || "nenhuma"}`);
  console.log(`  disponibilidade: ${a.disponibilidade.total} territórios, availableInNewTerritories ${a.disponibilidade.availableInNewTerritories}`);
  console.log(`  preços: ${a.precos.total} em ${a.precos.territorios.length} territórios (BRA ${a.precos.precoBRA}, tier ${a.precos.tierBRA}, líquido ${a.precos.proceedsBRA}), preservados ${a.precos.preservados}`);
  console.log(`  oferta introdutória: ${a.intros.total} · ${a.intros.modos.join(", ") || "nenhuma"}${a.intros.BRA?.endDate ? ` · BRA termina ${a.intros.BRA.endDate}` : ""}`);
  console.log(`  screenshot de revisão: ${a.screenshot ? `${a.screenshot.state} ${a.screenshot.w}×${a.screenshot.h}` : "nenhum"}`);
  console.log(`  reviewNote: "${nota.slice(0, 150)}${nota.length > 150 ? "…" : ""}"`);
}

/* ------------------------------------------------------------ diff campo a campo */
async function diff() {
  const lista = await doGrupo();
  const irmaoId = await acharIrmao(lista);
  const novo = await noGrupo(NOVO.productId, lista);
  if (!novo) {
    console.log(`✗ ${NOVO.productId} ainda não existe no grupo ${GRUPO} (hoje: ${lista.map((s) => s.attributes.productId).join(", ")}).`);
    console.log(`  Rode "criar" (ensaio) e, quando o dono mandar, "criar --executar".\n`);
    console.log(`referência — ${IRMAO_PRODUCT_ID} (${irmaoId}) hoje, é o que o 119 vai ter que bater:`);
    mostrarReferencia(await lerProduto(irmaoId));
    process.exit(2);
  }
  console.log(`lendo ${irmaoId} (${IRMAO_PRODUCT_ID}) e ${novo.id} (${NOVO.productId})…`);
  const [a, b] = await Promise.all([lerProduto(irmaoId), lerProduto(novo.id)]);
  let falhas = 0;
  const f = (v) => (JSON.stringify(v) ?? "—").slice(0, 60);
  const linha = (campo, va, vb, ok = JSON.stringify(va) === JSON.stringify(vb), nota = "") => {
    if (!ok) falhas++;
    console.log(`${ok ? "  ok " : "  !! "}${campo.padEnd(46)} 97: ${f(va)}   119: ${f(vb)}${nota ? "   " + nota : ""}`);
  };

  console.log("\n— atributos (todos os campos que a API devolve; só id, nome, nota e estado podem mudar)");
  const PROPRIOS = new Set(["productId", "name", "reviewNote", "state"]);
  for (const k of [...new Set([...Object.keys(a.attrs), ...Object.keys(b.attrs)])].sort()) if (!PROPRIOS.has(k)) linha(`attributes.${k}`, a.attrs[k], b.attrs[k]);
  linha(`attributes.groupLevel = ${NIVEL} (nível dos anuais)`, a.attrs.groupLevel, b.attrs.groupLevel, a.attrs.groupLevel === NIVEL && b.attrs.groupLevel === NIVEL);
  linha("attributes.productId", a.attrs.productId, b.attrs.productId, b.attrs.productId === NOVO.productId);
  linha("attributes.name", a.attrs.name, b.attrs.name, b.attrs.name === NOVO.name);
  linha("attributes.state (APPROVED só depois da revisão)", a.attrs.state, b.attrs.state, ["APPROVED", "WAITING_FOR_REVIEW", "READY_TO_SUBMIT", "IN_REVIEW"].includes(b.attrs.state));
  linha("reviewNote cita 119,90 (e não 97,90)", /97,90/.test(a.attrs.reviewNote ?? ""), /119,90/.test(b.attrs.reviewNote ?? ""), /119,90/.test(b.attrs.reviewNote ?? "") && !/97,90/.test(b.attrs.reviewNote ?? ""));
  linha("grupo", a.grupo ?? `(lista do grupo ${GRUPO})`, b.grupo ?? `(lista do grupo ${GRUPO})`, (a.grupo ?? GRUPO) === GRUPO && (b.grupo ?? GRUPO) === GRUPO);

  console.log("\n— localização");
  linha("localizações (locale/name/description)", a.locs, b.locs);

  console.log("\n— preço");
  linha("preços: nº", a.precos.total, b.precos.total);
  linha("preços: territórios iguais", a.precos.territorios, b.precos.territorios);
  linha("preços: preservados (tem que ser 0)", a.precos.preservados, b.precos.preservados, b.precos.preservados === 0);
  linha("preço BRA (tier) — tem que ser diferente", a.precos.tierBRA, b.precos.tierBRA, !!b.precos.tierBRA && a.precos.tierBRA !== b.precos.tierBRA);
  linha("preço BRA = 119,90", a.precos.precoBRA, b.precos.precoBRA, b.precos.precoBRA === NOVO.precoBRA, `(líquido BRA: 97 ${a.precos.proceedsBRA} · 119 ${b.precos.proceedsBRA})`);
  if (b.precos.ppBRAId) {
    const eq = await todos(`/v1/subscriptionPricePoints/${b.precos.ppBRAId}/equalizations?limit=200`);
    const tierEq = Object.fromEntries(eq.map((e) => [decodeId(e.id).t, decodeId(e.id).p]));
    const fora = b.precos.territorios.filter((t) => t !== "BRA" && tierEq[t] !== b.precos.tierPorTerritorio[t]);
    linha("preços fora do BRA = equalizações do 119,90", "—", fora.length ? `${fora.length} diferentes: ${fora.slice(0, 6).join(",")}` : "todos", fora.length === 0);
  } else linha("preços fora do BRA = equalizações do 119,90", "—", "sem preço BRA", false);

  console.log("\n— oferta introdutória (3 dias grátis)");
  linha("intros: nº de territórios", a.intros.total, b.intros.total);
  linha("intros: modos", a.intros.modos, b.intros.modos);
  linha("intro BRA (modo/duração/períodos/plano/fim)", a.intros.BRA, b.intros.BRA);
  linha("intro BRA já valendo (startDate ≤ hoje)", a.intros.inicioBRA, b.intros.inicioBRA, !!b.intros.BRA && (!b.intros.inicioBRA || new Date(b.intros.inicioBRA) <= new Date()));

  console.log("\n— disponibilidade");
  linha("availableInNewTerritories", a.disponibilidade.availableInNewTerritories, b.disponibilidade.availableInNewTerritories);
  linha("territórios disponíveis (nº)", a.disponibilidade.total, b.disponibilidade.total);
  linha("territórios disponíveis (lista)", a.disponibilidade.territorios, b.disponibilidade.territorios);

  console.log("\n— screenshot de revisão");
  linha("screenshot (state/w/h)", a.screenshot && { state: a.screenshot.state, w: a.screenshot.w, h: a.screenshot.h }, b.screenshot && { state: b.screenshot.state, w: b.screenshot.w, h: b.screenshot.h });

  console.log(falhas ? `\n✗ ${falhas} diferença(s) fora do esperado — NÃO está pronto (regra: "ACTIVE" ≠ "comprável").\n` : `\n✓ ${NOVO.productId} é cópia fiel do ${IRMAO_PRODUCT_ID} — só muda id, nome, nota e preço. Próximo: checklist do cabeçalho (1 → 5).\n`);
  process.exit(falhas ? 1 : 0);
}

/* ------------------------------------------------------------ criação (ensaio por padrão) */
async function criar() {
  console.log(executar ? "\n⚠ EXECUTANDO de verdade no App Store Connect.\n" : "\n[ENSAIO] nada será criado — só leituras (GET); cada escrita abaixo é só impressa. Rode com --executar quando o dono autorizar.\n");
  const lista = await doGrupo();
  console.log(`grupo CORE Pro ${GRUPO} hoje: ${lista.map((s) => `${s.attributes.productId} (nível ${s.attributes.groupLevel}, ${s.attributes.state})`).join(" · ")}`);
  const irmaoId = await acharIrmao(lista);
  console.log(`\nlendo o irmão ${IRMAO_PRODUCT_ID} (${irmaoId}) — tudo que o 119 copia sai daqui:`);
  const irmao = await lerProduto(irmaoId);
  mostrarReferencia(irmao);
  const modoIntro = `${INTRO.offerMode}/${INTRO.duration}/${INTRO.numberOfPeriods}`;
  if (irmao.attrs.subscriptionPeriod !== "ONE_YEAR") pare(`o 97 não é ONE_YEAR (${irmao.attrs.subscriptionPeriod})`);
  if (irmao.attrs.groupLevel !== NIVEL) pare(`o 97 não está no nível ${NIVEL} (está no ${irmao.attrs.groupLevel})`);
  if (!irmao.disponibilidade.total || irmao.precos.total !== irmao.disponibilidade.total || irmao.intros.total !== irmao.disponibilidade.total) {
    pare(`o 97 não está como eu esperava (territórios ${irmao.disponibilidade.total}, preços ${irmao.precos.total}, intros ${irmao.intros.total})`);
  }
  if (JSON.stringify(irmao.intros.modos) !== JSON.stringify([modoIntro])) pare(`a oferta introdutória do 97 não é só ${modoIntro} (${irmao.intros.modos.join(", ")})`);
  if (irmao.intros.BRA?.endDate) pare(`a oferta introdutória do 97 tem data de fim (${irmao.intros.BRA.endDate}) — decidir se o 119 copia`);
  if (!irmao.locs.some((l) => l.locale === "pt-BR")) pare("o 97 não tem localização pt-BR");
  if (irmao.locs.some((l) => (l.description ?? "").length > 55)) pare("descrição do 97 com mais de 55 chars");
  /* RETOMÁVEL (lição do 69, 01/10): cada etapa confere o que já existe antes de criar — a
   * DISPONIBILIDADE tem que vir ANTES do preço (HTTP 409 se inverter). */

  // 1. a assinatura no grupo
  console.log(`\n1) assinatura (${irmao.attrs.subscriptionPeriod}, groupLevel ${irmao.attrs.groupLevel}, familySharable ${irmao.attrs.familySharable}, grupo ${GRUPO})`);
  let sub = await noGrupo(NOVO.productId, lista);
  if (sub) console.log("   já existe:", sub.id, sub.attributes.state);
  else {
    sub = (await api("POST", "/v1/subscriptions", { data: { type: "subscriptions", attributes: { name: NOVO.name, productId: NOVO.productId, subscriptionPeriod: irmao.attrs.subscriptionPeriod, familySharable: irmao.attrs.familySharable, reviewNote: NOVO.reviewNote, groupLevel: irmao.attrs.groupLevel }, relationships: { group: { data: { type: "subscriptionGroups", id: GRUPO } } } } })).data;
    if (executar) console.log("   id:", sub.id);
  }
  const id = sub.id;
  const existe = id !== "ENSAIO";

  // 2. localizações: as do 97 (pt-BR "CORE Anual"; descrição ≤ 55 chars — a Apple recusa mais)
  console.log(`\n2) localizações (${irmao.locs.map((l) => l.locale).join(", ")}, copiadas do 97)`);
  const locsAtuais = existe ? ((await api("GET", `/v1/subscriptions/${id}/subscriptionLocalizations?limit=50`)).data ?? []).map((l) => l.attributes.locale) : [];
  for (const l of irmao.locs) {
    if (locsAtuais.includes(l.locale)) { console.log(`   ${l.locale} já existe`); continue; }
    await api("POST", "/v1/subscriptionLocalizations", { data: { type: "subscriptionLocalizations", attributes: { locale: l.locale, name: l.name, description: l.description }, relationships: { subscription: { data: { type: "subscriptions", id } } } } });
  }

  // 3. disponibilidade: os mesmos territórios do 97 (ANTES do preço)
  console.log(`\n3) disponibilidade (${irmao.disponibilidade.total} territórios do 97, availableInNewTerritories ${irmao.disponibilidade.availableInNewTerritories})`);
  const disp = existe ? await api("GET", `/v1/subscriptions/${id}/subscriptionAvailability`, undefined, { tolerar: true }) : null;
  const terrAtuais = disp ? (await todos(`/v1/subscriptionAvailabilities/${disp.data?.id ?? id}/availableTerritories?limit=200`)).map((t) => t.id) : [];
  if (terrAtuais.length === irmao.disponibilidade.total) console.log("   já existe:", terrAtuais.length, "territórios");
  else await api("POST", "/v1/subscriptionAvailabilities", { data: { type: "subscriptionAvailabilities", attributes: { availableInNewTerritories: irmao.disponibilidade.availableInNewTerritories !== false }, relationships: { subscription: { data: { type: "subscriptions", id } }, availableTerritories: { data: irmao.disponibilidade.territorios.map((t) => ({ type: "territories", id: t })) } } } });

  // 4. preço BRA R$ 119,90 + equalizações. O degrau é lido na hora: na execução da lista do
  //    produto novo (o id do price point carrega o produto); no ensaio da lista do 97 (o tier
  //    e as equalizações são os mesmos — só o id muda).
  console.log("\n4) preço BRA R$ 119,90 + equalizações");
  const daLista = executar ? id : irmao.id;
  const ppsBRA = await todos(`/v1/subscriptions/${daLista}/pricePoints?filter[territory]=BRA&limit=200`);
  const certo = ppsBRA.find((p) => p.attributes.customerPrice === NOVO.precoBRA);
  if (!certo) pare(`não achei o degrau R$ 119,90 (customerPrice "${NOVO.precoBRA}") nos ${ppsBRA.length} degraus de /pricePoints?filter[territory]=BRA`);
  const tier = decodeId(certo.id).p;
  console.log(`   degrau BRA "${certo.attributes.customerPrice}": tier ${tier}, líquido R$ ${certo.attributes.proceeds} (de ${ppsBRA.length} degraus BRA${executar ? "" : "; lido da lista do 97 — na execução, o mesmo tier da lista do 119"})`);
  const ppId = (pp, terr) => (executar ? pp.id : `ENSAIO(${terr} tier ${decodeId(pp.id).p})`);
  const precosAtuais = existe ? await todos(`/v1/subscriptions/${id}/prices?include=territory&limit=50`) : [];
  const terrComPreco = new Set(precosAtuais.map((p) => p.relationships?.territory?.data?.id).filter(Boolean));
  const corpoPreco = (pp, terr) => ({ data: { type: "subscriptionPrices", relationships: { subscription: { data: { type: "subscriptions", id } }, subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: ppId(pp, terr) } }, territory: { data: { type: "territories", id: terr } } } } });
  if (terrComPreco.has("BRA")) console.log("   BRA já tem preço");
  else await api("POST", "/v1/subscriptionPrices", corpoPreco(certo, "BRA"));
  const equal = await todos(`/v1/subscriptionPricePoints/${certo.id}/equalizations?include=territory&limit=200`);
  const terrDeEq = (e) => e.relationships?.territory?.data?.id ?? decodeId(e.id).t;
  const disponiveis = new Set(irmao.disponibilidade.territorios);
  const alvo = equal.filter((e) => { const t = terrDeEq(e); return t && t !== "BRA" && disponiveis.has(t) && !terrComPreco.has(t); });
  const foraDaDisp = equal.filter((e) => { const t = terrDeEq(e); return t && t !== "BRA" && !disponiveis.has(t); }).map(terrDeEq);
  const semEqualizacao = irmao.disponibilidade.territorios.filter((t) => t !== "BRA" && !equal.some((e) => terrDeEq(e) === t));
  const amostra = ["USA", "PRT", "MEX", "GBR"].map((t) => { const e = equal.find((x) => terrDeEq(x) === t); return e ? `${t} ${e.attributes.customerPrice}` : null; }).filter(Boolean);
  console.log(`   equalizações do 119,90: ${equal.length} · a criar agora: ${alvo.length} · já com preço no 119: ${terrComPreco.size}${foraDaDisp.length ? ` · ${foraDaDisp.length} fora dos territórios do 97 (pulados): ${foraDaDisp.slice(0, 6).join(",")}` : ""}${semEqualizacao.length ? ` · ${semEqualizacao.length} territórios do 97 SEM equalização: ${semEqualizacao.slice(0, 6).join(",")}` : ""}`);
  if (amostra.length) console.log(`   amostra fora do Brasil: ${amostra.join(" · ")}`);
  let criados = 0;
  for (const [i, e] of alvo.entries()) {
    const terr = terrDeEq(e);
    if (!executar) { if (i === 0) await api("POST", "/v1/subscriptionPrices", corpoPreco(e, terr)); continue; }
    const r = await api("POST", "/v1/subscriptionPrices", corpoPreco(e, terr), { tolerar: true });
    if (r) criados++;
    await dorme(120);
  }
  if (!executar && alvo.length > 1) console.log(`  [ensaio] … + ${alvo.length - 1} POST /v1/subscriptionPrices iguais (1 por território, price point da equalização)`);
  if (executar) console.log(`   preços criados agora: ${criados} de ${alvo.length}`);

  // 5. oferta introdutória igual à do 97: 1 POST por território (a API exige territory)
  console.log(`\n5) oferta introdutória ${modoIntro} em cada um dos ${irmao.disponibilidade.total} territórios`);
  const introsAtuais = existe ? await todos(`/v1/subscriptions/${id}/introductoryOffers?include=territory&limit=50`) : [];
  const terrComIntro = new Set(introsAtuais.map((i) => i.relationships?.territory?.data?.id).filter(Boolean));
  const faltamIntro = irmao.disponibilidade.territorios.filter((t) => !terrComIntro.has(t));
  let introsCriadas = 0;
  for (const [i, t] of faltamIntro.entries()) {
    const corpo = { data: { type: "subscriptionIntroductoryOffers", attributes: { duration: INTRO.duration, offerMode: INTRO.offerMode, numberOfPeriods: INTRO.numberOfPeriods }, relationships: { subscription: { data: { type: "subscriptions", id } }, territory: { data: { type: "territories", id: t } } } } };
    if (!executar) { if (i === 0) await api("POST", "/v1/subscriptionIntroductoryOffers", corpo); continue; }
    const r = await api("POST", "/v1/subscriptionIntroductoryOffers", corpo, { tolerar: true });
    if (r) introsCriadas++;
    await dorme(120);
  }
  if (!executar && faltamIntro.length > 1) console.log(`  [ensaio] … + ${faltamIntro.length - 1} POST /v1/subscriptionIntroductoryOffers iguais (1 por território)`);
  if (executar) console.log(`   já tinham: ${terrComIntro.size}; criadas agora: ${introsCriadas} de ${faltamIntro.length}`);

  // 6. screenshot de revisão: a mesma imagem do 97 (baixa do templateUrl → reserva → PUT → PATCH com md5)
  console.log("\n6) screenshot de revisão (cópia do 97)");
  const shotAtual = existe ? (await api("GET", `/v1/subscriptions/${id}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data : null;
  const shot = (await api("GET", `/v1/subscriptions/${irmao.id}/appStoreReviewScreenshot`, undefined, { tolerar: true }))?.data;
  if (!shot) console.log("   ! o 97 não tem screenshot de revisão — anexar pelo painel antes de enviar");
  else {
    const tpl = shot.attributes.imageAsset.templateUrl; const w = shot.attributes.imageAsset.width; const h = shot.attributes.imageAsset.height;
    const urlImg = tpl.replace("{w}", w).replace("{h}", h).replace("{f}", "png");
    if (shotAtual?.attributes?.assetDeliveryState?.state === "COMPLETE") console.log("   já existe (COMPLETE)");
    else if (executar) {
      const bytes = Buffer.from(await (await fetch(urlImg)).arrayBuffer());
      const criado = await api("POST", "/v1/subscriptionAppStoreReviewScreenshots", { data: { type: "subscriptionAppStoreReviewScreenshots", attributes: { fileSize: bytes.length, fileName: "revisao-core-anual-119.png" }, relationships: { subscription: { data: { type: "subscriptions", id } } } } });
      const op = criado.data.attributes.uploadOperations?.[0];
      const put = await fetch(op.url, { method: op.method, headers: Object.fromEntries((op.requestHeaders ?? []).map((x) => [x.name, x.value])), body: bytes });
      if (!put.ok) { console.error("✗ upload do screenshot falhou", put.status); process.exit(1); }
      const md5 = createHash("md5").update(bytes).digest("hex");
      await api("PATCH", `/v1/subscriptionAppStoreReviewScreenshots/${criado.data.id}`, { data: { type: "subscriptionAppStoreReviewScreenshots", id: criado.data.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
      console.log("   enviado:", bytes.length, "bytes, md5", md5);
    } else {
      console.log(`  [ensaio] baixaria a imagem do 97 (${w}×${h} png, ${shot.attributes.fileSize ?? "?"} bytes, ${new URL(urlImg).host}) → POST /v1/subscriptionAppStoreReviewScreenshots (reserva, fileName revisao-core-anual-119.png) → PUT dos bytes → PATCH uploaded + md5`);
    }
  }

  console.log(`\n${executar ? "✓ criado/completado." : "[ensaio terminado — nada foi escrito]"} Próximos passos (mão do dono; detalhes no cabeçalho do script):
   a) node scripts/asc-anual-119.mjs diff   ← tem que terminar em ✓ (trava de catálogo)
   1) DEPLOY do rc-mapa-19-119 (0e71fbe4): revenuecat-webhook, revenuecat-sync, meta-backfill-app, prova-social
      — antes, conferir a migration 20261009120000_afiliados.sql aplicada (o webhook importa _shared/afiliados.ts)
   2) App Store Connect → Assinaturas → CORE Pro → ${NOVO.productId} → "Adicionar para revisão" junto com a 1.0.16
   3) RevenueCat → ${NOVO.productId} no entitlement "CORE APP Pro" → offering "anual_119" ($rc_annual = ${NOVO.productId},
      $rc_monthly = o da current, metadata copiada da current) → Experiment 50/50 current × anual_119 (como o exp7a4c95d973)
   4) TRAVA DE CAIXA: 1 compra REAL do ${NOVO.productId} (reembolsar depois) com subscriptions.amount_cents = 11990 ANTES do experimento
   5) Ler por receita por paywall (anual + mensal), com ≥ 2 turmas de dia útil por braço.`);
}

if (modo === "diff") await diff();
else if (modo === "criar") await criar();
else { console.error("uso: node scripts/asc-anual-119.mjs diff | criar [--executar]"); process.exit(1); }
