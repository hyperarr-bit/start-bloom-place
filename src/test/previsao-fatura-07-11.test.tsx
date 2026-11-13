/**
 * A FATURA QUE VEIO DO MÊS PASSADO VIRAVA "RITMO DO DIA" NA PREVISÃO (bug "previsao-fatura", 07/11).
 *
 * `previsaoDoMes` tira da saída os fixos, as parcelas e as avulsas e chama o resto de "variáveis do dia a
 * dia". Mas, pela regra da fatura, o resto inclui a fatura do mês anterior que cai neste
 * (variaveisMes.doMesAnterior). Em 1º/11, com a TV de R$ 1.000 de 28/10 (fechamento 25) e nada gasto em
 * novembro, a previsão fazia 1.000 ÷ 1 dia × 30 = R$ 30.000: o Dashboard dizia "falta R$ 27.000" e o
 * Pergunte ao CORE "fecha em ~R$ 30.000". O certo: a TV entra uma vez (~R$ 1.000).
 *
 * Conserto: `faturaDoMesAnterior` (opcional) sai do ritmo e fica inteira em monthlyOutflow. O Index passa
 * a soma de variaveisMes.doMesAnterior ao Dashboard, ao Pergunte ao CORE e à lista de desejos.
 *
 * Rodar com: npx vitest run src/test/previsao-fatura-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const UID = "u-previsao-fatura";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-previsao-fatura", created_at: "2026-10-01T00:00:00.000Z" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
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
import { previsaoDoMes as previsaoDaWishlist } from "@/components/WishlistItems";
import Index from "@/pages/Index";

const hoje = new Date(2026, 10, 1, 12); // 1º/11/2026
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

const salario = { id: "sal", description: "Salário", value: 3000, date: "2026-11-01" };
const tv = { id: "tv", description: "TV", category: "casa", value: 1000, date: "2026-10-28", paymentMethod: "credito", cardName: "nubank" };
const cartao = { nubank: { closingDay: 25, dueDay: 5 } };

describe("previsao-fatura (07/11): a fatura do mês passado entra uma vez, não vira ritmo", () => {
  it("1º/11, só a TV de 28/10 na fatura: Dashboard 'sobra R$ 2.000' e Pergunte 'fecha em ~R$ 1.000'", async () => {
    abrirIndex({
      "finance-2026-outubro-expenses": [tv],
      "finance-2026-outubro-incomes": [{ ...salario, id: "sal-out", date: "2026-10-01" }],
      "finance-expenses": [],
      "finance-incomes": [salario],
      "finance-card-config": cartao,
      "spotlight-done-financas": "true",
    });
    const previsao = document.querySelector('[data-testid="previsao-valor"]')?.textContent ?? "";
    expect(previsao).toMatch(/sobra R\$ 2\.000/);
    fireEvent.click(screen.getByRole("button", { name: "Pergunte ao CORE" }));
    fireEvent.click(screen.getByText(/Tô melhor que mês passado/));
    const resp = await screen.findByText(/no ritmo atual, fecha em/, {}, { timeout: 3000 });
    expect(resp.textContent).toMatch(/Este mês até agora: R\$ 1\.000/);
    expect(resp.textContent).toMatch(/fecha em ~R\$ 1\.000\./);
  });
});

describe("previsaoDoMes (lib/finance-totals) com faturaDoMesAnterior", () => {
  it("só o que ela gastou NESTE mês segue o ritmo; a fatura que veio do mês passado entra uma vez", () => {
    const dia11 = new Date(2026, 10, 11, 12);
    const p = previsaoDoMes({
      totalIncome: 3000, monthlyOutflow: 1000 + 110, fixedExpenses: [], monthlyInstallments: 0, dueDays: [],
      faturaDoMesAnterior: 1000, agora: dia11,
    });
    expect(p.variableSpent).toBe(110);
    expect(p.dailyVariableRate).toBeCloseTo(10, 6);
    expect(p.saidaProjetada).toBeCloseTo(1110 + 10 * 19, 6);
    expect(p.totalAlreadySpent).toBe(1110);
  });

  it("sem cartão com fechamento (0 ou ausente) a conta é a de sempre", () => {
    const base = { totalIncome: 3000, monthlyOutflow: 700, fixedExpenses: [], monthlyInstallments: 0, dueDays: [], agora: new Date(2026, 10, 7, 12) };
    const sem = previsaoDoMes(base);
    expect(previsaoDoMes({ ...base, faturaDoMesAnterior: 0 })).toEqual(sem);
    expect(sem.saidaProjetada).toBeCloseTo(700 + (700 / 7) * 23, 6);
  });

  it("lista de desejos: a mesma previsão (a fatura do mês passado não vira ritmo)", () => {
    const p = previsaoDaWishlist(3000, 1000, 0, [], [], new Date(2026, 10, 1, 12), 1000);
    expect(p.projecaoVariavel).toBe(0);
    expect(p.saldoProjetado).toBe(2000);
  });
});
