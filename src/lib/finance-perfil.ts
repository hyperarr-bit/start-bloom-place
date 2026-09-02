/**
 * PERFIS DE FINANÇA — PF, PJ e uma empresa por vez (01/09).
 *
 * Pedido de cliente por WhatsApp: "separar a questão da pf e pj... fazer o
 * controle do pj igual do pf, isso aqui é da empresa x isso aqui é da
 * empresa y".
 *
 * ── POR QUE ETIQUETA E NÃO CHAVE SEPARADA ────────────────────────────────
 * O caminho óbvio seria prefixar as chaves (`finance-pj:acme-incomes`). Foi
 * descartado: Finanças é o módulo mais usado do app (981 pessoas em agosto), e
 * as chaves atuais são lidas por muita coisa fora da tela — arquivamento de
 * mês, virada de contas, sincronização de fixos com vencimentos, dashboard,
 * relatórios, score de saúde financeira. Um erro no prefixo não daria um
 * número errado: daria Finanças VAZIA pra quem já usa. Etiqueta por lançamento
 * é aditiva — quem nunca criar um perfil não tem nem como perceber que isso
 * existe, porque `perfil` ausente significa "pessoal".
 *
 * ── A PARTE PERIGOSA ─────────────────────────────────────────────────────
 * Filtrar a lista antes de entregar pra tabela é fácil. O risco está na
 * VOLTA: a tabela recebe 3 itens (os da empresa X), o usuário edita um e
 * chama `setExpenses` com esses 3 — se isso for gravado direto, os itens dos
 * outros perfis somem do banco. Seria perda silenciosa de dado financeiro, a
 * pior categoria de bug que este app pode ter.
 *
 * `mesclarPerfil` existe pra isso: recompõe a lista inteira preservando a
 * ordem original, aplicando edições, respeitando remoções DELIBERADAS (item
 * que pertencia ao perfil e sumiu da lista visível) e marcando os itens novos
 * com o perfil ativo. É a função mais testada deste commit por um motivo.
 */

export const PERFIL_PESSOAL = "pessoal";
export const PERFIL_TODOS = "__todos__";

export interface Perfil {
  id: string;
  nome: string;
}

export interface ItemComPerfil {
  id?: string;
  perfil?: string;
}

/** Perfil efetivo de um item: sem etiqueta = pessoal (retrocompatível). */
export const perfilDe = (item: ItemComPerfil | undefined | null) =>
  (item?.perfil ?? PERFIL_PESSOAL) || PERFIL_PESSOAL;

/** O que a tela mostra. `PERFIL_TODOS` é a visão consolidada de sempre. */
export const doPerfil = <T extends ItemComPerfil>(itens: T[], perfil: string): T[] => {
  if (perfil === PERFIL_TODOS) return itens;
  return (itens || []).filter((i) => perfilDe(i) === perfil);
};

/**
 * Recompõe a lista completa a partir do que a tela devolveu.
 *
 * - item de OUTRO perfil: passa intacto, na posição original;
 * - item do perfil ativo que voltou: recebe a versão editada;
 * - item do perfil ativo que NÃO voltou: foi apagado de propósito, sai;
 * - item que não estava na lista completa: é novo, entra no fim já etiquetado.
 */
export const mesclarPerfil = <T extends ItemComPerfil>(
  completos: T[],
  visiveis: T[],
  perfil: string,
): T[] => {
  if (perfil === PERFIL_TODOS) return visiveis;

  const pendentes = new Map<string, T>();
  for (const item of visiveis || []) {
    // Item sem id não tem como ser casado com o original; trata-se como novo.
    if (item?.id != null) pendentes.set(String(item.id), item);
  }

  const saida: T[] = [];
  for (const original of completos || []) {
    if (perfilDe(original) !== perfil) {
      saida.push(original);
      continue;
    }
    const chave = original?.id != null ? String(original.id) : null;
    if (chave && pendentes.has(chave)) {
      const editado = pendentes.get(chave)!;
      saida.push(editado.perfil ? editado : { ...editado, perfil });
      pendentes.delete(chave);
    }
    // sem correspondência = apagado na tela; simplesmente não entra
  }

  // Sobrou em `pendentes` o que a tela criou agora.
  for (const novo of pendentes.values()) {
    saida.push(novo.perfil ? novo : { ...novo, perfil });
  }
  // Itens novos sem id entram no fim, também etiquetados.
  for (const item of visiveis || []) {
    if (item?.id == null) saida.push(item.perfil ? item : { ...item, perfil });
  }

  return saida;
};

/**
 * Empacota um par [lista, setter] filtrado por perfil, com a volta já mesclada.
 * A tela usa como se fosse o estado normal e não precisa saber de nada disso.
 */
export const usarListaDoPerfil = <T extends ItemComPerfil>(
  completos: T[],
  gravar: (v: T[]) => void,
  perfil: string,
): [T[], (v: T[]) => void] => [
  doPerfil(completos, perfil),
  (visiveis: T[]) => gravar(mesclarPerfil(completos, visiveis, perfil)),
];
