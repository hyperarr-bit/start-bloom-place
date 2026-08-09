import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/**
 * A versão do app, lida do build.gradle no momento do build (29/07).
 *
 * O app não mostrava versão em canto nenhum, e isso custou uma investigação
 * inteira: o dono testou o login com Google, disse que ainda ia pro site, e
 * não dava pra saber se o conserto falhou ou se o aparelho estava com um
 * build de cinco dias atrás. Lida do gradle, e não escrita à mão, pra nunca
 * divergir do que a Play mostra.
 */
const versaoDoApp = (() => {
  try {
    const g = fs.readFileSync(path.resolve(__dirname, "android/app/build.gradle"), "utf8");
    const nome = g.match(/versionName\s+"([^"]+)"/)?.[1];
    const codigo = g.match(/versionCode\s+(\d+)/)?.[1];
    return nome && codigo ? `${nome} (${codigo})` : "dev";
  } catch {
    return "dev";
  }
})();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Constante global, NÃO "import.meta.env.X": definir uma chave isolada de
  // import.meta.env faz o Vite substituir o objeto inteiro e derruba as
  // outras (VITE_SUPABASE_URL etc). Foi o que quebrou o smoke agora há pouco.
  define: {
    __APP_VERSION__: JSON.stringify(versaoDoApp),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  /*
   * TELA BRANCA EM ANDROID ANTIGO (03/08).
   *
   * Sem target explícito o Vite mira "navegadores de ~2020" (Chrome 87+), e o
   * bundle saía com sintaxe/globais que WebView velho não conhece —
   * `globalThis` aparecia 45× e só existe no Chrome 71+. Resultado real: um
   * aparelho de teste abriu o app numa tela branca muda, e como campanha de
   * app mira exatamente o Android popular sem atualização, cada instalação
   * dessas era dinheiro pago por alguém que nunca viu o paywall.
   *
   * es2015 é o piso de SINTAXE (esbuild transpila optional chaining, async,
   * etc). Globais de runtime que a transpilação não cobre (globalThis & cia)
   * têm polyfill inline no index.html, ANTES do bundle carregar.
   */
  build: {
    target: "es2015",
    /*
     * cssTarget EXPLÍCITO (04/08) — o es2015 acima quase desfez a si mesmo.
     *
     * Sem cssTarget, o Vite herda o build.target pro CSS. Só que "es2015"
     * não é navegador — não tem tabela de features CSS — e o esbuild PAROU
     * de rebaixar o shorthand `inset`. O target padrão (que inclui safari14)
     * expandia `inset: 0` em top/right/bottom/left; com es2015 o bundle
     * passou a entregar `inset:` puro, que WebView < Chrome 87 descarta como
     * propriedade desconhecida.
     *
     * O estrago no aparelho antigo (foto do dono, 04/08): todo overlay
     * `fixed inset-0` (paywall, spotlight, dialogs) deixava de cobrir a
     * tela, camadas de fundo `absolute inset-0` colapsavam (superfícies
     * cruas/cinzas) e a barra de progresso do funil v2 não pintava. Ou
     * seja: a mudança feita PARA os WebViews antigos quebrava o CSS
     * exatamente neles.
     *
     * chrome61: expande o inset E converte cores hex-alpha (#RRGGBBAA, que
     * é Chrome 62+) pra rgba() — mesmo piso do polyfill de globalThis.
     * Verificado por diff byte a byte: fora inset e hex→rgba, o CSS é
     * idêntico ao de antes do es2015.
     */
    cssTarget: "chrome61",
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // APK de TESTE (RC_MOCK=1, setado só pelo `npm run loja -- --teste`):
      // troca o plugin do RevenueCat por uma loja simulada controlável, pra
      // validar cancelamento/downsell/compra/cadastro-pós-compra no emulador.
      // O build de PRODUÇÃO aborta se RC_MOCK existir (preparar-loja.mjs).
      ...(process.env.RC_MOCK === "1"
        ? { "@revenuecat/purchases-capacitor": path.resolve(__dirname, "./src/dev/rc-plugin-mock.ts") }
        : {}),
    },
  },
}));
