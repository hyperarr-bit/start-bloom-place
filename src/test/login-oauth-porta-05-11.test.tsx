/**
 * 05/11: o `login_completed` passa a contar Google e Apple que saem do /entrar, em cada lugar onde a sessão nasce, e a
 * tela "Você ganhou 3 dias grátis" fala certo com quem veio da entrada do iPhone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const sb = vi.hoisted(() => ({
  setSession: vi.fn(async () => ({ error: null })),
  getUser: vi.fn(async () => ({ data: { user: { id: "u1", created_at: "2026-09-20T00:00:00Z" } } })),
  signInWithIdToken: vi.fn(async () => ({ error: null as { message: string } | null })),
}));
const nativo = vi.hoisted(() => ({ ligado: false, authorize: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { ...sb, signOut: async () => ({}), signInWithOAuth: async () => ({ error: { message: "sem rede" } }) } } }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn() }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.ligado }));
vi.mock("@capacitor-community/apple-sign-in", () => ({ SignInWithApple: { authorize: nativo.authorize } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, signIn: vi.fn() }) }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => true }));
vi.mock("@/components/auth/EntrarComCodigo", () => ({ EntrarComCodigo: () => null }));
vi.mock("@/components/app/RestaurarCompras", () => ({ RestaurarCompras: () => null }));

import AuthCallback from "@/pages/AuthCallback";
import Entrar from "@/pages/Entrar";
import { entrarComApple } from "@/lib/auth-nativo";
import { guardarMetodoLogin, pegarMetodoLogin, registrarLoginOAuth } from "@/lib/login-oauth";
import { ParabensPorta, linhaDoPlano } from "@/components/porta/ParabensPorta";
import { trackEvent } from "@/lib/analytics";

const logins = () => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "login_completed").map((c) => c[1]);
const callback = (url: string) => {
  window.history.replaceState({}, "", url);
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<div data-testid="saiu" />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(trackEvent).mockClear();
  nativo.ligado = false;
  nativo.authorize.mockReset();
  sb.signInWithIdToken.mockClear();
  sb.getUser.mockResolvedValue({ data: { user: { id: "u1", created_at: "2026-09-20T00:00:00Z" } } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState({}, "", "/"); });

describe("login_completed com Google e Apple", () => {
  it("volta do OAuth na web: registra o método uma vez só, com o destino", async () => {
    guardarMetodoLogin("google", "/planos");
    callback("/auth/callback#access_token=a&refresh_token=b");
    await screen.findByTestId("saiu");
    expect(logins()).toEqual([{ method: "google", source: "email_access", next: "/planos" }]);
    registrarLoginOAuth();
    expect(logins()).toHaveLength(1);
  });

  it("conta criada nessa volta vem marcada", async () => {
    sb.getUser.mockResolvedValue({ data: { user: { id: "u1", created_at: new Date().toISOString() } } });
    guardarMetodoLogin("apple", null);
    callback("/auth/callback#access_token=a&refresh_token=b");
    await screen.findByTestId("saiu");
    expect(logins()).toEqual([{ method: "apple", source: "email_access", conta_nova: true }]);
  });

  it("não registra: link de e-mail sem passar pelo /entrar, OAuth com erro, volta sem sessão", async () => {
    callback("/auth/callback#access_token=a&refresh_token=b");
    await screen.findByTestId("saiu");
    cleanup();
    guardarMetodoLogin("google", null);
    callback("/auth/callback#error_description=negado");
    await screen.findByTestId("saiu");
    expect(pegarMetodoLogin()).toBeNull();
    cleanup();
    sb.getUser.mockResolvedValue({ data: { user: null } } as never);
    guardarMetodoLogin("google", null);
    callback("/auth/callback");
    await screen.findByTestId("saiu");
    expect(logins()).toEqual([]);
  });

  it("login abandonado vence em 15 minutos; registro torto não quebra", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 5, 10, 0));
    guardarMetodoLogin("google", null);
    vi.setSystemTime(new Date(2026, 10, 5, 10, 16));
    expect(pegarMetodoLogin()).toBeNull();
    localStorage.setItem("core-auth-metodo", "{torto");
    expect(pegarMetodoLogin()).toBeNull();
    localStorage.setItem("core-auth-metodo", JSON.stringify({ method: "facebook", em: Date.now() }));
    expect(pegarMetodoLogin()).toBeNull();
  });

  it("Apple nativa no iPhone: registra no sucesso; cancelar e falhar não registram", async () => {
    nativo.ligado = true;
    nativo.authorize.mockResolvedValue({ response: { identityToken: "t" } });
    guardarMetodoLogin("apple", null);
    await entrarComApple();
    expect(logins()).toEqual([{ method: "apple", source: "email_access" }]);
    vi.mocked(trackEvent).mockClear();

    nativo.authorize.mockRejectedValue(new Error("1001"));
    guardarMetodoLogin("apple", null);
    expect(await entrarComApple()).toEqual({ error: null });
    expect(pegarMetodoLogin()).toBeNull();

    nativo.authorize.mockResolvedValue({ response: { identityToken: "t" } });
    sb.signInWithIdToken.mockResolvedValueOnce({ error: { message: "x" } });
    guardarMetodoLogin("apple", null);
    await entrarComApple();
    expect(logins()).toEqual([]);
  });

  it("o /entrar guarda o método antes de sair e esquece se o OAuth nem abriu; a tela segue com os dois botões", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Entrar /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Continuar com a Apple/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/ }));
    await screen.findByText(/Não foi possível entrar com Google/);
    expect(localStorage.getItem("core-auth-metodo")).toBeNull();
    expect(logins()).toEqual([]);
  });
});

describe("tela de parabéns da Porta", () => {
  const monta = (porta: Parameters<typeof ParabensPorta>[0]["porta"]) => render(<ParabensPorta porta={porta} onContinuar={() => {}} />);
  const titulo = () => screen.getByTestId("porta-parabens-titulo").textContent;

  it("entrada do iPhone: linha nova, mesmo com área; conta nova mantém os 3 dias", () => {
    expect(linhaDoPlano({ pagina: "iphone", respostas: { area: "dinheiro" } })).toBe("Sua conta está pronta.");
    monta({ pagina: "iphone" });
    expect(screen.getByTestId("porta-parabens-plano").textContent).toBe("Sua conta está pronta.");
    expect(titulo()).toBe("Você ganhou3 dias grátis");
  });

  it("conta antiga: nenhuma promessa de 3 dias na tela", () => {
    monta({ pagina: "iphone", conta_antiga: true });
    expect(document.body.textContent).not.toMatch(/3 dias|grátis/i);
    expect(titulo()).toBe("Tudo pronto");
    expect(screen.getByTestId("porta-parabens-plano").textContent).toBe("Sua conta está pronta.");
  });

  it("quem veio da Porta de sempre não muda", () => {
    expect(linhaDoPlano({ respostas: { area: "dinheiro" } })).toBe("Seu plano de Dinheiro já está salvo.");
    monta({ respostas: { area: "tudo" } });
    expect(titulo()).toBe("Você ganhou3 dias grátis");
  });
});
