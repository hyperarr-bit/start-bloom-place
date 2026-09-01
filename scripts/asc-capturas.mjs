/**
 * Sobe as CAPTURAS DE TELA da ficha da App Store, na ordem dada:
 *
 *   node scripts/asc-capturas.mjs --loc <appStoreVersionLocalizationId> \
 *     --tipo APP_IPHONE_69 img1.png img2.png ...
 *
 * A ORDEM IMPORTA E É A DOS ARGUMENTOS. As duas ou três primeiras são as que
 * aparecem no resultado de busca da App Store — quem decide se alguém toca no
 * app são elas, não a descrição.
 *
 * Mesma mecânica de três etapas do asc-screenshot.mjs (reservar → PUT dos
 * bytes crus → PATCH com md5). O checksum é conferido do lado da Apple: se
 * não bater, a imagem entra corrompida e ninguém avisa.
 *
 * Idempotente por conjunto: se já existir um set do mesmo tipo, ele é APAGADO
 * e recriado. Sem isso, rodar duas vezes deixa capturas duplicadas na ficha —
 * e a Apple aceita, então o erro só apareceria na loja publicada.
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

const loc = arg("loc");
const tipo = arg("tipo") ?? "APP_IPHONE_69";
const imagens = process.argv.slice(2).filter((a, i, arr) => {
  if (a.startsWith("--")) return false;
  const ant = arr[i - 1];
  return !(typeof ant === "string" && ant.startsWith("--"));
});

if (!loc || !imagens.length) {
  console.error("\n  --loc <id da localização da versão>  --tipo APP_IPHONE_69  img1.png img2.png …\n");
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
  try { j = JSON.parse(t); } catch { /* sem corpo */ }
  if (!r.ok) {
    console.error(`\n✗ HTTP ${r.status} em ${metodo} ${caminho}`);
    console.error(JSON.stringify(j ?? t, null, 2).slice(0, 700));
    process.exit(1);
  }
  return j;
};

// 1. Conjunto do tipo pedido — recria do zero pra não duplicar.
const sets = await api("GET", `/v1/appStoreVersionLocalizations/${loc}/appScreenshotSets`);
for (const s of sets?.data ?? []) {
  if (s.attributes.screenshotDisplayType === tipo) {
    await api("DELETE", `/v1/appScreenshotSets/${s.id}`);
    console.log(`→ conjunto ${tipo} anterior removido`);
  }
}
const set = await api("POST", "/v1/appScreenshotSets", {
  data: {
    type: "appScreenshotSets",
    attributes: { screenshotDisplayType: tipo },
    relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc } } },
  },
});
const setId = set.data.id;
console.log(`→ conjunto ${tipo} criado`);

// 2. Cada imagem, na ordem dos argumentos.
for (const [i, img] of imagens.entries()) {
  const bytes = readFileSync(img);
  const nome = basename(img);
  const criado = await api("POST", "/v1/appScreenshots", {
    data: {
      type: "appScreenshots",
      attributes: { fileSize: bytes.length, fileName: nome },
      relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } } },
    },
  });
  const id = criado.data.id;
  const op = criado.data.attributes.uploadOperations?.[0];
  const put = await fetch(op.url, {
    method: op.method,
    headers: Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])),
    body: bytes,
  });
  if (!put.ok) { console.error(`\n✗ upload de ${nome} falhou: HTTP ${put.status}\n`); process.exit(1); }
  const md5 = createHash("md5").update(bytes).digest("hex");
  const fim = await api("PATCH", `/v1/appScreenshots/${id}`, {
    data: { type: "appScreenshots", id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  console.log(`  ${i + 1}. ${nome} → ${fim.data.attributes.assetDeliveryState?.state ?? "?"}`);
}
console.log(`\n✓ ${imagens.length} capturas na ficha, nessa ordem.\n`);
