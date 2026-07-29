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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
