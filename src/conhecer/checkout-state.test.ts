import { beforeEach, describe, expect, it } from 'vitest';
import { CHECKOUT_COOKIE, CHECKOUT_OFFER, CHECKOUT_STORAGE, expired, parseCheckout, readCheckout, saveCheckout } from './checkout-state';
const pix = () => ({ orderId: 'order-123', qrCode: '000201COREPIX', qrCodeBase64: null, expiresAt: new Date(Date.now() + 1800000).toISOString(), criadoEm: Date.now(), oferta: CHECKOUT_OFFER });
beforeEach(() => { localStorage.clear(); document.cookie = `${CHECKOUT_COOKIE}=; Max-Age=0; Path=/`; });
describe('retomada do checkout /conhecer', () => {
  it('persiste pedido e e-mail no namespace próprio, sem mudar o Pix da LP', () => {
    localStorage.setItem('landing-pix', 'keep'); const p = pix(); saveCheckout(p, 'Pessoa@Example.com');
    expect(readCheckout()).toMatchObject({ email: 'pessoa@example.com', pix: { orderId: p.orderId } });
    expect(localStorage.getItem('landing-pix')).toBe('keep');
  });
  it('cookie recupera o mesmo pedido se o storage desaparece', () => {
    const p = pix(); saveCheckout(p, 'pessoa@example.com'); localStorage.removeItem(CHECKOUT_STORAGE);
    expect(readCheckout()?.pix.orderId).toBe(p.orderId);
  });
  it('retém pedido expirado para conferir pagamento tardio, sem criar outro', () => {
    const p = { ...pix(), expiresAt: new Date(Date.now() - 10000).toISOString() }; saveCheckout(p, 'pessoa@example.com');
    expect(expired(readCheckout()!.pix)).toBe(true); expect(readCheckout()?.pix.orderId).toBe(p.orderId);
  });
  it('estado local pago não é prova de pagamento e não sobrevive ao parser', () => {
    const p = pix(); const read = parseCheckout(JSON.stringify({ v: 1, pix: p, email: 'pessoa@example.com', savedAt: Date.now(), paid: true, stage: 'access' }));
    expect(read).not.toHaveProperty('paid'); expect(read).not.toHaveProperty('stage');
  });
  it.each(['w67', 'w27', 'LN_ano279'])('rejeita oferta incompatível %s', oferta => {
    expect(parseCheckout(JSON.stringify({ v: 1, pix: { ...pix(), oferta }, email: 'pessoa@example.com', savedAt: Date.now() }))).toBeNull();
  });
  it('rejeita payload corrompido, muito antigo e vencimento inválido', () => {
    expect(parseCheckout('{')).toBeNull();
    expect(parseCheckout(JSON.stringify({ v: 1, pix: pix(), email: 'pessoa@example.com', savedAt: Date.now() - 8 * 86400000 }))).toBeNull();
    expect(parseCheckout(JSON.stringify({ v: 1, pix: { ...pix(), expiresAt: 'yesterday' }, email: 'pessoa@example.com', savedAt: Date.now() }))).toBeNull();
  });
});
