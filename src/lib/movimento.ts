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
