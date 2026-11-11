import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storeForDevice } from './platform';

const mocks = vi.hoisted(() => ({ event: vi.fn(), init: vi.fn(), prepare: vi.fn() }));
vi.mock('./telemetry', () => ({ QA: true, event: mocks.event, initMeasurement: mocks.init }));
vi.mock('./links', () => ({
  APP_STORE_URL: 'https://apps.apple.com/br/app/id6806913181?pt=129384060&ct=core_instalar&mt=8',
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_campaign%3Dcore_instalar',
  prepareStoreLink: mocks.prepare,
}));
const html = readFileSync(resolve('instalar.html'), 'utf8');
const ua = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
};
const scroll = vi.fn();
const originalObserver = window.IntersectionObserver;
let docListeners: ReturnType<typeof vi.spyOn>;
let windowListeners: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
  const fixture = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = fixture.head.innerHTML;
  document.body.innerHTML = fixture.body.innerHTML;
  history.replaceState(null, '', '/instalar?qa=1');
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua.mac);
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  const observer = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  Object.defineProperty(window, 'IntersectionObserver', { value: observer });
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: observer });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  Element.prototype.scrollIntoView = function(options?: ScrollIntoViewOptions | boolean) { scroll(this.id, options); };
  docListeners = vi.spyOn(document, 'addEventListener');
  windowListeners = vi.spyOn(window, 'addEventListener');
});
afterEach(() => {
  for (const [name, listener, options] of (docListeners?.mock.calls ?? []) as [string, EventListenerOrEventListenerObject, boolean | EventListenerOptions | undefined][]) document.removeEventListener(name, listener, options);
  for (const [name, listener, options] of (windowListeners?.mock.calls ?? []) as [string, EventListenerOrEventListenerObject, boolean | EventListenerOptions | undefined][]) window.removeEventListener(name, listener, options);
  document.body.innerHTML = ''; document.head.innerHTML = '';
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
  Object.defineProperty(window, 'IntersectionObserver', { value: originalObserver });
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: originalObserver });
});
const boot = () => import('./main');
const query = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
function click(element: Element, button = 0, type = 'click') {
  element.addEventListener(type, e => e.preventDefault(), { once: true }); // Test the handler without leaving jsdom.
  element.dispatchEvent(new MouseEvent(type, { button, bubbles: true, cancelable: true }));
}
function message(data: Record<string, unknown>, origin = location.origin, source: MessageEventSource | null = query<HTMLIFrameElement>('#lp-demo-frame').contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
}

describe('rota de download por aparelho', () => {
  it.each([
    [ua.ios, 0, 'ios'],
    [ua.android, 0, 'android'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, 'ios'],
    [ua.mac, 5, 'ios'], // iPad requesting a desktop website.
    [ua.mac, 0, null],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, null],
  ])('detecta destino sem tratar computador como iPhone (%s)', (agent, touches, expected) => {
    expect(storeForDevice(String(agent), Number(touches))).toBe(expected);
  });

  it('a primeira tela não tem botão de baixar: igual à /organizar, a pessoa escolhe por onde começar antes', () => {
    const topo = new DOMParser().parseFromString(html, 'text/html').querySelector('#topo')!;
    expect(topo.querySelectorAll('a, [data-download-auto], [data-loja]')).toHaveLength(0);
    expect(topo.querySelectorAll('button.lp-area')).toHaveLength(4);
  });

  it('no computador, o CTA mostra as duas lojas sem registrar saída para loja', async () => {
    await boot();
    const cta = query<HTMLAnchorElement>('[data-download-auto][data-onde="demo"]');
    expect(cta.getAttribute('href')).toBe('#download');
    expect(cta.hasAttribute('data-loja')).toBe(false);
    expect(document.querySelectorAll('#download a[data-loja]')).toHaveLength(2);
    click(cta);
    expect(scroll).toHaveBeenCalledWith('download', { behavior: 'smooth', block: 'start' });
    expect(mocks.event).toHaveBeenCalledWith('landing_cta', { onde: 'demo', destino: 'escolher_loja' });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it.each([['ios', ua.ios, 'apps.apple.com'], ['android', ua.android, 'play.google.com']])('no %s, o clique real aponta à loja e conta apenas uma vez', async (store, agent, host) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent);
    await boot();
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>('[data-download-auto]')];
    expect(anchors).toHaveLength(3);
    for (const anchor of anchors) { expect(anchor.dataset.loja).toBe(store); expect(new URL(anchor.href).host).toBe(host); }
    expect(mocks.prepare).not.toHaveBeenCalled(); // Rendering is not a store visit.
    const cta = anchors[0];
    click(cta, 2); click(cta, 2, 'auxclick');
    expect(mocks.prepare).not.toHaveBeenCalled();
    click(cta.querySelector('svg')!);
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    expect(mocks.prepare).toHaveBeenLastCalledWith(cta, 'demo');
    expect(scroll).not.toHaveBeenCalled();
    click(cta, 1, 'auxclick');
    expect(mocks.prepare).toHaveBeenCalledTimes(2);
  });
});

describe('demonstração da LP de download', () => {
  it('escolha abre o módulo correto e aceita mensagens somente do iframe legítimo', async () => {
    await boot();
    click(query('[data-a="rotina"]'));
    const frame = query<HTMLIFrameElement>('#lp-demo-frame');
    const url = new URL(frame.src);
    expect(url.pathname).toBe('/instalar/demo');
    expect(url.searchParams.get('m')).toBe('rotina');
    expect(url.searchParams.get('qa')).toBe('1');
    expect(scroll).toHaveBeenCalledWith('demo', expect.anything());
    const phone = query('#lp-celular');
    message({ tipo: 'landing:pronta', modulo: 'rotina' }, 'https://example.com');
    message({ tipo: 'landing:pronta', modulo: 'rotina' }, location.origin, window);
    expect(phone.hasAttribute('data-pronta')).toBe(false);
    expect(mocks.event.mock.calls.filter(([name]) => name === 'landing_demo_pronta')).toHaveLength(0);
    message({ tipo: 'landing:pronta', modulo: 'rotina' });
    expect(phone.hasAttribute('data-pronta')).toBe(true);
    expect(query<HTMLDivElement>('#demo-status').hidden).toBe(true);
    message({ tipo: 'landing:mexeu', modulo: 'rotina' });
    message({ tipo: 'landing:mexeu', modulo: 'rotina' });
    expect(mocks.event.mock.calls.filter(([name]) => name === 'landing_demo_mexeu')).toHaveLength(1);
    message({ tipo: 'landing:oferta' });
    expect(scroll).toHaveBeenLastCalledWith('download', expect.anything());
    vi.advanceTimersByTime(12000);
    expect(query<HTMLButtonElement>('#demo-retry').hidden).toBe(true);
    expect(mocks.event).not.toHaveBeenCalledWith('landing_erro', expect.objectContaining({ onde: 'demo_timeout' }));
  });

  it('falha de carregamento oferece nova tentativa após 12 segundos', async () => {
    await boot(); click(query('[data-a="corpo"]'));
    const frame = query<HTMLIFrameElement>('#lp-demo-frame');
    expect(new URL(frame.src).searchParams.get('m')).toBe('treino');
    const retry = query<HTMLButtonElement>('#demo-retry');
    vi.advanceTimersByTime(11999); expect(retry.hidden).toBe(true);
    vi.advanceTimersByTime(1); expect(retry.hidden).toBe(false);
    expect(query('#demo-status').textContent).toContain('tentar novamente');
    expect(mocks.event).toHaveBeenCalledWith('landing_erro', { onde: 'demo_timeout', modulo: 'treino' });
    click(retry); expect(retry.hidden).toBe(true);
    expect(query('#demo-status').textContent).toBe('Abrindo o app…');
    expect(mocks.event).toHaveBeenCalledWith('landing_demo_aberta', { modulo: 'treino', via: 'tentar_novamente' });
    message({ tipo: 'landing:pronta', modulo: 'treino' });
    vi.advanceTimersByTime(12000);
    expect(mocks.event.mock.calls.filter(([name]) => name === 'landing_erro')).toHaveLength(1);
  });
});

it('adiciona a LP separada e preserva rotas de compra e download existentes', () => {
  const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
  const rewrites = new Map(config.rewrites.map((r: { source: string; destination: string }) => [r.source, r.destination]));
  expect(rewrites.get('/instalar')).toBe('/instalar.html');
  expect(rewrites.get('/instalar/demo')).toBe('/instalar-demo.html');
  expect(rewrites.get('/organizar')).toBe('/landing.html');
  expect(rewrites.get('/oferta')).toBe('/landing.html');
  expect(rewrites.get('/vitalicio')).toBe('/conhecer.html');
  expect(rewrites.get('/baixar')).toBe('/api/baixar');
  const main = readFileSync(resolve('src/instalar/main.ts'), 'utf8');
  expect(main).not.toMatch(/import\s*(?:\([^)]*|[^;]*from\s*)['"][^'"]*(?:pagamento|checkout|landing\/landing)/i);
  expect([...document.scripts].map(script => script.getAttribute('src'))).toEqual(['/src/instalar/main.ts']);
  expect(document.querySelector('#lp-pagar, #lp-pix, input[type="email"]')).toBeNull();
});
