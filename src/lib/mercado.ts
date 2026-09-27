/**
 * Categorias do Mercado (Casa) — fonte única (26/09, varredura). A Dieta
 * ("Enviar para Casa") gravava a categoria "Dieta" numa lista VAZIA quando a
 * pessoa nunca tinha aberto o Mercado; como o Mercado só usa o padrão quando a
 * chave não existe, as 9 categorias sumiam e ficava só a "Dieta".
 */
/** Canto da Despensa (Casa › Despensa) — mesmo formato de PantryItem.category. */
export type CantoDespensa = "geladeira" | "armario" | "limpeza" | "banheiro";
export type ItemDespensa = { id: string; name: string; category: CantoDespensa; status: "cheio" | "acabando" | "acabou" };

/** `origem` e `devolvidoId` são OPCIONAIS (26/09, varredura): item que veio do
 *  "Acabou" da Despensa lembra de onde saiu pra voltar pra lá quando for
 *  comprado; `devolvidoId` é o item que a compra recriou na despensa, pra
 *  desmarcar desfazer (antes marcar/desmarcar/marcar punha "Leite" 2x). */
export type ItemMercado = { id: string; text: string; done: boolean; origem?: CantoDespensa; devolvidoId?: string };
export type CategoriaMercado = { id: string; name: string; emoji: string; color: string; items: ItemMercado[] };

export const CATEGORIAS_PADRAO_MERCADO: CategoriaMercado[] = [
  { id: "1", name: "HortiFrutti", emoji: "🥬", color: "bg-green-500", items: [] },
  { id: "2", name: "Açougue e Peixaria", emoji: "🥩", color: "bg-red-500", items: [] },
  { id: "3", name: "Laticínios e Frios", emoji: "🧀", color: "bg-blue-600", items: [] },
  { id: "4", name: "Mercearia", emoji: "🏪", color: "bg-purple-500", items: [] },
  { id: "5", name: "Padaria", emoji: "🥖", color: "bg-orange-500", items: [] },
  { id: "6", name: "Congelados", emoji: "🍦", color: "bg-yellow-600", items: [] },
  { id: "7", name: "Limpeza", emoji: "🧹", color: "bg-cyan-500", items: [] },
  { id: "8", name: "Higiene Pessoal", emoji: "🛁", color: "bg-pink-500", items: [] },
  { id: "9", name: "Bebidas", emoji: "🥤", color: "bg-indigo-600", items: [] },
];

export const ID_CATEGORIA_DIETA = "dieta-auto";

const padraoNovo = () => CATEGORIAS_PADRAO_MERCADO.map((c) => ({ ...c, items: [] }));

const comoLista = (v: unknown): CategoriaMercado[] =>
  Array.isArray(v) ? v.filter((c): c is CategoriaMercado => !!c && typeof c === "object" && Array.isArray((c as CategoriaMercado).items)) : [];

/** Quem caiu no bug ficou só com a "Dieta": devolve as 9 do padrão na frente. */
export const precisaReparar = (v: unknown): boolean => {
  const l = comoLista(v);
  return l.length > 0 && l.every((c) => c.id === ID_CATEGORIA_DIETA);
};
export const repararCategorias = (v: unknown): CategoriaMercado[] =>
  precisaReparar(v) ? [...padraoNovo(), ...comoLista(v)] : comoLista(v);

/** Junta itens na categoria "Dieta" partindo do padrão quando o Mercado nunca foi aberto. Devolve a lista nova e quantos entraram. */
export const enviarParaMercado = (atual: unknown, textos: string[]): { lista: CategoriaMercado[]; novos: number } => {
  const base = comoLista(atual).length ? repararCategorias(atual) : padraoNovo();
  const i = base.findIndex((c) => c.id === ID_CATEGORIA_DIETA || c.name === "Dieta");
  const dieta: CategoriaMercado = i >= 0 ? base[i] : { id: ID_CATEGORIA_DIETA, name: "Dieta", emoji: "🥗", color: "bg-green-500", items: [] };
  const ja = new Set(dieta.items.map((it) => String(it.text).toLowerCase()));
  const vistos = new Set<string>();
  const entram = textos.map((t) => t.trim()).filter((t) => {
    const k = t.toLowerCase();
    if (!t || ja.has(k) || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const nova = { ...dieta, items: [...dieta.items, ...entram.map((text, n) => ({ id: `${Date.now()}-${n}`, text, done: false }))] };
  return { lista: i >= 0 ? base.map((c, j) => (j === i ? nova : c)) : [...base, nova], novos: entram.length };
};

/* ===================== DESPENSA ↔ MERCADO (26/09, varredura) =====================
 * "Acabou" na Despensa mandava o item pra uma lista "Compras" DENTRO da própria
 * Despensa — a dica do módulo promete a Lista de Compras (aba Mercado). Agora
 * vai pro Mercado, no corredor que combina com o canto de onde saiu, e volta
 * pra esse canto quando for marcado como comprado (pedido da avaliação de 07/09:
 * "poderia voltar o item para o local onde foi colocado"). */
export const CORREDOR_DA_DESPENSA: Record<CantoDespensa, string> = {
  geladeira: "Laticínios e Frios",
  armario: "Mercearia",
  limpeza: "Limpeza",
  banheiro: "Higiene Pessoal",
};
const CORREDOR_PADRAO = "Mercearia";

/** Compara nomes sem caixa, acento nem espaço sobrando ("Leite " = "leite"). */
export const mesmoNome = (a: unknown, b: unknown) => {
  const n = (s: unknown) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  return n(a) === n(b);
};

/** Põe um item que acabou na Despensa na lista do Mercado. Não duplica: se o
 *  nome já está pendente em qualquer categoria, só marca a origem nele. */
export const adicionarDaDespensa = (
  atual: unknown,
  nome: string,
  canto: CantoDespensa,
  agora: number = Date.now(),
): { lista: CategoriaMercado[]; entrou: boolean; categoria: string } => {
  const texto = String(nome ?? "").trim();
  const base = comoLista(atual).length ? repararCategorias(atual) : padraoNovo();
  if (!texto) return { lista: base, entrou: false, categoria: "" };

  for (const c of base) {
    const ja = c.items.find((it) => !it.done && mesmoNome(it.text, texto));
    if (ja) {
      const lista = ja.origem ? base : base.map((x) => (x.id !== c.id ? x : { ...x, items: x.items.map((it) => (it.id === ja.id ? { ...it, origem: canto } : it)) }));
      return { lista, entrou: false, categoria: c.name };
    }
  }

  const acha = (nomeCat: string) => base.findIndex((c) => mesmoNome(c.name, nomeCat));
  let i = acha(CORREDOR_DA_DESPENSA[canto] ?? CORREDOR_PADRAO);
  if (i < 0) i = acha(CORREDOR_PADRAO);
  const item: ItemMercado = { id: `desp-${agora}`, text: texto, done: false, origem: canto };
  if (i < 0) {
    // a pessoa apagou o corredor e a Mercearia: recria a Mercearia do padrão
    const modelo = CATEGORIAS_PADRAO_MERCADO.find((c) => c.name === CORREDOR_PADRAO)!;
    const id = base.some((c) => c.id === modelo.id) ? `merc-${agora}` : modelo.id;
    return { lista: [...base, { ...modelo, id, items: [item] }], entrou: true, categoria: modelo.name };
  }
  return { lista: base.map((c, j) => (j === i ? { ...c, items: [...c.items, item] } : c)), entrou: true, categoria: base[i].name };
};

/** Comprou: o item volta pro canto da despensa (sem duplicar se já estiver lá).
 *  Devolve a despensa nova e o id criado (undefined = já estava, nada criado). */
export const devolverADespensa = (
  despensa: ItemDespensa[],
  nome: string,
  canto: CantoDespensa,
  agora: number = Date.now(),
): { despensa: ItemDespensa[]; id?: string } => {
  const lista = Array.isArray(despensa) ? despensa : [];
  if (lista.some((p) => p?.category === canto && mesmoNome(p.name, nome))) return { despensa: lista };
  const id = `volta-${agora}`;
  return { despensa: [...lista, { id, name: String(nome).trim(), category: canto, status: "cheio" }], id };
};

/** Desmarcou o "comprei": tira da despensa o que a marcação tinha posto lá. */
export const retirarDaDespensa = (despensa: ItemDespensa[], id?: string): ItemDespensa[] => {
  const lista = Array.isArray(despensa) ? despensa : [];
  return id ? lista.filter((p) => p?.id !== id) : lista;
};

/** Marca/desmarca um item do Mercado; se ele veio da Despensa, a despensa anda junto. */
export const alternarItemMercado = (
  categorias: CategoriaMercado[],
  despensa: ItemDespensa[],
  catId: string,
  itemId: string,
  agora: number = Date.now(),
): { categorias: CategoriaMercado[]; despensa: ItemDespensa[]; voltou?: { nome: string; canto: CantoDespensa } } => {
  const cat = categorias.find((c) => c.id === catId);
  const item = cat?.items.find((i) => i.id === itemId);
  if (!cat || !item) return { categorias, despensa };
  const done = !item.done;
  let novaDespensa = despensa;
  let devolvidoId = item.devolvidoId;
  let voltou: { nome: string; canto: CantoDespensa } | undefined;
  if (item.origem) {
    if (done) {
      const r = devolverADespensa(despensa, item.text, item.origem, agora);
      novaDespensa = r.despensa;
      devolvidoId = r.id;
      if (r.id) voltou = { nome: item.text, canto: item.origem };
    } else {
      novaDespensa = retirarDaDespensa(despensa, item.devolvidoId);
      devolvidoId = undefined;
    }
  }
  const novo: ItemMercado = { ...item, done };
  if (devolvidoId) novo.devolvidoId = devolvidoId; else delete novo.devolvidoId;
  return {
    categorias: categorias.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((i) => (i.id === itemId ? novo : i)) })),
    despensa: novaDespensa,
    voltou,
  };
};
