import { afterEach, expect, it, vi } from 'vitest';
const create = vi.hoisted(() => vi.fn((_url: string, _key: string, _options: { auth: Record<string, unknown> }) => ({})));
vi.mock('@supabase/supabase-js', () => ({ createClient: create }));
afterEach(() => { vi.unstubAllGlobals(); history.replaceState(null, '', '/'); vi.clearAllMocks(); });
it.each(['/vitalicio/demo', '/vitalicio/demo/', '/conhecer-demo.html'])('never initializes real session storage or auto-refresh at %s', async path => {
  history.replaceState(null, '', path + '?code=ignored'); vi.resetModules();
  await import('@/integrations/supabase/client');
  expect(create.mock.calls[0][2].auth).toEqual({ storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});
it.each(['/inicio', '/organizar/demo', '/vitalicio/demo-extra'])('retains the original auth configuration at %s', async path => {
  history.replaceState(null, '', path); vi.resetModules();
  await import('@/integrations/supabase/client');
  expect(create.mock.calls[0][2].auth).toEqual({ storage: localStorage, persistSession: true, autoRefreshToken: true });
});
it.each([
  ['https://www.coreaplicativo.com.br/vitalicio',false],
  ['https://www.coreaplicativo.com.br/vitalicio?qa=1',true],
  ['http://localhost/vitalicio',true],
  ['http://localhost/conhecer.html',true],
  ['https://www.coreaplicativo.com.br/organizar?qa=1',false],
])('isolates only the new checkout preview at %s',async(url,isolated)=>{
  vi.stubGlobal('window',{location:new URL(url)});vi.resetModules();
  await import('@/integrations/supabase/client');
  expect(create.mock.calls[0][2].auth).toEqual(isolated?{storage:undefined,persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}:{storage:localStorage,persistSession:true,autoRefreshToken:true});
});
