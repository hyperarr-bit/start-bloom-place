/**
 * Tamanho do copo/garrafa de água (chave `core-saude-copo-ml`, em ml).
 *
 * O app conta água em PORÇÕES (copos): os registros do dia guardam quantas
 * vezes a pessoa bebeu, e o ml só entra na hora de mostrar. Este é o único
 * lugar que sabe o padrão (250) e a faixa (50–2000) — Saúde, a ação rápida da
 * Home e a demo liam a chave cada um com a sua cópia da regra.
 *
 * 07/10 (chamado do iPhone 1.0.9): "mudei pra 1 litro por vez, que é minha
 * garrafa, e não muda aí no início" — a ação rápida da Home dizia "+ 200ml
 * Água" cravado no código (o toast já respeitava a chave desde 16/08; o
 * rótulo do botão, não).
 */
export const CHAVE_COPO_ML = "core-saude-copo-ml";
export const COPO_ML_PADRAO = 250;

export const normalizarCopoMl = (bruto: unknown): number =>
  Math.min(2000, Math.max(50, Math.round(Number(bruto) || COPO_ML_PADRAO)));

/** "200ml", "500ml", "1L", "1,5L" — como a tela de Saúde escreve. */
export const rotuloMl = (ml: number): string =>
  ml >= 1000 ? `${(ml / 1000).toFixed(1).replace(/\.0$/, "").replace(".", ",")}L` : `${ml}ml`;

/** Texto do botão da ação rápida da Home: "+ 200ml Água", "+ 1L Água". */
export const rotuloAcaoAgua = (copoMl: number): string => `+ ${rotuloMl(copoMl)} Água`;

/** Garrafa (≥ 500 ml) fala em litros; copo fala em copos (07/10, dono: com a
 *  garrafa de 1 L a Home dizia "Faltam 8 copos de água"). */
const ehGarrafa = (copoMl: number) => copoMl >= 500;

/** "3 copos de água", "1 copo de água", "2L de água", "1,5L de água". */
export const aguaQueFalta = (porcoes: number, copoMl: number): string =>
  ehGarrafa(copoMl) ? `${rotuloMl(porcoes * copoMl)} de água` : `${porcoes} copo${porcoes > 1 ? "s" : ""} de água`;

/** Unidade da contagem na Home: "copos" ou "garrafas". */
export const unidadeDaAgua = (copoMl: number): string => (ehGarrafa(copoMl) ? "garrafas" : "copos");
