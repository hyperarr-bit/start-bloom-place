/**
 * O QUE A PESSOA CRIOU NA DEMO E SEGUE PRA CONTA (funil-demo /experimente, 14/10).
 *
 * Regra do dono: dado de EXEMPLO nunca entra na conta; o que ela mesma anotou, entra.
 * Não há mecanismo novo aqui — é o da demo guiada (28/09), já testado:
 *   · ACHAR: `alvoDaMissao(tipo).achar` (src/components/demo-guiada/alvos.ts) compara a gravação com o valor
 *     de antes e devolve o item NOVO (gasto com id que não existia, hábito com nome novo, exercício novo);
 *   · GRAVAR: `levarItemParaConta` (src/lib/demo-guiada-registro.ts) — lista fechada de chaves, só o item dela,
 *     chave nunca muda de tipo, idempotente.
 * O que segue (de propósito, o mínimo seguro):
 *   · Finanças: gasto que ela lançou (qualquer jeito);
 *   · Rotina: hábito que ela DIGITOU (marcar o quadradinho de um hábito de exemplo não é dela);
 *   · Treino: exercício que ela digitou.
 * Não seguem: edição de item de exemplo (o item é do exemplo), Saúde (o copo d'água da demo é toque em dado
 * de exemplo) e Dieta (não há registro seguro pra ela). E só segue o que AINDA está lá na hora da conta
 * (lançou e apagou = não segue).
 * Nada daqui escreve em `guest:` — a migração do convidado (use-user-data) não leva NADA da demo.
 */
import { alvoDaMissao, type LeitorDaDemo } from "@/components/demo-guiada/alvos";
import { codificarItem, decodificarItem, tipoDoModulo, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { CHAVES_DO_ITEM, idDoItem, levarItemParaConta, type ChaveDoItem } from "@/lib/demo-guiada-registro";

export const TIPOS_QUE_SEGUEM: readonly TipoDoItem[] = ["gasto", "habito", "exercicio"];
export const MAX_ITENS = 8;

/** Uma gravação da demo → o item que ELA criou (ou null). */
export function itemDaGravacao(modulo: string, chave: string, valor: unknown, anterior: unknown, ler: LeitorDaDemo): ItemDaDemo | null {
  const tipo = tipoDoModulo(modulo);
  if (!tipo || !TIPOS_QUE_SEGUEM.includes(tipo)) return null;
  const alvo = alvoDaMissao(tipo);
  if (!alvo.chaves.includes(chave)) return null;
  let r: ReturnType<typeof alvo.achar> = null;
  try { r = alvo.achar(chave, valor, anterior, ler); } catch { return null; }
  if (!r) return null;
  // Rotina: o "toque" é marcar um hábito de EXEMPLO — não é item dela
  if (tipo !== "gasto" && r.via !== "digitado") return null;
  return r.item;
}

/** Junta o item na lista (sem repetir, no máximo MAX_ITENS). Devolve a MESMA lista se nada mudou. */
export function juntarItem(itens: ItemDaDemo[], novo: ItemDaDemo | null): ItemDaDemo[] {
  if (!novo) return itens;
  const id = idDoItem(novo);
  if (itens.some((i) => idDoItem(i) === id)) return itens;
  return [...itens, novo].slice(-MAX_ITENS);
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const igual = (a: unknown, b: string) => typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

/** O item ainda está na demo (ela não apagou)? `ler` = o valor atual da chave no módulo dele. */
export function aindaEsta(item: ItemDaDemo, ler: (chave: string) => unknown): boolean {
  switch (item.tipo) {
    case "gasto":
      return lista(ler("finance-expenses")).some((e) => igual(mapa(e).description, item.nome) && Math.abs(Number(mapa(e).value) - (item.valor ?? 0)) < 0.005);
    case "habito":
      return lista(ler("rotina-habits")).some((h) => igual(typeof h === "string" ? h : mapa(h).name, item.nome));
    case "exercicio":
      return Object.values(mapa(ler("saude-workouts-v2"))).some((d) => lista(mapa(d).exercises).some((e) => igual(mapa(e).name, item.nome)));
    default:
      return false;
  }
}

/* ------------------------------------------------ na URL (Instagram → "Abrir no navegador") */

export const codificarItens = (itens: ItemDaDemo[]): string[] => itens.slice(0, MAX_ITENS).map(codificarItem);
export const decodificarItens = (x: unknown): ItemDaDemo[] => {
  if (!Array.isArray(x)) return [];
  let out: ItemDaDemo[] = [];
  for (const c of x.slice(0, MAX_ITENS)) {
    const i = typeof c === "string" ? decodificarItem(c) : null;
    if (i && TIPOS_QUE_SEGUEM.includes(i.tipo)) out = juntarItem(out, i);
  }
  return out;
};

/* ------------------------------------------------ na conta */

/** O mínimo do cliente do Supabase que a gravação usa (os testes trocam). */
export interface BancoDosItens {
  from: (tabela: "user_data") => {
    select: (cols: string) => { eq: (c: string, v: string) => { in: (c: string, v: string[]) => PromiseLike<{ data: Array<{ key: string; value: unknown }> | null; error: unknown }> } };
    upsert: (linhas: Array<{ user_id: string; key: string; value: unknown }>, o: { onConflict: string }) => PromiseLike<{ error: unknown }>;
  };
}

/**
 * Grava os itens dela na conta: LÊ o que a conta já tem nessas chaves (erro de leitura = não grava nada — nunca
 * escreve por cima sem saber o que há lá), aplica `levarItemParaConta` item a item e grava só as chaves que mudaram.
 * Conta nova = a lista só com o item dela. Nunca lança.
 */
export async function levarItensParaConta(banco: BancoDosItens, userId: string, itens: ItemDaDemo[], hoje: Date = new Date()): Promise<{ ok: boolean; chaves: ChaveDoItem[]; erro?: string }> {
  if (!itens.length) return { ok: true, chaves: [] };
  try {
    const chaves = [...CHAVES_DO_ITEM] as string[];
    const { data, error } = await banco.from("user_data").select("key,value").eq("user_id", userId).in("key", chaves);
    if (error) return { ok: false, chaves: [], erro: "ler" };
    const conta = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));
    const mudou = new Set<ChaveDoItem>();
    for (const item of itens) {
      levarItemParaConta(item, (k) => conta.get(k), (k, v) => { conta.set(k, v); mudou.add(k); }, hoje);
    }
    if (!mudou.size) return { ok: true, chaves: [] };
    const linhas = [...mudou].map((k) => ({ user_id: userId, key: k, value: conta.get(k) }));
    const { error: e2 } = await banco.from("user_data").upsert(linhas, { onConflict: "user_id,key" });
    if (e2) return { ok: false, chaves: [], erro: "gravar" };
    return { ok: true, chaves: [...mudou] };
  } catch (e) {
    return { ok: false, chaves: [], erro: String(e).slice(0, 80) };
  }
}
