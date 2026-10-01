/**
 * O PAYWALL DO iPHONE, RENDERIZADO (31/08).
 *
 * Cada teste aqui corresponde a uma reprovação da App Review — e nenhuma
 * delas dá erro de compilação. Todas passam no typecheck e só apareceriam
 * quando um revisor abrisse a tela, dias depois de enviar:
 *
 *   · 3.1.1 — "Restaurar compras" alcançável no paywall
 *   · 3.1.2 — Termos e Privacidade com link na própria tela de compra
 *   · 3.1.1 — nenhuma menção a pagamento de fora da App Store
 *   · 3.1.2 — assinatura tem que dizer que RENOVA
 *
 * Foi um teste como estes que pegou os selos "Pix na hora" e "Garantia de
 * 7 dias" escondidos num componente importado — coisa que revisão de código
 * não pegaria, porque o texto não estava neste arquivo.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallIOS } from "./PaywallIOS";

// 20/09: preço "da loja" mutável por teste — a App Store manda a string já
// formatada e ela muda com a vitrine ("R$ 97,90" no Brasil, "$14.99" nos EUA).
const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", dias: 3, trial: true, compraOk: true, motivo: null as string | null,
  // 01/10: o produto/braço que a offering atual serviu (97,90 × 69,90) e um
  // "segura" pra ensaiar a tela ANTES de a loja responder
  produto: "core_anual_97", offering: "default" as string | null,
  segurar: null as null | (() => void),
}));
// 01/10: o paywall NÃO abre diálogo de permissão (24/09) — mas a compra em
// teste GUARDA o pedido do lembrete "acaba amanhã" (pedirLembreteDoTeste), que
// a Missão arma depois de a permissão ser decidida. Espiões pros dois lados.
const notif = vi.hoisted(() => ({
  pedir: vi.fn(async () => true),
  agendar: vi.fn(async () => true),
  pedirLembrete: vi.fn(async (_p: { fimMs: number; precoAno: string }) => "pendente" as const),
}));
vi.mock("@/lib/notificacoes", () => ({
  estadoPermissao: async () => "prompt",
  pedirPermissao: () => notif.pedir(),
  agendarLembreteDoTeste: () => notif.agendar(),
  pedirLembreteDoTeste: (p: { fimMs: number; precoAno: string }) => notif.pedirLembrete(p),
}));

vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  // 18/09: anual com 3 dias grátis no lugar do vitalício
  prefetchAnualIos: vi.fn(() => (loja.segurar ? new Promise<void>((r) => { loja.segurar = r; }) : Promise.resolve())),
  temAnualIos: () => true,
  precoAnualIos: () => loja.preco,
  idProdutoAnualIos: () => loja.produto,
  ofertaAnualIos: () => loja.produto.replace(/^core_/, ""),
  dadosDaOfertaIos: () => ({ oferta: loja.produto.replace(/^core_/, ""), produto: loja.produto, offering: loja.offering, preco: loja.preco, pacote: !!loja.offering }),
  precoMensalDoAnualIos: () => loja.mes,
  diasTrialIos: () => (loja.trial ? loja.dias : 0),
  anualIosTemTrial: () => loja.trial,
  ultimaCompraAnualFoiTrial: () => loja.trial,
  fimDaUltimaCompraTrial: () => null,
  comprarAnualIos: vi.fn(async () => loja.compraOk),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  comprar: vi.fn(), comprarVitalicio: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => loja.motivo,
  sincronizarAssinatura: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

import { trackEvent } from "@/lib/analytics";
import { comprarAnualIos, comprar as comprarAssinatura } from "@/lib/revenuecat";

// gasto tem que ser uma CHAVE real do quiz (GASTO_ANCHOR) — senão o cartão
// âncora nem monta e o teste "passa" sem olhar pra ele (foi assim que a build
// 20 saiu com "CORE vitalício · R$ $14.99" no cartão).
const montar = (opts: { area?: "dinheiro" | "corpo" | "saude"; onPago?: () => void } = {}) =>
  render(
    <MemoryRouter>
      <PaywallIOS area={opts.area ?? "dinheiro"} answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={opts.onPago ?? (() => {})} />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  loja.preco = "R$ 97,90"; loja.mes = "R$ 8,16"; loja.dias = 3; loja.trial = true; loja.compraOk = true; loja.motivo = null;
  loja.produto = "core_anual_97"; loja.offering = "default"; loja.segurar = null;
  notif.pedir.mockClear(); notif.agendar.mockClear(); notif.pedirLembrete.mockClear();
  vi.mocked(trackEvent).mockClear(); vi.mocked(comprarAnualIos).mockClear(); vi.mocked(comprarAssinatura).mockClear();
});
afterEach(cleanup);

describe("Paywall do iPhone", () => {
  // ---------- 20/09: anual com dias grátis, do jeito aprovado pelo dono ----------
  it("(A) âncora e coluna mostram o preço POR MÊS, com o ano ao lado", async () => {
    montar();
    expect(await screen.findByText(/pela sua estimativa/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 8,16/).length).toBeGreaterThanOrEqual(2); // âncora + coluna
    expect(screen.getAllByText(/R\$ 97,90\/ano/).length).toBeGreaterThan(0);
    expect(screen.getByText("por mês · R$ 97,90/ano")).toBeInTheDocument(); // sub da âncora (uma linha)
  });

  it("(B) cronograma do teste: hoje / dia 2 aviso / dia 3 cobrança, com o preço do ano (promessa de volta, 01/10)", async () => {
    montar();
    expect(await screen.findByText("Como funciona o teste")).toBeInTheDocument();
    expect(screen.getByText("Hoje · acesso a tudo")).toBeInTheDocument();
    expect(screen.getByText("Dia 2 · a gente te avisa")).toBeInTheDocument();
    expect(screen.getByText(/1 dia antes do teste acabar\. Nada é cobrado sem aviso/)).toBeInTheDocument();
    expect(screen.getByText("Dia 3 · só se você continuar")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 97,90 pelo ano inteiro/)).toBeInTheDocument();
  });

  it("(C) botão, 'sem cobrança hoje' e selos coerentes com uma assinatura que renova", async () => {
    montar();
    expect(await screen.findByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
    expect(screen.getByText("Sem cobrança hoje")).toBeInTheDocument();
    expect(screen.getByText("Compra pela App Store")).toBeInTheDocument();
    expect(screen.getByText("Cancele em 1 toque")).toBeInTheDocument();
    // 01/10: a promessa de aviso voltou — clara, abaixo do botão e no selo
    expect(screen.getByTestId("ios-sem-cobranca")).toHaveTextContent("Sem cobrança hoje · a gente te avisa 1 dia antes do teste acabar");
    expect(screen.getByText("Aviso 1 dia antes de cobrar")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/sem mensalidade/i);
    expect(document.body.textContent).toMatch(/3 dias grátis, depois R\$ 97,90\/ano pela App Store · renova automaticamente/);
  });

  it("(F) a duração vem da loja: 7 dias muda botão, selo, cronograma e legal sem build", async () => {
    loja.dias = 7;
    montar();
    expect(await screen.findByRole("button", { name: /Começar 7 dias grátis/ })).toBeInTheDocument();
    expect(screen.getByText("7 DIAS GRÁTIS")).toBeInTheDocument();
    expect(screen.getByText("Dia 6 · a gente te avisa")).toBeInTheDocument();
    expect(screen.getByText("Dia 7 · só se você continuar")).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/7 dias grátis, depois/);
    expect(document.body.textContent).not.toMatch(/3 dias/);
  });

  it("sem teste (conta já usou a oferta): nem cronograma nem promessa de grátis — só o anual como assinatura", async () => {
    loja.trial = false;
    montar();
    expect(await screen.findByRole("button", { name: /Quero o ano — R\$ 97,90/ })).toBeInTheDocument();
    expect(screen.queryByText("Como funciona o teste")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem cobrança hoje")).not.toBeInTheDocument();
    expect(screen.getByText("Cancele quando quiser")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/grátis/i);
  });

  it("(E) mensal selecionado: cronograma e 'sem cobrança hoje' somem, legal diz que renova", async () => {
    montar();
    await screen.findByText("Como funciona o teste");
    fireEvent.click(screen.getByText("mês"));
    expect(screen.queryByText("Como funciona o teste")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem cobrança hoje")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Assinatura de R\$ 24,90\/mês pela App Store · renova automaticamente/);
  });

  it("(D, 01/10) compra em teste: guarda o pedido do lembrete (3 dias, preço da loja) e segue DIRETO pro cadastro — sem diálogo de permissão", async () => {
    const onPago = vi.fn();
    vi.setSystemTime(new Date(2026, 9, 1, 15, 0));
    try {
      montar({ onPago });
      fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
      await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/Te aviso/)).not.toBeInTheDocument();
      expect(notif.pedir).not.toHaveBeenCalled(); // o diálogo é da Missão B1, não do paywall
      expect(notif.pedirLembrete).toHaveBeenCalledTimes(1);
      const pedido = notif.pedirLembrete.mock.calls[0][0];
      expect(pedido.precoAno).toBe("R$ 97,90");
      expect(pedido.fimMs).toBe(new Date(2026, 9, 4, 15, 0).getTime()); // 3 dias depois da compra
    } finally { vi.useRealTimers(); }
  });

  it("(D) sem direito ao teste (cobra na hora): compra do anual NÃO guarda lembrete nenhum", async () => {
    loja.trial = false;
    const onPago = vi.fn();
    montar({ onPago });
    fireEvent.click(await screen.findByRole("button", { name: /Quero o ano/ }));
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(notif.pedirLembrete).not.toHaveBeenCalled();
  });

  it("(D) mensal: nada de lembrete de teste", async () => {
    const onPago = vi.fn();
    vi.mocked(comprarAssinatura).mockResolvedValueOnce(true);
    montar({ onPago });
    await screen.findByText("Como funciona o teste");
    fireEvent.click(screen.getByText("mês"));
    fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(notif.pedirLembrete).not.toHaveBeenCalled();
  });

  // ---------- 01/10: teste de preço 97,90 × 69,90 (RevenueCat Experiments) ----------
  describe("teste de preço: o paywall lê o anual da offering atual", () => {
    it("braço B (core_anual_69, R$ 69,90): coluna, âncora, cronograma, botão e legal mudam com a loja — e nenhum 97,90 sobra", async () => {
      loja.produto = "core_anual_69"; loja.preco = "R$ 69,90"; loja.mes = "R$ 5,83"; loja.offering = "anual_69";
      montar();
      expect(await screen.findByText("por mês · R$ 69,90/ano")).toBeInTheDocument();
      expect(screen.getAllByText(/R\$ 5,83/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/R\$ 69,90 pelo ano inteiro/)).toBeInTheDocument();
      expect(document.body.textContent).toMatch(/3 dias grátis, depois R\$ 69,90\/ano pela App Store/);
      expect(document.body.textContent).not.toMatch(/97,90|8,16/);
      // o braço vai junto em cada evento: o que ela viu…
      await waitFor(() => expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("paywall_oferta_vista", expect.objectContaining({ oferta: "anual_69", produto: "core_anual_69", offering: "anual_69", preco: "R$ 69,90" })));
      // …o toque no botão…
      fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
      expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("funnel_click", expect.objectContaining({ cta: "app_paywall_cta", produto: "core_anual_69", oferta: "anual_69", preco: "R$ 69,90" }));
      // …e a compra (o produto NÃO é mais um id fixo; o lembrete leva o preço do braço)
      await waitFor(() => expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("app_sheet_success", expect.objectContaining({ produto: "core_anual_69", oferta: "anual_69" })));
      expect(notif.pedirLembrete).toHaveBeenCalledWith(expect.objectContaining({ precoAno: "R$ 69,90" }));
    });

    it("braço A (core_anual_97): segue 97,90 e os eventos dizem anual_97", async () => {
      montar();
      await screen.findByText("por mês · R$ 97,90/ano");
      await waitFor(() => expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("paywall_oferta_vista", expect.objectContaining({ oferta: "anual_97", produto: "core_anual_97" })));
      fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
      expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("funnel_click", expect.objectContaining({ produto: "core_anual_97", oferta: "anual_97" }));
    });

    it("ANTES de a loja responder não aparece preço nenhum (um traço no lugar) — nada de 97,90 chumbado", async () => {
      loja.segurar = () => {};
      montar();
      expect(await screen.findByText(/pela sua estimativa/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/97,90|8,16|69,90/);
      expect(screen.getByText("por mês · R$ —/ano")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument(); // o botão não precisa do preço
      // a loja responde: os números entram
      loja.segurar?.(); loja.segurar = null;
      expect(await screen.findByText("por mês · R$ 97,90/ano")).toBeInTheDocument();
    });

    it("segunda chance leva o braço junto", async () => {
      loja.produto = "core_anual_69"; loja.preco = "R$ 69,90"; loja.compraOk = false; loja.motivo = "cancelou";
      montar();
      fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
      await screen.findByTestId("ios-segunda-chance");
      expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("folha_segunda_chance_view", expect.objectContaining({ produto: "core_anual_69", oferta: "anual_69", preco: "R$ 69,90" }));
    });
  });

  it("depoimento com 'pagamento único' NÃO aparece no iPhone (áreas corpo e saúde)", async () => {
    montar({ area: "corpo" });
    await screen.findByText("O que dizem quem já usa");
    expect(document.body.textContent).not.toMatch(/pagamento único/i);
    expect(screen.queryByText(/Sabrina/)).not.toBeInTheDocument();
  });

  it("não cita vitalício em lugar nenhum — o iPhone vende ANUAL com 3 dias grátis (bug da build 20)", async () => {
    montar();
    expect(await screen.findByText(/pela sua estimativa/)).toBeInTheDocument(); // cartão âncora montou
    expect(screen.getByText(/CORE anual/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/vitalíc/i);
    expect(document.body.textContent).not.toMatch(/pra sempre|1x,/i);
  });

  it("preço da loja em outra moeda NÃO ganha R$ na frente — vitrine dos EUA que o revisor vê (bug da build 20)", async () => {
    loja.preco = "$14.99";
    try {
      montar();
      // o preço da loja chega depois do prefetch (assíncrono)
      expect((await screen.findAllByText(/\$14\.99/)).length).toBeGreaterThan(0);
      const corpo = document.body.textContent ?? "";
      expect(corpo).not.toMatch(/R\$\s*\$/);
      expect(corpo).not.toMatch(/R\$\s*R\$/);
      expect(corpo).not.toMatch(/vitalíc/i);
    } finally {
      loja.preco = "R$ 97,90";
    }
  });

  it("mostra os DOIS preços — spec do dono", async () => {
    montar();
    expect(screen.getByText("meses")).toBeInTheDocument(); // 18/09: anual com 3 dias grátis no lugar do vitalício
    expect(screen.getByText("mês")).toBeInTheDocument();
    // 20/09: o anual mostra o POR MÊS em destaque e o ano ao lado (01/10: só depois de a loja responder)
    expect((await screen.findAllByText(/R\$ 97,90\/ano/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 24,90").length).toBeGreaterThan(0);
  });

  it("não tem A/B — não grava braço no localStorage de ninguém", () => {
    montar();
    expect(localStorage.getItem("core-w-braco")).toBeNull();
  });

  it("traz Restaurar compras e os links legais — 3.1.1 e 3.1.2", () => {
    montar();
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(screen.getByText("Termos")).toBeInTheDocument();
    expect(screen.getByText("Privacidade")).toBeInTheDocument();
  });

  it("não cita Pix, Google nem Play em lugar nenhum da tela — 3.1.1", () => {
    const { container } = montar();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/pix/i);
    expect(texto).not.toMatch(/google/i);
    expect(texto).not.toMatch(/play/i);
    expect(texto).toMatch(/App Store/);
  });

  it("não promete garantia própria — na Apple quem reembolsa é a Apple", () => {
    const { container } = montar();
    expect(container.textContent ?? "").not.toMatch(/garantia/i);
  });

  it("avisa que a assinatura RENOVA — 3.1.2", () => {
    const { container } = montar();
    expect(container.textContent ?? "").toMatch(/renova/i);
  });

  // ---------- 28/09: segunda chance pra quem fecha a folha da Apple ----------
  describe("segunda chance (fechou a folha da Apple)", () => {
    const TITULO = "Hoje você não paga nada · cancela em 2 toques";
    const vezes = (evento: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === evento).length;
    const fecharFolhaDoAnual = async () => {
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
    };

    it("fechou a folha do anual com teste: cartão perto do botão; 'Tentar de novo' reabre a compra do anual e some quando dá certo", async () => {
      const onPago = vi.fn();
      montar({ onPago });
      await fecharFolhaDoAnual();
      expect(await screen.findByText(TITULO)).toBeInTheDocument();
      expect(screen.getByTestId("ios-segunda-chance")).toContainElement(screen.getByRole("button", { name: "Tentar de novo" }));
      expect(vezes("folha_segunda_chance_view")).toBe(1);
      // não é modal: o botão principal continua vivo, com o texto de sempre
      expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled();
      expect(comprarAnualIos).toHaveBeenCalledTimes(1);

      loja.compraOk = true; loja.motivo = null;
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
      await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
      expect(comprarAnualIos).toHaveBeenCalledTimes(2); // a MESMA compra do botão principal
      expect(vezes("folha_segunda_chance_click")).toBe(1);
      expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
    });

    it("aparece 1 vez por sessão do paywall: fechou de novo depois de usar o cartão, ele não volta", async () => {
      montar();
      await fecharFolhaDoAnual();
      fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
      await waitFor(() => expect(comprarAnualIos).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
      expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
      await waitFor(() => expect(comprarAnualIos).toHaveBeenCalledTimes(3));
      await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
      expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
      expect(vezes("folha_segunda_chance_view")).toBe(1);
    });

    it("some com o mensal selecionado e volta com o anual — a mesma exibição, um evento só", async () => {
      montar();
      await fecharFolhaDoAnual();
      await screen.findByText(TITULO);
      fireEvent.click(screen.getByText("mês"));
      expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
      fireEvent.click(screen.getByText("meses"));
      expect(screen.getByText(TITULO)).toBeInTheDocument();
      expect(vezes("folha_segunda_chance_view")).toBe(1);
    });

    it("erro da loja (não foi ela que fechou): mensagem de erro, sem cartão", async () => {
      montar();
      loja.compraOk = false; loja.motivo = "billing_erro";
      fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
      await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
      expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
      expect(vezes("folha_segunda_chance_view")).toBe(0);
    });

    it("sem direito ao teste: nunca promete 'não paga nada'", async () => {
      loja.trial = false;
      montar();
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(await screen.findByRole("button", { name: /Quero o ano — R\$ 97,90/ }));
      await waitFor(() => expect(screen.getByRole("button", { name: /Quero o ano — R\$ 97,90/ })).toBeEnabled());
      expect(document.body.textContent).not.toMatch(/não paga nada/);
      expect(vezes("folha_segunda_chance_view")).toBe(0);
    });

    it("fechou a folha do MENSAL: sem cartão (o teste grátis é só do anual)", async () => {
      montar();
      await screen.findByText("Como funciona o teste");
      fireEvent.click(screen.getByText("mês"));
      loja.motivo = "cancelou";
      fireEvent.click(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ }));
      await waitFor(() => expect(comprarAssinatura).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole("button", { name: /Começar por R\$ 24,90\/mês/ })).toBeEnabled());
      fireEvent.click(screen.getByText("meses"));
      expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
      expect(vezes("folha_segunda_chance_view")).toBe(0);
    });
  });

  it("é independente do Android: não lê nem escreve a flag do A/B de lá", () => {
    // Simula a sessão do Android tendo sorteado um braço neste aparelho.
    // O paywall do iPhone tem que ignorar completamente.
    localStorage.setItem("core-w-braco", "a");
    montar();
    // braço "a" no Android = um preço só; aqui as duas colunas continuam
    expect(screen.getByText("meses")).toBeInTheDocument(); // 18/09: anual com 3 dias grátis no lugar do vitalício
    expect(screen.getByText("mês")).toBeInTheDocument();
  });
});
