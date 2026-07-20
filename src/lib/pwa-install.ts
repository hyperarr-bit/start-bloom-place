import { useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";

/** Instalação do PWA sem service worker NENHUM: o main.tsx desregistra SW de
 *  propósito (auto-cura do cache velho) e Chrome moderno instala só com o
 *  manifest. Este módulo captura o beforeinstallprompt cedo (import no
 *  main.tsx), guarda o prompt e expõe um hook pros convites de instalação.
 *
 *  Também marca a coorte: quem roda INSTALADO dispara `pwa_open` 1x/sessão —
 *  é o que permite comparar retenção instalado × navegador no analytics. */

type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BipEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Mesma marca do RootGate: lançou pelo ícone alguma vez = é PWA. */
export const rodandoInstalado = (): boolean => {
  try {
    if (new URLSearchParams(window.location.search).get("fonte") === "pwa") return true;
    if (localStorage.getItem("core-pwa") === "true") return true;
  } catch { /* noop */ }
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (window.navigator as { standalone?: boolean }).standalone === true;
};

export const ehIosSafari = (): boolean => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  // Chrome/Firefox no iOS também instalam pelo mesmo gesto do Safari (WebKit),
  // mas o passo-a-passo que mostramos é o do Safari — só cobrimos ele.
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export const initPwaInstall = () => {
  // Persiste a marca AGORA, com o ?fonte=pwa ainda na URL — depois o router
  // troca a rota e o param some. Sem isso, usuário logado abrindo pelo ícone
  // não era reconhecido como instalado (e via convite de instalar de novo).
  try {
    if (rodandoInstalado()) localStorage.setItem("core-pwa", "true");
  } catch { /* noop */ }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // segura o mini-infobar do Chrome; o convite é nosso
    deferredPrompt = e as BipEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
    trackEvent("pwa_installed");
  });

  // Coorte instalado × navegador: 1 evento por sessão, só quando instalado.
  try {
    if (rodandoInstalado() && !sessionStorage.getItem("core-pwa-open-sent")) {
      sessionStorage.setItem("core-pwa-open-sent", "true");
      trackEvent("pwa_open");
    }
  } catch { /* noop */ }
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => deferredPrompt !== null;

/** canInstall = Chrome/Android com prompt na mão. iOS nunca tem prompt —
 *  lá o convite vira passo-a-passo (Compartilhar → Adicionar à Tela de Início). */
export const usePwaInstall = () => {
  const canInstall = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const promptInstall = async () => {
    const bip = deferredPrompt;
    if (!bip) return;
    trackEvent("pwa_install_click");
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    trackEvent(outcome === "accepted" ? "pwa_install_accepted" : "pwa_install_dismissed");
    if (outcome === "accepted") {
      deferredPrompt = null;
      notify();
    }
  };

  return { canInstall, promptInstall, instalado: rodandoInstalado(), iosSafari: ehIosSafari() };
};
