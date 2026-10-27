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
  // 1.0.17 (conta que já tinha acesso / Apple sem sessão)
  signUpErro: null as null | { message: string },
  sessao: { user: { id: "u-velha", created_at: "2026-03-01T10:00:00Z" } } as unknown,
  linhas: [] as Array<Record<string, unknown>>,
  rcAtivo: true,
  trial: true,
}));

vi.mock("@/hooks/use-auth", () => ({
  EVENTO_RELER_ASSINATURA: "core:reler-assinatura",
  useAuth: () => ({
    ...estado.auth,
    loading: false,
    signUp: vi.fn(async () => (estado.signUpErro ? { error: estado.signUpErro, session: null } : { error: null, session: { user: { id: "u-nova" } } })),
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
  ultimaCompraAnualFoiTrial: () => estado.trial,
  compraAssinaturaLocal: vi.fn(async () => estado.rcAtivo),
}));
vi.mock("@/lib/auth-nativo", () => ({ entrarComApple: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => {
  const consulta = () => {
    const q = { select: () => q, eq: () => q, in: () => Promise.resolve({ data: estado.linhas, error: null }) };
    return q;
  };
  return {
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: estado.sessao } })), resetPasswordForEmail: vi.fn(async () => ({ error: null })) },
      from: vi.fn(() => consulta()),
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

import { SignupIOS, LiberandoIOS } from "./CadastroIOS";
import { instalarTecladoIphone } from "@/test/helpers/teclado-iphone";
import { quantoSubir, topoVisivelNoCliente } from "@/hooks/use-botao-acima-do-teclado";
import { trackEvent } from "@/lib/analytics";
import { acessoAnteriorDaConta, URL_ASSINATURAS_APPLE } from "@/lib/conta-ja-tinha-acesso";
import { iniciarMissao, CHAVE_ESTADO_MISSAO_DOSES } from "@/lib/missao-doses";

const fingirIPhone = () => {
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
};

beforeEach(() => {
  localStorage.clear();
  estado.sets = [];
  estado.sync = true;
  estado.signUpErro = null;
  estado.sessao = { user: { id: "u-velha", created_at: "2026-03-01T10:00:00Z" } };
  estado.linhas = [];
  estado.rcAtivo = true;
  estado.trial = true;
  vi.mocked(trackEvent).mockClear();
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

  it("SEM INTERNET (20/10): o erro do fetch do WKWebView ('Load failed', em inglês) vira a frase em português e o botão volta a funcionar", async () => {
    estado.signUpErro = { message: "Load failed", name: "AuthRetryableFetchError" } as { message: string };
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: /Salvar meu acesso/ }).closest("form")!); });
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/Load failed/)).toBeNull();
    expect(screen.getByText(/Sem conexão com a internet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar meu acesso/ })).not.toBeDisabled();
  });

  it("formulário incompleto: o toque segue normal (não segura o foco)", () => {
    render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
    const botao = screen.getByRole("button", { name: /Salvar meu acesso/ });
    const md = createEvent.mouseDown(botao);
    fireEvent(botao, md);
    expect(md.defaultPrevented).toBe(false);
  });
});

describe("iPhone SE com o teclado de verdade (1.0.17)", () => {
  it("teclado no 'Seu nome' (339 px visíveis): o 'Salvar meu acesso' ficava meio atrás da barra do teclado — a página sobe o que falta e o campo continua à vista", () => {
    vi.useFakeTimers();
    const teclado = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 328 });
    let rolado = 0;
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(((_x: number, y: number) => { rolado += y; }) as typeof window.scrollBy);
    // as posições do print (se1-cal-texto): "Seu nome" 145–195, o botão 325–372 (com a página já rolada pelo iPhone)
    const rect = (top: number, h: number) => ({ top: top - rolado, bottom: top + h - rolado, left: 20, right: 355, width: 335, height: h, x: 20, y: top - rolado, toJSON: () => ({}) }) as DOMRect;
    const rects = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if ((this as HTMLInputElement).placeholder === "Seu nome") return rect(145, 50);
      if (this.matches('[data-testid="cadastro-ios-salvar"]')) return rect(325, 48);
      return rect(0, 0);
    });
    try {
      render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
      const nome = screen.getByPlaceholderText("Seu nome");
      teclado.abrir(nome, 0, 0);
      act(() => { vi.advanceTimersByTime(200); });
      const botao = screen.getByTestId("cadastro-ios-salvar").getBoundingClientRect();
      expect(botao.bottom).toBeLessThanOrEqual(667 - 328); // inteiro acima do teclado
      expect(nome.getBoundingClientRect().top).toBeGreaterThanOrEqual(8); // o campo segue à vista
      expect(rolado).toBeGreaterThan(0);
      // sem teclado (ou o Simulador com o teclado do Mac): nada rola
      teclado.assentar();
      const antes = rolado;
      act(() => { vi.advanceTimersByTime(200); });
      expect(rolado).toBe(antes);
    } finally {
      rects.mockRestore(); scrollBy.mockRestore(); teclado.desinstalar(); vi.useRealTimers();
    }
  });
  it("o WKWebView de verdade (sentinela no SE: vv=339@163 com scrollY=163 — a página rola JUNTO e o rect já é o da tela): o botão sobe acima do teclado mesmo assim", () => {
    vi.useFakeTimers();
    const teclado = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 328 });
    let rolado = 0;
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(((_x: number, y: number) => { rolado += y; }) as typeof window.scrollBy);
    // o rect já é o da tela depois da rolagem do iPhone (top=145 no "Seu nome", o botão 325–373)
    const rect = (top: number, h: number) => ({ top: top - rolado, bottom: top + h - rolado, left: 20, right: 355, width: 335, height: h, x: 20, y: top - rolado, toJSON: () => ({}) }) as DOMRect;
    const rects = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if ((this as HTMLInputElement).placeholder === "Seu nome") return rect(145, 48);
      if (this.matches('[data-testid="cadastro-ios-salvar"]')) return rect(325, 48);
      return rect(0, 0);
    });
    try {
      render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
      teclado.abrir(screen.getByPlaceholderText("Seu nome"), 163, 163); // a página rolou 163 E o offsetTop diz 163
      act(() => { vi.advanceTimersByTime(200); });
      expect(screen.getByTestId("cadastro-ios-salvar").getBoundingClientRect().bottom).toBeLessThanOrEqual(339);
      expect(screen.getByPlaceholderText("Seu nome").getBoundingClientRect().top).toBeGreaterThanOrEqual(8);
    } finally {
      rects.mockRestore(); scrollBy.mockRestore(); teclado.desinstalar(); vi.useRealTimers();
    }
    expect(topoVisivelNoCliente(163, 163)).toBe(0);
    expect(topoVisivelNoCliente(163, 0)).toBe(163);
    expect(topoVisivelNoCliente(0, 300)).toBe(0);
  });
  it("com o teclado e a página rolada, uma tarja da cor do fundo cobre a área do relógio (no topo da tela: top = offsetTop); sem teclado, nada", () => {
    vi.useFakeTimers();
    const teclado = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 328 });
    try {
      render(<MemoryRouter><SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} /></MemoryRouter>);
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
      teclado.abrir(screen.getByPlaceholderText("Seu nome"), 163, 163);
      const tarja = screen.getByTestId("tarja-do-relogio");
      expect(tarja.style.top).toBe("163px");
      expect(tarja.className).toMatch(/pointer-events-none/);
      teclado.soltarFoco();
      teclado.assentar();
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
    } finally { teclado.desinstalar(); vi.useRealTimers(); }
  });
  it("quantoSubir nunca empurra o campo em foco pra fora da área visível", () => {
    expect(quantoSubir(384, 339, 145, 8)).toBe(45);
    expect(quantoSubir(300, 339, 145, 8)).toBe(0);
    expect(quantoSubir(600, 339, 60, 8)).toBe(52); // faltariam 261, mas o campo só pode subir 52
  });
});

describe("Guardando seu acesso… → Home pela rota, sem recarregar (1.0.17; fluxo enxuto OFF = o de hoje)", () => {
  beforeEach(() => { localStorage.setItem("fluxo-enxuto-force", "off"); });
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

/* ------------------------------------------------------------------ 1.0.17: bugs de produção 20/10 */
describe("conta que JÁ tinha acesso comprando o teste do iPhone (1.0.17)", () => {
  const preencher = () => {
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText(/melhor e-mail/i), { target: { value: "ana@exemplo.com" } });
    fireEvent.change(screen.getByPlaceholderText(/Crie uma senha/), { target: { value: "segredo123" } });
  };
  const enviar = async () => {
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: /Salvar meu acesso/ }).closest("form")!); });
  };
  const eventos = (n: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === n).map((c) => c[1]);

  it("acessoAnteriorDaConta: vitalício da web conta; App Store não; assinatura vencida não", () => {
    const agora = Date.parse("2026-10-20T12:00:00Z");
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "lifetime", payment_method: "pix", current_period_end: null }], agora)).toBe("vitalicio");
    expect(acessoAnteriorDaConta([{ status: "active", plan: "lifetime", payment_method: "asaas" }], agora)).toBe("vitalicio");
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "monthly", payment_method: "cakto", current_period_end: "2026-11-01T00:00:00Z" }], agora)).toBe("assinatura");
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "monthly", payment_method: "cakto", current_period_end: "2026-10-01T00:00:00Z" }], agora)).toBeNull();
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "annual", payment_method: "app_store", current_period_end: "2026-10-23T00:00:00Z" }], agora)).toBeNull();
    // 27/10: a linha da Apple chega como "play_store" (revenuecat-webhook/-sync) — com o cartão recusado ela segue "active"
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "annual", payment_method: "play_store", current_period_end: "2026-10-23T00:00:00Z" }], agora)).toBeNull();
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "annual", payment_method: "play_store", revenuecat_subscription_id: "subAapXyZ123", current_period_end: "2027-10-20T00:00:00Z" }], agora)).toBeNull();
    expect(acessoAnteriorDaConta([{ status: "active", plan: "lifetime", payment_method: "play_store", revenuecat_subscription_id: "otpAabc" }], agora)).toBeNull();
    // 27/10 (revisor b52): a GOOGLE PLAY também grava "play_store" — essa conta como acesso de fora (Android + teste da Apple)
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "annual", payment_method: "play_store", revenuecat_subscription_id: "subGooAbc123", current_period_end: "2027-10-20T00:00:00Z" }], agora)).toBe("assinatura");
    expect(acessoAnteriorDaConta([{ status: "active", billing_period: "annual", payment_method: "play_store", revenuecat_subscription_id: "GPA.3344-1122-5566-77889", current_period_end: "2027-10-20T00:00:00Z" }], agora)).toBe("assinatura");
    expect(acessoAnteriorDaConta([
      { status: "active", billing_period: "annual", payment_method: "play_store", revenuecat_subscription_id: "subAapXyZ123", current_period_end: "2027-10-20T00:00:00Z" },
      { status: "active", billing_period: "lifetime", payment_method: "pix", current_period_end: null },
    ], agora)).toBe("vitalicio");
    expect(acessoAnteriorDaConta([{ status: "canceled", billing_period: "lifetime", payment_method: "pix" }], agora)).toBeNull();
    expect(acessoAnteriorDaConta(null, agora)).toBeNull();
  });

  it("vitalício da web + teste desta compra na loja → avisa 'cancele o teste na App Store' (sem bloquear: Entendi segue)", async () => {
    estado.signUpErro = { message: "User already registered" };
    estado.linhas = [{ status: "active", billing_period: "lifetime", payment_method: "pix", current_period_end: null }];
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    await enviar();
    const aviso = await screen.findByTestId("conta-ja-tinha-acesso");
    expect(aviso.textContent).toMatch(/Você já tem o CORE vitalício\./);
    expect(aviso.textContent).toMatch(/Pra não ser cobrado, cancele o teste na App Store\./);
    expect(screen.getByRole("link", { name: "Gerenciar assinatura" })).toHaveAttribute("href", URL_ASSINATURAS_APPLE);
    expect(URL_ASSINATURAS_APPLE).toBe("itms-apps://apps.apple.com/account/subscriptions");
    expect(eventos("conta_ja_tinha_acesso")).toEqual([{ tipo: "vitalicio", via: "ja_registrado", funil: "ios" }]);
    expect(onSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Gerenciar assinatura" }));
    expect(eventos("conta_ja_tinha_acesso_gerenciar")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("conta-ja-tinha-acesso")).toBeNull();
  });

  it("conta antiga SEM acesso (ou só a App Store) → segue direto, sem aviso", async () => {
    estado.signUpErro = { message: "User already registered" };
    for (const linhas of [[], [{ status: "active", billing_period: "annual", payment_method: "app_store", current_period_end: "2099-01-01T00:00:00Z" }]]) {
      estado.linhas = linhas;
      const onSession = vi.fn();
      render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
      preencher();
      await enviar();
      await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId("conta-ja-tinha-acesso")).toBeNull();
      cleanup();
    }
    expect(eventos("conta_ja_tinha_acesso")).toHaveLength(0);
  });

  it("a loja não mostra assinatura/teste desta compra → não avisa", async () => {
    estado.signUpErro = { message: "User already registered" };
    estado.linhas = [{ status: "active", billing_period: "lifetime", payment_method: "pix" }];
    estado.rcAtivo = false;
    estado.trial = false;
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    await enviar();
    await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("conta-ja-tinha-acesso")).toBeNull();
  });

  it("conta NOVA (cadastro normal) nem consulta", async () => {
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    preencher();
    await enviar();
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("conta-ja-tinha-acesso")).toBeNull();
  });
});

describe("Entrar com a Apple sem sessão (1.0.17)", () => {
  it("cancelou/falhou sem erro: registra funnel_error e diz o que fazer, na mesma tela", async () => {
    estado.sessao = null;
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Continuar com a Apple/ })); });
    expect(await screen.findByText("Não deu certo com a Apple. Tente de novo ou use o e-mail.")).toBeInTheDocument();
    expect(vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "funnel_error").map((c) => (c[1] as { where: string }).where)).toEqual(["signup_apple_sem_sessao"]);
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Continuar com a Apple/ })).not.toBeDisabled();
    expect(screen.getByPlaceholderText(/melhor e-mail/i)).toBeInTheDocument();
  });

  it("Apple entrou numa conta antiga com vitalício: o mesmo aviso", async () => {
    estado.linhas = [{ status: "active", billing_period: "lifetime", payment_method: "cakto" }];
    const onSession = vi.fn();
    render(<MemoryRouter><SignupIOS posCompra onSession={onSession} onConfirm={() => {}} /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Continuar com a Apple/ })); });
    expect(await screen.findByTestId("conta-ja-tinha-acesso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(onSession).toHaveBeenCalledTimes(1);
  });
});

describe("FLUXO ENXUTO (1.0.21): compra → cadastro → Parabéns → Home", () => {
  // o padrão de verdade do iPhone ("on") — o setup da suíte deixa "off" pros testes do fluxo de antes
  const G = globalThis as { __FLUXO_ENXUTO_PADRAO_APP__?: string };
  let antes: string | undefined;
  beforeEach(() => { antes = G.__FLUXO_ENXUTO_PADRAO_APP__; delete G.__FLUXO_ENXUTO_PADRAO_APP__; });
  afterEach(() => { G.__FLUXO_ENXUTO_PADRAO_APP__ = antes; });
  const App = () => (
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route path="/app" element={<LiberandoIOS />} />
        <Route path="/" element={<div data-testid="raiz">RAIZ</div>} />
      </Routes>
    </MemoryRouter>
  );

  it("no iPhone o padrão é ligado: a Parabéns aparece JÁ (sem 'Guardando…' antes, sem BoasVindasPago)", async () => {
    render(<App />);
    expect(screen.getByTestId("tela-parabens")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Parabéns/ })).toBeInTheDocument();
    expect(screen.queryByText("Guardando seu acesso…")).toBeNull();
    expect(eventosDe("parabens_view")).toHaveLength(1);
    await act(async () => { await Promise.resolve(); });
  });

  it("Entrar antes do acesso: espera em 'Guardando…'; com assinatura + missão, troca de rota sem recarregar", async () => {
    const hrefAntes = window.location.href;
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByTestId("parabens-entrar"));
    expect(eventosDe("parabens_entrar")).toHaveLength(1);
    expect(localStorage.getItem("core-boas-vindas-visto")).toBe("1"); // a BoasVindasPago não volta na abertura
    expect(screen.getByText("Guardando seu acesso…")).toBeInTheDocument();
    estado.auth.isSubscribed = true;
    rerender(<App />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("raiz")).toBeNull();
    await act(async () => { iniciarMissao(["financas", "rotina", "saude"]); });
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    expect(window.location.href).toBe(hrefAntes);
    expect(vi.mocked(trackEvent).mock.calls.some((c) => c[0] === "app_pos_compra_home" && (c[1] as { via?: string }).via === "rota")).toBe(true);
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
  });

  it("acesso já pronto: Entrar vai direto pra Home (a Parabéns fica até a rota trocar; o 'Guardando…' não pisca)", async () => {
    estado.auth.isSubscribed = true;
    await act(async () => { iniciarMissao(["financas", "rotina", "saude"]); });
    render(<App />);
    await waitFor(() => expect(vi.mocked(trackEvent).mock.calls.some((c) => c[0] === "app_pos_compra_liberado")).toBe(true));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByTestId("parabens-entrar"));
    expect(screen.queryByText("Guardando seu acesso…")).toBeNull();
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
  });

  it("?fluxo-enxuto=off (rollback): volta o 'Guardando…' e nada de Parabéns", () => {
    localStorage.setItem("fluxo-enxuto-force", "off");
    render(<App />);
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
    expect(screen.getByText("Guardando seu acesso…")).toBeInTheDocument();
  });
});
const eventosDe = (n: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === n);

/* 1.0.21 — MODO 1.0.12 (lib/modo-1012): compra → cadastro → a BOAS-VINDAS DA 1.0.12 ("Pronto, Nome." + círculo magenta +
 * confete + "Começar") → Home, onde o convite da missão aparece. Mesmo com a missão em doses vindo (antes ela era
 * PULADA por pulaPelaMissao) e mesmo com o enxuto ligado (no lugar da TelaParabens). */
describe("MODO 1.0.12: compra → cadastro → boas-vindas da 1.0.12 → Home", () => {
  const G = globalThis as { __FLUXO_ENXUTO_PADRAO_APP__?: string; __MODO_1012__?: unknown };
  let antes: string | undefined;
  beforeEach(() => { antes = G.__FLUXO_ENXUTO_PADRAO_APP__; delete G.__FLUXO_ENXUTO_PADRAO_APP__; G.__MODO_1012__ = true; });
  afterEach(() => { G.__FLUXO_ENXUTO_PADRAO_APP__ = antes; delete G.__MODO_1012__; });
  const App = () => (
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route path="/app" element={<LiberandoIOS />} />
        <Route path="/" element={<div data-testid="raiz">RAIZ</div>} />
      </Routes>
    </MemoryRouter>
  );

  it("a boas-vindas da 1.0.12 aparece JÁ (nunca pulada pela missão), sem TelaParabens e sem 'Tá dentro'", async () => {
    render(<App />);
    expect(screen.getByTestId("boas-vindas-pago")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Pronto/ })).toBeInTheDocument();
    expect(screen.getByText(/O CORE inteiro é seu/)).toBeInTheDocument();
    expect(screen.getByTestId("boas-vindas-comecar")).toHaveTextContent("Começar");
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
    expect(screen.queryByText(/Tá dentro/)).toBeNull();
    expect(eventosDe("parabens_view")).toHaveLength(0);
    expect(vi.mocked(trackEvent).mock.calls.some((c) => c[0] === "boas_vindas_pago_seguiu" && (c[1] as { pulada?: boolean }).pulada)).toBe(false);
    await act(async () => { await Promise.resolve(); });
  });

  it("Começar antes do acesso: 'Guardando…'; com assinatura + missão, troca de rota sem recarregar; a marca de visto fica gravada", async () => {
    const hrefAntes = window.location.href;
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByTestId("boas-vindas-comecar"));
    expect(localStorage.getItem("core-boas-vindas-visto")).toBe("1");
    expect(eventosDe("boas_vindas_1012_comecar")).toHaveLength(1);
    expect(await screen.findByText("Guardando seu acesso…")).toBeInTheDocument();
    estado.auth.isSubscribed = true;
    rerender(<App />);
    await act(async () => { iniciarMissao(["financas", "rotina", "saude"]); });
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    expect(window.location.href).toBe(hrefAntes);
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
  });

  it("acesso já pronto: Começar vai direto pra Home, sem a boas-vindas reaparecer nem o 'Guardando…'", async () => {
    estado.auth.isSubscribed = true;
    await act(async () => { iniciarMissao(["financas", "rotina", "saude"]); });
    render(<App />);
    await waitFor(() => expect(vi.mocked(trackEvent).mock.calls.some((c) => c[0] === "app_pos_compra_liberado")).toBe(true));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByTestId("boas-vindas-comecar"));
    expect(screen.queryByText("Guardando seu acesso…")).toBeNull();
    expect(await screen.findByTestId("raiz")).toBeInTheDocument();
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
  });

  it("o rollback remoto do enxuto (`fluxo_enxuto: off`) não muda o modo 1.0.12", () => {
    localStorage.setItem("core-fluxo-enxuto", "off");
    render(<App />);
    expect(screen.getByTestId("boas-vindas-pago")).toBeInTheDocument();
  });
});
