/**
 * UPSELL "SEU 2027 JÁ ORGANIZADO" (21/10) — a chave, as copies e o estado do fluxo do lado do SITE.
 *
 * Depois do "pagamento confirmado" do vitalício (R$ 27,90) no /inicio e no /hoje, ANTES das lojas: "Seu 2027 já
 * organizado" por R$ 19,90 (Pix Asaas `u2027`, uma vez só). Pago → "Pronto, seu 2027 tá no seu CORE" → o pós-compra de
 * sempre. O servidor grava `core-pacote-2027` na conta de quem pagou (supabase/functions/_shared/pacote-2027.ts); o app
 * mostra a aba "SEU 2027" em Desenvolvimento Pessoal (src/lib/pacote-2027.ts). A COMPRA é só na web: o app nunca mostra
 * a oferta nem link de pagamento.
 *
 * DESLIGADO (UPSELL_2027 = false): os funis /inicio e /hoje ficam exatamente como estão (travado nos testes).
 * QA sem mexer em ninguém: `?up2027=on` (fica neste navegador; `?up2027=off` tira).
 */
export const UPSELL_2027: boolean = false;
export const PARAM_QA_2027 = "up2027";
/** Fora do prefixo core-* de propósito (a vassoura do cache não mexe; é do aparelho, como o presente-force). */
export const CHAVE_FORCA_2027 = "up2027-force";

let forca: "on" | "off" | null = null;
/** Só testes. */
export const _zerarForca2027 = (): void => { forca = null; };

/** O upsell do 2027 está ligado AQUI? Lê `?up2027=on|off` (fica no navegador e no heap — o Instagram zera o storage). */
export function upsell2027Ligado(busca: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get(PARAM_QA_2027); } catch { /* noop */ }
  if (v === "on" || v === "off") {
    forca = v;
    try { localStorage.setItem(CHAVE_FORCA_2027, v); } catch { /* storage bloqueado: fica o heap */ }
  }
  let f: string | null = forca;
  if (!f) { try { f = localStorage.getItem(CHAVE_FORCA_2027); } catch { f = null; } }
  if (f === "on") return true;
  if (f === "off") return false;
  return UPSELL_2027;
}

/* ───────────────────────── oferta ───────────────────────── */

export const OFERTA_2027 = "u2027" as const;
export const VALOR_2027 = 19.9;

/** As 2 versões da oferta (mockups a1-oferta-visual e a2-oferta-curta) — o dono escolhe. */
export type VersaoOferta2027 = "visual" | "curta";
export const VERSAO_OFERTA_2027: VersaoOferta2027 = "visual";

/** O que vem no pacote — SÓ o que o app faz de verdade (ver src/lib/pacote-2027.ts). */
export const ITENS_2027 = [
  { emoji: "🎯", titulo: "Planejar 2027 em 5 minutos", sub: "3 metas, orçamento do ano e as datas que importam", bonus: false },
  { emoji: "🗓️", titulo: "12 revisões do mês", sub: "no dia 1 de cada mês, o roteiro pronto", bonus: false },
  { emoji: "🐷", titulo: "Cofrinho das 52 semanas", sub: "R$ 1 a R$ 52 = R$ 1.378 no fim do ano", bonus: true },
  { emoji: "🖨️", titulo: "Planner 2027 pra imprimir", sub: "PDF com as 16 áreas", bonus: true },
] as const;
export const PILULAS_2027 = ["🎯 3 metas", "💰 orçamento do ano", "🎂 datas que importam", "🐷 cofrinho 52 semanas", "🖨️ PDF pra imprimir"] as const;
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/* ───────────────────────── o fluxo (estado puro) ───────────────────────── */

export type Etapa2027 = "oferta" | "pix" | "pronto" | "fim";
export type PixDoFluxo2027 = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string | null; criadoEm: number; oferta: string };
export type Estado2027 = {
  v: 1;
  /** o pedido do vitalício que abriu o fluxo (um fluxo por compra) */
  compra: string;
  etapa: Etapa2027;
  pix: PixDoFluxo2027 | null;
  /** o pedido do pacote pago */
  pedido: string | null;
};
export const novoEstado2027 = (compra: string): Estado2027 => ({ v: 1, compra, etapa: "oferta", pix: null, pedido: null });

/** Fora do prefixo core-* de propósito: a vassoura do cache não pode apagar o fluxo na volta do app do banco. */
export const CHAVE_ESTADO_2027 = "up2027-fluxo-v1";
let memoria: Estado2027 | null = null;
/** Só testes. */
export const _zerarEstado2027 = (): void => { memoria = null; };
export function lerEstado2027(compra: string): Estado2027 {
  let e: Estado2027 | null = memoria;
  if (!e) {
    try { const raw = localStorage.getItem(CHAVE_ESTADO_2027); if (raw) e = JSON.parse(raw) as Estado2027; } catch { e = null; }
  }
  return e && e.v === 1 && e.compra === compra ? e : novoEstado2027(compra);
}
export function gravarEstado2027(e: Estado2027): void {
  memoria = e;
  try { localStorage.setItem(CHAVE_ESTADO_2027, JSON.stringify(e)); } catch { /* fica o heap */ }
}

export const reais2027 = (v: number): string => `R$ ${v.toFixed(2).replace(".", ",")}`;
