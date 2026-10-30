/**
 * CARDÁPIO E LISTA DE COMPRAS ÚNICOS (1.0.22, sem repetição — dono 28/10: "bora botar logo").
 *
 * CARDÁPIO — um só: o da Dieta (`saude-meals`, Dieta › CARDÁPIO, 19,4% de uso real). Casa › Cardápio passa a mostrar
 * e editar ESSE. O cardápio antigo da Casa (`casa-meal-plan` + `casa-recipes`) não é apagado nem regravado: aparece
 * num bloco "Do cardápio antigo da Casa" e a pessoa pode levá-lo pro cardápio (só preenche Almoço/Janta VAZIOS).
 *
 * LISTA DE COMPRAS — uma só: o Mercado da Casa (`casa-grocery-categories`). Dieta › 🛒 LISTA (`dieta-smart-list`, 1,6%)
 * vira o botão "Gerar lista de compras" no Cardápio, que manda os itens direto pro Mercado (categoria "Dieta", a mesma
 * do "Enviar para Casa" de antes). A lista "Compras" de dentro da Despensa (`casa-shopping-list`) também vira o
 * Mercado. O que existia nas listas antigas continua visível ("da lista antiga") até a pessoa mover ou limpar.
 *
 * Nenhuma chave muda de formato: o Mercado continua `CategoriaMercado[]`, a lista antiga da Dieta continua
 * `{id,text,done}[]`, a da Despensa `{id,name,checked,fromPantry,…}[]` e o cardápio `Record<DIA, Record<refeição, texto>>`.
 * O app antigo (que ainda tem as abas antigas) lê tudo igual: o que ele vê a mais é só o que a pessoa mandou pro Mercado.
 */
import { itensDoCardapio, primeiraMaiuscula } from "@/components/dieta/cardapio";
import {
  CATEGORIAS_PADRAO_MERCADO, adicionarDaDespensa, enviarParaMercado, mesmoNome, repararCategorias,
  type CantoDespensa, type CategoriaMercado,
} from "@/lib/mercado";

/* ================================================================== LISTA DE COMPRAS */

const comoCategorias = (v: unknown): CategoriaMercado[] =>
  Array.isArray(v) ? v.filter((c): c is CategoriaMercado => !!c && typeof c === "object" && Array.isArray((c as CategoriaMercado).items)) : [];

/** Os textos de tudo que está PENDENTE no Mercado (qualquer categoria). */
export const pendentesDoMercado = (mercado: unknown): string[] =>
  comoCategorias(mercado).flatMap((c) => c.items.filter((i) => i && !i.done && typeof i.text === "string").map((i) => i.text));

/**
 * "Gerar lista de compras" do Cardápio: separa os ingredientes das refeições (sem quantidades, sem repetir) e põe no
 * Mercado o que ainda não está pendente lá. `descricoes` = os textos das refeições, na ordem do cardápio.
 */
export function gerarListaDoCardapio(mercado: unknown, descricoes: string[]): { lista: CategoriaMercado[]; novos: number; itens: string[] } {
  const itens = itensDoCardapio(descricoes, pendentesDoMercado(mercado)).map(primeiraMaiuscula);
  const { lista, novos } = enviarParaMercado(mercado, itens);
  return { lista, novos, itens };
}

/** As descrições do cardápio da Dieta, na ordem: dias da semana × refeições configuradas (e as extras do dia). */
export function descricoesDoCardapio(cardapio: unknown, dias: readonly string[], refeicoes: readonly string[]): string[] {
  const c = cardapio && typeof cardapio === "object" && !Array.isArray(cardapio) ? (cardapio as Record<string, Record<string, unknown>>) : {};
  const out: string[] = [];
  for (const dia of dias) {
    const doDia = c[dia];
    if (!doDia || typeof doDia !== "object") continue;
    for (const m of [...refeicoes, ...Object.keys(doDia).filter((k) => !refeicoes.includes(k))]) {
      const d = doDia[m];
      if (typeof d === "string" && d.trim()) out.push(d);
    }
  }
  return out;
}

/* ------------------------------------------------- lista antiga da Dieta (`dieta-smart-list`) */

export type ItemListaAntigaDieta = { id: string; text: string; done: boolean };

export const comoListaAntigaDieta = (v: unknown): ItemListaAntigaDieta[] =>
  Array.isArray(v) ? v.filter((i): i is ItemListaAntigaDieta => !!i && typeof i === "object" && typeof (i as ItemListaAntigaDieta).text === "string") : [];

/**
 * Move os PENDENTES da lista antiga da Dieta pro Mercado. Devolve o Mercado novo e a lista antiga SEM os pendentes
 * movidos (os comprados ficam até "Limpar"). Quem já estava no Mercado não duplica, mas sai da lista antiga do mesmo
 * jeito (já está onde deve).
 */
export function moverListaAntigaDaDieta(mercado: unknown, antiga: unknown): { lista: CategoriaMercado[]; novos: number; restante: ItemListaAntigaDieta[]; movidos: number } {
  const itens = comoListaAntigaDieta(antiga);
  const pendentes = itens.filter((i) => !i.done && i.text.trim());
  const jaNoMercado = pendentesDoMercado(mercado);
  const entram = pendentes.map((i) => primeiraMaiuscula(i.text.trim())).filter((t) => !jaNoMercado.some((j) => mesmoNome(j, t)));
  const { lista, novos } = enviarParaMercado(mercado, entram);
  return { lista, novos, restante: itens.filter((i) => !pendentes.includes(i)), movidos: pendentes.length };
}

/* ------------------------------------------------- lista antiga da Despensa (`casa-shopping-list`) */

export type ItemListaAntigaDespensa = {
  id: string; name: string; checked: boolean; fromPantry?: boolean; origemCategory?: CantoDespensa; devolvidoId?: string;
};

export const comoListaAntigaDespensa = (v: unknown): ItemListaAntigaDespensa[] =>
  Array.isArray(v) ? v.filter((i): i is ItemListaAntigaDespensa => !!i && typeof i === "object" && typeof (i as ItemListaAntigaDespensa).name === "string") : [];

const CANTOS: readonly CantoDespensa[] = ["geladeira", "armario", "limpeza", "banheiro"];
const CORREDOR_SEM_ORIGEM = "Mercearia";

/** Põe um item avulso (sem canto de origem) num corredor do Mercado, sem duplicar o que já está pendente. */
function adicionarAvulso(base: CategoriaMercado[], texto: string, agora: number, n: number): { lista: CategoriaMercado[]; entrou: boolean } {
  if (base.some((c) => c.items.some((it) => !it.done && mesmoNome(it.text, texto)))) return { lista: base, entrou: false };
  const item = { id: `desp-lista-${agora}-${n}`, text: texto, done: false };
  const i = base.findIndex((c) => mesmoNome(c.name, CORREDOR_SEM_ORIGEM));
  if (i < 0) {
    const modelo = CATEGORIAS_PADRAO_MERCADO.find((c) => c.name === CORREDOR_SEM_ORIGEM)!;
    const id = base.some((c) => c.id === modelo.id) ? `merc-${agora}` : modelo.id;
    return { lista: [...base, { ...modelo, id, items: [item] }], entrou: true };
  }
  return { lista: base.map((c, j) => (j === i ? { ...c, items: [...c.items, item] } : c)), entrou: true };
}

/**
 * Move os PENDENTES da lista "Compras" da Despensa pro Mercado. O item que veio do "Acabou" leva o canto de origem
 * (volta pra ele quando for comprado no Mercado, como já acontece); o avulso vai pra Mercearia. Os comprados ficam.
 */
export function moverListaAntigaDaDespensa(mercado: unknown, antiga: unknown, agora = Date.now()): { lista: CategoriaMercado[]; novos: number; restante: ItemListaAntigaDespensa[]; movidos: number } {
  const itens = comoListaAntigaDespensa(antiga);
  const pendentes = itens.filter((i) => !i.checked && i.name.trim());
  let lista = comoCategorias(mercado).length ? repararCategorias(mercado) : CATEGORIAS_PADRAO_MERCADO.map((c) => ({ ...c, items: [] }));
  let novos = 0;
  pendentes.forEach((it, n) => {
    const nome = it.name.trim();
    if (it.fromPantry) {
      const canto = CANTOS.includes(it.origemCategory as CantoDespensa) ? (it.origemCategory as CantoDespensa) : "armario";
      const r = adicionarDaDespensa(lista, nome, canto, agora + n);
      lista = r.lista;
      if (r.entrou) novos++;
    } else {
      const r = adicionarAvulso(lista, nome, agora, n);
      lista = r.lista;
      if (r.entrou) novos++;
    }
  });
  return { lista, novos, restante: itens.filter((i) => !pendentes.includes(i)), movidos: pendentes.length };
}

/* ================================================================== CARDÁPIO */

/** Os dias do cardápio da Dieta (as chaves de `saude-meals`). */
export const DIAS_DO_CARDAPIO = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"] as const;
/** Os dias do cardápio antigo da Casa (`casa-meal-plan`) → os da Dieta. */
const DIA_DA_CASA: Record<string, (typeof DIAS_DO_CARDAPIO)[number]> = {
  Segunda: "SEGUNDA", Terça: "TERÇA", Quarta: "QUARTA", Quinta: "QUINTA", Sexta: "SEXTA", Sábado: "SÁBADO", Domingo: "DOMINGO",
};
export const REFEICAO_ALMOCO = "Almoço";
export const REFEICAO_JANTA = "Janta";

export type DiaDoCardapioAntigo = { dia: (typeof DIAS_DO_CARDAPIO)[number]; almoco?: string; janta?: string };

type ReceitaDaCasa = { id?: unknown; name?: unknown; emoji?: unknown };

/** O cardápio antigo da Casa já com o NOME das receitas (só os dias com alguma receita que ainda existe). */
export function cardapioAntigoDaCasa(plano: unknown, receitas: unknown): DiaDoCardapioAntigo[] {
  const p = plano && typeof plano === "object" && !Array.isArray(plano) ? (plano as Record<string, { almoco?: unknown; janta?: unknown }>) : {};
  const lista = Array.isArray(receitas) ? (receitas as ReceitaDaCasa[]) : [];
  const nome = (id: unknown): string | undefined => {
    if (typeof id !== "string" || !id) return undefined;
    const r = lista.find((x) => x && x.id === id);
    if (!r || typeof r.name !== "string" || !r.name.trim()) return undefined;
    return r.name.trim();
  };
  const out: DiaDoCardapioAntigo[] = [];
  for (const [diaCasa, dia] of Object.entries(DIA_DA_CASA)) {
    const doDia = p[diaCasa];
    if (!doDia || typeof doDia !== "object") continue;
    const almoco = nome(doDia.almoco);
    const janta = nome(doDia.janta);
    if (almoco || janta) out.push({ dia, ...(almoco ? { almoco } : {}), ...(janta ? { janta } : {}) });
  }
  return out;
}

/**
 * Leva o cardápio antigo da Casa pro da Dieta: preenche Almoço/Janta SÓ onde está vazio (nunca sobrescreve o que a
 * pessoa já escreveu na Dieta). Devolve o cardápio novo e quantas refeições entraram.
 */
export function levarCardapioAntigo(cardapio: unknown, antigo: DiaDoCardapioAntigo[]): { cardapio: Record<string, Record<string, string>>; preenchidas: number } {
  const base = cardapio && typeof cardapio === "object" && !Array.isArray(cardapio) ? (cardapio as Record<string, Record<string, string>>) : {};
  const novo: Record<string, Record<string, string>> = { ...base };
  let preenchidas = 0;
  for (const d of antigo) {
    const doDia = { ...(novo[d.dia] && typeof novo[d.dia] === "object" ? novo[d.dia] : {}) };
    const vazio = (m: string) => typeof doDia[m] !== "string" || !doDia[m].trim();
    if (d.almoco && vazio(REFEICAO_ALMOCO)) { doDia[REFEICAO_ALMOCO] = d.almoco; preenchidas++; }
    if (d.janta && vazio(REFEICAO_JANTA)) { doDia[REFEICAO_JANTA] = d.janta; preenchidas++; }
    novo[d.dia] = doDia;
  }
  return { cardapio: preenchidas ? novo : base, preenchidas };
}
