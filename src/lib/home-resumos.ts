/**
 * OS RESUMOS DA HOME NOVA (rodada 2, 26/10) — os 3 cards pequenos da página 1 ("Seu dia"), que a pessoa pode
 * trocar em Você › Personalizar início › Resumos. Até 3 ("mais que isso é desnecessário", dono); a ordem é a da
 * escolha. Guardado na conta (`core-home-resumos`, useUserData). Sem escolha, os 3 de sempre: Hábitos · Água · Refeições
 * (1.0.20: menos na conta nova nos primeiros 7 dias — lá, sem escolha, os cards são o que conta no score dela).
 */
export type IdDoResumo = "habitos" | "agua" | "refeicoes" | "sono" | "financas" | "treino" | "leitura";

export const CHAVE_RESUMOS = "core-home-resumos";
export const MAX_RESUMOS = 3;
export const RESUMOS_PADRAO: IdDoResumo[] = ["habitos", "agua", "refeicoes"];
export const CATALOGO_RESUMOS: ReadonlyArray<{ id: IdDoResumo; rotulo: string; descricao: string }> = [
  { id: "habitos", rotulo: "Hábitos", descricao: "Os hábitos do dia feitos" },
  { id: "agua", rotulo: "Água", descricao: "Os copos da meta" },
  { id: "refeicoes", rotulo: "Refeições", descricao: "As refeições registradas" },
  { id: "sono", rotulo: "Sono", descricao: "As horas dormidas" },
  { id: "financas", rotulo: "Gasto", descricao: "Registrou um gasto hoje" },
  { id: "treino", rotulo: "Treino", descricao: "O treino de hoje feito" },
  { id: "leitura", rotulo: "Leitura", descricao: "Leu hoje" },
];
const VALIDOS = new Set<string>(CATALOGO_RESUMOS.map((r) => r.id));

/** O que está gravado → uma lista válida (ids conhecidos, sem repetir, no máximo 3); vazio/estranho = os 3 de sempre. */
export function normalizarResumos(v: unknown): IdDoResumo[] {
  if (!Array.isArray(v)) return RESUMOS_PADRAO;
  const lista = v.filter((x): x is IdDoResumo => typeof x === "string" && VALIDOS.has(x));
  const unicos = lista.filter((x, i) => lista.indexOf(x) === i).slice(0, MAX_RESUMOS);
  return unicos.length > 0 ? unicos : RESUMOS_PADRAO;
}

/**
 * 1.0.20 — o que a pessoa ESCOLHEU em Personalizar início, ou null quando ela nunca escolheu (nada gravado, ou só lixo).
 * A conta nova sem escolha não vê o padrão fixo: vê os cards do que conta no score dela (PaginaSeuDia, metricasDoDia).
 */
export function resumosEscolhidos(v: unknown): IdDoResumo[] | null {
  if (!Array.isArray(v) || !v.some((x) => typeof x === "string" && VALIDOS.has(x))) return null;
  return normalizarResumos(v);
}

/** 1.0.20 — o resumo do catálogo que um card da página 1 representa (o card do gasto é o resumo "financas"); null nos
 *  cards sem resumo no catálogo (Humor, Peso, Ideia, Gratidão, Suplementos, Registros). */
export function resumoDoCard(idDoCard: string): IdDoResumo | null {
  const id = idDoCard === "gasto" ? "financas" : idDoCard;
  return VALIDOS.has(id) ? (id as IdDoResumo) : null;
}

/** Liga/desliga um resumo (no máximo 3; nunca fica sem nenhum). */
export function alternarResumo(atuais: IdDoResumo[], id: IdDoResumo): IdDoResumo[] {
  const lista = normalizarResumos(atuais);
  if (lista.includes(id)) return lista.length > 1 ? lista.filter((x) => x !== id) : lista;
  if (lista.length >= MAX_RESUMOS) return lista;
  return [...lista, id];
}
