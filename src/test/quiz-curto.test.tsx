/**
 * QUIZ CURTO (30/09) — Dia 1 do plano "ROI 2 em 7 dias".
 *
 * Trava:
 *   · chave DESLIGADA = o quiz de hoje, byte a byte (5 perguntas + impacto
 *     em dinheiro, 4 + impacto nas outras trilhas; nenhum evento ganha campo);
 *   · braço CURTO = só as perguntas que alguma tela lê depois (gasto/
 *     consistência + vitória) com a tela de impacto no mesmo lugar, e o
 *     braço carimbado em todo evento do funil;
 *   · o sorteio respeita a fatia e a força de QA;
 *   · rollback = "off".
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: true, ehFunilRoi2: () => true }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => new Intl.NumberFormat("pt-BR").format(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  trackEventBeacon: analytics.trackEventBeacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({}),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, set: vi.fn(), data: {}, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({ guardarCompraAnonima: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: () => null,
  aquecerCheckoutPix: vi.fn(),
  prepararPixAdiantado: () => ({ tocou: () => {}, parar: () => {} }),
}));

import ComecarDia14 from "@/pages/funis/dia14/ComecarDia14";
import { QUIZ, AREA_TRACKS, AREA_PROOF } from "@/lib/funnel";
import {
  QUIZ_CURTO, QUIZ_CURTO_FATIA, CHAVE_FORCA_QUIZ_CURTO, CHAVE_BRACO_QUIZ, PERGUNTAS_CURTAS,
  sortearBracoDoQuiz, perguntasDoBraco, bracoGuardadoDoQuiz, guardarBracoDoQuiz,
} from "@/lib/quiz-curto";

MotionGlobalConfig.skipAnimations = true;

const porta = () => render(<MemoryRouter initialEntries={["/inicio"]}><ComecarDia14 /></MemoryRouter>);
const texto = () => document.body.textContent ?? "";
const opcoes = () => Array.from(document.querySelectorAll("div.space-y-3 > button")) as HTMLButtonElement[];
const pergunta = () => document.querySelector("h2")?.textContent ?? "";
const eventos = (nome: string) => analytics.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);

beforeEach(() => {
  localStorage.clear();
  analytics.trackEvent.mockClear();
  analytics.trackEventBeacon.mockClear();
});
afterEach(cleanup);

describe("a chave", () => {
  it("nasce DESLIGADA (o funil de hoje) e o rollback é uma constante", () => {
    expect(QUIZ_CURTO).toBe("off");
    expect(sortearBracoDoQuiz("off")).toBeNull();
    expect(bracoGuardadoDoQuiz("off")).toBeNull();
  });
  it("'on' põe todo mundo no curto; 'ab' sorteia pela fatia", () => {
    expect(sortearBracoDoQuiz("on")).toBe("curto");
    expect(sortearBracoDoQuiz("ab", () => QUIZ_CURTO_FATIA - 0.01)).toBe("curto");
    expect(sortearBracoDoQuiz("ab", () => QUIZ_CURTO_FATIA + 0.01)).toBe("cheio");
    expect(QUIZ_CURTO_FATIA).toBe(0.5);
  });
  it("a força de QA manda mais que a chave, e o braço guardado sobrevive à recarga só com a chave ligada", () => {
    localStorage.setItem(CHAVE_FORCA_QUIZ_CURTO, "on");
    expect(sortearBracoDoQuiz("off")).toBe("curto");
    localStorage.setItem(CHAVE_FORCA_QUIZ_CURTO, "off");
    expect(sortearBracoDoQuiz("on")).toBeNull();
    localStorage.removeItem(CHAVE_FORCA_QUIZ_CURTO);
    guardarBracoDoQuiz("cheio");
    expect(localStorage.getItem(CHAVE_BRACO_QUIZ)).toBe("cheio");
    expect(bracoGuardadoDoQuiz("ab")).toBe("cheio");
    expect(bracoGuardadoDoQuiz("off")).toBeNull();
    guardarBracoDoQuiz(null);
    expect(localStorage.getItem(CHAVE_BRACO_QUIZ)).toBeNull();
  });
});

describe("as perguntas de cada braço", () => {
  it("cheio/fora do experimento = a MESMA lista de hoje (mesmo array)", () => {
    expect(perguntasDoBraco(QUIZ, "dinheiro", null)).toBe(QUIZ);
    expect(perguntasDoBraco(QUIZ, "dinheiro", "cheio")).toBe(QUIZ);
    expect(perguntasDoBraco(AREA_TRACKS.rotina, "rotina", null)).toBe(AREA_TRACKS.rotina);
  });
  it("curto = só o que alguma tela lê depois: gasto + vitória em dinheiro; consistência + vitória nas outras", () => {
    expect(perguntasDoBraco(QUIZ, "dinheiro", "curto").map((q) => q.key)).toEqual(["gasto", "vitoria"]);
    for (const area of ["rotina", "corpo", "saude", "metas"] as const) {
      expect(perguntasDoBraco(AREA_TRACKS[area], area, "curto").map((q) => q.key)).toEqual([...PERGUNTAS_CURTAS[area]]);
      expect(PERGUNTAS_CURTAS[area]).toEqual(["consistencia", "vitoria"]);
    }
    // ordem de hoje preservada (a impacto continua depois de gasto/consistência)
    expect(QUIZ.findIndex((q) => q.key === "gasto")).toBeLessThan(QUIZ.findIndex((q) => q.key === "vitoria"));
  });
  it("trilha sem as chaves esperadas não vira quiz vazio", () => {
    expect(perguntasDoBraco([{ key: "x", q: "?", opts: [] }], "dinheiro", "curto")).toEqual([{ key: "x", q: "?", opts: [] }]);
  });
});

describe("no funil (/inicio)", () => {
  it("DESLIGADA: 'Meu dinheiro' abre a 1ª pergunta de hoje e nenhum evento leva o campo quiz", async () => {
    porta();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(pergunta()).toBe(QUIZ[0].q); // "O que mais te atrapalha hoje?"
    expect(opcoes().length).toBe(QUIZ[0].opts.length);
    for (const e of [...eventos("funnel_click"), ...eventos("funnel_view")]) expect(e).not.toHaveProperty("quiz");
    expect(localStorage.getItem(CHAVE_BRACO_QUIZ)).toBeNull();
  });

  it("CURTO (força de QA): dinheiro = gasto → impacto → vitória → preparando, e o braço vai em todo evento", async () => {
    localStorage.setItem(CHAVE_FORCA_QUIZ_CURTO, "on");
    porta();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(eventos("funnel_click").find((e) => e.cta === "start")).toEqual(expect.objectContaining({ area: "dinheiro", quiz: "curto" }));
    expect(localStorage.getItem(CHAVE_BRACO_QUIZ)).toBe("curto");
    // 1ª pergunta: gasto (a que alimenta a tela de impacto e a âncora do paywall)
    expect(pergunta()).toBe("Quanto você acha que gasta sem perceber, por mês?");
    expect(texto()).not.toMatch(/O que mais te atrapalha hoje\?/);
    fireEvent.click(screen.getByText("Mais de R$ 500"));
    // tela de impacto, com a resposta dela
    await waitFor(() => expect(texto()).toMatch(/Pela sua estimativa/), { timeout: 4000 });
    expect(texto()).toMatch(/somem por mês/);
    fireEvent.click(screen.getByRole("button", { name: /Quero ver pra onde vai/ }));
    // 2ª e última pergunta: vitória
    await waitFor(() => expect(pergunta()).toBe("Qual seria uma vitória nos próximos 7 dias?"), { timeout: 4000 });
    expect(texto()).not.toMatch(/Como você controla seu dinheiro hoje\?|Topa dedicar 5 minutos/);
    fireEvent.click(screen.getByText("Saber quanto posso gastar"));
    // acabou o quiz: preparando
    await waitFor(() => expect(texto()).toMatch(/Ligando os 16 módulos|Analisando suas respostas/), { timeout: 4000 });
    const vistas = eventos("funnel_view").map((e) => e.step);
    expect(vistas).toEqual(expect.arrayContaining(["quiz_1", "quiz_proof", "quiz_2", "progress"]));
    expect(vistas).not.toContain("quiz_3");
    for (const e of eventos("funnel_view").filter((x) => x.step !== "start")) expect(e.quiz).toBe("curto");
    // as respostas que o paywall lê chegaram inteiras
    expect(JSON.parse(localStorage.getItem("funnel-quiz-answers") ?? "{}")).toEqual(expect.objectContaining({
      area: "dinheiro", gasto: "Mais de R$ 500", vitoria: "Saber quanto posso gastar",
    }));
  });

  it("CURTO: trilha de rotina = consistência → pico → vitória", async () => {
    localStorage.setItem(CHAVE_FORCA_QUIZ_CURTO, "on");
    porta();
    fireEvent.click(screen.getByText("Minha rotina"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(pergunta()).toBe("Quanto tempo você costuma manter um hábito novo?");
    fireEvent.click(opcoes()[0]);
    // a tela de PICO das trilhas de vida (AreaProofSlide), com o botão dela
    const avancar = await screen.findByRole("button", { name: new RegExp(AREA_PROOF.rotina.cta) }, { timeout: 4000 });
    expect(texto()).toMatch(AREA_PROOF.rotina.reframe.slice(0, 20));
    fireEvent.click(avancar);
    await waitFor(() => expect(pergunta()).toBe("Qual seria uma vitória nos próximos 7 dias?"), { timeout: 4000 });
    expect(texto()).not.toMatch(/O que mais bagunça sua rotina hoje\?|Topa dedicar 5 minutos/);
  });

  it("'cheio' (sorteado no A/B) é o quiz de hoje com o braço carimbado", async () => {
    guardarBracoDoQuiz("cheio");
    // simula a chave em "ab": o braço guardado só vale com a chave ligada — aqui forçamos pelo storage lido no mount
    localStorage.setItem(CHAVE_FORCA_QUIZ_CURTO, "off");
    porta();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(pergunta()).toBe(QUIZ[0].q);
  });
});
