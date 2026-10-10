/**
 * ONBOARDING → CONTRATO NUMA TELA SÓ (10/10, chave ONBOARDING_1TELA em lib/onboarding-1tela,
 * tela em pages/funis/w/PlanoDe3Dias). O que este arquivo trava:
 *   · a chave nasce DESLIGADA e, desligada, a volta da demo (`?step=compromissos`) é o funil de
 *     hoje byte a byte: os 3 "Claro!" → o contrato assinado no dedo; os eventos de hoje, nenhum novo;
 *   · ligada (força de QA pelo link `?onboarding-1tela=on`): UMA tela "Seu plano de 3 dias" — os 3
 *     compromissos da rota já marcados (dá pra desmarcar), a linha do contrato e "Fechado";
 *     `funnel_view step=plano_3_dias`; no "Fechado" os MESMOS `compromisso_N claro|nao` e
 *     `contrato_assinou` de hoje; depois vem o paywall;
 *   · o Voltar do Android anda por passo (plano_3_dias → central) e o recuo do paywall cai no plano;
 *   · a retomada/deep link traduz "compromissos"/"contrato" ↔ "plano_3_dias" conforme a chave.
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
vi.mock("@/lib/revenuecat", () => ({ compraNaLojaSemConta: async () => false }));
vi.mock("@/lib/notificacoes", () => ({ agendarResgateDoPlano: vi.fn(async () => {}), cancelarResgateDoPlano: vi.fn(async () => {}), pedirPermissao: vi.fn(async () => true), estadoPermissao: vi.fn(async () => "prompt") }));
vi.mock("@/pages/funis/w/PaywallW", () => ({ PaywallW: () => <div data-testid="paywall-w">paywall</div> }));
vi.mock("@/pages/funis/ios/PaywallIOS", () => ({ PaywallIOS: () => <div data-testid="paywall-ios">paywall ios</div> }));
vi.mock("@/pages/funis/ios/CadastroIOS", () => ({ SignupIOS: () => <div />, ConfirmIOS: () => <div />, LiberandoIOS: () => <div /> }));
vi.mock("@/pages/funis/radar/ComecarRadar", () => ({ SignupScreen: () => <div data-testid="signup">signup</div>, ConfirmScreen: () => <div />, LiberandoScreen: () => <div />, POS_COMPRA_OAUTH_KEY: "core-pos-compra-oauth" }));
vi.mock("@/components/app/AppWelcome", () => ({ AppWelcome: () => <div data-testid="welcome">welcome</div> }));
// o jsdom não anima: o AnimatePresence (mode="wait") seguraria a tela antiga pra sempre — aqui ele só renderiza os filhos
vi.mock("framer-motion", async (orig) => {
  const m = await orig<typeof import("framer-motion")>();
  return { ...m, AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

import ComecarW from "@/pages/funis/w/ComecarW";
import { CHAVES_FUNIL_W, passoAnteriorDe, passoDeRetomada, recuoDoPaywall, RECUO_DO_PAYWALL, guardarChave } from "@/pages/funis/w/retomada";
import { CHAVE_FORCA_ONBOARDING_1TELA, ONBOARDING_1TELA, STEP_PLANO_3_DIAS, guardarForcaOnboarding1Tela, onboarding1TelaLigado, passoDoOnboarding, textoDoContrato } from "@/lib/onboarding-1tela";
import { COMPROMISSOS_POR_AREA, compromissoComoChip } from "@/pages/funis/w/compromissos";

const montar = (url: string) => {
  window.history.replaceState({}, "", url);
  return render(<MemoryRouter initialEntries={[url]}><ComecarW /></MemoryRouter>);
};
const nomes = () => eventos.map(([n, d]) => `${n}:${String(d.step ?? d.cta ?? "")}`);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  eventos.length = 0;
  guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("a chave", () => {
  it("nasce DESLIGADA; a força de QA pelo link liga/desliga/desfaz e traduz os passos", () => {
    expect(ONBOARDING_1TELA).toBe("off");
    expect(onboarding1TelaLigado()).toBe(false);
    expect(passoDoOnboarding("compromissos")).toBe("compromissos");
    expect(passoDoOnboarding(STEP_PLANO_3_DIAS)).toBe("compromissos"); // guardado com a chave ligada, lido com ela desligada: rollback suave
    guardarForcaOnboarding1Tela("?onboarding-1tela=on");
    expect(onboarding1TelaLigado()).toBe(true);
    expect(passoDoOnboarding("compromissos")).toBe(STEP_PLANO_3_DIAS);
    expect(passoDoOnboarding("contrato")).toBe(STEP_PLANO_3_DIAS);
    expect(passoDoOnboarding("offer")).toBe("offer");
    guardarForcaOnboarding1Tela("?onboarding-1tela=off");
    expect(onboarding1TelaLigado("on")).toBe(false);
    guardarForcaOnboarding1Tela("?onboarding-1tela=auto");
    expect(localStorage.getItem(CHAVE_FORCA_ONBOARDING_1TELA)).toBeNull();
    expect(onboarding1TelaLigado("on")).toBe(true);
  });

  it("o Voltar do Android anda por passo (plano → central); o recuo do paywall cai no plano só com a chave ligada; a retomada conhece o passo", () => {
    expect(passoAnteriorDe(STEP_PLANO_3_DIAS)).toBe("central");
    expect(passoAnteriorDe("contrato")).toBe("compromissos"); // o de hoje não muda
    expect(recuoDoPaywall(false)).toBe(RECUO_DO_PAYWALL);
    expect(recuoDoPaywall(true)).toBe(STEP_PLANO_3_DIAS);
    expect(passoDeRetomada(STEP_PLANO_3_DIAS, true)).toBe(STEP_PLANO_3_DIAS);
    expect(passoDeRetomada(STEP_PLANO_3_DIAS, false)).toBeNull();
  });

  it("o texto do contrato e os chips: a pergunta vira afirmação em 1ª pessoa", () => {
    expect(textoDoContrato()).toBe("Eu vou dar 10 min por dia ao meu CORE por 3 dias.");
    expect(textoDoContrato("Ana")).toBe("Eu, Ana, vou dar 10 min por dia ao meu CORE por 3 dias.");
    expect(compromissoComoChip("Você quer saber pra onde seu dinheiro vai?")).toBe("Saber pra onde meu dinheiro vai");
    expect(compromissoComoChip("Quer parar de esquecer conta e pagar juros?")).toBe("Parar de esquecer conta e pagar juros");
    expect(compromissoComoChip("Topa fechar o mês no azul?")).toBe("Fechar o mês no azul");
    expect(Object.keys(COMPROMISSOS_POR_AREA)).toEqual(["dinheiro", "rotina", "corpo", "saude", "metas"]);
  });
});

describe("DESLIGADA: a volta da demo é o funil de hoje, byte a byte", () => {
  it("?step=compromissos → os 3 'Claro!' → o contrato no dedo; eventos de hoje; nada de plano_3_dias", async () => {
    montar("/funil-w?step=compromissos");
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("plano-3-dias")).toBeNull();
    expect(screen.getByText("Claro!")).toBeInTheDocument();
    expect(screen.getByText("Você quer saber pra onde seu dinheiro vai?")).toBeInTheDocument();
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "compromissos", funil: "w", retomada: true })]);
    fireEvent.click(screen.getByText("Claro!"));
    fireEvent.click(screen.getByText("Claro!"));
    fireEvent.click(screen.getByText("Claro!"));
    expect(eventos.filter(([n, d]) => n === "funnel_quiz_answer" && /^compromisso_/.test(String(d.step)))).toEqual([
      ["funnel_quiz_answer", { step: "compromisso_1", answer: "claro", area: "dinheiro", funil: "w" }],
      ["funnel_quiz_answer", { step: "compromisso_2", answer: "claro", area: "dinheiro", funil: "w" }],
      ["funnel_quiz_answer", { step: "compromisso_3", answer: "claro", area: "dinheiro", funil: "w" }],
    ]);
    expect(screen.getByText(/Assina esse compromisso/)).toBeInTheDocument();
    expect(screen.getByText(/assina aqui com o dedo/)).toBeInTheDocument();
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "contrato", funil: "w" })]);
    expect(nomes().some((n) => /plano_3_dias/.test(n))).toBe(false);
    expect(JSON.parse(localStorage.getItem(CHAVES_FUNIL_W.passo) ?? "{}").v).toBe("contrato");
  });
});

describe("LIGADA: 'Seu plano de 3 dias' — uma tela, chips marcados, contrato em 1 linha, Fechado → paywall", () => {
  it("a volta da demo cai na tela única; funnel_view step=plano_3_dias; desmarcar um chip; Fechado emite os compromisso_N de hoje + contrato_assinou e vai pro paywall", async () => {
    montar("/funil-w?step=compromissos&onboarding-1tela=on");
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Claro!")).toBeNull();
    const tela = screen.getByTestId("plano-3-dias");
    expect(tela).toHaveTextContent("Seu plano de 3 dias");
    expect(screen.getByTestId("plano-3-dias-contrato")).toHaveTextContent("Eu vou dar 10 min por dia ao meu CORE por 3 dias.");
    for (const i of [1, 2, 3]) expect(screen.getByTestId(`plano-3-dias-chip-${i}`)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("plano-3-dias-chip-1")).toHaveTextContent("Saber pra onde meu dinheiro vai");
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "plano_3_dias", funil: "w", retomada: true })]);
    expect(nomes()).not.toContain("funnel_view:compromissos");
    // desmarca o 2º
    fireEvent.click(screen.getByTestId("plano-3-dias-chip-2"));
    expect(screen.getByTestId("plano-3-dias-chip-2")).toHaveAttribute("aria-checked", "false");
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "plano_3_dias_desmarcou", indice: 2 })]);
    fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
    expect(eventos.filter(([n, d]) => n === "funnel_quiz_answer" && /^compromisso_/.test(String(d.step))).map(([, d]) => [d.step, d.answer])).toEqual([
      ["compromisso_1", "claro"], ["compromisso_2", "nao"], ["compromisso_3", "claro"],
    ]);
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "contrato_assinou", funil: "w", tela: "plano_3_dias" })]);
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "plano_3_dias_fechado", marcados: 2 })]);
    // depois do plano vem o paywall, como hoje depois do contrato (web com sessão anônima ligada → offer)
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("paywall-w")).toBeInTheDocument();
    expect(screen.queryByText(/Assina esse compromisso/)).toBeNull();
  });

  it("a retomada de quem parou no plano (chave ligada) volta no plano; com a chave desligada depois, cai nos compromissos de hoje", async () => {
    localStorage.setItem(CHAVE_FORCA_ONBOARDING_1TELA, "on");
    expect(passoDoOnboarding(passoDeRetomada("contrato", true) ?? "")).toBe(STEP_PLANO_3_DIAS);
    localStorage.removeItem(CHAVE_FORCA_ONBOARDING_1TELA);
    expect(passoDoOnboarding(passoDeRetomada(STEP_PLANO_3_DIAS, true) ?? "")).toBe("compromissos");
  });
});
