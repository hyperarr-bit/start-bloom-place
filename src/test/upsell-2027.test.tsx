/**
 * UPSELL "SEU 2027 JÁ ORGANIZADO" (21/10) — o lado do site no /hoje, com a chave forçada por URL (`?up2027=on`) e os
 * servidores mockados.
 *   · chave OFF (padrão): o /hoje vitalício vai do Pix DIRETO pro pós-compra, como sempre — nada do 2027 aparece;
 *   · ON: pagou o vitalício → oferta (visual; "Agora não" fácil) → Pix u2027 R$ 19,90 → "Pronto, seu 2027 tá no seu
 *     CORE" (onde fica + lojas) → pós-compra com e-mail + lojas; o pacote vai pra conta final (core-pacote-2027);
 *   · "Agora não" → pós-compra, sem Pix nem pacote; voltar do Pix → oferta; recarregar no meio → a mesma tela;
 *   · quem não é pra sempre nunca vê; eventos u2027_*; a versão curta.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const setSession = vi.fn();
const invoke = vi.fn();
const upserts: Array<unknown> = [];
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
    from: () => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
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
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: (...a: unknown[]) => garantirSessao(...a),
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: vi.fn(async () => {}),
  vincularCompraAnonima: vi.fn(async () => true),
  limparBatismo: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { markPixPurchasePending } from "@/lib/purchase-tracking";
import FunilHojeRota, { _zerarEstadoHoje, proximoPosCompra } from "@/pages/hoje/FunilHoje";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import { VALOR_OFERTA, _forcarOfertaHoje, _zerarForcaHoje } from "@/pages/hoje/conteudo";
import { UPSELL_2027, VERSAO_OFERTA_2027, _zerarEstado2027, _zerarForca2027, upsell2027Ligado } from "@/lib/upsell-2027";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { Fluxo2027 } from "@/upsell-2027/Fluxo2027";
import { PRECOS_HOJE } from "../../supabase/functions/_shared/ofertas-hoje";

const irPara = (url: string) => window.history.replaceState({}, "", url);
const montar = (url = "/hoje?funil-hoje=on&up2027=on&utm_source=meta&fbclid=IwAR_x") => {
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

let pedidos = 0;
const pagos = new Set<string>();
function servidor() {
  invoke.mockImplementation(async (fn: string, { body }: { body: Record<string, unknown> }) => {
    if (fn !== "asaas-pix") return { data: { ok: true }, error: null };
    if (body.action === "create") { const id = `qr_${++pedidos}_${body.offer}`; return { data: { orderId: id, qrCode: `000201PIX${id}`, qrCodeBase64: null, expiresAt: null }, error: null }; }
    if (body.action === "check") return { data: { paid: pagos.has(String(body.id)) }, error: null };
    return { data: { ok: true }, error: null };
  });
}
const pagarEConferir = async (oferta: string) => {
  await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
  expect(invocacoes("asaas-pix", "create").filter((b) => b.offer === oferta).length).toBeGreaterThan(0);
  pagos.add(`qr_${pedidos}_${oferta}`);
  fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
};
const pagarVitalicio = async (url?: string) => {
  montar(url);
  fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
  await waitFor(() => expect(etapa()).toBe("contas"));
  fireEvent.click(screen.getByTestId("hoje-conta-aluguel"));
  fireEvent.click(screen.getByTestId("hoje-ver-numero"));
  await waitFor(() => expect(etapa()).toBe("resultado"));
  fireEvent.click(screen.getByTestId("hoje-ver-core"));
  await waitFor(() => expect(etapa()).toBe("oferta"));
  fireEvent.click(screen.getByTestId("hoje-pagar"));
  await pagarEConferir("hv279");
};
const salvarEmail = async () => {
  await waitFor(() => expect(etapa()).toBe("pago"));
  fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@exemplo.com" } });
  fireEvent.click(screen.getByTestId("hoje-salvar-email"));
  await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
};
const upsertDoPacote = () => upserts.find((u) => (u as { key?: string })?.key === "core-pacote-2027") as { key: string; value: Record<string, unknown> } | undefined;

beforeEach(() => {
  _zerarEstado2027(); _zerarForca2027();
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarCopiaSessao(); _zerarMemoriaPorta(); _forcarOfertaHoje(null);
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.isSubscribed = false;
  [getSession, getUser, updateUser, setSession, invoke, garantirSessao, definirEmailDaCompra].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear(); vi.mocked(markPixPurchasePending).mockClear();
  upserts.length = 0; pedidos = 0; pagos.clear();
  let temSessao = false;
  garantirSessao.mockImplementation(async () => { temSessao = true; return "anonima"; });
  getSession.mockImplementation(async () => ({ data: { session: temSessao ? { access_token: "a", refresh_token: "r", user: { id: "anon-1" } } : null } }));
  getUser.mockImplementation(async () => ({ data: { user: temSessao ? { id: "anon-1", email: null, user_metadata: {} } : null } }));
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  servidor();
});
afterEach(() => { cleanup(); irPara("/"); _forcarOfertaHoje(null); });

describe("a chave (padrão OFF)", () => {
  it("UPSELL_2027 = true (ligada 22/10); ?up2027=off desliga neste navegador e ?up2027=on liga", () => {
    expect(UPSELL_2027).toBe(true);
    expect(upsell2027Ligado("")).toBe(true);
    expect(upsell2027Ligado("?up2027=off")).toBe(false);
    expect(upsell2027Ligado("")).toBe(false);
    expect(localStorage.getItem("up2027-force")).toBe("off");
    expect(upsell2027Ligado("?up2027=on")).toBe(true);
    expect(upsell2027Ligado("")).toBe(true);
  });
  it("o preço bate com o servidor (R$ 19,90 = 1990)", () => {
    expect(VALOR_OFERTA.u2027).toBe(19.9);
    expect(PRECOS_HOJE.u2027).toBe(1990);
  });
  it("proximoPosCompra: sem a chave nada muda; com a chave, pra sempre → u2027 (1 vez); quem não é pra sempre nunca vê", () => {
    const vit = { pagos: [{ oferta: "hv279" as const, orderId: "x", em: 0 }], recusou: [], parceiro: null };
    expect(proximoPosCompra(vit)).toBe("pago");
    expect(proximoPosCompra(vit, false, "off")).toBe("pago");
    expect(proximoPosCompra(vit, false, "2027")).toBe("u2027");
    // 21/10 (integração): "Agora não" no 2027 → o plano de 30 dias (1 vez); pagou o 2027 → pós-compra
    expect(proximoPosCompra({ ...vit, u2027: { pedido: null } }, false, "2027")).toBe("plano30");
    expect(proximoPosCompra({ ...vit, u2027: { pedido: null }, plano30: { pedido: null } }, false, "2027")).toBe("pago");
    expect(proximoPosCompra({ ...vit, u2027: { pedido: "p1" } }, false, "2027")).toBe("pago");
    const anualSemPraSempre = { pagos: [{ oferta: "h279" as const, orderId: "y", em: 0 }], recusou: ["hv47" as const, "hv27" as const], parceiro: null };
    expect(proximoPosCompra(anualSemPraSempre, false, "2027")).toBe("pago");
  });
  it("/hoje com ?ofertas=off: pagou o vitalício → DIRETO pro pós-compra; nenhum evento nem tela do 2027", async () => {
    await pagarVitalicio("/hoje?funil-hoje=on&utm_source=meta&ofertas=off");
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(screen.queryByTestId("u2027-oferta")).toBeNull();
    expect(vi.mocked(trackEvent).mock.calls.some((c) => String(c[0]).startsWith("u2027_"))).toBe(false);
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279"]);
    await salvarEmail();
    expect(upsertDoPacote()).toBeUndefined();
  });
});

describe("/hoje com ?up2027=on", () => {
  it("quero → Pix u2027 R$ 19,90 → pronto (onde fica + lojas) → pós-compra; o pacote vai pra conta final", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("u2027-oferta")).toBeTruthy());
    expect(etapa()).toBe("u2027");
    expect(screen.getByTestId("u2027-oferta").getAttribute("data-versao")).toBe(VERSAO_OFERTA_2027);
    expect(screen.getByTestId("u2027-confirmado").textContent).toContain("Pagamento confirmado · R$ 27,90");
    expect(texto()).toContain("Seu 2027 já organizado");
    expect(screen.getByTestId("u2027-preco").textContent).toBe("R$ 19,90");
    expect(screen.getByTestId("u2027-nao").textContent).toBe("Agora não");
    expect(eventos("u2027_oferta_view")[0]).toMatchObject({ origem: "hoje", versao: VERSAO_OFERTA_2027 });

    fireEvent.click(screen.getByTestId("u2027-quero"));
    expect(eventos("u2027_quero")).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279", "u2027"]);
    expect(screen.getByTestId("hoje-pix-valor").textContent).toBe("R$ 19,90");
    expect(texto()).toContain("Seu 2027 já organizado");
    expect(markPixPurchasePending).toHaveBeenCalledWith({ offer: "u2027", orderId: "qr_2_u2027" });
    expect(eventos("u2027_pix_gerado")[0]).toMatchObject({ order_id: "qr_2_u2027", valor: 19.9 });

    await pagarEConferir("u2027");
    await waitFor(() => expect(screen.getByTestId("u2027-pronto")).toBeTruthy());
    expect(eventos("u2027_pago")[0]).toMatchObject({ order_id: "qr_2_u2027", valor: 19.9, origem: "hoje" });
    expect(texto()).toContain("Pronto, seu 2027 tá no seu CORE");
    expect(screen.getByTestId("u2027-onde").textContent).toContain("Dev. Pessoal → Seu 2027");
    expect(screen.getByTestId("selos-das-lojas")).toBeTruthy();

    fireEvent.click(screen.getByTestId("u2027-continuar"));
    await salvarEmail();
    // 21/10 (integração): pagou o 2027 → pós-compra direto, sem o plano de 30 dias
    expect(eventos("plano30_view")).toHaveLength(0);
    // 21/10 (segurança): o pacote é conteúdo pago — quem grava é o SERVIDOR (asaas-pix check/webhook/reconcile); a página não
    expect(upsertDoPacote()).toBeUndefined();
    // o pós-compra mostra o total pago (27,90 + 19,90) e as lojas
    expect(screen.getByTestId("hoje-lojas")).toBeTruthy();
  });

  it("Agora não → o plano de 30 dias (21/10, integração) → Não, obrigado → pós-compra, sem Pix nem pacote", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("u2027-nao")).toBeTruthy());
    fireEvent.click(screen.getByTestId("u2027-nao"));
    await waitFor(() => expect(etapa()).toBe("plano30"));
    await waitFor(() => expect(screen.getByTestId("plano30-nao")).toBeTruthy());
    expect(screen.queryByTestId("presente-oferta")).toBeNull();
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(eventos("u2027_nao")).toHaveLength(1);
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["hv279"]);
    await salvarEmail();
    expect(upsertDoPacote()).toBeUndefined();
  });

  it("voltar do Pix → a oferta; recarregar a página no Pix (volta do app do banco) → o mesmo Pix", async () => {
    await pagarVitalicio();
    await waitFor(() => expect(screen.getByTestId("u2027-quero")).toBeTruthy());
    fireEvent.click(screen.getByTestId("u2027-quero"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    fireEvent.click(screen.getByText("Voltar"));
    await waitFor(() => expect(screen.getByTestId("u2027-oferta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("u2027-quero"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    const antes = invocacoes("asaas-pix", "create").length;
    cleanup();
    _zerarEstadoHoje(); _zerarEstado2027(); // o heap some (página nova); o localStorage fica
    montar();
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(etapa()).toBe("u2027");
    expect(invocacoes("asaas-pix", "create").length).toBe(antes); // não gerou outro QR
  });
});

describe("a versão curta da oferta", () => {
  it("4 linhas (2 bônus) + preço + 'Aparece no app e no site'", () => {
    render(<div className="fn u27"><div className="fn-corpo"><Fluxo2027 origem="hoje" compra="c1" valorPago={27.9} versao="curta" onFim={vi.fn()} /></div></div>);
    expect(screen.getByTestId("u2027-oferta").getAttribute("data-versao")).toBe("curta");
    for (const s of ["Planejar 2027 em 5 minutos", "12 revisões do mês", "Cofrinho das 52 semanas", "Planner 2027 pra imprimir", "Aparece no app e no site, na hora"]) expect(texto()).toContain(s);
    expect((texto().match(/BÔNUS/g) ?? []).length).toBe(2);
    expect(screen.getByTestId("u2027-preco").textContent).toBe("R$ 19,90");
    // nada de IA nem de promessa que o app não cumpre
    expect(texto().toLowerCase()).not.toMatch(/\bia\b|intelig[eê]ncia artificial|garant/);
  });
});
