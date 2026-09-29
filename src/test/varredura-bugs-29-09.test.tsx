/**
 * VARREDURA DE BUGS 29/09 — o que derrubava tela de verdade (route_error do
 * painel) e o que a varredura com Playwright achou. Cada bloco reproduz o
 * caminho da pessoa e falha sem o conserto.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { toast } from "sonner";
import { InstallmentTracker, type Installment } from "@/components/InstallmentTracker";
import { EmergencyFund } from "@/components/finance/EmergencyFund";
import { MonthTurnover } from "@/components/MonthTurnover";
import { FinancialHealth } from "@/components/FinancialHealth";
import { FinancesWidget } from "@/components/home/widgets/FinancesWidget";
import { BudgetRemainingWidget } from "@/components/home/widgets/BudgetRemainingWidget";
import { MemoryRouter } from "react-router-dom";
import { normalizeForKey } from "@/lib/data-normalizers";

vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  return { ...real, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

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
beforeEach(() => vi.clearAllMocks());

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};
const renderComStore = (ui: React.ReactElement, store = criarStore()) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);
const erros = () => (toast.error as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
/** O que o app faz com a lista ao salvar e REABRIR: passa pelo JSON (Infinity/NaN → null). */
const reabrir = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* ============================================================
 * 1. PARCELAMENTO COM 0 PARCELAS DERRUBAVA O FINANÇAS AO REABRIR
 *    (route_error "Cannot read properties of null (reading 'toLocaleString')",
 *    17× entre 22 e 25/09, 3 pessoas — web e app Android)
 * ============================================================ */
describe("Parcelamentos — número que não é número", () => {
  const parcelaQuebrada = {
    id: "1790650065508", description: "Celular", totalValue: 1200, installmentValue: null,
    paidInstallments: 0, totalInstallments: 0, cardName: "outro", category: "outros", date: "2026-09-28",
  } as unknown as Installment;

  it("o card não cai com parcela null (o dado que já está salvo na nuvem de quem passou por isso)", () => {
    expect(() => renderComStore(<InstallmentTracker installments={[parcelaQuebrada]} setInstallments={() => {}} />)).not.toThrow();
    expect(screen.getAllByText(/Celular/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/∞|NaN/);
  });

  it("'Total parcelas' = 0 é recusado com aviso (antes gravava Infinity e mostrava R$ ∞)", () => {
    let gravado: Installment[] | null = null;
    renderComStore(<InstallmentTracker installments={[]} setInstallments={(l) => { gravado = l; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Celular" } });
    fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "1200" } });
    fireEvent.change(screen.getByPlaceholderText("Total parcelas"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(gravado).toBeNull();
    expect(erros().join(" ")).toMatch(/parcelas/i);
  });

  it("Salvar com campo vazio avisa o que falta (antes ficava mudo)", () => {
    renderComStore(<InstallmentTracker installments={[]} setInstallments={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(erros().length).toBe(1);
  });

  it("ciclo inteiro: cadastrar 10× de 1.200 → salvar → REABRIR → card mostra R$ 120,00 sem cair", () => {
    let gravado: Installment[] = [];
    const { unmount } = renderComStore(<InstallmentTracker installments={[]} setInstallments={(l) => { gravado = l; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Celular" } });
    fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "1200" } });
    fireEvent.change(screen.getByPlaceholderText("Total parcelas"), { target: { value: "10" } });
    fireEvent.change(screen.getByPlaceholderText("Pagas"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(gravado).toHaveLength(1);
    expect(gravado[0].installmentValue).toBe(120);
    expect(gravado[0].paidInstallments).toBe(10); // "pagas" não passa do total
    unmount();
    const lista = normalizeForKey("finance-installments", reabrir(gravado));
    renderComStore(<InstallmentTracker installments={lista} setInstallments={() => {}} />);
    expect(document.body.textContent).toMatch(/120,00/);
  });

  it("a leitura cura o que já está salvo: 0 parcelas + parcela null vira 1× do total; item saudável volta intacto", () => {
    const saudavel = { id: "2", description: "TV", totalValue: 3000, installmentValue: 300, paidInstallments: 2, totalInstallments: 10 };
    const [curado, igual] = normalizeForKey("finance-installments", [reabrir(parcelaQuebrada), saudavel]) as Installment[];
    expect(curado.totalInstallments).toBe(1);
    expect(curado.installmentValue).toBe(1200);
    expect(curado.totalValue).toBe(1200);
    expect(igual).toBe(saudavel);
    // parcela e total nulos (NaN digitado): nada de NaN na conta
    const [semNada] = normalizeForKey("finance-installments", [{ id: "3", description: "X", totalValue: null, installmentValue: null, totalInstallments: 3, paidInstallments: null }]) as Installment[];
    expect(semNada).toMatchObject({ totalValue: 0, installmentValue: 0, totalInstallments: 3, paidInstallments: 0 });
  });
});

/* ============================================================
 * 2. RESERVA DE EMERGÊNCIA DERRUBAVA O FINANÇAS EM MOTOR ANTIGO
 *    (route_error "maximumFractionDigits value is out of range", 25/09)
 * ============================================================ */
describe("Reserva de emergência — motor de Intl antigo", () => {
  const original = Number.prototype.toLocaleString;
  beforeEach(() => {
    /* Emula a regra antiga do ECMA-402 (Chrome < 106 / Safari < 15.4): com style
       currency o mínimo padrão é o da moeda (2 pro BRL) e máximo < mínimo lança. */
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (this: number, loc?: string | string[], o?: Intl.NumberFormatOptions) {
      if (o?.style === "currency" && o.maximumFractionDigits !== undefined) {
        const min = o.minimumFractionDigits ?? 2;
        if (o.maximumFractionDigits < min) throw new RangeError("maximumFractionDigits value is out of range.");
      }
      return original.call(this, loc, o);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("abre com a reserva registrada sem cair", () => {
    const store = criarStore({ "finance-emergency-fund": { meses: 6, guardado: 5000, registrada: true } });
    expect(() => renderComStore(<EmergencyFund despesaMensal={3000} />, store)).not.toThrow();
    expect(document.body.textContent).toMatch(/18\.000/);
  });
});

/* ============================================================
 * 3. RESUMO DO MÊS NA VIRADA (01/10) COM UMA CASA DECIMAL
 *    "🏆 Setembro acabou! … Despesas R$ 2.522,4" — visto na varredura com o
 *    relógio em 01/10 00:01; o cartão "Resumo de Setembro" do topo também.
 * ============================================================ */
describe("Resumo do mês que acabou — dinheiro com 2 casas", () => {
  const UID = "u-varredura";
  afterEach(() => { vi.useRealTimers(); auth.user = null; localStorage.clear(); });

  it("01/10: 'Setembro acabou!' mostra R$ 2.522,40 (não R$ 2.522,4)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1, 9, 0));
    auth.user = { id: UID };
    const dados: Record<string, unknown> = {
      "finance-2026-setembro-incomes": [{ id: "r", date: "2026-09-01", value: 6200, description: "Salário" }],
      "finance-2026-setembro-expenses": [
        { id: "e1", date: "2026-09-03", value: 640.5, description: "Mercado" },
        { id: "e2", date: "2026-09-28", value: 31.9, description: "Uber" },
      ],
      "finance-2026-setembro-fixed": [{ id: "f", description: "Aluguel", value: 1850, day: 5 }],
      "finance-last-seen-month": "Setembro-2026",
    };
    for (const [k, v] of Object.entries(dados)) localStorage.setItem(`u:${UID}:${k}`, JSON.stringify(v));
    renderComStore(<MonthTurnover />, criarStore(dados));
    expect(screen.getByText("Setembro acabou!")).toBeInTheDocument();
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/R\$ 2\.522,40/);
    expect(texto).not.toMatch(/R\$ 2\.522,4(?!\d)/);
  });
});

/* ============================================================
 * 4. SAÚDE FINANCEIRA — "NaN/100" e número com ponto
 *    O card de Desejos já se defendia de preço antigo sem número; o score
 *    somava o bruto (undefined → NaN, "100" → concatenação) e a parcela com
 *    0 parcelas dividia por zero. E toFixed(1) mostrava "50.0%".
 * ============================================================ */
describe("Saúde Financeira", () => {
  const base = {
    totalIncome: 5001, totalExpenses: 1000, totalFixedExpenses: 1500, monthlyInstallments: 0, totalDebts: 0,
    totalInvestments: 0, emergencyFundGoal: 0, dueDays: [], installments: [], wishlistItems: [], trips: [], investments: [],
  };

  it("desejo antigo sem preço + parcela com 0 parcelas: score é número, não 'NaN/100'", () => {
    render(<FinancialHealth {...base}
      wishlistItems={[{ id: "w", name: "iPad", price: undefined, savedAmount: "100" }] as never}
      installments={[{ id: "p", totalValue: 1200, installmentValue: null, paidInstallments: 0, totalInstallments: 0 }] as never} />);
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/NaN|Infinity/);
    expect(texto).toMatch(/SCORE FINANCEIRO\s*\d{1,3}\/100/);
  });

  it("taxa de poupança com vírgula e reais com 2 casas (50,0% · R$ 2.500,50)", () => {
    render(<FinancialHealth {...base} />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/50,0%/);
    expect(texto).not.toMatch(/\d\.\d%/);
    expect(texto).toMatch(/Necessidades: R\$ 2\.500,50/);
  });
});

/* ============================================================
 * 5. HOME × FINANÇAS — o mesmo saldo nos dois lugares
 *    A Home fazia conta própria sem as parcelas do mês, e o "Orçamento
 *    Restante" dividia pelos dias SEM contar hoje ("por 1 dias" em 29/09).
 * ============================================================ */
describe("Widgets de dinheiro da Home", () => {
  afterEach(() => { vi.useRealTimers(); });
  const conta = {
    "finance-incomes": [{ id: "r", date: "2026-09-01", value: 6200, description: "Salário" }],
    "finance-expenses": [
      { id: "e1", date: "2026-09-03", value: 640.5, description: "Mercado" },
      { id: "e2", date: "2026-09-28", value: 31.9, description: "Uber" },
    ],
    "finance-fixed-expenses": [{ id: "f", description: "Aluguel", value: 1850, day: 5 }],
    "finance-installments": [{ id: "p", description: "Celular", totalValue: 1800, installmentValue: 150, paidInstallments: 9, totalInstallments: 12, cardName: "nubank", category: "eletronicos", date: "2025-12-15" }],
  };
  const naHome = (ui: React.ReactElement) => renderComStore(<MemoryRouter>{ui}</MemoryRouter>, criarStore(conta));

  it("card Finanças: 6.200 − 672,40 − 1.850 − parcela 150 = R$ 3.527,60 (antes R$ 3.677,60)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 29, 10, 0));
    naHome(<FinancesWidget size="small" />);
    expect(document.body.textContent).toMatch(/R\$\s?3\.527,60/);
  });

  it("Orçamento Restante em 29/09: divide por 2 dias (29 e 30), com a parcela", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 29, 10, 0));
    naHome(<BudgetRemainingWidget />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/R\$\s?3\.527,60/);
    expect(texto).toMatch(/R\$\s?1\.763,80\/dia por 2 dias/);
    expect(texto).not.toMatch(/por 1 dias/);
  });
});
