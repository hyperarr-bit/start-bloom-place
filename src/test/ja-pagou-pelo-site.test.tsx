/**
 * "JÁ PAGOU PELO SITE? ENTRE COM SEU E-MAIL" (P6, 30/09).
 *
 * 1.092 toques em "Restaurar compras" em 305 sessões, 9 viraram acesso: quem
 * pagou pelo SITE procura a compra na loja. Logo abaixo de cada "Restaurar
 * compras" do app das lojas, pra quem ainda não entrou, a linha que leva pro
 * login com e-mail (o mesmo lugar do "Já tenho conta? Entrar" da welcome).
 * Na web nada muda; no iPhone o texto não cita o site (regra 3.1.1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

// o build define __APP_VERSION__ (vite define); no vitest não existe (a /planos mostra)
(globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "teste";

const estado = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  veioDoSite: false,
  teste: { fase: "nunca" } as Record<string, unknown>,
}));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  getAttributionParams: () => ({}),
  instalouVindoDoSite: () => estado.veioDoSite,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: estado.user, loading: false, isSubscribed: false, subLoaded: true,
    billingPeriod: null, subscriptionEnd: null, paymentMethod: null, inGracePeriod: false,
  }),
}));
vi.mock("@/lib/att-ios", () => ({ pedirRastreamentoIos: vi.fn(async () => "nao_ios") }));
vi.mock("@/lib/notificacoes", () => ({
  estadoPermissao: async () => "prompt",
  pedirPermissao: vi.fn(async () => true),
  agendarLembreteDoTeste: vi.fn(async () => true),
  agendarResgateDoPlano: vi.fn(), cancelarResgateDoPlano: vi.fn(), cancelarReguaDoTeste: vi.fn(),
}));
vi.mock("@/lib/teste-gratis", async (orig) => ({
  ...(await orig<typeof import("@/lib/teste-gratis")>()),
  estadoTeste: () => estado.teste,
  trialCartaoAtivo: () => false,
}));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  prefetchAnualIos: vi.fn().mockResolvedValue(undefined),
  temAnualIos: () => true,
  precoAnualIos: () => "R$ 97,90", idProdutoAnualIos: () => "core_anual_97", mesesDeMensalQuePagamOAno: () => 4, ofertaAnualIos: () => "anual_97", dadosDaOfertaIos: () => ({ oferta: "anual_97", produto: "core_anual_97", offering: "default", preco: "R$ 97,90", pacote: true }),
  precoMensalDoAnualIos: () => "R$ 8,16",
  diasTrialIos: () => 3,
  anualIosTemTrial: () => true,
  ultimaCompraAnualFoiTrial: () => true,
  comprarAnualIos: vi.fn(async () => false),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  comprar: vi.fn(), comprarVitalicio: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null,
  sincronizarAssinatura: vi.fn(),
  abrirResgateApple: vi.fn(),
}));
vi.mock("@/components/app/AppPurchaseSheet", () => ({ AppPurchaseSheet: () => null }));
vi.mock("@/components/paywall/EntradaDeCodigo", () => ({ EntradaDeCodigo: () => null }));

import { JaPagouPeloSite } from "@/components/app/JaPagouPeloSite";
import { AppWelcome } from "@/components/app/AppWelcome";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";
import PlanosApp from "@/pages/PlanosApp";

MotionGlobalConfig.skipAnimations = true;

// o texto pedido (Android) e o do iPhone, escritos por extenso de propósito: mudou a frase, o teste acusa
const LINHA_ANDROID = "Já pagou pelo site? Entre com seu e-mail";
const LINHA_IOS = "Já é cliente? Entre com seu e-mail";

/** O app das lojas: o runtime do Capacitor injeta o global (é o que o isNativeShell lê). */
const noApp = (plataforma: "ios" | "android") => {
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => plataforma };
};

/** Monta com as rotas do login: o toque tem que pousar em /entrar. */
const montar = (ui: React.ReactElement, inicio = "/app") =>
  render(
    <MemoryRouter initialEntries={[inicio]}>
      <Routes>
        <Route path="/entrar" element={<p data-testid="tela-entrar">tela de entrar</p>} />
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>,
  );

const linha = () => screen.queryByTestId("ja-pagou-site");
const eventos = (nome: string) => analytics.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
/** "Logo abaixo": o próximo elemento depois do botão "Restaurar compras". */
const logoAbaixoDoRestaurar = () => {
  const restaurar = screen.getByText("Restaurar compras").closest("button") as HTMLElement;
  return restaurar.nextElementSibling;
};

beforeEach(() => {
  estado.user = null;
  estado.veioDoSite = false;
  estado.teste = { fase: "nunca" };
  analytics.trackEvent.mockClear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("a linha", () => {
  it("na WEB não aparece (lá não existe 'Restaurar compras')", () => {
    montar(<JaPagouPeloSite origem="teste" />);
    expect(linha()).toBeNull();
  });

  it("no Android: 'Já pagou pelo site? Entre com seu e-mail' → /entrar, com evento próprio", async () => {
    noApp("android");
    montar(<JaPagouPeloSite origem="teste" />);
    expect(linha()?.textContent).toBe(LINHA_ANDROID);
    fireEvent.click(linha()!);
    await screen.findByTestId("tela-entrar");
    expect(eventos("ja_pagou_site_click")).toEqual([expect.objectContaining({ origem: "teste", loja: "android" })]);
  });

  it("no iPhone: não cita pagamento de fora da App Store (3.1.1) — 'Já é cliente?'", () => {
    noApp("ios");
    montar(<JaPagouPeloSite origem="teste" />);
    expect(linha()?.textContent).toBe(LINHA_IOS);
    expect(linha()?.textContent).not.toMatch(/site|pag|pix/i);
  });

  it("quem já está numa conta não vê", () => {
    noApp("android");
    montar(<JaPagouPeloSite origem="teste" logado />);
    expect(linha()).toBeNull();
  });

  it("quem monta com o próprio caminho de login (onEntrar) é chamado no lugar do /entrar", () => {
    noApp("android");
    const onEntrar = vi.fn();
    montar(<JaPagouPeloSite origem="teste" onEntrar={onEntrar} />);
    fireEvent.click(linha()!);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("tela-entrar")).toBeNull();
  });
});

describe("boas-vindas do app (AppWelcome)", () => {
  it("Android: logo abaixo do 'Restaurar compras'; o toque vai pro MESMO lugar do 'Já tenho conta? Entrar'", () => {
    noApp("android");
    const onEntrar = vi.fn();
    montar(<AppWelcome onComecar={() => {}} onEntrar={onEntrar} />);
    expect(logoAbaixoDoRestaurar()).toBe(linha());
    expect(linha()?.textContent).toBe(LINHA_ANDROID);
    fireEvent.click(linha()!);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(eventos("ja_pagou_site_click")).toEqual([expect.objectContaining({ origem: "welcome", loja: "android" })]);
    // o "Já tenho conta? Entrar" continua lá, com o evento dele
    fireEvent.click(screen.getByText(/Já tenho conta\?/).closest("button")!);
    expect(onEntrar).toHaveBeenCalledTimes(2);
    expect(eventos("app_welcome_login")).toHaveLength(1);
  });

  it("sem onEntrar (welcome do /comecar e do radar): o toque cai no /entrar", async () => {
    noApp("android");
    montar(<AppWelcome onComecar={() => {}} />);
    fireEvent.click(linha()!);
    await screen.findByTestId("tela-entrar");
  });

  it("iPhone: a linha sem citar o site", () => {
    noApp("ios");
    montar(<AppWelcome onComecar={() => {}} />);
    expect(logoAbaixoDoRestaurar()).toBe(linha());
    expect(linha()?.textContent).toBe(LINHA_IOS);
  });

  it("quem instalou vindo do card pós-compra do site já tem o aviso + 'Entrar na minha conta': sem repetição", () => {
    noApp("android");
    estado.veioDoSite = true;
    montar(<AppWelcome onComecar={() => {}} />);
    expect(screen.getByTestId("welcome-veio-do-site")).toBeInTheDocument();
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(linha()).toBeNull();
  });

  it("na web (sem Restaurar compras) a welcome não ganha nada", () => {
    montar(<AppWelcome onComecar={() => {}} />);
    expect(screen.queryByText("Restaurar compras")).toBeNull();
    expect(linha()).toBeNull();
  });
});

describe("paywall do iPhone (PaywallIOS) — só a linha, nada mais", () => {
  const paywall = () => <PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={() => {}} />;

  it("logo abaixo do 'Restaurar compras', sem citar Pix/Google/Play/site; o toque vai pro /entrar", async () => {
    noApp("ios");
    const { container } = montar(paywall());
    expect(await screen.findByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
    expect(logoAbaixoDoRestaurar()).toBe(linha());
    expect(linha()?.textContent).toBe(LINHA_IOS);
    // mesmo tamanho e cor da linha legal (Privacidade · Termos) — discreta
    expect(linha()?.className).toMatch(/text-\[11px\]/);
    expect(linha()?.className).toMatch(/text-muted-foreground/);
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/pix|google|play|pelo site/i);
    // a linha mora no rodapé legal (conteúdo que rola), não no bloco fixo de compra
    const blocoFixo = screen.getByRole("button", { name: /Começar 3 dias grátis/ }).closest(".fixed") as HTMLElement;
    expect(blocoFixo.contains(linha())).toBe(false);
    fireEvent.click(linha()!);
    await screen.findByTestId("tela-entrar");
    expect(eventos("ja_pagou_site_click")).toEqual([expect.objectContaining({ origem: "rodape_legal", loja: "ios" })]);
  });

  it("fora do app (sem Capacitor) o paywall fica como era", async () => {
    montar(paywall());
    await screen.findByRole("button", { name: /Começar 3 dias grátis/ });
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(linha()).toBeNull();
  });
});

describe("rodapé legal dos paywalls do app (AppLegalFooter) e 'Meu acesso'", () => {
  it("gate/planos de quem já está numa conta: não aparece (a troca de conta é o 'Entrar com outra conta' do gate)", () => {
    noApp("android");
    estado.user = { id: "u1", email: "maria@exemplo.com" };
    montar(<AppLegalFooter origem="paywall_gate" />);
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(linha()).toBeNull();
  });

  it("convidado (sem conta) no app: aparece logo abaixo do restaurar", () => {
    noApp("android");
    montar(<AppLegalFooter origem="paywall_gate" />);
    expect(logoAbaixoDoRestaurar()).toBe(linha());
    expect(linha()?.textContent).toBe(LINHA_ANDROID);
  });

  it("'Meu acesso' (/planos) no teste grátis sem conta: aparece e leva pro /entrar", async () => {
    noApp("android");
    estado.teste = { fase: "ativo", dia: 1, horasRestantes: 60, inicio: Date.now() };
    montar(<PlanosApp />, "/planos");
    expect(logoAbaixoDoRestaurar()).toBe(linha());
    fireEvent.click(linha()!);
    await waitFor(() => expect(screen.getByTestId("tela-entrar")).toBeInTheDocument());
    expect(eventos("ja_pagou_site_click")).toEqual([expect.objectContaining({ origem: "planos", loja: "android" })]);
  });

  it("'Meu acesso' logado: não aparece", () => {
    noApp("android");
    estado.user = { id: "u1", email: "maria@exemplo.com" };
    montar(<PlanosApp />, "/planos");
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(linha()).toBeNull();
  });
});
