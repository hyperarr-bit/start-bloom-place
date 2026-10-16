/**
 * O FUNIL DO APP NA WEB (/assinatura, 16/10): as telas do iPhone 1.0.15 até o paywall, e o paywall da WEB no Pix com
 * a escada 97,90 → 69,90 → 24,90.
 *
 * O que não pode quebrar:
 *   · os passos do app na ordem (welcome com vídeo → porta → 2 perguntas → sem × com → lembretes → prova → preparando →
 *     resultado → plano de 3 dias → paywall), com os eventos de passo marcados como web (`funil: "app_web"`);
 *   · a escada: recusou o 97,90 → presente 69,90 → recusou → 24,90 → recusou → nada mais (volta pro 97,90, sem presente);
 *     cada presente 1x por sessão; voltar do QR sem pagar = recusa;
 *   · cada aceite → nome + e-mail → Pix com o VALOR e a OFERTA certos (a97 · a69 · w25); InitiateCheckout com o valor;
 *   · o mensal diz "30 dias de acesso, sem renovação automática — pra continuar, é só pagar de novo"; nunca "sem cartão";
 *   · quem já é assinante não paga; a conta leva `user_metadata.venda.variante = "app"`;
 *   · /comece, /experimente, /assinar e /liberar com a mesma linha no App.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
type U = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({}) }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
      signUp: vi.fn(async () => ({ data: {}, error: null })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(), trackEventBeacon: vi.fn(), captureLandingMeta: vi.fn(() => ({})), getAttributionParams: vi.fn(() => ({})),
}));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
const definirEmailDaCompra = vi.fn();
vi.mock("@/lib/sessao-anonima", () => ({
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: vi.fn(async () => {}),
  limparBatismo: vi.fn(),
  anonimoLigado: vi.fn(async () => false),
  precisaBatizar: vi.fn(async () => false),
}));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { markPixPurchasePending } from "@/lib/purchase-tracking";
import AssinaturaAppRota, { _zerarEstadoApp, CHAVE_ESTADO_APP, passoValido, type EstadoApp } from "@/pages/funis/app-web/AssinaturaApp";
import { MENSAL_SEM_RENOVACAO, OFERTAS, proximoDegrau, porMes } from "@/pages/funis/app-web/conteudo";
import { _zerarSessaoVenda } from "@/pages/venda/rastreio";
import { AREA_TRACKS } from "@/lib/funnel";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";

/* ---------------------------------------------------------------- ambiente */
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const QUERY_AD = "?utm_source=meta&utm_medium=paid&utm_campaign=app_web&utm_content=video1&c_id=111&as_id=222&ad_id=333&fbclid=IwAR_abc";
const montar = (url = `/assinatura${QUERY_AD}`) => {
  window.history.replaceState({}, "", url);
  return render(
    <MemoryRouter initialEntries={["/assinatura"]}>
      <Routes><Route path="/assinatura" element={<AssinaturaAppRota />} /><Route path="/entrar" element={<div data-testid="pagina-entrar" />} /></Routes>
    </MemoryRouter>,
  );
};
const passo = () => screen.getByTestId("assinatura-app").getAttribute("data-passo");
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const metas = (nome: string) => vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === nome);
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body?: Record<string, unknown> } | undefined)?.body ?? {});
const semCartaoNaTela = () => expect(texto()).not.toMatch(/sem cart[aã]o/i);
/** chegou no passo E a tela anterior já saiu (a troca de tela anima: a de saída fica no DOM até acabar) */
const telas = () => Array.from(document.querySelectorAll("[data-tela]")).map((el) => el.getAttribute("data-tela"));
const ate = async (p: string, timeout = 3000) => {
  await waitFor(() => {
    expect(passo()).toBe(p);
    if (p === "welcome") expect(telas()).toEqual([]);
    else expect(telas()).toEqual([p]);
  }, { timeout });
  semCartaoNaTela();
};
const semear = (e: Partial<EstadoApp>) => localStorage.setItem(CHAVE_ESTADO_APP, JSON.stringify({ passo: "paywall", area: "dinheiro", answers: { area: "dinheiro", area_label: "Meu dinheiro" }, ...e }));
const preencher = (nome: string, email: string) => {
  fireEvent.change(screen.getByTestId("venda-nome"), { target: { value: nome } });
  fireEvent.change(screen.getByTestId("venda-email"), { target: { value: email } });
};
const PIX = (id: string) => ({ data: { orderId: id, qrCode: `00020126580014br.gov.bcb.pix-${id}`, qrCodeBase64: null, expiresAt: null }, error: null });
/** asaas-pix create → um QR por oferta; check → não pago (a não ser que `pago`) */
const gateway = (opts: { pago?: boolean; assinante?: boolean } = {}) => {
  invoke.mockImplementation(async (fn: string, args?: { body?: Record<string, unknown> }) => {
    const b = args?.body ?? {};
    if (fn === "asaas-pix" && b.action === "create") return PIX(`qr_${b.offer}`);
    if (fn === "asaas-pix" && b.action === "check") return { data: { paid: !!opts.pago }, error: null };
    if (fn === "check-subscription") return { data: { subscribed: !!opts.assinante, subscription_end: opts.assinante ? "2027-10-16T12:00:00Z" : null }, error: null };
    return { data: null, error: null };
  });
};
/** paga o degrau mostrado: aceita → nome + e-mail → Pix */
const aceitarEIrProPix = async (degrau: 97 | 69 | 24, email = "ana@exemplo.com") => {
  fireEvent.click(screen.getByTestId(degrau === 97 ? "app-web-pagar-97" : `app-web-aceitar-${degrau}`));
  await waitFor(() => { expect(["dados", "pix"]).toContain(passo()); expect(telas()).toEqual([passo()]); });
  if (passo() === "dados") {
    preencher("Ana Souza", email);
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
  }
  await ate("pix");
  await waitFor(() => expect(screen.getByTestId("venda-pix").getAttribute("data-fase")).toBe("qr"));
};

beforeEach(() => {
  _zerarEstadoApp();
  _zerarSessaoVenda();
  _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.loading = false; authState.isSubscribed = false;
  [getSession, getUser, updateUser, signOut, invoke, definirEmailDaCompra].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear(); vi.mocked(fireMetaEvent).mockClear(); vi.mocked(markPixPurchasePending).mockClear();
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "ana@exemplo.com", user_metadata: {} } } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  gateway();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement["play"];
  Object.defineProperty(navigator, "userAgent", { value: UA_IPHONE, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

/* ---------------------------------------------------------------- rota */
describe("rota: só na web, e as outras rotas intactas", () => {
  it("App.tsx: /assinatura no SoNaWeb; /comece, /experimente, /assinar e /liberar com a mesma linha; TrialBanner fora", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/assinatura" element={<SoNaWeb><RouteErrorBoundary routeName="assinatura-app"><AssinaturaApp /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/experimente" element={<SoNaWeb><RouteErrorBoundary routeName="experimente"><Experimente /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/liberar" element={<SoNaWeb><RouteErrorBoundary routeName="liberar"><Liberar /></RouteErrorBoundary></SoNaWeb>} />');
    expect(readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8")).toContain('location.pathname.startsWith("/assinatura")');
    // a medição antes do React (index.html) também cobre a /assinatura, com variante "app"
    expect(readFileSync(join(process.cwd(), "index.html"), "utf8")).toContain('prefixo === "/assinatura" ? "app"');
  });

  it("no app da loja não monta (vai pra entrada do app)", () => {
    (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
    try {
      montar();
      expect(screen.queryByTestId("assinatura-app")).toBeNull();
    } finally {
      delete (window as { Capacitor?: unknown }).Capacitor;
    }
  });

  it("noindex + venda_view (variante app) + ViewContent 1x por sessão", async () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-assinatura]')?.getAttribute("content")).toMatch(/noindex/);
    expect(eventos("venda_view")[0]).toMatchObject({ utm_campaign: "app_web", ad_id: "333", plataforma: "ios", variante: "app" });
    expect(metas("ViewContent")).toHaveLength(1);
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-assinatura]')).toBeNull();
    montar();
    expect(metas("ViewContent")).toHaveLength(1); // mesma sessão: não repete
    expect(eventos("venda_view")).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- o funil do app */
describe("as telas do app, na ordem, na web", () => {
  it("welcome com o vídeo → porta → 2 perguntas → sem × com → lembretes → prova → preparando → resultado → plano → paywall", async () => {
    montar();
    expect(passo()).toBe("welcome");
    expect(screen.getByTestId("welcome-video").getAttribute("src")).toBe("/funil/welcome-app.mp4");
    expect(screen.getByTestId("welcome-promessa").textContent).toBe("Sua vida inteira organizada num app só.");
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await ate("porta");
    expect(texto()).toContain("Qual área da sua vida tá mais fora de controle hoje?");
    fireEvent.click(screen.getByTestId("app-web-porta-dinheiro"));
    await ate("quiz");
    // pergunta 1 (a dor) e 3 (o número: quanto some por mês) do QUIZ do app
    await waitFor(() => expect(texto()).toContain("O que mais te atrapalha"));
    fireEvent.click(screen.getByText("Esqueço contas"));
    await waitFor(() => expect(screen.getByText("R$ 300 a R$ 500")).toBeTruthy());
    fireEvent.click(screen.getByText("R$ 300 a R$ 500"));
    await ate("grafico_com_sem");
    expect(screen.getByTestId("grafico-titulo").textContent).toContain("R$ 500 somem por mês.");
    fireEvent.click(screen.getByTestId("grafico-quero-ver"));
    await ate("notif");
    expect(texto()).toContain("O CORE te avisa antes da conta vencer");
    fireEvent.click(screen.getByTestId("notif-ativar"));
    await ate("prova");
    fireEvent.click(screen.getByTestId("prova-social-botao"));
    await ate("progress");
    await ate("result", 7000);
    fireEvent.click(screen.getByTestId("result-botao"));
    await ate("plano_3_dias");
    expect(screen.getByTestId("plano-3-dias-cadeado").textContent).toContain("Desbloqueia quando você liberar o CORE");
    expect(texto()).not.toMatch(/teste gr[aá]tis/i);
    fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
    await ate("paywall");

    // os passos do funil saem marcados como WEB (o app sai com funil "w")
    const passos = eventos("funnel_view").filter((e) => e.funil === "app_web").map((e) => e.step);
    expect(passos).toEqual(expect.arrayContaining(["welcome", "start", "quiz", "grafico_com_sem", "notif", "prova", "progress", "result", "plano_3_dias", "offer"]));
    expect(eventos("funnel_view").filter((e) => e.funil === "app_web").every((e) => e.web === true && e.variante === "app")).toBe(true);
    expect(eventos("funnel_view").some((e) => e.funil === "w")).toBe(false);
    expect(eventos("funnel_click").find((e) => e.cta === "grafico_quero_ver")).toMatchObject({ funil: "app_web" });
    expect(eventos("venda_paywall_view")).toHaveLength(1);
  }, 20000);

  it("outra rota: a porta Rotina faz as 2 perguntas da trilha e o sem × com vira copy", async () => {
    montar();
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await ate("porta");
    fireEvent.click(screen.getByTestId("app-web-porta-rotina"));
    await ate("quiz");
    const [q1, q2] = AREA_TRACKS.rotina;
    await waitFor(() => expect(screen.getByText(q1.q)).toBeTruthy());
    fireEvent.click(screen.getByText(q1.opts[0].label));
    await waitFor(() => { expect(screen.getByText(q2.q)).toBeTruthy(); expect(screen.queryByText(q1.q)).toBeNull(); });
    fireEvent.click(screen.getByText(q2.opts[0].label));
    await ate("grafico_com_sem");
    expect(screen.getByTestId("grafico-com-sem").getAttribute("data-formato")).toBe("copy");
  });

  it("o voltar da porta volta pra welcome; o 'Já tem conta? Entrar' vai pro /entrar", async () => {
    montar();
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await ate("porta");
    fireEvent.click(screen.getByLabelText("Voltar"));
    await ate("welcome");
    fireEvent.click(screen.getByTestId("welcome-entrar"));
    await waitFor(() => expect(screen.getByTestId("pagina-entrar")).toBeTruthy());
  });
});

/* ---------------------------------------------------------------- a escada */
describe("o paywall da web e a escada 97,90 → 69,90 → 24,90", () => {
  it("o paywall: anual R$ 97,90 (R$ 8,16/mês), Pix, sem renovação; nada de cartão nem mensal na 1ª tela", async () => {
    semear({});
    montar();
    expect(passo()).toBe("paywall");
    expect(screen.getByTestId("app-web-preco-97").textContent).toContain("R$ 97,90");
    expect(screen.getByTestId("app-web-por-mes-97").textContent).toBe(`R$ ${porMes(97.9)}/mês`);
    expect(screen.getByTestId("app-web-paywall-legal").textContent).toContain("sem renovação automática");
    expect(texto()).not.toContain("24,90");
    expect(texto()).not.toContain("69,90");
    expect(texto()).not.toMatch(/cart[aã]o de cr[eé]dito/i);
  });

  it("recusou o 97,90 (Voltar) → 69,90 → recusou (Agora não) → 24,90 → recusou → nada mais: volta pro 97,90 e o próximo Voltar recua pro plano", async () => {
    semear({});
    montar();
    fireEvent.click(screen.getByTestId("app-web-paywall-voltar"));
    await ate("oferta_69");
    expect(screen.getByTestId("app-web-presente-selo").textContent).toBe("Presente · só agora");
    expect(screen.getByTestId("app-web-preco-69").textContent).toBe("R$ 69,90");
    expect(screen.getByTestId("app-web-preco-de").textContent).toBe("R$ 97,90");
    fireEvent.click(screen.getByTestId("app-web-agora-nao-69"));
    await ate("oferta_24");
    expect(screen.getByTestId("app-web-preco-24").textContent).toBe("R$ 24,90");
    expect(screen.getByTestId("app-web-sem-renovacao").textContent).toBe(MENSAL_SEM_RENOVACAO);
    expect(MENSAL_SEM_RENOVACAO).toBe("30 dias de acesso, sem renovação automática — pra continuar, é só pagar de novo.");
    fireEvent.click(screen.getByTestId("app-web-agora-nao-24"));
    await ate("paywall");
    // a escada acabou: o Voltar do 97,90 agora recua um passo (não abre presente de novo)
    fireEvent.click(screen.getByTestId("app-web-paywall-voltar"));
    await ate("plano_3_dias");
    expect(eventos("venda_downsell_view").map((e) => e.degrau)).toEqual([69, 24]);
    expect(eventos("venda_downsell_recusou").map((e) => `${e.degrau}:${e.via}`)).toEqual(["69:agora_nao", "24:agora_nao"]);
    expect(eventos("venda_paywall_recusou").map((e) => e.via)).toEqual(["voltar", "voltar"]);
    expect(eventos("venda_downsell_view").every((e) => e.variante === "app")).toBe(true);
  });

  it("cada presente 1x por sessão: recarregou a página e recusou o 97,90 de novo → não volta o 69,90 nem o 24,90", async () => {
    semear({});
    const { unmount } = montar();
    fireEvent.click(screen.getByTestId("app-web-agora-nao-97"));
    await ate("oferta_69");
    fireEvent.click(screen.getByTestId("app-web-presente-voltar"));
    await ate("oferta_24");
    unmount();
    _zerarEstadoApp(); // página nova, mesma sessão (sessionStorage)
    semear({ passo: "paywall" });
    montar();
    fireEvent.click(screen.getByTestId("app-web-agora-nao-97"));
    await ate("plano_3_dias");
    expect(eventos("venda_downsell_view")).toHaveLength(2);
  });

  it("proximoDegrau: a ordem e o 'sem loop'", () => {
    expect(proximoDegrau(97, [])).toBe(69);
    expect(proximoDegrau(97, [69])).toBe(24);
    expect(proximoDegrau(97, [69, 24])).toBeNull();
    expect(proximoDegrau(69, [69])).toBe(24);
    expect(proximoDegrau(69, [69, 24])).toBeNull();
    expect(proximoDegrau(24, [69, 24])).toBeNull();
  });

  it("aceitou o 97,90 → nome + e-mail → Pix a97 de R$ 97,90 (InitiateCheckout 97,9) → pago → sucesso", async () => {
    semear({});
    montar();
    gateway({ pago: true });
    await aceitarEIrProPix(97);
    expect(invocacoes("asaas-pix").find((b) => b.action === "create")).toMatchObject({ offer: "a97" });
    expect(screen.getByTestId("venda-pix-resumo").textContent).toBe("Anual · R$ 97,90 · 1 ano de acesso");
    expect(metas("InitiateCheckout")[0][1]).toMatchObject({ value: 97.9, content_name: "core_anual_web" });
    expect(vi.mocked(markPixPurchasePending).mock.calls[0][0]).toMatchObject({ offer: "a97" });
    // a conta leva a campanha com a variante "app"
    const venda = (definirEmailDaCompra.mock.calls.length ? updateUser.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data.venda).find(Boolean) : null) as Record<string, unknown> | null;
    expect(venda).toMatchObject({ variante: "app", oferta: "a97", plano: "anual", metodo: "pix" });
    await ate("sucesso", 6000);
    expect(eventos("venda_pago")[0]).toMatchObject({ oferta: "a97", valor: 97.9, plano: "anual", variante: "app" });
    expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("Plano anual");
  });

  it("aceitou o presente 69,90 → Pix a69 de R$ 69,90 (InitiateCheckout 69,9, venda_downsell_aceitou)", async () => {
    semear({});
    montar();
    fireEvent.click(screen.getByTestId("app-web-paywall-voltar"));
    await ate("oferta_69");
    await aceitarEIrProPix(69);
    expect(invocacoes("asaas-pix").find((b) => b.action === "create")).toMatchObject({ offer: "a69" });
    expect(screen.getByTestId("venda-pix-resumo").textContent).toBe("Anual · R$ 69,90 · 1 ano de acesso");
    expect(metas("InitiateCheckout")[0][1]).toMatchObject({ value: 69.9, content_name: "core_anual69_web" });
    expect(eventos("venda_downsell_aceitou")[0]).toMatchObject({ degrau: 69, valor: 69.9 });
    expect(eventos("venda_pix_qr_view")[0]).toMatchObject({ oferta: "a69", valor: 69.9, plano: "anual" });
  });

  it("aceitou o 24,90 → Pix w25 de R$ 24,90 com o aviso de sem renovação; pago → sucesso diz 30 dias sem renovação", async () => {
    semear({ passo: "oferta_24" });
    montar();
    gateway({ pago: true });
    await aceitarEIrProPix(24);
    expect(invocacoes("asaas-pix").find((b) => b.action === "create")).toMatchObject({ offer: "w25" });
    expect(screen.getByTestId("venda-pix-resumo").textContent).toBe("Mensal · R$ 24,90 · pagamento único");
    expect(screen.getByTestId("venda-pix-aviso").textContent).toBe(MENSAL_SEM_RENOVACAO);
    expect(metas("InitiateCheckout")[0][1]).toMatchObject({ value: 24.9, content_name: "core_mensal_pix_web" });
    await ate("sucesso", 6000);
    expect(eventos("venda_pago")[0]).toMatchObject({ oferta: "w25", valor: 24.9, plano: "mensal" });
    expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("sem renovação automática");
  });

  it("voltou do QR do 97,90 sem pagar = recusa → presente 69,90; aceitou → direto pro Pix a69 (a conta já é desta sessão), QR novo", async () => {
    semear({});
    montar();
    await aceitarEIrProPix(97);
    expect(invocacoes("asaas-pix").filter((b) => b.action === "create").map((b) => b.offer)).toEqual(["a97"]);
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: "2026-10-16T12:00:00Z", user_metadata: {} };
    fireEvent.click(screen.getByTestId("app-web-voltar"));
    await ate("oferta_69");
    expect(eventos("venda_downsell_recusou")).toHaveLength(0);
    expect(eventos("venda_paywall_recusou").map((e) => e.via)).toEqual(["pix_voltar"]);
    fireEvent.click(screen.getByTestId("app-web-aceitar-69"));
    await ate("pix");
    await waitFor(() => expect(invocacoes("asaas-pix").filter((b) => b.action === "create").map((b) => b.offer)).toEqual(["a97", "a69"]));
    expect(invocacoes("check-subscription").length).toBeGreaterThan(0); // conferiu antes de cobrar de novo
    // voltou do QR do 69,90 → 24,90
    fireEvent.click(screen.getByTestId("app-web-voltar"));
    await ate("oferta_24");
    expect(eventos("venda_downsell_recusou")[0]).toMatchObject({ degrau: 69, via: "pix_voltar" });
  });

  it("o Pix do degrau anterior caiu antes do aceite do presente → não cobra de novo (sucesso 'já é assinante')", async () => {
    semear({});
    montar();
    await aceitarEIrProPix(97);
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: "2026-10-16T12:00:00Z", user_metadata: {} };
    fireEvent.click(screen.getByTestId("app-web-voltar"));
    await ate("oferta_69");
    gateway({ assinante: true });
    fireEvent.click(screen.getByTestId("app-web-aceitar-69"));
    await ate("sucesso");
    expect(invocacoes("asaas-pix").filter((b) => b.action === "create").map((b) => b.offer)).toEqual(["a97"]);
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Você já é assinante");
  });

  it("quem já é assinante (logada com o mesmo e-mail) não paga: vai pro sucesso sem gerar Pix", async () => {
    authState.user = { id: "u-9", email: "bia@exemplo.com", created_at: "2026-01-01T00:00:00Z", user_metadata: {} };
    authState.isSubscribed = true;
    semear({});
    montar();
    fireEvent.click(screen.getByTestId("app-web-pagar-97"));
    await ate("dados");
    preencher("Bia", "bia@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await ate("sucesso");
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Você já é assinante");
    expect(eventos("venda_ja_assinante")[0]).toMatchObject({ via: "sessao", variante: "app" });
  });

  it("o Voltar do dados volta pro degrau escolhido (não é recusa)", async () => {
    semear({ passo: "oferta_69" });
    montar();
    fireEvent.click(screen.getByTestId("app-web-aceitar-69"));
    await ate("dados");
    expect(screen.getByTestId("venda-resumo").textContent).toContain("R$ 69,90");
    fireEvent.click(screen.getByTestId("app-web-voltar"));
    await ate("oferta_69");
    expect(eventos("venda_downsell_recusou")).toHaveLength(0);
  });

  it("o Voltar do navegador no paywall é a recusa (abre o presente), sem prender ninguém", async () => {
    semear({});
    montar();
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate", { state: { aw: "plano_3_dias" } })); });
    await ate("oferta_69");
    expect(eventos("venda_paywall_recusou")[0]).toMatchObject({ via: "navegador" });
  });

  it("recarregar no meio nunca cai numa tela sem dado", () => {
    const base = { area: "dinheiro" as const, answers: {}, marcados: null, nome: null, pix: null, pixOferta: null };
    expect(passoValido({ ...base, passo: "pix", oferta: "a69", email: null })).toBe("dados");
    expect(passoValido({ ...base, passo: "pix", oferta: null, email: "a@x.com" })).toBe("paywall");
    expect(passoValido({ ...base, passo: "dados", oferta: null, email: null })).toBe("paywall");
    expect(passoValido({ ...base, passo: "sucesso", oferta: "a97", email: "a@x.com" })).toBe("paywall");
    expect(passoValido({ ...base, passo: "progress", oferta: null, email: null })).toBe("result");
    expect(passoValido({ ...base, area: null, passo: "quiz", oferta: null, email: null })).toBe("porta");
  });

  it("as ofertas batem com as funções de dinheiro (preço, oferta, conteúdo da CAPI)", () => {
    expect(OFERTAS.a97).toMatchObject({ valor: 97.9, preco: "97,90", plano: "anual" });
    expect(OFERTAS.a69).toMatchObject({ valor: 69.9, preco: "69,90", plano: "anual" });
    expect(OFERTAS.w25).toMatchObject({ valor: 24.9, preco: "24,90", plano: "mensal", acesso: "30 dias de acesso" });
  });
});
