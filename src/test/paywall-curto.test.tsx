/**
 * PAYWALL CURTO DO iPHONE (10/10, 1.0.14) — chave PAYWALL_CURTO (lib/ofertas-saida, "curto").
 *
 *  · OFF (o padrão) = o paywall de hoje: cronograma, duas colunas, botão "Começar 3 dias grátis",
 *    nenhum testid/texto do curto, nenhum campo novo nos eventos.
 *  · ON (estrutura do Cal AI, dono 10/10): imagem grande sangrando + Voltar redondo; título "Comece
 *    seus 3 dias grátis pra continuar"; card do anual com cabeçalho "3 DIAS GRÁTIS", "Comece grátis e
 *    economize 67%", "R$ 97,90 cobrado por ano", "R$ 8,16/mês"; card do mensal "Mensal · R$ 24,90/mês";
 *    "✓ Sem cobrança hoje · a gente te avisa dia DD/MM"; botão "Continuar"; legal em 2 linhas;
 *    "Termos · Privacidade · Restaurar compras". O toque mostra a pílula de preparação ~1,2 s e SÓ
 *    ENTÃO abre a folha; presente 69,90 na folha fechada (16/10; a 2ª chance de mesmo preço vira reserva), presente no Voltar (botão redondo = core:voltar) e paywall_saiu
 *    seguem funcionando; `paywall_oferta_vista` ganha `paywall_curto: true`.
 *  · preços SEMPRE da loja: 69,90 troca tudo; sem o mensal da loja = sem selo e "R$ —".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9 as number | null, precoMensal: "R$ 24,90" as string | null,
  precoTeste: "R$ 0,00" as string | null, dias: 3, trial: true,
  compraOk: true, motivo: null as string | null,
  presente: { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 } as null | { preco: string; precoMes: string | null; produto: string; comTrial: boolean; dias: number },
}));
const notif = vi.hoisted(() => ({
  pedirLembrete: vi.fn(async (_p: { fimMs: number; precoAno: string }) => "pendente" as const),
  recuperar: vi.fn(async (_area: string | null) => ({ ok: true as const, quando: { tresHoras: new Date(), manha: new Date() } })),
  cancelarRecuperacao: vi.fn(async () => undefined),
}));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: (p: { fimMs: number; precoAno: string }) => notif.pedirLembrete(p),
  cancelarLembreteDoTeste: vi.fn(),
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
  idProdutoAnualIos: () => (loja.preco === "R$ 69,90" ? "core_anual_69" : "core_anual_97"),
  mesesDeMensalQuePagamOAno: () => (loja.preco === "R$ 69,90" ? 3 : 4),
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
  carregarPresente69: vi.fn(async () => loja.presente),
  comprarPresente69: vi.fn(async () => true),
  carregarMensal19: vi.fn(async () => null),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));

import { trackEvent } from "@/lib/analytics";
import { comprarAnualIos, comprar as comprarAssinatura } from "@/lib/revenuecat";
import { CHAVE_FORCA_OFERTAS, PAYWALL_CURTO, PLANO_CADEADO, ofertaLigada, registrarChavesRemotas, _zerarChavesRemotas, lerChavesRemotas } from "@/lib/ofertas-saida";
import { PaywallIOS, PREPARACAO_DA_FOLHA_MS, diaDoAviso, linhaDoTempoDoTeste } from "@/pages/funis/ios/PaywallIOS";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const ligar = (v: string) => localStorage.setItem(CHAVE_FORCA_OFERTAS, v);
const voltar = () => act(() => { window.dispatchEvent(new CustomEvent("core:voltar")); });
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const montar = (area: "dinheiro" | "rotina" | "corpo" | "saude" | "metas" = "dinheiro", onPago = vi.fn()) => {
  render(<MemoryRouter><PaywallIOS area={area} answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
  return onPago;
};
const dd = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarAnualIos).mockClear();
  vi.mocked(comprarAssinatura).mockClear();
  notif.pedirLembrete.mockClear(); notif.recuperar.mockClear(); notif.cancelarRecuperacao.mockClear();
  ios();
  loja.preco = "R$ 97,90"; loja.mes = "R$ 8,16"; loja.valorAnual = 97.9; loja.valorMensal = 24.9; loja.precoMensal = "R$ 24,90"; loja.precoTeste = "R$ 0,00";
  loja.dias = 3; loja.trial = true; loja.compraOk = true; loja.motivo = null;
  loja.presente = { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 };
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("a chave PAYWALL_CURTO (e a PLANO_CADEADO)", () => {
  it("nascem 'off'; metadata `paywall_curto`/`plano_cadeado` e a lista `?ofertas-saida=curto,cadeado` ligam", () => {
    expect([PAYWALL_CURTO, PLANO_CADEADO]).toEqual(["off", "off"]);
    expect(ofertaLigada("curto")).toBe(false);
    expect(ofertaLigada("cadeado")).toBe(false);
    registrarChavesRemotas({ current: { identifier: "d", metadata: { paywall_curto: "on", plano_cadeado: "on" } }, all: {} });
    expect(ofertaLigada("curto")).toBe(true);
    expect(ofertaLigada("cadeado")).toBe(true);
    expect(lerChavesRemotas({ current: { identifier: "d", metadata: { paywall_curto: "off" } }, all: {} })).toEqual({ curto: "off" });
    _zerarChavesRemotas();
    ligar("curto,cadeado");
    expect(ofertaLigada("curto")).toBe(true);
    expect(ofertaLigada("cadeado")).toBe(true);
    expect(ofertaLigada("textos")).toBe(false);
  });

  it("linha do tempo pura: Dia 1 = hoje; aviso no dia N−1; cobrança no dia N com o preço da loja; sem preço do teste = 'sem cobrança'", () => {
    const hoje = new Date(2026, 9, 10);
    expect(linhaDoTempoDoTeste(3, "R$ 97,90", "R$ 0,00", hoje).map((l) => l.t)).toEqual([
      "Hoje · R$ 0,00", "Dia 2 (11/10) · a gente te avisa", "Dia 3 (12/10) · R$ 97,90/ano só se você continuar",
    ]);
    expect(linhaDoTempoDoTeste(7, "R$ 69,90", "$0.00", hoje).map((l) => l.t)).toEqual([
      "Hoje · $0.00", "Dia 6 (15/10) · a gente te avisa", "Dia 7 (16/10) · R$ 69,90/ano só se você continuar",
    ]);
    expect(linhaDoTempoDoTeste(3, "R$ 97,90", null, hoje)[0].t).toBe("Hoje · sem cobrança");
    expect(linhaDoTempoDoTeste(1, "R$ 97,90", "R$ 0,00", hoje).map((l) => l.t)).toEqual(["Hoje · R$ 0,00", "Dia 1 (10/10) · R$ 97,90/ano só se você continuar"]);
    // a virada do mês
    expect(linhaDoTempoDoTeste(3, "R$ 97,90", "R$ 0,00", new Date(2026, 9, 31))[2].t).toMatch(/Dia 3 \(02\/11\)/);
    // a linha única do Cal AI: o dia do aviso (N−1)
    expect(diaDoAviso(3, hoje)).toBe("11/10");
    expect(diaDoAviso(7, hoje)).toBe("15/10");
    expect(diaDoAviso(3, new Date(2026, 9, 31))).toBe("01/11");
    expect(diaDoAviso(1, hoje)).toBeNull();
  });
});

describe("OFF: o paywall do iPhone é o de hoje", () => {
  it("cronograma + duas colunas + 'Começar 3 dias grátis'; nada do curto; evento sem paywall_curto", async () => {
    montar();
    expect(await screen.findByText("por mês · R$ 97,90/ano")).toBeInTheDocument();
    expect(screen.queryByTestId("ios-curto")).toBeNull();
    expect(screen.queryByTestId("ios-linha-do-tempo")).toBeNull();
    expect(screen.queryByTestId("ios-ver-mais")).toBeNull();
    expect(screen.queryByTestId("ios-curto-anual")).toBeNull();
    expect(screen.getByTestId("ios-cronograma")).toBeInTheDocument();
    expect(screen.getByTestId("ios-coluna-anual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/pra continuar|A Apple vai mostrar|economize|cobrado por ano|a gente te avisa dia/);
    expect(screen.queryByTestId("ios-curto-hero")).toBeNull();
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
    expect(eventos("paywall_oferta_vista")[0]).not.toHaveProperty("paywall_curto");
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).not.toHaveProperty("paywall_curto");
    // sem pílula: a folha abre no toque
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
  });
});

describe("ON: a estrutura do Cal AI, cheia de cima a baixo", () => {
  beforeEach(() => ligar("curto"));
  const esperarCurto = () => screen.findByTestId("ios-curto-legal");

  it("imagem + Voltar redondo, título, card do anual com '3 DIAS GRÁTIS' / 'Comece grátis e economize 67%' / 'R$ 97,90 cobrado por ano' / 'R$ 8,16/mês', mensal 'R$ 24,90/mês', linha única, 'Continuar', legal em 2 linhas, Termos · Privacidade · Restaurar", async () => {
    montar();
    await esperarCurto();
    const tela = screen.getByTestId("ios-curto");
    const hero = screen.getByTestId("ios-curto-hero");
    expect(hero.querySelector("img")).toHaveAttribute("src", "/paywall-hero.jpg");
    expect(screen.getByTestId("ios-curto-voltar")).toHaveAttribute("aria-label", "Voltar");
    expect(tela.querySelector("h1")).toHaveTextContent("Comece seus 3 dias grátis pra continuar");
    const anual = screen.getByTestId("ios-curto-anual");
    expect(anual).toHaveAttribute("aria-checked", "true");
    expect(anual).toHaveTextContent("3 DIAS GRÁTIS");
    expect(anual).toHaveTextContent("Comece grátis e economize 67%");
    expect(anual).toHaveTextContent("R$ 97,90 cobrado por ano");
    expect(anual).toHaveTextContent("R$ 8,16/mês");
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 67%");
    const mensal = screen.getByTestId("ios-curto-mensal");
    expect(mensal).toHaveAttribute("aria-checked", "false");
    expect(mensal).toHaveTextContent("Mensal");
    expect(mensal).toHaveTextContent("R$ 24,90/mês");
    expect(screen.getByTestId("ios-sem-cobranca")).toHaveTextContent(`Sem cobrança hoje · a gente te avisa dia ${dd(1)}`);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.getByTestId("ios-curto-legal")).toHaveTextContent("3 dias grátis, depois R$ 97,90 por ano. Renova automaticamente, a menos que cancele na App Store.");
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(screen.getByText("Termos")).toHaveAttribute("href", "/termos");
    expect(screen.getByText("Privacidade")).toHaveAttribute("href", "/privacidade");
    expect(screen.getByTestId("ios-tenho-codigo")).toBeInTheDocument();
    // o que saiu: cronograma, colunas, depoimentos, selos, estrelas, "ver mais"
    expect(screen.queryByTestId("ios-cronograma")).toBeNull();
    expect(screen.queryByTestId("ios-coluna-anual")).toBeNull();
    expect(screen.queryByText("Como funciona o teste")).toBeNull();
    expect(screen.queryByText("Compra pela App Store")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Ver mais|aprovaram|Pix|Google|Play|vitalício|garantia/i);
    // eventos: os de hoje + paywall_curto
    expect(eventos("funnel_view")[0]).toMatchObject({ step: "offer", funil: "ios", loja: "ios" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ paywall_curto: true, economia: 67, oferta: "anual_97", trial: true });
    // a pílula do PAYWALL_TEXTOS não aparece junto (uma só)
    expect(screen.queryByTestId("ios-apple-confirma")).toBeNull();
  });

  it("com PAYWALL_TEXTOS também ligado, a pílula de sempre NÃO duplica — só a do toque", async () => {
    ligar("curto,textos");
    montar();
    await esperarCurto();
    expect(screen.queryByTestId("ios-apple-confirma")).toBeNull();
    expect(document.body.textContent).not.toMatch(/A Apple vai pedir confirmação/);
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 67%");
  });

  it("o toque em Continuar: pílula 'A Apple vai mostrar R$ 97,90/ano: é o valor depois dos 3 dias. Hoje: R$ 0,00.' por ~1,2 s, botão travado, e SÓ ENTÃO a folha abre; 2º toque não abre duas", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      await esperarCurto();
      const botao = screen.getByRole("button", { name: "Continuar" });
      fireEvent.click(botao);
      const pilula = screen.getByTestId("ios-preparando-folha");
      expect(pilula).toHaveTextContent("A Apple vai mostrar R$ 97,90/ano: é o valor depois dos 3 dias. Hoje: R$ 0,00.");
      expect(vi.mocked(comprarAnualIos)).not.toHaveBeenCalled();
      expect(botao).toBeDisabled();
      expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).toMatchObject({ paywall_curto: true, produto: "core_anual_97" });
      fireEvent.click(botao);
      await act(async () => { vi.advanceTimersByTime(PREPARACAO_DA_FOLHA_MS + 50); });
      await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
      expect(eventos("app_sheet_success")).toHaveLength(1);
      expect(notif.pedirLembrete).toHaveBeenCalledWith(expect.objectContaining({ precoAno: "R$ 97,90" }));
    } finally { vi.useRealTimers(); }
  });

  it("mensal: título vira 'Escolha seu plano', 'Sem cobrança hoje' some, legal do mensal, SEM pílula (cobra hoje); o selo fica no anual", async () => {
    montar();
    await esperarCurto();
    fireEvent.click(screen.getByTestId("ios-curto-mensal"));
    expect(screen.getByTestId("ios-curto-mensal")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("ios-curto-anual")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("ios-curto").querySelector("h1")).toHaveTextContent("Escolha seu plano pra continuar");
    expect(screen.queryByTestId("ios-sem-cobranca")).toBeNull();
    expect(eventos("funnel_click").find((e) => e.cta === "ios_plano")).toMatchObject({ plano: "mensal", paywall_curto: true });
    expect(screen.getByTestId("ios-curto-legal")).toHaveTextContent("R$ 24,90 por mês pela App Store. Renova automaticamente, a menos que cancele na App Store.");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
    await waitFor(() => expect(vi.mocked(comprarAssinatura)).toHaveBeenCalledWith("core_mensal", { semTrial: true }));
    expect(screen.getByTestId("ios-economize")).toBeInTheDocument();
  });

  it("preços da loja: 69,90 troca card, selo (77%) e legal; mensal de 26,90 troca o card do mensal; sem o mensal da loja: sem selo e 'R$ —'", async () => {
    loja.preco = "R$ 69,90"; loja.valorAnual = 69.9; loja.mes = "R$ 5,83";
    montar();
    await esperarCurto();
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("R$ 69,90 cobrado por ano");
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("R$ 5,83/mês");
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 77%");
    expect(screen.getByTestId("ios-curto-legal")).toHaveTextContent("depois R$ 69,90 por ano");
    expect(document.body.textContent).not.toMatch(/97,90/);
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ oferta: "anual_69", paywall_curto: true, economia: 77 });
    cleanup();
    loja.preco = "R$ 97,90"; loja.valorAnual = 97.9; loja.mes = "R$ 8,16"; loja.precoMensal = "R$ 26,90"; loja.valorMensal = 26.9;
    montar();
    await esperarCurto();
    expect(screen.getByTestId("ios-curto-mensal")).toHaveTextContent("R$ 26,90/mês");
    expect(document.body.textContent).not.toMatch(/24,90/);
    cleanup();
    loja.precoMensal = null; loja.valorMensal = null;
    montar();
    await esperarCurto();
    expect(screen.getByTestId("ios-curto-mensal")).toHaveTextContent("R$ —");
    expect(screen.queryByTestId("ios-economize")).toBeNull();
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("Comece grátis");
  });

  it("a duração vem da loja: 7 dias muda título, cabeçalho, aviso e legal; sem direito ao teste: 'Escolha seu plano', card 'Anual' sem cabeçalho, sem 'Sem cobrança hoje', folha abre no toque", async () => {
    loja.dias = 7;
    montar();
    await esperarCurto();
    expect(screen.getByTestId("ios-curto").querySelector("h1")).toHaveTextContent("Comece seus 7 dias grátis pra continuar");
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("7 DIAS GRÁTIS");
    expect(screen.getByTestId("ios-sem-cobranca")).toHaveTextContent(`a gente te avisa dia ${dd(5)}`);
    expect(screen.getByTestId("ios-curto-legal")).toHaveTextContent("7 dias grátis, depois R$ 97,90 por ano.");
    cleanup();
    loja.trial = false; loja.precoTeste = null;
    montar();
    await esperarCurto();
    expect(screen.getByTestId("ios-curto").querySelector("h1")).toHaveTextContent("Escolha seu plano pra continuar");
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("Anual e economize 67%");
    expect(screen.getByTestId("ios-curto-anual")).not.toHaveTextContent("DIAS GRÁTIS");
    expect(screen.queryByTestId("ios-sem-cobranca")).toBeNull();
    expect(document.body.textContent).not.toMatch(/grátis|Sem cobrança/);
    expect(screen.getByTestId("ios-curto-legal")).toHaveTextContent("R$ 97,90 por ano pela App Store. Renova automaticamente");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
  });

  it("16/10: fechou a folha do 97,90 → o presente 69,90 com 3 dias grátis por cima (não o cartão de mesmo preço); tocar compra o core_anual_69", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onPago = montar();
      await esperarCurto();
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      await act(async () => { vi.advanceTimersByTime(PREPARACAO_DA_FOLHA_MS + 50); });
      const folha = await screen.findByTestId("presente69");
      expect(folha).toHaveAttribute("data-lugar", "folha_cancelada");
      expect(folha.textContent).toMatch(/R\$ 69,90/);
      expect(folha.textContent).toMatch(/3 dias grátis/);
      expect(screen.getByTestId("presente69-regra").textContent).toMatch(/Nada é cobrado hoje\./);
      expect(screen.queryByTestId("ios-segunda-chance")).toBeNull();
      expect(screen.getByTestId("ios-curto")).toBeInTheDocument(); // o paywall continua embaixo
      await act(async () => { vi.advanceTimersByTime(450); }); // a caixa abre e libera o CTA
      const { comprarPresente69 } = await import("@/lib/revenuecat");
      await act(async () => { fireEvent.click(screen.getByTestId("presente69-cta")); });
      await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
      expect(vi.mocked(comprarPresente69)).toHaveBeenCalledWith("folha_cancelada");
      expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_69", oferta: "presente69", lugar: "folha_cancelada", segunda_chance: "imediata" });
    } finally { vi.useRealTimers(); }
  });

  it("presente desligado (`presente: off` na offering): a 2ª chance de sempre — fechou a folha → cartão 'Hoje você não paga nada' → 'Tentar de novo' reabre a compra", async () => {
    loja.presente = null;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      await esperarCurto();
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      await act(async () => { vi.advanceTimersByTime(PREPARACAO_DA_FOLHA_MS + 50); });
      await screen.findByTestId("ios-segunda-chance");
      expect(eventos("folha_segunda_chance_view")[0]).toMatchObject({ segunda_chance: "imediata" });
      loja.compraOk = true; loja.motivo = null;
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
      await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(2));
      expect(eventos("folha_segunda_chance_click")).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it("o Voltar redondo emite core:voltar: com OFERTA_X_PAYWALL abre o presente 69,90 por cima (e a recuperação arma); sem presente aberto, chama onVoltar do funil; paywall_saiu sai no desmonte", async () => {
    ligar("curto,x_paywall,recuperacao");
    const onVoltar = vi.fn();
    render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} onVoltar={onVoltar} /></MemoryRouter>);
    await esperarCurto();
    fireEvent.click(screen.getByTestId("ios-curto-voltar"));
    expect(eventos("funnel_click").find((e) => e.cta === "ios_paywall_voltar")).toMatchObject({ paywall_curto: true });
    const folha = await screen.findByTestId("presente69");
    expect(folha).toHaveAttribute("data-lugar", "x_paywall");
    expect(screen.getByTestId("ios-curto")).toBeInTheDocument(); // o paywall continua embaixo
    expect(notif.recuperar).toHaveBeenCalledWith("Dinheiro");
    await espera(500);
    expect(onVoltar).not.toHaveBeenCalled(); // o presente abriu: o recuo não acontece por cima dele
    cleanup();
    expect(eventos("paywall_saiu")[0]).toMatchObject({ funil: "ios", motivo: "voltar", viu_oferta: true });
    // sem presente (já visto neste aparelho): o funil recua
    localStorage.setItem("core-presente69-x-paywall-visto", "1");
    vi.mocked(trackEvent).mockClear();
    render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} onVoltar={onVoltar} /></MemoryRouter>);
    await esperarCurto();
    fireEvent.click(screen.getByTestId("ios-curto-voltar"));
    await espera(500);
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it("sem onVoltar (o funil de hoje não passa): o Voltar só emite core:voltar e nada quebra", async () => {
    montar();
    await esperarCurto();
    fireEvent.click(screen.getByTestId("ios-curto-voltar"));
    await espera(500);
    expect(screen.getByTestId("ios-curto")).toBeInTheDocument();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });
});
