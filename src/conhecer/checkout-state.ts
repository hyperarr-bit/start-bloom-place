import type { PixLanding } from '@/landing/regras';
import { gravarCookie, lerCookie } from '@/landing/marcador';

export const CHECKOUT_OFFER = 'LN_sempre279' as const;
export const CHECKOUT_PRICE = 27.9;
export const CHECKOUT_PRICE_LABEL = 'R$ 27,90';
export const CHECKOUT_STORAGE = 'core-conhecer-checkout-v1';
export const CHECKOUT_COOKIE = 'core_conhecer_pix_v1';
export const CHECKOUT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RETENTION_MS = 7 * 86400000;
export type SavedCheckout = { v: 1; email: string; pix: PixLanding; savedAt: number };

export function expiresAt(pix: PixLanding): number {
  const explicit = pix.expiresAt ? Date.parse(pix.expiresAt) : NaN;
  return Number.isFinite(explicit) ? explicit : pix.criadoEm + 30 * 60000;
}
export function expired(pix: PixLanding, now = Date.now()): boolean { return now >= expiresAt(pix); }

/** A receipt in storage is never proof of payment. Every restored order is checked again. */
export function parseCheckout(raw: string | null, now = Date.now()): SavedCheckout | null {
  try {
    const x = JSON.parse(raw || 'null');
    if (x?.v !== 1 || !Number.isFinite(x.savedAt) || x.savedAt > now + 60000 || now - x.savedAt > RETENTION_MS) return null;
    if (typeof x.email !== 'string' || x.email.length > 254 || !CHECKOUT_EMAIL.test(x.email)) return null;
    const p = x.pix;
    if (!p || p.oferta !== CHECKOUT_OFFER || typeof p.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(p.orderId)) return null;
    if (typeof p.qrCode !== 'string' || !p.qrCode || p.qrCode.length > 1800 || !Number.isFinite(p.criadoEm) || p.criadoEm > now + 60000) return null;
    if (p.expiresAt != null && (typeof p.expiresAt !== 'string' || !Number.isFinite(Date.parse(p.expiresAt)))) return null;
    return { v: 1, email: x.email.trim().toLowerCase(), savedAt: x.savedAt, pix: { orderId: p.orderId, qrCode: p.qrCode, qrCodeBase64: null, expiresAt: p.expiresAt ?? null, criadoEm: p.criadoEm, oferta: CHECKOUT_OFFER } };
  } catch { return null; }
}
export function readCheckout(): SavedCheckout | null {
  let local: SavedCheckout | null = null;
  try { local = parseCheckout(localStorage.getItem(CHECKOUT_STORAGE)); } catch { /* cookie fallback */ }
  const cookie = parseCheckout(lerCookie(CHECKOUT_COOKIE));
  return [local, cookie].filter((x): x is SavedCheckout => !!x).sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}
export function saveCheckout(pix: PixLanding, email: string): void {
  const value: SavedCheckout = { v: 1, pix: { ...pix, qrCodeBase64: null }, email: email.trim().toLowerCase(), savedAt: Date.now() };
  const raw = JSON.stringify(value);
  try { localStorage.setItem(CHECKOUT_STORAGE, raw); } catch { /* cookie fallback */ }
  // Own namespace. The pending order is retained after expiry so a late payment can still be checked.
  if (encodeURIComponent(raw).length < 3600) gravarCookie(CHECKOUT_COOKIE, raw, RETENTION_MS / 1000);
}
