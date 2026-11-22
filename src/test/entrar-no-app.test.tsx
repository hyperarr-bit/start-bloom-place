/**
 * ENTRAR NO APP COM A CONTA DA COMPRA DA WEB (24/09).
 *
 * 17–24/09: de 374 sessões que tocaram em "Já tenho conta? Entrar" no app,
 * 80 nunca logaram (o /auth antigo não tinha código por e-mail nem Google) e
 * 80 acabaram no "Crie agora" → conta nova sem compra → paywall de tela
 * inteira SEM saída. Estes testes travam as três portas consertadas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; email: string } }));
const saiu = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: auth.user, loading: false, isSubscribed: false, subLoaded: true }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: async () => { saiu.n++; return { error: null }; }, getUser: async () => ({ data: { user: null } }) }, from: () => ({ insert: () => ({ then: () => {} }) }) },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
// o que o paywall precisa pra montar fora do app (mesmo desenho do paywall-assinatura-ios.test)
vi.mock("@/lib/loja", async (orig) => ({
  ...(await orig<typeof import("@/lib/loja")>()),
  ehApple: () => true, pelaLoja: () => "pela App Store", sufixoPagamento: () => "", temEscadaPix: () => false,
}));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  prefetchAssinaturas: vi.fn().mockResolvedValue(undefined),
  prefetchAnualIos: vi.fn().mockResolvedValue(undefined),
  temVitalicio97: () => true, temAnual97: () => false, temMensalVista: () => false, temAnualIos: () => true,
  precoAnualIos: () => "R$ 97,90", idProdutoAnualIos: () => "core_anual_97", mesesDeMensalQuePagamOAno: () => 4, ofertaAnualIos: () => "anual_97", dadosDaOfertaIos: () => ({ oferta: "anual_97", produto: "core_anual_97", offering: "default", preco: "R$ 97,90", pacote: true }), precoMensalDoAnualIos: () => "R$ 8,16", diasTrialIos: () => 3,
  anualIosTemTrial: () => true, ultimaCompraAnualFoiTrial: () => true, estadoRevenueCat: () => "pronto",
  comprarAnualIos: vi.fn(), comprar: vi.fn(), comprarVitalicio: vi.fn(), comprarAnual97: vi.fn(), comprarMensalVista: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false), motivoUltimaCompra: () => null, marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ data: {}, loaded: true }) }));
vi.mock("@/lib/teste-gratis", () => ({ estadoTeste: () => ({ fase: "nunca" }), limparGuiaSemente: vi.fn() }));
vi.mock("@/lib/notificacoes", () => ({ agendarResgateDoPlano: vi.fn(), cancelarResgateDoPlano: vi.fn(), cancelarReguaDoTeste: vi.fn() }));

beforeEach(() => { auth.user = null; saiu.n = 0; localStorage.clear(); });
afterEach(cleanup);

describe("página /como-entrar", () => {
  it("22/11: o passo a passo do app de HOJE (o mesmo do pós-compra), o toque certo e o aviso de não comprar de novo", async () => {
    const { default: ComoEntrar } = await import("@/pages/ComoEntrar");
    render(<MemoryRouter><ComoEntrar /></MemoryRouter>);
    expect(screen.getByText("Como entrar no app")).toBeInTheDocument();
    expect(screen.getByTestId("como-entrar-nao-compre").textContent).toMatch(/Você já pagou\. Não compre de novo no app\./);
    fireEvent.click(screen.getByTestId("como-entrar-aba-ios"));
    expect(screen.getByTestId("pos-passo-1").textContent).toMatch(/App Store/);
    expect(screen.getByTestId("pos-passo-2").textContent).toMatch(/Já tenho conta\? Entrar/);
    expect(screen.getByTestId("pos-passo-2").textContent).toMatch(/Não toque em “Começar”/);
    expect(screen.getByTestId("pos-passo-3").textContent).toMatch(/Receber código/);
    expect(screen.getByTestId("pos-passo-4").textContent).toMatch(/8 números/);
    expect(screen.getByTestId("pos-planos").textContent).toMatch(/Já é cliente\? Entre com seu e-mail/);
    fireEvent.click(screen.getByTestId("como-entrar-aba-android"));
    expect(screen.getByTestId("pos-passo-2").textContent).toMatch(/Entrar na minha conta/);
    expect(screen.getByTestId("como-entrar-email").textContent).not.toMatch(/@/); // deslogado: sem e-mail inventado
  });

  it("logado na web: mostra o e-mail exato pra usar no app", async () => {
    auth.user = { id: "u1", email: "maria@exemplo.com" };
    const { default: ComoEntrar } = await import("@/pages/ComoEntrar");
    render(<MemoryRouter><ComoEntrar /></MemoryRouter>);
    expect(screen.getByTestId("como-entrar-email").textContent).toMatch(/maria@exemplo\.com/);
    fireEvent.click(screen.getByTestId("como-entrar-aba-ios"));
    expect(screen.getByTestId("pos-passo-3").textContent).toMatch(/maria@exemplo\.com/);
  });
});

describe("gate do app (paywall de tela inteira)", () => {
  it("mostra em que conta a pessoa está e deixa trocar: sai e vai pro /entrar", async () => {
    auth.user = { id: "u2", email: "conta.errada@privaterelay.appleid.com" };
    const { PaywallAssinatura } = await import("@/components/paywall/PaywallAssinatura");
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<PaywallAssinatura contexto="gate" />} />
          <Route path="/entrar" element={<p>tela de entrar</p>} />
        </Routes>
      </MemoryRouter>
    );
    const linha = await screen.findByTestId("gate-trocar-conta");
    expect(linha.textContent).toMatch(/conta\.errada@privaterelay\.appleid\.com/);
    fireEvent.click(screen.getByRole("button", { name: "Entrar com outra conta" }));
    await waitFor(() => expect(screen.getByText("tela de entrar")).toBeInTheDocument());
    expect(saiu.n).toBe(1);
  });

  it("fora do gate (funil, /planos) a linha não aparece", async () => {
    auth.user = { id: "u3", email: "alguem@exemplo.com" };
    const { PaywallAssinatura } = await import("@/components/paywall/PaywallAssinatura");
    render(<MemoryRouter><PaywallAssinatura contexto="planos" /></MemoryRouter>);
    await screen.findAllByText(/Restaurar compras/);
    expect(screen.queryByTestId("gate-trocar-conta")).not.toBeInTheDocument();
  });
});
