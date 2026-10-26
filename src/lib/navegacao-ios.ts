import type { NavigateFunction, NavigationType } from "react-router-dom";

/**
 * NAVEGAÇÃO EMPILHADA COMO NO iOS (rodada 3, 26/10 — o menu do Cal AI): uma linha do Você abre a subpágina ENTRANDO
 * da direita (a tela de antes recua um pouco); voltar (← ou o gesto da borda esquerda) faz a subpágina sair pra
 * direita. Quem decide é o `state.push === "ios"` da navegação (só as linhas do Você põem) — com a chave home_nova
 * desligada, nada muda. O PageTransition lê o modo e anima; a foto da tela de antes (troca-de-rota) desliza junto.
 */
export const PUSH_IOS = "ios" as const;
export interface EstadoPush { push?: typeof PUSH_IOS }

/** Abre a rota EMPILHANDO (push do iOS). */
export const irEmpilhando = (navigate: NavigateFunction, rota: string, state: Record<string, unknown> = {}): void => {
  navigate(rota, { state: { ...state, push: PUSH_IOS } });
};

/** Volta pela pilha quando dá (sai com a animação de pop); sem pilha, vai pra rota de fallback no lugar. */
export const voltar = (navigate: NavigateFunction, fallback: string): void => {
  let idx = 0;
  try { idx = Number((typeof history !== "undefined" ? (history.state as { idx?: number } | null)?.idx : 0) ?? 0); } catch { idx = 0; }
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
};

/* a pilha: quantas páginas empilhadas (push) estão acima — o POP de uma delas anima como pop */
let empilhadas = 0;
let ultimaChave: string | null = null;
let ultimoModo: ModoDeEntrada = null;
export type ModoDeEntrada = "push" | "pop" | null;

/** O modo de entrada da página que está montando (idempotente por `chave` — o StrictMode monta 2x). */
export function modoDeEntrada(chave: string, pediuPush: boolean, tipo: NavigationType | "PUSH" | "POP" | "REPLACE"): ModoDeEntrada {
  if (chave === ultimaChave) return ultimoModo;
  ultimaChave = chave;
  if (pediuPush) { empilhadas += 1; ultimoModo = "push"; return "push"; }
  if (tipo === "POP" && empilhadas > 0) { empilhadas -= 1; ultimoModo = "pop"; return "pop"; }
  if (tipo !== "POP") empilhadas = 0; // saiu da pilha por outro caminho: a pilha zera
  ultimoModo = null;
  return null;
}

/** só pros testes */
export const _zerarPilhaIos = (): void => { empilhadas = 0; ultimaChave = null; ultimoModo = null; };
export const _empilhadas = (): number => empilhadas;
