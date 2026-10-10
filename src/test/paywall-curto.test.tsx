/**
 * PAYWALL CURTO DO iPHONE (10/10, 1.0.14) — chave PAYWALL_CURTO (lib/ofertas-saida, "curto").
 *
 *  · OFF (o padrão) = o paywall de hoje: cronograma, duas colunas, botão "Começar 3 dias grátis",
 *    nenhum testid/texto do curto, nenhum campo novo nos eventos.
 *  · ON: 5 blocos — título com a meta, linha do tempo com DATAS reais, anual pré-selecionado
 *    "R$ 8,16/mês" + "economize 67%", mensal numa linha "sem teste grátis", "★★★★★ +1000 pessoas
 *    aprovaram", "✓ Sem cobrança hoje" + "Começar meus 3 dias grátis" + legal de renovação;
 *    o toque mostra a pílula de preparação ~1,2 s e SÓ ENTÃO abre a folha; "Ver mais" guarda o
 *    resto; Restaurar compras/Termos/Privacidade continuam; 2ª chance, presente no Voltar e
 *    paywall_saiu seguem funcionando; `paywall_oferta_vista` ganha `paywall_curto: true`.
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
import { PaywallIOS, PREPARACAO_DA_FOLHA_MS, linhaDoTempoDoTeste } from "@/pages/funis/ios/PaywallIOS";

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
    expect(document.body.textContent).not.toMatch(/Começar meus|A Apple vai mostrar|pessoas aprovaram|economize|sem teste grátis/);
    expect(eventos("paywall_oferta_vista")[0]).not.toHaveProperty("paywall_curto");
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).not.toHaveProperty("paywall_curto");
    // sem pílula: a folha abre no toque
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
  });
});

describe("ON: 5 blocos, sem rolar", () => {
  beforeEach(() => ligar("curto"));

  it("título com a meta, linha do tempo com datas reais, anual pré-selecionado R$ 8,16/mês + economize 67%, mensal 'sem teste grátis', prova social em 1 linha, Sem cobrança hoje + botão + legal", async () => {
    montar();
    const tela = await screen.findByTestId("ios-curto");
    expect(tela.querySelector("h1")).toHaveTextContent("Seu plano pra ver pra onde seu dinheiro vai está pronto");
    const linha = await screen.findByTestId("ios-linha-do-tempo");
    expect(linha).toHaveTextContent("Hoje · R$ 0,00");
    expect(linha).toHaveTextContent(`Dia 2 (${dd(1)}) · a gente te avisa`);
    expect(linha).toHaveTextContent(`Dia 3 (${dd(2)}) · R$ 97,90/ano só se você continuar`);
    const anual = screen.getByTestId("ios-curto-anual");
    expect(anual).toHaveAttribute("aria-checked", "true");
    expect(anual).toHaveTextContent("Anual");
    expect(anual).toHaveTextContent("3 DIAS GRÁTIS");
    expect(anual).toHaveTextContent("R$ 8,16");
    expect(anual).toHaveTextContent("R$ 97,90/ano, depois dos 3 dias");
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 67%");
    const mensal = screen.getByTestId("ios-curto-mensal");
    expect(mensal).toHaveAttribute("aria-checked", "false");
    expect(mensal).toHaveTextContent("Mensal · sem teste grátis");
    expect(mensal).toHaveTextContent("R$ 24,90/mês");
    expect(screen.getByTestId("ios-prova-social")).toHaveTextContent("★★★★★ +1000 pessoas aprovaram");
    expect(screen.getByTestId("ios-sem-cobranca")).toHaveTextContent("Sem cobrança hoje");
    expect(screen.getByRole("button", { name: /Começar meus 3 dias grátis/ })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/3 dias grátis, depois R\$ 97,90\/ano pela App Store · renova automaticamente até você cancelar · cancele antes do fim do teste e não paga nada/);
    // o que saiu da dobra NÃO está na tela; o obrigatório da Apple está
    expect(screen.queryByTestId("ios-cronograma")).toBeNull();
    expect(screen.queryByText("Como funciona o teste")).toBeNull();
    expect(screen.queryByText("Compra pela App Store")).toBeNull();
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(screen.getByText("Termos")).toBeInTheDocument();
    expect(screen.getByText("Privacidade")).toBeInTheDocument();
    expect(screen.getByTestId("ios-tenho-codigo")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Pix|Google|Play|vitalício|garantia/i);
    // eventos: os de hoje + paywall_curto
    expect(eventos("funnel_view")[0]).toMatchObject({ step: "offer", funil: "ios", loja: "ios" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ paywall_curto: true, economia: 67, oferta: "anual_97", trial: true });
    // a pílula do PAYWALL_TEXTOS não aparece junto (uma só)
    expect(screen.queryByTestId("ios-apple-confirma")).toBeNull();
  });

  it("com PAYWALL_TEXTOS também ligado, a pílula de sempre NÃO duplica — só a do toque", async () => {
    ligar("curto,textos");
    montar();
    await screen.findByTestId("ios-linha-do-tempo");
    expect(screen.queryByTestId("ios-apple-confirma")).toBeNull();
    expect(document.body.textContent).not.toMatch(/A Apple vai pedir confirmação/);
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 67%");
  });

  it("o toque: pílula 'A Apple vai mostrar R$ 97,90/ano: é o valor depois dos 3 dias. Hoje: R$ 0,00.' por ~1,2 s, botão travado, e SÓ ENTÃO a folha abre; 2º toque não abre duas", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      await screen.findByTestId("ios-linha-do-tempo");
      const botao = screen.getByRole("button", { name: /Começar meus 3 dias grátis/ });
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

  it("mensal: a linha do tempo e o 'Sem cobrança hoje' somem, botão 'Começar por R$ 24,90/mês', legal diz que renova, SEM pílula (cobra hoje)", async () => {
    montar();
    await screen.findByTestId("ios-linha-do-tempo");
    fireEvent.click(screen.getByTestId("ios-curto-mensal"));
    expect(screen.getByTestId("ios-curto-mensal")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("ios-curto-anual")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("ios-linha-do-tempo")).toBeNull();
    expect(screen.queryByTestId("ios-sem-cobranca")).toBeNull();
    expect(eventos("funnel_click").find((e) => e.cta === "ios_plano")).toMatchObject({ plano: "mensal", paywall_curto: true });
    expect(document.body.textContent).toMatch(/Assinatura de R\$ 24,90\/mês pela App Store · renova automaticamente até você cancelar/);
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
    await waitFor(() => expect(vi.mocked(comprarAssinatura)).toHaveBeenCalledWith("core_mensal", { semTrial: true }));
    // o selo fica no anual
    expect(screen.getByTestId("ios-economize")).toBeInTheDocument();
  });

  it("preços da loja: 69,90 troca título do preço, linha do tempo, selo (77%) e legal; mensal de 26,90 troca a linha do mensal; sem o mensal da loja: sem selo e 'R$ —'", async () => {
    loja.preco = "R$ 69,90"; loja.valorAnual = 69.9; loja.mes = "R$ 5,83";
    montar();
    const linha = await screen.findByTestId("ios-linha-do-tempo");
    expect(linha).toHaveTextContent("R$ 69,90/ano só se você continuar");
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("R$ 5,83");
    expect(screen.getByTestId("ios-economize")).toHaveTextContent("economize 77%");
    expect(document.body.textContent).not.toMatch(/97,90/);
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ oferta: "anual_69", paywall_curto: true, economia: 77 });
    cleanup();
    loja.preco = "R$ 97,90"; loja.valorAnual = 97.9; loja.mes = "R$ 8,16"; loja.precoMensal = "R$ 26,90"; loja.valorMensal = 26.9;
    montar();
    expect(await screen.findByTestId("ios-curto-mensal")).toHaveTextContent("R$ 26,90/mês");
    expect(document.body.textContent).not.toMatch(/24,90/);
    cleanup();
    loja.precoMensal = null; loja.valorMensal = null;
    montar();
    expect(await screen.findByTestId("ios-curto-mensal")).toHaveTextContent("R$ —");
    expect(screen.queryByTestId("ios-economize")).toBeNull();
  });

  it("a duração vem da loja: 7 dias muda linha do tempo, selo e botão; sem direito ao teste: sem linha do tempo, sem 'Sem cobrança hoje', botão 'Quero o ano'", async () => {
    loja.dias = 7;
    montar();
    const linha = await screen.findByTestId("ios-linha-do-tempo");
    expect(linha).toHaveTextContent(`Dia 6 (${dd(5)}) · a gente te avisa`);
    expect(linha).toHaveTextContent(`Dia 7 (${dd(6)}) · R$ 97,90/ano só se você continuar`);
    expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("7 DIAS GRÁTIS");
    expect(screen.getByRole("button", { name: /Começar meus 7 dias grátis/ })).toBeInTheDocument();
    cleanup();
    loja.trial = false; loja.precoTeste = null;
    montar();
    expect(await screen.findByRole("button", { name: /Quero o ano — R\$ 97,90/ })).toBeInTheDocument();
    expect(screen.queryByTestId("ios-linha-do-tempo")).toBeNull();
    expect(screen.queryByTestId("ios-sem-cobranca")).toBeNull();
    expect(document.body.textContent).not.toMatch(/grátis|Sem cobrança/);
    expect(document.body.textContent).toMatch(/Assinatura de R\$ 97,90\/ano pela App Store · renova automaticamente/);
    // sem teste a pílula não existe: a folha abre no toque
    fireEvent.click(screen.getByRole("button", { name: /Quero o ano/ }));
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
  });

  it("'Ver mais' abre o que saiu da dobra (gráfico, módulos, depoimentos, selos) e fecha de novo", async () => {
    montar();
    await screen.findByTestId("ios-linha-do-tempo");
    expect(screen.queryByTestId("ios-ver-mais-conteudo")).toBeNull();
    fireEvent.click(screen.getByTestId("ios-ver-mais"));
    expect(screen.getByTestId("ios-ver-mais-conteudo")).toBeInTheDocument();
    expect(screen.getByText("Compra pela App Store")).toBeInTheDocument();
    expect(screen.getByText("Aviso 1 dia antes de cobrar")).toBeInTheDocument();
    expect(eventos("funnel_click").find((e) => e.cta === "ios_ver_mais")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Pix|Google|Play|vitalício|garantia/i);
    fireEvent.click(screen.getByTestId("ios-ver-mais"));
    expect(screen.queryByTestId("ios-ver-mais-conteudo")).toBeNull();
  });

  it("2ª chance da folha continua: fechou a folha → cartão 'Hoje você não paga nada' → 'Tentar de novo' reabre a compra", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      await screen.findByTestId("ios-linha-do-tempo");
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(screen.getByRole("button", { name: /Começar meus 3 dias grátis/ }));
      await act(async () => { vi.advanceTimersByTime(PREPARACAO_DA_FOLHA_MS + 50); });
      await screen.findByTestId("ios-segunda-chance");
      expect(eventos("folha_segunda_chance_view")[0]).toMatchObject({ segunda_chance: "imediata" });
      loja.compraOk = true; loja.motivo = null;
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
      await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(2));
      expect(eventos("folha_segunda_chance_click")).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it("o presente 69,90 no Voltar (OFERTA_X_PAYWALL) e a recuperação seguem por cima do curto; paywall_saiu sai no desmonte", async () => {
    ligar("curto,x_paywall,recuperacao");
    montar();
    await screen.findByTestId("ios-linha-do-tempo");
    voltar();
    const folha = await screen.findByTestId("presente69");
    expect(folha).toHaveAttribute("data-lugar", "x_paywall");
    expect(screen.getByTestId("ios-curto")).toBeInTheDocument(); // o paywall continua embaixo
    expect(notif.recuperar).toHaveBeenCalledWith("Dinheiro");
    await espera();
    cleanup();
    expect(eventos("paywall_saiu")[0]).toMatchObject({ funil: "ios", motivo: "voltar", viu_oferta: true });
  });

  it("as outras áreas levam a própria meta no título", async () => {
    montar("rotina");
    expect((await screen.findByTestId("ios-curto")).querySelector("h1")).toHaveTextContent("Seu plano pra organizar sua rotina está pronto");
  });
});
