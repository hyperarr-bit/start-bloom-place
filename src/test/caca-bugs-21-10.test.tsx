/**
 * CAÇA A BUGS 21/10 — consertos pequenos achados nos dados e nos chamados.
 *
 * 1) Chamado de 20/10 (Android 132): "os custos fixos pagos não deviam sumir
 *    quando vira o mês". A pessoa marcou o aluguel como pago em setembro; no
 *    dia 20/10 a virada rodou, zerou os ✓ de outubro (certo: pagamento expira)
 *    e guardou o retrato de setembro COM os ✓ (`finance-2026-setembro-dueDays`).
 *    Mas a planilha de setembro mostrava tudo como NÃO pago: a tabela de fixos
 *    só recebia as contas do mês corrente (Index); na planilha de outro mês
 *    (MonthlySheet) ela caía no `pagoEm`, que fixo com Dia nunca tem.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, subLoaded: true, loading: false }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { MonthlySheet } from "@/components/MonthlySheet";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode) => render(<MemoryRouter><Provedor>{ui}</Provedor></MemoryRouter>);
  const ler = <T,>(k: string) => estado.dados[k] as T;
  return { estado, montar, ler };
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 20, 13, 0)); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

/* id com carimbo de tempo de setembro/2026 (como todo escritor de fixo grava: Date.now()) */
const ID_ALUGUEL = String(new Date(2026, 8, 3, 10, 0).getTime());

describe("1) planilha do mês passado mostra o ✓ dos custos fixos pagos (retrato das contas)", () => {
  const retratoDeSetembro = {
    "finance-2026-setembro-fixed": [
      { id: ID_ALUGUEL, description: "Aluguel", category: "moradia", value: 1200, paymentMethod: "boleto", day: 5 },
      { id: "f-netflix", description: "Netflix", category: "lazer", value: 55, paymentMethod: "cartao" },
    ],
    "finance-2026-setembro-dueDays": [
      { day: 5, color: "slate", bills: [{ id: `fx-${ID_ALUGUEL}`, name: "Aluguel", paid: true, value: 1200, fixedId: ID_ALUGUEL }] },
    ],
    // outubro (corrente) já zerado pela virada — não pode vazar pra setembro
    "finance-fixed-expenses": [{ id: ID_ALUGUEL, description: "Aluguel", category: "moradia", value: 1200, paymentMethod: "boleto", day: 5 }],
    "finance-dueDays": [{ day: 5, color: "slate", bills: [{ id: `fx-${ID_ALUGUEL}`, name: "Aluguel", paid: false, value: 1200, fixedId: ID_ALUGUEL }] }],
  };

  it("setembro: Aluguel (com Dia) aparece PAGO, lido da conta fx-<id> do retrato de setembro", () => {
    const store = criarStore(retratoDeSetembro);
    store.montar(<MonthlySheet month="Setembro" year={2026} onClose={() => {}} />);
    const aluguel = screen.getByRole("button", { name: "Desmarcar Aluguel como paga" });
    expect(aluguel).toHaveAttribute("aria-pressed", "true");
    // Netflix (sem Dia, sem pagoEm) segue não pago — o conserto não inventa ✓
    expect(screen.getByRole("button", { name: "Marcar Netflix como paga" })).toHaveAttribute("aria-pressed", "false");
  });

  it("desmarcar em setembro mexe só na conta de SETEMBRO; outubro (corrente) fica como está", () => {
    const store = criarStore(retratoDeSetembro);
    store.montar(<MonthlySheet month="Setembro" year={2026} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Aluguel como paga" }));
    const set = store.ler<{ bills: { id: string; paid: boolean }[] }[]>("finance-2026-setembro-dueDays");
    expect(set.flatMap((d) => d.bills).find((b) => b.id === `fx-${ID_ALUGUEL}`)?.paid).toBe(false);
    const out = store.ler<{ bills: { id: string; paid: boolean }[] }[]>("finance-dueDays");
    expect(out.flatMap((d) => d.bills).find((b) => b.id === `fx-${ID_ALUGUEL}`)?.paid).toBe(false);
    // o fixo em si não ganhou `pagoEm` (o ✓ do fixo com Dia mora na conta, não no fixo)
    const fixos = store.ler<{ id: string; pagoEm?: string }[]>("finance-2026-setembro-fixed");
    expect(fixos.find((f) => f.id === ID_ALUGUEL)?.pagoEm).toBeUndefined();
  });
});
