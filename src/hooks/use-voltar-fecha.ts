import { useEffect, useRef } from "react";

/**
 * VOLTAR FECHA A FOLHA (1.0.19) — o padrão do AppPurchaseSheet: enquanto a folha está aberta existe uma
 * entrada FANTASMA no histórico; o primeiro Voltar (botão do Android, gesto, seta do navegador) consome a
 * entrada e fecha a folha em vez de sair da tela. Fechar pelo X desfaz a entrada (history.back) pra pilha
 * não crescer. Uma folha por vez — duas abertas ao mesmo tempo fechariam juntas no mesmo Voltar.
 */
export function useVoltarFecha(aberta: boolean, onFechar: () => void, marca = "folha"): void {
  const onFecharRef = useRef(onFechar);
  onFecharRef.current = onFechar;
  useEffect(() => {
    if (!aberta) return;
    let fechouPeloVoltar = false;
    try { history.pushState({ coreSheet: marca }, ""); } catch { return; }
    const aoVoltar = () => { fechouPeloVoltar = true; onFecharRef.current(); };
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      if (!fechouPeloVoltar && (history.state as { coreSheet?: unknown } | null)?.coreSheet === marca) {
        try { history.back(); } catch { /* noop */ }
      }
    };
  }, [aberta, marca]);
}
