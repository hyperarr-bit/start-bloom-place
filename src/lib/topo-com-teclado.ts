/**
 * TOPO PRESO NA TELA COM O TECLADO (1.0.22, dono 29/10 — "o borrão não funciona nos módulos… aparece horário sobrepondo
 * os módulos", prints do Simulador em Biblioteca e Saúde).
 *
 * Causa: com um campo focado (teclado ou só a barra ⌃ ⌄ ✓ do teclado), a área visível do WKWebView fica menor que a
 * janela e, rolando até o fim da página, o iPhone DESLOCA a área visível dentro da janela (visualViewport.offsetTop > 0).
 * Tudo que é `fixed`/`sticky` no topo é preso à JANELA, não à área visível: o cabeçalho do módulo (sticky em
 * --app-safe-top) subia pra baixo do relógio/ilha e a faixa de vidro do relógio (.app-safe-top-guard, fixed em 0) saía
 * da tela — o horário ficava em cima do título, sem borrão. Reproduzido no Simulador: focar "Novo suplemento" na Saúde e
 * rolar até o fim.
 *
 * Conserto: este deslocamento vira a variável --vv-topo no <html> (0 quando não há deslocamento) e o CSS soma ela no
 * `top` do cabeçalho sticky, das faixas fixas e na posição da faixa do relógio (index.css). Com zoom de pinça
 * (scale ≠ 1) não mexe: aí o deslocamento é do zoom, não do teclado. Na web/Android sem deslocamento fica 0 — nada muda.
 */
let instalada = false;

export function instalarTopoComTeclado(): void {
  if (instalada || typeof window === "undefined") return;
  const vv = window.visualViewport;
  if (!vv) return;
  instalada = true;
  const raiz = document.documentElement;
  let atual = -1;
  let quadro = 0;
  const aplicar = () => {
    quadro = 0;
    const d = Math.abs(vv.scale - 1) < 0.01 ? Math.max(0, Math.round(vv.offsetTop)) : 0;
    if (d === atual) return;
    atual = d;
    if (d > 0) raiz.style.setProperty("--vv-topo", `${d}px`);
    else raiz.style.removeProperty("--vv-topo");
  };
  const medir = () => {
    // na hora (o deslocamento chega junto da rolagem; esperar um quadro deixa o cabeçalho piscar sob o relógio) e de novo
    // no próximo quadro (o WKWebView às vezes só atualiza o offsetTop depois do evento)
    aplicar();
    if (!quadro) quadro = requestAnimationFrame(aplicar);
  };
  vv.addEventListener("resize", medir);
  vv.addEventListener("scroll", medir);
  window.addEventListener("scroll", medir, { passive: true });
  window.addEventListener("focusout", () => setTimeout(medir, 350));
  aplicar();
}
