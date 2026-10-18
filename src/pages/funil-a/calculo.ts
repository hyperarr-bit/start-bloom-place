/**
 * O CÁLCULO DO /funil-a — "Quanto do seu 13º cai na conta?" (18/10). Puro, sem React, testado.
 *
 * Fontes (conferidas em 18/10/2026):
 *   · INSS do empregado a partir de jan/2026: Portaria Interministerial MPS/MF nº 13, de 09/01/2026 (Anexo II).
 *     Progressivo por faixa, teto R$ 8.475,55. O 13º é enquadrado SEPARADO do salário do mês.
 *   · IRRF: tabela progressiva mensal (a de maio/2025, mantida em 2026) + desconto simplificado de R$ 607,20
 *     (o maior entre ele e as deduções legais) + a REDUÇÃO da Lei 15.270/2025 (art. 3º-A da Lei 9.250):
 *     até R$ 5.000,00 de rendimento tributável → até R$ 312,89 (imposto zera); de 5.000,01 a 7.350,00 →
 *     978,62 − 0,133145 × rendimento; acima, nada. A redução vale também no 13º (§ 3º), que é tributado
 *     exclusivamente na fonte e SEM o desconto simplificado (base = 13º − INSS do 13º).
 *   · 13º: 1ª parcela (metade, sem desconto) até 30/11; 2ª (o resto, com TODO o INSS e o IR) até 20/12 — em 2026
 *     o dia 20 é domingo, então a 2ª tem que cair até sexta, 18/12 (Lei 4.749/1965: antecipa pro dia útil anterior).
 *   · FGTS: 8% do salário e do 13º, depositado pela empresa.
 *
 * Fora do cálculo (a tela diz): dependentes, pensão, médias de hora extra/comissão/adicional, faltas.
 */

export type Faixa = { ate: number; aliquota: number };

export const INSS_2026: readonly Faixa[] = [
  { ate: 1621.0, aliquota: 0.075 },
  { ate: 2902.84, aliquota: 0.09 },
  { ate: 4354.27, aliquota: 0.12 },
  { ate: 8475.55, aliquota: 0.14 },
];
export const TETO_INSS_2026 = 8475.55;
export const SALARIO_MINIMO_2026 = 1621.0;

export const IRRF_2026: readonly { ate: number; aliquota: number; deduzir: number }[] = [
  { ate: 2428.8, aliquota: 0, deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deduzir: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 675.49 },
  { ate: Infinity, aliquota: 0.275, deduzir: 908.73 },
];
export const DESCONTO_SIMPLIFICADO_2026 = 607.2;

export const centavos = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export function inss(base: number): number {
  const b = Math.min(Math.max(0, base), TETO_INSS_2026);
  let total = 0;
  let piso = 0;
  for (const f of INSS_2026) {
    if (b <= piso) break;
    total += (Math.min(b, f.ate) - piso) * f.aliquota;
    piso = f.ate;
  }
  return centavos(total);
}

/** Imposto pela tabela progressiva, sobre a base já deduzida. */
export function irDaTabela(base: number): number {
  if (base <= 0) return 0;
  const f = IRRF_2026.find((x) => base <= x.ate) ?? IRRF_2026[IRRF_2026.length - 1];
  return centavos(Math.max(0, base * f.aliquota - f.deduzir));
}

/** A redução da Lei 15.270/2025, pelo rendimento tributável BRUTO do mês (ou do 13º). */
export function reducaoLei15270(rendimento: number): number {
  if (rendimento <= 5000) return 312.89;
  if (rendimento <= 7350) return centavos(Math.max(0, 978.62 - 0.133145 * rendimento));
  return 0;
}

export function irMensal(bruto: number, comReducao = true): number {
  const deducao = Math.max(inss(bruto), DESCONTO_SIMPLIFICADO_2026);
  const imposto = irDaTabela(bruto - deducao);
  const reducao = comReducao ? Math.min(imposto, reducaoLei15270(bruto)) : 0;
  return centavos(Math.max(0, imposto - reducao));
}

export function irDo13(bruto13: number, comReducao = true): number {
  const imposto = irDaTabela(bruto13 - inss(bruto13));
  const reducao = comReducao ? Math.min(imposto, reducaoLei15270(bruto13)) : 0;
  return centavos(Math.max(0, imposto - reducao));
}

export type Resultado13 = {
  bruto: number;
  /** meses (avos) de 13º: 12 pra quem já estava na empresa em janeiro */
  avos: number;
  bruto13: number;
  parcela1: number;
  parcela2: number;
  inss13: number;
  ir13: number;
  liquido13: number;
  /** o que sai da 2ª parcela (INSS + IR) */
  descontos13: number;
  inssMes: number;
  irMes: number;
  liquidoMes: number;
  /** quanto a Lei 15.270/2025 deixa a mais no bolso: por mês e no ano (12 meses + 13º) */
  economiaIrMes: number;
  economiaIrAno: number;
  fgtsAno: number;
};

export function calcular13(bruto: number, avos = 12): Resultado13 {
  const b = centavos(Math.max(0, bruto));
  const a = Math.min(12, Math.max(1, Math.round(avos)));
  const bruto13 = centavos((b * a) / 12);
  const parcela1 = centavos(bruto13 / 2);
  const inss13 = inss(bruto13);
  const ir13 = irDo13(bruto13);
  const liquido13 = centavos(bruto13 - inss13 - ir13);
  const parcela2 = centavos(liquido13 - parcela1);
  const inssMes = inss(b);
  const irMes = irMensal(b);
  const economiaIrMes = centavos(irMensal(b, false) - irMes);
  const economia13 = centavos(irDo13(bruto13, false) - ir13);
  return {
    bruto: b, avos: a, bruto13, parcela1, parcela2, inss13, ir13, liquido13,
    descontos13: centavos(inss13 + ir13),
    inssMes, irMes, liquidoMes: centavos(b - inssMes - irMes),
    economiaIrMes, economiaIrAno: centavos(economiaIrMes * a + economia13),
    fgtsAno: centavos(0.08 * (b * a + bruto13)),
  };
}

/* ------------------------------------------------ datas do 13º de 2026 */
export const DATA_PARCELA_1 = new Date(2026, 10, 30); // seg, 30/11
export const DATA_PARCELA_2 = new Date(2026, 11, 18); // sex, 18/12 (20/12 é domingo)

/** Dias inteiros de hoje até a data (0 se já passou). */
export function diasAte(data: Date, hoje: Date = new Date()): number {
  const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.max(0, Math.round((data.getTime() - a) / 86_400_000));
}

/* ------------------------------------------------ entrada */
/** "3.500", "3500,50", "R$ 3.500,00" → 3500.5. Lixo → NaN. */
export function lerSalario(texto: string): number {
  const limpo = String(texto ?? "").replace(/[^\d,.]/g, "");
  if (!limpo) return NaN;
  let normal = limpo;
  if (limpo.includes(",")) normal = limpo.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\.|$)/.test(limpo)) normal = limpo.replace(/\./g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

export const SALARIO_MIN_ACEITO = 500;
export const SALARIO_MAX_ACEITO = 100_000;

/** A faixa que vai pra analytics e pra conta: nunca o salário exato. */
export function faixaDoSalario(bruto: number): string {
  if (bruto < 2000) return "ate_2k";
  if (bruto < 3000) return "2k_3k";
  if (bruto < 5000) return "3k_5k";
  if (bruto <= 7350) return "5k_7k";
  if (bruto < 12000) return "7k_12k";
  return "12k_mais";
}

/* ------------------------------------------------ formatação */
export const reais = (v: number, casas = 2): string =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
