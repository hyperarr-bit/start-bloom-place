/**
 * CONSTÂNCIA DO TREINO (26/09, mockup aprovado — p7). O dono recusou o mapa de
 * calor copiado da Rotina: treino não é hábito diário, e um quadrado cinza no
 * dia de descanso lê como falha. Aqui a régua é a SEMANA:
 *  - meta de N treinos por semana; a sequência conta semanas fechadas na meta
 *    ("descanso não quebra a sequência — o que conta é fechar a semana");
 *  - o mês ganha um CARIMBO por dia treinado, com o grupo muscular;
 *  - post-it quando um grupo do plano está há ≥ 10 dias sem treino.
 * Datas sempre locais (localDayKey/parseLocalDay).
 */
import { localDayKey, parseLocalDay } from "@/lib/utils";

export const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const ehData = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** 0 = segunda … 6 = domingo */
export const indiceDoDia = (d: Date): number => (d.getDay() + 6) % 7;
export const diaDaSemanaDe = (data: string): string => DIAS[indiceDoDia(parseLocalDay(data))];
export const somarDias = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const segundaDe = (d: Date): Date => somarDias(d, -indiceDoDia(d));
export const diasEntre = (de: string, ate: string): number =>
  Math.round((parseLocalDay(ate).getTime() - parseLocalDay(de).getTime()) / 86_400_000);
export const nomeDoMes = (mes: number): string => MESES[((mes % 12) + 12) % 12];

/** "21 a 27 de set" (virando o mês: "28 de set a 4 de out"). */
export const faixaDaSemana = (segunda: Date): string => {
  const fim = somarDias(segunda, 6);
  return segunda.getMonth() === fim.getMonth()
    ? `${segunda.getDate()} a ${fim.getDate()} de ${MESES_CURTOS[fim.getMonth()]}`
    : `${segunda.getDate()} de ${MESES_CURTOS[segunda.getMonth()]} a ${fim.getDate()} de ${MESES_CURTOS[fim.getMonth()]}`;
};

/** Meta padrão = nº de dias de treino do plano (1–7); sem plano, 3. */
export const metaPadrao = (diasAtivos: string[]): number => {
  const n = new Set(diasAtivos.filter((d) => DIAS.includes(d))).size;
  return n > 0 ? Math.min(7, n) : 3;
};

export interface SemanaDaMeta {
  /** AAAA-MM-DD da segunda */
  inicio: string;
  /** "22/9" */
  rotulo: string;
  treinos: number;
  bateu: boolean;
  atual: boolean;
}

/** As últimas `quantas` semanas (a atual por último) e a sequência de semanas na
 *  meta. A semana atual só entra na sequência depois de bater — antes disso ela
 *  ainda não fechou e não quebra nada. */
export const semanasNaMeta = (
  log: unknown,
  meta: number,
  hoje: Date,
  quantas = 12,
): { semanas: SemanaDaMeta[]; sequencia: number } => {
  const hojeKey = localDayKey(hoje);
  const datas = new Set((Array.isArray(log) ? log : []).filter((d): d is string => ehData(d) && d <= hojeKey));
  const porSemana = new Map<string, number>();
  for (const d of datas) {
    const k = localDayKey(segundaDe(parseLocalDay(d)));
    porSemana.set(k, (porSemana.get(k) ?? 0) + 1);
  }
  const alvo = Math.max(1, Math.round(meta) || 1);
  const seg = segundaDe(hoje);
  const semanas: SemanaDaMeta[] = [];
  for (let i = quantas - 1; i >= 0; i--) {
    const ini = somarDias(seg, -7 * i);
    const k = localDayKey(ini);
    const n = porSemana.get(k) ?? 0;
    semanas.push({ inicio: k, rotulo: `${ini.getDate()}/${ini.getMonth() + 1}`, treinos: n, bateu: n >= alvo, atual: i === 0 });
  }
  let sequencia = (porSemana.get(localDayKey(seg)) ?? 0) >= alvo ? 1 : 0;
  for (let i = 1; i < 530; i++) {
    if ((porSemana.get(localDayKey(somarDias(seg, -7 * i))) ?? 0) >= alvo) sequencia++;
    else break;
  }
  return { semanas, sequencia };
};

/* ---------------- grupos musculares ---------------- */

export type Regiao = "pernas" | "peito" | "costas" | "ombros" | "braços" | "abdômen" | "cardio";
export type GrupoDoCarimbo = "pernas" | "superiores" | "costas" | "cardio" | "core";

const REGIAO_DO_MUSCULO: Record<string, Regiao | "tudo"> = {
  peito: "peito", costas: "costas", ombros: "ombros", "bíceps": "braços", "tríceps": "braços", biceps: "braços", triceps: "braços",
  pernas: "pernas", "glúteos": "pernas", gluteos: "pernas", "quadríceps": "pernas", quadriceps: "pernas", posterior: "pernas",
  panturrilha: "pernas", "abdômen": "abdômen", abdomen: "abdômen", cardio: "cardio", "full body": "tudo",
};

/** Palavra do nome do exercício → região (pra quem monta o treino sem marcar
 *  o grupo, e pro histórico antigo). A 1ª regra que casar ganha. */
const PALAVRAS: [RegExp, Regiao][] = [
  [/crucifixo invertido|voador invertido|face ?pull|posterior de ombro/i, "ombros"],
  // braços antes do cardio: "Tríceps corda" é braço, "Pular corda" é cardio
  [/tr[ií]ceps|b[ií]ceps|rosca|franc[eê]s|testa|mergulho|paralela|coice|antebra[cç]o/i, "braços"],
  [/esteira|bike|bicicleta|corrida|correr|caminhada|\bcorda\b|el[ií]ptico|escada|spinning|nata[cç][aã]o|cardio|hiit|transport/i, "cardio"],
  [/agach|leg ?press|extensora|flexora|panturrilha|afundo|avan[cç]o|stiff|b[uú]lgaro|gl[uú]te|p[eé]lvica|hack|abdutora|adutora|sum[oô]|romeno|passada|coxa|perna|quadr[ií]ceps|posterior/i, "pernas"],
  [/supino|crucifixo|peck|voador|crossover|cross over|flex[aã]o|peitoral|peito/i, "peito"],
  [/remada|puxada|pulldown|pull ?down|barra fixa|serrote|pull ?over|dorsal|costas|levantamento terra|\bterra\b|lombar/i, "costas"],
  [/desenvolvimento|eleva[cç][aã]o lateral|eleva[cç][aã]o frontal|ombro|arnold|militar/i, "ombros"],
  [/abdominal|prancha|abd[oô]men|crunch|infra|obl[ií]quo|canivete|\bcore\b/i, "abdômen"],
];

export const regiaoDoExercicio = (nome: unknown, tipo?: string): Regiao | null => {
  if (tipo === "cardio") return "cardio";
  const t = String(nome ?? "");
  for (const [re, r] of PALAVRAS) if (re.test(t)) return r;
  return null;
};

const regiaoDoMusculo = (m: unknown): Regiao | "tudo" | null => REGIAO_DO_MUSCULO[String(m ?? "").trim().toLowerCase()] ?? null;

const GRUPO_DA_REGIAO: Record<Regiao, GrupoDoCarimbo> = {
  pernas: "pernas", peito: "superiores", ombros: "superiores", "braços": "superiores", costas: "costas", cardio: "cardio", "abdômen": "core",
};

export const CARIMBOS: Record<GrupoDoCarimbo, { emoji: string; rotulo: string }> = {
  pernas: { emoji: "🦵", rotulo: "pernas" },
  superiores: { emoji: "💪", rotulo: "peito/braços" },
  costas: { emoji: "🚣", rotulo: "costas" },
  cardio: { emoji: "🏃", rotulo: "cardio" },
  core: { emoji: "🔥", rotulo: "abdômen/full body" },
};

export interface MetaDaSessao { dia?: string; minutos?: number; musculos?: string[] }

export interface FonteDosTreinos {
  /** `treino-sessoes`: o que o "Concluir" deixou por data */
  sessoes: Record<string, MetaDaSessao | undefined>;
  historico: { date?: string; exercise?: string; tipo?: string }[];
  plano: Record<string, { muscles?: string[]; exercises?: { name?: string; tipo?: string }[] } | undefined>;
}

/** O que foi treinado numa data, em regiões (com repetição, na ordem — pra achar
 *  o grupo dominante do carimbo). Fontes, da mais fiel pra menos: os músculos
 *  gravados no Concluir + os nomes dos exercícios do dia; sem nada disso (treino
 *  marcado pela Home), os músculos do dia da semana no plano. */
export const regioesDoTreino = (
  data: string,
  fonte: FonteDosTreinos,
  historicoDoDia?: { exercise?: string; tipo?: string }[],
): { regioes: Regiao[]; tudo: boolean } => {
  const regioes: Regiao[] = [];
  let tudo = false;
  const somarMusculos = (lista: unknown) => {
    for (const m of Array.isArray(lista) ? lista : []) {
      const r = regiaoDoMusculo(m);
      if (r === "tudo") tudo = true;
      else if (r) regioes.push(r);
    }
  };
  somarMusculos(fonte.sessoes?.[data]?.musculos);
  const doDia = historicoDoDia ?? (fonte.historico ?? []).filter((h) => h?.date === data);
  for (const h of doDia) {
    const r = regiaoDoExercicio(h?.exercise, h?.tipo);
    if (r) regioes.push(r);
  }
  if (!regioes.length && !tudo) {
    const dia = fonte.sessoes?.[data]?.dia && DIAS.includes(fonte.sessoes[data]!.dia!) ? fonte.sessoes[data]!.dia! : diaDaSemanaDe(data);
    somarMusculos(fonte.plano?.[dia]?.muscles);
  }
  return { regioes, tudo };
};

/** Carimbo do dia: o grupo que mais apareceu (empate: o que veio primeiro). */
export const carimboDoTreino = (r: { regioes: Regiao[]; tudo: boolean }): { emoji: string; grupo: GrupoDoCarimbo | "outro" } => {
  const conta = new Map<GrupoDoCarimbo, number>();
  for (const x of r.regioes) {
    const g = GRUPO_DA_REGIAO[x];
    conta.set(g, (conta.get(g) ?? 0) + 1);
  }
  let melhor: GrupoDoCarimbo | null = null;
  for (const [g, n] of conta) if (!melhor || n > (conta.get(melhor) ?? 0)) melhor = g;
  if (!melhor && r.tudo) melhor = "core";
  return melhor ? { emoji: CARIMBOS[melhor].emoji, grupo: melhor } : { emoji: "✓", grupo: "outro" };
};

/** Carimbo de um dia do PLANO: os músculos marcados; sem músculo, os nomes dos exercícios. */
export const carimboDoPlano = (d?: { muscles?: string[]; exercises?: { name?: string; tipo?: string }[] }) => {
  const regioes: Regiao[] = [];
  let tudo = false;
  for (const m of d?.muscles ?? []) {
    const r = regiaoDoMusculo(m);
    if (r === "tudo") tudo = true;
    else if (r) regioes.push(r);
  }
  if (!regioes.length && !tudo) {
    for (const ex of d?.exercises ?? []) {
      const r = regiaoDoExercicio(ex?.name, ex?.tipo);
      if (r) regioes.push(r);
    }
  }
  return carimboDoTreino({ regioes, tudo });
};

export interface DiaDoMes {
  data: string;
  dia: number;
  /** 0 = segunda */
  coluna: number;
  treinou: boolean;
  carimbo: { emoji: string; grupo: GrupoDoCarimbo | "outro" } | null;
  hoje: boolean;
  futuro: boolean;
}

/** O mês "carimbado": um dia por célula, carimbo nos dias treinados, total de
 *  treinos e de minutos (só dos treinos com duração gravada). */
export const mesCarimbado = (
  ano: number,
  mes: number,
  log: unknown,
  fonte: FonteDosTreinos,
  hoje: string,
): { dias: DiaDoMes[]; vazioAntes: number; treinos: number; minutos: number; grupos: GrupoDoCarimbo[] } => {
  const datas = new Set((Array.isArray(log) ? log : []).filter(ehData));
  const primeiro = new Date(ano, mes, 1);
  const total = new Date(ano, mes + 1, 0).getDate();
  const porData = new Map<string, { exercise?: string; tipo?: string }[]>();
  for (const h of fonte.historico ?? []) {
    if (!h || !ehData(h.date)) continue;
    const l = porData.get(h.date) ?? [];
    l.push(h);
    porData.set(h.date, l);
  }
  const dias: DiaDoMes[] = [];
  const grupos: GrupoDoCarimbo[] = [];
  let treinos = 0;
  let minutos = 0;
  for (let d = 1; d <= total; d++) {
    const dt = new Date(ano, mes, d);
    const data = localDayKey(dt);
    const futuro = data > hoje;
    const treinou = !futuro && datas.has(data);
    let carimbo: DiaDoMes["carimbo"] = null;
    if (treinou) {
      treinos++;
      minutos += Math.max(0, Number(fonte.sessoes?.[data]?.minutos) || 0);
      carimbo = carimboDoTreino(regioesDoTreino(data, fonte, porData.get(data) ?? []));
      if (carimbo.grupo !== "outro" && !grupos.includes(carimbo.grupo)) grupos.push(carimbo.grupo);
    }
    dias.push({ data, dia: d, coluna: indiceDoDia(dt), treinou, carimbo, hoje: data === hoje, futuro });
  }
  const ordem: GrupoDoCarimbo[] = ["pernas", "superiores", "costas", "cardio", "core"];
  return { dias, vazioAntes: indiceDoDia(primeiro), treinos, minutos, grupos: ordem.filter((g) => grupos.includes(g)) };
};

/* ---------------- grupo esquecido ---------------- */

const NOME_DA_REGIAO: Record<Regiao, string> = {
  pernas: "pernas", peito: "peito", costas: "costas", ombros: "ombros", "braços": "braços", "abdômen": "abdômen", cardio: "cardio",
};
const DIA_NA_FRASE: Record<string, string> = {
  SEGUNDA: "na segunda", "TERÇA": "na terça", QUARTA: "na quarta", QUINTA: "na quinta", SEXTA: "na sexta", "SÁBADO": "no sábado", DOMINGO: "no domingo",
};

export interface GrupoEsquecido {
  regiao: Regiao;
  nome: string;
  dias: number;
  /** "SEXTA" ou "HOJE" */
  dia: string;
  /** "Faz 12 dias sem treinar ombros." */
  frase: string;
  /** "Encaixa na sexta?" */
  pergunta: string;
}

/** Regiões que o plano de um dia cobre (músculos marcados + nomes dos exercícios). */
const regioesDoPlano = (d: FonteDosTreinos["plano"][string]): Set<Regiao> => {
  const s = new Set<Regiao>();
  for (const m of d?.muscles ?? []) {
    const r = regiaoDoMusculo(m);
    if (r && r !== "tudo") s.add(r);
  }
  for (const ex of d?.exercises ?? []) {
    const r = regiaoDoExercicio(ex?.name, ex?.tipo);
    if (r) s.add(r);
  }
  return s;
};

/** Um grupo do plano há ≥ `minimo` dias sem treino (o mais esquecido), com o
 *  próximo dia do plano que o tem. Sem nenhum treino registrado, não cobra. */
export const grupoEsquecido = ({
  fonte,
  diasAtivos,
  log,
  hoje,
  minimo = 10,
}: {
  fonte: FonteDosTreinos;
  diasAtivos: string[];
  log: unknown;
  hoje: string;
  minimo?: number;
}): GrupoEsquecido | null => {
  const datas = [...new Set((Array.isArray(log) ? log : []).filter((d): d is string => ehData(d) && d <= hoje))].sort();
  if (!datas.length) return null;
  const ativos = DIAS.filter((d) => diasAtivos.includes(d));
  const planejadas: Regiao[] = [];
  const porDia = new Map<string, Set<Regiao>>();
  for (const d of ativos) {
    const rs = regioesDoPlano(fonte.plano?.[d]);
    porDia.set(d, rs);
    for (const r of rs) if (!planejadas.includes(r)) planejadas.push(r);
  }
  if (!planejadas.length) return null;
  const ultimaVez = new Map<Regiao, string>();
  for (const data of datas) {
    const { regioes, tudo } = regioesDoTreino(data, fonte);
    const cobertas = tudo ? planejadas : regioes;
    for (const r of cobertas) ultimaVez.set(r, data);
  }
  let pior: { regiao: Regiao; dias: number } | null = null;
  for (const r of planejadas) {
    const desde = ultimaVez.get(r) ?? datas[0];
    const dias = diasEntre(desde, hoje);
    if (dias >= minimo && (!pior || dias > pior.dias)) pior = { regiao: r, dias };
  }
  if (!pior) return null;
  const idxHoje = indiceDoDia(parseLocalDay(hoje));
  const treinouHoje = datas.includes(hoje);
  let dia = "";
  for (let k = treinouHoje ? 1 : 0; k < 7 + (treinouHoje ? 1 : 0) && !dia; k++) {
    const d = DIAS[(idxHoje + k) % 7];
    if (porDia.get(d)?.has(pior.regiao)) dia = k === 0 ? "HOJE" : d;
  }
  if (!dia) dia = ativos[0] ?? "HOJE";
  const nome = NOME_DA_REGIAO[pior.regiao];
  return {
    regiao: pior.regiao,
    nome,
    dias: pior.dias,
    dia,
    frase: `Faz ${pior.dias} dias sem ${pior.regiao === "cardio" ? "fazer cardio" : `treinar ${nome}`}.`,
    pergunta: `Encaixa ${dia === "HOJE" ? "hoje" : DIA_NA_FRASE[dia] ?? dia.toLowerCase()}?`,
  };
};
