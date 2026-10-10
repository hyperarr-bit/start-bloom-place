/**
 * PORTA iPHONE (/comece, 10/10) — anúncio → perguntas → plano → CONTA NO SITE
 * (campanha gravada nela) → App Store → "Já tenho conta? Entrar" no app.
 *
 * O que não pode quebrar:
 *   · o fluxo inteiro por área (dinheiro e rotina), CTA sempre o mesmo botão;
 *   · o app nativo NUNCA monta /comece;
 *   · a atribuição é capturada na 1ª carga e sobrevive ao Instagram zerar o storage;
 *   · user_metadata.porta só é gravado se AUSENTE (nunca sobrescreve a 1ª atribuição);
 *   · nenhum "R$" em tela nenhuma; "dias grátis" só na tela 7;
 *   · os eventos saem com os campos certos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
type U = { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean } = { user: null, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getUser = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      signInWithOtp: (...a: unknown[]) => signInWithOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: vi.fn(async () => ({ error: null })) }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { entrarComGoogle } from "@/lib/auth-nativo";
import PortaIphoneRota, { _zerarEstadoPorta } from "@/pages/porta/PortaIphone";
import { _zerarMemoriaPorta, capturarAtribuicao, decidirGravacao, lerAtribuicao, sessaoDaPorta, CHAVE_ATTR, COOKIE_ATTR } from "@/pages/porta/atribuicao";
import { planoDe3Dias, PERGUNTA_3_OPCOES } from "@/pages/porta/conteudo";

/* ---------------------------------------------------------------- ambiente */
const UA = {
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 390.0.0.28.85 (iPhone15,3; iOS 18_5; pt_BR; pt; scale=3.00; 1290x2796; 721384054)",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15",
};
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const QUERY_AD = "?utm_source=meta&utm_medium=paid&utm_campaign=porta_teste&utm_content=video_organizei&utm_term=t1&c_id=111&as_id=222&ad_id=333&pl=Instagram_Reels&fbclid=IwAR_abc";
const irPara = (url: string) => window.history.replaceState({}, "", url);
const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};
const limparCookies = () => {
  for (const c of document.cookie.split(";")) {
    const n = c.split("=")[0].trim();
    if (n) document.cookie = `${n}=; Max-Age=0; Path=/`;
  }
};
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}</p>; };
const montar = () => render(
  <MemoryRouter initialEntries={["/comece"]}>
    <Routes>
      <Route path="/comece" element={<PortaIphoneRota />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const texto = () => document.body.textContent ?? "";
/** a cada tela: sem preço; "dias grátis" só na tela 7 */
const conferirCopy = () => {
  expect(texto()).not.toMatch(/R\$/);
  const naSete = !!screen.queryByTestId("porta-salvo");
  if (!naSete) expect(texto()).not.toMatch(/dias? grátis/i);
};
const escolher = async (id: string, proxima: string) => {
  fireEvent.click(screen.getByTestId(`porta-opcao-${id}`));
  await waitFor(() => expect(screen.getByTestId(proxima)).toBeInTheDocument());
  conferirCopy();
};

const usuario = (over: Partial<U> = {}): U => ({ id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {}, ...over });

beforeEach(() => {
  _zerarMemoriaPorta();
  _zerarEstadoPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  limparCookies();
  nativo(false);
  authState.user = null;
  authState.loading = false;
  [getUser, signInWithOtp, verifyOtp, updateUser, signOut].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  vi.mocked(entrarComGoogle).mockClear();
  updateUser.mockResolvedValue({ data: {}, error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement["play"];
  ua(UA.instagram);
  irPara(`/comece${QUERY_AD}`);
});
afterEach(() => { cleanup(); nativo(false); irPara("/"); });

/* ---------------------------------------------------------------- testes */
describe("rota", () => {
  it("o app nativo NUNCA monta /comece (vai pra porta do app)", () => {
    nativo(true);
    montar();
    expect(screen.getByTestId("onde").textContent).toBe("/app");
    expect(screen.queryByTestId("porta-welcome")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("App.tsx: /comece só na web (SoNaWeb) e o paywall global não monta por cima", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    const banner = readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8");
    expect(banner).toContain('location.pathname.startsWith("/comece")');
  });

  it("noindex enquanto a Porta está montada", () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-porta]')?.getAttribute("content")).toMatch(/noindex/);
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-porta]')).toBeNull();
  });
});

describe("fluxo inteiro — DINHEIRO, no Instagram do iPhone, conta nova por e-mail", () => {
  it("8 telas, conta criada com a campanha, CompleteRegistration com o eventID guardado, loja e volta da aba", async () => {
    montar();
    // 0. welcome
    expect(screen.getByTestId("porta-welcome-titulo").textContent).toBe("Sua vida inteira organizada num app só.");
    expect(texto()).toContain("+1000 pessoas");
    expect(screen.getByTestId("porta-welcome-entrar").textContent).toBe("Já tem conta? Entrar");
    expect(texto()).not.toMatch(/Restaurar|Termos/);
    conferirCopy();
    const view = eventos("porta_view")[0];
    expect(view).toMatchObject({ utm_source: "meta", utm_medium: "paid", utm_campaign: "porta_teste", utm_content: "video_organizei", utm_term: "t1", c_id: "111", as_id: "222", ad_id: "333", pl: "Instagram_Reels", fbclid: "IwAR_abc", atribuicao: "url", in_app: true, plataforma: "ios" });
    expect(String(view.fbc)).toMatch(/^fb\.1\.\d{13}\.IwAR_abc$/);
    expect(typeof view.ts).toBe("number");
    expect(String(view.porta_session_id)).toMatch(/.{8,}/);
    expect(fireMetaEvent).toHaveBeenCalledWith("ViewContent", expect.objectContaining({ content_name: "porta_iphone" }));

    fireEvent.click(screen.getByTestId("porta-comecar"));
    // 1. área
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que você quer arrumar primeiro?");
    for (const id of ["dinheiro", "rotina", "corpo", "saude", "metas", "tudo"]) expect(screen.getByTestId(`porta-opcao-${id}`)).toBeInTheDocument();
    conferirCopy();
    await escolher("dinheiro", "porta-p2");
    // 2.
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("Você sabe quanto sobra no fim do mês?");
    await escolher("nao_sei", "porta-p3");
    // 3.
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que mais te atrapalha?");
    await escolher("gasto_pequeno", "porta-comsem");
    // 4. com × sem: gráfico, sem reais
    expect(screen.getByTestId("porta-comsem").getAttribute("data-tipo")).toBe("dinheiro");
    expect(screen.getByTestId("porta-grafico")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("porta-comsem-cta"));
    // 5. plano: Dia 1 da resposta 3, dias 2 e 3 trancados
    await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
    conferirCopy();
    expect(screen.getByTestId("porta-plano-dia1").textContent).toContain("Anota os gastos pequenos de hoje e vê quanto somam");
    expect(screen.getByTestId("porta-plano-dia2").hasAttribute("data-trancado")).toBe(true);
    expect(screen.getByTestId("porta-plano-dia3").hasAttribute("data-trancado")).toBe(true);
    expect(screen.getByTestId("porta-desbloquear").textContent).toBe("Desbloquear meu plano");
    fireEvent.click(screen.getByTestId("porta-desbloquear"));
    // 6. conta: no Instagram o Google some (o Google barra login em webview)
    await waitFor(() => expect(screen.getByTestId("porta-conta")).toBeInTheDocument());
    conferirCopy();
    expect(screen.queryByTestId("porta-google")).toBeNull();
    expect((screen.getByTestId("porta-enviar-codigo") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId("porta-email"), { target: { value: " Ana@Exemplo.com " } });

    let portaEnviada: Record<string, unknown> | null = null;
    signInWithOtp.mockImplementation(async (arg: { options: { data: { porta: Record<string, unknown> } } }) => { portaEnviada = arg.options.data.porta; return { error: null }; });
    fireEvent.click(screen.getByTestId("porta-enviar-codigo"));
    await waitFor(() => expect(screen.getByTestId("porta-codigo")).toBeInTheDocument());
    const otp = signInWithOtp.mock.calls[0][0] as { email: string; options: { shouldCreateUser: boolean; emailRedirectTo: string; data: { porta: Record<string, any> } } };
    expect(otp.email).toBe("ana@exemplo.com");
    expect(otp.options.shouldCreateUser).toBe(true);
    expect(otp.options.emailRedirectTo).toContain("/auth/callback?next=%2Fcomece%3Fpasso%3Dsalvo");
    const porta = otp.options.data.porta;
    expect(porta.attr).toMatchObject({ utm_campaign: "porta_teste", utm_content: "video_organizei", c_id: "111", as_id: "222", ad_id: "333", pl: "Instagram_Reels", fbclid: "IwAR_abc", origem: "url" });
    expect(porta.attr.fbc).toMatch(/^fb\.1\.\d+\.IwAR_abc$/);
    expect(porta.respostas).toEqual({ area: "dinheiro", rota: "dinheiro", p2: "nao_sei", p3: "gasto_pequeno" });
    expect(porta.event_id).toMatch(/^porta_cr_/);
    expect(porta.porta_session_id).toBe(view.porta_session_id);
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "email", ad_id: "333", porta_session_id: view.porta_session_id });

    // a conta nasceu agora, com o `data` desta sessão
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: usuario({ user_metadata: { porta: portaEnviada } }) } });
    fireEvent.change(screen.getByTestId("porta-codigo"), { target: { value: "1234-5678" } });
    fireEvent.click(screen.getByTestId("porta-conferir"));
    // 7. pronto
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(verifyOtp).toHaveBeenCalledWith({ email: "ana@exemplo.com", token: "12345678", type: "email" });
    expect(updateUser).not.toHaveBeenCalled(); // já veio no signInWithOtp: nada a regravar
    expect(fireMetaEvent).toHaveBeenCalledWith("CompleteRegistration", expect.objectContaining({ content_name: "porta_iphone" }), porta.event_id);
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "email", existente: false, event_id: porta.event_id, gravou: false, ad_id: "333" });
    conferirCopy();
    expect(screen.getByTestId("porta-salvo-titulo").textContent).toBe("Pronto, seu plano está salvo ✓");
    expect(screen.getByTestId("porta-salvo-email").textContent).toContain("ana@exemplo.com");
    expect(screen.getByTestId("porta-salvo-texto").textContent).toBe("Baixe o CORE, toque em “Entrar” com este e-mail e comece seus 3 dias grátis.");
    expect(screen.getByTestId("porta-passo-2").querySelector("img")?.getAttribute("src")).toBe("/como-entrar/1-tela-inicial-ios.jpg");
    expect(screen.getByTestId("porta-passo-3").querySelector("img")?.getAttribute("src")).toBe("/como-entrar/2-entrar-ios.jpg");
    const loja = screen.getByTestId("porta-loja");
    expect(loja.getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei");
    expect(loja.textContent).toContain("Baixar na App Store");

    fireEvent.click(loja);
    expect(trackEventBeacon).toHaveBeenCalledWith("porta_loja_click", expect.objectContaining({ plataforma: "ios", loja: "ios", ad_id: "333", porta_session_id: view.porta_session_id }));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("porta-salvo-titulo").textContent).toBe("Já instalou? Abra o CORE e toque em Entrar");
    expect(eventos("porta_voltou_aba")).toHaveLength(1);

    // os passos, na ordem, com área e resposta
    expect(eventos("porta_passo").map((e) => [e.passo, e.area, e.resposta])).toEqual([
      ["welcome", null, "comecar"],
      ["area", "dinheiro", "dinheiro"],
      ["p2", "dinheiro", "nao_sei"],
      ["p3", "dinheiro", "gasto_pequeno"],
      ["comsem", "dinheiro", "seguir"],
      ["plano", "dinheiro", "desbloquear"],
    ]);
    for (const e of eventos("porta_passo")) expect(e.porta_session_id).toBe(view.porta_session_id);
  });

  it("'Tudo' segue pela rota do dinheiro", async () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("tudo", "porta-p2");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("Você sabe quanto sobra no fim do mês?");
    expect(eventos("porta_passo").at(-1)).toMatchObject({ passo: "area", area: "tudo", resposta: "tudo" });
  });
});

describe("fluxo inteiro — ROTINA, no Safari, conta pelo Google", () => {
  it("copy no com × sem, Dia 1 da rotina, Google sai e volta pra tela 7 com a porta gravada", async () => {
    ua(UA.safari);
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("rotina", "porta-p2");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("Quantos dias por semana você consegue manter uma rotina?");
    await escolher("1-2", "porta-p3");
    expect(screen.getByTestId("porta-opcao-largo_no_meio")).toBeInTheDocument();
    await escolher("largo_no_meio", "porta-comsem");
    expect(screen.getByTestId("porta-comsem").getAttribute("data-tipo")).toBe("copy");
    expect(screen.getByTestId("porta-card-sem")).toBeInTheDocument();
    expect(screen.getByTestId("porta-card-com")).toBeInTheDocument();
    expect(screen.queryByTestId("porta-grafico")).toBeNull();
    fireEvent.click(screen.getByTestId("porta-comsem-cta"));
    await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
    expect(screen.getByTestId("porta-plano-dia1").textContent).toContain("Escolhe 1 hábito só e marca feito hoje");
    conferirCopy();
    fireEvent.click(screen.getByTestId("porta-desbloquear"));
    await waitFor(() => expect(screen.getByTestId("porta-google")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("porta-google"));
    await waitFor(() => expect(entrarComGoogle).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem("core-auth-next")).toBe("/comece?passo=voltou");
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "google" });
    cleanup();

    // a volta do OAuth: página NOVA (/auth/callback → /comece?passo=voltou), Instagram não, Safari mantém o storage
    _zerarMemoriaPorta();
    _zerarEstadoPorta();
    irPara("/comece?passo=voltou");
    const u = usuario({ email: "rotina@gmail.com", user_metadata: { full_name: "Ana" } });
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    montar();
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    const gravada = (updateUser.mock.calls[0][0] as { data: { porta: Record<string, any> } }).data.porta;
    expect(gravada.attr).toMatchObject({ utm_campaign: "porta_teste", ad_id: "333", fbclid: "IwAR_abc" }); // a campanha da 1ª carga, relida do storage
    expect(gravada.respostas).toEqual({ area: "rotina", rota: "rotina", p2: "1-2", p3: "largo_no_meio" });
    expect(gravada.metodo).toBe("google");
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "google", existente: false, gravou: true });
    expect(fireMetaEvent).toHaveBeenCalledWith("CompleteRegistration", expect.anything(), gravada.event_id);
    expect(screen.getByTestId("porta-salvo-email").textContent).toContain("rotina@gmail.com");
    expect(screen.getByTestId("porta-passo-3").textContent).toContain("Continuar com Google");
  });
});

describe("conta que já existe e metadata só se ausente", () => {
  const chegarNaConta = async () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("metas", "porta-p2");
    await escolher("nenhuma", "porta-p3");
    await escolher("na_cabeca", "porta-comsem");
    fireEvent.click(screen.getByTestId("porta-comsem-cta"));
    await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("porta-desbloquear"));
    await waitFor(() => expect(screen.getByTestId("porta-conta")).toBeInTheDocument());
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    fireEvent.change(screen.getByTestId("porta-email"), { target: { value: "velha@exemplo.com" } });
    fireEvent.click(screen.getByTestId("porta-enviar-codigo"));
    await waitFor(() => expect(screen.getByTestId("porta-codigo")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("porta-codigo"), { target: { value: "87654321" } });
  };

  it("conta antiga SEM porta: entra, grava a porta (updateUser), existente:true, sem CompleteRegistration", async () => {
    await chegarNaConta();
    getUser.mockResolvedValue({ data: { user: usuario({ email: "velha@exemplo.com", created_at: "2025-01-01T00:00:00Z", user_metadata: { full_name: "Bia" } }) } });
    fireEvent.click(screen.getByTestId("porta-conferir"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect((updateUser.mock.calls[0][0] as { data: { porta: { respostas: unknown } } }).data.porta.respostas).toEqual({ area: "metas", rota: "metas", p2: "nenhuma", p3: "na_cabeca" });
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "email", existente: true, gravou: true });
    expect(fireMetaEvent).not.toHaveBeenCalledWith("CompleteRegistration", expect.anything(), expect.anything());
  });

  it("conta que JÁ tem porta (de outra visita): NUNCA sobrescreve a 1ª atribuição", async () => {
    await chegarNaConta();
    const antiga = { v: 1, porta_session_id: "outra-sessao", event_id: "porta_cr_antigo", attr: { ad_id: "999" } };
    getUser.mockResolvedValue({ data: { user: usuario({ email: "velha@exemplo.com", created_at: "2026-09-01T00:00:00Z", user_metadata: { porta: antiga } }) } });
    fireEvent.click(screen.getByTestId("porta-conferir"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).not.toHaveBeenCalled();
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ existente: true, gravou: false, event_id: "porta_cr_antigo" });
  });

  it("decidirGravacao: mesma sessão = conta nova; outra sessão = intocada; ausente = grava", () => {
    const agora = Date.parse("2026-10-10T12:00:00Z");
    expect(decidirGravacao({ created_at: "2026-10-10T11:58:00Z", user_metadata: { porta: { porta_session_id: "s1" } } }, "s1", agora)).toEqual({ gravar: false, existente: false });
    expect(decidirGravacao({ created_at: "2026-10-10T11:58:00Z", user_metadata: { porta: { porta_session_id: "s0" } } }, "s1", agora)).toEqual({ gravar: false, existente: true });
    expect(decidirGravacao({ created_at: "2026-10-10T11:58:00Z", user_metadata: {} }, "s1", agora)).toEqual({ gravar: true, existente: false });
    expect(decidirGravacao({ created_at: "2024-01-01T00:00:00Z", user_metadata: null }, "s1", agora)).toEqual({ gravar: true, existente: true });
  });

  it("já logado neste navegador: 'Salvar nesta conta' grava sem pedir e-mail", async () => {
    const u = usuario({ email: "logada@exemplo.com", created_at: "2025-05-05T00:00:00Z" });
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("saude", "porta-p2");
    await escolher("um_falha", "porta-p3");
    await escolher("agua", "porta-comsem");
    fireEvent.click(screen.getByTestId("porta-comsem-cta"));
    await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("porta-desbloquear"));
    await waitFor(() => expect(screen.getByTestId("porta-conta-email-logado").textContent).toBe("logada@exemplo.com"));
    fireEvent.click(screen.getByTestId("porta-salvar-nesta-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "sessao" });
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "sessao", existente: true });
  });
});

describe("atribuição à prova do Instagram", () => {
  it("captura na 1ª carga e persiste em localStorage, sessionStorage, cookie próprio e memória", () => {
    const a = capturarAtribuicao({ search: QUERY_AD, cookie: "_fbp=fb.1.1700000000000.123456", agora: 1_791_000_000_000, caminho: "/comece" });
    expect(a).toMatchObject({ utm_source: "meta", ad_id: "333", fbclid: "IwAR_abc", fbc: "fb.1.1791000000000.IwAR_abc", fbp: "fb.1.1700000000000.123456", ts: 1_791_000_000_000, origem: "url" });
    expect(JSON.parse(localStorage.getItem(CHAVE_ATTR)!).ad_id).toBe("333");
    expect(JSON.parse(sessionStorage.getItem(CHAVE_ATTR)!).ad_id).toBe("333");
    expect(document.cookie).toContain(`${COOKIE_ATTR}=`);
  });

  it("o Instagram zera storage e cookies com a página viva: a memória re-semeia e a campanha não se perde", () => {
    capturarAtribuicao({ search: QUERY_AD, agora: 1_791_000_000_000 });
    const s1 = sessaoDaPorta();
    localStorage.clear(); sessionStorage.clear(); limparCookies();
    const relida = capturarAtribuicao({ search: "" }); // a próxima leitura (ex.: na hora de gravar a conta)
    expect(relida).toMatchObject({ ad_id: "333", utm_campaign: "porta_teste", fbclid: "IwAR_abc", origem: "url" });
    expect(JSON.parse(localStorage.getItem(CHAVE_ATTR)!).ad_id).toBe("333"); // re-semeado
    expect(sessaoDaPorta()).toEqual({ id: s1.id, nova: false }); // mesma sessão
    expect(lerAtribuicao()?.ad_id).toBe("333");
  });

  it("sem nada na URL nem guardado: o fbclid do cookie _fbc (< 7 dias) liga ao anúncio", () => {
    const agora = 1_791_000_000_000;
    const a = capturarAtribuicao({ search: "", cookie: `_fbc=fb.1.${agora - 3_600_000}.IwAR_velho`, agora });
    expect(a).toMatchObject({ fbclid: "IwAR_velho", fbc: `fb.1.${agora - 3_600_000}.IwAR_velho`, origem: "cookie_fbc" });
  });

  it("o mesmo clique relido numa página nova mantém a hora e o fbc da 1ª carga", () => {
    const a = capturarAtribuicao({ search: QUERY_AD, agora: 1_791_000_000_000 });
    _zerarMemoriaPorta();
    const b = capturarAtribuicao({ search: QUERY_AD, agora: 1_791_000_999_000 });
    expect(b.fbc).toBe(a.fbc);
    expect(b.ts).toBe(a.ts);
  });

  it("porta_view sai uma vez por sessão (remontar não repete)", () => {
    montar();
    cleanup();
    montar();
    expect(eventos("porta_view")).toHaveLength(1);
  });
});

describe("tela 7 por aparelho", () => {
  const naSete = (email = "ana@exemplo.com", metodo = "email") => {
    localStorage.setItem("porta-estado-v1", JSON.stringify({ passo: "salvo", escolha: "dinheiro", p2: "sei", p3: "cartao", eventId: "porta_cr_x", metodo, email }));
    montar();
  };

  it("Android: Google Play pelo /baixar, sem prometer teste grátis (no Android não há)", () => {
    ua(UA.android);
    naSete();
    expect(screen.getByTestId("porta-loja").textContent).toContain("Google Play");
    expect(screen.getByTestId("porta-loja").getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei");
    expect(texto()).not.toMatch(/grátis/);
    expect(screen.getByTestId("porta-passo-2").querySelector("img")?.getAttribute("src")).toBe("/como-entrar/1-tela-inicial-android.jpg");
  });

  it("computador: QR do /baixar, 'também no computador' e as duas lojas", () => {
    ua(UA.mac);
    naSete();
    expect(screen.getByTestId("porta-qr").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("porta-salvo-computador").textContent).toBe("No computador você também usa: entre em coreaplicativo.com.br");
    expect(screen.getByTestId("porta-loja").getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=ios");
    expect(screen.getByTestId("porta-loja-android").getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=android");
    expect(texto()).not.toMatch(/R\$/);
  });
});

describe("conteúdo", () => {
  it("o plano nunca repete o Dia 1 nos dias 2 e 3", () => {
    for (const [rota, ops] of Object.entries(PERGUNTA_3_OPCOES)) {
      for (const o of ops) {
        const p = planoDe3Dias(rota as keyof typeof PERGUNTA_3_OPCOES, o.id);
        expect(p.dia1).toBe(o.dia1);
        expect(new Set([p.dia1, p.dia2, p.dia3]).size).toBe(3);
      }
    }
  });
});
