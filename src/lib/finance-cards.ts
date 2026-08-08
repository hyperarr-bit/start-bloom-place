import { useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";

/**
 * FONTE ÚNICA dos cartões de finanças (08/08). A lista das 11 bandeiras estava
 * COPIADA em três lugares (ExpenseTable, FixedExpensesTable, InstallmentTracker)
 * e era fechada: quem tem cartão de loja (Renner, Riachuelo, Will, Mercado Pago)
 * marcava tudo como "Outro" — e aí o resumo "TOTAL POR CARTÃO NO MÊS" juntava
 * tudo num balde só, que é justamente o número que a pessoa abre pra conferir
 * contra a fatura. Pedido de assinante ("tenho cartões de lojas como a Renner e
 * não tem essa opção lá").
 *
 * Espelha finance-categories.ts de propósito: mesma mecânica (chave própria que
 * sincroniza entre aparelhos, soft-delete, paleta por índice, resolução por
 * `value`). Quem já entendeu um entende o outro.
 *
 * COMPATIBILIDADE (inegociável — ~966 assinantes com dados gravados): o campo
 * salvo continua sendo `cardName: string`, com os MESMOS values das 11 bandeiras
 * ("nubank", "itau", "c6"…). Nada é reescrito na migração; cartão personalizado
 * grava um id novo (`k_...`) no MESMO campo. Value que ninguém conhece (dado
 * antigo, ou cartão arquivado) cai no fallback e aparece cru — nunca vazio,
 * nunca perdido.
 */

export type FinanceCard = { value: string; label: string; color: string; custom?: boolean };

// As 11 bandeiras de sempre — values e cores IDÊNTICOS aos que estavam nos três
// arquivos, senão os dados já gravados perderiam a cor/rótulo.
export const DEFAULT_CARDS: FinanceCard[] = [
  { value: "nubank", label: "Nubank", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "inter", label: "Inter", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "itau", label: "Itaú", color: "bg-blue-600/15 text-blue-700 dark:text-blue-300" },
  { value: "bradesco", label: "Bradesco", color: "bg-red-600/15 text-red-700 dark:text-red-300" },
  { value: "santander", label: "Santander", color: "bg-red-500/15 text-red-600 dark:text-red-300" },
  { value: "c6", label: "C6 Bank", color: "bg-gray-800/15 text-gray-700 dark:text-gray-300" },
  { value: "bb", label: "Banco do Brasil", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  { value: "caixa", label: "Caixa", color: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  { value: "neon", label: "Neon", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { value: "picpay", label: "PicPay", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { value: "outro", label: "Outro", color: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
];

// Paleta dos PERSONALIZADOS — classes literais (o Tailwind precisa enxergá-las
// no código-fonte). Escolhida por índice estável guardado no próprio cartão.
export const CARD_PALETTE: { color: string }[] = [
  { color: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  { color: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { color: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { color: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { color: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300" },
  { color: "bg-lime-500/15 text-lime-700 dark:text-lime-300" },
];

const NEUTRO = "bg-gray-500/15 text-gray-700 dark:text-gray-300";

export const CUSTOM_CARDS_KEY = "finance-custom-cards";
export const MAX_CUSTOM_CARDS = 20;

/** `value` é um id estável — o rename NÃO mexe nele, então gasto/parcela já
 *  lançados seguem resolvendo pro nome novo. `archived` = some do seletor mas
 *  continua resolvendo rótulo/cor do que já foi lançado (nada se perde). */
export type CustomCard = { value: string; label: string; palette: number; archived?: boolean };

// Array congelado: `get(key, [])` com literal novo a cada render invalidaria os
// useMemo abaixo sem necessidade.
const VAZIO: CustomCard[] = [];

const norm = (s: string) => s.trim().toLowerCase();

export function customToCard(c: CustomCard): FinanceCard {
  const p = CARD_PALETTE[((c.palette % CARD_PALETTE.length) + CARD_PALETTE.length) % CARD_PALETTE.length];
  return { value: c.value, label: c.label, color: p.color, custom: true };
}

/**
 * Cartões + ações. `cards` já vem com os personalizados intercalados ANTES de
 * "Outro". labelOf/styleOf resolvem qualquer value (bandeira padrão, cartão
 * personalizado ou até arquivado) — é o que o resumo por cartão usa.
 */
export function useFinanceCards() {
  // Lê DIRETO do store do useUserData (não usePersistedState) pelo mesmo motivo
  // documentado em finance-categories.ts: o snapshot do usePersistedState
  // hidrata 1x e não escuta escrita de OUTRA instância — o seletor criaria o
  // cartão e a tabela ao lado continuaria mostrando o id cru "k_..." até
  // recarregar. O set() do useUserData atualiza o contexto e todo mundo
  // re-renderiza junto.
  const { get, set: setData } = useUserData();
  const custom = get<CustomCard[]>(CUSTOM_CARDS_KEY, VAZIO);
  const list = useMemo(() => (Array.isArray(custom) ? custom : VAZIO), [custom]);
  const setCustom = (next: CustomCard[]) => setData(CUSTOM_CARDS_KEY, next);

  // ATIVOS aparecem no seletor; ARQUIVADOS só resolvem rótulo/cor do histórico
  const ativos = useMemo(() => list.filter((c) => !c.archived).map(customToCard), [list]);
  const todos = useMemo(() => list.map(customToCard), [list]);

  const cards = useMemo(() => {
    const outro = DEFAULT_CARDS[DEFAULT_CARDS.length - 1]; // "Outro" sempre por último
    return [...DEFAULT_CARDS.slice(0, -1), ...ativos, outro];
  }, [ativos]);

  const byValue = useMemo(() => {
    const m = new Map<string, FinanceCard>();
    // inclui arquivados: rótulo/cor do que já foi lançado continuam resolvendo
    for (const c of [...DEFAULT_CARDS, ...todos]) if (!m.has(c.value)) m.set(c.value, c);
    return m;
  }, [todos]);

  const labelOf = (v: string) => byValue.get(v)?.label ?? v;
  const styleOf = (v: string) => byValue.get(v)?.color ?? NEUTRO;

  const nomeColide = (label: string, exceto?: string) =>
    [...DEFAULT_CARDS, ...ativos].some((c) => c.value !== exceto && norm(c.label) === norm(label));

  /** Cria (dedupe contra bandeira padrão E personalizados ativos). {value} ou {error}. */
  const addCustom = (rawLabel: string): { value?: string; error?: string } => {
    const label = rawLabel.trim().replace(/\s+/g, " ");
    if (label.length < 2 || label.length > 20) return { error: "O nome precisa ter de 2 a 20 caracteres." };
    if (nomeColide(label)) return { error: "Já existe um cartão com esse nome." };
    if (ativos.length >= MAX_CUSTOM_CARDS) return { error: `Limite de ${MAX_CUSTOM_CARDS} cartões personalizados.` };
    const value = `k_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const palette = list.length % CARD_PALETTE.length;
    setCustom([...list, { value, label, palette }]);
    return { value };
  };

  /** Renomeia; o value não muda, então o histórico acompanha o nome novo. */
  const renameCustom = (value: string, rawLabel: string): { error?: string } => {
    const label = rawLabel.trim().replace(/\s+/g, " ");
    if (label.length < 2 || label.length > 20) return { error: "O nome precisa ter de 2 a 20 caracteres." };
    if (nomeColide(label, value)) return { error: "Já existe um cartão com esse nome." };
    setCustom(list.map((c) => (c.value === value ? { ...c, label } : c)));
    return {};
  };

  // Soft-delete: some do seletor, mas byValue (via `todos`) segue resolvendo
  // rótulo/cor dos gastos e parcelas já lançados. Zero perda de dado.
  const removeCustom = (value: string) => setCustom(list.map((c) => (c.value === value ? { ...c, archived: true } : c)));

  // cor que o PRÓXIMO cartão criado vai ganhar (pré-visualização no diálogo)
  const nextPalette = CARD_PALETTE[list.length % CARD_PALETTE.length];

  return { cards, custom: ativos, byValue, labelOf, styleOf, addCustom, renameCustom, removeCustom, nextPalette };
}
