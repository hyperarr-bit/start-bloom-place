import { useEffect, useState } from "react";

/**
 * TEM AVISO (toast) NA TELA? (26/10, agente do vídeo da welcome: registrar pelo "+" quase não deixava ver o fogo ACENDER —
 * o acender tocava ~0,8 s depois de salvar, por baixo da pílula do aviso no topo, que ocupa a largura e fica ~3–4 s.)
 * Lido do DOM do sonner (`[data-sonner-toast]`, sem os que já estão saindo `data-removed="true"`): a Home nova passa isto
 * como `coberta` pra pílula do fogo, que espera o aviso sair e acende ~0,4 s depois.
 */
const SELETOR = '[data-sonner-toast]:not([data-removed="true"])';
export const haToastNaTela = (): boolean => typeof document !== "undefined" && !!document.querySelector(SELETOR);

export function useToastNaTela(): boolean {
  const [ha, setHa] = useState(haToastNaTela);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    let quadro = 0;
    const olhar = () => { quadro = 0; setHa(haToastNaTela()); };
    const obs = new MutationObserver(() => { if (!quadro) quadro = window.requestAnimationFrame(olhar); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-removed"] });
    olhar();
    return () => { obs.disconnect(); if (quadro) window.cancelAnimationFrame(quadro); };
  }, []);
  return ha;
}
