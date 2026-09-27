import { supabase } from "@/integrations/supabase/client";
import type { EventoCard, LinhaVisita } from "./uso-contas";

/**
 * MODO RESERVA DA ABA "USO" (27/09).
 *
 * Enquanto a função admin_uso não está no banco, a tela busca as linhas pelo
 * REST (o admin já lê module_analytics e subscriptions) e agrega no navegador
 * com a mesma conta (uso-contas.ts). Sai mais lento que a função — por isso a
 * barra de progresso — mas a aba funciona hoje.
 *
 * Por que em FATIAS de tempo e não paginando a janela inteira: cada página
 * com offset alto obriga o banco a ler e descartar tudo o que veio antes (e a
 * policy de admin roda linha a linha). Fatias de 1 dia saem baratas, cada uma
 * com 1–3 páginas, e rodam 6 ao mesmo tempo.
 */

const PAGINA = 1000;
const PARALELO = 6;
const TENTATIVAS = 3;
const HORA = 3600e3;

export interface Avanco { feitos: number; total: number; linhas: number }

/** Fatias [a, b) de `passoMs` que cobrem [de, ate). */
export function fatiar(de: string, ate: string, passoMs: number): Array<[string, string]> {
  const saida: Array<[string, string]> = [];
  const fim = Date.parse(ate);
  for (let t = Date.parse(de); t < fim; t += passoMs) {
    saida.push([new Date(t).toISOString(), new Date(Math.min(t + passoMs, fim)).toISOString()]);
  }
  return saida;
}

const cancelado = () => new DOMException("cancelado", "AbortError");

async function comRetentativa<T>(fn: () => Promise<T>, sinal: AbortSignal): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < TENTATIVAS; i++) {
    if (sinal.aborted) throw cancelado();
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (sinal.aborted) throw cancelado();
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw ultimo;
}

async function emParalelo<T>(tarefas: Array<() => Promise<T>>, limite: number): Promise<T[]> {
  const saida = new Array<T>(tarefas.length);
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < tarefas.length) {
      const i = proxima++;
      saida[i] = await tarefas[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, tarefas.length) }, trabalhador));
  return saida;
}

type RespostaPagina<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;

async function buscarFatiado<T>(
  fatias: Array<[string, string]>,
  pagina: (de: string, ate: string, offset: number) => RespostaPagina<T>,
  sinal: AbortSignal,
  aoAvancar?: (a: Avanco) => void,
): Promise<T[]> {
  let feitos = 0;
  let linhas = 0;
  aoAvancar?.({ feitos, total: fatias.length, linhas });
  const tarefas = fatias.map(([a, b]) => async () => {
    const saida: T[] = [];
    for (let off = 0; ; off += PAGINA) {
      const lote = await comRetentativa(async () => {
        const { data, error } = await pagina(a, b, off);
        if (error) throw error;
        return data ?? [];
      }, sinal);
      for (const l of lote) saida.push(l);
      linhas += lote.length;
      if (lote.length < PAGINA) break;
      aoAvancar?.({ feitos, total: fatias.length, linhas });
    }
    feitos += 1;
    aoAvancar?.({ feitos, total: fatias.length, linhas });
    return saida;
  });
  return (await emParalelo(tarefas, PARALELO)).flat();
}

/** Quem tem assinatura agora (active / trialing / cancel_scheduled). */
export async function buscarAssinantes(sinal: AbortSignal): Promise<Set<string>> {
  const saida = new Set<string>();
  for (let off = 0; ; off += PAGINA) {
    const lote = await comRetentativa(async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("user_id")
        .in("status", ["active", "trialing", "cancel_scheduled"])
        .order("id", { ascending: true })
        .range(off, off + PAGINA - 1)
        .abortSignal(sinal);
      if (error) throw error;
      return data ?? [];
    }, sinal);
    for (const r of lote) saida.add(r.user_id);
    if (lote.length < PAGINA) break;
  }
  return saida;
}

/** Visitas (module_analytics) de [de, ate), em fatias de 1 dia. */
export function buscarVisitas(de: string, ate: string, sinal: AbortSignal, aoAvancar?: (a: Avanco) => void): Promise<LinhaVisita[]> {
  return buscarFatiado<LinhaVisita>(
    fatiar(de, ate, 24 * HORA),
    (a, b, off) =>
      supabase
        .from("module_analytics")
        .select("user_id,module_id,tab_id,duration_seconds,entered_at")
        .gte("entered_at", a)
        .lt("entered_at", b)
        .order("entered_at", { ascending: true })
        .order("id", { ascending: true })
        .range(off, off + PAGINA - 1)
        .abortSignal(sinal),
    sinal,
    aoAvancar,
  );
}

// String larga de propósito: com o literal, o tipo do supabase-js tenta ler
// os "->>" da seleção e estoura a profundidade do TypeScript (TS2589).
const COLUNAS_CARD: string = "user_id,event_name,modulo:event_data->>modulo,aba:event_data->>aba,card:event_data->>card";

/**
 * Cards de UM módulo (card_view / card_interact de conta logada), em fatias
 * de 6 h. No modo reserva a tela limita a 7 dias: são ~10 mil eventos de
 * card por dia, e o filtro por módulo dentro do JSON não tem índice.
 */
export function buscarCardsDoModulo(
  modulo: string, de: string, ate: string, sinal: AbortSignal, aoAvancar?: (a: Avanco) => void,
): Promise<EventoCard[]> {
  return buscarFatiado<EventoCard>(
    fatiar(de, ate, 6 * HORA),
    (a, b, off) =>
      supabase
        .from("analytics_events")
        .select(COLUNAS_CARD)
        .in("event_name", ["card_view", "card_interact"])
        .not("user_id", "is", null)
        .filter("event_data->>modulo", "eq", modulo)
        .gte("created_at", a)
        .lt("created_at", b)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(off, off + PAGINA - 1)
        .abortSignal(sinal) as unknown as RespostaPagina<EventoCard>,
    sinal,
    aoAvancar,
  );
}
