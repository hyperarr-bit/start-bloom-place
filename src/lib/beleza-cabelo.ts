import { localDayKey, parseLocalDay } from "@/lib/utils";
import { normalizarHora } from "@/lib/tarefas";
import { calculatePorosity, WASH_STEPS, type PorosityResult } from "@/components/beleza/utils";

/**
 * CABELO — O CRONOGRAMA CAPILAR (28/09, Onda 1 do "módulo completo" da Beleza).
 *
 * Por quê: no Brasil, "beleza no celular" é cabelo antes de pele. O Meu Cronograma
 * Capilar tem 8,3 mi de instalações; 82% de quem trata o cabelo em casa faz
 * cronograma; cabelo aparece em 59,5% das compras de beleza do mês (skincare, 24,9%).
 *
 * O cronograma: 4 semanas de lavagens com HIDRATAÇÃO (H), NUTRIÇÃO (N) e
 * RECONSTRUÇÃO (R). O pedido nº 1 nas avaliações dos apps de cronograma é que ele
 * ESPERE: pulou a lavagem, a etapa não se perde. Por isso aqui a sequência é uma
 * FILA — só anda quando a etapa é FEITA; lavagem "fora do plano" fica registrada
 * sem pular nada. A reconstrução nunca vem a menos de 15 dias da anterior: se a
 * fila chegar nela cedo demais, a R espera e a próxima etapa passa na frente.
 *
 * Chaves NOVAS (nenhuma chave existente muda):
 *  - `cabelo-perfil`   (objeto) as 4 respostas
 *  - `cabelo-plano`    (objeto) a sequência, o ritmo de lavar e o dia 1
 *  - `cabelo-lavagens` (lista)  cada lavagem: etapa, passos, extras, produtos, resultado
 *  - `cabelo-lembrete-prefs` (objeto) os avisos — `-prefs` pra ficar fora da
 *    sequência de dias anotados (é ajuste, não registro), como o do skincare.
 * Tudo aqui é PURO (recebe `hoje`/`agora`): testável sem tela nem plugin.
 */

export const CHAVE_PERFIL_CABELO = "cabelo-perfil";
export const CHAVE_PLANO_CABELO = "cabelo-plano";
export const CHAVE_LAVAGENS = "cabelo-lavagens";
export const CHAVE_LEMBRETE_CABELO = "cabelo-lembrete-prefs";

export type Curvatura = "liso" | "ondulado" | "cacheado" | "crespo";
export type Quimica = "nenhuma" | "coloracao" | "descoloracao" | "progressiva" | "transicao";
export type Etapa = "hidratacao" | "nutricao" | "reconstrucao";
/** "lavo N vezes por semana" (`porSemana`) OU "a cada N dias" (`intervaloDias`) — um dos dois. */
export type Frequencia = { porSemana?: number; intervaloDias?: number };
export type Ritmo = { tipo: "semana"; dias: number[] } | { tipo: "intervalo"; dias: number };

export interface PerfilCapilar {
  curvaturas: Curvatura[];
  quimica: Quimica;
  frequencia: Frequencia;
  porosidade: PorosityResult;
  respostasPorosidade: [number, number, number];
  criadoEm: string;
}

export interface PlanoCapilar {
  id: string;
  /** as etapas das lavagens de UM ciclo de 4 semanas, na ordem */
  sequencia: Etapa[];
  /** os dias de lavar: dias da semana fixos (0 = seg … 6 = dom) ou "a cada N dias" */
  ritmo: Ritmo;
  /** o dia 1 do cronograma ("YYYY-MM-DD") */
  inicio: string;
  /** lavagem prevista que a pessoa mudou de dia no MEU MÊS: dia previsto → dia novo */
  trocas?: Record<string, string>;
}

export interface LavagemCapilar {
  id: string;
  /** "YYYY-MM-DD" */
  data: string;
  /** a etapa feita (lavagem fora do plano pode não ter) */
  etapa: Etapa | null;
  /** conta no cronograma? (false = "lavei fora do plano": registra sem andar a fila) */
  noPlano: boolean;
  /** id do plano em que foi feita (refazer o cronograma começa a fila do zero) */
  plano?: string;
  /** a etapa só anda com FEITO; os passos marcados antes ficam guardados */
  feita: boolean;
  /** ids de WASH_STEPS marcados */
  passos: string[];
  /** ids de EXTRAS (umectação na véspera, acidificação…) */
  extras: string[];
  /** passo → id do produto em MEUS PRODUTOS, ou o nome digitado */
  produtos: Record<string, string>;
  /** ids de HAIR_RESULT_TAGS */
  tags: string[];
  nota: string;
}

/* ------------------------------------------------------------ as 4 perguntas */

export const OPCOES_CURVATURA: { id: Curvatura; rotulo: string; dica: string }[] = [
  { id: "liso", rotulo: "Liso", dica: "cai reto, sem onda" },
  { id: "ondulado", rotulo: "Ondulado", dica: "onda em S, solta" },
  { id: "cacheado", rotulo: "Cacheado", dica: "cachos definidos, em espiral" },
  { id: "crespo", rotulo: "Crespo", dica: "cachos bem fechados, em zigue-zague" },
];

export const OPCOES_QUIMICA: { id: Quimica; rotulo: string; emoji: string; dica: string }[] = [
  { id: "nenhuma", rotulo: "Nenhuma química", emoji: "🌿", dica: "cabelo natural" },
  { id: "coloracao", rotulo: "Coloração", emoji: "🎨", dica: "tintura, tonalizante" },
  { id: "descoloracao", rotulo: "Descoloração", emoji: "🌟", dica: "luzes, mechas, platinado" },
  { id: "progressiva", rotulo: "Progressiva", emoji: "💨", dica: "alisamento, selagem" },
  { id: "transicao", rotulo: "Em transição", emoji: "🌱", dica: "deixando a química crescer" },
];

/** Teste de porosidade: 3 perguntas, resposta 1 (baixa) a 3 (alta) → calculatePorosity. */
export const PERGUNTAS_POROSIDADE: { pergunta: string; opcoes: [string, string, string] }[] = [
  { pergunta: "Depois de lavar, seu cabelo seca…", opcoes: ["devagar, demora muito", "no tempo normal", "muito rápido"] },
  { pergunta: "Creme ou óleo no cabelo…", opcoes: ["fica por cima, pesa", "absorve bem", "some rápido, pede mais"] },
  { pergunta: "Frizz e pontas…", opcoes: ["quase sem frizz, brilho natural", "um pouco de frizz", "muito frizz, pontas secas"] },
];

export const ROTULO_POROSIDADE: Record<PorosityResult, string> = { baixa: "baixa", media: "média", alta: "alta" };

/* ------------------------------------------------------------ as etapas */

export const ETAPAS: Record<Etapa, { rotulo: string; letra: string; mascara: string; dica: string }> = {
  hidratacao: {
    rotulo: "HIDRATAÇÃO", letra: "H", mascara: "Máscara de hidratação",
    dica: "Repõe água. Máscara do comprimento às pontas, no tempo do rótulo.",
  },
  nutricao: {
    rotulo: "NUTRIÇÃO", letra: "N", mascara: "Máscara de nutrição",
    dica: "Repõe óleos. Menos produto na raiz pra não pesar.",
  },
  reconstrucao: {
    rotulo: "RECONSTRUÇÃO", letra: "R", mascara: "Máscara de reconstrução",
    dica: "Repõe massa (queratina). Não passe do tempo do rótulo; de 15 em 15 dias, no máximo.",
  },
};

/** Etapas extras de uma lavagem (pedidos nas avaliações: "passos que também salvam o cabelo"). */
export const EXTRAS: { id: string; rotulo: string }[] = [
  { id: "umectacao", rotulo: "Umectação na véspera" },
  { id: "acidificacao", rotulo: "Acidificação" },
  { id: "detox", rotulo: "Detox" },
  { id: "matizacao", rotulo: "Matização" },
  { id: "co-wash", rotulo: "Co-wash" },
  { id: "low-poo", rotulo: "Low poo" },
];

/** O passo da lavagem, com o nome da máscara da etapa ("Máscara de nutrição"). */
export const passosDaLavagem = (etapa: Etapa | null): { id: string; rotulo: string }[] =>
  WASH_STEPS.map((p) => ({ id: p.id, rotulo: p.id === "mascara" && etapa ? ETAPAS[etapa].mascara : p.label }));

/* ------------------------------------------------------------ datas (dia LOCAL) */

export const somarDias = (dia: string, n: number): string => {
  const d = parseLocalDay(dia);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
};
/** Dias de `de` até `ate` (positivo se `ate` é depois). */
export const diasEntre = (de: string, ate: string): number =>
  Math.round((parseLocalDay(ate).getTime() - parseLocalDay(de).getTime()) / 86_400_000);
/** 0 = segunda … 6 = domingo */
export const diaDaSemanaDe = (dia: string): number => (parseLocalDay(dia).getDay() + 6) % 7;
const ehDia = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ------------------------------------------------------------ o gerador */

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Lavagens num ciclo de 4 semanas. */
export const lavagensNoCiclo = (f: Frequencia): number => {
  if (typeof f.porSemana === "number") return limitar(Math.round(f.porSemana), 1, 7) * 4;
  return Math.max(1, Math.floor(28 / limitar(Math.round(f.intervaloDias ?? 3), 1, 14)));
};

/** Os dias de lavar padrão pra "N vezes por semana" (0 = seg). Editável no MEU MÊS. */
export const DIAS_PADRAO: Record<number, number[]> = {
  1: [5],
  2: [1, 5],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export const ritmoDaFrequencia = (f: Frequencia): Ritmo =>
  typeof f.porSemana === "number"
    ? { tipo: "semana", dias: DIAS_PADRAO[limitar(Math.round(f.porSemana), 1, 7)] }
    : { tipo: "intervalo", dias: limitar(Math.round(f.intervaloDias ?? 3), 1, 14) };

/** `n` posições espalhadas por igual em `total` casas, nunca a primeira (o ciclo começa pela hidratação). */
const espalhar = (total: number, n: number): Set<number> => {
  const s = new Set<number>();
  for (let i = 0; i < n; i++) s.add(Math.min(total - 1, Math.floor(((i + 1) * total) / (n + 1))));
  return s;
};

/**
 * A sequência de um ciclo de 4 semanas.
 *  - Reconstrução: 1 por ciclo (fecha a semana 4, como o cronograma clássico); 2 com
 *    porosidade ALTA, descoloração ou progressiva (fim da semana 2 e da 4) — e nunca
 *    mais de 1 a cada 4 lavagens. O "de 15 em 15 dias, no máximo" é garantido na
 *    AGENDA (a R espera), porque a data real depende de quando a pessoa lava.
 *  - Entre H e N: a porosidade decide a base (baixa pede água, alta pede óleo); cacho e
 *    crespo puxam pra nutrição, liso pra hidratação; química resseca → mais nutrição.
 *  - As N se espalham por igual entre as H (H N H · H N H…).
 */
export function gerarCronograma(p: Pick<PerfilCapilar, "curvaturas" | "quimica" | "porosidade" | "frequencia">): Etapa[] {
  const total = lavagensNoCiclo(p.frequencia);
  const danificado = p.quimica === "descoloracao" || p.quimica === "progressiva";
  let r = p.porosidade === "alta" || danificado ? 2 : 1;
  r = Math.min(r, Math.floor(total / 4));

  let fatiaN = p.porosidade === "baixa" ? 0.25 : p.porosidade === "alta" ? 0.45 : 0.35;
  const curvas = Array.isArray(p.curvaturas) ? p.curvaturas : [];
  if (curvas.includes("cacheado") || curvas.includes("crespo")) fatiaN += 0.15;
  else if (curvas.includes("ondulado")) fatiaN += 0.05;
  else if (curvas.length && curvas.every((c) => c === "liso")) fatiaN -= 0.1;
  if (p.quimica === "coloracao" || p.quimica === "transicao") fatiaN += 0.05;
  if (p.quimica === "descoloracao") fatiaN += 0.1;
  fatiaN = limitar(fatiaN, 0.15, 0.6);

  const posR = new Set<number>(r === 2 ? [Math.floor(total / 2) - 1, total - 1] : r === 1 ? [total - 1] : []);
  const livres = total - posR.size;
  const n = livres >= 3 ? Math.max(1, Math.round(livres * fatiaN)) : Math.round(livres * fatiaN);
  const posN = espalhar(livres, n);

  const seq: Etapa[] = [];
  let k = 0;
  for (let i = 0; i < total; i++) {
    if (posR.has(i)) { seq.push("reconstrucao"); continue; }
    seq.push(posN.has(k) ? "nutricao" : "hidratacao");
    k++;
  }
  return seq;
}

/** O cronograma novo: sequência + ritmo + dia 1. */
export const criarPlano = (perfil: Pick<PerfilCapilar, "curvaturas" | "quimica" | "porosidade" | "frequencia">, hoje: string, id: string): PlanoCapilar => ({
  id,
  sequencia: gerarCronograma(perfil),
  ritmo: ritmoDaFrequencia(perfil.frequencia),
  inicio: hoje,
});

export const perfilDasRespostas = (
  r: { curvaturas: Curvatura[]; quimica: Quimica; frequencia: Frequencia; porosidade: [number, number, number] },
  hoje: string,
): PerfilCapilar => ({
  curvaturas: r.curvaturas.slice(0, 2),
  quimica: r.quimica,
  frequencia: r.frequencia,
  porosidade: calculatePorosity(r.porosidade),
  respostasPorosidade: r.porosidade,
  criadoEm: hoje,
});

/** "7 hidratações, 4 nutrições e 1 reconstrução" */
export const resumoDaSequencia = (seq: Etapa[]): string => {
  const c = (e: Etapa) => seq.filter((x) => x === e).length;
  const parte = (n: number, um: string, varios: string) => (n ? `${n} ${n === 1 ? um : varios}` : "");
  const partes = [parte(c("hidratacao"), "hidratação", "hidratações"), parte(c("nutricao"), "nutrição", "nutrições"), parte(c("reconstrucao"), "reconstrução", "reconstruções")].filter(Boolean);
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes.join("");
};

/* ------------------------------------------------------------ a fila (a sequência só anda com FEITO) */

/** Intervalo mínimo entre duas reconstruções. */
export const DIAS_ENTRE_RECONSTRUCOES = 15;

const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Só o que dá pra ler: plano torto vira null (a tela oferece as 4 perguntas de novo, sem regravar nada). */
export const planoValido = (p: unknown): PlanoCapilar | null => {
  if (!p || typeof p !== "object") return null;
  const x = p as Partial<PlanoCapilar>;
  const seq = lista<Etapa>(x.sequencia).filter((e) => e === "hidratacao" || e === "nutricao" || e === "reconstrucao");
  if (!seq.length || typeof x.id !== "string" || !ehDia(x.inicio)) return null;
  const r = x.ritmo as Ritmo | undefined;
  const ritmo: Ritmo | null =
    r?.tipo === "semana" && lista<number>(r.dias).some((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      ? { tipo: "semana", dias: [...new Set(lista<number>(r.dias).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() }
      : r?.tipo === "intervalo" && Number.isFinite(r.dias) && r.dias >= 1
        ? { tipo: "intervalo", dias: Math.round(r.dias) }
        : null;
  if (!ritmo) return null;
  const trocas = x.trocas && typeof x.trocas === "object" ? Object.fromEntries(Object.entries(x.trocas).filter(([a, b]) => ehDia(a) && ehDia(b))) : undefined;
  return { id: x.id, sequencia: seq, ritmo, inicio: x.inicio, ...(trocas ? { trocas } : {}) };
};

export const lavagensValidas = (v: unknown): LavagemCapilar[] =>
  lista<LavagemCapilar>(v).filter((l) => !!l && typeof l === "object" && typeof l.id === "string" && ehDia(l.data));

/** As lavagens que contam no cronograma deste plano, em ordem de data. */
export const lavagensDoPlano = (plano: PlanoCapilar, lavagens: LavagemCapilar[]): LavagemCapilar[] =>
  lavagens
    .filter((l) => l.feita && l.noPlano && l.plano === plano.id && (l.etapa === "hidratacao" || l.etapa === "nutricao" || l.etapa === "reconstrucao"))
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));

export interface EstadoDaFila {
  /** o que falta do ciclo atual, na ordem */
  fila: Etapa[];
  /** 1, 2, 3… */
  ciclo: number;
  /** lavagens do cronograma já feitas no ciclo atual */
  feitasNoCiclo: number;
  ultima?: string;
  ultimaR?: string;
}

/** Repassa as lavagens feitas pela fila: cada uma tira a sua etapa (a 1ª igual); fila vazia = ciclo novo. */
export function estadoDaFila(plano: PlanoCapilar, lavagens: LavagemCapilar[]): EstadoDaFila {
  let fila = [...plano.sequencia];
  let ciclo = 1;
  let ultima: string | undefined;
  let ultimaR: string | undefined;
  for (const l of lavagensDoPlano(plano, lavagens)) {
    if (!fila.length) { fila = [...plano.sequencia]; ciclo++; }
    const i = fila.indexOf(l.etapa as Etapa);
    fila.splice(i >= 0 ? i : 0, 1);
    ultima = l.data;
    if (l.etapa === "reconstrucao") ultimaR = l.data;
  }
  if (!fila.length) { fila = [...plano.sequencia]; ciclo++; }
  return { fila, ciclo, feitasNoCiclo: plano.sequencia.length - fila.length, ultima, ultimaR };
}

/** R cedo demais? (a menos de 15 dias da última) */
export const reconstrucaoEspera = (ultimaR: string | undefined, dia: string): boolean =>
  !!ultimaR && diasEntre(ultimaR, dia) < DIAS_ENTRE_RECONSTRUCOES;

/** A etapa da vez num dia: a primeira da fila — a não ser que seja R cedo demais; aí passa a próxima. */
export function etapaDaVez(fila: Etapa[], sequencia: Etapa[], ultimaR: string | undefined, dia: string): { etapa: Etapa; indice: number; rEspera: boolean } {
  const pool = fila.length ? fila : sequencia;
  const primeira = pool[0] ?? "hidratacao";
  if (primeira !== "reconstrucao" || !reconstrucaoEspera(ultimaR, dia)) return { etapa: primeira, indice: 0, rEspera: false };
  const j = pool.findIndex((e) => e !== "reconstrucao");
  if (j >= 0) return { etapa: pool[j], indice: j, rEspera: true };
  return { etapa: sequencia.find((e) => e !== "reconstrucao") ?? "hidratacao", indice: -1, rEspera: true };
}

/* ------------------------------------------------------------ a agenda (MEU MÊS, CABELO DE HOJE, lembrete) */

/** Os dias previstos de lavar a partir de `desde` (inclusive) até `ate` (inclusive), com as trocas do MEU MÊS. */
export function diasPrevistos(plano: PlanoCapilar, estado: EstadoDaFila, desde: string, ate: string): string[] {
  const base: string[] = [];
  if (plano.ritmo.tipo === "semana") {
    const dias = plano.ritmo.dias;
    for (let d = desde; d <= ate; d = somarDias(d, 1)) if (dias.includes(diaDaSemanaDe(d))) base.push(d);
  } else {
    const n = plano.ritmo.dias;
    let d = estado.ultima ? somarDias(estado.ultima, n) : plano.inicio;
    if (d < desde) d = desde; // atrasou: o cronograma espera — a próxima é hoje
    for (; d <= ate; d = somarDias(d, n)) base.push(d);
  }
  const trocas = plano.trocas ?? {};
  const movidos = base.map((d) => trocas[d] ?? d).filter((d) => d >= desde && d <= ate);
  // troca PRA um dia que não era de lavar também vale (mudou de qua pra qui)
  for (const [de, para] of Object.entries(trocas)) if (para >= desde && para <= ate && de < desde) movidos.push(para);
  return [...new Set(movidos)].sort();
}

export type DiaDaAgenda = { dia: string; etapa: Etapa; rEspera: boolean };

/**
 * A agenda daqui pra frente: cada dia previsto recebe a etapa da vez, simulando a
 * fila (e a R que espera 15 dias). Se hoje já teve a lavagem do cronograma, começa amanhã.
 */
export function agendaCapilar(plano: PlanoCapilar, lavagens: LavagemCapilar[], hoje: string, dias = 28): DiaDaAgenda[] {
  const estado = estadoDaFila(plano, lavagens);
  const jaHoje = lavagensDoPlano(plano, lavagens).some((l) => l.data === hoje);
  const desde = jaHoje ? somarDias(hoje, 1) : hoje;
  const ate = somarDias(hoje, dias - 1);
  let fila = [...estado.fila];
  let ultimaR = estado.ultimaR;
  const out: DiaDaAgenda[] = [];
  for (const dia of diasPrevistos(plano, estado, desde, ate)) {
    if (!fila.length) fila = [...plano.sequencia];
    const v = etapaDaVez(fila, plano.sequencia, ultimaR, dia);
    if (v.indice >= 0) fila.splice(v.indice, 1);
    if (v.etapa === "reconstrucao") ultimaR = dia;
    out.push({ dia, etapa: v.etapa, rEspera: v.rEspera });
  }
  return out;
}

/** A próxima lavagem prevista (hoje, se hoje é dia e ainda não lavou). */
export const proximaLavagem = (plano: PlanoCapilar, lavagens: LavagemCapilar[], hoje: string): DiaDaAgenda | null =>
  agendaCapilar(plano, lavagens, hoje, 60)[0] ?? null;

/** A lavagem do cronograma feita num dia (a do plano atual). */
export const lavagemDoDia = (plano: PlanoCapilar | null, lavagens: LavagemCapilar[], dia: string): LavagemCapilar | null =>
  lavagens.find((l) => l.data === dia && l.noPlano && (!plano || l.plano === plano.id)) ?? null;

/* ------------------------------------------------------------ o lembrete */

export type LembreteCabelo = { dia: { ligado: boolean; hora: string }; vespera: { ligado: boolean; hora: string } };

/**
 * 08:30 no dia de lavar e 20:30 na véspera (umectação) — na meia hora, como os do
 * skincare, pra não empilhar com os diários de hora cheia. Nascem DESLIGADOS (regra
 * do dono pra todo lembrete novo). Horário final: decisão do dono.
 */
export const LEMBRETE_CABELO_PADRAO: LembreteCabelo = {
  dia: { ligado: false, hora: "08:30" },
  vespera: { ligado: false, hora: "20:30" },
};

export const lerLembreteCabelo = (bruto: unknown): LembreteCabelo => {
  const b = (bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {}) as Partial<Record<keyof LembreteCabelo, { ligado?: unknown; hora?: unknown }>>;
  const um = (k: keyof LembreteCabelo) => ({
    ligado: b[k]?.ligado === true,
    hora: normalizarHora(typeof b[k]?.hora === "string" ? (b[k]?.hora as string) : undefined) ?? LEMBRETE_CABELO_PADRAO[k].hora,
  });
  return { dia: um("dia"), vespera: um("vespera") };
};

export const lembreteCabeloLigado = (l: LembreteCabelo): boolean => l.dia.ligado || l.vespera.ligado;

type Leitor = <T>(key: string, fallback: T) => T;

export interface DadosDoCabelo {
  prefs: LembreteCabelo;
  plano: PlanoCapilar | null;
  lavagens: LavagemCapilar[];
}

export const lerDadosDoCabelo = (get: Leitor): DadosDoCabelo => ({
  prefs: lerLembreteCabelo(get<unknown>(CHAVE_LEMBRETE_CABELO, undefined)),
  plano: planoValido(get<unknown>(CHAVE_PLANO_CABELO, null)),
  lavagens: lavagensValidas(get<unknown>(CHAVE_LAVAGENS, [])),
});

export type AvisoDeCabelo = { quando: Date; title: string; body: string; id: number };

const TETO_CABELO = 24;

/** O texto de um aviso de dia de lavar (também é a prévia da tela). */
export const textoDoDiaDeLavar = (etapa: Etapa): { title: string; body: string } => ({
  title: `💆 Hoje é dia de ${ETAPAS[etapa].rotulo}`,
  body: `Cabelo de hoje: ${passosDaLavagem(etapa).map((p) => p.rotulo.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " e $1")}.`,
});

export const textoDaVespera = (etapa: Etapa): { title: string; body: string } => ({
  title: `🌙 Amanhã é dia de ${ETAPAS[etapa].rotulo}`,
  body: "Umectação hoje à noite? Óleo no comprimento, e amanhã lava normal.",
});

/**
 * Os avisos a agendar (10 dias), já com id na faixa: no dia de lavar (na hora
 * escolhida) e, se ligado, na véspera. Só no futuro. Mudar a fila (FEITO) muda a
 * agenda → o reagendador refaz a série. PURA.
 */
export function planejarCabelo(d: DadosDoCabelo, base: number, agora = new Date()): AvisoDeCabelo[] {
  if (!d.plano || !lembreteCabeloLigado(d.prefs)) return [];
  const hoje = localDayKey(agora);
  const agenda = agendaCapilar(d.plano, d.lavagens, hoje, 12);
  const avisos: Omit<AvisoDeCabelo, "id">[] = [];
  const quando = (dia: string, hora: string) => {
    const [h, m] = hora.split(":").map(Number);
    const x = parseLocalDay(dia);
    x.setHours(h, m, 0, 0);
    return x;
  };
  for (const a of agenda) {
    if (d.prefs.dia.ligado) {
      const q = quando(a.dia, d.prefs.dia.hora);
      if (q.getTime() > agora.getTime()) avisos.push({ quando: q, ...textoDoDiaDeLavar(a.etapa) });
    }
    if (d.prefs.vespera.ligado) {
      const q = quando(somarDias(a.dia, -1), d.prefs.vespera.hora);
      if (q.getTime() > agora.getTime()) avisos.push({ quando: q, ...textoDaVespera(a.etapa) });
    }
  }
  return avisos
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .slice(0, TETO_CABELO)
    .map((a, i) => ({ ...a, id: base + i }));
}
