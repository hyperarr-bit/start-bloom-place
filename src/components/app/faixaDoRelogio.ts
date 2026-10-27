import { useEffect } from "react";
import { aplicarBarraDeStatus } from "@/lib/status-bar";

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

/**
 * 1.0.20 — o mesmo, como componente: montado DENTRO de uma camada escura de tela cheia, vive e morre com ela (inclusive na
 * animação de saída do AnimatePresence/Radix, que mantém os filhos montados até o fim). Usado pelo menu da conta
 * (AccountDrawer) e pelas folhas da missão em doses (festas, "Dia 1 feito", plano de amanhã, convite/escolha do dia 2,
 * pré-folha do lembrete, a dica do dia e o fundo do "Escolher treino") — QA do v1020: todas ficavam com a faixa clara
 * por cima do escurecido, logo no dia 1 de toda conta nova.
 */
export function FaixaDoRelogioTransparente(): null {
  useFaixaDoRelogioTransparente(true);
  return null;
}

/**
 * 1.0.21 — o mesmo para tela de fundo ESCURO (a tela cheia do "3 dias seguidos!" da missão, o menu da conta com o
 * escurecido de 80%): a faixa fica transparente E o relógio/bateria ficam brancos enquanto ela está montada, como o
 * álbum faz (AlbumTela). Sem a troca, o relógio escuro do tema claro some no fundo escuro. Ao sair, a barra volta ao
 * tema do app.
 */
export function FaixaDoRelogioSobFundoEscuro(): null {
  useFaixaDoRelogioTransparente(true);
  useEffect(() => {
    void aplicarBarraDeStatus("dark");
    return () => { void aplicarBarraDeStatus(document.documentElement.classList.contains("dark") ? "dark" : "light"); };
  }, []);
  return null;
}
