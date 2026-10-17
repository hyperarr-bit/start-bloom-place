/**
 * CATÁLOGO DOS DESAFIOS DA SEMANA (17/10, ramo v1016-desafios).
 *
 * Pedido do dono: "os desafios mudassem conforme a semana; desafios úteis que o
 * pessoal engaje". Pesquisa, veredito da lista do Grok e o desenho inteiro em
 * scratchpad/definitiva/12-desafios.md. O que importa aqui:
 *
 *  · A FALHA de todo desafio de restrição ("zero delivery"): quem PARA DE ANOTAR
 *    vence. Então todo desafio do tipo `restricao` só fecha com ≥ 4 dias anotados
 *    na semana (gasto variável no dia, ou o toque "não gastei nada hoje", que
 *    grava `finance-sem-gasto`) — ver `avaliarNoCatalogo`. Perder por falta de
 *    registro é "faltou anotar" (motivo `sem-registro`), não regra quebrada, e o
 *    desafio volta como revanche.
 *  · Metade do cardápio é AÇÃO positiva (anotar, categorizar, pagar conta, guardar,
 *    revisar assinaturas): impossível vencer por omissão.
 *  · Só se oferece o que a pessoa tem DADO pra sustentar (`elegivel`): Uber só pra
 *    quem anota corrida; crédito só pra quem preenche a forma de pagamento; etc.
 *  · Teto em vez de zero sempre que possível (o "what-the-hell effect": regra
 *    rígida + uma escorregada = a pessoa desiste e gasta mais). Níveis apertam só
 *    depois de uma vitória.
 *
 * Tudo puro: `montarDados` lê o store pelo `ler` e cada definição decide em cima
 * de `DadosDaSemana`. Nada aqui grava.
 */

import { chaveArquivada } from "@/lib/virada-do-mes";
import { doPerfil } from "@/lib/finance-perfil";
import { CHAVE_SEM_GASTO } from "@/lib/acao-do-dia";
import { type GastoDoDesafio, type MotivoDoFechamento, gastosParaDesafio, segundaAnterior, weekDates } from "./challenges";

export type Leitor = (chave: string) => unknown;
export type TipoDesafio = "restricao" | "acao";

export interface Avaliacao {
  pct: number;
  done: boolean;
  failed: boolean;
  statusText: string;
  motivo?: MotivoDoFechamento;
}

export interface ContaDaSemana { date: string; name: string; paid: boolean }

export interface Calendario {
  /** Semana pré-Black Friday (a da BF e a de duas semanas antes). */
  blackFriday: boolean;
  dezembro: boolean;
  /** A semana em que o salário costuma cair (só quando o app conseguiu inferir o dia). */
  pagamento: boolean;
}

/** Tudo o que um desafio pode olhar, já filtrado pelo perfil (PF/PJ) e pela semana. */
export interface DadosDaSemana {
  weekStart: string;
  /** Hoje, "AAAA-MM-DD" local. */
  hoje: string;
  /** Os 7 dias da semana (segunda a domingo). */
  dias: string[];
  /** 1..7 (segunda = 1). Semana já acabou = 7. */
  elapsedDays: number;
  semanaAcabou: boolean;
  /** Gastos variáveis da semana. */
  semana: GastoDoDesafio[];
  /** Gastos variáveis da semana anterior. */
  anterior: GastoDoDesafio[];
  /** Gastos das 4 semanas antes desta (inclui a anterior) — o "hábito" da pessoa. */
  historico4: GastoDoDesafio[];
  /** Gastos das 8 semanas antes desta. */
  historico8: GastoDoDesafio[];
  /** Dias da semana com registro: gasto variável OU "não gastei nada hoje". */
  diasAnotados: Set<string>;
  /** Dias da semana marcados "não gastei nada hoje". */
  semGasto: Set<string>;
  /** Custos fixos (finance-fixed-expenses) do perfil. */
  fixos: Record<string, unknown>[];
  /** Contas (finance-dueDays) que vencem em dias desta semana. */
  contas: ContaDaSemana[];
  reserva: { guardado: number; registrada: boolean };
  /** Receitas no mês corrente + mês anterior. */
  receitasRecentes: number;
  diaPagamento: number | null;
  calendario: Calendario;
  /** `active.meta`: retrato de segunda e confirmações da pessoa. */
  meta: Record<string, unknown>;
}

export interface DefDesafio {
  key: string;
  emoji: string;
  tipo: TipoDesafio;
  /** Quantos níveis existem (1 = sem níveis). */
  niveis: number;
  titulo: (nivel: number, d: DadosDaSemana) => string;
  desc: (nivel: number, d: DadosDaSemana) => string;
  elegivel: (d: DadosDaSemana) => boolean;
  /** A regra do desafio em si — a trava de registro entra por fora (avaliarNoCatalogo). */
  avaliar: (nivel: number, d: DadosDaSemana) => Avaliacao;
  /** Retrato gravado em `active.meta` na hora da escolha (ex.: quanto já tinha na reserva). */
  retrato?: (d: DadosDaSemana) => Record<string, unknown>;
  /** Botão de confirmação dentro do card ("Revisei, todas valem") → grava `meta[chave] = hoje`. */
  confirmacao?: { botao: string; chave: string };
}

/* ───────────────────────────── helpers ───────────────────────────── */

const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const num = (v: unknown) => (v !== null && Number.isFinite(Number(v)) ? Number(v) : 0);
const texto = (g: GastoDoDesafio | Record<string, unknown>) => String((g as { description?: unknown }).description ?? (g as { name?: unknown }).name ?? "");
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
const soma = (gs: GastoDoDesafio[]) => gs.reduce((s, g) => s + num(g.value), 0);
const diasDistintos = (gs: GastoDoDesafio[]) => new Set(gs.map((g) => g.date ?? "")).size;
const diaDaSemana = (data: string) => new Date(`${data}T12:00:00`).getDay(); // 0 = domingo
const ehDiaUtil = (data: string) => { const dow = diaDaSemana(data); return dow >= 1 && dow <= 5; };
export const reais = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** Loja online na descrição (Shopee, Shein, Temu, Mercado Livre, Amazon, AliExpress, Magalu…). */
export const LOJA_ONLINE = /shopee|shein|temu|mercado ?livre|\bmeli\b|amazon|ali ?express|magalu|magazine ?luiza|americanas|kabum|netshoes|dafiti|zattini|\bolx\b|enjoei/i;
/** Corrida de app na descrição. "Transporte" sem isso pode ser ônibus — não conta. */
export const CORRIDA_DE_APP = /\buber\b|\b99\b|99 ?pop|cabify|indriver|in ?drive|t[aá]xi|\bcorrida\b/i;
/** Assinatura pelo nome (quando o fixo não está na categoria "assinaturas"). */
export const ASSINATURA = /netflix|spotify|prime|disney|hbo|\bmax\b|deezer|youtube|globoplay|crunchyroll|icloud|apple\.com|google (one|storage)|paramount|telecine|xbox game|playstation plus|ps plus|canva|chatgpt|assinatura/i;

const ehDelivery = (g: GastoDoDesafio) => g.category === "delivery";
const ehComidaFora = (g: GastoDoDesafio) => g.category === "restaurante" || g.category === "delivery";
const ehLazer = (g: GastoDoDesafio) => g.category === "lazer" || g.category === "entretenimento";
const ehMercado = (g: GastoDoDesafio) => g.category === "mercado";
const ehCredito = (g: GastoDoDesafio) => g.paymentMethod === "credito";
const ehCorrida = (g: GastoDoDesafio) => CORRIDA_DE_APP.test(texto(g));
const ehLojaOnline = (g: GastoDoDesafio) => LOJA_ONLINE.test(texto(g));
const ehFormiga = (g: GastoDoDesafio) => num(g.value) > 0 && num(g.value) < 20 && (g.category === "alimentacao" || ehComidaFora(g));
const ehGrandeImpulso = (g: GastoDoDesafio) => (g.category === "vestuario" || g.category === "eletronicos") && num(g.value) > 80;
const semCategoria = (g: GastoDoDesafio) => !g.category || g.category === "outros";
const ehAssinatura = (f: Record<string, unknown>) => f.category === "assinaturas" || ASSINATURA.test(texto(f));

/** Arredonda a R$ 5 (teto legível), nunca abaixo de R$ 20. */
const tetoDeLazer = (d: DadosDaSemana) => Math.max(20, Math.round(soma(d.anterior.filter(ehLazer)) / 2 / 5) * 5);

/** Semana ISO do ano da segunda-feira (o "N" do desafio das 52 semanas). */
export const semanaDoAno = (weekStart: string): number => {
  const seg = new Date(`${weekStart}T12:00:00`);
  const quinta = new Date(seg);
  quinta.setDate(seg.getDate() + 3);
  const jan4 = new Date(quinta.getFullYear(), 0, 4, 12);
  const segDoJan4 = new Date(jan4);
  segDoJan4.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  return Math.round((seg.getTime() - segDoJan4.getTime()) / (7 * 86_400_000)) + 1;
};

/** Black Friday = dia seguinte à 4ª quinta de novembro. */
export const blackFridayDe = (ano: number): string => {
  const primeiro = new Date(ano, 10, 1, 12);
  const primeiraQuinta = 1 + ((4 - primeiro.getDay() + 7) % 7);
  return diaLocal(new Date(ano, 10, primeiraQuinta + 21 + 1, 12));
};

const mondayLocal = (data: string) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return diaLocal(d);
};

/** As duas semanas de tentação: a da Black Friday e a de duas semanas antes (2026: 09–15/11 e 23–29/11). */
export const semanaPreBlackFriday = (weekStart: string): boolean => {
  const bf = blackFridayDe(Number(weekStart.slice(0, 4)));
  const semanaBf = mondayLocal(bf);
  const duasAntes = new Date(`${semanaBf}T12:00:00`);
  duasAntes.setDate(duasAntes.getDate() - 14);
  return weekStart === semanaBf || weekStart === diaLocal(duasAntes);
};

const diasNoMes = (ano: number, mes1a12: number) => new Date(ano, mes1a12, 0).getDate();

/** A semana contém o dia do pagamento (dia 31 num mês de 30 cai no 30). */
export const semanaDoPagamento = (dias: string[], diaPagamento: number | null): boolean =>
  diaPagamento !== null && dias.some((d) => Number(d.slice(8, 10)) === Math.min(diaPagamento, diasNoMes(Number(d.slice(0, 4)), Number(d.slice(5, 7)))));

const RECEITA_DE_SALARIO = /sal[aá]rio|pagamento|holerite|adiantamento|\bvale\b|pr[oó]-?labore|quinzena/i;

/**
 * Dia do mês em que o salário costuma cair, inferido das receitas de até 4 meses
 * (mês corrente + 3 arquivados): o dia mais repetido entre as receitas "de
 * salário" (ou a maior de cada mês), em pelo menos 2 meses distintos. `null` =
 * o app não sabe — e aí não se finge que sabe.
 */
export const inferirDiaDoPagamento = (ler: Leitor, perfil: string, hoje: Date): number | null => {
  const meses: Record<string, unknown>[][] = [lista(ler("finance-incomes"))];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(lista(ler(chaveArquivada(d.getFullYear(), d.getMonth(), "incomes"))));
  }
  const votos = new Map<number, Set<string>>();
  for (const bruto of meses) {
    const receitas = doPerfil(bruto as (Record<string, unknown> & { perfil?: string })[], perfil).filter((r) => typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.date as string));
    const porMes = new Map<string, Record<string, unknown>[]>();
    for (const r of receitas) {
      const mes = (r.date as string).slice(0, 7);
      porMes.set(mes, [...(porMes.get(mes) ?? []), r]);
    }
    for (const [mes, rs] of porMes) {
      const deSalario = rs.filter((r) => RECEITA_DE_SALARIO.test(texto(r)));
      const escolhidas = deSalario.length ? deSalario : [rs.reduce((a, b) => (num(b.value) > num(a.value) ? b : a))];
      for (const r of escolhidas) {
        const dia = Number((r.date as string).slice(8, 10));
        if (dia >= 1 && dia <= 31) votos.set(dia, new Set([...(votos.get(dia) ?? []), mes]));
      }
    }
  }
  let melhor: { dia: number; meses: number } | null = null;
  for (const [dia, ms] of votos) if (ms.size >= 2 && (!melhor || ms.size > melhor.meses)) melhor = { dia, meses: ms.size };
  return melhor?.dia ?? null;
};

/* ───────────────────────────── os dados da semana ───────────────────────────── */

export interface EntradaDosDados {
  ler: Leitor;
  weekStart: string;
  perfil: string;
  hoje?: Date;
  /** A lista que a tela já tem na mão (entra primeiro). */
  extras?: GastoDoDesafio[];
  meta?: Record<string, unknown>;
}

const diasAtras = (data: string, n: number) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() - n);
  return diaLocal(d);
};

/** Contas que vencem em dias desta semana: o balde do mês de cada dia (vivo ou arquivado na virada). */
const contasDaSemana = (ler: Leitor, dias: string[], perfil: string, hoje: Date): ContaDaSemana[] => {
  const mesAgora = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const out: ContaDaSemana[] = [];
  for (const data of dias) {
    const mes = data.slice(0, 7);
    const bruto = mes === mesAgora ? ler("finance-dueDays") : ler(chaveArquivada(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, "dueDays"));
    const diaDoMes = Number(data.slice(8, 10));
    for (const d of lista(bruto)) {
      if (num(d.day) !== diaDoMes) continue;
      for (const b of doPerfil(lista(d.bills) as (Record<string, unknown> & { perfil?: string })[], perfil)) {
        out.push({ date: data, name: texto(b), paid: b.paid === true });
      }
    }
  }
  return out;
};

export function montarDados({ ler, weekStart, perfil, hoje = new Date(), extras = [], meta = {} }: EntradaDosDados): DadosDaSemana {
  const dias = weekDates(weekStart);
  const hojeStr = diaLocal(hoje);
  const semanaAcabou = hojeStr > dias[6];
  const elapsedDays = semanaAcabou ? 7 : Math.min(Math.max(dias.indexOf(hojeStr) + 1, 1), 7);

  const todos = gastosParaDesafio(ler, weekStart, perfil, extras, 8);
  const naSemana = new Set(dias);
  const naAnterior = new Set(weekDates(segundaAnterior(weekStart)));
  const data = (g: GastoDoDesafio) => g.date ?? "";
  const desde4 = diasAtras(weekStart, 28);
  const desde8 = diasAtras(weekStart, 56);
  const semana = todos.filter((g) => naSemana.has(data(g)));
  const anterior = todos.filter((g) => naAnterior.has(data(g)));
  const historico8 = todos.filter((g) => data(g) < weekStart && data(g) >= desde8);
  const historico4 = historico8.filter((g) => data(g) >= desde4);

  const marcas = ler(CHAVE_SEM_GASTO);
  const semGasto = new Set(dias.filter((d) => !!marcas && typeof marcas === "object" && (marcas as Record<string, unknown>)[d] === true));
  const diasAnotados = new Set([...semana.map(data).filter((d) => naSemana.has(d)), ...semGasto]);

  const fixos = doPerfil(lista(ler("finance-fixed-expenses")) as (Record<string, unknown> & { perfil?: string })[], perfil);
  const reservaBruta = ler("finance-emergency-fund") as { guardado?: unknown; registrada?: unknown } | null | undefined;
  const reserva = { guardado: num(reservaBruta?.guardado), registrada: reservaBruta?.registrada === true };

  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const receitasRecentes =
    doPerfil(lista(ler("finance-incomes")) as (Record<string, unknown> & { perfil?: string })[], perfil).length +
    doPerfil(lista(ler(chaveArquivada(mesAnterior.getFullYear(), mesAnterior.getMonth(), "incomes"))) as (Record<string, unknown> & { perfil?: string })[], perfil).length;
  const diaPagamento = inferirDiaDoPagamento(ler, perfil, hoje);

  return {
    weekStart, hoje: hojeStr, dias, elapsedDays, semanaAcabou,
    semana, anterior, historico4, historico8, diasAnotados, semGasto,
    fixos, contas: contasDaSemana(ler, dias, perfil, hoje), reserva, receitasRecentes, diaPagamento,
    calendario: { blackFriday: semanaPreBlackFriday(weekStart), dezembro: weekStart.slice(5, 7) === "12", pagamento: semanaDoPagamento(dias, diaPagamento) },
    meta,
  };
}

/* ───────────────────────────── as definições ───────────────────────────── */

/** Dias que ainda podem virar "anotados": os que faltam + hoje, se hoje ainda não tem registro. */
const diasQueFaltam = (d: DadosDaSemana) => (d.semanaAcabou ? 0 : 7 - d.elapsedDays + (d.diasAnotados.has(d.hoje) ? 0 : 1));

/** Restrição com teto: até `limite` ocorrências na semana (0 = nenhuma). */
const comTeto = (
  ocorrencias: number,
  limite: number,
  d: DadosDaSemana,
  frases: { unidade: [string, string]; zero: string; passou: string; venceu: string },
): Avaliacao => {
  if (ocorrencias > limite) return { pct: 0, done: false, failed: true, statusText: frases.passou };
  const done = d.elapsedDays >= 7;
  const andamento = limite === 0 ? frases.zero : `${ocorrencias} de ${limite} ${frases.unidade[1]}`;
  return { pct: (d.elapsedDays / 7) * 100, done, failed: false, statusText: done ? frases.venceu : andamento };
};

const PASSOU_OUTRO = "Semana que vem tem outro.";

export const CATALOGO: DefDesafio[] = [
  {
    key: "sem-delivery", emoji: "🛵", tipo: "restricao", niveis: 1,
    titulo: () => "Semana sem delivery",
    desc: () => "Nenhum pedido no app até domingo. Cozinha, marmita, o que for.",
    elegivel: (d) => d.historico4.some(ehDelivery),
    avaliar: (_n, d) => comTeto(d.semana.filter(ehDelivery).length, 0, d, {
      unidade: ["delivery", "deliveries"], zero: "zero delivery até aqui", passou: `Rolou um delivery... ${PASSOU_OUTRO}`, venceu: "Semana limpa, zero delivery",
    }),
  },
  {
    key: "marmita", emoji: "🍱", tipo: "restricao", niveis: 3,
    titulo: (n) => ["Semana da marmita", "Marmita firme", "Marmita todo dia"][n - 1],
    desc: (n) => ["No máximo 2 almoços fora de segunda a sexta (restaurante ou delivery)", "No máximo 1 almoço fora de segunda a sexta", "Nenhum restaurante ou delivery de segunda a sexta"][n - 1],
    elegivel: (d) => d.historico4.filter((g) => ehComidaFora(g) && ehDiaUtil(g.date ?? "")).length >= 2,
    avaliar: (n, d) => {
      const limite = [2, 1, 0][n - 1];
      const fora = d.semana.filter((g) => ehComidaFora(g) && ehDiaUtil(g.date ?? "")).length;
      return comTeto(fora, limite, d, {
        unidade: ["almoço fora", "almoços fora"], zero: "zero almoço fora até aqui",
        passou: limite === 0 ? `Rolou um almoço fora... ${PASSOU_OUTRO}` : `Passou de ${limite} ${plural(limite, "almoço fora", "almoços fora")}. ${PASSOU_OUTRO}`,
        venceu: `Marmita venceu: ${fora} ${plural(fora, "almoço fora", "almoços fora")} na semana`,
      });
    },
  },
  {
    key: "sem-comprinha-online", emoji: "📦", tipo: "restricao", niveis: 2,
    titulo: (n) => (n === 1 ? "Semana sem comprinha online" : "Sem comprinha, sem impulso"),
    desc: (n) => (n === 1 ? "Nada de Shopee, Shein, Temu, Amazon ou Mercado Livre até domingo" : "Nada de loja online e nenhuma roupa ou eletrônico acima de R$ 80"),
    elegivel: (d) => d.historico8.some(ehLojaOnline) || (d.calendario.blackFriday && d.historico8.some((g) => g.category === "vestuario" || g.category === "eletronicos" || g.category === "beleza")),
    avaliar: (n, d) => {
      if (n === 2 && d.semana.some(ehGrandeImpulso)) return { pct: 0, done: false, failed: true, statusText: `Rolou uma compra grande por impulso. ${PASSOU_OUTRO}` };
      return comTeto(d.semana.filter(ehLojaOnline).length, 0, d, {
        unidade: ["comprinha", "comprinhas"], zero: "zero comprinha até aqui", passou: `Caiu uma comprinha... ${PASSOU_OUTRO}`, venceu: "Carrinho fechado a semana inteira",
      });
    },
  },
  {
    key: "uber-2x", emoji: "🚕", tipo: "restricao", niveis: 3,
    titulo: (n) => ["Uber só 2x", "Uber só 1x", "Semana do busão"][n - 1],
    desc: (n) => ["Corrida de app (Uber, 99) só duas vezes na semana toda", "Uma corrida de app e pronto", "Zero Uber e 99: a pé, bike ou transporte público"][n - 1],
    elegivel: (d) => d.historico4.filter(ehCorrida).length >= 3,
    avaliar: (n, d) => {
      const limite = [2, 1, 0][n - 1];
      const corridas = d.semana.filter(ehCorrida).length;
      return comTeto(corridas, limite, d, {
        unidade: ["corrida usada", "corridas usadas"], zero: "zero corrida até aqui",
        passou: limite === 0 ? `Rolou uma corrida de app... ${PASSOU_OUTRO}` : `Passou das ${limite} ${plural(limite, "corrida", "corridas")}. ${PASSOU_OUTRO}`,
        venceu: `Deu certo: ${corridas} ${plural(corridas, "corrida", "corridas")} na semana`,
      });
    },
  },
  {
    key: "sem-credito", emoji: "💳", tipo: "restricao", niveis: 1,
    titulo: () => "Semana sem cartão de crédito",
    desc: () => "Tudo no Pix, débito ou dinheiro até domingo — pra sentir o dinheiro saindo",
    elegivel: (d) => d.historico4.filter(ehCredito).length >= 3,
    avaliar: (_n, d) => comTeto(d.semana.filter(ehCredito).length, 0, d, {
      unidade: ["gasto no crédito", "gastos no crédito"], zero: "zero no crédito até aqui", passou: `Passou no crédito... ${PASSOU_OUTRO}`, venceu: "Semana inteira sem crédito",
    }),
  },
  {
    key: "gasto-formiga", emoji: "🐜", tipo: "restricao", niveis: 2,
    titulo: (n) => (n === 1 ? "Caça ao gasto formiga" : "Formiga sob controle"),
    desc: (n) => (n === 1 ? "No máximo 3 gastinhos abaixo de R$ 20 em comida (café, lanche, docinho)" : "No máximo 1 gastinho abaixo de R$ 20 em comida"),
    elegivel: (d) => d.historico4.filter(ehFormiga).length >= 4,
    avaliar: (n, d) => {
      const limite = n === 1 ? 3 : 1;
      const formigas = d.semana.filter(ehFormiga).length;
      return comTeto(formigas, limite, d, {
        unidade: ["gastinho", "gastinhos"], zero: "zero gastinho até aqui",
        passou: `Passou de ${limite} ${plural(limite, "gastinho", "gastinhos")}. ${PASSOU_OUTRO}`,
        venceu: `Formiga domada: ${formigas} ${plural(formigas, "gastinho", "gastinhos")} na semana`,
      });
    },
  },
  {
    key: "role-com-teto", emoji: "🎟️", tipo: "restricao", niveis: 1,
    titulo: (_n, d) => `Rolê com teto: ${reais(tetoDeLazer(d))}`,
    desc: (_n, d) => `Lazer e saídas até ${reais(tetoDeLazer(d))} até domingo (metade da semana passada)`,
    elegivel: (d) => soma(d.anterior.filter(ehLazer)) >= 40,
    avaliar: (_n, d) => {
      const teto = tetoDeLazer(d);
      const gasto = soma(d.semana.filter(ehLazer));
      if (gasto > teto) return { pct: 0, done: false, failed: true, statusText: `Passou do teto (${reais(teto)}). ${PASSOU_OUTRO}` };
      const done = d.elapsedDays >= 7;
      return { pct: (d.elapsedDays / 7) * 100, done, failed: false, statusText: done ? `Rolê dentro do teto: ${reais(gasto)} de ${reais(teto)}` : `${reais(gasto)} de ${reais(teto)}` };
    },
  },
  {
    key: "mercado-1x", emoji: "🛒", tipo: "restricao", niveis: 1,
    titulo: () => "Mercado uma vez só",
    desc: () => "Um dia de mercado na semana, com lista. Sem voltar lá 'só pra pegar uma coisinha'",
    elegivel: (d) => diasDistintos(d.historico4.filter(ehMercado)) >= 3,
    avaliar: (_n, d) => {
      const idas = diasDistintos(d.semana.filter(ehMercado));
      if (idas > 1) return { pct: 0, done: false, failed: true, statusText: `Segunda ida ao mercado... ${PASSOU_OUTRO}` };
      const done = d.elapsedDays >= 7;
      return { pct: (d.elapsedDays / 7) * 100, done, failed: false, statusText: done ? (idas ? "Uma ida só, com lista" : "Semana sem mercado") : idas ? "1 dia de mercado (o limite)" : "nenhuma ida ao mercado ainda" };
    },
  },
  {
    key: "tres-dias-zero", emoji: "🧘", tipo: "restricao", niveis: 2,
    titulo: (n) => (n === 1 ? "2 dias sem gastar" : "3 dias sem gastar"),
    desc: (n) => (n === 1 ? "Dois dias da semana com zero gasto variável — marque 'não gastei nada hoje' na Home" : "Três dias da semana com zero gasto variável"),
    elegivel: () => true,
    avaliar: (n, d) => {
      const alvo = n === 1 ? 2 : 3;
      const comGasto = new Set(d.semana.map((g) => g.date ?? ""));
      // dia passado sem gasto = zerado; hoje só conta zerado se a pessoa marcou "não gastei nada"
      const zerados = d.dias.filter((dia) => (d.semanaAcabou || dia < d.hoje) ? !comGasto.has(dia) : dia === d.hoje && d.semGasto.has(dia) && !comGasto.has(dia)).length;
      const restantes = d.semanaAcabou ? 0 : d.dias.filter((dia) => dia > d.hoje).length + (d.semGasto.has(d.hoje) || comGasto.has(d.hoje) ? 0 : 1);
      const done = zerados >= alvo;
      const failed = !done && zerados + restantes < alvo;
      return {
        pct: Math.min((zerados / alvo) * 100, 100), done, failed,
        ...(failed ? { motivo: "nao-cumpriu" as const } : {}),
        statusText: done ? `${alvo} dias sem gastar. Monge 🧘` : failed ? "Não fecha mais essa semana — próxima tem." : `${zerados} de ${alvo} dias zerados`,
      };
    },
  },
  {
    key: "menos-que-passada", emoji: "📉", tipo: "restricao", niveis: 1,
    titulo: () => "Gastar menos que semana passada",
    desc: (_n, d) => `Fechar a semana abaixo de ${reais(soma(d.anterior))} (o total da semana passada)`,
    elegivel: (d) => soma(d.anterior) > 0 && diasDistintos(d.anterior) >= 3,
    avaliar: (_n, d) => {
      const teto = soma(d.anterior);
      const atual = soma(d.semana);
      if (teto <= 0) return { pct: 0, done: false, failed: true, statusText: "Sem semana anterior pra comparar." };
      if (atual >= teto) return { pct: 100, done: false, failed: true, statusText: `Passou do teto (${reais(teto)}). ${PASSOU_OUTRO}` };
      const done = d.elapsedDays >= 7;
      return { pct: Math.min((atual / teto) * 100, 100), done, failed: false, statusText: done ? `Fechou abaixo: ${reais(atual)} de ${reais(teto)}` : `${reais(atual)} de ${reais(teto)}` };
    },
  },
  {
    key: "registro-5-dias", emoji: "✍️", tipo: "acao", niveis: 2,
    titulo: (n) => (n === 1 ? "Anotar em 5 dias" : "Anotar os 7 dias"),
    desc: (n) => (n === 1 ? "Pelo menos 1 gasto (ou 'não gastei nada') em 5 dias diferentes" : "Todo dia da semana com pelo menos 1 registro"),
    elegivel: () => true,
    avaliar: (n, d) => {
      const alvo = n === 1 ? 5 : 7;
      const anotados = d.diasAnotados.size;
      const done = anotados >= alvo;
      const failed = !done && anotados + diasQueFaltam(d) < alvo;
      return {
        pct: Math.min((anotados / alvo) * 100, 100), done, failed,
        statusText: done ? `${alvo} dias anotados. Disciplina real ✍️` : failed ? "Essa semana não fecha mais — bora na próxima." : `${anotados} de ${alvo} dias anotados`,
      };
    },
  },
  {
    key: "sem-outros", emoji: "🗂️", tipo: "acao", niveis: 1,
    titulo: () => "Nada em 'Outros'",
    desc: () => "5 ou mais gastos na semana, cada um na categoria certa (nenhum em Outros)",
    elegivel: (d) => d.historico4.some(semCategoria) || d.historico8.length < 5,
    avaliar: (_n, d) => {
      const total = d.semana.length;
      const emOutros = d.semana.filter(semCategoria).length;
      const done = total >= 5 && emOutros === 0;
      return {
        pct: Math.min((total / 5) * 100, 100) * (emOutros ? 0.5 : 1), done, failed: false,
        statusText: done ? `${total} gastos, todos na categoria certa 🗂️` : `${total} de 5 gastos · ${emOutros ? `${emOutros} em Outros (ajusta a categoria)` : "nenhum em Outros"}`,
      };
    },
  },
  {
    key: "contas-em-dia", emoji: "✅", tipo: "acao", niveis: 1,
    titulo: () => "Contas da semana em dia",
    desc: (_n, d) => `Marcar como paga toda conta que vence até domingo (${d.contas.length} ${plural(d.contas.length, "conta", "contas")})`,
    elegivel: (d) => d.contas.length >= 1,
    avaliar: (_n, d) => {
      const total = d.contas.length;
      if (!total) return { pct: 0, done: false, failed: true, statusText: "Sem conta vencendo nesta semana." };
      const pagas = d.contas.filter((c) => c.paid).length;
      const done = pagas === total;
      return { pct: (pagas / total) * 100, done, failed: false, statusText: done ? `Todas as ${total} ${plural(total, "conta", "contas")} da semana pagas ✅` : `${pagas} de ${total} ${plural(total, "conta paga", "contas pagas")}` };
    },
  },
  {
    key: "guarda-da-semana", emoji: "🐷", tipo: "acao", niveis: 2,
    titulo: (n, d) => `Guarda ${reais(semanaDoAno(d.weekStart) * n)}${n === 1 ? ` (semana ${semanaDoAno(d.weekStart)})` : ""}`,
    desc: (n) => (n === 1 ? "O desafio das 52 semanas: põe na Reserva e atualiza o valor guardado em Meu Financeiro" : "Dobro da semana: R$ 2 por semana do ano, direto na Reserva"),
    elegivel: (d) => d.reserva.registrada || d.reserva.guardado > 0 || d.receitasRecentes >= 1,
    retrato: (d) => ({ base: d.reserva.guardado }),
    avaliar: (n, d) => {
      const alvo = semanaDoAno(d.weekStart) * n;
      const base = num(d.meta.base);
      const delta = Math.max(0, d.reserva.guardado - base);
      const done = delta >= alvo;
      return { pct: Math.min((delta / alvo) * 100, 100), done, failed: false, statusText: done ? `${reais(alvo)} guardados. Semana ${semanaDoAno(d.weekStart)} no bolso 🐷` : `${reais(delta)} de ${reais(alvo)} guardados` };
    },
  },
  {
    key: "faxina-assinaturas", emoji: "🧹", tipo: "acao", niveis: 1,
    titulo: () => "Faxina de assinaturas",
    desc: (_n, d) => {
      const as = d.fixos.filter(ehAssinatura);
      return `Revisar suas ${as.length} assinaturas (${reais(as.reduce((s, f) => s + num(f.value), 0))}/mês): cancela o que não usa ou confirma que todas valem`;
    },
    elegivel: (d) => d.fixos.filter(ehAssinatura).length >= 2,
    retrato: (d) => {
      const as = d.fixos.filter(ehAssinatura);
      return { ids: as.map((f) => String(f.id ?? "")), total: as.reduce((s, f) => s + num(f.value), 0) };
    },
    confirmacao: { botao: "Revisei, todas valem", chave: "revisado" },
    avaliar: (_n, d) => {
      const atuais = d.fixos.filter(ehAssinatura);
      const ids = Array.isArray(d.meta.ids) ? (d.meta.ids as unknown[]).map(String) : null;
      const total = atuais.reduce((s, f) => s + num(f.value), 0);
      const aMenos = ids ? ids.filter((id) => !atuais.some((f) => String(f.id ?? "") === id)).length : 0;
      const mudou = aMenos > 0 || (typeof d.meta.total === "number" && total < d.meta.total);
      const confirmou = !!d.meta.revisado;
      const done = mudou || confirmou;
      return {
        pct: done ? 100 : 30, done, failed: false,
        statusText: done ? (mudou ? `Faxina feita: ${aMenos || 1} ${plural(aMenos || 1, "assinatura a menos", "assinaturas a menos")} 🧹` : "Revisadas: todas valem ✓") : `${atuais.length} assinaturas · ${reais(total)}/mês · revisa e confirma`,
      };
    },
  },
];

export const defDoCatalogo = (key: string): DefDesafio | null => CATALOGO.find((c) => c.key === key) ?? null;

/* ───────────────────────────── a trava de registro ───────────────────────────── */

/** Dias anotados (gasto ou "não gastei nada hoje") que um desafio de RESTRIÇÃO exige pra valer. */
export const MIN_DIAS_ANOTADOS = 4;

/**
 * Avalia o desafio no catálogo novo. Pra `restricao`, a regra do desafio só fecha com
 * a trava de registro: a linha de progresso mostra os dois contadores e perder por
 * falta de registro é "faltou anotar" (`sem-registro`), tratado como revanche no rodízio.
 * Semana acabada sem vencer = `nao-cumpriu`.
 */
export function avaliarNoCatalogo(def: DefDesafio, nivel: number, d: DadosDaSemana): Avaliacao {
  const n = Math.min(Math.max(1, nivel), def.niveis);
  const bruto = def.avaliar(n, d);
  if (def.tipo === "acao") {
    if (bruto.done) return { ...bruto, motivo: "cumpriu" };
    if (bruto.failed) return { ...bruto, motivo: "nao-cumpriu" };
    if (d.semanaAcabou) return { ...bruto, failed: true, motivo: "nao-cumpriu", statusText: "Não deu essa semana — a próxima tem." };
    return bruto;
  }
  const anotados = d.diasAnotados.size;
  const registroOk = anotados >= MIN_DIAS_ANOTADOS;
  const registroImpossivel = anotados + diasQueFaltam(d) < MIN_DIAS_ANOTADOS;
  const linhaRegistro = `${anotados} de ${MIN_DIAS_ANOTADOS} dias anotados`;
  if (bruto.failed) return { ...bruto, motivo: bruto.motivo ?? "regra" };
  if (registroImpossivel) {
    return { pct: (anotados / MIN_DIAS_ANOTADOS) * 100, done: false, failed: true, motivo: "sem-registro", statusText: `Faltou anotar: sem ${MIN_DIAS_ANOTADOS} dias anotados o desafio não fecha. Na próxima vale de novo.` };
  }
  if (bruto.done && registroOk) return { pct: 100, done: true, failed: false, motivo: "cumpriu", statusText: `${bruto.statusText} · ${anotados} dias anotados 👑` };
  if (d.semanaAcabou) return { pct: bruto.pct, done: false, failed: true, motivo: "nao-cumpriu", statusText: "Não deu essa semana — a próxima tem." };
  // regra cumprida até aqui (domingo), só falta o registro de hoje
  const andamento = bruto.done ? "regra cumprida, anota hoje e fecha 👊" : bruto.statusText;
  return { pct: Math.min(bruto.pct, registroOk ? 100 : (anotados / MIN_DIAS_ANOTADOS) * 100), done: false, failed: false, statusText: `${linhaRegistro} · ${andamento}` };
}

/** O que a pessoa precisa ler ao escolher: a trava, em uma linha. */
export const NOTA_DA_TRAVA = `Desafio de "não gastar" só vale com ${MIN_DIAS_ANOTADOS}+ dias anotados — anotar é o jogo.`;
