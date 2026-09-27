/**
 * Reais na tela (26/09, varredura): `toLocaleString({ maximumFractionDigits: 2 })`
 * sem mínimo mostrava "R$ 3.807,9". Com centavos, sempre 2 casas; valor
 * redondo fica sem casas ("R$ 9.000"), como a Comparação mensal já fazia.
 */
export const reais = (n: number): string => {
  const v = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  return Number.isInteger(v)
    ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
    : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
