/**
 * BACK no /hoje (21/10; mecânica e chave em src/lib/back-funil.ts, o /inicio em back-funil.test.tsx):
 *   · oferta do vitalício: o voltar do navegador mostra a MESMA oferta (R$ 27,90); "Quero meu CORE" = "Pagar com Pix";
 *   · Pix gerado: o voltar mostra o MESMO código; "Copiar" copia ele, sem Pix novo;
 *   · as telas do quiz (renda/contas/número) não mexem no histórico, e o "Voltar" de dentro da página segue igual;
 *   · chave desligada: nada empilha, nenhuma tela de back.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const invoke = vi.fn();
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
      upsert: () => Promise.resolve({ error: null }),
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
import FunilHojeRota, { _zerarEstadoHoje } from "@/pages/hoje/FunilHoje";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import { _forcarOfertaHoje, _zerarForcaHoje } from "@/pages/hoje/conteudo";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { _zerarBack } from "@/lib/back-funil";

const montar = (busca: string) => {
  window.history.replaceState(null, "", "/anuncio");
  window.history.pushState(null, "", `/hoje?funil-hoje=on&utm_source=meta${busca}`);
  return render(
    <MemoryRouter initialEntries={["/hoje"]}>
      <Routes>
        <Route path="/hoje" element={<FunilHojeRota />} />
        <Route path="/" element={<div data-testid="landing">landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const etapa = () => screen.getByTestId("hoje").getAttribute("data-etapa");
const voltar = () => act(() => new Promise<void>((ok) => {
  const f = () => { window.removeEventListener("popstate", f); window.setTimeout(ok, 0); };
  window.addEventListener("popstate", f);
  window.history.back();
}));
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const criados = () => invoke.mock.calls.filter((c) => c[0] === "asaas-pix" && (c[1] as { body: { action: string } }).body.action === "create").map((c) => (c[1] as { body: Record<string, unknown> }).body);
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

let push: ReturnType<typeof vi.spyOn>;
const marcas = () => push.mock.calls.filter((c) => (c[0] as Record<string, unknown> | null)?.coreBack).length;
const clip = vi.fn(async () => {});
beforeEach(() => {
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarCopiaSessao(); _zerarMemoriaPorta(); _forcarOfertaHoje(null); _zerarBack();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.isSubscribed = false;
  [getSession, getUser, invoke, garantirSessao, clip].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear();
  let temSessao = false;
  garantirSessao.mockImplementation(async () => { temSessao = true; return "anonima"; });
  getSession.mockImplementation(async () => ({ data: { session: temSessao ? { access_token: "a", refresh_token: "r", user: { id: "anon-1" } } : null } }));
  getUser.mockImplementation(async () => ({ data: { user: temSessao ? { id: "anon-1", email: null, user_metadata: {} } : null } }));
  let n = 0;
  invoke.mockImplementation(async (fn: string, { body }: { body: Record<string, unknown> }) => {
    if (fn === "asaas-pix" && body.action === "create") { const id = `qr_${++n}_${body.offer}`; return { data: { orderId: id, qrCode: `000201PIX${id}`, qrCodeBase64: null, expiresAt: null }, error: null }; }
    if (fn === "asaas-pix" && body.action === "check") return { data: { paid: false }, error: null };
    return { data: { ok: true }, error: null };
  });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: clip }, configurable: true });
  push = vi.spyOn(window.history, "pushState");
});
afterEach(() => { cleanup(); push.mockRestore(); _zerarBack(); _forcarOfertaHoje(null); });

describe("/hoje — o back", () => {
  it("chave desligada: o quiz e a oferta não mexem no histórico; voltar na oferta não mostra nada", async () => {
    await ateOferta("");
    expect(marcas()).toBe(0);
    await voltar();
    expect(screen.queryByTestId("back-folha")).toBeNull();
  });

  it("quiz intacto com ?back=on: renda/contas/número não empilham, e o Voltar da página segue voltando 1 tela", async () => {
    montar("&back=on");
    fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
    await waitFor(() => expect(etapa()).toBe("contas"));
    expect(marcas()).toBe(0);
    fireEvent.click(screen.getByText("Voltar"));
    await waitFor(() => expect(etapa()).toBe("renda"));
    expect(marcas()).toBe(0);
  });

  it("oferta: 1º voltar mostra a MESMA oferta (R$ 27,90); Quero meu CORE = Pagar com Pix (hv279)", async () => {
    await ateOferta("&back=on");
    expect(marcas()).toBe(1);
    await voltar();
    const f = await screen.findByTestId("back-folha");
    expect(f.getAttribute("data-funil")).toBe("hoje");
    expect(screen.getByTestId("back-preco").textContent).toBe("R$27,90");
    expect(eventos("back_view")[0]).toMatchObject({ funil: "hoje", etapa: "oferta" });
    fireEvent.click(screen.getByTestId("back-quero"));
    await waitFor(() => expect(etapa()).toBe("pix"));
    await waitFor(() => expect(criados()[0]).toMatchObject({ offer: "hv279" }));
    expect(eventos("funnel_click").some((e) => e.cta === "pagar_pix")).toBe(true);
  });

  it("oferta: 2º voltar (depois de fechar com Sair) sai de verdade, sem outra tela", async () => {
    await ateOferta("&back=on");
    await voltar();
    fireEvent.click(await screen.findByTestId("back-sair"));
    await waitFor(() => expect(window.location.pathname).toBe("/anuncio"));
    expect(screen.queryByTestId("back-folha")).toBeNull();
  });

  it("Pix gerado: o voltar mostra o MESMO código; Copiar copia ele e não gera outro Pix", async () => {
    await ateOferta("&back=on");
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    await voltar();
    const f = await screen.findByTestId("back-folha");
    expect(f.getAttribute("data-etapa")).toBe("pix");
    expect(screen.getByTestId("back-codigo").textContent).toBe("000201PIXqr_1_hv279");
    fireEvent.click(screen.getByTestId("back-quero"));
    await waitFor(() => expect(clip).toHaveBeenCalledWith("000201PIXqr_1_hv279"));
    await waitFor(() => expect(screen.queryByTestId("back-folha")).toBeNull());
    expect(etapa()).toBe("pix");
    expect(criados()).toHaveLength(1);
    expect(eventos("hoje_pix_copiado")[0]).toMatchObject({ order_id: "qr_1_hv279" });
  });

  it("modo 'anual' (rollback da oferta): sem back — a tela só sabe vender o vitalício", async () => {
    _forcarOfertaHoje("anual");
    await ateOferta("&back=on");
    expect(marcas()).toBe(0);
  });
});

// 22/10: a 1ª pergunta leve está ligada pra todos (HOJE_P1 = "leve"); este arquivo testa o resto do /hoje com a ordem de antes
beforeEach(async () => { (await import("@/pages/hoje/conteudo")).modoP1("?hoje-p1=off"); });
