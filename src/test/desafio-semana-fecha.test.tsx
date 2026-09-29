/**
 * DESAFIO DA SEMANA (Finanças › Painel) — o resultado não pode depender do
 * Painel estar aberto no domingo (29/09, achado de outro agente, conferido
 * aqui). Casos com relógio simulado: fecha no card, fecha na abertura do app
 * sem o card, e a semana que cruza o mês (28/09 a 04/10).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-desafio" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { WeeklyChallenge } from "@/components/challenges/WeeklyChallenge";
import { fecharSemanaDoDesafio, gastosParaDesafio, type ChallengesState } from "@/components/challenges/challenges";
import { useFechamentoDoDesafio } from "@/hooks/use-fechamento-desafio";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => { vi.useRealTimers(); });

const criarStore = (inicial: Record<string, unknown>) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const sistema: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown, opts?: { system?: boolean }) => { dados[key] = value; if (opts?.system) sistema.push(key); },
    loaded: true,
    isGuest: false,
    fetchKey: async () => null,
  };
  return { dados, sistema, valor };
};
const quando = (a: number, m: number, d: number, h = 9) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(a, m - 1, d, h, 0));
};
const desafios = (dados: Record<string, unknown>) => dados["finance-challenges"] as ChallengesState;
const gasto = (id: string, date: string, value: number, category = "alimentacao") => ({ id, date, value, category, description: category });

describe("a semana que passou fecha AVALIADA (não 'derrota' automática)", () => {
  it("'Semana sem delivery' cumprida, Painel aberto só na segunda: vitória (antes: derrota)", async () => {
    quando(2026, 9, 28); // segunda
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-09-21" }, history: [] },
      "finance-expenses": [gasto("1", "2026-09-22", 40), gasto("2", "2026-09-27", 25)],
    });
    render(<UserDataContext.Provider value={store.valor}><WeeklyChallenge expenses={store.dados["finance-expenses"] as never} /></UserDataContext.Provider>);
    await act(async () => {});
    expect(desafios(store.dados).history).toEqual([{ key: "sem-delivery", weekStart: "2026-09-21", result: "win" }]);
    expect(desafios(store.dados).active).toBeNull();
  });

  it("com delivery na semana continua derrota", async () => {
    quando(2026, 9, 28);
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-09-21" }, history: [] },
      "finance-expenses": [gasto("1", "2026-09-26", 58, "delivery")],
    });
    render(<UserDataContext.Provider value={store.valor}><WeeklyChallenge expenses={store.dados["finance-expenses"] as never} /></UserDataContext.Provider>);
    await act(async () => {});
    expect(desafios(store.dados).history[0].result).toBe("loss");
  });

  it("vitória do meio da semana (já no histórico) não vira derrota nem duplica", () => {
    const estado: ChallengesState = { active: { key: "tres-dias-zero", weekStart: "2026-09-21" }, history: [{ key: "tres-dias-zero", weekStart: "2026-09-21", result: "win" }] };
    const r = fecharSemanaDoDesafio(estado, () => [], new Date(2026, 8, 28, 9));
    expect(r).toEqual({ active: null, history: estado.history });
  });
});

describe("fecha na ABERTURA do app, sem o Painel montado", () => {
  const SemPainel = () => { useFechamentoDoDesafio(); return <p>home</p>; };

  it("'Gastar menos que a semana passada' (R$ 300 × R$ 500): vitória gravada como escrita de sistema", async () => {
    quando(2026, 9, 28);
    const store = criarStore({
      "finance-challenges": { active: { key: "menos-que-passada", weekStart: "2026-09-21" }, history: [] },
      "finance-expenses": [gasto("a", "2026-09-15", 500), gasto("b", "2026-09-23", 300)],
    });
    render(<UserDataContext.Provider value={store.valor}><SemPainel /></UserDataContext.Provider>);
    await act(async () => {});
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(desafios(store.dados).history).toEqual([{ key: "menos-que-passada", weekStart: "2026-09-21", result: "win" }]);
    expect(store.sistema).toContain("finance-challenges"); // não conta como gesto da pessoa (ativação)
  });

  it("desafio desta semana não é mexido", async () => {
    quando(2026, 9, 30);
    const store = criarStore({ "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-09-28" }, history: [] } });
    render(<UserDataContext.Provider value={store.valor}><SemPainel /></UserDataContext.Provider>);
    await act(async () => {});
    expect(desafios(store.dados).active).toEqual({ key: "sem-delivery", weekStart: "2026-09-28" });
  });
});

describe("a semana que cruza o mês (28/09 a 04/10)", () => {
  it("em 02/10 o delivery de 29/09 (já no arquivo de setembro) ainda derruba o desafio", async () => {
    quando(2026, 10, 2);
    const store = criarStore({
      "finance-challenges": { active: { key: "sem-delivery", weekStart: "2026-09-28" }, history: [] },
      "finance-expenses": [gasto("o1", "2026-10-01", 30)],
      "finance-2026-setembro-expenses": [gasto("s1", "2026-09-29", 62, "delivery")],
    });
    render(<UserDataContext.Provider value={store.valor}><WeeklyChallenge expenses={store.dados["finance-expenses"] as never} /></UserDataContext.Provider>);
    await act(async () => {});
    expect(screen.getByText(/Rolou um delivery/)).toBeInTheDocument();
  });

  it("'menos que a semana passada' fechando em 05/10 compara com a semana de 21–27/09 (toda no arquivo)", () => {
    const ler = (k: string) => ({
      "finance-expenses": [gasto("o1", "2026-10-02", 100)],
      "finance-2026-setembro-expenses": [gasto("s0", "2026-09-22", 400), gasto("s1", "2026-09-29", 150)],
    } as Record<string, unknown>)[k];
    const gastos = gastosParaDesafio(ler, "2026-09-28", "pessoal");
    expect(gastos.map((g) => g.id).sort()).toEqual(["o1", "s0", "s1"]);
    const r = fecharSemanaDoDesafio({ active: { key: "menos-que-passada", weekStart: "2026-09-28" }, history: [] }, (ws) => gastosParaDesafio(ler, ws, "pessoal"), new Date(2026, 9, 5, 9));
    expect(r?.history[0]).toEqual({ key: "menos-que-passada", weekStart: "2026-09-28", result: "win" }); // 250 < 400
  });
});
