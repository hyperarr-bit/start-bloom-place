/**
 * App Store Connect API — o mesmo espírito do que já existe pra Play.
 *
 * POR QUE POR API E NÃO PELO FORMULÁRIO: no Play, montar o catálogo por API
 * pegou uma divergência de schema entre o produto novo e o irmão que já
 * vendia — coisa que ninguém enxerga clicando, porque o formulário não mostra
 * o que gravou. Aqui vale igual: eu leio a resposta e comparo campo a campo.
 * A regra da casa (ver feedback-catalogo-e-caixa) é justamente essa.
 *
 * SEGREDOS FORA DO REPO. Este repositório é PÚBLICO. A chave .p8 mora em
 * ~/.appstoreconnect/ com permissão 600 e NUNCA entra aqui; o script só lê o
 * caminho. Key ID e Issuer ID vêm do .env.local (gitignored) ou de flag.
 *
 * USO:
 *   node scripts/asc-api.mjs GET /v1/apps
 *   node scripts/asc-api.mjs GET "/v2/inAppPurchases/ID/pricePoints?filter[territory]=BRA&limit=200"
 *   node scripts/asc-api.mjs POST /v2/inAppPurchases '{"data":{...}}'
 *
 * Sempre imprime o STATUS e o corpo — inclusive no erro, porque a mensagem de
 * erro da Apple é onde está a informação útil (campo faltando, valor inválido).
 */
import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const doEnv = (nome) => env.match(new RegExp(`^\\s*${nome}\\s*=\\s*"?([^"\\n]+)"?`, "m"))?.[1];

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const keyId = arg("key-id") ?? doEnv("ASC_KEY_ID");
const issuerId = arg("issuer-id") ?? doEnv("ASC_ISSUER_ID");
const p8 = arg("p8") ?? doEnv("ASC_P8") ?? join(homedir(), ".appstoreconnect", `AuthKey_${keyId}.p8`);

if (!keyId || !issuerId) {
  console.error("\n✗ Faltam ASC_KEY_ID / ASC_ISSUER_ID (no .env.local ou via --key-id / --issuer-id)\n");
  process.exit(1);
}
if (!existsSync(p8)) {
  console.error(`\n✗ Chave não encontrada em ${p8}\n  (ela mora FORA do repo — este repositório é público)\n`);
  process.exit(1);
}

const b64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** O token da ASC vale no MÁXIMO 20 minutos; a Apple recusa exp maior. */
const token = () => {
  const agora = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: issuerId, iat: agora, exp: agora + 15 * 60, aud: "appstoreconnect-v1" };
  const corpo = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // ieee-p1363: o padrão do Node é DER, que a Apple recusa sem explicar.
  const assin = createSign("SHA256").update(corpo).sign({
    key: createPrivateKey(readFileSync(p8, "utf8")),
    dsaEncoding: "ieee-p1363",
  });
  return `${corpo}.${b64url(assin)}`;
};

/* Sobram os posicionais: tira cada `--flag` e o valor que vem colado nela. */
const posicionais = [];
const bruto = process.argv.slice(2);
for (let i = 0; i < bruto.length; i++) {
  if (bruto[i].startsWith("--")) { i++; continue; }
  posicionais.push(bruto[i]);
}
const [metodo = "GET", caminho, corpoBruto] = posicionais;

if (!caminho) {
  console.error(`
  node scripts/asc-api.mjs GET /v1/apps
  node scripts/asc-api.mjs GET "/v1/apps/ID/inAppPurchasesV2"
  node scripts/asc-api.mjs POST /v2/inAppPurchases '{"data":{...}}'
`);
  process.exit(1);
}

const chamar = (url, body) =>
  fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    ...(body ? { body } : {}),
  });

/*
 * --all: segue `links.next` até acabar e junta tudo em `data`.
 *
 * Não é conveniência. A lista de degraus de preço da Apple em BRL tem
 * CENTENAS de entradas, e a primeira página para nos ~R$ 30. Quem olha só a
 * primeira página conclui que "R$ 97,90 não existe" — e essa conclusão errada
 * muda o preço de um produto.
 */
if (process.argv.includes("--all")) {
  let url = `https://api.appstoreconnect.apple.com${caminho}`;
  const tudo = [];
  let paginas = 0;
  while (url) {
    const r = await chamar(url);
    if (!r.ok) {
      console.log(`HTTP ${r.status}`);
      console.log(await r.text());
      process.exit(1);
    }
    const j = await r.json();
    tudo.push(...(j.data ?? []));
    url = j.links?.next ?? null;
    paginas++;
  }
  console.log(JSON.stringify({ paginas, total: tudo.length, data: tudo }, null, 2));
  process.exit(0);
}

const r = await chamar(`https://api.appstoreconnect.apple.com${caminho}`, corpoBruto);
const texto = await r.text();
console.log(`HTTP ${r.status}`);
try {
  console.log(JSON.stringify(JSON.parse(texto), null, 2));
} catch {
  console.log(texto || "(sem corpo)");
}
if (!r.ok) process.exit(1);
