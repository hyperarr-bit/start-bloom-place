/**
 * FERIADOS NACIONAIS (28/10) — chamados de 14/10 e 27/10: "o calendário poderia vir com os
 * feriados do ano? nacional" / "poderiam colocar os feriados nacionais brasileiros?".
 *
 * Calculados aqui, pra qualquer ano, sem API: os fixos da lei (Lei 662/1949, 6.802/1980 e
 * 14.759/2023 — Consciência Negra nacional desde 2024) e os móveis pela Páscoa (algoritmo de
 * Meeus/Jones/Butcher, calendário gregoriano). Carnaval (segunda e terça) e Corpus Christi são
 * PONTO FACULTATIVO nacional — aparecem marcados como tal.
 *
 * O feriado é só INFORMAÇÃO na tela: não é tarefa, não vai pro user_data, não conta pra
 * sequência nem pro score, não gera aviso. O único dado é a preferência "Mostrar feriados"
 * (CHAVE_FERIADOS_PREFS, padrão ligado).
 *
 * Tudo aqui é PURO.
 */

export interface Feriado {
  /** "YYYY-MM-DD" */
  dia: string;
  nome: string;
  /** ponto facultativo (Carnaval, Corpus Christi) — não é feriado de lei */
  facultativo: boolean;
}

/**
 * Preferência "Mostrar feriados" (Rotina › Meu mês), na conta. Chave NOVA, objeto
 * `{ mostrar: boolean }`; ausente = ligado. O sufixo `-prefs` a deixa fora da sequência
 * (lib/sequencia: ajuste não é anotação do dia).
 */
export const CHAVE_FERIADOS_PREFS = "rotina-feriados-prefs";
export type PrefsFeriados = { mostrar: boolean };
export const PREFS_FERIADOS_PADRAO: PrefsFeriados = { mostrar: true };

/** Lê a preferência sem confiar no formato: só `mostrar: false` desliga. */
export const mostrarFeriados = (prefs: unknown): boolean =>
  !(prefs && typeof prefs === "object" && (prefs as { mostrar?: unknown }).mostrar === false);

const doisDig = (n: number) => String(n).padStart(2, "0");
const chave = (d: Date) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
const somar = (d: Date, dias: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);

/** Domingo de Páscoa do ano (data local, meio-dia não importa: só o dia). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const FIXOS: Array<[mes: number, dia: number, nome: string, desde?: number]> = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência do Brasil"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  [11, 20, "Dia da Consciência Negra", 2024],
  [12, 25, "Natal"],
];

const cache = new Map<number, Feriado[]>();

/** Os feriados nacionais do ano, em ordem de data. */
export function feriadosDoAno(ano: number): Feriado[] {
  const pronto = cache.get(ano);
  if (pronto) return pronto;
  const p = pascoa(ano);
  const lista: Feriado[] = [
    ...FIXOS.filter(([, , , desde]) => !desde || ano >= desde).map(([m, d, nome]) => ({ dia: `${ano}-${doisDig(m)}-${doisDig(d)}`, nome, facultativo: false })),
    { dia: chave(somar(p, -48)), nome: "Carnaval", facultativo: true },
    { dia: chave(somar(p, -47)), nome: "Carnaval", facultativo: true },
    { dia: chave(somar(p, -2)), nome: "Sexta-feira Santa", facultativo: false },
    { dia: chave(somar(p, 60)), nome: "Corpus Christi", facultativo: true },
  ].sort((a, b) => a.dia.localeCompare(b.dia));
  cache.set(ano, lista);
  return lista;
}

/** O feriado do dia ("YYYY-MM-DD") ou null. Dia torto = null. */
export function feriadoDoDia(dia: string): Feriado | null {
  if (typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  return feriadosDoAno(Number(dia.slice(0, 4))).find((f) => f.dia === dia) ?? null;
}

/** Os feriados de um mês (mes 0–11), indexados pelo dia — pro calendário marcar. */
export function feriadosDoMes(ano: number, mes: number): Map<string, Feriado> {
  const prefixo = `${ano}-${doisDig(mes + 1)}-`;
  return new Map(feriadosDoAno(ano).filter((f) => f.dia.startsWith(prefixo)).map((f) => [f.dia, f]));
}

/** "Feriado: Proclamação da República" / "Ponto facultativo: Carnaval". */
export const textoDoFeriado = (f: Feriado): string => `${f.facultativo ? "Ponto facultativo" : "Feriado"}: ${f.nome}`;
