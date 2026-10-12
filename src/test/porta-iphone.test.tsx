/**
 * PORTA iPHONE (/comece) — v5 (12/10, o desenho da Dinzo): TOPO FIXO (logo · PLANO GRATUITO · "Monte seu plano
 * de 3 dias" · "4 perguntas rápidas…") igual em todos os passos + UM card: 1 área → 2 dor → 3 número →
 * 4 "Como você organiza isso hoje?" (multi) → 5 conta → 6 sucesso (loja sozinha em ~3 s, 1x; volta → Abrir o CORE).
 *
 * O que não pode quebrar:
 *   · o topo é o MESMO em todos os passos; as opções são SÓ TEXTO (sem emoji);
 *   · a dor e o número são as MESMAS perguntas do funil novo do app, área por área;
 *   · o passo 4 é multi-seleção ("Não organizo" exclusiva) com "Continuar" no card;
 *   · conta: "3 dias grátis no app · nada cobrado hoje" só no iPhone; Apple 1º (não no Android); Google no
 *     Instagram = aviso, sem OAuth; e-mail + senha com o botão SEMPRE ativo e erro por campo; NUNCA "sem cartão";
 *     e-mail que já existe entra com a senha, NUNCA vira 2ª conta; user_metadata.porta só se AUSENTE;
 *   · sucesso: loja abre sozinha 1x por sessão (tocar cancela); volta da aba → "Abrir o CORE" (core://entrar?h=);
 *     computador = QR, sem abrir loja; faixa do e-mail só se o e-mail saiu;
 *   · o estado salvo das versões antigas cai no passo equivalente;
 *   · nenhum PREÇO do produto em tela nenhuma; os eventos saem com os campos certos.
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
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
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
import { irPraLoja } from "@/pages/porta/navegar";
import PortaIphoneRota, { _zerarEstadoPorta, SEGUNDOS_ATE_A_LOJA } from "@/pages/porta/PortaIphone";
import AbrirPortaRota from "@/pages/porta/AbrirPorta";
import { _zerarMemoriaPorta, capturarAtribuicao, decidirGravacao, lerAtribuicao, sessaoDaPorta, CHAVE_ATTR, COOKIE_ATTR } from "@/pages/porta/atribuicao";
import { PERGUNTA_DOR, alternarOrganiza, planoDe3Dias, type AreaPorta } from "@/pages/porta/conteudo";

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
const beacons = (nome: string) => vi.mocked(trackEventBeacon).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const texto = () => document.body.textContent ?? "";
/** o texto sem os espaços inquebráveis (antes do travessão) */
const nb = (t: string | null | undefined) => (t ?? "").replace(/\u00a0/g, " ");
const passo = () => screen.getByTestId("porta").getAttribute("data-passo");
/** PREÇO DO PRODUTO (97,90 / 24,90 / 69,90 / 19,90 / anual / mensal / assinatura): nunca. */
const PRECO_DO_PRODUTO = /\d+,90|R\$\s?\d+,\d{2}|\banual\b|\bmensal\b|mensalidade|assinatura|por ano|\/ano|\/mês/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const TOPO = "COREPlano gratuitoMonte seu plano de 3 dias4 perguntas rápidas, e sua conta fica pronta em menos de um minuto.";
const conferirCopy = () => {
  expect(texto()).not.toMatch(PRECO_DO_PRODUTO);
  expect(texto()).not.toMatch(/sem cart[aã]o/i); // a Apple pede forma de pagamento pro teste
  expect(texto()).not.toMatch(/desbloque/i);
  // o topo é SEMPRE o mesmo; o card não tem emoji
  expect(screen.getByTestId("porta-topo").textContent).toBe(TOPO);
  expect(screen.getByTestId("porta-card").textContent).not.toMatch(EMOJI);
  // "dias grátis" só na conta do iPhone
  const iphone = /iPhone/.test(navigator.userAgent);
  if (!(iphone && screen.queryByTestId("porta-conta"))) expect(texto()).not.toMatch(/dias? grátis/i);
};
const rotulos = (testid: string) => Array.from(screen.getByTestId(testid).querySelectorAll("[data-testid^='porta-opcao-']")).map((n) => n.textContent);
type PortaGravada = { attr: Record<string, unknown>; respostas: Record<string, unknown>; metodo: string; porta_session_id: string; event_id: string };
const usuario = (over: Partial<U> = {}): U => ({ id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {}, ...over });

/** toca numa opção de 1 toque e espera o passo seguinte */
const escolher = async (id: string, proximo: string) => {
  fireEvent.click(screen.getByTestId(`porta-opcao-${id}`));
  await waitFor(() => expect(passo()).toBe(proximo));
  conferirCopy();
};
/** até o passo 4 (organiza), numa área, com as respostas dadas */
const ateOrganiza = async (area: string, dor: string, numero: string) => {
  montar();
  conferirCopy();
  await escolher(area, "p2");
  await escolher(dor, "p3");
  await escolher(numero, "organiza");
};
/** até a conta (no passo 4 marca as opções dadas) */
const ateConta = async (area: string, dor: string, numero: string, organiza: string[] = ["notas"]) => {
  await ateOrganiza(area, dor, numero);
  for (const o of organiza) fireEvent.click(screen.getByTestId(`porta-opcao-${o}`));
  fireEvent.click(screen.getByTestId("porta-continuar"));
  await waitFor(() => expect(screen.getByTestId("porta-conta")).toBeInTheDocument());
  conferirCopy();
};
const preencherSenha = (email: string, senha: string) => {
  fireEvent.change(screen.getByTestId("porta-email"), { target: { value: email } });
  fireEvent.change(screen.getByTestId("porta-senha"), { target: { value: senha } });
};
const salvo = (passoAntigo: string, extra: Record<string, unknown> = {}) =>
  localStorage.setItem("porta-estado-v1", JSON.stringify({ passo: passoAntigo, escolha: "rotina", p2: "celular", p3: "semana", eventId: "porta_cr_antigo1", metodo: null, email: null, ...extra }));
const noSucesso = (metodo = "senha", extra: Record<string, unknown> = {}) => {
  localStorage.setItem("porta-estado-v1", JSON.stringify({ passo: "sucesso", escolha: "dinheiro", p2: "esqueco_contas", p3: "nao_sei", p4: ["notas"], eventId: "porta_cr_x", metodo, email: "ana@exemplo.com", ...extra }));
  montar();
};

beforeEach(() => {
  _zerarMemoriaPorta();
  _zerarEstadoPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  limparCookies();
  nativo(false);
  authState.user = null;
  authState.loading = false;
  [getUser, signUp, signInWithPassword, updateUser, signOut, invoke].forEach((f) => f.mockReset());
  invoke.mockResolvedValue({ data: null, error: { message: "funcao_fora" } });
  vi.mocked(trackEvent).mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  vi.mocked(entrarComGoogle).mockClear();
  vi.mocked(entrarComApple).mockClear();
  vi.mocked(irPraLoja).mockClear();
  updateUser.mockResolvedValue({ data: {}, error: null });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  ua(UA.instagram);
  irPara(`/comece${QUERY_AD}`);
});
afterEach(() => { cleanup(); nativo(false); irPara("/"); vi.useRealTimers(); });

/* ---------------------------------------------------------------- rota */
describe("rota", () => {
  it("o app nativo NUNCA monta /comece (vai pra porta do app)", () => {
    nativo(true);
    montar();
    expect(screen.getByTestId("onde").textContent).toBe("/app");
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

/* ---------------------------------------------------------------- o desenho */
describe("topo fixo + card (o desenho da Dinzo)", () => {
  it("passo 1: logo (ícone do app + CORE), PLANO GRATUITO, título, sub; card com a barra, SEM voltar, 5 áreas só texto (sem Tudo)", () => {
    montar();
    expect(screen.getByTestId("porta-logo").getAttribute("src")).toBe("/icon-192.png");
    expect(readFileSync(join(process.cwd(), "public/icon-192.png")).length).toBeLessThan(20_000);
    expect(screen.getByTestId("porta-selo").textContent).toBe("Plano gratuito");
    expect(screen.getByTestId("porta-selo").className).toContain("uppercase");
    expect(screen.getByTestId("porta-titulo").textContent).toBe("Monte seu plano de 3 dias");
    expect(screen.getByTestId("porta-sub").textContent).toBe("4 perguntas rápidas, e sua conta fica pronta em menos de um minuto.");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que você quer organizar primeiro?");
    expect(rotulos("porta-q-area")).toEqual(["Dinheiro", "Rotina", "Treino e dieta", "Saúde", "Metas"]);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("10");
    expect(screen.queryByTestId("porta-voltar")).toBeNull();
    expect(screen.queryByTestId("porta-continuar")).toBeNull();
    expect(screen.getByTestId("porta-entrar").textContent).toBe("Já tem conta? Entrar");
    conferirCopy();
  });

  it("o topo é IDÊNTICO em todos os passos (até o sucesso); a barra anda; o voltar aparece do 2º passo em diante", async () => {
    montar();
    const topo = screen.getByTestId("porta-topo").outerHTML;
    const barras: string[] = [];
    const conferir = () => {
      expect(screen.getByTestId("porta-topo").outerHTML).toBe(topo);
      barras.push(screen.queryByRole("progressbar")?.getAttribute("aria-valuenow") ?? "sem");
    };
    conferir();
    await escolher("dinheiro", "p2"); conferir();
    expect(screen.getByTestId("porta-voltar")).toBeInTheDocument();
    await escolher("gasto_sem_perceber", "p3"); conferir();
    await escolher("300_500", "organiza"); conferir();
    fireEvent.click(screen.getByTestId("porta-opcao-planilha"));
    fireEvent.click(screen.getByTestId("porta-continuar"));
    await waitFor(() => expect(passo()).toBe("conta")); conferir();
    signUp.mockResolvedValue({ data: { user: { id: "u-1" }, session: { access_token: "x" } }, error: null });
    getUser.mockResolvedValue({ data: { user: usuario() } });
    preencherSenha("ana@exemplo.com", "segredo1");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(passo()).toBe("sucesso")); conferir();
    expect(barras).toEqual(["10", "30", "50", "70", "88", "sem"]);
    expect(screen.queryByTestId("porta-voltar")).toBeNull(); // do sucesso não se volta
  });

  it("voltar: do número pra dor (com a resposta marcada) e da dor pra área", async () => {
    montar();
    await escolher("rotina", "p2");
    await escolher("celular", "p3");
    fireEvent.click(screen.getByTestId("porta-voltar"));
    await waitFor(() => expect(passo()).toBe("p2"));
    expect(screen.getByTestId("porta-opcao-celular").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("porta-voltar"));
    await waitFor(() => expect(passo()).toBe("area"));
    expect(screen.getByTestId("porta-opcao-rotina").getAttribute("aria-pressed")).toBe("true");
    // trocar a área zera a dor/número da antiga
    await escolher("saude", "p2");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que você mais negligencia hoje?");
    expect(screen.getByTestId("porta-q-p2").querySelector("[aria-pressed='true']")).toBeNull();
  });

  it("'Já tem conta? Entrar' vai pro /entrar", () => {
    montar();
    fireEvent.click(screen.getByTestId("porta-entrar"));
    expect(screen.getByTestId("onde").textContent).toBe("/entrar");
    expect(eventos("porta_entrar_click")).toHaveLength(1);
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

describe("a dor (passo 2) e o número (passo 3) são as MESMAS perguntas do funil do app, área por área", () => {
  for (const area of Object.keys(DO_APP) as AreaPorta[]) {
    it(area, async () => {
      montar();
      await escolher(area, "p2");
      expect(screen.getByTestId("porta-pergunta").textContent).toBe(DO_APP[area].dor[0]);
      expect(rotulos("porta-q-p2")).toEqual(DO_APP[area].dor[1]);
      fireEvent.click(screen.getByTestId("porta-q-p2").querySelectorAll("[data-testid^='porta-opcao-']")[0]);
      await waitFor(() => expect(passo()).toBe("p3"));
      expect(screen.getByTestId("porta-pergunta").textContent).toBe(DO_APP[area].numero[0]);
      expect(rotulos("porta-q-p3")).toEqual(DO_APP[area].numero[1]);
      conferirCopy();
    });
  }

  it("12/10: sem a opção 'Tudo'; estado antigo salvo com 'tudo' segue pelo dinheiro", async () => {
    localStorage.setItem("porta-estado-v1", JSON.stringify({ passo: "p2", escolha: "tudo", eventId: "porta_cr_x" }));
    montar();
    await waitFor(() => expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que mais te atrapalha hoje?"));
  });
});

describe("passo 4 — 'Como você organiza isso hoje?' (multi-seleção)", () => {
  it("círculo à direita, várias marcadas, 'Não organizo' exclusiva, 'Continuar' só com 1+ marcada", async () => {
    await ateOrganiza("dinheiro", "pra_onde_vai", "mais_500");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("Como você organiza isso hoje?");
    expect(screen.getByTestId("porta-pergunta-sub").textContent).toBe("Pode marcar mais de um.");
    expect(rotulos("porta-q-organiza")).toEqual(["Não organizo", "Bloco de notas", "Planilha", "Outro app", "Só de cabeça"]);
    const continuar = screen.getByTestId("porta-continuar") as HTMLButtonElement;
    expect(continuar.disabled).toBe(true);
    const on = (id: string) => screen.getByTestId(`porta-opcao-${id}`).getAttribute("aria-pressed");
    fireEvent.click(screen.getByTestId("porta-opcao-notas"));
    fireEvent.click(screen.getByTestId("porta-opcao-planilha"));
    expect([on("notas"), on("planilha"), passo()]).toEqual(["true", "true", "organiza"]); // marcar NÃO avança
    expect(screen.getByTestId("porta-circulo-notas").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("porta-circulo-outro_app").querySelector("svg")).toBeNull();
    expect(continuar.disabled).toBe(false);
    fireEvent.click(screen.getByTestId("porta-opcao-nao_organizo"));
    expect([on("nao_organizo"), on("notas"), on("planilha")]).toEqual(["true", "false", "false"]);
    fireEvent.click(screen.getByTestId("porta-opcao-cabeca"));
    expect([on("nao_organizo"), on("cabeca")]).toEqual(["false", "true"]);
    fireEvent.click(screen.getByTestId("porta-opcao-outro_app"));
    fireEvent.click(continuar);
    await waitFor(() => expect(passo()).toBe("conta"));
    expect(eventos("porta_passo").find((e) => e.passo === "organiza")).toMatchObject({ resposta: "Outro app, Só de cabeça", area: "dinheiro" });
  });

  it("alternarOrganiza (puro)", () => {
    expect(alternarOrganiza([], "notas")).toEqual(["notas"]);
    expect(alternarOrganiza(["notas"], "notas")).toEqual([]);
    expect(alternarOrganiza(["notas", "planilha"], "nao_organizo")).toEqual(["nao_organizo"]);
    expect(alternarOrganiza(["nao_organizo"], "cabeca")).toEqual(["cabeca"]);
  });
});

/* ---------------------------------------------------------------- estado antigo */
describe("estado salvo das versões antigas (porta-estado-v1) cai no passo equivalente", () => {
  it("'abertura' (v3/v4) com área → a dor dela; sem área → a área", () => {
    salvo("abertura");
    montar();
    expect(passo()).toBe("p2");
    expect(screen.getByTestId("porta-pergunta").textContent).toBe("O que mais bagunça sua rotina hoje?");
    cleanup(); _zerarEstadoPorta(); localStorage.clear();
    salvo("abertura", { escolha: null, p2: null, p3: null });
    montar();
    expect(passo()).toBe("area");
  });

  for (const [antigo, novo] of [["welcome", "p2"], ["area", "p2"], ["p2", "p2"], ["p3", "p3"], ["comsem", "organiza"], ["plano", "organiza"], ["conta", "conta"]] as const) {
    it(`'${antigo}' → ${novo}`, () => {
      salvo(antigo);
      montar();
      expect(passo()).toBe(novo);
      conferirCopy();
    });
  }

  it("'instrucao' e 'salvo' (o fim antigo) → sucesso; passo desconhecido → área do zero", () => {
    for (const antigo of ["instrucao", "salvo"]) {
      cleanup(); _zerarEstadoPorta(); localStorage.clear();
      salvo(antigo, { metodo: "senha", email: "ana@exemplo.com" });
      montar();
      expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument();
    }
    cleanup(); _zerarEstadoPorta(); localStorage.clear();
    salvo("passo_que_nao_existe");
    montar();
    expect(passo()).toBe("area");
  });
});

/* ---------------------------------------------------------------- fluxo inteiro */
describe("fluxo inteiro — DINHEIRO, no Instagram do iPhone, conta nova por e-mail e senha", () => {
  it("4 perguntas → conta (Google bloqueado com aviso, botão sempre ativo) → conta com a campanha → CompleteRegistration → sucesso → loja → volta da aba", async () => {
    montar();
    const view = eventos("porta_view")[0];
    expect(view).toMatchObject({ utm_source: "meta", utm_campaign: "porta_teste", utm_content: "video_organizei", c_id: "111", as_id: "222", ad_id: "333", pl: "Instagram_Reels", fbclid: "IwAR_abc", atribuicao: "url", in_app: true, plataforma: "ios", tela1_visivel: true });
    expect(String(view.fbc)).toMatch(/^fb\.1\.\d{13}\.IwAR_abc$/);
    expect(fireMetaEvent).toHaveBeenCalledWith("ViewContent", expect.objectContaining({ content_name: "porta_iphone" }));

    await escolher("dinheiro", "p2");
    await escolher("gasto_sem_perceber", "p3");
    await escolher("300_500", "organiza");
    fireEvent.click(screen.getByTestId("porta-opcao-notas"));
    fireEvent.click(screen.getByTestId("porta-opcao-planilha"));
    fireEvent.click(screen.getByTestId("porta-continuar"));

    // 5. conta (iPhone): o teste de 3 dias, Apple 1º com a legenda, Google, e-mail
    await waitFor(() => expect(screen.getByTestId("porta-conta")).toBeInTheDocument());
    expect(screen.getByTestId("porta-conta-titulo").textContent).toBe("Pronto! Seu plano de 3 dias está montado.");
    expect(screen.getByTestId("porta-conta-texto").textContent).toBe("Agora crie sua conta pra abrir no app.");
    expect(screen.queryByTestId("porta-conta-teste")).toBeNull(); // 12/10: a linha do teste saiu da conta
    const apple = screen.getByTestId("porta-apple"), google = screen.getByTestId("porta-google");
    expect(apple.textContent?.trim()).toBe("Continuar com a Apple");
    expect(apple.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // Apple vem antes
    expect(screen.getByTestId("porta-apple-legenda").textContent).toBe("1 toque, sem senha");
    expect(google.textContent?.trim()).toBe("Continuar com o Google");
    expect(texto()).toContain("ou com e-mail");
    expect(screen.getByTestId("porta-termos").textContent).toBe("Ao continuar, você aceita os Termos de Uso e a Política de Privacidade.");
    fireEvent.click(google);
    expect(entrarComGoogle).not.toHaveBeenCalled();
    expect(screen.getByTestId("porta-aviso-google").textContent).toBe("O Google não deixa entrar por dentro do Instagram. Toque em ⋯ no alto e em Abrir no navegador. Ou use a Apple ou o e-mail.");
    expect(eventos("porta_google_bloqueado")[0]).toMatchObject({ app: "Instagram", ad_id: "333" });
    // as respostas (com o passo 4) e a sessão foram pra URL, pra irem junto no "Abrir no navegador"
    const q = new URLSearchParams(window.location.search);
    expect(JSON.parse(q.get("pe")!)).toMatchObject({ escolha: "dinheiro", p2: "gasto_sem_perceber", p3: "300_500", p4: ["notas", "planilha"] });
    expect(q.get("ps")).toBe(view.porta_session_id);
    expect(q.get("utm_campaign")).toBe("porta_teste");
    conferirCopy();

    // botão "Criar conta" sempre ativo: senha curta → erro embaixo do campo, nada enviado
    expect((screen.getByTestId("porta-criar-conta") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("porta-criar-conta").textContent).toBe("Criar conta");
    preencherSenha(" Ana@Exemplo.com ", "12345");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    expect(screen.getByTestId("porta-erro-senha").textContent).toBe("A senha precisa de 6 letras ou números");
    expect(screen.queryByTestId("porta-erro-email")).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("porta-senha"), { target: { value: "segredo1" } });
    expect(screen.queryByTestId("porta-erro-senha")).toBeNull();
    let portaEnviada: Record<string, unknown> | null = null;
    signUp.mockImplementation(async (arg: { options: { data: { porta: Record<string, unknown> } } }) => {
      portaEnviada = arg.options.data.porta;
      return { data: { user: { id: "u-1" }, session: { access_token: "x" } }, error: null };
    });
    getUser.mockImplementation(async () => ({ data: { user: usuario({ user_metadata: { porta: portaEnviada } }) } }));
    fireEvent.click(screen.getByTestId("porta-criar-conta"));

    // 6. sucesso
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    const cad = signUp.mock.calls[0][0] as { email: string; password: string; options: { data: { porta: PortaGravada } } };
    expect(cad.email).toBe("ana@exemplo.com");
    expect(cad.password).toBe("segredo1");
    const porta = cad.options.data.porta;
    expect(porta.attr).toMatchObject({ utm_campaign: "porta_teste", utm_content: "video_organizei", c_id: "111", as_id: "222", ad_id: "333", pl: "Instagram_Reels", fbclid: "IwAR_abc", origem: "url" });
    expect(porta.respostas).toEqual({ area: "dinheiro", rota: "dinheiro", p2: "gasto_sem_perceber", p3: "300_500", atrapalha: "Gasto sem perceber", gasto: "R$ 300 a R$ 500", p4: "notas,planilha", organiza: "Bloco de notas, Planilha" });
    expect(porta.metodo).toBe("senha");
    expect(porta.porta_session_id).toBe(view.porta_session_id);
    expect(updateUser).not.toHaveBeenCalled(); // a porta nasceu junto com a conta
    expect(fireMetaEvent).toHaveBeenCalledWith("CompleteRegistration", expect.objectContaining({ content_name: "porta_iphone" }), porta.event_id);
    // 11/10: o mesmo CompleteRegistration pela CAPI do site, com o MESMO eventID
    const reg = invoke.mock.calls.find((c) => (c[1] as { body: { acao: string } }).body.acao === "registro");
    expect((reg![1] as { body: { event_id: string } }).body.event_id).toBe(porta.event_id);
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "senha", ad_id: "333" });
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "senha", existente: false, event_id: porta.event_id, gravou: false, ad_id: "333" });
    conferirCopy();
    expect(screen.getByTestId("porta-sucesso-selo").textContent).toBe("Conta criada");
    expect(screen.getByTestId("porta-sucesso-titulo").textContent).toBe("Agora é só entrar");
    expect(nb(screen.getByTestId("porta-sucesso-texto").textContent)).toBe("Baixe o CORE e toque em Entrar — sua conta já está te esperando.");
    expect(screen.getByTestId("porta-sucesso-check")).toBeInTheDocument();
    expect(screen.getByTestId("porta-sucesso-abrindo").textContent).toBe("Abrindo a App Store…");
    expect(screen.queryByTestId("porta-sucesso-email")).toBeNull(); // a função está fora: o e-mail não saiu
    expect(nb(screen.getByTestId("porta-sucesso-dica").textContent)).toContain("No app, toque em “Entrar” — não em “Começar”.");
    expect(screen.getByTestId("porta-sucesso-depois").textContent).toBe("Depois, seu e-mail e a senha que você criou.");
    expect(screen.getByTestId("porta-sucesso-print").getAttribute("src")).toBe("/porta/tela-inicial-1014-ios.jpg");
    const loja = screen.getByTestId("porta-loja");
    expect(loja.textContent).toBe("Baixar naApp Store");
    expect(loja.getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei");
    fireEvent.pointerDown(loja);
    fireEvent.click(loja);
    expect(beacons("porta_loja_click")[0]).toMatchObject({ plataforma: "ios", loja: "ios", via: "botao", ad_id: "333", porta_session_id: view.porta_session_id });
    expect(screen.queryByTestId("porta-sucesso-abrindo")).toBeNull(); // tocar cancela o automático
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(eventos("porta_voltou_aba")).toHaveLength(1);
    // sem código (função fora): continua a loja, o texto manda abrir o app e tocar em Entrar
    expect(screen.queryByTestId("porta-abrir-app")).toBeNull();
    expect(nb(screen.getByTestId("porta-sucesso-texto").textContent)).toBe("Já baixou? Abra o CORE e toque em Entrar — sua conta já está te esperando.");

    expect(eventos("porta_passo").map((e) => [e.passo, e.area, e.resposta])).toEqual([
      ["area", "dinheiro", "dinheiro"],
      ["p2", "dinheiro", "Gasto sem perceber"],
      ["p3", "dinheiro", "R$ 300 a R$ 500"],
      ["organiza", "dinheiro", "Bloco de notas, Planilha"],
      ["conta", "dinheiro", "view"],
      ["sucesso", "dinheiro", "view"],
    ]);
    expect(eventos("porta_conta_erro")).toEqual([expect.objectContaining({ campo: "senha", motivo: "curta", ad_id: "333" })]);
  });

  it("'Abrir no navegador': a URL com pe/ps abre direto na conta, com as respostas e a MESMA sessão", async () => {
    ua(UA.safari);
    const pe = JSON.stringify({ escolha: "dinheiro", p2: "esqueco_contas", p3: "mais_500", p4: ["cabeca"], eventId: "porta_cr_abc12345" });
    irPara(`/comece${QUERY_AD}&pe=${encodeURIComponent(pe)}&ps=sessao-do-instagram-1`);
    montar();
    expect(screen.getByTestId("porta-conta")).toBeInTheDocument();
    expect(sessaoDaPorta().id).toBe("sessao-do-instagram-1");
    fireEvent.click(screen.getByTestId("porta-google"));
    await waitFor(() => expect(entrarComGoogle).toHaveBeenCalledTimes(1)); // no Safari o Google vai
    expect(eventos("porta_conta_iniciada")[0]).toMatchObject({ metodo: "google", porta_session_id: "sessao-do-instagram-1" });
    expect(JSON.parse(localStorage.getItem("porta-estado-v1")!).p4).toEqual(["cabeca"]);
  });
});

describe("conta por plataforma; Google e Apple voltam pro sucesso", () => {
  it("ROTINA no Safari, Google: sai, volta e cai no sucesso com a porta gravada", async () => {
    ua(UA.safari);
    await ateConta("rotina", "sem_plano", "semana", ["nao_organizo"]);
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
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    const gravada = (updateUser.mock.calls[0][0] as { data: { porta: PortaGravada } }).data.porta;
    expect(gravada.attr).toMatchObject({ utm_campaign: "porta_teste", ad_id: "333", fbclid: "IwAR_abc" });
    expect(gravada.respostas).toEqual({ area: "rotina", rota: "rotina", p2: "sem_plano", p3: "semana", atrapalha: "Acordo sem plano nenhum", consistencia: "Uma semana", p4: "nao_organizo", organiza: "Não organizo" });
    expect(gravada.metodo).toBe("google");
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "google", existente: false, gravou: true });
    expect(fireMetaEvent).toHaveBeenCalledWith("CompleteRegistration", expect.anything(), gravada.event_id);
    expect(screen.getByTestId("porta-sucesso-depois").textContent).toBe("Depois, “Continuar com Google”.");
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
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "apple", existente: false });
    expect(screen.getByTestId("porta-sucesso-depois").textContent).toBe("Depois, “Continuar com a Apple”.");
  });

  it("Android: sem Apple, sem promessa de teste; sucesso com Google Play, sem faixa do e-mail", async () => {
    ua(UA.android);
    await ateConta("metas", "na_cabeca", "ano");
    expect(screen.queryByTestId("porta-apple")).toBeNull();
    expect(screen.getByTestId("porta-google")).toBeInTheDocument();
    expect(screen.queryByTestId("porta-conta-teste")).toBeNull();
    expect(screen.getByTestId("porta-conta-titulo").textContent).toBe("Pronto! Seu plano de 3 dias está montado.");
    expect(screen.getByTestId("porta-card").textContent).not.toMatch(/grátis|cobrança|cobrado|cancele/i);
    signUp.mockResolvedValue({ data: { user: { id: "u-1" }, session: { access_token: "x" } }, error: null });
    getUser.mockResolvedValue({ data: { user: usuario() } });
    preencherSenha("ana@exemplo.com", "segredo1");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(screen.getByTestId("porta-loja").textContent).toBe("Baixar noGoogle Play");
    expect(screen.getByTestId("porta-sucesso-abrindo").textContent).toBe("Abrindo a Google Play…");
    expect(screen.queryByTestId("porta-sucesso-email")).toBeNull();
    expect(screen.getByTestId("porta-sucesso-print").getAttribute("src")).toBe("/como-entrar/1-tela-inicial-android.jpg");
    expect(texto()).not.toMatch(/grátis/);
    // Android não pede código (o app Android não resgata)
    expect(invoke.mock.calls.filter((c) => (c[1] as { body: { acao: string } }).body.acao === "criar")).toHaveLength(0);
  });

  it("computador: conta sem promessa de teste (com Apple); sucesso com o QR do /baixar, sem loja sozinha", async () => {
    ua(UA.mac);
    await ateConta("dinheiro", "esqueco_contas", "nao_sei");
    expect(screen.getByTestId("porta-apple")).toBeInTheDocument();
    expect(screen.queryByTestId("porta-conta-teste")).toBeNull();
    expect(texto()).not.toMatch(/grátis/);
    signUp.mockResolvedValue({ data: { user: { id: "u-1" }, session: { access_token: "x" } }, error: null });
    getUser.mockResolvedValue({ data: { user: usuario() } });
    preencherSenha("ana@exemplo.com", "segredo1");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(screen.getByTestId("porta-qr").querySelector("svg")).not.toBeNull();
    expect(screen.queryByTestId("porta-loja")).toBeNull();
    expect(screen.queryByTestId("porta-sucesso-abrindo")).toBeNull();
    expect(nb(screen.getByTestId("porta-sucesso-texto").textContent)).toBe("Aponte a câmera do celular pro código, baixe o CORE e toque em Entrar — sua conta já está te esperando.");
    expect(irPraLoja).not.toHaveBeenCalled();
    expect(invoke.mock.calls.filter((c) => (c[1] as { body: { acao: string } }).body.acao === "criar")).toHaveLength(0);
    conferirCopy();
  });

  it("botão sempre ativo: vazio → 'Digite seu e-mail' + senha, foca o e-mail; e-mail torto → 'E-mail inválido'; evento por campo", async () => {
    await ateConta("rotina", "celular", "semana");
    const botao = screen.getByTestId("porta-criar-conta") as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    expect(screen.getByTestId("porta-erro-email").textContent).toBe("Digite seu e-mail");
    expect(screen.getByTestId("porta-erro-senha").textContent).toBe("A senha precisa de 6 letras ou números");
    expect(document.activeElement).toBe(screen.getByTestId("porta-email"));
    expect(screen.getByTestId("porta-email").getAttribute("aria-invalid")).toBe("true");
    expect(eventos("porta_conta_erro").map((e) => [e.campo, e.motivo])).toEqual([["email", "vazio"], ["senha", "vazio"]]);
    preencherSenha("ana@", "segredo1");
    fireEvent.click(botao);
    expect(screen.getByTestId("porta-erro-email").textContent).toBe("E-mail inválido");
    expect(screen.queryByTestId("porta-erro-senha")).toBeNull();
    preencherSenha("ana@exemplo.com", "abc");
    fireEvent.click(botao);
    expect(screen.queryByTestId("porta-erro-email")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("porta-senha"));
    expect(eventos("porta_conta_erro").at(-1)).toMatchObject({ campo: "senha", motivo: "curta" });
    expect(signUp).not.toHaveBeenCalled();
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
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "velha@exemplo.com", password: "minhasenha" });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "senha", existente: true, gravou: true });
    expect(fireMetaEvent).not.toHaveBeenCalledWith("CompleteRegistration", expect.anything(), expect.anything());
  });

  it("senha diferente: pede a senha dela (no card, com 'Esqueci a senha'), entra e não cria outra conta", async () => {
    await ateConta("dinheiro", "nao_guardo", "menos_100");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "User already registered" } });
    signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: "Invalid login credentials" } });
    preencherSenha("velha@exemplo.com", "outrasenha");
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-conta").getAttribute("data-fase")).toBe("existe"));
    expect(screen.getByTestId("porta-card").contains(screen.getByTestId("porta-conta"))).toBe(true);
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
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(signUp).toHaveBeenCalledTimes(1);
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
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
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

  it("já logado neste navegador: 'Continuar com esta conta' grava sem pedir nada", async () => {
    const u = usuario({ email: "logada@exemplo.com", created_at: "2025-05-05T00:00:00Z" });
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    await ateConta("saude", "sono", "cansaco");
    await waitFor(() => expect(screen.getByTestId("porta-conta-email-logado").textContent).toBe("logada@exemplo.com"));
    fireEvent.click(screen.getByTestId("porta-salvar-nesta-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "sessao", existente: true });
  });
});

/* ---------------------------------------------------------------- sucesso: a loja */
describe("sucesso — a loja abre sozinha (como a Dinzo)", () => {
  it(`iPhone: abre a App Store em ${SEGUNDOS_ATE_A_LOJA} s com "Abrindo a App Store…"; 1x por sessão`, () => {
    vi.useFakeTimers();
    noSucesso();
    expect(screen.getByTestId("porta-sucesso-abrindo").textContent).toBe("Abrindo a App Store…");
    act(() => { vi.advanceTimersByTime(SEGUNDOS_ATE_A_LOJA * 1000 - 100); });
    expect(irPraLoja).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(irPraLoja).toHaveBeenCalledTimes(1);
    expect(vi.mocked(irPraLoja).mock.calls[0][0]).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=ios");
    expect(beacons("porta_loja_click")[0]).toMatchObject({ loja: "ios", via: "auto" });
    expect(screen.queryByTestId("porta-sucesso-abrindo")).toBeNull();
    // recarregar na mesma sessão NÃO joga pra loja de novo
    cleanup();
    noSucesso();
    expect(screen.queryByTestId("porta-sucesso-abrindo")).toBeNull();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(irPraLoja).toHaveBeenCalledTimes(1);
  });

  it("qualquer toque na página cancela o automático (e não abre 2x)", () => {
    vi.useFakeTimers();
    noSucesso();
    fireEvent.pointerDown(screen.getByTestId("porta-sucesso-dica"));
    expect(screen.queryByTestId("porta-sucesso-abrindo")).toBeNull();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(irPraLoja).not.toHaveBeenCalled();
    expect(beacons("porta_loja_click")).toHaveLength(0);
  });

  it("tocar no botão da loja antes: conta como 'botao' e o automático não dispara", () => {
    vi.useFakeTimers();
    noSucesso();
    fireEvent.click(screen.getByTestId("porta-loja"));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(irPraLoja).not.toHaveBeenCalled();
    expect(beacons("porta_loja_click")).toEqual([expect.objectContaining({ via: "botao", loja: "ios" })]);
  });

  it("Android: abre a Google Play sozinha", () => {
    vi.useFakeTimers();
    ua(UA.android);
    noSucesso("google");
    act(() => { vi.advanceTimersByTime(SEGUNDOS_ATE_A_LOJA * 1000 + 50); });
    expect(vi.mocked(irPraLoja).mock.calls[0][0]).toBe("/baixar?origem=porta&utm_content=video_organizei&loja=android");
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

  it("v4: porta_view com tempo_ms, tela 1 visível e o html_id/html_ms do index.html", () => {
    (window as { __portaHtml?: unknown }).__portaHtml = { id: "html-abc-123", t: 812 };
    try {
      montar();
      const v = eventos("porta_view")[0];
      expect(typeof v.tempo_ms).toBe("number");
      expect(v.tempo_ms as number).toBeGreaterThanOrEqual(0);
      expect(v).toMatchObject({ tela1_visivel: true, visivel: true, html_id: "html-abc-123", html_ms: 812, retomou: null });
    } finally { delete (window as { __portaHtml?: unknown }).__portaHtml; }
    cleanup(); _zerarMemoriaPorta(); _zerarEstadoPorta(); sessionStorage.clear(); vi.mocked(trackEvent).mockClear();
    montar();
    expect(eventos("porta_view")[0]).toMatchObject({ html_id: null, html_ms: null, tela1_visivel: true });
  });
});

describe("conteúdo", () => {
  it("o plano (fica pro app/e-mail): Dia 1 é o da dor e nunca se repete nos dias 2 e 3", () => {
    for (const rota of Object.keys(PERGUNTA_DOR) as AreaPorta[]) {
      for (const o of PERGUNTA_DOR[rota].opts) {
        const p = planoDe3Dias(rota, o.id);
        expect(p.dia1).toBe(o.dia1);
        expect(new Set([p.dia1, p.dia2, p.dia3]).size).toBe(3);
      }
    }
  });

  it("as telas antigas saíram (com × sem, plano, último passo, tela 7) e nenhum preço do produto no código da Porta", () => {
    for (const f of ["PortaIphone.tsx", "telas.tsx", "ContaPorta.tsx", "SucessoPorta.tsx", "conteudo.ts"]) {
      const fonte = readFileSync(join(process.cwd(), "src/pages/porta", f), "utf8");
      expect(fonte).not.toMatch(/97,90|69,90|24,90|19,90/);
      expect(fonte).not.toMatch(/ComSemPorta|PlanoPorta|InstrucaoPorta|SalvoPorta/);
    }
  });
});

/* ---------------------------------------------------------------- abrir o app já logado */
describe("abrir o app JÁ LOGADO (porta-handoff)", () => {
  const CODIGO = "ABCDEFGH23";
  const LINK_APP = `core://entrar?h=${CODIGO}`;
  /* PROIBIDO clipboard (dono 10/10): um writeText espião prova que ninguém copia nada */
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => { writeText = vi.fn(async () => {}); Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true }); });
  afterEach(() => { try { delete (navigator as { clipboard?: unknown }).clipboard; } catch { /* noop */ } });

  const contaCriada = async () => {
    await ateConta("dinheiro", "gasto_sem_perceber", "300_500");
    preencherSenha("ana@exemplo.com", "segredo1");
    signUp.mockResolvedValue({ data: { user: { id: "u-1" }, session: { access_token: "x" } }, error: null });
    getUser.mockResolvedValue({ data: { user: usuario() } });
    fireEvent.click(screen.getByTestId("porta-criar-conta"));
    await waitFor(() => expect(screen.getByTestId("porta-sucesso")).toBeInTheDocument());
  };

  it("iPhone: pede o código (com o método); faixa verde do e-mail; loja não copia nada; volta da aba → 'Abrir o CORE' principal e a loja vira link", async () => {
    ua(UA.safari);
    invoke.mockImplementation(async (_n: string, { body }: { body: { acao: string } }) => (body.acao === "criar" ? { data: { codigo: CODIGO, expira_em: "x", email_enviado: true }, error: null } : { data: { ok: true }, error: null }));
    await contaCriada();
    await waitFor(() => expect(eventos("porta_codigo")[0]).toMatchObject({ ok: true, email: true }));
    expect(invoke).toHaveBeenCalledWith("porta-handoff", { body: { acao: "criar", metodo: "senha" } });
    expect(invoke.mock.calls.filter((c) => (c[1] as { body: { acao: string } }).body.acao === "criar")).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId("porta-sucesso-email").textContent).toBe("Enviamos um link de acesso no seu e-mail"));
    expect(screen.queryByTestId("porta-abrir-app")).toBeNull(); // antes da loja, o principal é a loja

    fireEvent.click(screen.getByTestId("porta-loja"));
    expect(writeText).not.toHaveBeenCalled();
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    const principal = screen.getByTestId("porta-abrir-app");
    expect(principal.textContent).toBe("Abrir o CORE");
    expect(principal.getAttribute("href")).toBe(LINK_APP);
    const loja = screen.getByTestId("porta-loja");
    expect(loja.hasAttribute("data-secundario")).toBe(true);
    expect(loja.textContent).toBe("Ainda não baixou? App Store");
    expect(loja.getAttribute("href")).toBe("/baixar?origem=porta&utm_content=video_organizei");
    expect(nb(screen.getByTestId("porta-sucesso-texto").textContent)).toBe("Baixe o CORE e toque em Entrar — sua conta já está te esperando.");
    fireEvent.click(principal);
    expect(beacons("porta_abrir_app_click")[0]).toMatchObject({ onde: "principal", voltou: true });
    expect(screen.getByTestId("porta-sucesso-dica").textContent).toContain("Entrar");
  });

  it("código sem e-mail enviado: 'Abrir o CORE' na volta, mas sem a faixa verde", async () => {
    ua(UA.safari);
    invoke.mockImplementation(async (_n: string, { body }: { body: { acao: string } }) => (body.acao === "criar" ? { data: { codigo: CODIGO, email_enviado: false }, error: null } : { data: {}, error: null }));
    await contaCriada();
    await waitFor(() => expect(eventos("porta_codigo")[0]).toMatchObject({ ok: true, email: false }));
    expect(screen.queryByTestId("porta-sucesso-email")).toBeNull();
    fireEvent.click(screen.getByTestId("porta-loja"));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("porta-abrir-app").getAttribute("href")).toBe(LINK_APP);
  });

  it("função fora (ou código inválido): sem 'Abrir o CORE' e sem faixa; o fluxo segue com o 'toque em Entrar'", async () => {
    ua(UA.safari);
    await contaCriada();
    await waitFor(() => expect(eventos("porta_codigo")[0]).toMatchObject({ ok: false, erro: "funcao_fora" }));
    expect(screen.queryByTestId("porta-sucesso-email")).toBeNull();
    fireEvent.click(screen.getByTestId("porta-loja"));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.queryByTestId("porta-abrir-app")).toBeNull();
    expect(screen.getByTestId("porta-loja").textContent).toBe("Baixar naApp Store");

    cleanup(); _zerarEstadoPorta(); localStorage.clear(); invoke.mockReset();
    invoke.mockResolvedValue({ data: { codigo: "TESTE" }, error: null }); // formato errado = ignorado
    await contaCriada();
    await waitFor(() => expect(eventos("porta_codigo").at(-1)).toMatchObject({ ok: false }));
  });

  it("recarregou o sucesso logado e sem código: pede 1x", async () => {
    ua(UA.safari);
    invoke.mockResolvedValue({ data: { codigo: CODIGO }, error: null });
    authState.user = usuario();
    noSucesso();
    await waitFor(() => expect(eventos("porta_codigo")[0]).toMatchObject({ ok: true }));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("porta-estado-v1")!).codigo).toBe(CODIGO);
  });

  describe("/abrir?h=<código> (a reserva https do link do e-mail)", () => {
    const abrirLink = (codigo: string) => render(
      <MemoryRouter initialEntries={[`/abrir?h=${codigo}`]}>
        <Routes>
          <Route path="/abrir" element={<AbrirPortaRota />} />
          <Route path="*" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );

    it("'Abrir o CORE' → core://entrar?h=…, 'Baixar' secundário, noindex, evento", () => {
      ua(UA.safari);
      const { unmount } = abrirLink("abcdefgh23");
      expect(screen.getByTestId("porta-abrir-titulo").textContent).toBe("Abrir o CORE");
      const abrir = screen.getByTestId("porta-abrir-app");
      expect(abrir.getAttribute("href")).toBe(LINK_APP);
      expect(screen.getByTestId("porta-abrir-baixar").getAttribute("href")).toBe("/baixar?origem=porta_link");
      expect(screen.getByTestId("porta-abrir-baixar").textContent).toBe("Ainda não tem o app? Baixar");
      expect(document.head.querySelector('meta[name="robots"][data-porta]')?.getAttribute("content")).toMatch(/noindex/);
      expect(eventos("porta_link_view")[0]).toEqual({ valido: true });
      fireEvent.click(abrir);
      expect(beacons("porta_abrir_app_click")[0]).toMatchObject({ onde: "link" });
      unmount();
      expect(document.head.querySelector('meta[name="robots"][data-porta]')).toBeNull();
    });

    it("código torto: sem botão de abrir, ensina o Entrar e oferece baixar", () => {
      abrirLink("xx");
      expect(screen.queryByTestId("porta-abrir-app")).toBeNull();
      expect(screen.getByTestId("porta-abrir-titulo").textContent).toBe("Abra o CORE e toque em Entrar");
      expect(screen.getByTestId("porta-abrir-baixar").getAttribute("href")).toBe("/baixar?origem=porta_link");
    });

    it("o app nativo nunca monta /abrir (SoNaWeb + cinto); TrialBanner não cobre; nada de clipboard na Porta", () => {
      nativo(true);
      abrirLink(CODIGO);
      expect(screen.getByTestId("onde").textContent).toBe("/app");
      const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
      expect(app).toContain('<Route path="/abrir" element={<SoNaWeb><RouteErrorBoundary routeName="porta-abrir"><AbrirPorta /></RouteErrorBoundary></SoNaWeb>} />');
      const banner = readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8");
      expect(banner).toContain('location.pathname.startsWith("/abrir")');
      for (const f of ["PortaIphone.tsx", "SucessoPorta.tsx", "ContaPorta.tsx", "telas.tsx", "AbrirPorta.tsx", "handoff.ts"]) {
        const fonte = readFileSync(join(process.cwd(), "src/pages/porta", f), "utf8");
        expect(fonte).not.toMatch(/navigator\.clipboard|writeText|execCommand|porta_clipboard/);
      }
    });
  });
});
