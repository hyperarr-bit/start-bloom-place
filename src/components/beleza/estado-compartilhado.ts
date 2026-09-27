import { useCallback, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";

/**
 * Chave da Beleza lida e gravada DIRETO no useUserData, sem cópia local
 * (26/09, varredura). Espelho do dia, Rotina e Diário mostram as mesmas
 * chaves (pele de hoje, passos marcados), mas cada um tinha o seu
 * usePersistedState — que guarda uma cópia e só relê a chave na hidratação.
 * Marcar "Sensível" no Espelho avisava que os ácidos tinham saído da noite,
 * e a Rotina só escondia depois de trocar de aba; o anel "0/7" nunca andava
 * ao marcar um passo. Lendo do store a cada render, quem mostra a chave
 * re-renderiza junto com quem grava. Formato das chaves não muda.
 *
 * O setter aplica a função NA HORA, sobre o último valor (inclusive o que
 * acabou de ser gravado no mesmo toque): apagar passo + corrigir os checks
 * no mesmo clique não parte de valor velho.
 */
const mesmoFormato = (v: unknown, padrao: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (Array.isArray(padrao)) return Array.isArray(v);
  if (typeof padrao === "object") return typeof v === "object" && !Array.isArray(v);
  return typeof v === typeof padrao;
};

export const useChaveDaBeleza = <T,>(chave: string, padrao: T): [T, (v: T | ((anterior: T) => T)) => void] => {
  const { get, set } = useUserData();
  const lido = get<unknown>(chave, padrao);
  // dado torto gravado (null, lista no lugar de objeto…) vira o padrão na
  // LEITURA, sem regravar — quem grava é só o gesto da pessoa
  const valor = (mesmoFormato(lido, padrao) ? lido : padrao) as T;
  const ultimo = useRef(valor);
  ultimo.current = valor;
  const gravar = useCallback((v: T | ((anterior: T) => T)) => {
    const proximo = typeof v === "function" ? (v as (anterior: T) => T)(ultimo.current) : v;
    ultimo.current = proximo;
    set(chave, proximo);
  }, [chave, set]);
  return [valor, gravar];
};

/** Estamos na demonstração pública (/preview)? Lá não há conta: foto não sobe. */
export const emDemonstracao = (): boolean => {
  try { return window.location.pathname.startsWith("/preview"); } catch { return false; }
};
