/**
 * "O CORE está nas lojas" — pra quem comprou/usa na WEB (15/09).
 *
 * Maior causa de reembolso na web, segundo o dono: a pessoa paga e acha que
 * o CORE é "só um site". Piorava com o convite antigo de PWA ("Instale na
 * tela inicial, como um app") — que dizia, sem querer, que app mesmo não
 * tinha. Agora tem os dois: App Store e Google Play, mesma conta, mesma
 * compra. Este card substitui o de PWA na Home e no /bem-vindo, e a mesma
 * peça entra na tela de "Pronto" logo depois de pagar.
 *
 * Só na web: dentro do app das lojas não faz sentido. A loja do aparelho
 * vem primeiro (iPhone → App Store; Android → Play); no computador mostra
 * as duas, porque o celular é outro aparelho. O link da Play leva
 * `referrer` com utm_campaign=web_<origem> pra medir quantas instalações
 * nascem aqui (o app decodifica o install referrer).
 */
import { useState } from "react";
import { X } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

export const URL_APP_STORE = "https://apps.apple.com/br/app/id6806913181";
export const urlPlay = (origem: string) =>
  `https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=${encodeURIComponent(`utm_source=web&utm_medium=${origem}&utm_campaign=web_${origem}`)}`;

export type AparelhoWeb = "iphone" | "android" | "outro";
export const aparelhoDaWeb = (): AparelhoWeb => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  return "outro";
};

const DISMISS_KEY = "lojas-card-dispensado";

const Apple = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
  </svg>
);
const Play = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M4 3.3v17.4c0 .8.9 1.3 1.6.9l14.6-8.7c.6-.4.6-1.3 0-1.7L5.6 2.4C4.9 2 4 2.5 4 3.3z" />
  </svg>
);

/** Os dois botões, a loja do aparelho primeiro. Reusado na tela de "Pronto". */
export function BotoesDasLojas({ origem, className = "" }: { origem: string; className?: string }) {
  const ap = aparelhoDaWeb();
  const clique = (loja: "app_store" | "play") => trackEvent("lojas_click", { loja, origem, aparelho: ap });
  const apple = (
    <a
      key="apple"
      href={URL_APP_STORE}
      target="_blank"
      rel="noopener"
      onClick={() => clique("app_store")}
      className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-foreground text-background text-[13px] font-bold"
      data-testid="loja-app-store"
    >
      <Apple /> App Store
    </a>
  );
  const play = (
    <a
      key="play"
      href={urlPlay(origem)}
      target="_blank"
      rel="noopener"
      onClick={() => clique("play")}
      className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-foreground text-background text-[13px] font-bold"
      data-testid="loja-play"
    >
      <Play /> Google Play
    </a>
  );
  const ordem = ap === "android" ? [play, apple] : [apple, play];
  return <div className={`grid grid-cols-2 gap-2 ${className}`}>{ordem}</div>;
}

export const LojasCard = ({ variant }: { variant: "home" | "welcome" }) => {
  const [dispensado, setDispensado] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "true"; } catch { return false; }
  });
  if (isNativeShell()) return null;
  if (variant === "home" && dispensado) return null;

  const dispensar = () => {
    try { localStorage.setItem(DISMISS_KEY, "true"); } catch { /* noop */ }
    setDispensado(true);
    trackEvent("lojas_card_dispensado", {});
  };
  const ap = aparelhoDaWeb();

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative" data-testid="lojas-card">
      {variant === "home" && (
        <button
          onClick={dispensar}
          aria-label="Dispensar"
          className="absolute top-2.5 right-2.5 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <p className="text-sm font-semibold text-foreground pr-6">O CORE também é app de celular</p>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
        {ap === "outro"
          ? "Está na App Store e no Google Play. Baixa no celular e entra com o mesmo e-mail — tudo que você fizer aqui aparece lá."
          : "Baixa da loja e entra com o mesmo e-mail — sua compra já está lá, sem pagar de novo."}
      </p>
      <BotoesDasLojas origem={variant} />
    </div>
  );
};
