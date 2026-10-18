/**
 * A CÓPIA DE SEGURANÇA DO DIA 1 DA CONVIDADA (funil da missão, 18/10).
 *
 * O navegador do Instagram zera o storage COM A PÁGINA VIVA (memória atribuicao_web_zerada_instagram, 24/09). Antes de
 * pagar, tudo o que a convidada montou mora no localStorage (guest:* do useUserData, a missão `missao-doses`, o estado do
 * funil `core-missao-web`, a oferta). Se ele some no meio, ela perde o dia 1 antes de pagar — e a oferta perde o motivo.
 *
 * Três camadas:
 *   1. MEMÓRIA: a cada 1,5 s (e quando a aba some/volta) copia o localStorage do funil pro heap. Se a sentinela
 *      (`core-missao-web`) sumir do storage mas estiver na cópia, foi o navegador que apagou: tudo volta na hora
 *      (só as chaves que faltam; nada é sobrescrito) e sai `missao_web_storage_sumiu {onde: "memoria"}`.
 *   2. IndexedDB: a mesma cópia, gravada quando muda (o Instagram às vezes recarrega a página depois de zerar).
 *      Na abertura (app-entry do /missao e main.tsx), sem a sentinela no storage e com a cópia lá: volta antes de o
 *      React montar e sai `missao_web_storage_sumiu {onde: "indexeddb"}`.
 *   3. Um cookie (`core_missao_copia=1`, 7 dias) diz ao main.tsx que vale a pena abrir o IndexedDB — sem ele, o boot
 *      de quem nunca passou pelo funil não paga nada (nem abrir o banco).
 * A sessão do Supabase (depois do Pix) já tem a cópia dela no heap (pages/hoje/conta) — aqui não entra (`sb-*`),
 * nem o cache por conta (`u:*`, que o servidor refaz).
 */
import { trackEvent } from "@/lib/analytics";

export const SENTINELA = "core-missao-web";
const COOKIE = "core_missao_copia";
const DB = "core-missao";
const LOJA = "copia";
const CHAVE_COPIA = "v1";
const VALIDADE_MS = 7 * 24 * 3600_000;

type Copia = { em: number; dados: Record<string, string> };

const fica = (k: string) => !k.startsWith("sb-") && !k.startsWith("u:");

/** Lê do localStorage tudo o que a cópia guarda (sem lançar). */
export function lerStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !fica(k)) continue;
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  } catch { /* storage bloqueado */ }
  return out;
}

/** Devolve ao storage só o que falta. Quantas chaves voltaram. */
export function devolver(dados: Record<string, string>): number {
  let n = 0;
  for (const [k, v] of Object.entries(dados)) {
    try { if (localStorage.getItem(k) === null) { localStorage.setItem(k, v); n++; } } catch { /* cheio/bloqueado */ }
  }
  return n;
}

/* ───────────────────────── IndexedDB (tudo falha em silêncio) ───────────────────────── */

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined") { ok(null); return; }
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(LOJA); } catch { /* já existe */ } };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch { ok(null); }
  });
}

async function gravarNoBanco(c: Copia): Promise<void> {
  const db = await abrir();
  if (!db) return;
  try {
    await new Promise<void>((ok) => {
      const tx = db.transaction(LOJA, "readwrite");
      tx.objectStore(LOJA).put(c, CHAVE_COPIA);
      tx.oncomplete = () => ok(); tx.onerror = () => ok(); tx.onabort = () => ok();
    });
  } catch { /* noop */ } finally { try { db.close(); } catch { /* noop */ } }
}

async function lerDoBanco(): Promise<Copia | null> {
  const db = await abrir();
  if (!db) return null;
  try {
    return await new Promise<Copia | null>((ok) => {
      const tx = db.transaction(LOJA, "readonly");
      const r = tx.objectStore(LOJA).get(CHAVE_COPIA);
      r.onsuccess = () => ok((r.result as Copia | undefined) ?? null);
      r.onerror = () => ok(null);
    });
  } catch { return null; } finally { try { db.close(); } catch { /* noop */ } }
}

const temCookie = (): boolean => { try { return document.cookie.split(/;\s*/).some((c) => c === `${COOKIE}=1`); } catch { return false; } };
const marcarCookie = () => { try { document.cookie = `${COOKIE}=1; max-age=${7 * 24 * 3600}; path=/; samesite=lax`; } catch { /* noop */ } };
const semSentinela = (): boolean => { try { return localStorage.getItem(SENTINELA) === null; } catch { return false; } };

/** main.tsx: vale abrir o IndexedDB antes de montar? (cookie do funil + a sentinela sumiu do storage) */
export function precisaRestaurar(): boolean {
  return temCookie() && semSentinela();
}

/**
 * Na abertura: sem a sentinela no storage e com uma cópia recente no IndexedDB → devolve antes do React montar.
 * Nunca espera mais que `limiteMs` (o boot não fica refém do banco).
 */
export async function restaurarDaCopia(limiteMs = 800): Promise<boolean> {
  if (!semSentinela()) return false;
  const c = await Promise.race([lerDoBanco(), new Promise<null>((ok) => setTimeout(() => ok(null), limiteMs))]);
  if (!c || !c.dados?.[SENTINELA] || Date.now() - c.em > VALIDADE_MS) return false;
  const n = devolver(c.dados);
  if (n > 0) trackEvent("missao_web_storage_sumiu", { onde: "indexeddb", chaves: n, idade_min: Math.round((Date.now() - c.em) / 60000) });
  return n > 0;
}

/* ───────────────────────── o vigia (com a página viva) ───────────────────────── */

let memoria: Record<string, string> | null = null;
let ultimoGravado = "";
let timer: number | null = null;
let vigias = 0;

/** Uma volta do vigia: restaura se a sentinela sumiu; senão, atualiza a cópia. Exportada pros testes. */
export function rodada(): "restaurou" | "copiou" | "nada" {
  const agora = lerStorage();
  if (!agora[SENTINELA]) {
    if (memoria?.[SENTINELA]) {
      const n = devolver(memoria);
      trackEvent("missao_web_storage_sumiu", { onde: "memoria", chaves: n });
      return "restaurou";
    }
    return "nada"; // o funil ainda não começou (ou acabou de propósito)
  }
  memoria = agora;
  const json = JSON.stringify(agora);
  if (json !== ultimoGravado) {
    ultimoGravado = json;
    marcarCookie();
    void gravarNoBanco({ em: Date.now(), dados: agora });
  }
  return "copiou";
}

/** Liga o vigia (idempotente; devolve o desligar). */
export function vigiarStorage(intervaloMs = 1500): () => void {
  vigias++;
  if (vigias === 1) {
    rodada();
    timer = window.setInterval(rodada, intervaloMs);
    document.addEventListener("visibilitychange", rodada);
    window.addEventListener("pageshow", rodada);
  }
  return () => {
    vigias = Math.max(0, vigias - 1);
    if (vigias === 0) {
      if (timer) window.clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", rodada);
      window.removeEventListener("pageshow", rodada);
    }
  };
}

/** Só testes. */
export function _zerarSeguranca(): void { memoria = null; ultimoGravado = ""; if (timer) window.clearInterval(timer); timer = null; vigias = 0; }
