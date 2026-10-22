/**
 * O BRAÇO DO SINO NOS EVENTOS DO PAYWALL DO iPHONE (1.0.18, chave `sino_paywall`, lib/sino-paywall):
 *   · chave off → `funnel_view step=offer`, `paywall_oferta_vista` e `app_sheet_success` SEM o campo `sino` (de hoje);
 *   · on/ab → os três levam `sino: "com"|"sem"` (o braço sorteado) — a comparação paywall→folha→teste por braço;
 *   · o gate (TrialBanner, conta logada) nunca leva o campo.
 * (mocks da loja copiados de paywall-minimalista.test.tsx)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9 as number | null, precoMensal: "R$ 24,90" as string | null,
  precoTeste: "R$ 0,00" as string | null, dias: 3, trial: true,
  compraOk: true, motivo: null as string | null, compraPresenteOk: true,
  tipo: null as string | null, codigo: null as string | null, restauraOk: false,
  presente: { preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3, precoTeste: "R$ 0,00" } as null | { preco: string; valor?: number; precoMes: string | null; produto: string; comTrial: boolean; dias: number; precoTeste?: string | null },
  permissao: "granted" as "granted" | "denied" | "prompt" | "indisponivel",
  metadataMini: null as null | "on" | "off",
}));
const notif = vi.hoisted(() => ({
  pedirLembrete: vi.fn(async (_p: { fimMs: number; precoAno: string }) => "pendente" as const),
  permissao: vi.fn(async () => loja.permissao),
}));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: (p: { fimMs: number; precoAno: string }) => notif.pedirLembrete(p),
  cancelarLembreteDoTeste: vi.fn(async () => undefined),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: vi.fn(async () => ({ ok: true })),
  cancelarRecuperacaoDoPaywall: vi.fn(async () => undefined),
  estadoPermissao: () => notif.permissao(),
}));
const id97 = (preco: string) => (preco === "R$ 69,90" ? "core_anual_69" : "core_anual_97");
vi.mock("@/lib/revenuecat", async (original) => {
  const mini = await import("@/lib/paywall-minimalista");
  return {
    ...(await original<typeof import("@/lib/revenuecat")>()),
    // a metadata das offerings chega junto com a loja (o revenuecat.ts real registra em registrarChavesDasOfferings)
    initRevenueCat: vi.fn(async () => {
      if (loja.metadataMini) mini.registrarChavePaywallMinimalista({ current: { identifier: "d", metadata: { paywall_minimalista: loja.metadataMini } }, all: {} });
      return "pronto";
    }),
    prefetchAnualIos: vi.fn(async () => undefined),
    temAnualIos: () => true,
    precoAnualIos: () => loja.preco,
    idProdutoAnualIos: () => id97(loja.preco),
    mesesDeMensalQuePagamOAno: () => 4,
    ofertaAnualIos: () => id97(loja.preco).replace("core_", ""),
    dadosDaOfertaIos: () => ({ oferta: id97(loja.preco).replace("core_", ""), produto: id97(loja.preco), offering: "default", preco: loja.preco, pacote: true }),
    precoMensalDoAnualIos: () => loja.mes,
    diasTrialIos: () => (loja.trial ? loja.dias : 0),
    anualIosTemTrial: () => loja.trial,
    ultimaCompraAnualFoiTrial: () => loja.trial,
    fimDaUltimaCompraTrial: () => null,
    comprarAnualIos: vi.fn(async () => loja.compraOk),
    comprar: vi.fn(async () => loja.compraOk),
    estadoRevenueCat: () => "pronto",
    restaurar: vi.fn(async () => loja.restauraOk),
    compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
    compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
    motivoUltimaCompra: () => loja.motivo,
    tipoUltimaFalha: () => loja.tipo,
    codigoUltimaFalha: () => loja.codigo,
    sincronizarAssinatura: vi.fn(),
    valorAnualIos: () => loja.valorAnual,
    valorMensalIos: () => loja.valorMensal,
    precoMensalIos: () => loja.precoMensal,
    economiaDoAnualIos: () => (loja.valorAnual && loja.valorMensal ? Math.round((1 - loja.valorAnual / (12 * loja.valorMensal)) * 100) : null),
    precoDoTesteIos: () => (loja.trial ? loja.precoTeste : null),
    situacaoDoPresente: vi.fn(async () => null),
    carregarPresente69: vi.fn(async () => loja.presente),
    comprarPresente69: vi.fn(async () => loja.compraPresenteOk),
    carregarMensal19: vi.fn(async () => null),
    marcarToqueDeCompra: vi.fn(),
  };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { CHAVE_FORCA_OFERTAS, _zerarChavesRemotas } from "@/lib/ofertas-saida";
import { _zerarRemotaMinimalista } from "@/lib/paywall-minimalista";
import { CHAVE_BRACO_SINO, _zerarSinoRemoto, registrarSinoRemoto } from "@/lib/sino-paywall";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const remoto = (v: string) => registrarSinoRemoto({ current: { identifier: "default", metadata: { sino_paywall: v } }, all: {} });
const montar = (modo: "funil" | "gate" = "funil") => {
  const onPago = vi.fn();
  render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} modo={modo} /></MemoryRouter>);
  return onPago;
};
const esperarLoja = () => waitFor(() => expect(eventos("paywall_oferta_vista")).toHaveLength(1));
const comprar = async (onPago: () => void) => {
  fireEvent.click(screen.getByRole("button", { name: "Começar teste grátis" }));
  await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
};

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  _zerarRemotaMinimalista();
  _zerarSinoRemoto();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  ios();
  localStorage.setItem(CHAVE_FORCA_OFERTAS, "curto");
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("o braço do sino nos eventos do paywall", () => {
  it("chave off: nenhum evento leva `sino` (os eventos de hoje)", async () => {
    const onPago = montar();
    await esperarLoja();
    await comprar(onPago);
    for (const n of ["funnel_view", "paywall_oferta_vista", "app_sheet_success"]) {
      expect(eventos(n).length).toBeGreaterThan(0);
      for (const e of eventos(n)) expect(e).not.toHaveProperty("sino");
    }
  });

  it("ab, braço 'sem': funnel_view offer, paywall_oferta_vista e app_sheet_success levam sino: 'sem'", async () => {
    remoto("ab");
    localStorage.setItem(CHAVE_BRACO_SINO, "sem");
    const onPago = montar();
    await esperarLoja();
    expect(eventos("funnel_view").find((e) => e.step === "offer")).toMatchObject({ sino: "sem", loja: "ios" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ sino: "sem" });
    await comprar(onPago);
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_97", sino: "sem" });
  });

  it("on: sino: 'com'", async () => {
    remoto("on");
    const onPago = montar();
    await esperarLoja();
    expect(eventos("funnel_view").find((e) => e.step === "offer")).toMatchObject({ sino: "com" });
    await comprar(onPago);
    expect(eventos("app_sheet_success")[0]).toMatchObject({ sino: "com" });
  });

  it("gate (conta logada no TrialBanner): nunca leva o campo", async () => {
    remoto("on");
    montar("gate");
    await esperarLoja();
    expect(eventos("funnel_view").find((e) => e.step === "offer")).not.toHaveProperty("sino");
    expect(eventos("paywall_oferta_vista")[0]).not.toHaveProperty("sino");
  });
});
