/**
 * Estado do funil. sessionStorage "raiox-estado" (passo, respostas, resumo, escolha, variante, e-mail).
 * Lançamento bruto NÃO entra aqui: fica em memória, e no IndexedDB "raiox-tx" só se a pessoa marcar salvar.
 */
import { RAIOX_DEMO } from "@/lib/raiox";
import type { ParsedTx } from "@/lib/extrato-parser";
import type { Chave } from "./conteudo";
import type { ResumoRaiox } from "./estimativa";
import type { TxClassificada } from "./vazamentos";

export const CHAVE_ESTADO = "raiox-estado";
export const CHAVE_DEMO = "raiox-demo";
export const CHAVE_SESSAO = "raiox-sessao";
export const IDB_RAIOX = "raiox-tx";

export const PASSOS = [
  "q1", "q2", "q3", "q4", "q5",
  "calculando", "resultado", "extrato", "leitura",
  "escolha", "demo", "plano_preco", "pix", "sucesso",
] as const;
export type PassoRaiox = (typeof PASSOS)[number];

export type VarianteDemo = "com" | "sem";

export type EstadoRaiox = {
  passo: PassoRaiox;
  respostas: Partial<Record<Chave, number>>;
  resumo: ResumoRaiox | null;
  escolha: Chave | null;
  variante_demo: VarianteDemo;
  email: string | null;
  pix: { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string | null; criadoEm: number } | null;
  codigo: string | null;
  emailEnviado: boolean;
  jaAssinante: boolean;
  fim: string | null;
  quizInicio: number;
  fonte: "estimativa" | "extrato";
};

let memoria: EstadoRaiox | null = null;
let memoriaDemo: VarianteDemo | null = null;
let memoriaSessao: string | null = null;
let txsMemoria: TxClassificada[] = [];

export function _zerarEstadoRaiox(): void {
  memoria = null;
  memoriaDemo = null;
  memoriaSessao = null;
  txsMemoria = [];
}

export function guardarTxs(txs: TxClassificada[]): void {
  txsMemoria = txs;
}
export function lerTxs(): TxClassificada[] {
  return txsMemoria;
}
export function limparTxs(): void {
  txsMemoria = [];
}

const uuid = (): string => {
  try { return crypto.randomUUID(); } catch { return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
};

export function sessaoDoRaiox(): { id: string; nova: boolean } {
  if (memoriaSessao) return { id: memoriaSessao, nova: false };
  try {
    const s = sessionStorage.getItem(CHAVE_SESSAO);
    if (s) { memoriaSessao = s; return { id: s, nova: false }; }
  } catch { /* noop */ }
  memoriaSessao = uuid();
  try { sessionStorage.setItem(CHAVE_SESSAO, memoriaSessao); } catch { /* noop */ }
  return { id: memoriaSessao, nova: true };
}

/** FNV-1a. Mesmo fbclid → mesma variante, mesmo se o Instagram zerar o storage. */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolverDemo(opts: { search: string; fbclid?: string; flag?: "off" | "on" | "ab" }): VarianteDemo {
  const flag = opts.flag ?? RAIOX_DEMO;
  let q: string | null = null;
  try { q = new URLSearchParams(opts.search).get("demo"); } catch { q = null; }
  if (q === "1" || q === "0") {
    const v: VarianteDemo = q === "1" ? "com" : "sem";
    memoriaDemo = v;
    try { sessionStorage.setItem(CHAVE_DEMO, v); } catch { /* noop */ }
    return v;
  }
  if (flag === "on" || flag === "off") {
    const v: VarianteDemo = flag === "on" ? "com" : "sem";
    memoriaDemo = v;
    return v;
  }
  if (memoriaDemo) return memoriaDemo;
  try {
    const salvo = sessionStorage.getItem(CHAVE_DEMO);
    if (salvo === "com" || salvo === "sem") { memoriaDemo = salvo; return salvo; }
  } catch { /* noop */ }
  const fb = opts.fbclid || "";
  const v: VarianteDemo = fb ? (hash32(fb) % 2 === 0 ? "com" : "sem") : (Math.random() < 0.5 ? "com" : "sem");
  memoriaDemo = v;
  try { sessionStorage.setItem(CHAVE_DEMO, v); } catch { /* noop */ }
  return v;
}

export function novoEstado(variante: VarianteDemo): EstadoRaiox {
  return {
    passo: "q1",
    respostas: {},
    resumo: null,
    escolha: null,
    variante_demo: variante,
    email: null,
    pix: null,
    codigo: null,
    emailEnviado: false,
    jaAssinante: false,
    fim: null,
    quizInicio: Date.now(),
    fonte: "estimativa",
  };
}

export function lerEstado(): EstadoRaiox | null {
  if (memoria && PASSOS.includes(memoria.passo)) return memoria;
  try {
    const raw = sessionStorage.getItem(CHAVE_ESTADO);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoRaiox;
    if (e && PASSOS.includes(e.passo)) { memoria = e; return e; }
  } catch { /* noop */ }
  return null;
}

export function gravarEstado(e: EstadoRaiox): void {
  memoria = e;
  try { sessionStorage.setItem(CHAVE_ESTADO, JSON.stringify(e)); } catch { /* fica a memória */ }
}

export async function gravarTxsLocais(txs: ParsedTx[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.open(IDB_RAIOX, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("tx")) db.createObjectStore("tx", { keyPath: "id", autoIncrement: true });
      };
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("tx", "readwrite");
        tx.objectStore("tx").clear();
        for (const item of txs) tx.objectStore("tx").add(item);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
    } catch { resolve(); }
  });
}

export async function limparTxsLocais(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(IDB_RAIOX);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}
