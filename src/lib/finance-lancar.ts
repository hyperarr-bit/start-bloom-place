import { etiquetar, PERFIL_PESSOAL } from "@/lib/finance-perfil";

/**
 * LANÇAR UM GASTO FORA DA TELA DE FINANÇAS (28/09) — o caminho ÚNICO pra quem cria
 * gasto de fora (a ação rápida da Home e, desde a Onda 1 da Beleza, o "Lançar em
 * Finanças · Beleza" dos cuidados). Antes a ação rápida fazia isso inline; agora os
 * dois passam por aqui, então o formato não tem como divergir:
 *  - balde do MÊS CORRENTE (`finance-expenses`), no formato da tabela de gastos
 *    ({ id, description, value, category, date, paymentMethod });
 *  - etiquetado com o perfil ATIVO (empresa selecionada em Finanças → cai na empresa;
 *    Pessoal nasce sem etiqueta, o legado).
 * Quem chama garante que a data é do mês corrente (o balde É o mês).
 */

type Leitor = <T>(key: string, fallback: T) => T;
type Gravador = (key: string, value: unknown) => void;

export type GastoNovo = {
  descricao: string;
  valor: number;
  /** o `value` de VARIABLE_CATEGORIES (lib/finance-categories), ex. "beleza" */
  categoria: string;
  /** "YYYY-MM-DD" */
  data: string;
  metodo?: string;
};

export type GastoLancado = { id: string; description: string; value: number; category: string; date: string; paymentMethod: string; perfil?: string };

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export function lancarGasto(get: Leitor, set: Gravador, g: GastoNovo): GastoLancado {
  const atuais = get<unknown>("finance-expenses", []);
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const item = etiquetar<GastoLancado>({
    id: novoId(),
    description: g.descricao,
    value: g.valor,
    category: g.categoria,
    date: g.data,
    paymentMethod: g.metodo ?? "pix",
  }, perfil);
  set("finance-expenses", [...(Array.isArray(atuais) ? atuais : []), item]);
  return item;
}
