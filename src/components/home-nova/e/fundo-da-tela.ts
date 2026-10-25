import { useEffect } from "react";

/**
 * O FUNDO DA TELA ATÉ O TOPO (adendo 26/10 — print do dono no iPhone b46 × Cal AI). A faixa do relógio
 * (.app-safe-top-guard, App.tsx/index.css) pinta a área segura de cima com o branco do tema por cima de tudo; na Home
 * nova, cinza-clara, ficava uma faixa branca atrás do relógio/ilha. Enquanto uma tela da E está montada (Home, Você,
 * Personalizar início), o <html> ganha `he-fundo-da-tela` (home-e.css): a faixa fica na cor do TOPO da E, translúcida
 * com um leve desfoque (ao rolar, o conteúdo passa por trás sem faixa branca), e a casca (html/body/.app-safe-shell)
 * pinta o fundo da E — claro e escuro. É o mesmo mecanismo das Conquistas do Codex (html.cn-fundo-da-tela).
 * Pilha: duas telas montadas juntas não se atropelam — a classe só sai quando a última desmonta.
 */
export const CLASSE_FUNDO_DA_TELA_E = "he-fundo-da-tela";
let montadas = 0;

export function useFundoDaTelaE(ativo = true) {
  useEffect(() => {
    if (!ativo || typeof document === "undefined") return;
    const raiz = document.documentElement;
    montadas += 1;
    raiz.classList.add(CLASSE_FUNDO_DA_TELA_E);
    return () => {
      montadas = Math.max(0, montadas - 1);
      if (montadas === 0) raiz.classList.remove(CLASSE_FUNDO_DA_TELA_E);
    };
  }, [ativo]);
}

/** só pros testes */
export const _zerarFundoDaTelaE = () => { montadas = 0; document.documentElement.classList.remove(CLASSE_FUNDO_DA_TELA_E); };
