import { ehDia, somarDias } from "@/lib/sequencia";
import { localDayKey, parseLocalDay } from "@/lib/utils";

/**
 * A AÇÃO DO DIA — SEQUÊNCIA INDIVIDUAL (02/10, dono: "a sequência não pode
 * ser só apertar o hábito; ir de base com o usuário").
 *
 * Antes (`conquistas-acao.ts`): a ação era a do módulo mais usado em 30 dias,
 * entre 5 frases fixas — na conta do dono era SEMPRE "marcar um hábito"; e a
 * conta de gasto lia só o balde do mês corrente, então todo dia 1º quem é de
 * Finanças recebia hábito/treino.
 *
 * Agora a frase é DA PESSOA, DO DIA DA SEMANA e GIRA:
 *  1. módulos VIVOS = registrou em ≥ 2 dos últimos 14 dias (até ontem);
 *  2. PESO por dia da semana = quantas vezes registrou nesse módulo neste
 *     dia da semana nas últimas 4 semanas (×10) + dias em 14 (desempate);
 *     Treino só entra em dia em que ela já treinou, ou que está no plano —
 *     domingo sem treino nunca pede treino;
 *  3. PRINCIPAL = o vivo de maior peso que NÃO foi a principal de ontem
 *     (rodízio; com 1 módulo vivo só, repete); os outros vivos viram chips "ou …";
 *  4. Finanças ganha "não gastei nada hoje ✓" — um registro de verdade
 *     (`finance-sem-gasto`) que conta pra sequência;
 *  5. dia 1 / sem histórico = a área escolhida na porta do funil; sem área,
 *     "anote 1 coisa do seu dia" com 3 chips;
 *  6. Finanças lê também os baldes ARQUIVADOS (`finance-AAAA-mes-expenses`):
 *     some o defeito do dia 1º.
 *
 * A regra "qualquer registro de verdade conta" (lib/sequencia.ts) NÃO muda:
 * aqui só se decide a FRASE. Tudo puro — o `get` é o leitor do useUserData.
 */

export type Leitor = <T>(key: string, fallback: T) => T;

export type ModuloAcao =
  | "financas" | "rotina" | "treino" | "dieta" | "saude" | "humor"
  | "biblioteca" | "estudos" | "detox" | "beleza" | "pet" | "relacoes";

/** O dia-sem-gasto do Finanças: {"AAAA-MM-DD": true}. Chave de DADO (conta pra sequência). */
export const CHAVE_SEM_GASTO = "finance-sem-gasto";

/** Janelas da conta. */
export const JANELA_VIVO = 14;
export const MIN_DIAS_VIVO = 2;
export const SEMANAS_DE_PESO = 4;

const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_DO_PLANO = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const MESES_DO_ARQUIVO = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const nomeDoDiaDaSemana = (dia: string): string => DIAS_DA_SEMANA[parseLocalDay(dia).getDay()];

export interface Chip {
  id: string;
  texto: string;
  rota: string;
  /** "sem-gasto" grava o dia sem gasto na hora (não navega). */
  tipo: "modulo" | "sem-gasto";
}

export interface AcaoDoDia {
  /** O módulo da ação, "area" (dia 1 pela porta) ou "qualquer". */
  id: ModuloAcao | "area" | "qualquer";
  modulo: ModuloAcao | null;
  texto: string;
  rota: string;
  /** "ou …" (até 2 módulos + o "não gastei" quando Finanças está viva). */
  chips: Chip[];
  /** Uma linha explicando a escolha (opcional na tela). */
  motivo: string | null;
  /** Os vivos de hoje, do maior peso pro menor (pra medição e pro dev). */
  vivos: Array<{ id: ModuloAcao; peso: number }>;
}

interface DefModulo {
  id: ModuloAcao;
  nome: string;
  rota: string;
  /** A frase principal ("marque o treino de terça"). */
  frase: (dia: string) => string;
  /** O chip curto ("o treino"). */
  chip: string;
}

/* ------------------------------------------------------------------ leitura */

const RE_ISO = /^\d{4}-\d{2}-\d{2}/;
const diaLocalDe = (v: unknown): string | null => {
  if (typeof v !== "string" || !RE_ISO.test(v)) return null;
  const texto: string = v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? texto.slice(0, 10) : localDayKey(d);
};
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const temAlgo = (v: unknown): boolean => {
  if (v == null || v === false || v === 0 || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
};

/** Dias de um registro por dia {"AAAA-MM-DD": valor}. */
const diasDeMapa = (reg: unknown, ok: (v: unknown) => boolean = temAlgo): string[] =>
  Object.entries(objeto(reg)).filter(([k, v]) => ehDia(k) && ok(v)).map(([k]) => k);
/** Dias de uma lista de dias ["AAAA-MM-DD"]. */
const diasDeLista = (reg: unknown): string[] => lista(reg).filter(ehDia);
/** Dias de itens com data [{date}]. */
const diasDeItens = (reg: unknown, campo = "date"): string[] =>
  lista(reg).map((it) => diaLocalDe((it as Record<string, unknown>)?.[campo])).filter((d): d is string => !!d);

/** Baldes arquivados de gastos dos meses que a janela toca (a virada do mês move o balde corrente pra cá). */
const chavesArquivadasDeGastos = (desde: string, ate: string): string[] => {
  const out: string[] = [];
  const a = parseLocalDay(desde);
  const fim = parseLocalDay(ate);
  const cursor = new Date(a.getFullYear(), a.getMonth(), 1);
  while (cursor <= fim) {
    out.push(`finance-${cursor.getFullYear()}-${MESES_DO_ARQUIVO[cursor.getMonth()]}-expenses`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
};

const LEITORES: Record<ModuloAcao, (get: Leitor, desde: string, ate: string) => string[]> = {
  financas: (get, desde, ate) => [
    ...diasDeItens(get("finance-expenses", [])),
    ...chavesArquivadasDeGastos(desde, ate).flatMap((k) => diasDeItens(get(k, []))),
    ...diasDeItens(get("finance-incomes", [])),
    ...diasDeMapa(get(CHAVE_SEM_GASTO, {})),
  ],
  rotina: (get) => [
    ...diasDeMapa(get("heatmap-log", {}), (v) => (typeof v === "number" ? v > 0 : v === true)),
    ...diasDeMapa(get("rotina-habit-log", {})),
    ...diasDeMapa(get("core-rotina-habit-log", {})),
  ],
  treino: (get) => diasDeLista(get("saude-workout-log", [])),
  dieta: (get) => diasDeMapa(get("dieta-diary-v2", {}), (v) => {
    const meals = (v as { meals?: Record<string, { followed?: boolean; note?: string }> })?.meals;
    return !!meals && Object.values(meals).some((m) => m?.followed || !!m?.note);
  }),
  saude: (get) => [
    ...diasDeMapa(get("water-log", {}), (v) => Number(v) > 0),
    ...diasDeMapa(get("sleep-log", {}), (v) => Number(v) > 0),
    ...diasDeMapa(get("core-saude-sleep", {}), (v) => Number(v) > 0),
    ...diasDeMapa(get("core-saude-supplement-log", {})),
  ],
  humor: (get) => [
    ...diasDeMapa(get("mood-log", {})),
    ...diasDeMapa(get("core-mood-log", {})),
    ...diasDeMapa(get("dp-mood-log", {})),
    ...diasDeMapa(get("journal-entries", {})),
  ],
  biblioteca: (get) => diasDeLista(get("lib-read-log", [])),
  estudos: (get) => [
    ...diasDeMapa(get("pomodoro-log", {}), (v) => Number(v) > 0),
    ...diasDeItens(get("estudos-sessoes", [])),
  ],
  detox: (get) => diasDeItens(get("detox-diary", [])),
  beleza: (get) => [
    ...diasDeMapa(get("skincare-daily-checkin", {})),
    ...diasDeMapa(get("skincare-morning-checked", {})),
    ...diasDeMapa(get("skincare-night-checked", {})),
  ],
  pet: (get) => diasDeItens(get("pet-diary", [])),
  relacoes: (get) => diasDeItens(get("rel-moments", [])),
};

export const MODULOS_DA_ACAO: DefModulo[] = [
  { id: "financas", nome: "Finanças", rota: "/financas", frase: () => "anote o gasto de hoje", chip: "o gasto de hoje" },
  { id: "rotina", nome: "Rotina", rota: "/rotina", frase: () => "marque um hábito", chip: "um hábito" },
  { id: "treino", nome: "Treino", rota: "/treino", frase: (dia) => `marque o treino de ${nomeDoDiaDaSemana(dia)}`, chip: "o treino" },
  { id: "dieta", nome: "Dieta", rota: "/dieta", frase: () => "marque uma refeição", chip: "uma refeição" },
  { id: "saude", nome: "Saúde", rota: "/saude", frase: () => "anote a água de hoje", chip: "a água" },
  { id: "humor", nome: "Humor", rota: "/rotina", frase: () => "anote como você está", chip: "como você está" },
  { id: "biblioteca", nome: "Biblioteca", rota: "/biblioteca", frase: () => "marque a leitura de hoje", chip: "a leitura" },
  { id: "estudos", nome: "Estudos", rota: "/estudos", frase: () => "registre um estudo", chip: "um estudo" },
  { id: "detox", nome: "Detox", rota: "/detox", frase: () => "anote o dia no Detox", chip: "o Detox" },
  { id: "beleza", nome: "Beleza", rota: "/beleza", frase: () => "marque o skincare de hoje", chip: "o skincare" },
  { id: "pet", nome: "Pet", rota: "/pet", frase: () => "anote algo do seu pet", chip: "algo do pet" },
  { id: "relacoes", nome: "Relações", rota: "/relacionamentos", frase: () => "guarde um momento", chip: "um momento" },
];
const DEF = Object.fromEntries(MODULOS_DA_ACAO.map((m) => [m.id, m])) as Record<ModuloAcao, DefModulo>;
export const ORDEM_DOS_MODULOS: ModuloAcao[] = MODULOS_DA_ACAO.map((m) => m.id);

/** Os dias com registro por módulo, dentro de [desde, ate] (um Set por módulo; nunca lança). */
export function diasPorModulo(get: Leitor, desde: string, ate: string): Record<ModuloAcao, Set<string>> {
  const out = {} as Record<ModuloAcao, Set<string>>;
  for (const m of ORDEM_DOS_MODULOS) {
    let dias: string[] = [];
    try { dias = LEITORES[m](get, desde, ate); } catch { dias = []; }
    out[m] = new Set(dias.filter((d) => d >= desde && d <= ate));
  }
  return out;
}

/* ------------------------------------------------------------------ pesos */

interface Peso { id: ModuloAcao; peso: number; noDiaDaSemana: number; em14: number }

const diasDoPlanoDeTreino = (get: Leitor): Set<number> => {
  const plano = lista(get("treino-active-days", null)).filter((d): d is string => typeof d === "string");
  return new Set(plano.map((d) => DIAS_DO_PLANO.indexOf(d.toUpperCase())).filter((i) => i >= 0));
};

/**
 * O peso de cada módulo VIVO no dia `dia` (olhando só o que veio antes dele).
 * Treino fora do plano e sem histórico nesse dia da semana = fora.
 */
export function pesosNoDia(dias: Record<ModuloAcao, Set<string>>, dia: string, planoTreino: Set<number> | null): Peso[] {
  // (planoTreino = os dias da semana marcados no plano do Treino; vazio/nulo = sem plano)
  const semana = parseLocalDay(dia).getDay();
  const desde14 = somarDias(dia, -JANELA_VIVO);
  const ontem = somarDias(dia, -1);
  const out: Peso[] = [];
  for (const id of ORDEM_DOS_MODULOS) {
    const set = dias[id];
    if (!set) continue;
    let em14 = 0;
    for (const d of set) if (d >= desde14 && d <= ontem) em14++;
    if (em14 < MIN_DIAS_VIVO) continue;
    let noDiaDaSemana = 0;
    for (let s = 1; s <= SEMANAS_DE_PESO; s++) if (set.has(somarDias(dia, -7 * s))) noDiaDaSemana++;
    // treino SÓ nos dias em que ela treina (ou que estão no plano): domingo sem treino nunca pede treino
    if (id === "treino" && noDiaDaSemana === 0 && !(planoTreino && planoTreino.has(semana))) continue;
    out.push({ id, peso: noDiaDaSemana * 10 + em14, noDiaDaSemana, em14 });
  }
  return out.sort((a, b) => b.peso - a.peso || ORDEM_DOS_MODULOS.indexOf(a.id) - ORDEM_DOS_MODULOS.indexOf(b.id));
}

/* ------------------------------------------------------------------ rodízio */

/** Quantos dias pra trás o rodízio é refeito (o bastante pra ser estável). */
const PROFUNDIDADE = 8;

/**
 * A principal entre os candidatos de hoje: o maior peso — e, se foi a de
 * ontem, a segunda, DESDE QUE a segunda também tenha história neste dia da
 * semana (ou nenhuma das duas tenha). O rodízio nunca empurra "treino de
 * domingo" pra quem só treina ter/qui/sáb só porque ontem foi hábito.
 */
export const escolherPrincipal = (cand: Peso[], anterior: ModuloAcao | null): ModuloAcao | null => {
  if (!cand.length) return null;
  if (cand.length < 2 || cand[0].id !== anterior) return cand[0].id;
  const alt = cand[1];
  return alt.noDiaDaSemana > 0 || cand[0].noDiaDaSemana === 0 ? alt.id : cand[0].id;
};

/**
 * A principal de `dia`, com rodízio: o maior peso que não foi a principal de
 * ontem (com 2+ vivos). Determinística: refaz os últimos 8 dias com a mesma
 * regra, sem gravar nada — dois aparelhos chegam na mesma frase, e a
 * notificação de amanhã consegue prever a de amanhã.
 */
export function principaisAte(dias: Record<ModuloAcao, Set<string>>, dia: string, planoTreino: Set<number> | null, aFrente = 0): Map<string, ModuloAcao | null> {
  const out = new Map<string, ModuloAcao | null>();
  let anterior: ModuloAcao | null = null;
  for (let i = -PROFUNDIDADE; i <= aFrente; i++) {
    const d = somarDias(dia, i);
    const escolhida = escolherPrincipal(pesosNoDia(dias, d, planoTreino), anterior);
    out.set(d, escolhida);
    anterior = escolhida;
  }
  return out;
}

/* ------------------------------------------------------------------ dia 1 */

/** A área escolhida na porta do funil (localStorage: funil W {v,t} ou o funil antigo). Sem navegador: null. */
export function areaDaPorta(): string | null {
  try {
    const cru = localStorage.getItem("core-funil-w-area");
    if (cru) {
      const j = JSON.parse(cru) as { v?: unknown } | null;
      if (j && typeof j === "object" && typeof j.v === "string" && j.v) return j.v;
    }
    return localStorage.getItem("core-funnel-area");
  } catch {
    return null;
  }
}

const MODULO_DA_AREA: Record<string, ModuloAcao> = { dinheiro: "financas", rotina: "rotina", corpo: "treino", saude: "saude", metas: "humor" };
const FRASE_DA_AREA: Record<string, string> = { dinheiro: "anote 1 gasto de hoje", rotina: "marque 1 hábito de hoje", corpo: "marque o treino de hoje", saude: "anote a água de hoje", metas: "anote como você está hoje" };

export const ACAO_PADRAO: AcaoDoDia = {
  id: "qualquer", modulo: null, texto: "anote 1 coisa do seu dia", rota: "/home", motivo: null, vivos: [],
  chips: [
    { id: "financas", texto: "um gasto", rota: "/financas", tipo: "modulo" },
    { id: "rotina", texto: "um hábito", rota: "/rotina", tipo: "modulo" },
    { id: "saude", texto: "a água", rota: "/saude", tipo: "modulo" },
  ],
};

const CHIP_SEM_GASTO: Chip = { id: "sem-gasto", texto: "não gastei nada hoje", rota: "/financas", tipo: "sem-gasto" };

/* ------------------------------------------------------------------ a ação */

const motivoDe = (p: Peso, dia: string): string => {
  const nome = DEF[p.id].nome;
  const semana = nomeDoDiaDaSemana(dia);
  if (p.id === "treino" && p.noDiaDaSemana > 0) return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} é um dos seus dias de treino (${p.noDiaDaSemana} das últimas ${SEMANAS_DE_PESO}).`;
  if (p.noDiaDaSemana >= 2) return `Você costuma registrar ${nome} ${semana === "sábado" || semana === "domingo" ? "aos" : "às"} ${semana}s.`;
  return `${nome} em ${p.em14} dos últimos ${JANELA_VIVO} dias.`;
};

export interface OpcoesAcao {
  /** A área da porta (dia 1). Por padrão lê o localStorage. */
  area?: string | null;
  /** Dias à frente (a notificação prevê a frase de amanhã). */
  aFrente?: number;
}

/**
 * A ação de `dia` (hoje) — e, com `aFrente`, as dos próximos dias (a mesma
 * regra, com os dados de hoje; a de amanhã olha a de hoje no rodízio).
 */
export function acoesDoDia(get: Leitor, hoje: string, opcoes: OpcoesAcao = {}): AcaoDoDia[] {
  const aFrente = Math.max(0, opcoes.aFrente ?? 0);
  const desde = somarDias(hoje, -(JANELA_VIVO + 7 * SEMANAS_DE_PESO + PROFUNDIDADE));
  const dias = diasPorModulo(get, desde, somarDias(hoje, aFrente));
  let plano: Set<number> | null = null;
  try { plano = diasDoPlanoDeTreino(get); } catch { plano = null; }
  const principais = principaisAte(dias, hoje, plano, aFrente);
  const area = opcoes.area === undefined ? areaDaPorta() : opcoes.area;
  const out: AcaoDoDia[] = [];
  for (let i = 0; i <= aFrente; i++) {
    const d = somarDias(hoje, i);
    const pesos = pesosNoDia(dias, d, plano);
    const principal = principais.get(d) ?? null;
    const vivos = pesos.map((p) => ({ id: p.id, peso: p.peso }));
    if (!principal) {
      const modulo = area ? MODULO_DA_AREA[area] : undefined;
      if (modulo) out.push({ id: "area", modulo, texto: FRASE_DA_AREA[area!], rota: DEF[modulo].rota, chips: modulo === "financas" ? [CHIP_SEM_GASTO] : [], motivo: null, vivos });
      else out.push({ ...ACAO_PADRAO, vivos });
      continue;
    }
    const def = DEF[principal];
    const outros = pesos.filter((p) => p.id !== principal).slice(0, 2);
    const chips: Chip[] = outros.map((p) => ({ id: p.id, texto: DEF[p.id].chip, rota: DEF[p.id].rota, tipo: "modulo" as const }));
    const financasViva = pesos.some((p) => p.id === "financas");
    if (financasViva) chips.push(CHIP_SEM_GASTO);
    const p = pesos.find((x) => x.id === principal)!;
    out.push({ id: principal, modulo: principal, texto: def.frase(d), rota: def.rota, chips: chips.slice(0, 3), motivo: motivoDe(p, d), vivos });
  }
  return out;
}

/** A ação de hoje. */
export const acaoDoDia = (get: Leitor, hoje: string, opcoes: OpcoesAcao = {}): AcaoDoDia => acoesDoDia(get, hoje, { ...opcoes, aFrente: 0 })[0];

/* ------------------------------------------------------------------ "não gastei" */

/** Grava o dia sem gasto (devolve o mapa novo, ou null se já estava). */
export const marcarDiaSemGasto = (atual: unknown, dia: string): Record<string, true> | null => {
  const mapa = objeto(atual) as Record<string, true>;
  if (mapa[dia] === true) return null;
  const novo: Record<string, true> = {};
  // guarda só os últimos 400 dias
  for (const k of Object.keys(mapa).filter(ehDia).sort().slice(-399)) novo[k] = true;
  novo[dia] = true;
  return novo;
};

export const diaSemGasto = (atual: unknown, dia: string): boolean => objeto(atual)[dia] === true;

/* ------------------------------------------------------------------ notificação */

/** A frase do aviso das 20h com a ação da pessoa ("Terça é dia de treino 🔥 — marque o treino e sua sequência de 5 dias continua"). */
export function textoDoLembrete(acao: Pick<AcaoDoDia, "id" | "modulo" | "texto">, dias: number, dia: string): { title: string; body: string } {
  const n = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (acao.modulo === "treino") {
    const s = nomeDoDiaDaSemana(dia);
    return { title: `${s.charAt(0).toUpperCase()}${s.slice(1)} é dia de treino 🔥`, body: `Marque o treino e sua sequência de ${n} continua.` };
  }
  if (acao.modulo === "financas") return { title: `Sua sequência de ${n} acaba hoje 🔥`, body: "Anote o gasto de hoje — ou toque em \"não gastei nada\". Leva 10 segundos." };
  return { title: `Sua sequência de ${n} acaba hoje 🔥`, body: `Falta 1 coisa: ${acao.texto}. Leva 10 segundos.` };
}
