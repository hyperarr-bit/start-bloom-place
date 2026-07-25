/**
 * Prepara o binário da loja: `npm run loja`
 *
 * Existe porque duas coisas já quase foram pro ar erradas (25/07):
 *
 * 1. A chave do RevenueCat. O APK de teste usa a chave do Test Store
 *    ("test_…"). Publicado com ela, o Purchases.configure sobe contra a loja
 *    de mentira, getOfferings() volta vazio e o botão de assinar fica
 *    DESABILITADO pra todo mundo — app na loja sem forma de pagamento. Esse
 *    tipo de erro não pode depender de alguém lembrar; aqui ele barra o build.
 *
 * 2. 39 MB de vídeo de marketing dentro do .aab. v3-hero.mp4, /videos/* e
 *    hero-phones são da landing page — nenhuma tela alcançável dentro do app
 *    usa isso. Ficavam no binário só porque o Capacitor copia a pasta public
 *    inteira. Sair deles derruba o app de ~46 MB pra ~7 MB.
 *
 * O que faz, na ordem: confere a chave → build → cap sync → tira o peso morto
 * → mostra o tamanho final. Depois é só rodar o gradle (bundleRelease).
 *
 * Pra gerar um APK de TESTE com a chave do Test Store: `npm run loja -- --teste`.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const teste = process.argv.includes("--teste");
const ASSETS = "android/app/src/main/assets/public";

// Peso morto: só a web alcança essas telas (a landing page e o funil /plano,
// que dentro do app redirecionam pro /inicio pela trava de rota do App.tsx).
const MORTO = ["v3-hero.mp4", "v3-hero-poster.jpg", "videos", "hero-phones.png", "hero-phones.webp", "images"];

const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
const tamanho = (p) => {
  if (!existsSync(p)) return 0;
  const s = statSync(p);
  if (!s.isDirectory()) return s.size;
  return readdirSync(p).reduce((t, f) => t + tamanho(join(p, f)), 0);
};
const mb = (b) => (b / 1024 / 1024).toFixed(1) + " MB";

// 1. a chave
const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const chave = env.match(/^\s*VITE_REVENUECAT_ANDROID_KEY\s*=\s*"?([^"\n]+)"?/m)?.[1] ?? "";
if (!chave) {
  console.error("\n✗ VITE_REVENUECAT_ANDROID_KEY não está no .env.local — o app subiria sem forma de pagamento.\n");
  process.exit(1);
}
if (!teste && !chave.startsWith("goog_")) {
  console.error(`\n✗ A chave do RevenueCat é "${chave.slice(0, 12)}…", não uma chave de produção (goog_).`);
  console.error("  Publicado assim, o botão de assinar nasce desabilitado pra todo mundo.");
  console.error("  Troque no .env.local, ou rode `npm run loja -- --teste` se o build é só pra testar.\n");
  process.exit(1);
}
console.log(`✓ chave do RevenueCat: ${chave.slice(0, 12)}… ${teste ? "(build de TESTE)" : "(produção)"}`);

// 2. build + sync
sh("npm run build");
sh("npx cap sync android");

// 3. tira o peso morto
const antes = tamanho(ASSETS);
for (const alvo of MORTO) {
  const p = join(ASSETS, alvo);
  if (!existsSync(p)) continue;
  console.log(`  − ${alvo} (${mb(tamanho(p))})`);
  rmSync(p, { recursive: true, force: true });
}
console.log(`\n✓ assets do app: ${mb(antes)} → ${mb(tamanho(ASSETS))}`);
console.log(teste
  ? "\nAgora: ./android/gradlew -p android assembleDebug"
  : "\nAgora: ./android/gradlew -p android bundleRelease");
