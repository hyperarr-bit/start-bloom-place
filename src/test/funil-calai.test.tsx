/**
 * FUNIL DO iPHONE ENXUTO NOS PRINCÍPIOS DO CAL AI (10/10, chave FUNIL_CALAI em lib/funil-calai;
 * telas em pages/funis/w/WelcomeCalai e GraficoComSem; número dela em lib/funil-numeros).
 * O que este arquivo trava:
 *   · a chave nasce DESLIGADA e, desligada, o funil é o de hoje byte a byte: welcome da grade azul,
 *     promessas, 7 itens de quiz na rota dinheiro (5 perguntas + notificação + prova), result → central;
 *     nenhum evento novo;
 *   · ligada (força de QA pelo link `?funil-calai=on`): welcome com vídeo (`funnel_view step=welcome
 *     video=true`, `welcome_video_play|erro`), Começar → porta (sem promessas), 2 perguntas (quiz_1 e
 *     quiz_3 na rota dinheiro; quiz_1 e quiz_2 nas outras), gráfico (`funnel_view step=grafico_com_sem
 *     {rota, numero}` + `funnel_click cta=grafico_quero_ver`), notificação como passo, prova social,
 *     progress, result → plano (tela única com ONBOARDING_1TELA; senão os compromissos de hoje);
 *   · o Voltar do Android anda pela fila nova; a retomada/deep link traduz os passos conforme a chave;
 *   · lib/funil-numeros: o número por rota, a mediana quando ela "não faz ideia", a projeção e a copy.
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
  instalouVindoDoSite: () => false,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, isSubscribed: false, loading: false }) }));
vi.mock("@/lib/sessao-anonima", () => ({ anonimoLigado: async () => true, precisaBatizar: async () => true }));
vi.mock("@/lib/revenuecat", () => ({ compraNaLojaSemConta: async () => false, initRevenueCat: async () => {}, restaurar: async () => false }));
vi.mock("@/lib/att-ios", () => ({ pedirRastreamentoIos: vi.fn(async () => "nao_ios"), segurarReservaNativaDoATT: vi.fn() }));
vi.mock("@/lib/notificacoes", () => ({ agendarResgateDoPlano: vi.fn(async () => {}), cancelarResgateDoPlano: vi.fn(async () => {}), pedirPermissao: vi.fn(async () => true), estadoPermissao: vi.fn(async () => "prompt") }));
vi.mock("@/pages/funis/w/PaywallW", () => ({ PaywallW: () => <div data-testid="paywall-w">paywall</div> }));
vi.mock("@/pages/funis/ios/PaywallIOS", () => ({ PaywallIOS: () => <div data-testid="paywall-ios">paywall ios</div> }));
vi.mock("@/pages/funis/ios/CadastroIOS", () => ({ SignupIOS: () => <div />, ConfirmIOS: () => <div />, LiberandoIOS: () => <div /> }));
vi.mock("@/pages/funis/radar/ComecarRadar", () => ({ SignupScreen: () => <div data-testid="signup">signup</div>, ConfirmScreen: () => <div />, LiberandoScreen: () => <div />, POS_COMPRA_OAUTH_KEY: "core-pos-compra-oauth" }));
vi.mock("@/components/app/AppWelcome", () => ({ AppWelcome: ({ onComecar }: { onComecar: () => void }) => <button data-testid="welcome-antiga" onClick={onComecar}>Começar (grade azul)</button> }));
// o jsdom não anima: o AnimatePresence (mode="wait") seguraria a tela antiga pra sempre — aqui ele só renderiza os filhos
vi.mock("framer-motion", async (orig) => {
  const m = await orig<typeof import("framer-motion")>();
  return { ...m, AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

import ComecarW from "@/pages/funis/w/ComecarW";
import { CHAVES_FUNIL_W, passoAnteriorDe, passoDeRetomada, guardarChave } from "@/pages/funis/w/retomada";
import { CHAVE_FORCA_FUNIL_CALAI, FUNIL_CALAI, STEP_GRAFICO_COM_SEM, funilCalaiLigado, guardarForcaFunilCalai, passoDoFunilCalai } from "@/lib/funil-calai";
import { CHAVE_FORCA_ONBOARDING_1TELA, passoDoOnboarding } from "@/lib/onboarding-1tela";
import { ABERTURA_TUDO, COPY_SEM_COM, MEDIANA_REAIS, MEDIANA_TREINOS, copyDoGrafico, mesAlvo, numeroDaRota, numeroDaRotaDe, portaTudo, projecao } from "@/lib/funil-numeros";
import { PORTA_TUDO } from "@/lib/funnel";

const montar = (url: string) => {
  window.history.replaceState({}, "", url);
  return render(<MemoryRouter initialEntries={[url]}><ComecarW /></MemoryRouter>);
};
const nomes = () => eventos.map(([n, d]) => `${n}:${String(d.step ?? d.cta ?? "")}`);
const viewsDe = (passo: string) => eventos.filter(([n, d]) => n === "funnel_view" && d.step === passo);
const tick = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  eventos.length = 0;
  // o jsdom não toca vídeo: play() não existe — a welcome nova trata como "sem autoplay"
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("a chave", () => {
  it("nasce DESLIGADA; a força de QA pelo link liga/desliga/desfaz; a tradução dos passos segue a chave", () => {
    expect(FUNIL_CALAI).toBe("off");
    expect(funilCalaiLigado()).toBe(false);
    expect(passoDoFunilCalai("central")).toBe("central");
    expect(passoDoFunilCalai(STEP_GRAFICO_COM_SEM)).toBe("quiz"); // guardado ligada, lido desligada: rollback suave
    expect(passoDoFunilCalai("notif")).toBe("quiz");
    guardarForcaFunilCalai("?funil-calai=on");
    expect(funilCalaiLigado()).toBe(true);
    expect(passoDoFunilCalai("promessas")).toBe("porta");
    expect(passoDoFunilCalai("central")).toBe("compromissos");
    expect(passoDoFunilCalai(STEP_GRAFICO_COM_SEM)).toBe(STEP_GRAFICO_COM_SEM);
    expect(passoDoFunilCalai("offer")).toBe("offer");
    guardarForcaFunilCalai("?funil-calai=off");
    expect(funilCalaiLigado("on")).toBe(false);
    guardarForcaFunilCalai("?funil-calai=auto");
    expect(localStorage.getItem(CHAVE_FORCA_FUNIL_CALAI)).toBeNull();
    expect(funilCalaiLigado("on")).toBe(true);
  });

  it("o Voltar do Android anda pela fila nova só com a chave ligada; a de hoje não muda; o gráfico retoma nele mesmo", () => {
    expect(passoAnteriorDe("porta")).toBe("welcome");
    expect(passoAnteriorDe("quiz")).toBe("porta");
    expect(passoAnteriorDe("prova")).toBe("quiz");
    expect(passoAnteriorDe("plano_3_dias")).toBe("central");
    expect(passoAnteriorDe(STEP_GRAFICO_COM_SEM)).toBeNull();
    expect(passoAnteriorDe(STEP_GRAFICO_COM_SEM, true)).toBe("quiz");
    expect(passoAnteriorDe("notif", true)).toBe(STEP_GRAFICO_COM_SEM);
    expect(passoAnteriorDe("prova", true)).toBe("notif");
    expect(passoAnteriorDe("plano_3_dias", true)).toBe("result");
    expect(passoAnteriorDe("compromissos", true)).toBe("result");
    expect(passoAnteriorDe("porta", true)).toBe("welcome");
    expect(passoDeRetomada(STEP_GRAFICO_COM_SEM, true)).toBe(STEP_GRAFICO_COM_SEM);
    expect(passoDeRetomada(STEP_GRAFICO_COM_SEM, false)).toBeNull();
  });

  it("a retomada de quem parou no gráfico/central traduz conforme as duas chaves", () => {
    localStorage.setItem(CHAVE_FORCA_FUNIL_CALAI, "on");
    localStorage.setItem(CHAVE_FORCA_ONBOARDING_1TELA, "on");
    expect(passoDoOnboarding(passoDoFunilCalai(passoDeRetomada("result", true) ?? ""))).toBe("plano_3_dias"); // result → central → compromissos → plano
    expect(passoDoOnboarding(passoDoFunilCalai(passoDeRetomada("contrato", true) ?? ""))).toBe("plano_3_dias");
    localStorage.removeItem(CHAVE_FORCA_ONBOARDING_1TELA);
    expect(passoDoOnboarding(passoDoFunilCalai(passoDeRetomada("central", true) ?? ""))).toBe("compromissos");
    localStorage.removeItem(CHAVE_FORCA_FUNIL_CALAI);
    expect(passoDoOnboarding(passoDoFunilCalai(passoDeRetomada(STEP_GRAFICO_COM_SEM, true) ?? ""))).toBe("quiz");
  });
});

describe("lib/funil-numeros: o número dela", () => {
  it("dinheiro: a faixa vira R$/mês (gráfico); 'não faço ideia' usa a mediana (estimado); corpo vira treinos/semana (gráfico); rotina e metas viram copy; a porta 'Tudo' é dinheiro", () => {
    expect(numeroDaRotaDe("dinheiro", { gasto: "R$ 300 a R$ 500" })).toMatchObject({ rota: "dinheiro", tipo: "reais", formato: "grafico", valor: 500, rotulo: "R$ 500", estimado: false });
    expect(numeroDaRotaDe("dinheiro", { gasto: "Mais de R$ 500" })).toMatchObject({ valor: 800, rotulo: "R$ 500+", estimado: false });
    expect(numeroDaRotaDe("dinheiro", { gasto: "Não faço ideia" })).toMatchObject({ valor: MEDIANA_REAIS, estimado: true });
    expect(numeroDaRotaDe("dinheiro", {})).toMatchObject({ valor: MEDIANA_REAIS, estimado: true });
    expect(numeroDaRotaDe(null, null)).toMatchObject({ rota: "dinheiro", valor: MEDIANA_REAIS, estimado: true });
    expect(numeroDaRotaDe("corpo", { consistencia: "Perdi a conta" })).toMatchObject({ rota: "corpo", tipo: "treinos", formato: "grafico", valor: 1, rotulo: "1 treino", estimado: false });
    expect(numeroDaRotaDe("corpo", { consistencia: "Tô na ativa, mas sem controle" })).toMatchObject({ valor: 3, rotulo: "3 treinos" });
    expect(numeroDaRotaDe("corpo", {})).toMatchObject({ valor: MEDIANA_TREINOS, estimado: true });
    expect(numeroDaRotaDe("rotina", { consistencia: "Uns 3 dias" })).toMatchObject({ rota: "rotina", tipo: "copy", formato: "copy", valor: 0, copy: COPY_SEM_COM.rotina });
    expect(numeroDaRotaDe("metas", {})).toMatchObject({ rota: "metas", tipo: "copy", copy: COPY_SEM_COM.metas });
    expect(COPY_SEM_COM.rotina.sem).toEqual(["Dias que passam e nada muda", "Hábitos que você começa e abandona", "Rotina sempre pra depois"]);
    expect(COPY_SEM_COM.metas.com).toEqual(["Metas com passo a passo", "Progresso que você vê", "Sonhos com data"]);
    // a porta "Tudo, sinceramente" mora em dinheiro: o número é o de Finanças; só `portaTudo` sabe de onde veio
    const tudo = { area: "dinheiro", area_label: PORTA_TUDO.label, gasto: "R$ 100 a R$ 300" };
    expect(numeroDaRotaDe("dinheiro", tudo)).toMatchObject({ rota: "dinheiro", tipo: "reais", valor: 300 });
    expect(portaTudo(tudo)).toBe(true);
    expect(portaTudo({ area: "dinheiro", area_label: "Meu dinheiro" })).toBe(false);
  });

  it("lê das chaves do funil já gravadas (retrocompatível: as mesmas de hoje)", () => {
    guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
    guardarChave(CHAVES_FUNIL_W.respostas, { area: "dinheiro", atrapalha: "Gasto sem perceber", gasto: "R$ 100 a R$ 300" });
    expect(numeroDaRota()).toMatchObject({ rota: "dinheiro", valor: 300, rotulo: "R$ 300", estimado: false });
    guardarChave(CHAVES_FUNIL_W.area, "corpo");
    guardarChave(CHAVES_FUNIL_W.respostas, { consistencia: "Umas 2 ou 3" });
    expect(numeroDaRota()).toMatchObject({ rota: "corpo", tipo: "treinos", valor: 2 });
  });

  it("a projeção e a copy: R$ 500 → R$ 1.500 sem rastro em 3 meses; treinos: 2/sem caem pra 1 e sobem pra 3; rotina/metas sem número", () => {
    const hoje = new Date(2026, 9, 10);
    expect(mesAlvo(hoje)).toBe("janeiro");
    expect(mesAlvo(new Date(2026, 2, 1))).toBe("junho");
    const d = numeroDaRotaDe("dinheiro", { gasto: "R$ 300 a R$ 500" });
    expect(projecao(d)).toEqual({ sem: [0, 500, 1000, 1500], com: [0, 200, 275, 325] });
    const cd = copyDoGrafico(d, hoje);
    expect(cd.titulo).toBe("R$ 500 somem por mês.");
    expect(cd.subtitulo).toBe("Até janeiro, R$ 1.500 sem rastro.");
    expect(cd.cta).toBe("Quero ver pra onde vai");
    expect(copyDoGrafico(numeroDaRotaDe("dinheiro", {}), hoje).titulo).toBe("Em média, R$ 500 somem por mês.");
    const t = numeroDaRotaDe("corpo", {});
    const pt = projecao(t);
    expect(pt.sem.length).toBe(13);
    expect(pt.sem[0]).toBe(2); expect(pt.sem[12]).toBe(1);
    expect(pt.com[0]).toBe(2); expect(pt.com[4]).toBe(3); expect(pt.com[12]).toBe(3);
    const ct = copyDoGrafico(t, hoje);
    expect(ct.titulo).toBe("Sem o CORE: 2 treinos por semana viram 1 em 3 meses.");
    expect(ct.subtitulo).toBe("Com o CORE: 3 por semana, sem falhar.");
    expect(ct.cta).toBe("Quero manter o ritmo");
    const r = numeroDaRotaDe("rotina", {});
    expect(projecao(r)).toEqual({ sem: [], com: [] });
    expect(copyDoGrafico(r, hoje)).toMatchObject({ titulo: "Sua vida sem o CORE", subtitulo: "× com o CORE", cta: "Quero uma rotina que fica" });
    expect(copyDoGrafico(numeroDaRotaDe("metas", {}), hoje).cta).toBe("Quero tirar do papel");
  });
});

describe("DESLIGADA: o funil de hoje, byte a byte", () => {
  it("welcome da grade azul → promessas; 7 itens no quiz de dinheiro; nenhum evento novo", async () => {
    montar("/funil-w");
    await tick();
    expect(screen.getByTestId("welcome-antiga")).toBeInTheDocument();
    expect(screen.queryByTestId("welcome-calai")).toBeNull();
    expect(eventos).toContainEqual(["funnel_view", { step: "welcome", funil: "w" }]);
    fireEvent.click(screen.getByTestId("welcome-antiga"));
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "promessas" })]);
    expect(screen.getByLabelText("Pular apresentação")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Pular apresentação"));
    expect(screen.getByText("Qual área da sua vida tá mais fora de controle hoje?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    // pergunta 1 → 2 → notificação → 3 → prova → 4 → 5 → prova social (os 7 itens de hoje)
    expect(screen.getByText("O que mais te atrapalha hoje?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Gasto sem perceber"));
    expect(screen.getByText("Como você controla seu dinheiro hoje?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Não controlo"));
    expect(screen.getByText("O CORE te avisa antes da conta vencer")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Agora não"));
    await tick();
    expect(screen.getByText("Quanto você acha que gasta sem perceber, por mês?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("R$ 300 a R$ 500"));
    expect(screen.getByText(/somem por mês/)).toBeInTheDocument(); // a prova do gasto de hoje
    expect(screen.queryByTestId("grafico-com-sem")).toBeNull();
    expect(nomes().some((n) => /grafico_com_sem|welcome_video/.test(n))).toBe(false);
    expect(viewsDe("quiz_2").length).toBe(1);
    expect(viewsDe("quiz_extra").length).toBe(1);
    expect(viewsDe("quiz_proof").length).toBe(1);
  });
});

describe("LIGADA: a sequência enxuta", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_FORCA_FUNIL_CALAI, "on"); localStorage.setItem(CHAVE_FORCA_ONBOARDING_1TELA, "on"); });

  it("welcome com vídeo → porta (sem promessas) → quiz_1 → quiz_3 → gráfico {rota, numero} → notificação → prova → progress → result → plano → paywall", async () => {
    vi.useFakeTimers();
    try {
      montar("/funil-w");
      await tick();
      const welcome = screen.getByTestId("welcome-calai");
      expect(welcome).toHaveTextContent("Sua vida inteira organizada num app só.");
      expect(screen.getByTestId("welcome-video")).toHaveAttribute("src", "/funil/welcome-app.mp4");
      expect(screen.getByTestId("welcome-video")).toHaveAttribute("poster", "/funil/welcome-app.jpg");
      expect(screen.getByTestId("welcome-video")).toHaveAttribute("loop");
      expect(screen.getByTestId("welcome-video")).toHaveAttribute("playsinline");
      expect(eventos).toContainEqual(["funnel_view", { step: "welcome", funil: "w", video: true }]);
      expect(eventos).toContainEqual(["app_welcome_view", { calai: true }]);
      // 10/10 (dono): "Já tem conta? Entrar" ABAIXO do Começar, como o Cal AI; sem termos, sem
      // "Restaurar compras" (foi pra tela de Entrar), sem "Já é cliente?"
      const entrar = screen.getByText(/Já tem conta\?/).closest("button")!;
      const comecar = screen.getByTestId("welcome-comecar");
      expect(comecar.compareDocumentPosition(entrar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByText(/Termos e Aviso de Privacidade/)).toBeNull();
      expect(screen.queryByText(/Restaurar compras/)).toBeNull();
      expect(screen.queryByText(/Já é cliente/)).toBeNull();
      // o vídeo rodou / falhou
      fireEvent.playing(screen.getByTestId("welcome-video"));
      expect(eventos).toContainEqual(["welcome_video_play", {}]);

      // Começar: pede o ATT (como hoje) e cai DIRETO na porta
      const { pedirRastreamentoIos } = await import("@/lib/att-ios");
      fireEvent.click(screen.getByTestId("welcome-comecar"));
      await tick(); await tick();
      expect(pedirRastreamentoIos).toHaveBeenCalledWith("welcome");
      expect(eventos).toContainEqual(["app_welcome_start", { calai: true }]);
      expect(screen.queryByLabelText("Pular apresentação")).toBeNull();
      expect(nomes()).not.toContain("funnel_view:promessas");
      expect(screen.getByText("Qual área da sua vida tá mais fora de controle hoje?")).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "start" })]);
      fireEvent.click(screen.getByText("Meu dinheiro"));

      // só 2 perguntas: quiz_1 e quiz_3 (os nomes de hoje)
      expect(screen.getByText("O que mais te atrapalha hoje?")).toBeInTheDocument();
      expect(viewsDe("quiz_1").length).toBe(1);
      fireEvent.click(screen.getByText("Gasto sem perceber"));
      expect(screen.queryByText("Como você controla seu dinheiro hoje?")).toBeNull();
      expect(screen.getByText("Quanto você acha que gasta sem perceber, por mês?")).toBeInTheDocument();
      expect(viewsDe("quiz_3").length).toBe(1);
      expect(viewsDe("quiz_2").length).toBe(0);
      fireEvent.click(screen.getByText("R$ 300 a R$ 500"));

      // o gráfico com o número dela
      const grafico = screen.getByTestId("grafico-com-sem");
      expect(grafico).toHaveAttribute("data-rota", "dinheiro");
      expect(grafico).toHaveAttribute("data-numero", "500");
      expect(screen.getByTestId("grafico-titulo")).toHaveTextContent("R$ 500 somem por mês.");
      expect(screen.getByTestId("grafico-titulo")).toHaveTextContent(`Até ${mesAlvo()}, R$ 1.500 sem rastro.`);
      expect(screen.getByTestId("grafico-sem-valor")).toHaveTextContent("R$ 1.500");
      expect(screen.getByTestId("grafico-com-valor")).toHaveTextContent("R$ 325");
      expect(screen.getByText("Com o CORE você vê pra onde vai cada real.")).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "grafico_com_sem", funil: "w", area: "dinheiro", rota: "dinheiro", formato: "grafico", numero: 500, estimado: false })]);
      expect(grafico).toHaveAttribute("data-formato", "grafico");
      expect(screen.queryByTestId("abertura-tudo")).toBeNull();
      expect(nomes()).not.toContain("funnel_view:quiz_proof");
      expect(JSON.parse(localStorage.getItem(CHAVES_FUNIL_W.passo) ?? "{}").v).toBe("grafico_com_sem");
      expect(numeroDaRota()).toMatchObject({ rota: "dinheiro", valor: 500 }); // a lib pura lê o que o funil gravou
      fireEvent.click(screen.getByTestId("grafico-quero-ver"));
      expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "grafico_quero_ver", rota: "dinheiro", numero: 500 })]);

      // notificação DEPOIS do gráfico, como passo próprio (a mesma tela de hoje)
      expect(screen.getByText("O CORE te avisa antes da conta vencer")).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "notif" })]);
      expect(nomes()).not.toContain("funnel_view:quiz_extra");
      fireEvent.click(screen.getByText("Agora não"));
      await tick();

      // prova social → progress → result
      expect(screen.getByText("Montar meu plano")).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "prova" })]);
      fireEvent.click(screen.getByText("Montar meu plano"));
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "progress" })]);
      // o loading encadeia um setTimeout por etapa (cada um nasce no re-render): anda passo a passo
      for (let i = 0; i < 8; i++) await act(async () => { vi.advanceTimersByTime(900); });
      expect(screen.getByText(/Seu mapa da vida/)).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "result" })]);
      // sem central nem demo: o botão leva pro plano
      expect(screen.queryByText("Ver minha central")).toBeNull();
      fireEvent.click(screen.getByText("Montar meu plano"));
      expect(screen.getByTestId("plano-3-dias")).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "plano_3_dias" })]);
      expect(nomes().some((n) => /funnel_view:central|funnel_view:demo/.test(n))).toBe(false);
      fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
      await tick();
      expect(screen.getByTestId("paywall-w")).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it("porta 'Tudo, sinceramente': o caminho de Finanças (quiz_1 + quiz_3, linha de abertura, gráfico em R$ com area=tudo no evento, plano de Finanças)", async () => {
    montar("/funil-w");
    await tick();
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await tick(); await tick();
    fireEvent.click(screen.getByText(PORTA_TUDO.label));
    expect(screen.getByTestId("abertura-tudo")).toHaveTextContent(ABERTURA_TUDO);
    expect(screen.getByText("O que mais te atrapalha hoje?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Gasto sem perceber"));
    expect(screen.getByText("Quanto você acha que gasta sem perceber, por mês?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("R$ 100 a R$ 300"));
    const grafico = screen.getByTestId("grafico-com-sem");
    expect(grafico).toHaveAttribute("data-rota", "dinheiro");
    expect(grafico).toHaveAttribute("data-formato", "grafico");
    expect(screen.getByTestId("grafico-titulo")).toHaveTextContent("R$ 300 somem por mês.");
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "grafico_com_sem", area: "tudo", rota: "dinheiro", formato: "grafico", numero: 300 })]);
    expect(eventos).toContainEqual(["funnel_quiz_answer", expect.objectContaining({ step: "porta", answer: PORTA_TUDO.label })]);
    fireEvent.click(screen.getByTestId("grafico-quero-ver"));
    expect(screen.getByText("O CORE te avisa antes da conta vencer")).toBeInTheDocument(); // a notificação de Finanças
    fireEvent.click(screen.getByText("Agora não"));
    await tick();
    // o loading encadeia setTimeouts: os timers falsos têm que estar ligados ANTES de ele montar
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText("Montar meu plano"));
      for (let i = 0; i < 8; i++) await act(async () => { vi.advanceTimersByTime(900); });
    } finally { vi.useRealTimers(); }
    expect(screen.getByText(/Seu mapa da vida/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Montar meu plano"));
    // o plano de FINANÇAS (os compromissos da rota dinheiro)
    expect(screen.getByTestId("plano-3-dias-chip-1")).toHaveTextContent("Saber pra onde meu dinheiro vai");
  });

  it("rota treino: quiz_1 + quiz_2 e o gráfico de treinos por semana", async () => {
    montar("/funil-w");
    await tick();
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await tick(); await tick();
    fireEvent.click(screen.getByText("Treino e alimentação"));
    fireEvent.click(screen.getByText("Começo a treinar e desisto"));
    expect(screen.getByText("Quantas vezes você já recomeçou treino ou dieta?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Perdi a conta"));
    const grafico = screen.getByTestId("grafico-com-sem");
    expect(grafico).toHaveAttribute("data-rota", "corpo");
    expect(grafico).toHaveAttribute("data-formato", "grafico");
    expect(grafico).toHaveAttribute("data-numero", "1");
    expect(screen.getByTestId("grafico-titulo")).toHaveTextContent("Sem o CORE: 1 treino por semana somem em 3 meses.");
    expect(screen.getByTestId("grafico-titulo")).toHaveTextContent("Com o CORE: 3 por semana, sem falhar.");
    expect(screen.getByTestId("grafico-com-valor")).toHaveTextContent("3/sem");
    expect(screen.getByText("Quero manter o ritmo")).toBeInTheDocument();
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "grafico_com_sem", rota: "corpo", formato: "grafico", numero: 1 })]);
  });

  it("rota metas: a tela de copy 'sem × com' (sem número)", async () => {
    montar("/funil-w");
    await tick();
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await tick(); await tick();
    fireEvent.click(screen.getByText("Minhas metas paradas"));
    fireEvent.click(screen.getByText("Ficam na cabeça, nunca no papel"));
    fireEvent.click(screen.getByText("Uns meses"));
    const grafico = screen.getByTestId("grafico-com-sem");
    expect(grafico).toHaveAttribute("data-rota", "metas");
    expect(grafico).toHaveAttribute("data-formato", "copy");
    expect(screen.getByTestId("grafico-card-sem")).toHaveTextContent("Objetivos que ficam só na cabeça");
    expect(screen.getByTestId("grafico-card-com")).toHaveTextContent("Sonhos com data");
    expect(screen.queryByTestId("grafico-sem-valor")).toBeNull();
    expect(screen.getByText("Quero tirar do papel")).toBeInTheDocument();
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "grafico_com_sem", rota: "metas", formato: "copy" })]);
  });

  it("rota rotina: quiz_1 + quiz_2 (consistência) e a tela de copy 'sem × com'; sem ONBOARDING_1TELA o resultado cai nos compromissos de hoje", async () => {
    localStorage.removeItem(CHAVE_FORCA_ONBOARDING_1TELA);
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    guardarChave(CHAVES_FUNIL_W.respostas, { area: "rotina", atrapalha: "Acordo sem plano nenhum", consistencia: "Uns 3 dias" });
    guardarChave(CHAVES_FUNIL_W.passo, "result");
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    try {
      montar("/app");
      await tick();
      // result → central (hoje) → compromissos (chave calai) → é o passo de retomada
      expect(screen.getByText("Claro!")).toBeInTheDocument();
      expect(screen.getByText("Você quer um dia que se organiza sozinho?")).toBeInTheDocument();
      expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "compromissos", retomada: true })]);
    } finally { delete (window as { Capacitor?: unknown }).Capacitor; }
    cleanup();
    eventos.length = 0;
    localStorage.removeItem(CHAVES_FUNIL_W.passo);
    localStorage.removeItem(CHAVES_FUNIL_W.area);
    localStorage.removeItem(CHAVES_FUNIL_W.respostas);
    montar("/funil-w");
    await tick();
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await tick(); await tick();
    fireEvent.click(screen.getByText("Minha rotina e hábitos"));
    expect(screen.getByText("O que mais bagunça sua rotina hoje?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Acordo sem plano nenhum"));
    expect(screen.getByText("Quanto tempo você costuma manter um hábito novo?")).toBeInTheDocument();
    expect(viewsDe("quiz_2").length).toBe(1);
    fireEvent.click(screen.getByText("Uns 3 dias"));
    const grafico = screen.getByTestId("grafico-com-sem");
    expect(grafico).toHaveAttribute("data-rota", "rotina");
    expect(grafico).toHaveAttribute("data-formato", "copy");
    expect(screen.getByTestId("grafico-titulo")).toHaveTextContent("Sua vida sem o CORE");
    expect(screen.getByTestId("grafico-card-sem")).toHaveTextContent("Hábitos que você começa e abandona");
    expect(screen.getByTestId("grafico-card-com")).toHaveTextContent("Sequência que você não quer perder");
    expect(screen.queryByTestId("grafico-linha-sem")).toBeNull();
    expect(screen.getByText("Quero uma rotina que fica")).toBeInTheDocument();
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "grafico_com_sem", rota: "rotina", formato: "copy" })]);
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "grafico_com_sem", area: "rotina" })]);
    fireEvent.click(screen.getByTestId("grafico-quero-ver"));
    expect(screen.getByText("O CORE te lembra do hábito na hora certa")).toBeInTheDocument();
  });

  it("a welcome com a rota já conhecida fala da rota; o vídeo que não carrega conta welcome_video_erro e fica no poster", async () => {
    guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
    montar("/funil-w");
    await tick();
    expect(screen.getByTestId("welcome-calai")).toHaveTextContent("Seu dinheiro inteiro, num app só.");
    fireEvent.error(screen.getByTestId("welcome-video"));
    expect(eventos).toContainEqual(["welcome_video_erro", expect.objectContaining({ motivo: "carregar" })]);
    expect(screen.getByTestId("welcome-video")).toHaveAttribute("data-falhou");
  });

  it("20/10 (Modo Pouca Energia): a capa cobre o vídeo desde o início (sem o play do iOS); sem rodar em 1,2 s entra o vídeo em WebP animado; rodando, a capa sai", async () => {
    vi.useFakeTimers();
    try {
      montar("/funil-w");
      await tick();
      const capa = screen.getByTestId("welcome-cobre");
      const imgs = Array.from(capa.querySelectorAll("img")).map((i) => i.getAttribute("src"));
      expect(imgs).toEqual(["/funil/welcome-app.jpg", "/funil/welcome-app.webp"]);
      expect(capa).not.toHaveAttribute("data-animado");
      await act(async () => { vi.advanceTimersByTime(1300); });
      expect(screen.getByTestId("welcome-cobre")).toHaveAttribute("data-animado");
      fireEvent.playing(screen.getByTestId("welcome-video"));
      expect(screen.queryByTestId("welcome-cobre")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
