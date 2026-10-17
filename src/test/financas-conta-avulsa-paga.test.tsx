/**
 * CONTA AVULSA PAGA NÃO PODE FAZER O DINHEIRO SUMIR (17/10, achado do dono).
 *
 * Conta lançada direto no calendário do MEU MÊS (Netflix, IPVA, boleto), sem
 * custo fixo por trás. Antes: em aberto ela só era RESERVADA no "quanto posso
 * gastar" (fora do "Saldo do mês"); marcada como paga saía da reserva e não
 * virava gasto — o "quanto posso gastar" SUBIA depois de pagar.
 *
 * Agora (lib/finance-totals, computeLooseBillsOutflow): a avulsa com valor
 * entra na saída do mês desde que nasce, paga ou não; o ✓ só mexe em alertas.
 *
 * Exemplo do relatório — 17/10/2026 (faltam 15 dias contando hoje):
 * renda 3.000 · fixos 1.150 (aluguel 1.000 + internet 150) · Netflix 45 avulsa
 *                     ANTES (aberta → paga)     AGORA (aberta = paga)
 *   Saldo do mês       1.850 → 1.850             1.805
 *   reserva               45 → 0                     0
 *   disponível         1.805 → 1.850 (subia!)    1.805
 *   por dia           120,33 → 123,33            120,33
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/financas-conta-avulsa-paga.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: "u-avulsa" } as { id: string } | null }));
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

import {
  computeArchivedLooseBillsOutflow, computeDailyBudget, computeLooseBillsOutflow, computeMonthlyBalance,
  computeMonthlyOutflow, computeUnpaidBillsEstimate, computeUnpaidOutsideOutflow,
} from "@/lib/finance-totals";
import { injetarFaturas } from "@/lib/finance-faturas";
import { viradaDeContas, CHAVE_CARIMBO_CONTAS, type DiaDeContas } from "@/lib/virada-contas";
import { totaisDoMes } from "@/components/finance/MonthComparison";
import { lerFinancasDoMes } from "@/lib/retrospectiva";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useViradaDoMes } from "@/hooks/use-virada-do-mes";
import Index from "@/pages/Index";

const dia17 = new Date(2026, 9, 17, 10); // outubro tem 31 dias → 15 dias contando hoje
const fixos = [
  { id: "alug", description: "Aluguel", value: 1000, day: 5 },
  { id: "net", description: "Internet", value: 150, day: 10 },
];
const contasDoMes = (netflix: { paid: boolean; value?: number }) => [
  { day: 5, color: "yellow", bills: [{ id: "fx-alug", name: "Aluguel", paid: true, value: 1000, fixedId: "alug" }] },
  { day: 10, color: "yellow", bills: [{ id: "fx-net", name: "Internet", paid: false, value: 150, fixedId: "net" }] },
  { day: 17, color: "slate", bills: [{ id: "n1", name: "Netflix", ...netflix }] },
];

/** A conta do Index: saída com as avulsas + o "quanto posso gastar" por cima dela. */
const numeros = (dueDays: any[], variaveis = 0) => {
  const avulsas = computeLooseBillsOutflow(dueDays, fixos);
  const saida = computeMonthlyOutflow(variaveis, 1150, 0, avulsas);
  const b = computeDailyBudget(3000, saida, dueDays, fixos, dia17);
  return { avulsas, saida, saldo: computeMonthlyBalance(3000, saida), reserva: b.unpaidBillsEstimate, disponivel: b.availableReal, porDia: b.perDay };
};

describe("conta avulsa: saldo do mês, reserva e quanto posso gastar", () => {
  it("em aberto: já entra no Saldo do mês (1.805), sem reserva dupla", () => {
    expect(numeros(contasDoMes({ paid: false, value: 45 }))).toEqual({
      avulsas: 45, saida: 1195, saldo: 1805, reserva: 0, disponivel: 1805, porDia: 1805 / 15,
    });
  });

  it("paga: NENHUM número muda (antes o disponível subia pra 1.850)", () => {
    const aberta = numeros(contasDoMes({ paid: false, value: 45 }));
    const paga = numeros(contasDoMes({ paid: true, value: 45 }));
    expect(paga).toEqual(aberta);
    expect(paga.disponivel).not.toBe(1850);
    // o ✓ continua mexendo no que é alerta: o "A vencer" só soma as em aberto
    expect(computeUnpaidBillsEstimate(contasDoMes({ paid: false, value: 45 }), fixos)).toBe(150 + 45);
    expect(computeUnpaidBillsEstimate(contasDoMes({ paid: true, value: 45 }), fixos)).toBe(150);
  });

  it("sem valor: fora do Saldo (não se inventa número), reservada pela média dos fixos — paga ou não", () => {
    const aberta = numeros(contasDoMes({ paid: false }));
    const paga = numeros(contasDoMes({ paid: true }));
    expect(aberta).toMatchObject({ avulsas: 0, saida: 1150, saldo: 1850, reserva: 575, disponivel: 1275 });
    expect(paga).toEqual(aberta); // pagar não devolve dinheiro: o ✓ não sobe o limite
    // valor 0 / texto também é "sem valor"
    expect(computeLooseBillsOutflow([{ day: 3, bills: [{ id: "z", name: "Z", paid: false, value: 0 }] }], fixos)).toBe(0);
  });

  it("ligada a custo fixo: só o fixo conta (nada em dobro); fixo apagado → a conta vira avulsa", () => {
    const soFixos = contasDoMes({ paid: false, value: 45 }).slice(0, 2);
    expect(computeLooseBillsOutflow(soFixos, fixos)).toBe(0);
    expect(numeros(soFixos)).toMatchObject({ saida: 1150, saldo: 1850, reserva: 0, disponivel: 1850 });
    const orfa = [{ day: 8, bills: [{ id: "fx-velho", name: "Velho", paid: true, value: 50, fixedId: "apagado" }] }];
    expect(computeLooseBillsOutflow(orfa, fixos)).toBe(50);
    expect(computeUnpaidOutsideOutflow(orfa, fixos)).toBe(0);
  });

  it("fatura do cartão: já está nas variáveis/parcelas — não entra como avulsa nem como reserva", () => {
    const comFatura = injetarFaturas(contasDoMes({ paid: false, value: 45 }) as never[], [
      { card: "Nubank", label: "Nubank", dueDay: 20, total: 450, variaveis: 300, parcelas: 150, fixos: 0, paga: false, mes: "2026-10" } as never,
    ]);
    expect(computeLooseBillsOutflow(comFatura, fixos)).toBe(45);
    expect(computeUnpaidOutsideOutflow(comFatura, fixos)).toBe(0);
  });

  it("virada do mês: zerar os ✓ não muda a saída do mês novo (paga ou não, conta igual)", () => {
    const outubro = [{ day: 17, color: "slate", bills: [{ id: String(new Date(2026, 8, 2).getTime()), name: "Netflix", paid: true, value: 45 }] }];
    const v = viradaDeContas(outubro as DiaDeContas[], "2026-10", new Date(2026, 10, 1, 9))!;
    expect(v.zerou).toBe(true);
    expect(computeLooseBillsOutflow(v.zeradas, [])).toBe(computeLooseBillsOutflow(outubro, []));
  });

  it("mês que não é o corrente: conta nascida de fixo nunca vira avulsa (o fixo daquele mês pode não ter retrato)", () => {
    const arquivo = [
      { day: 5, bills: [{ id: "fx-alug", name: "Aluguel", paid: true, value: 1000, fixedId: "alug" }] },
      { day: 17, bills: [{ id: "n1", name: "Netflix", paid: true, value: 45 }] },
    ];
    expect(computeArchivedLooseBillsOutflow(arquivo, [])).toBe(45);
    expect(computeLooseBillsOutflow(arquivo, [])).toBe(1045); // a regra do mês corrente contaria o aluguel órfão
  });
});

/* ── comparação mensal, resumo da virada e retrospectiva: o MESMO número ── */
const UIDC = "u-avulsa-comp";
const gravar = (chave: string, v: unknown) => localStorage.setItem(`u:${UIDC}:${chave}`, JSON.stringify(v));

describe("contas de outros meses: cada mês só com as contas DELE", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(dia17);
    gravar("finance-incomes", [{ id: "i", value: 3000, date: "2026-10-05" }]);
    gravar("finance-fixed-expenses", fixos);
    gravar("finance-dueDays", contasDoMes({ paid: true, value: 45 }));
    // setembro arquivado: Netflix + IPVA avulsos e a conta do aluguel (fixo SEM retrato de setembro)
    gravar("finance-2026-setembro-incomes", [{ id: "si", value: 3000, date: "2026-09-05" }]);
    gravar("finance-2026-setembro-dueDays", [
      { day: 5, bills: [{ id: "fx-alug", name: "Aluguel", paid: true, value: 1000, fixedId: "alug" }] },
      { day: 17, bills: [{ id: "n1", name: "Netflix", paid: true, value: 45 }, { id: "ipva", name: "IPVA", paid: false, value: 800 }] },
    ]);
  });
  afterEach(() => vi.useRealTimers());

  it("outubro (corrente) = a conta do Index: 1.150 + 45", () => {
    const out = totaisDoMes({ ano: 2026, idx: 9 }, UIDC, PERFIL_PESSOAL);
    expect(out.avulsas).toBe(45);
    expect(out.despesas).toBe(1195);
    expect(out.receitas - out.despesas).toBe(1805);
  });

  it("setembro (arquivo) leva as avulsas DELE (45 + 800), e o IPVA de setembro não vaza pra outubro", () => {
    const set = totaisDoMes({ ano: 2026, idx: 8 }, UIDC, PERFIL_PESSOAL);
    expect(set.avulsas).toBe(845);
    expect(set.despesas).toBe(845); // sem retrato de fixos em setembro: o aluguel não entra pela conta
    expect(totaisDoMes({ ano: 2026, idx: 9 }, UIDC, PERFIL_PESSOAL).avulsas).toBe(45);
    // mês sem retrato de contas: 0, não chute
    expect(totaisDoMes({ ano: 2026, idx: 7 }, UIDC, PERFIL_PESSOAL).avulsas).toBe(0);
  });

  it("retrospectiva lê as mesmas avulsas", () => {
    const ler = (k: string) => { const v = localStorage.getItem(`u:${UIDC}:${k}`); return v ? JSON.parse(v) : null; };
    expect(lerFinancasDoMes(2026, 9, ler, PERFIL_PESSOAL, dia17).avulsas).toBe(45);
    expect(lerFinancasDoMes(2026, 8, ler, PERFIL_PESSOAL, dia17).avulsas).toBe(845);
  });
});

/* ── a tela: MEU MÊS marcando a Netflix como paga ── */
const UID = "u-avulsa";
const lsKey = (k: string) => `u:${UID}:${k}`;
type Controle = { dados: () => Record<string, unknown> };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
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

describe("MEU MÊS: marcar a Netflix como paga não mexe no número", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("Saldo e QUANTO POSSO GASTAR HOJE iguais antes e depois do ✓", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    localStorage.clear();
    vi.setSystemTime(dia17);
    const inicial: Record<string, unknown> = {
      "spotlight-done-financas": "true",
      "finance-incomes": [{ id: "r", date: "2026-10-05", value: 3000, description: "Salário" }],
      "finance-fixed-expenses": fixos.map((f) => ({ ...f, category: "moradia", paymentMethod: "boleto" })),
      "finance-dueDays": contasDoMes({ paid: false, value: 45 }),
      [CHAVE_CARIMBO_CONTAS]: "2026-10",
    };
    for (const [k, v] of Object.entries(inicial)) localStorage.setItem(lsKey(k), JSON.stringify(v));
    const c = {} as Controle;
    render(<MemoryRouter initialEntries={["/financas"]}><Provedor inicial={inicial} controle={c}><App /></Provedor></MemoryRouter>);

    const limite = async () => {
      const titulo = await screen.findByText("QUANTO POSSO GASTAR HOJE");
      return titulo.closest("div")!.textContent!.replace(/\s+/g, " ");
    };
    // DASHBOARD antes: 3.000 − 1.150 − 45 = 1.805 livres ÷ 15 dias = R$ 120/dia
    const antes = await limite();
    expect(antes).toContain("R$ 120");
    expect(antes).toContain("Disponível livreR$ 1.805");
    expect(antes).not.toContain("Contas sem valor");

    fireEvent.click(screen.getByRole("button", { name: /MEU FINANCEIRO/ }));
    expect(screen.getByText("Saldo R$ 1.805")).toBeInTheDocument();
    expect(screen.getByText("↓ Saiu R$ 1.195")).toBeInTheDocument();

    const netflix = screen.getByRole("checkbox", { name: /Netflix/ });
    await act(async () => { fireEvent.click(netflix); });
    // gravou o ✓...
    const netflixGravada = (c.dados()["finance-dueDays"] as DiaDeContas[]).flatMap((d) => d.bills).find((b) => b.name === "Netflix");
    expect(netflixGravada?.paid).toBe(true);
    // ...e o número ficou onde estava (antes: Saldo 1.850 e limite subindo pra 1.850)
    expect(screen.getByText("Saldo R$ 1.805")).toBeInTheDocument();
    expect(screen.getByText("↓ Saiu R$ 1.195")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /DASHBOARD/ }));
    expect(await limite()).toBe(antes);
  }, 30_000);
});
