import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
  insert: vi.fn(async () => ({})), from: vi.fn(), note: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession }, from: mocks.from } }));
vi.mock('@/lib/aparelho', () => ({ propriedadesComuns: () => ({}), iniciarFichaDoAparelho: vi.fn() }));
vi.mock('@/lib/momento-ruim', () => ({ anotarPeloEvento: mocks.note }));
vi.mock('@/lib/home-nova', () => ({ camposHomeNova: () => ({}) }));
vi.mock('@/lib/fluxo-enxuto', () => ({ camposFluxoEnxuto: () => ({}) }));
vi.mock('@/lib/modo-1012', () => ({ camposModo1012: () => ({}) }));
import { trackEvent, trackEventBeacon } from '@/lib/analytics';

describe('isolated embedded demo measurement', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    vi.stubGlobal('fetch', vi.fn(async () => new Response()));
  });
  afterEach(() => { history.replaceState(null, '', '/'); vi.unstubAllGlobals(); });
  it.each(['/vitalicio/demo', '/vitalicio/demo/', '/conhecer-demo.html'])('suppresses ordinary and unload events at %s before session/storage/network work', async path => {
    history.replaceState(null, '', path + '?m=financas');
    trackEvent('module_view'); trackEventBeacon('module_exit');
    await Promise.resolve();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.note).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
  it.each(['/vitalicio', '/inicio', '/organizar/demo', '/vitalicio/demo-extra'])('keeps existing event contracts at %s', async path => {
    history.replaceState(null, '', path);
    trackEvent('module_view'); trackEventBeacon('module_exit');
    await Promise.resolve(); await Promise.resolve();
    expect(mocks.getSession).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ event_name: 'module_view' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
