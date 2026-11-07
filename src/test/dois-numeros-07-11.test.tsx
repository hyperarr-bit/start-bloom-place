/**
 * O MESMO MÊS COM DOIS NÚMEROS (bug "dois-numeros", 07/11).
 *
 * Nubank fecha dia 25. Em outubro: Mercado R$ 200 no Pix (10/10) e uma TV de R$ 1.000 no
 * crédito em 28/10 — depois do fechamento, logo fatura de NOVEMBRO. Em novembro: Cinema
 * R$ 60 no crédito em 26/11 — fatura de DEZEMBRO. A tela de Finanças (Index/MonthlySheet)
 * aplica a regra da fatura (lib/finance-fatura `variaveisDoMes`): out 200 · nov 1.000.
 * Todo mundo que LÊ o mês pelo store somava a chave crua e dava outro número pro mesmo mês:
 *   · Comparação mensal/anual e balanço anual (getMonthTotals, getExpensesByCategory): out 1.200 · nov 60;
 *   · Retrospectiva (lerFinancasDoMes): out 1.200;
 *   · LIMITES (Index passava `expenses` cru): o cinema de 26/11 contava em novembro, a TV não;
 *   · Home (use-life-hub-data), widget Orçamento Restante, widget E e lembrete do dia 2: saldo com 60 em vez de 1.000.
 *
 * Conserto: UMA fonte — lib/finance-fatura `variaveisDoMesLidas` (lê a chave do mês + a do anterior pela
 * regra da fatura do `finance-card-config`) pra quem lê do store, e `variaveisMes.noMes` pra quem já tem
 * as listas (Index → Dashboard e LIMITES). Na retrospectiva o dinheiro segue a fatura e os "dias com
 * gasto" seguem a data da compra (`lancados`).
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/dois-numeros-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const UID = "u-dois-numeros";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-dois-numeros", created_at: "2026-10-01T00:00:00.000Z" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
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

import { getMonthTotals } from "@/components/finance/storage-keys";
import { getExpensesByCategory, totaisDoMes } from "@/components/finance/MonthComparison";
import { atividadeDoMes, buildWrappedData, lerDadosDaVida, lerFinancasDoMes } from "@/lib/retrospectiva";
import { BudgetRemainingWidget } from "@/components/home/widgets/BudgetRemainingWidget";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { porDiaDasFinancas } from "@/lib/lembrete-dia2";
import { orcamentoRestante } from "@/lib/home-widgets-e";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { PERFIL_PESSOAL, esquecerPerfis, registrarPerfis } from "@/lib/finance-perfil";
import { chaveDeGastosDoMes, configOfDe, variaveisDoMesLidas } from "@/lib/finance-fatura";
import Index from "@/pages/Index";

const hoje = new Date(2026, 10, 7, 10); // 07/11/2026 — mês da tela: 2026-11
const cartoes = { nubank: { closingDay: 25, dueDay: 5 } };
const mercado = { id: "mercado", description: "Mercado", category: "mercado", value: 200, date: "2026-10-10", paymentMethod: "pix" };
const tv = { id: "tv", description: "TV", category: "eletronicos", value: 1000, date: "2026-10-28", paymentMethod: "credito", cardName: "nubank" };
const cinema = { id: "cinema", description: "Cinema", category: "lazer", value: 60, date: "2026-11-26", paymentMethod: "credito", cardName: "nubank" };
const salario = { id: "sal", description: "Salário", value: 3000, date: "2026-11-05" };

const dados: Record<string, unknown> = {
  "finance-card-config": cartoes,
  "finance-2026-outubro-expenses": [mercado, tv],
  "finance-expenses": [cinema],
  "finance-incomes": [salario],
  "spotlight-done-financas": "true",
};
const lsKey = (k: string) => `u:${UID}:${k}`;
/** O `get` do store (fallback obrigatório) e o leitor da retrospectiva (uma chave só). */
const get = <T,>(k: string, fb: T): T => (k in dados ? (dados[k] as T) : fb);
const ler = (k: string) => (k in dados ? dados[k] : undefined);
const soma = (itens: { value?: unknown }[]) => itens.reduce((s, i) => s + (Number(i?.value) || 0), 0);

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
  // os leitores de localStorage (Comparação, Balanço, retrospectiva sem `ler`) leem pelo id do usuário
  for (const [k, v] of Object.entries(dados)) localStorage.setItem(lsKey(k), JSON.stringify(v));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ═══════════════ Comparação mensal/anual e Balanço anual ═══════════════ */

describe("dois-numeros (07/11): Comparação e Balanço (getMonthTotals, getExpensesByCategory, totaisDoMes)", () => {
  it("outubro = 200 (a TV de 28/10 é fatura de novembro); novembro = 1.000; dezembro recebe o cinema de 26/11", () => {
    expect(getMonthTotals("Outubro", UID, 2026, PERFIL_PESSOAL).custosVariaveis).toBe(200);
    expect(getMonthTotals("Novembro", UID, 2026, PERFIL_PESSOAL).custosVariaveis).toBe(1000);
    expect(getMonthTotals("Dezembro", UID, 2026, PERFIL_PESSOAL).custosVariaveis).toBe(60);
    expect(totaisDoMes({ ano: 2026, idx: 9 }, UID, PERFIL_PESSOAL).despesas).toBe(200);
    expect(totaisDoMes({ ano: 2026, idx: 10 }, UID, PERFIL_PESSOAL).despesas).toBe(1000);
  });

  it("por categoria: outubro só Mercado 200; novembro Eletrônicos 1.000; dezembro Lazer 60 — nunca a mesma compra em dois meses", () => {
    expect(getExpensesByCategory({ ano: 2026, idx: 9 }, UID, PERFIL_PESSOAL)).toEqual({ mercado: 200 });
    expect(getExpensesByCategory({ ano: 2026, idx: 10 }, UID, PERFIL_PESSOAL)).toEqual({ eletronicos: 1000 });
    expect(getExpensesByCategory({ ano: 2026, idx: 11 }, UID, PERFIL_PESSOAL)).toEqual({ lazer: 60 });
  });

  it("sem cartão com fechamento cadastrado, nada muda: a soma crua de sempre", () => {
    localStorage.removeItem(lsKey("finance-card-config"));
    expect(getMonthTotals("Outubro", UID, 2026, PERFIL_PESSOAL).custosVariaveis).toBe(1200);
    expect(getMonthTotals("Novembro", UID, 2026, PERFIL_PESSOAL).custosVariaveis).toBe(60);
    expect(getExpensesByCategory({ ano: 2026, idx: 9 }, UID, PERFIL_PESSOAL)).toEqual({ mercado: 200, eletronicos: 1000 });
  });
});

/* ═══════════════ Retrospectiva ═══════════════ */

describe("dois-numeros (07/11): Retrospectiva (lerFinancasDoMes, buildWrappedData)", () => {
  it("outubro saiu 200 (Mercado no topo); novembro saiu 1.000 (Eletrônicos) — o mesmo número da tela", () => {
    expect(soma(lerFinancasDoMes(2026, 9, ler, PERFIL_PESSOAL, hoje).expenses)).toBe(200);
    expect(soma(lerFinancasDoMes(2026, 10, ler, PERFIL_PESSOAL, hoje).expenses)).toBe(1000);

    const out = buildWrappedData("Outubro", UID, 2026, { ler, agora: hoje })!;
    expect(out.outflow).toBe(200);
    expect(out.topCategories).toEqual([{ label: "Mercado", value: 200, pct: 100 }]);

    const nov = buildWrappedData("Novembro", UID, 2026, { ler, agora: hoje })!;
    expect(nov.outflow).toBe(1000);
    expect(nov.topCategories).toEqual([{ label: "Eletrônicos", value: 1000, pct: 100 }]);
    expect(nov.balance).toBe(2000);
  });

  it("os DIAS com gasto continuam sendo os de quando ela gastou: outubro 10 e 28; novembro 26 (o cinema é da fatura de dezembro, mas foi lançado em novembro)", () => {
    const out = buildWrappedData("Outubro", UID, 2026, { ler, agora: hoje })!;
    expect(out.diasComGasto).toEqual([10, 28]);
    expect(out.gastosAnotados).toBe(2);
    const nov = buildWrappedData("Novembro", UID, 2026, { ler, agora: hoje })!;
    expect(nov.diasComGasto).toEqual([26]);
    expect(nov.gastosAnotados).toBe(1);
    // e a atividade do mês (base dos percentuais, "dias com a vida anotada") também
    const vida = lerDadosDaVida(ler);
    expect(atividadeDoMes(2026, 9, vida, lerFinancasDoMes(2026, 9, ler, PERFIL_PESSOAL, hoje)).dias).toEqual([10, 28]);
    expect(atividadeDoMes(2026, 10, vida, lerFinancasDoMes(2026, 10, ler, PERFIL_PESSOAL, hoje)).dias).toEqual([5, 26]);
  });

  it("pela leitura do aparelho (sem `ler`, como o banner antigo chamava): o mesmo 200 / 1.000", () => {
    expect(buildWrappedData("Outubro", UID, 2026, { agora: hoje })!.outflow).toBe(200);
    expect(buildWrappedData("Novembro", UID, 2026, { agora: hoje })!.outflow).toBe(1000);
  });
});

/* ═══════════════ Home, widgets e lembrete do dia 2 ═══════════════ */

describe("dois-numeros (07/11): Home, widget Orçamento Restante, widget E e lembrete do dia 2", () => {
  const Sonda = () => {
    const d = useLifeHubData();
    return <span data-testid="saldo">{d.monthBalance}</span>;
  };

  it("saldo do mês da Home = 3.000 − 1.000 (a TV de outubro vence agora; o cinema de 26/11 é de dezembro)", () => {
    render(<MemoryRouter><Provedor inicial={dados}><Sonda /></Provedor></MemoryRouter>);
    expect(screen.getByTestId("saldo").textContent).toBe("2000");
  });

  it("widget Orçamento Restante: R$ 2.000,00 (antes dizia R$ 2.940,00)", () => {
    render(<MemoryRouter><Provedor inicial={dados}><BudgetRemainingWidget /></Provedor></MemoryRouter>);
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();
  });

  it("widget E (orçamento restante em %) e lembrete do dia 2 (R$/dia) fazem a mesma conta", () => {
    expect(orcamentoRestante(get)).toMatchObject({ pct: 67, dias: 24 }); // 2.000 de 3.000, do dia 7 ao 30
    expect(porDiaDasFinancas(get, hoje)).toBe(83); // 2.000 ÷ 24 dias = 83,33 → o lembrete arredonda pra baixo (antes: 122)
  });
});

/* ═══════════════ A tela de Finanças: LIMITES ═══════════════ */

describe("dois-numeros (07/11): LIMITES de novembro na tela de Finanças", () => {
  it("Eletrônicos R$ 1.000,00 (a TV de 28/10 é fatura de novembro); o cinema de 26/11 não conta (é de dezembro)", () => {
    render(
      <MemoryRouter initialEntries={["/financas"]}>
        <Provedor inicial={dados} loaded={false}>
          <Routes><Route path="/financas" element={<Index />} /></Routes>
        </Provedor>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /LIMITES/ }));
    const card = screen.getByText("Limites por Categoria").closest(".bg-card") as HTMLElement;
    expect(within(card).getByText("Eletrônicos")).toBeInTheDocument();
    expect(within(card).getByText(/R\$ 1\.000,00/)).toBeInTheDocument();
    expect(within(card).queryByText("Lazer")).toBeNull(); // só o chip "+ Lazer" (sem gasto que conte em novembro)
    expect(within(card).queryByText(/R\$ 60,00/)).toBeNull();
  });
});

/* ═══════════════ A fonte única (lib/finance-fatura) ═══════════════ */

describe("dois-numeros (07/11): variaveisDoMesLidas / configOfDe / chaveDeGastosDoMes", () => {
  it("chave do mês: o balde no mês corrente, o arquivo nos outros", () => {
    expect(chaveDeGastosDoMes("2026-11", "2026-11")).toBe("finance-expenses");
    expect(chaveDeGastosDoMes("2026-10", "2026-11")).toBe("finance-2026-outubro-expenses");
    expect(chaveDeGastosDoMes("2027-03", "2026-11")).toBe("finance-2027-marco-expenses");
    expect(chaveDeGastosDoMes("2026-11")).toBe("finance-expenses"); // o padrão é o mês de agora (relógio falso em 07/11)
  });

  it("configOfDe = a regra do useFinanceCards: só entrada com fechamento ou vencimento inteiro vale", () => {
    expect(configOfDe(undefined)("nubank")).toBeUndefined();
    expect(configOfDe({ nubank: {} })("nubank")).toBeUndefined();
    expect(configOfDe({ nubank: { closingDay: 25, dueDay: 5 } })("nubank")).toEqual({ closingDay: 25, dueDay: 5 });
    expect(configOfDe({ nubank: { dueDay: 5, mesDoVencimento: true } })("nubank")).toEqual({ dueDay: 5, mesDoVencimento: true });
    expect(configOfDe({ nubank: { closingDay: 25 } })("itau")).toBeUndefined();
    expect(configOfDe([1, 2])("nubank")).toBeUndefined(); // dado estranho na chave: sem fatura
  });

  it("novembro lido do store: conta a TV de outubro e adia o cinema; outubro lido em novembro adia a TV", () => {
    const nov = variaveisDoMesLidas("2026-11", ler, PERFIL_PESSOAL, "2026-11");
    expect(nov.noMes.map((g) => g.id)).toEqual(["tv"]);
    expect(nov.adiados.map((g) => g.id)).toEqual(["cinema"]);
    expect(nov.doMesAnterior.map((g) => g.id)).toEqual(["tv"]);
    expect(nov.total).toBe(1000);
    const out = variaveisDoMesLidas("2026-10", ler, PERFIL_PESSOAL, "2026-11");
    expect(out.noMes.map((g) => g.id)).toEqual(["mercado"]);
    expect(out.adiados.map((g) => g.id)).toEqual(["tv"]);
    expect(out.total).toBe(200);
  });

  it("perfil: o gasto da empresa não entra no pessoal; sem perfil, todos", () => {
    registrarPerfis([{ id: "acme", nome: "Acme" }]); // etiqueta de empresa que não existe cai no pessoal (13/09) — aqui ela existe
    try {
      const comEmpresa: Record<string, unknown> = { ...dados, "finance-expenses": [cinema, { ...tv, id: "tv-pj", date: "2026-11-02", perfil: "acme" }] };
      const lerPj = (k: string) => (k in comEmpresa ? comEmpresa[k] : undefined);
      expect(variaveisDoMesLidas("2026-11", lerPj, PERFIL_PESSOAL, "2026-11").total).toBe(1000);
      expect(variaveisDoMesLidas("2026-11", lerPj, "acme", "2026-11").total).toBe(1000); // só a TV da empresa (02/11, antes do fechamento)
      expect(variaveisDoMesLidas("2026-11", lerPj, undefined, "2026-11").total).toBe(2000);
    } finally { esquecerPerfis(); }
  });
});
