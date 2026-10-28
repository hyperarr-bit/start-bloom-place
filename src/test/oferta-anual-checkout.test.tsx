/**
 * OFERTA "ANUAL" DO /inicio (26/10) no checkout: o Pix do PLANO ANUAL (OFB_anual27) e, depois de pago, o upgrade pro
 * vitalício por cima do "Pagamento confirmado":
 *   upsell +47,90 → X → downsell +27,90 (UMA vez) → X → acesso de 1 ano com as lojas
 *   upsell pago (OFB_up47) → "agora é vitalício" · downsell pago (OFB_down27) → idem
 *   o pós-compra de sempre (2027/presente/plano de 30 dias) NUNCA aparece nesta variante
 *   o vitalício (w27) do /inicio normal segue sem o upgrade
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const m = vi.hoisted(() => ({ invoke: vi.fn(), track: vi.fn(), mark: vi.fn() }));
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
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: m.mark, firePixPurchaseOnce: vi.fn(async () => true) }));

import { PixCheckout } from "@/components/paywall/PixCheckout";
import { _zerarForcaOfertas } from "@/lib/ofertas-pos-compra";
import { _zerarEstadoPresente } from "@/lib/presente";
import { _zerarEstado2027 } from "@/lib/upsell-2027";
import { _zerarEstadoUpgrade, _zerarOfertaAnual, capturarOferta, posCompraSegurado } from "@/lib/oferta-anual";

const confirmou = () => waitFor(() => expect(m.track).toHaveBeenCalledWith("pix_confirmed", expect.anything()), { timeout: 9000 });
const outrasCamadas = () => ["inicio-2027", "inicio-plano30", "inicio-presente"].filter((id) => screen.queryByTestId(id)).length;
const etapas = () => m.track.mock.calls.filter((c) => c[0] === "oferta_etapa").map((c) => (c[1] as { etapa: string; variante: string }));
const pedidosCriados = () => m.invoke.mock.calls.filter((c) => c[0] === "asaas-pix" && (c[1] as { body: { action: string } }).body.action === "create").map((c) => (c[1] as { body: { offer: string } }).body.offer);

let pagoNoCheck: Record<string, unknown> = { paid: true, status: "PAID" };
beforeEach(() => {
  vi.clearAllMocks();
  _zerarForcaOfertas(); _zerarEstado2027(); _zerarEstadoPresente(); _zerarOfertaAnual(); _zerarEstadoUpgrade();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  document.cookie = "core_oferta=; max-age=0; path=/";
  Element.prototype.scrollIntoView = () => {};
  pagoNoCheck = { paid: true, status: "PAID" };
  let n = 0;
  m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && opts?.body?.action === "create") {
      n++;
      return { data: { orderId: `ord${n}`, qrCode: `000201pix${n}`, qrCodeBase64: null, amount: n === 1 ? "27.90" : undefined, expiresAt: new Date(Date.now() + 1800e3).toISOString() }, error: null };
    }
    if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: pagoNoCheck, error: null };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

const abrirAnual = () => {
  window.history.replaceState(null, "", "/inicio?oferta=anual&step=offer");
  capturarOferta();
  return render(<PixCheckout offer="OFB_anual27" context="funnel" onClose={vi.fn()} />);
};

describe("o Pix do plano anual", () => {
  it("cria o Pix com a oferta OFB_anual27 e diz 1 ano / não renova (nada de vitalício)", async () => {
    abrirAnual();
    await waitFor(() => expect(screen.getByTestId("pix-recibo-anual")).toBeInTheDocument(), { timeout: 5000 });
    expect(pedidosCriados()).toEqual(["OFB_anual27"]);
    expect(screen.getByTestId("pix-recibo-anual").textContent).toContain("1 ano de acesso · não renova sozinho");
    expect(document.body.textContent).not.toMatch(/vitalíc|pra sempre/i);
    expect(m.mark).toHaveBeenCalledWith({ offer: "OFB_anual27", orderId: "ord1" });
  }, 20000);
});

describe("depois do Pix do anual: upsell → downsell (1x) → acesso", () => {
  it("X no upsell abre o downsell; X no downsell → acesso de 1 ano com as lojas; o pós-compra de sempre nunca aparece", async () => {
    abrirAnual();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("ofa-up")).toBeInTheDocument(), { timeout: 5000 });
    expect(posCompraSegurado()).toBe(true);
    expect(screen.getByTestId("ofa-up-preco").textContent).toContain("47,90");
    expect(outrasCamadas()).toBe(0);
    fireEvent.click(screen.getByTestId("ofa-up-x"));
    await waitFor(() => expect(screen.getByTestId("ofa-down")).toBeInTheDocument());
    expect(screen.getByText(/Vitalício por \+ R\$ 27,90/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ofa-down-x"));
    await waitFor(() => expect(screen.queryByTestId("inicio-upgrade")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-anual")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByTestId("pix-confirmado-anual-selo").textContent).toMatch(/1 ANO DE ACESSO · até \d{2}\/\d{2}\/\d{4}/);
    expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument();
    expect(screen.queryByTestId("ofa-down")).toBeNull();
    expect(outrasCamadas()).toBe(0);
    for (const p of ["u2027_", "presente_", "plano30_"]) expect(m.track.mock.calls.filter((c) => String(c[0]).startsWith(p))).toHaveLength(0);
    // a medição: 1 evento por etapa, variante anual
    expect(etapas().map((e) => e.etapa)).toEqual(["checkout", "pix", "pago", "up_visto", "down_visto"]);
    expect(etapas().every((e) => e.variante === "anual")).toBe(true);
    // nenhuma cobrança além do anual
    expect(pedidosCriados()).toEqual(["OFB_anual27"]);
  }, 25000);

  it("'Não, obrigado' faz o mesmo caminho (downsell 1x, depois acesso)", async () => {
    abrirAnual();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("ofa-up-nao")).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByTestId("ofa-up-nao"));
    await waitFor(() => expect(screen.getByTestId("ofa-down-nao")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("ofa-down-nao"));
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-anual")).toBeInTheDocument());
    expect(m.track.mock.calls.filter((c) => c[0] === "oferta_upgrade" && (c[1] as { acao: string }).acao === "vista")).toHaveLength(2);
  }, 25000);

  it("aceitou o upsell → Pix de 47,90 (OFB_up47) → pago → 'agora é vitalício' (sem downsell)", async () => {
    abrirAnual();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("ofa-up-sim")).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByTestId("ofa-up-sim"));
    await waitFor(() => expect(screen.getByTestId("hoje-ja-paguei")).toBeInTheDocument());
    expect(pedidosCriados()).toEqual(["OFB_anual27", "OFB_up47"]);
    expect(screen.getByTestId("hoje-pix-valor").textContent).toContain("47,90");
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-vitalicio")).toBeInTheDocument());
    expect(screen.queryByTestId("ofa-down")).toBeNull();
    expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument();
    expect(etapas().map((e) => e.etapa)).toContain("up_pago");
    expect(etapas().map((e) => e.etapa)).not.toContain("down_visto");
  }, 25000);

  it("recusou o upsell e aceitou o downsell → Pix de 27,90 (OFB_down27) → vitalício", async () => {
    abrirAnual();
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("ofa-up-nao")).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByTestId("ofa-up-nao"));
    await waitFor(() => expect(screen.getByTestId("ofa-down-sim")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("ofa-down-sim"));
    await waitFor(() => expect(screen.getByTestId("hoje-ja-paguei")).toBeInTheDocument());
    expect(pedidosCriados()).toEqual(["OFB_anual27", "OFB_down27"]);
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-vitalicio")).toBeInTheDocument());
    expect(etapas().map((e) => e.etapa)).toContain("down_pago");
  }, 25000);
});

describe("variante desligada / controle", () => {
  it("o vitalício (w27) do /inicio normal não ganha o upgrade e mede variante 'controle'", async () => {
    window.history.replaceState(null, "", "/inicio?ofertas=off");
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    await confirmou();
    await waitFor(() => expect(screen.getByTestId("pix-confirmado-lojas")).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-upgrade")).toBeNull();
    expect(screen.getByText(/seu pra sempre/)).toBeInTheDocument();
    expect(posCompraSegurado()).toBe(false);
    expect(etapas().every((e) => e.variante === "controle")).toBe(true);
    expect(m.track.mock.calls.filter((c) => c[0] === "oferta_upgrade")).toHaveLength(0);
  }, 20000);

  it("o Pix do anual FORA do /inicio (ex.: o gate do app) não abre o upgrade nem mede", async () => {
    window.history.replaceState(null, "", "/financas");
    render(<PixCheckout offer="OFB_anual27" context="app" onClose={vi.fn()} />);
    await confirmou();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId("inicio-upgrade")).toBeNull();
    expect(etapas()).toHaveLength(0);
  }, 20000);
});
