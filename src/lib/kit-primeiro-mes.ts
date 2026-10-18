/**
 * KIT PRIMEIRO MÊS ORGANIZADO (18/10/2026) — o order bump de R$ 9,90 do funil
 * web novo. Entrega dentro do CORE, no dia da compra, três coisas:
 *   1. o PLANO DE 30 DIAS: uma tarefa curta por dia (2–5 min) que leva a pessoa
 *      a usar Finanças de verdade (cada tarefa abre o lugar certo);
 *   2. a PLANILHA DE DÍVIDAS: valor, juros, parcela e a ordem sugerida pra
 *      quitar (bola de neve), exportável em CSV;
 *   3. os DESAFIOS DAS 4 SEMANAS já escolhidos no "Desafio da semana".
 *
 * LIBERAÇÃO: só pra conta com `core-kit-primeiro-mes` = { comprado: true, em }
 * (gravada pelo funil, chave da CONTA em user_data). Sem ela, nada aparece —
 * nem cadeado, nem anúncio.
 *
 * Chaves que o kit grava (todas da conta, sincronizadas):
 *   · `core-kit-primeiro-mes-feitos` — { inicio, feitos: { [dia]: "AAAA-MM-DD" },
 *     desafios: ["<segunda>", …] } — o check do plano é gravação de SISTEMA
 *     (não conta como anotação na sequência nem como ativação);
 *   · `kit-dividas` — a lista da planilha (de propósito fora de `finance-*`:
 *     não entra na virada do mês nem dispara "1º lançamento" de Finanças).
 */
import { localDayKey } from "@/lib/utils";
import { mondayOf, type ChallengesState } from "@/components/challenges/challenges";

export const CHAVE_KIT = "core-kit-primeiro-mes";
export const CHAVE_KIT_PROGRESSO = "core-kit-primeiro-mes-feitos";
export const CHAVE_KIT_DIVIDAS = "kit-dividas";
export const DIAS_DO_KIT = 30;

export interface KitCompra { comprado: true; em?: string }

/** A conta comprou o kit? Tolerante: só `comprado === true` libera. */
export const kitLiberado = (v: unknown): v is KitCompra =>
  !!v && typeof v === "object" && (v as { comprado?: unknown }).comprado === true;

/* ───────────────────────────── o plano ───────────────────────────── */

/** Aba de Finanças + (opcional) o elemento pra rolar até ele. */
export interface DestinoDoKit { aba: string; alvo?: string; rotulo: string }
export interface TarefaDoKit { dia: number; titulo: string; como: string; destino: DestinoDoKit }

const FIXOS: DestinoDoKit = { aba: "financeiro", alvo: '[data-spotlight="add-fixed"]', rotulo: "Abrir contas fixas" };
const GASTOS: DestinoDoKit = { aba: "financeiro", alvo: '[data-spotlight="add-expense"]', rotulo: "Anotar gastos" };
const RENDA: DestinoDoKit = { aba: "financeiro", alvo: '[data-spotlight="add-income"]', rotulo: "Abrir receitas" };
const MEU_MES: DestinoDoKit = { aba: "financeiro", alvo: '[data-spotlight="add-bill"]', rotulo: "Abrir o Meu Mês" };
const NOTAS: DestinoDoKit = { aba: "financeiro", alvo: '[data-spotlight="add-note"]', rotulo: "Abrir anotações" };
const RESERVA: DestinoDoKit = { aba: "financeiro", alvo: "#reserva-emergencia", rotulo: "Abrir a reserva" };
const PARCELAS: DestinoDoKit = { aba: "financeiro", alvo: "#parcelamentos", rotulo: "Abrir parcelamentos" };
const PAINEL: DestinoDoKit = { aba: "dashboard", rotulo: "Abrir o Painel" };
const LIMITES: DestinoDoKit = { aba: "limites", rotulo: "Abrir limites" };
const DESEJOS: DestinoDoKit = { aba: "itens", alvo: '[data-spotlight="add-wish"]', rotulo: "Abrir desejos" };
const SAUDE: DestinoDoKit = { aba: "saude", rotulo: "Abrir saúde financeira" };
const RELATORIOS: DestinoDoKit = { aba: "relatorios", rotulo: "Abrir relatórios" };
const DIVIDAS: DestinoDoKit = { aba: "kit", alvo: "#kit-dividas", rotulo: "Abrir a planilha" };

export const SEMANAS_DO_KIT = [
  { semana: 1, titulo: "Enxergar o mês", dias: [1, 7] },
  { semana: 2, titulo: "Achar os vazamentos", dias: [8, 14] },
  { semana: 3, titulo: "Começar a reserva", dias: [15, 21] },
  { semana: 4, titulo: "Planejar o próximo mês", dias: [22, 30] },
] as const;

export const PLANO_30_DIAS: TarefaDoKit[] = [
  // Semana 1 — enxergar o mês
  { dia: 1, titulo: "Liste as contas do mês", como: "Aluguel, luz, água, internet, celular. Nome, valor e dia que vence.", destino: FIXOS },
  { dia: 2, titulo: "Anote os gastos de ontem", como: "Puxe pela memória ou pelo extrato. Até o café e o pão contam.", destino: GASTOS },
  { dia: 3, titulo: "Defina o seu \"pode gastar por dia\"", como: "Coloque o que entra no mês. O Painel mostra quanto dá pra gastar por dia.", destino: RENDA },
  { dia: 4, titulo: "Marque os vencimentos no Meu Mês", como: "Toque no dia de cada conta. O CORE avisa antes de vencer.", destino: MEU_MES },
  { dia: 5, titulo: "Anote os gastos de hoje", como: "Antes de dormir, 1 minuto: tudo o que saiu hoje.", destino: GASTOS },
  { dia: 6, titulo: "Veja pra onde foi o dinheiro", como: "No Painel, olhe a categoria que mais pesou nesta semana.", destino: PAINEL },
  { dia: 7, titulo: "Revisão da semana", como: "Faltou alguma conta ou assinatura? Coloque agora.", destino: FIXOS },
  // Semana 2 — achar os vazamentos
  { dia: 8, titulo: "Liste as assinaturas", como: "Streaming, apps, academia, nuvem. Cada uma como conta fixa.", destino: FIXOS },
  { dia: 9, titulo: "Anote os gastos de ontem", como: "Repare em quais foram por impulso.", destino: GASTOS },
  { dia: 10, titulo: "Escolha 1 vazamento pra cortar", como: "Uma assinatura parada, o delivery, a taxa do banco. Só um. Anote qual.", destino: NOTAS },
  { dia: 11, titulo: "Ponha um limite na categoria que mais pesou", como: "Um teto pro mês. Não precisa ser apertado — precisa existir.", destino: LIMITES },
  { dia: 12, titulo: "Liste suas dívidas", como: "Na planilha do kit: quanto falta, juros e parcela de cada uma.", destino: DIVIDAS },
  { dia: 13, titulo: "Veja a ordem pra quitar", como: "A planilha sugere por onde começar. Escolha a primeira.", destino: DIVIDAS },
  { dia: 14, titulo: "Revisão da semana", como: "Compare com a semana passada no Painel.", destino: PAINEL },
  // Semana 3 — começar a reserva
  { dia: 15, titulo: "Decida o tamanho da reserva", como: "Comece pequeno: 1 mês das suas contas já é um bom primeiro alvo.", destino: RESERVA },
  { dia: 16, titulo: "Registre o que você já tem guardado", como: "Mesmo que seja R$ 0. É o ponto de partida.", destino: RESERVA },
  { dia: 17, titulo: "Escolha um valor pra guardar por semana", como: "R$ 10 já conta. Anote o valor pra lembrar.", destino: NOTAS },
  { dia: 18, titulo: "Anote os gastos de ontem", como: "Já virou hábito? Leva 1 minuto.", destino: GASTOS },
  { dia: 19, titulo: "Ponha nos Desejos aquela compra adiada", como: "O CORE mostra se cabe no mês. Esperar também é decidir.", destino: DESEJOS },
  { dia: 20, titulo: "Guarde o valor da semana", como: "Separe o dinheiro e atualize a reserva.", destino: RESERVA },
  { dia: 21, titulo: "Revisão da semana", como: "No Painel: quanto do mês já foi e quanto sobra por dia.", destino: PAINEL },
  // Semana 4 — planejar o próximo mês
  { dia: 22, titulo: "Veja as parcelas do mês que vem", como: "O que ainda vai cair no cartão e nos carnês.", destino: PARCELAS },
  { dia: 23, titulo: "Estime as contas que mudam", como: "Luz, água, gás: confira o valor das contas fixas pro mês que vem.", destino: FIXOS },
  { dia: 24, titulo: "Anote os gastos de ontem", como: "Faltam poucos dias pro mês fechar.", destino: GASTOS },
  { dia: 25, titulo: "Monte os limites do mês que vem", como: "Use o que você viu neste mês pra ajustar cada teto.", destino: LIMITES },
  { dia: 26, titulo: "Marque as datas especiais", como: "Aniversário, IPVA, matrícula, presente. Coloque no Meu Mês.", destino: MEU_MES },
  { dia: 27, titulo: "Olhe a sua saúde financeira", como: "Veja qual ponto mais pesa hoje.", destino: SAUDE },
  { dia: 28, titulo: "Se der, adiante um pouco da 1ª dívida", como: "Qualquer valor a mais na primeira da lista. Se não der, tudo bem.", destino: DIVIDAS },
  { dia: 29, titulo: "Revisão do mês", como: "Nos Relatórios, veja o total de cada categoria.", destino: RELATORIOS },
  { dia: 30, titulo: "Feche o mês com 2 linhas", como: "Escreva 1 coisa que funcionou e 1 que vai mudar no próximo mês.", destino: NOTAS },
];

/* ───────────────────────────── progresso ───────────────────────────── */

export interface ProgressoDoKit {
  /** Dia 1 do plano, "AAAA-MM-DD" (o dia da compra). */
  inicio: string;
  /** Dia do plano → dia em que foi marcado. */
  feitos: Record<string, string>;
  /** Segundas em que o kit já pôs (ou respeitou) o desafio da semana. */
  desafios: string[];
}

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dia local da compra; sem data válida, hoje. */
export const inicioDaCompra = (kit: KitCompra | null | undefined, hoje: Date = new Date()): string => {
  const t = kit?.em ? new Date(kit.em) : null;
  return t && !Number.isNaN(t.getTime()) ? localDayKey(t) : localDayKey(hoje);
};

export const lerProgresso = (v: unknown, inicioPadrao: string): ProgressoDoKit => {
  const o = v && typeof v === "object" ? (v as Partial<ProgressoDoKit>) : {};
  const inicio = typeof o.inicio === "string" && DIA_RE.test(o.inicio) ? o.inicio : inicioPadrao;
  const feitos: Record<string, string> = {};
  if (o.feitos && typeof o.feitos === "object") {
    for (const [k, d] of Object.entries(o.feitos)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= DIAS_DO_KIT && typeof d === "string") feitos[String(n)] = d;
    }
  }
  const desafios = Array.isArray(o.desafios) ? o.desafios.filter((s): s is string => typeof s === "string" && DIA_RE.test(s)) : [];
  return { inicio, feitos, desafios };
};

const meioDia = (dia: string) => new Date(`${dia}T12:00:00`);
const diasEntre = (de: string, ate: string) => Math.round((meioDia(ate).getTime() - meioDia(de).getTime()) / 86400000);

/** Dia do plano hoje: 1 no dia da compra; pode passar de 30 (plano concluído). */
export const diaDoPlano = (inicio: string, hoje: Date = new Date()): number =>
  Math.max(1, diasEntre(inicio, localDayKey(hoje)) + 1);

export const marcarFeito = (p: ProgressoDoKit, dia: number, feito: boolean, hoje: Date = new Date()): ProgressoDoKit => {
  const feitos = { ...p.feitos };
  if (feito) feitos[String(dia)] = localDayKey(hoje);
  else delete feitos[String(dia)];
  return { ...p, feitos };
};

/** A tarefa que o destaque mostra: a de hoje (ou a 30ª depois do fim). */
export const tarefaDeHoje = (inicio: string, hoje: Date = new Date()): TarefaDoKit =>
  PLANO_30_DIAS[Math.min(diaDoPlano(inicio, hoje), DIAS_DO_KIT) - 1];

/* ───────────────────────────── desafios das 4 semanas ───────────────────────────── */

/** Uma semana de cada tipo, na ordem do plano (chaves de components/challenges). */
export const DESAFIOS_DO_KIT = [
  { semana: 1, key: "registro-5-dias", porque: "Primeira semana: o hábito de anotar." },
  { semana: 2, key: "sem-delivery", porque: "O vazamento mais comum, cortado por 7 dias." },
  { semana: 3, key: "tres-dias-zero", porque: "Dias sem gastar viram dinheiro pra reserva." },
  { semana: 4, key: "menos-que-passada", porque: "Fechar o mês gastando menos que na semana anterior." },
] as const;

/**
 * Segunda-feira da semana 1 dos desafios. Comprou de segunda ou terça → esta
 * semana (dá pra cumprir os 5 dias de registro); de quarta em diante → a
 * próxima segunda (começar no meio da semana já nasceria perdido).
 */
export const segundaDoDesafio1 = (inicio: string): string => {
  const d = meioDia(inicio);
  const dow = (d.getDay() + 6) % 7; // seg=0
  const seg = mondayOf(d);
  if (dow <= 1) return seg;
  const prox = meioDia(seg);
  prox.setDate(prox.getDate() + 7);
  return localDayKey(prox);
};

/** As 4 semanas com a segunda de cada uma. */
export const agendaDosDesafios = (inicio: string) => {
  const s1 = segundaDoDesafio1(inicio);
  return DESAFIOS_DO_KIT.map((d, i) => {
    const seg = meioDia(s1);
    seg.setDate(seg.getDate() + 7 * i);
    return { ...d, weekStart: localDayKey(seg) };
  });
};

/**
 * O que fazer com o desafio desta semana pra quem tem o kit:
 *   · fora das 4 semanas, ou esta segunda já foi tratada → nada (`null`);
 *   · a pessoa já escolheu um desafio nesta semana → respeita e só marca;
 *   · senão → põe o desafio do kit como ativo e marca.
 * A semana antiga tem que estar FECHADA antes (fecharSemanaDoDesafio) —
 * com um ativo de semana passada, não mexe.
 */
export const desafioDoKitParaAplicar = (
  estado: ChallengesState,
  progresso: ProgressoDoKit,
  hoje: Date = new Date(),
): { estado: ChallengesState | null; progresso: ProgressoDoKit } | null => {
  const seg = mondayOf(hoje);
  const semana = agendaDosDesafios(progresso.inicio).find((s) => s.weekStart === seg);
  if (!semana || progresso.desafios.includes(seg)) return null;
  if (estado.active && estado.active.weekStart < seg) return null; // a semana passada ainda não fechou
  const marcado = { ...progresso, desafios: [...progresso.desafios, seg] };
  if (estado.active && estado.active.weekStart === seg) return { estado: null, progresso: marcado };
  if (estado.history.some((h) => h.weekStart === seg)) return { estado: null, progresso: marcado };
  return { estado: { ...estado, active: { key: semana.key, weekStart: seg } }, progresso: marcado };
};

/* ───────────────────────────── planilha de dívidas ───────────────────────────── */

export interface Divida {
  id: string;
  nome: string;
  /** Quanto falta pagar hoje (R$). */
  saldo: number;
  /** Juros ao mês (%). 0 = sem juros (parcelado sem juros, empréstimo de alguém). */
  juros: number;
  /** Parcela (ou pagamento mínimo) por mês (R$). */
  parcela: number;
}

export const lerDividas = (v: unknown): Divida[] =>
  (Array.isArray(v) ? v : [])
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d, i) => ({
      id: typeof d.id === "string" ? d.id : `d${i}`,
      nome: String(d.nome ?? "").slice(0, 80) || "Dívida",
      saldo: Math.max(0, Number(d.saldo) || 0),
      juros: Math.max(0, Number(d.juros) || 0),
      parcela: Math.max(0, Number(d.parcela) || 0),
    }));

/** Bola de neve: a de MENOR saldo primeiro; empate → a de juros maior. Quitadas (saldo 0) vão pro fim. */
export const ordemBolaDeNeve = (dividas: Divida[]): Divida[] =>
  [...dividas].sort((a, b) => {
    if ((a.saldo <= 0) !== (b.saldo <= 0)) return a.saldo <= 0 ? 1 : -1;
    return a.saldo - b.saldo || b.juros - a.juros;
  });

/** Juros que a dívida gera em 1 mês com o saldo de hoje. */
export const jurosDoMes = (d: Divida) => (d.saldo * d.juros) / 100;

/** Juros ao mês a partir do qual a planilha avisa (cartão, cheque especial). */
export const JUROS_ALTOS = 8;

/**
 * Simulação da bola de neve com os números da pessoa: todo mês cada dívida
 * rende juros e recebe a parcela; quando uma acaba, a parcela dela soma na
 * próxima da ordem. Devolve em quantos meses cada uma termina (`null` = não
 * termina em 30 anos com essas parcelas — a parcela não cobre os juros).
 */
export const simularBolaDeNeve = (dividas: Divida[]): Record<string, number | null> => {
  const ordem = ordemBolaDeNeve(dividas).filter((d) => d.saldo > 0);
  const saldo = new Map(ordem.map((d) => [d.id, d.saldo]));
  const fim: Record<string, number | null> = {};
  for (const d of dividas) if (d.saldo <= 0) fim[d.id] = 0;
  for (let mes = 1; mes <= 360 && saldo.size > 0; mes++) {
    let sobra = 0;
    for (const d of ordem) {
      if (!saldo.has(d.id)) { sobra += d.parcela; continue; }
      const s = saldo.get(d.id)! * (1 + d.juros / 100);
      const pago = Math.min(s, d.parcela);
      sobra += d.parcela - pago;
      saldo.set(d.id, s - pago);
    }
    // a parcela livre (de quem já acabou + troco) vai pra primeira em aberto da ordem
    for (const d of ordem) {
      if (sobra <= 0.004) break;
      const s = saldo.get(d.id);
      if (s === undefined || s <= 0.004) continue;
      const extra = Math.min(s, sobra);
      saldo.set(d.id, s - extra);
      sobra -= extra;
    }
    for (const d of ordem) {
      const s = saldo.get(d.id);
      if (s !== undefined && s <= 0.005) { saldo.delete(d.id); fim[d.id] = mes; }
    }
  }
  for (const d of ordem) if (!(d.id in fim)) fim[d.id] = null;
  return fim;
};

export const rotuloMeses = (m: number | null): string => {
  if (m === null) return "não fecha com essa parcela";
  if (m === 0) return "quitada";
  if (m < 12) return `~${m} ${m === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(m / 12), resto = m % 12;
  return `~${anos} ${anos === 1 ? "ano" : "anos"}${resto ? ` e ${resto} ${resto === 1 ? "mês" : "meses"}` : ""}`;
};

/** CSV que abre certo no Excel em português (BOM, ponto e vírgula, decimal com vírgula). */
export const dividasEmCSV = (dividas: Divida[]): string => {
  const txt = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const num = (v: number) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).replace(".", ",");
  const ordem = ordemBolaDeNeve(dividas);
  const fim = simularBolaDeNeve(dividas);
  const linhas = [
    "PLANILHA DE DÍVIDAS — CORE (Kit Primeiro Mês Organizado)",
    "Ordem sugerida: bola de neve — quite a menor primeiro; quando ela acabar, a parcela dela vai pra próxima.",
    "",
    "Ordem;Dívida;Quanto falta (R$);Juros ao mês (%);Parcela por mês (R$);Juros deste mês (R$);Previsão (estimativa)",
    ...ordem.map((d, i) =>
      [i + 1, txt(d.nome), num(d.saldo), num(d.juros), num(d.parcela), num(jurosDoMes(d)), txt(rotuloMeses(fim[d.id] ?? null))].join(";"),
    ),
    ["TOTAL", "", num(ordem.reduce((s, d) => s + d.saldo, 0)), "", num(ordem.reduce((s, d) => s + d.parcela, 0)), num(ordem.reduce((s, d) => s + jurosDoMes(d), 0)), ""].join(";"),
    "",
    "A previsão usa os números acima e supõe que os juros e as parcelas não mudam.",
  ];
  return "﻿" + linhas.join("\r\n") + "\r\n";
};
