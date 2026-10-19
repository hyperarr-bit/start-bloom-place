/**
 * O /INICIO VOLTA A VENDER (19/10) — e só ele. O que este arquivo trava:
 *   · a chave estreita: INICIO_VENDE ligada com VENDA_NA_WEB desligada;
 *   · na WEB o /inicio renderiza o funil do dia 14 (a porta), sem redirecionar;
 *   · no APP DA LOJA o /inicio continua indo pra porta do app (ENTRADA_APP);
 *   · as outras rotas de funil antigas continuam caindo na landing "/";
 *   · App.tsx: só o /inicio tem `vende`, "/" segue a Landing, o import EAGER de setembro voltou;
 *   · o Funil B está desligado (a kenny g cai no funil de antes do B);
 *   · a compra do Pix chega nos DOIS pixels (todas as funções de dinheiro do funil usam fetchNosPixels);
 *   · os selos das lojas no "pagamento confirmado" do funil (e só do funil).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const m = vi.hoisted(() => ({
  nativo: false,
  user: null as null | { id: string; email?: string },
  invoke: vi.fn(),
  track: vi.fn(),
  beacon: vi.fn(),
}));

vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => m.nativo }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: m.track,
  trackEventBeacon: m.beacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({ utm_campaign: "120250474048320041" }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: async () => ({ data: { user: m.user } }),
      getSession: async () => ({ data: { session: null } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: m.user, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
  useAuthOpcional: () => ({ user: m.user }),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, set: vi.fn(), data: {}, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: async () => "conta",
  anonimoLigado: async () => false,
  emailDaSessao: async () => m.user?.email ?? null,
  definirEmailDaCompra: vi.fn(),
  entrarNaContaExistente: vi.fn(),
  marcarBatismoSeSemEmail: async () => {},
  guardarCompraAnonima: vi.fn().mockResolvedValue(undefined),
  limparBatismo: vi.fn(),
}));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => String(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn() }));
vi.mock("@/lib/funnel", async (orig) => ({ ...(await orig<typeof import("@/lib/funnel")>()), isInAppBrowser: () => false }));

import { FunilAposentado } from "@/components/site/FunilAposentado";
import { ENTRADA_APP, INICIO_VENDE, VENDA_NA_WEB } from "@/lib/rotas-web";
import { FUNIL_B, CAMPANHA_KENNY_G, decidirFunilB } from "@/lib/funil-b";
import ComecarDia14 from "@/pages/funis/dia14/ComecarDia14";
import { PixCheckout } from "@/components/paywall/PixCheckout";

MotionGlobalConfig.skipAnimations = true;

const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };
const montarInicio = (entrada: string) =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/inicio" element={<FunilAposentado vende={INICIO_VENDE} web={<ComecarDia14 />} />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  m.nativo = false;
  m.user = null;
  m.track.mockClear();
  m.invoke.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("a chave estreita", () => {
  it("o /inicio vende (INICIO_VENDE) e a venda do resto da web continua desligada (VENDA_NA_WEB)", () => {
    expect(INICIO_VENDE).toBe(true);
    expect(VENDA_NA_WEB).toBe(false);
  });
  it("Funil B desligado: a kenny g cai no funil de antes do B (30/09, aca89c38)", () => {
    expect(FUNIL_B).toBe("off");
    expect(decidirFunilB(CAMPANHA_KENNY_G)).toBe(false);
  });
});

describe("/inicio na WEB com INICIO_VENDE", () => {
  it("renderiza a porta do funil do dia 14 (kenny g com utm) — sem redirecionar e sem 'funil_redirecionado'", () => {
    montarInicio(`/inicio?utm_source=ig&utm_medium=paid&utm_campaign=${CAMPANHA_KENNY_G}&fbclid=abc`);
    expect(screen.queryByTestId("onde")).toBeNull();
    expect(document.body.textContent).toContain("16 módulos");
    expect(m.track).not.toHaveBeenCalledWith("funil_redirecionado", expect.anything());
    // a 1ª tela do funil é a porta, sem a marca do B
    const start = m.track.mock.calls.find(([n, d]) => n === "funnel_view" && d?.step === "start");
    expect(start?.[1]).toMatchObject({ step: "start", porta: "vida" });
    expect(start?.[1]).not.toHaveProperty("funil");
  });
});

describe("/inicio no APP DA LOJA — nada muda", () => {
  it("vai pra porta do app (ENTRADA_APP), nunca renderiza o funil da web", () => {
    m.nativo = true;
    montarInicio("/inicio?utm_source=ig");
    expect(screen.getByTestId("onde").textContent).toBe(ENTRADA_APP);
    expect(m.track).not.toHaveBeenCalledWith("funil_redirecionado", expect.anything());
  });
});

describe("as OUTRAS rotas de funil antigas continuam na landing", () => {
  it("sem `vende`, toda rota aposentada cai em '/' com a atribuição", () => {
    for (const r of ["/comecar", "/comecar-v2", "/plano", "/direto", "/lp", "/funil-dia14", "/funil-radar", "/funil-v1", "/funil-w", "/app"]) {
      render(
        <MemoryRouter initialEntries={[`${r}?utm_source=x&step=offer`]}>
          <Routes>
            <Route path={r} element={<FunilAposentado web={<p>funil</p>} />} />
            <Route path="*" element={<Onde />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByTestId("onde").textContent, r).toBe("/?utm_source=x");
      cleanup();
    }
  });
});

describe("App.tsx ligado do jeito certo (fonte)", () => {
  const src = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

  it("só o /inicio tem `vende`, e é a INICIO_VENDE; ele renderiza o dia 14 EAGER de setembro", () => {
    expect(src.match(/vende=\{/g)?.length).toBe(1);
    expect(src).toContain('<Route path="/inicio" element={<FunilAposentado vende={INICIO_VENDE} web={INICIO_VENDE ? <RouteErrorBoundary routeName="funil"><ComecarDia14Eager /></RouteErrorBoundary>');
    expect(src).toContain('import ComecarDia14Eager from "./pages/funis/dia14/ComecarDia14";');
  });

  it("'/' continua a Landing (também com utm); o desvio de anúncio pro /inicio segue só com VENDA_NA_WEB", () => {
    expect(src).toContain("return <Landing />;");
    expect(src).toContain("if (VENDA_NA_WEB && temMarcaDeAnuncio())");
  });

  it("/hoje e /missao intocados (SoNaWeb, fora do FunilAposentado)", () => {
    expect(src).toContain('<Route path="/hoje" element={<SoNaWeb>');
    expect(src).toContain('<Route path="/missao" element={<SoNaWeb>');
  });
});

describe("compra nos DOIS pixels — as funções de dinheiro do /inicio", () => {
  const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");
  // Pix w27: Cakto (cakto-pix cria, cakto-webhook libera e manda a CAPI); reserva Asaas; rede de segurança pix-reconcile.
  for (const f of ["cakto-webhook/index.ts", "asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
    it(`${f}: toda CAPI sai por fetchNosPixels (nenhum fetch direto pro graph.facebook.com)`, () => {
      const s = fonte(f);
      expect(s).toContain('import { fetchNosPixels } from "../_shared/meta-pixels.ts";');
      expect(s).toMatch(/fetchNosPixels\(\{/);
      expect(s).not.toContain("graph.facebook.com");
    });
  }
  it("cakto-webhook: o event_id continua o order_id (dedup com o pixel do navegador)", () => {
    const s = fonte("cakto-webhook/index.ts");
    expect(s).toMatch(/event_name: "Purchase", event_time: eventTime, event_id: eventId/);
  });
  it("cakto-pix não manda CAPI (só cria o Pix)", () => {
    expect(fonte("cakto-pix/index.ts")).not.toContain("graph.facebook.com");
  });
});

describe("selos das lojas no pagamento confirmado", () => {
  const qr = { data: { orderId: "ord1", qrCode: "000201pix1", qrCodeBase64: "data:image/png;base64,iVBORw0KGgo=", amount: "27,90", expiresAt: new Date(Date.now() + 30 * 60e3).toISOString() }, error: null };
  const pagar = () => m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && opts?.body?.action === "create") return qr;
    if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true }, error: null };
    return { data: {}, error: null };
  });
  beforeEach(() => {
    window.history.replaceState(null, "", "/inicio?gw=asaas"); // Pix na Asaas: a confirmação é o check dela
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    Element.prototype.scrollIntoView = () => {};
  });

  it("funil (/inicio): App Store + Google Play e 'entre com este e-mail' com o e-mail da conta", async () => {
    m.user = { id: "u1", email: "ana@exemplo.com" };
    pagar();
    render(<MemoryRouter><PixCheckout offer="w27" context="funnel" onClose={vi.fn()} /></MemoryRouter>);
    const bloco = await screen.findByTestId("pix-confirmado-lojas", undefined, { timeout: 10000 });
    expect(bloco.textContent).toContain("O CORE também é app: baixe e entre com este e-mail");
    expect(screen.getByTestId("pix-confirmado-email").textContent).toBe("ana@exemplo.com");
    expect(screen.getByTestId("selo-app-store").getAttribute("href")).toBe("/baixar?origem=web_inicio_pos_compra&loja=ios");
    expect(screen.getByTestId("selo-google-play").getAttribute("href")).toBe("/baixar?origem=web_inicio_pos_compra&loja=android");
    // o resto da tela é o de sempre
    expect(screen.getByRole("button", { name: "Entrar no meu app" })).toBeInTheDocument();
  }, 20000);

  it("gate/planos (context app): a tela confirmada fica como era, sem selos", async () => {
    m.user = { id: "u1", email: "ana@exemplo.com" };
    pagar();
    render(<MemoryRouter><PixCheckout offer="w27" context="app" onClose={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar no meu app" })).toBeInTheDocument(), { timeout: 10000 });
    expect(screen.queryByTestId("pix-confirmado-lojas")).toBeNull();
  }, 20000);
});
