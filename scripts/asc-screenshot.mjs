/**
 * Sobe a CAPTURA DE REVISÃO de um produto de compra:
 *
 *   node scripts/asc-screenshot.mjs --iap 6807154521 --img caminho/paywall.png
 *   node scripts/asc-screenshot.mjs --sub 6807155354 --img caminho/paywall.png
 *
 * POR QUE UM SCRIPT SÓ PRA ISSO: é o último campo obrigatório do produto, e
 * enquanto ele falta o produto fica em MISSING_METADATA — estado em que o
 * StoreKit **não devolve o produto nem no sandbox**. Ou seja: sem esta imagem,
 * não dá nem pra testar compra no TestFlight.
 *
 * O envio tem TRÊS etapas e falhar no meio deixa um registro órfão:
 *   1. reservar  → a Apple devolve uma URL de upload e os cabeçalhos exatos
 *   2. subir     → PUT dos bytes crus naquela URL (não é multipart)
 *   3. confirmar → PATCH com `uploaded: true` + md5 do arquivo
 * O md5 é conferido do lado deles: se não bater, a imagem entra corrompida e
 * o produto continua sem captura, sem dizer por quê.
 */
import { createSign, createPrivateKey, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const doEnv = (n) => env.match(new RegExp(`^\\s*${n}\\s*=\\s*"?([^"\\n]+)"?`, "m"))?.[1];

const keyId = doEnv("ASC_KEY_ID");
const issuerId = doEnv("ASC_ISSUER_ID");
const p8 = join(homedir(), ".appstoreconnect", `AuthKey_${keyId}.p8`);

const iap = arg("iap");
const sub = arg("sub");
const img = arg("img");
if ((!iap && !sub) || !img) {
  console.error("\n  --iap <id> | --sub <id>   e   --img <arquivo.png>\n");
  process.exit(1);
}

const b64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const token = () => {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: issuerId, iat: agora, exp: agora + 900, aud: "appstoreconnect-v1" })
  )}`;
  const s = createSign("SHA256").update(corpo).sign({
    key: createPrivateKey(readFileSync(p8, "utf8")),
    dsaEncoding: "ieee-p1363",
  });
  return `${corpo}.${b64url(s)}`;
};

const api = async (metodo, caminho, body) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* corpo vazio */ }
  if (!r.ok) {
    console.error(`\n✗ HTTP ${r.status} em ${metodo} ${caminho}`);
    console.error(JSON.stringify(j ?? t, null, 2).slice(0, 800));
    process.exit(1);
  }
  return j;
};

const bytes = readFileSync(img);
const nome = basename(img);
const tipo = iap ? "inAppPurchaseAppStoreReviewScreenshots" : "subscriptionAppStoreReviewScreenshots";
const relacao = iap
  ? { inAppPurchaseV2: { data: { type: "inAppPurchases", id: iap } } }
  : { subscription: { data: { type: "subscriptions", id: sub } } };

console.log(`→ reservando (${nome}, ${(bytes.length / 1024).toFixed(0)} KB)…`);
const criado = await api("POST", `/v1/${tipo}`, {
  data: { type: tipo, attributes: { fileSize: bytes.length, fileName: nome }, relationships: relacao },
});

const id = criado.data.id;
const op = criado.data.attributes.uploadOperations?.[0];
if (!op) { console.error("\n✗ a Apple não devolveu operação de upload\n"); process.exit(1); }

console.log("→ subindo os bytes…");
const put = await fetch(op.url, {
  method: op.method,
  headers: Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])),
  body: bytes,
});
if (!put.ok) { console.error(`\n✗ upload falhou: HTTP ${put.status}\n`); process.exit(1); }

console.log("→ confirmando com o checksum…");
const md5 = createHash("md5").update(bytes).digest("hex");
const fim = await api("PATCH", `/v1/${tipo}/${id}`, {
  data: { type: tipo, id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
});

console.log(`\n✓ enviada — id ${id} · estado ${fim.data.attributes.assetDeliveryState?.state ?? "?"}\n`);
