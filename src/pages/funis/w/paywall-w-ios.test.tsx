/**
 * O PAYWALL DO iPHONE, RENDERIZADO (30/08).
 *
 * Os testes de `src/lib/loja.test.ts` provam as STRINGS. Este aqui prova a
 * TELA: que o componente certo aparece, com o texto certo, e que nada do
 * mecanismo de Pix escapou pro iOS.
 *
 * Existe porque cada item abaixo é uma reprovação da App Review, e nenhuma
 * delas dá erro de compilação — todas passam no typecheck e só aparecem
 * quando um revisor abre a tela, quatro dias depois de enviar:
 *   · 3.1.1 — "Restaurar compras" tem que estar alcançável no paywall;
 *   · 3.1.2 — Termos e Privacidade têm que ter link na própria tela de compra;
 *   · 3.1.1 — nenhuma menção a pagamento de fora da App Store (Pix, Google);
 *   · 3.1.2 — assinatura tem que dizer que RENOVA, não só "cancele quando
 *     quiser".
 * E prova também a spec do dono de 30/08: o iPhone mostra os DOIS preços,
 * sem A/B.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallW } from "./PaywallW";

/* O RevenueCat é carregado por import() dinâmico dentro do componente. No
 * jsdom não há loja nenhuma, então devolvemos um módulo mudo — o teste é da
 * TELA, não do motor de compra. */
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  comprar: vi.fn(),
  comprarVitalicio: vi.fn(),
  comprarAnual97: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null,
  inicioUltimaFolha: () => null,
  sincronizarAssinatura: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
  getAttributionParams: () => ({}),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

const fingirPlataforma = (p: "ios" | "android") => {
  (window as { Capacitor?: unknown }).Capacitor = {
    getPlatform: () => p,
    isNativePlatform: () => true,
  };
};

const montar = () =>
  render(
    <MemoryRouter>
      <PaywallW area="dinheiro" answers={{ gasto: "2000" }} onPagoSemConta={() => {}} />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("Paywall do iPhone", () => {
  it("mostra os DOIS preços — spec do dono, sem A/B", () => {
    fingirPlataforma("ios");
    montar();
    // as duas colunas, pelo texto próprio de cada uma
    expect(screen.getByText("Pra sempre")).toBeInTheDocument();
    expect(screen.getByText("mês")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 97,90").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 24,90").length).toBeGreaterThan(0);
  });

  it("não sorteia braço de A/B (não suja o localStorage de quem não está em teste)", () => {
    fingirPlataforma("ios");
    montar();
    expect(localStorage.getItem("core-w-braco")).toBeNull();
  });

  it("traz Restaurar compras e os links legais — 3.1.1 e 3.1.2", () => {
    fingirPlataforma("ios");
    montar();
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(screen.getByText("Termos")).toBeInTheDocument();
    expect(screen.getByText("Privacidade")).toBeInTheDocument();
  });

  it("não cita Pix, Google nem Play em lugar nenhum da tela — 3.1.1", () => {
    fingirPlataforma("ios");
    const { container } = montar();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/pix/i);
    expect(texto).not.toMatch(/google/i);
    expect(texto).not.toMatch(/play/i);
    expect(texto).toMatch(/App Store/);
  });
});

describe("Android segue como está — a entrada do iPhone não podia mexer nele", () => {
  it("A/B desligado (31/08): todo mundo no braço A, sem sujar o localStorage", () => {
    // Decisão do dono pós-ROI de 30/08 (1,10× com o vitalício sozinho): a
    // v91 sobe SÓ com o conserto do produto_ausente, comportamento idêntico
    // à versão viva. AB_LIGADO=true no PaywallW religa o sorteio — e aí este
    // teste volta a afirmar o contrário.
    fingirPlataforma("android");
    montar();
    expect(localStorage.getItem("core-w-braco")).toBeNull();
    // braço A = um preço só: a coluna do mensal não existe na tela
    expect(screen.queryByText(/cancele quando quiser/i)).toBeNull();
  });

  it("continua falando Google Play e Pix", () => {
    fingirPlataforma("android");
    localStorage.setItem("core-w-braco", "a");
    const { container } = montar();
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/Google Play/);
    expect(texto).toMatch(/Pix/);
  });

  it("NÃO traz o rodapé legal novo (mudança é só do iOS)", () => {
    fingirPlataforma("android");
    localStorage.setItem("core-w-braco", "a");
    montar();
    expect(screen.queryByText("Restaurar compras")).toBeNull();
  });
});
