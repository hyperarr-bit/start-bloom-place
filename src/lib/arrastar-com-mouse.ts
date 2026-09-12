/**
 * Arrastar com o mouse qualquer faixa que rola pro lado (11/09, cliente na
 * web: "as ações rápidas não tá dando pra arrastar pro lado").
 *
 * O app foi desenhado pro dedo: 48 faixas com `overflow-x-auto`, muitas com a
 * barra escondida (`scrollbar-hide`). No celular o dedo arrasta. No computador
 * com mouse não existe arrasto nativo, e sem barra visível a pessoa não tem
 * como chegar no que está escondido à direita (a 4ª aba da Biblioteca, as
 * últimas ações rápidas, os filtros de Viagens…). Trackpad e shift+roda
 * funcionam, mas ninguém descobre.
 *
 * Instalado UMA vez no boot, só em aparelho com ponteiro fino (mouse). No
 * toque não faz nada. Regra: mousedown dentro de um ancestral que rola pro
 * lado → a partir de 6 px de movimento vira arrasto (cursor de mão fechada,
 * sem seleção de texto) e o click que viria logo depois é engolido, pra não
 * abrir o botão em que o arrasto começou. Campos de texto, selects e sliders
 * ficam de fora: neles o arrasto tem outro significado.
 */
const LIMIAR_PX = 6;
const FORA = "input, textarea, select, [contenteditable=true], [draggable=true], [role=slider]";

const faixaQueRola = (inicio: Element | null): HTMLElement | null => {
  for (let el = inicio as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox === "auto" || ox === "scroll") return el;
  }
  return null;
};

export function instalarArrastarComMouse() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!window.matchMedia?.("(pointer: fine)")?.matches) return;

  let faixa: HTMLElement | null = null;
  let x0 = 0;
  let rolagem0 = 0;
  let arrastou = false;

  const soltar = () => {
    if (!faixa) return;
    faixa.style.cursor = "";
    faixa.style.userSelect = "";
    faixa.style.scrollSnapType = "";
    faixa = null;
    if (!arrastou) return;
    // O click que fecha este mouseup é do arrasto, não da pessoa: engole.
    const engolir = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener("click", engolir, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", engolir, { capture: true }), 0);
  };

  document.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0) return;
    const alvo = ev.target as Element | null;
    if (!alvo || alvo.closest(FORA)) return;
    faixa = faixaQueRola(alvo);
    if (!faixa) return;
    x0 = ev.clientX;
    rolagem0 = faixa.scrollLeft;
    arrastou = false;
  });

  document.addEventListener("mousemove", (ev) => {
    if (!faixa) return;
    const dx = ev.clientX - x0;
    if (!arrastou) {
      if (Math.abs(dx) < LIMIAR_PX) return;
      arrastou = true;
      faixa.style.cursor = "grabbing";
      faixa.style.userSelect = "none";
      faixa.style.scrollSnapType = "none";
    }
    faixa.scrollLeft = rolagem0 - dx;
    ev.preventDefault();
  });

  document.addEventListener("mouseup", soltar);
  window.addEventListener("blur", soltar);
  // Imagens e links iniciam um arrasto nativo do navegador; durante o nosso, não.
  document.addEventListener("dragstart", (ev) => { if (faixa) ev.preventDefault(); });
}
