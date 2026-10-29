/**
 * UMA LISTA DO DIA COM TUDO (1.0.22, sem repetição — dono 28/10). Carreira › Meu dia (`career-day-tasks`) e
 * Estudos › Tarefas (`estudos-week-tasks`) continuam com as listas DELES; a lista "Tarefas de hoje" da Rotina e o
 * widget da Home MOSTRAM também as de hoje desses dois, com a etiqueta da origem ("Trabalho", "Estudos"), e marcar
 * ali grava na chave de ORIGEM — nada se move entre chaves, nenhum formato muda (o app antigo lê igual).
 *
 * Aqui fica só a parte de `estudos-week-tasks`, que é uma grade semanal SEM data nem id:
 *   { SEGUNDA: [{ text, done }], TERÇA: [...], …, "FINAL DE SEMANA": [...] }
 * "Hoje" = a coluna do dia da semana (sábado e domingo = FINAL DE SEMANA), como a própria aba mostra. A linha é
 * achada pelo ÍNDICE na lista crua (a aba pula linhas sem texto, então o índice tem de ser o da lista inteira).
 */

export const ROTULO_ORIGEM_CARREIRA = "Trabalho";
export const ROTULO_ORIGEM_ESTUDOS = "Estudos";
export const CHAVE_TAREFAS_ESTUDOS = "estudos-week-tasks";

const DIAS_ESTUDOS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"] as const;
export const FIM_DE_SEMANA_ESTUDOS = "FINAL DE SEMANA";

/** A coluna de hoje na grade dos Estudos. */
export const colunaDeHojeNosEstudos = (d: Date = new Date()): string => {
  const i = (d.getDay() + 6) % 7; // 0 = segunda
  return i < 5 ? DIAS_ESTUDOS[i] : FIM_DE_SEMANA_ESTUDOS;
};

export type TarefaDosEstudos = { indice: number; texto: string; feito: boolean; coluna: string };

type Grade = Record<string, { text?: unknown; done?: unknown }[]>;

const comoGrade = (v: unknown): Grade | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Grade) : null);

/** As tarefas de hoje dos Estudos (com texto), cada uma com o índice na lista crua da coluna. */
export function tarefasDeHojeDosEstudos(valor: unknown, d: Date = new Date()): TarefaDosEstudos[] {
  const grade = comoGrade(valor);
  const coluna = colunaDeHojeNosEstudos(d);
  const lista = grade && Array.isArray(grade[coluna]) ? grade[coluna] : [];
  const out: TarefaDosEstudos[] = [];
  lista.forEach((t, indice) => {
    if (!t || typeof t !== "object") return;
    const texto = typeof t.text === "string" ? t.text.trim() : "";
    if (!texto) return;
    out.push({ indice, texto, feito: t.done === true, coluna });
  });
  return out;
}

/**
 * Marca/desmarca UMA tarefa dos Estudos, devolvendo a grade nova com todo o resto igual (outras colunas, outras
 * linhas, campos que a gente não conhece). Valor torto ou linha que não existe = devolve o mesmo valor.
 */
export function alternarTarefaDosEstudos(valor: unknown, coluna: string, indice: number): unknown {
  const grade = comoGrade(valor);
  if (!grade || !Array.isArray(grade[coluna])) return valor;
  const lista = grade[coluna];
  const alvo = lista[indice];
  if (!alvo || typeof alvo !== "object") return valor;
  return { ...grade, [coluna]: lista.map((t, j) => (j === indice ? { ...t, done: !(t.done === true) } : t)) };
}
