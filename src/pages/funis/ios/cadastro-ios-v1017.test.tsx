/**
 * 1.0.17 — o pós-compra do iPhone sem piscada (vídeo do dono, 19/10).
 *
 *  · o nome digitado vai pra chave que a Home lê (`core-user-name`) — antes a saudação usava o começo do e-mail;
 *  · o botão fica em spinner até a tela sair (antes voltava a "Salvar meu acesso →" e parecia que falhou) e o
 *    toque nele não tira o foco do campo (o teclado fechando fazia o selo "Teste ativado" empurrar a tela);
 *  · "Guardando seu acesso…" → Home pela ROTA (sem `location.href`, que recarregava o WebView: tela preta + branca
 *    + Home com o tour longo), e só quando a assinatura já está no AuthProvider e a missão já nasceu.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor, createEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const estado = vi.hoisted(() => ({
  auth: {
    user: { id: "u-nova", created_at: new Date().toISOString(), email: "lucas@exemplo.com" } as Record<string, unknown> | null,
    isSubscribed: false,
  },
  sets: [] as Array<[string, unknown]>,
  sync: true,
}));

vi.mock("@/hooks/use-auth", () => ({
  EVENTO_RELER_ASSINATURA: "core:reler-assinatura",
  useAuth: () => ({
    ...estado.auth,
    loading: false,
    signUp: vi.fn(async () => ({ error: null, session: { user: { id: "u-nova" } } })),
    signIn: vi.fn(async () => ({ error: null })),
  }),
  useAuthOpcional: () => estado.auth,
}));
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({ set: (k: string, v: unknown) => { estado.sets.push([k, v]); }, get: (_k: string, d: unknown) => d, loaded: true, data: {} }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}), captureLandingMeta: () => ({}) }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  sincronizarAssinatura: vi.fn(async () => estado.sync),
  restaurar: vi.fn().mockResolvedValue(false),
  ultimaCompraAnualFoiTrial: () => true,
}));

import { SignupIOS, LiberandoIOS } from "./CadastroIOS";
import { iniciarMissao, CHAVE_ESTADO_MISSAO_DOSES } from "@/lib/missao-doses";

const fingirIPhone = () => {
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
};

beforeEach(() => {
  localStorage.clear();
  estado.sets = [];
  estado.sync = true;
  estado.auth.isSubscribed = false;
  fingirIPhone();
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("cadastro por e-mail no iPhone (1.0.17)", () => {
  const preencher = () => {
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "  Lucas Souza " } });
    fireEvent.change(screen.getByPlaceholderText(/melhor e-mail/i), { target: { value: "lucas@exemplo.com" } });
    fireEvent.change(screen.getByPlaceholderText(/Crie uma senha/), { target: { value: "segredo123" } });
  };

  it("grava o nome em core-user-name (a chave da saudação) e também em user-name", async () => {
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: /Salvar meu acesso/ }).closest("form")!); });
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(estado.sets).toContainEqual(["core-user-name", "Lucas Souza"]);
    expect(estado.sets).toContainEqual(["user-name", "Lucas Souza"]);
  });

  it("no sucesso o botão fica em spinner até a tela sair — não volta a 'Salvar meu acesso'", async () => {
    render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    const form = screen.getByRole("button", { name: /Salvar meu acesso/ }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });
    expect(screen.queryByRole("button", { name: /Salvar meu acesso/ })).toBeNull();
    const botao = form.querySelector('button[type="submit"]')!;
    expect(botao).toBeDisabled();
    expect(botao.getAttribute("aria-busy")).toBe("true");
    expect(botao.querySelector(".animate-spin")).not.toBeNull();
  });

  it("tocar no botão (formulário válido) não tira o foco do campo — o teclado não fecha antes da troca de tela", () => {
    render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    const botao = screen.getByRole("button", { name: /Salvar meu acesso/ });
    const md = createEvent.mouseDown(botao);
    fireEvent(botao, md);
    expect(md.defaultPrevented).toBe(true);
    // o selo do teste já mora no topo desde o 1º quadro (o espaço é dele: nada entra depois)
    expect(screen.getByText(/Teste ativado · nada cobrado hoje/)).toBeInTheDocument();
  });

  it("formulário incompleto: o toque segue normal (não segura o foco)", () => {
    render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
    const botao = screen.getByRole("button", { name: /Salvar meu acesso/ });
    const md = createEvent.mouseDown(botao);
    fireEvent(botao, md);
    expect(md.defaultPrevented).toBe(false);
  });
});

describe("Guardando seu acesso… → Home pela rota, sem recarregar (1.0.17)", () => {
  const App = () => (
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route path="/app" element={<LiberandoIOS />} />
        <Route path="/" element={<div data-testid="raiz">RAIZ</div>} />
      </Routes>
    </MemoryRouter>
  );

  it("espera a assinatura no AuthProvider E a missão nascer; aí troca de rota (sem location.href)", async () => {
    const releituras = vi.fn();
    window.addEventListener("core:reler-assinatura", releituras);
    const hrefAntes = window.location.href;
    const { rerender } = render(<App />);
    expect(screen.getByText("Guardando seu acesso…")).toBeInTheDocument();
    // o acesso foi gravado no servidor → pede a releitura na hora
    await waitFor(() => expect(releituras).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Guardando seu acesso…")).toBeInTheDocument(); // AuthProvider ainda não viu
    // AuthProvider viu a assinatura; a missão ainda não nasceu → segue em "Guardando…" (a Home não pisca)
    estado.auth.isSubscribed = true;
    rerender(<App />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("raiz")).toBeNull();
    expect(screen.getByText("Guardando seu acesso…")).toBeInTheDocument();
    // a missão nasce (MissaoDosesNaWeb, no App) → a rota troca
    await act(async () => { iniciarMissao(["financas", "rotina", "saude"]); });
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    expect(window.location.href).toBe(hrefAntes);
    window.removeEventListener("core:reler-assinatura", releituras);
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
  });

  it("conta que não vai ter missão (conta antiga): troca de rota assim que a assinatura chega", async () => {
    estado.auth.user = { id: "u-velha", created_at: new Date(Date.now() - 5 * 86400e3).toISOString() };
    estado.auth.isSubscribed = true;
    render(<App />);
    // sem a missão a tela de boas-vindas do pago aparece (não é pulada) e o Começar vai pela rota
    const comecar = await screen.findByRole("button", { name: /Começar|Bora|Entrar|Vamos/i });
    fireEvent.click(comecar);
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    estado.auth.user = { id: "u-nova", created_at: new Date().toISOString(), email: "lucas@exemplo.com" };
  });
});
