/**
 * ONDE O "SEU 2027" DA /organizar SE LEMBRA (31/10) — pequeno e síncrono (a landing lê antes de pintar o cartão da conta,
 * sem esperar o módulo do upsell, que só baixa com a chave ligada: ./upsell-2027.ts).
 *
 * Três lugares, como o Pix do vitalício: heap (o Instagram zera o storage com a página viva), localStorage
 * (`landing-u2027-v1`) e um cookie curto (`landing_u2027`: compra, etapa, pedido, validade, dono e o código — o banco
 * pode recarregar a aba DEPOIS do Instagram ter zerado o localStorage; o mesmo QR tem que voltar, nunca um 2º Pix).
 * O EstadoLanding (o Pix do vitalício) não muda.
 */
import { estadoU2027QueVolta, type EstadoU2027, type EtapaU2027, type PixU2027 } from "./regras";
import { gravarCookie, lerCookie } from "./marcador";

export const CHAVE_U2027 = "landing-u2027-v1";
export const COOKIE_U2027 = "landing_u2027";
const VIDA_COOKIE_U2027_S = 2 * 24 * 3600;

let heap: EstadoU2027 | null = null;

const etapas: readonly EtapaU2027[] = ["oferta", "qr", "pronto", "fim"];

/** compra~etapa~pedido~vence~dono~código (o código Pix só tem ASCII imprimível; "~" não aparece em BR Code). O campo dono
 *  leva marcas depois do 1/0: "c" = o código já foi copiado (crítica r1), "e" = também foi pro e-mail (crítica r2). */
export function paraCookie(e: EstadoU2027): string {
  const p = e.pix;
  return [e.compra, e.etapa, p?.orderId ?? "", p ? Date.parse(p.expiresAt) : "", p ? `${p.donoIgual ? "1" : "0"}${e.copiado ? "c" : ""}${e.comEmail ? "e" : ""}` : "", p?.qrCode ?? ""].join("~");
}
export function doCookie(v: string | null, agora: number = Date.now()): EstadoU2027 | null {
  if (!v) return null;
  const [compra, etapa, pedido, vence, dono, ...resto] = v.split("~");
  const codigo = resto.join("~");
  if (!compra || !etapas.includes(etapa as EtapaU2027)) return null;
  const venceMs = Number(vence);
  const pix: PixU2027 | null = pedido && codigo && Number.isFinite(venceMs) && venceMs > 0
    ? { orderId: pedido, qrCode: codigo, qrCodeBase64: null, expiresAt: new Date(venceMs).toISOString(), donoIgual: (dono ?? "").startsWith("1") }
    : null;
  const marcas = (dono ?? "").slice(1);
  return { v: 1, compra, etapa: etapa as EtapaU2027, pix, salvoEm: agora, ...(pix && marcas.includes("c") ? { copiado: true } : {}), ...(pix && marcas.includes("e") ? { comEmail: true } : {}) };
}

/** O estado do 2027 desta compra (heap → localStorage → cookie; nada = a oferta). */
export function lerEstadoU2027(compra: string, agora: number = Date.now()): EstadoU2027 {
  let bruto: unknown = heap && heap.compra === compra ? heap : null;
  if (!bruto) {
    try { const ls = JSON.parse(localStorage.getItem(CHAVE_U2027) || "null") as EstadoU2027 | null; if (ls && ls.compra === compra) bruto = ls; } catch { /* sem storage */ }
  }
  if (!bruto) { const c = doCookie(lerCookie(COOKIE_U2027), agora); if (c && c.compra === compra) bruto = c; }
  return estadoU2027QueVolta(bruto, compra, agora);
}

/**
 * Crítica r2 (dinheiro 1): o 2027 guardado SEM saber a compra — heap → localStorage → cookie. O Instagram zera o localStorage
 * (e com ele o estado do vitalício, então a landing não sabe mais qual compra é); o cookie do 2027 sobrevive e diz qual é.
 * Só volta o que vale reabrir: o QR ainda vivo (etapa "qr") ou o "Pronto". O resto (oferta, fim, vencido) = null.
 */
export function lerU2027Guardado(agora: number = Date.now()): EstadoU2027 | null {
  const candidatos: unknown[] = [heap];
  try { candidatos.push(JSON.parse(localStorage.getItem(CHAVE_U2027) || "null")); } catch { /* sem storage */ }
  candidatos.push(doCookie(lerCookie(COOKIE_U2027), agora));
  for (const c of candidatos) {
    const compra = (c as { compra?: unknown } | null)?.compra;
    if (typeof compra !== "string" || !compra) continue;
    const e = estadoU2027QueVolta(c, compra, agora);
    if ((e.etapa === "qr" && e.pix && Date.parse(e.pix.expiresAt) > agora) || e.etapa === "pronto") return e;
  }
  return null;
}

export function gravarEstadoU2027(e: EstadoU2027): void {
  heap = e;
  try { localStorage.setItem(CHAVE_U2027, JSON.stringify(e)); } catch { /* fica no heap e no cookie */ }
  gravarCookie(COOKIE_U2027, paraCookie(e), VIDA_COOKIE_U2027_S);
}

/** Só testes. */
export function _zerarU2027(): void {
  heap = null;
  try { localStorage.removeItem(CHAVE_U2027); } catch { /* noop */ }
  gravarCookie(COOKIE_U2027, "", 0);
}
