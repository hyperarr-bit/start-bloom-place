import { useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";

/**
 * FONTE ÚNICA das categorias de finanças (19/07). Antes a lista estava
 * TRIPLICADA (ExpenseTable, FixedExpensesTable, CategoryBudgets) e ainda
 * havia mapas de label soltos em Dashboard/Reports/MonthComparison — mexer
 * numa não refletia nas outras. Agora tudo lê daqui + categorias que o
 * usuário cria (finance-custom-categories, sincroniza entre aparelhos).
 *
 * Regra de dados: excluir uma categoria personalizada NÃO reatribui os gastos
 * antigos — eles mantêm o value/label; a categoria só some do seletor. Nada
 * do cliente se perde.
 */

export type FinanceCategory = { value: string; label: string; color: string; bar: string; custom?: boolean };

// Custos VARIÁVEIS (a lista do "adicionar um gasto")
export const VARIABLE_CATEGORIES: FinanceCategory[] = [
  { value: "alimentacao", label: "Alimentação", color: "bg-orange-100/80 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", bar: "bg-orange-500" },
  { value: "restaurante", label: "Restaurante", color: "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "bg-amber-500" },
  { value: "mercado", label: "Mercado", color: "bg-lime-100/80 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", bar: "bg-lime-500" },
  { value: "transporte", label: "Transporte", color: "bg-blue-100/80 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", bar: "bg-blue-500" },
  { value: "combustivel", label: "Combustível", color: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300", bar: "bg-zinc-500" },
  { value: "lazer", label: "Lazer", color: "bg-purple-100/80 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300", bar: "bg-purple-500" },
  { value: "entretenimento", label: "Entretenimento", color: "bg-pink-100/80 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300", bar: "bg-pink-500" },
  { value: "saude", label: "Saúde", color: "bg-green-100/80 text-green-700 dark:bg-green-500/15 dark:text-green-300", bar: "bg-green-500" },
  { value: "farmacia", label: "Farmácia", color: "bg-red-100/80 text-red-700 dark:bg-red-500/15 dark:text-red-300", bar: "bg-red-500" },
  { value: "vestuario", label: "Vestuário", color: "bg-fuchsia-100/80 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", bar: "bg-fuchsia-500" },
  { value: "beleza", label: "Beleza", color: "bg-rose-100/80 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", bar: "bg-rose-500" },
  { value: "educacao", label: "Educação", color: "bg-teal-100/80 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", bar: "bg-teal-500" },
  { value: "eletronicos", label: "Eletrônicos", color: "bg-cyan-100/80 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300", bar: "bg-cyan-500" },
  { value: "servicos", label: "Serviços", color: "bg-slate-100/80 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300", bar: "bg-slate-500" },
  { value: "delivery", label: "Delivery", color: "bg-yellow-100/80 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300", bar: "bg-yellow-500" },
  { value: "presente", label: "Presente", color: "bg-violet-100/80 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", bar: "bg-violet-500" },
  { value: "casa", label: "Casa", color: "bg-stone-100/80 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300", bar: "bg-stone-500" },
  { value: "pets", label: "Pets", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", bar: "bg-emerald-500" },
  { value: "filhos", label: "Filhos", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", bar: "bg-sky-500" },
  { value: "viagem", label: "Viagem", color: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", bar: "bg-indigo-500" },
  { value: "outros", label: "Outros", color: "bg-gray-100/80 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300", bar: "bg-gray-500" },
];

// Custos FIXOS (domínio próprio; alguns values coincidem com variáveis — ok)
export const FIXED_CATEGORIES: FinanceCategory[] = [
  { value: "moradia", label: "Moradia", color: "bg-orange-100/80 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", bar: "bg-orange-500" },
  { value: "contas_casa", label: "Contas da Casa", color: "bg-yellow-100/80 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300", bar: "bg-yellow-500" },
  { value: "condominio", label: "Condomínio", color: "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "bg-amber-500" },
  { value: "seguro", label: "Seguro", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", bar: "bg-sky-500" },
  { value: "plano_saude", label: "Plano de Saúde", color: "bg-green-100/80 text-green-700 dark:bg-green-500/15 dark:text-green-300", bar: "bg-green-500" },
  { value: "assinaturas", label: "Assinaturas", color: "bg-purple-100/80 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300", bar: "bg-purple-500" },
  { value: "internet_telefone", label: "Internet/Telefone", color: "bg-blue-100/80 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", bar: "bg-blue-500" },
  { value: "educacao", label: "Educação", color: "bg-teal-100/80 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", bar: "bg-teal-500" },
  { value: "academia", label: "Academia", color: "bg-lime-100/80 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", bar: "bg-lime-500" },
  { value: "transporte_fixo", label: "Transporte Fixo", color: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", bar: "bg-indigo-500" },
  { value: "fatura_cartao", label: "Fatura Cartão", color: "bg-rose-100/80 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", bar: "bg-rose-500" },
  { value: "financiamento", label: "Financiamento", color: "bg-red-100/80 text-red-700 dark:bg-red-500/15 dark:text-red-300", bar: "bg-red-500" },
  { value: "pensao", label: "Pensão", color: "bg-stone-100/80 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300", bar: "bg-stone-500" },
  { value: "pets", label: "Pets", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", bar: "bg-emerald-500" },
  { value: "filhos", label: "Filhos", color: "bg-cyan-100/80 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300", bar: "bg-cyan-500" },
  { value: "outros", label: "Outros", color: "bg-gray-100/80 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300", bar: "bg-gray-500" },
];

// Paleta das PERSONALIZADAS — classes literais (Tailwind precisa vê-las no
// código). Escolhida por índice estável guardado na categoria.
export const CUSTOM_PALETTE: { color: string; bar: string }[] = [
  { color: "bg-teal-100/80 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", bar: "bg-teal-500" },
  { color: "bg-violet-100/80 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", bar: "bg-violet-500" },
  { color: "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "bg-amber-500" },
  { color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", bar: "bg-emerald-500" },
  { color: "bg-sky-100/80 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", bar: "bg-sky-500" },
  { color: "bg-rose-100/80 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", bar: "bg-rose-500" },
  { color: "bg-fuchsia-100/80 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", bar: "bg-fuchsia-500" },
  { color: "bg-lime-100/80 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", bar: "bg-lime-500" },
];

const NEUTRO = { color: "bg-gray-100/80 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300", bar: "bg-gray-400" };

export const CUSTOM_CATEGORIES_KEY = "finance-custom-categories";
export const MAX_CUSTOM = 30;
/** value estável (id) — nunca muda no rename, então gastos antigos seguem
 *  resolvendo pro label novo. `archived` = removida do seletor mas ainda
 *  resolve label/cor dos gastos já lançados (nada do cliente se perde). */
export type CustomCategory = { value: string; label: string; palette: number; archived?: boolean };

const norm = (s: string) => s.trim().toLowerCase();

export function customToCategory(c: CustomCategory): FinanceCategory {
  const p = CUSTOM_PALETTE[((c.palette % CUSTOM_PALETTE.length) + CUSTOM_PALETTE.length) % CUSTOM_PALETTE.length];
  return { value: c.value, label: c.label, color: p.color, bar: p.bar, custom: true };
}

/**
 * Categorias + ações. `variableCats`/`fixedCats` já vêm com as personalizadas
 * intercaladas ANTES de "Outros". labelOf/styleOf/barOf resolvem qualquer
 * value (padrão, fixo ou personalizado) — usados nos gráficos/relatórios.
 */
export function useFinanceCategories() {
  // Lê DIRETO do store do useUserData (não usePersistedState): o snapshot do
  // usePersistedState hidrata 1x e não ouve escritas de OUTRA instância — o
  // CategorySelect criava a categoria e a tabela/gráficos continuavam com a
  // lista velha, mostrando o id cru "c_..." até recarregar (bug real do dono,
  // 19/07). O set() do useUserData atualiza o contexto → todo mundo re-renderiza
  // e o get() abaixo devolve a lista fresca em TODAS as telas, na hora.
  const { get, set: setData } = useUserData();
  const custom = get<CustomCategory[]>(CUSTOM_CATEGORIES_KEY, []);
  const list = useMemo(() => (Array.isArray(custom) ? custom : []), [custom]);
  const setCustom = (next: CustomCategory[]) => setData(CUSTOM_CATEGORIES_KEY, next);
  // ATIVAS aparecem no seletor; ARQUIVADAS só resolvem label/cor de gastos velhos
  const ativas = useMemo(() => list.filter((c) => !c.archived).map(customToCategory), [custom]);
  const todas = useMemo(() => list.map(customToCategory), [custom]);

  const withCustom = (base: FinanceCategory[]) => {
    const outros = base[base.length - 1]; // "Outros" fica sempre por último
    const semOutros = base.slice(0, -1);
    return [...semOutros, ...ativas, outros];
  };
  const variableCats = useMemo(() => withCustom(VARIABLE_CATEGORIES), [ativas]);
  const fixedCats = useMemo(() => withCustom(FIXED_CATEGORIES), [ativas]);

  // União (variável + fixo + personalizadas ativas), deduplicada, "Outros" no
  // fim — usada pela tela de Limites por Categoria.
  const allCats = useMemo(() => {
    const seen = new Set<string>();
    const out: FinanceCategory[] = [];
    const push = (c: FinanceCategory) => { if (!seen.has(c.value)) { seen.add(c.value); out.push(c); } };
    VARIABLE_CATEGORIES.filter((c) => c.value !== "outros").forEach(push);
    FIXED_CATEGORIES.filter((c) => c.value !== "outros").forEach(push);
    ativas.forEach(push);
    push(VARIABLE_CATEGORIES[VARIABLE_CATEGORIES.length - 1]); // Outros
    return out;
  }, [ativas]);

  const byValue = useMemo(() => {
    const m = new Map<string, FinanceCategory>();
    // inclui arquivadas: label/cor dos gastos antigos continuam resolvendo
    for (const c of [...VARIABLE_CATEGORIES, ...FIXED_CATEGORIES, ...todas]) if (!m.has(c.value)) m.set(c.value, c);
    return m;
  }, [todas]);

  const labelOf = (v: string) => byValue.get(v)?.label ?? v;
  const styleOf = (v: string) => byValue.get(v)?.color ?? NEUTRO.color;
  const barOf = (v: string) => byValue.get(v)?.bar ?? NEUTRO.bar;

  const nomeColide = (label: string, exceto?: string) =>
    [...VARIABLE_CATEGORIES, ...FIXED_CATEGORIES, ...ativas].some((c) => c.value !== exceto && norm(c.label) === norm(label));

  /** Cria (dedupe contra padrão E personalizadas ativas). {value} ou {error}. */
  const addCustom = (rawLabel: string): { value?: string; error?: string } => {
    const label = rawLabel.trim().replace(/\s+/g, " ");
    if (label.length < 2 || label.length > 24) return { error: "O nome precisa ter de 2 a 24 caracteres." };
    if (nomeColide(label)) return { error: "Já existe uma categoria com esse nome." };
    if (ativas.length >= MAX_CUSTOM) return { error: `Limite de ${MAX_CUSTOM} categorias personalizadas.` };
    const value = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const palette = list.length % CUSTOM_PALETTE.length;
    setCustom([...list, { value, label, palette }]);
    return { value };
  };

  /** Renomeia; retorna {error} se falhar, {} se ok. */
  const renameCustom = (value: string, rawLabel: string): { error?: string } => {
    const label = rawLabel.trim().replace(/\s+/g, " ");
    if (label.length < 2 || label.length > 24) return { error: "O nome precisa ter de 2 a 24 caracteres." };
    if (nomeColide(label, value)) return { error: "Já existe uma categoria com esse nome." };
    setCustom(list.map((c) => (c.value === value ? { ...c, label } : c)));
    return {};
  };

  // Soft-delete: some do seletor, mas byValue (via `todas`) segue resolvendo
  // label/cor dos gastos já lançados. Zero perda de dado.
  const removeCustom = (value: string) => setCustom(list.map((c) => (c.value === value ? { ...c, archived: true } : c)));

  // cor que a PRÓXIMA categoria criada vai ganhar (pré-visualização no diálogo)
  const nextPalette = CUSTOM_PALETTE[list.length % CUSTOM_PALETTE.length];

  return { custom: ativas, variableCats, fixedCats, allCats, byValue, labelOf, styleOf, barOf, addCustom, renameCustom, removeCustom, nextPalette };
}
