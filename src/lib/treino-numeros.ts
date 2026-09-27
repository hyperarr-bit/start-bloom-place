/**
 * Números do Treino (26/09, varredura). Os campos do plano são TEXTO ("52,5kg",
 * "60 kg", "25min") e o parseFloat cortava a vírgula: 52,5 virava 52 no volume
 * e na progressão. Um leitor só pra todo lugar que faz conta.
 */

/** Primeiro número do campo, com vírgula decimal. 0 se não houver número. */
export const lerNumero = (v: unknown): number => {
  const m = String(v ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};

/** Volume do exercício em kg (séries × repetições × carga). Cardio não soma:
 *  "25min" no campo de carga viraria 25 kg. */
export const volumeDoExercicio = (ex: { sets?: unknown; reps?: unknown; carga?: unknown; tipo?: string }): number =>
  ex.tipo === "cardio" ? 0 : lerNumero(ex.sets) * lerNumero(ex.reps) * lerNumero(ex.carga);

/** Volume legível: "3,4 mil" (e não "3.4k", com ponto). Abaixo de mil, inteiro. */
export const formatarVolume = (kg: number): string =>
  kg >= 1000
    ? `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : Math.round(kg).toLocaleString("pt-BR");

/** Histórico em ordem de DATA. Ele é gravado do mais novo pro mais antigo (e a
 *  seed da demo ao contrário): inverter o array mostrava a carga CAINDO. */
export const emOrdemDeData = <T extends { date: string }>(lista: T[]): T[] =>
  [...lista].sort((a, b) => a.date.localeCompare(b.date));
