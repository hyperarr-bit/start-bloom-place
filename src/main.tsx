import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { initPwaInstall } from "@/lib/pwa-install";
import { isNativeShell } from "@/lib/native-shell";

// Rede de segurança da classe core-shell (o index.html já tenta no boot):
// se a injeção do Capacitor chegar depois do bloco inline por qualquer
// mudança de ordem, aqui garante antes do React montar. O CSS do shell
// (ex.: matar outline de foco preso) depende só desta classe.
if (isNativeShell()) document.documentElement.classList.add("core-shell");

// Telemetria de crash (15/07): cliente reportou "tela branca ao pagar" e a
// gente só tinha silêncio nos eventos — sem isso, todo crash é adivinhação.
// Rate-limit de 1 report/20s pra nunca inundar o analytics em loop de erro.
let lastJsErrorAt = 0;
const reportJsError = (kind: string, message: string, extra: Record<string, unknown> = {}) => {
  const now = Date.now();
  if (now - lastJsErrorAt < 20_000) return;
  lastJsErrorAt = now;
  try {
    trackEvent("js_error", {
      kind,
      message: String(message || "?").slice(0, 300),
      route: window.location.pathname + window.location.search.slice(0, 60),
      ua: navigator.userAgent.slice(0, 160),
      ...extra,
    });
  } catch { /* nunca deixar o report derrubar nada */ }
};
window.addEventListener("error", (e) => {
  reportJsError("error", e.message, { source: `${e.filename?.split("/").pop() ?? "?"}:${e.lineno ?? "?"}` });
});
window.addEventListener("unhandledrejection", (e) => {
  const r = (e as PromiseRejectionEvent).reason;
  reportJsError("unhandledrejection", r?.message ?? String(r ?? "?"));
});

// Deploy troca os chunks hasheados e APAGA os antigos. Quem estava com o site
// aberto de antes fica com imports quebrados → TELA BRANCA (caso real 15/07:
// cliente travada no "vou pagar e fica branco"). O Vite emite vite:preloadError
// nesses casos — recarrega 1x pra pegar a versão nova. Guarda em sessionStorage
// evita loop se o reload não resolver.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "core-chunk-reload-at";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return; // já tentou há pouco — deixa o erro subir
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* segue e recarrega mesmo assim */ }
  event.preventDefault();
  // reload() puro pode devolver o MESMO index.html velho do cache do Safari
  // (caso da demo branca de 21/07). O param novo muda a URL → cache miss →
  // HTML fresco com os chunks novos. O param é inerte pro app.
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("core-cb", String(Date.now() % 1e7));
    window.location.replace(u.toString());
  } catch {
    window.location.reload();
  }
});

// Always unregister any previously-installed service worker and wipe caches.
// Past versions of this app may have registered a SW that is now serving
// stale HTML/JS/assets to returning visitors. This self-heals them.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {});
  }
}



// Captura o beforeinstallprompt ANTES do React montar (o evento pode disparar
// cedo e só dispara uma vez). Sem service worker: o bloco acima continua
// desregistrando qualquer SW — Chrome instala só com o manifest.
initPwaInstall();

/* UTM/fbclid no BOOT, antes do router (12/08). A captura vivia só no
 * useEffect das páginas de funil — e efeito roda DEPOIS do commit, quando o
 * <Navigate replace> de quem já é logado/assinante (ComecarDia14) ou da raiz
 * (RootGate) já limpou a URL. Resultado medido hoje: 6 de 10 vendas web "sem
 * utm" no banco e na UTMify — todas de gente com conta antiga que clicou no
 * anúncio de novo — enquanto o pixel da Meta (que lê a URL no boot, antes do
 * redirect) atribuía normalmente. Aqui é síncrono e ANTES do createRoot:
 * nenhum redirect corre antes. As chamadas nas páginas ficam — são no-op
 * inofensivo (a linha 40 da analytics não sobrescreve pago com vazio). */
captureLandingMeta();

createRoot(document.getElementById("root")!).render(<App />);
