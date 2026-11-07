/**
 * /oferta · a PÁGINA NOVA (06/11, AB_OFERTA_LP): o que o braço "nova" faz além do HTML do <template id="lpo-nova">.
 *   · todo botão [data-lpo-abre] abre o checkout direto (o valor do atributo é o `de` do landing_cta: topo|oferta|fim|fixo);
 *   · um toque feito antes de este módulo chegar (window.__lpoFila, script inline do landing.html) vale agora;
 *   · a barra fixa aparece enquanto nenhum botão da página está INTEIRO na tela, inclusive com fonte grande ou tela baixa na 1ª tela.
 * O checkout, a medição por bloco (data-bloco) e o resto ficam no landing.ts, iguais nos dois braços.
 */
type Janela = Window & { __lpoFila?: string | null; __lpoPronta?: boolean; Stripe?: unknown };

export function ligarOfertaNova(o: { abrir: (de: string) => void }): void {
  const w = window as Janela;
  const botoes = [...document.querySelectorAll<HTMLButtonElement>("[data-lpo-abre]")];
  for (const b of botoes) b.addEventListener("click", () => o.abrir(b.dataset.lpoAbre ?? "outro"));
  w.__lpoPronta = true;
  const fila = w.__lpoFila;
  w.__lpoFila = null;
  if (fila) o.abrir(fila);

  const barra = document.getElementById("lpo-fixo");
  if (!barra) return;
  const botaoDaBarra = barra.querySelector("button");
  const mostrar = (on: boolean) => {
    barra.toggleAttribute("data-on", on);
    barra.setAttribute("aria-hidden", on ? "false" : "true");
    if (botaoDaBarra) botaoDaBarra.tabIndex = on ? 0 : -1;
  };
  if (!("IntersectionObserver" in window)) { mostrar(true); return; }
  const naTela = new Set<Element>();
  const io = new IntersectionObserver((ens) => {
    for (const en of ens) { if (en.isIntersecting && en.intersectionRatio >= 0.99) naTela.add(en.target); else naTela.delete(en.target); }
    mostrar(naTela.size === 0);
  }, { threshold: [0, 1] });
  botoes.filter((b) => !barra.contains(b)).forEach((b) => io.observe(b));
}

/** quem já comprou neste aparelho: tira a página nova e mostra o #lp-pix ("Você já tem o CORE"), que o CSS da /oferta esconde.
 *  O estilo vai no próprio nó: quem nunca comprou continua sem ver diferença nenhuma no braço atual. */
export function sairDaOfertaNova(): void {
  document.querySelectorAll("#lpo, #lpo-fixo").forEach((el) => el.remove());
  document.documentElement.setAttribute("data-lpo", "atual");
  document.getElementById("lp-pix")?.style.setProperty("display", "block", "important");
}

/** Baixa o Stripe.js sem executar. O <script> continua sendo o do checkout e aproveita o download, mesmo se o toque vier no meio dele. */
export function preaquecerStripe(): void {
  if ((window as Janela).Stripe || document.querySelector('script[src*="js.stripe.com"], link[href*="js.stripe.com"]')) return;
  const l = document.createElement("link");
  l.rel = "preload"; l.as = "script"; l.href = "https://js.stripe.com/v3";
  document.head.appendChild(l);
}
