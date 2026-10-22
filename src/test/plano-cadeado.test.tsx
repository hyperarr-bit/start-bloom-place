/**
 * PLANO COM CADEADO (10/10, 1.0.14) — chave PLANO_CADEADO (lib/ofertas-saida, "cadeado") na tela
 * "Seu plano de 3 dias" (ONBOARDING_1TELA).
 *
 *  · OFF (o padrão) = a tela da 1.0.14 de hoje: chips grandes, contrato, "Fechado"; nenhum testid
 *    do cadeado; `funnel_view step=plano_3_dias` SEM `cadeado`.
 *  · ON: card da área com Dia 1/2/3 na linguagem dela (DIAS_POR_AREA), chips compactos (marcados,
 *    dá pra desmarcar), contrato em 1 linha, bloco "Depois do teste" borrado + "Desbloqueia quando
 *    começar o teste grátis", botão "Desbloquear meu plano" → paywall; `funnel_view` ganha
 *    `cadeado: true`, o toque emite os MESMOS eventos do Fechado + `funnel_click cta=desbloquear_plano`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  getAttributionParams: () => ({}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, isSubscribed: false, loading: false }) }));
vi.mock("@/lib/sessao-anonima", () => ({ anonimoLigado: async () => true, precisaBatizar: async () => true }));
vi.mock("@/lib/revenuecat", () => ({ compraNaLojaSemConta: async () => false, initRevenueCat: async () => "pronto", prefetchAnualIos: async () => undefined }));
vi.mock("@/lib/notificacoes", () => ({ agendarResgateDoPlano: vi.fn(async () => {}), cancelarResgateDoPlano: vi.fn(async () => {}), pedirPermissao: vi.fn(async () => true), estadoPermissao: vi.fn(async () => "prompt") }));
vi.mock("@/pages/funis/w/PaywallW", () => ({ PaywallW: () => <div data-testid="paywall-w">paywall</div> }));
vi.mock("@/pages/funis/ios/PaywallIOS", () => ({ PaywallIOS: () => <div data-testid="paywall-ios">paywall ios</div> }));
vi.mock("@/pages/funis/ios/CadastroIOS", () => ({ SignupIOS: () => <div />, ConfirmIOS: () => <div />, LiberandoIOS: () => <div /> }));
vi.mock("@/pages/funis/radar/ComecarRadar", () => ({ SignupScreen: () => <div data-testid="signup">signup</div>, ConfirmScreen: () => <div />, LiberandoScreen: () => <div />, POS_COMPRA_OAUTH_KEY: "core-pos-compra-oauth" }));
vi.mock("@/components/app/AppWelcome", () => ({ AppWelcome: () => <div data-testid="welcome">welcome</div> }));
vi.mock("framer-motion", async (orig) => {
  const m = await orig<typeof import("framer-motion")>();
  return { ...m, AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

import ComecarW from "@/pages/funis/w/ComecarW";
import { PlanoDe3Dias } from "@/pages/funis/w/PlanoDe3Dias";
import { CHAVES_FUNIL_W, guardarChave } from "@/pages/funis/w/retomada";
import { CHAVE_FORCA_OFERTAS } from "@/lib/ofertas-saida";
import { DIAS_POR_AREA, DEPOIS_DO_TESTE_POR_AREA } from "@/pages/funis/w/compromissos";

const montar = (url: string) => {
  window.history.replaceState({}, "", url);
  return render(<MemoryRouter initialEntries={[url]}><ComecarW /></MemoryRouter>);
};
const ligar = (v: string) => localStorage.setItem(CHAVE_FORCA_OFERTAS, v);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  eventos.length = 0;
  guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("os textos por área", () => {
  it("as 5 áreas têm 3 dias e 3 linhas de 'depois do teste', curtos", () => {
    for (const area of ["dinheiro", "rotina", "corpo", "saude", "metas"] as const) {
      expect(DIAS_POR_AREA[area]).toHaveLength(3);
      expect(DEPOIS_DO_TESTE_POR_AREA[area]).toHaveLength(3);
      for (const t of [...DIAS_POR_AREA[area], ...DEPOIS_DO_TESTE_POR_AREA[area]]) expect(t.length).toBeLessThanOrEqual(64);
    }
    expect(DIAS_POR_AREA.dinheiro[0]).toBe("Anota 1 gasto e vê o mês somar sozinho");
  });
});

describe("OFF: a tela da 1.0.14 de hoje", () => {
  it("chips grandes, contrato, 'Começar meu Dia 1' (era 'Fechado' até a 1.0.17); nada do cadeado; funnel_view sem `cadeado`", async () => {
    montar("/funil-w?step=compromissos&onboarding-1tela=on");
    await act(async () => { await Promise.resolve(); });
    const tela = screen.getByTestId("plano-3-dias");
    expect(tela).not.toHaveAttribute("data-cadeado");
    expect(tela).toHaveTextContent("É o que a gente combina agora. Dez minutos por dia, três dias");
    expect(screen.queryByTestId("plano-3-dias-cadeado")).toBeNull();
    expect(screen.queryByTestId("plano-3-dias-dias")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Depois do teste|Desbloque|DIA 1/);
    expect(screen.getByTestId("plano-3-dias-fechado")).toHaveTextContent("Começar meu Dia 1");
    const view = eventos.find(([n, d]) => n === "funnel_view" && d.step === "plano_3_dias");
    expect(view).toBeTruthy();
    expect(view![1]).not.toHaveProperty("cadeado");
    fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
    expect(eventos.some(([n, d]) => n === "funnel_click" && d.cta === "desbloquear_plano")).toBe(false);
    expect(eventos.some(([n, d]) => n === "funnel_click" && d.cta === "plano_3_dias_fechado")).toBe(true);
  });
});

describe("ON: a revelação com cadeado", () => {
  beforeEach(() => ligar("cadeado"));

  it("Dia 1/2/3 da área, chips marcados, contrato, bloco borrado 'Depois do teste', 'Desbloquear meu plano' → paywall; eventos", async () => {
    montar("/funil-w?step=compromissos&onboarding-1tela=on");
    await act(async () => { await Promise.resolve(); });
    const tela = screen.getByTestId("plano-3-dias");
    expect(tela).toHaveAttribute("data-cadeado");
    expect(tela.querySelector("h1")).toHaveTextContent("Seu plano de 3 dias");
    const dias = screen.getByTestId("plano-3-dias-dias");
    expect(dias).toHaveTextContent("Dinheiro");
    expect(dias).toHaveTextContent("DIA 1");
    expect(dias).toHaveTextContent("Anota 1 gasto e vê o mês somar sozinho");
    expect(dias).toHaveTextContent("DIA 2");
    expect(dias).toHaveTextContent("Marca as contas do mês e recebe o aviso antes de vencer");
    expect(dias).toHaveTextContent("DIA 3");
    expect(dias).toHaveTextContent("Vê quanto dá pra gastar hoje sem furar o mês");
    for (const i of [1, 2, 3]) expect(screen.getByTestId(`plano-3-dias-chip-${i}`)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("plano-3-dias-chip-1")).toHaveTextContent("Saber pra onde meu dinheiro vai");
    expect(screen.getByTestId("plano-3-dias-contrato")).toHaveTextContent("Eu vou dar 10 min por dia ao meu CORE por 3 dias.");
    const cadeado = screen.getByTestId("plano-3-dias-cadeado");
    expect(cadeado).toHaveTextContent("Depois do teste");
    expect(cadeado).toHaveTextContent("O que o CORE monta pra você nos próximos 30 dias");
    expect(cadeado).toHaveTextContent("Desbloqueia quando começar o teste grátis");
    const borrado = cadeado.querySelector("ul") as HTMLElement;
    expect(borrado.style.filter).toMatch(/blur/);
    expect(borrado).toHaveTextContent("Semana 1: seu mapa de gastos por categoria");
    // a tela de hoje não está aqui
    expect(document.body.textContent).not.toMatch(/É o que a gente combina agora/);
    expect(screen.queryByText("Fechado")).toBeNull();
    // funnel_view com cadeado
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "plano_3_dias", funil: "w", retomada: true, cadeado: true })]);
    // desmarca o 3º e desbloqueia
    fireEvent.click(screen.getByTestId("plano-3-dias-chip-3"));
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "plano_3_dias_desmarcou", indice: 3 })]);
    const botao = screen.getByTestId("plano-3-dias-fechado");
    expect(botao).toHaveTextContent("Desbloquear meu plano");
    fireEvent.click(botao);
    expect(eventos.filter(([n, d]) => n === "funnel_quiz_answer" && /^compromisso_/.test(String(d.step))).map(([, d]) => [d.step, d.answer])).toEqual([
      ["compromisso_1", "claro"], ["compromisso_2", "claro"], ["compromisso_3", "nao"],
    ]);
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "contrato_assinou", funil: "w", tela: "plano_3_dias" })]);
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "plano_3_dias_fechado", marcados: 2 })]);
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "desbloquear_plano", funil: "w", area: "dinheiro", marcados: 2 })]);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("paywall-w")).toBeInTheDocument();
  });

  it("a volta da demo (passo guardado) também registra `cadeado: true`; cada área leva os próprios dias", async () => {
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    montar("/funil-w?step=compromissos&onboarding-1tela=on");
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("plano-3-dias-dias")).toHaveTextContent("Marca 1 hábito e vê sua semana ganhar vida");
    expect(screen.getByTestId("plano-3-dias-dias")).toHaveTextContent("Rotina");
    expect(eventos.filter(([n, d]) => n === "funnel_view" && d.step === "plano_3_dias").every(([, d]) => d.cadeado === true)).toBe(true);
  });

  it("a tela sozinha (fora do funil): no shell nativo puxa as offerings e segue ligada; sem shell nada quebra", async () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    try {
      const onDone = vi.fn();
      render(<PlanoDe3Dias area="corpo" onDone={onDone} />);
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(screen.getByTestId("plano-3-dias")).toHaveAttribute("data-cadeado");
      expect(screen.getByTestId("plano-3-dias-dias")).toHaveTextContent("Anota 1 exercício e a carga de hoje");
      fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally { delete (window as { Capacitor?: unknown }).Capacitor; }
  });
});
