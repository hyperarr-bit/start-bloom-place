/**
 * GASTO COM DATA DE MÊS FUTURO CONTAVA INTEIRO NO MÊS DO CADASTRO (bug "gasto-futuro", 07/11).
 *
 * 07/11, "Dentista · R$ 800" com data 10/12. O gasto ia pro balde de novembro
 * (`finance-expenses`) e somava lá: novembro 900 (Mercado 100 + Dentista 800).
 * No dia 1º a virada arquivava só o Mercado em novembro e deixava o Dentista no
 * balde (data futura FICA — `separarPorMes`, de propósito): novembro virava 100.
 * A receita tinha o mesmo problema e foi consertada em 01/11 (lib/finance-
 * receita-futura): vai pra planilha do mês dela e a virada adota no dia 1º.
 *
 * O conserto usa a mesma ideia pro gasto: `guardarGastoNoMes` + a prop
 * `guardarEmOutroMes` no ExpenseTable (Index e planilha do MÊS ATUAL). O gasto
 * guardado não entra na lista do mês (nem dispara onPrimeiroGasto) e a tela
 * avisa pra onde foi. Gasto futuro que já estava no balde continua como está.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/gasto-futuro-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toasts.success, error: toasts.error, info: vi.fn(), warning: vi.fn(), message: vi.fn(), loading: vi.fn(), dismiss: vi.fn(), custom: vi.fn(), promise: vi.fn() }),
  Toaster: () => null,
}));
const auth = vi.hoisted(() => ({ user: { id: "u-futuro" } as { id: string } | null }));
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
vi.mock("@/lib/avaliacao", async (orig) => ({
  ...(await orig<typeof import("@/lib/avaliacao")>()),
  pedirAvaliacaoSePuder: vi.fn(async () => false),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { guardarGastoNoMes, guardarReceitaNoMes } from "@/lib/finance-receita-futura";
import { adotarMesPreenchido, separarPorMes } from "@/lib/virada-do-mes";
import { variaveisDoMes } from "@/lib/finance-fatura";
import { useViradaDoMes } from "@/hooks/use-virada-do-mes";
import { ExpenseTable } from "@/components/ExpenseTable";
import { MonthlySheet } from "@/components/MonthlySheet";
import Index from "@/pages/Index";

const hoje = new Date(2026, 10, 7, 10); // 07/11/2026
const semCartao = () => undefined;
type Gasto = { id: string; description: string; category: string; value: number; date: string; paymentMethod: string; perfil?: string };
const mercado: Gasto = { id: "m", description: "Mercado", category: "alimentacao", value: 100, date: "2026-11-05", paymentMethod: "pix" };
const dentista: Gasto = { id: "d", description: "Dentista", category: "saude", value: 800, date: "2026-12-10", paymentMethod: "pix" };
const DEZ = "finance-2026-dezembro-expenses";
const NOV = "finance-2026-novembro-expenses";
/** O "Despesas" (variáveis) de um mês, sem cartão com fatura: a soma crua, como no app sem fatura cadastrada. */
const total = (lista: unknown, mes: string) => variaveisDoMes(Array.isArray(lista) ? (lista as Gasto[]) : [], [], mes, semCartao).total;

/* ── store simples (a regra e a tabela sozinha) ── */
const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(k: string, fb: T): T => (k in dados ? (dados[k] as T) : fb),
    set: (k: string, v: unknown) => { dados[k] = v; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
const renderComStore = (ui: React.ReactElement, store = criarStore()) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

/* ── store "vivo" (a planilha do mês remonta a cada escrita, como o app) ── */
const criarStoreVivo = (inicial: Record<string, unknown>) => {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Record<string, unknown> };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode) => render(<MemoryRouter><Provedor>{ui}</Provedor></MemoryRouter>);
  const ler = <T,>(k: string) => estado.dados[k] as T | undefined;
  return { montar, ler };
};

beforeAll(() => {
  // Radix Select no jsdom
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
  toasts.success.mockClear();
  toasts.error.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** O card CUSTOS VARIÁVEIS (o que tem o "+ Novo gasto") de uma tela com várias tabelas. */
const cardDeGastos = () => within(screen.getByPlaceholderText("+ Novo gasto").closest("div.bg-card") as HTMLElement);
/** Preenche e salva um gasto no card; `data` abre "Mais opções" se precisar e digita a data. */
const lancarNo = (card: ReturnType<typeof within>, descricao: string, valor: string, data?: string) => {
  fireEvent.change(card.getByPlaceholderText("+ Novo gasto"), { target: { value: descricao } });
  fireEvent.change(card.getByPlaceholderText("Valor"), { target: { value: valor } });
  if (data) {
    const mais = card.queryByRole("button", { name: /Mais opções/ });
    if (mais) fireEvent.click(mais);
    fireEvent.change(card.getByLabelText(/Data:/), { target: { value: data } });
  }
  fireEvent.click(card.getByRole("button", { name: "Adicionar gasto" }));
};

/* ═══════════════ a regra (lib/finance-receita-futura) ═══════════════ */

describe("o relato: 'Dentista · R$ 800' com data 10/12, lançado em 07/11", () => {
  it("como era: no balde, o gasto futuro soma em novembro (900) e, no dia 1º, novembro vira 100 — o que a pessoa viu", () => {
    const balde = [mercado, dentista];
    expect(total(balde, "2026-11")).toBe(900);
    const dia1 = separarPorMes(balde, new Date(2026, 11, 1), "expenses");
    expect(total(dia1.arquivar[NOV], "2026-11")).toBe(100);
    expect(dia1.ficam.map((g) => g.id)).toEqual(["d"]); // data futura FICA no balde (regra que não muda aqui)
  });

  it("com a guarda: o Dentista vai pra chave de dezembro, etiquetado com o perfil; o balde de novembro não muda (100)", () => {
    const store = criarStore({ "finance-expenses": [mercado] });
    expect(guardarGastoNoMes(dentista, hoje, store.valor.get, store.valor.set, "pessoal")).toBe("Dezembro");
    expect(store.dados[DEZ]).toEqual([{ ...dentista, perfil: "pessoal" }]);
    expect(store.dados["finance-expenses"]).toEqual([mercado]);
    expect(total(store.dados["finance-expenses"], "2026-11")).toBe(100);
  });

  it("no dia 1º de dezembro a adoção (que já existia) leva o Dentista pro balde com a data dele: novembro 100, dezembro 800", () => {
    const store = criarStore({ "finance-expenses": [mercado] });
    guardarGastoNoMes(dentista, hoje, store.valor.get, store.valor.set, "pessoal");
    const dia1 = separarPorMes(store.dados["finance-expenses"] as Gasto[], new Date(2026, 11, 1), "expenses");
    const adocao = adotarMesPreenchido(
      { incomes: [], expenses: store.dados[DEZ], fixed: [], dueDays: [], notes: [] },
      { incomes: [], expenses: dia1.ficam, fixed: [], dueDays: [], notes: [] },
      "2026-12",
    )!;
    expect(adocao.gravar["finance-expenses"]).toEqual([{ ...dentista, perfil: "pessoal" }]); // data 2026-12-10 intacta
    expect(adocao.gravar[DEZ]).toEqual([]);
    expect(total(dia1.arquivar[NOV], "2026-11")).toBe(100);
    expect(total(adocao.gravar["finance-expenses"], "2026-12")).toBe(800);
  });

  it("mês atual, passado ou sem data não muda de lugar; virada de ano diz o ano; perfil PJ etiquetado sem mexer no que já estava; a receita segue igual", () => {
    const seguro = { id: "x", description: "Seguro", category: "outros", value: 50, date: "2027-01-02", paymentMethod: "pix" };
    const store = criarStore({ "finance-2027-janeiro-expenses": [seguro] });
    const { get, set } = store.valor;
    expect(guardarGastoNoMes({ ...dentista, date: "2026-11-20" }, hoje, get, set, "pessoal")).toBeNull();
    expect(guardarGastoNoMes({ ...dentista, date: "2026-10-20" }, hoje, get, set, "pessoal")).toBeNull();
    expect(guardarGastoNoMes({ ...dentista, date: "" }, hoje, get, set, "pessoal")).toBeNull();
    expect(store.dados["finance-expenses"]).toBeUndefined();
    expect(guardarGastoNoMes({ ...dentista, id: "j", date: "2027-01-10" }, hoje, get, set, "pj")).toBe("Janeiro de 2027");
    expect(store.dados["finance-2027-janeiro-expenses"]).toEqual([seguro, { ...dentista, id: "j", date: "2027-01-10", perfil: "pj" }]);
    expect(guardarReceitaNoMes({ id: "r", date: "2026-12-05", value: 4000 } as any, hoje, get, set, "pessoal")).toBe("Dezembro");
    expect(store.dados["finance-2026-dezembro-incomes"]).toEqual([{ id: "r", date: "2026-12-05", value: 4000, perfil: "pessoal" }]);
  });
});

/* ═══════════════ a tela (ExpenseTable) ═══════════════ */

describe("ExpenseTable com guardarEmOutroMes", () => {
  const guardaDeDezembro = (g: { date: string }) => (g.date.startsWith("2026-12") ? "Dezembro" : null);

  it("data de mês futuro: guarda fora, NÃO grava na lista do mês, NÃO dispara onPrimeiroGasto e avisa pra onde foi", () => {
    const gravar = vi.fn();
    const avisar = vi.fn();
    const guardar = vi.fn(guardaDeDezembro);
    renderComStore(<ExpenseTable expenses={[]} setExpenses={gravar} onPrimeiroGasto={avisar} guardarEmOutroMes={guardar} mes="2026-11" />);
    lancarNo(screen, "Dentista", "800", "2026-12-10");
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0][0]).toMatchObject({ description: "Dentista", value: 800, date: "2026-12-10", paymentMethod: "pix" });
    expect(gravar).not.toHaveBeenCalled();
    expect(avisar).not.toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith(
      expect.stringMatching(/guardado em Dezembro/),
      expect.objectContaining({ description: expect.stringMatching(/planilha de Dezembro.*ORÇAMENTO MENSAL/) }),
    );
    expect(screen.getByPlaceholderText("+ Novo gasto")).toHaveValue(""); // formulário limpo
    expect(screen.getByText("Nenhum gasto variável cadastrado")).toBeInTheDocument();
  });

  it("sem data futura: grava normal e, lista vazia, dispara onPrimeiroGasto (como sempre)", () => {
    const gravar = vi.fn();
    const avisar = vi.fn();
    const guardar = vi.fn(guardaDeDezembro);
    renderComStore(<ExpenseTable expenses={[]} setExpenses={gravar} onPrimeiroGasto={avisar} guardarEmOutroMes={guardar} mes="2026-11" />);
    lancarNo(screen, "Mercado", "100");
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar.mock.calls[0][0][0]).toMatchObject({ description: "Mercado", value: 100, date: "2026-11-07" });
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("editar a data pra um mês futuro tira o gasto da lista do mês", () => {
    const gravar = vi.fn();
    const guardar = vi.fn(guardaDeDezembro);
    renderComStore(<ExpenseTable expenses={[{ ...dentista, date: "2026-11-07" }]} setExpenses={gravar} guardarEmOutroMes={guardar} mes="2026-11" />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Dentista" }));
    fireEvent.change(screen.getByLabelText(/Data:/), { target: { value: "2026-12-10" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0][0]).toMatchObject({ id: "d", description: "Dentista", value: 800, date: "2026-12-10" });
    expect(gravar).toHaveBeenCalledWith([]);
    expect(toasts.success).toHaveBeenCalledWith(expect.stringMatching(/guardado em Dezembro/), expect.anything());
  });

  it("gasto que JÁ está no balde com data futura: editar sem trocar a data deixa onde está; sem a prop (planilha de outro mês) nada muda", () => {
    const viagem: Gasto = { id: "v", description: "Viagem", category: "lazer", value: 500, date: "2026-12-20", paymentMethod: "pix" };
    const gravar = vi.fn();
    const guardar = vi.fn(guardaDeDezembro);
    renderComStore(<ExpenseTable expenses={[viagem]} setExpenses={gravar} guardarEmOutroMes={guardar} mes="2026-11" />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Viagem" }));
    fireEvent.change(screen.getAllByPlaceholderText("Valor")[1], { target: { value: "550" } }); // o da linha em edição (o 1º é o do formulário)
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(guardar).not.toHaveBeenCalled();
    expect(gravar).toHaveBeenCalledWith([{ ...viagem, value: 550 }]);
    expect(toasts.success).not.toHaveBeenCalled();

    cleanup();
    const gravar2 = vi.fn();
    renderComStore(<ExpenseTable expenses={[]} setExpenses={gravar2} mes="2026-12" />);
    lancarNo(screen, "Seguro", "50", "2027-01-10");
    expect(gravar2.mock.calls[0][0][0]).toMatchObject({ description: "Seguro", value: 50, date: "2027-01-10" });
  });
});

/* ═══════════════ a planilha do MÊS ATUAL (MonthlySheet) ═══════════════ */

describe("planilha do mês (MonthlySheet)", () => {
  it("MÊS ATUAL passa pela guarda: gasto e receita com data de dezembro vão pras chaves de dezembro, não pro balde", () => {
    const store = criarStoreVivo({ "finance-expenses": [mercado], "finance-incomes": [] });
    store.montar(<MonthlySheet month="Novembro" year={2026} onClose={() => {}} />);
    expect(screen.getByText("MÊS ATUAL")).toBeInTheDocument();

    lancarNo(cardDeGastos(), "Dentista", "800", "2026-12-10");
    expect(store.ler(DEZ)).toEqual([expect.objectContaining({ description: "Dentista", value: 800, date: "2026-12-10", perfil: "pessoal" })]);
    expect((store.ler<Gasto[]>("finance-expenses") ?? []).map((g) => g.description)).toEqual(["Mercado"]);
    expect(toasts.success).toHaveBeenCalledWith(expect.stringMatching(/Gasto guardado em Dezembro/), expect.anything());

    const receitas = within(screen.getByPlaceholderText("+ Nova receita").closest("div.bg-card") as HTMLElement);
    fireEvent.change(receitas.getByPlaceholderText("+ Nova receita"), { target: { value: "13º" } });
    fireEvent.change(receitas.getByPlaceholderText("Valor"), { target: { value: "2000" } });
    fireEvent.change(receitas.getByLabelText(/Data:/), { target: { value: "2026-12-20" } });
    fireEvent.click(receitas.getByRole("button", { name: "Adicionar receita" }));
    expect(store.ler("finance-2026-dezembro-incomes")).toEqual([expect.objectContaining({ description: "13º", value: 2000, date: "2026-12-20" })]);
    expect(store.ler("finance-incomes") ?? []).toEqual([]);
    expect(toasts.success).toHaveBeenCalledWith(expect.stringMatching(/Receita guardada em Dezembro/));
  });

  it("planilha de OUTRO mês não passa (a chave dela já é datada): gasto de janeiro lançado na planilha de dezembro fica em dezembro", () => {
    const store = criarStoreVivo({});
    store.montar(<MonthlySheet month="Dezembro" year={2026} onClose={() => {}} />);
    expect(screen.getByText("PLANILHA DO MÊS")).toBeInTheDocument();
    lancarNo(cardDeGastos(), "Seguro", "50", "2027-01-10");
    expect(store.ler(DEZ)).toEqual([expect.objectContaining({ description: "Seguro", value: 50, date: "2027-01-10" })]);
    expect(store.ler("finance-2027-janeiro-expenses")).toBeUndefined();
    expect(toasts.success).not.toHaveBeenCalled();
  });
});

/* ═══════════════ o financeiro geral (Index), de verdade ═══════════════ */

const UID = "u-futuro";
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
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: false, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const App = () => {
  useViradaDoMes();
  return <Routes><Route path="/financas" element={<Index />} /></Routes>;
};
const abrirFinancas = (inicial: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(inicial)) localStorage.setItem(lsKey(k), JSON.stringify(v));
  const c: Controle = { dados: () => ({}) };
  render(<MemoryRouter initialEntries={["/financas"]}><Provedor inicial={inicial} controle={c}><App /></Provedor></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /MEU FINANCEIRO/ }));
  return c;
};

describe("o financeiro geral (Index)", () => {
  it("07/11: 'Dentista 800' em 10/12 não entra no balde de novembro (o card segue R$ 100) e vai pra chave de dezembro", async () => {
    const c = abrirFinancas({ "spotlight-done-financas": "true", "finance-expenses": [mercado], "finance-incomes": [] });
    const gastos = cardDeGastos();
    expect(gastos.getByText("R$ 100,00", { selector: ".font-bold" })).toBeInTheDocument();
    // fora de um act(async): o clique em "Mais opções" precisa renderizar o campo Data antes do próximo passo
    lancarNo(gastos, "Dentista", "800", "2026-12-10");
    await act(async () => {});

    expect(c.dados()[DEZ]).toEqual([expect.objectContaining({ description: "Dentista", value: 800, date: "2026-12-10" })]);
    expect((c.dados()["finance-expenses"] as Gasto[]).map((g) => g.description)).toEqual(["Mercado"]);
    expect(gastos.queryByText("Dentista")).not.toBeInTheDocument();
    expect(gastos.getByText("R$ 100,00", { selector: ".font-bold" })).toBeInTheDocument();
    expect(toasts.success).toHaveBeenCalledWith(expect.stringMatching(/Gasto guardado em Dezembro/), expect.anything());
  }, 30_000);
});
