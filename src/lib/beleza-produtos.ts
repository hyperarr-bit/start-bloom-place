import { localDayKey, parseLocalDay } from "@/lib/utils";
import type { Product } from "@/components/beleza/utils";
import type { ProdutoDoCatalogo } from "@/lib/beleza-rotina";

/**
 * MEUS PRODUTOS COMPLETO (28/09, Onda 1 da Beleza).
 *
 *  - CATEGORIAS além do rosto: Pele, Cabelo, Corpo, Maquiagem, Unhas, Perfume (e Outro).
 *    "Skincare", o valor que o app sempre gravou, É a Pele — a chave não muda de tipo nem
 *    de valor pra quem já tem produto.
 *  - DUAS DATAS: "vence em" (mês/ano impresso — a Anvisa exige a validade impressa; o PAO
 *    não) no campo `expiry` que já existia no tipo, sem tela ("AAAA-MM", continua string);
 *    e "aberto em" + o PAO. A tela mostra a que vence PRIMEIRO.
 *  - PAO padrão por tipo (decisão do dono): rímel 3 meses, base 12, batom 18, perfume 36,
 *    cabelo 12, corpo 12 — marcado "padrão", editável.
 *  - VENCENDO: o que vence em até 30 dias, no topo; aviso 7 dias antes (desligado).
 *
 * `beauty-products` só ganha campos OPCIONAIS (`tipo`, `catalogoId`, `ativos`, `paoPadrao`):
 * o app antigo lê a mesma nuvem e ignora o que não conhece. PURO.
 */

export type CategoriaProduto = "Skincare" | "Cabelo" | "Corpo" | "Maquiagem" | "Unhas" | "Perfume" | "Outro";

export const CATEGORIAS_PRODUTO: { valor: CategoriaProduto; rotulo: string }[] = [
  { valor: "Skincare", rotulo: "Pele" },
  { valor: "Cabelo", rotulo: "Cabelo" },
  { valor: "Corpo", rotulo: "Corpo" },
  { valor: "Maquiagem", rotulo: "Maquiagem" },
  { valor: "Unhas", rotulo: "Unhas" },
  { valor: "Perfume", rotulo: "Perfume" },
  { valor: "Outro", rotulo: "Outro" },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** A categoria lida de qualquer valor gravado: "Skincare"/"Pele" = Pele; desconhecida = Outro. */
export const categoriaDe = (c: unknown): CategoriaProduto => {
  const s = typeof c === "string" ? semAcento(c) : "";
  if (s === "skincare" || s === "pele" || s === "rosto") return "Skincare";
  const achada = CATEGORIAS_PRODUTO.find((x) => semAcento(x.valor) === s);
  return achada ? achada.valor : "Outro";
};

export const rotuloDaCategoria = (c: unknown): string => CATEGORIAS_PRODUTO.find((x) => x.valor === categoriaDe(c))?.rotulo ?? "Outro";

export const TIPOS_MAQUIAGEM: { id: string; rotulo: string; pao: number }[] = [
  { id: "rimel", rotulo: "Rímel", pao: 3 },
  { id: "base", rotulo: "Base", pao: 12 },
  { id: "batom", rotulo: "Batom", pao: 18 },
  { id: "outro", rotulo: "Outra", pao: 12 },
];

/** PAO padrão do tipo (meses). */
export const paoPadraoDe = (categoria: unknown, tipo?: string): number => {
  const c = categoriaDe(categoria);
  if (c === "Maquiagem") return TIPOS_MAQUIAGEM.find((t) => t.id === tipo)?.pao ?? 12;
  if (c === "Perfume") return 36;
  return 12;
};

/** O que MEUS PRODUTOS guarda: o formato de sempre + os opcionais. */
export type ProdutoMeu = Product & { tipo?: string; paoPadrao?: boolean; catalogoId?: string; ativos?: string[] };

/* ------------------------------------------------------------ as duas datas */

/** "AAAA-MM" (a validade impressa) */
export const ehMesAno = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
/** "YYYY-MM-DD" que existe de verdade (dado torto como "2026-99-99" não vira data nenhuma). */
const ehDia = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && localDayKey(parseLocalDay(s)) === s;

/** A validade impressa vale até o último dia do mês. */
export const fimDoMes = (am: string): string => {
  const [a, m] = am.split("-").map(Number);
  return localDayKey(new Date(a, m, 0));
};

/** Depois de aberto: o dia de abertura + o PAO (meses). */
export const vencimentoAberto = (p: Pick<Product, "openedDate" | "paoMonths">): string | null => {
  if (!ehDia(p.openedDate) || !(Number(p.paoMonths) > 0)) return null;
  const d = parseLocalDay(p.openedDate);
  d.setMonth(d.getMonth() + Number(p.paoMonths));
  return localDayKey(d);
};

export type Vencimento = { dia: string; motivo: "impressa" | "aberto"; dias: number };

const diasEntre = (de: string, ate: string) => Math.round((parseLocalDay(ate).getTime() - parseLocalDay(de).getTime()) / 86_400_000);

/** A data que vence PRIMEIRO (a impressa ou a de depois de aberto); sem nenhuma das duas, null. */
export function vencimentoDoProduto(p: Pick<Product, "openedDate" | "paoMonths" | "expiry">, hoje: string = localDayKey()): Vencimento | null {
  const impressa = ehMesAno(p.expiry) ? fimDoMes(p.expiry) : null;
  const aberto = vencimentoAberto(p);
  const escolhida = impressa && aberto ? (aberto <= impressa ? { dia: aberto, motivo: "aberto" as const } : { dia: impressa, motivo: "impressa" as const })
    : aberto ? { dia: aberto, motivo: "aberto" as const }
    : impressa ? { dia: impressa, motivo: "impressa" as const }
    : null;
  return escolhida ? { ...escolhida, dias: diasEntre(hoje, escolhida.dia) } : null;
}

/** "vence em 12 dias (depois de aberto)" · "vence 03/2027 (data impressa)" · "venceu há 3 dias" */
export const textoDoVencimento = (v: Vencimento, comMotivo = true): string => {
  const quando = v.dias < 0 ? (v.dias === -1 ? "venceu ontem" : `venceu há ${-v.dias} dias`)
    : v.dias === 0 ? "vence hoje"
    : v.dias === 1 ? "vence amanhã"
    : v.dias < 60 ? `vence em ${v.dias} dias`
    : `vence ${v.dia.slice(5, 7)}/${v.dia.slice(0, 4)}`;
  if (!comMotivo) return quando;
  return `${quando} (${v.motivo === "aberto" ? "depois de aberto" : "data impressa"})`;
};

/** VENCENDO: os ativos que vencem em até `janela` dias (e os vencidos), o mais urgente primeiro. */
export const vencendo = <P extends ProdutoMeu>(lista: P[], hoje: string, janela = 30): { p: P; v: Vencimento }[] =>
  lista
    .filter((p) => p && !p.finished)
    .map((p) => ({ p, v: vencimentoDoProduto(p, hoje) }))
    .filter((x): x is { p: P; v: Vencimento } => !!x.v && x.v.dias <= janela)
    .sort((a, b) => a.v.dias - b.v.dias);

/* ------------------------------------------------------------ o aviso 7 dias antes */

export const CHAVE_LEMBRETE_VALIDADE = "beleza-validade-prefs";
export type LembreteValidade = { ligado: boolean; hora: string; diasAntes: number };
/** Nasce DESLIGADO (regra do dono); 09:00, 7 dias antes. */
export const LEMBRETE_VALIDADE_PADRAO: LembreteValidade = { ligado: false, hora: "09:00", diasAntes: 7 };

export const lerLembreteValidade = (b: unknown): LembreteValidade => {
  const x = (b && typeof b === "object" && !Array.isArray(b) ? b : {}) as Partial<LembreteValidade>;
  return {
    ligado: x.ligado === true,
    hora: typeof x.hora === "string" && /^\d{2}:\d{2}$/.test(x.hora) ? x.hora : LEMBRETE_VALIDADE_PADRAO.hora,
    diasAntes: Number.isInteger(x.diasAntes) && (x.diasAntes as number) >= 0 ? (x.diasAntes as number) : LEMBRETE_VALIDADE_PADRAO.diasAntes,
  };
};

export type AvisoDeValidade = { quando: Date; title: string; body: string; id: number };

export const textoDoAvisoDeValidade = (p: ProdutoMeu, v: Vencimento, diasAntes: number): { title: string; body: string } => ({
  title: `🧴 ${p.name.trim()} vence em ${diasAntes} ${diasAntes === 1 ? "dia" : "dias"}`,
  body: v.motivo === "aberto"
    ? `Validade depois de aberto (${p.paoMonths} ${Number(p.paoMonths) === 1 ? "mês" : "meses"}). Hora de repor?`
    : `Data impressa na embalagem: ${v.dia.slice(5, 7)}/${v.dia.slice(0, 4)}. Hora de repor?`,
});

/** Um aviso por produto ativo, N dias antes do vencimento que chega primeiro, na hora escolhida; 60 dias à frente. PURA. */
export function planejarValidade(lista: ProdutoMeu[], prefs: LembreteValidade, base: number, agora = new Date()): AvisoDeValidade[] {
  if (!prefs.ligado) return [];
  const hoje = localDayKey(agora);
  const [h, m] = prefs.hora.split(":").map(Number);
  const avisos: Omit<AvisoDeValidade, "id">[] = [];
  for (const p of lista) {
    if (!p || p.finished || typeof p.name !== "string" || !p.name.trim()) continue;
    const v = vencimentoDoProduto(p, hoje);
    if (!v || v.dias < prefs.diasAntes) continue;
    const q = parseLocalDay(v.dia);
    q.setDate(q.getDate() - prefs.diasAntes);
    q.setHours(h, m, 0, 0);
    if (q.getTime() <= agora.getTime() || diasEntre(hoje, localDayKey(q)) > 60) continue;
    avisos.push({ quando: q, ...textoDoAvisoDeValidade(p, v, prefs.diasAntes) });
  }
  return avisos.sort((a, b) => a.quando.getTime() - b.quando.getTime()).slice(0, 24).map((a, i) => ({ ...a, id: base + i }));
}

/* ------------------------------------------------------------ o catálogo de cabelo */

export type CategoriaCabelo = "shampoo" | "condicionador" | "mascara" | "leave-in" | "creme-de-pentear" | "finalizador" | "oleo" | "co-wash" | "tonico" | "ampola" | "outro";

export interface ProdutoDeCabelo {
  id: string;
  marca: string;
  nome: string;
  categoria: CategoriaCabelo;
  etapa: "hidratacao" | "nutricao" | "reconstrucao" | null;
  curvaturas: string[];
  pao: number;
  paoPadrao: boolean;
  /** de onde foi conferido — nunca aparece na tela */
  fonte: string;
  fontePao?: string | null;
  verificacao: "pagina" | "listagem";
}

export const ROTULO_CATEGORIA_CABELO: Record<CategoriaCabelo, string> = {
  shampoo: "Shampoo", condicionador: "Condicionador", mascara: "Máscara", "leave-in": "Leave-in", "creme-de-pentear": "Creme de pentear",
  finalizador: "Finalizador", oleo: "Óleo", "co-wash": "Co-wash", tonico: "Tônico", ampola: "Ampola", outro: "Cabelo",
};

const ROTULO_CATEGORIA_PELE: Record<string, string> = {
  limpeza: "Limpeza", demaquilante: "Demaquilante", tonico: "Tônico", serum: "Sérum", acido: "Ácido", retinoide: "Retinol", hidratante: "Hidratante",
  protetor: "Protetor solar", olhos: "Olhos", labios: "Lábios", mascara: "Máscara facial",
};

let cacheCabelo: Promise<ProdutoDeCabelo[]> | null = null;
/** Sob demanda (como a lista de pele): quem nunca busca não baixa nada. */
export const carregarCatalogoCabelo = (): Promise<ProdutoDeCabelo[]> => {
  cacheCabelo ??= import("@/data/produtos-cabelo.json").then((m) => {
    const bruto = m as unknown as { default?: ProdutoDeCabelo[] } | ProdutoDeCabelo[];
    return (Array.isArray(bruto) ? bruto : bruto.default ?? []) as ProdutoDeCabelo[];
  });
  return cacheCabelo;
};

/** Um item das duas listas (pele e cabelo), do jeito que a busca de MEUS PRODUTOS mostra. */
export type ItemDaLista = {
  origem: "pele" | "cabelo";
  id: string;
  marca: string;
  nome: string;
  /** "Protetor solar", "Máscara"… */
  rotulo: string;
  etapa?: ProdutoDeCabelo["etapa"];
  pao: number;
  paoPadrao: boolean;
  ativos: string[];
};

export const itemDaPele = (p: ProdutoDoCatalogo): ItemDaLista => ({
  origem: "pele", id: p.id, marca: p.marca, nome: p.nome, rotulo: ROTULO_CATEGORIA_PELE[p.categoria] ?? "Pele", pao: p.pao, paoPadrao: !!p.paoPadrao, ativos: [...p.ativos],
});
export const itemDoCabelo = (p: ProdutoDeCabelo): ItemDaLista => ({
  origem: "cabelo", id: p.id, marca: p.marca, nome: p.nome, rotulo: ROTULO_CATEGORIA_CABELO[p.categoria] ?? "Cabelo", etapa: p.etapa, pao: p.pao, paoPadrao: !!p.paoPadrao, ativos: [],
});

/** Busca por nome/marca nas duas listas: todas as palavras precisam aparecer. `so` restringe a uma delas. */
export function buscarNaLista(itens: ItemDaLista[], consulta: string, limite = 8, so?: "pele" | "cabelo"): ItemDaLista[] {
  const palavras = semAcento(consulta).split(/\s+/).filter(Boolean);
  if (!palavras.length || semAcento(consulta).length < 2) return [];
  return itens
    .filter((i) => !so || i.origem === so)
    .filter((i) => {
      const alvo = semAcento(`${i.marca} ${i.nome} ${i.rotulo} ${i.etapa ?? ""}`);
      return palavras.every((w) => alvo.includes(w));
    })
    .slice(0, limite);
}

/** O produto da lista entra em MEUS PRODUTOS no formato de sempre + os opcionais (catalogoId, PAO "padrão"). */
export const produtoDaLista = (i: ItemDaLista, id: string): ProdutoMeu => ({
  id,
  name: i.nome.trim(),
  category: i.origem === "cabelo" ? "Cabelo" : "Skincare",
  brand: i.marca.trim(),
  opened: false,
  openedDate: "",
  paoMonths: i.pao,
  expiry: "",
  notes: "",
  rating: 0,
  repurchase: false,
  price: 0,
  sizeMl: 0,
  photoUrl: "",
  frequency: "Diário",
  finished: false,
  catalogoId: i.id,
  paoPadrao: i.paoPadrao,
  ...(i.ativos.length ? { ativos: [...i.ativos] } : {}),
});
