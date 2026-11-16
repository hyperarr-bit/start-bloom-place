/**
 * MENSAL DO ANDROID → R$ 34,90 (12/11, dono: "troca o mensal do Android pra 34,90 também").
 *  · Android, funil (PaywallW) e gate/planos (PaywallAssinatura): o mensal com renovação é core_mensal_34, comprado
 *    pelo plano-base (`core_mensal_34:coremensal34`), preço da loja com reserva "R$ 34,90"; "3 meses de mensal".
 *  · Fica igual: o vitalício 97,90 (core_vitalicio_97), o resgate "ou começa com 1 mês" 24,90 à vista
 *    (coremensalvista) e o iPhone (fluxo com teste: core_mensal 24,90 da offering atual).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  mensal34: { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  motivo: null as string | null,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn(async () => "pronto"),
  prefetchSemTeste: vi.fn(async () => undefined),
  prefetchVitalicio: vi.fn(async () => undefined),
  prefetchAssinaturas: vi.fn(async () => undefined),
  prefetchAnualIos: vi.fn(async () => undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  temAnual97: () => false,
  temMensalVista: () => true,
  temAnualIos: () => false,
  dadosSemTeste: () => null,
  dadosMensalAndroid: () => loja.mensal34,
  comprarMensalAndroid: vi.fn(async () => true),
  comprarSemTeste: vi.fn(async () => true),
  comprar: vi.fn(async () => true),
  comprarMensalVista: vi.fn(async () => true),
  comprarVitalicio: vi.fn(async () => true),
  comprarAnual97: vi.fn(async () => true),
  motivoUltimaCompra: () => loja.motivo,
  restaurar: vi.fn(async () => false),
  compraAssinaturaLocal: vi.fn(async () => false),
  compraVitaliciaLocal: vi.fn(async () => false),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ data: {}, get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/teste-gratis", async (original) => ({ ...(await original<typeof import("@/lib/teste-gratis")>()), estadoTeste: () => ({ fase: "nunca" }), limparGuiaSemente: vi.fn() }));
vi.mock("@/lib/notificacoes", () => ({
  agendarResgateDoPlano: vi.fn(async () => undefined), cancelarResgateDoPlano: vi.fn(async () => undefined),
  cancelarReguaDoTeste: vi.fn(async () => undefined), pedirLembreteDoTeste: vi.fn(async () => "pendente"),
}));

import { trackEvent } from "@/lib/analytics";
import { comprar as comprarRC, comprarMensalAndroid, comprarMensalVista, comprarSemTeste, comprarVitalicio } from "@/lib/revenuecat";
import { ID_MENSAL_ANDROID } from "@/lib/paywall-teste";
import { PaywallW } from "@/pages/funis/w/PaywallW";
import { PaywallAssinatura } from "@/components/paywall/PaywallAssinatura";

const plataforma = (p: "ios" | "android") => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; };
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const corpo = () => document.body.textContent ?? "";
const montarW = (onPago = vi.fn()) => {
  render(<MemoryRouter><PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
  return onPago;
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  loja.motivo = null;
  loja.mensal34 = { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true };
  plataforma("android");
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("Android, funil (PaywallW): mensal 34,90", () => {
  it("o id é o plano-base da Play", () => {
    expect(ID_MENSAL_ANDROID).toBe("core_mensal_34:coremensal34");
  });
  it("mostra mensal 34,90 + vitalício 97,90 (nada de 24,90); a conta vira \"3 meses de mensal\"", async () => {
    montarW();
    await espera();
    expect(corpo()).toMatch(/34,90/);
    expect(corpo()).toMatch(/97,90/);
    expect(corpo()).not.toMatch(/24,90/);
    expect(corpo()).toMatch(/3 meses de mensal/);
    expect(corpo()).not.toMatch(/4 meses de mensal/);
  });
  it("o preço vem da loja (a reserva só segura até ela responder)", async () => {
    loja.mensal34 = { ...loja.mensal34!, preco: "R$ 35,90", valor: 35.9 };
    montarW();
    await waitFor(() => expect(corpo()).toMatch(/35,90/));
  });
  it("mensal: compra core_mensal_34:coremensal34 pelo motor sem teste (nunca o core_mensal de 24,90)", async () => {
    const onPago = montarW();
    await espera();
    fireEvent.click(screen.getAllByText("mês")[0]);
    fireEvent.click(screen.getByText(/Começar por R\$ 34,90\/mês/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarMensalAndroid).toHaveBeenCalledWith("funil_w");
    expect(comprarRC).not.toHaveBeenCalled();
    const sucesso = vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "app_sheet_success").map((c) => c[1]);
    expect(sucesso).toEqual([expect.objectContaining({ produto: "core_mensal_34:coremensal34" })]);
    expect(corpo()).toMatch(/Assinatura de R\$ 34,90\/mês pelo Google Play/);
  });
  it("o vitalício segue igual: core_vitalicio_97", async () => {
    const onPago = montarW();
    await espera();
    fireEvent.click(screen.getByText(/Quero pra sempre/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarVitalicio).toHaveBeenCalledWith("core_vitalicio_97");
    expect(comprarMensalAndroid).not.toHaveBeenCalled();
  });
});

describe("Android, gate e /planos (PaywallAssinatura): mensal 34,90, resgate 24,90 à vista intacto", () => {
  for (const contexto of ["gate", "planos"] as const) {
    it(`${contexto}: coluna 34,90 compra core_mensal_34; legal de assinatura; vitalício 97,90 e "3 meses de mensal"`, async () => {
      render(<MemoryRouter><PaywallAssinatura contexto={contexto} /></MemoryRouter>);
      await waitFor(() => expect(screen.getByText("R$ 34,90")).toBeTruthy());
      expect(corpo()).toMatch(/97,90/);
      expect(corpo()).toMatch(/3 meses de mensal/);
      expect(corpo()).not.toMatch(/24,90/);
      fireEvent.click(screen.getByText("R$ 34,90"));
      expect(corpo()).toMatch(/Assinatura de R\$ 34,90\/mês pelo Google Play · renova todo mês · cancele quando quiser/);
      fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
      await waitFor(() => expect(comprarMensalAndroid).toHaveBeenCalledWith(contexto));
      expect(comprarRC).not.toHaveBeenCalled();
      expect(comprarMensalVista).not.toHaveBeenCalled();
    });
  }
  it("o resgate \"ou começa com 1 mês — R$ 24,90\" (depois de recusar o vitalício) segue no à vista (coremensalvista)", async () => {
    localStorage.setItem("core-debug-resgate-pix", "1"); // a caixa do resgate aberta, como depois da 1ª recusa rápida
    render(<MemoryRouter><PaywallAssinatura contexto="gate" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/ou começa com 1 mês — R\$ 24,90/)).toBeTruthy());
    fireEvent.click(screen.getByText(/ou começa com 1 mês — R\$ 24,90/));
    await waitFor(() => expect(comprarMensalVista).toHaveBeenCalled());
    expect(comprarMensalAndroid).not.toHaveBeenCalled();
    expect(comprarRC).not.toHaveBeenCalled();
  });
});

describe("iPhone não muda", () => {
  it("PaywallW com teste (paywall_teste on): mensal 24,90 do core_mensal, nada de 34,90", async () => {
    plataforma("ios");
    const onPago = montarW();
    await espera();
    expect(corpo()).toMatch(/24,90/);
    expect(corpo()).not.toMatch(/34,90/);
    fireEvent.click(screen.getAllByText("mês")[0]);
    fireEvent.click(screen.getByText(/Começar por R\$ 24,90\/mês/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarRC).toHaveBeenCalledWith("core_mensal", { semTrial: true });
    expect(comprarMensalAndroid).not.toHaveBeenCalled();
    expect(comprarSemTeste).not.toHaveBeenCalled();
  });
});
