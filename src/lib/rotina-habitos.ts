import { localDayKey, parseLocalDay, semanaAtualId } from "@/lib/utils";

/**
 * Hábitos da Rotina — regras compartilhadas entre o módulo e o widget da Home
 * (26/09, varredura). O widget grande da Home lia `core-rotina-habits`, chave
 * que nenhum módulo grava: pra cliente real a lista saía vazia, e o toque
 * gravava `core-rotina-habit-log`, que a Rotina não lê. Agora os dois marcam
 * do mesmo jeito: a grade da semana (`rotina-habits-checked` + o carimbo
 * `rotina-habits-week`), o log por data (`rotina-habit-log`) e o heatmap
 * (`heatmap-log`).
 */
export type LogDoHeatmap = Record<string, boolean | number>;

export const DIAS_DA_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];

/** Nível 0–3 de um dia do heatmap (true = 2; número = arredondado). */
export const nivelDoHeatmap = (raw: boolean | number | undefined): number => {
  if (raw === true) return 2;
  if (typeof raw === "number") return Math.max(0, Math.min(3, Math.round(raw)));
  return 0;
};

/** A marca do dia acompanha a grade: algum hábito feito → marcado (sem
 *  rebaixar um nível que já existe); nenhum → sai do heatmap. */
export const marcaDoDia = (log: LogDoHeatmap, dia: string, feitos: number): LogDoHeatmap => {
  const atual = log ?? {};
  if (feitos > 0) return nivelDoHeatmap(atual[dia]) > 0 ? atual : { ...atual, [dia]: true };
  if (!(dia in atual)) return atual;
  const { [dia]: _fora, ...resto } = atual;
  return resto;
};

/** Nomes dos hábitos, aceitando o formato antigo ({ name }). */
export const nomesDosHabitos = (lista: unknown): string[] =>
  (Array.isArray(lista) ? lista : [])
    .map((h) => (typeof h === "string" ? h : (h as { name?: string })?.name ?? ""))
    .filter((n) => typeof n === "string" && n.trim().length > 0);

/** Checks de HOJE, só se a grade for desta semana (senão é check de outra semana). */
export const checksDeHoje = (checked: Record<string, boolean[]> | undefined, semana: string, agora = new Date()): boolean[] => {
  if (semana !== semanaAtualId()) return [];
  const linha = checked?.[DIAS_DA_ROTINA[(agora.getDay() + 6) % 7]];
  return Array.isArray(linha) ? linha : [];
};

/** Marca/desmarca o hábito `indice` HOJE, igual ao toque na grade da Rotina. */
export const alternarHabitoDeHoje = (p: {
  nomes: string[]; checked: Record<string, boolean[]>; semana: string;
  habitLog: Record<string, string[]>; heatmap: LogDoHeatmap; indice: number; agora?: Date;
}) => {
  const agora = p.agora ?? new Date();
  const grade: Record<string, boolean[]> = p.semana === semanaAtualId() ? { ...(p.checked ?? {}) } : {};
  const dia = DIAS_DA_ROTINA[(agora.getDay() + 6) % 7];
  const linha = [...(grade[dia] ?? [])];
  while (linha.length < p.nomes.length) linha.push(false);
  linha[p.indice] = !linha[p.indice];
  grade[dia] = linha;
  const hoje = localDayKey(agora);
  const feitos = p.nomes.filter((_, i) => linha[i]);
  return {
    checked: grade,
    semana: semanaAtualId(),
    habitLog: { ...(p.habitLog ?? {}), [hoje]: feitos },
    heatmap: marcaDoDia(p.heatmap ?? {}, hoje, feitos.length),
  };
};

/* ------------------------------------------------------------------------- *
 * Marcar OUTRO dia (02/10): "esqueci de marcar ontem"
 * ------------------------------------------------------------------------- */

/** Id da semana (a segunda-feira) de uma data "YYYY-MM-DD". */
export const semanaDoDia = (dia: string): string => {
  const d = parseLocalDay(dia);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDayKey(d);
};

/** "QUINTA" de uma data "YYYY-MM-DD" (a grade da Rotina é por nome de dia). */
export const nomeDoDiaDaRotina = (dia: string): string => DIAS_DA_ROTINA[(parseLocalDay(dia).getDay() + 6) % 7];

/**
 * Quais hábitos estão marcados num dia, na ordem de `nomes`. Dia da semana
 * corrente com a grade carimbada nesta semana: a grade (é o que a tabela mostra).
 * Qualquer outro caso — dia da semana PASSADA (domingo visto numa segunda) ou
 * grade ainda sem carimbo —: o log por data, que não zera na virada da semana.
 */
export const marcadosDoDia = (p: {
  nomes: string[]; checked: Record<string, boolean[]>; semana: string; habitLog: Record<string, string[]>; dia: string; hoje: string;
}): boolean[] => {
  const naSemana = semanaDoDia(p.dia) === semanaDoDia(p.hoje) && p.semana === semanaDoDia(p.hoje);
  if (naSemana) {
    const linha = p.checked?.[nomeDoDiaDaRotina(p.dia)];
    return p.nomes.map((_, i) => !!(Array.isArray(linha) && linha[i]));
  }
  const feitos = Array.isArray(p.habitLog?.[p.dia]) ? p.habitLog[p.dia] : [];
  return p.nomes.map((n) => feitos.includes(n));
};

/**
 * Marca/desmarca o hábito `indice` num dia QUALQUER (hoje, ontem, anteontem,
 * ou a coluna que a pessoa tocou na grade). Escreve as mesmas três coisas de
 * sempre — a grade da semana (só se o dia é desta semana), o log por data e o
 * heatmap (só até hoje) — então a tela, o card de Consistência e a Home não
 * discordam. Auto-curativo: reescreve o dia inteiro a partir do que está marcado.
 */
export const alternarHabitoNoDia = (p: {
  nomes: string[]; checked: Record<string, boolean[]>; semana: string; habitLog: Record<string, string[]>;
  heatmap: LogDoHeatmap; indice: number; dia: string; hoje: string;
}) => {
  const atuais = marcadosDoDia(p);
  const novo = [...atuais];
  novo[p.indice] = !novo[p.indice];
  const feitos = p.nomes.filter((_, i) => novo[i]);
  const semanaCorrente = semanaDoDia(p.hoje);
  let checked = p.checked;
  let semana = p.semana;
  if (semanaDoDia(p.dia) === semanaCorrente) {
    checked = { ...(p.semana === semanaCorrente ? p.checked ?? {} : {}), [nomeDoDiaDaRotina(p.dia)]: novo };
    semana = semanaCorrente;
  }
  return {
    checked,
    semana,
    habitLog: { ...(p.habitLog ?? {}), [p.dia]: feitos },
    heatmap: p.dia <= p.hoje ? marcaDoDia(p.heatmap ?? {}, p.dia, feitos.length) : (p.heatmap ?? {}),
    marcando: !!novo[p.indice],
    feitos: feitos.length,
  };
};
