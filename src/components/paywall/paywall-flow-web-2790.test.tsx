/**
 * WEB A 27,90 EM TUDO (20/09, ordem do dono "troca aí pra 27,90").
 * O paywall genérico da web (gate de quem entra logado sem assinatura, volta
 * do Google, /comecar, demo) vendia o vitalício a 97,90 enquanto o funil do
 * /inicio vendia 27,90 — duas vendas de 97,90 em 20/09 vieram daí, de gente
 * que nunca tinha visto o 27,90. Este teste trava: preço na tela 27,90 e a
 * oferta que abre o Pix é a `w27` (o servidor cobra 2790 nela).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallFlow } from "./PaywallFlow";

vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: ({ offer }: { offer: string }) => <div data-testid="pix-mock">oferta:{offer}</div>,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "x@y.z" }, loading: false, isSubscribed: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, data: {}, loaded: true }) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/notificacoes", () => ({ cancelarResgateDoPlano: vi.fn(), cancelarReguaDoTeste: vi.fn() }));
vi.mock("@/lib/teste-gratis", () => ({ limparGuiaSemente: vi.fn(), estadoTeste: () => ({ fase: "nunca" }) }));
vi.mock("@/lib/revenuecat", () => ({
  restaurar: vi.fn().mockResolvedValue(false), initRevenueCat: vi.fn(), estadoRevenueCat: () => "pronto",
  comprarVitalicio: vi.fn(), prefetchVitalicio: vi.fn(), motivoUltimaCompra: () => null,
}));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null }));
vi.mock("@/components/onboarding/BoasVindasPago", () => ({ BoasVindasPago: () => null }));
vi.mock("@/components/account/DeleteAccountDialog", () => ({ DeleteAccountDialog: () => null }));

afterEach(cleanup);

describe("Paywall genérico da web (gate) a 27,90", () => {
  it("mostra R$ 27,90, nunca 97,90, e o botão abre a oferta w27", () => {
    render(<MemoryRouter><PaywallFlow context="app" answers={{ gasto: "R$ 100 a R$ 300" }} /></MemoryRouter>);
    expect(document.body.textContent).toMatch(/R\$ 27,90/);
    expect(document.body.textContent).not.toMatch(/97,90/);
    const cta = screen.getAllByRole("button", { name: /Quero pra sempre — R\$ 27,90 no Pix/ })[0];
    fireEvent.click(cta);
    expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w27");
  });
});
