/**
 * /entrar com a chave ENTRAR_CODIGO: e-mail + "Receber código", senha como link, Apple antes do Google, e a saída de
 * quem tocou Entrar sem ter conta ANTES deles. Com a chave desligada a tela antiga segue (ver welcome-1018.test).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const estado = vi.hoisted(() => ({ ligado: true, nativo: true, apple: true, otp: vi.fn(), signUp: vi.fn(), signIn: vi.fn() }));

vi.mock("@/lib/entrar-codigo", () => ({ entrarCodigoLigado: () => estado.ligado }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  instalouVindoDoSite: () => false,
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => estado.nativo }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => estado.apple }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, signIn: estado.signIn, signUp: estado.signUp }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ set: () => {} }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: async () => ({}), signInWithOtp: (...a: unknown[]) => estado.otp(...a), verifyOtp: async () => ({ error: null }) } } }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: async () => ({ error: { message: "x" } }), entrarComApple: async () => ({ error: { message: "x" } }) }));
vi.mock("@/components/app/RestaurarCompras", () => ({ RestaurarCompras: () => null }));

import Entrar from "@/pages/Entrar";
import Auth from "@/pages/Auth";

beforeEach(() => {
  eventos.length = 0;
  Object.assign(estado, { ligado: true, nativo: true, apple: true });
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

describe("/entrar com a chave ligada", () => {
  it("só o e-mail e 'Receber código'; a senha fica atrás do link e o login por senha continua", async () => {
    estado.signIn.mockResolvedValue({ error: null });
    montar("/entrar");
    expect(screen.getByLabelText(/Seu e-mail/i)).toBeInTheDocument();
    expect(screen.getByTestId("entrar-com-codigo")).toHaveTextContent("Receber código");
    expect(screen.queryByLabelText(/Sua senha/i)).toBeNull();
    fireEvent.click(screen.getByTestId("entrar-com-senha"));
    expect(screen.getByLabelText(/Sua senha/i)).toBeInTheDocument();
    expect(screen.queryByText("Receber código")).toBeNull();
  });

  it("a saída pro funil vem ANTES da Apple, e a Apple antes do Google", () => {
    montar("/entrar?de=welcome");
    const volta = screen.getByTestId("entrar-sem-conta-funil");
    const apple = screen.getByText("Continuar com a Apple").closest("button")!;
    const google = screen.getByText("Continuar com Google").closest("button")!;
    expect(volta.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(apple.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(volta);
    expect(screen.getByTestId("funil")).toBeInTheDocument();
    expect(eventos.filter(([n]) => n === "entrar_sem_conta_funil")).toHaveLength(1);
  });

  it("e-mail sem conta: o aviso aparece e a saída pro funil continua na tela", async () => {
    estado.otp.mockResolvedValue({ error: { message: "Signups not allowed for otp" } });
    montar("/entrar?de=welcome");
    fireEvent.change(screen.getByLabelText(/Seu e-mail/i), { target: { value: "nova@exemplo.com" } });
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    expect(await screen.findByTestId("email-sem-conta")).toBeInTheDocument();
    expect(screen.getByTestId("entrar-sem-conta-funil")).toBeInTheDocument();
  });

  it("falha da Apple aparece na tela e aponta pro código, não pra senha", async () => {
    montar("/entrar");
    await act(async () => { fireEvent.click(screen.getByText("Continuar com a Apple")); });
    expect(screen.getByRole("alert")).toHaveTextContent("Tente com o código por e-mail.");
  });

  it("no site: fala em e-mail da compra; o link do Google continua", () => {
    Object.assign(estado, { nativo: false, apple: false });
    montar("/entrar");
    expect(screen.getByText(/Digite o e-mail da compra/)).toBeInTheDocument();
    expect(screen.getByText("Continuar com Google")).toBeInTheDocument();
    expect(screen.queryByText("Continuar com a Apple")).toBeNull();
  });
});

describe("/auth: criar conta com e-mail que já existe", () => {
  const criar = async () => {
    montar("/auth?signup=1");
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("seu@gmail.com"), { target: { value: "Ana@Exemplo.com" } });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), { target: { value: "senha1234" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Criar conta/ })); });
  };

  it("senha não bate: segue pro código, já pedido, com o e-mail dela", async () => {
    estado.signUp.mockResolvedValue({ error: { message: "User already registered" }, session: null });
    estado.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await criar();
    expect(await screen.findByTestId("codigo-aviso")).toHaveTextContent("Esse e-mail já tem conta.");
    expect(estado.otp).toHaveBeenCalledTimes(1);
    expect(estado.otp).toHaveBeenCalledWith({ email: "ana@exemplo.com", options: { shouldCreateUser: false } });
  });

  it("senha bate: entra sem pedir código", async () => {
    estado.signUp.mockResolvedValue({ error: { message: "User already registered" }, session: null });
    estado.signIn.mockResolvedValue({ error: null });
    await criar();
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    expect(estado.otp).not.toHaveBeenCalled();
  });

  it("chave desligada: fica no /auth, como hoje", async () => {
    estado.ligado = false;
    estado.signUp.mockResolvedValue({ error: { message: "User already registered" }, session: null });
    await criar();
    expect(estado.signIn).not.toHaveBeenCalled();
    expect(estado.otp).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Criar conta/ })).toBeInTheDocument();
  });
});

describe("/entrar com a chave desligada", () => {
  it("a tela antiga: e-mail, senha e o botão de sempre", () => {
    estado.ligado = false;
    montar("/entrar");
    expect(screen.getByLabelText(/Sua senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar no meu CORE/ })).toBeInTheDocument();
    expect(screen.queryByText("Receber código")).toBeNull();
  });
});
