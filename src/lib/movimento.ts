/**
 * MOVIMENTO CALMO (1.0.17, dono 19/10: "os cortes entre as telas são bruscos — deixa agradável e lento"; "hoje a gente
 * joga informação na cara do usuário — faz com calma").
 *
 * Um vocabulário só, o mesmo do CSS (`--mov-*` no index.css), pra missão, os Montar e as intros:
 *   · rápido 150 ms — o que responde ao toque (chip marcado, campo abrindo);
 *   · base 280 ms — a troca entre passos e a folha que sai;
 *   · calmo 420 ms — o que ENTRA na tela (a tela inteira, a comemoração);
 *   · respiro 500 ms — a pausa antes de pedir algo novo (nada entra colado no que acabou de sair).
 * Curva de entrada ease-out `cubic-bezier(.22, 1, .36, 1)`; saída ease-in curta.
 * Regras: UMA coisa se mexe por vez (o que vem depois espera o anterior); deslocamento curto (24 px), nunca mola
 * pulando; com "reduzir movimento" do sistema tudo vira só um fade de 150 ms, sem deslocamento nem confete.
 */
import type { Transition, Variants } from "framer-motion";

export const MOV = {
  rapido: 0.15,
  base: 0.28,
  calmo: 0.42,
  /** a pausa entre uma coisa e a próxima (segundos) */
  respiro: 0.5,
  /** o deslocamento das trocas de passo (px) */
  passo: 24,
} as const;
/** Os mesmos tempos em milissegundos (setTimeout). */
export const MOV_MS = {
  rapido: 150,
  base: 280,
  calmo: 420,
  respiro: 500,
  /** troca de passo dos Montar (dono: "lento, agradável") */
  troca: 260,
} as const;

export const EASE_SAI: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_ENTRA_SAIDA: [number, number, number, number] = [0.4, 0, 1, 1];

/** A transição de quem ENTRA: `dur` em segundos; reduzido = fade de 150 ms. */
export const entrada = (reduzir: boolean, dur: number = MOV.calmo, atraso = 0): Transition =>
  reduzir ? { duration: MOV.rapido, delay: 0, ease: "linear" } : { duration: dur, delay: atraso, ease: EASE_SAI };
/** A transição de quem SAI (curta, ease-in). */
export const saida = (reduzir: boolean, dur: number = MOV.base): Transition =>
  reduzir ? { duration: MOV.rapido, ease: "linear" } : { duration: dur, ease: EASE_ENTRA_SAIDA };

/**
 * A troca entre os passos de um fluxo (Montar Finanças/Rotina): o novo entra de 24 px pro lado e o velho sai pro outro,
 * em cross-fade de 260 ms. `direcao` 1 = avançar, -1 = voltar. Reduzido: só opacidade.
 */
export function trocaDePasso(reduzir: boolean): Variants {
  const d = MOV_MS.troca / 1000;
  if (reduzir) {
    return {
      entra: { opacity: 0 },
      fica: { opacity: 1, transition: { duration: MOV.rapido } },
      sai: { opacity: 0, transition: { duration: MOV.rapido } },
    };
  }
  return {
    entra: (direcao: number) => ({ opacity: 0, x: MOV.passo * (direcao || 1) }),
    fica: { opacity: 1, x: 0, transition: { duration: d, ease: EASE_SAI } },
    sai: (direcao: number) => ({ opacity: 0, x: -MOV.passo * (direcao || 1), transition: { duration: d * 0.8, ease: EASE_ENTRA_SAIDA } }),
  };
}

/** O sistema pede menos movimento? (fora do React; nos componentes use `useReducedMotion`) */
export const reduzirMovimento = (): boolean => {
  try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

/**
 * SAÍDA CALMA (1.0.17 QA, gravação no Simulador 20/10): as folhas da missão, os Montar e o tour da Home saíam da tela
 * NUM QUADRO (eram desmontadas pelo estado, fora de um AnimatePresence) — "Combinado" no plano de amanhã, "Começar" no
 * Tá dentro, "Continuar" no fim do Montar (o módulo aparecia no meio da página e rolava às pressas). Em vez de reescrever
 * cada orquestração, quem fecha chama isto ANTES de mudar o estado: uma CÓPIA visual do elemento (sem testid, camada,
 * role nem toque — nada do app a enxerga) fica por cima e some em `ms`; o que vem embaixo já está montado e se ajeita
 * por trás dela. O estado e os callbacks seguem síncronos. Sem animação: "reduzir movimento" e jsdom (os testes).
 */
const ATRIBUTOS_DA_COPIA = ["data-testid", "data-camada-guia", "role", "aria-modal", "data-momento", "id", "data-folha", "data-state", "data-missao-dose"];
/** `segura`: ms em que a cópia fica INTEIRA antes de sumir — quando o que vem embaixo ainda está se mexendo (troca de
 *  rota, rolagem até o alvo), a cópia cobre isso e só some com a tela de baixo já parada (sem dupla exposição). */
export function saidaCalma(el: Element | null | undefined, ms: number = MOV_MS.calmo, segura = 0): void {
  try {
    if (!el || typeof document === "undefined" || !(el instanceof HTMLElement)) return;
    if (/jsdom/i.test(navigator.userAgent)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof el.animate !== "function") return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const copia = el.cloneNode(true) as HTMLElement;
    for (const n of [copia, ...Array.from(copia.querySelectorAll<HTMLElement>("*"))]) for (const a of ATRIBUTOS_DA_COPIA) n.removeAttribute(a);
    copia.setAttribute("aria-hidden", "true");
    copia.setAttribute("data-saida-calma", "");
    copia.style.pointerEvents = "none";
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") Object.assign(copia.style, { position: "fixed", top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, margin: "0", zIndex: cs.zIndex && cs.zIndex !== "auto" ? cs.zIndex : "250" });
    document.body.appendChild(copia);
    const tirar = () => { try { copia.remove(); } catch { /* já saiu */ } };
    const total = ms + Math.max(0, segura);
    const quadros: Keyframe[] = segura > 0 ? [{ opacity: 1, offset: 0 }, { opacity: 1, offset: segura / total }, { opacity: 0, offset: 1 }] : [{ opacity: 1 }, { opacity: 0 }];
    const a = copia.animate(quadros, { duration: total, easing: "ease-in-out", fill: "forwards" });
    a.onfinish = tirar;
    window.setTimeout(tirar, total + 400);
  } catch { /* a saída é enfeite: nunca derruba quem fecha */ }
}
/** Atalho: a saída calma do 1º elemento do seletor. */
export const saidaCalmaDe = (seletor: string, ms?: number, segura?: number): void => { try { saidaCalma(document.querySelector(seletor), ms, segura); } catch { /* noop */ } };

/**
 * A TELA INTEIRA em saída calma (1.0.17 QA, pedido do dono: "nenhum corte seco"): a troca de rota da missão (festa →
 * Home, plano do dia 2 → Home) passava por ~0,13 s de BRANCO — o véu da cor do app cobria, a rota trocava, o véu abria.
 * Aqui a foto do que está na tela (o #root e as camadas fixas do body, com a rolagem, os cabeçalhos grudados e o que foi
 * digitado) fica inteira por `segura` ms enquanto a rota troca e a página nova entra por baixo, e some em `ms` — um
 * cross-fade direto, sem quadro em branco. Devolve false quando não anima (reduzir movimento, jsdom): quem chama usa o
 * caminho antigo.
 */
export function saidaCalmaDaTela(ms: number = MOV_MS.calmo, segura = 260): boolean {
  try {
    if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    if (typeof HTMLElement.prototype.animate !== "function") return false;
    const marcados: HTMLElement[] = [];
    const marcar = (el: HTMLElement, k: string, v: string) => { el.setAttribute(k, v); marcados.push(el); };
    const filhos = Array.from(document.body.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(c.tagName) && !c.hasAttribute("data-saida-calma"));
    for (const raiz of filhos) {
      for (const el of Array.from(raiz.querySelectorAll<HTMLElement>("*"))) {
        if (el.scrollTop > 0 || el.scrollLeft > 0) marcar(el, "data-sc-rolagem", `${el.scrollTop},${el.scrollLeft}`);
        if (/sticky/.test(typeof el.className === "string" ? el.className : "") && getComputedStyle(el).position === "sticky") {
          const r = el.getBoundingClientRect();
          marcar(el, "data-sc-fixo", `${r.top},${r.left},${r.width},${r.height}`);
        }
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value) marcar(el, "data-sc-valor", el.value);
      }
    }
    const fundo = getComputedStyle(document.body).backgroundColor || "#fff";
    const foto = document.createElement("div");
    foto.setAttribute("aria-hidden", "true");
    foto.setAttribute("data-saida-calma", "tela");
    Object.assign(foto.style, { position: "fixed", inset: "0", zIndex: "2147483000", pointerEvents: "none", overflow: "hidden", background: fundo });
    for (const raiz of filhos) {
      const r = raiz.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(raiz);
      const c = raiz.cloneNode(true) as HTMLElement;
      if (cs.position !== "fixed") Object.assign(c.style, { position: "absolute", top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, margin: "0" });
      foto.appendChild(c);
    }
    for (const el of marcados) { el.removeAttribute("data-sc-rolagem"); el.removeAttribute("data-sc-fixo"); el.removeAttribute("data-sc-valor"); }
    for (const n of Array.from(foto.querySelectorAll<HTMLElement>("*"))) {
      for (const a of ATRIBUTOS_DA_COPIA) n.removeAttribute(a);
      if (n.tagName === "CANVAS" || n.tagName === "VIDEO") n.style.visibility = "hidden";
      const fixo = n.getAttribute("data-sc-fixo");
      if (fixo) { const [t, l, w, h] = fixo.split(",").map(Number); Object.assign(n.style, { position: "fixed", top: `${t}px`, left: `${l}px`, width: `${w}px`, height: `${h}px`, margin: "0" }); n.removeAttribute("data-sc-fixo"); }
      const valor = n.getAttribute("data-sc-valor");
      if (valor !== null) { (n as HTMLInputElement).value = valor; n.removeAttribute("data-sc-valor"); }
    }
    document.body.appendChild(foto);
    for (const n of Array.from(foto.querySelectorAll<HTMLElement>("[data-sc-rolagem]"))) {
      const [t, l] = (n.getAttribute("data-sc-rolagem") ?? "0,0").split(",").map(Number);
      n.scrollTop = t; n.scrollLeft = l; n.removeAttribute("data-sc-rolagem");
    }
    const total = ms + Math.max(0, segura);
    const tirar = () => { try { foto.remove(); } catch { /* já saiu */ } };
    const a = foto.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: segura / total }, { opacity: 0, offset: 1 }], { duration: total, easing: "ease-in-out", fill: "forwards" });
    a.onfinish = tirar;
    window.setTimeout(tirar, total + 400);
    return true;
  } catch {
    try { document.querySelectorAll("[data-sc-rolagem],[data-sc-fixo],[data-sc-valor]").forEach((e) => { e.removeAttribute("data-sc-rolagem"); e.removeAttribute("data-sc-fixo"); e.removeAttribute("data-sc-valor"); }); } catch { /* noop */ }
    return false;
  }
}
