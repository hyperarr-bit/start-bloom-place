import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
  window.location.reload();
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



createRoot(document.getElementById("root")!).render(<App />);
