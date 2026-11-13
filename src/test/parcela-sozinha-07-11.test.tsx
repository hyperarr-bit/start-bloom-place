/**
 * PARCELA FICA PAGA SOZINHA DEPOIS DA FATURA PAGA (bug "parcela-sozinha", 07/11).
 *
 * O caminho da pessoa: paga a fatura do Nubank no MEU MÊS (o "paguei" marca as
 * parcelas do cartão no mês — pedido de 14/09), depois DESMARCA uma parcela na
 * lista de parcelamentos (não era pra ter entrado, ou pagou separado). Aí dá
 * ✓ em QUALQUER outra conta do mês (Luz) — e a parcela volta a aparecer paga.
 *
 * Causa: `setDueDaysComFaturas` (pages/Index) recebe a lista inteira do MEU MÊS
 * a cada ✓, e `extrairFaturas` devolve TODAS as faturas da lista com o estado
 * delas, não só a que mudou. O Index já filtrava as que MUDARAM pra estimativa
 * do Montar, mas mandava a lista completa pro `marcarFaturas` — que, pra cada
 * fatura "paga", marca de novo toda parcela do cartão no mês. Então tocar na
 * Luz repetia o "paguei" da fatura e desfazia o desmarcar da pessoa.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/parcela-sozinha-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: "u-parcela" } as { id: string } | null }));
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
// o ✓ agenda o pedido de avaliação 1,2 s depois — fora do escopo daqui
vi.mock("@/lib/avaliacao", async (orig) => ({
  ...(await orig<typeof import("@/lib/avaliacao")>()),
  pedirAvaliacaoSePuder: vi.fn(async () => false),
}));

import { CHAVE_FATURAS_PAGAS, chaveDaFatura } from "@/lib/finance-faturas";
import { CHAVE_CARIMBO_CONTAS, type DiaDeContas } from "@/lib/virada-contas";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useViradaDoMes } from "@/hooks/use-virada-do-mes";
import type { Parcela } from "@/lib/finance-parcelas";
import Index from "@/pages/Index";

const hoje = new Date(2026, 10, 7, 10); // 07/11/2026 — mês da tela: 2026-11
const MES = "2026-11";
const CHAVE_NUBANK = chaveDaFatura(MES, "nubank");
// Nubank fecha 20 e vence 27: fecha e vence no MESMO mês → o "paguei" da fatura marca as parcelas deste mês
const cartoes = { nubank: { closingDay: 20, dueDay: 27 } };
const tv: Parcela = {
  id: "p-tv", description: "TV", totalValue: 1200, installmentValue: 100, paidInstallments: 2, totalInstallments: 12,
  cardName: "nubank", category: "casa", date: "2026-09-10", startMonth: MES, parcelaDoMes: 3,
};
const contas = (): DiaDeContas[] => [
  { day: 10, color: "yellow", bills: [{ id: "luz", name: "Luz", paid: false, value: 150 }] },
  { day: 15, color: "slate", bills: [{ id: "agua", name: "Água", paid: false, value: 80 }] },
] as DiaDeContas[];

/* ── o provider de mentira: store em memória + contador de escritas por chave ── */
const UID = "u-parcela";
const lsKey = (k: string) => `u:${UID}:${k}`;
type Controle = { dados: () => Record<string, unknown>; escritas: Record<string, number> };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    controle.escritas[k] = (controle.escritas[k] ?? 0) + 1;
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(
    () => ({ get, set, loaded: false, isGuest: false, fetchKey: async () => null }), [get, set],
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

const abrirFinancas = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  localStorage.clear();
  vi.setSystemTime(hoje);
  const inicial: Record<string, unknown> = {
    "spotlight-done-financas": "true",
    "finance-incomes": [{ id: "r", date: "2026-11-05", value: 3000, description: "Salário" }],
    "finance-card-config": cartoes,
    "finance-installments": [tv],
    "finance-dueDays": contas(),
    [CHAVE_CARIMBO_CONTAS]: MES,
  };
  for (const [k, v] of Object.entries(inicial)) localStorage.setItem(lsKey(k), JSON.stringify(v));
  const c: Controle = { dados: () => ({}), escritas: {} };
  render(<MemoryRouter initialEntries={["/financas"]}><Provedor inicial={inicial} controle={c}><App /></Provedor></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /MEU FINANCEIRO/ }));
  return c;
};
const parcelasPagasDaTV = (c: Controle) =>
  ((c.dados()["finance-installments"] as Parcela[] | undefined) ?? [tv]).find((p) => p.id === tv.id)?.paidInstallments;
const faturasPagas = (c: Controle) => (c.dados()[CHAVE_FATURAS_PAGAS] as Record<string, boolean> | undefined) ?? {};
const contaDoMes = (c: Controle, id: string) =>
  ((c.dados()["finance-dueDays"] as DiaDeContas[] | undefined) ?? contas()).flatMap((d) => d.bills).find((b) => b.id === id);
/** O MEU MÊS lista as contas do dia selecionado: escolhe o dia e dá o ✓ na conta. */
const marcarNoDia = async (dia: number, nome: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name: `Dia ${dia}` }));
  await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: nome })); });
};

describe("parcela-sozinha (07/11): ✓ em outra conta não devolve a parcela que a pessoa desmarcou", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("fatura paga → parcela desmarcada na mão → ✓ na Luz: a parcela FICA desmarcada", async () => {
    const c = abrirFinancas();
    expect(parcelasPagasDaTV(c)).toBe(2);

    // 1. paga a fatura do Nubank (dia 27): a parcela 3 da TV vai junto — o pedido de 14/09
    await marcarNoDia(27, /Fatura Nubank/);
    expect(faturasPagas(c)[CHAVE_NUBANK]).toBe(true);
    expect(parcelasPagasDaTV(c)).toBe(3);

    // 2. desmarca a parcela na lista de parcelamentos
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Desmarcar parcela 3 de TV como paga" })); });
    expect(parcelasPagasDaTV(c)).toBe(2);
    const escritasDaFatura = c.escritas[CHAVE_FATURAS_PAGAS] ?? 0;

    // 3. ✓ na Luz (dia 10) — antes do conserto a parcela voltava pra 3 aqui
    await marcarNoDia(10, /Luz/);
    expect(contaDoMes(c, "luz")?.paid).toBe(true);
    expect(parcelasPagasDaTV(c)).toBe(2);
    expect(screen.getByRole("checkbox", { name: "Marcar parcela 3 de TV como paga" })).toBeInTheDocument();
    // a fatura continua paga (ninguém mexeu nela) e o "paguei" dela não foi regravado à toa
    expect(faturasPagas(c)[CHAVE_NUBANK]).toBe(true);
    expect(c.escritas[CHAVE_FATURAS_PAGAS] ?? 0).toBe(escritasDaFatura);

    // 4. e de novo noutra conta (Água, dia 15): continua desmarcada
    await marcarNoDia(15, /Água/);
    expect(contaDoMes(c, "agua")?.paid).toBe(true);
    expect(parcelasPagasDaTV(c)).toBe(2);
  }, 30_000);

  it("o 'paguei' da fatura continua marcando as parcelas, e desmarcar a fatura tira só o 'paguei' (a parcela fica)", async () => {
    const c = abrirFinancas();

    await marcarNoDia(27, /Fatura Nubank/);
    expect(faturasPagas(c)[CHAVE_NUBANK]).toBe(true);
    expect(parcelasPagasDaTV(c)).toBe(3);

    // desmarca a fatura: o "paguei" sai; a parcela que já foi marcada fica como está (regra de 22/09)
    await marcarNoDia(27, /Fatura Nubank/);
    expect(faturasPagas(c)[CHAVE_NUBANK]).toBeUndefined();
    expect(parcelasPagasDaTV(c)).toBe(3);

    // marca de novo: a chave volta (a parcela já estava paga, nada a marcar)
    await marcarNoDia(27, /Fatura Nubank/);
    expect(faturasPagas(c)[CHAVE_NUBANK]).toBe(true);
    expect(parcelasPagasDaTV(c)).toBe(3);
  }, 30_000);

  it("✓ numa conta comum com a fatura em aberto não marca parcela nenhuma nem grava 'paguei'", async () => {
    const c = abrirFinancas();
    await marcarNoDia(10, /Luz/);
    expect(contaDoMes(c, "luz")?.paid).toBe(true);
    expect(parcelasPagasDaTV(c)).toBe(2);
    expect(faturasPagas(c)[CHAVE_NUBANK]).toBeUndefined();
    expect(c.escritas[CHAVE_FATURAS_PAGAS] ?? 0).toBe(0);
  }, 30_000);
});
