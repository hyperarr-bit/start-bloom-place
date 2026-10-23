import { diaDoMes, diasNoMes } from "./textos";

/**
 * O CALENDÁRIO DOS CARDS (29/09) — conta pura. Semana de SEGUNDA a DOMINGO,
 * como a semana da sequência e a meta do Treino no resto do app.
 */

export const LETRAS_DA_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

/** Coluna (0 = segunda … 6 = domingo) de uma data local. */
export const colunaDe = (ano: number, mesIdx: number, d: number) => (new Date(ano, mesIdx, d).getDay() + 6) % 7;

/**
 * As semanas do mês: linhas de 7 casas, cada casa com o número do dia ou
 * null (antes do dia 1 e depois do último). 4 a 6 linhas.
 */
export function semanasDoMes(ano: number, mesIdx: number): (number | null)[][] {
  const total = diasNoMes(ano, mesIdx);
  const inicio = colunaDe(ano, mesIdx, 1);
  const casas: (number | null)[] = [...Array(inicio).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (casas.length % 7) casas.push(null);
  const out: (number | null)[][] = [];
  for (let i = 0; i < casas.length; i += 7) out.push(casas.slice(i, i + 7));
  return out;
}

/** Os dias do mês que estão na lista (números 1–31), em ordem. */
export const diasMarcadosNoMes = (ano: number, mesIdx: number, dias: string[]): number[] => {
  const prefixo = diaDoMes(ano, mesIdx, 1).slice(0, 8);
  return [...new Set(dias.filter((d) => typeof d === "string" && d.startsWith(prefixo)).map((d) => Number(d.slice(8, 10))))]
    .filter((n) => n >= 1 && n <= diasNoMes(ano, mesIdx))
    .sort((a, b) => a - b);
};

/** A maior corrida de dias seguidos numa lista de dias do mês (números). */
export const maiorCorrida = (numeros: number[]): number => {
  let melhor = 0, atual = 0, anterior = -9;
  for (const n of [...new Set(numeros)].sort((a, b) => a - b)) {
    atual = n === anterior + 1 ? atual + 1 : 1;
    anterior = n;
    melhor = Math.max(melhor, atual);
  }
  return melhor;
};

const somar = (dia: string, n: number) => {
  const [a, m, d] = dia.split("-").map(Number);
  const x = new Date(a, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const colunaDoDia = (dia: string) => { const [a, m, d] = dia.split("-").map(Number); return (new Date(a, m - 1, d).getDay() + 6) % 7; };

/**
 * A FAIXA DE SEMANAS (o total desde o 1º treino): colunas = semanas (segunda
 * a domingo) do 1º dia até hoje; cada coluna com 7 dias ("AAAA-MM-DD" ou
 * null fora do intervalo). Devolve também onde cada mês começa (o rótulo).
 */
export function faixaDeSemanas(inicio: string, hoje: string): { semanas: (string | null)[][]; meses: { coluna: number; mesIdx: number }[] } {
  const segunda = somar(inicio, -colunaDoDia(inicio));
  const semanas: (string | null)[][] = [];
  const meses: { coluna: number; mesIdx: number }[] = [];
  for (let s = segunda, c = 0; s <= hoje; s = somar(s, 7), c++) {
    const coluna: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = somar(s, i);
      coluna.push(d < inicio || d > hoje ? null : d);
      if (d.endsWith("-01") && d >= inicio && d <= hoje) meses.push({ coluna: c, mesIdx: Number(d.slice(5, 7)) - 1 });
    }
    semanas.push(coluna);
  }
  if (!meses.length || meses[0].coluna > 0) meses.unshift({ coluna: 0, mesIdx: Number(inicio.slice(5, 7)) - 1 });
  return { semanas, meses };
}
