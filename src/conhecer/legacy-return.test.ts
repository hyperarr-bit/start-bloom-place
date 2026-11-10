import { describe, expect, it, vi } from 'vitest';
import { hasLegacyStripeAttempt, legacyStripeReturn } from './legacy-return';

describe('legacy Stripe returns', () => {
  it.each(['succeeded', 'processing', 'failed'])('preserves the exact query/hash for %s without claiming payment', status => {
    const query = `?utm_content=a%20b&payment_intent=pi_3AbC123&payment_intent_client_secret=opaque_test_value&redirect_status=${status}&x=1&x=2`;
    expect(legacyStripeReturn('https://www.coreaplicativo.com.br/vitalicio' + query + '#voltar')).toBe('/oferta' + query + '#voltar');
  });
  it.each(['/vitalicio/', '/conhecer.html'])('accepts the previous page and technical entry: %s', path => {
    expect(legacyStripeReturn(path + '?payment_intent=pi_123&redirect_status=succeeded')).toBe('/oferta?payment_intent=pi_123&redirect_status=succeeded');
  });
  it.each(['/oferta', '/inicio', '/vitalicio/demo', '/vitalicio-extra', '/conhecer'])('does not capture unrelated routes: %s', path => {
    expect(legacyStripeReturn(path + '?payment_intent=pi_123&redirect_status=succeeded')).toBeNull();
  });
  it.each([
    'qa=1&payment_intent=pi_123&redirect_status=succeeded',
    'qa=0&qa=1&payment_intent=pi_123&redirect_status=succeeded',
    'payment_intent=pi_123', 'redirect_status=succeeded',
    'payment_intent=pi_123&redirect_status=requires_payment_method',
    'payment_intent=pi_123&redirect_status=unknown',
    'payment_intent=pi_&redirect_status=succeeded',
    'payment_intent=pi_abc_secret_xyz&redirect_status=succeeded',
    'payment_intent=pi_%3Cscript%3E&redirect_status=succeeded',
    'payment_intent=pi_1&payment_intent=pi_2&redirect_status=succeeded',
    'payment_intent=pi_1&redirect_status=succeeded&redirect_status=failed',
  ])('ignores QA, incomplete or invalid returns: %s', query => {
    expect(legacyStripeReturn('/vitalicio?' + query)).toBeNull();
  });
  it('does not allow a non-web scheme or an external redirect target', () => {
    expect(legacyStripeReturn('javascript:alert(1)')).toBeNull();
    expect(legacyStripeReturn('https://example.invalid/vitalicio?payment_intent=pi_1&redirect_status=succeeded&next=https://evil.invalid')).toBe('/oferta?payment_intent=pi_1&redirect_status=succeeded&next=https://evil.invalid');
  });
});

describe('legacy Stripe attempt detection', () => {
  const store = (ref: unknown, raw: string | null) => ({ getItem: vi.fn((key: string) => key === 'oferta-stripe-ref' ? ref as string | null : raw) });
  it('recognizes only a valid PI paired with the same valid tab reference', () => {
    const storage = store('abcdef12-3456', JSON.stringify({ ref: 'abcdef12-3456', pi: 'pi_3AbC123' }));
    expect(hasLegacyStripeAttempt(storage)).toBe(true);
    expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual(['oferta-stripe-ref', 'oferta-stripe-pi']);
  });
  it.each([
    [null, null], ['short', '{}'], ['a'.repeat(65), '{}'],
    ['abcdef12', '{bad'], ['abcdef12', 'null'], ['abcdef12', '[]'],
    ['abcdef12', JSON.stringify({ ref: 'different', pi: 'pi_123' })],
    ['abcdef12', JSON.stringify({ ref: 'abcdef12', pi: 'pi_' })],
    ['abcdef12', JSON.stringify({ ref: 'abcdef12', pi: 'pi_123_secret_test' })],
    ['abcdef12', JSON.stringify({ ref: 'abcdef12', pi: 123 })],
  ])('rejects malformed, missing or mismatched state', (ref, raw) => {
    expect(hasLegacyStripeAttempt(store(ref, raw))).toBe(false);
  });
  it('tolerates storage access denial without writing or sending requests', () => {
    expect(hasLegacyStripeAttempt({ getItem: () => { throw new Error('Storage unavailable'); } })).toBe(false);
  });
});
