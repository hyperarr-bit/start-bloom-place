/**
 * UPSELL "SEU 2027" no /inicio (21/10): o "Pagamento confirmado" do vitalício (w27) no PixCheckout do funil.
 *   · chave OFF (padrão): a confirmação de sempre, com as lojas — o 2027 nem carrega;
 *   · ON (`?up2027=on`): a oferta cobre a confirmação; "Agora não" → a confirmação com as lojas; "Quero" → Pix u2027 →
 *     pronto → "Continuar" → a confirmação com as lojas;
 *   · nunca fora do /inicio nem em oferta que não é vitalícia.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const m = vi.hoisted(() => ({ invoke: vi.fn(), track: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "ana@exemplo.com", user_metadata: { full_name: "Ana Souza" } } } }),
      getSession: async () => ({ data: { session: { access_token: "a", refresh_token: "r", user: { id: "u1" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: vi.fn(), verifyOtp: vi.fn(),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: async () => "ja-tinha", anonimoLigado: async () => true, emailDaSessao: async () => "ana@exemplo.com",
  definirEmailDaCompra: vi.fn(), entrarNaContaExistente: vi.fn(), marcarBatismoSeSemEmail: async () => {}, guardarCompraAnonima: vi.fn(),
  limparBatismo: vi.fn(), vincularCompraAnonima: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/funnel", async (orig) => ({ ...(await orig()), isInAppBrowser: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com", user_metadata: { full_name: "Ana Souza" } } }) }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));

import { PixCheckout } from "@/components/paywall/PixCheckout";
import { _zerarEstado2027, _zerarForca2027 } from "@/lib/upsell-2027";

const eventos = (nome: string) => m.track.mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const abrir = (props: Partial<React.ComponentProps<typeof PixCheckout>> = {}) =>
  render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} {...props} />);
const confirmou = () => waitFor(() => expect(m.track).toHaveBeenCalledWith("pix_confirmed", expect.anything()), { timeout: 9000 });

beforeEach(() => {
  vi.clearAllMocks();
  _zerarEstado2027(); _zerarForca2027();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  Element.prototype.scrollIntoView = () => {};
  m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && opts?.body?.action === "create") return { data: { orderId: "ord1", qrCode: "000201pix1", qrCodeBase64: null, amount: "27.90", expiresAt: new Date(Date.now() + 1800e3).toISOString() }, error: null };
    if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, status: "PAID" }, error: null };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("/inicio — o Seu 2027 no 'Pagamento confirmado'", () => {
  it("chave OFF (padrão): a confirmação de sempre com as lojas; o 2027 não aparece", async () => {
    window.history.replaceState(null, "", "/inicio");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-2027")).toBeNull();
    expect(eventos("u2027_oferta_view")).toHaveLength(0);
  }, 20000);

  it("ON: a oferta cobre a confirmação; 'Agora não' → as lojas", async () => {
    window.history.replaceState(null, "", "/inicio?up2027=on");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("u2027-oferta")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByTestId("inicio-2027")).toBeInTheDocument();
    expect(screen.getByTestId("u2027-confirmado").textContent).toContain("R$ 27,90");
    expect(eventos("u2027_oferta_view")[0]).toMatchObject({ origem: "inicio" });
    fireEvent.click(screen.getByTestId("u2027-nao"));
    await waitFor(() => expect(screen.queryByTestId("inicio-2027")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
  }, 20000);

  it("ON: quero → Pix u2027 → pronto → Continuar → as lojas", async () => {
    window.history.replaceState(null, "", "/inicio?up2027=on");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("u2027-quero")).toBeInTheDocument(), { timeout: 5000 });
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return { data: { orderId: "u1q", qrCode: "000201u1q", qrCodeBase64: null, expiresAt: null }, error: null };
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, pacote2027: true }, error: null };
      return { data: { ok: true }, error: null };
    });
    fireEvent.click(screen.getByTestId("u2027-quero"));
    await waitFor(() => expect(screen.getByTestId("hoje-ja-paguei")).toBeInTheDocument());
    expect(m.invoke.mock.calls.find((c) => c[0] === "asaas-pix" && c[1].body.offer === "u2027")![1].body).toMatchObject({ action: "create" });
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("u2027-pronto")).toBeInTheDocument());
    expect(eventos("u2027_pago")[0]).toMatchObject({ order_id: "u1q", origem: "inicio" });
    fireEvent.click(screen.getByTestId("u2027-continuar"));
    await waitFor(() => expect(screen.queryByTestId("inicio-2027")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
  }, 20000);

  it("ON fora do /inicio ou com oferta que não é vitalícia: nada", async () => {
    window.history.replaceState(null, "", "/app?up2027=on");
    abrir();
    await confirmou();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-2027")).toBeNull();
    cleanup();
    m.track.mockClear();
    window.history.replaceState(null, "", "/inicio?up2027=on");
    abrir({ offer: "w25" });
    await confirmou();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-2027")).toBeNull();
  }, 30000);
});
