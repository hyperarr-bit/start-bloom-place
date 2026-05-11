import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Register service worker only in production, not in iframes/preview
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    // Clean: don't register SW in dev
  });
} else if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Prevent double-tap zoom (iOS Safari + alguns Android) e pinch-zoom via gesto
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false }
);
// Bloqueia pinch-zoom em navegadores que ainda permitem (Safari iOS)
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
// Bloqueia ctrl+scroll zoom no desktop
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
