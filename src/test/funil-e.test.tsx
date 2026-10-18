/**
 * SOMA-ASSINATURAS (/funil-e, 18/10) — a landing que JÁ É a ferramenta:
 * toca nas assinaturas que paga → total EXATO (preços públicos de hoje) →
 * "qual você NÃO usou?" → economia + lista de cancelamento → anual 97,90 no
 * Pix na página (a97) → sucesso. Proposta em FUNIL_PROPOSTA.md.
 *
 * O que não pode quebrar:
 *   · SÓ fora do domínio de produção (coreaplicativo.com.br devolve pra "/");
 *   · o total é CONTA EXATA sobre a seleção (nunca estimativa/faixa na tela);
 *   · o Meta NUNCA vê os valores do somatório (ViewContent/Lead sem valor;
 *     InitiateCheckout e Purchase com 97,90 fixo) — os totais ficam no analytics;
 *   · o rabo (dados → Pix/cartão → sucesso) é o MESMO da /assinar (conta nasce
 *     no pagamento, nunca 2ª conta, já assinante não paga de novo);
 *   · área de transferência: NADA neste funil copia ou lê (nem o Pix? — o
 *     PixVenda reusado copia SÓ no toque em "Copiar código Pix", regra dele);
 *   · /assinar, /comece, /experimente, /liberar, /assinatura e /raio-x intactos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks (os mesmos da /assinar) */
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
vi.mock("@/pages/venda/navegar", () => ({ irProCakto: vi.fn() }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { irProCakto } from "@/pages/venda/navegar";
import FunilERota, { _zerarEstadoFunile, ehDominioDeProducao, CHAVE_ESTADO_FUNILE } from "@/pages/funil-e/FunilE";
import { _zerarSessaoFunile } from "@/pages/funil-e/rastreio";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { PRECO_CORE_ANUAL, brl } from "@/pages/funil-e/somatorio";
import { SERVICOS } from "@/pages/funil-e/conteudo";

/* ---------------------------------------------------------------- ambiente */
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const QUERY_AD = "?utm_source=meta&utm_medium=paid&utm_campaign=funil_e&utm_content=video1&c_id=111&as_id=222&ad_id=333&fbclid=IwAR_abc";
const irPara = (url: string) => window.history.replaceState({}, "", url);
const montar = (url = `/funil-e${QUERY_AD}`) => {
  irPara(url);
  return render(
    <MemoryRouter initialEntries={["/funil-e"]}>
      <Routes><Route path="/funil-e" element={<FunilERota />} /></Routes>
    </MemoryRouter>,
  );
};
const passo = () => screen.getByTestId("funile").getAttribute("data-passo");
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === `funile_${nome}`).map((c) => c[1] as Record<string, unknown>);
const beacons = (nome: string) => vi.mocked(trackEventBeacon).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const metas = (nome: string) => vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === nome);
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body);
const preco = (id: string) => SERVICOS.find((s) => s.id === id)!.preco;

const PIX_OK = { orderId: "qr_funile_1", qrCode: "00020126580014br.gov.bcb.pix0136chave-pix-teste5204000053039865406" + "97.905802BR", qrCodeBase64: null, expiresAt: null };

/** ferramenta: toca netflix + spotify e vai pro resultado */
const ateResultado = async () => {
  montar();
  fireEvent.click(screen.getByTestId("funile-servico-netflix"));
  fireEvent.click(screen.getByTestId("funile-servico-spotify"));
  fireEvent.click(screen.getByTestId("funile-ver-total"));
  await waitFor(() => expect(passo()).toBe("resultado"));
};
/** …e marca a Netflix como "não usei" e vai pro preço */
const atePreco = async () => {
  await ateResultado();
  fireEvent.click(screen.getByTestId("funile-nao-netflix"));
  fireEvent.click(screen.getByTestId("funile-seguir"));
  await waitFor(() => expect(passo()).toBe("preco"));
};
const preencher = (nome: string, email: string) => {
  fireEvent.change(screen.getByTestId("venda-nome"), { target: { value: nome } });
  fireEvent.change(screen.getByTestId("venda-email"), { target: { value: email } });
};

beforeEach(() => {
  _zerarEstadoFunile();
  _zerarSessaoFunile();
  _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.loading = false; authState.isSubscribed = false;
  [getSession, getUser, updateUser, signOut, signUp, signInWithPassword, invoke, definirEmailDaCompra].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear(); vi.mocked(trackEventBeacon).mockClear(); vi.mocked(fireMetaEvent).mockClear();
  vi.mocked(irProCakto).mockClear();
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "ana@exemplo.com", user_metadata: {} } } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  invoke.mockResolvedValue({ data: null, error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  ua(UA_IPHONE);
  vi.stubEnv("VITE_VENDA_CAKTO_ANUAL", "anu4l97");
});
afterEach(() => { cleanup(); irPara("/"); vi.unstubAllEnvs(); });

/* ---------------------------------------------------------------- rota e o portão do domínio */
describe("rota e o portão do domínio", () => {
  it("App.tsx: /funil-e só na web, e as rotas dos outros funis INTACTAS", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/funil-e" element={<SoNaWeb><RouteErrorBoundary routeName="funil-e"><FunilE /></RouteErrorBoundary></SoNaWeb>} />');
    for (const linha of [
      '<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />',
      '<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />',
      '<Route path="/experimente" element={<SoNaWeb><RouteErrorBoundary routeName="experimente"><Experimente /></RouteErrorBoundary></SoNaWeb>} />',
      '<Route path="/liberar" element={<SoNaWeb><RouteErrorBoundary routeName="liberar"><Liberar /></RouteErrorBoundary></SoNaWeb>} />',
      '<Route path="/assinatura" element={<SoNaWeb><RouteErrorBoundary routeName="assinatura-app"><AssinaturaApp /></RouteErrorBoundary></SoNaWeb>} />',
    ]) expect(app).toContain(linha);
    // o banner global NUNCA monta por cima do funil (a conta sem assinatura nasce nele)
    expect(readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8")).toContain('location.pathname.startsWith("/funil-e")');
  });

  it("o portão: produção (com e sem www) devolve pra landing; preview e dev passam", () => {
    expect(ehDominioDeProducao("coreaplicativo.com.br")).toBe(true);
    expect(ehDominioDeProducao("www.coreaplicativo.com.br")).toBe(true);
    expect(ehDominioDeProducao("COREAPLICATIVO.COM.BR")).toBe(true);
    expect(ehDominioDeProducao("preview-xyz.vercel.app")).toBe(false);
    expect(ehDominioDeProducao("localhost")).toBe(false);
  });

  it("noindex + funile_view + ViewContent (pixel e CAPI, mesmo event_id) na 1ª carga; 1x por sessão", async () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-funile]')?.getAttribute("content")).toMatch(/noindex/);
    const v = eventos("view")[0];
    expect(v).toMatchObject({ atribuicao: "url", plataforma: "ios" });
    expect(v).toHaveProperty("funile_session_id");
    const vc = metas("ViewContent")[0];
    expect(vc[1]).toMatchObject({ content_name: "funil_e_somatorio" });
    expect(vc[1]).not.toHaveProperty("value"); // Meta nunca vê valor de somatório
    await waitFor(() => expect(invocacoes("venda-capi")[0]).toMatchObject({ evento: "ViewContent", event_id: vc[2] }));
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-funile]')).toBeNull();
    // 2ª montagem na MESMA sessão: sem novo view
    montar();
    expect(eventos("view")).toHaveLength(1);
    expect(metas("ViewContent")).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- T1 · a ferramenta */
describe("a ferramenta (T1)", () => {
  it("o total é a conta EXATA da seleção, vivo a cada toque; CTA travado sem seleção; outra soma; desmarcar tira", () => {
    montar();
    const total = () => screen.getByTestId("funile-total-numero").textContent;
    expect(total()).toBe(brl(0));
    expect(screen.getByTestId("funile-ver-total")).toBeDisabled();
    fireEvent.click(screen.getByTestId("funile-servico-netflix")); // 44,90
    expect(total()).toBe(brl(44.9));
    fireEvent.click(screen.getByTestId("funile-servico-spotify")); // 21,90
    expect(total()).toBe(brl(66.8));
    fireEvent.click(screen.getByTestId("funile-outra-19_9")); // academia & cia
    expect(total()).toBe(brl(86.7));
    expect(screen.getByTestId("funile-ver-total")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("funile-extra-0")); // tira a "outra"
    expect(total()).toBe(brl(66.8));
    fireEvent.click(screen.getByTestId("funile-servico-netflix")); // desmarca
    expect(total()).toBe(brl(21.9));
    // cada toque vira evento (a régua do funil), SEM valores pro Meta
    expect(eventos("toque")[0]).toMatchObject({ servico: "netflix", on: true });
    expect(eventos("outra")[0]).toMatchObject({ valor: 19.9 });
    expect(metas("Lead")).toHaveLength(0);
  });

  it("o estado sobrevive ao recarregamento (localStorage) e o voltar do resultado preserva a seleção", async () => {
    await ateResultado();
    fireEvent.click(screen.getByTestId("funile-voltar"));
    await waitFor(() => expect(passo()).toBe("ferramenta"));
    expect(screen.getByTestId("funile-servico-netflix").hasAttribute("data-on")).toBe(true);
    expect(screen.getByTestId("funile-total-numero").textContent).toBe(brl(66.8));
    cleanup();
    _zerarEstadoFunile(); // heap zerado: vale o localStorage
    montar();
    expect(passo()).toBe("ferramenta");
    expect(screen.getByTestId("funile-total-numero").textContent).toBe(brl(66.8));
  });
});

/* ---------------------------------------------------------------- T2 · o resultado */
describe("o resultado (T2)", () => {
  it("o número grande, o ano, o cupom; funile_resultado com faixa (não valor) + Lead SEM valor pro Meta", async () => {
    await ateResultado();
    expect(screen.getByTestId("funile-numero").textContent).toBe(brl(66.8));
    expect(screen.getByTestId("funile-numero-ano").textContent).toContain(brl(801.6));
    expect(screen.getByTestId("funile-item-netflix").textContent).toContain("44,90");
    expect(screen.getByTestId("funile-item-spotify").textContent).toContain("21,90");
    const r = eventos("resultado")[0];
    expect(r).toMatchObject({ n: 2, mes: 66.8, faixa: "ate_100" });
    await waitFor(() => expect(invocacoes("venda-capi").find((b) => b.evento === "Lead")).toMatchObject({ evento: "Lead", valor: null, conteudo: "funil_e_somatorio" }));
  });

  it("'qual você NÃO usou?' liga a economia exata e a lista de cancelamento; desmarcou o serviço na ferramenta, sai das não-usadas", async () => {
    await ateResultado();
    expect(screen.queryByTestId("funile-economia")).toBeNull();
    fireEvent.click(screen.getByTestId("funile-nao-netflix"));
    expect(screen.getByTestId("funile-economia").textContent).toContain(brl(44.9));
    expect(screen.getByTestId("funile-economia").textContent).toContain(brl(538.8));
    expect(screen.getByTestId("funile-lista-itens").textContent).toContain("Netflix");
    fireEvent.click(screen.getByTestId("funile-nao-spotify"));
    expect(screen.getByTestId("funile-economia").textContent).toContain(brl(66.8));
    // desmarca o spotify das "não usei": volta a economia da Netflix só
    fireEvent.click(screen.getByTestId("funile-nao-spotify"));
    expect(eventos("nao_usada").filter((e) => e.servico === "spotify")).toHaveLength(2);
  });

  it("o e-mail da lista: inválido não grava; válido grava no estado e vira o e-mail inicial dos dados", async () => {
    await ateResultado();
    fireEvent.change(screen.getByTestId("funile-email-campo"), { target: { value: "nao-eh-email" } });
    fireEvent.click(screen.getByTestId("funile-email-cta"));
    expect(eventos("email")).toHaveLength(0);
    expect(screen.queryByTestId("funile-email-ok")).toBeNull();
    fireEvent.change(screen.getByTestId("funile-email-campo"), { target: { value: "Ana@Exemplo.com" } });
    fireEvent.click(screen.getByTestId("funile-email-cta"));
    expect(eventos("email")).toHaveLength(1);
    expect(screen.getByTestId("funile-email-ok")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("funile-seguir"));
    await waitFor(() => expect(passo()).toBe("preco"));
    fireEvent.click(screen.getByTestId("funile-pagar-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect((screen.getByTestId("venda-email") as HTMLInputElement).value).toBe("ana@exemplo.com");
  });

  it("'não pago nenhuma': variante zero, sem âncora no preço, e o mesmo plano", async () => {
    montar();
    fireEvent.click(screen.getByTestId("funile-sem-assinatura"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    expect(screen.getByTestId("funile-resultado").hasAttribute("data-zero")).toBe(true);
    expect(eventos("sem_assinatura")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("funile-seguir-zero"));
    await waitFor(() => expect(passo()).toBe("preco"));
    expect(screen.queryByTestId("funile-ancora")).toBeNull();
    expect(screen.getByTestId("funile-preco-numero").textContent).toBe("R$ 97,90");
  });
});

/* ---------------------------------------------------------------- T3 · o preço */
describe("o preço (T3)", () => {
  it("a âncora usa o número DELA: a não-usada mais cara ≥ 1 ano de CORE", async () => {
    await atePreco();
    expect(screen.getByTestId("funile-ancora").textContent).toBe("Cancelar a Netflix que você nem usou já paga 5,5 anos de CORE.");
    expect(screen.getByTestId("funile-preco-numero").textContent).toBe("R$ 97,90");
    expect(texto()).toContain("dá R$ 8,16 por mês");
    // FAQ: a objeção do extrato respondida sem prometer o que o app não faz
    expect(texto()).toContain("Nada de senha de banco, extrato ou Open Finance");
  });

  it("sem não-usada e total ≥ o ano: a âncora é o total por mês × o preço por ano", async () => {
    montar();
    fireEvent.click(screen.getByTestId("funile-servico-chatgpt")); // 100
    fireEvent.click(screen.getByTestId("funile-servico-netflix")); // 44,90 → 144,90/mês
    fireEvent.click(screen.getByTestId("funile-ver-total"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    fireEvent.click(screen.getByTestId("funile-seguir"));
    await waitFor(() => expect(passo()).toBe("preco"));
    expect(screen.getByTestId("funile-ancora").textContent).toBe(`Você paga ${brl(144.9)} por MÊS em assinaturas. O CORE é ${brl(PRECO_CORE_ANUAL)} por ANO.`);
  });

  it("total abaixo do ano e sem não-usada: sem âncora (a linha do 8,16/mês trabalha)", async () => {
    montar();
    fireEvent.click(screen.getByTestId("funile-servico-icloud")); // 3,90
    fireEvent.click(screen.getByTestId("funile-ver-total"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    fireEvent.click(screen.getByTestId("funile-seguir"));
    await waitFor(() => expect(passo()).toBe("preco"));
    expect(screen.queryByTestId("funile-ancora")).toBeNull();
  });

  it("toque no Pix: funile_pagar_click + InitiateCheckout (97,90 fixo, nunca o somatório)", async () => {
    await atePreco();
    fireEvent.click(screen.getByTestId("funile-pagar-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    expect(eventos("pagar_click")[0]).toMatchObject({ metodo: "pix", valor: 97.9 });
    const ic = metas("InitiateCheckout")[0];
    expect(ic[1]).toMatchObject({ value: 97.9, currency: "BRL", content_name: "core_anual_web" });
    expect(ic[1]).not.toHaveProperty("total_mes");
    await waitFor(() => expect(invocacoes("venda-capi").find((b) => b.evento === "InitiateCheckout")).toMatchObject({ valor: 97.9 }));
  });

  it("sem o link da Cakto, o botão do cartão some (o Pix fica)", async () => {
    vi.stubEnv("VITE_VENDA_CAKTO_ANUAL", "");
    await atePreco();
    expect(screen.getByTestId("funile-pagar-pix")).toBeInTheDocument();
    expect(screen.queryByTestId("funile-pagar-cartao")).toBeNull();
  });
});

/* ---------------------------------------------------------------- dados → Pix → sucesso (o rabo da /assinar) */
describe("dados → Pix → sucesso", () => {
  it("nome + e-mail → conta (anônima + e-mail, com a seleção em texto) → QR a97 → pago → funile_pago + sucesso", async () => {
    invoke.mockImplementation(async (fn: string, opts: { body: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts.body.action === "create") return { data: PIX_OK, error: null };
      if (fn === "asaas-pix" && opts.body.action === "check") return { data: { paid: true }, error: null };
      if (fn === "porta-handoff") return { data: { codigo: "ABCDEFGHJK", email_enviado: true }, error: null };
      if (fn === "check-subscription") return { data: { subscribed: true, subscription_end: "2027-10-15T12:00:00Z" }, error: null };
      return { data: null, error: null };
    });
    await atePreco();
    fireEvent.click(screen.getByTestId("funile-pagar-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Ana Souza", "Ana@Exemplo.com");
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("pix"));
    expect(definirEmailDaCompra).toHaveBeenCalledWith("ana@exemplo.com");
    // a venda na conta: a SELEÇÃO em texto (servicos, nao_usadas, totais) + a campanha
    const dados = updateUser.mock.calls.map((c) => (c[0] as { data?: Record<string, unknown> }).data).find((d) => d?.venda) as Record<string, unknown>;
    const venda = dados.venda as { plano: string; respostas: Record<string, string | null> };
    expect(venda.plano).toBe("anual");
    expect(venda.respostas.funil).toBe("funil-e-soma-assinaturas");
    expect(venda.respostas.servicos).toContain("netflix");
    expect(venda.respostas.nao_usadas).toContain("Netflix");
    expect(venda.respostas.total_mes).toBe("66.8");
    // o QR na página, oferta a97
    await waitFor(() => expect(screen.getByTestId("venda-pix-codigo").textContent).toBe(PIX_OK.qrCode));
    expect(invocacoes("asaas-pix")[0]).toMatchObject({ action: "create", offer: "a97" });
    // pago → sucesso com o e-mail e o código do "abrir o app já logado"
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 5000 });
    expect(eventos("pago")[0]).toMatchObject({ plano: "anual", metodo: "pix", valor: 97.9 });
    expect(screen.getByTestId("venda-sucesso-email").textContent).toBe("ana@exemplo.com");
    await waitFor(() => expect(invocacoes("porta-handoff")[0]).toMatchObject({ acao: "criar", metodo: "codigo" }));
  });

  it("já assinante com o mesmo e-mail neste navegador: 'você já é assinante', SEM gerar Pix", async () => {
    authState.user = { id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {} };
    authState.isSubscribed = true;
    await atePreco();
    fireEvent.click(screen.getByTestId("funile-pagar-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Ana", "ana@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    expect(eventos("ja_assinante")[0]).toMatchObject({ via: "sessao" });
    expect(screen.getByTestId("venda-sucesso-selo").textContent).toBe("Você já é assinante");
    expect(eventos("pago")).toHaveLength(0);
  });

  it("e-mail que já tem conta: pede a senha ANTES do Pix — nunca 2ª conta", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    signInWithPassword.mockResolvedValue({ error: null });
    invoke.mockImplementation(async (fn: string, opts: { body?: Record<string, unknown> }) =>
      fn === "check-subscription" ? { data: { subscribed: false }, error: null }
        : fn === "asaas-pix" && opts.body?.action === "create" ? { data: PIX_OK, error: null } : { data: null, error: null });
    await atePreco();
    fireEvent.click(screen.getByTestId("funile-pagar-pix"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Bia", "bia@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(screen.getByTestId("venda-dados").getAttribute("data-fase")).toBe("existe"));
    expect(invocacoes("asaas-pix")).toHaveLength(0);
    fireEvent.change(screen.getByTestId("venda-senha"), { target: { value: "segredo1" } });
    fireEvent.click(screen.getByTestId("venda-entrar"));
    await waitFor(() => expect(passo()).toBe("pix"));
    await waitFor(() => expect(invocacoes("asaas-pix")[0]).toMatchObject({ offer: "a97" }));
  });
});

/* ---------------------------------------------------------------- cartão (Cakto) */
describe("cartão (Cakto)", () => {
  it("vai pra Cakto com e-mail/nome + utm/fbclid (funile_cakto_redirect); nunca gera Pix", async () => {
    await atePreco();
    fireEvent.click(screen.getByTestId("funile-pagar-cartao"));
    await waitFor(() => expect(passo()).toBe("dados"));
    preencher("Ana Souza", "ana@exemplo.com");
    fireEvent.click(screen.getByTestId("venda-dados-cta"));
    await waitFor(() => expect(passo()).toBe("cartao"));
    await waitFor(() => expect(irProCakto).toHaveBeenCalled(), { timeout: 2000 });
    const url = new URL(vi.mocked(irProCakto).mock.calls[0][0]);
    expect(`${url.origin}${url.pathname}`).toBe("https://pay.cakto.com.br/anu4l97");
    expect(url.searchParams.get("email")).toBe("ana@exemplo.com");
    expect(url.searchParams.get("utm_campaign")).toBe("funil_e");
    expect(url.searchParams.get("fbclid")).toBe("IwAR_abc");
    expect(beacons("funile_cakto_redirect")[0]).toMatchObject({ plano: "anual", valor: 97.9 });
    expect(invocacoes("asaas-pix")).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------- regras do código */
describe("regras", () => {
  const pasta = join(process.cwd(), "src/pages/funil-e");
  const fontes = readdirSync(pasta).map((f) => [f, readFileSync(join(pasta, f), "utf8")] as const);

  it("área de transferência PROIBIDA neste funil (a do PixVenda reusado é a dele, só no toque)", () => {
    for (const [, s] of fontes) {
      expect(s).not.toMatch(/clipboard\.read|readText/);
      expect(s).not.toMatch(/clipboard\.writeText/);
    }
  });

  it("a oferta é a97 em tudo: preço na copy = PRECO_CORE_ANUAL = 97,90", () => {
    const conteudo = fontes.find(([f]) => f === "conteudo.ts")![1];
    expect(conteudo).toContain("R$ 97,90");
    expect(PRECO_CORE_ANUAL).toBe(97.9);
  });

  it("a grade: ids únicos, preços > 0, todo serviço tem plano (o cupom mostra)", () => {
    const ids = SERVICOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SERVICOS) {
      expect(s.preco).toBeGreaterThan(0);
      expect(s.plano.length).toBeGreaterThan(0);
      expect(s.emoji.length).toBeGreaterThan(0);
    }
  });

  it("nada de segredo: nenhum token/chave hardcoded nos fontes do funil", () => {
    for (const [, s] of fontes) {
      expect(s).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT
      expect(s).not.toMatch(/sk_live|pk_live|asaas_[a-z0-9]{20,}/i);
    }
  });
});
