/**
 * 1.0.25 NO IPHONE SAI COM VITE_MODO_1012=1 (crítica da build, 11/11). A tela de Entrar por código só tinha teste com o
 * modo no padrão. Aqui o modo 1.0.12 está LIGADO e a chave ENTRAR_CODIGO é a de verdade (app = "on"), no iPhone:
 *  · o /entrar abre no código, e o caminho do revisor da Apple (conta demo com senha) é "Prefiro entrar com senha";
 *  · o /auth "Criar conta" com e-mail que já existe vai pro código;
 *  · no site (mesmo com o modo) a tela antiga segue.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const estado = vi.hoisted(() => ({ nativo: true, otp: vi.fn(), signUp: vi.fn(), signIn: vi.fn() }));

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  instalouVindoDoSite: () => false,
}));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => estado.nativo, isIOS: () => estado.nativo, isAndroid: () => false, plataformaApp: () => (estado.nativo ? "ios" : "web"),
}));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => estado.nativo }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, signIn: estado.signIn, signUp: estado.signUp }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ set: () => {} }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: async () => ({}), signInWithOtp: (...a: unknown[]) => estado.otp(...a), verifyOtp: async () => ({ error: null }) } } }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: async () => ({ error: { message: "x" } }), entrarComApple: async () => ({ error: { message: "x" } }) }));
vi.mock("@/components/app/RestaurarCompras", () => ({ RestaurarCompras: () => null }));

import Entrar from "@/pages/Entrar";
import Auth from "@/pages/Auth";
import { modo1012 } from "@/lib/modo-1012";
import { ENTRAR_CODIGO_APP, entrarCodigoLigado } from "@/lib/entrar-codigo";

const g = globalThis as { __MODO_1012__?: unknown };
beforeAll(() => { g.__MODO_1012__ = true; });
afterAll(() => { delete g.__MODO_1012__; });
beforeEach(() => {
  estado.nativo = true;
  estado.otp.mockReset().mockResolvedValue({ error: null });
  estado.signUp.mockReset();
  estado.signIn.mockReset();
});
afterEach(cleanup);

const montar = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/app" element={<div data-testid="funil">funil</div>} />
      <Route path="/" element={<div data-testid="raiz">raiz</div>} />
    </Routes>
  </MemoryRouter>,
);

describe("Entrar por código com o modo 1.0.12 ligado (o IPA da 1.0.25)", () => {
  it("o modo está ligado e a chave do app é a de verdade", () => {
    expect(modo1012()).toBe(true);
    expect(ENTRAR_CODIGO_APP).toBe("on");
    expect(entrarCodigoLigado()).toBe(true);
  });

  it("o /entrar abre no código; 'Prefiro entrar com senha' leva ao login da conta demo (caminho do revisor)", async () => {
    estado.signIn.mockResolvedValue({ error: null });
    montar("/entrar");
    expect(screen.getByTestId("entrar-com-codigo")).toHaveTextContent("Receber código");
    expect(screen.queryByLabelText(/Sua senha/i)).toBeNull();
    fireEvent.click(screen.getByTestId("entrar-com-senha"));
    fireEvent.change(screen.getByLabelText(/Seu e-mail/i), { target: { value: "demo@exemplo.com" } });
    fireEvent.change(screen.getByLabelText(/Sua senha/i), { target: { value: "senha-demo-123" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Entrar no meu CORE/ })); });
    expect(estado.signIn).toHaveBeenCalledTimes(1);
    expect(estado.signIn.mock.calls[0][0]).toBe("demo@exemplo.com");
    expect(estado.otp).not.toHaveBeenCalled();
  });

  it("o /auth 'Criar conta' com e-mail que já tem conta (senha não bate) vai pro código, já pedido", async () => {
    estado.signUp.mockResolvedValue({ error: { message: "User already registered" }, session: null });
    estado.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    montar("/auth?signup=1");
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("seu@gmail.com"), { target: { value: "Ana@Exemplo.com" } });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), { target: { value: "senha1234" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Criar conta/ })); });
    expect(await screen.findByTestId("codigo-aviso")).toHaveTextContent("Esse e-mail já tem conta.");
    expect(estado.otp).toHaveBeenCalledWith({ email: "ana@exemplo.com", options: { shouldCreateUser: false } });
  });

  it("no site, mesmo com o modo, a tela antiga de e-mail e senha segue", () => {
    estado.nativo = false;
    montar("/entrar");
    expect(screen.getByLabelText(/Sua senha/i)).toBeInTheDocument();
    expect(screen.queryByText("Receber código")).toBeNull();
  });
});
