/**
 * A/B DO VISUAL DO PAYWALL SEM TESTE (12/11 noite, dono) — SÓ iPhone (lib/paywall-teste `paywall_visual`).
 *  · o sorteio é estável por aparelho (FNV-1a com sal) e fica gravado; o Android é sempre "android";
 *  · a QA por URL (`?paywall-visual=android|enxovaly|auto`) e a chave remota (android|enxovaly|ab, a `current` vence);
 *  · as chaves novas são do APARELHO (sobrevivem às vassouras);
 *  · o braço "android" (PaywallW semTeste), conta VAZIA: anual 97,90 marcado (R$ 8,16/mês, economize 77%), mensal
 *    34,90, nenhum texto de teste/vitalício/"pra sempre"; compra core_anual_97_direto / core_mensal_34; Voltar ou folha
 *    cancelada → presente 69,90 sem teste; todo evento leva `paywall_visual: "android"`;
 *  · o braço "enxovaly" leva `paywall_visual: "enxovaly"` e mostra os mesmos preços;
 *  · o Android, com qualquer chave, segue no paywall de hoje (vitalício 97,90), só com o mensal trocado pra 34,90
 *    (core_mensal_34:coremensal34, 12/11 — ver android-mensal-34.test.tsx).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  ok: true, motivo: null as string | null,
  anual: { produto: "core_anual_97_direto", preco: "R$ 97,90", valor: 97.9, precoMes: "R$ 8,16", offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  mensal: { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  presente: { produto: "core_anual_69_direto", preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,83", offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn(async () => "pronto"),
  prefetchSemTeste: vi.fn(async () => undefined),
  prefetchVitalicio: vi.fn(async () => undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  dadosSemTeste: (p: "anual" | "mensal" | "presente") => loja[p],
  dadosMensalAndroid: () => loja.mensal,
  comprarSemTeste: vi.fn(async () => loja.ok),
  comprar: vi.fn(async () => true),
  comprarVitalicio: vi.fn(async () => true),
  comprarAnual97: vi.fn(async () => true),
  motivoUltimaCompra: () => loja.motivo,
  restaurar: vi.fn(async () => false),
  compraAssinaturaLocal: vi.fn(async () => false),
  compraVitaliciaLocal: vi.fn(async () => false),
  identificarRevenueCat: vi.fn(async () => undefined),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/notificacoes", () => ({ cancelarResgateDoPlano: vi.fn(async () => undefined), agendarResgateDoPlano: vi.fn(async () => undefined) }));

import { trackEvent } from "@/lib/analytics";
import { comprarSemTeste, comprarVitalicio, comprar as comprarRC } from "@/lib/revenuecat";
import {
  CHAVE_FORCA_PAYWALL_VISUAL, CHAVE_PAYWALL_VISUAL_APARELHO, CHAVE_PAYWALL_VISUAL_BRACO, PRODUTOS_SEM_TESTE,
  _zerarChavePaywallTeste, _zerarPaywallVisual, guardarForcaPaywallVisual, lerChaveRemotaPaywallVisual,
  modoPaywallTeste, registrarPaywallTesteRemoto, sortearVisualPaywall, visualDoPaywall,
} from "@/lib/paywall-teste";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";
import { PaywallW } from "@/pages/funis/w/PaywallW";
import { PaywallSemTeste } from "@/components/paywall/PaywallSemTeste";

const TEXTO_PROIBIDO = /teste|gr[aá]tis|3 dias|R\$ ?0,00|vital[ií]c|pra sempre|para sempre|pagamento [uú]nico|uma [uú]nica vez/i;
const plataforma = (p: "ios" | "android") => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; };
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const todosEventos = () => vi.mocked(trackEvent).mock.calls.map((c) => c[1] as Record<string, unknown>);
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const montarAndroid = (o: { onPago?: () => void; onVoltar?: () => void } = {}) => {
  const onPago = o.onPago ?? vi.fn();
  render(<MemoryRouter><PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} semTeste onVoltar={o.onVoltar} onPagoSemConta={onPago} /></MemoryRouter>);
  return onPago;
};
const esperarPrecos = () => waitFor(() => expect(screen.getByText(/Economize 77%/)).toBeTruthy());

beforeEach(() => {
  delete (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__;
  localStorage.clear(); // conta VAZIA, aparelho novo: nenhum seed
  window.history.replaceState({}, "", "/");
  _zerarChavePaywallTeste();
  _zerarPaywallVisual();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarSemTeste).mockClear();
  loja.ok = true; loja.motivo = null;
  plataforma("ios");
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__ = "on"; });

/* ─────────────────────────────── a chave ─────────────────────────────── */
describe("a chave `paywall_visual` (só iPhone)", () => {
  it("o sorteio é estável: o mesmo id dá sempre o mesmo braço; ids diferentes dão os dois braços (~50/50)", () => {
    expect(sortearVisualPaywall("aparelho-1")).toBe(sortearVisualPaywall("aparelho-1"));
    const n = 2000;
    let android = 0;
    for (let i = 0; i < n; i++) if (sortearVisualPaywall(`id-${i}`) === "android") android++;
    expect(android / n).toBeGreaterThan(0.45);
    expect(android / n).toBeLessThan(0.55);
  });
  it("padrão = ab: sorteia 1x, grava no aparelho e repete na reabertura", () => {
    const b = visualDoPaywall();
    expect(localStorage.getItem(CHAVE_PAYWALL_VISUAL_BRACO)).toBe(b);
    _zerarPaywallVisual(); // fechou o app
    expect(visualDoPaywall()).toBe(b);
    expect(visualDoPaywall()).toBe(b);
  });
  it("ANDROID é sempre \"android\" (e não sorteia nem grava nada), com qualquer chave ou força", () => {
    plataforma("android");
    localStorage.setItem(CHAVE_FORCA_PAYWALL_VISUAL, "enxovaly");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_visual: "enxovaly", paywall_teste: "off" } }, all: {} });
    expect(visualDoPaywall()).toBe("android");
    expect(localStorage.getItem(CHAVE_PAYWALL_VISUAL_BRACO)).toBeNull();
    expect(localStorage.getItem(CHAVE_PAYWALL_VISUAL_APARELHO)).toBeNull();
  });
  it("ANDROID fica como hoje: o paywall COM o fluxo de hoje com qualquer valor de `paywall_teste` (e qualquer força)", () => {
    plataforma("android");
    expect(modoPaywallTeste()).toBe("on");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_teste: "off" } }, all: {} });
    localStorage.setItem("paywall-teste-force", "off");
    expect(modoPaywallTeste()).toBe("on");
  });
  it("o site também fica como hoje", () => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    expect(modoPaywallTeste()).toBe("on");
    expect(visualDoPaywall()).toBe("android");
  });
  it("QA por URL: ?paywall-visual=android|enxovaly vence o sorteio e a chave; auto desfaz", () => {
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_visual: "enxovaly" } }, all: {} });
    window.history.replaceState({}, "", "/app?paywall-visual=android");
    expect(visualDoPaywall()).toBe("android");
    window.history.replaceState({}, "", "/app");
    expect(visualDoPaywall()).toBe("android"); // gravado no aparelho
    guardarForcaPaywallVisual("?paywall-visual=enxovaly");
    expect(visualDoPaywall()).toBe("enxovaly");
    guardarForcaPaywallVisual("?paywall-visual=auto");
    expect(localStorage.getItem(CHAVE_FORCA_PAYWALL_VISUAL)).toBeNull();
  });
  it("chave remota: android|enxovaly fixam, ab sorteia; a `current` vence; lixo = ninguém disse", () => {
    expect(lerChaveRemotaPaywallVisual({ current: { metadata: {} }, all: { x: { metadata: { paywall_visual: "enxovaly" } } } })).toBe("enxovaly");
    expect(lerChaveRemotaPaywallVisual({ current: { metadata: { paywall_visual: "android" } }, all: { x: { metadata: { paywall_visual: "enxovaly" } } } })).toBe("android");
    expect(lerChaveRemotaPaywallVisual({ current: { metadata: { paywall_visual: "xyz" } }, all: {} })).toBeNull();
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_visual: "enxovaly" } }, all: {} });
    expect(visualDoPaywall()).toBe("enxovaly");
    expect(localStorage.getItem(CHAVE_PAYWALL_VISUAL_APARELHO)).toBe("enxovaly");
    _zerarPaywallVisual(); // reabriu antes de o RevenueCat responder: vale a última resposta
    expect(visualDoPaywall()).toBe("enxovaly");
  });
  it("as chaves novas são do aparelho (sobrevivem às vassouras do cache)", () => {
    expect(CHAVES_DO_APARELHO.has(CHAVE_PAYWALL_VISUAL_APARELHO)).toBe(true);
    expect(CHAVES_DO_APARELHO.has(CHAVE_PAYWALL_VISUAL_BRACO)).toBe(true);
  });
  it("o anual sem teste é core_anual_97_direto (nunca o core_anual_97 com teste, nem o 99)", () => {
    expect(PRODUTOS_SEM_TESTE).toEqual({ anual: "core_anual_97_direto", mensal: "core_mensal_34", presente: "core_anual_69_direto" });
  });
});

/* ─────────────────────── braço "android" (PaywallW semTeste) ─────────────────────── */
describe("braço android: o desenho do Android vendendo sem teste (conta vazia)", () => {
  it("anual 97,90 marcado (R$ 8,16/mês, economize 77%), mensal 34,90, e NENHUM texto de teste/vitalício", async () => {
    montarAndroid();
    await esperarPrecos();
    const tela = screen.getByTestId("paywall-w-sem-teste");
    expect(tela.dataset.plano).toBe("anual");
    expect(tela.textContent).toContain("R$ 97,90");
    expect(tela.textContent).toContain("R$ 8,16/mês");
    expect(tela.textContent).toContain("R$ 34,90");
    expect(tela.textContent).toContain("Quero o anual — R$ 97,90/ano");
    expect(tela.textContent).toContain("Assinatura de R$ 97,90/ano pela App Store · renova automaticamente até você cancelar");
    expect(tela.textContent).not.toMatch(TEXTO_PROIBIDO);
    expect(tela.textContent).not.toMatch(/24,90|99,90/);
    expect(eventos("funnel_view")[0]).toMatchObject({ step: "offer", paywall_visual: "android", paywall_teste: "off" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ produto: "core_anual_97_direto", trial: false, paywall_visual: "android" });
  });
  it("loja calada: a reserva de texto (97,90 / 34,90 / 8,16 / 77%)", async () => {
    const a = loja.anual, m = loja.mensal;
    loja.anual = null; loja.mensal = null;
    montarAndroid();
    await espera();
    const tela = screen.getByTestId("paywall-w-sem-teste");
    expect(tela.textContent).toContain("R$ 97,90");
    expect(tela.textContent).toContain("R$ 8,16/mês");
    expect(tela.textContent).toContain("Economize 77%");
    expect(tela.textContent).toContain("R$ 34,90");
    expect(tela.textContent).not.toMatch(TEXTO_PROIBIDO);
    loja.anual = a; loja.mensal = m;
  });
  it("mensal marcado: a tela acompanha; compra o core_mensal_34; o evento leva o braço e o plano", async () => {
    const onPago = montarAndroid();
    await esperarPrecos();
    fireEvent.click(screen.getAllByText(/cancele quando quiser/i)[0]); // a coluna do mensal (vem antes do selo "Cancele quando quiser")
    const tela = screen.getByTestId("paywall-w-sem-teste");
    expect(tela.dataset.plano).toBe("mensal");
    expect(tela.textContent).toContain("Começar por R$ 34,90/mês");
    expect(tela.textContent).toContain("Assinatura de R$ 34,90/mês pela App Store");
    fireEvent.click(screen.getByText(/Começar por R\$ 34,90/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenCalledWith("mensal", "ios");
    expect(comprarVitalicio).not.toHaveBeenCalled();
    expect(comprarRC).not.toHaveBeenCalled();
    expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).toMatchObject({ plano: "mensal", produto: "core_mensal_34", paywall_visual: "android" });
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_mensal_34", trial: false, paywall_visual: "android" });
  });
  it("anual: compra o core_anual_97_direto e segue", async () => {
    const onPago = montarAndroid();
    await esperarPrecos();
    fireEvent.click(screen.getByText(/Quero o anual/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenCalledWith("anual", "ios");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_97_direto", paywall_visual: "android" });
  });
  it("CANCELOU A FOLHA → presente 69,90 sem teste; comprar entra com o braço no evento", async () => {
    loja.ok = false; loja.motivo = "cancelou";
    const onPago = montarAndroid();
    await esperarPrecos();
    fireEvent.click(screen.getByText(/Quero o anual/));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    const p = screen.getByTestId("presente-direto");
    expect(p.textContent).toContain("R$ 69,90");
    expect(p.textContent).not.toMatch(TEXTO_PROIBIDO);
    expect(eventos("presente69_view")[0]).toMatchObject({ lugar: "folha_cancelada", paywall_visual: "android", trial: false });
    loja.ok = true; loja.motivo = null;
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    fireEvent.click(screen.getByTestId("presente-direto-cta"));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenLastCalledWith("presente", "ios");
    expect(eventos("presente69_sucesso")[0]).toMatchObject({ paywall_visual: "android" });
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_69_direto", oferta: "presente69_direto" });
  });
  it("VOLTAR redondo → presente (sem recuar); Agora não → o paywall; o próximo Voltar recua", async () => {
    const onVoltar = vi.fn();
    montarAndroid({ onVoltar });
    await esperarPrecos();
    fireEvent.click(screen.getByTestId("paywall-w-voltar"));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    await espera(500);
    expect(onVoltar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("presente-direto-agora-nao"));
    expect(screen.queryByTestId("presente-direto")).toBeNull();
    fireEvent.click(screen.getByTestId("paywall-w-voltar"));
    await espera(500);
    expect(onVoltar).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("presente-direto")).toBeNull();
  });
  it("todo evento do braço leva paywall_visual: android", async () => {
    loja.ok = false; loja.motivo = "cancelou";
    montarAndroid();
    await esperarPrecos();
    fireEvent.click(screen.getAllByText(/cancele quando quiser/i)[0]); // a coluna do mensal (vem antes do selo "Cancele quando quiser")
    fireEvent.click(screen.getByText(/Começar por/));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    cleanup(); // saiu
    const evs = todosEventos();
    expect(evs.length).toBeGreaterThan(4);
    for (const e of evs) expect(e).toMatchObject({ paywall_visual: "android" });
    expect(eventos("paywall_saiu")[0]).toMatchObject({ viu_oferta: true });
  });
});

/* ─────────────────────── braço "enxovaly" (PaywallSemTeste) ─────────────────────── */
describe("braço enxovaly: os mesmos preços, o braço nos eventos", () => {
  it("97,90 / 34,90 / presente 69,90, sem texto de teste; eventos com paywall_visual: enxovaly", async () => {
    loja.ok = false; loja.motivo = "cancelou";
    render(<MemoryRouter><PaywallSemTeste area="dinheiro" answers={{}} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("sem-teste-anual").textContent).toContain("R$ 97,90"));
    const tela = screen.getByTestId("paywall-sem-teste");
    expect(tela.textContent).toContain("R$ 8,16/mês");
    expect(tela.textContent).toContain("ECONOMIZE 77%");
    expect(tela.textContent).toContain("R$ 34,90");
    expect(tela.textContent).not.toMatch(TEXTO_PROIBIDO);
    expect(tela.querySelector("img")?.getAttribute("src")).toBe("/paywall-sem-teste-foto.jpg");
    fireEvent.click(screen.getByTestId("sem-teste-cta"));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    expect(screen.getByTestId("presente-direto").textContent).toContain("R$ 69,90");
    for (const e of todosEventos()) expect(e).toMatchObject({ paywall_visual: "enxovaly" });
  });
});

/* ─────────────────────── Android: o paywall de hoje ─────────────────────── */
describe("Android: o PaywallW de hoje, só com o mensal em 34,90", () => {
  it("vitalício 97,90 + mensal 34,90; compra o core_vitalicio_97; nada de anual/24,90/69,90", async () => {
    plataforma("android");
    const onPago = vi.fn();
    render(<MemoryRouter><PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
    await espera();
    const corpo = document.body.textContent ?? "";
    expect(corpo).toContain("Pra sempre");
    expect(corpo).toMatch(/34,90/);
    expect(corpo).toMatch(/97,90/);
    expect(corpo).not.toMatch(/24,90|69,90|99,90/);
    expect(screen.queryByTestId("paywall-w-sem-teste")).toBeNull();
    expect(screen.queryByTestId("paywall-w-voltar")).toBeNull();
    fireEvent.click(screen.getByText(/Quero pra sempre/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarVitalicio).toHaveBeenCalledWith("core_vitalicio_97");
    expect(comprarSemTeste).not.toHaveBeenCalled();
    for (const e of todosEventos()) expect(e).not.toHaveProperty("paywall_visual");
  });
});
