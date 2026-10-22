/**
 * OFERTAS DEPOIS DO PIX no /inicio (21/10, integração): o "Pagamento confirmado" do vitalício (w27) no PixCheckout.
 * Uma camada por vez — a próxima só aparece quando a anterior terminou:
 *   · ?ofertas=2027: 2027 → Agora não → plano de 30 dias → lojas · 2027 pago → lojas (sem plano de 30 dias); presente nunca
 *   · ?ofertas=presente: presente (com o plano de 30 dias dentro) → lojas; 2027 nunca
 *   · off (?ofertas=off; a chave está em "2027" desde 22/10): a confirmação de sempre com as lojas, nada das ofertas
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
import { _zerarForcaOfertas } from "@/lib/ofertas-pos-compra";
import { _zerarEstadoPresente } from "@/lib/presente";
import { _zerarEstado2027 } from "@/lib/upsell-2027";

const eventosQueComecam = (prefixo: string) => m.track.mock.calls.filter((c) => String(c[0]).startsWith(prefixo));
const abrir = () => render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
const confirmou = () => waitFor(() => expect(m.track).toHaveBeenCalledWith("pix_confirmed", expect.anything()), { timeout: 9000 });
/** nunca duas camadas de oferta por cima uma da outra */
const camadas = () => ["inicio-2027", "inicio-plano30", "inicio-presente"].filter((id) => screen.queryByTestId(id)).length;

beforeEach(() => {
  vi.clearAllMocks();
  _zerarForcaOfertas(); _zerarEstado2027(); _zerarEstadoPresente();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  Element.prototype.scrollIntoView = () => {};
  m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && opts?.body?.action === "create") return { data: { orderId: "ord1", qrCode: "000201pix1", qrCodeBase64: null, amount: "27.90", expiresAt: new Date(Date.now() + 1800e3).toISOString() }, error: null };
    if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, status: "PAID" }, error: null };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("/inicio — a ordem das ofertas no 'Pagamento confirmado'", () => {
  it("?ofertas=off: a confirmação de sempre com as lojas; nenhuma camada nem evento das ofertas", async () => {
    window.history.replaceState(null, "", "/inicio?ofertas=off");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(camadas()).toBe(0);
    for (const p of ["u2027_", "presente_", "plano30_"]) expect(eventosQueComecam(p)).toHaveLength(0);
  }, 20000);

  it("?ofertas=2027: 2027 → Agora não → plano de 30 dias → Não, obrigado → lojas; 1 camada por vez; presente nunca", async () => {
    window.history.replaceState(null, "", "/inicio?ofertas=2027");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("u2027-oferta")).toBeInTheDocument(), { timeout: 5000 });
    expect(camadas()).toBe(1);
    fireEvent.click(screen.getByTestId("u2027-nao"));
    await waitFor(() => expect(screen.getByTestId("inicio-plano30")).toBeInTheDocument());
    expect(screen.queryByTestId("inicio-2027")).toBeNull();
    expect(camadas()).toBe(1);
    expect(screen.getByTestId("plano30")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await waitFor(() => expect(camadas()).toBe(0));
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    expect(eventosQueComecam("presente_")).toHaveLength(0);
  }, 20000);

  it("?ofertas=2027: aceitou o 2027 → pronto → Continuar → lojas, SEM o plano de 30 dias", async () => {
    window.history.replaceState(null, "", "/inicio?ofertas=2027");
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
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("u2027-pronto")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("u2027-continuar"));
    await waitFor(() => expect(camadas()).toBe(0));
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-plano30")).toBeNull();
    expect(eventosQueComecam("plano30_")).toHaveLength(0);
  }, 20000);

  it("?ofertas=presente: o presente cobre a confirmação; Agora não → plano de 30 dias → lojas; 2027 nunca", async () => {
    window.history.replaceState(null, "", "/inicio?ofertas=presente");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("presente-oferta")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByTestId("inicio-presente")).toBeInTheDocument();
    expect(camadas()).toBe(1);
    fireEvent.click(screen.getByTestId("presente-agora-nao"));
    await waitFor(() => expect(screen.getByTestId("plano30")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await waitFor(() => expect(camadas()).toBe(0));
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    expect(eventosQueComecam("u2027_")).toHaveLength(0);
  }, 20000);
});
