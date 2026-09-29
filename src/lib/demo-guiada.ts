/**
 * DEMO GUIADA — o item que a pessoa anota na demo e como ele SEGUE com ela
 * (28/09). A chave e o sorteio moram em `demo-guiada-braco.ts`; o paywall só
 * carrega `demo-guiada-volta.ts` (2 constantes). Este arquivo só desce na
 * demo e no bloco do paywall.
 *
 * Hoje nada do que se faz na demo segue: ela é só memória. O item da missão
 * viaja em TRÊS camadas, da mais robusta pra menos:
 *   1. na URL (`c=<tipo>|<nome>|<valor>`): nas pílulas da barra de módulos, no
 *      "Quase lá", na volta pro cadastro e no paywall — o navegador do
 *      Instagram zera o storage entre páginas, a URL ele não zera;
 *   2. na memória da página (a demo e o cadastro são a mesma SPA);
 *   3. no sessionStorage (volta do Google, recarga).
 * O que chega de fora (URL) é validado aqui: tipo de uma lista fechada, nome
 * limpo e curto, valor com teto. Quem grava na conta é `demo-guiada-registro.ts`
 * — só o item dela, nunca dado de exemplo.
 */
import { AREAS, type AreaKey } from "@/lib/funnel";
import { CHAVE_FORCA_DEMO_GUIADA, DEMO_GUIADA, PARAM_BRACO, forcaDaDemoGuiada } from "@/lib/demo-guiada-braco";
import { CHAVE_SESSAO_DA_MISSAO, PARAM_ITEM } from "@/lib/demo-guiada-volta";

export { CHAVE_FORCA_DEMO_GUIADA, PARAM_BRACO, PARAM_ITEM };

export type TipoDoItem = "gasto" | "habito" | "exercicio" | "agua" | "meta";
export interface ItemDaDemo {
  tipo: TipoDoItem;
  nome: string;
  /** gasto: reais; água: ml do copo. Os outros não têm valor. */
  valor?: number;
}

export const TIPOS_DO_ITEM: readonly TipoDoItem[] = ["gasto", "habito", "exercicio", "agua", "meta"];

/** Área do funil → o que a missão pede. "Tudo" cai em dinheiro, como no resto do funil. */
export const TIPO_DA_AREA: Record<AreaKey, TipoDoItem> = {
  dinheiro: "gasto", rotina: "habito", corpo: "exercicio", saude: "agua", metas: "meta",
};
export const AREA_DO_TIPO: Record<TipoDoItem, AreaKey> = {
  gasto: "dinheiro", habito: "rotina", exercicio: "corpo", agua: "saude", meta: "metas",
};
/** Módulo da demo onde o item nasce (e onde ele reaparece quando ela volta). */
export const MODULO_DO_TIPO: Record<TipoDoItem, string> = {
  gasto: AREAS.dinheiro.module, habito: AREAS.rotina.module, exercicio: AREAS.corpo.module,
  agua: AREAS.saude.module, meta: AREAS.metas.module,
};
export const tipoDoModulo = (modulo: string): TipoDoItem | null =>
  (TIPOS_DO_ITEM.find((t) => MODULO_DO_TIPO[t] === modulo) ?? null);

export const NOME_MAX = 60;
const VALOR_MAX = 1_000_000;

/** Nome que vem de fora (URL, storage): sem caractere de controle nem "|", espaços colapsados, curto. */
export const limparNome = (s: unknown): string =>
  typeof s !== "string"
    ? ""
    // eslint-disable-next-line no-control-regex
    : s.replace(/[\u0000-\u001f\u007f|]/g, " ").replace(/\s+/g, " ").trim().slice(0, NOME_MAX).trim();

/** Valida e normaliza um item qualquer. Inválido → null (nada segue, nada é gravado). */
export function normalizarItem(x: unknown): ItemDaDemo | null {
  if (!x || typeof x !== "object") return null;
  const o = x as { tipo?: unknown; nome?: unknown; valor?: unknown };
  const tipo = TIPOS_DO_ITEM.find((t) => t === o.tipo);
  if (!tipo) return null;
  const nome = limparNome(o.nome);
  if (!nome) return null;
  const n = typeof o.valor === "number" ? o.valor : typeof o.valor === "string" && o.valor.trim() ? Number(o.valor) : NaN;
  if (tipo === "gasto") {
    if (!Number.isFinite(n) || n <= 0 || n > VALOR_MAX) return null;
    return { tipo, nome, valor: Math.round(n * 100) / 100 };
  }
  if (tipo === "agua") {
    const ml = Number.isFinite(n) ? Math.round(n) : 250;
    return { tipo, nome, valor: Math.min(2000, Math.max(50, ml)) };
  }
  return { tipo, nome };
}

export const codificarItem = (i: ItemDaDemo): string => [i.tipo, limparNome(i.nome), i.valor ?? ""].join("|");

export function decodificarItem(cru: string | null | undefined): ItemDaDemo | null {
  if (!cru || cru.length > 200) return null;
  const partes = cru.split("|");
  if (partes.length < 2 || partes.length > 3) return null;
  const [tipo, nome, valor] = partes;
  return normalizarItem({ tipo, nome, valor: valor ?? "" });
}

/* ------------------------------------------------------------ o braço */

const paramsDe = (busca: string | URLSearchParams): URLSearchParams =>
  typeof busca === "string" ? new URLSearchParams(busca) : busca;

/**
 * Braço desta demo: "on" (missão), "off" (controle do A/B — a demo de hoje,
 * só que medida) ou null (fora do experimento = o funil de hoje, intocado).
 * Ordem: força de QA no aparelho > braço na URL > chave "on".
 */
export function bracoDaDemo(busca: string | URLSearchParams): "on" | "off" | null {
  const f = forcaDaDemoGuiada();
  if (f) return f;
  const g = paramsDe(busca).get(PARAM_BRACO);
  if (g === "1") return "on";
  if (g === "0") return "off";
  return DEMO_GUIADA === "on" ? "on" : null;
}

/* -------------------------------------------- estado da missão na sessão */

export type FimDaMissao = "levar" | "explorar" | "pulou" | "trocou_modulo" | "quase_la";
export interface EstadoDaMissao {
  /** Módulo em que a missão começou. */
  inicio?: string;
  item?: ItemDaDemo;
  fim?: FimDaMissao;
}

const CHAVE_SESSAO = CHAVE_SESSAO_DA_MISSAO;
let memoria: EstadoDaMissao = {};

const lerSessao = (): EstadoDaMissao => {
  try {
    const cru = sessionStorage.getItem(CHAVE_SESSAO);
    if (!cru) return {};
    const o = JSON.parse(cru) as EstadoDaMissao;
    return {
      inicio: typeof o?.inicio === "string" ? o.inicio : undefined,
      item: normalizarItem(o?.item) ?? undefined,
      fim: o?.fim,
    };
  } catch {
    return {};
  }
};

export const estadoDaMissao = (): EstadoDaMissao => ({ ...lerSessao(), ...memoria });

export function gravarEstadoDaMissao(parcial: EstadoDaMissao): EstadoDaMissao {
  memoria = { ...estadoDaMissao(), ...parcial };
  try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(memoria)); } catch { /* memória + URL seguram */ }
  return memoria;
}

/** Só pra teste. */
export const esquecerMissao = () => {
  memoria = {};
  try { sessionStorage.removeItem(CHAVE_SESSAO); } catch { /* noop */ }
};

/** O item que ela anotou: URL > memória > sessão. */
export const itemDaDemo = (busca: string | URLSearchParams): ItemDaDemo | null =>
  decodificarItem(paramsDe(busca).get(PARAM_ITEM)) ?? estadoDaMissao().item ?? null;

/* ------------------------------------------------------------ URLs */

const mexerNaUrl = (url: string, mudar: (p: URLSearchParams) => void): string => {
  const [semHash, hash = ""] = url.split("#");
  const [caminho, busca = ""] = semHash.split("?");
  const p = new URLSearchParams(busca);
  mudar(p);
  const q = p.toString();
  return `${caminho}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
};

/** Leva o item junto na URL. Sem item, devolve a MESMA string. */
export const comItem = (url: string, item: ItemDaDemo | null | undefined): string =>
  item ? mexerNaUrl(url, (p) => p.set(PARAM_ITEM, codificarItem(item))) : url;

/** Leva o braço junto (pílulas da barra de módulos). Sem braço, a MESMA string. */
export const comBraco = (url: string, braco: "on" | "off" | null): string =>
  braco ? mexerNaUrl(url, (p) => p.set(PARAM_BRACO, braco === "on" ? "1" : "0")) : url;

/* ------------------------------------------------------------ rótulos */

export const reais = (v: number): string =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });

/** "Café · R$ 12", "Beber água · hábito"… */
export function rotuloDoItem(i: ItemDaDemo): string {
  switch (i.tipo) {
    case "gasto": return `${i.nome} · R$ ${reais(i.valor ?? 0)}`;
    case "habito": return `${i.nome} · hábito`;
    case "exercicio": return `${i.nome} · exercício`;
    case "agua": return `${i.nome} · ${i.valor ?? 250} ml`;
    case "meta": return `${i.nome} · meta`;
  }
}

/** Curto, pra frase da faixa e da folha: "Café · R$ 12", "Meditar", "1 copo d'água". */
export const rotuloCurto = (i: ItemDaDemo): string =>
  i.tipo === "gasto" ? `${i.nome} · R$ ${reais(i.valor ?? 0)}` : i.nome;

/** Nome curto do módulo do item ("Finanças", "Rotina"…), pro "Finanças pronta". */
export const NOME_DO_MODULO: Record<TipoDoItem, string> = {
  gasto: "Finanças", habito: "Rotina", exercicio: "Treino", agua: "Saúde", meta: "Metas",
};

/** Adesivo do 1º registro (a arte das Conquistas), sempre com raridade comum. */
export const ADESIVO_DO_TIPO: Record<TipoDoItem, string> = {
  gasto: "first-expense", habito: "rotina-1", exercicio: "treino-1", agua: "agua-7", meta: "meta-1",
};
