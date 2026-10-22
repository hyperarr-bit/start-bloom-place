/**
 * OFERTAS DEPOIS DO PIX (21/10, integração dos ramos back-funil + presente-vitalicio + upsell-2027) — a chave central
 * OFERTAS_POS_COMPRA (src/lib/ofertas-pos-compra.ts) e a ORDEM no /hoje. Decisão: no máximo 2 ofertas depois do Pix.
 *   · "2027": oferta 2027 → (Agora não) plano de 30 dias → pós-compra · (pagou o 2027) → pós-compra. Presente nunca.
 *   · "presente": presente → (Agora não) plano de 30 dias → pós-compra. 2027 nunca.
 *   · "off" (padrão): pagou o vitalício → pós-compra direto, nenhum evento das ofertas.
 *   · o back continua 1 vez com as ofertas ligadas.
 * O /inicio (PixCheckout) fica em ofertas-pos-compra-inicio.test.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const invoke = vi.fn();
const upserts: Array<unknown> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
      setSession: vi.fn(),
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
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: (...a: unknown[]) => garantirSessao(...a),
  definirEmailDaCompra: vi.fn(async () => ({ erro: null })),
  guardarCompraAnonima: vi.fn(async () => {}),
  vincularCompraAnonima: vi.fn(async () => true),
  limparBatismo: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import FunilHojeRota, { _zerarEstadoHoje, proximoPosCompra } from "@/pages/hoje/FunilHoje";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import { _forcarOfertaHoje, _zerarForcaHoje } from "@/pages/hoje/conteudo";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { _zerarBack } from "@/lib/back-funil";
import { OFERTAS_POS_COMPRA, _zerarForcaOfertas, modoOfertas } from "@/lib/ofertas-pos-compra";
import { UPSELL_PRESENTE, _zerarEstadoPresente, presenteLigado } from "@/lib/presente";
import { UPSELL_2027, _zerarEstado2027, upsell2027Ligado } from "@/lib/upsell-2027";

/* ---------------------------------------------------------------- ambiente */
const montar = (busca: string) => {
  window.history.replaceState(null, "", "/anuncio");
  window.history.pushState(null, "", `/hoje?funil-hoje=on&utm_source=meta${busca}`);
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
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const eventosQueComecam = (prefixo: string) => vi.mocked(trackEvent).mock.calls.filter((c) => String(c[0]).startsWith(prefixo));
const criados = () => invoke.mock.calls.filter((c) => c[0] === "asaas-pix" && (c[1] as { body: { action: string } }).body.action === "create").map((c) => (c[1] as { body: Record<string, unknown> }).body);
const voltar = () => act(() => new Promise<void>((ok) => {
  const f = () => { window.removeEventListener("popstate", f); window.setTimeout(ok, 0); };
  window.addEventListener("popstate", f);
  window.history.back();
}));

let pedidos = 0;
const pagos = new Set<string>();
const ateOferta = async (busca: string) => {
  montar(busca);
  fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
  await waitFor(() => expect(etapa()).toBe("contas"));
  fireEvent.click(screen.getByTestId("hoje-conta-aluguel"));
  fireEvent.click(screen.getByTestId("hoje-ver-numero"));
  await waitFor(() => expect(etapa()).toBe("resultado"));
  fireEvent.click(screen.getByTestId("hoje-ver-core"));
  await waitFor(() => expect(etapa()).toBe("oferta"));
};
const pagarEConferir = async (oferta: string) => {
  await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
  expect(criados().filter((b) => b.offer === oferta).length).toBeGreaterThan(0);
  pagos.add(`qr_${pedidos}_${oferta}`);
  fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
};
const pagarVitalicio = async (busca: string) => {
  await ateOferta(busca);
  fireEvent.click(screen.getByTestId("hoje-pagar"));
  await pagarEConferir("hv279");
};
const salvarEmail = async () => {
  await waitFor(() => expect(etapa()).toBe("pago"));
  fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@exemplo.com" } });
  fireEvent.click(screen.getByTestId("hoje-salvar-email"));
  await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
};

beforeEach(() => {
  _zerarForcaOfertas(); _zerarEstadoPresente(); _zerarEstado2027(); _zerarBack();
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarCopiaSessao(); _zerarMemoriaPorta(); _forcarOfertaHoje(null);
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.isSubscribed = false;
  [getSession, getUser, invoke, garantirSessao].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear();
  upserts.length = 0; pedidos = 0; pagos.clear();
  let temSessao = false;
  garantirSessao.mockImplementation(async () => { temSessao = true; return "anonima"; });
  getSession.mockImplementation(async () => ({ data: { session: temSessao ? { access_token: "a", refresh_token: "r", user: { id: "anon-1" } } : null } }));
  getUser.mockImplementation(async () => ({ data: { user: temSessao ? { id: "anon-1", email: null, user_metadata: {} } : null } }));
  invoke.mockImplementation(async (fn: string, { body }: { body: Record<string, unknown> }) => {
    if (fn !== "asaas-pix") return { data: { ok: true }, error: null };
    if (body.action === "create") { const id = `qr_${++pedidos}_${body.offer}`; return { data: { orderId: id, qrCode: `000201PIX${id}`, qrCodeBase64: null, expiresAt: null }, error: null }; }
    if (body.action === "check") return { data: { paid: pagos.has(String(body.id)) }, error: null };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); _zerarBack(); _forcarOfertaHoje(null); window.history.replaceState(null, "", "/"); });

/* ---------------------------------------------------------------- a chave */
describe("a chave central OFERTAS_POS_COMPRA", () => {
  it("padrão 'off': as chaves dos ramos saem dela (presente off, 2027 off)", () => {
    expect(OFERTAS_POS_COMPRA).toBe("off");
    expect(UPSELL_PRESENTE).toBe("off");
    expect(UPSELL_2027).toBe(false);
    expect(modoOfertas("")).toBe("off");
  });

  it("?ofertas=2027|presente|off fica no navegador; valor estranho não mexe", () => {
    expect(modoOfertas("?ofertas=2027")).toBe("2027");
    expect(modoOfertas("")).toBe("2027");
    expect(localStorage.getItem("ofertas-force")).toBe("2027");
    expect(upsell2027Ligado("")).toBe(true);
    expect(presenteLigado("")).toBe(false);
    expect(modoOfertas("?ofertas=presente")).toBe("presente");
    expect(presenteLigado("")).toBe(true);
    expect(upsell2027Ligado("")).toBe(false);
    expect(modoOfertas("?ofertas=xyz")).toBe("presente");
    expect(modoOfertas("?ofertas=off")).toBe("off");
    expect(modoOfertas("")).toBe("off");
  });

  it("as forças antigas seguem valendo, uma só por vez (a última vence; as duas juntas = 2027)", () => {
    expect(modoOfertas("?presente=on")).toBe("presente");
    expect(modoOfertas("?up2027=on")).toBe("2027");
    expect(localStorage.getItem("presente-force")).toBeNull();
    expect(modoOfertas("?presente=on")).toBe("presente");
    expect(modoOfertas("?up2027=on&presente=on")).toBe("2027");
    expect(modoOfertas("?up2027=off")).toBe("presente"); // o presente segue forçado da linha de cima
    expect(modoOfertas("?presente=off")).toBe("off");
    // ?ofertas= esquece as forças antigas
    modoOfertas("?presente=on");
    expect(modoOfertas("?ofertas=2027")).toBe("2027");
    expect(localStorage.getItem("presente-force")).toBeNull();
    // e a força antiga depois de um ?ofertas= vence (é a escolha mais nova)
    expect(modoOfertas("?presente=on")).toBe("presente");
    expect(localStorage.getItem("ofertas-force")).toBeNull();
  });

  it("nunca as duas ligadas ao mesmo tempo", () => {
    for (const busca of ["?up2027=on&presente=on", "?ofertas=2027&presente=on", "?ofertas=presente", "?ofertas=2027", ""]) {
      _zerarForcaOfertas(); localStorage.clear();
      modoOfertas(busca);
      expect(presenteLigado("") && upsell2027Ligado("")).toBe(false);
    }
  });
});

/* ---------------------------------------------------------------- a ordem (pura) */
describe("proximoPosCompra — a ordem das ofertas", () => {
  const vit = { pagos: [{ oferta: "hv279" as const, orderId: "x", em: 0 }], recusou: [], parceiro: null };
  it("2027: oferta 2027 → (Agora não) plano de 30 dias → pós-compra; pagou o 2027 → pós-compra; presente nunca", () => {
    expect(proximoPosCompra(vit, false, "2027")).toBe("u2027");
    expect(proximoPosCompra({ ...vit, u2027: { pedido: null } }, false, "2027")).toBe("plano30");
    expect(proximoPosCompra({ ...vit, u2027: { pedido: null }, plano30: { pedido: "pk" } }, false, "2027")).toBe("pago");
    expect(proximoPosCompra({ ...vit, u2027: { pedido: null }, plano30: { pedido: null } }, false, "2027")).toBe("pago");
    expect(proximoPosCompra({ ...vit, u2027: { pedido: "u1" } }, false, "2027")).toBe("pago");
  });
  it("presente: presente → pós-compra (o plano de 30 dias mora dentro do fluxo do presente); 2027 nunca", () => {
    expect(proximoPosCompra(vit, false, "presente")).toBe("presente");
    expect(proximoPosCompra({ ...vit, presente: { pedido: null, plano30: null } }, false, "presente")).toBe("pago");
  });
  it("off: nada; quem não é pra sempre nunca vê oferta nenhuma", () => {
    expect(proximoPosCompra(vit, false, "off")).toBe("pago");
    expect(proximoPosCompra(vit)).toBe("pago");
    const anual = { pagos: [{ oferta: "h279" as const, orderId: "y", em: 0 }], recusou: ["hv47" as const, "hv27" as const], parceiro: null };
    expect(proximoPosCompra(anual, false, "2027")).toBe("pago");
    expect(proximoPosCompra(anual, false, "presente")).toBe("pago");
  });
});

/* ---------------------------------------------------------------- /hoje de ponta a ponta */
describe("/hoje com as ofertas", () => {
  it("off: pagou o vitalício → pós-compra direto; nenhuma tela nem evento das ofertas", async () => {
    await pagarVitalicio("");
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(eventosQueComecam("u2027_")).toHaveLength(0);
    expect(eventosQueComecam("presente_")).toHaveLength(0);
    expect(eventosQueComecam("plano30_")).toHaveLength(0);
    expect(criados().map((b) => b.offer)).toEqual(["hv279"]);
  });

  it("?ofertas=2027: oferta 2027 → Agora não → plano de 30 dias (sem presente) → Não, obrigado → pós-compra com as lojas", async () => {
    await pagarVitalicio("&ofertas=2027");
    await waitFor(() => expect(screen.getByTestId("u2027-oferta")).toBeTruthy());
    expect(etapa()).toBe("u2027");
    fireEvent.click(screen.getByTestId("u2027-nao"));
    await waitFor(() => expect(etapa()).toBe("plano30"));
    await waitFor(() => expect(screen.getByTestId("plano30")).toBeTruthy());
    expect(screen.queryByTestId("presente-oferta")).toBeNull();
    expect(eventos("plano30_view")[0]).toMatchObject({ origem: "hoje", via: "u2027", area: "dinheiro" });
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await salvarEmail();
    expect(eventosQueComecam("presente_")).toHaveLength(0);
    expect(criados().map((b) => b.offer)).toEqual(["hv279"]);
  });

  it("?ofertas=2027: Agora não → Quero meu plano → Pix pk99 R$ 9,90 (área) → pós-compra; o kit quem grava é o servidor", async () => {
    await pagarVitalicio("&ofertas=2027");
    await waitFor(() => expect(screen.getByTestId("u2027-nao")).toBeTruthy());
    fireEvent.click(screen.getByTestId("u2027-nao"));
    await waitFor(() => expect(screen.getByTestId("plano30-sim")).toBeTruthy());
    fireEvent.click(screen.getByTestId("plano30-sim"));
    await waitFor(() => expect(screen.getByTestId("hoje-pix-valor").textContent).toBe("R$ 9,90"));
    expect(criados().find((b) => b.offer === "pk99")).toMatchObject({ area: "dinheiro" });
    await pagarEConferir("pk99");
    await salvarEmail();
    // 21/10 (segurança): o kit é gravado pelo SERVIDOR; a página não grava a chave paga
    expect(upserts.some((u) => (u as { key?: string })?.key === "core-kit-primeiro-mes")).toBe(false);
    expect(criados().map((b) => b.offer)).toEqual(["hv279", "pk99"]);
  });

  it("?ofertas=2027: aceitou o 2027 → Pix u2027 → pronto → pós-compra, SEM o plano de 30 dias", async () => {
    await pagarVitalicio("&ofertas=2027");
    await waitFor(() => expect(screen.getByTestId("u2027-quero")).toBeTruthy());
    fireEvent.click(screen.getByTestId("u2027-quero"));
    await pagarEConferir("u2027");
    await waitFor(() => expect(screen.getByTestId("u2027-pronto")).toBeTruthy());
    fireEvent.click(screen.getByTestId("u2027-continuar"));
    await salvarEmail();
    expect(eventosQueComecam("plano30_")).toHaveLength(0);
    expect(eventosQueComecam("presente_")).toHaveLength(0);
    expect(criados().map((b) => b.offer)).toEqual(["hv279", "u2027"]);
  });

  it("?ofertas=presente: presente → Agora não → plano de 30 dias → pós-compra; 2027 nunca", async () => {
    await pagarVitalicio("&ofertas=presente");
    await waitFor(() => expect(screen.getByTestId("presente-oferta")).toBeTruthy());
    expect(etapa()).toBe("presente");
    fireEvent.click(screen.getByTestId("presente-agora-nao"));
    await waitFor(() => expect(screen.getByTestId("plano30")).toBeTruthy());
    fireEvent.click(screen.getByTestId("plano30-nao"));
    await salvarEmail();
    expect(eventosQueComecam("u2027_")).toHaveLength(0);
    expect(screen.queryByTestId("u2027-oferta")).toBeNull();
  });

  it("back continua 1 vez com as ofertas ligadas: voltar na oferta → a mesma oferta 1x → paga → oferta 2027", async () => {
    await ateOferta("&back=on&ofertas=2027");
    await voltar();
    fireEvent.click(await screen.findByTestId("back-quero"));
    await waitFor(() => expect(etapa()).toBe("pix"));
    await pagarEConferir("hv279");
    await waitFor(() => expect(screen.getByTestId("u2027-oferta")).toBeTruthy());
    expect(eventos("back_view")).toHaveLength(1);
    expect(eventos("back_view")[0]).toMatchObject({ funil: "hoje", etapa: "oferta" });
    expect(screen.queryByTestId("back-folha")).toBeNull();
  });
});
