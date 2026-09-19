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
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallIOS } from "./PaywallIOS";

vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
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

const montar = () =>
  render(
    <MemoryRouter>
      <PaywallIOS area="dinheiro" answers={{ gasto: "2000" }} onPagoSemConta={() => {}} />
    </MemoryRouter>
  );

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Paywall do iPhone", () => {
  it("mostra os DOIS preços — spec do dono", () => {
    montar();
    expect(screen.getByText("Pra sempre")).toBeInTheDocument();
    expect(screen.getByText("mês")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 97,90").length).toBeGreaterThan(0);
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
    expect(screen.getByText("Pra sempre")).toBeInTheDocument();
    expect(screen.getByText("mês")).toBeInTheDocument();
  });
});
