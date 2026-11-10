import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

it('uses memory-only auth with the actual SDK, even if the browser already has an expired account session', async () => {
  history.replaceState(null, '', '/vitalicio/demo?code=not-an-auth-callback');
  const saved = JSON.stringify({ access_token: 'expired-test-token', refresh_token: 'test-refresh-token', expires_at: 1, user: { id: 'existing-account' } });
  const storageKey = 'sb-itoylenzvahbscgjgtqf-auth-token';
  localStorage.setItem(storageKey, saved);
  const fetch = vi.fn(() => Promise.reject(new Error('No network expected')));
  vi.stubGlobal('fetch', fetch);
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull(); expect(data.session).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey)).toBe(saved);
  } finally {
    vi.unstubAllGlobals(); localStorage.removeItem(storageKey); history.replaceState(null, '', '/');
  }
});

it('routes the preview to its own HTML with a network barrier and no app/marketing entry', () => {
  const html = readFileSync('conhecer-demo.html', 'utf8');
  expect(html).toContain("connect-src 'none'");
  expect(html).toContain('/src/conhecer/demo-main.tsx');
  expect(html).not.toMatch(/src\/main\.tsx|facebook\.net|tiktok|utmify|fbq\(/i);
  const main = readFileSync('src/conhecer/demo-main.tsx', 'utf8');
  expect(main).not.toMatch(/import .*['"].*(?:App|main)['"]|<AuthProvider[ >]|<UserDataProvider[ >]/);
  expect(main).toContain('<PreviewAuthProvider>');
  const { rewrites } = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const path of ['/vitalicio/demo', '/vitalicio/demo/']) {
    expect(rewrites.find((r: { source: string }) => r.source === path)?.destination).toBe('/conhecer-demo.html');
  }
});
