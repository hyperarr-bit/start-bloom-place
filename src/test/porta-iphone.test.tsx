/**
 * PORTA iPHONE (/comece, 10/10) — anúncio → perguntas → plano → CONTA NO SITE
 * (campanha gravada nela) → App Store → "Entrar" no app.
 *
 * O que não pode quebrar:
 *   · as perguntas 2 e 3 são as MESMAS do funil novo do app, área por área (v2, dono);
 *   · o com × sem usa o número da resposta (R$ do gasto dela, treinos), como o app;
 *   · o fluxo inteiro, com o app nativo NUNCA montando /comece;
 *   · conta: Apple, Google (no Instagram: aviso, sem OAuth) e e-mail + senha, sem código;
 *     e-mail que já existe entra com a senha, NUNCA vira 2ª conta;
 *   · a atribuição é capturada na 1ª carga e sobrevive ao Instagram zerar o storage;
 *   · user_metadata.porta só é gravado se AUSENTE;
 *   · nenhum PREÇO do produto em tela nenhuma; "dias grátis" só na tela 7;
 *   · os eventos saem com os campos certos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
type U = { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean } = { user: null, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getUser = vi.fn();
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/pages/porta/navegar", () => ({ irPraLoja: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: vi.fn(async () => ({ error: null })), entrarComApple: vi.fn(async () => ({ error: null })) }));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { entrarComApple, entrarComGoogle } from "@/lib/auth-nativo";
import PortaIphoneRota, { _zerarEstadoPorta } from "@/pages/porta/PortaIphone";
import { _zerarMemoriaPorta, capturarAtribuicao, decidirGravacao, lerAtribuicao, sessaoDaPorta, CHAVE_ATTR, COOKIE_ATTR } from "@/pages/porta/atribuicao";
import { DIAS_POR_AREA, PERGUNTA_DOR, mesAlvo, planoDe3Dias, type AreaPorta } from "@/pages/porta/conteudo";

/* ---------------------------------------------------------------- ambiente */
const UA = {
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 390.0.0.28.85 (iPhone15,3; iOS 18_5; pt_BR; pt; scale=3.00; 1290x2796; 721384054)",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15",
};
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const QUERY_AD = "?utm_source=meta&utm_medium=paid&utm_campaign=porta_teste&utm_content=video_organizei&utm_term=t1&c_id=111&as_id=222&ad_id=333&pl=Instagram_Reels&fbclid=IwAR_abc";
const irPara = (url: string) => window.history.replaceState({}, "", url);
const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};
const limparCookies = () => {
  for (const c of document.cookie.split(";")) {
    const n = c.split("=")[0].trim();
    if (n) document.cookie = `${n}=; Max-Age=0; Path=/`;
  }
};
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}</p>; };
const montar = () => render(
  <MemoryRouter initialEntries={["/comece"]}>
    <Routes>
      <Route path="/comece" element={<PortaIphoneRota />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
);
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const texto = () => document.body.textContent ?? "";
/** PREÇO DO PRODUTO (97,90 / 24,90 / 69,90 / 19,90 / anual / mensal / assinatura): nunca. Gasto da pessoa em R$ pode. */
const PRECO_DO_PRODUTO = /\d+,90|\banual\b|\bmensal\b|mensalidade|assinatura|por ano|\/ano|\/mês/i;
const conferirCopy = () => {
  expect(texto()).not.toMatch(PRECO_DO_PRODUTO);
  if (!screen.queryByTestId("porta-salvo")) expect(texto()).not.toMatch(/dias? grátis/i);
};
const escolher = async (id: string, proxima: string) => {
  fireEvent.click(screen.getByTestId(`porta-opcao-${id}`));
  await waitFor(() => expect(screen.getByTestId(proxima)).toBeInTheDocument());
  conferirCopy();
};
const rotulos = (testid: string) => Array.from(screen.getByTestId(testid).querySelectorAll("[data-testid^='porta-opcao-'] span.block:first-child")).map((n) => n.textContent);
const usuario = (over: Partial<U> = {}): U => ({ id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {}, ...over });

/** até a tela da conta, numa área, com as respostas dadas */
const ateConta = async (area: string, dor: string, numero: string) => {
  montar();
  fireEvent.click(screen.getByTestId("porta-comecar"));
  await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
  await escolher(area, "porta-p2");
  await escolher(dor, "porta-p3");
  await escolher(numero, "porta-comsem");
  fireEvent.click(screen.getByTestId("porta-comsem-cta"));
  await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
  fireEvent.click(screen.getByTestId("porta-desbloquear"));
  await waitFor(() => expect(screen.getByTestId("porta-conta")).toBeInTheDocument());
  conferirCopy();
};
const preencherSenha = (email: string, senha: string) => {
  fireEvent.change(screen.getByTestId("porta-email"), { target: { value: email } });
  fireEvent.change(screen.getByTestId("porta-senha"), { target: { value: senha } });
};

beforeEach(() => {
  _zerarMemoriaPorta();
  _zerarEstadoPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  limparCookies();
  nativo(false);
  authState.user = null;
  authState.loading = false;
  [getUser, signUp, signInWithPassword, updateUser, signOut].forEach((f) => f.mockReset());
  vi.mocked(trackEvent).mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  vi.mocked(entrarComGoogle).mockClear();
  vi.mocked(entrarComApple).mockClear();
  updateUser.mockResolvedValue({ data: {}, error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement["play"];
  ua(UA.instagram);
  irPara(`/comece${QUERY_AD}`);
});
afterEach(() => { cleanup(); nativo(false); irPara("/"); });

/* ---------------------------------------------------------------- rota */
describe("rota", () => {
  it("o app nativo NUNCA monta /comece (vai pra porta do app)", () => {
    nativo(true);
    montar();
    expect(screen.getByTestId("onde").textContent).toBe("/app");
    expect(screen.queryByTestId("porta-welcome")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("App.tsx: /comece só na web (SoNaWeb) e o paywall global não monta por cima", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    const banner = readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8");
    expect(banner).toContain('location.pathname.startsWith("/comece")');
  });

  it("noindex enquanto a Porta está montada", () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-porta]')?.getAttribute("content")).toMatch(/noindex/);
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-porta]')).toBeNull();
  });
});

/* ---------------------------------------------------------------- perguntas = as do app */
/** Copiadas do funil novo do app (ramo v14: lib/funnel QUIZ + AREA_TRACKS; FUNIL_CALAI = quiz_1 + o número). */
const DO_APP: Record<AreaPorta, { dor: [string, string[]]; numero: [string, string[]] }> = {
  dinheiro: {
    dor: ["O que mais te atrapalha hoje?", ["Gasto sem perceber", "Esqueço contas", "Não consigo guardar dinheiro", "Não sei pra onde meu dinheiro vai", "Quero organizar tudo"]],
    numero: ["Quanto você acha que gasta sem perceber, por mês?", ["Menos de R$ 100", "R$ 100 a R$ 300", "R$ 300 a R$ 500", "Mais de R$ 500", "Não faço ideia"]],
  },
  rotina: {
    dor: ["O que mais bagunça sua rotina hoje?", ["Acordo sem plano nenhum", "Perco horas no celular", "Começo mil coisas e não termino", "Esqueço tarefas e compromissos", "Quero organizar tudo"]],
    numero: ["Quanto tempo você costuma manter um hábito novo?", ["Uns 3 dias", "Uma semana", "Um mês, aí largo", "Nunca consegui manter"]],
  },
  corpo: {
    dor: ["O que mais te trava hoje?", ["Começo a treinar e desisto", "Como mal e nem percebo", "Não tenho plano de treino nem dieta", "Falta constância, não vontade", "Quero organizar tudo"]],
    numero: ["Quantas vezes você já recomeçou treino ou dieta?", ["Essa vai ser a primeira", "Umas 2 ou 3", "Perdi a conta", "Tô na ativa, mas sem controle"]],
  },
  saude: {
    dor: ["O que você mais negligencia hoje?", ["Beber água", "Dormir direito", "Vitaminas e remédios na hora", "Exames e check-ups", "Um pouco de tudo"]],
    numero: ["Como seu corpo anda te avisando?", ["Cansaço o dia todo", "Sono ruim", "Ansiedade e estresse", "Tô bem — quero prevenir"]],
  },
  metas: {
    dor: ["O que acontece com as suas metas?", ["Ficam na cabeça, nunca no papel", "Empolgo em janeiro, esqueço em março", "Tenho tantas que não sei por onde começar", "Sinto que não saio do lugar", "Quero organizar tudo"]],
    numero: ["Quanto tempo faz que essa meta te espera?", ["Surgiu agora", "Uns meses", "Mais de um ano", "Anos… nem conto mais"]],
  },
};

describe("perguntas 2 e 3 são as MESMAS do funil do app, área por área", () => {
  for (const area of Object.keys(DO_APP) as AreaPorta[]) {
    it(area, async () => {
      montar();
      fireEvent.click(screen.getByTestId("porta-comecar"));
      await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
      await escolher(area, "porta-p2");
      expect(screen.getByTestId("porta-pergunta").textContent).toBe(DO_APP[area].dor[0]);
      expect(rotulos("porta-p2")).toEqual(DO_APP[area].dor[1]);
      fireEvent.click(screen.getAllByRole("listitem")[0]);
      await waitFor(() => expect(screen.getByTestId("porta-p3")).toBeInTheDocument());
      expect(screen.getByTestId("porta-pergunta").textContent).toBe(DO_APP[area].numero[0]);
      expect(rotulos("porta-p3")).toEqual(DO_APP[area].numero[1]);
      conferirCopy();
    });
  }

  it("'Tudo' segue pelo dinheiro, com a linha de abertura do app em cima", async () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("tudo", "porta-p2");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que mais te atrapalha hoje?");
    expect(screen.getByTestId("porta-abertura-tudo").textContent).toBe("Vamos começar pelo mais importante: o dinheiro. Rotina e saúde entram nos dias 2 e 3.");
    expect(eventos("porta_passo").at(-1)).toMatchObject({ passo: "area", area: "tudo", resposta: "tudo" });
  });
});

describe("com × sem usa o número da resposta (como o GraficoComSem do app)", () => {
  it("'R$ 100 a R$ 300' → R$ 300 por mês, R$ 900 em 3 meses", async () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("dinheiro", "porta-p2");
    await escolher("gasto_sem_perceber", "porta-p3");
    await escolher("100_300", "porta-comsem");
    expect(screen.getByTestId("porta-comsem").getAttribute("data-tipo")).toBe("reais");
    expect(screen.getByTestId("porta-comsem-titulo").textContent).toBe(`R$ 300 somem por mês.Até ${mesAlvo(new Date())}, R$ 900 sem rastro.`);
    expect(screen.getByTestId("porta-grafico-sem").textContent).toBe("R$ 900");
  });

  it("'Não faço ideia' → a mediana estimada do app (R$ 500, 'Em média')", async () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("dinheiro", "porta-p2");
    await escolher("esqueco_contas", "porta-p3");
    await escolher("nao_sei", "porta-comsem");
    expect(screen.getByTestId("porta-comsem-titulo").textContent).toContain("Em média, R$ 500 somem por mês.");
    expect(screen.getByTestId("porta-grafico-sem").textContent).toBe("R$ 1.500");
  });

  it("Corpo: gráfico de treinos por semana da resposta ('Perdi a conta' = 1 treino)", async () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("corpo", "porta-p2");
    await escolher("desisto", "porta-p3");
    await escolher("perdi_a_conta", "porta-comsem");
    expect(screen.getByTestId("porta-comsem").getAttribute("data-tipo")).toBe("treinos");
    expect(screen.getByTestId("porta-comsem-titulo").textContent).toBe("Sem o CORE: 1 treino por semana somem em 3 meses.Com o CORE: 3 por semana, sem falhar.");
    expect(screen.getByTestId("porta-grafico-com").textContent).toBe("3/sem");
  });
});

/* ---------------------------------------------------------------- fluxo inteiro */
describe("fluxo inteiro — DINHEIRO, no Instagram do iPhone, conta nova por e-mail e senha", () => {
  it("8 telas, Google bloqueado com aviso, conta criada com a campanha, CompleteRegistration, loja e volta da aba", async () => {
    montar();
    // 0. welcome
    expect(screen.getByTestId("porta-welcome-titulo").textContent).toBe("Sua vida inteira organizada num app só.");
    expect(texto()).toContain("+1000 pessoas");
    expect(screen.getByTestId("porta-welcome-entrar").textContent).toBe("Já tem conta? Entrar");
    conferirCopy();
    const view = eventos("porta_view")[0];
    expect(view).toMatchObject({ utm_source: "meta", utm_campaign: "porta_teste", utm_content: "video_organizei", c_id: "111", as_id: "222", ad_id: "333", pl: "Instagram_Reels", fbclid: "IwAR_abc", atribuicao: "url", in_app: true, plataforma: "ios" });
    expect(String(view.fbc)).toMatch(/^fb\.1\.\d{13}\.IwAR_abc$/);
    expect(fireMetaEvent).toHaveBeenCalledWith("ViewContent", expect.objectContaining({ content_name: "porta_iphone" }));

    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("dinheiro", "porta-p2");
    await escolher("gasto_sem_perceber", "porta-p3");
    await escolher("300_500", "porta-comsem");
    fireEvent.click(screen.getByTestId("porta-comsem-cta"));
    // 5. plano: Dia 1 da DOR, dias 2 e 3 = os degraus do app que ela não cobre
    await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
    expect(screen.getByTestId("porta-plano-dia1").textContent).toContain("Anota os gastos de hoje e vê quanto somam");
    expect(screen.getByTestId("porta-plano-dia1").textContent).toContain("Porque você disse: “Gasto sem perceber”");
    expect(screen.getByTestId("porta-plano-dia2").textContent).toContain(DIAS_POR_AREA.dinheiro[1]);
    expect(screen.getByTestId("porta-plano-dia3").textContent).toContain(DIAS_POR_AREA.dinheiro[2]);
    fireEvent.click(screen.getByTestId("porta-desbloquear"));

    // 6. conta: Apple e Google visíveis; Google no Instagram = aviso, sem OAuth
    await waitFor(() => expect(screen.getByTestId("porta-conta")).toBeInTheDocument());
    expect(screen.getByTestId("porta-apple").textContent).toContain("Continuar com a Apple");
    expect(screen.getByTestId("porta-google").textContent).toContain("Continuar com o Google");
    expect(screen.queryByTestId("porta-codigo")).toBeNull();
    fireEvent.click(screen.getByTestId("porta-google"));
    expect(entrarComGoogle).not.toHaveBeenCalled();
    expect(screen.getByTestId("porta-aviso-google").textContent).toBe("O Google não deixa entrar por dentro do Instagram. Toque em ⋯ no alto e em Abrir no navegador. Ou use a Apple ou o e-mail.");
    expect(eventos("porta_google_bloqueado")[0]).toMatchObject({ app: "Instagram", ad_id: "333" });
    // as respostas e a sessão foram pra URL, pra irem junto no "Abrir no navegador"
    const q = new URLSearchParams(window.location.search);
    expect(JSON.parse(q.get("pe")!)).toMatchObject({ escolha: "dinheiro", p2: "gasto_sem_perceber", p3: "300_500" });
    expect(q.get("ps")).toBe(view.porta_session_id);
    expect(q.get("utm_campaign")).toBe("porta_teste");
    conferirCopy();

    // e-mail + senha (sem código)
    expect((screen.getByTestId("porta-criar-conta") as HTMLButtonElement).disabled).toBe(true);
    preencherSenha(" Ana@Exemplo.com ", "12345");
    expect((screen.getByTestId("porta-criar-conta") as HTMLButtonElement).disabled).toBe(true); // senha < 6
    fireEvent.change(screen.getByTestId("porta-senha"), { target: { value: "segredo1" } });
    let portaEnviada: Record<string, unknown> | null = null;
    signUp.mockImplementation(async (arg: { options: { data: { porta: Record<string, unknown> } } }) => {
      portaEnviada = arg.options.data.porta;
      return { data: { user: { id: "u-1" }, session: { access_token: "x" } }, error: null };
    });
    getUser.mockImplementation(async () => ({ data: { user: usuario({ user_metadata: { porta: portaEnviada } }) } }));
    fireEvent.click(screen.getByTestId("porta-criar-conta"));

    // 7. pronto
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(signUp).toHaveBeenCalledTimes(1);
    const cad = signUp.mock.calls[0][0] as { email: string; password: string; options: { data: { porta: Record<string, any> } } };
    expect(cad.email).toBe("ana@exemplo.com");
    expect(cad.password).toBe("segredo1");
    const porta = cad.options.data.porta;
    expect(porta.attr).toMatchObject({ utm_campaign: "porta_teste", utm_content: "video_organizei", c_id: "111", as_id: "222", ad_id: "333", pl: "Instagram_Reels", fbclid: "IwAR_abc", origem: "url" });
    expect(porta.respostas).toEqual({ area: "dinheiro", rota: "dinheiro", p2: "gasto_sem_perceber", p3: "300_500", atrapalha: "Gasto sem perceber", gasto: "R$ 300 a R$ 500" });
    expect(porta.metodo).toBe("senha");
    expect(porta.porta_session_id).toBe(view.porta_session_id);
    expect(updateUser).not.toHaveBeenCalled(); // a porta nasceu junto com a conta
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(fireMetaEvent).toHaveBeenCalledWith("CompleteRegistration", expect.objectContaining({ content_name: "porta_iphone" }), porta.event_id);
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "senha", ad_id: "333" });
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "senha", existente: false, event_id: porta.event_id, gravou: false, ad_id: "333" });
    conferirCopy();
    expect(screen.getByTestId("porta-salvo-titulo").textContent).toBe("Pronto, seu plano está salvo ✓");
    expect(screen.getByTestId("porta-salvo-email").textContent).toContain("ana@exemplo.com");
    expect(screen.getByTestId("porta-salvo-texto").textContent).toBe("Baixe o CORE, toque em “Entrar” com este e-mail e comece seus 3 dias grátis.");
    expect(screen.getByTestId("porta-passo-3").textContent).toContain("Digite este e-mail e a sua senha");
    expect(screen.getByTestId("porta-passo-3").querySelector("img")?.getAttribute("src")).toBe("/porta/entrar-senha-ios.jpg");
    const loja = screen.getByTestId("porta-loja");
    expect(loja.getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei");
    fireEvent.click(loja);
    expect(trackEventBeacon).toHaveBeenCalledWith("porta_loja_click", expect.objectContaining({ plataforma: "ios", loja: "ios", ad_id: "333", porta_session_id: view.porta_session_id }));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("porta-salvo-titulo").textContent).toBe("Já instalou? Abra o CORE e toque em Entrar");
    expect(eventos("porta_voltou_aba")).toHaveLength(1);

    expect(eventos("porta_passo").map((e) => [e.passo, e.area, e.resposta])).toEqual([
      ["welcome", null, "comecar"],
      ["area", "dinheiro", "dinheiro"],
      ["p2", "dinheiro", "Gasto sem perceber"],
      ["p3", "dinheiro", "R$ 300 a R$ 500"],
      ["comsem", "dinheiro", "seguir"],
      ["plano", "dinheiro", "desbloquear"],
    ]);
  });

  it("'Abrir no navegador': a URL com pe/ps abre direto na conta, com as respostas e a MESMA sessão", async () => {
    ua(UA.safari);
    const pe = JSON.stringify({ escolha: "dinheiro", p2: "esqueco_contas", p3: "mais_500", eventId: "porta_cr_abc12345" });
    irPara(`/comece${QUERY_AD}&pe=${encodeURIComponent(pe)}&ps=sessao-do-instagram-1`);
    montar();
    expect(screen.getByTestId("porta-conta")).toBeInTheDocument();
    expect(sessaoDaPorta().id).toBe("sessao-do-instagram-1");
    fireEvent.click(screen.getByTestId("porta-google"));
    await waitFor(() => expect(entrarComGoogle).toHaveBeenCalledTimes(1)); // no Safari o Google vai
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "google", porta_session_id: "sessao-do-instagram-1" });
  });
});

describe("ROTINA no Safari, conta pelo Google; Apple; Android", () => {
  it("copy no com × sem, Dia 1 da dor, Google sai e volta pra tela 7 com a porta gravada", async () => {
    ua(UA.safari);
    await ateConta("rotina", "sem_plano", "semana");
    expect(eventos("porta_passo").find((e) => e.passo === "p3")?.resposta).toBe("Uma semana");
    fireEvent.click(screen.getByTestId("porta-google"));
    await waitFor(() => expect(entrarComGoogle).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("porta-aviso-google")).toBeNull();
    expect(localStorage.getItem("core-auth-next")).toBe("/comece?passo=voltou");
    cleanup();

    _zerarMemoriaPorta();
    _zerarEstadoPorta();
    irPara("/comece?passo=voltou");
    const u = usuario({ email: "rotina@gmail.com", user_metadata: { full_name: "Ana" } });
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    montar();
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    const gravada = (updateUser.mock.calls[0][0] as { data: { porta: Record<string, any> } }).data.porta;
    expect(gravada.attr).toMatchObject({ utm_campaign: "porta_teste", ad_id: "333", fbclid: "IwAR_abc" });
    expect(gravada.respostas).toEqual({ area: "rotina", rota: "rotina", p2: "sem_plano", p3: "semana", atrapalha: "Acordo sem plano nenhum", consistencia: "Uma semana" });
    expect(gravada.metodo).toBe("google");
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "google", existente: false, gravou: true });
    expect(fireMetaEvent).toHaveBeenCalledWith("CompleteRegistration", expect.anything(), gravada.event_id);
    expect(screen.getByTestId("porta-passo-3").textContent).toContain("Continuar com Google");
    expect(screen.getByTestId("porta-passo-3").querySelector("img")?.getAttribute("src")).toBe("/porta/entrar-google-ios.jpg");
  });

  it("Apple chama entrarComApple (também dentro do Instagram) e volta como método apple", async () => {
    await ateConta("saude", "agua", "sono_ruim");
    fireEvent.click(screen.getByTestId("porta-apple"));
    await waitFor(() => expect(entrarComApple).toHaveBeenCalledTimes(1));
    expect(entrarComGoogle).not.toHaveBeenCalled();
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "apple" });
    cleanup();
    _zerarMemoriaPorta();
    _zerarEstadoPorta();
    irPara("/comece?passo=voltou");
    const u = usuario({ email: "x1y2@privaterelay.appleid.com" });
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    montar();
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "apple", existente: false });
    expect(screen.getByTestId("porta-passo-3").textContent).toContain("Continuar com a Apple");
  });

  it("Android: sem o botão da Apple (o app Android não entra com a Apple)", async () => {
    ua(UA.android);
    await ateConta("metas", "na_cabeca", "ano");
    expect(screen.queryByTestId("porta-apple")).toBeNull();
    expect(screen.getByTestId("porta-google")).toBeInTheDocument();
  });
});

describe("e-mail que já existe: entra com a senha, NUNCA 2ª conta; porta só se ausente", () => {
  it("mesma senha: entra, grava a porta (updateUser), existente:true, sem CompleteRegistration", async () => {
    await ateConta("metas", "tantas", "meses");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "User already registered" } });
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    getUser.mockResolvedValue({ data: { user: usuario({ email: "velha@exemplo.com", created_at: "2025-01-01T00:00:00Z", user_metadata: { full_name: "Bia" } }) } });
    preencherSenha("velha@exemplo.com", "minhasenha");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "velha@exemplo.com", password: "minhasenha" });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "senha", existente: true, gravou: true });
    expect(fireMetaEvent).not.toHaveBeenCalledWith("CompleteRegistration", expect.anything(), expect.anything());
  });

  it("senha diferente: pede a senha dela (com 'Esqueci a senha'), entra e não cria outra conta", async () => {
    await ateConta("dinheiro", "nao_guardo", "menos_100");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "User already registered" } });
    signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: "Invalid login credentials" } });
    preencherSenha("velha@exemplo.com", "outrasenha");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-conta").getAttribute("data-fase")).toBe("existe"));
    expect(texto()).toContain("Esse e-mail já tem conta");
    expect(screen.getByTestId("porta-esqueci").getAttribute("href")).toBe("/reset-password");
    expect(eventos("porta_conta_existe")).toHaveLength(1);

    signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: "Invalid login credentials" } });
    fireEvent.change(screen.getByTestId("porta-senha-existente"), { target: { value: "erradaaa" } });
    fireEvent.click(screen.getByTestId("porta-entrar-existente"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha não bateu");

    signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    getUser.mockResolvedValue({ data: { user: usuario({ email: "velha@exemplo.com", created_at: "2025-01-01T00:00:00Z" }) } });
    fireEvent.change(screen.getByTestId("porta-senha-existente"), { target: { value: "acertei1" } });
    fireEvent.click(screen.getByTestId("porta-entrar-existente"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(signUp).toHaveBeenCalledTimes(1); // nunca uma 2ª tentativa de criar
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "senha", existente: true });
  });

  it("conta que JÁ tem porta (de outra visita): NUNCA sobrescreve a 1ª atribuição", async () => {
    await ateConta("rotina", "celular", "nunca");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "User already registered" } });
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const antiga = { v: 1, porta_session_id: "outra-sessao", event_id: "porta_cr_antigo", attr: { ad_id: "999" } };
    getUser.mockResolvedValue({ data: { user: usuario({ created_at: "2026-09-01T00:00:00Z", user_metadata: { porta: antiga } }) } });
    preencherSenha("velha@exemplo.com", "minhasenha");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).not.toHaveBeenCalled();
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ existente: true, gravou: false, event_id: "porta_cr_antigo" });
  });

  it("senha fraca recusada pelo servidor: mensagem clara, sem tentar entrar", async () => {
    await ateConta("corpo", "como_mal", "primeira");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Password should be at least 6 characters" } });
    preencherSenha("nova@exemplo.com", "abcdef");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    expect(await screen.findByRole("alert")).toHaveTextContent("senha é fraca");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("decidirGravacao: mesma sessão = conta nova; outra sessão = intocada; ausente = grava", () => {
    const agora = Date.parse("2026-10-10T12:00:00Z");
    expect(decidirGravacao({ created_at: "2026-10-10T11:58:00Z", user_metadata: { porta: { porta_session_id: "s1" } } }, "s1", agora)).toEqual({ gravar: false, existente: false });
    expect(decidirGravacao({ created_at: "2026-10-10T11:58:00Z", user_metadata: { porta: { porta_session_id: "s0" } } }, "s1", agora)).toEqual({ gravar: false, existente: true });
    expect(decidirGravacao({ created_at: "2026-10-10T11:58:00Z", user_metadata: {} }, "s1", agora)).toEqual({ gravar: true, existente: false });
    expect(decidirGravacao({ created_at: "2024-01-01T00:00:00Z", user_metadata: null }, "s1", agora)).toEqual({ gravar: true, existente: true });
  });

  it("já logado neste navegador: 'Salvar nesta conta' grava sem pedir nada", async () => {
    const u = usuario({ email: "logada@exemplo.com", created_at: "2025-05-05T00:00:00Z" });
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    montar();
    fireEvent.click(screen.getByTestId("porta-comecar"));
    await waitFor(() => expect(screen.getByTestId("porta-area")).toBeInTheDocument());
    await escolher("saude", "porta-p2");
    await escolher("sono", "porta-p3");
    await escolher("cansaco", "porta-comsem");
    fireEvent.click(screen.getByTestId("porta-comsem-cta"));
    await waitFor(() => expect(screen.getByTestId("porta-plano")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("porta-desbloquear"));
    await waitFor(() => expect(screen.getByTestId("porta-conta-email-logado").textContent).toBe("logada@exemplo.com"));
    fireEvent.click(screen.getByTestId("porta-salvar-nesta-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-salvo")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "sessao", existente: true });
  });
});

/* ---------------------------------------------------------------- atribuição */
describe("atribuição à prova do Instagram", () => {
  it("captura na 1ª carga e persiste em localStorage, sessionStorage, cookie próprio e memória", () => {
    const a = capturarAtribuicao({ search: QUERY_AD, cookie: "_fbp=fb.1.1700000000000.123456", agora: 1_791_000_000_000, caminho: "/comece" });
    expect(a).toMatchObject({ utm_source: "meta", ad_id: "333", fbclid: "IwAR_abc", fbc: "fb.1.1791000000000.IwAR_abc", fbp: "fb.1.1700000000000.123456", ts: 1_791_000_000_000, origem: "url" });
    expect(JSON.parse(localStorage.getItem(CHAVE_ATTR)!).ad_id).toBe("333");
    expect(JSON.parse(sessionStorage.getItem(CHAVE_ATTR)!).ad_id).toBe("333");
    expect(document.cookie).toContain(`${COOKIE_ATTR}=`);
  });

  it("o Instagram zera storage e cookies com a página viva: a memória re-semeia e a campanha não se perde", () => {
    capturarAtribuicao({ search: QUERY_AD, agora: 1_791_000_000_000 });
    const s1 = sessaoDaPorta();
    localStorage.clear(); sessionStorage.clear(); limparCookies();
    const relida = capturarAtribuicao({ search: "" });
    expect(relida).toMatchObject({ ad_id: "333", utm_campaign: "porta_teste", fbclid: "IwAR_abc", origem: "url" });
    expect(JSON.parse(localStorage.getItem(CHAVE_ATTR)!).ad_id).toBe("333");
    expect(sessaoDaPorta()).toEqual({ id: s1.id, nova: false });
    expect(lerAtribuicao()?.ad_id).toBe("333");
  });

  it("sem nada na URL nem guardado: o fbclid do cookie _fbc (< 7 dias) liga ao anúncio", () => {
    const agora = 1_791_000_000_000;
    const a = capturarAtribuicao({ search: "", cookie: `_fbc=fb.1.${agora - 3_600_000}.IwAR_velho`, agora });
    expect(a).toMatchObject({ fbclid: "IwAR_velho", fbc: `fb.1.${agora - 3_600_000}.IwAR_velho`, origem: "cookie_fbc" });
  });

  it("o mesmo clique relido numa página nova mantém a hora e o fbc da 1ª carga", () => {
    const a = capturarAtribuicao({ search: QUERY_AD, agora: 1_791_000_000_000 });
    _zerarMemoriaPorta();
    const b = capturarAtribuicao({ search: QUERY_AD, agora: 1_791_000_999_000 });
    expect(b.fbc).toBe(a.fbc);
    expect(b.ts).toBe(a.ts);
  });

  it("porta_view sai uma vez por sessão (remontar não repete)", () => {
    montar();
    cleanup();
    montar();
    expect(eventos("porta_view")).toHaveLength(1);
  });
});

describe("tela 7 por aparelho", () => {
  const naSete = (metodo = "senha", email = "ana@exemplo.com") => {
    localStorage.setItem("porta-estado-v1", JSON.stringify({ passo: "salvo", escolha: "dinheiro", p2: "esqueco_contas", p3: "nao_sei", eventId: "porta_cr_x", metodo, email }));
    montar();
  };

  it("10/10 (como a Dinzo): no iPhone a loja abre SOZINHA em 4 s, com a contagem na tela; 1x por sessão", async () => {
    const { irPraLoja } = await import("@/pages/porta/navegar");
    vi.mocked(irPraLoja).mockClear();
    sessionStorage.clear();
    vi.useFakeTimers();
    try {
      ua(UA.instagram);
      naSete();
      expect(screen.getByTestId("porta-salvo-contagem").textContent).toBe("Abrindo a App Store em 4…");
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByTestId("porta-salvo-contagem").textContent).toBe("Abrindo a App Store em 1…");
      expect(irPraLoja).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(irPraLoja).toHaveBeenCalledTimes(1);
      expect(vi.mocked(irPraLoja).mock.calls[0][0]).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=ios");
      expect(trackEventBeacon).toHaveBeenCalledWith("porta_loja_click", expect.objectContaining({ loja: "ios", via: "auto" }));
      expect(screen.queryByTestId("porta-salvo-contagem")).toBeNull();
      // recarregar a página na mesma sessão NÃO joga pra loja de novo
      cleanup();
      naSete();
      act(() => { vi.advanceTimersByTime(6000); });
      expect(irPraLoja).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("porta-salvo-contagem")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("tocar no botão antes da contagem acabar cancela o automático (não abre 2x); computador nunca conta", async () => {
    const { irPraLoja } = await import("@/pages/porta/navegar");
    vi.mocked(irPraLoja).mockClear();
    sessionStorage.clear();
    vi.useFakeTimers();
    try {
      ua(UA.instagram);
      naSete();
      fireEvent.click(screen.getByTestId("porta-loja"));
      act(() => { vi.advanceTimersByTime(6000); });
      expect(irPraLoja).not.toHaveBeenCalled();
      expect(screen.queryByTestId("porta-salvo-contagem")).toBeNull();
      cleanup(); sessionStorage.clear();
      ua(UA.mac);
      naSete();
      expect(screen.queryByTestId("porta-salvo-contagem")).toBeNull();
      act(() => { vi.advanceTimersByTime(6000); });
      expect(irPraLoja).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("Android: Google Play pelo /baixar, sem prometer teste grátis (no Android não há)", () => {
    ua(UA.android);
    naSete("google");
    expect(screen.getByTestId("porta-loja").textContent).toContain("Google Play");
    expect(texto()).not.toMatch(/grátis/);
    expect(screen.getByTestId("porta-passo-3").querySelector("img")?.getAttribute("src")).toBe("/porta/entrar-google-android.jpg");
  });

  it("computador: QR do /baixar, 'também no computador' e as duas lojas", () => {
    ua(UA.mac);
    naSete();
    expect(screen.getByTestId("porta-qr").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("porta-salvo-computador").textContent).toBe("No computador você também usa: entre em coreaplicativo.com.br");
    expect(screen.getByTestId("porta-loja").getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=ios");
    expect(screen.getByTestId("porta-loja-android").getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=android");
    conferirCopy();
  });

  it("o passo 3 é o método da conta: senha, Apple, Google", () => {
    naSete("senha");
    expect(screen.getByTestId("porta-passo-3").textContent).toBe("3Digite este e-mail e a sua senha e toque em “Entrar no meu CORE”.");
    cleanup(); _zerarEstadoPorta(); localStorage.clear();
    naSete("apple");
    expect(screen.getByTestId("porta-passo-3").textContent).toBe("3Toque em “Continuar com a Apple”.");
    expect(screen.getByTestId("porta-passo-3").querySelector("img")?.getAttribute("src")).toBe("/porta/entrar-apple-ios.jpg");
    cleanup(); _zerarEstadoPorta(); localStorage.clear();
    naSete("google");
    expect(screen.getByTestId("porta-passo-3").textContent).toBe("3Toque em “Continuar com Google” e escolha esta conta.");
  });
});

describe("conteúdo", () => {
  it("o plano: Dia 1 é o da dor e nunca se repete nos dias 2 e 3", () => {
    for (const rota of Object.keys(PERGUNTA_DOR) as AreaPorta[]) {
      for (const o of PERGUNTA_DOR[rota].opts) {
        const p = planoDe3Dias(rota, o.id);
        expect(p.dia1).toBe(o.dia1);
        expect(p.motivo).toBe(o.label);
        expect(new Set([p.dia1, p.dia2, p.dia3]).size).toBe(3);
      }
    }
  });
});
