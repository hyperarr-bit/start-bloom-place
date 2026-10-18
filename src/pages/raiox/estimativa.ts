/**
 * Estimativa do quiz. Pura: respostas (faixa 0–3) → vazamentos.
 * ESTIMATIVA — revisar com dado real (tabela em conteudo.ts).
 */
import { CHAVES, DICA, EMOJI, ROTULO, TABELA, type Chave, type Faixa } from "./conteudo";

export type FonteRaiox = "estimativa" | "extrato";

export type Vazamento = {
  chave: Chave;
  rotulo: string;
  emoji: string;
  mes: number;
  ano: number;
  dica: string;
  fonte: FonteRaiox;
};

export type ResumoRaiox = {
  vazou_mes: number;
  vazou_ano: number;
  projecao: number;
  extremo: boolean;
  vazamentos: Vazamento[];
  fonte: FonteRaiox;
};

/** Arredonda pra dezena mais próxima (0,5 sobe). */
export function arredondarDezena(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * Dias até o vazamento escolhido "cobrir" o preço anual.
 * Some quando não faz sentido: menos de 2 dias ou mais de 45.
 */
export function diasDaAncora(mes: number, preco = 97.9): number | null {
  if (!(mes > 0) || !Number.isFinite(mes)) return null;
  const dias = Math.round(preco / (mes / 30));
  if (dias < 2 || dias > 45) return null;
  return dias;
}

export function faixaDeValor(mes: number): string {
  if (mes < 60) return "ate_59";
  if (mes < 200) return "60_199";
  if (mes < 500) return "200_499";
  if (mes < 1000) return "500_999";
  return "1000_mais";
}

type ItemBruto = { chave: Chave; mes: number; fonte: FonteRaiox };

/**
 * Soma os vazamentos ≥ R$ 30, no máximo 4, os maiores primeiro.
 * A soma é a dos que aparecem (o número grande fecha com os cards).
 * Extremo: todas as respostas no primeiro degrau, ou a soma < R$ 60.
 */
export function montarResumo(itens: ItemBruto[], opts: { fonte: FonteRaiox; todasNoPrimeiro?: boolean }): ResumoRaiox {
  const ordenados = [...itens].filter((i) => i.mes >= 30).sort((a, b) => b.mes - a.mes || CHAVES.indexOf(a.chave) - CHAVES.indexOf(b.chave));
  const mostrados = ordenados.slice(0, 4);
  const vazou_mes = mostrados.reduce((s, i) => s + i.mes, 0);
  const vazou_ano = vazou_mes * 12;
  const vazamentos: Vazamento[] = mostrados.map((i) => ({
    chave: i.chave,
    rotulo: ROTULO[i.chave],
    emoji: EMOJI[i.chave],
    mes: i.mes,
    ano: i.mes * 12,
    dica: DICA[i.chave],
    fonte: i.fonte,
  }));
  return {
    vazou_mes,
    vazou_ano,
    projecao: arredondarDezena(vazou_ano * 0.5),
    extremo: !!opts.todasNoPrimeiro || vazou_mes < 60,
    vazamentos,
    fonte: opts.fonte,
  };
}

export function estimar(respostas: Partial<Record<Chave, number>>): ResumoRaiox {
  const itens: ItemBruto[] = [];
  let todas = true;
  for (const chave of CHAVES) {
    const faixa = respostas[chave];
    if (faixa == null || faixa < 0 || faixa > 3) {
      todas = false;
      continue;
    }
    if (faixa !== 0) todas = false;
    itens.push({ chave, mes: TABELA[chave][faixa as Faixa], fonte: "estimativa" });
  }
  return montarResumo(itens, { fonte: "estimativa", todasNoPrimeiro: todas && CHAVES.every((c) => respostas[c] === 0) });
}
