/**
 * PAYWALL DO iPHONE 1.0.16 (16/10) — as duas peças novas:
 *   1. ExplicaFolha: a meia-folha antes da 2ª folha da Apple (Continuar/"Tentar de novo" depois de
 *      uma folha fechada, e o presente 69,90 que vem da folha fechada). Nunca na 1ª vez. Lembrete
 *      só se a permissão de notificação permitir. Nunca fala de a Apple cobrar antes.
 *   2. a escada de saída: downsell sempre MAIS BARATO que a vitrine; UM presente por sessão (o
 *      mensal 19,90 incluído); mensal 19,90 some sem a offering; o Voltar redondo volta a recuar
 *      depois de um presente fechado.
 * (A variante B do paywall saiu do escopo em 16/10: o paywall curto da 1.0.14 fica como está.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9 as number | null, valorMensal: 24.9 as number | null, precoMensal: "R$ 24,90" as string | null,
  precoTeste: "R$ 0,00" as string | null, dias: 3, trial: true,
  compraOk: true, motivo: null as string | null, compraPresenteOk: true,
  presente: { preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 } as null | { preco: string; valor?: number | null; precoMes: string | null; produto: string; comTrial: boolean; dias: number },
  mensal19: { preco: "R$ 19,90", produto: "core_mensal_19", valor: 19.9 } as null | { preco: string; produto: string; valor?: number | null },
  permissao: "granted" as "granted" | "denied" | "prompt" | "indisponivel",
}));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: vi.fn(async () => "pendente"),
  cancelarLembreteDoTeste: vi.fn(async () => undefined),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: vi.fn(async () => ({ ok: true })),
  cancelarRecuperacaoDoPaywall: vi.fn(async () => undefined),
  estadoPermissao: vi.fn(async () => loja.permissao),
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn().mockResolvedValue("pronto"),
  prefetchAnualIos: vi.fn(async () => undefined),
  temAnualIos: () => true,
  precoAnualIos: () => loja.preco,
  idProdutoAnualIos: () => (loja.preco === "R$ 69,90" ? "core_anual_69" : "core_anual_97"),
  mesesDeMensalQuePagamOAno: () => 4,
  ofertaAnualIos: () => (loja.preco === "R$ 69,90" ? "anual_69" : "anual_97"),
  dadosDaOfertaIos: () => ({ oferta: loja.preco === "R$ 69,90" ? "anual_69" : "anual_97", produto: loja.preco === "R$ 69,90" ? "core_anual_69" : "core_anual_97", offering: "default", preco: loja.preco, pacote: true }),
  precoMensalDoAnualIos: () => loja.mes,
  diasTrialIos: () => (loja.trial ? loja.dias : 0),
  anualIosTemTrial: () => loja.trial,
  ultimaCompraAnualFoiTrial: () => loja.trial,
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
  precoDoTesteIos: () => (loja.trial ? loja.precoTeste : null),
  situacaoDoPresente: vi.fn(async () => null),
  carregarPresente69: vi.fn(async () => loja.presente),
  comprarPresente69: vi.fn(async () => loja.compraPresenteOk),
  carregarMensal19: vi.fn(async () => loja.mensal19),
  comprarMensal19: vi.fn(async () => true),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));

import { trackEvent } from "@/lib/analytics";
import { comprarAnualIos, comprar as comprarAssinatura, comprarPresente69 } from "@/lib/revenuecat";
import { CHAVE_FORCA_OFERTAS, _zerarChavesRemotas } from "@/lib/ofertas-saida";
import { PaywallIOS, PREPARACAO_DA_FOLHA_MS, DIAS_DE_TESTE_PADRAO } from "@/pages/funis/ios/PaywallIOS";
import { linhasDaExplicacao } from "@/components/paywall/ExplicaFolha";
import { prepararPresente } from "@/components/app/Presente69";
import { prepararMensal19 } from "@/components/paywall/OfertaMensal19";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const ligar = (v: string) => localStorage.setItem(CHAVE_FORCA_OFERTAS, v);
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
type Area = "dinheiro" | "rotina" | "corpo" | "saude" | "metas";
const montar = (o: { area?: Area; answers?: Record<string, string>; onPago?: () => void; onVoltar?: () => void; modo?: "funil" | "gate" } = {}) => {
  const onPago = o.onPago ?? vi.fn();
  render(<MemoryRouter><PaywallIOS area={o.area ?? "dinheiro"} answers={o.answers ?? { gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} onVoltar={o.onVoltar} modo={o.modo} /></MemoryRouter>);
  return onPago;
};
const esperarCurto = () => screen.findByText("R$ 97,90 cobrado por ano");

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarAnualIos).mockClear();
  vi.mocked(comprarAssinatura).mockClear();
  vi.mocked(comprarPresente69).mockClear();
  ios();
  Object.assign(loja, {
    preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9, precoMensal: "R$ 24,90", precoTeste: "R$ 0,00", dias: 3, trial: true,
    compraOk: true, motivo: null, compraPresenteOk: true, permissao: "granted",
    presente: { preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 },
    mensal19: { preco: "R$ 19,90", produto: "core_mensal_19", valor: 19.9 },
  });
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ─────────────────────────────── 1. a explicação antes da 2ª folha ─────────────────────────────── */
describe("ExplicaFolha — a meia-folha antes da folha da Apple, na 2ª vez", () => {
  it("o '3 dias' de reserva é uma constante só; o número de verdade vem da loja", () => {
    expect(DIAS_DE_TESTE_PADRAO).toBe(3);
  });

  it("linhas puras: datas reais, 'Nada é cobrado hoje', lembrete conforme a permissão; nunca fala de cobrar antes", () => {
    const hoje = new Date(2026, 9, 16);
    const sim = linhasDaExplicacao(3, "R$ 97,90", "R$ 0,00", "sim", hoje);
    expect(sim.map((l) => l.quando)).toEqual(["Hoje · 16/10", "Dia 2 · 17/10", "Dia 3 · 18/10"]);
    expect(sim[0].texto).toBe("Nada é cobrado hoje (R$ 0,00).");
    expect(sim[1].texto).toBe("Lembrete no celular antes do teste acabar.");
    expect(sim[2].texto).toBe("R$ 97,90/ano, só se você continuar. Cancelou antes, não paga nada.");
    expect(linhasDaExplicacao(3, "R$ 97,90", null, "se_ligar", hoje)[1].texto).toMatch(/deixar os avisos ligados/);
    expect(linhasDaExplicacao(3, "R$ 97,90", null, "nao", hoje).map((l) => l.tipo)).toEqual(["hoje", "fim"]);
    expect(linhasDaExplicacao(7, "R$ 69,90", null, "sim", hoje).map((l) => l.quando)).toEqual(["Hoje · 16/10", "Dia 6 · 21/10", "Dia 7 · 22/10"]);
    const todo = JSON.stringify(sim);
    expect(todo).not.toMatch(/24 ?h|antes do fim do teste a Apple|cobra antes|sem cartão/i);
  });

  it("1ª vez: nada muda (pílula do curto e folha); fechou a folha → Continuar de novo abre a explicação, e um toque segue pra Apple", async () => {
    ligar("curto");
    loja.presente = null; // sem o presente: o cartão de sempre fica de reserva
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      await esperarCurto();
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      expect(screen.queryByTestId("explica-folha")).toBeNull();
      expect(screen.getByTestId("ios-preparando-folha")).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(PREPARACAO_DA_FOLHA_MS + 50); });
      await waitFor(() => expect(comprarAnualIos).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled());
      // 2ª vez: a explicação no lugar da pílula
      loja.compraOk = true; loja.motivo = null;
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      const folha = await screen.findByTestId("explica-folha");
      expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
      expect(folha).toHaveAttribute("data-lugar", "paywall");
      expect(folha.textContent).toMatch(/Como funcionam seus 3 dias grátis/);
      expect(folha.textContent).toMatch(/Nada é cobrado hoje \(R\$ 0,00\)/);
      expect(folha.textContent).toMatch(/R\$ 97,90\/ano, só se você continuar/);
      expect(folha.textContent).toMatch(/clique 2 vezes no botão lateral/);
      expect(folha.textContent).not.toMatch(/sem cartão|24 ?h/i);
      await waitFor(() => expect(screen.getByTestId("explica-folha").textContent).toMatch(/Lembrete no celular antes do teste acabar\./));
      expect(eventos("explica_folha_view")).toEqual([expect.objectContaining({ lugar: "paywall", produto: "core_anual_97", preco: "R$ 97,90", dias: 3, aviso: "sim" })]);
      expect(comprarAnualIos).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId("explica-folha-continuar"));
      await waitFor(() => expect(comprarAnualIos).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId("explica-folha")).toBeNull();
      expect(eventos("explica_folha_continuar")).toEqual([expect.objectContaining({ lugar: "paywall", ms: expect.any(Number) })]);
    } finally { vi.useRealTimers(); }
  });

  it("'Agora não' fecha sem abrir a folha (explica_folha_fechar); permissão negada = sem a linha do lembrete", async () => {
    loja.presente = null; loja.permissao = "denied";
    montar();
    await screen.findByText("por mês · R$ 97,90/ano");
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    const folha = await screen.findByTestId("explica-folha");
    await waitFor(() => expect(eventos("explica_folha_view")).toHaveLength(1));
    expect(eventos("explica_folha_view")[0]).toMatchObject({ aviso: "nao" });
    expect(folha.textContent).not.toMatch(/a gente te avisa/i);
    expect(folha.querySelectorAll("[data-tipo]")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("explica-folha-fechar"));
    expect(screen.queryByTestId("explica-folha")).toBeNull();
    expect(eventos("explica_folha_fechar")).toHaveLength(1);
    expect(comprarAnualIos).toHaveBeenCalledTimes(1);
  });

  it("presente 69,90 da folha fechada: o 1º toque explica (com o 69,90), o 2º vai direto", async () => {
    const onPago = montar();
    await screen.findByText("por mês · R$ 97,90/ano");
    loja.compraOk = false; loja.motivo = "cancelou"; loja.compraPresenteOk = false;
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await screen.findByTestId("presente69");
    await waitFor(() => expect(screen.getByTestId("presente69-cta")).toBeEnabled());
    fireEvent.click(screen.getByTestId("presente69-cta"));
    const folha = await screen.findByTestId("explica-folha");
    expect(folha).toHaveAttribute("data-lugar", "presente_folha_cancelada");
    expect(folha.textContent).toMatch(/R\$ 69,90\/ano, só se você continuar/);
    fireEvent.click(screen.getByTestId("explica-folha-continuar"));
    await waitFor(() => expect(comprarPresente69).toHaveBeenCalledTimes(1));
    // cancelou a folha do 69,90 também: o toque seguinte vai direto (já explicado)
    loja.compraPresenteOk = true;
    await waitFor(() => expect(screen.getByTestId("presente69-cta")).toBeEnabled());
    fireEvent.click(screen.getByTestId("presente69-cta"));
    expect(screen.queryByTestId("explica-folha")).toBeNull();
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
  });

  it("presente no Voltar SEM folha fechada antes: sem explicação (é a 1ª folha dela)", async () => {
    ligar("x_paywall");
    const onPago = montar();
    await screen.findByText("por mês · R$ 97,90/ano");
    act(() => { window.dispatchEvent(new CustomEvent("core:voltar")); });
    await screen.findByTestId("presente69");
    await waitFor(() => expect(screen.getByTestId("presente69-cta")).toBeEnabled());
    fireEvent.click(screen.getByTestId("presente69-cta"));
    expect(screen.queryByTestId("explica-folha")).toBeNull();
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
  });
});

/* ─────────────────────────────── 2. a escada de saída ─────────────────────────────── */
describe("escada de saída: downsell mais barato, um presente por sessão", () => {
  it("presente 69,90 só se for MAIS BARATO que a vitrine — em todo lugar (Voltar incluso)", async () => {
    ligar("x_paywall");
    expect(await prepararPresente("x_paywall")).toMatchObject({ preco: "R$ 69,90", precoDe: "R$ 97,90" });
    loja.preco = "R$ 69,90"; loja.valorAnual = 69.9; // vitrine já é o 69 (braço do teste de preço)
    expect(await prepararPresente("x_paywall")).toBeNull();
    expect(await prepararPresente("folha_cancelada")).toBeNull();
    loja.preco = "R$ 59,90"; loja.valorAnual = 59.9; // vitrine mais barata que o presente
    expect(await prepararPresente("x_paywall")).toBeNull();
  });

  it("mensal 19,90 só se for MAIS BARATO que o mensal da vitrine; sem a offering, nada", async () => {
    expect(await prepararMensal19("mensal_paywall")).toMatchObject({ preco: "R$ 19,90", precoDe: "R$ 24,90" });
    loja.valorMensal = 19.9; loja.precoMensal = "R$ 19,90";
    expect(await prepararMensal19("mensal_paywall")).toBeNull();
    loja.valorMensal = 24.9; loja.precoMensal = "R$ 24,90"; loja.mensal19 = null;
    expect(await prepararMensal19("mensal_paywall")).toBeNull();
  });

  it("UM presente por sessão: viu o 69,90 (folha fechada) → fechar a folha do mensal NÃO abre o 19,90", async () => {
    ligar("mensal_19");
    montar();
    await screen.findByText("por mês · R$ 97,90/ano");
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await screen.findByTestId("presente69");
    fireEvent.click(screen.getByTestId("presente69-agora-nao"));
    fireEvent.click(screen.getByText("mês"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    await waitFor(() => expect(comprarAssinatura).toHaveBeenCalledTimes(1));
    await espera(60);
    expect(screen.queryByTestId("mensal19")).toBeNull();
    expect(eventos("mensal19_view")).toHaveLength(0);
  });

  it("sem presente antes: fechar a folha do mensal abre o 19,90 (com o braço nos eventos)", async () => {
    ligar("mensal_19");
    montar();
    await screen.findByText("por mês · R$ 97,90/ano");
    fireEvent.click(screen.getByText("mês"));
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    await screen.findByTestId("mensal19");
    expect(eventos("mensal19_view")[0]).toMatchObject({ lugar: "mensal_paywall", preco: "R$ 19,90", de: "R$ 24,90" });
  });

  it("Voltar redondo: depois de ver e fechar o presente, o próximo Voltar recua o funil (antes ficava morto)", async () => {
    ligar("curto,x_paywall");
    const onVoltar = vi.fn();
    montar({ onVoltar });
    await esperarCurto();
    fireEvent.click(screen.getByTestId("ios-curto-voltar"));
    await screen.findByTestId("presente69");
    await espera(450);
    expect(onVoltar).not.toHaveBeenCalled(); // o presente abriu por cima: não recua
    fireEvent.click(screen.getByTestId("presente69-agora-nao"));
    fireEvent.click(screen.getByTestId("ios-curto-voltar"));
    await espera(450);
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });
});
