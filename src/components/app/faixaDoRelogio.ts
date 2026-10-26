import { useEffect } from "react";

/**
 * FAIXA DO RELÓGIO SOB TELAS ESCURAS (QA de Simulador da 1.0.18). O `.app-safe-top-guard` (App.tsx/index.css) pinta a
 * área segura de cima com a cor do fundo (branca) por cima de TUDO (z-index máximo). Tela cheia escura — o álbum, o
 * escurecido da folha "O que te fez parar?" — ficava com uma faixa branca atrás do relógio. Enquanto uma delas está
 * montada, a faixa fica transparente: o próprio fundo dela (fixed inset-0) cobre a tela inteira, inclusive atrás do
 * relógio; o conteúdo continua respeitando a área segura pelo padding de sempre.
 *
 * Pilha: duas telas abertas juntas não se atropelam — a faixa só volta quando a última fecha.
 *
 * Varredura 26/10: na Home nova a faixa também tem DESFOQUE (home-e.css) — transparente mas desfocada, o conteúdo atrás
 * do relógio ficava borrado/nítido por cima do escurecido das folhas. Enquanto transparente, o <html> ganha a classe
 * CLASSE_TRANSPARENTE e o index.css tira o desfoque. As folhas de baixo da Home nova usam isto via
 * `FaixaDoRelogioSobFolha` (folha-arrasto.tsx): o escurecido cobre até o topo.
 */
const VAR = "--safe-top-cor";
export const CLASSE_TRANSPARENTE = "faixa-relogio-transparente";
let abertas = 0;
let anterior: string | null = null;

export function useFaixaDoRelogioTransparente(ativo = true) {
  useEffect(() => {
    if (!ativo || typeof document === "undefined") return;
    const raiz = document.documentElement;
    if (abertas === 0) anterior = raiz.style.getPropertyValue(VAR) || null;
    abertas += 1;
    raiz.style.setProperty(VAR, "transparent");
    raiz.classList.add(CLASSE_TRANSPARENTE);
    return () => {
      abertas = Math.max(0, abertas - 1);
      if (abertas > 0) return;
      raiz.classList.remove(CLASSE_TRANSPARENTE);
      if (anterior) raiz.style.setProperty(VAR, anterior);
      else raiz.style.removeProperty(VAR);
      anterior = null;
    };
  }, [ativo]);
}
