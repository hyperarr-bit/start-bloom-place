import { localDayKey, semanaAtualId } from "@/lib/utils";

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
