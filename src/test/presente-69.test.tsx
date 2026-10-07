/**
 * PRESENTE DE 69,90 (07/10, iPhone): o anual core_anual_69 (offering `anual_69`)
 * no lugar da save-offer do mensal pra quem cancelou o teste, e por cima do
 * paywall do gate pra quem perdeu o acesso. Nunca pra cartão recusado, nunca
 * duas vezes no mesmo lugar, desligável pelo metadata da offering.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const estado = vi.hoisted(() => ({
  situacao: null as null | { lugar: "cancelou_teste" | "bloqueio"; fimMs: number | null },
  presente: null as null | { preco: string; precoMes: string | null; produto: string; comTrial: boolean; dias: number },
  compra: true as boolean,
  motivo: null as string | null,
  trialCancelado: true,
  auth: {} as Record<string, unknown>,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  situacaoDoPresente: vi.fn(async () => estado.situacao),
  carregarPresente69: vi.fn(async () => estado.presente),
  comprarPresente69: vi.fn(async () => estado.compra),
  motivoUltimaCompra: vi.fn(() => estado.motivo),
  estadoTrialCancelado: vi.fn(async () => estado.trialCancelado),
  prefetchAnualIos: vi.fn(async () => undefined),
  precoAnualIos: vi.fn(() => "R$ 97,90"),
  problemaDeCobranca: vi.fn(async () => ({ temProblema: false, comAcesso: false, url: null })),
  comprar: vi.fn(async () => false),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => estado.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/lib/notificacoes", () => ({ cancelarLembreteDoTeste: vi.fn(async () => undefined), pedidoDeLembreteDoTeste: () => null }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({
  PaywallAssinatura: () => <div data-testid="paywall-gate"><button>Começar 3 dias grátis</button></div>,
}));
vi.mock("@/components/paywall/PaywallFlow", () => ({ PaywallFlow: () => <div data-testid="paywall-web" /> }));

import { lerSituacaoDoPresente, lerPacoteDoPresente, lerTrialCancelado } from "@/lib/revenuecat";
import { trackEvent } from "@/lib/analytics";
import { TrialBanner } from "@/components/TrialBanner";
import { SaveOfferDowngrade } from "@/components/missao/SaveOfferDowngrade";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
const OFERTA = { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: false, dias: 0 };
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const android = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" }; };

/* ───────────────────────────── leituras puras ───────────────────────────── */
describe("presente 69 — onde cabe (customerInfo real do RevenueCat)", () => {
  const trialCancelado = { periodType: "TRIAL", isActive: true, willRenew: false, unsubscribeDetectedAt: "2026-10-06T10:00:00Z", billingIssueDetectedAt: null, expirationDateMillis: 1_800_000_000_000 };
  const info = (all: Record<string, unknown>, active: Record<string, unknown> = {}) => ({ entitlements: { all, active } });

  it("teste cancelado com acesso vivo → cancelou_teste, com o fim real do teste", () => {
    expect(lerSituacaoDoPresente(info({ p: trialCancelado }, { p: trialCancelado }))).toEqual({ lugar: "cancelou_teste", fimMs: 1_800_000_000_000 });
    expect(lerTrialCancelado(info({ p: trialCancelado }, { p: trialCancelado }))).toBe(true);
  });

  it("teste acabou cancelado / expirou (entitlement em `all`, nada em `active`) → bloqueio", () => {
    const expirado = { ...trialCancelado, isActive: false };
    expect(lerSituacaoDoPresente(info({ p: expirado }))).toEqual({ lugar: "bloqueio", fimMs: null });
  });

  it("cartão recusado (billingIssueDetectedAt + willRenew false) NUNCA ganha presente — em carência ou fora", () => {
    const recusado = { periodType: "TRIAL", isActive: true, willRenew: false, unsubscribeDetectedAt: null, billingIssueDetectedAt: "2026-10-05T00:00:00Z" };
    expect(lerSituacaoDoPresente(info({ p: recusado }, { p: recusado }))).toBeNull();
    expect(lerSituacaoDoPresente(info({ p: { ...recusado, isActive: false } }))).toBeNull();
    // ...e a save-offer do mensal também não dispara pra ele (07/10: disparava)
    expect(lerTrialCancelado(info({ p: recusado }, { p: recusado }))).toBe(false);
  });

  it("assinante normal, teste em andamento ou quem nunca assinou: nada", () => {
    const vivo = { periodType: "NORMAL", isActive: true, willRenew: true, unsubscribeDetectedAt: null, billingIssueDetectedAt: null };
    expect(lerSituacaoDoPresente(info({ p: vivo }, { p: vivo }))).toBeNull();
    const emTeste = { ...vivo, periodType: "TRIAL" };
    expect(lerSituacaoDoPresente(info({ p: emTeste }, { p: emTeste }))).toBeNull();
    expect(lerSituacaoDoPresente(info({}))).toBeNull();
    expect(lerSituacaoDoPresente(null)).toBeNull();
  });
});

describe("presente 69 — a offering `anual_69` e o interruptor", () => {
  const pacote69 = { identifier: "$rc_annual", product: { identifier: "core_anual_69", priceString: "R$ 69,90", price: 69.9, currencyCode: "BRL" } };
  const offerings = (metadata: Record<string, unknown>, pacotes = [pacote69]) => ({
    current: { identifier: "default", availablePackages: [] },
    all: { anual_69: { identifier: "anual_69", metadata, availablePackages: pacotes, annual: pacotes[0] ?? null } },
  });

  it("acha o pacote do core_anual_69 pela offering anual_69 (não pela current)", () => {
    expect(lerPacoteDoPresente(offerings({}))?.product.identifier).toBe("core_anual_69");
  });
  it("metadata presente: 'off' desliga sem versão nova", () => {
    expect(lerPacoteDoPresente(offerings({ presente: "off" }))).toBeNull();
    expect(lerPacoteDoPresente(offerings({ presente: "OFF" }))).toBeNull();
    expect(lerPacoteDoPresente(offerings({ presente: "on" }))).not.toBeNull();
  });
  it("offering ausente ou sem o produto certo: nada (nunca vende outro produto como presente)", () => {
    expect(lerPacoteDoPresente({ current: null, all: {} })).toBeNull();
    expect(lerPacoteDoPresente(offerings({}, [{ identifier: "$rc_annual", product: { identifier: "core_anual_97", priceString: "R$ 97,90" } }]))).toBeNull();
    expect(lerPacoteDoPresente(null)).toBeNull();
  });
});

/* ───────────────────────────── as duas telas ───────────────────────────── */
describe("presente 69 — no bloqueio (gate do TrialBanner)", () => {
  const usuario = { id: "u1", email: "maria@exemplo.com" };
  const montar = () => render(<MemoryRouter initialEntries={["/home"]}><main>Home</main><TrialBanner /></MemoryRouter>);

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(trackEvent).mockClear();
    ios();
    estado.situacao = { lugar: "bloqueio", fimMs: null };
    estado.presente = OFERTA;
    estado.compra = true;
    estado.motivo = null;
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
  });
  afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

  it("perdeu o acesso: o presente aparece por cima do paywall, com o preço da loja e a regra honesta (cobra hoje)", async () => {
    montar();
    const folha = await screen.findByTestId("presente69");
    expect(folha).toHaveAttribute("data-lugar", "bloqueio");
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument(); // continua embaixo
    expect(screen.getByText("Seu teste acabou.", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("presente69-cartao").textContent).toMatch(/R\$ 97,90.*R\$ 69,90\/ano.*R\$ 5,82 por mês/);
    expect(screen.getByTestId("presente69-regra").textContent).toMatch(/Cobrado hoje pela App Store: R\$ 69,90, sem teste grátis/);
    expect(eventos("presente69_view")).toEqual([{ lugar: "bloqueio", preco: "R$ 69,90", de: "R$ 97,90", trial: false }]);
  });

  it("'Agora não': some, o paywall de sempre fica, marca o aparelho e não volta mais", async () => {
    montar();
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
    expect(localStorage.getItem("core-presente69-bloqueio-visto")).toBeTruthy();
    expect(eventos("presente69_fechou")).toEqual([{ lugar: "bloqueio" }]);
    cleanup();
    montar();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(1);
  });

  it("folha cancelada: continua na oferta, sem erro na tela, nada marcado; erro de verdade ganha frase", async () => {
    estado.compra = false;
    estado.motivo = "cancelou";
    montar();
    await screen.findByTestId("presente69");
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); }); // a caixa abre e libera o CTA
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
    await waitFor(() => expect(eventos("presente69_falhou")).toEqual([{ lugar: "bloqueio", motivo: "cancelou" }]));
    expect(screen.getByTestId("presente69")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(localStorage.getItem("core-presente69-bloqueio-visto")).toBeNull();
    expect(eventos("presente69_toque")).toEqual([{ lugar: "bloqueio" }]);

    estado.motivo = "billing_erro";
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/A Apple não concluiu o pagamento/));
    expect(screen.getByTestId("presente69")).toBeInTheDocument();
  });

  it("compra fechou: marca o aparelho e conta o sucesso", async () => {
    montar();
    await screen.findByTestId("presente69");
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
    await waitFor(() => expect(eventos("presente69_sucesso")).toEqual([{ lugar: "bloqueio", preco: "R$ 69,90" }]));
    expect(localStorage.getItem("core-presente69-bloqueio-visto")).toBeTruthy();
    expect(eventos("presente69_toque")).toEqual([{ lugar: "bloqueio" }]);
  });

  it("cartão recusado / desligado no RevenueCat / lugar errado: só o paywall de sempre", async () => {
    estado.situacao = null; // lerSituacaoDoPresente devolve null pra cartão recusado
    montar();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    cleanup();
    estado.situacao = { lugar: "bloqueio", fimMs: null };
    estado.presente = null; // metadata presente: "off" ou offering ausente
    montar();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    cleanup();
    estado.presente = OFERTA;
    estado.situacao = { lugar: "cancelou_teste", fimMs: null }; // ainda tem acesso: não é o bloqueio
    montar();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(0);
  });

  it("Android: nada muda", async () => {
    android();
    montar();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
  });
});

describe("presente 69 — quem cancelou o teste (no lugar da save-offer do mensal)", () => {
  const usuario = { id: "u1", email: "maria@exemplo.com" };
  const fim = Date.now() + 2 * 86_400_000;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("core-trial-cartao-fim", String(fim));
    vi.mocked(trackEvent).mockClear();
    ios();
    estado.trialCancelado = true;
    estado.situacao = { lugar: "cancelou_teste", fimMs: fim };
    estado.presente = OFERTA;
    estado.auth = { user: usuario, isSubscribed: true, billingPeriod: "annual" };
  });
  afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

  it("iPhone: o presente, com a regra da Apple de nível igual (entra na hora, cobra hoje, o teste vira ano)", async () => {
    render(<SaveOfferDowngrade />);
    const folha = await screen.findByTestId("presente69");
    expect(folha).toHaveAttribute("data-lugar", "cancelou_teste");
    expect(screen.getByText("Antes de ir,", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("presente69-regra").textContent).toMatch(/Entra na hora: a App Store cobra R\$ 69,90 hoje e troca o teste \(que iria até \d+ de \w+\) pelo ano inteiro/);
    expect(screen.queryByText("Mudar pro mensal", { exact: false })).toBeNull();
    expect(eventos("presente69_view")).toEqual([{ lugar: "cancelou_teste", preco: "R$ 69,90", de: "R$ 97,90", trial: false }]);
    expect(eventos("save_offer_view")).toHaveLength(0);
  });

  it("'Agora não' fecha o presente E a save-offer do mensal (uma oferta só por pessoa)", async () => {
    render(<SaveOfferDowngrade />);
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.queryByText("Mudar pro mensal", { exact: false })).toBeNull();
    expect(localStorage.getItem("core-presente69-cancelou-visto")).toBeTruthy();
    expect(localStorage.getItem("core-save-offer-visto")).toBeTruthy();
  });

  it("presente desligado no RevenueCat: a save-offer do mensal de sempre", async () => {
    estado.presente = null;
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText("Mudar pro mensal", { exact: false })).toBeInTheDocument();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("save_offer_view")).toHaveLength(1);
  });

  it("Android: a save-offer do mensal, como sempre", async () => {
    android();
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText("Mudar pro mensal", { exact: false })).toBeInTheDocument();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });

  it("cartão recusado (estadoTrialCancelado consertado devolve false): nenhuma oferta", async () => {
    estado.trialCancelado = false;
    render(<SaveOfferDowngrade />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.queryByText("Mudar pro mensal", { exact: false })).toBeNull();
  });
});
