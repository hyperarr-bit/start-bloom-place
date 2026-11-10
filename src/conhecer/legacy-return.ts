/** Compatibility with the Stripe checkout previously served at /vitalicio.
 * This module intentionally has no application imports, storage writes or network calls.
 * A redirect status is navigation context only; /oferta confirms payment with the server.
 */
const PAYMENT_INTENT = /^pi_[A-Za-z0-9]{1,100}$/;
const ATTEMPT_REF = /^[A-Za-z0-9-]{8,64}$/;
const RETURN_STATUSES = new Set(['succeeded', 'processing', 'failed']);

export function legacyStripeReturn(href: string): string | null {
  try {
    const url = new URL(href, 'https://core.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!['/vitalicio', '/conhecer.html'].includes(url.pathname.replace(/\/+$/, ''))) return null;
    if (url.searchParams.getAll('qa').includes('1')) return null;
    const intents = url.searchParams.getAll('payment_intent');
    const statuses = url.searchParams.getAll('redirect_status');
    if (intents.length !== 1 || statuses.length !== 1 || !PAYMENT_INTENT.test(intents[0]) || !RETURN_STATUSES.has(statuses[0])) return null;
    // Do not reconstruct searchParams: preserve attribution, Stripe parameters, encoding and hash.
    return '/oferta' + url.search + url.hash;
  } catch { return null; }
}

/** A stored attempt is not evidence of payment; only used to offer the existing checkout. */
export function hasLegacyStripeAttempt(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    const ref = storage.getItem('oferta-stripe-ref');
    if (!ref || !ATTEMPT_REF.test(ref)) return false;
    const raw = storage.getItem('oferta-stripe-pi');
    if (!raw || raw.length > 1024) return false;
    const attempt: unknown = JSON.parse(raw);
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) return false;
    const saved = attempt as { ref?: unknown; pi?: unknown };
    return saved.ref === ref && typeof saved.pi === 'string' && PAYMENT_INTENT.test(saved.pi);
  } catch { return false; }
}
