import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * MOLDURA DO IPHONE — só pros prints do mockup (/dev/home-nova?status=1). Desenha a barra de status
 * (hora, sinal, wi-fi, bateria), a Dynamic Island e o indicador de home por cima de tudo, e põe as áreas
 * seguras de um iPhone 15 (59 pt em cima, 34 embaixo) nas variáveis que o app já usa. É um portal no
 * <body> pra ficar DEPOIS do .app-safe-top-guard na ordem do DOM (os dois têm o mesmo z-index máximo).
 */
export const MolduraIphone = ({ fundo }: { fundo: string | null }) => {
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--app-safe-top", "59px");
    r.style.setProperty("--app-safe-bottom", "34px");
    // fundo null (a E): a faixa do relógio fica com a cor de verdade da tela (html.he-fundo-da-tela, home-e.css)
    if (fundo) r.style.setProperty("--safe-top-cor", fundo);
    return () => { r.style.removeProperty("--app-safe-top"); r.style.removeProperty("--app-safe-bottom"); r.style.removeProperty("--safe-top-cor"); };
  }, [fundo]);

  return createPortal(
    <>
      <div className="hn-status" aria-hidden data-testid="hn-status">
        <span className="hn-hora">9:41</span>
        <span className="hn-ilha" />
        <span className="hn-status-icones">
          {/* sinal */}
          <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor"><rect x="0" y="8" width="3.4" height="4" rx="1" /><rect x="5" y="5.5" width="3.4" height="6.5" rx="1" /><rect x="10" y="3" width="3.4" height="9" rx="1" /><rect x="15" y="0" width="3.4" height="12" rx="1" /></svg>
          {/* wi-fi */}
          <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 11.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" /><path d="M3.9 7.2a6.6 6.6 0 0 1 9.2 0l-1.3 1.3a4.8 4.8 0 0 0-6.6 0L3.9 7.2Z" /><path d="M.6 3.9a11.3 11.3 0 0 1 15.8 0l-1.3 1.3a9.5 9.5 0 0 0-13.2 0L.6 3.9Z" /></svg>
          {/* bateria */}
          <svg width="28" height="13" viewBox="0 0 28 13" fill="none"><rect x="0.5" y="0.5" width="24" height="12" rx="3.5" stroke="currentColor" strokeOpacity="0.4" /><rect x="2" y="2" width="21" height="9" rx="2" fill="currentColor" /><path d="M26 4.5v4a2 2 0 0 0 0-4Z" fill="currentColor" fillOpacity="0.4" /></svg>
        </span>
      </div>
      <div className="hn-indicador" aria-hidden />
    </>,
    document.body,
  );
};
