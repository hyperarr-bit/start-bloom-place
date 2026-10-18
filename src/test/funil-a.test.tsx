/**
 * /funil-a (18/10): salário → 13º líquido → destino → plano + preço → nome + e-mail → Pix (a97) → sucesso.
 *
 * O que não pode quebrar:
 *   · 1 campo e o resultado na hora (sem cadastro); os exemplos calculam com 1 toque;
 *   · o salário EXATO nunca sai do aparelho: nem analytics, nem Meta, nem a conta (só a faixa);
 *   · a conta e o Pix são os MESMOS do /assinar (oferta a97);
 *   · em coreaplicativo.com.br e www a rota leva pra "/" com a query; no app da loja, pra porta do app;
 *   · as rotas que não podem mudar seguem com a mesma linha no App.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type U = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: vi.fn(async () => ({})),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
const definirEmailDaCompra = vi.fn();
vi.mock("@/lib/sessao-anonima", () => ({
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: vi.fn(async () => {}),
  limparBatismo: vi.fn(),
}));
let nativo = false;
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => nativo }));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePixPurchaseOnce } from "@/lib/purchase-tracking";
import FunilARota, { FunilA, _zerarEstadoA } from "@/pages/funil-a/FunilA";
import { _zerarSessaoVenda } from "@/pages/venda/rastreio";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const QUERY_AD = "?utm_source=meta&utm_campaign=funil_a&utm_content=video1&ad_id=333&fbclid=IwAR_abc";
const HOJE = new Date(2026, 9, 18, 15);
const PIX_OK = { orderId: "qr_a1", qrCode: "00020126580014br.gov.bcb.pix0136chave-teste520400005303986540597.905802BR", qrCodeBase64: null, expiresAt: null };

const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };
const montar = () => {
  window.history.replaceState({}, "", `/funil-a${QUERY_AD}`);
  return render(
    <MemoryRouter initialEntries={["/funil-a"]}>
      <Routes><Route path="/funil-a" element={<FunilA hoje={HOJE} />} /></Routes>
    </MemoryRouter>,
  );
};
const passo = () => screen.getByTestId("funila").getAttribute("data-passo");
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body);

beforeEach(() => {
  _zerarEstadoA(); _zerarSessaoVenda(); _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  nativo = false;
  authState.user = null; authState.loading = false; authState.isSubscribed = false;
  [getSession, getUser, updateUser, invoke, definirEmailDaCompra].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear(); vi.mocked(fireMetaEvent).mockClear(); vi.mocked(firePixPurchaseOnce).mockClear();
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "ana@exemplo.com", user_metadata: {} } } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  invoke.mockResolvedValue({ data: null, error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.defineProperty(navigator, "userAgent", { value: UA_IPHONE, configurable: true });
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("rota", () => {
  it("App.tsx: /funil-a só na web; as rotas intocáveis seguem com a mesma linha", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/funil-a" element={<SoNaWeb><RouteErrorBoundary routeName="funil-a"><FunilA /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/assinatura" element={<SoNaWeb><RouteErrorBoundary routeName="assinatura-app"><AssinaturaApp /></RouteErrorBoundary></SoNaWeb>} />');
  });

  it("no app da loja vai pra porta do app", () => {
    nativo = true;
    render(
      <MemoryRouter initialEntries={["/funil-a"]}>
        <Routes><Route path="/funil-a" element={<FunilARota />} /><Route path="*" element={<Onde />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("onde").textContent).toBe("/app");
  });

  it("fora da produção (jsdom = localhost) abre o funil, com noindex", () => {
    const { unmount } = render(<MemoryRouter><FunilARota /></MemoryRouter>);
    expect(screen.getByTestId("funila-entrada")).toBeTruthy();
    expect(document.head.querySelector('meta[name="robots"][data-funil-a]')?.getAttribute("content")).toMatch(/noindex/);
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-funil-a]')).toBeNull();
  });
});

describe("o funil", () => {
  it("salário → resultado na hora, sem cadastro; o salário exato não sai do aparelho", async () => {
    montar();
    expect(eventos("funil_a_view")[0]).toMatchObject({ utm_campaign: "funil_a", ad_id: "333", variante: "funil_a" });
    fireEvent.change(screen.getByTestId("funila-salario"), { target: { value: "4.000" } });
    fireEvent.click(screen.getByTestId("funila-calcular"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    expect(screen.getByTestId("funila-liquido13").getAttribute("aria-label")).toBe("R$ 3.631,40");
    expect(screen.getByTestId("funila-parcela1").textContent).toContain("R$ 2.000,00");
    expect(screen.getByTestId("funila-parcela1").textContent).toContain("daqui a 43 dias");
    expect(screen.getByTestId("funila-parcela2").textContent).toContain("R$ 1.631,40");
    expect(screen.getByTestId("funila-economia-ir").textContent).toContain("R$ 114,76 a mais");
    expect(eventos("funil_a_calculou")[0]).toMatchObject({ faixa: "3k_5k", avos: 12, exemplo: false });
    expect(definirEmailDaCompra).not.toHaveBeenCalled();
    const tudoQueSaiu = JSON.stringify([vi.mocked(trackEvent).mock.calls, vi.mocked(fireMetaEvent).mock.calls, invoke.mock.calls]);
    expect(tudoQueSaiu).not.toMatch(/4\.?000|3631|3\.631/);
  });

  it("1 toque num exemplo já calcula; salário inválido mostra erro sem avançar", async () => {
    montar();
    fireEvent.change(screen.getByTestId("funila-salario"), { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("funila-calcular"));
    expect(screen.getByTestId("funila-erro")).toBeTruthy();
    expect(passo()).toBe("entrada");
    fireEvent.click(screen.getByTestId("funila-exemplo-2500"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    expect(eventos("funil_a_calculou")[0]).toMatchObject({ exemplo: true });
  });

  it("destino → plano com os potes e a âncora no 13º dela → dados → Pix a97 → pago → sucesso", async () => {
    invoke.mockImplementation(async (fn: string, opts: { body: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts.body.action === "create") return { data: PIX_OK, error: null };
      if (fn === "asaas-pix" && opts.body.action === "check") return { data: { paid: true }, error: null };
      if (fn === "check-subscription") return { data: { subscribed: true, subscription_end: "2027-10-18T12:00:00Z" }, error: null };
      return { data: null, error: null };
    });
    montar();
    fireEvent.change(screen.getByTestId("funila-salario"), { target: { value: "3000" } });
    fireEvent.click(screen.getByTestId("funila-calcular"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    fireEvent.click(screen.getByTestId("funila-resultado-cta"));
    await waitFor(() => expect(passo()).toBe("destino"));
    fireEvent.click(screen.getByTestId("funila-destino-reserva"));
    await waitFor(() => expect(passo()).toBe("plano"));
    expect(eventos("funil_a_destino")[0]).toMatchObject({ destino: "reserva" });
    expect(screen.getByTestId("funila-potes").textContent).toContain("Reserva de emergência");
    expect(screen.getByTestId("funila-ancora").textContent).toContain("3,6% do seu 13º");
    expect(screen.getByTestId("funila-preco").textContent).toContain("R$ 97,90");

    fireEvent.click(screen.getByTestId("funila-pagar"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(vi.mocked(fireMetaEvent).mock.calls.find((c) => c[0] === "InitiateCheckout")?.[1]).toMatchObject({ value: 97.9, currency: "BRL" });
    fireEvent.change(screen.getByTestId("venda-nome"), { target: { value: "Ana Souza" } });
    fireEvent.change(screen.getByTestId("venda-email"), { target: { value: "ana@exemplo.com" } });
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("pix"));
    const dados = updateUser.mock.calls.map((c) => (c[0] as { data?: Record<string, unknown> }).data).find((d) => d?.venda) as Record<string, unknown>;
    expect((dados.venda as { respostas: Record<string, unknown> }).respostas).toMatchObject({ funil: "funil_a", faixa_salario: "3k_5k", destino_13: "reserva" });
    expect(JSON.stringify(dados)).not.toContain("3000");
    await waitFor(() => expect(invocacoes("asaas-pix")[0]).toMatchObject({ action: "create", offer: "a97" }));
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 5000 });
    expect(firePixPurchaseOnce).toHaveBeenCalledWith("checkout");
    expect(eventos("venda_pago")[0]).toMatchObject({ plano: "anual", metodo: "pix", valor: 97.9, variante: "funil_a", destino: "reserva" });
  });
});
