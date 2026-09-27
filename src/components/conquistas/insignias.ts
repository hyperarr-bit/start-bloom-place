import { localDayKey, parseLocalDay } from "@/lib/utils";
import { CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, calcularSequencia, diasEfetivos } from "@/lib/sequencia";
import { aguaDoMes, atividadeDoMes, habitoCampeao, lerDadosDaVida, lerFinancasDoMes, type FinancasDoMes } from "@/lib/retrospectiva";
import { medirVida, recordeDeSequencia } from "@/components/gamification/badges-vida";
import { MIN_GASTOS_POUPANCA, lerMesesArquivados, mesesSeguidosNoAzul } from "@/components/gamification/badges-financas";
import { computeMonthlyBalance, computeMonthlyOutflow, computeSavingsRate } from "@/lib/finance-totals";
import { parcelaQuitada, somaParcelasDoMes, type Parcela } from "@/lib/finance-parcelas";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { recordesDoMes } from "@/lib/treino-evolucao";
import { DIAS, metaPadrao, semanasNaMeta } from "@/lib/treino-constancia";
import { inicioDoHabito, sequenciaDetox } from "@/lib/detox";

/**
 * INSÍGNIAS v3 (27/09, aprovado pelo dono — direção B · Esmalte): o CATÁLOGO
 * das 53 insígnias em 17 áreas, cada uma com a FONTE HONESTA (a chave do
 * storage + a conta que o app já faz), as 3 faixas (bronze · prata · ouro),
 * o orgulho (1–5: quanto dá vontade de postar) e o período (mês · agora ·
 * desde que começou). Tudo aqui é conta pura, sem React.
 *
 * Regras que valem pra todas (LEIA §4):
 * - só número que o app já calcula; "mês" só onde o registro tem data;
 * - dinheiro em % por padrão ("guardei 40% do que ganhei"); R$ e peso são
 *   SENSÍVEIS: só entram com "mostrar valores" ligado (`conquistas-mostrar-valores`);
 * - o herói do mês é automático (orgulho ≥ 4, com faixa, nunca água/remédio),
 *   e a pessoa pode trocar antes de postar;
 * - o mês que acabou é CONGELADO na virada (`conquistas-insignias-AAAA-MM`),
 *   porque a planilha de mês passado continua editável.
 */

export type AreaId =
  | "sequencia" | "financas" | "treino" | "dieta" | "rotina" | "saude" | "leitura" | "estudos" | "foco"
  | "metas" | "casa" | "beleza" | "pet" | "viagens" | "relacoes" | "detox" | "carreira";

export type Forma = "circulo" | "escudo" | "hexagono" | "flamula" | "losango" | "arco" | "quadrado" | "recortado";
export type Fmt = "int" | "pct" | "pctneg" | "kgneg" | "brl" | "kgmil" | "horas" | "meses";
export type Periodo = "mes" | "agora" | "sempre";
export type Faixa = "bronze" | "prata" | "ouro";
export const FAIXAS: Faixa[] = ["bronze", "prata", "ouro"];
export const NOME_FAIXA: Record<Faixa, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

export interface Area {
  nome: string;
  cor: string;
  cor2: string;
  glifo: string;
  forma: Forma;
  /** "Setembro foi de academia." */
  frase: string;
  rota: string;
}

export const AREAS: Record<AreaId, Area> = {
  sequencia: { nome: "Sequência", cor: "#ea580c", cor2: "#fdba74", glifo: "flame", forma: "flamula", frase: "não falhar", rota: "/home" },
  financas: { nome: "Finanças", cor: "#047857", cor2: "#6ee7b7", glifo: "piggy-bank", forma: "hexagono", frase: "guardar", rota: "/financas" },
  treino: { nome: "Treino", cor: "#2563eb", cor2: "#93c5fd", glifo: "dumbbell", forma: "escudo", frase: "academia", rota: "/treino" },
  dieta: { nome: "Dieta", cor: "#65a30d", cor2: "#d9f99d", glifo: "apple", forma: "losango", frase: "comer direito", rota: "/dieta" },
  rotina: { nome: "Rotina", cor: "#0d9488", cor2: "#99f6e4", glifo: "calendar-check", forma: "circulo", frase: "constância", rota: "/rotina" },
  saude: { nome: "Saúde", cor: "#dc2626", cor2: "#fca5a5", glifo: "heart-pulse", forma: "circulo", frase: "me cuidar", rota: "/saude" },
  leitura: { nome: "Leitura", cor: "#7c3aed", cor2: "#c4b5fd", glifo: "book-open", forma: "arco", frase: "ler", rota: "/biblioteca" },
  estudos: { nome: "Estudos", cor: "#4338ca", cor2: "#a5b4fc", glifo: "graduation-cap", forma: "hexagono", frase: "estudar", rota: "/estudos" },
  foco: { nome: "Mente", cor: "#6d28d9", cor2: "#ddd6fe", glifo: "brain", forma: "circulo", frase: "foco", rota: "/rotina" },
  metas: { nome: "Metas", cor: "#db2777", cor2: "#fbcfe8", glifo: "flag", forma: "escudo", frase: "riscar metas", rota: "/rotina" },
  casa: { nome: "Casa", cor: "#0891b2", cor2: "#a5f3fc", glifo: "house", forma: "quadrado", frase: "casa em ordem", rota: "/casa" },
  beleza: { nome: "Beleza", cor: "#c026d3", cor2: "#f5d0fe", glifo: "sparkles", forma: "recortado", frase: "autocuidado", rota: "/beleza" },
  pet: { nome: "Pet", cor: "#b45309", cor2: "#fcd34d", glifo: "paw-print", forma: "circulo", frase: "passeio", rota: "/pet" },
  viagens: { nome: "Viagens", cor: "#0369a1", cor2: "#bae6fd", glifo: "plane", forma: "quadrado", frase: "estrada", rota: "/viagens" },
  relacoes: { nome: "Relações", cor: "#9f1239", cor2: "#fda4af", glifo: "heart", forma: "circulo", frase: "gente", rota: "/relacionamentos" },
  detox: { nome: "Detox", cor: "#3f6212", cor2: "#bef264", glifo: "leaf", forma: "losango", frase: "desligar", rota: "/detox" },
  carreira: { nome: "Carreira", cor: "#475569", cor2: "#cbd5e1", glifo: "briefcase", forma: "escudo", frase: "carreira", rota: "/carreira" },
};

export interface DefinicaoInsignia {
  id: string;
  area: AreaId;
  /** Na página e no detalhe. */
  nome: string;
  /** Dentro do objeto, caixa alta e curto. */
  rotulo: string;
  unidade: [string, string];
  fmt: Fmt;
  periodo: Periodo;
  faixas: [number, number, number];
  orgulho: 1 | 2 | 3 | 4 | 5;
  glifo: string;
  /** Água e remédio nunca viram herói (LEIA §4). */
  nuncaHeroi?: boolean;
  /** R$ e peso: só com "mostrar valores" ligado. */
  sensivel?: boolean;
  /** O registro que a alimenta nasceu neste dia (a conta começa aqui, honestamente). */
  desde?: string;
  /** "Setembro foi de recorde." quando a frase da área não serve. */
  frase?: string;
}

const D = (o: DefinicaoInsignia) => o;

export const CATALOGO: DefinicaoInsignia[] = [
  // ---- Sequência (core-dias-anotados · lib/sequencia.ts) ----
  D({ id: "seq-viva", area: "sequencia", nome: "Dias seguidos", rotulo: "DIAS SEGUIDOS", unidade: ["dia seguido", "dias seguidos"], fmt: "int", periodo: "agora", faixas: [7, 30, 100], orgulho: 4, glifo: "flame" }),
  D({ id: "seq-mes", area: "sequencia", nome: "Dias anotados no mês", rotulo: "DIAS ANOTADOS", unidade: ["dia anotado", "dias anotados"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 3, glifo: "calendar-days" }),
  D({ id: "seq-recorde", area: "sequencia", nome: "Recorde de sequência", rotulo: "RECORDE", unidade: ["dia", "dias"], fmt: "int", periodo: "sempre", faixas: [30, 100, 365], orgulho: 4, glifo: "trophy" }),

  // ---- Finanças (finance-* · lerFinancasDoMes + finance-totals; badges-financas pros arquivados) ----
  D({ id: "fin-guardei", area: "financas", nome: "Guardei do que ganhei", rotulo: "DO QUE GANHEI", unidade: ["guardado", "guardado"], fmt: "pct", periodo: "mes", faixas: [10, 25, 45], orgulho: 5, glifo: "piggy-bank" }),
  D({ id: "fin-sobrou", area: "financas", nome: "Sobrou no mês", rotulo: "SOBROU", unidade: ["", ""], fmt: "brl", periodo: "mes", faixas: [200, 1000, 3000], orgulho: 4, glifo: "wallet", sensivel: true }),
  D({ id: "fin-sem-gastar", area: "financas", nome: "Dias sem gastar", rotulo: "DIAS SEM GASTAR", unidade: ["dia sem gastar", "dias sem gastar"], fmt: "int", periodo: "mes", faixas: [5, 10, 15], orgulho: 3, glifo: "ban" }),
  D({ id: "fin-menos", area: "financas", nome: "Gastei menos que no mês passado", rotulo: "A MENOS", unidade: ["", ""], fmt: "pctneg", periodo: "mes", faixas: [5, 10, 20], orgulho: 4, glifo: "trending-down", frase: "gastar menos" }),
  D({ id: "fin-reserva", area: "financas", nome: "Reserva de emergência", rotulo: "DE RESERVA", unidade: ["mês", "meses"], fmt: "meses", periodo: "sempre", faixas: [1, 3, 6], orgulho: 4, glifo: "shield", frase: "folga no bolso" }),
  D({ id: "fin-azul", area: "financas", nome: "Meses no azul seguidos", rotulo: "MESES NO AZUL", unidade: ["mês no azul", "meses no azul"], fmt: "int", periodo: "sempre", faixas: [1, 3, 6], orgulho: 4, glifo: "sun", frase: "folga no bolso" }),
  D({ id: "fin-dividas", area: "financas", nome: "Dívidas quitadas", rotulo: "QUITADAS", unidade: ["dívida quitada", "dívidas quitadas"], fmt: "int", periodo: "sempre", faixas: [1, 3, 6], orgulho: 4, glifo: "badge-check", frase: "zerar dívida" }),
  D({ id: "fin-delivery", area: "financas", nome: "Semanas sem delivery", rotulo: "SEM DELIVERY", unidade: ["semana sem delivery", "semanas sem delivery"], fmt: "int", periodo: "mes", faixas: [1, 2, 4], orgulho: 3, glifo: "utensils-crossed" }),
  D({ id: "fin-pago", area: "financas", nome: "Paguei de dívida no mês", rotulo: "DE DÍVIDA PAGA", unidade: ["", ""], fmt: "brl", periodo: "mes", faixas: [100, 500, 2000], orgulho: 4, glifo: "hand-coins", sensivel: true, frase: "zerar dívida" }),

  // ---- Treino (saude-workout-log, treino-weekly-volume, treino-exercise-history, saude-prs · lib/treino-*.ts) ----
  D({ id: "tre-mes", area: "treino", nome: "Treinos no mês", rotulo: "TREINOS", unidade: ["treino", "treinos"], fmt: "int", periodo: "mes", faixas: [8, 12, 18], orgulho: 5, glifo: "dumbbell" }),
  D({ id: "tre-semanas", area: "treino", nome: "Semanas seguidas na meta", rotulo: "SEMANAS NA META", unidade: ["semana na meta", "semanas na meta"], fmt: "int", periodo: "agora", faixas: [2, 4, 8], orgulho: 4, glifo: "calendar-check" }),
  D({ id: "tre-recordes", area: "treino", nome: "Recordes batidos no mês", rotulo: "RECORDES", unidade: ["recorde", "recordes"], fmt: "int", periodo: "mes", faixas: [1, 3, 6], orgulho: 5, glifo: "trophy", frase: "recorde" }),
  D({ id: "tre-volume", area: "treino", nome: "Carga levantada no mês", rotulo: "LEVANTADOS", unidade: ["kg", "kg"], fmt: "kgmil", periodo: "mes", faixas: [5000, 20000, 50000], orgulho: 4, glifo: "weight" }),
  D({ id: "tre-total", area: "treino", nome: "Treinos desde que começou", rotulo: "TREINOS", unidade: ["treino", "treinos"], fmt: "int", periodo: "sempre", faixas: [12, 50, 100], orgulho: 4, glifo: "medal" }),

  // ---- Dieta (dieta-diary-v2 · badges-vida.ts) ----
  D({ id: "die-impecaveis", area: "dieta", nome: "Dias impecáveis no mês", rotulo: "DIAS NA DIETA", unidade: ["dia impecável", "dias impecáveis"], fmt: "int", periodo: "mes", faixas: [7, 14, 20], orgulho: 5, glifo: "apple" }),
  D({ id: "die-refeicoes", area: "dieta", nome: "Refeições seguidas no mês", rotulo: "REFEIÇÕES", unidade: ["refeição seguida", "refeições seguidas"], fmt: "int", periodo: "mes", faixas: [30, 60, 100], orgulho: 3, glifo: "utensils" }),
  D({ id: "die-seguidos", area: "dieta", nome: "Dias impecáveis seguidos", rotulo: "SEGUIDOS NA DIETA", unidade: ["dia seguido", "dias seguidos"], fmt: "int", periodo: "sempre", faixas: [3, 7, 21], orgulho: 4, glifo: "flame" }),

  // ---- Saúde (water-log/core-saude-water, sleep-log/core-saude-sleep, core-saude-supplement-log, core-saude-measures) ----
  D({ id: "sau-agua", area: "saude", nome: "Dias de água na meta", rotulo: "DIAS DE ÁGUA", unidade: ["dia na meta", "dias na meta"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 2, glifo: "droplets", nuncaHeroi: true }),
  D({ id: "sau-sono", area: "saude", nome: "Noites na meta de sono", rotulo: "NOITES DE SONO", unidade: ["noite na meta", "noites na meta"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 3, glifo: "moon" }),
  D({ id: "sau-remedio", area: "saude", nome: "Remédios em dia", rotulo: "REMÉDIO EM DIA", unidade: ["dia", "dias"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 1, glifo: "pill", nuncaHeroi: true }),
  D({ id: "sau-peso", area: "saude", nome: "Peso a menos no mês", rotulo: "A MENOS", unidade: ["kg", "kg"], fmt: "kgneg", periodo: "mes", faixas: [1, 2, 4], orgulho: 5, glifo: "scale", sensivel: true }),

  // ---- Rotina (heatmap-log, rotina-habit-log, ritual-morning-checked, journal-entries · lib/retrospectiva.ts) ----
  D({ id: "rot-dias", area: "rotina", nome: "Dias de rotina no mês", rotulo: "DIAS DE ROTINA", unidade: ["dia de rotina", "dias de rotina"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 3, glifo: "calendar-check" }),
  D({ id: "rot-campeao", area: "rotina", nome: "Hábito campeão", rotulo: "DIAS DE", unidade: ["dia", "dias"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 4, glifo: "sprout" }),
  D({ id: "rot-recorde", area: "rotina", nome: "Recorde de rotina", rotulo: "DIAS SEGUIDOS", unidade: ["dia seguido", "dias seguidos"], fmt: "int", periodo: "sempre", faixas: [7, 21, 60], orgulho: 4, glifo: "flame" }),
  D({ id: "rot-ritual", area: "rotina", nome: "Manhãs com ritual", rotulo: "MANHÃS", unidade: ["manhã com ritual", "manhãs com ritual"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 3, glifo: "sunrise" }),
  D({ id: "rot-diario", area: "rotina", nome: "Dias de diário no mês", rotulo: "DIÁRIO", unidade: ["dia de diário", "dias de diário"], fmt: "int", periodo: "mes", faixas: [5, 15, 25], orgulho: 2, glifo: "pen-line" }),

  // ---- Mente / foco (PomodoroTimer: pomodoro-total-focus · pomodoro-log desde 27/09/2026) ----
  D({ id: "foc-total", area: "foco", nome: "Horas de foco desde que começou", rotulo: "DE FOCO", unidade: ["hora", "horas"], fmt: "horas", periodo: "sempre", faixas: [10, 50, 200], orgulho: 3, glifo: "brain" }),
  D({ id: "foc-mes", area: "foco", nome: "Horas de foco no mês", rotulo: "DE FOCO", unidade: ["hora", "horas"], fmt: "horas", periodo: "mes", faixas: [5, 20, 50], orgulho: 4, glifo: "timer", desde: "2026-09-27" }),

  // ---- Estudos (estudos-sessoes, estudos-aprendizados, estudos-revisoes) ----
  D({ id: "est-sessoes", area: "estudos", nome: "Sessões de estudo no mês", rotulo: "SESSÕES", unidade: ["sessão de estudo", "sessões de estudo"], fmt: "int", periodo: "mes", faixas: [4, 10, 20], orgulho: 4, glifo: "graduation-cap" }),
  D({ id: "est-aprendizados", area: "estudos", nome: "Aprendizados anotados no mês", rotulo: "APRENDIZADOS", unidade: ["aprendizado", "aprendizados"], fmt: "int", periodo: "mes", faixas: [5, 15, 30], orgulho: 3, glifo: "lightbulb" }),
  D({ id: "est-revisoes", area: "estudos", nome: "Revisões feitas", rotulo: "REVISÕES", unidade: ["revisão", "revisões"], fmt: "int", periodo: "sempre", faixas: [5, 20, 50], orgulho: 3, glifo: "repeat" }),

  // ---- Leitura (lib-books, lib-read-log, lib-year-goal) ----
  D({ id: "lei-livros", area: "leitura", nome: "Livros lidos no mês", rotulo: "LIVROS LIDOS", unidade: ["livro lido", "livros lidos"], fmt: "int", periodo: "mes", faixas: [1, 2, 4], orgulho: 5, glifo: "book-open" }),
  D({ id: "lei-paginas", area: "leitura", nome: "Páginas terminadas no mês", rotulo: "PÁGINAS", unidade: ["página", "páginas"], fmt: "int", periodo: "mes", faixas: [200, 500, 1000], orgulho: 4, glifo: "book-marked" }),
  D({ id: "lei-dias", area: "leitura", nome: "Dias de leitura no mês", rotulo: "DIAS LENDO", unidade: ["dia lendo", "dias lendo"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 3, glifo: "bookmark" }),
  D({ id: "lei-ano", area: "leitura", nome: "Livros no ano", rotulo: "LIVROS NO ANO", unidade: ["livro", "livros"], fmt: "int", periodo: "sempre", faixas: [3, 12, 25], orgulho: 4, glifo: "library" }),

  // ---- Metas (month-goals · goals-timeline) ----
  D({ id: "met-mes", area: "metas", nome: "Metas do mês batidas", rotulo: "METAS DO MÊS", unidade: ["meta batida", "metas batidas"], fmt: "int", periodo: "mes", faixas: [1, 3, 5], orgulho: 3, glifo: "flag" }),
  D({ id: "met-feitas", area: "metas", nome: "Metas da linha do tempo feitas", rotulo: "METAS FEITAS", unidade: ["meta concluída", "metas concluídas"], fmt: "int", periodo: "sempre", faixas: [1, 3, 10], orgulho: 4, glifo: "flag" }),

  // ---- Detox (detox-habits · lib/detox.ts) ----
  D({ id: "det-limpos", area: "detox", nome: "Dias limpos no mês", rotulo: "DIAS LIMPOS", unidade: ["dia limpo", "dias limpos"], fmt: "int", periodo: "mes", faixas: [7, 15, 30], orgulho: 4, glifo: "leaf" }),
  D({ id: "det-sequencia", area: "detox", nome: "Dias sem recaída", rotulo: "SEM RECAÍDA", unidade: ["dia", "dias"], fmt: "int", periodo: "agora", faixas: [7, 30, 90], orgulho: 4, glifo: "shield-check" }),

  // ---- Casa (casa-utilities · casa-maint-tasks) ----
  D({ id: "cas-luz", area: "casa", nome: "Luz a menos que no mês passado", rotulo: "DE LUZ A MENOS", unidade: ["", ""], fmt: "pctneg", periodo: "mes", faixas: [5, 10, 20], orgulho: 3, glifo: "zap" }),
  D({ id: "cas-manutencoes", area: "casa", nome: "Manutenções feitas no mês", rotulo: "MANUTENÇÕES", unidade: ["manutenção", "manutenções"], fmt: "int", periodo: "mes", faixas: [1, 3, 6], orgulho: 2, glifo: "wrench" }),

  // ---- Beleza (skincare-morning-checked / skincare-night-checked) ----
  D({ id: "bel-skincare", area: "beleza", nome: "Dias de skincare no mês", rotulo: "DIAS DE SKINCARE", unidade: ["dia de skincare", "dias de skincare"], fmt: "int", periodo: "mes", faixas: [10, 20, 28], orgulho: 3, glifo: "sparkles" }),

  // ---- Pet (pet-routine-AAAA-MM-DD · pet-diary) ----
  D({ id: "pet-passeios", area: "pet", nome: "Passeios no mês", rotulo: "PASSEIOS", unidade: ["passeio", "passeios"], fmt: "int", periodo: "mes", faixas: [8, 16, 26], orgulho: 3, glifo: "paw-print" }),
  D({ id: "pet-diario", area: "pet", nome: "Registros do pet no mês", rotulo: "DO PET", unidade: ["registro", "registros"], fmt: "int", periodo: "mes", faixas: [5, 15, 30], orgulho: 2, glifo: "notebook-pen" }),

  // ---- Viagens (travel-outings · travel-bucket · travel-trips-v2) ----
  D({ id: "via-passeios", area: "viagens", nome: "Rolês no mês", rotulo: "ROLÊS", unidade: ["rolê", "rolês"], fmt: "int", periodo: "mes", faixas: [2, 5, 10], orgulho: 3, glifo: "ticket" }),
  D({ id: "via-paises", area: "viagens", nome: "Países visitados", rotulo: "PAÍSES", unidade: ["país", "países"], fmt: "int", periodo: "sempre", faixas: [1, 3, 10], orgulho: 4, glifo: "earth" }),
  D({ id: "via-viagens", area: "viagens", nome: "Viagens feitas", rotulo: "VIAGENS", unidade: ["viagem", "viagens"], fmt: "int", periodo: "sempre", faixas: [1, 3, 10], orgulho: 4, glifo: "plane" }),

  // ---- Relações (rel-moments) ----
  D({ id: "rel-momentos", area: "relacoes", nome: "Momentos guardados no mês", rotulo: "MOMENTOS", unidade: ["momento", "momentos"], fmt: "int", periodo: "mes", faixas: [2, 5, 10], orgulho: 2, glifo: "heart" }),

  // ---- Carreira (career-jobs) ----
  D({ id: "car-candidaturas", area: "carreira", nome: "Candidaturas no mês", rotulo: "CANDIDATURAS", unidade: ["candidatura", "candidaturas"], fmt: "int", periodo: "mes", faixas: [3, 10, 25], orgulho: 3, glifo: "send" }),
  D({ id: "car-ofertas", area: "carreira", nome: "Ofertas recebidas", rotulo: "OFERTAS", unidade: ["oferta", "ofertas"], fmt: "int", periodo: "sempre", faixas: [1, 3, 5], orgulho: 4, glifo: "briefcase" }),
];

export const TOTAL_INSIGNIAS = CATALOGO.length;

/* ------------------------------------------------------------------------- *
 * Formato dos números
 * ------------------------------------------------------------------------- */

const ptBR = (n: number, max = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: max });

/** "19" · "40%" · "−12%" · "−2,1 kg" · "R$ 1.240" · "24 mil" · "12,5 h" · "1,8" */
export const fmtNum = (v: number, fmt: Fmt): string => {
  const n = Math.max(0, Number.isFinite(v) ? v : 0);
  switch (fmt) {
    case "pct": return `${Math.round(n)}%`;
    case "pctneg": return `−${Math.round(n)}%`;
    case "kgneg": return `−${ptBR(Math.round(n * 10) / 10, 1)} kg`;
    case "brl": return `R$ ${ptBR(Math.round(n))}`;
    case "kgmil": return n >= 1000 ? `${ptBR(n / 1000, n < 10000 ? 1 : 0)} mil` : String(Math.round(n));
    case "horas": return `${ptBR(Math.round(n * 2) / 2, 1)} h`;
    case "meses": return ptBR(Math.round(n * 10) / 10, 1);
    default: return String(Math.round(n));
  }
};

/** O alvo de uma faixa no mesmo formato ("25%", "R$ 1.000", "20 mil", "20 h"). */
export const fmtAlvo = (v: number, fmt: Fmt): string => {
  switch (fmt) {
    case "pct": case "pctneg": return `${v}%`;
    case "kgneg": return `${ptBR(v, 1)} kg`;
    case "brl": return `R$ ${ptBR(v)}`;
    case "kgmil": return v >= 1000 ? `${ptBR(v / 1000)} mil` : String(v);
    case "horas": return `${ptBR(v)} h`;
    case "meses": return `${v} ${v === 1 ? "mês" : "meses"}`;
    default: return String(v);
  }
};

export const faixaDe = (valor: number, faixas: [number, number, number]): Faixa | null => {
  let f: Faixa | null = null;
  faixas.forEach((p, i) => { if (valor >= p) f = FAIXAS[i]; });
  return f;
};

export const proximaFaixa = (valor: number, faixas: [number, number, number]): { faixa: Faixa; alvo: number } | null => {
  const i = faixas.findIndex((p) => valor < p);
  return i < 0 ? null : { faixa: FAIXAS[i], alvo: faixas[i] };
};

/* ------------------------------------------------------------------------- *
 * A insígnia montada (definição + o número de verdade)
 * ------------------------------------------------------------------------- */

export interface Insignia extends DefinicaoInsignia {
  valor: number;
  faixa: Faixa | null;
  estrelas: 0 | 1 | 2 | 3;
  proxima: { faixa: Faixa; alvo: number } | null;
  temDado: boolean;
  /** "19" · "40%" — o número como vai dentro do objeto. */
  texto: string;
  /** "treinos" · "do que ganhei" — a unidade curta embaixo do número. */
  unid: string;
  /** Complemento honesto ("Meditar" no hábito campeão, "de 5" nas metas, "sem Instagram" no detox, "com o Thor"). */
  sub?: string;
  cor: string;
  cor2: string;
  areaNome: string;
  forma: Forma;
  rota: string;
}

/** A unidade curta que aparece embaixo do número no objeto. */
const unidadeCurta = (d: DefinicaoInsignia, valor: number): string => {
  switch (d.fmt) {
    case "pct": return "do que ganhei";
    case "pctneg": return d.id === "cas-luz" ? "de luz" : "de gastos";
    case "kgneg": return "no mês";
    case "brl": return d.id === "fin-pago" ? "de dívida paga" : "sobrou";
    case "kgmil": return "kg";
    case "horas": return "";
    case "meses": return valor === 1 ? "mês" : "meses";
    default: return valor === 1 ? d.unidade[0] : d.unidade[1];
  }
};

export interface Medida { valor: number; sub?: string; faixas?: [number, number, number] }
export type Medidas = Record<string, Medida>;

export const montarInsignia = (d: DefinicaoInsignia, m: Medida | undefined): Insignia => {
  const faixas = m?.faixas ?? d.faixas;
  const valor = Math.max(0, Number.isFinite(m?.valor ?? 0) ? (m?.valor ?? 0) : 0);
  const faixa = faixaDe(valor, faixas);
  const a = AREAS[d.area];
  return {
    ...d,
    faixas,
    valor,
    faixa,
    estrelas: faixa ? ((FAIXAS.indexOf(faixa) + 1) as 1 | 2 | 3) : 0,
    proxima: proximaFaixa(valor, faixas),
    temDado: valor > 0,
    texto: fmtNum(valor, d.fmt),
    unid: unidadeCurta(d, valor),
    sub: m?.sub,
    cor: a.cor,
    cor2: a.cor2,
    areaNome: a.nome,
    forma: a.forma,
    rota: a.rota,
  };
};

/* ------------------------------------------------------------------------- *
 * As medidas: cada número da SUA chave (LEIA §4, coluna "fonte honesta")
 * ------------------------------------------------------------------------- */

export type Get = <T>(key: string, fallback: T) => T;

const ehDia = (k: unknown): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pad2 = (n: number) => String(n).padStart(2, "0");
export const idDoMes = (ano: number, mesIdx: number) => `${ano}-${pad2(mesIdx + 1)}`;
const mesAnteriorDe = (ano: number, mesIdx: number) => (mesIdx === 0 ? { ano: ano - 1, mesIdx: 11 } : { ano, mesIdx: mesIdx - 1 });

/** Dia LOCAL de uma data gravada (chave de dia ou ISO — o diário do pet grava toISOString). */
const diaLocalDe = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  if (ehDia(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : localDayKey(d);
};

const soma = (itens: unknown[]) => itens.reduce<number>((s, i) => s + num((i as { value?: unknown })?.value), 0);

/** Só os lançamentos do mês (os sem data ficam — na dúvida não se tira nada). */
const doMesFin = <T extends { date?: unknown }>(itens: T[], mesId: string): T[] =>
  itens.filter((i) => typeof i?.date !== "string" || !/^\d{4}-\d{2}/.test(i.date) || i.date.startsWith(`${mesId}-`));

interface TotaisDoMes { receitas: number; saida: number; medido: boolean; expenses: { date?: string; category?: string }[]; fixos: number; parcelas: number }

const totaisDe = (f: FinancasDoMes, mesId: string): TotaisDoMes => {
  const incomes = doMesFin(f.incomes, mesId);
  const expenses = doMesFin(f.expenses, mesId);
  const receitas = soma(incomes);
  const variaveis = soma(expenses);
  const fixos = soma(f.fixed);
  const parcelas = somaParcelasDoMes(f.parcelas as Parcela[]);
  const saida = computeMonthlyOutflow(variaveis, fixos, parcelas);
  return {
    receitas, saida, fixos, parcelas,
    expenses: expenses as { date?: string; category?: string }[],
    medido: receitas > 0 && expenses.length + f.fixed.length >= MIN_GASTOS_POUPANCA && saida > 0,
  };
};

/**
 * Mede as 53 insígnias pro mês (ano, mesIdx) — por padrão o mês de `hoje`.
 * Devolve só os NÚMEROS (e o complemento honesto); quem monta é `montarInsignias`.
 */
export function medirInsignias(get: Get, hoje: string = localDayKey(), mesAlvo?: { ano: number; mesIdx: number }): Medidas {
  const agora = parseLocalDay(hoje);
  const ano = mesAlvo?.ano ?? agora.getFullYear();
  const mesIdx = mesAlvo?.mesIdx ?? agora.getMonth();
  const mesId = idDoMes(ano, mesIdx);
  const noMes = (d: unknown): d is string => typeof d === "string" && d.startsWith(`${mesId}-`);
  const diaLocalNoMes = (v: unknown) => { const d = diaLocalDe(v); return !!d && noMes(d); };
  const mesCorrente = ano === agora.getFullYear() && mesIdx === agora.getMonth();
  const ultimoDia = mesCorrente ? agora.getDate() : new Date(ano, mesIdx + 1, 0).getDate();
  const fimDoMes = mesCorrente ? hoje : `${mesId}-${pad2(ultimoDia)}`;
  const ler = (k: string) => get<unknown>(k, undefined);
  const M: Medidas = {};
  const marcar = (id: string, valor: number, extra: Partial<Medida> = {}) => { M[id] = { valor: Number.isFinite(valor) ? valor : 0, ...extra }; };

  // ---------- sequência ----------
  const efetivos = diasEfetivos(get<unknown>(CHAVE_DIAS_ANOTADOS, undefined), get<unknown>(CHAVE_HUB_STREAK, null), hoje);
  const seq = calcularSequencia(efetivos, hoje);
  marcar("seq-viva", seq.dias);
  marcar("seq-mes", efetivos.filter(noMes).length);
  marcar("seq-recorde", seq.recorde);

  // ---------- vida (o snapshot dos módulos, lido UMA vez) ----------
  const vida = medirVida(get, hoje);
  const dados = lerDadosDaVida(ler);

  // ---------- finanças (o perfil ativo; o mês pela data; fixos + parcelas como o Painel) ----------
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const fin = totaisDe(lerFinancasDoMes(ano, mesIdx, ler, perfil, agora), mesId);
  const ant = mesAnteriorDe(ano, mesIdx);
  const finAnt = totaisDe(lerFinancasDoMes(ant.ano, ant.mesIdx, ler, perfil, agora), idDoMes(ant.ano, ant.mesIdx));
  marcar("fin-guardei", fin.medido ? Math.max(0, computeSavingsRate(fin.receitas, fin.saida)) : 0);
  marcar("fin-sobrou", fin.medido ? Math.max(0, computeMonthlyBalance(fin.receitas, fin.saida)) : 0);
  // dias da base do mês (do 1º registro datado até hoje) sem gasto anotado — só com o mês anotado
  const gastosDatados = fin.expenses.filter((e) => noMes(e.date)).length;
  if (gastosDatados >= MIN_GASTOS_POUPANCA) {
    const primeiro = atividadeDoMes(ano, mesIdx, dados, { incomes: [], expenses: fin.expenses, fixed: [], parcelas: [] }).primeiroDia ?? 1;
    const comGasto = new Set(fin.expenses.map((e) => e.date).filter(noMes));
    let semGasto = 0;
    for (let d = primeiro; d <= ultimoDia; d++) if (!comGasto.has(`${mesId}-${pad2(d)}`)) semGasto++;
    marcar("fin-sem-gastar", semGasto);
    // semanas cheias do mês (janelas de 7 dias a partir do dia 1) sem gasto em "delivery"
    const delivery = new Set(fin.expenses.filter((e) => e.category === "delivery" && noMes(e.date)).map((e) => e.date as string));
    let semDelivery = 0;
    for (let inicio = 1; inicio + 6 <= ultimoDia; inicio += 7) {
      let limpa = true;
      for (let d = inicio; d < inicio + 7; d++) if (delivery.has(`${mesId}-${pad2(d)}`)) limpa = false;
      if (limpa) semDelivery++;
    }
    marcar("fin-delivery", semDelivery);
  } else {
    marcar("fin-sem-gastar", 0);
    marcar("fin-delivery", 0);
  }
  marcar("fin-menos", fin.medido && finAnt.medido && finAnt.saida > 0 ? Math.max(0, ((finAnt.saida - fin.saida) / finAnt.saida) * 100) : 0);
  const reserva = objeto(ler("finance-emergency-fund"));
  marcar("fin-reserva", fin.saida > 0 ? num(reserva.guardado) / fin.saida : 0);
  marcar("fin-azul", mesesSeguidosNoAzul(lerMesesArquivados(get, agora, perfil)));
  // dívidas quitadas: entre pessoas (saldo voltou a zero depois de existir) + parcelamentos 100% pagos
  type Lanc = { data?: unknown; valor?: unknown };
  type Divida = { direcao?: unknown; lancamentos?: unknown };
  const dividas = lista(ler("finance-dividas-pessoas")) as Divida[];
  const devo = dividas.filter((d) => d?.direcao === "devo");
  const quitadasPessoas = devo.filter((d) => {
    const l = lista(d.lancamentos) as Lanc[];
    const teveDivida = l.some((x) => num(x?.valor) > 0);
    const saldo = l.reduce((s, x) => s + num(x?.valor), 0);
    return teveDivida && saldo <= 0.005;
  }).length;
  const parcelamentos = lista(ler("finance-installments")) as Parcela[];
  marcar("fin-dividas", quitadasPessoas + parcelamentos.filter((p) => p && parcelaQuitada(p)).length);
  marcar("fin-pago", devo.reduce((s, d) => s + (lista(d.lancamentos) as Lanc[]).filter((x) => noMes(x?.data) && num(x?.valor) < 0).reduce((t, x) => t - num(x.valor), 0), 0));

  // ---------- treino ----------
  marcar("tre-mes", vida.treinos.filter(noMes).length);
  const metaSalva = Number(get<unknown>("treino-meta-semanal", null));
  const diasDoPlano = lista(get<unknown>("treino-active-days", [])).filter((d): d is string => typeof d === "string" && DIAS.includes(d));
  const meta = metaSalva > 0 ? metaSalva : metaPadrao(diasDoPlano);
  marcar("tre-semanas", semanasNaMeta(vida.treinos, meta, agora).sequencia);
  const prs = lista(ler("saude-prs")).filter((p) => noMes((p as { date?: unknown })?.date)).length;
  marcar("tre-recordes", recordesDoMes(dados.treino?.historico ?? [], ano, mesIdx).length + prs);
  const volume = objeto(ler("treino-weekly-volume"));
  marcar("tre-volume", Object.entries(volume).filter(([k]) => noMes(k)).reduce((s, [, v]) => s + Math.max(0, num(v)), 0));
  marcar("tre-total", vida.treinos.length);

  // ---------- dieta ----------
  marcar("die-impecaveis", vida.diasImpecaveis.filter(noMes).length);
  type DiaDieta = { meals?: Record<string, { followed?: boolean }> };
  const diarioDieta = objeto(ler("dieta-diary-v2")) as Record<string, DiaDieta>;
  marcar("die-refeicoes", Object.entries(diarioDieta).filter(([k]) => noMes(k)).reduce((s, [, d]) => s + Object.values(d?.meals ?? {}).filter((m) => m?.followed === true).length, 0));
  marcar("die-seguidos", vida.recordeDieta);

  // ---------- saúde ----------
  const agua = aguaDoMes(ano, mesIdx, dados);
  marcar("sau-agua", [...agua.porDia.values()].filter((n) => n >= vida.metaAgua).length);
  const metaSono = Math.min(12, Math.max(4, Number(get<unknown>("core-saude-sleep-goal", 8)) || 8));
  const horasPorNoite = new Map<string, number>();
  for (const reg of [dados.sono, dados.sonoHub]) for (const [k, v] of Object.entries(reg ?? {})) if (noMes(k)) horasPorNoite.set(k, Math.max(horasPorNoite.get(k) ?? 0, num(v)));
  marcar("sau-sono", [...horasPorNoite.values()].filter((h) => h >= metaSono).length);
  marcar("sau-remedio", Object.entries(objeto(ler("core-saude-supplement-log"))).filter(([k, v]) => noMes(k) && Array.isArray(v) && v.length > 0).length);
  type Medicao = { date?: unknown; peso?: unknown; weight?: unknown };
  const medicoes = (lista(ler("core-saude-measures")) as Medicao[])
    .map((m) => ({ dia: diaLocalDe(m?.date), kg: num(String(m?.weight ?? m?.peso ?? "").replace(",", ".")) }))
    .filter((m) => m.dia && noMes(m.dia) && m.kg > 0)
    .sort((a, b) => a.dia!.localeCompare(b.dia!));
  marcar("sau-peso", medicoes.length >= 2 ? Math.max(0, medicoes[0].kg - medicoes[medicoes.length - 1].kg) : 0);

  // ---------- rotina ----------
  marcar("rot-dias", vida.diasAtivos.filter(noMes).length);
  const campeao = habitoCampeao(ano, mesIdx, dados);
  marcar("rot-campeao", campeao?.dias ?? 0, campeao ? { sub: campeao.nome } : {});
  marcar("rot-recorde", vida.recordeRotina);
  marcar("rot-ritual", Object.entries(objeto(ler("ritual-morning-checked"))).filter(([k, v]) => noMes(k) && Array.isArray(v) && v.length > 0).length);
  type Entrada = { gratitude?: unknown; learned?: unknown; tomorrow?: unknown } | null;
  marcar("rot-diario", Object.entries(objeto(ler("journal-entries")) as Record<string, Entrada>).filter(([k, e]) => noMes(k) && ((Array.isArray(e?.gratitude) && e!.gratitude.filter(Boolean).length > 0) || !!e?.learned || !!e?.tomorrow)).length);

  // ---------- mente / foco ----------
  marcar("foc-total", vida.minutosDeFoco / 60);
  marcar("foc-mes", Object.entries(objeto(ler("pomodoro-log"))).filter(([k]) => noMes(k)).reduce((s, [, v]) => s + Math.max(0, num(v)), 0) / 60);

  // ---------- estudos ----------
  marcar("est-sessoes", lista(ler("estudos-sessoes")).filter((s) => noMes((s as { data?: unknown })?.data)).length);
  marcar("est-aprendizados", Object.values(objeto(ler("estudos-aprendizados"))).reduce<number>((s, l) => s + lista(l).filter((a) => noMes((a as { data?: unknown })?.data)).length, 0));
  marcar("est-revisoes", Object.values(objeto(ler("estudos-revisoes"))).reduce<number>((s, e) => s + Math.max(0, num((e as { vezes?: unknown })?.vezes)), 0));

  // ---------- leitura ----------
  const lidosNoMes = vida.livros.filter((b) => b?.status === "lido" && noMes(b.endDate));
  marcar("lei-livros", lidosNoMes.length);
  marcar("lei-paginas", lidosNoMes.reduce((s, b) => s + Math.max(0, num(b.pages)), 0));
  marcar("lei-dias", new Set(lista(ler("lib-read-log")).filter((d) => noMes(d))).size);
  const lidosNoAno = vida.livros.filter((b) => b?.status === "lido" && typeof b.endDate === "string" && b.endDate.startsWith(`${ano}-`)).length;
  marcar("lei-ano", lidosNoAno, { faixas: [3, Math.min(24, Math.max(12, vida.metaDoAno)), 25] });

  // ---------- metas ----------
  type Meta = { done?: unknown };
  const metasDoMes = lista(objeto(ler("month-goals"))[mesId]) as Meta[];
  marcar("met-mes", metasDoMes.filter((m) => !!m?.done).length, metasDoMes.length ? { sub: `de ${metasDoMes.length}` } : {});
  marcar("met-feitas", vida.metasConcluidas);

  // ---------- detox ----------
  type Detox = { name?: unknown; startDate?: string; createdAt?: string; relapses?: string[] };
  const habitosDetox = (lista(ler("detox-habits")) as Detox[]).filter((h) => h && typeof h === "object");
  let limpos: { n: number; nome: string } | null = null;
  let semRecaida: { n: number; nome: string } | null = null;
  for (const h of habitosDetox) {
    const nome = typeof h.name === "string" ? h.name : "";
    const inicio = inicioDoHabito(h);
    if (inicio && inicio <= fimDoMes) {
      const de = inicio > `${mesId}-01` ? Number(inicio.slice(8, 10)) : 1;
      const recaidas = new Set((h.relapses ?? []).filter((r) => noMes(r)));
      let n = 0;
      for (let d = de; d <= ultimoDia; d++) if (!recaidas.has(`${mesId}-${pad2(d)}`)) n++;
      if (!limpos || n > limpos.n) limpos = { n, nome };
    }
    const s = sequenciaDetox(h, agora);
    if (!semRecaida || s > semRecaida.n) semRecaida = { n: s, nome };
  }
  marcar("det-limpos", limpos?.n ?? 0, limpos?.nome ? { sub: `sem ${limpos.nome}` } : {});
  marcar("det-sequencia", semRecaida?.n ?? 0, semRecaida?.nome ? { sub: `sem ${semRecaida.nome}` } : {});

  // ---------- casa ----------
  type Utilidade = { type?: unknown; month?: unknown; consumption?: unknown };
  const luz = (lista(ler("casa-utilities")) as Utilidade[]).filter((u) => u?.type === "luz");
  const consumoDe = (m: string) => luz.filter((u) => u.month === m).reduce((s, u) => s + Math.max(0, num(u.consumption)), 0);
  const luzMes = consumoDe(mesId), luzAnt = consumoDe(idDoMes(ant.ano, ant.mesIdx));
  marcar("cas-luz", luzMes > 0 && luzAnt > 0 ? Math.max(0, ((luzAnt - luzMes) / luzAnt) * 100) : 0);
  marcar("cas-manutencoes", lista(ler("casa-maint-tasks")).filter((t) => noMes((t as { lastDone?: unknown })?.lastDone)).length);

  // ---------- beleza ----------
  const skincare = new Set<string>();
  for (const k of ["skincare-morning-checked", "skincare-night-checked"]) for (const [dia, v] of Object.entries(objeto(ler(k)))) if (noMes(dia) && Array.isArray(v) && v.length > 0) skincare.add(dia);
  marcar("bel-skincare", skincare.size);

  // ---------- pet ----------
  type Pet = { id?: unknown; name?: unknown };
  const pets = (lista(ler("pet-list")) as Pet[]).filter((p) => p && typeof p === "object");
  const passeiosPorPet = new Map<string, number>();
  for (let d = 1; d <= ultimoDia; d++) {
    const rotina = objeto(ler(`pet-routine-${mesId}-${pad2(d)}`));
    for (const [petId, tarefas] of Object.entries(rotina)) if (objeto(tarefas).walk === true) passeiosPorPet.set(petId, (passeiosPorPet.get(petId) ?? 0) + 1);
  }
  let melhorPet: { id: string; n: number } | null = null;
  for (const [id, n] of passeiosPorPet) if (!melhorPet || n > melhorPet.n) melhorPet = { id, n };
  const nomeDoPet = melhorPet ? pets.find((p) => String(p.id) === melhorPet!.id)?.name : undefined;
  marcar("pet-passeios", melhorPet?.n ?? 0, typeof nomeDoPet === "string" && nomeDoPet ? { sub: `com ${nomeDoPet}` } : {});
  marcar("pet-diario", lista(ler("pet-diary")).filter((e) => diaLocalNoMes((e as { date?: unknown })?.date)).length);

  // ---------- viagens ----------
  marcar("via-passeios", lista(ler("travel-outings")).filter((o) => noMes((o as { date?: unknown })?.date)).length);
  type Destino = { visited?: unknown; country?: unknown };
  marcar("via-paises", new Set((lista(ler("travel-bucket")) as Destino[]).filter((d) => d?.visited === true && typeof d.country === "string" && d.country.trim()).map((d) => String(d.country).trim().toLowerCase())).size);
  type Viagem = { endDate?: unknown };
  marcar("via-viagens", (lista(objeto(ler("travel-trips-v2")).trips) as Viagem[]).filter((t) => ehDia(t?.endDate) && t.endDate <= hoje).length);

  // ---------- relações ----------
  marcar("rel-momentos", lista(ler("rel-moments")).filter((m) => diaLocalNoMes((m as { date?: unknown })?.date)).length);

  // ---------- carreira ----------
  type Vaga = { date?: unknown; status?: unknown };
  const vagas = lista(ler("career-jobs")) as Vaga[];
  marcar("car-candidaturas", vagas.filter((v) => diaLocalNoMes(v?.date)).length);
  marcar("car-ofertas", vagas.filter((v) => v?.status === "oferta").length);

  return M;
}

/** As 53 montadas com os números de verdade (inclui as sensíveis: quem filtra é `ordenarPagina`). */
export const montarInsignias = (get: Get, hoje: string = localDayKey(), mesAlvo?: { ano: number; mesIdx: number }): Insignia[] => {
  const medidas = medirInsignias(get, hoje, mesAlvo);
  return CATALOGO.map((d) => montarInsignia(d, medidas[d.id]));
};

/* ------------------------------------------------------------------------- *
 * Quem é o herói
 * ------------------------------------------------------------------------- */

/**
 * Pontuação do herói (LEIA §5): só com faixa, orgulho ≥ 4, nunca água/remédio,
 * sensível só com "mostrar valores". orgulho × (estrelas + 1) × 1,25 se é do
 * mês + a fração até a próxima faixa (desempate).
 */
export const pontuar = (i: Insignia, valoresLigados = false): number => {
  if (i.nuncaHeroi || (i.sensivel && !valoresLigados) || !i.faixa || i.orgulho < 4) return 0;
  return i.orgulho * (i.estrelas + 1) * (i.periodo === "mes" ? 1.25 : 1) + (i.proxima ? i.valor / i.proxima.alvo : 1);
};

/** Os `n` melhores de ÁREAS diferentes (o Story "Minhas 3 conquistas"). */
export const herois = (lista: Insignia[], n = 3, valoresLigados = false): Insignia[] => {
  const ordem = lista.filter((i) => pontuar(i, valoresLigados) > 0).sort((a, b) => pontuar(b, valoresLigados) - pontuar(a, valoresLigados));
  const out: Insignia[] = [];
  for (const i of ordem) {
    if (out.length >= n) break;
    if (out.some((o) => o.area === i.area)) continue;
    out.push(i);
  }
  return out;
};

/** As candidatas a herói (pra pessoa TROCAR antes de postar), da melhor pra pior. */
export const candidatasAHeroi = (lista: Insignia[], valoresLigados = false): Insignia[] =>
  lista.filter((i) => pontuar(i, valoresLigados) > 0).sort((a, b) => pontuar(b, valoresLigados) - pontuar(a, valoresLigados));

export interface PaginaOrdenada {
  /** Com faixa (o herói de verdade) ou, sem nenhuma faixa, a com dado mais perto do bronze (estado "pouco dado"). */
  heroi: Insignia | null;
  /** O herói tem faixa (senão é o "suas primeiras insígnias"). */
  heroiConquistado: boolean;
  /** As outras, na ordem da página: com dado por orgulho × faixa, depois as trancadas mais perto. */
  resto: Insignia[];
  /** Quantas sensíveis ficaram fora por "mostrar valores" desligado. */
  escondidas: number;
  visiveis: Insignia[];
  conquistadas: number;
  deOuro: number;
}

export const ordenarPagina = (lista: Insignia[], { valoresLigados = false } = {}): PaginaOrdenada => {
  const visiveis = lista.filter((i) => valoresLigados || !i.sensivel);
  const escondidas = valoresLigados ? 0 : lista.filter((i) => i.sensivel).length;
  const h = herois(visiveis, 1, valoresLigados)[0] ?? null;
  const peso = (i: Insignia) => i.orgulho * (i.estrelas + 1);
  const perto = (i: Insignia) => i.valor / i.faixas[0];
  const comDado = visiveis.filter((i) => i.temDado && i !== h).sort((a, b) => peso(b) - peso(a) || perto(b) - perto(a));
  const semDado = visiveis.filter((i) => !i.temDado).sort((a, b) => b.orgulho - a.orgulho);
  let heroi = h;
  if (!heroi) {
    // pouco dado: a insígnia com dado mais perto do bronze vira o herói (sem metal)
    const maisPerto = [...comDado].sort((a, b) => perto(b) - perto(a))[0] ?? null;
    if (maisPerto) { heroi = maisPerto; comDado.splice(comDado.indexOf(maisPerto), 1); }
  }
  return {
    heroi,
    heroiConquistado: !!heroi?.faixa,
    resto: [...comDado, ...semDado],
    escondidas,
    visiveis,
    conquistadas: visiveis.filter((i) => !!i.faixa).length,
    deOuro: visiveis.filter((i) => i.faixa === "ouro").length,
  };
};

/* ------------------------------------------------------------------------- *
 * As frases (os Stories e a página)
 * ------------------------------------------------------------------------- */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeDoMes = (mesIdx: number) => MESES[((mesIdx % 12) + 12) % 12];
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Setembro foi de academia." */
export const fraseDe = (i: Insignia, mesIdx = new Date().getMonth()): string => {
  const mes = capitalizar(nomeDoMes(mesIdx));
  if (i.id === "rot-campeao" && i.sub) return `${mes} foi de ${i.sub.toLowerCase()}.`;
  if ((i.id === "det-limpos" || i.id === "det-sequencia") && i.sub) return `${mes} foi de ficar ${i.sub}.`;
  if (i.id === "det-limpos" || i.id === "det-sequencia") return `${mes} foi de ficar longe.`;
  return `${mes} foi de ${i.frase ?? AREAS[i.area].frase}.`;
};

/** "19 treinos" · "Guardei 40% do que ganhei" · "−12% de gastos que em agosto" — a linha que fala o número. */
export const linhaDe = (i: Insignia, mesIdx = new Date().getMonth()): string => {
  const anterior = nomeDoMes(mesIdx - 1);
  if (i.fmt === "pct") return `Guardei ${i.texto} do que ganhei`;
  if (i.fmt === "pctneg") return i.id === "cas-luz" ? `${i.texto} de luz que em ${anterior}` : `${i.texto} de gastos que em ${anterior}`;
  if (i.fmt === "kgneg") return `${i.texto} no mês`;
  if (i.fmt === "brl") return i.id === "fin-pago" ? `${i.texto} de dívida paga` : `Sobraram ${i.texto}`;
  if (i.fmt === "kgmil") return `${i.texto} kg levantados`;
  if (i.fmt === "horas") return `${i.texto} de foco`;
  if (i.fmt === "meses") return `${i.texto} ${i.unid} de reserva`;
  if (i.id === "rot-campeao" && i.sub) return `${i.sub}: ${i.texto} dias`;
  if (i.id === "det-limpos" && i.sub) return `${i.texto} dias ${i.sub}`;
  if (i.id === "pet-passeios" && i.sub) return `${i.texto} passeios ${i.sub}`;
  if (i.id === "met-mes" && i.sub) return `${i.texto} ${i.sub} metas do mês`;
  return `${i.texto} ${i.unid}`.trim();
};

/** "setembro" · "agora" · "desde que começou" — o período no detalhe. */
export const periodoTexto = (i: Insignia, mesIdx = new Date().getMonth()): string =>
  i.periodo === "mes" ? nomeDoMes(mesIdx) : i.periodo === "agora" ? "agora" : "desde que começou";

/* ------------------------------------------------------------------------- *
 * Congelar o mês que acabou (a planilha de mês passado continua editável)
 * ------------------------------------------------------------------------- */

export const CHAVE_MOSTRAR_VALORES = "conquistas-mostrar-valores";
export const chaveDoMesCongelado = (mesId: string) => `conquistas-insignias-${mesId}`;

export interface MesCongelado {
  mes: string;
  congeladoEm: string;
  valores: Record<string, number>;
  subs: Record<string, string>;
}

export const lerMesCongelado = (get: Get, mesId: string): MesCongelado | null => {
  const v = get<unknown>(chaveDoMesCongelado(mesId), null);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Partial<MesCongelado>;
  if (typeof o.mes !== "string" || !o.valores || typeof o.valores !== "object") return null;
  return { mes: o.mes, congeladoEm: typeof o.congeladoEm === "string" ? o.congeladoEm : "", valores: o.valores as Record<string, number>, subs: (o.subs ?? {}) as Record<string, string> };
};

/**
 * Na 1ª abertura de um mês novo, grava as insígnias do mês que acabou como
 * elas estavam (só se houve algum dado). Devolve o que gravou (ou null).
 */
export const congelarMesAnterior = (get: Get, set: (k: string, v: unknown, o?: { system?: boolean }) => void, hoje: string = localDayKey()): MesCongelado | null => {
  const agora = parseLocalDay(hoje);
  const ant = mesAnteriorDe(agora.getFullYear(), agora.getMonth());
  const mesId = idDoMes(ant.ano, ant.mesIdx);
  if (get<unknown>(chaveDoMesCongelado(mesId), undefined) !== undefined) return null;
  const medidas = medirInsignias(get, hoje, ant);
  const valores: Record<string, number> = {};
  const subs: Record<string, string> = {};
  let algum = false;
  for (const d of CATALOGO) {
    const m = medidas[d.id];
    valores[d.id] = Math.round((m?.valor ?? 0) * 100) / 100;
    if (m?.sub) subs[d.id] = m.sub;
    if ((m?.valor ?? 0) > 0) algum = true;
  }
  if (!algum) return null;
  const registro: MesCongelado = { mes: mesId, congeladoEm: hoje, valores, subs };
  set(chaveDoMesCongelado(mesId), registro, { system: true });
  return registro;
};
