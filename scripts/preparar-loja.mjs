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
import { readFileSync, writeFileSync, existsSync, rmSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const teste = process.argv.includes("--teste");

/*
 * DUAS LOJAS (30/08). `npm run loja` continua sendo o Android, byte por byte
 * igual ao que já vende — a entrada do iPhone não podia mexer no caminho do
 * dinheiro que está no ar. `npm run loja -- --ios` faz o mesmo ritual pro
 * binário da Apple, com as três diferenças que importam:
 *   - a pasta que o cap sync alimenta é outra (ios/App/App/public);
 *   - a chave do RevenueCat é appl_, não goog_ (chave trocada = getOfferings
 *     vazio = app na loja sem forma de pagamento, o mesmo desastre do topo);
 *   - não existe SDK nativo da Meta no iOS, então a trava do client token
 *     não se aplica (checá-la aqui abortaria um build correto).
 * A poda de peso morto e o strip dos pixels JS valem IGUAL nos dois: o
 * Capacitor copia a mesma pasta public pros dois lados.
 */
const alvoIOS = process.argv.includes("--ios");
const LOJA = alvoIOS
  ? { nome: "iOS", assets: "ios/App/App/public", plataforma: "ios", envKey: "VITE_REVENUECAT_IOS_KEY", prefixo: "appl_" }
  : { nome: "Android", assets: "android/app/src/main/assets/public", plataforma: "android", envKey: "VITE_REVENUECAT_ANDROID_KEY", prefixo: "goog_" };
const ASSETS = LOJA.assets;

// Peso morto: só a web alcança essas telas (a landing page e o funil /plano,
// que dentro do app redirecionam pro /inicio pela trava de rota do App.tsx).
const MORTO = ["v3-hero.mp4", "v3-hero-poster.jpg", "videos", "hero-phones.png", "hero-phones.webp", "images"];

// Rastreadores de anúncio que moram no index.html da WEB e vinham de carona
// pro binário (o Capacitor copia a pasta public inteira).
//
// HISTÓRIA DA POLÍTICA: até 11/08 a regra era "nenhum rastreador no binário"
// pra manter o Data Safety da Play limpo. Em 12/08 o dono reverteu — o SDK
// NATIVO da Meta entrou no APK (MainActivity.java), porque sem ele campanha
// de App Promotion não mede instalação/compra e otimiza no escuro. O strip
// abaixo CONTINUA valendo mesmo assim: estes são os pixels JS da WEB, que
// dentro do app duplicariam evento com o SDK nativo (Purchase contado 2x
// estraga o CPA) e disparariam PageView de funil que não existe no app.
const ASSINATURAS = [
  { nome: "UTMify", re: /cdn\.utmify\.com\.br/i },
  { nome: "TikTok Pixel", re: /TiktokAnalyticsObject|analytics\.tiktok\.com/i },
  { nome: "Meta Pixel", re: /fbq\(|connect\.facebook\.net/i },
  { nome: "Google Ads", re: /googletagmanager\.com|gtag\(/i },
];

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
const chave = env.match(new RegExp(`^\\s*${LOJA.envKey}\\s*=\\s*"?([^"\\n]+)"?`, "m"))?.[1] ?? "";
if (!chave) {
  console.error(`\n✗ ${LOJA.envKey} não está no .env.local — o app ${LOJA.nome} subiria sem forma de pagamento.\n`);
  process.exit(1);
}
if (!teste && !chave.startsWith(LOJA.prefixo)) {
  console.error(`\n✗ A chave do RevenueCat é "${chave.slice(0, 12)}…", não uma chave de produção do ${LOJA.nome} (${LOJA.prefixo}).`);
  console.error("  Publicado assim, o botão de assinar nasce desabilitado pra todo mundo.");
  console.error("  Troque no .env.local, ou rode `npm run loja -- --teste` se o build é só pra testar.\n");
  process.exit(1);
}
console.log(`✓ loja: ${LOJA.nome}`);
console.log(`✓ chave do RevenueCat: ${chave.slice(0, 12)}… ${teste ? "(build de TESTE)" : "(produção)"}`);

// SDK da Meta (12/08): a MainActivity só liga o SDK se o client token estiver
// preenchido no strings.xml. Ou seja, build de produção com token vazio não
// quebra nada visível — o app funciona e a campanha volta a ficar CEGA em
// silêncio. Esse tipo de silêncio é o que barra aqui.
if (!teste && !alvoIOS) {
  // Mora no key.properties (gitignored) e não no strings.xml: o repo é
  // público, e token vazado vira evento falso no nosso dataset.
  const props = existsSync("android/key.properties")
    ? readFileSync("android/key.properties", "utf8") : "";
  const clientToken = props.match(/^\s*metaClientToken\s*=\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (!clientToken) {
    console.error("\n✗ metaClientToken não está em android/key.properties.");
    console.error("  Sem ele o SDK da Meta não liga e a atribuição de campanha morre em silêncio.");
    console.error("  Pegue em developers.facebook.com → Configurações → Avançado → Token de cliente.\n");
    process.exit(1);
  }
  console.log(`✓ client token da Meta: ${clientToken.slice(0, 6)}…`);
}

// Trava dupla do mock da loja (09/08): o build de teste liga RC_MOCK=1 (o
// vite troca o plugin do RevenueCat por uma loja simulada — ver
// src/dev/rc-plugin-mock.ts); o de produção ABORTA se a flag vazar do
// ambiente, porque um binário de loja com loja de mentira dentro é o app
// inteiro sem caixa.
if (!teste && process.env.RC_MOCK === "1") {
  console.error("\n✗ RC_MOCK=1 no ambiente de um build de PRODUÇÃO — o binário sairia com a loja simulada.");
  console.error("  Rode sem RC_MOCK, ou use `npm run loja -- --teste` se é build de teste.\n");
  process.exit(1);
}

// 2. build + sync
sh(teste ? "RC_MOCK=1 npm run build" : "npm run build");
sh(`npx cap sync ${LOJA.plataforma}`);

// 3. tira os rastreadores de anúncio do index.html do binário
const indexApp = join(ASSETS, "index.html");
if (!existsSync(indexApp)) {
  console.error(`\n✗ ${indexApp} não existe — o cap sync não rodou?\n`);
  process.exit(1);
}
let html = readFileSync(indexApp, "utf8");
for (const bloco of html.match(/<script[\s\S]*?<\/script>/gi) ?? []) {
  const achado = ASSINATURAS.find((a) => a.re.test(bloco));
  if (!achado) continue;
  html = html.replace(bloco, "");
  console.log(`  − rastreador: ${achado.nome}`);
}
// Os comentários que embrulhavam os blocos ficam órfãos e são inertes, mas um
// binário com "<!-- Meta Pixel Code -->" dentro engana quem for auditar.
html = html.replace(/[ \t]*<!--[^>]*(TikTok Pixel|Meta Pixel|Google tag)[^>]*-->\n?/gi, "");
writeFileSync(indexApp, html);

// A prova. Se o build da Vite um dia mudar o formato do index.html e um
// rastreador escapar, o build TEM que parar — descobrir isso depois de
// publicar significa Data Safety declarado errado na loja.
const escaparam = ASSINATURAS.filter((a) => a.re.test(html)).map((a) => a.nome);
if (escaparam.length) {
  console.error(`\n✗ rastreador sobrou no binário: ${escaparam.join(", ")}`);
  console.error("  Ajuste ASSINATURAS em scripts/preparar-loja.mjs antes de publicar.\n");
  process.exit(1);
}

// 4. tira o peso morto
const antes = tamanho(ASSETS);
for (const alvo of MORTO) {
  const p = join(ASSETS, alvo);
  if (!existsSync(p)) continue;
  console.log(`  − ${alvo} (${mb(tamanho(p))})`);
  rmSync(p, { recursive: true, force: true });
}
console.log(`\n✓ assets do app: ${mb(antes)} → ${mb(tamanho(ASSETS))}`);
if (alvoIOS) {
  // No iOS o binário não sai da linha de comando sem certificado e perfil
  // resolvidos — quem assina é o Xcode. Então o script para aqui, no mesmo
  // ponto em que o Android para antes do gradle.
  console.log("\nAgora: npx cap open ios → Product ▸ Archive (device/Any iOS Device)");
  console.log("Simulador: npx cap run ios");
} else {
  console.log(teste
    ? "\nAgora: ./android/gradlew -p android assembleDebug"
    : "\nAgora: ./android/gradlew -p android bundleRelease");
}
