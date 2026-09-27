import { medirFinancas } from "@/components/gamification/badges-financas";
import { medirVida } from "@/components/gamification/badges-vida";
import { localDayKey } from "@/lib/utils";

/**
 * INSÍGNIAS (27/09) — os patches bordados da primeira página do planner.
 *
 * Cada uma mostra um NÚMERO DE VERDADE, com a mesma conta dos adesivos
 * (medirFinancas / medirVida / calcularSequencia) — nada aqui inventa métrica.
 * As 3 estrelas são os patamares daquela medida (os adesivos que já existem).
 * A página mostra 6: as 6 do protótipo na ordem aprovada; quando uma delas
 * ainda não tem dado (sem treino, mês sem anotar…), entra a próxima da lista
 * (investidos, desafios vencidos) e, faltando ainda, o patch aparece "a
 * conquistar" — apagado, sem número — em vez de um zero enganoso.
 */

export type IdInsignia = "sequencia" | "sobrou" | "treinos" | "livros" | "agua" | "rotina" | "investido" | "desafios";
export type GlifoInsignia = "chama" | "moeda" | "halter" | "livro" | "gota" | "agenda" | "grafico" | "alvo";
export type FormatoInsignia = "int" | "brl" | "brlmil";

export interface Insignia {
  id: IdInsignia;
  cor: string;
  borda: string;
  glifo: GlifoInsignia;
  rotulo: string;
  valor: number;
  fmt: FormatoInsignia;
  /** 0–3 estrelas: quantos patamares já passou. */
  estrelas: number;
  patamares: [number, number, number];
  /** false = ainda sem dado: o patch aparece "a conquistar", sem número. */
  temDado: boolean;
}

type Leitor = <T>(key: string, fallback: T) => T;

export const ORDEM_INSIGNIAS: IdInsignia[] = ["sequencia", "sobrou", "treinos", "livros", "agua", "rotina", "investido", "desafios"];
export const QUANTAS_NA_PAGINA = 6;

export const estrelasDe = (valor: number, patamares: [number, number, number]): number => patamares.filter((p) => valor >= p).length;

/** "12" · "R$ 1.240" · "R$ 8,5 mil" — o número do patch. */
export const fmtInsignia = (v: number, fmt: FormatoInsignia): string => {
  const n = Math.max(0, v);
  if (fmt === "brl") return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  if (fmt === "brlmil") return n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: n < 10000 ? 1 : 0 })} mil` : `R$ ${Math.round(n)}`;
  return String(Math.round(n));
};

/** As 8 insígnias, com o dado de hoje. `dias` = sequência viva (calcularSequencia().dias). */
export function montarInsignias(get: Leitor, dias: number, hoje: string = localDayKey()): Insignia[] {
  let f: ReturnType<typeof medirFinancas> | null = null;
  let v: ReturnType<typeof medirVida> | null = null;
  try { f = medirFinancas(get); } catch (e) { console.error("[insígnias] finanças:", e); }
  try { v = medirVida(get, hoje); } catch (e) { console.error("[insígnias] vida:", e); }

  const seq = Math.max(0, dias);
  // só com o mês anotado (≥ 5 gastos e receita): a mesma trava das insígnias de poupança
  const sobrou = f && f.mesAnotado && f.totalIncome > 0 ? f.sobrouNoMes : 0;
  const treinos = v?.treinos.length ?? 0;
  const livros = v?.terminados ?? 0;
  const agua = v?.diasDeAgua ?? 0;
  const rotina = v?.recordeRotina ?? 0;
  const investido = f?.totalInvestments ?? 0;
  const desafios = f?.challengeWins ?? 0;

  const ins = (
    id: IdInsignia, cor: string, borda: string, glifo: GlifoInsignia, rotulo: string,
    valor: number, fmt: FormatoInsignia, patamares: [number, number, number], estrelas = estrelasDe(valor, patamares),
  ): Insignia => ({ id, cor, borda, glifo, rotulo, valor, fmt, patamares, estrelas, temDado: valor > 0 });

  return [
    ins("sequencia", "#ea580c", "#9a3412", "chama", "DIAS SEGUIDOS", seq, "int", [7, 30, 100]),
    ins("sobrou", "#16a34a", "#14532d", "moeda", "SOBROU NO MÊS", sobrou, "brl", [20, 40, 60], f ? estrelasDe(sobrou > 0 ? f.taxaDoMes : 0, [20, 40, 60]) : 0),
    ins("treinos", "#2563eb", "#1e3a8a", "halter", "TREINOS", treinos, "int", [1, 12, 50]),
    ins("livros", "#7c3aed", "#4c1d95", "livro", "LIVROS LIDOS", livros, "int", [1, 10, 25]),
    ins("agua", "#0284c7", "#075985", "gota", "DIAS DE ÁGUA", agua, "int", [7, 30, 100]),
    ins("rotina", "#059669", "#064e3b", "agenda", "DIAS DE ROTINA", rotina, "int", [7, 21, 60]),
    ins("investido", "#b45309", "#78350f", "grafico", "INVESTIDOS", investido, "brlmil", [1000, 10000, 50000]),
    ins("desafios", "#db2777", "#9d174d", "alvo", "DESAFIOS VENCIDOS", desafios, "int", [1, 5, 15]),
  ];
}

/**
 * As 6 da página: as 6 primeiras da ordem aprovada que têm dado; sem dado,
 * entra a próxima da lista; faltando ainda, os patches "a conquistar".
 */
export function escolherInsignias(todas: Insignia[], quantas = QUANTAS_NA_PAGINA): Insignia[] {
  const comDado = todas.filter((i) => i.temDado);
  const semDado = todas.filter((i) => !i.temDado);
  return [...comDado, ...semDado].slice(0, quantas);
}
