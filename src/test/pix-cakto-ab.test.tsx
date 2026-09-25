/**
 * TESTE A/B ASAAS × CAKTO (25/09, dono: "to pensando em mudar pra cakto, bora
 * testar"). A Cakto voltou a emitir Pix SEM CPF (sonda 9/9), então o braço dela
 * tem a MESMA tela da Asaas — nada de campo de CPF. Se a Cakto falhar, o Pix
 * sai pela Asaas na hora e a confirmação pergunta pra quem emitiu.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ invoke: vi.fn(), track: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: async () => "logada",
  anonimoLigado: async () => false,
  emailDaSessao: async () => "ana@gmail.com",
  definirEmailDaCompra: vi.fn(),
  entrarNaContaExistente: vi.fn(),
  marcarBatismoSeSemEmail: async () => {},
  guardarCompraAnonima: vi.fn(),
  limparBatismo: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, getAttributionParams: () => ({}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/funnel", async (orig) => ({ ...(await orig()), isInAppBrowser: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn() }));

import { PixCheckout, bracoPorSemente, aquecerCheckoutPix } from "@/components/paywall/PixCheckout";

const qr = (id: string) => ({ data: { orderId: id, qrCode: `000201${id}`, amount: "27.9", expiresAt: new Date(Date.now() + 30 * 60e3).toISOString() }, error: null });
const chamadas = (fn: string, action?: string) =>
  m.invoke.mock.calls.filter((c) => c[0] === fn && (!action || c[1]?.body?.action === action)).length;

describe("checkout Pix — braço Cakto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/inicio?gw=cakto");
  });

  it("sem campo de CPF: o Pix sai da Cakto e a confirmação pergunta ao check-subscription", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "cakto-pix") return opts?.body?.warm ? { data: { ok: true }, error: null } : qr("uuid-cakto-1");
      if (fn === "check-subscription") return { data: { subscribed: false }, error: null };
      return { data: {}, error: null };
    });
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText("CPF")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument(), { timeout: 6000 });
    expect(screen.queryByPlaceholderText("CPF")).not.toBeInTheDocument();
    expect(chamadas("asaas-pix")).toBe(0);
    const create = m.invoke.mock.calls.find((c) => c[0] === "cakto-pix" && !c[1]?.body?.warm);
    expect(create?.[1]?.body?.customer?.docNumber).toBeUndefined(); // não inventa CPF
    expect(m.track).toHaveBeenCalledWith("pix_generated", expect.objectContaining({ gateway: "cakto", braco: "cakto" }));
    await waitFor(() => expect(chamadas("check-subscription")).toBeGreaterThan(0), { timeout: 6000 });
    expect(chamadas("asaas-pix", "check")).toBe(0);
  });

  it("Cakto falhou: o Pix sai pela Asaas na hora, sem erro nem CPF, e a confirmação pergunta à Asaas", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "cakto-pix") return opts?.body?.warm ? { data: { ok: true }, error: null } : { data: null, error: new Error("Edge Function returned a non-2xx status code") };
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr("pay_asaas_1");
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: false, status: "PENDING" }, error: null };
      return { data: {}, error: null };
    });
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument(), { timeout: 6000 });
    expect(screen.queryByPlaceholderText("CPF")).not.toBeInTheDocument();
    expect(screen.queryByText(/Não consegui gerar o Pix/i)).not.toBeInTheDocument();
    expect(m.track).toHaveBeenCalledWith("pix_fallback", expect.objectContaining({ de: "cakto", para: "asaas" }));
    expect(m.track).toHaveBeenCalledWith("pix_generated", expect.objectContaining({ gateway: "asaas", braco: "cakto", order_id: "pay_asaas_1" }));
    await waitFor(() => expect(chamadas("asaas-pix", "check")).toBeGreaterThan(0), { timeout: 6000 });
    expect(chamadas("check-subscription")).toBe(0);
  });

  it("a preparação só marca 'Gerando seu Pix' quando o Pix chega", async () => {
    let solta: (v: unknown) => void = () => {};
    m.invoke.mockImplementation((fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "cakto-pix" && !opts?.body?.warm) return new Promise((r) => { solta = r; });
      return Promise.resolve({ data: { ok: true, subscribed: false }, error: null });
    });
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("preparo-1")).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 1200)); // a lista antiga já estaria toda marcada aqui
    expect(screen.getByTestId("preparo-0").dataset.marcado).toBe("1");
    expect(screen.getByTestId("preparo-1").dataset.marcado).toBe("0");
    expect(screen.getByTestId("preparo-2").dataset.marcado).toBe("0");
    solta(qr("uuid-cakto-2"));
    await waitFor(() => expect(screen.getByTestId("preparo-1").dataset.marcado).toBe("1"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument(), { timeout: 6000 });
  });
});

describe("sorteio do braço", () => {
  const uids = Array.from({ length: 600 }, (_, i) => `${(i * 2654435761 >>> 0).toString(16).padStart(8, "0")}-4b1c-4d2e-9f3a-${String(i).padStart(12, "0")}`);

  it("w27 divide perto de 50/50 entre Asaas e Cakto, e a mesma pessoa cai sempre no mesmo braço", () => {
    const cakto = uids.filter((u) => bracoPorSemente(u, "w27") === "cakto").length;
    expect(cakto / uids.length).toBeGreaterThan(0.4);
    expect(cakto / uids.length).toBeLessThan(0.6);
    expect(uids.every((u) => bracoPorSemente(u, "w27") === bracoPorSemente(u, "w27"))).toBe(true);
  });

  it("oferta que a Cakto cobraria diferente da tela (lifetime = 97,90 na tela) nunca vai pra Cakto", () => {
    expect(uids.some((u) => bracoPorSemente(u, "lifetime") === "cakto")).toBe(false);
    expect(uids.some((u) => bracoPorSemente(u, "w97") === "cakto")).toBe(false);
  });
});

/* 25/09 00h30 — Cakto em 100% na web (dono: "faz 100% a cakto logo"). Estes
 * testes valem enquanto FORCE_GATEWAY = "cakto". O do disjuntor fica por
 * ÚLTIMO: o estado "Cakto desligada" é do módulo e vale pro resto do arquivo. */
describe("Cakto em 100% (sem link de teste)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/inicio");
  });

  it("a w27 vai pra Cakto sem precisar do ?gw=cakto", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "cakto-pix") return opts?.body?.warm ? { data: { ok: true, ativa: true }, error: null } : qr("uuid-cakto-100");
      return { data: { subscribed: false }, error: null };
    });
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument(), { timeout: 6000 });
    expect(m.invoke.mock.calls.some((c) => c[0] === "cakto-pix" && !c[1]?.body?.warm)).toBe(true);
    expect(chamadas("asaas-pix")).toBe(0);
    expect(m.track).toHaveBeenCalledWith("pix_checkout_open", expect.objectContaining({ gateway: "cakto" }));
  });

  it("a lifetime (97,90 na tela; na Cakto cobraria 27,90) nunca vai pra Cakto", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr("pay_asaas_lifetime");
      return { data: { paid: false }, error: null };
    });
    render(<PixCheckout offer="lifetime" context="funnel" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument(), { timeout: 6000 });
    expect(chamadas("cakto-pix")).toBe(0);
    expect(chamadas("asaas-pix", "create")).toBe(1);
  });

  it("disjuntor aberto (aquecimento diz ativa:false): nem tenta a Cakto, o Pix sai direto pela Asaas", async () => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "cakto-pix") return opts?.body?.warm ? { data: { ok: true, ativa: false }, error: null } : qr("nao-devia");
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr("pay_asaas_disjuntor");
      return { data: { paid: false }, error: null };
    });
    aquecerCheckoutPix(null, "w27"); // o paywall aquece enquanto a pessoa lê
    await new Promise((r) => setTimeout(r, 20));
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiar código Pix/i })).toBeInTheDocument(), { timeout: 6000 });
    expect(m.invoke.mock.calls.some((c) => c[0] === "cakto-pix" && !c[1]?.body?.warm)).toBe(false);
    expect(m.track).toHaveBeenCalledWith("pix_fallback", expect.objectContaining({ de: "cakto", para: "asaas", motivo: "cakto_desligada" }));
    expect(m.track).toHaveBeenCalledWith("pix_generated", expect.objectContaining({ gateway: "asaas", braco: "cakto" }));
  });
});
