/**
 * SUBSTITUTOS por refeição (11/09) — contas puras.
 *
 * Cliente por áudio: a dieta do nutricionista "tem 30.000 substitutos", e o
 * app só tinha um texto por refeição; no dia em que comia outra coisa, ele
 * editava o PLANO e depois desfazia. O plano é uma coisa (o que devo
 * comer), o diário é outra (o que comi). Aqui mora a lista de alternativas
 * de cada refeição — vale pra todos os dias, porque é assim que o
 * nutricionista escreve ("café da manhã: A, ou B, ou C") — e o diário
 * oferece essas opções quando a pessoa marca que não seguiu.
 *
 * Chave `dieta-substitutos`: `{ [nomeDaRefeição]: string[] }`.
 */
export type Substitutos = Record<string, string[]>;

export const comoSubstitutos = (v: unknown): Substitutos => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Substitutos = {};
  for (const [meal, lista] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(lista)) continue;
    const limpa = lista.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
    if (limpa.length) out[meal] = limpa;
  }
  return out;
};

/** Junta sem repetir (comparação sem caixa e sem espaço sobrando). */
export const adicionarSubstituto = (mapa: Substitutos, meal: string, texto: string): Substitutos => {
  const t = texto.trim();
  if (!t) return mapa;
  const atuais = mapa[meal] ?? [];
  if (atuais.some((x) => x.toLowerCase() === t.toLowerCase())) return mapa;
  return { ...mapa, [meal]: [...atuais, t] };
};

export const removerSubstituto = (mapa: Substitutos, meal: string, texto: string): Substitutos => {
  const lista = (mapa[meal] ?? []).filter((x) => x !== texto);
  const next = { ...mapa };
  if (lista.length) next[meal] = lista; else delete next[meal];
  return next;
};

/** A nota do diário quando a pessoa escolhe um substituto. */
export const notaDeSubstituto = (texto: string) => `Comi: ${texto.trim()}`;
