/**
 * Pendências de hoje ESPELHAM o Score do Dia (cliente pagante, 10/09).
 *
 * Ela zerou "Pendências de hoje" e o score parou em 95: os seis blocos de 5
 * pontos que são registro diário (humor, gasto, peso, sono, gratidão, ideia)
 * não apareciam na lista. Este arquivo é a trava do invariante
 *
 *     lista de pendências vazia  ⇔  score = 100
 *
 * nos fixtures do score-do-dia.test (duplicados aqui no mínimo: importar um
 * arquivo de teste registraria os describes dele de novo), e prova que o
 * toque numa linha nova abre o MESMO formulário da ação rápida.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { QuickActions, EVENTO_ACAO_RAPIDA } from "@/components/home/QuickActions";
import { localDayKey } from "@/lib/utils";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
}));

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

const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const hoje = () => localDayKey();
const diaDaSemana = () => DIAS[new Date().getDay()];

/** Mesmo fixture do score-do-dia.test: hábitos e treino cadastrados, TUDO
 *  feito, sem suplemento, sem livro, sem plano de refeições. */
const tudoFeitoBasico = (): Record<string, unknown> => ({
  "rotina-habits": [{ id: "h1", name: "Meditar" }, { id: "h2", name: "Alongar" }],
  "core-rotina-habit-log": { [hoje()]: { h1: true, h2: true } },
  "saude-workouts-v2": { [diaDaSemana()]: { muscles: ["Peito"] } },
  "treino-active-days": [diaDaSemana()],
  "saude-workout-log": [hoje()],
  "core-saude-water": { [hoje()]: 8 },
  "core-dieta-log": { [hoje()]: { cafe: { calories: 300 }, almoco: {}, lanche: {}, jantar: {} } },
  "mood-log": { [hoje()]: 4 },
  "dp-gratitude": { [hoje()]: ["família"] },
  "hiperfoco-thoughts": { [hoje()]: { ideias: ["app novo"] } },
  "core-saude-measures": [{ date: hoje(), weight: 70 }],
  "sleep-log": { [hoje()]: 7.5 },
  "finance-expenses": [{ date: hoje(), value: 12.5, category: "Alimentação" }],
});

/** A timeline ligada ao hook de verdade, como na Home — score e pendências
 *  saem do MESMO objeto. */
const Sonda = () => {
  const d = useLifeHubData();
  return (
    <>
      <p data-testid="score">{d.dayScore}</p>
      <NextHoursTimeline data={d} />
    </>
  );
};

const renderHome = (dados: Record<string, unknown>, comAcoes = false) => {
  const store = criarStore(dados);
  render(
    <MemoryRouter>
      <UserDataContext.Provider value={store.valor}>
        {comAcoes && <QuickActions />}
        <Sonda />
      </UserDataContext.Provider>
    </MemoryRouter>,
  );
  // a lista nasce fechada; abre pelo cabeçalho
  fireEvent.click(screen.getByRole("button", { name: /Pendências de hoje/ }));
  return store;
};

const score = () => Number(screen.getByTestId("score").textContent);
/** Linhas pendentes são <button>; as feitas são <div> riscado. O cabeçalho
 *  também é <button>, por isso o filtro. */
const pendentes = () =>
  screen.getAllByRole("button").filter(b => !/Pendências de hoje/.test(b.textContent || "")).map(b => b.textContent || "");

beforeEach(() => {
  try { localStorage.clear(); } catch { /* jsdom */ }
});

describe("Pendências de hoje espelham o Score do Dia", () => {
  it("(a) tudo feito → nenhuma pendência e score 100", () => {
    renderHome(tudoFeitoBasico());
    expect(score()).toBe(100);
    expect(pendentes()).toEqual([]);
    expect(screen.queryByText(/pendente/)).not.toBeInTheDocument(); // sem o selo "N pendentes"
    // as seis viram a versão "feito", como as outras linhas do arquivo
    for (const feito of ["Humor registrado", "Gasto registrado", "Peso registrado", "Sono registrado", "Ideia anotada", "Gratidão anotada"]) {
      expect(screen.getByText(feito)).toBeInTheDocument();
    }
  });

  it("(b) tudo feito menos sono → exatamente uma pendência, 'Registrar sono', e score 95", () => {
    renderHome({ ...tudoFeitoBasico(), "sleep-log": {} });
    expect(score()).toBe(95);
    const lista = pendentes();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatch(/Registrar sono/);
    expect(screen.getByText("1 pendente")).toBeInTheDocument();
  });

  it("cada um dos seis registros, sozinho, é a única pendência e vale os 5 pontos", () => {
    const casos: [Record<string, unknown>, RegExp][] = [
      [{ "mood-log": {} }, /Check de humor/],
      [{ "finance-expenses": [] }, /Registrar um gasto/],
      [{ "core-saude-measures": [] }, /Pesar hoje/],
      [{ "hiperfoco-thoughts": {} }, /Anotar uma ideia/],
      [{ "dp-gratitude": {} }, /Anotar uma gratidão/],
    ];
    for (const [semEsse, rotulo] of casos) {
      const { unmount } = render(<span />); // separa os renders
      unmount();
      renderHome({ ...tudoFeitoBasico(), ...semEsse });
      expect(score()).toBe(95);
      const lista = pendentes();
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatch(rotulo);
      document.body.innerHTML = "";
    }
  });

  /* "Configurei tudo nos treinos mas não saiu o 'Configurar treino da
   * semana'" (cliente, 11/09). A Home exigia GRUPO MUSCULAR; o Treino
   * considera configurado quem tem EXERCÍCIO. E dia de descanso caía na
   * mesma cobrança. */
  it("treino com exercícios mas sem grupo muscular NÃO é 'Configurar treino da semana'", () => {
    const d = tudoFeitoBasico();
    d["saude-workouts-v2"] = { [diaDaSemana()]: { muscles: [], exercises: [{ id: "e1", name: "Supino", done: true }, { id: "e2", name: "Remada", done: true }] } };
    renderHome(d);
    expect(screen.queryByText("Configurar treino da semana")).not.toBeInTheDocument();
    expect(screen.getByText(/Treino de 2 exercícios concluído/)).toBeInTheDocument();
    expect(score()).toBe(100);
  });

  it("dia de descanso (fora dos dias ativos) vira 'Hoje é descanso', feito — não pendência", () => {
    const d = tudoFeitoBasico();
    const outroDia = DIAS[(new Date().getDay() + 1) % 7];
    d["saude-workouts-v2"] = { [outroDia]: { muscles: ["Costas"], exercises: [{ id: "e1", name: "Barra", done: false }] } };
    d["treino-active-days"] = [outroDia];
    d["saude-workout-log"] = [];
    renderHome(d);
    expect(screen.queryByText("Configurar treino da semana")).not.toBeInTheDocument();
    expect(screen.getByText("Hoje é descanso")).toBeInTheDocument();
    expect(pendentes()).toEqual([]);
    expect(score()).toBe(100);
  });

  it("semana realmente vazia (nenhum dia com exercício ou grupo) continua pedindo pra configurar", () => {
    const d = tudoFeitoBasico();
    d["saude-workouts-v2"] = { [diaDaSemana()]: { muscles: [], exercises: [] } };
    d["saude-workout-log"] = [];
    renderHome(d);
    expect(pendentes()).toEqual(["🏋️Configurar treino da semana"]);
  });

  it("leitura: porcentagem vem de currentPage/pages; mexeu na página hoje → linha feita; sem mexer → 'Continuar' pendente e score 95", () => {
    const d = tudoFeitoBasico();
    d["lib-books"] = [{ id: "b1", title: "Um livro", status: "lendo", pages: 200, currentPage: 50 }];
    renderHome(d);
    expect(pendentes()).toEqual(['📖Continuar "Um livro" (25%)']);
    expect(score()).toBe(95);
  });

  it("leitura: com lib-read-log de hoje a linha fica riscada e o score fecha", () => {
    const d = tudoFeitoBasico();
    d["lib-books"] = [{ id: "b1", title: "Um livro", status: "lendo", pages: 200, currentPage: 50 }];
    d["lib-read-log"] = [hoje()];
    renderHome(d);
    expect(pendentes()).toEqual([]);
    expect(screen.getByText(/Leitura de hoje feita/)).toBeInTheDocument();
    expect(score()).toBe(100);
  });

  it("(c) sem suplemento cadastrado → nenhuma pendência de suplemento (o score já dá o bloco como cumprido)", () => {
    renderHome(tudoFeitoBasico());
    expect(screen.queryByText(/suplemento/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/livro|Continuar/i)).not.toBeInTheDocument();
    expect(score()).toBe(100);
  });

  it("suplemento cadastrado e não tomado continua pendência (e score 95) — a regra antiga fica", () => {
    renderHome({ ...tudoFeitoBasico(), "core-saude-supplements": [{ id: "s1", name: "Creatina" }] });
    expect(score()).toBe(95);
    expect(pendentes()).toEqual([expect.stringMatching(/1 suplemento pendente/)]);
  });

  it("(d) toque na pendência dispara o evento com o id da ação rápida", () => {
    const ouvido = vi.fn();
    window.addEventListener(EVENTO_ACAO_RAPIDA, ouvido);
    renderHome({ ...tudoFeitoBasico(), "sleep-log": {} });
    fireEvent.click(screen.getByRole("button", { name: /Registrar sono/ }));
    expect(ouvido).toHaveBeenCalledTimes(1);
    expect((ouvido.mock.calls[0][0] as CustomEvent).detail).toEqual({ id: "sleep" });
    window.removeEventListener(EVENTO_ACAO_RAPIDA, ouvido);
  });

  it("(d') ...e o QuickActions da mesma Home abre o formulário de sono; gasto abre 'Registrar Gasto'", () => {
    renderHome({ ...tudoFeitoBasico(), "sleep-log": {}, "finance-expenses": [] }, true);
    expect(screen.queryByPlaceholderText("Quantas horas dormiu?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Registrar sono/ }));
    expect(screen.getByPlaceholderText("Quantas horas dormiu?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Registrar um gasto/ }));
    expect(screen.queryByPlaceholderText("Quantas horas dormiu?")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("R$ 0,00")).toBeInTheDocument();
    // "Registrar Gasto" aparece 2x: o botão da fileira e o TÍTULO do formulário aberto
    expect(screen.getAllByText("Registrar Gasto")).toHaveLength(2);
  });

  it("ordem: as linhas que já existiam ficam onde estavam; as novas entram depois, na ordem das Ações rápidas", () => {
    // nada feito, só cadastros → todas as linhas antigas e as seis novas pendentes
    renderHome({
      "rotina-habits": [{ id: "h1", name: "Meditar" }],
      "saude-workouts-v2": { [diaDaSemana()]: { muscles: ["Peito"] } },
      "treino-active-days": [diaDaSemana()],
    });
    const lista = pendentes();
    const idx = (re: RegExp) => lista.findIndex(l => re.test(l));
    const antigas = [/Hábito pendente/, /Treino de Peito hoje/, /refeições para registrar/, /copos de água/];
    const novas = [/Check de humor/, /Registrar um gasto/, /Pesar hoje/, /Registrar sono/, /Anotar uma ideia/, /Anotar uma gratidão/];
    const posAntigas = antigas.map(idx);
    const posNovas = novas.map(idx);
    expect(posAntigas.every(p => p >= 0)).toBe(true);
    expect(posNovas.every(p => p >= 0)).toBe(true);
    expect(Math.max(...posAntigas)).toBeLessThan(Math.min(...posNovas));
    expect([...posNovas].sort((a, b) => a - b)).toEqual(posNovas);
  });
});
