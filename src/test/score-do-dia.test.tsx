/**
 * Score do Dia — "fiz tudo mas só vai até os 95%" (cliente pagante, 10/09).
 *
 * O score somava 12 blocos = 100, mas três só existiam pra quem tinha
 * cadastro em outro módulo (suplemento, livro "lendo", plano de 4 refeições).
 * Quem não usava ficava com teto 95/90 e ainda lia "Dia completo!" a partir
 * de 80. Este arquivo é a trava dos dois lados:
 *  - o score FECHA em 100 pra quem fez tudo o que a tela mostra, com ou sem
 *    esses cadastros;
 *  - a comemoração (frase, anel, toast) só existe em 100, e o toast sai UMA
 *    vez por dia — ciclo completo: abrir → 100 → sair → reabrir → amanhã.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { DayScoreRing, CHAVE_DIA_100_VISTO, MENSAGEM_DIA_100 } from "@/components/home/DayScoreRing";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { localDayKey } from "@/lib/utils";

const toastMock = vi.fn();
vi.mock("sonner", () => ({ toast: (...args: unknown[]) => toastMock(...args) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-1", email: "cliente@exemplo.com" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
// O header arrasta ThemeToggle (contexto de tema) e AccountDrawer (supabase,
// router). Nada disso é o que está em teste: só a frase.
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/home/AccountDrawer", () => ({ AccountDrawer: () => null }));
vi.mock("@/components/home/NameEditDialog", () => ({ NameEditDialog: () => null }));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

const Sonda = () => {
  const d = useLifeHubData();
  return <p data-testid="score">{d.dayScore}</p>;
};
const scoreDe = (dados: Record<string, unknown>) => {
  const tela = renderComStore(<Sonda />, criarStore(dados));
  const n = Number(screen.getByTestId("score").textContent);
  tela.unmount();
  return n;
};

const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const hoje = () => localDayKey();
const diaDaSemana = () => DIAS[new Date().getDay()];

/** O "básico" da cliente: hábitos cadastrados, treino programado pra hoje —
 *  e TUDO feito. Sem suplemento, sem livro, sem plano de refeições. */
const tudoFeitoBasico = (): Record<string, unknown> => ({
  "rotina-habits": [{ id: "h1", name: "Meditar" }, { id: "h2", name: "Alongar" }],
  "core-rotina-habit-log": { [hoje()]: { h1: true, h2: true } },
  "saude-workouts-v2": { [diaDaSemana()]: { muscles: ["Peito"] } },
  "treino-active-days": [diaDaSemana()],
  "saude-workout-log": [hoje()],
  "core-saude-water": { [hoje()]: 8 },
  "core-dieta-log": { [hoje()]: { cafe: { calories: 300 }, almoco: {}, lanche: {}, jantar: {} } },
  "mood-log": { [hoje()]: 4 },
  "dp-gratitude": { [hoje()]: ["família"] },
  "hiperfoco-thoughts": { [hoje()]: { ideias: ["app novo"] } },
  "core-saude-measures": [{ date: hoje(), weight: 70 }],
  "sleep-log": { [hoje()]: 7.5 },
  "finance-expenses": [{ date: hoje(), value: 12.5, category: "Alimentação" }],
});

/** Tudo cadastrado por cima: suplemento tomado, livro lendo, plano de 3
 *  refeições todas registradas. */
const tudoFeitoCompleto = (): Record<string, unknown> => ({
  ...tudoFeitoBasico(),
  "core-saude-supplements": [{ id: "s1", name: "Creatina" }, { id: "s2", name: "Ômega 3" }],
  "core-saude-supplement-log": { [hoje()]: ["s1", "s2"] },
  "lib-books": [{ id: "b1", title: "Hábitos Atômicos", status: "lendo", progress: 40 }],
  "core-dieta-meals": [{ name: "Café" }, { name: "Almoço" }, { name: "Jantar" }],
  "core-dieta-log": { [hoje()]: { cafe: {}, almoco: {}, jantar: {} } },
});

beforeEach(() => {
  toastMock.mockReset();
  try { localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Score do Dia fecha em 100", () => {
  it("tudo feito, nada cadastrado além do básico = 100 (caso da cliente: sem suplemento, sem livro)", () => {
    expect(scoreDe(tudoFeitoBasico())).toBe(100);
  });

  it("tudo feito, tudo cadastrado = 100 (os pesos somam 100, sem ponto sobrando)", () => {
    expect(scoreDe(tudoFeitoCompleto())).toBe(100);
  });

  it("caso da cliente com livro mas sem suplemento (o antigo teto de 95) = 100", () => {
    expect(scoreDe({
      ...tudoFeitoBasico(),
      "lib-books": [{ id: "b1", title: "Um livro", status: "lendo" }],
    })).toBe(100);
  });

  it("suplemento cadastrado e NÃO tomado continua cobrando os 5", () => {
    expect(scoreDe({
      ...tudoFeitoBasico(),
      "core-saude-supplements": [{ id: "s1", name: "Creatina" }],
    })).toBe(95);
  });

  it("plano de 3 refeições, 3 registradas = os 10 pontos inteiros (antes dava 8)", () => {
    const base = tudoFeitoBasico();
    const plano3 = { "core-dieta-meals": [{ name: "Café" }, { name: "Almoço" }, { name: "Jantar" }] };
    expect(scoreDe({ ...base, ...plano3, "core-dieta-log": { [hoje()]: { a: {}, b: {}, c: {} } } })).toBe(100);
    // 2 de 3 → round(6,67) = 7, não round(2/4*10) = 5
    expect(scoreDe({ ...base, ...plano3, "core-dieta-log": { [hoje()]: { a: {}, b: {} } } })).toBe(97);
    // registrar além do plano não passa de 10 — o bloco não mascara outro
    expect(scoreDe({
      ...base, ...plano3,
      "core-dieta-log": { [hoje()]: { a: {}, b: {}, c: {}, d: {}, e: {} } },
      "sleep-log": {},
    })).toBe(95);
  });

  it("sem plano de refeições continua cobrando 4", () => {
    expect(scoreDe({ ...tudoFeitoBasico(), "core-dieta-log": { [hoje()]: { a: {}, b: {} } } })).toBe(95);
  });

  it("nada feito continua baixo — só o que não existe pra cobrar (suplemento, leitura) entra", () => {
    const nadaFeito = {
      "rotina-habits": [{ id: "h1", name: "Meditar" }],
      "saude-workouts-v2": { [diaDaSemana()]: { muscles: ["Peito"] } },
      "treino-active-days": [diaDaSemana()],
    };
    expect(scoreDe(nadaFeito)).toBe(10);
    // sem hábito cadastrado a Home pede pra cadastrar: os 20 seguem em aberto
    expect(scoreDe({})).toBeLessThan(30);
  });
});

describe("Comemoração dos 100", () => {
  const dadosHeader = (dayScore: number) => ({
    dayScore, streak: 3, monthBalance: 0, nextBillName: null, nextBillDate: null,
    todayWorkoutGroup: null, workoutDone: true, workoutTime: null,
    caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 4, mealsTotal: 4,
    waterGlasses: 8, waterGoal: 8, sleepHours: 7,
    supplementsTaken: 0, supplementsTotal: 0,
    currentBook: null, readingProgress: 0, booksReadThisYear: 0,
    tasksCompleted: 2, tasksTotal: 2, habits: [], userName: "Ana",
  });

  it("'Dia completo' só em 100; de 80 a 99 é 'Dia incrível'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10, 22, 0, 0));
    const store = criarStore();
    const a = renderComStore(<GreetingHeader data={dadosHeader(95)} />, store);
    expect(screen.getByText(/Dia incrível/)).toBeInTheDocument();
    expect(screen.queryByText(/Dia completo/)).not.toBeInTheDocument();
    a.unmount();

    const b = renderComStore(<GreetingHeader data={dadosHeader(100)} />, store);
    expect(screen.getByText(/Dia completo! Descanse com orgulho/)).toBeInTheDocument();
    b.unmount();

    // no turno das 18–21 a mesma regra
    vi.setSystemTime(new Date(2026, 8, 10, 19, 30, 0));
    const c = renderComStore(<GreetingHeader data={dadosHeader(99)} />, store);
    expect(screen.getByText(/Dia incrível/)).toBeInTheDocument();
    c.unmount();
    renderComStore(<GreetingHeader data={dadosHeader(100)} />, store);
    expect(screen.getByText(/Dia completo/)).toBeInTheDocument();
  });

  it("anel marca o 100 e o número vai pro tom de sucesso; abaixo disso não", () => {
    const a = render(<DayScoreRing score={99} streak={0} />);
    expect(screen.getByTestId("anel-score")).not.toHaveAttribute("data-completo");
    expect(screen.getByText("99")).not.toHaveClass("text-success");
    a.unmount();
    render(<DayScoreRing score={100} streak={0} />);
    expect(screen.getByTestId("anel-score")).toHaveAttribute("data-completo", "true");
    expect(screen.getByText("100")).toHaveClass("text-success");
  });

  it("toast dispara UMA vez por dia: abrir → 100 → sair → reabrir (não repete) → dia seguinte (repete)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10, 21, 0, 0));

    // abre em 95: nada
    const a = render(<DayScoreRing score={95} streak={0} />);
    expect(toastMock).not.toHaveBeenCalled();
    a.unmount();

    // cruza 100 (rerender na mesma Home)
    const b = render(<DayScoreRing score={95} streak={0} />);
    act(() => { b.rerender(<DayScoreRing score={100} streak={0} />); });
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][0]).toBe(MENSAGEM_DIA_100);
    expect(localStorage.getItem(CHAVE_DIA_100_VISTO)).toBe("2026-09-10");
    b.unmount();

    // reabre a Home no mesmo dia: não repete
    const c = render(<DayScoreRing score={100} streak={0} />);
    expect(toastMock).toHaveBeenCalledTimes(1);
    c.unmount();

    // dia seguinte, 100 de novo: comemora de novo
    vi.setSystemTime(new Date(2026, 8, 11, 21, 0, 0));
    render(<DayScoreRing score={100} streak={0} />);
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(CHAVE_DIA_100_VISTO)).toBe("2026-09-11");
  });
});
