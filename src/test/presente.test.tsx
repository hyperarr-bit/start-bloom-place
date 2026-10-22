/**
 * UPSELL DE PRESENTE (21/10) — o lado do site, com a chave forçada por URL (`?presente=on`) e os servidores mockados.
 *   · chave OFF (padrão): o /hoje vitalício vai do Pix DIRETO pro pós-compra, como sempre — nada do presente aparece;
 *   · ON: pagou o vitalício → oferta (Quero presentear / Agora não) → Pix pv149 R$ 14,90 → cartão (nome, WhatsApp,
 *     Copiar link, código do servidor) → pós-compra com e-mail + lojas; o link do presente vai pro e-mail salvo;
 *   · "Agora não" → downsell do plano de 30 dias (só Dinheiro) → "Não, obrigado" (pós-compra) ou Pix pk99 → o kit
 *     na conta final;
 *   · a página /presente/<código>: quem deu, criar conta sem senha, resgate, lojas; já tem / usado / e-mail com conta;
 *   · eventos presente_* e plano30_*; copy sem "ele/ela".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const setSession = vi.fn();
const invoke = vi.fn();
const upserts: Array<unknown> = [];
let userDataExistente: Array<{ key: string; value: unknown }> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      setSession: (...a: unknown[]) => setSession(...a),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: (tabela: string) => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: tabela === "user_data" ? userDataExistente : [], error: null }) }) }),
      upsert: (linhas: unknown) => { upserts.push(linhas); return Promise.resolve({ error: null }); },
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
const garantirSessao = vi.fn();
const definirEmailDaCompra = vi.fn();
const guardarCompraAnonima = vi.fn(async () => {});
const vincularCompraAnonima = vi.fn(async (..._a: unknown[]) => true);
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: (...a: unknown[]) => garantirSessao(...a),
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: () => guardarCompraAnonima(),
  vincularCompraAnonima: (...a: unknown[]) => vincularCompraAnonima(...a),
  limparBatismo: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { markPixPurchasePending } from "@/lib/purchase-tracking";
import FunilHojeRota, { _zerarEstadoHoje, proximoPosCompra } from "@/pages/hoje/FunilHoje";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import { _forcarOfertaHoje, _zerarForcaHoje } from "@/pages/hoje/conteudo";
import ResgatePresenteRota from "@/pages/presente/ResgatePresente";
import {
  UPSELL_PRESENTE, DOWNSELL_PLANO30, _zerarEstadoPresente, _zerarForcaPresente, depoisDoAgoraNao, mensagemDoPresente, presenteLigado, temPlano30,
} from "@/lib/presente";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";

/* ---------------------------------------------------------------- ambiente */
const irPara = (url: string) => window.history.replaceState({}, "", url);
const montar = (url = "/hoje?funil-hoje=on&presente=on&utm_source=meta&utm_campaign=hoje&fbclid=IwAR_x") => {
  irPara(url);
  return render(
    <MemoryRouter initialEntries={["/hoje"]}>
      <Routes>
        <Route path="/hoje" element={<FunilHojeRota />} />
        <Route path="/" element={<div data-testid="landing">landing</div>} />
        <Route path="/financas" element={<div data-testid="financas">app</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const etapa = () => screen.getByTestId("hoje").getAttribute("data-etapa");
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const invocacoes = (fn: string, acao?: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body).filter((b) => !acao || b.action === acao);

/* a função presente-resgatar (mock): o código do pedido pago e o resgate */
let respostaVer: Record<string, unknown> = { ok: true, estado: "livre", de: "Ana" };
let respostaResgatar: Record<string, unknown> = { ok: true, r: "ok", de: "Ana" };
function presenteServidor(body: Record<string, unknown>): Record<string, unknown> {
  if (body.action === "meu") return { ok: true, codigo: "K7QM2XPA", de: null, resgatado: false };
  if (body.action === "ver") return respostaVer;
  if (body.action === "resgatar") return respostaResgatar;
  return { ok: true };
}
let pedidos = 0;
let falharCreate = false;
const pagos = new Set<string>();
const parceiroOk = vi.fn(() => ({ ok: true }));
function servidor() {
  invoke.mockImplementation(async (fn: string, { body }: { body: Record<string, unknown> }) => {
    if (fn === "presente-resgatar") return { data: presenteServidor(body), error: null };
    if (fn !== "asaas-pix") return { data: { ok: true }, error: null };
    if (body.action === "create" && falharCreate) return { data: null, error: { message: "502" } };
    if (body.action === "create") { const id = `qr_${++pedidos}_${body.offer}`; return { data: { orderId: id, qrCode: `000201PIX${id}`, qrCodeBase64: null, expiresAt: null }, error: null }; }
    if (body.action === "check") return { data: { paid: pagos.has(String(body.id)) }, error: null };
    if (body.action === "parceiro") return { data: parceiroOk(), error: null };
    return { data: { ok: true }, error: null };
  });
}
const pagarEConferir = async (oferta: string) => {
  await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
  const ped = invocacoes("asaas-pix", "create").filter((b) => b.offer === oferta).length;
  expect(ped).toBeGreaterThan(0);
  pagos.add(`qr_${pedidos}_${oferta}`);
  fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
};
const ateOferta = async (url?: string) => {
  montar(url);
  fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
  await waitFor(() => expect(etapa()).toBe("contas"));
  for (const c of ["aluguel", "luz", "internet"]) fireEvent.click(screen.getByTestId(`hoje-conta-${c}`));
  fireEvent.click(screen.getByTestId("hoje-ver-numero"));
  await waitFor(() => expect(etapa()).toBe("resultado"));
  fireEvent.click(screen.getByTestId("hoje-ver-core"));
  await waitFor(() => expect(etapa()).toBe("oferta"));
};

const clip = vi.fn(async () => {});
beforeEach(() => {
  _zerarEstadoPresente(); _zerarForcaPresente();
  respostaVer = { ok: true, estado: "livre", de: "Ana" }; respostaResgatar = { ok: true, r: "ok", de: "Ana" };
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarCopiaSessao(); _zerarMemoriaPorta(); _forcarOfertaHoje(null);
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.isSubscribed = false;
  [getSession, getUser, updateUser, setSession, invoke, garantirSessao, definirEmailDaCompra, clip, parceiroOk].forEach((f) => f.mockReset());
  guardarCompraAnonima.mockClear(); vincularCompraAnonima.mockClear(); vincularCompraAnonima.mockResolvedValue(true);
  vi.mocked(trackEvent).mockClear(); vi.mocked(fireMetaEvent).mockClear(); vi.mocked(markPixPurchasePending).mockClear();
  upserts.length = 0; userDataExistente = []; pedidos = 0; pagos.clear(); falharCreate = false;
  // a sessão anônima: nasce no "Pagar com Pix" (garantirSessao), sem e-mail
  let temSessao = false;
  garantirSessao.mockImplementation(async () => { temSessao = true; return "anonima"; });
  getSession.mockImplementation(async () => ({ data: { session: temSessao ? { access_token: "a", refresh_token: "r", user: { id: "anon-1" } } : null } }));
  getUser.mockImplementation(async () => ({ data: { user: temSessao ? { id: "anon-1", email: null, user_metadata: {} } : null } }));
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  parceiroOk.mockReturnValue({ ok: true });
  servidor();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: clip }, configurable: true });
});
afterEach(() => { cleanup(); irPara("/"); _forcarOfertaHoje(null); });
/** as suítes do desenho "anual" (1º ano × mensal + upsells) — o rollback da chave OFERTA_HOJE */
const comoAnual = () => beforeEach(() => _forcarOfertaHoje("anual"));

const pagarVitalicio = async (url?: string) => {
  await ateOferta(url);
  fireEvent.click(screen.getByTestId("hoje-pagar"));
  await pagarEConferir("hv279");
};
const montarResgate = (codigo = "K7QM2XPA") => {
  irPara(`/presente/${codigo}`);
  return render(
    <MemoryRouter initialEntries={[`/presente/${codigo}`]}>
      <Routes>
        <Route path="/presente/:codigo" element={<ResgatePresenteRota />} />
        <Route path="/" element={<div data-testid="landing">landing</div>} />
        <Route path="/entrar" element={<div data-testid="entrar">entrar</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const ELE_ELA = /\b(ela|ele|dela|dele|ela\(e\)|ele\/ela)\b/i;

describe("a chave (padrão OFF)", () => {
  it("UPSELL_PRESENTE = 'off'; ?presente=on liga neste navegador e ?presente=off desliga", () => {
    expect(UPSELL_PRESENTE).toBe("off");
    expect(presenteLigado("")).toBe(false);
    expect(presenteLigado("?presente=on")).toBe(true);
    expect(presenteLigado("")).toBe(true);
    expect(localStorage.getItem("presente-force")).toBe("on");
    expect(presenteLigado("?presente=off")).toBe(false);
    expect(presenteLigado("")).toBe(false);
  });
  it("proximoPosCompra: sem a chave nada muda; com a chave, pra sempre → presente (1 vez); quem não é pra sempre nunca vê", () => {
    const vit = { pagos: [{ oferta: "hv279" as const, orderId: "x", em: 0 }], recusou: [], parceiro: null };
    expect(proximoPosCompra(vit)).toBe("pago");
    expect(proximoPosCompra(vit, false, "off")).toBe("pago");
    expect(proximoPosCompra(vit, false, "presente")).toBe("presente");
    expect(proximoPosCompra({ ...vit, presente: { pedido: null, plano30: null } }, false, "presente")).toBe("pago");
    const anualSemPraSempre = { pagos: [{ oferta: "h279" as const, orderId: "y", em: 0 }], recusou: ["hv47" as const, "hv27" as const], parceiro: null };
    expect(proximoPosCompra(anualSemPraSempre, false, "presente")).toBe("pago");
  });
  it("/hoje com ?ofertas=off: pagou o vitalício → DIRETO pro pós-compra; nenhum evento nem tela do presente", async () => {
    await pagarVitalicio("/hoje?funil-hoje=on&utm_source=meta&ofertas=off");
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(screen.queryByTestId("presente-oferta")).toBeNull();
    expect(vi.mocked(trackEvent).mock.calls.some((c) => String(c[0]).startsWith("presente_") || String(c[0]).startsWith("plano30_"))).toBe(false);
    expect(invocacoes("presente-resgatar")).toHaveLength(0);
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279"]);
  });
});

describe("/hoje com ?presente=on — quero presentear", () => {
  it("oferta → Pix pv149 R$ 14,90 → cartão com o código → WhatsApp + copiar → pós-compra; o link vai pro e-mail salvo", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("presente-oferta")).toBeTruthy());
    expect(etapa()).toBe("presente");
    expect(screen.getByTestId("presente-confirmado").textContent).toContain("Pagamento confirmado · R$ 27,90");
    expect(texto()).toContain("Leve alguém junto");
    expect(screen.getByTestId("presente-preco").textContent).toBe("R$ 14,90");
    expect(screen.getByTestId("presente-agora-nao")).toBeTruthy();
    expect(eventos("presente_oferta_view")[0]).toMatchObject({ origem: "hoje", copy: 1 });

    fireEvent.click(screen.getByTestId("presente-quero"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279", "pv149"]);
    expect(screen.getByTestId("hoje-pix-valor").textContent).toBe("R$ 14,90");
    expect(texto()).toContain("Presente pra alguém especial");
    expect(markPixPurchasePending).toHaveBeenCalledWith({ offer: "pv149", orderId: "qr_2_pv149" });
    expect(eventos("presente_pix_gerado")[0]).toMatchObject({ order_id: "qr_2_pv149", valor: 14.9 });

    await pagarEConferir("pv149");
    await waitFor(() => expect(screen.getByTestId("presente-cartao")).toBeTruthy());
    expect(eventos("presente_pago")[0]).toMatchObject({ order_id: "qr_2_pv149", valor: 14.9, origem: "hoje" });
    await waitFor(() => expect(screen.getByTestId("presente-link").textContent).toBe("coreaplicativo.com.br/presente/K7QM2XPA"));
    expect(invocacoes("presente-resgatar", "meu")[0]).toMatchObject({ pedido: "qr_2_pv149" });

    fireEvent.change(screen.getByTestId("presente-nome"), { target: { value: "Ana" } });
    expect(screen.getByTestId("presente-cartao-de").textContent).toBe("Ana te deu o CORE pra sempre 💛");
    await waitFor(() => expect(invocacoes("presente-resgatar", "nome")[0]).toMatchObject({ pedido: "qr_2_pv149", nome: "Ana" }), { timeout: 3000 });

    const zap = screen.getByTestId("presente-whatsapp") as HTMLAnchorElement;
    expect(zap.href).toContain("https://wa.me/?text=");
    expect(decodeURIComponent(zap.href)).toContain("Ana te deu o CORE pra sempre 💛");
    expect(decodeURIComponent(zap.href)).toContain("https://www.coreaplicativo.com.br/presente/K7QM2XPA");
    fireEvent.click(zap);
    expect(eventos("presente_whatsapp")[0]).toMatchObject({ com_nome: true });
    fireEvent.click(screen.getByTestId("presente-copiar"));
    await waitFor(() => expect(clip).toHaveBeenCalledWith("https://www.coreaplicativo.com.br/presente/K7QM2XPA"));
    expect(eventos("presente_link_copiado")[0]).toMatchObject({ ok: true });

    fireEvent.click(screen.getByTestId("presente-continuar"));
    await waitFor(() => expect(etapa()).toBe("pago"));
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    await waitFor(() => expect(invocacoes("presente-resgatar", "email")[0]).toMatchObject({ pedido: "qr_2_pv149" }));
    // o presente não é plano de ninguém aqui: nada de kit, e o recebido do pós-compra é o do vitalício
    expect(upserts.some((u) => (u as { key?: string })?.key === "core-kit-primeiro-mes")).toBe(false);
    expect(texto()).not.toMatch(ELE_ELA);
  });
  it("voltar do Pix do presente → a oferta de novo", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("presente-quero")).toBeTruthy());
    fireEvent.click(screen.getByTestId("presente-quero"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    fireEvent.click(screen.getByText("Voltar"));
    await waitFor(() => expect(screen.getByTestId("presente-oferta")).toBeTruthy());
  });
});

describe("/hoje com ?presente=on — Agora não → downsell do plano de 30 dias", () => {
  it("toda área tem plano (sem área = 'Tudo'); o /hoje é Dinheiro; a chave do downsell desliga", () => {
    expect(DOWNSELL_PLANO30).toBe(true);
    for (const a of ["dinheiro", "rotina", "corpo", "saude", "metas"] as const) expect(depoisDoAgoraNao(a)).toBe("plano30");
    expect(depoisDoAgoraNao(null)).toBe("plano30");
    expect(depoisDoAgoraNao("dinheiro", false)).toBe("fim");
    expect(temPlano30("corpo")).toBe(true);
  });
  it("Agora não → plano de 30 dias (dia 1 marcado, R$ 9,90) → Não, obrigado → pós-compra", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("presente-agora-nao")).toBeTruthy());
    fireEvent.click(screen.getByTestId("presente-agora-nao"));
    await waitFor(() => expect(screen.getByTestId("plano30")).toBeTruthy());
    expect(screen.getByTestId("plano30").getAttribute("data-versao")).toBe("visual");
    expect(texto()).toContain("Seu plano de 30 dias pra organizar a vida");
    expect(texto()).toContain("Liste as contas do mês");
    expect(texto()).toContain("Começando por Dinheiro");
    expect(screen.getByTestId("plano30-preco").textContent).toBe("R$ 9,90");
    expect(eventos("presente_agora_nao")).toHaveLength(1);
    expect(eventos("plano30_view")[0]).toMatchObject({ area: "dinheiro", versao: "visual", origem: "hoje" });
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(eventos("plano30_nao")).toHaveLength(1);
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279"]);
  });
  it("Quero meu plano → Pix pk99 R$ 9,90 → pago → pós-compra (o kit quem grava é o servidor)", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("presente-agora-nao")).toBeTruthy());
    fireEvent.click(screen.getByTestId("presente-agora-nao"));
    await waitFor(() => expect(screen.getByTestId("plano30-sim")).toBeTruthy());
    fireEvent.click(screen.getByTestId("plano30-sim"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279", "pk99"]);
    expect(screen.getByTestId("hoje-pix-valor").textContent).toBe("R$ 9,90");
    await pagarEConferir("pk99");
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(eventos("plano30_pago")[0]).toMatchObject({ order_id: "qr_2_pk99", valor: 9.9 });
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    // 21/10 (segurança): o kit é gravado pelo SERVIDOR (liberarPlano30 nos 3 caminhos); a página não grava a chave paga
    expect(upserts.some((u) => (u as { key?: string })?.key === "core-kit-primeiro-mes")).toBe(false);
    // o pedido do plano leva a área (o /hoje é Dinheiro) — os 3 caminhos do servidor gravam o plano dessa área
    expect(invocacoes("asaas-pix", "create").find((b) => b.offer === "pk99")).toMatchObject({ area: "dinheiro" });
  });
});

describe("a página /presente/<código> (quem ganhou)", () => {
  it("quem deu + o que vem → e-mail → Criar minha conta (sem senha) → resgate → lojas + como entrar", async () => {
    montarResgate();
    await waitFor(() => expect(screen.getByTestId("presente-livre")).toBeTruthy());
    expect(texto()).toContain("Ana te deu o CORE pra sempre 💛");
    expect(texto()).toContain("e mais 13 áreas");
    expect(eventos("presente_abriu")[0]).toMatchObject({ estado: "livre" });
    expect(invocacoes("presente-resgatar", "ver")[0]).toMatchObject({ codigo: "K7QM2XPA" });
    fireEvent.change(screen.getByTestId("presente-email"), { target: { value: "bia@exemplo.com" } });
    fireEvent.click(screen.getByTestId("presente-criar"));
    await waitFor(() => expect(screen.getByTestId("presente-resgatado")).toBeTruthy());
    expect(garantirSessao).toHaveBeenCalled();
    expect(definirEmailDaCompra).toHaveBeenCalledWith("bia@exemplo.com");
    expect(invocacoes("presente-resgatar", "resgatar")[0]).toMatchObject({ codigo: "K7QM2XPA" });
    expect(eventos("presente_resgatado")[0]).toMatchObject({ via: "nova" });
    expect(screen.getByTestId("selo-app-store")).toBeTruthy();
    expect(screen.getByTestId("selo-google-play")).toBeTruthy();
    expect(screen.getByTestId("presente-lojas").textContent).toContain("bia@exemplo.com");
    expect(texto()).toContain("Presente de Ana");
    expect(texto()).not.toMatch(ELE_ELA);
  });
  it("já tem o CORE pra sempre → mensagem gentil e o link segue valendo (passar pra outra pessoa)", async () => {
    respostaResgatar = { ok: false, motivo: "ja_tem", de: "Ana" };
    montarResgate();
    await waitFor(() => expect(screen.getByTestId("presente-email")).toBeTruthy());
    fireEvent.change(screen.getByTestId("presente-email"), { target: { value: "bia@exemplo.com" } });
    fireEvent.click(screen.getByTestId("presente-criar"));
    await waitFor(() => expect(screen.getByTestId("presente-ja_tem")).toBeTruthy());
    expect(texto()).toContain("Você já tem o CORE pra sempre");
    expect(texto()).toContain("continua valendo");
    expect((screen.getByTestId("presente-passar") as HTMLAnchorElement).href).toContain(encodeURIComponent("/presente/K7QM2XPA"));
    expect(eventos("presente_resgate_recusado")[0]).toMatchObject({ motivo: "ja_tem" });
  });
  it("o próprio comprador → 'Esse presente é pra você dar'", async () => {
    respostaResgatar = { ok: false, motivo: "proprio", de: "Ana" };
    montarResgate();
    await waitFor(() => expect(screen.getByTestId("presente-email")).toBeTruthy());
    fireEvent.change(screen.getByTestId("presente-email"), { target: { value: "ana@exemplo.com" } });
    fireEvent.click(screen.getByTestId("presente-criar"));
    await waitFor(() => expect(screen.getByTestId("presente-proprio")).toBeTruthy());
  });
  it("código usado / inexistente → mensagem curta, sem formulário", async () => {
    respostaVer = { ok: true, estado: "usado", de: "Ana" };
    montarResgate();
    await waitFor(() => expect(screen.getByTestId("presente-usado")).toBeTruthy());
    cleanup();
    respostaVer = { ok: true, estado: "nao_existe", de: null };
    montarResgate("ZZZZZZZZ");
    await waitFor(() => expect(screen.getByTestId("presente-nao_existe")).toBeTruthy());
    expect(screen.queryByTestId("presente-email")).toBeNull();
  });
  it("e-mail que já tem conta → código no e-mail (nunca 2ª conta)", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    montarResgate();
    await waitFor(() => expect(screen.getByTestId("presente-email")).toBeTruthy());
    fireEvent.change(screen.getByTestId("presente-email"), { target: { value: "bia@exemplo.com" } });
    fireEvent.click(screen.getByTestId("presente-criar"));
    await waitFor(() => expect(screen.getByTestId("presente-existe")).toBeTruthy());
    expect(invocacoes("presente-resgatar", "resgatar")).toHaveLength(0);
  });
  it("sem nome no cartão: 'Você ganhou o CORE pra sempre'", async () => {
    respostaVer = { ok: true, estado: "livre", de: null };
    montarResgate();
    await waitFor(() => expect(screen.getByTestId("presente-livre")).toBeTruthy());
    expect(texto()).toContain("Você ganhou o CORE pra sempre");
  });
});

describe("copy sem ele/ela", () => {
  it("mensagem do WhatsApp e os textos das telas novas", () => {
    expect(mensagemDoPresente("K7QM2XPA", "Ana")).toBe("Ana te deu o CORE pra sempre 💛\nAbre aqui pra ativar o seu: https://www.coreaplicativo.com.br/presente/K7QM2XPA");
    expect(mensagemDoPresente("K7QM2XPA", null)).toMatch(/^Ganhei pra você o CORE pra sempre/);
    for (const f of ["src/presente/FluxoPresente.tsx", "src/presente/OfertaPlano30.tsx", "src/pages/presente/ResgatePresente.tsx", "src/lib/presente.ts"]) {
      const jsx = readFileSync(join(process.cwd(), f), "utf8").split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
      expect(jsx, f).not.toMatch(ELE_ELA);
    }
  });
});
