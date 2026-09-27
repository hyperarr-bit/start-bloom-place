import { getMonthKey, readMonthData } from "@/components/finance/storage-keys";
import { doPerfil, perfilAtivoLocal } from "@/lib/finance-perfil";
import { computeMonthlyOutflow, computeSavingsRate } from "@/lib/finance-totals";
import {
  chaveArquivadaDeParcelas, mesesAnteriores, mesesEntre, projetarParcelas, somaParcelasDoMes,
  valorDaParcelaNoMes, viradaDeParcelas, type Parcela,
} from "@/lib/finance-parcelas";
import {
  CARIMBOS, mesCarimbado, metaPadrao, semanasNaMeta, type GrupoDoCarimbo, type MetaDaSessao,
} from "@/lib/treino-constancia";
import { recordesDoMes } from "@/lib/treino-evolucao";
import type { EntradaDoHistorico } from "@/lib/treino-series";
import { localDayKey } from "@/lib/utils";

/**
 * Retrospectiva do mês — a camada de DADOS (27/07).
 *
 * Até aqui a retrospectiva só sabia falar de dinheiro. Isso a tornava
 * invisível pra metade da base: quem usa o CORE pra hábito, leitura e treino
 * abria e não via nada. Como agora existe uma NOTIFICAÇÃO mensal chamando a
 * pessoa pra cá, mandar alguém pra uma tela vazia seria pior do que não
 * mandar. Então a retrospectiva passa a ler a vida inteira, e as finanças
 * viram um bloco entre outros.
 *
 * (26/09) LEITURA PELO STORE: tudo passa por um `Leitor` (na tela, o `get` do
 * useUserData). Ler o localStorage direto perdia as chaves de 50KB+
 * (diário, acervo), que a hidratação guarda só na memória — em aparelho novo
 * a retrospectiva saía sem livros e sem diário. Sem leitor, cai no
 * localStorage do usuário (compatível com quem chamava antes).
 *
 * (26/09) Toda a parte PURA mora aqui, inclusive o bloco de finanças
 * (`buildWrappedData`, antes no componente): o componente só desenha.
 *
 * (26/09, redesenho aprovado) As páginas do planner — MEU MÊS, DINHEIRO,
 * CORPO, COMO VOCÊ ESTAVA e o CARD — saem daqui prontas (`meuMes`, `corpo`,
 * `sentir`, `conteudoDoCard`). Cada página só existe com dado real.
 */

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Lê uma chave lógica; `undefined`/`null` = ausente. */
export type Leitor = (chave: string) => unknown;

/** Leitor do aparelho (localStorage do usuário; seeds na demo). */
export const leitorLocal = (userId: string | null): Leitor => (chave) => readMonthData(userId, chave);

/* ------------------------------------------------------------- utilidades */

/** Um lançamento de Finanças como os módulos gravam (receita, gasto, fixo). */
interface Item {
  id?: string;
  date?: string;
  value?: number | string;
  category?: string;
  description?: string;
  paymentMethod?: string;
  perfil?: string;
  [campo: string]: unknown;
}
const lista = <T = Item,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const objeto = <T,>(v: unknown): Record<string, T> =>
  (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {});
const idDoMes = (ano: number, mesIdx: number) => `${ano}-${String(mesIdx + 1).padStart(2, "0")}`;
const naFaixa = (chave: string, ano: number, mesIdx: number) =>
  typeof chave === "string" && chave.startsWith(`${idDoMes(ano, mesIdx)}-`);
const diaDe = (chave: string) => Number(chave.slice(8, 10));
const nivel = (v: unknown) => (typeof v === "number" ? v : v === true ? 1 : 0);
const soma = (itens: Item[]) => itens.reduce((s, i) => s + (Number(i?.value) || 0), 0);
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const mesAntesDe = (ano: number, mesIdx: number) => ({ ano: mesIdx === 0 ? ano - 1 : ano, mesIdx: (mesIdx + 11) % 12 });

/** "R$ 1.575" — valor redondo, sem centavos (retrospectiva é de olhada). */
export const reais = (v: number) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;

/* ------------------------------------------------------------ o mês e a base */

/**
 * A BASE dos percentuais (26/09): os dias desde o 1º registro com data NO
 * mês até o fim dele (no mês corrente, até hoje). Quem começou no dia 20 e
 * marcou 9 dias via "30% dos dias do mês" — era o calendário, não ela.
 */
export const baseDoMes = (ano: number, mesIdx: number, primeiroDia: number | null, agora = new Date()) => {
  const diasDoMes = new Date(ano, mesIdx + 1, 0).getDate();
  const noMesAtual = agora.getFullYear() === ano && agora.getMonth() === mesIdx;
  const ultimoDia = noMesAtual ? agora.getDate() : diasDoMes;
  const inicio = Math.min(Math.max(1, primeiroDia ?? 1), ultimoDia);
  return { primeiroDia: inicio, ultimoDia, diasDoMes, dias: ultimoDia - inicio + 1 };
};
export type BaseDoMes = ReturnType<typeof baseDoMes>;

/* ------------------------------------------------------------- vida: dados */

type Livro = { title?: string; author?: string; status?: string; pages?: number; endDate?: string };
type Entrada = { gratitude?: string[]; learned?: string; tomorrow?: string };
type DiaDoPlano = { muscles?: string[]; exercises?: { name?: string; tipo?: string }[] };

/** O que a retrospectiva lê do Treino (planner de 26/09). */
export interface DadosDoTreino {
  /** `treino-sessoes`: dia do plano, minutos e músculos de cada data */
  sessoes: Record<string, MetaDaSessao | undefined>;
  /** `treino-exercise-history` */
  historico: Partial<EntradaDoHistorico>[];
  /** `saude-workouts-v2`, com o `muscle` antigo virando `muscles` */
  plano: Record<string, DiaDoPlano | undefined>;
  /** `treino-meta-semanal` (null = a pessoa nunca mudou) */
  meta: number | null;
  /** `treino-active-days` (null = nunca configurou) */
  diasAtivos: string[] | null;
}

/**
 * Snapshot dos módulos de vida, lido UMA vez.
 *
 * Sem isto, a tela que lista 12 meses reparsearia `journal-entries` (que
 * passa fácil de 50KB) doze vezes seguidas na montagem — jank puro por um
 * dado que não muda entre um mês e outro. As chaves aqui são globais e
 * indexadas por data; quem recorta o mês é o construtor.
 */
export interface DadosDaVida {
  heatmap: Record<string, boolean | number>;
  treinos: string[];
  acervo: Livro[];
  diario: Record<string, Entrada>;
  /** humor da Rotina ({ mood }) */
  humor: Record<string, { mood?: number }>;
  agua: Record<string, number>;
  aguaSaude: Record<string, number>;
  /** (26/09) humor do Desenvolvimento (número 1–5) */
  humorDp?: Record<string, number>;
  /** (26/09) humor da ação rápida da Home ({ value, emoji, time }) */
  humorHome?: Record<string, { value?: number }>;
  /** (26/09) hábitos feitos por dia (lista de nomes) — e o legado do widget */
  habitos?: Record<string, unknown>;
  habitosLegado?: Record<string, unknown>;
  /** (26/09) dias em que a pessoa mexeu na página do livro */
  leitura?: string[];
  /** (26/09, redesenho) sono: `sleep-log` (Rotina) e `core-saude-sleep` (Home) */
  sono?: Record<string, number>;
  sonoHub?: Record<string, number>;
  /** meta de copos (`core-saude-water-goal`, padrão 8) */
  metaAgua?: number | null;
  /** gratidão da Home (`core-gratitude-log`) e do Desenvolvimento (`dp-gratitude`) */
  gratidaoHub?: Record<string, string[]>;
  gratidaoDp?: Record<string, string[]>;
  /** o texto que a pessoa escreveu sobre o mês (`month-retro`, Rotina › Mês) */
  retroEscrita?: Record<string, string>;
  treino?: DadosDoTreino;
}

/** O plano antigo guardava um `muscle` só; o novo, `muscles`. */
const planoDoTreino = (v: unknown): Record<string, DiaDoPlano> => {
  const out: Record<string, DiaDoPlano> = {};
  for (const [dia, d] of Object.entries(objeto<Record<string, unknown>>(v))) {
    const muscles = Array.isArray(d?.muscles)
      ? (d.muscles as string[])
      : typeof d?.muscle === "string" && d.muscle !== "Descanso" ? [d.muscle] : [];
    out[dia] = { muscles, exercises: lista<{ name?: string; tipo?: string }>(d?.exercises) };
  }
  return out;
};

export const lerDadosDaVida = (fonte: string | null | Leitor): DadosDaVida => {
  const ler: Leitor = typeof fonte === "function" ? fonte : leitorLocal(fonte);
  const meta = Number(ler("treino-meta-semanal"));
  const diasAtivos = ler("treino-active-days");
  const metaAgua = Number(ler("core-saude-water-goal"));
  return {
    heatmap: objeto(ler("heatmap-log")),
    treinos: lista<string>(ler("saude-workout-log")),
    acervo: lista<Livro>(ler("lib-books")),
    diario: objeto(ler("journal-entries")),
    humor: objeto(ler("mood-log")),
    agua: objeto(ler("water-log")),
    aguaSaude: objeto(ler("core-saude-water")),
    humorDp: objeto(ler("dp-mood-log")),
    humorHome: objeto(ler("core-mood-log")),
    habitos: objeto(ler("rotina-habit-log")),
    habitosLegado: objeto(ler("core-rotina-habit-log")),
    leitura: lista<string>(ler("lib-read-log")),
    sono: objeto(ler("sleep-log")),
    sonoHub: objeto(ler("core-saude-sleep")),
    metaAgua: Number.isFinite(metaAgua) && metaAgua > 0 ? metaAgua : null,
    gratidaoHub: objeto(ler("core-gratitude-log")),
    gratidaoDp: objeto(ler("dp-gratitude")),
    retroEscrita: objeto(ler("month-retro")),
    treino: {
      sessoes: objeto(ler("treino-sessoes")),
      historico: lista<Partial<EntradaDoHistorico>>(ler("treino-exercise-history")),
      plano: planoDoTreino(ler("saude-workouts-v2")),
      meta: Number.isFinite(meta) && meta > 0 ? meta : null,
      diasAtivos: Array.isArray(diasAtivos) ? diasAtivos.map((d) => String(d).toUpperCase()) : null,
    },
  };
};

/** Nota de humor 1–5 de qualquer um dos três formatos; fora disso, nada. */
const notaDeHumor = (v: unknown): number | null => {
  const bruto = typeof v === "number" ? v
    : v && typeof v === "object" ? Number((v as Item).mood ?? (v as Item).value ?? (v as Item).score)
    : Number.NaN;
  return Number.isFinite(bruto) && bruto >= 1 && bruto <= 5 ? bruto : null;
};

/**
 * HUMOR DAS TRÊS PORTAS (26/09). A Rotina grava `mood-log` ({ mood }), o
 * Desenvolvimento `dp-mood-log` (número) e a ação rápida da Home
 * `core-mood-log` ({ value }) — todas na escala 1–5. A retrospectiva só lia a
 * primeira: quem registrava pela Home tinha "humor" em branco. Aqui cada dia
 * vira UMA nota (média das portas que registraram naquele dia, pra quem
 * marcou em dois lugares não pesar em dobro) e o mês é a média dos dias.
 */
export const humorDoMes = (ano: number, mesIdx: number, dados: DadosDaVida) => {
  const porDia = new Map<number, number[]>();
  const juntar = (registro: Record<string, unknown> | undefined) => {
    for (const [k, v] of Object.entries(registro ?? {})) {
      if (!naFaixa(k, ano, mesIdx)) continue;
      const nota = notaDeHumor(v);
      if (nota === null) continue;
      const dia = diaDe(k);
      porDia.set(dia, [...(porDia.get(dia) ?? []), nota]);
    }
  };
  juntar(dados.humor);
  juntar(dados.humorDp);
  juntar(dados.humorHome);
  const notas = [...porDia.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dia, ns]) => ({ dia, nota: ns.reduce((s, n) => s + n, 0) / ns.length }));
  const media = notas.length ? notas.reduce((s, n) => s + n.nota, 0) / notas.length : null;
  const melhorDia = notas.length ? notas.reduce((m, n) => (n.nota > m.nota ? n : m), notas[0]) : null;
  return { media, melhorDia, dias: notas.map((n) => n.dia), porDia: notas };
};

/**
 * ÁGUA SEM DOBRO (26/09). A Home, o widget e a Saúde gravam o MESMO número
 * do dia em `water-log` e em `core-saude-water`; somar as duas contava cada
 * copo duas vezes. Por dia vale o MAIOR dos dois (a regra do hub,
 * use-life-hub-data).
 */
export const aguaDoMes = (ano: number, mesIdx: number, dados: Pick<DadosDaVida, "agua" | "aguaSaude">) => {
  const porDia = new Map<number, number>();
  for (const registro of [dados.agua, dados.aguaSaude]) {
    for (const [k, v] of Object.entries(registro ?? {})) {
      if (!naFaixa(k, ano, mesIdx)) continue;
      const n = Math.max(0, Number(v) || 0);
      porDia.set(diaDe(k), Math.max(porDia.get(diaDe(k)) ?? 0, n));
    }
  }
  const dias = [...porDia.entries()].filter(([, n]) => n > 0).map(([d]) => d).sort((a, b) => a - b);
  return { copos: [...porDia.values()].reduce((s, n) => s + n, 0), dias, porDia };
};

/** Hábitos feitos num dia, em qualquer formato que o app já gravou. */
const feitosNoDia = (v: unknown): number => {
  if (Array.isArray(v)) return v.filter(Boolean).length;
  if (v && typeof v === "object") return Object.values(v as Item).filter(Boolean).length;
  return typeof v === "number" && v > 0 ? v : 0;
};

/** Hábitos feitos no mês — por dia, o maior entre a chave nova e a legada (as duas podem ter o mesmo dia). */
const habitosDoMes = (ano: number, mesIdx: number, dados: DadosDaVida) => {
  const porDia = new Map<number, number>();
  for (const registro of [dados.habitos, dados.habitosLegado]) {
    for (const [k, v] of Object.entries(registro ?? {})) {
      if (!naFaixa(k, ano, mesIdx)) continue;
      porDia.set(diaDe(k), Math.max(porDia.get(diaDe(k)) ?? 0, feitosNoDia(v)));
    }
  }
  const dias = [...porDia.entries()].filter(([, n]) => n > 0).map(([d]) => d);
  return { feitos: [...porDia.values()].reduce((s, n) => s + n, 0), dias };
};

/** Nomes dos hábitos feitos num dia (lista de nomes; objeto { nome: true }). */
const nomesFeitos = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([k, ok]) => !!ok && !/^\d+$/.test(k))
      .map(([k]) => k.trim())
      .filter(Boolean);
  }
  return [];
};

/** O hábito feito em mais dias do mês (≥ 2 dias; empate: o que veio antes). */
export const habitoCampeao = (ano: number, mesIdx: number, dados: DadosDaVida): { nome: string; dias: number } | null => {
  const porNome = new Map<string, { nome: string; dias: Set<number> }>();
  for (const registro of [dados.habitos, dados.habitosLegado]) {
    for (const [k, v] of Object.entries(registro ?? {})) {
      if (!naFaixa(k, ano, mesIdx)) continue;
      for (const nome of nomesFeitos(v)) {
        const chave = nome.toLowerCase();
        const item = porNome.get(chave) ?? { nome, dias: new Set<number>() };
        item.dias.add(diaDe(k));
        porNome.set(chave, item);
      }
    }
  }
  let melhor: { nome: string; dias: number } | null = null;
  for (const item of porNome.values()) if (!melhor || item.dias.size > melhor.dias) melhor = { nome: item.nome, dias: item.dias.size };
  return melhor && melhor.dias >= 2 ? melhor : null;
};

const diasDoHeatmap = (ano: number, mesIdx: number, dados: DadosDaVida) =>
  Object.entries(dados.heatmap ?? {})
    .filter(([k, v]) => naFaixa(k, ano, mesIdx) && nivel(v) > 0)
    .map(([k]) => diaDe(k))
    .sort((a, b) => a - b);

const livrosDoMes = (ano: number, mesIdx: number, dados: DadosDaVida) =>
  lista<Livro>(dados.acervo).filter(
    (b) => b?.status === "lido" && typeof b?.endDate === "string" && naFaixa(b.endDate, ano, mesIdx),
  );

const diasDeDiarioDoMes = (ano: number, mesIdx: number, dados: DadosDaVida) =>
  Object.entries(dados.diario ?? {})
    .filter(([k, e]) => {
      if (!naFaixa(k, ano, mesIdx)) return false;
      const g = Array.isArray(e?.gratitude) ? e.gratitude.filter(Boolean).length : 0;
      return g > 0 || !!e?.learned || !!e?.tomorrow;
    })
    .map(([k]) => diaDe(k));

const diasDeTreino = (ano: number, mesIdx: number, dados: DadosDaVida) =>
  lista<string>(dados.treinos).filter((d) => typeof d === "string" && naFaixa(d, ano, mesIdx)).map(diaDe);

/** Gratidão do mês (diário, Home e Desenvolvimento), sem contar a mesma frase do mesmo dia duas vezes. */
const gratidoesDoMes = (ano: number, mesIdx: number, dados: DadosDaVida) => {
  const itens = new Map<string, { dia: number; texto: string }>();
  const somar = (k: string, lista: unknown) => {
    for (const g of Array.isArray(lista) ? lista : []) {
      if (typeof g !== "string" || !g.trim()) continue;
      itens.set(`${k}|${g.trim().toLowerCase()}`, { dia: diaDe(k), texto: g.trim() });
    }
  };
  for (const [k, e] of Object.entries(dados.diario ?? {})) if (naFaixa(k, ano, mesIdx)) somar(k, e?.gratitude);
  for (const registro of [dados.gratidaoHub, dados.gratidaoDp]) {
    for (const [k, l] of Object.entries(registro ?? {})) if (naFaixa(k, ano, mesIdx)) somar(k, l);
  }
  return [...itens.values()];
};

/** Horas de sono por dia (a ação rápida da Home primeiro, como o hub lê). */
const sonoDoMes = (ano: number, mesIdx: number, dados: DadosDaVida) => {
  const porDia = new Map<number, number>();
  for (const registro of [dados.sonoHub, dados.sono]) {
    for (const [k, v] of Object.entries(registro ?? {})) {
      if (!naFaixa(k, ano, mesIdx) || porDia.has(diaDe(k))) continue;
      const h = Number(v);
      if (h > 0 && h <= 24) porDia.set(diaDe(k), h);
    }
  }
  const horas = [...porDia.values()];
  return horas.length
    ? { mediaMin: Math.round((horas.reduce((s, h) => s + h, 0) / horas.length) * 60), dias: [...porDia.keys()] }
    : null;
};

/* --------------------------------------------------------- finanças: dados */

export interface FinancasDoMes {
  incomes: Item[];
  expenses: Item[];
  fixed: Item[];
  parcelas: Parcela[];
}

const chaveDoMes = (ano: number, mesIdx: number, sufixo: string) =>
  `finance-${ano}-${getMonthKey(MESES[mesIdx])}-${sufixo}`;

/** Custo fixo criado DEPOIS do mês (id = Date.now(), às vezes com "fx-"). */
const nascidoDepoisDoMes = (id: unknown, ano: number, mesIdx: number) => {
  const m = /^(?:fx-)?(\d{13})/.exec(String(id ?? ""));
  return !!m && Number(m[1]) >= new Date(ano, mesIdx + 1, 1).getTime();
};

/** Arquivo do mês + o que ainda está no balde corrente com data do mês, sem repetir id. */
const juntarPorId = (arquivo: Item[], doBalde: Item[]): Item[] => {
  if (doBalde.length === 0) return arquivo;
  const ids = new Set(arquivo.map((i) => i?.id).filter((x) => x !== undefined && x !== null).map(String));
  return [...arquivo, ...doBalde.filter((i) => i?.id === undefined || i?.id === null || !ids.has(String(i.id)))];
};

/**
 * Os lançamentos de um mês, já no perfil (PF/PJ) pedido.
 *
 * MÊS FRIO NO DIA 1º (26/09). Quem abre pela notificação do dia 1º às 10h
 * chega antes do arquivamento (use-virada-do-mes roda depois da carga do
 * servidor — e espera a pessoa sair de Finanças): `finance-2026-setembro-*`
 * ainda não existe e setembro saía SEM finanças. Agora:
 *  - gastos e receitas de mês passado = arquivo ∪ itens do balde corrente
 *    com data daquele mês (antes da virada é lá que eles estão; depois dela o
 *    balde não tem mais nenhum — mesclar por id não duplica);
 *  - fixos e parcelas não têm data: só pro mês que ACABOU de fechar, sem
 *    arquivo ainda, valem o balde corrente (fixos nascidos depois do mês
 *    ficam fora, e só se o mês teve receita ou gasto) e as parcelas
 *    carimbadas com aquele mês.
 * O mês corrente lê o balde, como sempre.
 */
export const lerFinancasDoMes = (
  ano: number, mesIdx: number, ler: Leitor, perfil: string, agora = new Date(),
): FinancasDoMes => {
  const mesId = idDoMes(ano, mesIdx);
  const atual = idDoMes(agora.getFullYear(), agora.getMonth());
  const atras = mesesEntre(mesId, atual); // >0 passado · 0 corrente · <0 futuro

  if (atras === 0) {
    const balde = lista<Parcela>(ler("finance-installments"));
    const fontes = [atual, ...mesesAnteriores(atual, 24)].map((mes) => ({ mes, itens: lista<Parcela>(ler(chaveArquivadaDeParcelas(mes))) }));
    return {
      incomes: doPerfil(lista<Item>(ler("finance-incomes")), perfil),
      expenses: doPerfil(lista<Item>(ler("finance-expenses")), perfil),
      fixed: doPerfil(lista<Item>(ler("finance-fixed-expenses")), perfil),
      parcelas: doPerfil(viradaDeParcelas(balde, atual, fontes)?.lista ?? balde, perfil),
    };
  }

  const doBalde = (chave: string) =>
    atras > 0 ? lista<Item>(ler(chave)).filter((i) => typeof i?.date === "string" && i.date.trim().startsWith(`${mesId}-`)) : [];
  const recemFechado = atras === 1;
  const incomes = juntarPorId(lista<Item>(ler(chaveDoMes(ano, mesIdx, "incomes"))), doBalde("finance-incomes"));
  const expenses = juntarPorId(lista<Item>(ler(chaveDoMes(ano, mesIdx, "expenses"))), doBalde("finance-expenses"));

  // Fixos: mesma regra da virada (lib/virada-do-mes, viradaDeFixos) — mês
  // sem receita nem gasto não ganha retrato dos fixos, senão ele "existiria"
  // só com os fixos ("saiu R$ 2.040, entrou R$ 0").
  const fixosArquivo = ler(chaveDoMes(ano, mesIdx, "fixed"));
  const teveMovimento = incomes.length + expenses.length > 0;
  const fixed = fixosArquivo !== undefined && fixosArquivo !== null
    ? lista<Item>(fixosArquivo)
    : recemFechado && teveMovimento
      ? lista<Item>(ler("finance-fixed-expenses")).filter((f) => !nascidoDepoisDoMes(f?.id, ano, mesIdx))
      : [];

  const parcelasArquivo = ler(chaveArquivadaDeParcelas(mesId));
  const proprias = parcelasArquivo !== undefined && parcelasArquivo !== null
    ? lista<Parcela>(parcelasArquivo)
    : recemFechado ? lista<Parcela>(ler("finance-installments")).filter((p) => p?.startMonth === mesId) : [];
  // mês passado ainda recebe o que as chaves anteriores projetam pra ele
  // (mesma regra de parcelasDoMesDe); mês futuro, só o que é dele
  const projetadas = atras > 0
    ? projetarParcelas(mesesAnteriores(mesId, 24).map((mes) => ({ mes, itens: lista<Parcela>(ler(chaveArquivadaDeParcelas(mes))) })), mesId, proprias)
    : [];

  return {
    incomes: doPerfil(incomes, perfil),
    expenses: doPerfil(expenses, perfil),
    fixed: doPerfil(fixed, perfil),
    parcelas: doPerfil([...proprias, ...projetadas], perfil),
  };
};

/* ------------------------------------------------------ finanças: o bloco */

const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", restaurante: "Restaurante", mercado: "Mercado",
  transporte: "Transporte", combustivel: "Combustível", lazer: "Lazer",
  saude: "Saúde", farmacia: "Farmácia", vestuario: "Vestuário",
  educacao: "Educação", eletronicos: "Eletrônicos", delivery: "Delivery",
  presente: "Presentes", pets: "Pets", moradia: "Moradia",
  contas_casa: "Contas da Casa", plano_saude: "Plano de Saúde",
  assinaturas: "Assinaturas", internet_telefone: "Internet/Telefone",
  academia: "Academia", beleza: "Beleza", outros: "Outros",
};

export type EgoMoment =
  | { kind: "saver"; rate: number; saved: number }
  | { kind: "raise"; pct: number; prevMonth: string }
  | { kind: "cutter"; pct: number; prevMonth: string }
  | { kind: "modest"; saved: number }
  | { kind: "reality"; deficit: number; cut: { label: string; value: number } | null }
  /** (26/09) sem renda registrada: não há saldo pra comemorar */
  | { kind: "semRenda" };

export interface WrappedData {
  month: string;
  income: number;
  outflow: number;
  balance: number;
  savingsRate: number;
  /** `pct` = fatia do total que saiu (26/09: a página de dinheiro fala em %) */
  topCategories: { label: string; value: number; pct: number }[];
  biggestExpense: { description: string; value: number; day: string } | null;
  pixPct: number;
  txCount: number;
  ego: EgoMoment;
  /** (26/09) teve renda registrada no mês — sem ela não existe saldo, "faltou" nem "% guardado" */
  temRenda: boolean;
  /** (26/09) gastos variáveis anotados no mês */
  gastosAnotados: number;
  /** (26/09) dias da base sem nenhum gasto anotado (null se nenhum gasto tem data) */
  diasSemGasto: number | null;
  /** (26/09, redesenho) os dias do mês com algum gasto anotado — a tira "dias sem gastar nada" */
  diasComGasto: number[];
}

const totaisDe = (f: FinancasDoMes) => ({
  receitas: soma(f.incomes),
  saiu: computeMonthlyOutflow(soma(f.expenses), soma(f.fixed), somaParcelasDoMes(f.parcelas)),
});

/** Monta o bloco de finanças a partir dos lançamentos já lidos. Null se o mês não tem nada. */
const montarWrapped = (
  month: string, f: FinancasDoMes, anterior: { receitas: number; saiu: number }, prevMonth: string,
  base: BaseDoMes, mesId: string,
): WrappedData | null => {
  const { expenses, fixed, parcelas } = f;
  const income = soma(f.incomes);
  // "Saiu" = fixos + variáveis + PARCELAS do mês, como no Dashboard (26/09,
  // varredura: a parcela do celular sumia da retrospectiva e o mês parecia
  // mais folgado do que foi).
  const outflow = totaisDe(f).saiu;
  if (income <= 0 && outflow <= 0) return null;

  const all = [...expenses, ...fixed];
  const byCategory: Record<string, number> = {};
  for (const e of all) {
    const cat = e.category || "outros";
    byCategory[cat] = (byCategory[cat] || 0) + (Number(e.value) || 0);
  }
  for (const p of parcelas) {
    const v = valorDaParcelaNoMes(p);
    if (v <= 0) continue;
    const cat = p.category === "roupa" ? "vestuario" : p.category || "outros";
    byCategory[cat] = (byCategory[cat] || 0) + v;
  }
  const topCategories = Object.entries(byCategory)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, value]) => ({ label: CATEGORY_LABELS[cat] || cat, value, pct: outflow > 0 ? (value / outflow) * 100 : 0 }));

  const biggest = [...expenses].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];
  const biggestExpense = biggest
    ? {
        description: biggest.description || CATEGORY_LABELS[biggest.category ?? ""] || "Gasto",
        value: Number(biggest.value) || 0,
        day: biggest.date ? new Date(`${biggest.date}T12:00:00`).getDate().toString() : "",
      }
    : null;

  const paid = all.filter((e) => e.paymentMethod);
  const pixPct = paid.length > 0
    ? Math.round((paid.filter((e) => e.paymentMethod === "pix").length / paid.length) * 100)
    : 0;

  const temRenda = income > 0;
  const savingsRate = computeSavingsRate(income, outflow);
  const balance = income - outflow;

  // dias sem gasto, contados na mesma base dos percentuais
  const todosOsDiasComGasto = [...new Set(
    expenses
      .filter((e) => typeof e?.date === "string" && e.date.startsWith(`${mesId}-`))
      .map((e) => diaDe(e.date as string)),
  )].sort((a, b) => a - b);
  const naBase = todosOsDiasComGasto.filter((d) => d >= base.primeiroDia && d <= base.ultimoDia);
  const diasSemGasto = naBase.length > 0 ? Math.max(0, base.dias - naBase.length) : null;

  const incomeUpPct = anterior.receitas > 0 ? ((income - anterior.receitas) / anterior.receitas) * 100 : 0;
  const spentDownPct = anterior.saiu > 0 ? ((anterior.saiu - outflow) / anterior.saiu) * 100 : 0;

  // ---- momento de ego ---- (26/09: só existe COM renda; sem ela, "saiu mais
  // do que entrou" era mentira — entrou R$ 0 porque ninguém lançou)
  let ego: EgoMoment;
  if (!temRenda) {
    ego = { kind: "semRenda" };
  } else if (balance < 0) {
    const varByCat: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category || "outros";
      varByCat[cat] = (varByCat[cat] || 0) + (Number(e.value) || 0);
    }
    const topVar = Object.entries(varByCat).sort((a, b) => b[1] - a[1])[0];
    ego = {
      kind: "reality",
      deficit: Math.abs(balance),
      cut: topVar ? { label: CATEGORY_LABELS[topVar[0]] || topVar[0], value: topVar[1] } : null,
    };
  } else if (savingsRate >= 20) {
    ego = { kind: "saver", rate: savingsRate, saved: balance };
  } else if (incomeUpPct >= 10) {
    ego = { kind: "raise", pct: incomeUpPct, prevMonth };
  } else if (spentDownPct >= 10) {
    ego = { kind: "cutter", pct: spentDownPct, prevMonth };
  } else {
    ego = { kind: "modest", saved: balance };
  }

  return {
    month, income, outflow, balance, savingsRate,
    topCategories, biggestExpense, pixPct,
    txCount: all.length,
    ego,
    temRenda,
    gastosAnotados: expenses.length,
    diasSemGasto,
    diasComGasto: todosOsDiasComGasto,
  };
};

/**
 * Lê o bloco de FINANÇAS do mês. Null se o mês não tem lançamento nenhum.
 * `opts.ler` troca a fonte (a tela passa o `get` do store); sem ele, lê o
 * localStorage do usuário — é assim que os testes e o banner antigo chamavam.
 */
export const buildWrappedData = (
  month: string, userId: string | null, ano?: number,
  opts: { ler?: Leitor; agora?: Date; primeiroDia?: number | null } = {},
): WrappedData | null => {
  const idx = MESES.indexOf(month);
  if (idx < 0) return null;
  const agora = opts.agora ?? new Date();
  const ler = opts.ler ?? leitorLocal(userId);
  const anoBase = ano ?? agora.getFullYear();
  const perfil = perfilAtivoLocal(userId);
  const f = lerFinancasDoMes(anoBase, idx, ler, perfil, agora);
  // O ano tem que acompanhar a virada: em Janeiro o "anterior" é Dezembro do
  // ANO PASSADO, e sem isso a comparação lia um mês que não existe. Mesma
  // régua dos dois lados: o mês anterior também com as parcelas dele.
  const prev = mesAntesDe(anoBase, idx);
  const anterior = totaisDe(lerFinancasDoMes(prev.ano, prev.mesIdx, ler, perfil, agora));
  const primeiro = opts.primeiroDia !== undefined ? opts.primeiroDia : primeiroDiaDasFinancas(f, anoBase, idx);
  return montarWrapped(month, f, anterior, MESES[prev.mesIdx], baseDoMes(anoBase, idx, primeiro, agora), idDoMes(anoBase, idx));
};

const primeiroDiaDasFinancas = (f: FinancasDoMes, ano: number, mesIdx: number): number | null => {
  const dias = [...f.expenses, ...f.incomes]
    .filter((i) => typeof i?.date === "string" && naFaixa(i.date, ano, mesIdx))
    .map((i) => diaDe(i.date as string));
  return dias.length ? Math.min(...dias) : null;
};

/* ------------------------------------------------------------ atividade */

export interface AtividadeDoMes {
  /** dias do mês com QUALQUER registro datado (qualquer módulo) */
  diasComRegistro: number;
  /** registros do mês somando os módulos */
  registros: number;
  /** módulos com pelo menos um registro */
  modulos: string[];
  /** 1º dia do mês com registro datado (null = nenhum registro com data) */
  primeiroDia: number | null;
  /** (26/09, redesenho) os dias (1–31) com algum registro — o calendário da capa e a tira do card */
  dias: number[];
}

/**
 * Quanto a pessoa USOU o app no mês, somando tudo o que tem data (26/09).
 * É daqui que saem a base dos percentuais (1º dia de uso NO mês), os "dias
 * com a vida anotada" e a decisão entre a retrospectiva completa e a curta.
 */
export const atividadeDoMes = (
  ano: number, mesIdx: number, dados: DadosDaVida, fin?: FinancasDoMes | null,
): AtividadeDoMes => {
  const modulos: Record<string, { dias: number[]; registros: number }> = {};
  const marcar = (modulo: string, dias: number[], registros: number) => {
    if (registros <= 0) return;
    const m = (modulos[modulo] ??= { dias: [], registros: 0 });
    m.dias.push(...dias);
    m.registros += registros;
  };

  if (fin) {
    const datados = [...fin.expenses, ...fin.incomes]
      .filter((i) => typeof i?.date === "string" && naFaixa(i.date, ano, mesIdx))
      .map((i) => diaDe(i.date as string));
    // fixos e parcelas contam como registro (é dado do mês), mas não têm dia
    marcar("financas", datados, fin.expenses.length + fin.incomes.length + fin.fixed.length + fin.parcelas.length);
  }
  const heat = diasDoHeatmap(ano, mesIdx, dados);
  const hab = habitosDoMes(ano, mesIdx, dados);
  marcar("habitos", [...heat, ...hab.dias], Math.max(hab.feitos, heat.length));
  const treinos = diasDeTreino(ano, mesIdx, dados);
  marcar("treino", treinos, treinos.length);
  const livros = livrosDoMes(ano, mesIdx, dados);
  const diasLendo = lista<string>(dados.leitura).filter((d) => typeof d === "string" && naFaixa(d, ano, mesIdx)).map(diaDe);
  marcar("leitura", [...livros.map((b) => diaDe(b.endDate as string)), ...diasLendo], livros.length + diasLendo.length);
  const diario = diasDeDiarioDoMes(ano, mesIdx, dados);
  marcar("diario", diario, diario.length);
  const humor = humorDoMes(ano, mesIdx, dados);
  marcar("humor", humor.dias, humor.dias.length);
  const agua = aguaDoMes(ano, mesIdx, dados);
  marcar("agua", agua.dias, agua.dias.length);
  // (26/09, redesenho) gratidão e sono também são "vida anotada"
  const gratidoes = gratidoesDoMes(ano, mesIdx, dados).filter((g) => !diario.includes(g.dia));
  marcar("gratidao", gratidoes.map((g) => g.dia), gratidoes.length);
  const sono = sonoDoMes(ano, mesIdx, dados);
  if (sono) marcar("sono", sono.dias, sono.dias.length);

  const todosOsDias = [...new Set(Object.values(modulos).flatMap((m) => m.dias).filter((d) => d >= 1 && d <= 31))].sort((a, b) => a - b);
  return {
    diasComRegistro: todosOsDias.length,
    registros: Object.values(modulos).reduce((s, m) => s + m.registros, 0),
    modulos: Object.keys(modulos),
    primeiroDia: todosOsDias.length ? todosOsDias[0] : null,
    dias: todosOsDias,
  };
};

/**
 * POUCO DADO (26/09): menos de 5 dias com registro, ou menos de 15 registros
 * no mês (quem usou 1–2 módulos poucas vezes), recebe a retrospectiva CURTA —
 * capa, 1–2 fatos reais e um fecho positivo. Sem "% do mês" nem perfil: três
 * dias de dado não sustentam "Mês Turbulento" nem "6% dos dias".
 */
export const DIAS_MINIMOS_COMPLETA = 5;
export const REGISTROS_MINIMOS_COMPLETA = 15;
export const ehRetroCurta = (a: AtividadeDoMes) =>
  a.diasComRegistro < DIAS_MINIMOS_COMPLETA || a.registros < REGISTROS_MINIMOS_COMPLETA;

/** A maior sequência de dias seguidos, com o dia em que começou e terminou. */
export const sequenciaDeDias = (dias: number[]): { dias: number; de: number; ate: number } | null => {
  let melhor: { dias: number; de: number; ate: number } | null = null;
  let n = 0;
  let inicio = 0;
  let anterior = -99;
  for (const d of [...new Set(dias)].sort((a, b) => a - b)) {
    if (d === anterior + 1) n++;
    else { n = 1; inicio = d; }
    anterior = d;
    if (!melhor || n > melhor.dias) melhor = { dias: n, de: inicio, ate: d };
  }
  return melhor;
};

/* -------------------------------------------------------------- vida */

export interface RetroVida {
  /** dias com QUALQUER atividade marcada no heatmap */
  diasAtivos: number;
  /** a BASE dos percentuais: dias desde o 1º registro do mês até o fim dele
   *  (o mês corrente não conta o futuro) — 26/09 */
  diasPossiveis: number;
  /** dia em que a base começa (1 = o mês inteiro) */
  primeiroDia: number;
  /** dias do calendário do mês */
  diasDoMes: number;
  /** maior sequência de dias ativos DENTRO do mês */
  melhorSequencia: number;
  treinos: number;
  livros: { titulo: string; autor: string }[];
  paginas: number;
  diasDeDiario: number;
  /** média 1–5 do humor registrado (Rotina, Desenvolvimento e Home), null se ninguém registrou */
  humorMedio: number | null;
  /** dias com humor registrado */
  diasComHumor: number;
  /** dia com o melhor humor do mês (e qual foi) */
  melhorDia: { dia: number; nota: number } | null;
  copos: number;
  /** hábitos marcados como feitos no mês (26/09) */
  habitosFeitos: number;
}

/**
 * Recorta um mês do snapshot. Devolve null quando NADA aconteceu — assim quem
 * chama sabe que não há bloco a mostrar, em vez de exibir uma tela cheia de
 * zeros. `opts.primeiroDia` = 1º dia de uso do mês contando TODOS os módulos
 * (finanças inclusive); sem ele, vale o 1º registro da própria vida.
 */
export const construirRetroVida = (
  ano: number,
  mesIdx: number,
  dados: DadosDaVida,
  opts: { primeiroDia?: number | null; agora?: Date } = {},
): RetroVida | null => {
  // ---- dias ativos + melhor sequência (heatmap da Rotina) ----
  const diasMarcados = diasDoHeatmap(ano, mesIdx, dados);
  const melhorSequencia = sequenciaDeDias(diasMarcados)?.dias ?? 0;

  const treinos = diasDeTreino(ano, mesIdx, dados).length;

  // ---- leitura: livro conta no mês em que foi TERMINADO ----
  const terminados = livrosDoMes(ano, mesIdx, dados);
  const livros = terminados.map((b) => ({ titulo: b.title || "Sem título", autor: b.author || "" }));
  const paginas = terminados.reduce((s, b) => s + (Number(b.pages) || 0), 0);

  const diasDeDiario = diasDeDiarioDoMes(ano, mesIdx, dados).length;
  const humor = humorDoMes(ano, mesIdx, dados);
  const { copos } = aguaDoMes(ano, mesIdx, dados);
  const { feitos: habitosFeitos } = habitosDoMes(ano, mesIdx, dados);

  const vazio =
    diasMarcados.length === 0 && treinos === 0 && livros.length === 0 &&
    diasDeDiario === 0 && humor.media === null && copos === 0 && habitosFeitos === 0;
  if (vazio) return null;

  const primeiro = opts.primeiroDia !== undefined ? opts.primeiroDia : atividadeDoMes(ano, mesIdx, dados).primeiroDia;
  const base = baseDoMes(ano, mesIdx, primeiro, opts.agora);

  return {
    diasAtivos: diasMarcados.length,
    diasPossiveis: base.dias,
    primeiroDia: base.primeiroDia,
    diasDoMes: base.diasDoMes,
    melhorSequencia,
    treinos,
    livros,
    paginas,
    diasDeDiario,
    humorMedio: humor.media,
    diasComHumor: humor.dias.length,
    melhorDia: humor.melhorDia,
    copos,
    habitosFeitos,
  };
};

/* -------------------------------------------- as páginas do planner (26/09) */

const DIAS_DA_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const NOME_DO_DIA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const PLURAL_DO_DIA = ["segundas", "terças", "quartas", "quintas", "sextas", "sábados", "domingos"];

/** O dia da semana em que a pessoa mais apareceu (proporção, ≥ 2 vezes). */
export const diaMaisForte = (ano: number, mesIdx: number, dias: number[], base: BaseDoMes) => {
  const conta = Array.from({ length: 7 }, () => ({ total: 0, feitos: 0 }));
  const anotados = new Set(dias);
  for (let d = base.primeiroDia; d <= base.ultimoDia; d++) {
    const i = (new Date(ano, mesIdx, d).getDay() + 6) % 7;
    conta[i].total++;
    if (anotados.has(d)) conta[i].feitos++;
  }
  let melhor = -1;
  for (let i = 0; i < 7; i++) {
    if (conta[i].feitos < 2) continue;
    if (melhor < 0) { melhor = i; continue; }
    const a = conta[i].feitos / conta[i].total;
    const b = conta[melhor].feitos / conta[melhor].total;
    if (a > b || (a === b && conta[i].feitos > conta[melhor].feitos)) melhor = i;
  }
  return melhor < 0
    ? null
    : { dia: DIAS_DA_SEMANA[melhor], nome: NOME_DO_DIA[melhor], plural: PLURAL_DO_DIA[melhor], feitos: conta[melhor].feitos, total: conta[melhor].total };
};

export interface MeuMes {
  diasAnotados: number;
  /** a maior sequência de dias anotados (só a partir de 2) */
  sequencia: { dias: number; de: number; ate: number } | null;
  diaForte: ReturnType<typeof diaMaisForte>;
  habitoCampeao: { nome: string; dias: number } | null;
  /** "+4 dias que em agosto" — só quando o mês anterior teve registro E este foi maior */
  aMaisQueAnterior: { mes: string; dias: number } | null;
}

export type GrupoDoCorpo = GrupoDoCarimbo;

/** Rótulo curto do grupo (o carimbo e o agrupamento são os do Treino). */
const ROTULO_DO_GRUPO: Record<GrupoDoCarimbo, string> = {
  pernas: "Pernas", superiores: "Superiores", costas: "Costas", cardio: "Cardio", core: "Abdômen",
};

export interface CorpoDoMes {
  treinos: number;
  /** semanas (que começam no mês) em que a meta semanal do Treino foi batida */
  meta: { porSemana: number; semanas: number } | null;
  /** treinos por semana na base do mês */
  porSemana: number;
  grupos: { grupo: GrupoDoCarimbo; emoji: string; rotulo: string; dias: number }[];
  agua: { diasNaMeta: number; meta: number; dias: { dia: number; naMeta: boolean }[] } | null;
  sono: { mediaMin: number; diferencaMin: number | null; mesAnterior: string } | null;
  recorde: { exercicio: string; carga: number; reps: number } | null;
}

export interface SentirDoMes {
  /** humor de cada dia registrado (média das três portas) */
  porDia: { dia: number; nota: number }[];
  /** a palavra da maior parte dos dias ("bem"); null sem humor */
  palavra: string | null;
  /** maior parte dos dias em 1–2 (a página ganha uma frase gentil) */
  pesado: boolean;
  diasDeDiario: number;
  gratidoes: number;
  /** uma frase da própria pessoa — SÓ dentro do app */
  frase: { texto: string; quando: string | null } | null;
}

const PALAVRA_DO_HUMOR: Record<number, string> = { 1: "mal", 2: "pra baixo", 3: "no meio-termo", 4: "bem", 5: "muito bem" };

/** A palavra da maior parte dos dias (empate: a mais perto da média). Sem gênero. */
export const palavraDoHumor = (porDia: { nota: number }[]) => {
  if (!porDia.length) return { palavra: null, categoria: 0 };
  const conta = [0, 0, 0, 0, 0, 0];
  for (const { nota } of porDia) conta[Math.min(5, Math.max(1, Math.round(nota)))]++;
  const media = porDia.reduce((s, n) => s + n.nota, 0) / porDia.length;
  let melhor = 0;
  for (let c = 1; c <= 5; c++) {
    if (!melhor || conta[c] > conta[melhor] || (conta[c] === conta[melhor] && Math.abs(c - media) < Math.abs(melhor - media))) melhor = c;
  }
  return { palavra: PALAVRA_DO_HUMOR[melhor], categoria: melhor };
};

const limparFrase = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length <= 140 ? s : `${s.slice(0, 137).replace(/\s+\S*$/, "")}…`;
};

/**
 * Uma frase da própria pessoa pro post-it: o que ela escreveu sobre o mês
 * (Rotina › Mês); senão, o aprendizado ou a gratidão mais recente do mês.
 * Nunca vai pro card.
 */
export const fraseDoMes = (ano: number, mesIdx: number, dados: DadosDaVida): SentirDoMes["frase"] => {
  const escrita = dados.retroEscrita?.[idDoMes(ano, mesIdx)];
  if (typeof escrita === "string" && escrita.trim().length >= 8) return { texto: limparFrase(escrita), quando: null };
  const candidatos: { data: string; texto: string; peso: number }[] = [];
  const somar = (data: string, texto: unknown, peso: number) => {
    if (typeof texto === "string" && texto.trim().length >= 8) candidatos.push({ data, texto, peso });
  };
  for (const [k, e] of Object.entries(dados.diario ?? {})) {
    if (!naFaixa(k, ano, mesIdx)) continue;
    somar(k, e?.learned, 2);
    for (const g of Array.isArray(e?.gratitude) ? e.gratitude : []) somar(k, g, 1);
  }
  for (const registro of [dados.gratidaoHub, dados.gratidaoDp]) {
    for (const [k, l] of Object.entries(registro ?? {})) {
      if (!naFaixa(k, ano, mesIdx)) continue;
      for (const g of Array.isArray(l) ? l : []) somar(k, g, 1);
    }
  }
  candidatos.sort((a, b) => b.peso - a.peso || b.data.localeCompare(a.data));
  const c = candidatos[0];
  return c ? { texto: limparFrase(c.texto), quando: `${diaDe(c.data)}/${c.data.slice(5, 7)}` } : null;
};

const montarMeuMes = (
  ano: number, mesIdx: number, dados: DadosDaVida, atividade: AtividadeDoMes, base: BaseDoMes, anterior: AtividadeDoMes,
): MeuMes | null => {
  if (atividade.diasComRegistro === 0) return null;
  const seq = sequenciaDeDias(atividade.dias);
  const diferenca = atividade.diasComRegistro - anterior.diasComRegistro;
  const prev = mesAntesDe(ano, mesIdx);
  return {
    diasAnotados: atividade.diasComRegistro,
    sequencia: seq && seq.dias >= 2 ? seq : null,
    diaForte: diaMaisForte(ano, mesIdx, atividade.dias, base),
    habitoCampeao: habitoCampeao(ano, mesIdx, dados),
    aMaisQueAnterior: anterior.diasComRegistro > 0 && diferenca > 0 ? { mes: MESES[prev.mesIdx].toLowerCase(), dias: diferenca } : null,
  };
};

const montarCorpo = (ano: number, mesIdx: number, dados: DadosDaVida, base: BaseDoMes, agora: Date): CorpoDoMes | null => {
  const treinos = diasDeTreino(ano, mesIdx, dados).length;
  const t = dados.treino;
  let grupos: CorpoDoMes["grupos"] = [];
  let meta: CorpoDoMes["meta"] = null;
  let recorde: CorpoDoMes["recorde"] = null;
  if (t && treinos > 0) {
    const m = mesCarimbado(ano, mesIdx, dados.treinos, { sessoes: t.sessoes, historico: t.historico, plano: t.plano }, localDayKey(agora));
    const conta = new Map<GrupoDoCarimbo, number>();
    for (const d of m.dias) {
      if (d.carimbo && d.carimbo.grupo !== "outro") conta.set(d.carimbo.grupo, (conta.get(d.carimbo.grupo) ?? 0) + 1);
    }
    grupos = [...conta.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([grupo, dias]) => ({ grupo, emoji: CARIMBOS[grupo].emoji, rotulo: ROTULO_DO_GRUPO[grupo], dias }));
    const porSemana = Math.min(7, Math.max(1, Math.round(t.meta ?? metaPadrao(t.diasAtivos ?? ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"]))));
    const { semanas } = semanasNaMeta(dados.treinos, porSemana, new Date(ano, mesIdx, base.ultimoDia, 12), 7);
    const batidas = semanas.filter((s) => s.inicio.startsWith(`${idDoMes(ano, mesIdx)}-`) && s.bateu).length;
    meta = batidas > 0 ? { porSemana, semanas: batidas } : null;
    const r = recordesDoMes(t.historico, ano, mesIdx)[0];
    recorde = r ? { exercicio: r.exercicio, carga: r.melhor.carga, reps: r.melhor.reps } : null;
  }

  const a = aguaDoMes(ano, mesIdx, dados);
  const metaAgua = dados.metaAgua && dados.metaAgua > 0 ? dados.metaAgua : 8;
  const diasDeAgua = a.dias.map((dia) => ({ dia, naMeta: (a.porDia.get(dia) ?? 0) >= metaAgua }));
  const agua = diasDeAgua.length ? { diasNaMeta: diasDeAgua.filter((d) => d.naMeta).length, meta: metaAgua, dias: diasDeAgua } : null;

  const s = sonoDoMes(ano, mesIdx, dados);
  const prev = mesAntesDe(ano, mesIdx);
  const sPrev = sonoDoMes(prev.ano, prev.mesIdx, dados);
  const sono = s ? { mediaMin: s.mediaMin, diferencaMin: sPrev ? s.mediaMin - sPrev.mediaMin : null, mesAnterior: MESES[prev.mesIdx].toLowerCase() } : null;

  if (treinos === 0 && !agua && !sono) return null;
  return { treinos, meta, porSemana: treinos / Math.max(1, base.dias / 7), grupos, agua, sono, recorde };
};

const montarSentir = (ano: number, mesIdx: number, dados: DadosDaVida): SentirDoMes | null => {
  const humor = humorDoMes(ano, mesIdx, dados);
  const { palavra, categoria } = palavraDoHumor(humor.porDia);
  const diasDeDiario = diasDeDiarioDoMes(ano, mesIdx, dados).length;
  const gratidoes = gratidoesDoMes(ano, mesIdx, dados).length;
  const frase = fraseDoMes(ano, mesIdx, dados);
  if (!humor.porDia.length && !diasDeDiario && !gratidoes && !frase) return null;
  return { porDia: humor.porDia, palavra, pesado: categoria > 0 && categoria <= 2, diasDeDiario, gratidoes, frase };
};

/* -------------------------------------------------------------- perfil */

export type AreaDoPerfil = "vida" | "dinheiro" | "corpo" | "sentir" | "leitura";
export interface PerfilDoMes { emoji: string; name: string; line: string; area: AreaDoPerfil }

/** "dos 12 dias desde que você começou" / "dos 31 dias do mês" */
export const textoDaBase = (v: Pick<RetroVida, "diasPossiveis" | "primeiroDia">) =>
  v.primeiroDia > 1 ? `dos ${v.diasPossiveis} dias desde que você começou` : `dos ${v.diasPossiveis} dias do mês`;

/** O uso do mês visto pelo perfil: dias com a vida anotada sobre a base e a maior sequência. */
export interface ConstanciaDoMes { dias: number; base: number; primeiroDia: number; sequencia: number }

/**
 * O "perfil do mês" — o carimbo do card que a pessoa posta.
 *
 * A ordem importa: o perfil sai do que ela MAIS fez, não do módulo que o app
 * prefere. Um mês de 4 livros vira "Devorador de livros" mesmo com finanças
 * lançadas, porque foi ali que a pessoa se reconhece. Dinheiro só assume o
 * perfil quando o número é notável (guardou 30%+).
 *
 * (26/09) NUNCA NEGATIVO e sem comparação que não dá pra provar ("poucos
 * param pra pensar", "elite"): "Mês Turbulento" e "Recomeço" saíram. Sem
 * destaque notável, o perfil é o que a pessoa mais registrou.
 * (26/09, redesenho) a constância é a dos dias com a vida anotada (qualquer
 * módulo) — "Imparável" virou o carimbo "Constância de Ferro" do mockup.
 */
export const perfilDoMes = (f: WrappedData | null, v: RetroVida | null, c?: ConstanciaDoMes | null): PerfilDoMes => {
  const constancia = c ?? (v ? { dias: v.diasAtivos, base: v.diasPossiveis, primeiroDia: v.primeiroDia, sequencia: v.melhorSequencia } : null);
  const razao = constancia && constancia.base > 0 ? constancia.dias / constancia.base : 0;
  const comRenda = !!f && f.temRenda;

  if (comRenda && f!.savingsRate >= 30) {
    return { emoji: "🐷", name: "Cofre Forte", line: `Guardou ${f!.savingsRate.toFixed(0)}% do que entrou.`, area: "dinheiro" };
  }
  if (v && v.livros.length >= 3) {
    return { emoji: "📚", name: "Devorador de Livros", line: `${v.livros.length} livros terminados em um mês só.`, area: "leitura" };
  }
  if (v && v.treinos >= 12) {
    return { emoji: "🏋️", name: "Modo Atleta", line: `${v.treinos} treinos registrados. Sem desculpa.`, area: "corpo" };
  }
  if (constancia && constancia.dias >= DIAS_MINIMOS_COMPLETA && razao >= 0.8) {
    return {
      emoji: "🔥", name: "Constância de Ferro", area: "vida",
      line: `Ativo em ${constancia.dias} ${textoDaBase({ diasPossiveis: constancia.base, primeiroDia: constancia.primeiroDia })}.`,
    };
  }
  if (v && v.diasDeDiario >= 10) {
    return { emoji: "✨", name: "Observador", line: `${v.diasDeDiario} dias de diário. Parou pra pensar.`, area: "sentir" };
  }
  if (constancia && constancia.sequencia >= 7) {
    return { emoji: "⛓️", name: "Corrente Longa", line: `${constancia.sequencia} dias seguidos sem quebrar.`, area: "vida" };
  }
  if (comRenda && f!.savingsRate >= 10) {
    return { emoji: "⚖️", name: "Equilibrista", line: "Fechou no azul, com folga.", area: "dinheiro" };
  }
  if (constancia && constancia.dias >= DIAS_MINIMOS_COMPLETA && razao >= 0.5) {
    return { emoji: "🌱", name: "Em Construção", line: "Mais da metade dos dias no jogo. Isso vira hábito.", area: "vida" };
  }
  if (comRenda && f!.balance >= 0) {
    return { emoji: "✅", name: "No Azul", line: "Fechou o mês no azul, com tudo anotado.", area: "dinheiro" };
  }

  // Sem destaque: o que ela mais registrou (contagem de registros/dias).
  const candidatos: { peso: number; perfil: PerfilDoMes }[] = [];
  if (f && f.gastosAnotados > 0) {
    candidatos.push({ peso: f.gastosAnotados, perfil: {
      emoji: "🧭", name: "Olho no Dinheiro", area: "dinheiro",
      line: `${plural(f.gastosAnotados, "gasto anotado", "gastos anotados")}. Quem enxerga o mês decide o próximo.`,
    } });
  }
  if (v && v.treinos > 0) {
    candidatos.push({ peso: v.treinos, perfil: { emoji: "💪", name: "Em Movimento", line: `${plural(v.treinos, "treino", "treinos")} no mês. O corpo agradece.`, area: "corpo" } });
  }
  if (v && v.livros.length > 0) {
    candidatos.push({ peso: v.livros.length * 5, perfil: {
      emoji: "📖", name: "Página Virada", area: "leitura",
      line: v.livros.length === 1 ? `Terminou "${v.livros[0].titulo}".` : `${v.livros.length} livros terminados.`,
    } });
  }
  if (v && (v.diasAtivos > 0 || v.habitosFeitos > 0)) {
    candidatos.push({ peso: Math.max(v.diasAtivos, 1), perfil: {
      emoji: "🌱", name: "Em Construção", area: "vida",
      line: v.diasAtivos > 0 ? `${plural(v.diasAtivos, "dia", "dias")} de hábito marcado. Isso vira rotina.` : "Hábitos marcados. Isso vira rotina.",
    } });
  }
  if (v && v.diasDeDiario > 0) {
    candidatos.push({ peso: v.diasDeDiario, perfil: { emoji: "✍️", name: "Diário Aberto", line: `${plural(v.diasDeDiario, "dia", "dias")} de diário. Ficou registrado.`, area: "sentir" } });
  }
  if (v && v.diasComHumor > 0) {
    candidatos.push({ peso: v.diasComHumor, perfil: { emoji: "💜", name: "De Olho em Si", line: `Humor registrado em ${plural(v.diasComHumor, "dia", "dias")}.`, area: "sentir" } });
  }
  if (v && v.copos > 0) {
    candidatos.push({ peso: Math.min(v.copos, 31), perfil: { emoji: "💧", name: "Bem Hidratado", line: `${plural(v.copos, "copo", "copos")} d'água no mês.`, area: "corpo" } });
  }
  if (candidatos.length > 0) {
    return candidatos.reduce((melhor, cand) => (cand.peso > melhor.peso ? cand : melhor), candidatos[0]).perfil;
  }
  if (f) return { emoji: "🧭", name: "Olho no Dinheiro", line: "Tudo anotado. É assim que o mês fica claro.", area: "dinheiro" };
  return { emoji: "🌱", name: "Em Construção", line: "Cada registro conta. O próximo mês começa agora.", area: "vida" };
};

/* ---------------------------------------------------------- o mês inteiro */

export interface RetroMes {
  mes: string;
  ano: number;
  /** índice 0–11 do mês (26/09) */
  mesIdx: number;
  financas: WrappedData | null;
  vida: RetroVida | null;
  perfil: PerfilDoMes;
  /** quanto a pessoa usou o app no mês (26/09) */
  atividade: AtividadeDoMes;
  /** pouco dado: retrospectiva curta, sem perfil nem "% do mês" (26/09) */
  curta: boolean;
  /** (26/09, redesenho) a base do mês e as páginas do planner */
  base: BaseDoMes;
  meuMes: MeuMes | null;
  corpo: CorpoDoMes | null;
  sentir: SentirDoMes | null;
}

/**
 * Monta a retrospectiva completa de um mês. Null quando não há NADA — nem
 * dinheiro nem vida. É esse null que a tela e a notificação usam pra decidir
 * se vale chamar a pessoa.
 */
export const construirRetroMes = (
  ano: number,
  mesIdx: number,
  userId: string | null,
  /** snapshot já lido — quem monta vários meses passa o mesmo pra todos */
  dados?: DadosDaVida,
  opts: { ler?: Leitor; agora?: Date } = {},
): RetroMes | null => {
  const agora = opts.agora ?? new Date();
  const ler = opts.ler ?? leitorLocal(userId);
  const vidaDados = dados ?? lerDadosDaVida(ler);
  const mes = MESES[mesIdx];
  const perfilFinancas = perfilAtivoLocal(userId);
  const fin = lerFinancasDoMes(ano, mesIdx, ler, perfilFinancas, agora);
  const atividade = atividadeDoMes(ano, mesIdx, vidaDados, fin);
  const base = baseDoMes(ano, mesIdx, atividade.primeiroDia, agora);
  const prev = mesAntesDe(ano, mesIdx);
  const finAnterior = lerFinancasDoMes(prev.ano, prev.mesIdx, ler, perfilFinancas, agora);
  const financas = montarWrapped(mes, fin, totaisDe(finAnterior), MESES[prev.mesIdx], base, idDoMes(ano, mesIdx));
  const vida = construirRetroVida(ano, mesIdx, vidaDados, { primeiroDia: atividade.primeiroDia, agora });
  const corpo = montarCorpo(ano, mesIdx, vidaDados, base, agora);
  const sentir = montarSentir(ano, mesIdx, vidaDados);
  if (!financas && !vida && !corpo && !sentir) return null;
  const meuMes = montarMeuMes(ano, mesIdx, vidaDados, atividade, base, atividadeDoMes(prev.ano, prev.mesIdx, vidaDados, finAnterior));
  const constancia: ConstanciaDoMes | null = atividade.diasComRegistro > 0
    ? { dias: atividade.diasComRegistro, base: base.dias, primeiroDia: base.primeiroDia, sequencia: sequenciaDeDias(atividade.dias)?.dias ?? 0 }
    : null;
  return {
    mes, ano, mesIdx, financas, vida,
    perfil: perfilDoMes(financas, vida, constancia),
    atividade, curta: ehRetroCurta(atividade),
    base, meuMes, corpo, sentir,
  };
};

/* --------------------------------------------------- versão curta: fatos */

export type TipoDoFato = "treinos" | "livros" | "habitos" | "diario" | "gastos" | "humor" | "agua" | "gratidao" | "dias" | "lancamentos";
export interface FatoDoMes { valor: number; rotulo: string; emoji: string; tipo: TipoDoFato }

/**
 * Os 1–2 fatos da retrospectiva CURTA: números reais que a pessoa fez, do
 * mais "dela" pro mais genérico. Nada de percentual, nada de saldo.
 */
export const fatosDaRetroCurta = (r: RetroMes): FatoDoMes[] => {
  const v = r.vida;
  const f = r.financas;
  const fatos: FatoDoMes[] = [];
  const add = (valor: number | undefined | null, um: string, muitos: string, emoji: string, tipo: TipoDoFato) => {
    if (valor && valor > 0) fatos.push({ valor, rotulo: valor === 1 ? um : muitos, emoji, tipo });
  };
  add(v?.treinos, "treino registrado", "treinos registrados", "🏋️", "treinos");
  add(v?.livros.length, "livro terminado", "livros terminados", "📖", "livros");
  if (v && v.habitosFeitos > 0) add(v.habitosFeitos, "hábito cumprido", "hábitos cumpridos", "✅", "habitos");
  else add(v?.diasAtivos, "dia de hábito marcado", "dias de hábito marcados", "✅", "habitos");
  add(v?.diasDeDiario, "dia de diário", "dias de diário", "✍️", "diario");
  add(f?.gastosAnotados, "gasto anotado", "gastos anotados", "🧾", "gastos");
  add(v?.diasComHumor, "dia com humor registrado", "dias com humor registrado", "💜", "humor");
  add(v?.copos, "copo d'água", "copos d'água", "💧", "agua");
  add(r.sentir?.gratidoes, "gratidão anotada", "gratidões anotadas", "🙏", "gratidao");
  if (fatos.length === 0) add(r.atividade.diasComRegistro, "dia com registro", "dias com registro", "📅", "dias");
  if (fatos.length === 0 && f) add(f.txCount, "lançamento no mês", "lançamentos no mês", "🧾", "lancamentos");
  return fatos.slice(0, 2);
};

/** O fato da página "1 fato de verdade" (26/09, temas): o número, o que ele conta, uma linha e o porquê. */
export interface FatoDaCurta { valor: number; rotulo: string; sub: string; porque: string; dinheiro: boolean; tipo: TipoDoFato }

const PORQUE_DO_FATO: Record<TipoDoFato, [string, string]> = {
  treinos: ["Cada treino anotado vira histórico.", "É com o histórico que dá pra ver a evolução: carga, frequência, constância."],
  livros: ["Terminado e anotado.", "É o começo da sua estante no CORE."],
  habitos: ["Marcado no seu planner.", "Cada hábito marcado é um dia que contou."],
  diario: ["Escrito só pra você.", "O que você escreve fica guardado só com você."],
  gastos: ["Já dá pra ver pra onde vai.", "Cada um deles é uma decisão que você viu acontecer."],
  humor: ["Anotado no seu planner.", "Com mais dias anotados, dá pra ver o que muda o seu humor."],
  agua: ["Anotado no seu planner.", "Com a água anotada, dá pra ver os dias em que você bateu a meta."],
  gratidao: ["Guardado só com você.", "Cada gratidão anotada fica guardada só com você."],
  dias: ["Anotado no seu planner.", "Cada dia anotado conta."],
  lancamentos: ["Tudo o que saiu, anotado num lugar só.", "Com tudo anotado, o mês fica claro."],
};

export const fatoDaCurta = (r: RetroMes): FatoDaCurta | null => {
  const [f] = fatosDaRetroCurta(r);
  if (!f) return null;
  const [sub, porque] = PORQUE_DO_FATO[f.tipo];
  if (f.tipo === "gastos") {
    // "em N dias" = os dias com gasto (não os dias com qualquer registro)
    const dias = r.financas?.diasComGasto.length ?? 0;
    const cats = (r.financas?.topCategories ?? []).slice(0, 2).map((c) => c.label);
    const frente = cats.length === 2 ? `${cats[0]} e ${cats[1]} na frente. ` : cats.length === 1 ? `${cats[0]} na frente. ` : "";
    return { ...f, rotulo: dias > 0 ? `${f.rotulo} em ${plural(dias, "dia", "dias")}` : f.rotulo, sub: `${frente}${sub}`, porque, dinheiro: true };
  }
  return { ...f, sub, porque, dinheiro: f.tipo === "lancamentos" };
};

/* ------------------------------------------------------------ o card */

export interface ConteudoDoCard {
  /** "SETEMBRO · 2026" (a fita) */
  fita: string;
  /** "O setembro de Ana foi" / "O seu setembro foi" */
  abertura: string;
  /** o nome do perfil, que vai no carimbo */
  carimbo: string;
  area: AreaDoPerfil;
  /** frase curta com dado real — sem comparação que não dá pra provar */
  frase: string;
  /** até 3 números; sem R$ a menos que a pessoa ligue "Mostrar valores" */
  numeros: { valor: string; rotulo: string }[];
  /** a tira dos dias do mês, com os anotados */
  tira: { total: number; marcados: number[] };
  /* (26/09, temas) o que os 3 cards (planner, revista, recortes) escrevem */
  mes: string;
  ano: number;
  mesIdx: number;
  /** o nome da etiqueta ("Ana Beatriz"); null = "o seu setembro" */
  nome: string | null;
  /** "21 dias anotados, 9 seguidos" */
  resumo: string;
  diasAnotados: number;
  /** a maior sequência (0 = nenhuma de 2+ dias) */
  seguidos: number;
  /** o 1º dia de uso (antes dele a grade fica pontilhada) */
  primeiroDia: number;
  /** o perfil em frase ("Constância de ferro") */
  perfil: string;
  /** a capa da revista: até 4 linhas "número + o que ele conta" (com R$ só se ligado) */
  linhas: { valor: string; rotulo: string }[];
  /** os adesivos do scrapbook — só o que a pessoa fez */
  adesivos: { treinos: number; livros: number; sequencia: number; agua: number };
  /** dias da base sem gastar nada (null sem gasto com data) */
  semGasto: number | null;
  /** R$ — só com o interruptor ligado; sem renda, só o que saiu */
  dinheiro: { valor: string; rotulo: string }[] | null;
}

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "d'"]);
const capitalizar = (p: string) => (p ? p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1) : p);

/**
 * O nome que a pessoa deu: o da Home (`core-user-name`), o do cadastro do
 * funil (`user-name`) ou o da conta (`full_name`). Sem nome, a retrospectiva
 * fala "o seu setembro" — nunca o começo do e-mail.
 */
export const nomeDaPessoa = (ler: Leitor, metadados?: { full_name?: unknown } | null): string | null => {
  for (const v of [ler("core-user-name"), ler("user-name"), metadados?.full_name]) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** "ana beatriz da silva" → "Ana" (o card fala do primeiro nome). */
export const primeiroNome = (nome: string | null | undefined): string | null => {
  const p = String(nome ?? "").trim().split(/\s+/)[0];
  return p ? capitalizar(p) : null;
};

/** "ana beatriz da silva" → "Ana Beatriz" (a capa aguenta dois nomes; partícula não entra). */
export const nomeDaCapa = (nome: string | null | undefined): string | null => {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return null;
  const segundo = partes[1] && !PARTICULAS.has(partes[1].toLowerCase()) && partes[0].length + partes[1].length <= 16 ? partes[1] : null;
  return [partes[0], segundo].filter(Boolean).map((p) => capitalizar(p as string)).join(" ");
};

const fraseDoCard = (r: RetroMes): string => {
  const m = r.mes.toLowerCase();
  const v = r.vida;
  const dias = r.atividade.diasComRegistro;
  const seq = r.meuMes?.sequencia?.dias ?? 0;
  const dosDias = dias > 0 ? `${plural(dias, "dia", "dias")} com a vida anotada${seq >= 2 ? `, ${seq} deles seguidos` : ""}.` : `Um ${m} anotado.`;
  switch (r.perfil.area) {
    case "corpo":
      if (v && v.treinos > 0) return `${plural(v.treinos, "treino", "treinos")}${dias > 0 ? ` e ${plural(dias, "dia", "dias")} anotados` : ""} em ${m}.`;
      if (r.corpo?.agua?.diasNaMeta) return `${plural(r.corpo.agua.diasNaMeta, "dia", "dias")} na meta de água em ${m}.`;
      return dosDias;
    case "leitura":
      return v && v.livros.length > 0 ? `${plural(v.livros.length, "livro terminado", "livros terminados")} em ${m}.` : dosDias;
    case "sentir":
      if (v && v.diasDeDiario > 0) return `${plural(v.diasDeDiario, "dia", "dias")} de diário em ${m}.`;
      if (v && v.diasComHumor > 0) return `Humor registrado em ${plural(v.diasComHumor, "dia", "dias")}.`;
      return dosDias;
    case "dinheiro":
      if (r.perfil.name === "Olho no Dinheiro" && r.financas?.gastosAnotados) return `${plural(r.financas.gastosAnotados, "gasto anotado", "gastos anotados")} em ${m}.`;
      if (r.financas?.temRenda && r.financas.balance >= 0) return `Fechou ${m} no azul.`;
      return dosDias;
    default:
      return dosDias;
  }
};

/** Os números da vida (sem dinheiro), na ordem em que importam. (26/09, temas: sem ✓ — a Inter embarcada não tem o glifo) */
const numerosDaVida = (r: RetroMes) => {
  const v = r.vida;
  const out: { valor: string; rotulo: string }[] = [];
  const add = (n: number | undefined | null, rotulo: string) => { if (n && n > 0) out.push({ valor: String(n), rotulo }); };
  add(r.atividade.diasComRegistro, r.atividade.diasComRegistro === 1 ? "DIA" : "DIAS");
  add(v?.treinos, v?.treinos === 1 ? "TREINO" : "TREINOS");
  add(v?.livros.length, v?.livros.length === 1 ? "LIVRO" : "LIVROS");
  add(v?.habitosFeitos, "HÁBITOS");
  add(r.financas?.gastosAnotados, "GASTOS");
  add(v?.diasDeDiario, "DIÁRIO");
  add(r.corpo?.agua?.diasNaMeta, "ÁGUA NA META");
  return out;
};

/**
 * As linhas da capa da revista ("14 · treinos · pernas em 1º"), na ordem do
 * mockup: treino, dias sem gastar, dia mais forte, livros — e o resto do que
 * a pessoa fez. Nada de texto dela (nome de hábito também não).
 */
const linhasDaRevista = (r: RetroMes) => {
  const v = r.vida;
  const out: { valor: string; rotulo: string }[] = [];
  const add = (valor: string | null, rotulo: string) => { if (valor) out.push({ valor, rotulo }); };
  const n = (x: number | undefined | null) => (x && x > 0 ? String(x) : null);
  const grupo = r.corpo?.grupos[0];
  if (v && v.treinos > 0) add(n(v.treinos), `${v.treinos === 1 ? "treino" : "treinos"}${grupo ? ` · ${grupo.rotulo.toLowerCase()} em 1º` : ""}`);
  const livres = r.financas?.diasSemGasto ?? 0;
  add(n(livres), livres === 1 ? "dia sem gastar nada" : "dias sem gastar nada");
  const forte = r.meuMes?.diaForte;
  if (forte) add(`${forte.feitos}/${forte.total}`, `${forte.plural} com a vida anotada`);
  add(n(v?.livros.length), v?.livros.length === 1 ? "livro lido" : "livros lidos");
  add(n(v?.habitosFeitos), "hábitos cumpridos");
  add(n(v?.diasDeDiario), v?.diasDeDiario === 1 ? "dia de diário" : "dias de diário");
  add(n(r.corpo?.agua?.diasNaMeta), "dias na meta de água");
  add(n(r.financas?.gastosAnotados), r.financas?.gastosAnotados === 1 ? "gasto anotado" : "gastos anotados");
  if (!out.length) add(n(r.atividade.diasComRegistro), "dias com a vida anotada");
  return out;
};

/**
 * Tudo o que o card escreve (puro — os testes olham aqui pra garantir que não
 * vaza R$ nem texto da pessoa). `valores` = o interruptor "Mostrar valores
 * em R$"; mesmo ligado, sem renda não existe saldo.
 */
export const conteudoDoCard = (r: RetroMes, opts: { valores?: boolean; nome?: string | null } = {}): ConteudoDoCard => {
  const m = r.mes.toLowerCase();
  const nome = primeiroNome(opts.nome);
  const vida = numerosDaVida(r);
  let numeros = vida.slice(0, 3);
  const f = r.financas;
  if (opts.valores && f) {
    if (f.temRenda) {
      numeros = [
        { valor: reais(f.income), rotulo: "ENTROU" },
        { valor: reais(f.outflow), rotulo: "SAIU" },
        f.balance >= 0 ? { valor: reais(f.balance), rotulo: "SOBROU" } : vida[0],
      ].filter(Boolean) as ConteudoDoCard["numeros"];
    } else {
      numeros = [{ valor: reais(f.outflow), rotulo: "GASTOS" }, ...vida.filter((n) => n.rotulo !== "GASTOS").slice(0, 2)];
    }
  }
  // (26/09, temas) o dinheiro dos cards da revista e dos recortes: entrou,
  // saiu e (se sobrou) sobrou; sem renda, só o que saiu. Nunca "faltou".
  const dinheiro = opts.valores && f
    ? f.temRenda
      ? [
          { valor: reais(f.income), rotulo: "entrou" },
          { valor: reais(f.outflow), rotulo: "saiu" },
          ...(f.balance >= 0 ? [{ valor: reais(f.balance), rotulo: "sobrou" }] : []),
        ]
      : [{ valor: reais(f.outflow), rotulo: "saiu no mês" }]
    : null;
  const revista = linhasDaRevista(r);
  const dias = r.atividade.diasComRegistro;
  const seguidos = r.meuMes?.sequencia?.dias ?? 0;
  const perfil = r.perfil.name.charAt(0) + r.perfil.name.slice(1).toLocaleLowerCase("pt-BR");
  return {
    fita: `${r.mes.toUpperCase()} · ${r.ano}`,
    abertura: nome ? `O ${m} de ${nome} foi` : `O seu ${m} foi`,
    carimbo: r.perfil.name,
    area: r.perfil.area,
    frase: fraseDoCard(r),
    numeros,
    tira: { total: r.base.diasDoMes, marcados: r.atividade.dias },
    mes: r.mes,
    ano: r.ano,
    mesIdx: r.mesIdx,
    nome: nomeDaCapa(opts.nome),
    resumo: `${plural(dias, "dia anotado", "dias anotados")}${seguidos >= 2 ? `, ${seguidos} seguidos` : ""}`,
    diasAnotados: dias,
    seguidos: seguidos >= 2 ? seguidos : 0,
    primeiroDia: r.base.primeiroDia,
    perfil,
    linhas: dinheiro ? [...dinheiro, ...revista].slice(0, 4) : revista.slice(0, 4),
    adesivos: {
      treinos: r.vida?.treinos ?? 0,
      livros: r.vida?.livros.length ?? 0,
      sequencia: seguidos >= 2 ? seguidos : 0,
      agua: r.corpo?.agua?.diasNaMeta ?? 0,
    },
    semGasto: r.financas?.diasSemGasto ?? null,
    dinheiro,
  };
};

/* ------------------------------------------------------------ o foco */

/** O mês depois do da retrospectiva ("outubro"). */
export const mesSeguinte = (r: Pick<RetroMes, "ano" | "mesIdx">) => {
  const mesIdx = (r.mesIdx + 1) % 12;
  return { ano: r.mesIdx === 11 ? r.ano + 1 : r.ano, mesIdx, nome: MESES[mesIdx], id: idDoMes(r.mesIdx === 11 ? r.ano + 1 : r.ano, mesIdx) };
};

/** Sugestões de foco pro mês seguinte, a partir do que a pessoa já faz. */
export const sugestoesDeFoco = (r: RetroMes): string[] => {
  const out: string[] = [];
  // sem repetir nem quase repetir ("Beber 2L de água" × "Beber 2L de água por dia")
  const add = (s: string) => {
    const k = s.toLowerCase();
    if (!out.some((x) => x.toLowerCase().includes(k) || k.includes(x.toLowerCase()))) out.push(s);
  };
  if (r.meuMes?.habitoCampeao) add(r.meuMes.habitoCampeao.nome);
  if (r.corpo && r.corpo.treinos > 0) add(`Treinar ${r.corpo.meta?.porSemana ?? 3}x por semana`);
  if (r.financas && r.financas.gastosAnotados > 0) add("Anotar todo gasto");
  if (r.vida && r.vida.livros.length > 0) add("Terminar mais 1 livro");
  if (r.sentir && r.sentir.porDia.length > 0) add("Registrar o humor todo dia");
  for (const s of ["Beber 2L de água por dia", "Dormir 7 horas", "Ler 10 páginas por dia", "Treinar 3x por semana"]) add(s);
  return out.slice(0, 4);
};

const CONTEXTO_PADRAO: Record<string, string> = {
  "Beber 2L de água por dia": "um cuidado simples pra começar",
  "Dormir 7 horas": "um cuidado por noite",
  "Ler 10 páginas por dia": "10 por dia viram 300 no mês",
  "Treinar 3x por semana": "começando pelo básico",
};

/**
 * As 3 opções da página de foco (26/09, temas), cada uma com a linha que
 * diz de onde ela veio ("você fez 14 treinos em setembro").
 */
export const opcoesDeFoco = (r: RetroMes): { texto: string; contexto: string }[] => {
  const m = r.mes.toLowerCase();
  const ctx = new Map<string, string>();
  const mm = r.meuMes?.habitoCampeao;
  if (mm) ctx.set(mm.nome, `${plural(mm.dias, "dia", "dias")} em ${m}`);
  if (r.corpo && r.corpo.treinos > 0) ctx.set(`Treinar ${r.corpo.meta?.porSemana ?? 3}x por semana`, `você fez ${plural(r.corpo.treinos, "treino", "treinos")} em ${m}`);
  const f = r.financas;
  if (f && f.gastosAnotados > 0) ctx.set("Anotar todo gasto", `${f.gastosAnotados} ${f.gastosAnotados === 1 ? "anotado" : "anotados"}${f.diasSemGasto ? `, ${plural(f.diasSemGasto, "dia", "dias")} sem gastar` : ""}`);
  if (r.vida && r.vida.livros.length > 0) ctx.set("Terminar mais 1 livro", `${plural(r.vida.livros.length, "livro", "livros")} em ${m}`);
  if (r.sentir && r.sentir.porDia.length > 0) ctx.set("Registrar o humor todo dia", `humor anotado em ${plural(r.sentir.porDia.length, "dia", "dias")}`);
  return sugestoesDeFoco(r).slice(0, 3).map((texto) => ({ texto, contexto: ctx.get(texto) ?? CONTEXTO_PADRAO[texto] ?? "" }));
};

/** O mês anterior ao de hoje, com o ano certo na virada de dezembro. */
export const mesAnterior = (agora = new Date()) => {
  const mesIdx = (agora.getMonth() + 11) % 12;
  const ano = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
  return { ano, mesIdx };
};
