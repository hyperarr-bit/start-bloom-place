import { useEffect, type RefObject } from "react";
import { quantoSubir } from "@/hooks/use-botao-acima-do-teclado";

/* Movido do MontarFinancas (20/10) pra servir também o "Rotina pronta em 3 toques" (MontarRotina): a mesma folha fixa
 * de tela inteira, o mesmo teclado do iPhone cobrindo o "+ Outro" e o botão. Quem usa esconde o que sobra com
 * `[data-teclado]` no CSS dele. */
/**
 * Com o teclado do iPhone aberto, a folha (fixa, tela inteira) passa a ocupar só a área VISÍVEL
 * (visualViewport): o campo em foco vai pro meio e o botão fica logo acima do teclado. Fora do
 * iPhone (sem visualViewport encolhendo) nada muda. A faixa da missão, se estiver visível em cima,
 * continua por cima: a folha começa embaixo dela.
 */
/** A altura da faixa da missão lida do CSS. 1.0.17: no dia 1 sem faixa ela é "0px" — o `|| 40` de antes virava 40 (0 é
 *  falso) e a folha descia 40 px por nada com o teclado aberto. Sem valor legível: 40, a altura padrão. */
export const alturaDaFaixa = (valorCss: string): number => {
  const n = parseFloat(valorCss);
  return Number.isFinite(n) && n >= 0 ? n : 40;
};
export function useFolhaAcimaDoTeclado(ref: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const el = ref.current;
    if (!vv || !el) return;
    let aberto = false;
    let t = 0;
    const centralizarCampo = () => {
      const ativo = document.activeElement as HTMLElement | null;
      if (!(ativo && el.contains(ativo) && /^(INPUT|TEXTAREA)$/.test(ativo.tagName))) return;
      ativo.scrollIntoView?.({ block: "center" });
      mostrarOJunto(ativo);
    };
    /* 1.0.17 (iPhone SE, teclado de verdade, passo do cartão): com o teclado na "Fatura deste mês", os dias de "Vence todo
     * dia" — a próxima escolha, logo abaixo — ficavam atrás do botão colado "Ver quanto posso gastar". O bloco marcado
     * `data-teclado-junto` em volta do campo sobe até terminar acima do rodapé (`data-teclado-rodape`), sem tirar o campo
     * em foco da vista. */
    const mostrarOJunto = (ativo: HTMLElement) => {
      const bloco = ativo.closest<HTMLElement>("[data-teclado-junto]");
      const rodape = el.querySelector<HTMLElement>("[data-teclado-rodape]");
      if (!bloco || !rodape) return;
      let rolo: HTMLElement | null = bloco.parentElement;
      while (rolo && rolo !== el && !/^(auto|scroll)$/.test(getComputedStyle(rolo).overflowY)) rolo = rolo.parentElement;
      if (!rolo || rolo === el) return;
      const d = quantoSubir(bloco.getBoundingClientRect().bottom + 8, rodape.getBoundingClientRect().top, ativo.getBoundingClientRect().top, rolo.getBoundingClientRect().top + 8);
      if (d >= 1) rolo.scrollTop += d;
    };
    const soltar = () => {
      el.style.removeProperty("top");
      el.style.removeProperty("bottom");
      el.style.removeProperty("height");
      el.removeAttribute("data-teclado");
    };
    const aplicar = () => {
      t = 0;
      const agoraAberto = vv.height < window.innerHeight - 140;
      if (!agoraAberto) { if (aberto) soltar(); aberto = false; return; }
      const html = document.documentElement;
      const faixa = html.hasAttribute("data-missao-doses-faixa")
        ? alturaDaFaixa(getComputedStyle(html).getPropertyValue("--missao-doses-faixa-h"))
        : 0;
      const topo = Math.max(vv.offsetTop, faixa);
      el.style.top = `${topo}px`;
      el.style.bottom = "auto";
      el.style.height = `${Math.max(0, vv.offsetTop + vv.height - topo)}px`;
      el.setAttribute("data-teclado", "");
      if (!aberto) window.setTimeout(centralizarCampo, 30); // acabou de abrir: o campo vai pro meio
      aberto = true;
    };
    const agendar = () => { if (!t) t = window.setTimeout(aplicar, 0); };
    // trocou de campo com o teclado já aberto: centraliza o novo
    const aoFocar = () => { if (aberto) window.setTimeout(centralizarCampo, 30); };
    vv.addEventListener("resize", agendar);
    vv.addEventListener("scroll", agendar);
    el.addEventListener("focusin", aoFocar);
    aplicar();
    return () => {
      vv.removeEventListener("resize", agendar);
      vv.removeEventListener("scroll", agendar);
      el.removeEventListener("focusin", aoFocar);
      if (t) window.clearTimeout(t);
      soltar();
    };
  }, [ref]);
}
