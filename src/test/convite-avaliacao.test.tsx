/**
 * CONVITE DE AVALIAÇÃO NO PRIMEIRO GASTO (02/09).
 *
 * Contexto: 27–29/08 o pedido no fim do funil rendeu 63 avaliações em 3 dias
 * (4,9★) e foi morto em 28/08 por uma leitura atrasada do Console ("~1
 * avaliação"). O volume volta por aqui — no primeiro gasto, uma vez por
 * aparelho, com uma folha nossa antes da caixa do Google. Cada bloco trava
 * uma regra que, quebrada, ou repete o erro do funil ou fere a diretriz do
 * In-App Review.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn(), requestReview: vi.fn(async () => {}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => true }));
vi.mock("@/lib/analytics", () => ({ trackEvent: mocks.trackEvent }));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: { requestReview: mocks.requestReview } }));

import { reservarConvitePrimeiroGasto, reservarConviteDoFunil, jaLancouGastoAntes, podePedirAvaliacao } from "@/lib/avaliacao";
import { ExpenseTable } from "@/components/ExpenseTable";
import { ConviteAvaliacao } from "@/components/avaliacao/ConviteAvaliacao";

const UID = "novato";
const k = (logico: string) => `u:${UID}:${logico}`;
const seed = (logico: string, v: unknown) => localStorage.setItem(k(logico), JSON.stringify(v));

beforeEach(() => {
  localStorage.clear();
  mocks.trackEvent.mockClear();
  mocks.requestReview.mockClear();
  window.history.replaceState({}, "", "/financas");
});

/* ============================================================
 * QUEM MERECE A FOLHA — reservarConvitePrimeiroGasto
 * ============================================================ */
describe("reservarConvitePrimeiroGasto", () => {
  it("conta nova, aparelho nunca perguntado, nenhum gasto: SIM — e só UMA vez por aparelho", () => {
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(true);
    expect(reservarConvitePrimeiroGasto(UID, "g2")).toBe(false);
  });

  it("o gasto recém-salvo já no disco não conta como 'anterior'", () => {
    seed("finance-expenses", [{ id: "g1", value: 10 }]);
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(true);
  });

  it("quem tem gasto em mês ARQUIVADO (histórico hidratado de outro aparelho) não é novato", () => {
    seed("finance-2026-agosto-expenses", [{ id: "a1", value: 10 }]);
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(false);
  });

  it("custo fixo cadastrado também é uso anterior; e o gasto do perfil PJ não escapa", () => {
    seed("finance-fixed-expenses", [{ id: "f1", value: 10 }]);
    expect(jaLancouGastoAntes(UID, "g1")).toBe(true);
    localStorage.clear();
    seed("finance-expenses", [{ id: "pj1", value: 10, perfil: "pj" }, { id: "g1", value: 5 }]);
    expect(jaLancouGastoAntes(UID, "g1")).toBe(true);
  });

  it("lista vazia salva não é gasto — e chave de outra pessoa não conta", () => {
    seed("finance-expenses", []);
    seed("finance-2026-julho-expenses", []);
    localStorage.setItem("u:outra-pessoa:finance-expenses", JSON.stringify([{ id: "z", value: 1 }]));
    expect(jaLancouGastoAntes(UID)).toBe(false);
  });

  it("sem conta logada, nunca", () => {
    expect(reservarConvitePrimeiroGasto(null, "g1")).toBe(false);
  });

  it("na DEMO (/preview) nunca — o erro do funil não volta pela porta dos fundos", () => {
    window.history.replaceState({}, "", "/preview/financas");
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(false);
  });

  it("respeita as travas de sempre: 90 dias entre pedidos e 3 na vida", () => {
    localStorage.setItem("core-avaliacao-ultima", String(Date.now() - 10 * 86_400_000));
    expect(podePedirAvaliacao()).toBe(false);
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(false);
    localStorage.clear();
    localStorage.setItem("core-avaliacao-total", "3");
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(false);
  });

  it("reservar NÃO gasta a janela de 90 dias — só o toque em 'Deixar minha nota' gasta", () => {
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(true);
    expect(localStorage.getItem("core-avaliacao-ultima")).toBeNull();
    expect(podePedirAvaliacao()).toBe(true);
  });
});

/* ============================================================
 * A TABELA AVISA O PRIMEIRO LANÇAMENTO — ExpenseTable
 * ============================================================ */
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
const renderComStore = (ui: React.ReactElement) =>
  render(<UserDataContext.Provider value={criarStore().valor}>{ui}</UserDataContext.Provider>);

const lancar = (container: HTMLElement, descricao: string, valor: string) => {
  fireEvent.change(screen.getByPlaceholderText("+ Novo gasto"), { target: { value: descricao } });
  fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: valor } });
  const botao = container.querySelector("svg.lucide-plus")?.closest("button");
  expect(botao).toBeTruthy();
  fireEvent.click(botao!);
};

describe("ExpenseTable — onPrimeiroGasto", () => {
  it("lista VAZIA → salva e avisa, com o gasto no vocabulário da folha e o MESMO id", () => {
    const avisar = vi.fn();
    const salvar = vi.fn();
    const { container } = renderComStore(<ExpenseTable expenses={[]} setExpenses={salvar} onPrimeiroGasto={avisar} />);
    lancar(container, "Mercado", "250");
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(avisar).toHaveBeenCalledTimes(1);
    const g = avisar.mock.calls[0][0];
    expect(g).toMatchObject({ descricao: "Mercado", valor: 250 });
    expect(g.categoria).toMatch(/outros/i);
    expect(g.id).toBe(salvar.mock.calls[0][0][0].id);
  });

  it("lista com gasto → salva normal e NÃO avisa", () => {
    const avisar = vi.fn();
    const salvar = vi.fn();
    const existente = [{ id: "x", description: "Luz", category: "outros", value: 1, date: "2026-09-01", paymentMethod: "pix" }];
    const { container } = renderComStore(<ExpenseTable expenses={existente} setExpenses={salvar} onPrimeiroGasto={avisar} />);
    lancar(container, "Água", "80");
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(avisar).not.toHaveBeenCalled();
  });
});

/* ============================================================
 * A FOLHA — ConviteAvaliacao
 * ============================================================ */
describe("ConviteAvaliacao", () => {
  const gasto = { id: "g1", descricao: "Mercado", valor: 250, categoria: "Alimentação" };

  it("mostra o gasto, o porquê, e o toque FECHA a folha antes de chamar a caixa do Google", async () => {
    vi.useFakeTimers();
    try {
      const fechar = vi.fn();
      render(<ConviteAvaliacao gasto={gasto} pagante onFechar={fechar} />);
      expect(screen.getByText("Mercado")).toBeInTheDocument();
      expect(screen.getByText("Alimentação")).toBeInTheDocument();
      expect(screen.getByText(/R\$\s?250,00/)).toBeInTheDocument();
      // Diretriz do In-App Review: nenhuma pergunta, nenhuma previsão de nota.
      expect(document.body.textContent).not.toMatch(/\?|estrelas|gostando/i);
      expect(mocks.trackEvent).toHaveBeenCalledWith("app_avaliacao_convite", expect.objectContaining({ motivo: "primeiro_gasto", acao: "visto" }));

      fireEvent.click(screen.getByRole("button", { name: /Deixar minha nota/ }));
      expect(fechar).toHaveBeenCalledTimes(1);
      expect(mocks.requestReview).not.toHaveBeenCalled(); // ainda não — a folha precisa sair da tela
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.requestReview).toHaveBeenCalledTimes(1);
      expect(mocks.trackEvent).toHaveBeenCalledWith("app_avaliacao_pedida", expect.objectContaining({ motivo: "primeiro_gasto", pagante: true }));
      // agora sim a janela de 90 dias foi gasta
      expect(localStorage.getItem("core-avaliacao-ultima")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fechada e reaberta com outro gasto, a folha volta (e conta um 'visto' novo)", () => {
    const fechar = vi.fn();
    const { rerender } = render(<ConviteAvaliacao gasto={gasto} pagante onFechar={fechar} />);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    rerender(<ConviteAvaliacao gasto={null} pagante onFechar={fechar} />);
    rerender(<ConviteAvaliacao gasto={{ ...gasto, id: "g2", descricao: "Farmácia" }} pagante onFechar={fechar} />);
    expect(screen.getByText("Farmácia")).toBeInTheDocument();
    expect(mocks.trackEvent.mock.calls.filter(([n, d]) => n === "app_avaliacao_convite" && (d as { acao: string }).acao === "visto")).toHaveLength(2);
  });

  it("'Agora não' fecha sem gastar a cota e sem chamar o Google", () => {
    const fechar = vi.fn();
    render(<ConviteAvaliacao gasto={gasto} pagante={false} onFechar={fechar} />);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(fechar).toHaveBeenCalledTimes(1);
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(localStorage.getItem("core-avaliacao-ultima")).toBeNull();
    expect(mocks.trackEvent).toHaveBeenCalledWith("app_avaliacao_convite", expect.objectContaining({ acao: "recusou" }));
  });
});

/* ============================================================
 * O CONVITE DO FUNIL — reservarConviteDoFunil (03/09)
 * O gatilho que colheu 63 avaliações em 3 dias volta, agora com a folha na
 * frente: quem recusa não gasta a janela de 90 dias do aparelho.
 * ============================================================ */
describe("reservarConviteDoFunil", () => {
  it("uma vez por aparelho — e sem conta logada também vale (o funil vem antes do cadastro)", () => {
    expect(reservarConviteDoFunil()).toBe(true);
    expect(reservarConviteDoFunil()).toBe(false);
  });

  it("reservar NÃO gasta a cota do Google: só o toque na folha gasta", () => {
    expect(reservarConviteDoFunil()).toBe(true);
    expect(localStorage.getItem("core-avaliacao-ultima")).toBeNull();
    expect(podePedirAvaliacao()).toBe(true);
  });

  it("na DEMO (/preview) nunca — a folha não entra por rota de vitrine", () => {
    window.history.replaceState({}, "", "/preview/financas");
    expect(reservarConviteDoFunil()).toBe(false);
  });

  it("dois convites não se atropelam: quem viu o do funil não vê o do 1º gasto na mesma semana", () => {
    expect(reservarConviteDoFunil()).toBe(true);
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(false);
    // passada a espera de 7 dias, o momento de valor volta a valer
    localStorage.setItem("core-avaliacao-convite-em", String(Date.now() - 8 * 24 * 3600_000));
    expect(reservarConvitePrimeiroGasto(UID, "g1")).toBe(true);
  });

  it("respeita as travas de sempre (90 dias entre pedidos)", () => {
    localStorage.setItem("core-avaliacao-ultima", String(Date.now()));
    expect(reservarConviteDoFunil()).toBe(false);
  });
});

describe("ConviteAvaliacao — variante do plano pronto", () => {
  const plano = { emoji: "\u{1F4B0}", nome: "Dinheiro" };

  it("mostra o plano da área, respeita a diretriz e pede com o motivo plano_pronto", async () => {
    vi.useFakeTimers();
    try {
      const fechar = vi.fn();
      render(<ConviteAvaliacao plano={plano} pagante={false} onFechar={fechar} />);
      expect(screen.getByText("Seu plano de Dinheiro")).toBeInTheDocument();
      expect(screen.getByText("16 módulos liberados")).toBeInTheDocument();
      // nenhuma pergunta, nenhuma previsão de nota, nenhum seletor nosso
      expect(document.body.textContent).not.toMatch(/\?|estrelas|gostando/i);
      expect(mocks.trackEvent).toHaveBeenCalledWith("app_avaliacao_convite", expect.objectContaining({ motivo: "plano_pronto", acao: "visto" }));

      fireEvent.click(screen.getByRole("button", { name: /Deixar minha nota/ }));
      expect(fechar).toHaveBeenCalledTimes(1);
      expect(mocks.requestReview).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.trackEvent).toHaveBeenCalledWith("app_avaliacao_pedida", expect.objectContaining({ motivo: "plano_pronto" }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("'Agora não' no funil não gasta a janela de 90 dias — era a objeção que matou o gatilho", () => {
    const fechar = vi.fn();
    render(<ConviteAvaliacao plano={plano} pagante={false} onFechar={fechar} />);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(localStorage.getItem("core-avaliacao-ultima")).toBeNull();
    expect(podePedirAvaliacao()).toBe(true);
  });
});
