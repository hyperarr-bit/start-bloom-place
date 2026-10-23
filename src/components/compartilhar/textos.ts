/**
 * OS TEXTOS DOS CARDS DE COMPARTILHAR (29/09) — conta pura, sem React.
 *
 * Três regras que valem pra todos os cards:
 *  1. PLURAL certo sempre: "1 mês", "2 meses", "1 treino" (o card de 28/09
 *     dizia "1 MESES NO AZUL").
 *  2. PERÍODO explícito: o número diz de quando é ("em setembro", "desde
 *     março"). O card antigo punha "Setembro foi de academia." em cima de um
 *     total desde que a pessoa começou (35 treinos em 7 meses).
 *  3. DINHEIRO: nunca R$ por padrão. `reais()` só devolve texto com a
 *     escolha da pessoa ("mostrar valores" ligado); senão devolve null e o
 *     card mostra % ou nada.
 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Índice de mês normalizado (−1 vira dezembro). */
const idx = (mesIdx: number) => ((mesIdx % 12) + 12) % 12;

export const nomeDoMes = (mesIdx: number) => MESES[idx(mesIdx)];
export const mesCurto = (mesIdx: number) => MESES_CURTOS[idx(mesIdx)];
export const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "1.234" · "12,5" — número à brasileira. */
export const numeroBR = (n: number, casas = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 });

/**
 * "1 mês" · "2 meses" · "0 treinos". A forma singular é só para exatamente 1
 * (em português, 0 e 1,5 vão no plural).
 */
export const plural = (n: number, [um, varios]: readonly [string, string], casas = 0) =>
  `${numeroBR(n, casas)} ${Math.abs(n) === 1 ? um : varios}`;

/** Só a palavra, concordando com n ("mês"/"meses"). */
export const palavra = (n: number, [um, varios]: readonly [string, string]) => (Math.abs(n) === 1 ? um : varios);

export const UNIDADES = {
  mes: ["mês", "meses"],
  mesNoAzul: ["mês no azul", "meses no azul"],
  treino: ["treino", "treinos"],
  dia: ["dia", "dias"],
  diaSeguido: ["dia seguido", "dias seguidos"],
  livro: ["livro", "livros"],
  pagina: ["página", "páginas"],
  noite: ["noite", "noites"],
  meta: ["meta", "metas"],
  semana: ["semana", "semanas"],
  recorde: ["recorde", "recordes"],
  copo: ["copo", "copos"],
} as const satisfies Record<string, readonly [string, string]>;

/** "AAAA-MM" → { ano, mesIdx } */
export const lerMesId = (id: string): { ano: number; mesIdx: number } => {
  const [a, m] = id.split("-").map(Number);
  return { ano: a || 1970, mesIdx: (m || 1) - 1 };
};

/** "AAAA-MM-DD" (dia local) do dia `d` do mês. */
export const diaDoMes = (ano: number, mesIdx: number, d: number) =>
  `${ano}-${String(mesIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const diasNoMes = (ano: number, mesIdx: number) => new Date(ano, mesIdx + 1, 0).getDate();

/** "em setembro" · "em setembro de 2025" (só põe o ano se não for o ano de referência). */
export const noMes = (mesIdx: number, ano: number, anoDeReferencia = ano) =>
  `em ${nomeDoMes(mesIdx)}${ano !== anoDeReferencia ? ` de ${ano}` : ""}`;

/** "SETEMBRO 2026" */
export const mesAno = (mesIdx: number, ano: number) => `${nomeDoMes(mesIdx).toUpperCase()} ${ano}`;

/** "desde março" · "desde março de 2025" */
export const desdeMes = (mesIdx: number, ano: number, anoDeReferencia = ano) =>
  `desde ${nomeDoMes(mesIdx)}${ano !== anoDeReferencia ? ` de ${ano}` : ""}`;

/**
 * R$ só com a escolha da pessoa. Sem "mostrar valores" → null (quem chama
 * não mostra nada, ou mostra a %). Com → "R$ 1.240".
 */
export const reais = (valor: number | null | undefined, valoresLigados: boolean): string | null => {
  if (!valoresLigados || valor == null || !Number.isFinite(valor)) return null;
  return `R$ ${numeroBR(Math.round(valor))}`;
};

/** "18%" — a % inteira (o que o card mostra por padrão no lugar do R$). */
export const porcento = (v: number) => `${Math.round(Number.isFinite(v) ? v : 0)}%`;

/** "João Victor" → "João" (o card nunca precisa do sobrenome). */
export const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] ?? "";
