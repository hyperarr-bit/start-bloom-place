/**
 * A DEMO QUE VENDE (/liberar, 16/10): a demo do /experimente + o paywall/Pix do /assinar.
 *
 * O que não pode quebrar:
 *   · topo/pílulas/folha/fim iguais ao /experimente, com "Liberar meu CORE" no lugar de "Criar conta";
 *   · TODA entrada (topo, faixa, folha, fim, seta ← do módulo, saída do módulo) abre o PAYWALL do /assinar
 *     (anual 97,90 · 8,16/mês · "Pagar com Pix"); sem os links da Cakto não há cartão nem mensal;
 *   · a folha aparece 1x por sessão (30 s ou 2ª troca de módulo) e não bloqueia;
 *   · nome + e-mail → conta pelo caminho do /assinar (user_metadata.venda com variante "demo") → Pix → sucesso;
 *     quem já é assinante não paga de novo;
 *   · o que ELA criou na demo vai pra conta (exemplo nunca);
 *   · eventos com variante "demo"; ViewContent 1x por sessão; InitiateCheckout como no /assinar;
 *   · nunca "sem cartão"; /assinar e /experimente com as mesmas rotas de antes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
type U = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const invoke = vi.fn();
const lerUserData = vi.fn();
const upsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signInWithOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ in: (...a: unknown[]) => lerUserData(...a), limit: () => Promise.resolve({ data: [] }) }) }),
      upsert: (...a: unknown[]) => upsert(...a),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
const definirEmailDaCompra = vi.fn();
vi.mock("@/lib/sessao-anonima", () => ({
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: vi.fn(async () => {}),
  limparBatismo: vi.fn(),
}));
vi.mock("@/pages/venda/navegar", () => ({ irProCakto: vi.fn() }));
vi.mock("@/pages/Index", async () => ({ default: (await import("./experimente-modulos-falsos")).FinancasFalsa }));
vi.mock("@/pages/Rotina", async () => ({ default: (await import("./experimente-modulos-falsos")).RotinaFalsa }));
vi.mock("@/pages/Treino", async () => ({ default: (await import("./experimente-modulos-falsos")).TreinoFalso }));
vi.mock("@/pages/Saude", async () => ({ default: (await import("./experimente-modulos-falsos")).SaudeFalsa }));
vi.mock("@/pages/Dieta", async () => ({ default: (await import("./experimente-modulos-falsos")).DietaFalsa }));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePixPurchaseOnce } from "@/lib/purchase-tracking";
import { irProCakto } from "@/pages/venda/navegar";
import LiberarRota, { _zerarEstadoLiberar, passoValido } from "@/pages/liberar/Liberar";
import { BOTAO_LIBERAR, FOLHA_TITULO_LIBERAR, contextoDoPaywall, moduloMaisUsado } from "@/pages/liberar/conteudo";
import { _zerarSessaoVenda } from "@/pages/venda/rastreio";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { ehCaminhoDeDemo } from "@/lib/caminho-demo";
import { desvioNaDemo } from "@/pages/experimente/navegacao";

/* ---------------------------------------------------------------- ambiente */
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const QUERY_AD = "utm_source=meta&utm_medium=paid&utm_campaign=liberar&utm_content=video1&c_id=111&as_id=222&ad_id=333&fbclid=IwAR_lib";
const irPara = (url: string) => window.history.replaceState({}, "", url);
const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };
let local = { search: "" };
const Local = () => { const l = useLocation(); local = { search: l.search }; return null; };
const montar = (query = `m=financas&${QUERY_AD}`) => {
  irPara(`/liberar?${query}`);
  return render(
    <MemoryRouter initialEntries={[`/liberar?${query}`]}>
      <Local />
      <Routes>
        <Route path="/liberar" element={<LiberarRota />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );
};
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const metas = (nome: string) => vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === nome);
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> } | undefined)?.body ?? {});
const pagina = () => screen.getByTestId("liberar");
const passo = () => pagina().getAttribute("data-passo");
const texto = () => document.body.textContent ?? "";
const semCartao = () => expect(texto()).not.toMatch(/sem cart[aã]o/i);
const tocar = (testid: string) => { const el = screen.getByTestId(testid); act(() => { fireEvent.pointerDown(el); fireEvent.click(el); }); };
const noModulo = async (m: string, falso: string) => {
  await waitFor(() => expect(pagina().getAttribute("data-modulo")).toBe(m));
  await screen.findByTestId(falso);
};
const preencher = (nome: string, email: string) => {
  fireEvent.change(screen.getByTestId("venda-nome"), { target: { value: nome } });
  fireEvent.change(screen.getByTestId("venda-email"), { target: { value: email } });
};
const PIX_OK = { orderId: "qr_456", qrCode: "00020126580014br.gov.bcb.pix0136chave-pix-teste5204000053039865406" + "97.905802BR", qrCodeBase64: null, expiresAt: null };

beforeEach(() => {
  _zerarEstadoLiberar();
  _zerarSessaoVenda();
  _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  nativo(false);
  authState.user = null; authState.loading = false; authState.isSubscribed = false;
  [getSession, getUser, updateUser, signOut, signUp, signInWithPassword, invoke, definirEmailDaCompra, lerUserData, upsert].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear(); vi.mocked(fireMetaEvent).mockClear(); vi.mocked(firePixPurchaseOnce).mockClear(); vi.mocked(irProCakto).mockClear();
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "ana@exemplo.com", user_metadata: {} } } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  invoke.mockResolvedValue({ data: null, error: null });
  lerUserData.mockResolvedValue({ data: [], error: null });
  upsert.mockResolvedValue({ error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  ua(UA_IPHONE);
  // a configuração de hoje: sem os links da Cakto (só Pix)
  vi.stubEnv("VITE_VENDA_CAKTO_ANUAL", "");
  vi.stubEnv("VITE_VENDA_CAKTO_MENSAL", "");
});
afterEach(() => { cleanup(); nativo(false); irPara("/"); vi.useRealTimers(); vi.unstubAllEnvs(); });

/* ---------------------------------------------------------------- rota */
describe("rota", () => {
  it("o app nativo NUNCA monta /liberar", () => {
    nativo(true);
    montar();
    expect(screen.getByTestId("onde").textContent).toBe("/app");
  });

  it("App.tsx: /liberar só na web; /assinar e /experimente com as MESMAS linhas; o banner do teste não monta por cima", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/liberar" element={<SoNaWeb><RouteErrorBoundary routeName="liberar"><Liberar /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/experimente" element={<SoNaWeb><RouteErrorBoundary routeName="experimente"><Experimente /></RouteErrorBoundary></SoNaWeb>} />');
    expect(readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8")).toContain('location.pathname.startsWith("/liberar")');
  });

  it("os módulos tratam /liberar como demonstração; a navegação presa deixa o /liberar passar", () => {
    expect(ehCaminhoDeDemo("/liberar")).toBe(true);
    expect(ehCaminhoDeDemo("/liberarx")).toBe(false);
    expect(desvioNaDemo("/liberar?m=financas&passo=paywall")).toBeNull();
    expect(desvioNaDemo("/experimente?passo=conta")).toBeNull();
    expect(desvioNaDemo("/auth")).toEqual({ tipo: "conta", destino: "/auth" });
  });

  it("noindex enquanto montado; ViewContent 1x por sessão (pixel + CAPI, mesmo event_id do /assinar)", async () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-liberar]')?.getAttribute("content")).toMatch(/noindex/);
    const vc = metas("ViewContent");
    expect(vc).toHaveLength(1);
    expect(String(vc[0][2])).toMatch(/^venda_vc_/);
    await waitFor(() => expect(invocacoes("venda-capi")[0]).toMatchObject({ evento: "ViewContent", event_id: vc[0][2] }));
    await waitFor(() => expect(eventos("demo_view")[0]).toMatchObject({ entrada: true, sessao_nova: true }));
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-liberar]')).toBeNull();
    // recarregou na mesma sessão: não repete
    _zerarEstadoLiberar();
    vi.mocked(trackEvent).mockClear();
    montar();
    expect(metas("ViewContent")).toHaveLength(1);
    await waitFor(() => expect(eventos("demo_view")[0]).toMatchObject({ entrada: true, sessao_nova: false }));
  });

  it("o passo da URL só vale com os dados dele (recarregar no meio não cai em tela vazia)", () => {
    const base = { plano: null, metodo: null, nome: null, email: null, pix: null, cartaoUrl: null, itens: [] };
    expect(passoValido(null, base)).toBe("demo");
    expect(passoValido("paywall", base)).toBe("paywall");
    expect(passoValido("dados", base)).toBe("paywall");
    expect(passoValido("pix", { ...base, plano: "anual" })).toBe("dados");
    expect(passoValido("pix", { ...base, plano: "anual", email: "a@b.co" })).toBe("pix");
    expect(passoValido("sucesso", base)).toBe("paywall");
    expect(passoValido("sucesso", { ...base, pago: true })).toBe("sucesso");
  });
});

/* ---------------------------------------------------------------- a demo */
describe("a demo (a do /experimente, com \"Liberar meu CORE\")", () => {
  it("topo: CORE · Modo demonstração · Entrar · Liberar meu CORE; 5 pílulas; demo_view com variante demo e a campanha", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    expect(screen.getByTestId("demo-selo").textContent).toBe("Modo demonstração");
    expect(screen.getByTestId("demo-entrar").textContent).toBe("Entrar");
    expect(screen.getByTestId("demo-topo-criar").textContent).toBe(BOTAO_LIBERAR);
    expect(screen.getByTestId("demo-faixa-criar").textContent).toBe(BOTAO_LIBERAR);
    expect(screen.getByTestId("demo-fim-criar").textContent).toContain(BOTAO_LIBERAR);
    expect(texto()).not.toMatch(/Criar conta/);
    expect(texto()).not.toMatch(/grátis/i);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Finanças", "Rotina", "Treino", "Saúde", "Dieta"]);
    expect(eventos("demo_view")[0]).toMatchObject({ modulo: "financas", entrada: true, variante: "demo", utm_campaign: "liberar", ad_id: "333", venda_session_id: expect.any(String) });
    // na demo, nada de preço ainda
    expect(texto()).not.toMatch(/97,90/);
    semCartao();
  });

  it("pílula troca o módulo e mede; Entrar vai pro login", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    await noModulo("treino", "falso-exercicio");
    expect(local.search).toContain("m=treino");
    expect(eventos("demo_pilula")).toEqual([expect.objectContaining({ de: "financas", para: "treino", n: 1, variante: "demo" })]);
    fireEvent.click(screen.getByTestId("demo-entrar"));
    expect(screen.getByTestId("onde").textContent).toBe("/entrar");
  });
});

/* ---------------------------------------------------------------- a folha */
describe("a folha de baixo", () => {
  it("aparece UMA vez aos 30 s com \"Liberar meu CORE\" / \"Continuar explorando\"; não volta na mesma sessão", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_900); });
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    const folha = screen.getByTestId("demo-folha");
    expect(folha.textContent).toContain(FOLHA_TITULO_LIBERAR);
    expect(screen.getByTestId("demo-folha-criar").textContent).toContain(BOTAO_LIBERAR);
    expect(screen.getByTestId("demo-folha-fechar").textContent).toBe("Continuar explorando");
    expect(folha.getAttribute("aria-modal")).toBe("false");
    expect(eventos("demo_folha_view")).toEqual([expect.objectContaining({ gatilho: "30s", variante: "demo" })]);
    semCartao();
    fireEvent.click(screen.getByTestId("demo-folha-fechar"));
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    cleanup();
    _zerarEstadoLiberar();
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    expect(eventos("demo_folha_view")).toHaveLength(1);
  });

  it("aparece na 2ª troca de módulo (não na 1ª), e os 30 s não repetem", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    fireEvent.click(screen.getByTestId("demo-pilula-saude"));
    expect(screen.getByTestId("demo-folha")).toBeInTheDocument();
    expect(eventos("demo_folha_view")).toEqual([expect.objectContaining({ gatilho: "pilula" })]);
    fireEvent.click(screen.getByTestId("demo-folha-x"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    expect(eventos("demo_folha_view")).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- entradas → paywall */
describe("todo \"Liberar meu CORE\" abre o paywall do /assinar", () => {
  const abriuPaywall = async (origem: string) => {
    await waitFor(() => expect(passo()).toBe("paywall"));
    expect(local.search).toContain("passo=paywall");
    expect(screen.getByTestId("venda-preco-anual").textContent).toBe("R$ 97,90");
    expect(screen.getByTestId("venda-por-mes").textContent).toContain("R$ 8,16/mês");
    expect(screen.getByTestId("venda-anual-pix").textContent).toContain("Pagar com Pix");
    // sem os links da Cakto: nem cartão, nem mensal (igual ao /assinar)
    expect(screen.queryByTestId("venda-anual-cartao")).toBeNull();
    expect(screen.queryByTestId("venda-plano-mensal")).toBeNull();
    expect(texto()).not.toMatch(/24,90|mensal/i);
    expect(eventos("demo_liberar_click").at(-1)).toMatchObject({ origem, variante: "demo", venda_session_id: expect.any(String) });
    expect(eventos("venda_paywall_view").at(-1)).toMatchObject({ variante: "demo", cartao_anual: false, mensal: false });
    expect(eventos("venda_passo").at(-1)).toMatchObject({ passo: "paywall", resposta: "view", variante: "demo" });
    semCartao();
  };

  it.each([
    ["topo", "demo-topo-criar"],
    ["faixa", "demo-faixa-criar"],
    ["fim", "demo-fim-criar"],
  ])("origem %s", async (origem, testid) => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId(testid));
    await abriuPaywall(origem);
  });

  it("origem folha (+ demo_folha_criar)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    fireEvent.click(screen.getByTestId("demo-folha-criar"));
    vi.useRealTimers();
    await abriuPaywall("folha");
    expect(eventos("demo_folha_criar")).toEqual([expect.objectContaining({ gatilho: "30s", variante: "demo" })]);
  });

  it("origem seta ← do cabeçalho do módulo (1 clique só)", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("falso-seta"));
    await abriuPaywall("seta");
    expect(eventos("demo_liberar_click")).toHaveLength(1);
  });

  it("origem modulo: o módulo tentou sair (login); outro módulo da demo troca aqui", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("falso-ir-rotina"));
    await noModulo("rotina", "falso-habitos");
    expect(local.search).toContain("aba=meu-mes");
    fireEvent.click(screen.getByTestId("demo-pilula-financas"));
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("falso-ir-auth"));
    await abriuPaywall("modulo");
    expect(eventos("demo_navegacao").map((e) => e.acao)).toEqual(["modulo", "liberar"]);
  });

  it("voltar do paywall devolve pra demo no mesmo módulo, com o que ela mexeu", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    const antes = Number(screen.getByTestId("falso-n-gastos").textContent);
    tocar("falso-gasto");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("paywall"));
    expect(screen.getByTestId("venda-paywall-contexto").textContent).toBe("Seu CORE começa por FinançasO que você anotou na demonstração vai junto.");
    fireEvent.click(screen.getByTestId("porta-voltar"));
    await noModulo("financas", "falso-n-gastos");
    expect(Number(screen.getByTestId("falso-n-gastos").textContent)).toBe(antes + 1);
    fireEvent.click(screen.getByTestId("demo-faixa-criar"));
    await waitFor(() => expect(passo()).toBe("paywall"));
    fireEvent.click(screen.getByTestId("liberar-voltar-demo"));
    await noModulo("financas", "falso-n-gastos");
  });

  it("com os links da Cakto configurados, o cartão e o mensal aparecem como no /assinar", async () => {
    vi.stubEnv("VITE_VENDA_CAKTO_ANUAL", "anu4l97");
    vi.stubEnv("VITE_VENDA_CAKTO_MENSAL", "mens2490");
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("paywall"));
    expect(screen.getByTestId("venda-anual-cartao")).toBeInTheDocument();
    expect(screen.getByTestId("venda-plano-mensal").textContent).toContain("R$ 24,90/mês");
  });
});

/* ---------------------------------------------------------------- Pix */
describe("paywall → dados → Pix → sucesso", () => {
  it("o caminho inteiro: itens dela vão pra conta, venda com variante demo, InitiateCheckout e Pix como no /assinar", async () => {
    invoke.mockImplementation(async (fn: string, opts?: { body: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body.action === "create") return { data: PIX_OK, error: null };
      if (fn === "asaas-pix" && opts?.body.action === "check") return { data: { paid: true }, error: null };
      if (fn === "porta-handoff") return { data: { codigo: "ABCDEFGHJK", email_enviado: true }, error: null };
      if (fn === "check-subscription") return { data: { subscribed: true, subscription_end: "2027-10-16T12:00:00Z" }, error: null };
      return { data: null, error: null };
    });
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-gasto");            // dela → vai
    tocar("falso-editar-exemplo");   // exemplo editado → não vai
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    await noModulo("rotina", "falso-habitos");
    tocar("falso-habito");           // hábito digitado → vai
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("paywall"));
    expect(eventos("demo_liberar_click")[0]).toMatchObject({ origem: "topo", modulo: "rotina", itens: 2 });
    // o módulo mais usado (2 mexidas em Finanças × 1 em Rotina)
    expect(screen.getByTestId("venda-paywall-contexto").textContent).toBe("Seu CORE começa por FinançasAs 2 coisas que você anotou na demonstração vão junto.");

    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(eventos("venda_plano_click")[0]).toMatchObject({ plano: "anual", metodo: "pix", valor: 97.9, variante: "demo" });
    const ic = metas("InitiateCheckout")[0];
    expect(ic[1]).toMatchObject({ value: 97.9, currency: "BRL", content_name: "core_anual_web" });
    expect(String(ic[2])).toMatch(/^venda_ic_/);
    await waitFor(() => expect(invocacoes("venda-capi").find((b) => b.evento === "InitiateCheckout")).toMatchObject({ event_id: ic[2], valor: 97.9 }));
    expect(screen.getByTestId("venda-resumo").textContent).toContain("Anual · R$ 97,90 · Pix");

    preencher("Ana Souza", "Ana@Exemplo.com");
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("pix"));
    expect(definirEmailDaCompra).toHaveBeenCalledWith("ana@exemplo.com");
    // a campanha na conta: user_metadata.venda (nunca porta), com variante "demo" e o que ela fez na demo
    const dados = updateUser.mock.calls.map((c) => (c[0] as { data?: Record<string, unknown> }).data).find((d) => d?.venda) as Record<string, unknown>;
    const venda = dados.venda as Record<string, unknown>;
    expect(venda).toMatchObject({ v: 1, variante: "demo", plano: "anual", metodo: "pix", respostas: { modulo: "financas", mais_usado: "financas", itens: "2", origem: "topo" } });
    expect(venda.attr).toMatchObject({ utm_campaign: "liberar", ad_id: "333", c_id: "111" });
    expect(dados.porta).toBeUndefined();
    expect(dados.full_name).toBe("Ana Souza");

    // os itens DELA foram pra conta (nunca o exemplo)
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const linhas = upsert.mock.calls[0][0] as Array<{ user_id: string; key: string; value: unknown }>;
    const porChave = Object.fromEntries(linhas.map((l) => [l.key, l.value]));
    expect(Object.keys(porChave).sort()).toEqual(["finance-expenses", "rotina-habits"]);
    expect(porChave["finance-expenses"]).toEqual([expect.objectContaining({ description: "Pizza", value: 45 })]);
    expect(porChave["rotina-habits"]).toEqual(["Tomar vitamina"]);
    for (const exemplo of ["Mercado", "iFood", "Uber", "Treinar", "Beber 2L"]) expect(JSON.stringify(linhas)).not.toContain(exemplo);
    await waitFor(() => expect(eventos("demo_itens_conta")).toEqual([expect.objectContaining({ ok: true, n: 2, variante: "demo" })]));

    // o Pix: a97 na página
    await waitFor(() => expect(screen.getByTestId("venda-pix-codigo").textContent).toBe(PIX_OK.qrCode));
    expect(invocacoes("asaas-pix")[0]).toMatchObject({ action: "create", offer: "a97" });
    expect(eventos("venda_pix_qr_view")[0]).toMatchObject({ order_id: "qr_456", valor: 97.9, variante: "demo" });
    semCartao();
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 5000 });
    expect(firePixPurchaseOnce).toHaveBeenCalledWith("checkout");
    expect(eventos("venda_pago")[0]).toMatchObject({ plano: "anual", metodo: "pix", valor: 97.9, order_id: "qr_456", variante: "demo" });
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Pagamento confirmado");
    expect(screen.getByTestId("venda-sucesso-email").textContent).toBe("ana@exemplo.com");
    expect(screen.getByTestId("venda-loja").getAttribute("href")).toContain("/baixar?origem=venda_demo");
    await waitFor(() => expect(invocacoes("porta-handoff")[0]).toMatchObject({ acao: "criar", metodo: "codigo" }));
    await waitFor(() => expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("16/10/2027"));
    // os itens não foram gravados 2x
    expect(upsert).toHaveBeenCalledTimes(1);
    // o Purchase do pixel é o do PixVenda (firePixPurchaseOnce, id do pedido) — a página não manda outro
    expect(metas("Purchase")).toHaveLength(0);
    // depois de pago, "Liberar" não cobra de novo: Voltar do navegador → demo → Liberar → sucesso
    expect(local.search).toContain("passo=sucesso");
  }, 10_000);

  it("quem já é assinante (entrou com a senha) não paga de novo: sucesso 'Você já é assinante', sem Pix", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    signInWithPassword.mockResolvedValue({ error: null });
    invoke.mockImplementation(async (fn: string) =>
      fn === "check-subscription" ? { data: { subscribed: true, subscription_end: "2126-01-01T00:00:00Z" }, error: null } : { data: null, error: null });
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("paywall"));
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Bia", "bia@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(screen.getByTestId("venda-dados").getAttribute("data-fase")).toBe("existe"));
    expect(signUp).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("venda-senha"), { target: { value: "segredo1" } });
    fireEvent.click(screen.getByTestId("venda-entrar"));
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "bia@exemplo.com", password: "segredo1" });
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Você já é assinante");
    expect(eventos("venda_ja_assinante")[0]).toMatchObject({ via: "senha", variante: "demo" });
    expect(eventos("venda_pago")).toHaveLength(0);
    // e o Liberar da demo agora leva pro sucesso, não pra cobrar
    cleanup();
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("sucesso"));
  });

  it("sem nada criado por ela: nada é gravado em user_data", async () => {
    invoke.mockImplementation(async (fn: string, opts?: { body: Record<string, unknown> }) =>
      fn === "asaas-pix" && opts?.body.action === "create" ? { data: PIX_OK, error: null } : { data: null, error: null });
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-editar-exemplo");
    fireEvent.click(screen.getByTestId("demo-fim-criar"));
    await waitFor(() => expect(passo()).toBe("paywall"));
    expect(screen.getByTestId("venda-paywall-contexto").textContent).toBe("Seu CORE começa por Finanças");
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Ana", "ana@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("pix"));
    await waitFor(() => expect(invocacoes("asaas-pix")).toHaveLength(1));
    expect(upsert).not.toHaveBeenCalled();
    expect(lerUserData).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- textos e regras */
describe("textos e regras", () => {
  it("contexto do paywall e módulo mais usado", () => {
    expect(contextoDoPaywall("treino", 0)).toEqual({ linha: "Seu CORE começa por Treino", itens: null });
    expect(contextoDoPaywall("dieta", 3)).toEqual({ linha: "Seu CORE começa por Dieta", itens: "As 3 coisas que você anotou na demonstração vão junto." });
    expect(moduloMaisUsado({}, "saude")).toBe("saude");
    expect(moduloMaisUsado({ rotina: 3, financas: 1 }, "financas")).toBe("rotina");
    expect(moduloMaisUsado({ rotina: 1, financas: 1 }, "financas")).toBe("financas");
  });

  it("nunca 'sem cartão' nem 'grátis' nos arquivos da página; área de transferência nenhuma (só a do PixVenda)", () => {
    const dir = join(process.cwd(), "src/pages/liberar");
    for (const f of readdirSync(dir)) {
      const s = readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(s, f).not.toMatch(/sem cart[aã]o/i);
      expect(s, f).not.toMatch(/gr[aá]tis/i);
      expect(s, f).not.toMatch(/clipboard|writeText|readText/);
    }
  });

  it("index.html mede antes do React em /liberar com variante \"liberar\" (e /experimente segue \"demo\")", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const inicio = html.indexOf("// ─── PORTA (/comece): medir ANTES do React");
    const bloco = html.slice(html.lastIndexOf("<script>", inicio) + "<script>".length, html.indexOf("</script>", inicio));
    const chamadas: Array<{ event_name: string; event_data: Record<string, unknown> }> = [];
    const fetchAntes = globalThis.fetch;
    const addAntes = window.addEventListener.bind(window);
    const ouvintes: Array<[string, EventListenerOrEventListenerObject]> = [];
    window.addEventListener = ((t: string, l: EventListenerOrEventListenerObject) => { ouvintes.push([t, l]); }) as typeof window.addEventListener;
    globalThis.fetch = vi.fn((_u: string, init: RequestInit) => { chamadas.push(JSON.parse(String(init.body))); return Promise.resolve(new Response(null, { status: 201 })); }) as unknown as typeof fetch;
    try {
      sessionStorage.setItem("venda-sessao-v1", "sessao-venda-1");
      const rodar = (c: string) => { window.history.replaceState({}, "", c); new Function(bloco)(); };
      rodar("/liberarx");
      expect(chamadas).toHaveLength(0);
      rodar(`/liberar?m=rotina&${QUERY_AD}`);
      expect(chamadas[0]).toMatchObject({ event_name: "porta_html", event_data: { variante: "liberar", venda_session_id: "sessao-venda-1", utm_campaign: "liberar", ad_id: "333" } });
      rodar("/experimente?m=rotina");
      expect(chamadas[1].event_data.variante).toBe("demo");
      expect(chamadas[1].event_data).not.toHaveProperty("venda_session_id");
    } finally {
      globalThis.fetch = fetchAntes;
      window.addEventListener = addAntes;
      delete (window as { __portaHtml?: unknown }).__portaHtml;
    }
  });
});
