/**
 * A TELA DE FINANÇAS DE VERDADE NA VIRADA DO MÊS (26/09).
 *
 * Cenário do aviso "seu limite de hoje" (8h, abre /financas): o app abre
 * FRIO direto em Finanças no dia 1º, com o cache de setembro no aparelho, e a
 * carga do servidor volta depois de a tela montar. Aqui monta o Index real
 * (não um dublê) com o hook da virada no pai, como em AnimatedRoutes.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/virada-mes-index.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: "u-index" } as { id: string } | null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const q: any = {
        select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, gte: () => q, lte: () => q,
        maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
        update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
      };
      return q;
    },
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useViradaDoMes } from "@/hooks/use-virada-do-mes";
import { CHAVE_CARIMBO_CONTAS, viradaDeContas, type DiaDeContas } from "@/lib/virada-contas";
import Index from "@/pages/Index";

const UID = "u-index";
const lsKey = (k: string) => `u:${UID}:${k}`;
const em = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min);
const nascida = (a: number, m: number, d: number, h = 12) => String(em(a, m, d, h).getTime());
const contasDe = (dias: unknown) => (dias as DiaDeContas[]).flatMap((d) => d.bills);

type Controle = { setLoaded: (v: boolean) => void; dados: () => Record<string, unknown> };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.setLoaded = setLoaded;
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(
    () => ({ get, set, loaded, isGuest: false, fetchKey: async () => null }), [get, set, loaded],
  );
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const App = () => {
  useViradaDoMes();
  return <Routes><Route path="/financas" element={<Index />} /></Routes>;
};

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Finanças aberta direto no dia 1º (aviso das 8h), antes da carga do servidor", () => {
  const aluguel = nascida(2026, 8, 3);
  const setembro: Record<string, unknown> = {
    "spotlight-done-financas": "true",
    "finance-fixed-expenses": [{ id: aluguel, description: "Aluguel", value: 2000, day: 5, category: "moradia", paymentMethod: "boleto" }],
    "finance-dueDays": [
      { day: 5, color: "yellow", bills: [{ id: `fx-${aluguel}`, name: "Aluguel", paid: true, value: 2000, fixedId: aluguel }] },
      { day: 10, color: "slate", bills: [{ id: nascida(2026, 8, 4), name: "Luz", paid: true, value: 180 }] },
    ],
    [CHAVE_CARIMBO_CONTAS]: "2026-09",
    "finance-incomes": [{ id: "r-set", date: "2026-09-05", value: 5000, description: "Salário" }],
    "finance-expenses": [{ id: "e-set", date: "2026-09-28", value: 300, description: "Mercado", category: "mercado", paymentMethod: "pix" }],
  };

  it("a tela remonta com outubro quando a virada grava, e o 1º toque não devolve setembro", async () => {
    vi.setSystemTime(em(2026, 10, 1, 8, 0));
    for (const [k, v] of Object.entries(setembro)) localStorage.setItem(lsKey(k), JSON.stringify(v));
    const c = {} as Controle;
    render(<MemoryRouter initialEntries={["/financas"]}><Provedor inicial={setembro} controle={c}><App /></Provedor></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MEU FINANCEIRO/ }));
    // o cache do aparelho, antes da carga do servidor: é setembro na cara de outubro
    expect(screen.getByText("✓ contas em dia")).toBeInTheDocument();

    // a carga do servidor volta → o hook do App vira o mês
    await act(async () => { c.setLoaded(true); });
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-10");
    // a tela renasceu com outubro, na MESMA aba (antes de 26/09: seguia "✓ contas em dia" e R$ 2.300 de saída)
    expect(screen.getByText("MEU MÊS — OUTUBRO")).toBeInTheDocument();
    expect(screen.queryByText("✓ contas em dia")).toBeNull();
    expect(screen.getByText("Aluguel vence em 4 dias")).toBeInTheDocument();
    expect(screen.getByText("Nenhum gasto variável cadastrado")).toBeInTheDocument();

    // o 1º toque do dia: uma conta nova no calendário e a padaria nos variáveis
    fireEvent.change(screen.getByPlaceholderText("Conta que vence dia 1 (ex: luz)"), { target: { value: "Internet" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar conta" }));
    const novoGasto = screen.getByPlaceholderText("+ Novo gasto");
    fireEvent.change(novoGasto, { target: { value: "Padaria" } });
    fireEvent.change(within(novoGasto.parentElement!).getByPlaceholderText("Valor"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gasto" }));

    const depois = c.dados();
    const contas = contasDe(depois["finance-dueDays"]);
    // antes de 26/09 este toque gravava Aluguel ✓ e Luz ✓ de volta, com o carimbo já em outubro
    expect(contas.filter((b) => b.paid)).toEqual([]);
    expect(contas.map((b) => b.name).sort()).toEqual(["Aluguel", "Internet", "Luz"]);
    expect(viradaDeContas(depois["finance-dueDays"] as DiaDeContas[], depois[CHAVE_CARIMBO_CONTAS], new Date())).toBeNull();
    // ...e o mercado de 28/09 voltava pro balde de outubro
    expect((depois["finance-expenses"] as { description: string }[]).map((e) => e.description)).toEqual(["Padaria"]);
    // setembro guardado como foi
    expect(contasDe(depois["finance-2026-setembro-dueDays"]).map((b) => [b.name, b.paid])).toEqual([["Aluguel", true], ["Luz", true]]);
    expect((depois["finance-2026-setembro-expenses"] as { id: string }[]).map((e) => e.id)).toEqual(["e-set"]);
    // renderiza o Index inteiro: sozinho leva ~1,2 s, mas com a máquina cheia
    // (suíte toda em paralelo) passou dos 5 s padrão — folga pra não dar falso vermelho
  }, 30_000);
});
