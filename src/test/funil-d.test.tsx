/**
 * /funil-d — um salário, a hora, o Pix a97. Sem quiz e sem extrato.
 * No domínio de produção a rota cai na landing. No app da loja, na porta do app.
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
      signOut: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ data: {}, error: null })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
      insert: () => Promise.resolve({ error: null }),
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

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import FunilD, { _zerarFunilD } from "@/pages/funil-d/FunilD";
import { CercaFunilD, ehDominioDeProducao } from "@/pages/funil-d/CercaFunilD";
import { _zerarSessaoVenda } from "@/pages/venda/rastreio";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { H1 } from "@/pages/funil-d/conteudo";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body);
const passo = () => screen.getByTestId("funild").getAttribute("data-passo");
const texto = () => document.body.textContent ?? "";

const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};

const Onde = () => {
  const l = useLocation();
  return <p data-testid="onde">{l.pathname}{l.search}</p>;
};

beforeEach(() => {
  _zerarFunilD();
  _zerarSessaoVenda();
  _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.loading = false; authState.isSubscribed = false;
  getSession.mockReset(); getUser.mockReset(); updateUser.mockReset(); invoke.mockReset(); definirEmailDaCompra.mockReset();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: null } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  invoke.mockResolvedValue({ data: { orderId: "qr_d", qrCode: "00020126580014br.gov.bcb.pix", qrCodeBase64: null, expiresAt: null }, error: null });
  nativo(false);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.history.replaceState({}, "", "/funil-d");
});
afterEach(() => { cleanup(); nativo(false); });

const montar = () => render(
  <MemoryRouter initialEntries={["/funil-d"]}>
    <Routes><Route path="/funil-d" element={<FunilD />} /></Routes>
  </MemoryRouter>,
);

describe("domínio", () => {
  it("só coreaplicativo.com.br e www são produção", () => {
    expect(ehDominioDeProducao("coreaplicativo.com.br")).toBe(true);
    expect(ehDominioDeProducao("WWW.CoreAplicativo.com.br.")).toBe(true);
    expect(ehDominioDeProducao("localhost")).toBe(false);
    expect(ehDominioDeProducao("core-git-funil-d.vercel.app")).toBe(false);
  });

  it("produção cai na landing e guarda o utm", () => {
    render(
      <MemoryRouter initialEntries={["/funil-d?utm_source=meta&fbclid=abc&step=offer"]}>
        <Routes>
          <Route path="/funil-d" element={<CercaFunilD hostname="www.coreaplicativo.com.br"><p>funil</p></CercaFunilD>} />
          <Route path="*" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("onde").textContent).toBe("/?utm_source=meta&fbclid=abc");
    expect(screen.queryByText("funil")).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("funild_redirecionado", { de: "/funil-d" });
  });

  it("preview mostra o funil; o app da loja vai pra porta", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/funil-d"]}>
        <Routes>
          <Route path="/funil-d" element={<CercaFunilD hostname="localhost"><p>funil</p></CercaFunilD>} />
          <Route path="*" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("funil")).toBeInTheDocument();
    unmount();
    nativo(true);
    render(
      <MemoryRouter initialEntries={["/funil-d?utm_source=meta"]}>
        <Routes>
          <Route path="/funil-d" element={<CercaFunilD hostname="localhost"><p>funil</p></CercaFunilD>} />
          <Route path="*" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("onde").textContent).toBe("/app");
    expect(screen.queryByText("funil")).toBeNull();
  });

  it("a rota no App.tsx passa pela cerca e pelo SoNaWeb, e não aposenta o funil", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/funil-d" element={<CercaFunilD><SoNaWeb><RouteErrorBoundary routeName="funil-d"><FunilD /></RouteErrorBoundary></SoNaWeb></CercaFunilD>} />');
    expect(app).toContain('<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).not.toContain('path="/funil-d" element={<FunilAposentado');
  });
});

describe("o fluxo", () => {
  it("a primeira tela já é o número, com a promessa do anúncio e noindex", () => {
    montar();
    expect(passo()).toBe("entrada");
    expect(screen.getByTestId("funild-h1").textContent).toBe(H1);
    expect(texto()).toContain("Sem extrato e sem estimativa");
    expect(document.head.querySelector('meta[name="robots"][data-funild]')?.getAttribute("content")).toMatch(/noindex/);
    expect(vi.mocked(fireMetaEvent).mock.calls[0]?.[0]).toBe("ViewContent");
    expect(invocacoes("asaas-pix")).toHaveLength(0);
  });

  it("salário inválido não avança; R$ 3.200 mostra a hora e não manda o valor pro evento", async () => {
    montar();
    fireEvent.click(screen.getByTestId("funild-ver"));
    expect(passo()).toBe("entrada");
    expect(screen.getByTestId("funild-erro").textContent).toMatch(/3\.200/);

    fireEvent.change(screen.getByTestId("funild-salario"), { target: { value: "50" } });
    fireEvent.click(screen.getByTestId("funild-ver"));
    expect(passo()).toBe("entrada");

    fireEvent.change(screen.getByTestId("funild-salario"), { target: { value: "3.200" } });
    fireEvent.click(screen.getByTestId("funild-ver"));
    expect(passo()).toBe("resultado");
    expect(screen.getByTestId("funild-hora").textContent).toBe("R$ 14,55");
    expect(screen.getByTestId("funild-dia").textContent).toContain("R$ 106,67");
    expect(screen.getByTestId("funild-plano-horas").textContent).toContain("6h 44min");
    expect(texto()).toContain("Não é o que sobrou na conta");

    const cru = JSON.stringify(vi.mocked(trackEvent).mock.calls);
    expect(cru).not.toContain("3200");
    expect(cru).not.toContain("320000");
    expect(cru).not.toContain("14,55");
    expect(eventos("funild_salario")[0]).toMatchObject({ faixa: "3000_5000", jornada: "44h" });
  });

  it("meio período troca a hora; um exemplo vira horas sem dizer que ela gastou isso", () => {
    montar();
    fireEvent.change(screen.getByTestId("funild-salario"), { target: { value: "3200" } });
    fireEvent.click(screen.getByTestId("funild-ver"));
    fireEvent.click(screen.getByTestId("funild-jornada"));
    expect(screen.getByTestId("funild-hora").textContent).toBe("R$ 29,09");
    fireEvent.click(screen.getByTestId("funild-jornada"));
    expect(screen.getByTestId("funild-hora").textContent).toBe("R$ 14,55");
    fireEvent.click(screen.getByTestId("funild-exemplo-ifood"));
    expect(screen.getByTestId("funild-traducao").textContent).toContain("3h 6min");
    expect(screen.getByTestId("funild-traducao").textContent).toContain("42% de um dia seu");
    expect(texto()).toContain("Não é o seu gasto");
    expect(eventos("funild_traduziu")[0]).toMatchObject({ faixa_preco: "20_50" });
    expect(JSON.stringify(eventos("funild_traduziu"))).not.toContain("4500");
  });

  it("o plano cita o que o app tem e o Pix só nasce depois do e-mail, na oferta a97", async () => {
    montar();
    fireEvent.change(screen.getByTestId("funild-salario"), { target: { value: "3200" } });
    fireEvent.click(screen.getByTestId("funild-ver"));
    fireEvent.click(screen.getByTestId("funild-exemplo-ifood"));
    fireEvent.click(screen.getByTestId("funild-seguir"));
    expect(passo()).toBe("plano");
    expect(screen.getByTestId("funild-passo-1").textContent).toContain("Quanto posso gastar hoje");
    expect(screen.getByTestId("funild-passo-2").textContent).toContain("Limite por categoria");
    expect(screen.getByTestId("funild-passo-3").textContent).toContain("Semana sem delivery");
    expect(screen.getByTestId("funild-modulos").textContent).toContain("16 módulos inclusos");
    expect(screen.getByTestId("funild-preco-card").textContent).toContain("R$ 97,90");
    expect(screen.getByTestId("funild-preco-card").textContent).toContain("R$ 8,16 por mês");
    expect(screen.getByTestId("funild-ancora").textContent).toContain("34 min");
    expect(screen.getByTestId("funild-preco-card").textContent).toContain("cabe dentro desse preço de R$ 45,00");
    expect(screen.getByTestId("funild-cnpj").textContent).toContain("55.041.112/0001-82");
    expect(texto()).not.toMatch(/extrato do banco|senha do banco|Open Finance/i);

    fireEvent.click(screen.getByTestId("funild-faq-2"));
    expect(texto()).toContain("Nada de banco");
    expect(invocacoes("asaas-pix")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("funild-pagar"));
    expect(passo()).toBe("email");
    fireEvent.change(screen.getByTestId("funild-email"), { target: { value: "ana@exemplo.com" } });
    fireEvent.click(screen.getByTestId("funild-gerar"));
    await waitFor(() => expect(invocacoes("asaas-pix").some((b) => b.action === "create" && b.offer === "a97")).toBe(true));
    expect(passo()).toBe("pix");
    expect(vi.mocked(fireMetaEvent).mock.calls.some((c) => c[0] === "InitiateCheckout" && (c[1] as { value?: number }).value === 97.9)).toBe(true);
    const venda = definirEmailDaCompra.mock.calls[0]?.[0];
    expect(venda).toBe("ana@exemplo.com");
    const corpos = JSON.stringify(invoke.mock.calls);
    expect(corpos).not.toContain("3200");
    expect(corpos).not.toContain("14,55");
  });
});
