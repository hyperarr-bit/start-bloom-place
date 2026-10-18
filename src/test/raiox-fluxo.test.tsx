/**
 * Fluxo do Raio-X com a chave ligada no teste (o arquivo entregue continua "off").
 * Pix mockado. Nenhum lançamento sai antes do sucesso com o checkbox marcado.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/raiox", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/raiox")>();
  return { ...real, RAIOX: "on" as const, RAIOX_DEMO: "ab" as const };
});

const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = {
  user: null, loading: false, isSubscribed: false,
};
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const invoke = vi.fn();
const upserts: unknown[] = [];
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
      verifyOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      upsert: (row: unknown) => { upserts.push(row); return Promise.resolve({ error: null }); },
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
import RaioXRota from "@/pages/raiox/RaioX";
import { _zerarEstadoRaiox } from "@/pages/raiox/estado";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { PRECO_DESTAQUE, GARANTIA } from "@/pages/raiox/conteudo";

const PIX_OK = { orderId: "qr_raiox", qrCode: "00020126580014br.gov.bcb.pix", qrCodeBase64: null, expiresAt: null };
const QUERY = "?utm_source=meta&utm_medium=paid&utm_campaign=120250&utm_content=ad9&adset=as3&fbclid=IwAR_abc";

const irPara = (url: string) => window.history.replaceState({}, "", url);
const passo = () => screen.getByTestId("raiox").getAttribute("data-passo");
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const fbq = vi.fn();
const metas = (nome: string) => vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === nome);
const leads = () => fbq.mock.calls.filter((c) => c[0] === "track" && c[1] === "Lead");
const invocacoes = (fn: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body);

const montar = (query = `${QUERY}&demo=1`) => {
  irPara(`/raio-x${query}`);
  return render(<RaioXRota />);
};

const responder = async (indice: number, proximo: string) => {
  fireEvent.click(screen.getByTestId(`raiox-opcao-${indice}`));
  await waitFor(() => expect(passo()).toBe(proximo), { timeout: 4000 });
};

const ateResultado = async (query?: string) => {
  montar(query);
  expect(screen.getByTestId("raiox-pergunta").textContent).toMatch(/delivery/i);
  expect(screen.getByTestId("raiox-promessa").textContent).toMatch(/30 segundos/);
  expect(screen.getByTestId("raiox-rodape").textContent).toBe("Sem cadastro. Grátis.");
  await responder(1, "q2");
  await responder(1, "q3");
  await responder(0, "q4");
  await responder(1, "q5");
  await responder(1, "resultado");
};

const pixPago = () => {
  invoke.mockImplementation(async (fn: string, opts: { body?: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && opts.body?.action === "create") return { data: PIX_OK, error: null };
    if (fn === "asaas-pix" && opts.body?.action === "check") return { data: { paid: true }, error: null };
    if (fn === "porta-handoff") return { data: { codigo: "ABCDEFGHJK", email_enviado: true }, error: null };
    if (fn === "check-subscription") return { data: { subscribed: false }, error: null };
    return { data: null, error: null };
  });
};

const seguirPix = async () => {
  fireEvent.change(screen.getByTestId("raiox-pix-email"), { target: { value: "ana@exemplo.com" } });
  fireEvent.click(screen.getByTestId("raiox-pix-seguir"));
  await waitFor(() => expect(screen.getByTestId("venda-pix-codigo").textContent).toContain("00020126"), { timeout: 4000 });
};

const SEGREDO = "IFOOD PEDIDO SECRETO XYZ";
const br = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

beforeEach(() => {
  _zerarEstadoRaiox();
  _zerarMemoriaPorta();
  upserts.length = 0;
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null;
  authState.isSubscribed = false;
  [getSession, getUser, updateUser, signOut, signUp, signInWithPassword, invoke, definirEmailDaCompra].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  fbq.mockClear();
  window.fbq = fbq;
  getSession.mockResolvedValue({ data: { session: null } });
  getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "ana@exemplo.com", user_metadata: {} } } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  invoke.mockResolvedValue({ data: null, error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1", configurable: true });
});
afterEach(() => { cleanup(); irPara("/"); });

describe("quiz até o Pix", () => {
  it("Q1 já é a pergunta, e o preço é Pix único sem cartão", async () => {
    pixPago();
    await ateResultado();
    expect(screen.getByTestId("raiox-numero").textContent).toMatch(/R\$\s*585/);
    expect(screen.getByTestId("raiox-ano").textContent).toMatch(/7\.020/);
    expect(screen.getByTestId("raiox").getAttribute("data-fonte")).toBe("estimativa");
    expect(eventos("raiox_view")[0]).toMatchObject({ utm_campaign: "120250", fbclid: "IwAR_abc", ad_id: "ad9", adset_id: "as3", campaign_id: "120250", variante_demo: "com" });
    expect(metas("ViewContent").length).toBeGreaterThan(0);
    expect(eventos("raiox_quiz_completo")[0]).toMatchObject({ variante_demo: "com" });
    expect(eventos("raiox_resultado")[0]).toMatchObject({ fonte: "estimativa", n_vazamentos: 4 });
    expect(eventos("raiox_resultado")[0]).not.toHaveProperty("vazou_mes");
    expect(leads().length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("raiox-cta-escolha"));
    await waitFor(() => expect(passo()).toBe("escolha"));
    fireEvent.click(screen.getByTestId("raiox-escolha-delivery"));
    await waitFor(() => expect(passo()).toBe("demo"), { timeout: 2000 });
    expect(eventos("raiox_demo_view")[0]).toMatchObject({ chave: "delivery", variante_demo: "com" });
    await waitFor(() => expect(screen.getByTestId("raiox-demo-pular")).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByTestId("raiox-demo-pular"));
    await waitFor(() => expect(passo()).toBe("plano_preco"));
    expect(eventos("raiox_demo_pulou")[0]).toMatchObject({ chave: "delivery" });
    expect(screen.getByTestId("raiox-preco-valor").textContent).toBe(PRECO_DESTAQUE);
    expect(screen.getByTestId("raiox-garantia").textContent).toBe(GARANTIA);
    expect(screen.getByTestId("raiox-ancora").textContent).toMatch(/10 dias/);
    expect(document.body.textContent).not.toMatch(/12x|Cakto|parcel/i);

    fireEvent.click(screen.getByTestId("raiox-cta-pix"));
    await waitFor(() => expect(passo()).toBe("pix"));
    expect(eventos("raiox_pagar_click")[0]).toMatchObject({ metodo: "pix" });
    expect(metas("InitiateCheckout")[0][1]).toMatchObject({ value: 97.9, currency: "BRL" });
    await seguirPix();
    expect(invocacoes("asaas-pix")[0]).toMatchObject({ action: "create", offer: "a97" });
    expect(definirEmailDaCompra).toHaveBeenCalledWith("ana@exemplo.com");
    const venda = updateUser.mock.calls.map((c) => (c[0] as { data?: { venda?: Record<string, unknown> } }).data?.venda).find(Boolean);
    expect(venda).toMatchObject({ variante: "raiox", variante_demo: "com", fbclid: "IwAR_abc", ad_id: "ad9", adset_id: "as3", campaign_id: "120250", utm_campaign: "120250" });
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 8000 });
    expect(eventos("venda_pago")[0]).toMatchObject({ oferta: "a97", metodo: "pix", valor: 97.9, order_id: "qr_raiox", raiox: true, variante_demo: "com" });
    expect(screen.getByTestId("raiox-sucesso-email").textContent).toBe("ana@exemplo.com");
    expect(screen.getByTestId("raiox-sucesso-titulo").textContent).toMatch(/liberado/);
    expect(screen.queryByTestId("raiox-consentir")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("raiox-abrir")).toHaveAttribute("href", "core://entrar?h=ABCDEFGHJK"));
    expect(screen.getByTestId("raiox-loja-ios")).toHaveAttribute("href", "/baixar?origem=raiox&loja=ios");
    expect(upserts).toHaveLength(0);
  }, 20000);

  it("?demo=0 pula a demo; ?demo=1 força", async () => {
    montar(`${QUERY}&demo=0`);
    await responder(1, "q2");
    await responder(1, "q3");
    await responder(0, "q4");
    await responder(1, "q5");
    await responder(1, "resultado");
    expect(screen.getByTestId("raiox").getAttribute("data-demo")).toBe("sem");
    fireEvent.click(screen.getByTestId("raiox-cta-escolha"));
    fireEvent.click(await screen.findByTestId("raiox-escolha-delivery"));
    await waitFor(() => expect(passo()).toBe("plano_preco"), { timeout: 2000 });
    expect(screen.queryByTestId("raiox-demo")).toBeNull();
    expect(eventos("raiox_demo_view")).toHaveLength(0);
  }, 15000);
});

describe("extrato opcional", () => {
  const csv = () => `data;valor;descricao\n${br(new Date())};-80,00;${SEGREDO}\n${br(new Date())};-40,00;NETFLIX.COM\n`;

  const subir = async () => {
    await ateResultado(`${QUERY}&demo=0`);
    fireEvent.click(screen.getByTestId("raiox-link-extrato"));
    await waitFor(() => expect(passo()).toBe("extrato"));
    const arquivo = new File([csv()], "extrato.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("raiox-arquivo"), { target: { files: [arquivo] } });
    await waitFor(() => expect(passo()).toBe("resultado"));
    expect(screen.getByTestId("raiox-selo").textContent).toMatch(/com os seus números/);
  };

  it("arquivo ruim volta pra estimativa sem travar", async () => {
    await ateResultado(`${QUERY}&demo=0`);
    fireEvent.click(screen.getByTestId("raiox-link-extrato"));
    const ruim = new File(["isto nao e extrato"], "nota.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("raiox-arquivo"), { target: { files: [ruim] } });
    await waitFor(() => expect(screen.getByTestId("raiox-extrato-erro").textContent).toMatch(/Não consegui ler/));
    fireEvent.click(screen.getByTestId("raiox-extrato-voltar"));
    await waitFor(() => expect(passo()).toBe("resultado"));
    expect(screen.getByTestId("raiox").getAttribute("data-fonte")).toBe("estimativa");
    expect(eventos("raiox_extrato_erro")[0]).toMatchObject({ motivo: "vazio" });
  }, 15000);

  it("não manda descrição antes do sucesso com consentimento", async () => {
    pixPago();
    await subir();
    const vazou = () => JSON.stringify({
      track: vi.mocked(trackEvent).mock.calls,
      meta: vi.mocked(fireMetaEvent).mock.calls,
      fbq: fbq.mock.calls,
      invoke: invoke.mock.calls,
      upserts,
    });
    expect(vazou()).not.toContain(SEGREDO);
    expect(eventos("raiox_extrato_lido")[0]).toMatchObject({ n_tx: 2 });
    expect(JSON.stringify(eventos("raiox_extrato_lido")[0])).not.toContain(SEGREDO);

    fireEvent.click(screen.getByTestId("raiox-cta-escolha"));
    fireEvent.click(await screen.findByTestId("raiox-escolha-delivery"));
    await waitFor(() => expect(passo()).toBe("plano_preco"));
    fireEvent.click(screen.getByTestId("raiox-cta-pix"));
    await seguirPix();
    expect(vazou()).not.toContain(SEGREDO);
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 8000 });
    expect(screen.getByTestId("raiox-consentir")).toBeChecked();
    await waitFor(() => expect(JSON.stringify(upserts)).toContain(SEGREDO), { timeout: 2000 });
    const gastos = upserts.find((u) => (u as { key?: string }).key === "finance-expenses") as { value: Array<{ id: string; description: string }> };
    expect(gastos.value[0].id).toMatch(/-e0$/);
    expect(gastos.value[0].description).toBe(SEGREDO);
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain(SEGREDO);
    expect(JSON.stringify(vi.mocked(fireMetaEvent).mock.calls)).not.toContain(SEGREDO);
    expect(JSON.stringify(fbq.mock.calls)).not.toContain(SEGREDO);
    expect(JSON.stringify(invoke.mock.calls)).not.toContain(SEGREDO);
    const meta = updateUser.mock.calls.map((c) => (c[0] as { data?: { raiox_meta?: Record<string, unknown> } }).data?.raiox_meta).find(Boolean);
    expect(JSON.stringify(meta)).not.toContain(SEGREDO);
    expect(meta).toMatchObject({ fonte: "extrato", escolha: "delivery" });
  }, 20000);

  it("checkbox desmarcado não grava lançamento", async () => {
    pixPago();
    await subir();
    fireEvent.click(screen.getByTestId("raiox-cta-escolha"));
    fireEvent.click(await screen.findByTestId("raiox-escolha-delivery"));
    await waitFor(() => expect(passo()).toBe("plano_preco"));
    fireEvent.click(screen.getByTestId("raiox-cta-pix"));
    await seguirPix();
    await waitFor(() => expect(passo()).toBe("sucesso"), { timeout: 8000 });
    fireEvent.click(screen.getByTestId("raiox-consentir"));
    expect(screen.getByTestId("raiox-consentir")).not.toBeChecked();
    await new Promise((r) => setTimeout(r, 800));
    expect(JSON.stringify(upserts)).not.toContain(SEGREDO);
  }, 20000);
});

describe("copy do pagamento", () => {
  it("a pasta do funil não cita Cakto, 12x nem a env do cartão", () => {
    const dir = join(process.cwd(), "src/pages/raiox");
    for (const nome of readdirSync(dir)) {
      if (!/\.(ts|tsx)$/.test(nome)) continue;
      const src = readFileSync(join(dir, nome), "utf8");
      expect(src, nome).not.toMatch(/VITE_VENDA_CAKTO/);
      expect(src, nome).not.toMatch(/linkDoCakto/);
      expect(src, nome).not.toMatch(/12x/);
      expect(src, nome).not.toMatch(/Cartão em até/);
    }
    expect(readFileSync(join(process.cwd(), "src/pages/raiox/recuperacao.ts"), "utf8")).toContain("ativo: false");
    expect(readFileSync(join(process.cwd(), "src/pages/raiox/RaioX.tsx"), "utf8")).not.toContain("recuperacao");
  });
});
