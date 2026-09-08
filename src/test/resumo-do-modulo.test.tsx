/**
 * Resumo do módulo — avaliação 5★ da Play (07/09): "Cada aba poderia ser
 * igual a de finanças, você entrar e ja ter um resumo do que tem para fazer".
 *
 * Três travas: o componente em si (tiles, estado vazio, toque troca a aba),
 * e duas páginas reais montadas com as seeds da demo (Rotina e Dieta) — é a
 * mesma montagem do /preview/<modulo>, então se o resumo quebrar a demo do
 * funil, quebra aqui primeiro.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { ResumoDoModulo, valorVazio, diasAte, rotuloEmDias } from "@/components/ui/resumo-do-modulo";
import { localDayKey } from "@/lib/utils";
import Rotina from "@/pages/Rotina";
import Dieta from "@/pages/Dieta";
import Casa from "@/pages/Casa";

// As páginas puxam auth e telemetria; aqui não há sessão nem rede.
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

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

const montarDemo = (moduleKey: string, ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <PreviewUserDataProvider moduleKey={moduleKey}>{ui}</PreviewUserDataProvider>
    </MemoryRouter>,
  );

const resumo = () => screen.getByTestId("resumo-do-modulo");

describe("ResumoDoModulo — o componente", () => {
  it("renderiza os tiles com rótulo, valor e sub-texto", () => {
    render(
      <ResumoDoModulo
        itens={[
          { rotulo: "Hábitos hoje", valor: "3/6", tom: "atencao" },
          { rotulo: "Tarefas", valor: 2, sub: "pendentes" },
          { rotulo: "Sequência", valor: "12 dias", tom: "ok" },
        ]}
      />,
    );
    const barra = resumo();
    expect(barra).not.toHaveAttribute("data-vazio");
    expect(within(barra).getByText("Hábitos hoje")).toBeInTheDocument();
    expect(within(barra).getByText("3/6")).toBeInTheDocument();
    expect(within(barra).getByText("2")).toBeInTheDocument();
    expect(within(barra).getByText("pendentes")).toBeInTheDocument();
    expect(within(barra).getByText("12 dias")).toHaveClass("text-green-500");
    // sem onClick, tile não vira botão
    expect(within(barra).queryAllByRole("button")).toHaveLength(0);
  });

  it("tudo zero/indefinido vira UMA linha de convite — nunca barra de zeros", () => {
    render(
      <ResumoDoModulo
        vazio="Comece cadastrando um hábito"
        itens={[
          { rotulo: "Hábitos", valor: null },
          { rotulo: "Tarefas", valor: 0 },
          { rotulo: "Sequência", valor: "" },
          { rotulo: "Fases", valor: undefined },
        ]}
      />,
    );
    const barra = resumo();
    expect(barra).toHaveAttribute("data-vazio", "true");
    expect(barra).toHaveTextContent("Comece cadastrando um hábito");
    expect(within(barra).queryByText("Hábitos")).not.toBeInTheDocument();
    expect(within(barra).queryByText("0")).not.toBeInTheDocument();
  });

  it("esconde só os tiles vazios quando há pelo menos um com número", () => {
    render(<ResumoDoModulo itens={[{ rotulo: "Água", valor: "2/8" }, { rotulo: "Remédios", valor: null }]} />);
    const barra = resumo();
    expect(within(barra).getByText("2/8")).toBeInTheDocument();
    expect(within(barra).queryByText("Remédios")).not.toBeInTheDocument();
  });

  it("toque no tile chama o onClick (troca de aba)", () => {
    const irParaFoco = vi.fn();
    render(<ResumoDoModulo itens={[{ rotulo: "Tarefas", valor: 3, sub: "pendentes", onClick: irParaFoco }]} />);
    fireEvent.click(within(resumo()).getByRole("button", { name: /Tarefas/ }));
    expect(irParaFoco).toHaveBeenCalledTimes(1);
  });

  it("helpers: '0/6' NÃO é vazio (é lista por fazer); dias e rótulo", () => {
    expect(valorVazio("0/6")).toBe(false);
    expect(valorVazio(0)).toBe(true);
    expect(valorVazio("0")).toBe(true);
    expect(valorVazio(null)).toBe(true);
    expect(diasAte(localDayKey())).toBe(0);
    expect(diasAte("lixo")).toBeNaN();
    expect(rotuloEmDias(0)).toBe("Hoje");
    expect(rotuloEmDias(1)).toBe("Amanhã");
    expect(rotuloEmDias(5)).toBe("em 5 dias");
  });
});

describe("Rotina com as seeds da demo", () => {
  it("abre com o resumo: hábitos de hoje, tarefas pendentes e sequência", () => {
    montarDemo("rotina", <Rotina />);
    const barra = resumo();
    // 6 hábitos na seed, semana não carimbada → nada feito ainda hoje = 0/6
    expect(within(barra).getByText("0/6")).toBeInTheDocument();
    // todo-list: 2 abertas + 1 urgência = 3 pendentes
    expect(within(barra).getByText("3")).toBeInTheDocument();
    expect(within(barra).getByText("pendentes")).toBeInTheDocument();
    // heatmap de 41 dias → sequência viva
    expect(within(barra).getByText(/\d+ dias/)).toBeInTheDocument();
    // os alvos da demo guiada continuam no lugar
    expect(document.querySelector('[data-spotlight="add-habit"]')).not.toBeNull();
    expect(document.querySelector('[data-spotlight="tab-mes"]')).not.toBeNull();
  });

  it("tocar em TAREFAS leva pra aba FOCO", () => {
    montarDemo("rotina", <Rotina />);
    expect(document.querySelector('[data-spotlight="tab-foco"]')).toHaveAttribute("data-active", "false");
    fireEvent.click(within(resumo()).getByRole("button", { name: /Tarefas/ }));
    expect(document.querySelector('[data-spotlight="tab-foco"]')).toHaveAttribute("data-active", "true");
    // a lista de tarefas da aba FOCO está na tela, com a tarefa da seed
    expect(screen.getByText("Pagar boleto da luz")).toBeInTheDocument();
  });
});

describe("Dieta com as seeds da demo", () => {
  it("abre com as refeições de hoje por seguir e o toque leva pro DIÁRIO", () => {
    montarDemo("dieta", <Dieta />);
    const barra = resumo();
    // 5 refeições configuradas, diário ainda vazio hoje
    expect(within(barra).getByText("0/5")).toBeInTheDocument();
    expect(within(barra).getByText("refeições seguidas")).toBeInTheDocument();
    expect(document.querySelector('[data-spotlight="first-day"]')).not.toBeNull();
    fireEvent.click(within(barra).getByRole("button", { name: /Hoje/ }));
    expect(screen.getByText(/REFEIÇÕES QUE VOCÊ SEGUIU/)).toBeInTheDocument();
  });
});

describe("Módulo sem dado nenhum", () => {
  it("Casa vazia mostra a linha de convite, não uma barra de zeros", () => {
    const store = criarStore();
    render(
      <MemoryRouter>
        <UserDataContext.Provider value={store.valor}><Casa /></UserDataContext.Provider>
      </MemoryRouter>,
    );
    const barra = resumo();
    expect(barra).toHaveAttribute("data-vazio", "true");
    expect(barra).toHaveTextContent("Nada pendente na casa hoje");
  });
});
