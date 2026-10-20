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
