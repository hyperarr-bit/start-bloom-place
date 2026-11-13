/** O mesmo formato do `get` do use-user-data e dos leitores das conquistas. */
export type LeitorMemo = <T>(chave: string, padrao: T) => T;

const AUSENTE = Symbol("ausente");

export interface CacheDeLeituras<R> {
  atual: { lidas: Map<string, unknown>; marca: string; r: R } | null;
}
export const novoCacheDeLeituras = <R,>(): CacheDeLeituras<R> => ({ atual: null });

/**
 * MEMO PELAS CHAVES LIDAS, FORA DO REACT (07/11, desempenho da lente "toque").
 *
 * Guarda o último resultado junto com as chaves que a conta leu (pelo leitor que ela recebe) e uma marca (o dia).
 * Na chamada seguinte, se a marca é a mesma e NENHUMA chave lida mudou de valor, devolve o guardado sem calcular.
 * Os valores do store são imutáveis (toda escrita troca o objeto), então comparar a referência basta; chave ausente
 * fica ausente. Um cache por função (módulo), compartilhado por quem chamar com os mesmos dados — a mesma conta
 * feita por dois componentes na mesma tela roda uma vez só.
 *
 * Semântica do leitor é a do `get`: ausente devolve `padrao`; presente devolve o valor como está. A conta não pode
 * ler o store por fora do leitor (senão a mudança passa despercebida).
 */
export function memoPorLeituras<R>(cache: CacheDeLeituras<R>, get: LeitorMemo, marca: string, calcular: (ler: LeitorMemo) => R): R {
  const c = cache.atual;
  if (c && c.marca === marca) {
    let igual = true;
    for (const [k, v] of c.lidas) {
      if (get<unknown>(k, AUSENTE) !== v) { igual = false; break; }
    }
    if (igual) return c.r;
  }
  const lidas = new Map<string, unknown>();
  const ler: LeitorMemo = <T,>(chave: string, padrao: T): T => {
    const v = get<unknown>(chave, AUSENTE);
    if (!lidas.has(chave)) lidas.set(chave, v);
    return (v === AUSENTE ? padrao : v) as T;
  };
  const r = calcular(ler);
  cache.atual = { lidas, marca, r };
  return r;
}
