/**
 * PIX ADIANTADO (26/09, dono: "faz isso da cakto adiantado"). Com o paywall da
 * web visível há 1,5 s, o Pix da w27 nasce na Cakto em segundo plano. No toque:
 * pronto → QR na hora; em voo → espera o MESMO pedido; falhou/venceu → caminho
 * de sempre. pix_generated só sai com o QR na tela.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

type Resp = { data: any; error: any };

const m = vi.hoisted(() => ({
  invoke: vi.fn(),
  track: vi.fn(),
  beacon: vi.fn(),
  mark: vi.fn(),
  garantir: vi.fn(),
  emailRede: vi.fn(),
  sessao: null as null | { user: { id: string; email: string | null } },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: {
      getUser: async () => ({ data: { user: m.sessao?.user ?? null } }),
      getSession: async () => ({ data: { session: m.sessao } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: m.garantir,
  anonimoLigado: async () => false,
  emailDaSessao: m.emailRede,
  definirEmailDaCompra: vi.fn(),
  entrarNaContaExistente: vi.fn(),
  marcarBatismoSeSemEmail: async () => {},
  guardarCompraAnonima: vi.fn(),
  limparBatismo: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, trackEventBeacon: m.beacon, getAttributionParams: () => ({}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/funnel", async (orig) => ({ ...(await orig()), isInAppBrowser: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: m.sessao?.user ?? null }) }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: m.mark, firePixPurchaseOnce: vi.fn() }));

import { PixCheckout, aquecerCheckoutPix, prepararPixAdiantado } from "@/components/paywall/PixCheckout";

const MIN = 60_000;
const qr = (id: string, restaMs: number | null = 30 * MIN): Resp => ({
  data: { orderId: id, qrCode: `000201${id}`, amount: "27.9", expiresAt: null, restaMs },
  error: null,
});
const erroHttp = (): Resp => ({ data: null, error: new Error("Edge Function returned a non-2xx status code") });

let aquecido: Record<string, unknown>;
let noAdiantado: () => Resp | Promise<Resp>;
let noToque: () => Resp | Promise<Resp>;

/** Pedidos de criação na cakto-pix (sem contar aquecimento). */
const criacoes = (tipo?: "adiantado" | "toque") =>
  m.invoke.mock.calls.filter((c) => c[0] === "cakto-pix" && !c[1]?.body?.warm
    && (tipo === undefined || (tipo === "adiantado") === (c[1]?.body?.adiantado === true))).length;
const asaas = () => m.invoke.mock.calls.filter((c) => c[0] === "asaas-pix" && c[1]?.body?.action === "create").length;
const eventos = (nome: string) => m.track.mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);
const adiantadoCom = (status: string) => eventos("pix_adiantado").filter((e) => e.status === status);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const botaoCopiar = () => screen.queryByRole("button", { name: /Copiar código Pix/i });

/** Paywall aberto: aquece e arma o adiantado (prazo curto no teste). */
const abrirPaywall = (aposMs = 10) => {
  aquecerCheckoutPix(m.sessao?.user.id, "w27");
  return prepararPixAdiantado("w27", { aposMs });
};
const tocarEPagar = () => render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/inicio");
  m.sessao = { user: { id: "u1", email: "ana@gmail.com" } };
  m.garantir.mockResolvedValue("ja-tinha");
  m.emailRede.mockResolvedValue("ana@gmail.com");
  aquecido = { ok: true, ativa: true, adiantar: true };
  noAdiantado = () => qr("nao-devia-adiantar");
  noToque = () => qr("nao-devia-no-toque");
  m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
    const b = opts?.body ?? {};
    if (fn === "cakto-pix" && b.warm) return { data: aquecido, error: null };
    if (fn === "cakto-pix" && b.adiantado === true) return noAdiantado();
    if (fn === "cakto-pix") return noToque();
    if (fn === "asaas-pix" && b.action === "create") return qr("pay_asaas_1");
    if (fn === "check-subscription") return { data: { subscribed: false }, error: null };
    return { data: { paid: false }, error: null };
  });
});

describe("Pix adiantado no paywall da web", () => {
  it("pronto: o QR aparece na hora, sem 2º pedido — e nada de evento de venda antes do toque", async () => {
    noAdiantado = () => qr("uuid-adiantado-1");
    const paywall = abrirPaywall();
    await waitFor(() => expect(criacoes("adiantado")).toBe(1));
    await esperar(30);
    // Só o pedido existe: nenhum evento de venda enquanto a pessoa só lê a oferta.
    expect(eventos("pix_generated")).toHaveLength(0);
    expect(m.mark).not.toHaveBeenCalled();
    const corpo = m.invoke.mock.calls.find((c) => c[1]?.body?.adiantado)?.[1]?.body;
    expect(corpo).toMatchObject({ offer: "w27", adiantado: true });
    expect(corpo?.customer?.docNumber).toBeUndefined(); // não inventa CPF

    paywall.tocou();
    tocarEPagar();
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 3000 });
    expect(criacoes()).toBe(1); // só o adiantado — o toque não criou outro
    expect(asaas()).toBe(0);
    const gerado = eventos("pix_generated");
    expect(gerado).toHaveLength(1);
    expect(gerado[0]).toMatchObject({ order_id: "uuid-adiantado-1", gateway: "cakto", braco: "cakto", adiantado: true });
    // "Na hora": sem a espera mínima de 900 ms da preparação.
    expect(gerado[0].espera_ms).toBeGreaterThanOrEqual(0);
    expect(gerado[0].espera_ms).toBeLessThan(900);
    expect(adiantadoCom("ok")).toEqual([expect.objectContaining({ order_id: "uuid-adiantado-1", pronto: true })]);
    expect(m.mark).toHaveBeenCalledWith({ offer: "w27", orderId: "uuid-adiantado-1" });
    expect(m.emailRede).not.toHaveBeenCalled(); // e-mail veio da sessão local, sem ida à rede
    paywall.parar();
    expect(adiantadoCom("nao_usado")).toHaveLength(0);
  });

  it("em voo: o toque espera o MESMO pedido, sem criar outro", async () => {
    let solta: (r: Resp) => void = () => {};
    noAdiantado = () => new Promise<Resp>((r) => { solta = r; });
    const paywall = abrirPaywall();
    await waitFor(() => expect(criacoes("adiantado")).toBe(1));
    paywall.tocou();
    tocarEPagar();
    await esperar(400);
    expect(criacoes()).toBe(1);
    expect(botaoCopiar()).not.toBeInTheDocument();
    expect(screen.getByTestId("preparo-1").dataset.marcado).toBe("0");
    solta(qr("uuid-adiantado-2"));
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 3000 });
    expect(criacoes()).toBe(1);
    expect(asaas()).toBe(0);
    expect(eventos("pix_generated")[0]).toMatchObject({ order_id: "uuid-adiantado-2", adiantado: true });
    expect(adiantadoCom("ok")).toEqual([expect.objectContaining({ pronto: false })]);
    paywall.parar();
  });

  it("em voo e falha enquanto a pessoa espera: o Pix sai pela Asaas, sem 2º pedido na Cakto", async () => {
    let solta: (r: Resp) => void = () => {};
    noAdiantado = () => new Promise<Resp>((r) => { solta = r; });
    const paywall = abrirPaywall();
    await waitFor(() => expect(criacoes("adiantado")).toBe(1));
    paywall.tocou();
    tocarEPagar();
    await esperar(100);
    solta(erroHttp());
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 3000 });
    expect(criacoes()).toBe(1);
    expect(asaas()).toBe(1);
    expect(eventos("pix_fallback")[0]).toMatchObject({ de: "cakto", para: "asaas", adiantado: true });
    expect(eventos("pix_generated")[0]).toMatchObject({ gateway: "asaas", braco: "cakto", adiantado: false, order_id: "pay_asaas_1" });
    expect(adiantadoCom("falhou")).toEqual([expect.objectContaining({ esperando: true })]);
    paywall.parar();
  });

  it("falhou antes do toque: o toque segue o caminho de sempre (Cakto no toque)", async () => {
    noAdiantado = erroHttp;
    noToque = () => qr("uuid-toque-3");
    const paywall = abrirPaywall();
    await waitFor(() => expect(adiantadoCom("falhou")).toHaveLength(1));
    expect(adiantadoCom("falhou")[0]).toMatchObject({ esperando: false });
    paywall.tocou();
    tocarEPagar();
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 6000 });
    expect(criacoes("adiantado")).toBe(1);
    expect(criacoes("toque")).toBe(1);
    expect(asaas()).toBe(0);
    expect(eventos("pix_generated")[0]).toMatchObject({ order_id: "uuid-toque-3", gateway: "cakto", adiantado: false });
    paywall.parar();
    expect(adiantadoCom("nao_usado")).toHaveLength(0);
  });

  it("vencido (o QR da Cakto não teria folga pra pagar): o toque gera outro", async () => {
    noAdiantado = () => qr("uuid-velho", 10 * MIN); // vence em 10 min < 15 min de folga
    noToque = () => qr("uuid-novo");
    const paywall = abrirPaywall();
    await waitFor(() => expect(criacoes("adiantado")).toBe(1));
    await esperar(30);
    paywall.tocou();
    tocarEPagar();
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 6000 });
    expect(adiantadoCom("expirou")).toEqual([expect.objectContaining({ order_id: "uuid-velho" })]);
    expect(criacoes("toque")).toBe(1);
    expect(eventos("pix_generated")[0]).toMatchObject({ order_id: "uuid-novo", adiantado: false });
    paywall.parar();
  });

  it("outra conta no toque: não mostra o Pix da conta anterior", async () => {
    noAdiantado = () => qr("uuid-da-u1");
    noToque = () => qr("uuid-da-u2");
    const paywall = abrirPaywall();
    await waitFor(() => expect(criacoes("adiantado")).toBe(1));
    await esperar(30);
    m.sessao = { user: { id: "u2", email: "bia@gmail.com" } };
    paywall.tocou();
    tocarEPagar();
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 6000 });
    expect(eventos("pix_generated")[0]).toMatchObject({ order_id: "uuid-da-u2", adiantado: false });
    paywall.parar();
    expect(adiantadoCom("nao_usado")).toEqual([expect.objectContaining({ order_id: "uuid-da-u1" })]);
  });

  it("saiu do paywall sem tocar: nao_usado (por beacon se a página fechou) e nenhum pix_generated", async () => {
    noAdiantado = () => qr("uuid-ninguem-viu");
    const paywall = abrirPaywall();
    await waitFor(() => expect(criacoes("adiantado")).toBe(1));
    await esperar(30);
    window.dispatchEvent(new Event("pagehide"));
    expect(m.beacon).toHaveBeenCalledWith("pix_adiantado", expect.objectContaining({ status: "nao_usado", order_id: "uuid-ninguem-viu" }));
    paywall.parar(); // desmontar depois não repete
    expect(m.beacon).toHaveBeenCalledTimes(1);
    expect(adiantadoCom("nao_usado")).toHaveLength(0);
    expect(eventos("pix_generated")).toHaveLength(0);
    expect(m.mark).not.toHaveBeenCalled();
  });
});

describe("quando NÃO adianta", () => {
  it("disjuntor aberto (aquecimento diz ativa:false)", async () => {
    aquecido = { ok: true, ativa: false, adiantar: true };
    const paywall = abrirPaywall();
    await esperar(150);
    expect(criacoes()).toBe(0);
    paywall.parar();
    // devolve o disjuntor fechado pros próximos testes (o estado é do módulo)
    aquecido = { ok: true, ativa: true, adiantar: true };
    aquecerCheckoutPix("u1", "w27");
    await esperar(20);
  });

  it("função antiga (aquecimento sem `adiantar`) ou desligada (adiantar:false)", async () => {
    aquecido = { ok: true, ativa: true };
    let paywall = abrirPaywall();
    await esperar(150);
    paywall.parar();
    aquecido = { ok: true, ativa: true, adiantar: false };
    paywall = abrirPaywall();
    await esperar(150);
    paywall.parar();
    expect(criacoes()).toBe(0);
  });

  it("tocou antes do prazo (1,5 s): nenhum pedido a mais", async () => {
    const paywall = abrirPaywall(120);
    await esperar(40);
    paywall.tocou();
    await esperar(250);
    expect(criacoes()).toBe(0);
    paywall.parar();
  });

  it("sem sessão (a anônima só nasce no toque)", async () => {
    m.sessao = null;
    const paywall = abrirPaywall();
    await esperar(150);
    expect(criacoes()).toBe(0);
    paywall.parar();
  });

  it("assinante não ganha pedido", async () => {
    aquecerCheckoutPix("u1", "w27");
    const paywall = prepararPixAdiantado("w27", { aposMs: 10, podeAdiantar: () => false });
    await esperar(150);
    expect(criacoes()).toBe(0);
    paywall.parar();
  });

  it("oferta fora da Cakto (lifetime, 97,90 na tela) nunca adianta", async () => {
    aquecerCheckoutPix("u1", "lifetime");
    const paywall = prepararPixAdiantado("lifetime", { aposMs: 10 });
    await esperar(150);
    expect(criacoes()).toBe(0);
    paywall.parar();
  });
});

describe("sessão no mount do checkout (26/09)", () => {
  it("a sessão começa a nascer no toque, junto da checagem de e-mail, e o 1º Pix usa ESSA", async () => {
    m.sessao = null;
    m.garantir.mockResolvedValue("anonima");
    let soltaEmail: (v: string | null) => void = () => {};
    m.emailRede.mockImplementation(() => new Promise((r) => { soltaEmail = r; }));
    aquecido = { ok: true, ativa: true, adiantar: false };
    noToque = () => qr("uuid-anonimo");
    tocarEPagar();
    await esperar(50);
    // o e-mail ainda nem voltou e a sessão já está sendo aberta
    expect(m.garantir).toHaveBeenCalledTimes(1);
    soltaEmail(null);
    await waitFor(() => expect(botaoCopiar()).toBeInTheDocument(), { timeout: 6000 });
    expect(m.garantir).toHaveBeenCalledTimes(1); // o generate reaproveitou a mesma
    expect(eventos("pix_sessao_anonima")).toHaveLength(1);
    expect(eventos("pix_generated")[0]).toMatchObject({ order_id: "uuid-anonimo", adiantado: false });
  });
});
