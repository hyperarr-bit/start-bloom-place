/**
 * CANCELAR ASSINATURA DE LOJA PELO SITE (24/09).
 *
 * Caso real (3d79e6b4, teste do anual do iPhone): "cancelou" no /planos do
 * site — aceitou "pausa" (+30 dias só no nosso banco), depois confirmou —,
 * abriu chamado "estão me cobrando algo que não estou devendo", e o
 * RevenueCat seguia com a renovação LIGADA (will_renew): a Apple ia cobrar.
 * Assinatura de loja só se cancela na loja; o diálogo tem que dizer isso e
 * levar até lá, sem motivo/oferta/pausa.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) } },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(cleanup);

describe("diálogo de cancelar — assinatura feita no app", () => {
  it("App Store: passo a passo da Apple + botão pra tela de assinaturas, sem motivo nem oferta", async () => {
    const { CancelFlowDialog } = await import("@/components/retention/CancelFlowDialog");
    render(<CancelFlowDialog open onOpenChange={() => {}} loja="app_store" />);
    expect(screen.getByText("Cancelar pela App Store")).toBeInTheDocument();
    expect(screen.getByTestId("cancelar-na-loja").textContent).toMatch(/quem cobra e quem cancela é a Apple/);
    expect(screen.getByText(/Escolha CORE e toque em Cancelar assinatura/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Abrir assinaturas da App Store/ });
    expect(link).toHaveAttribute("href", "https://apps.apple.com/account/subscriptions");
    expect(screen.queryByText("Antes de você ir...")).not.toBeInTheDocument();
    expect(screen.queryByText(/Tá caro pra mim agora/)).not.toBeInTheDocument();
  });

  it("Google Play: leva pra assinatura do app na Play", async () => {
    const { CancelFlowDialog } = await import("@/components/retention/CancelFlowDialog");
    render(<CancelFlowDialog open onOpenChange={() => {}} loja="google_play" />);
    expect(screen.getByText("Cancelar pelo Google Play")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir assinaturas do Google Play/ }))
      .toHaveAttribute("href", "https://play.google.com/store/account/subscriptions?package=br.com.coreaplicativo.app");
  });

  it("assinatura da web continua com o fluxo de sempre (motivo → oferta)", async () => {
    const { CancelFlowDialog } = await import("@/components/retention/CancelFlowDialog");
    render(<CancelFlowDialog open onOpenChange={() => {}} />);
    expect(screen.getByText("Antes de você ir...")).toBeInTheDocument();
    expect(screen.queryByTestId("cancelar-na-loja")).not.toBeInTheDocument();
  });
});
