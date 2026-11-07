/**
 * "TÔ MELHOR QUE MÊS PASSADO?" PROJETAVA O ALUGUEL COMO GASTO DO DIA A DIA (bug "pergunte-ritmo", 07/11).
 *
 * A resposta multiplicava a saída INTEIRA do mês (fixos + parcelas + avulsas + variáveis) por
 * dias do mês / hoje. Em 07/11, com aluguel fixo de R$ 2.000 e R$ 100 de padaria, dizia "fecha em
 * ~R$ 9.000 ⚠️ passa R$ 6.200 do mês anterior" — enquanto a PREVISÃO DO FIM DO MÊS do Dashboard,
 * no mesmo instante, dizia "sobra R$ 571" (ela só projeta as variáveis).
 *
 * Conserto: a conta da previsão saiu do Dashboard pra lib/finance-totals `previsaoDoMes`, e as duas
 * telas usam a mesma: só as variáveis seguem o ritmo do dia; fixos, parcelas e avulsas entram uma vez.
 *
 * Rodar com: npx vitest run src/test/pergunte-ritmo-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const UID = "u-pergunte-ritmo";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-pergunte-ritmo", created_at: "2026-10-01T00:00:00.000Z" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
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
vi.mock("@/lib/avaliacao", async (orig) => ({
  ...(await orig<typeof import("@/lib/avaliacao")>()),
  pedirAvaliacaoSePuder: vi.fn(async () => false),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { previsaoDoMes } from "@/lib/finance-totals";
import Index from "@/pages/Index";

const hoje = new Date(2026, 10, 7, 10); // 07/11/2026
const lsKey = (k: string) => `u:${UID}:${k}`;

/* ── provider de mentira: store em memória (o que o Index e a Home leem) ── */
const Provedor = ({ inicial, loaded = true, children }: { inicial: Record<string, unknown>; loaded?: boolean; children?: ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const getS = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  const valor = useMemo<UserDataContextType>(
    () => ({ get: getS, set, loaded, isGuest: false, fetchKey: async () => null }), [getS, set, loaded],
  );
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {}; // o chat do Pergunte ao CORE rola sozinho
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
  vi.setSystemTime(hoje);
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });


const abrirIndex = (inicial: Record<string, unknown>) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(inicial)) localStorage.setItem(lsKey(k), JSON.stringify(v));
  return render(
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={inicial} loaded={false}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
};

const salario = { id: "sal", description: "Salário", value: 3000, date: "2026-11-05" };
const aluguel = { id: "alug", description: "Aluguel", category: "moradia", value: 2000, day: 10, paymentMethod: "boleto" };
const mercadoOut = { id: "mercado", description: "Mercado", category: "mercado", value: 800, date: "2026-10-10", paymentMethod: "pix" };

describe("pergunte-ritmo (07/11): 'Tô melhor que mês passado?' projeta só o dia a dia", () => {
  it("outubro saiu 2.800; novembro tem aluguel + R$ 100 em 7 dias: fecha em ~R$ 2.429 e responde Sim, igual à previsão do Dashboard", async () => {
    abrirIndex({
      "finance-2026-outubro-expenses": [mercadoOut],
      "finance-2026-outubro-fixed": [aluguel],
      "finance-2026-outubro-incomes": [{ ...salario, date: "2026-10-05" }],
      "finance-fixed-expenses": [aluguel],
      "finance-expenses": [{ id: "p", description: "Padaria", category: "alimentacao", value: 100, date: "2026-11-03", paymentMethod: "pix" }],
      "finance-incomes": [salario],
      "spotlight-done-financas": "true",
    });
    const previsao = document.querySelector('[data-testid="previsao-valor"]')?.textContent ?? "";
    expect(previsao).toMatch(/571/);
    fireEvent.click(screen.getByRole("button", { name: "Pergunte ao CORE" }));
    fireEvent.click(screen.getByText(/Tô melhor que mês passado/));
    const resp = await screen.findByText(/no ritmo atual, fecha em/, {}, { timeout: 3000 });
    expect(resp.textContent).toMatch(/Outubro: R\$ 2\.800 de gastos/);
    expect(resp.textContent).toMatch(/Este mês até agora: R\$ 2\.100/);
    expect(resp.textContent).toMatch(/fecha em ~R\$ 2\.429/);
    expect(resp.textContent).toMatch(/Sim!/);
  });
});

describe("previsaoDoMes (lib/finance-totals): a conta única do ritmo", () => {
  it("só as variáveis seguem o ritmo; fixos, parcelas e avulsas entram uma vez", () => {
    const p = previsaoDoMes({
      totalIncome: 3000, monthlyOutflow: 2100 + 150 + 40, fixedExpenses: [aluguel], monthlyInstallments: 150,
      dueDays: [{ day: 15, bills: [{ id: "net", name: "Netflix", value: 40, paid: false }] }], agora: hoje,
    });
    expect(p.variableSpent).toBe(100);
    expect(p.remainingDays).toBe(23);
    expect(p.projectedVariableRemaining).toBeCloseTo((100 / 7) * 23, 6);
    expect(p.saidaProjetada).toBeCloseTo(2290 + (100 / 7) * 23, 6);
    expect(p.projectedBalance).toBeCloseTo(3000 - p.saidaProjetada, 6);
  });
});
