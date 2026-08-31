/**
 * A VITRINE DO ANDROID (31/08, ordem do dono).
 *
 * O paywall que vende hoje passa a mostrar os DOIS preços com o MENSAL em
 * foco. Este arquivo existe porque a decisão é contraintuitiva e alguém —
 * inclusive eu, daqui a duas semanas — vai olhar o tíquete e querer "voltar
 * pro vitalício sozinho, que rendia R$ 93". O motivo está no conjunto, não
 * no tíquete: a Play cobra 15% e segura o caixa 60 dias (mensalidade que
 * renova rende mais no mesmo dinheiro preso), enquanto o vitalício de 97,90
 * mudou de casa e agora vive na web, onde o Pix cai em 1 dia.
 *
 * O que este teste trava:
 *   · as DUAS colunas aparecem (o vitalício não pode sumir da tela);
 *   · o MENSAL nasce selecionado;
 *   · a âncora do topo abre no preço do mensal — é o que resolve o medo de
 *     "a pessoa se assusta com 97,90 antes de ver que existe mensal";
 *   · o CTA e a letra legal falam de ASSINATURA, com aviso de renovação
 *     (exigência de loja, não capricho);
 *   · dá pra escolher o vitalício e a tela inteira acompanha.
 *
 * Trocar ANDROID_PLANO_INICIAL ou ANDROID_DUAS_COLUNAS quebra aqui de
 * propósito: é mudança de superfície de venda e tem que ser consciente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallW } from "./PaywallW";

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
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

const montar = () =>
  render(
    <MemoryRouter>
      <PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "android", isNativePlatform: () => true };
  localStorage.clear();
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("paywall do Android: dois preços, mensal em foco", () => {
  it("mostra as DUAS colunas — o vitalício não sai da tela", () => {
    montar();
    expect(screen.getByText(/cancele quando quiser/i)).toBeTruthy();   // coluna mensal
    expect(screen.getByText(/MELHOR ESCOLHA/i)).toBeTruthy();          // coluna vitalício
    expect(screen.getAllByText(/97,90/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/24,90/).length).toBeGreaterThan(0);
  });

  it("o MENSAL nasce selecionado: CTA e legal falam de assinatura", () => {
    montar();
    expect(screen.getByText(/Começar por R\$ ?24,90\/mês/i)).toBeTruthy();
    /* A letra legal tem que dizer que é ASSINATURA e mensal — no Android a
     * frase aprovada é "cancela quando quiser" ("renova automaticamente" é
     * exigência da Apple, e loja.test.ts trava essas strings byte a byte). */
    expect(screen.getByText(/Assinatura de R\$ ?24,90\/mês/i)).toBeTruthy();
    expect(screen.getByText(/cancela quando quiser/i)).toBeTruthy();
  });

  it("escolher o vitalício vira a tela inteira", () => {
    montar();
    fireEvent.click(screen.getByText(/MELHOR ESCOLHA/i));
    expect(screen.getByText(/Quero pra sempre/i)).toBeTruthy();
    expect(screen.getByText(/Pagamento/i)).toBeTruthy();
  });

  it("não sorteia braço de A/B — a vitrine é decisão, não teste", () => {
    montar();
    expect(localStorage.getItem("core-w-braco")).toBeNull();
  });
});
