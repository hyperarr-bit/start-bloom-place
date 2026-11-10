import { describe, expect, it } from 'vitest';
import { compactCheckoutSource } from './attribution';
describe('fonte de atribuição do pagamento', () => {
  it('mantém campanha e IDs completos quando click id anterior excede o limite', () => {
    const r = compactCheckoutSource('https://www.coreaplicativo.com.br/vitalicio?ttclid=' + 'x'.repeat(400) + '&utm_campaign=120250477300450621&c_id=120250477300450621&as_id=123&ad_id=456&utm_source=tiktok');
    const u = new URL(r.url);
    expect(r.url.length).toBeLessThanOrEqual(300);
    expect(u.searchParams.get('utm_campaign')).toBe('120250477300450621');
    expect(u.searchParams.get('ad_id')).toBe('456');
    expect(u.searchParams.has('ttclid')).toBe(false);
    expect(r.omitted).toEqual(['ttclid']);
  });
  it('preserva click IDs que cabem, removes parâmetros de etapa, QA e campos desconhecidos', () => {
    const r = compactCheckoutSource('https://www.coreaplicativo.com.br/vitalicio?etapa=checkout&qa=1&email=private%40example.com&ttclid=whole-click-id&fbclid=whole-meta-id&utm_source=tiktok#pay');
    const u = new URL(r.url);
    expect(u.pathname).toBe('/vitalicio');
    expect(u.searchParams.get('ttclid')).toBe('whole-click-id');
    expect(u.searchParams.get('fbclid')).toBe('whole-meta-id');
    expect(u.searchParams.has('email')).toBe(false);
    expect(u.searchParams.has('etapa')).toBe(false);
    expect(u.searchParams.has('qa')).toBe(false);
    expect(u.hash).toBe('');
    expect(r.omitted).toEqual([]);
  });
  it('não corta caracteres escapados nem injeta campanha de outra visita', () => {
    const r = compactCheckoutSource('https://www.coreaplicativo.com.br/vitalicio?utm_campaign=teste&utm_content=' + encodeURIComponent('ação '.repeat(100)) + '&utm_medium=cpc');
    expect(r.url.length).toBeLessThanOrEqual(300);
    expect(new URL(r.url).searchParams.get('utm_medium')).toBe('cpc');
    expect(new URL(r.url).searchParams.has('utm_content')).toBe(false);
    expect(r.omitted).toEqual(['utm_content']);
    expect(compactCheckoutSource('https://www.coreaplicativo.com.br/vitalicio').url).toBe('https://www.coreaplicativo.com.br/vitalicio');
  });
});
