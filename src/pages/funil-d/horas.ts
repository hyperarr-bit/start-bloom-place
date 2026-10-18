/**
 * O PREÇO DA HORA (/funil-d). Conta pura: o salário que a pessoa digitou vira
 * a hora dela, o dia dela e o quanto o plano de R$ 97,90 cabe nessa hora.
 *
 * Não estima gasto. Não lê extrato. O único dado dela é o número que ela
 * mesma escreveu; o resto é divisão.
 *
 * Divisor: CLT art. 64 — salário-hora do mensalista = salário ÷ (30 × jornada
 * diária). 44h/semana ÷ 6 = 7h20; 30 × 7h20 = 220. Meio período (22h) = 110.
 * O "dia" é o salário ÷ 30, a fatia igual de cada dia do calendário — não é
 * o que ela gastou.
 *
 * Pro analytics e pro pixel sai SÓ a faixa (`faixaSalario` / `faixaPreco`).
 * O valor em centavos fica na tela e na memória da aba.
 */

export const HORAS_CLT = 220;
export const HORAS_MEIO = 110;
export const PRECO_ANUAL_CENTAVOS = 9790;
/** 97,90 ÷ 12 = 8,1583… → R$ 8,16 (nunca prometer menos do que a divisão dá). */
export const PRECO_MES_CENTAVOS = 816;

export const SALARIO_MIN = 10_000;
export const SALARIO_MAX = 20_000_000;
export const PRECO_MIN = 100;
export const PRECO_MAX = 10_000_000;

export type Jornada = "44h" | "22h";
export type FaixaSalario = "ate_1500" | "1500_3000" | "3000_5000" | "5000_8000" | "8000_mais";
export type FaixaPreco = "ate_20" | "20_50" | "50_100" | "100_300" | "300_mais";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const horasDaJornada = (j: Jornada): number => (j === "22h" ? HORAS_MEIO : HORAS_CLT);

export function reais(centavos: number): string {
  const neg = centavos < 0;
  const v = Math.abs(Math.round(centavos));
  const inteiro = Math.floor(v / 100);
  const cents = String(v % 100).padStart(2, "0");
  const mil = String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}R$ ${mil},${cents}`;
}

/** "R$ 3.200" quando não há centavos; senão o valor cheio. */
export function reaisSolto(centavos: number): string {
  if (Math.round(centavos) % 100 === 0) return reais(centavos).replace(/,00$/, "");
  return reais(centavos);
}

export function duracao(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
}

/**
 * Lê o que a pessoa digitou. Vírgula é centavo. Ponto com 3 dígitos depois é
 * milhar ("3.200", "1.500.000"). Ponto com 1 ou 2 dígitos é centavo ("14.90"),
 * porque tem gente que digita assim no celular.
 */
export function centavosDe(texto: string): number | null {
  const s = texto.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let reaisStr: string;
  let centsStr = "00";
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot;
    const corte = decimal ? lastComma : lastDot;
    reaisStr = s.slice(0, corte).replace(/[.,]/g, "");
    centsStr = s.slice(corte + 1);
  } else if (lastComma >= 0) {
    reaisStr = s.slice(0, lastComma).replace(/\./g, "");
    centsStr = s.slice(lastComma + 1);
  } else if (lastDot >= 0) {
    const depois = s.slice(lastDot + 1);
    const milhar = /^\d{1,3}(\.\d{3})+$/.test(s);
    if (milhar) reaisStr = s.replace(/\./g, "");
    else if (depois.length <= 2) {
      reaisStr = s.slice(0, lastDot).replace(/\./g, "");
      centsStr = depois;
    } else return null;
  } else reaisStr = s;
  if (!/^\d+$/.test(reaisStr) || !/^\d{1,2}$/.test(centsStr)) return null;
  if (centsStr.length === 1) centsStr += "0";
  const centavos = Number(reaisStr) * 100 + Number(centsStr);
  if (!Number.isSafeInteger(centavos) || centavos <= 0) return null;
  return centavos;
}

export function faixaSalario(centavos: number): FaixaSalario {
  const r = centavos / 100;
  if (r < 1500) return "ate_1500";
  if (r < 3000) return "1500_3000";
  if (r < 5000) return "3000_5000";
  if (r < 8000) return "5000_8000";
  return "8000_mais";
}

export function faixaPreco(centavos: number): FaixaPreco {
  const r = centavos / 100;
  if (r < 20) return "ate_20";
  if (r < 50) return "20_50";
  if (r < 100) return "50_100";
  if (r < 300) return "100_300";
  return "300_mais";
}

export function salarioAceito(centavos: number | null): centavos is number {
  return centavos != null && centavos >= SALARIO_MIN && centavos <= SALARIO_MAX;
}

export function precoAceito(centavos: number | null): centavos is number {
  return centavos != null && centavos >= PRECO_MIN && centavos <= PRECO_MAX;
}

export type Calendario = { dia: number; diasNoMes: number; restantes: number; mes: string; ano: number };

export function calendario(hoje: Date): Calendario {
  const dia = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return { dia, diasNoMes, restantes: diasNoMes - dia + 1, mes: MESES[hoje.getMonth()], ano: hoje.getFullYear() };
}

export type ContaDaHora = Calendario & {
  salarioCentavos: number;
  jornada: Jornada;
  horaCentavos: number;
  diaCentavos: number;
  cabeCentavos: number;
  planoMinutos: number;
  mesMinutos: number;
  faixa: FaixaSalario;
};

export function calcularDia(salarioCentavos: number, jornada: Jornada, hoje: Date): ContaDaHora | null {
  if (!salarioAceito(salarioCentavos)) return null;
  const horaCentavos = Math.round(salarioCentavos / horasDaJornada(jornada));
  if (horaCentavos <= 0) return null;
  const cal = calendario(hoje);
  return {
    ...cal,
    salarioCentavos,
    jornada,
    horaCentavos,
    diaCentavos: Math.round(salarioCentavos / 30),
    cabeCentavos: Math.round((salarioCentavos * cal.restantes) / 30),
    planoMinutos: Math.round((PRECO_ANUAL_CENTAVOS / horaCentavos) * 60),
    mesMinutos: Math.round((PRECO_MES_CENTAVOS / horaCentavos) * 60),
    faixa: faixaSalario(salarioCentavos),
  };
}

export type Traducao = { precoCentavos: number; minutos: number; faixa: FaixaPreco };

export function traduzir(precoCentavos: number, conta: ContaDaHora): Traducao | null {
  if (!precoAceito(precoCentavos) || conta.horaCentavos <= 0) return null;
  return {
    precoCentavos,
    minutos: Math.round((precoCentavos / conta.horaCentavos) * 60),
    faixa: faixaPreco(precoCentavos),
  };
}

/** "42% de um dia seu" abaixo de 1 dia; "1 dia seu" / "2,5 dias seus" acima. */
export function fatiaDoDia(precoCentavos: number, diaCentavos: number): string {
  if (diaCentavos <= 0 || precoCentavos <= 0) return "";
  const razao = precoCentavos / diaCentavos;
  if (razao < 0.995) return `${Math.max(1, Math.round(razao * 100))}% de um dia seu`;
  const dias = Math.round(razao * 10) / 10;
  const txt = Number.isInteger(dias) ? String(dias) : dias.toFixed(1).replace(".", ",");
  return `${txt} ${dias < 1.05 ? "dia seu" : "dias seus"}`;
}

/**
 * A âncora do preço. A comparação com o preço traduzido só entra quando um
 * mês de CORE cabe de fato dentro dele — se não couber, a frase não aparece.
 */
export function ancora(conta: ContaDaHora, traducao: Traducao | null): { ano: string; comparacao: string | null } {
  const ano = `São ${duracao(conta.planoMinutos)} do seu trabalho no ano. Por mês, ${duracao(conta.mesMinutos)}.`;
  if (traducao && conta.mesMinutos < traducao.minutos) {
    return {
      ano,
      comparacao: `Um mês de CORE (${duracao(conta.mesMinutos)}) cabe dentro desse preço de ${reais(traducao.precoCentavos)} (${duracao(traducao.minutos)}).`,
    };
  }
  return { ano, comparacao: null };
}
