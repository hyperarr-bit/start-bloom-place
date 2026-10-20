/**
 * Cobrança recusada na loja (26/09): 11 testes do iPhone com o cartão recusado
 * no fim do teste. Só avisa quem ainda quer pagar (renovação ligada).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";

const estado = vi.hoisted(() => ({
  problema: { temProblema: true, comAcesso: false, url: "https://apps.apple.com/account/subscriptions" } as { temProblema: boolean; comAcesso: boolean; url: string | null; detectadoEm?: string | null },
  auth: {} as Record<string, unknown>,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  problemaDeCobranca: vi.fn(async () => estado.problema),
  // 07/10: o presente de 69,90 mora no gate; sem este mock ele importaria o plugin
  // REAL do RevenueCat no jsdom, e o @capacitor/core sobrescreve o window.Capacitor
  // de mentira (o app vira "web" no meio do teste e o aviso some).
  situacaoDoPresente: vi.fn(async () => null),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => estado.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({
  PaywallAssinatura: () => (
    <div data-testid="paywall-gate">
      <h2>Sua vida inteira organizada</h2>
      <button>Começar 3 dias grátis</button>
    </div>
  ),
}));
vi.mock("@/components/paywall/PaywallFlow", () => ({ PaywallFlow: () => <div data-testid="paywall-web" /> }));

import { lerProblemaDeCobranca } from "@/lib/revenuecat";
import { trackEvent } from "@/lib/analytics";
import { AvisoCobrancaRecusada } from "@/components/app/AvisoCobrancaRecusada";
import { TrialBanner } from "@/components/TrialBanner";
import {
  CARENCIA_DIAS, CHAVE_FORCA_COBRANCA_V14, URL_PAGAMENTO_APPLE, avisoFechadoNestaAbertura, diasRestantesDaCarencia,
  fecharAvisoNestaAbertura, registrarVisibilidadeDoAviso, textoDaCarencia, urlAtualizarPagamento, zerarAvisoDaAbertura,
  guiaNaTela, avisoVistoNestaAbertura, fecharTelaNestaAbertura, telaFechadaAgora,
} from "@/lib/cobranca-recusada";

const info = (ent: Record<string, unknown>, url: string | null = "https://apps.apple.com/account/subscriptions") => ({
  managementURL: url,
  entitlements: { all: { "CORE APP Pro": ent }, active: {} },
});

/* O FORMATO REAL (07/10): o SDK calcula willRenew = !(promo || vitalício ||
 * unsubscribeDetectedAt || billingIssueDetectedAt || prepago) — cartão recusado
 * chega SEMPRE com willRenew false. Até 07/10 o filtro exigia willRenew true e
 * o aviso nunca apareceu (aviso_cobranca_view = 0 com 68 pessoas em carência). */
const CARTAO_RECUSADO = { billingIssueDetectedAt: "2026-09-25T20:24:00Z", unsubscribeDetectedAt: null, willRenew: false, periodType: "NORMAL", store: "APP_STORE" };

describe("Cobrança recusada — leitura do RevenueCat", () => {
  it("cartão recusado (formato real: billingIssueDetectedAt + willRenew false): avisa, sem acesso", () => {
    expect(lerProblemaDeCobranca(info({ ...CARTAO_RECUSADO, isActive: false })))
      .toEqual({ temProblema: true, comAcesso: false, url: "https://apps.apple.com/account/subscriptions", detectadoEm: "2026-09-25T20:24:00Z" });
  });

  it("dentro da carência (acesso ativo, willRenew false do mesmo jeito): avisa pra não perder o acesso", () => {
    expect(lerProblemaDeCobranca(info({ ...CARTAO_RECUSADO, isActive: true, periodType: "TRIAL" })).comAcesso).toBe(true);
  });

  it("willRenew true com billingIssue (loja que não derrube o flag): avisa também", () => {
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: "2026-09-25T20:24:00Z", willRenew: true, isActive: false })).temProblema).toBe(true);
  });

  it("quem CANCELOU não recebe aviso de cartão — a régua é unsubscribeDetectedAt, não willRenew", () => {
    expect(lerProblemaDeCobranca(info({ ...CARTAO_RECUSADO, unsubscribeDetectedAt: "2026-09-25T21:00:00Z", isActive: false })).temProblema).toBe(false);
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: null, unsubscribeDetectedAt: "2026-09-25T21:00:00Z", willRenew: false, isActive: true })).temProblema).toBe(false);
  });

  it("sem problema de cobrança, ou sem dados: nada", () => {
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: null, willRenew: true, isActive: true })).temProblema).toBe(false);
    expect(lerProblemaDeCobranca(info({ billingIssueDetectedAt: null, willRenew: false, isActive: true, periodType: "TRIAL" })).temProblema).toBe(false);
    expect(lerProblemaDeCobranca(null).temProblema).toBe(false);
    expect(lerProblemaDeCobranca({}).temProblema).toBe(false);
  });
});

/* 28/09: sem acesso, o bloqueio do TrialBanner (fixed inset-0 z-[310]) cobria
 * a faixa — a pessoa via "compre de novo" em vez de "atualize o pagamento". */
describe("Cobrança recusada — o aviso por cima do bloqueio", () => {
  const Ir = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/planos")}>ir pra planos</button>;
  };
  /** O que o App.tsx monta: a faixa no alto do app + o TrialBanner depois das rotas. */
  const montarApp = () =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <div data-testid="topo-do-app"><AvisoCobrancaRecusada /></div>
        <main>Home</main>
        <Ir />
        <TrialBanner />
      </MemoryRouter>
    );
  const views = () => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "aviso_cobranca_view");
  const gate = () => document.querySelector(".fixed.inset-0") as HTMLElement | null;
  const usuario = { id: "u1", email: "maria@exemplo.com" };

  beforeEach(() => {
    localStorage.clear();
    zerarAvisoDaAbertura(); fecharTelaNestaAbertura(); /* 1.0.17: a faixa é a reserva depois da tela cheia */ // 1.0.17: o view sai 1x por abertura (memória do processo)
    vi.mocked(trackEvent).mockClear();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  });
  afterEach(() => {
    cleanup();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("sem acesso: o aviso aparece NO ALTO do bloqueio, antes do paywall, abaixo da área segura — um evento só", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: "https://apps.apple.com/account/subscriptions" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    const aviso = (await screen.findByText("Seu pagamento não passou")).closest('[role="alert"]') as HTMLElement;
    expect(screen.getAllByText("Seu pagamento não passou")).toHaveLength(1);
    // dentro do overlay do gate, e não mais na faixa escondida atrás dele
    expect(gate()).not.toBeNull();
    expect(gate()!.contains(aviso)).toBe(true);
    expect(screen.getByTestId("topo-do-app")).toBeEmptyDOMElement();
    // no alto: vem antes do paywall do gate, em fluxo normal (empurra, não cobre)
    const paywall = screen.getByTestId("paywall-gate");
    expect(aviso.compareDocumentPosition(paywall) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aviso.className).not.toMatch(/\b(fixed|absolute|sticky)\b/);
    expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
    // área segura do topo (o mesmo recuo que o resto do app usa)
    expect(aviso.parentElement).toHaveClass("pt-[var(--app-safe-top)]");
    // o texto certo pra quem perdeu o acesso, com o caminho pra loja
    expect(aviso.textContent).toMatch(/Atualize a forma de pagamento na App Store pra voltar a usar o CORE\./);
    // 10/10: no iPhone o botão leva pra FORMA DE PAGAMENTO da Apple (a tela de assinaturas não tem cartão)
    expect(screen.getByRole("link", { name: "Atualizar pagamento" })).toHaveAttribute("href", URL_PAGAMENTO_APPLE);
    // o evento sai num efeito depois do aviso montar — com a máquina cheia ele chega um tique depois (05/10: barrou o push)
    await waitFor(() => expect(views()).toEqual([["aviso_cobranca_view", { com_acesso: false, dias_restantes: null, formato: "faixa" }]]));
  });

  it("sem acesso, fora do bloqueio (ex.: /planos): volta pra faixa de cima — sem contar outra exibição", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    await screen.findByText("Seu pagamento não passou");
    expect(gate()).not.toBeNull();
    fireEvent.click(screen.getByText("ir pra planos"));
    expect(gate()).toBeNull();
    const aviso = screen.getByText("Seu pagamento não passou").closest('[role="alert"]') as HTMLElement;
    expect(screen.getByTestId("topo-do-app").contains(aviso)).toBe(true);
    expect(views()).toHaveLength(1);
  });

  it("com acesso (carência ligada): continua como hoje — faixa no alto do app, sem bloqueio", async () => {
    estado.problema = { temProblema: true, comAcesso: true, url: "https://apps.apple.com/account/subscriptions" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    montarApp();
    const aviso = (await screen.findByText("Seu pagamento não passou")).closest('[role="alert"]') as HTMLElement;
    expect(gate()).toBeNull();
    expect(screen.getByTestId("topo-do-app").firstElementChild).toBe(aviso);
    expect(aviso.textContent).toMatch(/pra não perder o acesso\./);
    expect(views()).toEqual([["aviso_cobranca_view", { com_acesso: true, dias_restantes: null, formato: "faixa" }]]);
    // chave desligada: sem contador
    expect(screen.queryByTestId("carencia-dias")).toBeNull();
  });

  it("'Agora não' dentro do bloqueio esconde o aviso e o bloqueio segue igual", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    await screen.findByText("Seu pagamento não passou");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Agora não" })); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(screen.getByTestId("paywall-gate")).toBeInTheDocument();
  });

  it("fora do app nativo (web): nada, nem no bloqueio", async () => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montarApp();
    // 01/10: na web o bloqueio virou "Assine no app" (venda só nas lojas); o
    // aviso de cobrança continua sendo coisa do app, então aqui não aparece.
    expect(await screen.findByTestId("assine-no-app")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(views()).toHaveLength(0);
  });
});

/* 10/10 (1.0.14): a conta da carência (pura) e o que muda com a chave COBRANCA_V14. */
describe("Cobrança recusada — carência de 28 dias e o botão (1.0.14)", () => {
  it("dias restantes: 28 a partir da detecção, arredondando pra cima, nunca negativo, null sem data", () => {
    const detectado = "2026-10-01T12:00:00Z";
    const t = (s: string) => new Date(s).getTime();
    expect(CARENCIA_DIAS).toBe(28);
    expect(diasRestantesDaCarencia(detectado, t("2026-10-01T12:00:00Z"))).toBe(28);
    expect(diasRestantesDaCarencia(detectado, t("2026-10-10T12:00:00Z"))).toBe(19);
    expect(diasRestantesDaCarencia(detectado, t("2026-10-28T09:00:00Z"))).toBe(2); // faltando 27 h: 2 dias
    expect(diasRestantesDaCarencia(detectado, t("2026-10-29T09:00:00Z"))).toBe(1); // faltando 3 h ainda é 1 dia
    expect(diasRestantesDaCarencia(detectado, t("2026-11-05T12:00:00Z"))).toBe(0);
    expect(diasRestantesDaCarencia(null)).toBeNull();
    expect(diasRestantesDaCarencia("lixo")).toBeNull();
  });
  it("texto do contador: singular, plural, e nada quando venceu ou sem data", () => {
    expect(textoDaCarencia(1)).toBe("Você tem 1 dia pra atualizar.");
    expect(textoDaCarencia(12)).toBe("Você tem 12 dias pra atualizar.");
    expect(textoDaCarencia(0)).toBeNull();
    expect(textoDaCarencia(null)).toBeNull();
  });
  it("o botão: iPhone → forma de pagamento da Apple; Android → a Play (managementURL ou a tela de assinaturas)", () => {
    expect(urlAtualizarPagamento({ url: "https://apps.apple.com/account/subscriptions" }, "ios")).toBe("https://apps.apple.com/account/billing");
    expect(urlAtualizarPagamento({ url: null }, "ios")).toBe("https://apps.apple.com/account/billing");
    expect(urlAtualizarPagamento({ url: "https://play.google.com/store/account/subscriptions?sku=x" }, "android")).toBe("https://play.google.com/store/account/subscriptions?sku=x");
    expect(urlAtualizarPagamento({ url: null }, "android")).toMatch(/^https:\/\/play\.google\.com\/store\/account\/subscriptions\?package=br\.com\.coreaplicativo\.app$/);
  });
});

describe("Cobrança recusada — com a chave COBRANCA_V14 ligada (QA: ?cobranca-v14=on)", () => {
  const montar = () =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <div data-testid="topo-do-app"><AvisoCobrancaRecusada /></div>
        <TrialBanner />
      </MemoryRouter>
    );
  const usuario = { id: "u1", email: "maria@exemplo.com" };
  const views = () => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "aviso_cobranca_view");

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    zerarAvisoDaAbertura(); fecharTelaNestaAbertura(); /* 1.0.17: a faixa é a reserva depois da tela cheia */
    vi.mocked(trackEvent).mockClear();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    zerarAvisoDaAbertura();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("com acesso: mostra o contador da carência e o view leva dias_restantes", async () => {
    estado.problema = { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-01T12:00:00Z" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    montar();
    await screen.findByText("Seu pagamento não passou");
    expect(screen.getByTestId("carencia-dias").textContent).toBe("Você tem 19 dias pra atualizar.");
    await waitFor(() => expect(views()).toEqual([["aviso_cobranca_view", { com_acesso: true, dias_restantes: 19, formato: "faixa" }]]));
  });

  it("no bloqueio (sem acesso): o contador aparece lá também; carência vencida não mostra contador", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null, detectadoEm: "2026-10-08T12:00:00Z" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    montar();
    const aviso = (await screen.findByText("Seu pagamento não passou")).closest('[role="alert"]') as HTMLElement;
    expect(document.querySelector(".fixed.inset-0")!.contains(aviso)).toBe(true);
    expect(screen.getByTestId("carencia-dias").textContent).toBe("Você tem 26 dias pra atualizar.");
    cleanup();
    zerarAvisoDaAbertura(); fecharTelaNestaAbertura(); /* 1.0.17: a faixa é a reserva depois da tela cheia */
    estado.problema = { temProblema: true, comAcesso: false, url: null, detectadoEm: "2026-08-01T12:00:00Z" };
    montar();
    await screen.findByText("Seu pagamento não passou");
    expect(screen.queryByTestId("carencia-dias")).toBeNull();
  });

  it("'Agora não' esconde só até a próxima abertura: nada em disco, remontar na mesma abertura segue escondido, abertura nova volta", async () => {
    estado.problema = { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-01T12:00:00Z" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    montar();
    await screen.findByText("Seu pagamento não passou");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Agora não" })); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(localStorage.getItem("core-aviso-cobranca-fechado-ate")).toBeNull(); // o modo antigo (24 h) não é gravado
    expect(vi.mocked(trackEvent).mock.calls.find((c) => c[0] === "aviso_cobranca_fechar")?.[1]).toEqual({ dias_restantes: 19, formato: "faixa" });
    cleanup();
    montar(); // mesma abertura do app (ex.: trocou de tela e voltou)
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    cleanup();
    zerarAvisoDaAbertura(); // o app foi fechado e aberto de novo
    montar();
    // 1.0.17: abertura nova = a tela cheia de novo (a faixa é só a reserva de quem fechou a tela nesta abertura)
    expect(await screen.findByTestId("cobranca-tela-cheia")).toBeInTheDocument();
  });

  it("voltar do fundo depois de 30 min conta como abertura nova; antes disso, não", () => {
    estado.problema = { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-01T12:00:00Z" };
    const t0 = Date.now();
    zerarAvisoDaAbertura();
    // fecha, vai pro fundo 10 min, volta: segue escondido
    registrarVisibilidadeDoAviso(true, t0);
    fecharAvisoNestaAbertura();
    registrarVisibilidadeDoAviso(false, t0 + 60e3);
    registrarVisibilidadeDoAviso(true, t0 + 11 * 60e3);
    expect(avisoFechadoNestaAbertura()).toBe(true);
    // fundo por 31 min: abertura nova
    registrarVisibilidadeDoAviso(false, t0 + 12 * 60e3);
    registrarVisibilidadeDoAviso(true, t0 + 44 * 60e3);
    expect(avisoFechadoNestaAbertura()).toBe(false);
  });
});

/* 1.0.17 — o aviso nunca por cima de uma guia (missão, Montar Finanças, festa, tour, folha modal), sem "24 h",
   e no máximo 1 view por abertura do app. */
describe("Cobrança recusada — 1.0.17: calmo, sem disputar com a missão", () => {
  const usuario = { id: "u1", email: "maria@exemplo.com" };
  const views = () => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "aviso_cobranca_view");
  beforeEach(() => {
    localStorage.clear();
    zerarAvisoDaAbertura(); fecharTelaNestaAbertura(); /* 1.0.17: a faixa é a reserva depois da tela cheia */
    vi.mocked(trackEvent).mockClear();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  });
  afterEach(() => {
    cleanup();
    document.body.querySelectorAll("[data-guia-de-teste]").forEach((e) => e.remove());
    zerarAvisoDaAbertura();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });
  const guia = (attrs: Record<string, string>) => {
    const d = document.createElement("div");
    d.setAttribute("data-guia-de-teste", "");
    for (const [k, v] of Object.entries(attrs)) d.setAttribute(k, v);
    document.body.appendChild(d);
    return d;
  };

  it("guiaNaTela reconhece as camadas da missão, o Montar, a festa e folhas modais — e ignora o resto", () => {
    expect(guiaNaTela()).toBe(false);
    for (const attrs of [
      { "data-camada-guia": "missao-doses-boas-vindas" }, { "data-testid": "montar-financas" }, { "data-momento": "festa" },
      { role: "dialog", "aria-modal": "true" }, { role: "alertdialog" },
    ]) {
      const d = guia(attrs);
      expect(guiaNaTela()).toBe(true);
      d.remove();
    }
    guia({ role: "dialog" }); // popover sem aria-modal não segura
    expect(guiaNaTela()).toBe(false);
  });

  it("com acesso e a boas-vindas da missão na tela: o aviso espera; a guia sai → aparece, com 1 view só", async () => {
    estado.problema = { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-18T12:00:00Z" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    const g = guia({ "data-camada-guia": "missao-doses-boas-vindas" });
    render(<AvisoCobrancaRecusada />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(views()).toHaveLength(0);
    g.remove();
    expect(await screen.findByText("Seu pagamento não passou", {}, { timeout: 2000 })).toBeInTheDocument();
    await waitFor(() => expect(views()).toHaveLength(1));
    // a guia volta (ex.: a festa da dose) e sai de novo: some e volta SEM contar outra exibição
    const g2 = guia({ "data-momento": "festa" });
    await waitFor(() => expect(screen.queryByText("Seu pagamento não passou")).toBeNull(), { timeout: 2000 });
    g2.remove();
    expect(await screen.findByText("Seu pagamento não passou", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(views()).toHaveLength(1);
    expect(avisoVistoNestaAbertura()).toBe(true);
  });

  it("nunca fala de '24 h' nem de antecedência da cobrança; o botão leva pra forma de pagamento da Apple", async () => {
    estado.problema = { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-18T12:00:00Z" };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    render(<AvisoCobrancaRecusada />);
    const aviso = (await screen.findByText("Seu pagamento não passou")).closest('[role="alert"]') as HTMLElement;
    expect(aviso.textContent).not.toMatch(/24\s*h|horas antes|antes do fim/i);
    expect(screen.getByRole("link", { name: "Atualizar pagamento" })).toHaveAttribute("href", URL_PAGAMENTO_APPLE);
    fireEvent.click(screen.getByRole("link", { name: "Atualizar pagamento" }));
    expect(vi.mocked(trackEvent).mock.calls.some((c) => c[0] === "aviso_cobranca_click")).toBe(true);
  });

  it("sem acesso (no bloqueio) não espera guia nenhuma — o bloqueio é a tela inteira", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: false, noTrial: true, trialExpired: false };
    guia({ role: "dialog", "aria-modal": "true" });
    render(<AvisoCobrancaRecusada />);
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
  });
});

/* 1.0.17 (dono, 20/10) — A TELA CHEIA: a cada abertura, com a tela livre; "Agora não" até a próxima abertura (e aí a
   faixa de reserva); contador da carência; destino do botão por loja; nada sem cartão recusado. */
describe("Cobrança recusada — 1.0.17: tela cheia a cada abertura", () => {
  const usuario = { id: "u1", email: "maria@exemplo.com" };
  const ev = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
  const plataforma = (p: "ios" | "android") => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; };
  beforeEach(() => {
    localStorage.clear();
    zerarAvisoDaAbertura();
    vi.mocked(trackEvent).mockClear();
    plataforma("ios");
    estado.auth = { user: usuario, subLoaded: true, isSubscribed: true, noTrial: false, trialExpired: false };
    estado.problema = { temProblema: true, comAcesso: true, url: "https://play.google.com/store/account/subscriptions?package=br.com.coreaplicativo.app", detectadoEm: new Date(Date.now() - 2 * 86400e3).toISOString() };
  });
  afterEach(() => {
    cleanup();
    document.body.querySelectorAll("[data-guia-de-teste]").forEach((e) => e.remove());
    zerarAvisoDaAbertura();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("abre o app com o cartão recusado → tela cheia: título, uma frase, o botão e 'Agora não'; view com formato tela_cheia", async () => {
    render(<AvisoCobrancaRecusada />);
    const tela = await screen.findByTestId("cobranca-tela-cheia");
    expect(tela.getAttribute("role")).toBe("alertdialog");
    expect(tela.textContent).toMatch(/Seu pagamento não passou/);
    expect(tela.textContent).toMatch(/A Apple não conseguiu cobrar seu plano\. Atualize a forma de pagamento pra continuar com o CORE\./);
    expect(tela.textContent).not.toMatch(/24\s*h|horas antes|antes do fim/i);
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull(); // a faixa não aparece junto
    await waitFor(() => expect(ev("aviso_cobranca_view")).toEqual([{ com_acesso: true, dias_restantes: expect.any(Number), formato: "tela_cheia" }]));
  });

  it("contador da carência (COBRANCA_V14 ligada) — e sem a chave, sem contador", async () => {
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "on");
    estado.problema = { ...estado.problema, detectadoEm: new Date(Date.now() - 2 * 86400e3 - 3600e3).toISOString() };
    render(<AvisoCobrancaRecusada />);
    await screen.findByTestId("cobranca-tela-cheia");
    expect(screen.getByTestId("carencia-dias").textContent).toBe("Você tem 26 dias pra atualizar.");
    cleanup();
    zerarAvisoDaAbertura();
    localStorage.setItem(CHAVE_FORCA_COBRANCA_V14, "off");
    render(<AvisoCobrancaRecusada />);
    await screen.findByTestId("cobranca-tela-cheia");
    expect(screen.queryByTestId("carencia-dias")).toBeNull();
  });

  it("botão: iPhone → forma de pagamento da Apple; Android → managementURL da Play; o clique leva formato", async () => {
    render(<AvisoCobrancaRecusada />);
    await screen.findByTestId("cobranca-tela-cheia");
    const link = screen.getByRole("link", { name: "Atualizar pagamento" });
    expect(link).toHaveAttribute("href", URL_PAGAMENTO_APPLE);
    fireEvent.click(link);
    expect(ev("aviso_cobranca_click")[0]).toMatchObject({ formato: "tela_cheia" });
    cleanup();
    zerarAvisoDaAbertura();
    plataforma("android");
    render(<AvisoCobrancaRecusada />);
    await screen.findByTestId("cobranca-tela-cheia");
    expect(screen.getByRole("link", { name: "Atualizar pagamento" })).toHaveAttribute("href", estado.problema.url);
    expect(screen.getByTestId("cobranca-tela-cheia").textContent).toMatch(/O Google não conseguiu cobrar seu plano/);
  });

  it("espera a tela ficar livre (missão / Montar / folha) e só então aparece", async () => {
    const g = guia({ "data-camada-guia": "missao-doses-boas-vindas" });
    render(<AvisoCobrancaRecusada />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByTestId("cobranca-tela-cheia")).toBeNull();
    expect(ev("aviso_cobranca_view")).toHaveLength(0);
    g.remove();
    expect(await screen.findByTestId("cobranca-tela-cheia", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("'Agora não' esconde até a próxima abertura; nesta abertura sobra só a faixa de reserva; abertura nova → tela de novo", async () => {
    render(<AvisoCobrancaRecusada />);
    await screen.findByTestId("cobranca-tela-cheia");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Agora não" })); });
    expect(screen.queryByTestId("cobranca-tela-cheia")).toBeNull();
    expect(telaFechadaAgora()).toBe(true);
    expect(ev("aviso_cobranca_fechar")[0]).toMatchObject({ formato: "tela_cheia" });
    const faixa = screen.getByRole("alert");
    expect(faixa.textContent).toMatch(/Seu pagamento não passou/);
    expect(localStorage.length).toBe(0); // nada em disco
    cleanup();
    render(<AvisoCobrancaRecusada />); // mesma abertura (trocou de tela)
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("cobranca-tela-cheia")).toBeNull();
    cleanup();
    zerarAvisoDaAbertura(); // fechou e abriu o app
    render(<AvisoCobrancaRecusada />);
    expect(await screen.findByTestId("cobranca-tela-cheia")).toBeInTheDocument();
  });

  it("voltar do fundo depois de 30 min conta como abertura nova (a tela volta); antes disso, não", () => {
    const t0 = Date.now();
    fecharTelaNestaAbertura();
    registrarVisibilidadeDoAviso(false, t0);
    registrarVisibilidadeDoAviso(true, t0 + 10 * 60e3);
    expect(telaFechadaAgora()).toBe(true);
    registrarVisibilidadeDoAviso(false, t0 + 11 * 60e3);
    registrarVisibilidadeDoAviso(true, t0 + 45 * 60e3);
    expect(telaFechadaAgora()).toBe(false);
  });

  it("sem cartão recusado: nada (nem tela nem faixa)", async () => {
    estado.problema = { temProblema: false, comAcesso: true, url: null };
    render(<AvisoCobrancaRecusada />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByTestId("cobranca-tela-cheia")).toBeNull();
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
  });

  it("sem acesso, por cima do bloqueio: a tela cheia aparece sem esperar guia", async () => {
    estado.problema = { temProblema: true, comAcesso: false, url: null };
    guia({ role: "dialog", "aria-modal": "true" });
    render(<AvisoCobrancaRecusada />);
    expect(await screen.findByTestId("cobranca-tela-cheia")).toBeInTheDocument();
    expect(screen.getByTestId("cobranca-tela-cheia").className).toMatch(/z-\[320\]/);
  });

  const guia = (attrs: Record<string, string>) => {
    const d = document.createElement("div");
    d.setAttribute("data-guia-de-teste", "");
    for (const [k, v] of Object.entries(attrs)) d.setAttribute(k, v);
    document.body.appendChild(d);
    return d;
  };
});
