/**
 * COMPARAÇÃO ANUAL (09/09) — card separado no Dashboard, embaixo da mensal.
 *
 * Ontem o pedido do cliente ("comparação entre os anos como no mensal") virou
 * uma linha no Balanço Anual porque o dono não queria tela nova; hoje ele
 * decidiu o contrário. Cada bloco abaixo é uma regra do card: totais somados
 * mês a mês pelas chaves do ano, "mesmo período" cortando no mês de agora,
 * categoria que mais mudou primeiro, ano vazio dito em palavras, perfil PF/PJ
 * trocando os números sem remontar, e a demo (PreviewUserDataProvider), que
 * lê de um store em memória e não do localStorage.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import {
  YearComparison, totaisDoAno, mesesComparados, ordenarPorDiferenca, anosDaLista,
} from "@/components/finance/YearComparison";
import { PERFIL_PESSOAL, PERFIL_TODOS } from "@/lib/finance-perfil";

const UID = "uid-comparacao-anual";

// O card lê localStorage pelo id do usuário; aqui não há sessão. `usuario`
// é mutável pra que o bloco da demo rode SEM usuário (é assim que o
// storage-keys cai no espelho __PREVIEW_SEEDS__).
let usuario: { id: string } | null = { id: UID };
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: usuario, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));

// Seeds da demo: o arquivo real está sendo editado por outra sessão e a
// demo não precisa de nada além do que este teste semeia.
const SEEDS_DEMO: Record<string, unknown> = {
  "finance-2025-janeiro-incomes": [{ id: "s1", value: 3000 }],
  "finance-2025-janeiro-expenses": [{ id: "s2", value: 800, category: "mercado" }],
  "finance-incomes": [{ id: "s3", value: 4500 }],
  "finance-expenses": [{ id: "s4", value: 1200, category: "mercado" }],
};
vi.mock("@/lib/preview-seeds", () => ({ getSeedsForModule: () => ({ ...SEEDS_DEMO }) }));

/* Radix Select no jsdom: abre por TECLADO (ArrowDown) e a opção seleciona
   no click. Faltam scrollIntoView, pointer capture e ResizeObserver. */
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

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

const envolver = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  <UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>;

const renderComStore = (ui: React.ReactElement, store = criarStore()) => render(envolver(ui, store));

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const chaveArquivada = (ano: number, mes: string, sufixo: string) => `u:${UID}:finance-${ano}-${mes}-${sufixo}`;
const gravarLocal = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

/** 2025 inteiro arquivado + 2026 de janeiro a agosto arquivado e setembro vivo. */
const semearDoisAnos = () => {
  for (const mes of MESES) {
    gravarLocal(chaveArquivada(2025, mes, "incomes"), [{ id: `r-${mes}`, value: 1000 }]);
    gravarLocal(chaveArquivada(2025, mes, "expenses"), [{ id: `d-${mes}`, value: 100, category: "lazer" }]);
  }
  for (const mes of MESES.slice(0, 8)) {
    gravarLocal(chaveArquivada(2026, mes, "incomes"), [{ id: `r26-${mes}`, value: 2000 }]);
    gravarLocal(chaveArquivada(2026, mes, "expenses"), [{ id: `d26-${mes}`, value: 300, category: "lazer" }]);
  }
  // setembro de 2026 = o mês corrente, nas chaves vivas
  gravarLocal(`u:${UID}:finance-incomes`, [{ id: "r26-set", value: 2000 }]);
  gravarLocal(`u:${UID}:finance-expenses`, [{ id: "d26-set", value: 300, category: "lazer" }]);
};

const resumo = () => within(screen.getByTestId("resumo-anos"));
/** Os três números de um ano, como texto — receita e saldo coincidem sem despesa. */
const linha = (ano: number) => ["receitas", "despesas", "saldo"].map((c) => screen.getByTestId(`${c}-${ano}`).textContent);
const toggle = () => screen.getByRole("switch", { name: "Mesmo período" });
const escolherAno = async (seletor: string, ano: number) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name: seletor }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: String(ano) }));
};

beforeEach(() => {
  localStorage.clear();
  usuario = { id: UID };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 9)); // 09/09/2026, o dia da decisão
});
afterEach(() => vi.useRealTimers());

/* ============================================================
 * Totais 2025 × 2026 a partir das chaves finance-{ano}-*
 * ============================================================ */
describe("Totais do ano", () => {
  it("soma os 12 meses das chaves finance-2025-* e junta o mês vivo de 2026 aos arquivados", () => {
    semearDoisAnos();
    const t25 = totaisDoAno(2025, UID, PERFIL_PESSOAL);
    expect(t25).toMatchObject({ receitas: 12000, despesas: 1200, saldo: 10800, temLancamento: true });
    expect(t25.categorias).toEqual({ lazer: 1200 });
    // 2026: 8 arquivados + setembro vivo = 9 meses
    expect(totaisDoAno(2026, UID, PERFIL_PESSOAL)).toMatchObject({ receitas: 18000, despesas: 2700, saldo: 15300 });
    // ano sem chave alguma
    expect(totaisDoAno(2024, UID, PERFIL_PESSOAL)).toMatchObject({ receitas: 0, despesas: 0, temLancamento: false, categorias: {} });
  });

  it("no card, o padrão é ano anterior × corrente, com os números de cada ano na SUA linha", () => {
    semearDoisAnos();
    renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />);
    expect(screen.getByRole("combobox", { name: "Primeiro ano" }).textContent).toBe("2025");
    expect(screen.getByRole("combobox", { name: "Segundo ano" }).textContent).toBe("2026");
    // mesmo período (jan–set) ligado por padrão: 9 × 1.000 e 9 × 2.000
    expect(resumo().getByText("R$ 9.000")).toBeInTheDocument();
    expect(resumo().getByText("R$ 900")).toBeInTheDocument();
    expect(resumo().getByText("R$ 8.100")).toBeInTheDocument();
    expect(resumo().getByText("R$ 18.000")).toBeInTheDocument();
    expect(resumo().getByText("R$ 2.700")).toBeInTheDocument();
    expect(resumo().getByText("R$ 15.300")).toBeInTheDocument();
    // receita dobrou (bom, verde); despesa triplicou (ruim, vermelho)
    expect(resumo().getByText("+100%")).toHaveClass("text-green-400");
    expect(resumo().getByText("+200%")).toHaveClass("text-red-400");
  });

  it("a lista vai do ano corrente até 2015, do mais novo pro mais velho", () => {
    expect(anosDaLista(2026)[0]).toBe(2026);
    expect(anosDaLista(2026)[anosDaLista(2026).length - 1]).toBe(2015);
    expect(anosDaLista(2026)).toHaveLength(12);
  });
});

/* ============================================================
 * "mesmo período": jan até o mês de agora, nos dois anos
 * ============================================================ */
describe("Mesmo período", () => {
  it("corta nos meses certos: 9 em setembro quando um dos anos é o corrente; 12 fora disso", () => {
    const set = new Date(2026, 8, 9);
    expect(mesesComparados(2025, 2026, true, set)).toBe(9);
    expect(mesesComparados(2026, 2025, true, set)).toBe(9);
    expect(mesesComparados(2025, 2026, false, set)).toBe(12);
    expect(mesesComparados(2024, 2025, true, set)).toBe(12); // nenhum é o corrente
    expect(mesesComparados(2025, 2026, true, new Date(2026, 0, 15))).toBe(1); // janeiro
    expect(totaisDoAno(2025, UID, PERFIL_PESSOAL, 9).receitas).toBe(0); // sem seed, só checa que não explode
  });

  it("desligar o toggle abre 2025 pro ano inteiro (12.000) e 2026 continua nos 9 que existem", () => {
    semearDoisAnos();
    renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />);
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("rotulo-periodo").textContent).toBe("(jan–set)");
    expect(resumo().getByText("R$ 9.000")).toBeInTheDocument();

    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("rotulo-periodo")).not.toBeInTheDocument();
    expect(resumo().getByText("R$ 12.000")).toBeInTheDocument();
    expect(resumo().getByText("R$ 1.200")).toBeInTheDocument();
    expect(resumo().getByText("R$ 18.000")).toBeInTheDocument();
    // 18.000 contra 12.000 = +50%, não os +100% de antes
    expect(resumo().getByText("+50%")).toBeInTheDocument();
  });

  it("trocar pra 2024 × 2025 esconde o toggle (nada a cortar) e lê o ano escolhido inteiro", async () => {
    semearDoisAnos();
    gravarLocal(chaveArquivada(2024, "dezembro", "incomes"), [{ id: "x", value: 700 }]);
    renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />);

    await escolherAno("Primeiro ano", 2024);
    await escolherAno("Segundo ano", 2025);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(linha(2024)).toEqual(["R$ 700", "R$ 0", "R$ 700"]);
    expect(linha(2025)).toEqual(["R$ 12.000", "R$ 1.200", "R$ 10.800"]); // 2025 inteiro, dezembro incluído
  });
});

/* ============================================================
 * Categorias: a que mais mudou primeiro; 12 linhas e "ver todas"
 * ============================================================ */
describe("Por categoria", () => {
  it("ordena pela maior diferença absoluta, não pelo maior gasto", () => {
    const linhas = ordenarPorDiferenca(
      { alimentacao: 5000, lazer: 100, transporte: 300 },
      { alimentacao: 5020, lazer: 900, transporte: 100 },
      (v) => v,
    );
    expect(linhas.map((l) => l.category)).toEqual(["lazer", "transporte", "alimentacao"]);
    expect(linhas[0]).toMatchObject({ label: "Lazer", anoA: 100, anoB: 900 });
  });

  it("no card: a maior diferença vem primeiro, e além de 12 categorias aparece 'ver todas'", () => {
    // 2025: alimentação enorme mas quase igual; lazer pequeno mas que explodiu
    gravarLocal(chaveArquivada(2025, "marco", "expenses"), [
      { id: "a", value: 5000, category: "alimentacao" },
      { id: "b", value: 100, category: "lazer" },
    ]);
    // 2026 (chaves vivas de setembro): 14 categorias distintas
    const catsExtras = ["mercado", "transporte", "saude", "farmacia", "vestuario", "beleza", "educacao", "eletronicos", "servicos", "delivery", "presente", "casa"];
    gravarLocal(`u:${UID}:finance-expenses`, [
      { id: "c", value: 5020, category: "alimentacao" },
      { id: "d", value: 900, category: "lazer" },
      // 30…41: todas mudaram mais que a alimentação (20), que fica em 14º
      ...catsExtras.map((category, i) => ({ id: `e${i}`, value: 30 + i, category })),
    ]);
    renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />);

    const rotulos = () => screen.getAllByTestId("categoria-linha").map((l) => within(l).getAllByText(/./)[0].textContent);
    expect(rotulos()[0]).toBe("Lazer");
    expect(screen.getAllByTestId("categoria-linha")).toHaveLength(12);
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument(); // diferença de 20: ficou de fora

    fireEvent.click(screen.getByRole("button", { name: "ver todas (14)" }));
    expect(screen.getAllByTestId("categoria-linha")).toHaveLength(14);
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ver menos" }));
    expect(screen.getAllByTestId("categoria-linha")).toHaveLength(12);
  });
});

/* ============================================================
 * Ano sem lançamento: a frase, não zeros
 * ============================================================ */
describe("Ano vazio", () => {
  it("só 2026 tem dado: 2025 vira 'Nenhum lançamento em 2025' e não há badge de variação", () => {
    gravarLocal(`u:${UID}:finance-incomes`, [{ id: "r", value: 2000 }]);
    renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />);
    expect(screen.getByTestId("sem-lancamento-2025").textContent).toBe("Nenhum lançamento em 2025");
    expect(linha(2026)).toEqual(["R$ 2.000", "R$ 0", "R$ 2.000"]);
    expect(screen.queryByTestId("receitas-2025")).not.toBeInTheDocument();
    expect(resumo().queryByText(/%/)).not.toBeInTheDocument();
  });

  it("nenhum dos dois tem dado: uma frase só, no lugar do card inteiro", () => {
    renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />);
    expect(screen.getByTestId("sem-lancamento-ambos").textContent).toBe("Nenhum lançamento em 2025 nem em 2026.");
    expect(screen.queryByTestId("resumo-anos")).not.toBeInTheDocument();
  });
});

/* ============================================================
 * Perfil PF/PJ: troca o chip, trocam os números — sem remontar
 * ============================================================ */
describe("Perfil", () => {
  it("pessoal, empresa e Tudo junto leem lançamentos diferentes das mesmas chaves", () => {
    gravarLocal(chaveArquivada(2025, "janeiro", "incomes"), [{ id: "1", value: 1000 }, { id: "2", value: 20000, perfil: "acme" }]);
    gravarLocal(chaveArquivada(2025, "janeiro", "expenses"), [{ id: "3", value: 300, perfil: "acme", category: "servicos" }]);
    gravarLocal(`u:${UID}:finance-incomes`, [{ id: "4", value: 500 }]);
    const store = criarStore();

    const tela = renderComStore(<YearComparison perfil={PERFIL_PESSOAL} />, store);
    expect(linha(2025)).toEqual(["R$ 1.000", "R$ 0", "R$ 1.000"]);
    expect(linha(2026)).toEqual(["R$ 500", "R$ 0", "R$ 500"]);
    expect(screen.queryByText("Serviços")).not.toBeInTheDocument();

    tela.rerender(envolver(<YearComparison perfil="acme" />, store));
    expect(linha(2025)).toEqual(["R$ 20.000", "R$ 300", "R$ 19.700"]);
    expect(screen.getByText("Serviços")).toBeInTheDocument();
    // 2026 não tem nada da empresa
    expect(screen.getByTestId("sem-lancamento-2026")).toBeInTheDocument();

    tela.rerender(envolver(<YearComparison perfil={PERFIL_TODOS} />, store));
    expect(linha(2025)).toEqual(["R$ 21.000", "R$ 300", "R$ 20.700"]);
    expect(linha(2026)).toEqual(["R$ 500", "R$ 0", "R$ 500"]);
  });
});

/* ============================================================
 * Demo (/preview/financas): store em memória, sem usuário
 * ============================================================ */
describe("Demo com PreviewUserDataProvider", () => {
  it("lê as seeds pelo espelho __PREVIEW_SEEDS__ — sem isso o card nasceria vazio na demo", () => {
    usuario = null;
    render(
      <PreviewUserDataProvider moduleKey="financas">
        <YearComparison perfil={PERFIL_PESSOAL} />
      </PreviewUserDataProvider>,
    );
    expect(resumo().getByText("R$ 3.000")).toBeInTheDocument();
    expect(resumo().getByText("R$ 4.500")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.queryByTestId("sem-lancamento-ambos")).not.toBeInTheDocument();
  });
});
