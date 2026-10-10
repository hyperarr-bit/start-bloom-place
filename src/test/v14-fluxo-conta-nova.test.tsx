/**
 * O FLUXO DA CONTA NOVA NA 1.0.14, COM TUDO LIGADO (build de QA, VITE_V14_QA=1) — teste de
 * integração em jsdom das peças REAIS: a orquestra da missão em doses (MissaoDosesNaWeb), a
 * folha "Plano de amanhã", a régua do tour (useTourDaHome + TourDaHome por cima das peças da
 * Home: pendências, grade de módulos), a festa "Casa arrumada" (badges-vida) e os cartões de
 * boas-vindas (BoasVindasDoModulo) dentro dos módulos. O casco da Home e das páginas dos
 * módulos é de mentira (como em dia1-cheio.test.tsx e tour-home-e-cartoes.test.tsx).
 *
 * Fluxo esperado (dono 10/10): missão (3 doses, braço B pra todo mundo) → plano de amanhã →
 * tour da Home (5 passos) → festa "Casa arrumada". Quem pulou a missão: tour direto.
 *
 * Cartões × missão (regra obrigatória, dono 10/10):
 *   · módulo QUE FAZ PARTE da missão: NUNCA cartões — nem no dia 1 (a dose é a boas-vindas), nem
 *     no dia 2/3 do "aprofundar" (o bug que o dono apontou);
 *   · módulo fora da missão: cartões na 1ª visita;
 *   · pulou a missão inteira: cartões em qualquer módulo;
 *   · missão da 1.0.10 (braço A / chave off): mesma regra;
 *   · conta antiga (nunca viu missão): cartões na 1ª visita de cada módulo.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
const nota = vi.hoisted(() => ({ pedir: vi.fn(async (_m: string) => true) }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: (m: string) => nota.pedir(m) }));
vi.mock("@/lib/notificacoes", async (orig) => ({
  ...(await orig<typeof import("@/lib/notificacoes")>()),
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu" as const),
  agendarProximaDose: vi.fn(async () => ({ ok: true as const, quando: new Date(2026, 9, 3, 18, 10) })),
}));
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", () => ({ ConstruiuEm3Dias: () => <div data-testid="construiu">O que você construiu</div> }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) } },
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { ModuleDrawer } from "@/components/home/ModuleDrawer";
import { TourDaHome, TOTAL_PASSOS, useTourDaHome } from "@/components/home/TourDaHome";
import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { CHAVE_TOUR_FEITO, cartoesLigados, tourHomeLigado } from "@/lib/tour-home";
import { CHAVE_ESTADO_MISSAO_DOSES, iniciarMissao, lerMissao, missaoEmAndamento } from "@/lib/missao-doses";
import { guardarForcaDia1Cheio, modoDia1Cheio } from "@/lib/dia1-cheio";

/* ------------------------------------------------------------ o aparelho de mentira */
function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f), ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
/* `get` só muda quando o store muda (como o provider de verdade): peças da Home (hub, grade) têm efeitos
 * que dependem do `get` — um `get` novo a cada render viraria laço infinito de efeito → estado → render. */
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [versao, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  const get = useCallback(<T,>(k: string, f: T): T => store.get(k, f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => store.valor().set(k, v), []); // eslint-disable-line react-hooks/exhaustive-deps
  const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
/** A Home de mentira com as âncoras REAIS do tour, as peças reais (pendências, grade) e a régua real (useTourDaHome). */
const HomeFalsa = () => {
  const life = useLifeHubData();
  const mostrarTour = useTourDaHome(conta.created_at, true);
  return (
    <div>
      <Rota />
      <div data-tour="score"><p data-testid="score">{life.dayScore}</p></div>
      <div data-tour="acoes-rapidas">ações</div>
      <button type="button" data-tour="adicionar-widget">Adicionar widget</button>
      <div data-tour="pendencias"><NextHoursTimeline data={life} /></div>
      <div data-tour="modulos"><ModuleDrawer /></div>
      {mostrarTour && <TourDaHome lifeData={life} widgetsAtivos={["habits"]} adicionarWidget={() => {}} />}
    </div>
  );
};
const FinancasFalsa = () => (
  <div><Rota /><header className="sticky">FINANÇAS</header><BoasVindasDoModulo moduleId="financas" tips={["dica"]} /><div><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div><section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
);
const RotinaFalsa = () => <div><Rota /><header className="sticky">ROTINA</header><BoasVindasDoModulo moduleId="rotina" tips={["dica"]} /><button type="button" data-spotlight="add-habit">+</button></div>;
const SaudeFalsa = () => <div><Rota /><header className="sticky">SAÚDE</header><BoasVindasDoModulo moduleId="saude" tips={["dica"]} /><button type="button" data-spotlight="add-water">+</button></div>;
const CasaFalsa = () => <div><Rota /><header className="sticky">CASA</header><BoasVindasDoModulo moduleId="casa" tips={["dica"]} /></div>;
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeFalsa />} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="/rotina" element={<RotinaFalsa />} />
          <Route path="/saude" element={<SaudeFalsa />} />
          <Route path="/casa" element={<CasaFalsa />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const dados = () => ({ "core-user-name": "Ana", "rotina-habits": ["Água", "Andar"], "finance-expenses": [] as unknown[], "conquistas-vistas": { adesivos: [], marcos: [] }, "conquistas-desbloqueadas": {} });
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const esperarPostIt = () => { avancar(400); avancar(3000); return screen.getByTestId("demo-guia-postit"); };
/** toca no 1º chip e chega na festa */
const tocarChipAteAFesta = () => {
  const postIt = esperarPostIt();
  fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
  avancar(700); avancar(1000);
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
/** A dose da Rotina: o post-it pede o quadradinho de HOJE (sem chip) — aqui o módulo de mentira grava o que o quadradinho gravaria. */
const marcarQuadradinhoAteAFesta = (store: Store) => {
  esperarPostIt();
  const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
  act(() => { store.valor().set("rotina-habits-checked", { [DIAS[new Date().getDay()]]: [true, false] }); });
  avancar(700); avancar(1000);
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
/** Dá tempo pro import dinâmico dos cartões (I/O real, fora do relógio falso) e pros relógios curtos. */
const respirar = async (n = 12) => { for (let i = 0; i < n; i++) { await act(async () => { await new Promise((r) => setImmediate(r)); }); avancar(100); } };
/** O import dinâmico da config lê o arquivo de verdade (100–300 ms reais na 1ª vez): espera pelo relógio REAL (performance.now não é falso aqui). */
const esperarCartoes = async () => {
  const inicio = performance.now();
  while (!screen.queryByTestId("cartoes-modulo") && performance.now() - inicio < 4000) { await act(async () => { await new Promise((r) => setImmediate(r)); }); avancar(50); }
  return screen.queryByTestId("cartoes-modulo");
};
const missaoGravada = (extra: Record<string, unknown>, inicio = "2026-10-03") => {
  const m = iniciarMissao(["financas", "rotina", "saude"], inicio);
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, ...extra }));
};
const nomes = () => eventos.map(([n]) => n);

// (sem o prepararJsdom: o ResizeObserver de mentira dele nunca avisa, e o post-it da missão espera por ele)
beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  nota.pedir.mockClear();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  localStorage.setItem("core-funnel-area", "dinheiro");
  vi.stubEnv("VITE_V14_QA", "1"); // a build de QA: tudo ligado, dia 1 cheio "on"
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026, 15:10
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("o fluxo inteiro da conta nova (QA: tudo ligado)", () => {
  it("as chaves da build de QA estão ligadas no shell do iPhone", () => {
    expect(modoDia1Cheio()).toBe("on");
    expect(tourHomeLigado()).toBe(true);
    expect(cartoesLigados()).toBe(true);
  });

  it("missão (3 doses no dia 1, sem cartões nos módulos dela) → plano de amanhã (prioridade sobre o tour) → tour da Home (5 passos) → 'Casa arrumada'; a avaliação é pedida 1,5 s depois de cada comemoração", async () => {
    const store = montarStore(dados());
    montar(store, "/home");
    // a Home nasce com a missão por cima: nada de tour
    expect(screen.getByTestId("missao-doses-boas-vindas")).toBeInTheDocument();
    expect(screen.queryByTestId("tour-home")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(lerMissao()?.braco).toBe("B");
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");

    // dose 1 — Finanças: a dose É a boas-vindas; cartões nunca
    tocarChipAteAFesta();
    await respirar(3);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-bora-proxima"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    // dose 2 — Rotina: a dose do hábito não tem chip, é o quadradinho de hoje no próprio módulo
    marcarQuadradinhoAteAFesta(store);
    await respirar(3);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-bora-proxima"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/saude");
    // dose 3 — Saúde: missão cumprida → a nota 1,5 s depois da comemoração
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Missão cumprida!");
    await respirar(3);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(nomes()).toContain("missao_completa");
    expect(nota.pedir).not.toHaveBeenCalled();
    avancar(1500);
    expect(nota.pedir).toHaveBeenCalledWith("missao_completa");

    // fecha o dia → Home: a folha "Plano de amanhã" tem prioridade; o tour espera
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.getByTestId("plano-amanha")).toBeInTheDocument();
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    await respirar(10);
    expect(screen.queryByTestId("tour-home")).toBeNull();

    // "Combinado" → a nota do plano 1,5 s depois → o tour entra
    fireEvent.click(screen.getByTestId("plano-amanha-combinado"));
    expect(nomes()).toContain("plano_amanha_definido");
    expect(missaoEmAndamento(lerMissao())).toBe(false);
    avancar(1500);
    expect(nota.pedir).toHaveBeenLastCalledWith("plano_amanha_definido");
    await respirar(10);
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    const tour = screen.getByTestId("tour-home");
    expect(tour.getAttribute("data-passo")).toBe("1");
    expect(screen.getByTestId("tour-contador").textContent).toBe(`1 de ${TOTAL_PASSOS}`);
    expect(nomes()).toContain("home_tour_visto");

    // os 5 passos ("Deixar como está" em todos) → fim → "Casa arrumada" destrancado
    for (let i = 0; i < TOTAL_PASSOS; i++) fireEvent.click(screen.getByTestId("tour-deixar"));
    expect(screen.queryByTestId("tour-home")).toBeNull();
    expect(nomes()).toContain("home_tour_concluido");
    expect(localStorage.getItem(CHAVE_TOUR_FEITO)).toBeTruthy();
    expect(store.dados[CHAVE_TOUR_FEITO]).toBeTruthy();
    const casa = buildBadgesVida(store.get).find((b) => b.id === "casa-arrumada")!;
    expect(casa.unlocked).toBe(true);
    // e não volta
    await respirar(5);
    expect(screen.queryByTestId("tour-home")).toBeNull();
  });

  it("quem pulou a missão ('Explorar por conta própria'): o tour entra direto na Home", async () => {
    montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-explorar"));
    expect(lerMissao()?.explorou).toBe(true);
    await respirar(10);
    expect(screen.getByTestId("tour-home")).toBeInTheDocument();
  });
});

describe("cartões de boas-vindas × missão em doses (regra obrigatória)", () => {
  it("dia 1, módulo da missão com a dose já feita: sem cartões (a dose foi a boas-vindas)", async () => {
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    montar(montarStore(dados()), "/financas");
    await respirar(10);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
  });

  it("dia 2, módulo da missão em 'aprofundar' (o bug do dono): a faixa da missão aparece e os cartões NÃO; módulo fora da missão (Casa): cartões", async () => {
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // dia 2
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "a" }, 2: { dia: "2026-10-03", rotulo: "b" }, 3: { dia: "2026-10-03", rotulo: "c" } }, completaEm: "2026-10-03", planoAmanha: { quando: "manha", dia: "2026-10-03" } });
    montar(montarStore(dados()), "/financas");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent(/Aprofundar/);
    await respirar(10);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(nomes()).not.toContain("modulo_cartoes_vistos");
    cleanup();
    montar(montarStore(dados()), "/casa");
    const folha = await esperarCartoes();
    expect(folha).not.toBeNull();
    expect(folha!.className).toContain("ct-casa");
    expect(nomes()).toContain("modulo_cartoes_vistos");
  });

  it("pulou a missão inteira: cartões em qualquer módulo, inclusive os 3 da missão", async () => {
    missaoGravada({ braco: "B", explorou: true });
    montar(montarStore(dados()), "/financas");
    const folha = await esperarCartoes();
    expect(folha).not.toBeNull();
    expect(folha!.getAttribute("data-modulo")).toBe("financas");
  });

  it("missão da 1.0.10 (braço A / chave do dia 1 cheio desligada): módulo da missão sem cartões (dia 1 e dia 2); fora da missão, cartões", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=off"); // a força do link vence a env: a missão de hoje, sem braço
    expect(modoDia1Cheio()).toBe("off");
    missaoGravada({ feitos: { 1: { dia: "2026-10-03", rotulo: "a" } } });
    montar(montarStore(dados()), "/rotina"); // dia 1: a dose 2 (Rotina) está por fazer
    await respirar(10);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // dia 2
    montar(montarStore(dados()), "/financas"); // a dose do dia 1 já foi: continua sem cartões
    await respirar(10);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    cleanup();
    montar(montarStore(dados()), "/casa");
    expect(await esperarCartoes()).not.toBeNull();
  });

  it("conta antiga (nunca viu missão): cartões na 1ª visita de cada módulo, e só uma vez por aparelho", async () => {
    conta.created_at = new Date(2026, 8, 20, 9, 0).toISOString(); // 13 dias: a missão não nasce
    montar(montarStore(dados()), "/financas");
    expect(lerMissao()).toBeNull();
    const folha = await esperarCartoes();
    expect(folha).not.toBeNull();
    fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
    cleanup();
    montar(montarStore(dados()), "/financas");
    await respirar(10);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull(); // já viu neste aparelho
    cleanup();
    montar(montarStore(dados()), "/rotina");
    expect(await esperarCartoes()).not.toBeNull(); // outro módulo: 1ª visita
  });
});
