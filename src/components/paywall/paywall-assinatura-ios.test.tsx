/**
 * O GATE do iPhone (20/09): quem entra logado sem assinatura (ou toca em
 * "Ver planos" no Meu acesso) via um paywall VITALÍCIO inteiro — "Quero pra
 * sempre", "pagamento único pela App Store", coluna "Pra sempre", comprando
 * um produto com id do Google. No iPhone a coluna longa é o anual com teste.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallAssinatura } from "./PaywallAssinatura";

vi.mock("@/lib/loja", async (orig) => ({
  ...(await orig<typeof import("@/lib/loja")>()),
  ehApple: () => true,
  pelaLoja: () => "pela App Store",
  sufixoPagamento: () => "",
  temEscadaPix: () => false,
}));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  prefetchAssinaturas: vi.fn().mockResolvedValue(undefined),
  prefetchAnualIos: vi.fn().mockResolvedValue(undefined),
  temVitalicio97: () => true, // a loja AINDA tem o vitalício (existe na App Store) — e mesmo assim o iPhone não pode vendê-lo aqui
  temAnual97: () => false,
  temMensalVista: () => false,
  temAnualIos: () => true,
  precoAnualIos: () => "R$ 97,90",
  precoMensalDoAnualIos: () => "R$ 8,16",
  diasTrialIos: () => 3,
  anualIosTemTrial: () => true,
  ultimaCompraAnualFoiTrial: () => true,
  estadoRevenueCat: () => "pronto",
  comprarAnualIos: vi.fn(), comprar: vi.fn(), comprarVitalicio: vi.fn(), comprarAnual97: vi.fn(), comprarMensalVista: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null,
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ data: {}, loaded: true }) }));
vi.mock("@/lib/teste-gratis", () => ({ estadoTeste: () => ({ fase: "nunca" }), limparGuiaSemente: vi.fn() }));
vi.mock("@/lib/notificacoes", () => ({
  agendarResgateDoPlano: vi.fn(), cancelarResgateDoPlano: vi.fn(), cancelarReguaDoTeste: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));

afterEach(cleanup);

const montar = (contexto: "gate" | "planos") =>
  render(<MemoryRouter><PaywallAssinatura contexto={contexto} /></MemoryRouter>);

describe("PaywallAssinatura no iPhone", () => {
  for (const contexto of ["gate", "planos"] as const) {
    it(`${contexto}: vende anual com 3 dias grátis e mensal, sem nada de vitalício`, async () => {
      montar(contexto);
      expect(await screen.findByText("3 DIAS GRÁTIS")).toBeInTheDocument();
      expect(screen.getByText("12 meses")).toBeInTheDocument();
      expect(screen.getByText("R$ 8,16")).toBeInTheDocument();
      expect(screen.getByText("por mês · R$ 97,90/ano")).toBeInTheDocument();
      expect(screen.getByText("R$ 24,90")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
      expect(document.body.textContent).toMatch(/3 dias grátis, depois R\$ 97,90\/ano pela App Store · renova automaticamente/);
      expect(document.body.textContent).not.toMatch(/pra sempre|vitalíc|pagamento único|uma única vez|sem renovação|Google|Pix/i);
    });
  }
});
