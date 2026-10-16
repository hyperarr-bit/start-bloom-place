/**
 * OFERTAS DE SAÍDA DO PAYWALL DO iPHONE (10/10, 1.0.14) — as 4 chaves de lib/ofertas-saida.
 *
 *  · TUDO OFF (o padrão) = o paywall de hoje: nenhum texto, selo, folha ou evento novo —
 *    nem no Voltar, nem na folha do mensal cancelada, nem no "Agora não" do presente.
 *  · OFERTA_X_PAYWALL: Voltar no paywall do funil → presente 69,90 COM 3 dias grátis (1x por aparelho).
 *  · OFERTA_MENSAL_19: folha do mensal cancelada → mensal 19,90, só se a offering existir.
 *  · SAIDA_TESTE_ESCADA: recusou o 69,90 (teste cancelado / bloqueio) → mensal 19,90; nunca os dois juntos.
 *  · PAYWALL_TEXTOS: "A Apple vai pedir confirmação…" + selo "economize N%" dos preços reais.
 *  · 16/10 (SEM chave): folha do 97,90 fechada → presente 69,90 com 3 dias grátis ("folha_cancelada");
 *    a 2ª chance de mesmo preço só como reserva (presente off/ausente/sem teste/front já 69,90).
 *  · 16/10 SAIDA_DIRETO_19: teste cancelado/bloqueio direto no 19,90, se a offering mensal_19 existir.
 *  · quem decide: força de QA > metadata do RevenueCat > constante local.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9, precoMensal: "R$ 24,90",
  compraOk: true, motivo: null as string | null,
  presente: { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 } as null | { preco: string; precoMes: string | null; produto: string; comTrial: boolean; dias: number },
  mensal19: { preco: "R$ 19,90", produto: "core_mensal_19" } as null | { preco: string; produto: string },
  compraPresenteOk: true, compraMensal19Ok: true,
  situacao: null as null | { lugar: "cancelou_teste" | "bloqueio"; fimMs: number | null },
  trialCancelado: true,
  ultimaFoiTrial: true,
  auth: {} as Record<string, unknown>,
}));
const notif = vi.hoisted(() => ({
  pedirLembrete: vi.fn(async (_p: { fimMs: number; precoAno: string }) => "pendente" as const), cancelar: vi.fn(async () => undefined),
  recuperar: vi.fn(async (_area: string | null) => ({ ok: true as const, quando: { tresHoras: new Date(), manha: new Date() } })),
  cancelarRecuperacao: vi.fn(async () => undefined),
}));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: (p: { fimMs: number; precoAno: string }) => notif.pedirLembrete(p),
  cancelarLembreteDoTeste: () => notif.cancelar(),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: (area: string | null) => notif.recuperar(area),
  cancelarRecuperacaoDoPaywall: () => notif.cancelarRecuperacao(),
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn().mockResolvedValue("pronto"),
  prefetchAnualIos: vi.fn(async () => undefined),
  temAnualIos: () => true,
  precoAnualIos: () => loja.preco,
  idProdutoAnualIos: () => "core_anual_97",
  mesesDeMensalQuePagamOAno: () => 4,
  ofertaAnualIos: () => "anual_97",
  dadosDaOfertaIos: () => ({ oferta: "anual_97", produto: "core_anual_97", offering: "default", preco: loja.preco, pacote: true }),
  precoMensalDoAnualIos: () => loja.mes,
  diasTrialIos: () => 3,
  anualIosTemTrial: () => true,
  ultimaCompraAnualFoiTrial: () => loja.ultimaFoiTrial,
  fimDaUltimaCompraTrial: () => null,
  comprarAnualIos: vi.fn(async () => loja.compraOk),
  comprar: vi.fn(async () => loja.compraOk),
  estadoRevenueCat: () => "pronto",
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => loja.motivo,
  sincronizarAssinatura: vi.fn(),
  valorAnualIos: () => loja.valorAnual,
  valorMensalIos: () => loja.valorMensal,
  precoMensalIos: () => loja.precoMensal,
  economiaDoAnualIos: () => (loja.valorAnual && loja.valorMensal ? Math.round((1 - loja.valorAnual / (12 * loja.valorMensal)) * 100) : null),
  situacaoDoPresente: vi.fn(async () => loja.situacao),
  carregarPresente69: vi.fn(async () => loja.presente),
  comprarPresente69: vi.fn(async () => loja.compraPresenteOk),
  carregarMensal19: vi.fn(async () => loja.mensal19),
  comprarMensal19: vi.fn(async () => loja.compraMensal19Ok),
  marcarToqueDeCompra: vi.fn(),
  estadoTrialCancelado: vi.fn(async () => loja.trialCancelado),
  problemaDeCobranca: vi.fn(async () => ({ temProblema: false, comAcesso: false, url: null })),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => loja.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/lib/teste-gratis", async (original) => ({ ...(await original<typeof import("@/lib/teste-gratis")>()), trialCartaoAtivo: () => true }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({ PaywallAssinatura: () => <div data-testid="paywall-gate" /> }));
vi.mock("@/components/paywall/PaywallFlow", async (original) => ({ ...(await original<typeof import("@/components/paywall/PaywallFlow")>()), PaywallFlow: () => <div data-testid="paywall-web" /> }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { comprarPresente69, comprarMensal19, lerPacoteDoMensal19, calcularEconomia } from "@/lib/revenuecat";
import {
  lerChavesRemotas, registrarChavesRemotas, _zerarChavesRemotas, ofertaLigada, guardarForcaDasOfertas,
  CHAVE_FORCA_OFERTAS, OFERTA_X_PAYWALL, OFERTA_MENSAL_19, SAIDA_TESTE_ESCADA, PAYWALL_TEXTOS, PAYWALL_ENXUTO, RECUPERACAO_PAYWALL, PAYWALL_CURTO, PLANO_CADEADO, SAIDA_DIRETO_19,
} from "@/lib/ofertas-saida";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";
import { SaveOfferDowngrade } from "@/components/missao/SaveOfferDowngrade";
import { TrialBanner } from "@/components/TrialBanner";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const ligar = (v: string) => localStorage.setItem(CHAVE_FORCA_OFERTAS, v);
const voltar = () => act(() => { window.dispatchEvent(new CustomEvent("core:voltar")); });
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

const montarPaywall = (onPago = vi.fn()) => {
  render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
  return onPago;
};
const esperarLoja = () => screen.findByText("por mês · R$ 97,90/ano");

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarPresente69).mockClear();
  vi.mocked(comprarMensal19).mockClear();
  notif.pedirLembrete.mockClear(); notif.cancelar.mockClear(); notif.recuperar.mockClear(); notif.cancelarRecuperacao.mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  ios();
  loja.preco = "R$ 97,90"; loja.valorAnual = 97.9; loja.valorMensal = 24.9; loja.precoMensal = "R$ 24,90";
  loja.compraOk = true; loja.motivo = null; loja.compraPresenteOk = true; loja.compraMensal19Ok = true; loja.ultimaFoiTrial = true;
  loja.presente = { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 };
  loja.mensal19 = { preco: "R$ 19,90", produto: "core_mensal_19" };
  loja.situacao = null; loja.trialCancelado = true;
  loja.auth = {};
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ───────────────────────────── as chaves ───────────────────────────── */
describe("ofertas de saída — as chaves", () => {
  it("as 8 constantes nascem 'off'", () => {
    expect([OFERTA_X_PAYWALL, OFERTA_MENSAL_19, SAIDA_TESTE_ESCADA, PAYWALL_TEXTOS, PAYWALL_ENXUTO, RECUPERACAO_PAYWALL, PAYWALL_CURTO, PLANO_CADEADO]).toEqual(["off", "off", "off", "off", "off", "off", "off", "off"]);
    for (const n of ["x_paywall", "mensal_19", "escada", "textos", "enxuto", "recuperacao", "curto", "cadeado"] as const) expect(ofertaLigada(n)).toBe(false);
    // a metadata remota também conhece as duas novas
    registrarChavesRemotas({ current: { identifier: "d", metadata: { paywall_enxuto: "on", recuperacao_paywall: "on" } }, all: {} });
    expect(ofertaLigada("enxuto")).toBe(true);
    expect(ofertaLigada("recuperacao")).toBe(true);
  });

  it("metadata do RevenueCat: qualquer offering liga/desliga; a current vence", () => {
    const off = (identifier: string, metadata: Record<string, unknown>) => ({ identifier, metadata, availablePackages: [] });
    const atual = off("default", { paywall_textos: "on" });
    const o = { current: atual, all: { default: atual, anual_69: off("anual_69", { oferta_x_paywall: "ON", paywall_textos: "off" }), mensal_19: off("mensal_19", { oferta_mensal_19: "on", saida_teste_escada: "talvez" }) } };
    expect(lerChavesRemotas(o)).toEqual({ textos: "on", x_paywall: "on", mensal_19: "on" });
    registrarChavesRemotas(o);
    expect(ofertaLigada("textos")).toBe(true);
    expect(ofertaLigada("x_paywall")).toBe(true);
    expect(ofertaLigada("mensal_19")).toBe(true);
    expect(ofertaLigada("escada")).toBe(false); // valor inválido = não decide → constante local
    expect(lerChavesRemotas(null)).toEqual({});
    expect(lerChavesRemotas({ current: null, all: {} })).toEqual({});
  });

  it("força de QA deste aparelho vence a metadata: on/off/lista/auto/recomecar", () => {
    registrarChavesRemotas({ current: { identifier: "d", metadata: { paywall_textos: "on", oferta_x_paywall: "on" } }, all: {} });
    guardarForcaDasOfertas("?ofertas-saida=off");
    expect(ofertaLigada("textos")).toBe(false);
    guardarForcaDasOfertas(new URLSearchParams("ofertas-saida=mensal_19,escada"));
    expect(ofertaLigada("mensal_19")).toBe(true);
    expect(ofertaLigada("escada")).toBe(true);
    expect(ofertaLigada("textos")).toBe(false); // lista = SÓ essas (a metadata não completa)
    guardarForcaDasOfertas("?ofertas-saida=auto");
    expect(localStorage.getItem(CHAVE_FORCA_OFERTAS)).toBeNull();
    expect(ofertaLigada("textos")).toBe(true); // de volta à metadata
    localStorage.setItem("core-presente69-x-paywall-visto", "1");
    guardarForcaDasOfertas("?ofertas-saida=on,recomecar");
    expect(ofertaLigada("escada")).toBe(true);
    expect(localStorage.getItem("core-presente69-x-paywall-visto")).toBeNull();
    guardarForcaDasOfertas("?outra=1"); // sem o parâmetro: nada muda
    expect(localStorage.getItem(CHAVE_FORCA_OFERTAS)).toBe("on");
  });

  it("offering `mensal_19`: acha o core_mensal_19 em $rc_monthly; ausente/outro produto/`presente: off` = nada", () => {
    const p19 = { identifier: "$rc_monthly", product: { identifier: "core_mensal_19", priceString: "R$ 19,90" } };
    const offs = (metadata: Record<string, unknown> = {}, pacotes = [p19]) => ({ current: { identifier: "default", availablePackages: [] }, all: { mensal_19: { identifier: "mensal_19", metadata, availablePackages: pacotes, monthly: pacotes[0] ?? null } } });
    expect(lerPacoteDoMensal19(offs())?.product.identifier).toBe("core_mensal_19");
    expect(lerPacoteDoMensal19(offs({ presente: "off" }))).toBeNull();
    expect(lerPacoteDoMensal19(offs({}, [{ identifier: "$rc_monthly", product: { identifier: "core_mensal", priceString: "R$ 24,90" } }]))).toBeNull();
    expect(lerPacoteDoMensal19({ current: null, all: {} })).toBeNull();
    expect(lerPacoteDoMensal19(null)).toBeNull();
  });

  it("economia do anual contra 12 meses de mensal, dos preços reais: 97,90 → 67%; 69,90 → 77%", () => {
    expect(calcularEconomia(97.9, 24.9)).toBe(67);
    expect(calcularEconomia(69.9, 24.9)).toBe(77);
    expect(calcularEconomia(null, 24.9)).toBeNull();
    expect(calcularEconomia(97.9, null)).toBeNull();
    expect(calcularEconomia(300, 24.9)).toBeNull(); // anual mais caro que 12 mensais: sem selo
  });
});

/* ───────────────────────────── tudo off = hoje ───────────────────────────── */
describe("ofertas de saída — com TUDO OFF o paywall do iPhone é o de hoje", () => {
  it("nenhum texto/selo novo, Voltar não abre nada, folha do mensal cancelada não abre nada, nenhum evento novo", async () => {
    montarPaywall();
    await esperarLoja();
    expect(screen.queryByTestId("ios-apple-confirma")).toBeNull();
    expect(screen.queryByTestId("ios-economize")).toBeNull();
    expect(document.body.textContent).not.toMatch(/economize|A Apple vai pedir|19,90|devagar/);
    voltar();
    await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    fireEvent.click(screen.getByText("mês"));
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeEnabled());
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    const nomes = vi.mocked(trackEvent).mock.calls.map((c) => c[0]);
    expect(nomes.some((n) => /presente69|mensal19/.test(String(n)))).toBe(false);
    expect(eventos("paywall_oferta_vista")[0]).not.toHaveProperty("textos");
    expect(vi.mocked(comprarPresente69)).not.toHaveBeenCalled();
    expect(vi.mocked(comprarMensal19)).not.toHaveBeenCalled();
  });

  it("presente desligado/ausente: a 2ª chance da folha da Apple de sempre — só ganha o campo segunda_chance: 'imediata'", async () => {
    loja.presente = null; // `presente: "off"` na offering anual_69 (ou a loja calada)
    montarPaywall();
    await esperarLoja();
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await screen.findByTestId("ios-segunda-chance");
    expect(eventos("folha_segunda_chance_view")[0]).toMatchObject({ segunda_chance: "imediata", produto: "core_anual_97" });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(eventos("folha_segunda_chance_click")[0]).toMatchObject({ segunda_chance: "imediata" });
  });

  it("presente do teste cancelado: 'Agora não' NÃO abre o 19,90 com a escada desligada", async () => {
    loja.situacao = { lugar: "cancelou_teste", fimMs: Date.now() + 2 * 86400e3 };
    loja.auth = { user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" };
    render(<SaveOfferDowngrade />);
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });
});

/* ───────────────────────────── OFERTA_X_PAYWALL ───────────────────────────── */
describe("OFERTA_X_PAYWALL — Voltar no paywall do funil", () => {
  beforeEach(() => ligar("x_paywall"));

  it("abre o presente: 3 dias grátis e depois R$ 69,90/ano (em vez de 97,90), eventos com lugar e segunda_chance 'saida'", async () => {
    montarPaywall();
    await esperarLoja();
    voltar();
    const folha = await screen.findByTestId("presente69");
    expect(folha).toHaveAttribute("data-lugar", "x_paywall");
    expect(screen.getByText("Antes de ir")).toBeInTheDocument();
    expect(folha.textContent).toMatch(/3 dias grátis e depois R\$ 69,90\/ano \(em vez de R\$ 97,90\)/);
    expect(screen.getByTestId("presente69-regra").textContent).toMatch(/3 dias grátis, depois R\$ 69,90 por ano pela App Store\. Cancelou antes do fim do teste, não paga nada\./);
    expect(screen.getByTestId("presente69-cta").textContent).toMatch(/Começar 3 dias grátis/);
    expect(eventos("presente69_view")).toEqual([{ lugar: "x_paywall", preco: "R$ 69,90", de: "R$ 97,90", trial: true, segunda_chance: "saida" }]);
    // o paywall continua embaixo, intacto (o botão principal de sempre + o CTA do presente)
    expect(screen.getAllByRole("button", { name: /Começar 3 dias grátis/ })).toHaveLength(2);
    expect(screen.getByTestId("ios-cronograma")).toBeInTheDocument();
  });

  it("'Agora não' fecha de vez: marca o aparelho, o 2º Voltar não reabre, e na próxima sessão também não", async () => {
    montarPaywall();
    await esperarLoja();
    voltar();
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(localStorage.getItem("core-presente69-x-paywall-visto")).toBeTruthy();
    expect(eventos("presente69_fechou")).toEqual([{ lugar: "x_paywall", segunda_chance: "saida" }]);
    voltar(); await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    cleanup();
    montarPaywall();
    await esperarLoja();
    voltar(); await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(1);
  });

  it("comprou: app_sheet_success com oferta/lugar, lembrete do teste armado com o preço do presente, e segue pro cadastro", async () => {
    const onPago = montarPaywall();
    await esperarLoja();
    voltar();
    await screen.findByTestId("presente69");
    await espera(450); // a caixa abre e libera o CTA
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(vi.mocked(comprarPresente69)).toHaveBeenCalledWith("x_paywall");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_69", oferta: "presente69", lugar: "x_paywall", funil: "ios", segunda_chance: "saida" });
    expect(notif.pedirLembrete).toHaveBeenCalledWith(expect.objectContaining({ precoAno: "R$ 69,90" }));
    expect(localStorage.getItem("core-presente69-x-paywall-visto")).toBeTruthy();
  });

  it("presente desligado no RevenueCat (`presente: off`) ou Voltar com a folha da Apple aberta: nada", async () => {
    loja.presente = null;
    montarPaywall();
    await esperarLoja();
    voltar(); await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });
});

/* ───────────────────────────── OFERTA_MENSAL_19 ───────────────────────────── */
describe("OFERTA_MENSAL_19 — fechou a folha do mensal", () => {
  beforeEach(() => ligar("mensal_19"));
  const cancelarMensal = async () => {
    fireEvent.click(screen.getByText("mês"));
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
  };

  it("abre o mensal de 19,90: 'Prefere ir devagar?', cobrado hoje, eventos com lugar e segunda_chance 'imediata'", async () => {
    montarPaywall();
    await esperarLoja();
    await cancelarMensal();
    const folha = await screen.findByTestId("mensal19");
    expect(folha).toHaveAttribute("data-lugar", "mensal_paywall");
    expect(folha.textContent).toMatch(/Prefere irdevagar\?/);
    expect(folha.textContent).toMatch(/R\$ 19,90 por mês \(em vez de R\$ 24,90\), cancela quando quiser/);
    expect(screen.getByTestId("mensal19-regra").textContent).toMatch(/Cobrado hoje pela App Store: R\$ 19,90\. Renova todo mês/);
    expect(eventos("mensal19_view")).toEqual([{ lugar: "mensal_paywall", segunda_chance: "imediata", preco: "R$ 19,90", de: "R$ 24,90" }]);
    expect(document.body.textContent).toMatch(/App Store/);
    expect(document.body.textContent).not.toMatch(/primeiro mês/i); // a Apple não permite "1º mês por"
  });

  it("'Agora não' marca o aparelho; comprou = app_sheet_success + cadastro", async () => {
    const onPago = montarPaywall();
    await esperarLoja();
    await cancelarMensal();
    await screen.findByTestId("mensal19");
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-agora-nao")); });
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(localStorage.getItem("core-mensal19-mensal-paywall-visto")).toBeTruthy();
    expect(eventos("mensal19_fechou")).toEqual([{ lugar: "mensal_paywall", segunda_chance: "imediata" }]);
    // 1x por aparelho: cancelar de novo não reabre
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    cleanup(); localStorage.removeItem("core-mensal19-mensal-paywall-visto");
    montarPaywall(onPago);
    await esperarLoja();
    await cancelarMensal();
    await screen.findByTestId("mensal19");
    loja.compraOk = true; loja.motivo = null;
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-cta")); });
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(vi.mocked(comprarMensal19)).toHaveBeenCalledWith("mensal_paywall");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_mensal_19", oferta: "mensal19", lugar: "mensal_paywall", segunda_chance: "imediata" });
    expect(notif.pedirLembrete).not.toHaveBeenCalled(); // mensal: sem teste, sem lembrete
  });

  it("offering `mensal_19` ausente no RevenueCat: a chave não faz nada", async () => {
    loja.mensal19 = null;
    montarPaywall();
    await esperarLoja();
    await cancelarMensal();
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeEnabled());
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(eventos("mensal19_view")).toHaveLength(0);
  });

  it("fechou a folha do ANUAL: o presente 69,90 da folha fechada (ou a 2ª chance de sempre), nunca o 19,90", async () => {
    montarPaywall();
    await esperarLoja();
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "folha_cancelada");
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    cleanup();
    loja.presente = null;
    montarPaywall();
    await esperarLoja();
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await screen.findByTestId("ios-segunda-chance");
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
  });
});

/* ───────────────────────────── PAYWALL_TEXTOS ───────────────────────────── */
describe("PAYWALL_TEXTOS — textos e selo", () => {
  beforeEach(() => ligar("textos"));

  it("'A Apple vai pedir confirmação. Nada é cobrado hoje.' acima do botão (só no anual com teste) e 'economize 67%' no anual", async () => {
    montarPaywall();
    await esperarLoja();
    expect(await screen.findByTestId("ios-apple-confirma")).toHaveTextContent("A Apple vai pedir confirmação. Nada é cobrado hoje.");
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 67%");
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ textos: true, economia: 67 });
    fireEvent.click(screen.getByText("mês"));
    expect(screen.queryByTestId("ios-apple-confirma")).toBeNull(); // o mensal cobra hoje
    expect(screen.getByTestId("ios-economize")).toBeInTheDocument(); // o selo fica na coluna do anual
  });

  it("o selo vem dos preços REAIS: anual 69,90 → 77%; sem o preço do mensal → sem selo (nunca um número chumbado)", async () => {
    loja.preco = "R$ 69,90"; loja.valorAnual = 69.9;
    montarPaywall();
    expect(await screen.findByTestId("ios-economize")).toHaveTextContent("economize 77%");
    cleanup();
    loja.valorMensal = 0;
    montarPaywall();
    await screen.findByTestId("ios-apple-confirma");
    expect(screen.queryByTestId("ios-economize")).toBeNull();
  });

  it("o preço do mensal passa a ser o da loja (priceString), não a constante", async () => {
    loja.precoMensal = "R$ 26,90";
    montarPaywall();
    await screen.findByTestId("ios-apple-confirma");
    expect(screen.getAllByText("R$ 26,90").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("mês"));
    expect(screen.getByRole("button", { name: /Começar por R\$ 26,90\/mês/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/24,90/);
  });
});

/* ───────────────────────────── SAIDA_TESTE_ESCADA ───────────────────────────── */
describe("SAIDA_TESTE_ESCADA — 69,90 → 'Agora não' → 19,90", () => {
  beforeEach(() => ligar("escada"));

  it("teste cancelado: o presente, depois o mensal 19 com 'continua no teste e só paga 19,90 quando ele acabar' — nunca os dois juntos", async () => {
    const fim = Date.now() + 2 * 86400e3;
    loja.situacao = { lugar: "cancelou_teste", fimMs: fim };
    loja.auth = { user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" };
    render(<SaveOfferDowngrade />);
    await screen.findByTestId("presente69");
    expect(screen.queryByTestId("mensal19")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    const folha = await screen.findByTestId("mensal19");
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(folha).toHaveAttribute("data-lugar", "cancelou_teste");
    expect(screen.getByTestId("mensal19-regra").textContent).toMatch(/Nada é cobrado hoje: você continua no teste e só paga R\$ 19,90 quando ele acabar, em \d+ de \w+\. Depois, renova todo mês/);
    expect(screen.getByTestId("mensal19-cta").textContent).toMatch(/Mudar pro mensal — R\$ 19,90\/mês/);
    expect(eventos("mensal19_view")).toEqual([{ lugar: "cancelou_teste", segunda_chance: "proxima_abertura", preco: "R$ 19,90", de: "R$ 24,90" }]);
    // comprou: o lembrete "acaba amanhã" do anual sai
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-cta")); });
    await waitFor(() => expect(vi.mocked(comprarMensal19)).toHaveBeenCalledWith("cancelou_teste"));
    await waitFor(() => expect(notif.cancelar).toHaveBeenCalled());
    expect(localStorage.getItem("core-mensal19-cancelou-visto")).toBeTruthy();
    expect(localStorage.getItem("core-save-offer-visto")).toBeTruthy();
  });

  it("'Agora não' no 19,90 fecha tudo e marca; na próxima abertura nenhuma das duas volta", async () => {
    loja.situacao = { lugar: "cancelou_teste", fimMs: null };
    loja.auth = { user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" };
    render(<SaveOfferDowngrade />);
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    await screen.findByTestId("mensal19");
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-agora-nao")); });
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(screen.queryByText("Mudar pro mensal — R$ 24,90", { exact: false })).toBeNull();
    cleanup();
    render(<SaveOfferDowngrade />);
    await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.queryByTestId("mensal19")).toBeNull();
  });

  it("recusou o presente numa abertura anterior (antes do 2º degrau existir): só o 19,90 aparece", async () => {
    localStorage.setItem("core-presente69-cancelou-visto", "1");
    localStorage.setItem("core-save-offer-visto", "1");
    loja.situacao = { lugar: "cancelou_teste", fimMs: null };
    loja.auth = { user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" };
    render(<SaveOfferDowngrade />);
    const folha = await screen.findByTestId("mensal19");
    expect(folha).toHaveAttribute("data-lugar", "cancelou_teste");
    expect(screen.queryByTestId("presente69")).toBeNull();
  });

  it("offering ausente: depois do 'Agora não' do presente não aparece nada", async () => {
    loja.mensal19 = null;
    loja.situacao = { lugar: "cancelou_teste", fimMs: null };
    loja.auth = { user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" };
    render(<SaveOfferDowngrade />);
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
  });

  it("bloqueio (perdeu o acesso): 69,90 → 'Agora não' → 19,90 cobrado hoje, por cima do paywall de sempre", async () => {
    loja.situacao = { lugar: "bloqueio", fimMs: null };
    loja.presente = { ...loja.presente!, comTrial: false, dias: 0 };
    loja.auth = { user: { id: "u1" }, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    const folha = await screen.findByTestId("mensal19");
    expect(folha).toHaveAttribute("data-lugar", "bloqueio");
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
    expect(screen.getByTestId("mensal19-regra").textContent).toMatch(/Cobrado hoje pela App Store: R\$ 19,90/);
    expect(folha.textContent).toMatch(/Tudo o que você construiu continua aqui/);
    expect(eventos("mensal19_view")).toEqual([{ lugar: "bloqueio", segunda_chance: "proxima_abertura", preco: "R$ 19,90", de: "R$ 24,90" }]);
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-agora-nao")); });
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
    expect(localStorage.getItem("core-mensal19-bloqueio-visto")).toBeTruthy();
  });
});


/* ───────────────────────────── 16/10: PRESENTE NA FOLHA FECHADA (sem chave) ───────────────────────────── */
describe("16/10 — fechou a folha do 97,90: presente 69,90 com 3 dias grátis no lugar da 2ª chance de mesmo preço", () => {
  const fecharFolha97 = async () => {
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
  };

  it("abre o presente: 3 dias grátis, 'Nada é cobrado hoje', depois o 69,90 DA LOJA (em vez de 97,90); eventos com lugar 'folha_cancelada' e segunda_chance 'imediata'", async () => {
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    const folha = await screen.findByTestId("presente69");
    expect(folha).toHaveAttribute("data-lugar", "folha_cancelada");
    expect(folha.textContent).toMatch(/3 dias grátise só R\$ 69,90\/ano\./);
    expect(folha.textContent).toMatch(/3 dias grátis e depois R\$ 69,90\/ano \(em vez de R\$ 97,90\)/);
    expect(screen.getByTestId("presente69-regra").textContent).toBe("Nada é cobrado hoje. 3 dias grátis, depois R$ 69,90 por ano pela App Store. Cancelou antes do fim do teste, não paga nada.");
    expect(screen.getByTestId("presente69-cta").textContent).toMatch(/Começar 3 dias grátis/);
    expect(document.body.textContent).not.toMatch(/sem cartão/i);
    expect(eventos("presente69_view")).toEqual([{ lugar: "folha_cancelada", preco: "R$ 69,90", de: "R$ 97,90", trial: true, segunda_chance: "imediata" }]);
    // o cartão de mesmo preço NÃO aparece
    expect(screen.queryByTestId("ios-segunda-chance")).toBeNull();
    expect(eventos("folha_segunda_chance_view")).toHaveLength(0);
  });

  it("o preço vem da loja (priceString), nunca chumbado", async () => {
    loja.presente = { preco: "R$ 59,90", precoMes: "R$ 4,99", produto: "core_anual_69", comTrial: true, dias: 3 };
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    const folha = await screen.findByTestId("presente69");
    expect(folha.textContent).toMatch(/R\$ 59,90/);
    expect(folha.textContent).not.toMatch(/69,90/);
  });

  it("tocar compra o core_anual_69 (lugar folha_cancelada): app_sheet_success 'presente69', lembrete do teste com o preço do presente, cadastro", async () => {
    const onPago = montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    await screen.findByTestId("presente69");
    await espera(450); // a caixa abre e libera o CTA
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(vi.mocked(comprarPresente69)).toHaveBeenCalledWith("folha_cancelada");
    expect(eventos("presente69_toque")).toEqual([{ lugar: "folha_cancelada", segunda_chance: "imediata" }]);
    expect(eventos("presente69_sucesso")[0]).toMatchObject({ lugar: "folha_cancelada", preco: "R$ 69,90" });
    expect(eventos("app_sheet_success")).toEqual([expect.objectContaining({ produto: "core_anual_69", oferta: "presente69", lugar: "folha_cancelada", offering: "anual_69", funil: "ios", segunda_chance: "imediata" })]);
    expect(notif.pedirLembrete).toHaveBeenCalledWith(expect.objectContaining({ precoAno: "R$ 69,90" }));
  });

  it("fechou a folha do PRÓPRIO 69,90: fica no presente, sem erro e sem laço; 'Agora não' devolve o paywall sem cartão; fechar o 97,90 de novo não reabre nada", async () => {
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    await screen.findByTestId("presente69");
    await espera(450);
    loja.compraPresenteOk = false; // motivo segue "cancelou"
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
    await espera();
    expect(eventos("presente69_falhou")).toEqual([{ lugar: "folha_cancelada", motivo: "cancelou", segunda_chance: "imediata" }]);
    expect(screen.getByTestId("presente69")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_fechou")).toEqual([{ lugar: "folha_cancelada", segunda_chance: "imediata" }]);
    expect(screen.queryByTestId("ios-segunda-chance")).toBeNull();
    // fechou a folha do 97,90 outra vez: nem presente, nem o cartão de mesmo preço
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await espera();
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.queryByTestId("ios-segunda-chance")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(1);
    expect(eventos("folha_segunda_chance_view")).toHaveLength(0);
  });

  it("com OFERTA_X_PAYWALL: viu o presente na folha fechada → o Voltar não mostra de novo (nesta sessão nem nas próximas)", async () => {
    ligar("x_paywall");
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    expect(localStorage.getItem("core-presente69-x-paywall-visto")).toBeTruthy();
    voltar(); await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    cleanup();
    montarPaywall();
    await esperarLoja();
    voltar(); await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(1);
  });

  it("com OFERTA_X_PAYWALL: ainda aberto (sem desfecho), o Voltar não empilha um 2º presente", async () => {
    ligar("x_paywall");
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    await screen.findByTestId("presente69");
    voltar(); await espera();
    expect(screen.getAllByTestId("presente69")).toHaveLength(1);
    expect(screen.getByTestId("presente69")).toHaveAttribute("data-lugar", "folha_cancelada");
    expect(eventos("presente69_view")).toHaveLength(1);
  });

  it("com OFERTA_X_PAYWALL: viu o presente pelo Voltar → fechar a folha do 97,90 depois cai na 2ª chance de sempre (1 presente por sessão)", async () => {
    ligar("x_paywall");
    montarPaywall();
    await esperarLoja();
    voltar();
    await screen.findByTestId("presente69");
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    await fecharFolha97();
    await screen.findByTestId("ios-segunda-chance");
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(1);
  });

  it("o presente da folha fechada é 1x por SESSÃO, não por aparelho: o Voltar já visto num paywall anterior não o impede", async () => {
    localStorage.setItem("core-presente69-x-paywall-visto", "1");
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "folha_cancelada");
  });

  it("reservas — volta a 2ª chance de mesmo preço: sem direito ao teste no 69,90 (o texto não pode prometer dias grátis) e quando o anual da tela já é o 69,90", async () => {
    loja.presente = { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: false, dias: 0 };
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    await screen.findByTestId("ios-segunda-chance");
    expect(screen.queryByTestId("presente69")).toBeNull();
    cleanup();
    // braço 69,90 do teste de preço: o "downsell" seria o mesmo preço
    loja.presente = { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 };
    loja.preco = "R$ 69,90";
    montarPaywall();
    await screen.findByText("por mês · R$ 69,90/ano");
    await fecharFolha97();
    await screen.findByTestId("ios-segunda-chance");
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("presente69_view")).toHaveLength(0);
  });

  it("erro da loja (não foi ela que fechou) ou folha do MENSAL fechada: nada de presente", async () => {
    montarPaywall();
    await esperarLoja();
    loja.compraOk = false; loja.motivo = "billing_erro";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
    await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    fireEvent.click(screen.getByText("mês"));
    loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeEnabled());
    await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });
});

/* ───────────────────────────── 16/10: SAIDA_DIRETO_19 ───────────────────────────── */
describe("SAIDA_DIRETO_19 — teste cancelado / bloqueio direto no mensal 19,90 (metadata `saida_direto_19`)", () => {
  const direto = (v = "on") => registrarChavesRemotas({ current: { identifier: "default", metadata: { saida_direto_19: v } }, all: {} });
  const testeCancelado = () => {
    loja.situacao = { lugar: "cancelou_teste", fimMs: Date.now() + 2 * 86400e3 };
    loja.auth = { user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" };
  };
  const bloqueio = () => {
    loja.situacao = { lugar: "bloqueio", fimMs: null };
    loja.presente = { ...loja.presente!, comTrial: false, dias: 0 };
    loja.auth = { user: { id: "u1" }, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
  };

  it("a chave: nasce off; liga pela metadata ou pela lista explícita; NÃO entra no `?ofertas-saida=on`; `off` desliga", () => {
    expect(SAIDA_DIRETO_19).toBe("off");
    expect(ofertaLigada("direto_19")).toBe(false);
    expect(lerChavesRemotas({ current: { identifier: "d", metadata: { saida_direto_19: "on" } }, all: {} })).toEqual({ direto_19: "on" });
    ligar("on");
    expect(ofertaLigada("escada")).toBe(true);
    expect(ofertaLigada("direto_19")).toBe(false); // o "liga tudo" de QA não muda a escada de ninguém
    direto();
    expect(ofertaLigada("direto_19")).toBe(true); // com `on` forçado, a metadata decide
    ligar("off");
    expect(ofertaLigada("direto_19")).toBe(false);
    ligar("direto_19");
    _zerarChavesRemotas();
    expect(ofertaLigada("direto_19")).toBe(true);
  });

  it("ligada + offering mensal_19: teste cancelado vê SÓ o 19,90, com 'continua no teste e só paga quando ele acabar'", async () => {
    direto();
    testeCancelado();
    render(<SaveOfferDowngrade />);
    const folha = await screen.findByTestId("mensal19");
    expect(folha).toHaveAttribute("data-lugar", "cancelou_teste");
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.getByTestId("mensal19-regra").textContent).toMatch(/Nada é cobrado hoje: você continua no teste e só paga R\$ 19,90 quando ele acabar, em \d+ de \w+\. Depois, renova todo mês/);
    expect(screen.getByTestId("mensal19-cta").textContent).toMatch(/Mudar pro mensal — R\$ 19,90\/mês/);
    expect(eventos("presente69_view")).toHaveLength(0);
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-agora-nao")); });
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull(); // nada de 69,90 depois
    expect(localStorage.getItem("core-save-offer-visto")).toBeTruthy();
    cleanup();
    render(<SaveOfferDowngrade />);
    await espera();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.queryByTestId("mensal19")).toBeNull();
  });

  it("ligada + offering mensal_19: bloqueio vê SÓ o 19,90, 'Cobrado hoje', por cima do paywall de sempre", async () => {
    direto();
    bloqueio();
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    const folha = await screen.findByTestId("mensal19");
    expect(folha).toHaveAttribute("data-lugar", "bloqueio");
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
    expect(screen.getByTestId("mensal19-regra").textContent).toMatch(/Cobrado hoje pela App Store: R\$ 19,90\. Renova todo mês/);
    await act(async () => { fireEvent.click(screen.getByTestId("mensal19-agora-nao")); });
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
    cleanup();
    // já viu o 19,90 neste aparelho: na próxima abertura não aparece nada (nem o 69,90)
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    await espera();
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });

  it("ligada SEM a offering mensal_19: o 69,90 de sempre nos dois lugares", async () => {
    direto();
    loja.mensal19 = null;
    testeCancelado();
    render(<SaveOfferDowngrade />);
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "cancelou_teste");
    expect(screen.queryByTestId("mensal19")).toBeNull();
    cleanup();
    bloqueio();
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "bloqueio");
    expect(screen.queryByTestId("mensal19")).toBeNull();
  });

  it("desligada (escada ligada): a escada de hoje — 69,90 primeiro, 19,90 só depois do 'Agora não'", async () => {
    direto("off");
    ligar("escada");
    testeCancelado();
    render(<SaveOfferDowngrade />);
    await screen.findByTestId("presente69");
    expect(screen.queryByTestId("mensal19")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("presente69-agora-nao")); });
    expect(await screen.findByTestId("mensal19")).toHaveAttribute("data-lugar", "cancelou_teste");
    cleanup(); localStorage.clear(); ligar("escada");
    bloqueio();
    render(<MemoryRouter initialEntries={["/home"]}><TrialBanner /></MemoryRouter>);
    await screen.findByTestId("presente69");
    expect(screen.queryByTestId("mensal19")).toBeNull();
  });

  it("ligada não mexe no presente do Voltar nem no da folha fechada (paywall do funil)", async () => {
    direto();
    ligar("x_paywall");
    montarPaywall();
    await esperarLoja();
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "folha_cancelada");
    expect(screen.queryByTestId("mensal19")).toBeNull();
    cleanup(); localStorage.clear(); ligar("x_paywall");
    montarPaywall();
    await esperarLoja();
    voltar();
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "x_paywall");
  });
});

/* ───────────────────────────── paywall_saiu + RECUPERACAO_PAYWALL (1.0.14) ───────────────────────────── */
const esconderApp = () => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
};
const mostrarApp = () => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); };
const saidas = () => [...eventos("paywall_saiu"), ...vi.mocked(trackEventBeacon).mock.calls.filter((c) => c[0] === "paywall_saiu").map((c) => c[1] as Record<string, unknown>)];

describe("paywall_saiu — sair do paywall do iPhone sem comprar (sempre ligado, não depende de chave)", () => {
  afterEach(mostrarApp);

  it("desmontou sem comprar: 1 evento {motivo: outro, segundos_na_tela, viu_oferta: false}; nenhuma recuperação com a chave off", async () => {
    const { unmount } = render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await esperarLoja();
    unmount();
    expect(saidas()).toEqual([expect.objectContaining({ motivo: "outro", viu_oferta: false, segundos_na_tela: expect.any(Number), funil: "ios", loja: "ios", area: "dinheiro" })]);
    expect(notif.recuperar).not.toHaveBeenCalled();
  });

  it("Voltar e depois saiu: motivo 'voltar'; com o presente do x_paywall aberto, viu_oferta true; o evento sai UMA vez", async () => {
    ligar("x_paywall");
    const { unmount } = render(<MemoryRouter><PaywallIOS area="rotina" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await esperarLoja();
    voltar();
    await screen.findByTestId("presente69");
    esconderApp(); // o 2º Voltar do iPhone minimiza o app: a saída vai por beacon
    unmount();
    expect(saidas()).toEqual([expect.objectContaining({ motivo: "voltar", viu_oferta: true, area: "rotina" })]);
  });

  it("comprou: nenhum paywall_saiu, e a recuperação pendente é cancelada", async () => {
    const onPago = vi.fn();
    const { unmount } = render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
    await esperarLoja();
    notif.cancelarRecuperacao.mockClear(); // o mount já cancela (ela voltou pro paywall)
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(notif.cancelarRecuperacao).toHaveBeenCalledTimes(1);
    unmount();
    expect(saidas()).toEqual([]);
  });
});

describe("RECUPERACAO_PAYWALL — quem sai sem iniciar o teste ganha 2 avisos (lib/notificacoes, faixa 950000)", () => {
  afterEach(mostrarApp);

  it("ligada: o 1º Voltar arma a recuperação com o nome da área, uma vez por paywall; o app no fundo também arma", async () => {
    ligar("recuperacao");
    const { unmount } = render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await esperarLoja();
    expect(notif.cancelarRecuperacao).toHaveBeenCalled(); // abriu o paywall de novo: a pendente sai
    voltar();
    voltar();
    expect(notif.recuperar).toHaveBeenCalledTimes(1);
    expect(notif.recuperar).toHaveBeenCalledWith("Dinheiro");
    unmount();
    // sem Voltar, o app no fundo arma
    notif.recuperar.mockClear();
    render(<MemoryRouter><PaywallIOS area="corpo" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await esperarLoja();
    esconderApp();
    expect(notif.recuperar).toHaveBeenCalledWith("Corpo");
  });

  it("desligada (padrão): nem o Voltar nem o fundo armam nada — o paywall de hoje", async () => {
    render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await esperarLoja();
    voltar();
    esconderApp();
    expect(notif.recuperar).not.toHaveBeenCalled();
  });
});
