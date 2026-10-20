/**
 * O FLUXO DA CONTA NOVA NA 1.0.14, COM TUDO LIGADO (build de QA, VITE_V14_QA=1) — teste de
 * integração em jsdom das peças REAIS: a orquestra da missão em doses (MissaoDosesNaWeb), a
 * folha "Plano de amanhã", a régua do tour (useTourDaHome + TourDaHome por cima das peças da
 * Home: pendências, grade de módulos), a festa "Casa arrumada" (badges-vida) e os cartões de
 * boas-vindas (BoasVindasDoModulo) dentro dos módulos. O casco da Home e das páginas dos
 * módulos é de mentira (como em dia1-cheio.test.tsx e tour-home-e-cartoes.test.tsx).
 *
 * Fluxo esperado (dono 10/10, 2ª rodada): missão de 4 passos (3 doses, braço B pra todo mundo,
 * + "Arrumar sua Home" = o tour da Home com a faixa "Missão · 4 de 4") → o fim do tour fecha a
 * missão (missao_completa; a festa "Casa arrumada" é a comemoração) → SÓ ENTÃO a folha do plano
 * de amanhã, a última coisa do dia 1. Quem pulou a missão: tour direto. Tudo com a conta VAZIA.
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

import { UserDataContext, useUserData } from "@/hooks/use-user-data";
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
/** A Rotina de mentira com o caminho REAL de criar um hábito: "+ Hábito" abre o campo, "Adicionar" grava
 *  `rotina-habits` (como a página), e a tabela tem a linha de HOJE com um quadradinho por hábito que grava
 *  `rotina-habits-checked`. É o que a dose 2 ensina em 2 passos. */
const DIAS_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const RotinaFalsa = () => {
  const { get, set } = useUserData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const habitos = (get<string[]>("rotina-habits", []) ?? []);
  const grade = get<Record<string, boolean[]>>("rotina-habits-checked", {}) ?? {};
  const adicionar = () => { if (!nome.trim()) return; set("rotina-habits", [...habitos, nome.trim()]); setNome(""); setAberto(false); };
  const marcar = (dia: string, i: number) => { const linha = [...(grade[dia] ?? habitos.map(() => false))]; linha[i] = !linha[i]; set("rotina-habits-checked", { ...grade, [dia]: linha }); };
  return (
    <div>
      <Rota /><header className="sticky">ROTINA</header><BoasVindasDoModulo moduleId="rotina" tips={["dica"]} />
      <button type="button" data-spotlight="add-habit" onClick={() => setAberto((a) => !a)}>+ Hábito</button>
      {aberto && <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={adicionar}>Adicionar</button></div>}
      <table><tbody>{DIAS_ROTINA.map((d) => (
        <tr key={d}><td>{d}</td>{habitos.map((h, i) => <td key={h}><input type="checkbox" aria-label={`${h} ${d}`} checked={!!grade[d]?.[i]} onChange={() => marcar(d, i)} /></td>)}</tr>
      ))}</tbody></table>
    </div>
  );
};
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
/** A CONTA NOVA DE VERDADE é VAZIA (10/10, dono): nenhum seed — o fluxo inteiro tem que fazer sentido assim. */
const dados = (): Record<string, unknown> => ({});
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** em passos curtos: a missão abre o campo da Rotina por um click que o React só confirma entre os `act` */
const esperarPostIt = () => { for (let i = 0; i < 12; i++) avancar(300); return screen.getAllByTestId("demo-guia-postit").at(-1)!; };
/** toca no 1º chip e chega na festa */
const tocarChipAteAFesta = () => {
  const postIt = esperarPostIt();
  fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
  avancar(700); avancar(1000); avancar(1500); /* 10/10: o olhar rola o card por 1 s, pausa 500 ms e só então monta o anel */
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
/** Dá tempo pro import dinâmico dos cartões (I/O real, fora do relógio falso) e pros relógios curtos. */
const respirar = async (n = 12) => { for (let i = 0; i < n; i++) { await act(async () => { await new Promise((r) => setImmediate(r)); }); avancar(100); } };
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
  // 1.0.16: a dose de Finanças virou o "Vamos montar suas Finanças" — aqui, o caminho de quem PULOU (o 1º gasto pelo chip)
  localStorage.setItem("core-montar-financas", JSON.stringify({ r: "pulou" }));
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

  it("conta VAZIA: boas-vindas (4 passos) → dose 1 (chip Café) → dose 2 (hábito pronto, sem hábito na conta) → dose 3 (copo) → 'Arrumar minha Home' → tour com a faixa 'Missão · 4 de 4' (5 passos) → missão completa ('Casa arrumada' destrancado) → plano de amanhã (a última coisa) → a avaliação 1,5 s depois de cada", async () => {
    const store = montarStore(dados());
    montar(store, "/home");
    // a Home nasce com a missão por cima: nada de tour; a boas-vindas B em 2 telas ("Tá dentro!" → as 3 doses)
    expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveTextContent("Tá dentro! 🎉");
    expect(screen.queryByTestId("tour-home")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    expect(boas).toHaveTextContent("Hoje é só 3 toques.");
    expect(screen.getByTestId("missao-doses-depois")).toHaveTextContent("Depois a gente arruma sua Home junto.");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(lerMissao()?.braco).toBe("B");
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");

    // dose 1 — Finanças: a dose É a boas-vindas; cartões nunca; o chip lança o gasto na conta vazia
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dose 1 de 4");
    tocarChipAteAFesta();
    expect((store.dados["finance-expenses"] as unknown[]).length).toBe(1);
    await respirar(3);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-bora-proxima"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    // dose 2 — Rotina numa conta SEM hábito, em 2 passos: o chip preenche o campo real, "Adicionar" cria, o quadradinho de hoje marca
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("1 de 2");
    fireEvent.pointerDown(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect((screen.getByPlaceholderText("Nome do hábito...") as HTMLInputElement).value).toBe("Beber água ao acordar");
    fireEvent.click(screen.getByText("Adicionar"));
    expect(store.dados["rotina-habits"]).toEqual(["Beber água ao acordar"]);
    avancar(400); avancar(3000);
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).toHaveTextContent("2 de 2");
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    avancar(700); avancar(1000); avancar(1500); /* 10/10: o olhar rola o card por 1 s, pausa 500 ms e só então monta o anel */
    const entendi = screen.queryByTestId("missao-doses-entendi");
    if (entendi) fireEvent.click(entendi);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Segunda dose feita!");
    await respirar(3);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-bora-proxima"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/saude");
    // dose 3 — Saúde: "Terceira dose feita!" + "Falta 1: arrumar sua Home"; a missão NÃO fecha aqui
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Terceira dose feita!");
    expect(screen.getByTestId("missao-doses-falta-home")).toBeInTheDocument();
    await respirar(3);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(nomes()).not.toContain("missao_completa");
    avancar(1500);
    expect(nota.pedir).not.toHaveBeenCalled();

    // "Arrumar minha Home" → Home: a faixa "Missão · 4 de 4" e o tour (o 4º passo); SEM a folha do plano ainda
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · 4 de 4");
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    expect(missaoEmAndamento(lerMissao())).toBe(false); // o tour É o passo 4: pode entrar
    await respirar(10);
    const tour = screen.getByTestId("tour-home");
    expect(tour.getAttribute("data-passo")).toBe("1");
    expect(screen.getByTestId("tour-contador").textContent).toBe(`Passo 1 de ${TOTAL_PASSOS} · falta ${TOTAL_PASSOS - 1}`);
    expect(screen.getByTestId("tour-continuar")).toHaveTextContent("Continuar");
    expect(screen.queryByTestId("tour-faca")).toBeNull(); // o passo do score é só de leitura
    expect(screen.queryByTestId("tour-dedinho")).toBeNull();
    expect(nomes()).toContain("home_tour_visto");

    // os 5 passos ("Continuar" nos 4 primeiros, "Concluir missão" no último) → o fim do tour FECHA a missão
    for (let i = 0; i < TOTAL_PASSOS - 1; i++) fireEvent.click(screen.getByTestId("tour-continuar"));
    expect(screen.getByTestId("tour-concluir")).toHaveTextContent("Concluir missão");
    fireEvent.click(screen.getByTestId("tour-concluir"));
    expect(screen.queryByTestId("tour-home")).toBeNull();
    expect(nomes()).toContain("home_tour_concluido");
    expect(localStorage.getItem(CHAVE_TOUR_FEITO)).toBeTruthy();
    expect(store.dados[CHAVE_TOUR_FEITO]).toBeTruthy();
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 4, modulo: "home" })]);
    expect(nomes()).toContain("missao_completa");
    expect(lerMissao()?.homeTour).toEqual(expect.objectContaining({ via: "tour" }));
    const casa = buildBadgesVida(store.get).find((b) => b.id === "casa-arrumada")!;
    expect(casa.unlocked).toBe(true);
    expect(nota.pedir).not.toHaveBeenCalled();
    avancar(1500);
    expect(nota.pedir).toHaveBeenCalledWith("missao_completa");

    // a festa "Casa arrumada" (Momentos) é a comemoração do fim — a folha do plano espera ela ser vista
    await respirar(3);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    act(() => { store.valor().set("conquistas-vistas", { adesivos: ["casa-arrumada"], marcos: [] }); });
    await respirar(2);
    // a ÚLTIMA coisa do dia 1: a folha do plano de amanhã (sem jargão) → "Combinado" → a nota 1,5 s depois
    const folha = screen.getByTestId("plano-amanha");
    expect(folha).toHaveTextContent("O CORE te avisa do que importa");
    expect(folha).not.toHaveTextContent("dia 2");
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    fireEvent.click(screen.getByTestId("plano-amanha-combinado"));
    expect(nomes()).toContain("plano_amanha_definido");
    expect(missaoEmAndamento(lerMissao())).toBe(false);
    avancar(1500);
    expect(nota.pedir).toHaveBeenLastCalledWith("plano_amanha_definido");
    await respirar(5);
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
    expect(screen.queryByTestId("tour-home")).toBeNull(); // e não volta
  });

  it("quem pulou a missão ('Explorar por conta própria'): o tour entra direto na Home", async () => {
    montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    fireEvent.click(screen.getByTestId("missao-doses-explorar"));
    expect(lerMissao()?.explorou).toBe(true);
    await respirar(10);
    expect(screen.getByTestId("tour-home")).toBeInTheDocument();
  });
});

describe("boas-vindas do módulo × missão em doses (regra obrigatória) — 1.0.16: a intro do módulo no lugar dos cartões", () => {
  /* 16/10 (INTRO_MODULO ligada no app): os cartões SAEM do fluxo — a 1ª visita a um módulo fora da missão mostra a
   * INTRO (Finanças guiada = faixa + anel; Casa = estado vazio com a captura real), e a regra da missão continua a
   * mesma: módulo da missão (dose por fazer, dose feita, 'aprofundar') não ganha NADA por cima. */
  const semBoasVindas = () => { expect(screen.queryByTestId("cartoes-modulo")).toBeNull(); expect(screen.queryByTestId("intro-modulo-faixa")).toBeNull(); };

  it("dia 1, módulo da missão com a dose já feita: nada por cima (a dose foi a boas-vindas) — nem cartões, nem intro", async () => {
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } } });
    montar(montarStore(dados()), "/financas");
    await respirar(10);
    semBoasVindas();
  });

  it("dia 2, módulo da missão em 'aprofundar' (o bug do dono): a faixa da missão aparece e nada por cima; módulo fora da missão (Casa): a intro (estado vazio), sem cartões", async () => {
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // dia 2
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "a" }, 2: { dia: "2026-10-03", rotulo: "b" }, 3: { dia: "2026-10-03", rotulo: "c" } }, completaEm: "2026-10-03", planoAmanha: { quando: "manha", dia: "2026-10-03" } });
    montar(montarStore(dados()), "/financas");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent(/Aprofundar/);
    await respirar(10);
    semBoasVindas();
    expect(nomes()).not.toContain("modulo_cartoes_vistos");
    cleanup();
    montar(montarStore(dados()), "/casa");
    await respirar(4);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("organize 1 cômodo"); // a intro de 1 toque da Casa (17/10)
    expect(nomes()).toContain("modulo_intro_vista");
    expect(nomes()).not.toContain("modulo_cartoes_vistos");
  });

  it("pulou a missão inteira: a intro em qualquer módulo, inclusive os 3 da missão (Finanças guiada), e nunca cartões", async () => {
    missaoGravada({ braco: "B", explorou: true });
    montar(montarStore(dados()), "/financas");
    await respirar(4);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.getByTestId("intro-modulo-faixa")).toHaveTextContent(/anote 1 gasto/);
    expect(nomes()).toContain("modulo_intro_vista");
  });

  it("braço A (uma dose por dia): Rotina no dia 1 (a dose é só amanhã) abriu por curiosidade → a intro; dia 2, Finanças com a dose feita = nada por cima; fora da missão, a intro", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=a"); // o teste ligado com o braço A forçado (a missão grava o braço dela)
    missaoGravada({ braco: "A", feitos: { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } } });
    montar(montarStore(dados()), "/rotina"); // dia 1: a dose 2 (Rotina) é só amanhã — a intro (dono 17/10: "não vai esperar o dia 2")
    await respirar(4);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.getByTestId("intro-modulo-faixa")).toHaveTextContent(/marque 1 hábito/);
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // dia 2
    montar(montarStore(dados()), "/financas"); // a dose do dia 1 já foi: continua sem nada por cima
    await respirar(10);
    semBoasVindas();
    cleanup();
    montar(montarStore(dados()), "/casa");
    await respirar(4);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("organize 1 cômodo");
  });

  it("missão da 1.0.10 (sem braço / chave do dia 1 cheio desligada): a dose 2 abre na Rotina no mesmo dia, como sempre — e nada por cima dela (nem cartões, nem intro)", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=off"); // a força do link vence a env: a missão de hoje, sem braço
    expect(modoDia1Cheio()).toBe("off");
    missaoGravada({ feitos: { 1: { dia: "2026-10-03", rotulo: "a" } } });
    montar(montarStore(dados()), "/rotina");
    await respirar(4);
    expect(screen.getByTestId("missao-doses-faixa")).toBeTruthy();
    semBoasVindas();
  });

  it("conta antiga (nunca viu missão), módulo vazio: a intro na 1ª visita de cada módulo, e só uma vez por aparelho; sem cartões", async () => {
    conta.created_at = new Date(2026, 8, 20, 9, 0).toISOString(); // 13 dias: a missão não nasce
    montar(montarStore(dados()), "/financas");
    expect(lerMissao()).toBeNull();
    await respirar(4);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    const faixa = screen.getByTestId("intro-modulo-faixa");
    fireEvent.click(faixa); fireEvent.click(faixa); // 2 toques na faixa = o "Pular" aparece
    fireEvent.click(screen.getByTestId("intro-modulo-agora-nao"));
    expect(screen.queryByTestId("intro-modulo-faixa")).toBeNull();
    expect(localStorage.getItem("core-intro-vista-financas")).toBeTruthy();
    cleanup();
    montar(montarStore(dados()), "/financas");
    await respirar(10);
    semBoasVindas(); // já viu neste aparelho
    cleanup();
    montar(montarStore(dados()), "/rotina");
    await respirar(4);
    expect(screen.getByTestId("intro-modulo-faixa")).toHaveTextContent(/marque 1 hábito/); // outro módulo: 1ª visita
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
  });
});
