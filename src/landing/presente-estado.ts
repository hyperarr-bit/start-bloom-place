/**
 * ONDE O PRESENTE DA /organizar SE LEMBRA (01/11, UPSELL_POS = "presente") — pequeno e síncrono (a landing lê antes de pintar
 * o cartão da conta, sem esperar o módulo ./upsell-presente.ts). O mesmo desenho do ./u2027-estado.ts: heap (o Instagram zera
 * o storage com a página viva), localStorage (`landing-presente-v1`) e um cookie curto (`landing_presente`) — a volta do
 * app do banco pode recarregar a aba DEPOIS do Instagram ter zerado o localStorage: o MESMO QR (ou o cartão) tem que voltar,
 * nunca um 2º Pix. O estado do vitalício e o do 2027 não mudam.
 */
import { estadoPresenteLpQueVolta, type EstadoPresenteLp } from "./regras";
import { gravarCookie, lerCookie } from "./marcador";

export const CHAVE_PRESENTE_LP = "landing-presente-v1";
export const COOKIE_PRESENTE_LP = "landing_presente";
const VIDA_COOKIE_S = 2 * 24 * 3600;

let heap: EstadoPresenteLp | null = null;

const doCookie = (): unknown => {
  try { return JSON.parse(lerCookie(COOKIE_PRESENTE_LP) || "null"); } catch { return null; }
};

/** O estado do presente desta compra (heap → localStorage → cookie; nada = a oferta). */
export function lerEstadoPresenteLp(compra: string, agora: number = Date.now()): EstadoPresenteLp {
  let bruto: unknown = heap && heap.compra === compra ? heap : null;
  if (!bruto) {
    try { const ls = JSON.parse(localStorage.getItem(CHAVE_PRESENTE_LP) || "null") as EstadoPresenteLp | null; if (ls && ls.compra === compra) bruto = ls; } catch { /* sem storage */ }
  }
  if (!bruto) { const c = doCookie() as EstadoPresenteLp | null; if (c && c.compra === compra) bruto = c; }
  return estadoPresenteLpQueVolta(bruto, compra, agora);
}

export function gravarEstadoPresenteLp(e: EstadoPresenteLp): void {
  heap = e;
  try { localStorage.setItem(CHAVE_PRESENTE_LP, JSON.stringify(e)); } catch { /* fica no heap e no cookie */ }
  // o cookie sem o qrCodeBase64 (o QR se desenha do código) — cabe folgado nos 4 KB
  const leve: EstadoPresenteLp = { ...e, pix: e.pix ? { ...e.pix, qrCodeBase64: null } : null };
  gravarCookie(COOKIE_PRESENTE_LP, JSON.stringify(leve), VIDA_COOKIE_S);
}

/** Só testes. */
export function _zerarPresenteLp(): void {
  heap = null;
  try { localStorage.removeItem(CHAVE_PRESENTE_LP); } catch { /* noop */ }
  gravarCookie(COOKIE_PRESENTE_LP, "", 0);
}
