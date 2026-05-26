import { useEffect } from "react";

/**
 * Faz a tab ativa rolar para a viewport (apenas horizontalmente, dentro do
 * próprio container de tabs) quando muda. NÃO mexe no scroll vertical da página.
 *
 * Coloque `data-active={activeTab === tab.id}` em cada botão de tab.
 */
export const useScrollActiveTabIntoView = (activeTab: string) => {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[data-active="true"]');
      if (!el) return;

      // Sobe até o ancestral rolável horizontalmente
      let container: HTMLElement | null = el.parentElement;
      while (container) {
        const style = window.getComputedStyle(container);
        const overflowX = style.overflowX;
        if (
          (overflowX === "auto" || overflowX === "scroll") &&
          container.scrollWidth > container.clientWidth
        ) {
          break;
        }
        container = container.parentElement;
      }
      if (!container) return;

      const elLeft = el.offsetLeft - container.offsetLeft;
      const elRight = elLeft + el.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;

      // Já visível? não faz nada.
      if (elLeft >= viewLeft && elRight <= viewRight) return;

      const target = elLeft - container.clientWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({
        left: Math.max(0, target),
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);
};
