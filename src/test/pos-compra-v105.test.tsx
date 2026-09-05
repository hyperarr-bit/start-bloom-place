/**
 * PÓS-COMPRA v105 (05/09) — o que muda entre "a folha fechou" e "app aberto".
 *
 * Medido em 207 vendas na Play (28/08→04/09): 92% criam a conta DEPOIS de
 * pagar (mediana 22 s), 15% tiveram o app morto embaixo da folha e voltaram
 * noutra sessão, e uma vez `app_pos_compra_liberado {ok:false}` soltou
 * confete em cima de um acesso que não existia. Cada bloco trava um pedaço
 * da ordem nova — PagoScreen (comemora ANTES do cadastro) → SignupScreen →
 * LiberandoScreen (sincroniza; honesto quando não acha; não comemora de
 * novo) — e o pedido DIRETO de avaliação no plano pronto, que colheu 63
 * avaliações em 3 dias enquanto a folha de convite colheu 4 em 107 vistas.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  requestReview: vi.fn(async () => {}),
  invoke: vi.fn(async () => ({ data: null, error: null })),
  shell: { on: true },
  rc: {
    init: vi.fn(async () => undefined),
    sync: vi.fn(async () => false),
    restaurar: vi.fn(async () => false),
  },
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: mocks.trackEvent, getAttributionParams: () => ({}), captureLandingMeta: () => ({}),
}));
vi.mock("@/lib/native-shell", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/native-shell")>();
  return { ...mod, isNativeShell: () => mocks.shell.on };
});
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: mocks.rc.init,
  sincronizarAssinatura: mocks.rc.sync,
  restaurar: mocks.rc.restaurar,
  estadoRevenueCat: () => "pronto",
}));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: { requestReview: mocks.requestReview } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false, signUp: vi.fn(), signIn: vi.fn() }),
}));
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({ get: () => "", set: vi.fn(), loaded: true, isGuest: false, fetchKey: async () => null }),
}));

import { PagoScreen } from "@/components/funil/PagoScreen";
import { LiberandoScreen } from "@/pages/funis/radar/ComecarRadar";
import { pedirAvaliacaoPlanoPronto, podePedirAvaliacao } from "@/lib/avaliacao";

const evento = (nome: string) =>
  mocks.trackEvent.mock.calls.filter(([n]) => n === nome).map(([, d]) => d as Record<string, unknown>);

const montarLiberando = (props: { celebrar?: boolean } = {}) =>
  render(<MemoryRouter><LiberandoScreen {...props} /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  mocks.trackEvent.mockClear();
  mocks.requestReview.mockClear();
  mocks.invoke.mockClear();
  mocks.rc.init.mockClear();
  mocks.rc.sync.mockReset();
  mocks.rc.sync.mockResolvedValue(false);
  mocks.rc.restaurar.mockReset();
  mocks.rc.restaurar.mockResolvedValue(false);
  mocks.shell.on = true;
  window.history.replaceState({}, "", "/comecar-w");
});
afterEach(() => cleanup());

/* ============================================================
 * PAGO — a comemoração, agora ANTES do cadastro
 * ============================================================ */
describe("PagoScreen", () => {
  it("mostra a área escolhida, os 8 recortes e o CTA; conta 'visto' no mount e 'seguiu' no toque", () => {
    const seguir = vi.fn();
    const { container } = render(<PagoScreen area="dinheiro" onContinuar={seguir} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pronto.");
    expect(screen.getByText(/Vamos começar por/).textContent).toContain("Dinheiro");
    expect(container.querySelectorAll(".pago-rc")).toHaveLength(8);
    expect(screen.getByText(/Leva 10 segundos/)).toBeInTheDocument();
    expect(evento("app_pago_visto")).toEqual([{ area: "dinheiro" }]);
    expect(evento("app_pago_seguiu")).toHaveLength(0);
    expect(seguir).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Guardar meu acesso/ }));
    expect(seguir).toHaveBeenCalledTimes(1);
    expect(evento("app_pago_seguiu")).toEqual([{ area: "dinheiro" }]);
  });

  it("a copy acompanha a área (rotina → Rotina) e não faz pergunta nenhuma", () => {
    const { container } = render(<PagoScreen area="rotina" onContinuar={() => {}} />);
    expect(screen.getByText(/Vamos começar por/).textContent).toContain("Rotina");
    expect(container.textContent).not.toMatch(/\?/);
  });
});

/* ============================================================
 * LIBERANDO — ok=false é honesto, e "Já paguei" sincroniza de novo
 * ============================================================ */
describe("LiberandoScreen — o shell não achou a compra (ok=false)", () => {
  it("não comemora: sem confete, sem 'Acesso guardado'; oferece atualizar, entrar assim mesmo e o suporte", async () => {
    montarLiberando();
    expect(screen.getByText("Guardando seu acesso…")).toBeInTheDocument();
    await screen.findByText("Ainda não achamos sua compra");

    expect(evento("app_pos_compra_liberado")).toEqual([{ ok: false }]);
    expect(evento("boas_vindas_pago_visto")).toHaveLength(0);
    expect(screen.queryByText("Acesso guardado")).toBeNull();
    expect(screen.getByText(/Se você pagou no Pix/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Já paguei — atualizar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar no app mesmo assim" })).toBeInTheDocument();
    const suporte = screen.getByRole("link", { name: "Falar com a gente" });
    expect(suporte.getAttribute("href")).toMatch(/^mailto:suporte@coreaplicativo\.com\.br/);

    // receita da 1ª tentativa: init → sync → restaurar → sync
    expect(mocks.rc.init).toHaveBeenCalledTimes(1);
    expect(mocks.rc.sync).toHaveBeenCalledTimes(2);
    expect(mocks.rc.restaurar).toHaveBeenCalledTimes(1);
  });

  it("'Já paguei — atualizar' re-sincroniza (init + sync + restaurar) e conta a tentativa; quando acha, libera", async () => {
    montarLiberando();
    await screen.findByText("Ainda não achamos sua compra");

    fireEvent.click(screen.getByRole("button", { name: "Já paguei — atualizar" }));
    expect(evento("app_pos_compra_retry")).toEqual([{ tentativa: 1 }]);
    await waitFor(() => expect(mocks.rc.sync).toHaveBeenCalledTimes(4));
    expect(mocks.rc.init).toHaveBeenCalledTimes(2);
    expect(mocks.rc.restaurar).toHaveBeenCalledTimes(2);
    await screen.findByText(/Ainda não apareceu/);
    expect(screen.getByText("Ainda não achamos sua compra")).toBeInTheDocument();
    expect(evento("app_pos_compra_liberado")).toEqual([{ ok: false }, { ok: false, tentativa: 1 }]);

    // 2ª tentativa: o Pix entrou
    mocks.rc.sync.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Já paguei — atualizar" }));
    expect(evento("app_pos_compra_retry")).toEqual([{ tentativa: 1 }, { tentativa: 2 }]);
    await waitFor(() => expect(evento("app_pos_compra_liberado")).toContainEqual({ ok: true, tentativa: 2 }));
    expect(mocks.rc.restaurar).toHaveBeenCalledTimes(2); // achou de primeira, não restaurou
    // padrão (celebrar) → BoasVindasPago
    await waitFor(() => expect(evento("boas_vindas_pago_visto")).toHaveLength(1));
    expect(screen.queryByText("Ainda não achamos sua compra")).toBeNull();
  });
});

/* ============================================================
 * LIBERANDO — celebrar={false}: a comemoração já aconteceu no PagoScreen
 * ============================================================ */
describe("LiberandoScreen — celebrar={false}", () => {
  it("fecha com 'Acesso guardado' na área do funil, sem BoasVindasPago — e NÃO pede avaliação aqui (o pedido é no plano pronto)", async () => {
    localStorage.setItem("core-funnel-area", "rotina");
    mocks.rc.sync.mockResolvedValue(true);
    montarLiberando({ celebrar: false });
    await screen.findByText("Acesso guardado");

    expect(screen.getByText(/Vamos começar por/).textContent).toContain("Rotina");
    expect(screen.getByRole("button", { name: /Abrir o CORE/ })).toBeInTheDocument();
    expect(evento("app_pos_compra_liberado")).toEqual([{ ok: true }]);
    expect(evento("boas_vindas_pago_visto")).toHaveLength(0);
    expect(mocks.rc.restaurar).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 1200));
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(evento("app_avaliacao_pedida")).toHaveLength(0);
  });

  it("sem a prop, o padrão continua comemorando — nada muda antes de o funil ser religado", async () => {
    mocks.rc.sync.mockResolvedValue(true);
    montarLiberando();
    await waitFor(() => expect(evento("boas_vindas_pago_visto")).toHaveLength(1));
    expect(screen.queryByText("Acesso guardado")).toBeNull();
  });
});

describe("LiberandoScreen — a web segue exatamente como estava", () => {
  it("sem loja: check-subscription, ok:true web:true, comemora — e nunca chama o RevenueCat", async () => {
    mocks.shell.on = false;
    montarLiberando();
    await waitFor(() => expect(evento("app_pos_compra_liberado")).toEqual([{ ok: true, web: true }]));
    expect(mocks.invoke).toHaveBeenCalledWith("check-subscription");
    expect(mocks.rc.init).not.toHaveBeenCalled();
    await waitFor(() => expect(evento("boas_vindas_pago_visto")).toHaveLength(1));
    expect(screen.queryByText("Ainda não achamos sua compra")).toBeNull();
  });
});

/* ============================================================
 * AVALIAÇÃO — o pedido direto no plano pronto (63 em 3 dias × 4 em 107)
 * ============================================================ */
describe("pedirAvaliacaoPlanoPronto", () => {
  it("pede UMA vez por aparelho, com o motivo plano_pronto — e nunca duas", async () => {
    expect(await pedirAvaliacaoPlanoPronto()).toBe(true);
    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(evento("app_avaliacao_pedida")).toEqual([expect.objectContaining({ motivo: "plano_pronto" })]);
    expect(localStorage.getItem("core-avaliacao-plano-pronto")).toBe("1");

    expect(await pedirAvaliacaoPlanoPronto()).toBe(false);
    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
  });

  it("a trava do aparelho vale mesmo depois que a janela de 90 dias abre de novo", async () => {
    expect(await pedirAvaliacaoPlanoPronto()).toBe(true);
    localStorage.removeItem("core-avaliacao-ultima");
    localStorage.removeItem("core-avaliacao-total");
    expect(podePedirAvaliacao()).toBe(true);
    expect(await pedirAvaliacaoPlanoPronto()).toBe(false);
    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
  });

  it("respeita as travas comuns (web, /preview, 90 dias) SEM gastar a chance do aparelho", async () => {
    mocks.shell.on = false;
    expect(await pedirAvaliacaoPlanoPronto()).toBe(false);
    mocks.shell.on = true;
    window.history.replaceState({}, "", "/preview/financas");
    expect(await pedirAvaliacaoPlanoPronto()).toBe(false);
    window.history.replaceState({}, "", "/comecar-w");
    localStorage.setItem("core-avaliacao-ultima", String(Date.now()));
    expect(await pedirAvaliacaoPlanoPronto()).toBe(false);
    expect(localStorage.getItem("core-avaliacao-plano-pronto")).toBeNull();
    expect(mocks.requestReview).not.toHaveBeenCalled();

    // aberta a janela, a chance continua inteira
    localStorage.removeItem("core-avaliacao-ultima");
    expect(await pedirAvaliacaoPlanoPronto()).toBe(true);
  });
});
