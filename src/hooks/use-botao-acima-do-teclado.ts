import { useEffect, type RefObject } from "react";

/**
 * O BOTÃO DO FORMULÁRIO ACIMA DO TECLADO DO iPHONE (1.0.17 — iPhone SE, toque real no Simulador com o teclado de
 * software: no cadastro pós-compra, com o teclado no "Seu nome", o "Salvar meu acesso" ficava meio atrás da barra do
 * teclado). O iPhone rola a página só até mostrar o CAMPO; o botão logo abaixo fica cortado e ela não sabe que é só
 * tocar nele.
 *
 * Com o teclado aberto (visualViewport encolhido) e o foco num campo do mesmo <form> do botão, a página (ou o rolo que
 * contém o botão) sobe o que falta pro botão ficar inteiro acima do teclado — sem nunca empurrar o campo em foco pra
 * fora da área visível. Fora do iPhone (sem visualViewport encolhendo) nada acontece.
 */
const FOLGA = 12;
const rolavel = (el: HTMLElement | null): HTMLElement | null => {
  for (let p = el?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
};

/** Quanto subir (px) pra `fundo` (o fim do que tem de aparecer) ficar acima de `limite`, sem o topo do campo em foco
 *  passar de `topoMin`. Puro, pra teste. */
export function quantoSubir(fundo: number, limite: number, topoDoCampo: number, topoMin: number): number {
  const falta = fundo - limite;
  if (falta <= 0) return 0;
  return Math.max(0, Math.min(falta, topoDoCampo - topoMin));
}

export function useBotaoAcimaDoTeclado(botao: RefObject<HTMLElement>) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    let t = 0;
    const ajustar = () => {
      t = 0;
      const b = botao.current;
      if (!b || !(vv.height < window.innerHeight - 140)) return;
      const ativo = document.activeElement as HTMLElement | null;
      if (!ativo || !/^(INPUT|TEXTAREA)$/.test(ativo.tagName)) return;
      const form = b.closest("form");
      if (form && !form.contains(ativo)) return;
      const visivelEmbaixo = vv.offsetTop + vv.height;
      const d = quantoSubir(b.getBoundingClientRect().bottom + FOLGA, visivelEmbaixo, ativo.getBoundingClientRect().top, vv.offsetTop + 8);
      if (d < 1) return;
      const rolo = rolavel(b);
      if (rolo) rolo.scrollTop += d;
      else window.scrollBy(0, d);
    };
    // depois da rolagem do próprio iPhone (ele mostra o campo primeiro)
    const agendar = () => { if (t) window.clearTimeout(t); t = window.setTimeout(ajustar, 80); };
    vv.addEventListener("resize", agendar);
    vv.addEventListener("scroll", agendar);
    document.addEventListener("focusin", agendar);
    return () => {
      vv.removeEventListener("resize", agendar);
      vv.removeEventListener("scroll", agendar);
      document.removeEventListener("focusin", agendar);
      if (t) window.clearTimeout(t);
    };
  }, [botao]);
}
