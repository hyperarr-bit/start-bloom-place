/**
 * 1.0.22 — TRÊS PEQUENOS (28/10, aprovados pelo dono):
 *  1. QUANTO POSSO GASTAR HOJE no topo do Dashboard + compacto no topo do MEU FINANCEIRO (mesma conta; vazio honesto).
 *  2. Água e humor do "+" aparecendo no módulo certo; os 3 "Como você está hoje" lendo o mesmo registro do dia.
 *  3. Parcelamento começando no meio: "Já paguei __" → "parcela 3 de 5", só as que faltam, nos meses certos.
 * Em todos: dado antigo sem nada novo continua igual, o app antigo continua lendo a SUA chave, e fechar/reabrir
 * (JSON de ida e volta, como o user_data) não perde nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { normalizeForKey } from "@/lib/data-normalizers";

vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  return { ...real, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: async () => {},
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, plataformaApp: () => "web" }));

import { toast } from "sonner";
import { Dashboard } from "@/components/Dashboard";
import { PodeGastarCompacto } from "@/components/finance/PodeGastarCompacto";
import { computeDailyBudget } from "@/lib/finance-totals";
import {
  espelharHumor, gravarHumorNasTres, historicoDeHumor, humorDoDia, valorDoRegistro,
} from "@/lib/humor-do-dia";
import { gravarAgua, gravarHumor } from "@/lib/acoes-rapidas";
import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { MoodTracker } from "@/pages/Rotina";
import { InstallmentTracker, type Installment } from "@/components/InstallmentTracker";
import { avancarPara, parcelaDoMes, parcelaPagaNoMes, somaParcelasDoMes, viradaDeParcelas } from "@/lib/finance-parcelas";

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
afterEach(() => { cleanup(); vi.clearAllMocks(); });

/** user_data de mentira; `reabrir()` simula fechar e abrir o app (tudo passa pelo JSON, como na nuvem). */
const criarStore = (inicial: Record<string, unknown> = {}) => {
  let dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return {
    get dados() { return dados; },
    valor,
    reabrir() { dados = JSON.parse(JSON.stringify(dados)); },
  };
};
const comStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

// ───────────────────────── 1 · QUANTO POSSO GASTAR HOJE ─────────────────────────
describe("1 · QUANTO POSSO GASTAR HOJE no topo", () => {
  const base = {
    totalDebts: 0, totalInvestments: 0, expenses: [], savingsRate: 0, incomes: [],
  };
  const fixos = [{ id: "a", description: "Aluguel", category: "moradia", value: 1000, paymentMethod: "boleto", day: 5 }];

  it("Dashboard de sempre: o card é o 1º da tela (antes era o último), com a mesma conta", () => {
    const store = criarStore();
    const { container } = comStore(
      <Dashboard {...base} totalIncome={3000} totalExpenses={1500} fixedExpenses={fixos} dueDays={[]} gastoDeHoje={0} />, store,
    );
    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz.firstElementChild?.getAttribute("data-testid")).toBe("pode-gastar-simples");
    const b = computeDailyBudget(3000, 1500, [], fixos);
    expect(screen.getByTestId("pode-gastar-valor").textContent).toContain(String(Math.round(b.perDay)));
    // a previsão continua existindo (lá embaixo)
    expect(screen.getByText(/PREVISÃO DO FIM DO MÊS/i)).toBeTruthy();
  });

  it("sem renda (com ou sem saídas): estado vazio honesto, nunca 'Você não pode gastar'", () => {
    const store = criarStore();
    comStore(<Dashboard {...base} totalIncome={0} totalExpenses={0} fixedExpenses={[]} dueDays={[]} />, store);
    expect(screen.getByTestId("pode-gastar-vazio").textContent).toMatch(/quanto entra no mês/);
    expect(screen.queryByText(/Você não pode gastar/)).toBeNull();
    cleanup();
    comStore(<Dashboard {...base} totalIncome={0} totalExpenses={1000} fixedExpenses={fixos} dueDays={[]} />, store);
    expect(screen.getByTestId("pode-gastar-vazio").textContent).toMatch(/Falta só quanto entra no mês/);
    expect(screen.queryByText(/Você não pode gastar/)).toBeNull();
  });

  it("compacto do MEU FINANCEIRO: o MESMO número do card do Dashboard, e o toque leva ao Dashboard", () => {
    const dia = new Date(2026, 9, 28, 10);
    const vi_ = vi.fn();
    render(<PodeGastarCompacto totalIncome={3000} totalExpenses={1500} dueDays={[]} fixedExpenses={fixos} gastoDeHoje={30} onVerNoPainel={vi_} onAnotarRenda={() => {}} agora={dia} />);
    const b = computeDailyBudget(3000, 1500, [], fixos, dia);
    expect(screen.getByTestId("pode-gastar-compacto-valor").textContent).toBe(`R$ ${Math.round(b.perDay)}`);
    // com gasto hoje: a linha "sobram R$ X pra hoje" (o que dava no começo do dia − o de hoje)
    const inicio = computeDailyBudget(3000, 1470, [], fixos, dia);
    expect(screen.getByTestId("pode-gastar-compacto-linha").textContent).toContain(String(Math.round(inicio.perDay) - 30));
    fireEvent.click(screen.getByTestId("pode-gastar-compacto"));
    expect(vi_).toHaveBeenCalledTimes(1);
  });

  it("compacto sem renda: diz o que falta e leva até RECEITAS", () => {
    const anotar = vi.fn();
    render(<PodeGastarCompacto totalIncome={0} totalExpenses={0} dueDays={[]} fixedExpenses={[]} onVerNoPainel={() => {}} onAnotarRenda={anotar} />);
    expect(screen.getByTestId("pode-gastar-compacto-vazio").textContent).toMatch(/falta quanto entra no mês/);
    fireEvent.click(screen.getByRole("button", { name: /Anotar minha renda/ }));
    expect(anotar).toHaveBeenCalled();
  });

  it("contas maiores que o saldo: R$ 0 nos dois, sem inventar número", () => {
    render(<PodeGastarCompacto totalIncome={1000} totalExpenses={1500} dueDays={[]} fixedExpenses={fixos} onVerNoPainel={() => {}} onAnotarRenda={() => {}} />);
    expect(screen.getByTestId("pode-gastar-compacto-valor").textContent).toBe("R$ 0");
  });
});

// ───────────────────────── 2 · ÁGUA E HUMOR ─────────────────────────
describe("2a · água do '+' = água da Saúde (o mesmo total do dia)", () => {
  const hoje = localDayKey();
  const ctx = (store: ReturnType<typeof criarStore>) => ({ get: store.valor.get, set: store.valor.set, navigate: vi.fn(), waterGoal: 8 });

  it("'+' da Home → a Saúde mostra os copos, mesmo pra quem nunca abriu a Saúde; fecha e reabre continua", () => {
    const store = criarStore();
    gravarAgua(ctx(store));
    gravarAgua(ctx(store));
    store.reabrir();
    comStore(<HydrationTracker />, store);
    expect(screen.getByText("500ml / 2000ml")).toBeTruthy(); // 2 copos de 250
  });

  it("vice-versa: a Saúde marca 3 e o próximo '+' vira 4 (lê o maior das duas chaves, grava nas duas)", () => {
    const store = criarStore({ "core-saude-water": { [hoje]: 3 } }); // só a chave da Saúde (app antigo)
    gravarAgua(ctx(store));
    expect((store.dados["water-log"] as Record<string, number>)[hoje]).toBe(4);
    expect((store.dados["core-saude-water"] as Record<string, number>)[hoje]).toBe(4);
  });

  it("o aviso da água leva à Saúde", () => {
    const store = criarStore();
    const c = ctx(store);
    gravarAgua(c);
    const [, opcoes] = (toast.success as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opcoes.action.label).toBe("Ver Saúde");
    opcoes.action.onClick();
    expect(c.navigate).toHaveBeenCalledWith("/saude");
  });
});

describe("2b · o humor do dia é um só (3 chaves, cada uma no seu formato)", () => {
  const hoje = localDayKey();

  it("lê o formato de cada chave; dado inválido não conta", () => {
    expect(valorDoRegistro("mood-log", { mood: 4, note: "x" })).toBe(4);
    expect(valorDoRegistro("mood-log", { mood: 0, emocoes: ["Calmo"] })).toBeNull();
    expect(valorDoRegistro("core-mood-log", { value: 2, emoji: "😔", time: "10:00" })).toBe(2);
    expect(valorDoRegistro("dp-mood-log", 5)).toBe(5);
    expect(valorDoRegistro("dp-mood-log", 9)).toBeNull();
    expect(valorDoRegistro("dp-mood-log", null)).toBeNull();
  });

  it("dado ANTIGO em uma chave só aparece nas 3 telas; nada é reescrito na leitura", () => {
    const store = criarStore({ "core-mood-log": { [hoje]: { value: 4, emoji: "🙂", time: "09:00" } } });
    expect(humorDoDia(store.valor.get, hoje)).toEqual({ valor: 4, chave: "core-mood-log" });
    expect(store.dados["mood-log"]).toBeUndefined();
    expect(store.dados["dp-mood-log"]).toBeUndefined();
  });

  it("histórico unificado: dias de cada chave entram; conflito antigo segue Rotina → Home → Dev", () => {
    const get = criarStore({
      "mood-log": { "2026-10-20": { mood: 2, note: "" }, "2026-10-22": { mood: 5, note: "" } },
      "core-mood-log": { "2026-10-21": { value: 3, emoji: "😐" }, "2026-10-22": { value: 1, emoji: "😡" } },
      "dp-mood-log": { "2026-10-23": 4, "2026-10-22": 3, "lixo": 2 },
    }).valor.get;
    expect(historicoDeHumor(get)).toEqual({ "2026-10-20": 2, "2026-10-21": 3, "2026-10-22": 5, "2026-10-23": 4 });
  });

  it("gravar espelha nas 3 SEM mudar formato e sem perder a nota/emoções da Rotina", () => {
    const novos = espelharHumor({ "mood-log": { [hoje]: { mood: 2, note: "dia longo", emocoes: ["Cansado"] } } }, hoje, 5, { emoji: "🤩" });
    expect(novos["mood-log"][hoje]).toEqual({ mood: 5, note: "dia longo", emocoes: ["Cansado"] });
    expect(novos["dp-mood-log"][hoje]).toBe(5);
    expect(novos["core-mood-log"][hoje]).toMatchObject({ value: 5, emoji: "🤩" });
    expect(typeof (novos["core-mood-log"][hoje] as { time: unknown }).time).toBe("string");
  });

  it("'+' da Home grava nas 3 — e o APP ANTIGO, lendo só a sua chave do jeito dele, vê o registro", () => {
    const store = criarStore({ "dp-mood-log": { "2026-10-01": 3 } });
    const navigate = vi.fn();
    gravarHumor({ get: store.valor.get, set: store.valor.set, navigate }, { value: 4, emoji: "🙂" });
    store.reabrir();
    // Rotina antiga: Number(reg?.mood) por dia
    const rotina = store.dados["mood-log"] as Record<string, { mood: number; note: string }>;
    expect(Number(rotina[hoje]?.mood)).toBe(4);
    expect(rotina[hoje].note).toBe("");
    // Dev. Pessoal antigo: moodLog[today] é número
    const dp = store.dados["dp-mood-log"] as Record<string, number>;
    expect(dp[hoje]).toBe(4);
    expect(dp["2026-10-01"]).toBe(3); // o resto do mapa intacto
    // Home antiga: core-mood-log { value, emoji, time } — e o normalizador de sempre aceita
    const home = normalizeForKey("core-mood-log", store.dados["core-mood-log"]) as Record<string, { value: number; emoji: string }>;
    expect(home[hoje]).toMatchObject({ value: 4, emoji: "🙂" });
    // o aviso leva pra Rotina
    const [, opcoes] = (toast.success as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opcoes.action.label).toBe("Ver na Rotina");
  });

  it("Rotina › COMO VOCÊ ESTÁ HOJE? mostra o humor do '+' marcado e no histórico; fecha/reabre; trocar grava nas 3", () => {
    const store = criarStore();
    gravarHumorNasTres(store.valor.get, store.valor.set, hoje, 2, { emoji: "😔" });
    // o que interessa é a leitura de quem só tinha o "+": apaga as cópias e deixa só a da Home (dado de antes da 1.0.22)
    delete store.dados["mood-log"];
    delete store.dados["dp-mood-log"];
    store.reabrir();
    comStore(<MoodTracker />, store);
    const meh = screen.getByRole("button", { name: /Ruim/ }); // 1.0.22: o 2 se chama "Ruim" em todo lugar (era "Meh" na Rotina)
    expect(meh.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("emocoes-do-dia")).toBeTruthy(); // emoções e nota liberadas: o dia tem humor
    // trocar na Rotina → as 3 chaves com o mesmo valor
    fireEvent.click(screen.getByRole("button", { name: /Ótimo/ }));
    expect((store.dados["mood-log"] as Record<string, { mood: number }>)[hoje].mood).toBe(5);
    expect((store.dados["dp-mood-log"] as Record<string, number>)[hoje]).toBe(5);
    expect((store.dados["core-mood-log"] as Record<string, { value: number }>)[hoje].value).toBe(5);
    cleanup();
    store.reabrir();
    comStore(<MoodTracker />, store);
    expect(screen.getByRole("button", { name: /Ótimo/ }).getAttribute("aria-pressed")).toBe("true");
  });
});

// ───────────────────────── 3 · PARCELAS COMEÇANDO NO MEIO ─────────────────────────
describe("3 · parcelamento 'Já paguei'", () => {
  const MES = "2026-10";

  it("cadastro: 5 parcelas, já paguei 2 → prévia 'parcela 3 de 5', grava paidInstallments 2 no formato de sempre, lista mostra 'parcela 3 de 5'", () => {
    let gravado: Installment[] = [];
    const store = criarStore();
    const { unmount } = comStore(<InstallmentTracker installments={[]} setInstallments={(l) => { gravado = l; }} mes={MES} />, store);
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Geladeira" } });
    fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "2500" } });
    fireEvent.change(screen.getByLabelText("Total de parcelas"), { target: { value: "5" } });
    expect((screen.getByLabelText("Já paguei") as HTMLInputElement).placeholder).toBe("0");
    fireEvent.change(screen.getByLabelText("Já paguei"), { target: { value: "2" } });
    expect(screen.getByTestId("previa-parcelamento").textContent).toMatch(/^(Este mês|Em outubro): parcela 3 de 5 \(R\$ 500,00\) · faltam 3, a última em dez$/);
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(gravado).toHaveLength(1);
    const g = gravado[0];
    expect(g.paidInstallments).toBe(2);
    expect(g.totalInstallments).toBe(5);
    expect(g.installmentValue).toBe(500);
    expect(Object.keys(g).sort()).toEqual(["cardName", "category", "date", "description", "id", "installmentValue", "paidInstallments", "parcelaDoMes", "startMonth", "totalInstallments", "totalValue"]);
    expect(g.parcelaDoMes).toBe(3);
    unmount();
    // fecha e reabre
    const lista = normalizeForKey("finance-installments", JSON.parse(JSON.stringify(gravado))) as Installment[];
    comStore(<InstallmentTracker installments={lista} setInstallments={() => {}} mes={MES} />, store);
    expect(screen.getByText(/parcela 3 de 5 ·/)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Marcar parcela 3 de Geladeira como paga/ })).toBeTruthy();
  });

  it("só as que faltam, nos meses certos: out=3, nov=4, dez=5, jan=quitado (sai do total)", () => {
    const p: Installment = { id: "g", description: "Geladeira", totalValue: 2500, installmentValue: 500, paidInstallments: 2, totalInstallments: 5, cardName: "nubank", category: "casa", date: "2026-10-28", startMonth: MES, parcelaDoMes: 3 };
    expect(parcelaDoMes(p)).toBe(3);
    expect(parcelaPagaNoMes(p)).toBe(false);
    expect(parcelaDoMes(avancarPara(p, MES, "2026-11")!)).toBe(4);
    expect(parcelaDoMes(avancarPara(p, MES, "2026-12")!)).toBe(5);
    const jan = avancarPara(p, MES, "2027-01")!;
    expect(somaParcelasDoMes([jan])).toBe(0);
    // a virada de novembro leva adiante no próprio balde
    const v = viradaDeParcelas([p], "2026-11");
    expect(parcelaDoMes(v!.lista[0])).toBe(4);
  });

  it("sem 'Já paguei' (padrão 0) e parcelamento ANTIGO sem nenhum campo de mês: tudo como antes", () => {
    let gravado: Installment[] = [];
    comStore(<InstallmentTracker installments={[]} setInstallments={(l) => { gravado = l; }} mes={MES} />, criarStore());
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "TV" } });
    fireEvent.change(screen.getByPlaceholderText("Valor total"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Total de parcelas"), { target: { value: "10" } });
    expect(screen.getByTestId("previa-parcelamento").textContent).toMatch(/parcela 1 de 10/);
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(gravado[0].paidInstallments).toBe(0);
    expect(gravado[0].parcelaDoMes).toBe(1);
    // legado (gravado pelo app antigo, sem startMonth/parcelaDoMes): parcela do mês = pagas + 1, de sempre
    const legado = { id: "l", description: "Sofá", totalValue: 1200, installmentValue: 200, paidInstallments: 1, totalInstallments: 6, cardName: "outro", category: "casa", date: "2026-08-01" } as Installment;
    expect(parcelaDoMes(legado)).toBe(2);
    cleanup();
    comStore(<InstallmentTracker installments={[legado]} setInstallments={() => {}} mes={MES} />, criarStore());
    expect(screen.getByText(/parcela 2 de 6 ·/)).toBeTruthy();
  });

  it("'Já paguei' maior que o total não quebra: entra como quitado (regra de sempre)", () => {
    comStore(<InstallmentTracker installments={[]} setInstallments={() => {}} mes={MES} />, criarStore());
    fireEvent.click(screen.getByRole("button", { name: /Novo Parcelamento/ }));
    fireEvent.change(screen.getByLabelText("Total de parcelas"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Já paguei"), { target: { value: "7" } });
    expect(within(screen.getByTestId("previa-parcelamento")).getByText(/Todas já pagas/)).toBeTruthy();
  });
});
