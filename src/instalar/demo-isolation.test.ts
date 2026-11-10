import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ehCaminhoDeDemo, ehDemoDaVenda } from '@/lib/caminho-demo';

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, '', '/');
});

it.each(['/instalar/demo', '/instalar/demo/', '/instalar-demo.html'])('never reads or refreshes a saved expired account at %s, including hostile callback parameters', async path => {
  history.replaceState(null, '', `${path}?code=untrusted-code#access_token=untrusted-token&refresh_token=untrusted-refresh&expires_in=3600&token_type=bearer`);
  const storageKey = 'sb-itoylenzvahbscgjgtqf-auth-token';
  const saved = JSON.stringify({ access_token: 'expired-test-token', refresh_token: 'test-refresh-token', expires_at: 1, user: { id: 'existing-account' } });
  localStorage.setItem(storageKey, saved);
  localStorage.setItem('u:existing-account:finance-transactions', '[{"private":true}]');
  const get = vi.spyOn(Storage.prototype, 'getItem');
  const set = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const network = vi.fn(() => Promise.reject(new Error('Demo cannot use the network')));
  vi.stubGlobal('fetch', network);
  vi.resetModules();

  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.auth.getSession();
  expect(error).toBeNull();
  expect(data.session).toBeNull();
  expect(network).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalledWith(storageKey);
  expect(get).not.toHaveBeenCalledWith('u:existing-account:finance-transactions');
  // The SDK may probe whether localStorage exists with an ephemeral lswt-* key.
  // It must not read/write/remove any account, app or attribution state.
  expect(set.mock.calls.every(([key]) => key.startsWith('lswt-'))).toBe(true);
  expect(remove.mock.calls.every(([key]) => key.startsWith('lswt-'))).toBe(true);
  get.mockRestore();
  expect(localStorage.getItem(storageKey)).toBe(saved);
  expect(localStorage.getItem('u:existing-account:finance-transactions')).toBe('[{"private":true}]');
  supabase.auth.stopAutoRefresh();
});

it.each(['/instalar/demo', '/instalar/demo/', '/instalar-demo.html'])('uses module demo guards and suppresses real-app usage attribution at %s', path => {
  expect(ehCaminhoDeDemo(path)).toBe(true);
  expect(ehDemoDaVenda(path)).toBe(true);
});

it.each(['/instalar', '/instalar/', '/instalar/demo-extra', '/instalar/demo/private', '/home', '/financas'])('does not classify a landing or application route as a demo: %s', path => {
  expect(ehCaminhoDeDemo(path)).toBe(false);
  expect(ehDemoDaVenda(path)).toBe(false);
});

it('ships a standalone network-isolated entry using the existing 16-module preview', () => {
  const html = readFileSync('instalar-demo.html', 'utf8');
  expect(html).toContain("connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'self'");
  expect(html).toContain('/src/instalar/demo-main.tsx');
  expect(html).toContain('"/instalar/demo"');
  expect(html).not.toMatch(/src\/main\.tsx|facebook\.net|tiktok|utmify|fbq\(/i);
  const main = readFileSync('src/instalar/demo-main.tsx', 'utf8');
  expect(main).not.toMatch(/import .*['"].*(?:App|main)['"]|<AuthProvider[ >]|<UserDataProvider[ >]/);
  expect(main).toContain('<PreviewAuthProvider>');
  expect(main).toContain("from '@/pages/organizar/DemoDaLanding'");
  expect(main).toContain("window.location.replace('/instalar')");
});
