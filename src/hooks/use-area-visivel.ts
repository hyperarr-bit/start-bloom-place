import { useEffect, useState, type CSSProperties } from "react";

/**
 * A ÁREA VISÍVEL com o teclado do celular (iPhone/WKWebView, 26/10). Quando um campo foca, o iOS mostra o teclado
 * e NÃO muda a altura do layout (100dvh continua a tela inteira; `window.innerHeight` é que encolhe, por isso não
 * serve de medida do layout): a visualViewport encolhe (`height`) e, se o campo está dentro de um elemento fixo, o
 * WebKit ARRASTA a janela visível pra baixo (`offsetTop` > 0, até a altura do teclado). Uma folha `fixed; bottom: 0`
 * alta (92dvh) fica com o TOPO fora da tela nesse arrasto — a folha da tarefa abria com o campo "O que precisa
 * fazer" sumido acima do relógio (achado do QA no Simulador, pré-existente pela Home de hoje e pela Rotina).
 *   · `altura`  = o que cabe na tela agora (visualViewport.height);
 *   · `coberto` = quanto do FUNDO do layout está fora da janela visível (= onde ancorar o `bottom` da folha);
 *   · `teclado` = o teclado está aberto (a área visível encolheu mais de 100 px).
 */
export interface AreaVisivel { altura: number; coberto: number; teclado: boolean }

const PARADA: AreaVisivel = { altura: 0, coberto: 0, teclado: false };

/** A altura do LAYOUT (a tela inteira no iOS, mesmo com o teclado): o clientHeight do <html>, não o innerHeight. */
export const alturaDoLayout = (): number => {
  if (typeof document === "undefined") return 0;
  return document.documentElement?.clientHeight || window.innerHeight || 0;
};

export function lerAreaVisivel(): AreaVisivel {
  if (typeof window === "undefined") return PARADA;
  const layout = alturaDoLayout();
  const vv = window.visualViewport;
  if (!vv) return { altura: layout, coberto: 0, teclado: false };
  const altura = Math.round(vv.height);
  const coberto = Math.max(0, Math.round(layout - vv.height - vv.offsetTop));
  return { altura, coberto, teclado: layout - altura > 100 };
}

/** Acompanha a visualViewport enquanto `ativa` (a folha aberta); parada = tudo zero. */
export function useAreaVisivel(ativa = true): AreaVisivel {
  const [area, setArea] = useState<AreaVisivel>(() => (ativa ? lerAreaVisivel() : PARADA));
  useEffect(() => {
    if (!ativa) { setArea(PARADA); return; }
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const atualizar = () => setArea((ant) => {
      const n = lerAreaVisivel();
      return ant.altura === n.altura && ant.coberto === n.coberto && ant.teclado === n.teclado ? ant : n;
    });
    atualizar();
    if (!vv) return;
    vv.addEventListener("resize", atualizar);
    vv.addEventListener("scroll", atualizar);
    return () => { vv.removeEventListener("resize", atualizar); vv.removeEventListener("scroll", atualizar); };
  }, [ativa]);
  return area;
}

/**
 * O estilo de uma folha de baixo (`fixed; bottom: 0`) com o teclado aberto: ancorada logo acima do que o teclado
 * cobre e nunca mais alta que a área visível (o conteúdo rola por dentro). Sem teclado, nada (vale a classe).
 */
export function estiloDaFolhaComTeclado(area: AreaVisivel, margem = 8): CSSProperties | undefined {
  if (!area.teclado) return undefined;
  return { bottom: area.coberto, maxHeight: Math.max(160, area.altura - margem) };
}

/** Ao focar um campo dentro da folha, rola o campo pra dentro da área visível (depois do teclado assentar). */
export function rolarCampoFocado(e: { target: EventTarget | null }, atrasoMs = 300): void {
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.scrollIntoView !== "function" || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  window.setTimeout(() => { try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch { /* noop */ } }, atrasoMs);
}
