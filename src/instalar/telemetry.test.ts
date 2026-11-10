import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  delete (window as { fbq?: unknown }).fbq;
  delete (window as { _fbq?: unknown })._fbq;
  delete (window as { __eventosInstalar?: unknown }).__eventosInstalar;
  document.querySelectorAll('script[src*="connect.facebook.net"]').forEach(s => s.remove());
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('isolated download measurement', () => {
  it.each([
    'https://www.coreaplicativo.com.br/instalar?qa=1&utm_campaign=qa',
    'http://127.0.0.1:5442/instalar?utm_campaign=local',
  ])('QA does not send analytics/pixel or persist campaign/session/device data (%s)', async url => {
    vi.stubGlobal('location', new URL(url));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const beforeCookie = document.cookie;
    const m = await import('./telemetry');
    m.initMeasurement();
    m.trackStoreClick({ loja: 'ios', onde: 'instalar_topo', link_click_id: 'random-id', referrer_medido: false });
    expect(m.QA).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(document.cookie).toBe(beforeCookie);
    expect(window.fbq).toBeUndefined();
    expect(document.querySelector('script[src*="connect.facebook.net"]')).toBeNull();
  });

  it('production writes route-separated compatible analytics and only PageView + custom StoreClick', async () => {
    vi.stubGlobal('location', new URL('https://www.coreaplicativo.com.br/instalar?utm_campaign=campaign-1&ad_id=123'));
    const pixel = vi.fn(); window.fbq = pixel;
    const m = await import('./telemetry');
    m.initMeasurement(); m.initMeasurement();
    m.trackStoreClick({ loja: 'android', onde: 'instalar_fim', link_click_id: 'random-click-id', referrer_medido: true });
    expect(m.QA).toBe(false);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(2);
    const rows = calls.map(([, options]) => JSON.parse(String(options!.body)));
    expect(rows.map(row => row.event_name)).toEqual(['landing_html', 'landing_loja']);
    expect(rows[1].event_data).toMatchObject({ path: '/instalar', pagina: 'instalar', objetivo: 'download', utm_campaign: 'campaign-1', ad_id: '123', link_click_id: 'random-click-id', medicao_forcada: false, braco_pix: 'unknown' });
    expect(rows[1].session_id).toBe(sessionStorage.getItem('core_session_id'));
    expect(rows[1].event_data.landing_session_id).toBe(sessionStorage.getItem('landing-sessao-v1'));
    expect(pixel.mock.calls.map(args => args.slice(0, 2))).toEqual([['track', 'PageView'], ['trackCustom', 'StoreClick']]);
    expect(calls.every(([, options]) => options!.keepalive === true)).toBe(true);
  });

  it('cannot emit payment/trial events and strips typed/private/unrecognized fields', async () => {
    vi.stubGlobal('location', new URL('https://www.coreaplicativo.com.br/instalar'));
    const m = await import('./telemetry');
    for (const name of ['Purchase', 'StartTrial', 'Lead', 'InitiateCheckout', 'landing_pix_pago']) m.event(name);
    m.event('landing_loja', { loja: 'ios' });
    expect(fetch).not.toHaveBeenCalled();
    m.event('landing_cta', { onde: 'topo', email: 'private@example.com', password: 'private', path: '/organizar' });
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
    expect(body.event_data.path).toBe('/instalar');
    expect(body.event_data.onde).toBe('topo');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(body.event_data).not.toHaveProperty('password');
  });

  it('storage/network/pixel failures do not throw or block navigation', async () => {
    vi.stubGlobal('location', new URL('https://www.coreaplicativo.com.br/instalar'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    vi.mocked(fetch).mockRejectedValue(Error('offline'));
    window.fbq = () => { throw Error('blocked'); };
    const m = await import('./telemetry');
    expect(() => m.initMeasurement()).not.toThrow();
    expect(() => m.trackStoreClick({ loja: 'android', onde: 'instalar_topo', link_click_id: 'random-id', referrer_medido: true })).not.toThrow();
  });
});
