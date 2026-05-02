import { useEffect } from "react";

/**
 * Faz a tab ativa rolar para a viewport quando muda.
 * Usa um seletor genérico: qualquer elemento com [data-active="true"]
 * dentro do cabeçalho rolável (overflow-x-auto).
 *
 * Coloque `data-active={activeTab === tab.id}` em cada botão de tab.
 */
export const useScrollActiveTabIntoView = (activeTab: string) => {
  useEffect(() => {
    // pequena espera pro DOM atualizar
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-active="true"]');
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }, 30);
    return () => window.clearTimeout(id);
  }, [activeTab]);
};
