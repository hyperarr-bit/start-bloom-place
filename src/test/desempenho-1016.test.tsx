/**
 * DESEMPENHO 1.0.16 (17/10, dono: "o app ser leve, rápido, fluido"). Cada bloco trava um conserto medido no
 * relatório scratchpad/definitiva/13-desempenho.md — o comportamento que a pessoa vê é o mesmo; muda o trabalho
 * que o app fazia sem ninguém ver.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn(), reagendarTudo: vi.fn(async () => ({ total: 1 })), nativo: { ligado: true } }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => mocks.nativo.ligado, plataformaApp: () => "ios" }));
vi.mock("@/lib/analytics", () => ({ trackEvent: mocks.trackEvent }));
vi.mock("@/lib/notificacoes", () => ({ temPermissao: async () => true }));
vi.mock("@/lib/reagendar", () => ({
  lerDadosDosLembretes: (get: (k: string, fb: unknown) => unknown) => ({ gastos: get("finance-expenses", []) }),
  assinaturaDos: (dados: unknown) => JSON.stringify(dados),
  reagendarTudo: mocks.reagendarTudo,
}));
// os gráficos de verdade precisam de ResizeObserver/medida de texto (jsdom não tem): aqui só importa SE montam
vi.mock("recharts", () => {
  const Caixa = ({ children }: { children?: ReactNode }) => <div data-testid="recharts-montado">{children}</div>;
  const Nada = () => null;
  return { ResponsiveContainer: Caixa, PieChart: Caixa, BarChart: Caixa, AreaChart: Caixa, Pie: Caixa, Cell: Nada, Bar: Nada, Area: Nada, XAxis: Nada, YAxis: Nada, Tooltip: Nada, Legend: Nada };
});

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useLembretes } from "@/hooks/use-lembretes";
import { ConviteAvaliacao } from "@/components/avaliacao/ConviteAvaliacao";
import { GraficoCategorias, GraficoReceitasDespesas } from "@/components/finance/DashboardGraficos";

afterEach(() => { cleanup(); mocks.reagendarTudo.mockClear(); mocks.trackEvent.mockClear(); });

const contexto = (extra: Partial<UserDataContextType> = {}): UserDataContextType => ({
  get: <T,>(_k: string, fb: T) => fb, set: vi.fn(), loaded: true, isGuest: false, fetchKey: vi.fn(async () => null), ...extra,
});
const fingirSegundoPlano = () => {
  const vis = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  delete (document as unknown as Record<string, unknown>).visibilityState;
  if (vis) Object.defineProperty(Document.prototype, "visibilityState", vis);
};

describe("usePersistedState: a chave que não está na conta não vira um pedido por chave", () => {
  it("com o app na tela desde a leitura da conta, chave ausente NÃO busca no servidor; depois do 2º plano, busca como antes", () => {
    const fetchKey = vi.fn(async () => null);
    const Chave = ({ k }: { k: string }) => { usePersistedState(k, [] as unknown[]); return null; };
    render(<UserDataContext.Provider value={contexto({ fetchKey })}><Chave k="finance-notes" /><Chave k="finance-goals" /></UserDataContext.Provider>);
    // conta nova abrindo Finanças: eram 26 pedidos assim, todos voltando vazios
    expect(fetchKey).not.toHaveBeenCalled();
    cleanup();
    // foi pro 2º plano: outro aparelho pode ter criado a chave nesse meio-tempo → a rede de segurança volta
    fingirSegundoPlano();
    render(<UserDataContext.Provider value={contexto({ fetchKey })}><Chave k="finance-wishlist" /></UserDataContext.Provider>);
    expect(fetchKey).toHaveBeenCalledWith("finance-wishlist");
  });
});

describe("ConviteAvaliacao: a folha fechada não monta o Drawer", () => {
  it("nunca aberta: nada do vaul (nem o ouvinte de rolagem); abre normal na 1ª vez e reabre depois de fechar", () => {
    const ouvintes = vi.spyOn(window, "addEventListener");
    const gasto = { id: "g1", descricao: "Mercado", valor: 250, categoria: "Alimentação" };
    const { rerender } = render(<ConviteAvaliacao gasto={null} pagante onFechar={() => undefined} />);
    expect(ouvintes.mock.calls.filter(([tipo]) => tipo === "scroll")).toHaveLength(0);
    rerender(<ConviteAvaliacao gasto={gasto} pagante onFechar={() => undefined} />);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(mocks.trackEvent).toHaveBeenCalledWith("app_avaliacao_convite", expect.objectContaining({ acao: "visto" }));
    rerender(<ConviteAvaliacao gasto={null} pagante onFechar={() => undefined} />);
    rerender(<ConviteAvaliacao gasto={{ ...gasto, id: "g2", descricao: "Farmácia" }} pagante onFechar={() => undefined} />);
    expect(screen.getByText("Farmácia")).toBeInTheDocument();
    ouvintes.mockRestore();
  });
});

describe("gráficos do Dashboard: só montam perto da tela", () => {
  it("longe da tela: a MESMA caixa (largura/altura de sempre), sem a recharts; chegando perto, monta", () => {
    const original = window.IntersectionObserver;
    let avisar: ((perto: boolean) => void) | null = null;
    class IOControlado {
      private cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
      observe(alvo: Element) { avisar = (perto) => this.cb([{ isIntersecting: perto, target: alvo } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      unobserve() {}
      disconnect() { avisar = null; }
      takeRecords() { return []; }
    }
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IOControlado;
    try {
      const { container } = render(<div><GraficoCategorias dados={[{ name: "Mercado", value: 10 }]} cores={["#f00"]} /><GraficoReceitasDespesas dados={[{ month: "out", Receitas: 1, Despesas: 1 }]} corReceita="#0f0" corDespesa="#f00" /></div>);
      expect(screen.queryByTestId("recharts-montado")).toBeNull();
      const caixas = container.querySelectorAll<HTMLElement>("[data-grafico-espera]");
      expect(caixas).toHaveLength(2);
      expect([caixas[0].style.width, caixas[0].style.height]).toEqual(["50%", "180px"]);
      expect([caixas[1].style.width, caixas[1].style.height]).toEqual(["100%", "180px"]);
      act(() => avisar?.(false));
      expect(screen.queryByTestId("recharts-montado")).toBeNull();
      act(() => avisar?.(true)); // a última observada (o 2º gráfico) chegou perto
      expect(screen.getAllByTestId("recharts-montado").length).toBeGreaterThan(0);
    } finally {
      (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = original;
    }
  });
});

describe("useLembretes: fora do caminho do toque", () => {
  /** um provider de mentira cujo `get` troca a cada escrita, como o de verdade */
  let escrever: (v: unknown) => void = () => {};
  const Conta = ({ children }: { children: ReactNode }) => {
    const [gastos, setGastos] = useState<unknown>([]);
    escrever = setGastos;
    const get = <T,>(k: string, fb: T) => (k === "finance-expenses" ? (gastos as T) : fb);
    return <UserDataContext.Provider value={contexto({ get })}>{children}</UserDataContext.Provider>;
  };
  const Lembretes = () => { useLembretes(); return null; };
  // relógio de verdade: o reagendamento passa por import() dinâmico, que o relógio falso não anda
  const dormir = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  const chamadas = () => mocks.reagendarTudo.mock.calls.length;

  it("junta a rajada de escritas numa rodada só, depois da última — e a escrita contínua não adia pra sempre (teto de 3 s)", async () => {
    render(<Conta><Lembretes /></Conta>);
    await dormir(300);
    expect(chamadas()).toBe(0); // a abertura não disputa a 1ª pintura da Home
    await waitFor(() => expect(chamadas()).toBe(1), { timeout: 2000 });
    // 4 toques seguidos (um a cada 200 ms): nada no meio da rajada…
    for (let i = 1; i <= 4; i++) { act(() => escrever([{ id: i }])); await dormir(200); }
    expect(chamadas()).toBe(1);
    // …e UMA rodada depois do último
    await waitFor(() => expect(chamadas()).toBe(2), { timeout: 2000 });
    await dormir(1000);
    expect(chamadas()).toBe(2);
    // escrita a cada 400 ms por 3,6 s: o teto garante pelo menos uma rodada no meio
    for (let i = 10; i < 19; i++) { act(() => escrever([{ id: i }])); await dormir(400); }
    expect(chamadas()).toBeGreaterThanOrEqual(3);
  }, 15_000);

  it("indo pro 2º plano com escrita pendente: reagenda na hora", async () => {
    render(<Conta><Lembretes /></Conta>);
    await waitFor(() => expect(chamadas()).toBe(1), { timeout: 2000 });
    act(() => escrever([{ id: "x" }]));
    await dormir(50);
    act(() => fingirSegundoPlano());
    await waitFor(() => expect(chamadas()).toBe(2), { timeout: 400 }); // bem antes dos 800 ms da espera
  });
});
