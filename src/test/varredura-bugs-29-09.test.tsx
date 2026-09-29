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
import { normalizeForKey } from "@/lib/data-normalizers";

vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  return { ...real, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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
