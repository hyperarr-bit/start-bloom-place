/**
 * A MATEMÁTICA DO SOMA-ASSINATURAS (/funil-e) — pura e testada.
 *
 * Por que isto existe e não é "mais um quiz de estimativa": o número que a
 * pessoa vê é uma CONTA EXATA sobre a seleção dela (serviço × preço público
 * de hoje), não uma faixa chutada. "Valor de mentira" foi a causa nº 2 do
 * post-mortem dos funis — aqui não existe estimativa.
 */
import { SERVICOS, type Servico } from "./conteudo";

/** Preço do CORE anual (a97): usado SÓ na âncora ("paga N anos de CORE"). */
export const PRECO_CORE_ANUAL = 97.9;

/* ------------------------------------------------ formatação */
/** "R$ 347" se inteiro, "R$ 347,79" com centavos. */
export const brl = (v: number): string => {
  const c = Math.round(v * 100) / 100;
  const inteiro = Math.abs(c - Math.round(c)) < 0.005;
  return `R$ ${c.toLocaleString("pt-BR", inteiro ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
/** "out/2026" — o selo do resultado (no fuso de São Paulo, que é o do tráfego). */
export const mesRotulo = (agora: Date = new Date()): string => {
  const sp = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${MESES[sp.getMonth()]}/${sp.getFullYear()}`;
};

/* ------------------------------------------------ totais */
const mapa = (servicos: Servico[]): Map<string, Servico> => new Map(servicos.map((s) => [s.id, s]));

/** Total por mês: a soma exata dos serviços escolhidos + os "outra assinatura" (valores avulsos). */
export function totalMes(sel: string[], extras: number[], servicos: Servico[] = SERVICOS): number {
  const m = mapa(servicos);
  const dosServicos = sel.reduce((acc, id) => acc + (m.get(id)?.preco ?? 0), 0);
  const dosExtras = extras.reduce((acc, v) => acc + v, 0);
  return Math.round((dosServicos + dosExtras) * 100) / 100;
}

export const totalAno = (mes: number): number => Math.round(mes * 12 * 100) / 100;

/** Os itens do cupom (na ordem da grade, depois os extras), pra lista do resultado. */
export function cupom(sel: string[], extras: number[], servicos: Servico[] = SERVICOS): { chave: string; nome: string; emoji: string; preco: number; plano: string }[] {
  const m = mapa(servicos);
  const itens = sel
    .map((id) => m.get(id))
    .filter((s): s is Servico => !!s)
    .map((s) => ({ chave: s.id, nome: s.nome, emoji: s.emoji, preco: s.preco, plano: s.plano }));
  extras.forEach((v, i) => itens.push({ chave: `extra-${i}`, nome: "Outra assinatura", emoji: "➕", preco: v, plano: "valor informado" }));
  return itens.sort((a, b) => b.preco - a.preco);
}

/* ------------------------------------------------ "não usei no último mês" */
/** A economia de cancelar as marcadas como "não usei": por mês e por ano. */
export function economia(naoUsadas: { preco: number }[]): { n: number; mes: number; ano: number } {
  const mes = Math.round(naoUsadas.reduce((acc, s) => acc + s.preco, 0) * 100) / 100;
  return { n: naoUsadas.length, mes, ano: totalAno(mes) };
}

/** A mais cara das "não usei" (é ela que ancora o preço). */
export function maisCara(naoUsadas: { chave: string; nome: string; preco: number }[]): { chave: string; nome: string; preco: number } | null {
  return naoUsadas.reduce<typeof naoUsadas[number] | null>((max, s) => (max && max.preco >= s.preco ? max : s), null);
}

/* ------------------------------------------------ âncora do preço */
/** Quantos anos de CORE a economia de 1 ano paga (1 casa decimal; "2,7"). */
export const anosDeCore = (economiaAnual: number): number => Math.floor((economiaAnual / PRECO_CORE_ANUAL) * 10) / 10;

/**
 * A linha de âncora do card de preço — sempre com o número DELA:
 *  1. marcou "não usei" e a mais cara cobre ≥ 1 ano de CORE: "Cancelar a Netflix que você nem
 *     usou já paga 2,7 anos de CORE.";
 *  2. o total dela por mês ≥ o preço do ano: "Você paga R$ 347 por MÊS. O CORE é R$ 97,90 por ANO.";
 *  3. senão, sem âncora (a linha "dá R$ 8,16/mês" já trabalha).
 */
export function ancoraPreco(args: { totalMes: number; caraNaoUsada: { nome: string; preco: number } | null }): string | null {
  const { totalMes: tm, caraNaoUsada } = args;
  if (caraNaoUsada && caraNaoUsada.preco * 12 >= PRECO_CORE_ANUAL) {
    const anos = anosDeCore(caraNaoUsada.preco * 12);
    const rotulo = String(anos).replace(".", ",");
    return `Cancelar ${artigo(caraNaoUsada.nome)} que você nem usou já paga ${rotulo} ${anos === 1 ? "ano" : "anos"} de CORE.`;
  }
  if (tm >= PRECO_CORE_ANUAL) return `Você paga ${brl(tm)} por MÊS em assinaturas. O CORE é ${brl(PRECO_CORE_ANUAL)} por ANO.`;
  return null;
}

/** "o/a" pra alguns nomes ("a Netflix", "o Spotify") — só pra âncora ler natural. */
const FEMININOS = new Set(["Netflix", "Paramount+", "PS Plus"]);
const artigo = (nome: string): string => (FEMININOS.has(nome) ? `a ${nome}` : `o ${nome}`);

/* ------------------------------------------------ equivalência concreta (tabela fixa, sem preço de produto) */
/** "= uma viagem / um celular novo…" — faixas fixas, nunca inventar preço de produto específico. */
export function equivalencia(ano: number): string | null {
  if (ano >= 8000) return "uma viagem em família";
  if (ano >= 4000) return "um celular novo";
  if (ano >= 2000) return "4 meses de mercado";
  if (ano >= 1000) return "2 meses de mercado";
  return null;
}

/* ------------------------------------------------ faixa pro analytics (NUNCA valores exatos pro Meta) */
export type FaixaTotal = "ate_100" | "100_200" | "200_350" | "350_600" | "600_mais";
export const faixaTotal = (mes: number): FaixaTotal =>
  mes < 100 ? "ate_100" : mes < 200 ? "100_200" : mes < 350 ? "200_350" : mes < 600 ? "350_600" : "600_mais";
