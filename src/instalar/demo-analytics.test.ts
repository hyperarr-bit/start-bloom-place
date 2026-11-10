import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
  getUser: vi.fn(async () => ({ data: { user: null } })),
  insert: vi.fn(async () => ({})), from: vi.fn(), note: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession, getUser: mocks.getUser }, from: mocks.from } }));
vi.mock('@/lib/aparelho', () => ({ propriedadesComuns: () => ({}), iniciarFichaDoAparelho: vi.fn() }));
vi.mock('@/lib/momento-ruim', () => ({ anotarPeloEvento: mocks.note }));
vi.mock('@/lib/home-nova', () => ({ camposHomeNova: () => ({}), }));
vi.mock('@/lib/fluxo-enxuto', () => ({ camposFluxoEnxuto: () => ({}) }));
vi.mock('@/lib/modo-1012', () => ({ camposModo1012: () => ({}) }));
import { markActivation, trackEvent, trackEventBeacon } from '@/lib/analytics';

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  vi.stubGlobal('fetch', vi.fn(async () => new Response()));
});
afterEach(() => { history.replaceState(null, '', '/'); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['/instalar/demo', '/instalar/demo/', '/instalar-demo.html'])('blocks event, unload and activation tracking before auth/storage/network work at %s', async path => {
  history.replaceState(null, '', path + '?m=treino');
  const get = vi.spyOn(Storage.prototype, 'getItem');
  const set = vi.spyOn(Storage.prototype, 'setItem');
  trackEvent('module_view'); trackEventBeacon('module_exit');
  await markActivation('first_workout');
  await Promise.resolve();
  expect(mocks.getSession).not.toHaveBeenCalled();
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.note).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled();
});

it.each(['/instalar', '/instalar/demo-extra', '/organizar/demo', '/home'])('retains normal tracking at %s', async path => {
  history.replaceState(null, '', path);
  trackEvent('module_view'); trackEventBeacon('module_exit');
  await markActivation('first_workout');
  await Promise.resolve(); await Promise.resolve();
  expect(mocks.getSession).toHaveBeenCalledTimes(2);
  expect(mocks.getUser).toHaveBeenCalledTimes(1);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ event_name: 'module_view' }));
  expect(fetch).toHaveBeenCalledTimes(1);
});
