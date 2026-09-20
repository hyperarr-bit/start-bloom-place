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
const loja = vi.hoisted(() => ({ preco: "R$ 97,90", mes: "R$ 8,16", dias: 3, trial: true, compraOk: true }));
// notificações: o pedido de permissão pro lembrete do teste, controlável por teste
const notif = vi.hoisted(() => ({
  estado: "prompt" as "granted" | "denied" | "prompt" | "indisponivel",
  pedir: vi.fn(async () => true),
  agendar: vi.fn(async (_o: { dias: number; precoAno: string }) => true),
}));
vi.mock("@/lib/notificacoes", () => ({
  estadoPermissao: async () => notif.estado,
  pedirPermissao: () => notif.pedir(),
  agendarLembreteDoTeste: (o: { dias: number; precoAno: string }) => notif.agendar(o),
}));

vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  // 18/09: anual com 3 dias grátis no lugar do vitalício
  prefetchAnualIos: vi.fn().mockResolvedValue(undefined),
  temAnualIos: () => true,
  precoAnualIos: () => loja.preco,
  precoMensalDoAnualIos: () => loja.mes,
  diasTrialIos: () => (loja.trial ? loja.dias : 0),
  anualIosTemTrial: () => loja.trial,
  ultimaCompraAnualFoiTrial: () => loja.trial,
  comprarAnualIos: vi.fn(async () => loja.compraOk),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  comprar: vi.fn(), comprarVitalicio: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null,
  sincronizarAssinatura: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

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
  loja.preco = "R$ 97,90"; loja.mes = "R$ 8,16"; loja.dias = 3; loja.trial = true; loja.compraOk = true;
  notif.estado = "prompt"; notif.pedir.mockClear(); notif.agendar.mockClear();
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

  it("(B) cronograma do teste: hoje / dia 2 aviso / dia 3 cobrança, com o preço do ano", async () => {
    montar();
    expect(await screen.findByText("Como funciona o teste")).toBeInTheDocument();
    expect(screen.getByText("Hoje · acesso a tudo")).toBeInTheDocument();
    expect(screen.getByText("Dia 2 · a gente te avisa")).toBeInTheDocument();
    expect(screen.getByText("Dia 3 · só se você continuar")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 97,90 pelo ano inteiro/)).toBeInTheDocument();
  });

  it("(C) botão, 'sem cobrança hoje' e selos coerentes com uma assinatura que renova", async () => {
    montar();
    expect(await screen.findByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
    expect(screen.getByText("Sem cobrança hoje")).toBeInTheDocument();
    expect(screen.getByText("Aviso antes de cobrar")).toBeInTheDocument();
    expect(screen.getByText("Cancele em 1 toque")).toBeInTheDocument();
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

  it("(D) depois da compra em teste, pergunta se quer o aviso, pede a permissão e arma o lembrete", async () => {
    const onPago = vi.fn();
    montar({ onPago });
    fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
    expect(await screen.findByText("Te aviso 1 dia antes de cobrar?")).toBeInTheDocument();
    expect(onPago).not.toHaveBeenCalled(); // espera a resposta antes de seguir pro cadastro
    fireEvent.click(screen.getByRole("button", { name: "Sim, me avisa" }));
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(notif.pedir).toHaveBeenCalledTimes(1);
    expect(notif.agendar).toHaveBeenCalledWith({ dias: 3, precoAno: "R$ 97,90" });
  });

  it("(D) permissão já dada: arma o lembrete sem perguntar nada", async () => {
    notif.estado = "granted";
    const onPago = vi.fn();
    montar({ onPago });
    fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Te aviso 1 dia antes de cobrar?")).not.toBeInTheDocument();
    expect(notif.pedir).not.toHaveBeenCalled();
    expect(notif.agendar).toHaveBeenCalledWith({ dias: 3, precoAno: "R$ 97,90" });
  });

  it("(D) 'Agora não' segue pro cadastro sem armar nada", async () => {
    const onPago = vi.fn();
    montar({ onPago });
    fireEvent.click(await screen.findByRole("button", { name: /Começar 3 dias grátis/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(notif.agendar).not.toHaveBeenCalled();
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

  it("mostra os DOIS preços — spec do dono", () => {
    montar();
    expect(screen.getByText("meses")).toBeInTheDocument(); // 18/09: anual com 3 dias grátis no lugar do vitalício
    expect(screen.getByText("mês")).toBeInTheDocument();
    // 20/09: o anual mostra o POR MÊS em destaque e o ano ao lado
    expect(screen.getAllByText(/R\$ 97,90\/ano/).length).toBeGreaterThan(0);
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
