/**
 * confere-aab — abre o .aab e PROVA que o que vai pra loja está inteiro.
 *
 * Nasceu em 18/08: o core-v57.aab subiu pra Play SEM a chave do RevenueCat
 * embutida — todo aparelho na v57 via "esta versão ficou sem o catálogo"
 * (rc_sem_chave) e NINGUÉM conseguia pagar. O preparar-loja valida o
 * .env.local ANTES do build; este script valida o ARTEFATO depois — porque
 * entre um e outro existem cache do vite, dist velho e erro de pipe.
 *
 * Uso: node scripts/confere-aab.mjs ~/Desktop/core-v59.aab 1.0.58
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [aab, versaoEsperada] = process.argv.slice(2);
if (!aab) { console.error("uso: node scripts/confere-aab.mjs <arquivo.aab> [versionName]"); process.exit(2); }

const dir = mkdtempSync(join(tmpdir(), "confere-aab-"));
let falhas = 0;
const ok = (nome, passou, detalhe = "") => {
  console.log(`${passou ? "✓" : "✗"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!passou) falhas++;
};

try {
  execSync(`unzip -o -q "${aab}" "base/assets/public/assets/*.js" "base/manifest/AndroidManifest.xml" -d "${dir}"`);
  const manifesto = readFileSync(join(dir, "base/manifest/AndroidManifest.xml"), "latin1");
  const pastaJs = join(dir, "base/assets/public/assets");
  const bundle = readdirSync(pastaJs)
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(join(pastaJs, f), "utf8"))
    .join("\n");

  // 1. A chave do RevenueCat DE PRODUÇÃO está no bundle (o acidente do v57).
  ok("chave RevenueCat (goog_) embutida", /goog_[A-Za-z0-9]{8,}/.test(bundle));
  // 2. Não é o build de TESTE (mock da loja) indo pra produção.
  ok("sem mock da loja (RC_MOCK)", !/__rcModo/.test(bundle) || !/RC_MOCK["']?\s*[:=]\s*["']?1/.test(bundle));
  // 3. versionName esperado no manifesto (upload errado de arquivo velho).
  if (versaoEsperada) ok(`versionName ${versaoEsperada} no manifesto`, manifesto.includes(versaoEsperada));
  // 4. Superfície de venda atual presente (embarcou o dist certo).
  ok("gate do trial no bundle", bundle.includes("Destrave seus 3 dias"));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (falhas) { console.error(`\n✗ ${falhas} verificação(ões) FALHARAM — NÃO SUBIR este arquivo.`); process.exit(1); }
console.log("\n✓ AAB conferido — pode subir.");
