import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { Outings } from "./Outings";
import { TravelBudget } from "./TravelBudget";
import { BucketList } from "./BucketList";
import { DailyTimeline } from "./DailyTimeline";
import { TripCountdown } from "./TripCountdown";
import { TravelDiary } from "./TravelDiary";
import { PlacesBoard } from "./PlacesBoard";
import { BillSplitter } from "./BillSplitter";
import { PackingChecklist } from "./PackingChecklist";
import { Outing, TravelTrip, TravelTripsStore } from "./types";

/**
 * Ciclo completo (regra da casa, 19/07): abrir → usar → SAIR → REABRIR.
 * Feature de UI que só foi testada "adicionando" já enganou antes — o buraco
 * aparece na reabertura, quando o dado tem que voltar da chave certa.
 *
 * O store aqui é um dicionário em memória no lugar do Supabase: exercita os
 * componentes de verdade (usePersistedState → useUserData) sem rede.
 */
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

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

describe("Passeios", () => {
  it("adiciona, soma no mês, EDITA e sobrevive a fechar/reabrir a aba", () => {
    const store = criarStore();
    const tela = renderComStore(<Outings />, store);

    // adicionar
    fireEvent.change(screen.getByPlaceholderText(/O que foi\?/i), { target: { value: "Cinema com a Ana" } });
    fireEvent.change(screen.getByPlaceholderText(/Custo R\$/i), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar passeio" }));

    expect(screen.getByText("Cinema com a Ana")).toBeInTheDocument();
    expect(screen.getAllByText(/45,00/).length).toBeGreaterThan(0); // total do mês

    // gravou na chave nova, com data em chave de dia LOCAL
    const salvos = store.dados["travel-outings"] as Outing[];
    expect(salvos).toHaveLength(1);
    expect(salvos[0].date).toBe(localDayKey());
    expect(salvos[0].cost).toBe(45);

    // editar (o pedido: "pra arrumar só apagando")
    fireEvent.click(screen.getByRole("button", { name: "Editar Cinema com a Ana" }));
    const campoNome = screen.getByDisplayValue("Cinema com a Ana");
    fireEvent.change(campoNome, { target: { value: "Cinema com a Ana e o Léo" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    expect(screen.getByText("Cinema com a Ana e o Léo")).toBeInTheDocument();
    expect((store.dados["travel-outings"] as Outing[])).toHaveLength(1); // editou, não duplicou

    // SAIR e REABRIR (troca de aba / app reaberto) — o dado tem que voltar
    tela.unmount();
    renderComStore(<Outings />, store);
    expect(screen.getByText("Cinema com a Ana e o Léo")).toBeInTheDocument();

    // excluir
    fireEvent.click(screen.getByRole("button", { name: "Apagar Cinema com a Ana e o Léo" }));
    expect(screen.queryByText("Cinema com a Ana e o Léo")).not.toBeInTheDocument();
    expect(store.dados["travel-outings"]).toHaveLength(0);
  });
});

/**
 * As 7 abas que só sabiam adicionar e excluir ("pra arrumar só apagando").
 * Cada caso faz o caminho inteiro: achar o lápis → trocar o texto → salvar →
 * conferir que virou UMA coisa editada, e não uma cópia nova.
 */
describe("Editar nas abas que não tinham", () => {
  const casos: { nome: string; ui: () => React.ReactElement; store: Record<string, unknown>; antes: () => void; rotuloEditar: string; valorAtual: string; novoValor: string; botaoSalvar: string }[] = [
    {
      nome: "Destinos",
      ui: () => <BucketList />,
      store: { "travel-bucket": [{ id: "d1", name: "Tóquio", country: "Japão", continent: "Ásia", notes: "", visited: false, rating: 0, photoUrl: "", priority: "sonho" }] },
      antes: () => {},
      rotuloEditar: "Editar Tóquio", valorAtual: "Tóquio", novoValor: "Tóquio + Kyoto", botaoSalvar: "Salvar",
    },
    {
      nome: "Roteiro (inclui a HORA)",
      ui: () => <DailyTimeline />,
      store: { "travel-timeline-v2": [{ id: "dia1", tripId: "", dayNumber: 1, date: localDayKey(), items: [{ id: "i1", time: "09:00", title: "Museu", location: "", mapsLink: "", estimatedCost: 0, type: "atividade", done: false, pinned: false }] }] },
      antes: () => {},
      rotuloEditar: "Editar Museu", valorAtual: "Museu", novoValor: "Museu Nacional", botaoSalvar: "Salvar",
    },
    {
      nome: "Timer",
      ui: () => <TripCountdown />,
      store: { "travel-countdowns": [{ id: "c1", tripName: "Chile", departureDate: "2027-01-10", photoUrl: "" }] },
      antes: () => {},
      rotuloEditar: "Editar Chile", valorAtual: "Chile", novoValor: "Chile com a família", botaoSalvar: "Salvar",
    },
    {
      nome: "Diário",
      ui: () => <TravelDiary />,
      store: { "travel-diary-v2": [{ id: "e1", tripName: "", date: localDayKey(), bestThing: "Pôr do sol", wouldNotDoAgain: "", photoUrl: "", mood: "🤩" }] },
      antes: () => {},
      rotuloEditar: "Editar entrada do diário", valorAtual: "Pôr do sol", novoValor: "Pôr do sol na praia", botaoSalvar: "Salvar",
    },
    {
      nome: "Lugares",
      ui: () => <PlacesBoard />,
      store: { "travel-places-v2": [{ id: "p1", name: "Caminito", category: "turistico", address: "", mapsLink: "", status: "quero_ir", notes: "", city: "Buenos Aires" }] },
      antes: () => {},
      rotuloEditar: "Editar Caminito", valorAtual: "Caminito", novoValor: "Caminito (La Boca)", botaoSalvar: "Salvar",
    },
    {
      nome: "Rachar",
      ui: () => <BillSplitter />,
      store: { "travel-bill-split": { tripName: "", people: ["Ana", "Léo"], entries: [{ id: "b1", description: "Jantar", amount: 100, paidBy: "Ana", splitBetween: ["Ana", "Léo"], date: localDayKey() }] } },
      antes: () => {},
      rotuloEditar: "Editar Jantar", valorAtual: "Jantar", novoValor: "Jantar de sábado", botaoSalvar: "Salvar",
    },
    {
      nome: "Mala",
      ui: () => <PackingChecklist />,
      store: { "travel-packing-v2": [{ id: "l1", tripName: "Praia", template: "custom", items: [{ id: "it1", name: "Protetor", packed: false, category: "Higiene" }] }] },
      // a lista precisa estar aberta pra ver os itens
      antes: () => fireEvent.click(screen.getByText("Praia")),
      rotuloEditar: "Editar Protetor", valorAtual: "Protetor", novoValor: "Protetor solar 50", botaoSalvar: "Salvar item",
    },
  ];

  casos.forEach(caso => {
    it(`${caso.nome}: edita sem precisar apagar`, () => {
      const store = criarStore(caso.store);
      renderComStore(caso.ui(), store);
      caso.antes();

      fireEvent.click(screen.getByRole("button", { name: caso.rotuloEditar }));
      fireEvent.change(screen.getByDisplayValue(caso.valorAtual), { target: { value: caso.novoValor } });
      fireEvent.click(screen.getByRole("button", { name: caso.botaoSalvar }));

      expect(screen.getByText(caso.novoValor)).toBeInTheDocument();
      expect(screen.queryByText(caso.valorAtual)).not.toBeInTheDocument(); // editou, não duplicou
    });
  });

  it("Roteiro: a HORA do item também muda", () => {
    const store = criarStore({ "travel-timeline-v2": [{ id: "dia1", tripId: "", dayNumber: 1, date: localDayKey(), items: [{ id: "i1", time: "09:00", title: "Museu", location: "", mapsLink: "", estimatedCost: 0, type: "atividade", done: false, pinned: false }] }] });
    renderComStore(<DailyTimeline />, store);

    expect(screen.getByText("09:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Museu" }));
    fireEvent.change(screen.getByDisplayValue("09:00"), { target: { value: "14:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("14:30")).toBeInTheDocument();
  });

  it("Rachar: renomear participante segue nas despesas (senão o acerto quebra)", () => {
    const store = criarStore({ "travel-bill-split": { tripName: "", people: ["Ana", "Léo"], entries: [{ id: "b1", description: "Jantar", amount: 100, paidBy: "Ana", splitBetween: ["Ana", "Léo"], date: localDayKey() }] } });
    renderComStore(<BillSplitter />, store);

    fireEvent.click(screen.getByRole("button", { name: "Renomear Ana" }));
    fireEvent.change(screen.getByDisplayValue("Ana"), { target: { value: "Aninha" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome de Ana" }));

    const dados = store.dados["travel-bill-split"] as { people: string[]; entries: { paidBy: string; splitBetween: string[] }[] };
    expect(dados.people).toEqual(["Aninha", "Léo"]);
    expect(dados.entries[0].paidBy).toBe("Aninha");
    expect(dados.entries[0].splitBetween).toEqual(["Aninha", "Léo"]);
  });
});

describe("Orçamento: várias viagens", () => {
  const viagemAntiga: TravelTrip = {
    id: "antiga-1",
    destination: "Buenos Aires",
    startDate: "2026-03-10",
    endDate: "2026-03-17",
    photoUrl: "",
    places: [],
    categories: { hotel: [{ id: "c1", description: "Hostel", estimated: 900, actual: 0 }] },
  };

  it("puxa sozinha a viagem que estava na chave antiga (sem apagá-la de lá)", () => {
    const store = criarStore({ "travel-budget-v2": viagemAntiga });
    renderComStore(<TravelBudget />, store);

    // apareceu no seletor E no card de destino
    expect(screen.getAllByText("Buenos Aires").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Buenos Aires")).toBeInTheDocument();

    const novo = store.dados["travel-trips-v2"] as TravelTripsStore;
    expect(novo.trips).toHaveLength(1);
    expect(novo.migrouDoObjetoUnico).toBe(true);
    // a chave antiga continua intacta — ninguém escreve nela
    expect(store.dados["travel-budget-v2"]).toEqual(viagemAntiga);
  });

  it("segunda viagem NÃO escreve por cima da primeira (o bug original)", () => {
    const store = criarStore({ "travel-budget-v2": viagemAntiga });
    renderComStore(<TravelBudget />, store);

    fireEvent.click(screen.getByRole("button", { name: /Nova viagem/i }));
    fireEvent.change(screen.getByPlaceholderText(/Nome do destino/i), { target: { value: "Salvador" } });

    const novo = store.dados["travel-trips-v2"] as TravelTripsStore;
    expect(novo.trips.map(t => t.destination)).toEqual(["Buenos Aires", "Salvador"]);
  });

  it("reabrir a aba não duplica nem ressuscita a viagem migrada", () => {
    const store = criarStore({ "travel-budget-v2": viagemAntiga });
    const tela = renderComStore(<TravelBudget />, store);
    tela.unmount();

    renderComStore(<TravelBudget />, store);
    const novo = store.dados["travel-trips-v2"] as TravelTripsStore;
    expect(novo.trips).toHaveLength(1);

    // e se a pessoa apagar a viagem, ela não volta do além na próxima abertura
    const seletor = screen.getAllByText("Buenos Aires")[0];
    expect(seletor).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir esta viagem" }));
    fireEvent.click(screen.getByRole("button", { name: /Excluir mesmo/i }));
    expect((store.dados["travel-trips-v2"] as TravelTripsStore).trips).toHaveLength(0);

    const terceira = renderComStore(<TravelBudget />, store);
    expect((store.dados["travel-trips-v2"] as TravelTripsStore).trips).toHaveLength(0);
    expect(within(terceira.container).queryByText("Buenos Aires")).not.toBeInTheDocument();
  });
});
