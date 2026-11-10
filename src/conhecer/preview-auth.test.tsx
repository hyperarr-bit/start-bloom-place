import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), invoke: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: boundary, functions: boundary, from: boundary.from } }));
vi.mock('@/lib/analytics', () => ({ vincularOrigem: vi.fn() }));
vi.mock('@/lib/sessao-anonima', () => ({ vincularCompraAnonima: vi.fn() }));
import { PreviewAuthProvider, useAuth, useAuthOpcional } from '@/hooks/use-auth';
let guest: ReturnType<typeof useAuth>;
function Consumer() {
  guest = useAuth();
  expect(useAuthOpcional()).toBe(guest);
  return <output>{guest.user?.id ?? 'guest'}:{String(guest.loading)}:{String(guest.subLoaded)}</output>;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
it('provides a resolved read-only guest, without reading, changing or signing out the real account', async () => {
  localStorage.setItem('core-financas', 'real account data');
  boundary.getSession.mockResolvedValue({ data: { session: { user: { id: 'already-signed-in' } } } });
  render(<PreviewAuthProvider><Consumer /></PreviewAuthProvider>);
  expect(screen.getByText('guest:false:true')).toBeInTheDocument();
  expect(guest.session).toBeNull(); expect(guest.isSubscribed).toBe(false);
  expect((await guest.signUp('qa@example.invalid', 'not-a-real-password')).error).toBeTruthy();
  expect((await guest.signIn('qa@example.invalid', 'not-a-real-password')).error).toBeTruthy();
  await guest.signOut();
  for (const fn of Object.values(boundary)) expect(fn).not.toHaveBeenCalled();
  expect(localStorage.getItem('core-financas')).toBe('real account data');
});
