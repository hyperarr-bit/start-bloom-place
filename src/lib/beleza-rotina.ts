import { CONFLICT_RULES, type ConflictRule, type Product } from "@/components/beleza/utils";
import { parseLocalDay } from "@/lib/utils";

/**
 * ROTINA PRONTA EM 3 TOQUES + "O QUE EU USO HOJE" (28/09, protótipo pro dono aprovar).
 *
 * Por quê: 32% das pessoas abrem a Beleza (424 em 30 dias) e ficam 35 s. A Rotina
 * abre VAZIA ("Adicione seus passos"). Nas 11 mil avaliações de ~50 apps de pele,
 * o que segura é a rotina do dia — "o que eu passo hoje", marcar feito, lembrete no
 * horário — e ter os MEUS produtos. Aqui: três perguntas (pele, objetivo, nível)
 * viram uma rotina de manhã e de noite com FREQUÊNCIA por passo (o ácido 3× por
 * semana, o protetor todo dia), e cada passo pode ter um produto de verdade.
 *
 * DADOS — a regra dura de 28/09 (Finanças caiu no app antigo porque uma chave
 * sincronizada virou objeto): NENHUMA chave muda de tipo.
 *  - `skincare-am-steps` / `skincare-pm-steps` continuam arrays de objetos
 *    `{ name, isSunscreen?, isAcid? }`; o passo ganha só campos OPCIONAIS:
 *    `dias` (0 = segunda … 6 = domingo; ausente = todo dia), `produtoId` (id na
 *    Bancada) e `tipo` (de onde veio, filtra a lista de produtos). O app antigo
 *    ignora os três e mostra todos os passos todo dia, como sempre mostrou.
 *  - Os checks continuam índice no array INTEIRO (`skincare-*-checked`), mesmo
 *    quando o passo não é de hoje.
 *  - `beauty-products` (Bancada) ganha `catalogoId`, `ativos` e `paoPadrao`,
 *    opcionais; o resto do produto é o de sempre.
 * Tudo aqui é PURO pra ser testável sem tela.
 */

export type Periodo = "manha" | "noite";
export type TipoDePele = "oleosa" | "mista" | "normal" | "seca" | "sensivel";
export type Objetivo = "acne" | "manchas" | "hidratacao" | "sinais" | "basico";
export type Nivel = "iniciante" | "intermediario" | "avancado";
export type PerfilDaPele = { pele: TipoDePele; objetivo: Objetivo; nivel: Nivel };

/** O que o passo é — de onde veio no gerador e o filtro da lista de produtos. */
export type TipoDoPasso =
  | "limpeza" | "hidratante" | "protetor"
  | "vitamina-c" | "niacinamida" | "hialuronico"
  | "acido-salicilico" | "acido-glicolico" | "retinol";

export interface PassoDaRotina {
  name: string;
  isSunscreen?: boolean;
  isAcid?: boolean;
  /** dias da semana em que o passo entra (0 = segunda … 6 = domingo); ausente = todo dia */
  dias?: number[];
  /** produto da Bancada (`beauty-products[].id`) usado neste passo */
  produtoId?: string;
  tipo?: TipoDoPasso | string;
}

/** Produto da Bancada com os campos opcionais de 28/09. */
export type ProdutoDaBancada = Product & { catalogoId?: string; ativos?: string[]; paoPadrao?: boolean };

export const CHAVE_PASSOS: Record<Periodo, string> = { manha: "skincare-am-steps", noite: "skincare-pm-steps" };
export const CHAVE_FEITOS: Record<Periodo, string> = { manha: "skincare-morning-checked", noite: "skincare-night-checked" };
export const CHAVE_PERFIL = "skincare-perfil";
/** Chave NOVA (objeto) das dicas já dispensadas — `-prefs`: é ajuste, não conta pra sequência. */
export const CHAVE_DICAS = "skincare-dicas-prefs";

/* ------------------------------------------------------------ as perguntas */

export const OPCOES_PELE: { id: TipoDePele; rotulo: string; emoji: string; dica: string }[] = [
  { id: "oleosa", rotulo: "Oleosa", emoji: "💧", dica: "brilha ao longo do dia, poro aparente" },
  { id: "mista", rotulo: "Mista", emoji: "⚖️", dica: "oleosa na testa e no nariz, seca no resto" },
  { id: "normal", rotulo: "Normal", emoji: "🙂", dica: "nem oleosa nem seca" },
  { id: "seca", rotulo: "Seca", emoji: "🌵", dica: "repuxa depois de lavar, descama" },
  { id: "sensivel", rotulo: "Sensível", emoji: "🍅", dica: "arde ou fica vermelha fácil" },
];

export const OPCOES_OBJETIVO: { id: Objetivo; rotulo: string; emoji: string; dica: string }[] = [
  { id: "acne", rotulo: "Acne e espinhas", emoji: "🔴", dica: "cravos, espinhas, oleosidade" },
  { id: "manchas", rotulo: "Manchas", emoji: "🟤", dica: "marcas de espinha, melasma, sol" },
  { id: "hidratacao", rotulo: "Hidratação", emoji: "💦", dica: "pele sem viço, repuxando" },
  { id: "sinais", rotulo: "Sinais do tempo", emoji: "⏳", dica: "linhas finas, firmeza" },
  { id: "basico", rotulo: "Só o básico bem feito", emoji: "✨", dica: "limpar, hidratar, proteger" },
];

export const OPCOES_NIVEL: { id: Nivel; rotulo: string; emoji: string; dica: string }[] = [
  { id: "iniciante", rotulo: "Iniciante", emoji: "🌱", dica: "o essencial, poucos passos" },
  { id: "intermediario", rotulo: "Intermediário", emoji: "🌿", dica: "um sérum de manhã e um ativo à noite" },
  { id: "avancado", rotulo: "Avançado", emoji: "🌳", dica: "dois ativos à noite, em dias alternados" },
];

/* ------------------------------------------------------------ dias */

export const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];
export const DIAS_CURTOS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DIAS_MINUSC = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** 0 = segunda … 6 = domingo (o JS conta domingo = 0). */
export const diaDaSemana = (d: Date): number => (d.getDay() + 6) % 7;
export const diaDaSemanaDaChave = (dia: string): number => diaDaSemana(parseLocalDay(dia));

/**
 * AS DUAS VAGAS DA NOITE. O retinol mora em seg/qua/sex, os ácidos em ter/qui/sáb
 * — nunca se cruzam, então "retinol + ácido no mesmo dia" (a regra de alternar os
 * dias) não acontece em rotina nenhuma que o gerador monta. Domingo fica livre:
 * noite de descanso da pele (é o "recovery" do skin cycling).
 */
const VAGA_RETINOL: Record<number, number[]> = { 1: [2], 2: [0, 4], 3: [0, 2, 4] };
const VAGA_ACIDO: Record<number, number[]> = { 1: [5], 2: [1, 5], 3: [1, 3, 5] };

/** Dias válidos do passo. Ausente, vazio ou lixo = TODO dia (dado torto nunca some com o passo). */
export const diasDoPasso = (p: unknown): number[] => {
  const d = (p as PassoDaRotina | null | undefined)?.dias;
  if (!Array.isArray(d)) return TODOS_OS_DIAS;
  const ok = [...new Set(d.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6))].sort((a, b) => a - b);
  return ok.length ? ok : TODOS_OS_DIAS;
};

export const ehTodoDia = (p: unknown): boolean => diasDoPasso(p).length === 7;

/** "todo dia", "3×/sem", "1×/sem". */
export const ritmoDoPasso = (p: unknown): string => {
  const n = diasDoPasso(p).length;
  return n === 7 ? "todo dia" : `${n}×/sem`;
};

/** "seg · qua · sex" */
export const diasPorExtenso = (p: unknown): string => diasDoPasso(p).map((d) => DIAS_MINUSC[d]).join(" · ");

/** O passo é legível (objeto com nome)? Dado torto não entra na tela — mas o ÍNDICE dos outros não muda. */
export const passoValido = (p: unknown): p is PassoDaRotina =>
  !!p && typeof p === "object" && typeof (p as PassoDaRotina).name === "string" && (p as PassoDaRotina).name.trim() !== "";

/** Os passos de UM dia da semana, com o índice no array INTEIRO (é o que o check grava). */
export const passosDoDia = (passos: unknown, dia: number): { passo: PassoDaRotina; i: number }[] =>
  (Array.isArray(passos) ? passos : [])
    .map((passo, i) => ({ passo, i }))
    .filter((x): x is { passo: PassoDaRotina; i: number } => passoValido(x.passo) && diasDoPasso(x.passo).includes(dia));

/** Os que ficam de fora nesse dia (pra "hoje não: Retinol (seg · sex)"). */
export const passosForaDoDia = (passos: unknown, dia: number): { passo: PassoDaRotina; i: number }[] =>
  (Array.isArray(passos) ? passos : [])
    .map((passo, i) => ({ passo, i }))
    .filter((x): x is { passo: PassoDaRotina; i: number } => passoValido(x.passo) && !diasDoPasso(x.passo).includes(dia));

/** Alguma etapa com dias próprios? (Sem nenhuma, é rotina "todo dia" — a antiga, ou montada assim.) */
export const temAgenda = (manha: unknown, noite: unknown): boolean =>
  [manha, noite].some((l) => Array.isArray(l) && l.some((p) => passoValido(p) && !ehTodoDia(p)));

/** Liga/desliga um dia do passo. O último dia não sai (passo sem dia nenhum = passo apagado; pra isso existe Remover). */
export const alternarDia = (p: PassoDaRotina, dia: number): PassoDaRotina => {
  const atuais = diasDoPasso(p);
  const novos = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia].sort((a, b) => a - b);
  if (!novos.length) return p;
  const { dias: _d, ...resto } = p;
  return novos.length === 7 ? resto : { ...resto, dias: novos };
};

/**
 * SEM O CICLO FIXO DE 4 DIAS (28/09, dono: "a MINHA SEMANA passa a ser o único
 * jeito"). Rotina antiga — ou montada à mão — com ativo à noite TODO DIA (retinol
 * e ácido juntos, de novo e de novo): a sugestão é a mesma agenda que o gerador
 * usa. Retinoide nas vagas seg/qua/sex; ácidos nas ter/qui/sáb (dois ácidos
 * dividem as vagas, pra AHA e BHA também não caírem no mesmo dia); domingo livre.
 * Só mexe em passo ativo que está todo dia; o resto fica como está. É OFERTA:
 * a tela mostra e só aplica no toque ("Alternar"), com Desfazer.
 */
export function sugerirDias(noite: unknown): { i: number; dias: number[] }[] {
  const ativos = (Array.isArray(noite) ? noite : [])
    .map((passo, i) => ({ passo, i }))
    .filter((x): x is { passo: PassoDaRotina; i: number } => passoValido(x.passo) && !!x.passo.isAcid && ehTodoDia(x.passo));
  const retinoide = (p: PassoDaRotina) => p.tipo === "retinol" || /retin/i.test(p.name);
  const retinoides = ativos.filter(({ passo }) => retinoide(passo));
  const acidos = ativos.filter(({ passo }) => !retinoide(passo));
  const diasDosAcidos = (k: number, n: number): number[] =>
    n === 1 ? VAGA_ACIDO[3] : n === 2 ? (k === 0 ? [1, 5] : [3]) : [VAGA_ACIDO[3][k % 3]];
  return [
    ...retinoides.map(({ i }) => ({ i, dias: VAGA_RETINOL[3] })),
    ...acidos.map(({ i }, k) => ({ i, dias: diasDosAcidos(k, acidos.length) })),
  ];
}

/** "Vitamina C", "Ácido salicílico", "Hidratante leve" — o nome curto da grade da semana. */
export const nomeCurto = (nome: string): string =>
  String(nome ?? "")
    .replace(/^s[ée]rum\s+de\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

/* ------------------------------------------------------------ o gerador */

const NOMES: Record<TipoDoPasso, (pele: TipoDePele) => string> = {
  limpeza: (pele) => (pele === "oleosa" || pele === "mista" ? "Gel de limpeza" : pele === "seca" || pele === "sensivel" ? "Limpeza suave" : "Limpeza"),
  hidratante: (pele) =>
    pele === "oleosa" || pele === "mista" ? "Hidratante leve (gel)" : pele === "seca" ? "Hidratante nutritivo" : pele === "sensivel" ? "Hidratante calmante" : "Hidratante",
  protetor: (pele) => (pele === "oleosa" || pele === "mista" ? "Protetor solar (toque seco)" : "Protetor solar"),
  "vitamina-c": () => "Sérum de vitamina C",
  niacinamida: () => "Sérum de niacinamida",
  hialuronico: () => "Sérum de ácido hialurônico",
  "acido-salicilico": () => "Ácido salicílico (BHA)",
  "acido-glicolico": () => "Ácido glicólico (AHA)",
  retinol: () => "Retinol",
};

/** O ativo principal de cada tipo — é o que "ingredientes a evitar" compara. */
export const ATIVO_DO_TIPO: Partial<Record<TipoDoPasso, string>> = {
  "vitamina-c": "vitamina c",
  niacinamida: "niacinamida",
  hialuronico: "ácido hialurônico",
  "acido-salicilico": "ácido salicílico",
  "acido-glicolico": "ácido glicólico",
  retinol: "retinol",
};

const ESFOLIA: TipoDoPasso[] = ["acido-salicilico", "acido-glicolico", "retinol"];

type Tratamento = { tipo: TipoDoPasso; vezes: 1 | 2 | 3 | 7 };
type Plano = { manha: TipoDoPasso[]; noite: Tratamento[] };

/**
 * O que cada objetivo pede, por nível. Iniciante = UM tratamento (ou nenhum, no
 * básico): começar devagar é o conselho de todo dermatologista. Intermediário
 * põe um sérum de manhã; avançado, dois ativos à noite em vagas que não se cruzam.
 * Ordem da noite: ácido/retinol antes do sérum, hidratante sempre por último.
 */
const PLANOS: Record<Objetivo, Record<Nivel, Plano>> = {
  acne: {
    iniciante: { manha: [], noite: [{ tipo: "acido-salicilico", vezes: 2 }] },
    intermediario: { manha: ["niacinamida"], noite: [{ tipo: "acido-salicilico", vezes: 3 }] },
    avancado: { manha: ["niacinamida"], noite: [{ tipo: "acido-salicilico", vezes: 3 }, { tipo: "retinol", vezes: 2 }] },
  },
  manchas: {
    iniciante: { manha: ["vitamina-c"], noite: [] },
    intermediario: { manha: ["vitamina-c"], noite: [{ tipo: "acido-glicolico", vezes: 2 }] },
    avancado: { manha: ["vitamina-c"], noite: [{ tipo: "acido-glicolico", vezes: 2 }, { tipo: "retinol", vezes: 2 }] },
  },
  hidratacao: {
    iniciante: { manha: ["hialuronico"], noite: [] },
    intermediario: { manha: ["hialuronico"], noite: [{ tipo: "niacinamida", vezes: 7 }] },
    avancado: { manha: ["vitamina-c", "hialuronico"], noite: [{ tipo: "niacinamida", vezes: 7 }] },
  },
  sinais: {
    iniciante: { manha: [], noite: [{ tipo: "retinol", vezes: 2 }] },
    intermediario: { manha: ["vitamina-c"], noite: [{ tipo: "retinol", vezes: 3 }] },
    avancado: { manha: ["vitamina-c"], noite: [{ tipo: "retinol", vezes: 3 }, { tipo: "acido-glicolico", vezes: 1 }] },
  },
  basico: {
    iniciante: { manha: [], noite: [] },
    intermediario: { manha: ["niacinamida"], noite: [] },
    avancado: { manha: ["vitamina-c"], noite: [{ tipo: "acido-glicolico", vezes: 1 }, { tipo: "niacinamida", vezes: 7 }] },
  },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "ingredientes a evitar" da Bancada bate com o ativo? ("Ácido Salicílico" = "acido salicilico") */
export const evitaAtivo = (evitar: string[] | undefined, ativo: string): boolean => {
  const a = norm(ativo);
  return (evitar ?? []).some((e) => {
    const x = norm(String(e ?? ""));
    return x.length >= 3 && (a.includes(x) || x.includes(a));
  });
};

const passo = (tipo: TipoDoPasso, pele: TipoDePele, dias?: number[]): PassoDaRotina => ({
  name: NOMES[tipo](pele),
  tipo,
  ...(tipo === "protetor" ? { isSunscreen: true } : {}),
  ...(ESFOLIA.includes(tipo) ? { isAcid: true } : {}),
  ...(dias && dias.length < 7 ? { dias } : {}),
});

/**
 * As três respostas viram a rotina. Pele muda o NOME da base (gel pra oleosa,
 * suave pra seca/sensível) e o RITMO dos ativos: pele sensível não leva ácido
 * glicólico (troca por niacinamida) e nenhum esfoliante passa de 2× por semana;
 * pele seca também segura os esfoliantes em 2×; vitamina C na sensível fica em
 * dias alternados. O que está em "ingredientes a evitar" não entra.
 */
export function gerarRotina(perfil: PerfilDaPele, evitar: string[] = []): { manha: PassoDaRotina[]; noite: PassoDaRotina[] } {
  const { pele, objetivo, nivel } = perfil;
  const plano = PLANOS[objetivo]?.[nivel] ?? PLANOS.basico.iniciante;
  const sensivel = pele === "sensivel";
  const tetoEsfoliante = sensivel || pele === "seca" ? 2 : 3;
  const pode = (t: TipoDoPasso) => !ATIVO_DO_TIPO[t] || !evitaAtivo(evitar, ATIVO_DO_TIPO[t] as string);

  // noite: troca e teto antes de distribuir nas vagas
  let noite: Tratamento[] = plano.noite.map((t) => ({ ...t }));
  if (sensivel && noite.some((t) => t.tipo === "acido-glicolico")) {
    noite = noite.filter((t) => t.tipo !== "acido-glicolico");
    if (!noite.some((t) => t.tipo === "niacinamida") && !plano.manha.includes("niacinamida")) noite.push({ tipo: "niacinamida", vezes: 7 });
  }
  noite = noite
    .filter((t) => pode(t.tipo))
    .map((t) => (ESFOLIA.includes(t.tipo) && t.vezes !== 7 ? { ...t, vezes: Math.min(t.vezes, tetoEsfoliante) as Tratamento["vezes"] } : t));

  const diasDe = (t: Tratamento): number[] | undefined => {
    if (t.vezes === 7) return undefined;
    return t.tipo === "retinol" ? VAGA_RETINOL[t.vezes] : VAGA_ACIDO[t.vezes];
  };

  const manha: PassoDaRotina[] = [
    passo("limpeza", pele),
    ...plano.manha.filter(pode).map((t) => passo(t, pele, t === "vitamina-c" && sensivel ? [0, 2, 4] : undefined)),
    passo("hidratante", pele),
    passo("protetor", pele),
  ];
  const ordem: TipoDoPasso[] = ["acido-salicilico", "acido-glicolico", "retinol", "niacinamida", "hialuronico", "vitamina-c"];
  const tratamentos = [...noite].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));
  const noitePassos: PassoDaRotina[] = [
    passo("limpeza", pele),
    ...tratamentos.map((t) => passo(t.tipo, pele, diasDe(t))),
    passo("hidratante", pele),
  ];
  return { manha, noite: noitePassos };
}

/* ------------------------------------------------------------ conflitos com agenda e produto */

/** Sinônimos de classe: glicólico/lático/mandélico são AHA; salicílico e LHA, BHA; retinal é retinoide. */
const CLASSE: Record<string, string[]> = {
  "ácido glicólico": ["aha"],
  "ácido lático": ["aha"],
  "ácido mandélico": ["aha"],
  "ácido salicílico": ["bha"],
  lha: ["bha"],
  retinal: ["retinol"],
};

/**
 * Tudo pelo que um passo pode conflitar: o nome digitado, o tipo e os ativos do
 * produto escolhido. Produto de ENXÁGUE (o passo de limpeza) não conta com os
 * ativos dele: o gel com ácido salicílico sai da pele em segundos e não "briga"
 * com o retinol que vem depois — acusar isso seria alarme falso toda noite.
 */
export const termosDoPasso = (p: PassoDaRotina, produto?: { ativos?: unknown } | null): string[] => {
  const termos = new Set<string>([String(p?.name ?? "").toLowerCase()]);
  const doTipo = p?.tipo ? ATIVO_DO_TIPO[p.tipo as TipoDoPasso] : undefined;
  const enxague = (p?.tipo ?? tipoPeloNome(String(p?.name ?? ""))) === "limpeza";
  const ativos = [...(doTipo ? [doTipo] : []), ...(!enxague && Array.isArray(produto?.ativos) ? (produto?.ativos as unknown[]) : [])];
  for (const a of ativos) {
    if (typeof a !== "string") continue;
    const x = a.toLowerCase();
    termos.add(x);
    (CLASSE[x] ?? []).forEach((c) => termos.add(c));
  }
  return [...termos];
};

export type PassoParaConflito = { nome: string; termos: string[]; dias: number[] };
export type ConflitoDoPlano = { regra: ConflictRule; a: string; b: string; dias: number[] };

/**
 * Conflito de ativos olhando a AGENDA (28/09). Mesmas regras de sempre
 * (CONFLICT_RULES): "horários diferentes" só conflita no mesmo período; "alterne
 * os dias" (mesmoDia) conflita em qualquer período. A diferença é que dois passos
 * que nunca caem no mesmo dia da semana não conflitam — retinol seg/qua/sex e
 * ácido ter/qui/sáb é exatamente o conselho. Um par de passos aparece uma vez só.
 */
export function conflitosDoPlano(manha: PassoParaConflito[], noite: PassoParaConflito[]): ConflitoDoPlano[] {
  const todos = [
    ...manha.map((p, i) => ({ ...p, periodo: "manha" as const, chave: `m${i}` })),
    ...noite.map((p, i) => ({ ...p, periodo: "noite" as const, chave: `n${i}` })),
  ];
  const tem = (p: { termos: string[] }, ingrediente: string) => p.termos.some((t) => t.includes(ingrediente));
  const vistos = new Set<string>();
  const out: ConflitoDoPlano[] = [];
  for (const regra of CONFLICT_RULES) {
    const [ia, ib] = regra.ingredients;
    for (const x of todos) {
      if (!tem(x, ia)) continue;
      for (const y of todos) {
        if (x.chave === y.chave || !tem(y, ib)) continue;
        if (x.periodo !== y.periodo && !regra.mesmoDia) continue;
        const dias = x.dias.filter((d) => y.dias.includes(d));
        if (!dias.length) continue;
        const par = [x.chave, y.chave].sort().join("|");
        if (vistos.has(par)) continue;
        vistos.add(par);
        out.push({ regra, a: x.nome, b: y.nome, dias });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ o que o passo é, pelo nome digitado */

/** Passo digitado à mão: o tipo sai do nome (filtra a lista de produtos e acha protetor/ácido). */
export const tipoPeloNome = (nome: string): TipoDoPasso | undefined => {
  const n = norm(nome);
  if (/protetor|fps|filtro solar|sunscreen/.test(n)) return "protetor";
  if (/retin/.test(n)) return "retinol";
  if (/salicil|\bbha\b/.test(n)) return "acido-salicilico";
  if (/glicol|\baha\b|latico|mandelico/.test(n)) return "acido-glicolico";
  if (/vitamina c|vit c|\bvit\. c/.test(n)) return "vitamina-c";
  if (/niacinamida/.test(n)) return "niacinamida";
  if (/hialuron/.test(n)) return "hialuronico";
  if (/hidratante|creme|moistur/.test(n)) return "hidratante";
  if (/limpeza|sabonete|cleanser|micelar|demaquil/.test(n)) return "limpeza";
  return undefined;
};

/** Passo novo digitado: protetor e ativo marcados pelo nome (o "OBRIGATÓRIO" e o modo sensível dependem disso). */
export const passoDigitado = (nome: string, periodo: Periodo): PassoDaRotina => {
  const tipo = tipoPeloNome(nome);
  return {
    name: nome.trim(),
    ...(tipo ? { tipo } : {}),
    ...(tipo === "protetor" && periodo === "manha" ? { isSunscreen: true } : {}),
    ...(tipo && ESFOLIA.includes(tipo) ? { isAcid: true } : {}),
  };
};

/* ------------------------------------------------------------ a lista curada de produtos */

export type CategoriaDoCatalogo = "limpeza" | "demaquilante" | "tonico" | "serum" | "acido" | "retinoide" | "hidratante" | "protetor" | "olhos";

export interface ProdutoDoCatalogo {
  id: string;
  marca: string;
  nome: string;
  categoria: CategoriaDoCatalogo;
  ativos: string[];
  tipos: TipoDePele[];
  fps?: number | null;
  cor?: boolean;
  /** meses de validade depois de aberto */
  pao: number;
  /** true = o rótulo/página não informa; é o padrão da categoria */
  paoPadrao: boolean;
  /** de onde o produto foi conferido — nunca aparece na tela */
  fonte: string;
  fontePao?: string | null;
  verificacao?: "pagina" | "busca";
}

/**
 * PAO que a página não informa: o padrão da categoria, sempre marcado como padrão
 * na tela ("12 meses · padrão"). Vitamina C e retinoide oxidam — 6 meses.
 */
export const PAO_PADRAO: Record<CategoriaDoCatalogo, number> = {
  limpeza: 12, demaquilante: 12, tonico: 12, serum: 6, acido: 12, retinoide: 6, hidratante: 12, protetor: 12, olhos: 6,
};

let cache: Promise<ProdutoDoCatalogo[]> | null = null;

/** Carregada SOB DEMANDA (como a TACO): quem nunca abre a lista não baixa nada. */
export const carregarCatalogo = (): Promise<ProdutoDoCatalogo[]> => {
  cache ??= import("@/data/produtos-beleza.json").then((m) => {
    const bruto = m as unknown as { default?: ProdutoDoCatalogo[] } | ProdutoDoCatalogo[];
    const lista = (Array.isArray(bruto) ? bruto : bruto.default ?? []) as ProdutoDoCatalogo[];
    return lista;
  });
  return cache;
};

/** O que cada tipo de passo aceita da lista: categoria e/ou ativo. */
const ENCAIXE: Record<TipoDoPasso, { categorias: CategoriaDoCatalogo[]; ativos?: string[] }> = {
  limpeza: { categorias: ["limpeza", "demaquilante"] },
  hidratante: { categorias: ["hidratante"] },
  protetor: { categorias: ["protetor"] },
  "vitamina-c": { categorias: ["serum", "hidratante", "olhos"], ativos: ["vitamina c"] },
  niacinamida: { categorias: ["serum", "hidratante", "tonico"], ativos: ["niacinamida"] },
  hialuronico: { categorias: ["serum", "hidratante"], ativos: ["ácido hialurônico"] },
  "acido-salicilico": { categorias: ["acido", "serum", "tonico"], ativos: ["ácido salicílico", "lha"] },
  "acido-glicolico": { categorias: ["acido", "serum", "tonico"], ativos: ["ácido glicólico", "ácido lático", "ácido mandélico"] },
  retinol: { categorias: ["retinoide", "serum", "hidratante"], ativos: ["retinol", "retinal"] },
};

export const encaixaNoPasso = (p: ProdutoDoCatalogo, tipo: TipoDoPasso | string | undefined): boolean => {
  const e = tipo ? ENCAIXE[tipo as TipoDoPasso] : undefined;
  if (!e) return false;
  if (!e.categorias.includes(p.categoria)) return false;
  if (!e.ativos) return true;
  return p.ativos.some((a) => e.ativos?.includes(a));
};

/** Produto tem algo da lista "ingredientes a evitar"? Devolve o que bateu (pra tela dizer). */
export const ativoEvitado = (p: Pick<ProdutoDoCatalogo, "ativos">, evitar: string[] | undefined): string | null =>
  p.ativos.find((a) => evitaAtivo(evitar, a)) ?? null;

/** Creme "Dia"/com FPS não é o hidratante da noite; "Noturno" não é o da manhã. */
const foraDoPeriodo = (p: ProdutoDoCatalogo, periodo?: Periodo): boolean => {
  if (!periodo) return false;
  const n = norm(p.nome);
  return periodo === "noite" ? /\bdia\b|diurno|\bfps\b/.test(n) : /noite|noturn/.test(n);
};

type Contexto = { pele?: TipoDePele; evitar?: string[]; periodo?: Periodo; tipo?: TipoDoPasso | string };

const pontuar = (p: ProdutoDoCatalogo, c: Contexto) =>
  (ativoEvitado(p, c.evitar) ? -100 : 0) +
  (c.tipo && encaixaNoPasso(p, c.tipo) ? 20 : 0) +
  (c.pele && p.tipos.includes(c.pele) ? 10 : 0) +
  (foraDoPeriodo(p, c.periodo) ? -8 : 0) +
  (p.verificacao === "pagina" ? 1 : 0);

const ordenar = (c: Contexto) => (a: ProdutoDoCatalogo, b: ProdutoDoCatalogo) =>
  pontuar(b, c) - pontuar(a, c) || a.marca.localeCompare(b.marca) || a.nome.localeCompare(b.nome);

/**
 * Os indicados pra um passo: os que encaixam; a pele da pessoa primeiro; o do
 * período errado ("Creme Dia FPS 30" no hidratante da noite) mais pra baixo; o
 * que ela evita por último, marcado.
 */
export function indicadosPara(
  lista: ProdutoDoCatalogo[],
  tipo: TipoDoPasso | string | undefined,
  pele?: TipoDePele,
  evitar?: string[],
  limite = 40,
  periodo?: Periodo,
): ProdutoDoCatalogo[] {
  return lista.filter((p) => encaixaNoPasso(p, tipo)).sort(ordenar({ pele, evitar, periodo })).slice(0, limite);
}

/**
 * Busca por nome ou marca: todas as palavras precisam aparecer ("cerave gel",
 * "anthelios"). O que encaixa no passo vem primeiro — "cerave hidratante" no
 * passo do hidratante traz o hidratante, não a loção de LIMPEZA hidratante.
 */
export function buscarProdutos(
  lista: ProdutoDoCatalogo[],
  consulta: string,
  pele?: TipoDePele,
  evitar?: string[],
  limite = 30,
  tipo?: TipoDoPasso | string,
  periodo?: Periodo,
): ProdutoDoCatalogo[] {
  const palavras = norm(consulta).split(/\s+/).filter((p) => p.length > 0);
  if (!palavras.length || norm(consulta).length < 2) return [];
  return lista
    .filter((p) => {
      const alvo = norm(`${p.marca} ${p.nome} ${p.ativos.join(" ")}`);
      return palavras.every((w) => alvo.includes(w));
    })
    .sort(ordenar({ pele, evitar, periodo, tipo }))
    .slice(0, limite);
}

/** "12 meses" / "6 meses · padrão" */
export const textoDoPao = (meses: number, padrao?: boolean): string => `${meses} ${meses === 1 ? "mês" : "meses"}${padrao ? " · padrão" : ""}`;

/**
 * O produto escolhido entra na BANCADA com o formato de sempre (o app antigo lê
 * igual) + os campos opcionais. Já está lá (mesmo item da lista, não acabou)? Usa
 * o mesmo — nada de duplicar. Devolve a Bancada nova e o id pro passo.
 */
export function guardarNaBancada(
  bancada: ProdutoDaBancada[],
  escolhido: ProdutoDoCatalogo | { marca: string; nome: string; categoria?: CategoriaDoCatalogo },
  novoId: string,
  ritmo = "Diário",
): { bancada: ProdutoDaBancada[]; id: string } {
  const lista = Array.isArray(bancada) ? bancada : [];
  const doCatalogo = "id" in escolhido && typeof escolhido.id === "string" && "fonte" in escolhido;
  if (doCatalogo) {
    const ja = lista.find((x) => x && !x.finished && x.catalogoId === (escolhido as ProdutoDoCatalogo).id);
    if (ja) return { bancada: lista, id: ja.id };
  }
  const c = escolhido as ProdutoDoCatalogo;
  const categoria = (c.categoria ?? "serum") as CategoriaDoCatalogo;
  const produto: ProdutoDaBancada = {
    id: novoId,
    name: c.nome.trim(),
    category: "Skincare",
    brand: c.marca.trim(),
    opened: false,
    openedDate: "",
    paoMonths: doCatalogo ? c.pao : PAO_PADRAO[categoria] ?? 12,
    expiry: "",
    notes: "",
    rating: 0,
    repurchase: false,
    price: 0,
    sizeMl: 0,
    photoUrl: "",
    frequency: ritmo,
    finished: false,
    ...(doCatalogo ? { catalogoId: c.id, ativos: [...c.ativos], paoPadrao: !!c.paoPadrao } : {}),
  };
  return { bancada: [...lista, produto], id: novoId };
}

/** "CeraVe · Gel de Limpeza Espumante" */
export const rotuloDoProduto = (p: Pick<Product, "brand" | "name"> | null | undefined): string =>
  !p ? "" : [String(p.brand ?? "").trim(), String(p.name ?? "").trim()].filter(Boolean).join(" · ");
