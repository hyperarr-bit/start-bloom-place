/**
 * TESTE DE TÍTULO DO PAYWALL MINIMALISTA DO iPHONE (06/11, chave `titulo_paywall`, lib/titulo-paywall):
 * chave off = hoje, byte a byte; sorteio estável; sem área escolhida (sem porta, "Tudo", gate) = hoje;
 * o braço vai nos eventos do paywall, do toque e da folha. (mocks da loja copiados de sino-paywall-eventos.test.tsx)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({ trial: true, dias: 3 }));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: vi.fn(async () => "pendente"),
  cancelarLembreteDoTeste: vi.fn(async () => undefined),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: vi.fn(async () => ({ ok: true })),
  cancelarRecuperacaoDoPaywall: vi.fn(async () => undefined),
  agendarResgateDoPlano: vi.fn(async () => undefined),
  cancelarResgateDoPlano: vi.fn(async () => undefined),
  cancelarReguaDoTeste: vi.fn(async () => undefined),
  estadoPermissao: vi.fn(async () => "granted"),
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn(async () => "pronto"),
  prefetchAnualIos: vi.fn(async () => undefined),
  temAnualIos: () => true,
  precoAnualIos: () => "R$ 97,90",
  idProdutoAnualIos: () => "core_anual_97",
  mesesDeMensalQuePagamOAno: () => 4,
  ofertaAnualIos: () => "anual_97",
  dadosDaOfertaIos: () => ({ oferta: "anual_97", produto: "core_anual_97", offering: "default", preco: "R$ 97,90", pacote: true }),
  precoMensalDoAnualIos: () => "R$ 8,16",
  diasTrialIos: () => (loja.trial ? loja.dias : 0),
  anualIosTemTrial: () => loja.trial,
  ultimaCompraAnualFoiTrial: () => loja.trial,
  fimDaUltimaCompraTrial: () => null,
  comprarAnualIos: vi.fn(async () => true),
  comprar: vi.fn(async () => true),
  estadoRevenueCat: () => "pronto",
  restaurar: vi.fn(async () => false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null,
  tipoUltimaFalha: () => null,
  codigoUltimaFalha: () => null,
  sincronizarAssinatura: vi.fn(),
  valorAnualIos: () => 97.9,
  valorMensalIos: () => 24.9,
  precoMensalIos: () => "R$ 24,90",
  economiaDoAnualIos: () => 67,
  precoDoTesteIos: () => (loja.trial ? "R$ 0,00" : null),
  situacaoDoPresente: vi.fn(async () => null),
  carregarPresente69: vi.fn(async () => null),
  carregarMensal19: vi.fn(async () => null),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";
import { CHAVE_FORCA_OFERTAS, _zerarChavesRemotas } from "@/lib/ofertas-saida";
import { CHAVE_FORCA_PAYWALL_MINIMALISTA, _zerarRemotaMinimalista } from "@/lib/paywall-minimalista";
import {
  CHAVE_BRACO_TITULO, CHAVE_FORCA_TITULO, CHAVE_TITULO_APARELHO, _zerarTituloRemoto, areaDoTitulo, bracoTitulo, camposDoTituloNaFolha,
  estiloDoTituloDaArea, guardarForcaTitulo, lerTituloRemoto, modoTitulo, registrarTituloRemoto, sortearBracoTitulo, tituloDaArea,
} from "@/lib/titulo-paywall";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";
import type { AreaKey } from "@/lib/funnel";

const G = globalThis as { __MODO_1012__?: unknown };
const DINHEIRO = { area: "dinheiro", area_label: "Meu dinheiro" };
const ROTINA = { area: "rotina", area_label: "Minha rotina e hábitos" };
const TUDO = { area: "dinheiro", area_label: "Tudo, sinceramente" };
const remoto = (v: string) => registrarTituloRemoto({ current: { identifier: "default", metadata: { titulo_paywall: v } }, all: {} });
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const beacons = (nome: string) => vi.mocked(trackEventBeacon).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const cta = (cta: string) => eventos("funnel_click").filter((e) => e.cta === cta);
const montar = async (area: AreaKey, answers: Record<string, string>, modo: "funil" | "gate" = "funil") => {
  render(<MemoryRouter><PaywallIOS area={area} answers={answers} modo={modo} onPagoSemConta={() => undefined} /></MemoryRouter>);
  await waitFor(() => expect(eventos("paywall_oferta_vista").length).toBe(1));
};
const titulo = () => screen.getByTestId("ios-mini-titulo");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(CHAVE_FORCA_OFERTAS, "curto");
  localStorage.setItem(CHAVE_FORCA_PAYWALL_MINIMALISTA, "on");
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  delete G.__MODO_1012__;
  loja.trial = true;
  _zerarTituloRemoto(); _zerarChavesRemotas(); _zerarRemotaMinimalista();
  vi.mocked(trackEvent).mockClear(); vi.mocked(trackEventBeacon).mockClear();
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; delete G.__MODO_1012__; });

describe("a chave", () => {
  it("sem resposta, ausente ou estranha = off; a current vence", () => {
    expect(modoTitulo()).toBe("off");
    expect(lerTituloRemoto(null)).toBe("off");
    expect(lerTituloRemoto({ current: { metadata: { titulo_paywall: "talvez" } }, all: {} })).toBe("off");
    expect(lerTituloRemoto({ current: { metadata: { titulo_paywall: "off" } }, all: { x: { metadata: { titulo_paywall: "ab" } } } })).toBe("off");
    expect(lerTituloRemoto({ current: { metadata: {} }, all: { x: { metadata: { titulo_paywall: "ab" } } } })).toBe("ab");
  });
  it("a última resposta fica no aparelho e a força de QA vence", () => {
    remoto("ab");
    expect(localStorage.getItem(CHAVE_TITULO_APARELHO)).toBe("ab");
    _zerarTituloRemoto();
    expect(modoTitulo()).toBe("ab");
    guardarForcaTitulo("?titulo-paywall=off");
    expect(modoTitulo()).toBe("off");
    guardarForcaTitulo("?titulo-paywall=auto");
    expect(localStorage.getItem(CHAVE_FORCA_TITULO)).toBeNull();
  });
  it("modo 1.0.12 (paywall longo): sempre off, mesmo com a metadata ligando", () => {
    G.__MODO_1012__ = true;
    remoto("on");
    expect(modoTitulo()).toBe("off");
    expect(bracoTitulo("dinheiro", DINHEIRO)).toBeNull();
  });
  it("as chaves do braço sobrevivem à vassoura do cache", () => {
    expect(CHAVES_DO_APARELHO.has(CHAVE_TITULO_APARELHO)).toBe(true);
    expect(CHAVES_DO_APARELHO.has(CHAVE_BRACO_TITULO)).toBe(true);
  });
});

describe("o sorteio", () => {
  it("é estável por aparelho e divide perto de 50/50", () => {
    expect(sortearBracoTitulo("aparelho-1")).toBe(sortearBracoTitulo("aparelho-1"));
    const n = Array.from({ length: 2000 }, (_, i) => sortearBracoTitulo(`aparelho-${i}`)).filter((b) => b === "com").length;
    expect(n).toBeGreaterThan(900);
    expect(n).toBeLessThan(1100);
  });
  it("grava na 1ª vez e o gravado vale nas próximas aberturas", () => {
    remoto("ab");
    const b = bracoTitulo("dinheiro", DINHEIRO);
    expect(localStorage.getItem(CHAVE_BRACO_TITULO)).toBe(b);
    expect(bracoTitulo("dinheiro", DINHEIRO)).toBe(b);
    const outro = b === "com" ? "sem" : "com";
    localStorage.setItem(CHAVE_BRACO_TITULO, outro);
    expect(bracoTitulo("dinheiro", DINHEIRO)).toBe(outro);
  });
  it("chave off ou pessoa fora do teste: não sorteia nem grava", () => {
    expect(bracoTitulo("dinheiro", DINHEIRO)).toBeNull();
    remoto("ab");
    expect(bracoTitulo("dinheiro", TUDO)).toBeNull();
    expect(localStorage.getItem(CHAVE_BRACO_TITULO)).toBeNull();
  });
});

describe("quem escolheu a área", () => {
  it("só a resposta da porta conta: sem porta, 'Tudo', corpo e área diferente ficam fora", () => {
    expect(areaDoTitulo("dinheiro", DINHEIRO)).toBe("dinheiro");
    expect(areaDoTitulo("rotina", ROTINA)).toBe("rotina");
    expect(areaDoTitulo("metas", { area: "metas" })).toBe("metas");
    expect(areaDoTitulo("dinheiro", {})).toBeNull();
    expect(areaDoTitulo("dinheiro", TUDO)).toBeNull();
    expect(areaDoTitulo("corpo", { area: "corpo" })).toBeNull();
    expect(areaDoTitulo("dinheiro", ROTINA)).toBeNull();
    expect(tituloDaArea("corpo")).toBeNull();
  });
  it("só o título de dinheiro tem teto de largura", () => {
    expect(estiloDoTituloDaArea("Organize seu dinheiro")?.fontSize).toContain("100vw");
    expect(estiloDoTituloDaArea("Organize sua rotina")).toBeUndefined();
  });
});

describe("a tela", () => {
  it("chave off: o título e os eventos de hoje", async () => {
    await montar("dinheiro", DINHEIRO);
    expect(titulo().textContent).toBe("Experimente 3 dias grátis");
    expect(titulo().getAttribute("style")).toBeNull();
    fireEvent.click(screen.getByTestId("ios-mini-cta"));
    await waitFor(() => expect(eventos("app_sheet_success").length).toBe(1));
    for (const e of [...eventos("funnel_view"), ...eventos("paywall_oferta_vista"), ...cta("app_paywall_cta"), ...eventos("app_sheet_success")]) expect(e).not.toHaveProperty("titulo_area");
    expect(localStorage.getItem(CHAVE_BRACO_TITULO)).toBeNull();
  });

  it("braço com: dinheiro e rotina, nas 2 linhas, com os dias da loja", async () => {
    remoto("on");
    loja.dias = 7;
    await montar("dinheiro", DINHEIRO);
    await waitFor(() => expect(titulo().textContent).toBe("Organize seu dinheiro 7 dias grátis"));
    expect(titulo().querySelectorAll("br").length).toBe(1);
    cleanup(); vi.mocked(trackEvent).mockClear(); loja.dias = 3;
    await montar("rotina", ROTINA);
    await waitFor(() => expect(titulo().textContent).toBe("Organize sua rotina 3 dias grátis"));
  });

  it("braço sem: o título de hoje, com o braço nos eventos", async () => {
    remoto("ab");
    localStorage.setItem(CHAVE_BRACO_TITULO, "sem");
    await montar("dinheiro", DINHEIRO);
    expect(titulo().textContent).toBe("Experimente 3 dias grátis");
    expect(eventos("paywall_oferta_vista")[0].titulo_area).toBe("sem");
  });

  it.each([
    ["sem resposta da porta", "dinheiro", {}, "funil"],
    ["porta 'Tudo'", "dinheiro", TUDO, "funil"],
    ["corpo", "corpo", { area: "corpo" }, "funil"],
    ["gate (padrão dinheiro)", "dinheiro", {}, "gate"],
    ["gate mesmo com área", "dinheiro", DINHEIRO, "gate"],
  ] as const)("%s: igual a hoje com a chave ligada, sem braço nos eventos", async (_n, area, answers, modo) => {
    remoto("on");
    await montar(area, answers, modo);
    expect(titulo().textContent).toBe("Experimente 3 dias grátis");
    for (const e of [...eventos("funnel_view"), ...eventos("paywall_oferta_vista")]) expect(e).not.toHaveProperty("titulo_area");
  });

  it("sem teste grátis: 'Assine o plano anual' e sem braço na oferta", async () => {
    remoto("on");
    loja.trial = false;
    await montar("dinheiro", DINHEIRO);
    await waitFor(() => expect(titulo().textContent).toBe("Assine o plano anual"));
    expect(eventos("paywall_oferta_vista")[0]).not.toHaveProperty("titulo_area");
    expect(camposDoTituloNaFolha()).toEqual({});
  });

  it("no plano mensal o título é o de sempre", async () => {
    remoto("on");
    await montar("dinheiro", DINHEIRO);
    fireEvent.click(screen.getByTestId("ios-mini-trocar-plano"));
    await waitFor(() => expect(titulo().textContent).toBe("Assine o plano mensal"));
  });

  it("o braço vai no paywall, no toque e na folha", async () => {
    remoto("ab");
    localStorage.setItem(CHAVE_BRACO_TITULO, "com");
    await montar("dinheiro", DINHEIRO);
    expect(eventos("funnel_view").find((e) => e.step === "offer")?.titulo_area).toBe("com");
    expect(eventos("paywall_oferta_vista")[0].titulo_area).toBe("com");
    await waitFor(() => expect(camposDoTituloNaFolha()).toEqual({ titulo_area: "com" })); // folha_apple_resultado
    fireEvent.click(screen.getByTestId("ios-mini-cta"));
    expect(cta("app_paywall_cta")[0].titulo_area).toBe("com");
    await waitFor(() => expect(eventos("app_sheet_success").length).toBe(1));
    expect(eventos("app_sheet_success")[0].titulo_area).toBe("com");
    expect(beacons("app_sheet_success")).toEqual([]);
  });

  it("ao sair do paywall o braço não vaza pra folha de outra tela", async () => {
    remoto("on");
    await montar("dinheiro", DINHEIRO);
    await waitFor(() => expect(camposDoTituloNaFolha()).toEqual({ titulo_area: "com" }));
    cleanup();
    expect(camposDoTituloNaFolha()).toEqual({});
  });
});
