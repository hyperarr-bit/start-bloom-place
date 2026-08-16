import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { initPwaInstall } from "@/lib/pwa-install";
import { isNativeShell } from "@/lib/native-shell";
import { instalarResizeObserverSePreciso } from "@/lib/resize-observer-fallback";

// Rede de segurança da classe core-shell (o index.html já tenta no boot):
// se a injeção do Capacitor chegar depois do bloco inline por qualquer
// mudança de ordem, aqui garante antes do React montar. O CSS do shell
// (ex.: matar outline de foco preso) depende só desta classe.
if (isNativeShell()) document.documentElement.classList.add("core-shell");

// Navegador/WebView sem ResizeObserver derrubava o módulo Finanças INTEIRO
// (o Recharts exige, e o throw sobe até o RouteErrorBoundary). Instala antes
// do React montar; em navegador moderno isto é um `if` e nada mais.
instalarResizeObserverSePreciso();

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
//
// NUNCA chamar event.preventDefault() aqui (16/08 — era o crash nº1 de
// produção, 11 telas quebradas em /casa e 10 pessoas DIFERENTES em 7 dias).
// O helper do Vite é `carrega().catch(aoFalhar)`, e `aoFalhar` só RELANÇA se
// ninguém tiver chamado preventDefault. Com o preventDefault, aquele catch
// RESOLVE `undefined` — o React.lazy guarda _result=undefined e o
// lazyInitializer lê `undefined.default`, estourando
// "Cannot read properties of undefined (reading 'default')". Ou seja: a
// proteção contra tela branca estava CRIANDO um crash pior, porque o
// TypeError genérico não parece erro de chunk e o boundary não recarregava.
// Deixando o erro subir, a rejeição chega com a mensagem verdadeira
// ("dynamically imported module"), que o RouteErrorBoundary já sabe tratar.
//
// Chave PRÓPRIA de propósito: usar a mesma do boundary gravaria o timestamp
// milissegundos antes dele rodar e mataria o auto-reload de lá.
window.addEventListener("vite:preloadError", () => {
  const KEY = "core-preload-reload-at";
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return; // já tentou há pouco — não vira loop
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* segue e recarrega mesmo assim */ }
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
