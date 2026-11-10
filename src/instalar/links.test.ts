import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('location', new URL('https://www.coreaplicativo.com.br/instalar?qa=1'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  document.body.innerHTML = '';
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('store destinations for /instalar', () => {
  it('Android carries the random join key and always stays pre-purchase', async () => {
    const { attributedStoreUrl } = await import('./links');
    // Even a placement called pos_compra must not turn this download page into a paid-user instruction.
    const url = new URL(attributedStoreUrl('android', '12345678-1234-1234-1234-123456789abc', 'pos_compra', false));
    const ref = new URLSearchParams(url.searchParams.get('referrer')!);
    expect(url.origin).toBe('https://play.google.com');
    expect(url.searchParams.get('id')).toBe('br.com.coreaplicativo.app');
    expect(ref.get('core_link_id')).toBe('12345678-1234-1234-1234-123456789abc');
    expect(ref.get('core_etapa')).toBe('pre_compra');
    expect(ref.get('core_path')).toBe('/instalar');
    expect(ref.get('core_pix')).toBe('unknown');
    expect(ref.get('utm_campaign')).toBe('core_instalar');
    expect(ref.get('utm_campaign')).not.toMatch(/^web_/);
    expect(ref.has('core_qa')).toBe(false);
  });

  it('Apple has a distinct aggregate campaign without individual IDs; QA is separate', async () => {
    const { attributedStoreUrl } = await import('./links');
    const url = new URL(attributedStoreUrl('ios', 'private-random-id', 'topo', false));
    expect(url.searchParams.get('pt')).toBe('129384060');
    expect(url.searchParams.get('ct')).toBe('core_instalar');
    expect(url.searchParams.get('mt')).toBe('8');
    expect(url.href).not.toContain('private-random-id');
    expect(attributedStoreUrl('ios', 'random-id', 'fim', true)).toContain('ct=core_instalar_qa');
    const ref = new URLSearchParams(new URL(attributedStoreUrl('android', 'random-id', 'fim', true)).searchParams.get('referrer')!);
    expect(ref.get('core_qa')).toBe('1');
  });

  it('records one distinct click per activation, with event key matching Android referrer', async () => {
    const { PLAY_STORE_URL, prepareStoreLink } = await import('./links');
    const a = document.createElement('a'); a.href = PLAY_STORE_URL; a.dataset.loja = 'android';
    const first = prepareStoreLink(a, 'topo')!;
    const second = prepareStoreLink(a, 'topo')!;
    expect(first.clickId).not.toBe(second.clickId);
    const events = (window as unknown as { __eventosInstalar: Array<Record<string, unknown>> }).__eventosInstalar;
    const clicks = events.filter(e => e.nome === 'landing_loja');
    expect(clicks).toHaveLength(2);
    expect(clicks[1]).toMatchObject({ link_click_id: second.clickId, path: '/instalar', onde: 'instalar_topo', loja: 'android', medicao_forcada: true });
    expect(new URLSearchParams(new URL(a.href).searchParams.get('referrer')!).get('core_link_id')).toBe(second.clickId);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps no-JS destinations usable and refuses unrelated URLs', async () => {
    const { APP_STORE_URL, PLAY_STORE_URL, prepareStoreLink } = await import('./links');
    expect(new URL(APP_STORE_URL).hostname).toBe('apps.apple.com');
    expect(new URL(PLAY_STORE_URL).hostname).toBe('play.google.com');
    const a = document.createElement('a'); a.href = 'https://example.com'; a.dataset.loja = 'android';
    expect(prepareStoreLink(a, 'topo')).toBeNull();
    expect(a.href).toBe('https://example.com/');
  });
});
