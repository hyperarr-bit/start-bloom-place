/**
 * VENDA DA WEB (/assinar, 15/10): quiz da Porta → plano montado → PAYWALL (antes da conta) → nome + e-mail →
 * Pix na página (Asaas a97) ou cartão na Cakto → sucesso.
 *
 * O que não pode quebrar:
 *   · os passos na ordem, com as MESMAS perguntas da Porta; `?m=` começa na dor;
 *   · paywall: anual 97,90 em DESTAQUE (8,16/mês) com Pix e cartão; mensal 24,90 menor e SÓ no cartão;
 *     sem o link da Cakto, o cartão daquele plano some (o anual fica no Pix);
 *   · Pix: QR + copia-e-cola na página; o clipboard SÓ no toque em "Copiar código Pix";
 *   · cartão: vai pra Cakto com e-mail/nome + utm/fbclid; na volta, confere e dispara Purchase com o id da compra;
 *   · sucesso: loja do aparelho + "entre com este e-mail" + "Abrir o CORE" (iPhone, com o código);
 *   · nunca "sem cartão"; a /comece não muda.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
type U = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const invoke = vi.fn();
let linhasAssinatura: Array<Record<string, unknown>> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signInWithOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: linhasAssinatura }) }) }),
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
vi.mock("@/pages/venda/navegar", () => ({ irProCakto: vi.fn() }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePixPurchaseOnce, markPixPurchasePending } from "@/lib/purchase-tracking";
import { irProCakto } from "@/pages/venda/navegar";
import VendaWebRota, { _zerarEstadoVenda, CHAVE_ESTADO_VENDA } from "@/pages/venda/VendaWeb";
import { _zerarSessaoVenda } from "@/pages/venda/rastreio";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { linkDoCakto, porMes, urlDoCakto, areaDoM } from "@/pages/venda/conteudo";
import { TopoPorta } from "@/pages/porta/telas";

/* ---------------------------------------------------------------- ambiente */
const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15",
};
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const QUERY_AD = "?utm_source=meta&utm_medium=paid&utm_campaign=venda_web&utm_content=video1&c_id=111&as_id=222&ad_id=333&fbclid=IwAR_abc";
const irPara = (url: string) => window.history.replaceState({}, "", url);
const montar = (url = `/assinar${QUERY_AD}`) => {
  irPara(url);
  return render(
    <MemoryRouter initialEntries={["/assinar"]}>
      <Routes><Route path="/assinar" element={<VendaWebRota />} /></Routes>
    </MemoryRouter>,
  );
};
const passo = () => screen.getByTestId("venda").getAttribute("data-passo");
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const beacons = (nome: string) => vi.mocked(trackEventBeacon).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const metas = (nome: string) => vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === nome);
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body);
const semCartaoNaTela = () => expect(texto()).not.toMatch(/sem cart[aã]o/i);

const escolher = async (id: string, proximo: string) => {
  fireEvent.click(screen.getByTestId(`porta-opcao-${id}`));
  await waitFor(() => expect(passo()).toBe(proximo));
  semCartaoNaTela();
};
const atePaywall = async () => {
  montar();
  await escolher("dinheiro", "p2");
  await escolher("esqueco_contas", "p3");
  await escolher("nao_sei", "organiza");
  fireEvent.click(screen.getByTestId("porta-opcao-planilha"));
  fireEvent.click(screen.getByTestId("porta-continuar"));
  await waitFor(() => expect(passo()).toBe("montado"));
  fireEvent.click(screen.getByTestId("venda-montado-cta"));
  await waitFor(() => expect(passo()).toBe("paywall"));
};
const preencher = (nome: string, email: string) => {
  fireEvent.change(screen.getByTestId("venda-nome"), { target: { value: nome } });
  fireEvent.change(screen.getByTestId("venda-email"), { target: { value: email } });
};
const PIX_OK = { orderId: "qr_123", qrCode: "00020126580014br.gov.bcb.pix0136chave-pix-teste5204000053039865406" + "97.905802BR", qrCodeBase64: null, expiresAt: null };

const clip = vi.fn(async () => {});
beforeEach(() => {
  _zerarEstadoVenda();
  _zerarSessaoVenda();
  _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.loading = false; authState.isSubscribed = false;
  [getSession, getUser, updateUser, signOut, signUp, signInWithPassword, invoke, definirEmailDaCompra, clip].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear(); vi.mocked(trackEventBeacon).mockClear(); vi.mocked(fireMetaEvent).mockClear();
  vi.mocked(firePixPurchaseOnce).mockClear(); vi.mocked(markPixPurchasePending).mockClear(); vi.mocked(irProCakto).mockClear();
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "ana@exemplo.com", user_metadata: {} } } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  invoke.mockResolvedValue({ data: null, error: null });
  linhasAssinatura = [];
  Object.defineProperty(navigator, "clipboard", { value: { writeText: clip }, configurable: true });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  ua(UA.iphone);
  vi.stubEnv("VITE_VENDA_CAKTO_ANUAL", "anu4l97");
  vi.stubEnv("VITE_VENDA_CAKTO_MENSAL", "mens2490");
});
afterEach(() => { cleanup(); irPara("/"); vi.unstubAllEnvs(); });

/* ---------------------------------------------------------------- rota */
describe("rota e a /comece intacta", () => {
  it("App.tsx: /assinar só na web; /comece e /experimente com a mesma linha de antes; o banner global não monta por cima", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/experimente" element={<SoNaWeb><RouteErrorBoundary routeName="experimente"><Experimente /></RouteErrorBoundary></SoNaWeb>} />');
    expect(readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8")).toContain('location.pathname.startsWith("/assinar")');
  });

  it("o topo da Porta sem props continua byte a byte o da /comece", () => {
    render(<TopoPorta />);
    expect(screen.getByTestId("porta-topo").textContent).toBe("COREPlano gratuitoMonte seu plano de 3 dias4 perguntas rápidas, e sua conta fica pronta em menos de um minuto.");
  });

  it("noindex + venda_view + ViewContent (pixel e CAPI com o MESMO event_id) na 1ª carga", async () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-venda]')?.getAttribute("content")).toMatch(/noindex/);
    const v = eventos("venda_view")[0];
    expect(v).toMatchObject({ utm_campaign: "venda_web", ad_id: "333", plataforma: "ios" });
    const vc = metas("ViewContent")[0];
    expect(String(vc[2])).toMatch(/^venda_vc_/);
    await waitFor(() => expect(invocacoes("venda-capi")[0]).toMatchObject({ evento: "ViewContent", event_id: vc[2] }));
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-venda]')).toBeNull();
  });
});

/* ---------------------------------------------------------------- passos */
describe("os passos", () => {
  it("área → dor → número → como organiza → plano montado → paywall, com venda_passo; topo cheio no quiz e só o logo depois", async () => {
    montar();
    expect(screen.getByTestId("porta-topo").textContent).toContain("Organize sua vida em 3 dias");
    await atePaywallDaqui();
    expect(screen.getByTestId("porta-topo").hasAttribute("data-compacto")).toBe(true);
    const passos = eventos("venda_passo").map((e) => `${e.passo}:${e.resposta}`);
    expect(passos).toEqual(expect.arrayContaining(["area:dinheiro", "p2:Esqueço contas", "p3:Não faço ideia", "organiza:Planilha", "montado:view", "paywall:view"]));
    expect(eventos("venda_paywall_view")).toHaveLength(1);
  });

  it("plano montado mostra os 3 dias (o Dia 1 sai da dor)", async () => {
    montar();
    await escolher("rotina", "p2");
    await escolher("celular", "p3");
    await escolher("semana", "organiza");
    fireEvent.click(screen.getByTestId("porta-opcao-cabeca"));
    fireEvent.click(screen.getByTestId("porta-continuar"));
    await waitFor(() => expect(passo()).toBe("montado"));
    expect(screen.getByTestId("venda-montado-titulo").textContent).toBe("Seu plano está montado");
    expect(screen.getByTestId("venda-dias").textContent).toContain("Troca 15 minutos de celular por 1 hábito e marca");
  });

  it("?m=treino já escolhe a área e começa na dor (o voltar leva pra área)", async () => {
    montar(`/assinar?m=treino`);
    expect(passo()).toBe("p2");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que mais te trava hoje?");
    fireEvent.click(screen.getByTestId("porta-voltar"));
    await waitFor(() => expect(passo()).toBe("area"));
    expect(areaDoM("Finanças")).toBe("dinheiro");
    expect(areaDoM("xyz")).toBeNull();
  });
});
async function atePaywallDaqui() {
  await escolher("dinheiro", "p2");
  await escolher("esqueco_contas", "p3");
  await escolher("nao_sei", "organiza");
  fireEvent.click(screen.getByTestId("porta-opcao-planilha"));
  fireEvent.click(screen.getByTestId("porta-continuar"));
  await waitFor(() => expect(passo()).toBe("montado"));
  fireEvent.click(screen.getByTestId("venda-montado-cta"));
  await waitFor(() => expect(passo()).toBe("paywall"));
}

/* ---------------------------------------------------------------- paywall */
describe("paywall", () => {
  it("anual 97,90 em destaque (8,16/mês) com Pix e cartão; mensal 24,90 menor e só no cartão", async () => {
    await atePaywall();
    const anual = screen.getByTestId("venda-plano-anual");
    expect(anual.hasAttribute("data-destaque")).toBe(true);
    expect(screen.getByTestId("venda-selo-anual").textContent).toBe("Mais escolhido");
    expect(screen.getByTestId("venda-preco-anual").textContent).toBe("R$ 97,90");
    expect(screen.getByTestId("venda-por-mes").textContent).toContain("R$ 8,16/mês");
    expect(anual.textContent).toContain("Pagar com Pix");
    expect(anual.textContent).toContain("Cartão de crédito");
    const mensal = screen.getByTestId("venda-plano-mensal");
    expect(mensal.textContent).toContain("R$ 24,90/mês");
    expect(mensal.textContent).toMatch(/só no cartão/i);
    expect(mensal.textContent).not.toMatch(/pix/i);
    // o mensal vem DEPOIS do anual, fora do card de destaque
    expect(anual.contains(mensal)).toBe(false);
    expect(anual.compareDocumentPosition(mensal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(porMes(97.9)).toBe("8,16");
    semCartaoNaTela();
  });

  it("sem os links da Cakto: o anual fica só no Pix e o mensal some", async () => {
    vi.stubEnv("VITE_VENDA_CAKTO_ANUAL", "");
    vi.stubEnv("VITE_VENDA_CAKTO_MENSAL", "");
    await atePaywall();
    expect(screen.getByTestId("venda-anual-pix")).toBeInTheDocument();
    expect(screen.queryByTestId("venda-anual-cartao")).toBeNull();
    expect(screen.queryByTestId("venda-plano-mensal")).toBeNull();
  });

  it("toque no plano: venda_plano_click + InitiateCheckout (pixel e CAPI, mesmo event_id, valor do plano)", async () => {
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(eventos("venda_plano_click")[0]).toMatchObject({ plano: "anual", metodo: "pix", valor: 97.9 });
    const ic = metas("InitiateCheckout")[0];
    expect(ic[1]).toMatchObject({ value: 97.9, currency: "BRL", content_name: "core_anual_web" });
    expect(String(ic[2])).toMatch(/^venda_ic_/);
    await waitFor(() => expect(invocacoes("venda-capi").find((b) => b.evento === "InitiateCheckout")).toMatchObject({ event_id: ic[2], valor: 97.9 }));
  });
});

/* ---------------------------------------------------------------- Pix */
describe("Pix na página", () => {
  it("nome + e-mail → conta (anônima + e-mail) → QR + copia-e-cola (a97); copiar só no toque; pago → Purchase + venda_pago + sucesso", async () => {
    invoke.mockImplementation(async (fn: string, opts: { body: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts.body.action === "create") return { data: PIX_OK, error: null };
      if (fn === "asaas-pix" && opts.body.action === "check") return { data: { paid: true }, error: null };
      if (fn === "porta-handoff") return { data: { codigo: "ABCDEFGHJK", email_enviado: true }, error: null };
      if (fn === "check-subscription") return { data: { subscribed: true, subscription_end: "2027-10-15T12:00:00Z" }, error: null };
      return { data: null, error: null };
    });
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(screen.getByTestId("venda-resumo").textContent).toContain("Anual · R$ 97,90 · Pix");
    // erro por campo, sem enviar
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    expect(screen.getByTestId("venda-erro-nome").textContent).toBe("Digite seu nome");
    expect(definirEmailDaCompra).not.toHaveBeenCalled();
    preencher("Ana Souza", "Ana@Exemplo.com");
    // a conta logada aqui é a anônima que acabou de ganhar o e-mail
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("pix"));
    expect(definirEmailDaCompra).toHaveBeenCalledWith("ana@exemplo.com");
    // nome + a venda (campanha) na conta, nunca `porta`
    const dados = updateUser.mock.calls.map((c) => (c[0] as { data?: Record<string, unknown> }).data).find((d) => d?.venda) as Record<string, unknown>;
    expect(dados.full_name).toBe("Ana Souza");
    expect((dados.venda as Record<string, unknown>).plano).toBe("anual");
    expect(dados.porta).toBeUndefined();
    await waitFor(() => expect(screen.getByTestId("venda-pix-codigo").textContent).toBe(PIX_OK.qrCode));
    expect(invocacoes("asaas-pix")[0]).toMatchObject({ action: "create", offer: "a97" });
    expect(markPixPurchasePending).toHaveBeenCalledWith({ offer: "a97", orderId: "qr_123" });
    expect(eventos("venda_pix_qr_view")[0]).toMatchObject({ order_id: "qr_123", valor: 97.9 });
    expect(clip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("venda-pix-copiar"));
    await waitFor(() => expect(clip).toHaveBeenCalledWith(PIX_OK.qrCode));
    expect(screen.getByTestId("venda-pix-copiar").textContent).toContain("Código copiado");
    semCartaoNaTela();
    // o check (3 s) diz pago
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 5000 });
    expect(firePixPurchaseOnce).toHaveBeenCalledWith("checkout");
    expect(eventos("venda_pago")[0]).toMatchObject({ plano: "anual", metodo: "pix", valor: 97.9 });
    expect(screen.getByTestId("venda-sucesso-email").textContent).toBe("ana@exemplo.com");
    await waitFor(() => expect(invocacoes("porta-handoff")[0]).toMatchObject({ acao: "criar", metodo: "codigo" }));
    await waitFor(() => expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("15/10/2027"));
  });

  it("computador: o QR aparece direto (o celular mostra o copia-e-cola primeiro)", async () => {
    ua(UA.mac);
    invoke.mockImplementation(async (fn: string, opts: { body: Record<string, unknown> }) =>
      fn === "asaas-pix" && opts.body.action === "create" ? { data: PIX_OK, error: null } : { data: null, error: null });
    localStorage.setItem(CHAVE_ESTADO_VENDA, JSON.stringify({ passo: "pix", escolha: "dinheiro", p2: null, p3: null, p4: null, plano: "anual", metodo: "pix", nome: "Ana", email: "ana@exemplo.com", pix: null, cartaoUrl: null }));
    montar();
    await waitFor(() => expect(screen.getByTestId("venda-pix-qr")).toBeInTheDocument());
    expect(screen.getByTestId("venda-pix-qr").querySelector("svg")).not.toBeNull();
  });

  it("e-mail que já tem conta: pede a senha (ou código), entra e só então gera o Pix — nunca 2ª conta", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    signInWithPassword.mockResolvedValue({ error: null });
    invoke.mockImplementation(async (fn: string, opts: { body: Record<string, unknown> }) =>
      fn === "asaas-pix" && opts.body.action === "create" ? { data: PIX_OK, error: null } : { data: null, error: null });
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Bia", "bia@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(screen.getByTestId("venda-dados").getAttribute("data-fase")).toBe("existe"));
    expect(signUp).not.toHaveBeenCalled();
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    expect(texto()).toContain("Entrar com um código no e-mail");
    fireEvent.change(screen.getByTestId("venda-senha"), { target: { value: "segredo1" } });
    fireEvent.click(screen.getByTestId("venda-entrar"));
    await waitFor(() => expect(passo()).toBe("pix"));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "bia@exemplo.com", password: "segredo1" });
    await waitFor(() => expect(invocacoes("asaas-pix")[0]).toMatchObject({ offer: "a97" }));
  });
});

describe("quem já é assinante não paga de novo", () => {
  it("entrou na conta que já existe e ela já é assinante (vitalício/loja/anual): sucesso 'você já é assinante', SEM gerar Pix", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    signInWithPassword.mockResolvedValue({ error: null });
    invoke.mockImplementation(async (fn: string) =>
      fn === "check-subscription" ? { data: { subscribed: true, subscription_end: "2126-01-01T00:00:00Z", billing_period: "lifetime" }, error: null } : { data: null, error: null });
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Bia", "bia@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(screen.getByTestId("venda-dados").getAttribute("data-fase")).toBe("existe"));
    fireEvent.change(screen.getByTestId("venda-senha"), { target: { value: "segredo1" } });
    fireEvent.click(screen.getByTestId("venda-entrar"));
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Você já é assinante");
    expect(screen.getByTestId("venda-sucesso-titulo").textContent).toBe("Seu CORE já está liberado");
    expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("Não precisa pagar de novo");
    expect(eventos("venda_ja_assinante")[0]).toMatchObject({ via: "senha" });
    expect(eventos("venda_pago")).toHaveLength(0);
    expect(metas("Purchase")).toHaveLength(0);
  });

  it("conta existente que NÃO é assinante: segue pro Pix normalmente", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    signInWithPassword.mockResolvedValue({ error: null });
    invoke.mockImplementation(async (fn: string, opts: { body?: Record<string, unknown> }) =>
      fn === "check-subscription" ? { data: { subscribed: false }, error: null }
        : fn === "asaas-pix" && opts.body?.action === "create" ? { data: PIX_OK, error: null } : { data: null, error: null });
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Bia", "bia@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(screen.getByTestId("venda-dados").getAttribute("data-fase")).toBe("existe"));
    fireEvent.change(screen.getByTestId("venda-senha"), { target: { value: "segredo1" } });
    fireEvent.click(screen.getByTestId("venda-entrar"));
    await waitFor(() => expect(passo()).toBe("pix"));
    await waitFor(() => expect(invocacoes("asaas-pix")[0]).toMatchObject({ action: "create", offer: "a97" }));
  });

  it("já logado neste navegador com o mesmo e-mail e assinante (o servidor confirma): não cobra", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u-1", email: "ana@exemplo.com" } } } });
    invoke.mockImplementation(async (fn: string) =>
      fn === "check-subscription" ? { data: { subscribed: true, subscription_end: "2027-03-01T12:00:00Z" }, error: null } : { data: null, error: null });
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Ana", "ana@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("01/03/2027");
  });
});

/* ---------------------------------------------------------------- cartão */
describe("cartão (Cakto)", () => {
  it("anual no cartão: vai pra Cakto com e-mail/nome pré-preenchidos + utm/fbclid (venda_cakto_redirect com fbp/fbc)", async () => {
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-anual-cartao"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(screen.getByTestId("venda-dados-cta").textContent).toContain("Ir pro pagamento no cartão");
    preencher("Ana Souza", "ana@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("cartao"));
    expect(screen.getByTestId("venda-cartao").getAttribute("data-fase")).toBe("indo");
    await waitFor(() => expect(irProCakto).toHaveBeenCalled(), { timeout: 2000 });
    const url = new URL(vi.mocked(irProCakto).mock.calls[0][0]);
    expect(`${url.origin}${url.pathname}`).toBe("https://pay.cakto.com.br/anu4l97");
    expect(url.searchParams.get("email")).toBe("ana@exemplo.com");
    expect(url.searchParams.get("confirmEmail")).toBe("ana@exemplo.com");
    expect(url.searchParams.get("name")).toBe("Ana Souza");
    expect(url.searchParams.get("utm_campaign")).toBe("venda_web");
    expect(url.searchParams.get("utm_content")).toBe("video1");
    expect(url.searchParams.get("fbclid")).toBe("IwAR_abc");
    const b = beacons("venda_cakto_redirect")[0];
    expect(b).toMatchObject({ plano: "anual", valor: 97.9 });
    expect(String(b.fbc)).toMatch(/^fb\.1\.\d+\.IwAR_abc$/);
    expect(invocacoes("asaas-pix")).toHaveLength(0);
  });

  it("mensal: só cartão, 24,90, link do mensal", async () => {
    await atePaywall();
    fireEvent.click(screen.getByTestId("venda-plano-mensal"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(screen.getByTestId("venda-resumo").textContent).toContain("Mensal · R$ 24,90/mês · cartão");
    expect(eventos("venda_plano_click")[0]).toMatchObject({ plano: "mensal", metodo: "cartao", valor: 24.9 });
    preencher("Ana", "ana@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(irProCakto).toHaveBeenCalled(), { timeout: 2000 });
    expect(vi.mocked(irProCakto).mock.calls[0][0]).toMatch(/^https:\/\/pay\.cakto\.com\.br\/mens2490\?/);
  });

  it("volta da Cakto (?pago=cartao): confere a assinatura e dispara Purchase com o id da compra e o valor pago", async () => {
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    getSession.mockResolvedValue({ data: { session: { user: { id: "u-1", email: "ana@exemplo.com" } } } });
    linhasAssinatura = [{ abacatepay_billing_id: "cakto-ord-9", amount_cents: 10990, billing_period: "annual", payment_method: "card", status: "active" }];
    invoke.mockImplementation(async (fn: string) =>
      fn === "check-subscription" ? { data: { subscribed: true, subscription_end: "2027-10-15T12:00:00Z" }, error: null } : { data: null, error: null });
    localStorage.setItem(CHAVE_ESTADO_VENDA, JSON.stringify({ passo: "cartao", escolha: "dinheiro", p2: null, p3: null, p4: null, plano: "anual", metodo: "cartao", nome: "Ana", email: "ana@exemplo.com", pix: null, cartaoUrl: "https://pay.cakto.com.br/anu4l97?email=ana%40exemplo.com" }));
    montar("/assinar?pago=cartao");
    await waitFor(() => expect(passo()).toBe("sucesso"));
    const p = metas("Purchase")[0];
    expect(p[1]).toMatchObject({ value: 109.9, currency: "BRL" });
    expect(p[2]).toBe("cakto-ord-9");
    expect(eventos("venda_pago")[0]).toMatchObject({ plano: "anual", metodo: "cartao", valor: 109.9 });
  });

  it("voltou da Cakto num navegador sem a sessão: 'entre com o e-mail do pagamento' + loja", async () => {
    montar("/assinar?pago=cartao");
    expect(passo()).toBe("cartao");
    await waitFor(() => expect(screen.getByTestId("venda-sucesso")).toBeInTheDocument());
    expect(screen.getByTestId("venda-sucesso").hasAttribute("data-confirmado")).toBe(false);
    expect(texto()).toContain("entre com o e-mail que você usou no pagamento");
    expect(screen.getByTestId("venda-loja").getAttribute("href")).toMatch(/^\/baixar\?origem=venda/);
  });
});

/* ---------------------------------------------------------------- sucesso */
describe("sucesso", () => {
  const noSucesso = (extra: Record<string, unknown> = {}) => {
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    localStorage.setItem(CHAVE_ESTADO_VENDA, JSON.stringify({ passo: "sucesso", escolha: "dinheiro", p2: null, p3: null, p4: null, plano: "anual", metodo: "pix", nome: "Ana", email: "ana@exemplo.com", pix: null, cartaoUrl: null, ...extra }));
    montar();
  };

  it("iPhone: App Store + o e-mail + a dica do Entrar sem senha; voltou da loja com código → Abrir o CORE (core://entrar?h=)", async () => {
    noSucesso({ codigo: "ABCDEFGHJK", emailEnviado: true, fim: "2027-10-15T12:00:00Z" });
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Pagamento confirmado");
    expect(screen.getByTestId("venda-sucesso-titulo").textContent).toBe("Seu CORE está liberado");
    expect(screen.getByTestId("venda-sucesso-email").textContent).toBe("ana@exemplo.com");
    expect(screen.getByTestId("venda-sucesso-plano").textContent).toContain("Plano anual · acesso até 15/10/2027");
    const loja = screen.getByTestId("venda-loja");
    expect(loja.textContent).toContain("App Store");
    expect(loja.getAttribute("href")).toBe("/baixar?origem=venda&utm_content=video1");
    expect(texto()).toContain("“Entrar sem senha”");
    expect(screen.getByTestId("venda-sucesso-aviso-email")).toBeInTheDocument();
    fireEvent.click(loja);
    expect(beacons("venda_loja_click")[0]).toMatchObject({ loja: "ios" });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(screen.getByTestId("venda-abrir-app").getAttribute("href")).toBe("core://entrar?h=ABCDEFGHJK"));
    semCartaoNaTela();
  });

  it("Android: Google Play; computador: QR", () => {
    ua(UA.android);
    noSucesso();
    expect(screen.getByTestId("venda-loja").textContent).toContain("Google Play");
    cleanup();
    _zerarEstadoVenda();
    ua(UA.mac);
    noSucesso();
    expect(screen.getByTestId("venda-qr").querySelector("svg")).not.toBeNull();
    expect(screen.queryByTestId("venda-loja")).toBeNull();
  });
});

/* ---------------------------------------------------------------- regras do código */
describe("regras", () => {
  const pasta = join(process.cwd(), "src/pages/venda");
  const fontes = readdirSync(pasta).map((f) => [f, readFileSync(join(pasta, f), "utf8")] as const);

  it("nunca 'sem cartão' no funil (fora dos comentários que explicam a regra)", () => {
    const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const [, s] of fontes) expect(semComentarios(s)).not.toMatch(/sem cart[aã]o/i);
  });

  it("área de transferência: só o writeText do 'Copiar código Pix' (PixVenda); nada lê o clipboard", () => {
    for (const [f, s] of fontes) {
      expect(s).not.toMatch(/clipboard\.read|readText/);
      const usos = (s.match(/clipboard\.writeText/g) ?? []).length;
      expect(usos).toBe(f === "PixVenda.tsx" ? 1 : 0);
    }
  });

  it("links da Cakto: código ou URL da Cakto; qualquer outra coisa = sem cartão", () => {
    expect(linkDoCakto("anual", { VITE_VENDA_CAKTO_ANUAL: "abc1234" })).toBe("https://pay.cakto.com.br/abc1234");
    expect(linkDoCakto("anual", { VITE_VENDA_CAKTO_ANUAL: "https://pay.cakto.com.br/abc1234/" })).toBe("https://pay.cakto.com.br/abc1234");
    expect(linkDoCakto("anual", { VITE_VENDA_CAKTO_ANUAL: "https://evil.example/abc" })).toBeNull();
    expect(linkDoCakto("mensal", {})).toBeNull();
    const u = new URL(urlDoCakto("https://pay.cakto.com.br/abc1234", { email: " X@Y.COM ", nome: "Zé", attr: { utm_source: "meta", c_id: "1" } }));
    expect(u.searchParams.get("email")).toBe("x@y.com");
    expect(u.searchParams.get("utm_source")).toBe("meta");
    expect(u.searchParams.get("c_id")).toBeNull();
  });
});
