import { useRef } from "react";

/** O mesmo formato do `get` do use-user-data (e dos leitores das conquistas/ação do dia). */
export type LeitorDeChaves = <T>(chave: string, padrao: T) => T;

const AUSENTE = Symbol("ausente");

/**
 * useMemo PELAS CHAVES LIDAS (07/11, desempenho da lente "toque").
 *
 * O `get` do use-user-data muda de identidade a cada escrita no store (ele depende do store). Então todo
 * `useMemo(() => calcular(get), [get])` recalculava em TODA escrita, de qualquer chave, em qualquer tela:
 * marcar um copo d'água na Home refazia as conquistas inteiras (varrendo o histórico de 270 KB do Treino e
 * 24 meses de gastos arquivados), a ação do dia e a retrospectiva do mês — medido com a CPU 4× mais lenta
 * na conta cheia: 35–70 ms por toque só nisso (novidades-guardadas/2026-11-07/desempenho/diagnostico-toque.md).
 *
 * Aqui a conta roda com um leitor que ANOTA as chaves lidas; nos renders seguintes ela só é refeita se o
 * valor de alguma dessas chaves mudou (ou se `deps` mudou). Os valores do store são imutáveis (toda escrita
 * troca o objeto), então a comparação por referência basta; quando a referência muda mas o conteúdo é o
 * mesmo (chave que o `get` lê do aparelho e desserializa de novo), compara o JSON e segue com o cache.
 *
 * Semântica do leitor é a do `get`: chave ausente devolve `padrao`; presente devolve o valor como está
 * (inclusive null). Quem calcula NÃO pode ler o store por fora do leitor (senão a mudança passa despercebida
 * — o mesmo que já acontecia com o memo por `get`).
 */
export function useMemoPorChaves<T>(get: LeitorDeChaves, calcular: (ler: LeitorDeChaves) => T, deps: readonly unknown[] = []): T {
  const cache = useRef<{ lidas: Map<string, unknown>; valor: T; deps: readonly unknown[] } | null>(null);
  const c = cache.current;
  if (c && mesmasDeps(c.deps, deps) && nadaMudou(get, c.lidas)) return c.valor;
  const lidas = new Map<string, unknown>();
  const ler: LeitorDeChaves = <V,>(chave: string, padrao: V): V => {
    const v = get<unknown>(chave, AUSENTE);
    if (!lidas.has(chave)) lidas.set(chave, v);
    return (v === AUSENTE ? padrao : v) as V;
  };
  const valor = calcular(ler);
  cache.current = { lidas, valor, deps };
  return valor;
}

const mesmasDeps = (a: readonly unknown[], b: readonly unknown[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
};

const nadaMudou = (get: LeitorDeChaves, lidas: Map<string, unknown>): boolean => {
  for (const [chave, visto] of lidas) {
    const atual = get<unknown>(chave, AUSENTE);
    if (atual === visto) continue;
    if (!mesmoConteudo(atual, visto)) return false;
    lidas.set(chave, atual); // referência nova, conteúdo igual: lembra a nova pra não comparar o JSON de novo
  }
  return true;
};

const mesmoConteudo = (a: unknown, b: unknown): boolean => {
  if (a === AUSENTE || b === AUSENTE || typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};
