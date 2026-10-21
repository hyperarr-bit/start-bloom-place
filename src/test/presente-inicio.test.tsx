/**
 * UPSELL DE PRESENTE no /inicio (21/10): o "Pagamento confirmado" do vitalício (w27) no PixCheckout do funil.
 *   · chave OFF (padrão): a confirmação de sempre, com as lojas — o presente nem carrega;
 *   · ON (`?presente=on`): a oferta do presente cobre a confirmação; "Agora não" (área sem plano de 30 dias) → a
 *     confirmação com as lojas; área Dinheiro → o downsell do plano de 30 dias primeiro;
 *   · nunca fora do /inicio, no Funil B, nem em oferta que não é vitalícia.
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
import { _zerarEstadoPresente, _zerarForcaPresente } from "@/lib/presente";

const eventos = (nome: string) => m.track.mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const abrir = (props: Partial<React.ComponentProps<typeof PixCheckout>> = {}) =>
  render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} {...props} />);
const confirmou = () => waitFor(() => expect(m.track).toHaveBeenCalledWith("pix_confirmed", expect.anything()), { timeout: 9000 });

beforeEach(() => {
  vi.clearAllMocks();
  _zerarEstadoPresente(); _zerarForcaPresente();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  Element.prototype.scrollIntoView = () => {};
  m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && opts?.body?.action === "create") return { data: { orderId: "ord1", qrCode: "000201pix1", qrCodeBase64: null, amount: "27.90", expiresAt: new Date(Date.now() + 1800e3).toISOString() }, error: null };
    if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, status: "PAID" }, error: null };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("/inicio — o presente no 'Pagamento confirmado'", () => {
  it("chave OFF (padrão): a confirmação de sempre com as lojas; o presente não aparece nem carrega", async () => {
    window.history.replaceState(null, "", "/inicio");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-presente")).toBeNull();
    expect(eventos("presente_oferta_view")).toHaveLength(0);
  }, 20000);

  it("ON: a oferta cobre a confirmação; 'Agora não' (área sem plano de 30 dias) → a confirmação com as lojas", async () => {
    window.history.replaceState(null, "", "/inicio?presente=on");
    localStorage.setItem("core-funnel-area", "rotina");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("presente-oferta")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByTestId("inicio-presente")).toBeInTheDocument();
    expect(screen.getByTestId("presente-confirmado").textContent).toContain("R$ 27,90");
    expect(eventos("presente_oferta_view")[0]).toMatchObject({ origem: "inicio" });
    fireEvent.click(screen.getByTestId("presente-agora-nao"));
    await waitFor(() => expect(screen.queryByTestId("inicio-presente")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    expect(eventos("plano30_view")).toHaveLength(0);
  }, 20000);

  it("ON + área Dinheiro: 'Agora não' → o plano de 30 dias; 'Não, obrigado' → as lojas", async () => {
    window.history.replaceState(null, "", "/inicio?presente=on");
    localStorage.setItem("core-funnel-area", "dinheiro");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("presente-agora-nao")).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByTestId("presente-agora-nao"));
    await waitFor(() => expect(screen.getByTestId("plano30")).toBeInTheDocument());
    expect(eventos("plano30_view")[0]).toMatchObject({ area: "dinheiro", origem: "inicio" });
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await waitFor(() => expect(screen.queryByTestId("inicio-presente")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
  }, 20000);

  it("ON: quero presentear → Pix pv149 → cartão já com o nome da conta", async () => {
    window.history.replaceState(null, "", "/inicio?presente=on");
    abrir();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("presente-quero")).toBeInTheDocument(), { timeout: 5000 });
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return { data: { orderId: "pv1", qrCode: "000201pv1", qrCodeBase64: null, expiresAt: null }, error: null };
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true, presente: true, codigo: "K7QM2XPA" }, error: null };
      if (fn === "presente-resgatar") return { data: { ok: true, codigo: "K7QM2XPA", de: null }, error: null };
      return { data: { ok: true }, error: null };
    });
    fireEvent.click(screen.getByTestId("presente-quero"));
    await waitFor(() => expect(screen.getByTestId("hoje-ja-paguei")).toBeInTheDocument());
    expect(m.invoke.mock.calls.find((c) => c[0] === "asaas-pix" && c[1].body.offer === "pv149")).toBeTruthy();
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("presente-cartao")).toBeInTheDocument());
    expect((screen.getByTestId("presente-nome") as HTMLInputElement).value).toBe("Ana");
    await waitFor(() => expect(screen.getByTestId("presente-link").textContent).toContain("K7QM2XPA"));
    fireEvent.click(screen.getByTestId("presente-continuar"));
    await waitFor(() => expect(screen.queryByTestId("inicio-presente")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
  }, 20000);

  it("ON mas fora das regras: Funil B, oferta que não é vitalícia, fora do /inicio → nada do presente", async () => {
    window.history.replaceState(null, "", "/inicio?presente=on");
    const b = abrir({ funilB: { aoConfirmar: vi.fn() } });
    await confirmou();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-presente")).toBeNull();
    b.unmount(); m.track.mockClear();
    const mes = abrir({ offer: "w25" });
    await confirmou();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-presente")).toBeNull();
    mes.unmount(); m.track.mockClear();
    window.history.replaceState(null, "", "/planos?presente=on");
    abrir();
    await confirmou();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-presente")).toBeNull();
  }, 40000);
});
