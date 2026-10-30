/**
 * SEM REPETIÇÃO ENTRE MÓDULOS (1.0.22, dono 28/10: "bora botar logo"). Regra de ouro em todos: ninguém perde nada e
 * nenhuma chave muda de tipo/formato — o app antigo continua lendo as mesmas chaves.
 *   1. Finanças › ✈️ VIAGEM saiu da fileira (era Viagens › Budget, `travel-trips-v2`) → atalho "Abrir em Viagens".
 *   2. Casa › Cardápio mostra e edita o cardápio da Dieta (`saude-meals`); o antigo (`casa-meal-plan`) aparece.
 *   3. Lista de compras = Mercado da Casa (`casa-grocery-categories`); Dieta › LISTA → "Gerar lista de compras";
 *      `dieta-smart-list` e a "Compras" da Despensa (`casa-shopping-list`) continuam visíveis até mover/limpar.
 *   4. "Tarefas de hoje" da Rotina (e a Home) mostram as de hoje da Carreira e dos Estudos; ✓ grava na origem.
 *   5. Pomodoro: um só estado — Rotina/Carreira (PomodoroTimer) e Home (FocusTimerWidget) mostram o mesmo timer.
 * Cada bloco fecha e REABRE (desmonta e monta de novo com o mesmo dado) — regra da casa.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import MealPlanner from "@/components/casa/MealPlanner";
import SmartPantry from "@/components/casa/SmartPantry";
import { ListaDeComprasDoCardapio } from "@/components/dieta/ListaDeComprasDoCardapio";
import { TarefasDeHoje } from "@/components/tarefas/tarefas-do-dia";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { FocusTimerWidget } from "@/components/home/widgets/FocusTimerWidget";
import { _reabrirPomodoro, _zerarPomodoro, lerEstado } from "@/lib/pomodoro-agora";
import {
  cardapioAntigoDaCasa, descricoesDoCardapio, gerarListaDoCardapio, levarCardapioAntigo, moverListaAntigaDaDespensa, moverListaAntigaDaDieta,
} from "@/lib/lista-e-cardapio-unicos";
import { alternarTarefaDosEstudos, colunaDeHojeNosEstudos, tarefasDeHojeDosEstudos } from "@/lib/tarefas-de-outros";
import { ABAS_DE_FINANCAS_NA_URL } from "@/pages/Index";
import MealPlannerAntigo from "@/test/app-antigo/casa/MealPlanner";
import SmartPantryAntigo from "@/test/app-antigo/casa/SmartPantry";
import { PomodoroTimer as PomodoroAntigo } from "@/test/app-antigo/PomodoroTimer";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, plataformaApp: () => "web" }));
const navegou: string[] = [];
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => (p: string) => { navegou.push(p); },
}));

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => { navegou.length = 0; });
afterEach(() => { vi.useRealTimers(); _zerarPomodoro(); });

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; escritas.push(key); },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};
type Store = ReturnType<typeof criarStore>;
const montar = (ui: React.ReactElement, store: Store) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);
/** Fecha e reabre: desmonta tudo e monta de novo lendo o mesmo dado salvo. */
const reabrir = (ui: React.ReactElement, store: Store) => { cleanup(); return montar(ui, store); };

/* ================================================================== 1. FINANÇAS › VIAGEM */
describe("1. Orçamento de viagem: um lugar só (Viagens › Budget)", () => {
  const fonte = (f: string) => readFileSync(resolve(__dirname, `../pages/${f}.tsx`), "utf8");
  it("a fileira de Finanças não tem mais a aba VIAGEM nem o TravelBudget; o ?aba=viagem antigo cai no atalho", () => {
    const index = fonte("Index");
    expect(index).not.toMatch(/id: "viagem"/);
    expect(index).not.toMatch(/<TravelBudget/);
    expect(index).toMatch(/<AtalhoParaOutroModulo[\s\S]*para="\/viagens\?aba=budget"/);
    // link antigo (plano de 30 dias, aba que estava aberta) continua aceito — e mostra o atalho, não tela vazia
    expect(ABAS_DE_FINANCAS_NA_URL).toContain("viagem");
  });
  it("Viagens lê ?aba=budget (o atalho abre direto no orçamento, a mesma chave travel-trips-v2)", () => {
    expect(fonte("Viagens")).toMatch(/get\("aba"\)/);
    expect(fonte("Viagens")).toMatch(/activeTab === "budget" && <TravelBudget \/>/);
  });
});

/* ================================================================== 2. CARDÁPIO */
describe("2. Cardápio: um só (o da Dieta, saude-meals)", () => {
  const cardapioDieta = { SEGUNDA: { "Café da Manhã": "", "Almoço": "Frango com arroz", "Lanche": "", "Janta": "" }, TERÇA: { "Almoço": "", "Janta": "Sopa" } };
  const antigoCasa = { Segunda: { almoco: "r1", janta: "r2" }, Terça: { almoco: "r1", janta: "r2" } };
  const receitasCasa = [{ id: "r1", name: "Lasanha", emoji: "🍝", ingredients: [] }, { id: "r2", name: "Omelete", emoji: "🍳", ingredients: [] }];

  it("Casa › Cardápio mostra o da Dieta e o antigo da Casa; editar grava em saude-meals (mesmo formato); reabrir mantém", () => {
    const store = criarStore({ "saude-meals": cardapioDieta, "casa-meal-plan": antigoCasa, "casa-recipes": receitasCasa });
    montar(<MealPlanner />, store);
    expect(screen.getByText("Frango com arroz")).toBeInTheDocument();
    expect(screen.getByTestId("cardapio-antigo-casa")).toHaveTextContent("Lasanha");
    fireEvent.click(screen.getByRole("button", { name: "Editar Lanche de Segunda" }));
    const campo = screen.getByRole("textbox", { name: "Lanche de Segunda" });
    fireEvent.change(campo, { target: { value: "Iogurte" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    const meals = store.dados["saude-meals"] as Record<string, Record<string, string>>;
    expect(meals.SEGUNDA).toEqual({ "Café da Manhã": "", "Almoço": "Frango com arroz", "Lanche": "Iogurte", "Janta": "" });
    expect(meals.TERÇA).toEqual(cardapioDieta.TERÇA); // o resto intacto
    // o cardápio antigo da Casa não foi tocado
    expect(store.escritas).not.toContain("casa-meal-plan");
    expect(store.escritas).not.toContain("casa-recipes");
    reabrir(<MealPlanner />, store);
    expect(screen.getByText("Iogurte")).toBeInTheDocument();
  });

  it("'Levar pro cardápio' só preenche Almoço/Janta VAZIOS (nunca sobrescreve) e não apaga o antigo", () => {
    const store = criarStore({ "saude-meals": cardapioDieta, "casa-meal-plan": antigoCasa, "casa-recipes": receitasCasa });
    montar(<MealPlanner />, store);
    fireEvent.click(screen.getByTestId("levar-cardapio-antigo"));
    const meals = store.dados["saude-meals"] as Record<string, Record<string, string>>;
    expect(meals.SEGUNDA["Almoço"]).toBe("Frango com arroz"); // já tinha: fica
    expect(meals.SEGUNDA["Janta"]).toBe("Omelete");
    expect(meals.TERÇA["Almoço"]).toBe("Lasanha");
    expect(meals.TERÇA["Janta"]).toBe("Sopa"); // já tinha: fica
    expect(store.dados["casa-meal-plan"]).toEqual(antigoCasa);
    // depois de levar, o bloco antigo continua visível, sem o botão
    expect(screen.getByTestId("cardapio-antigo-casa")).toBeInTheDocument();
    expect(screen.queryByTestId("levar-cardapio-antigo")).toBeNull();
  });

  it("regra pura: receita apagada some do antigo; dado torto não derruba", () => {
    expect(cardapioAntigoDaCasa({ Segunda: { almoco: "x", janta: "r2" } }, receitasCasa)).toEqual([{ dia: "SEGUNDA", janta: "Omelete" }]);
    expect(cardapioAntigoDaCasa("lixo", null)).toEqual([]);
    expect(levarCardapioAntigo(null, []).preenchidas).toBe(0);
  });
});

/* ================================================================== 3. LISTA DE COMPRAS */
type Cat = { id: string; name: string; items: { id: string; text: string; done: boolean; origem?: string }[] };
describe("3. Lista de compras: uma só (o Mercado da Casa)", () => {
  it("'Gerar lista de compras' manda os ingredientes pro Mercado (categoria Dieta, formato de sempre) — nada em dieta-smart-list", () => {
    const store = criarStore({ "casa-grocery-categories": [{ id: "1", name: "HortiFrutti", emoji: "🥬", color: "bg-green-500", items: [{ id: "a", text: "Arroz", done: false }] }] });
    const descricoes = descricoesDoCardapio({ SEGUNDA: { "Almoço": "Arroz • Feijão (100g)", "Janta": "Frango grelhado" } }, ["SEGUNDA"], ["Almoço", "Janta"]);
    montar(<ListaDeComprasDoCardapio descricoes={descricoes} />, store);
    fireEvent.click(screen.getByTestId("gerar-lista-compras"));
    const lista = store.dados["casa-grocery-categories"] as Cat[];
    expect(lista[0].items.map((i) => i.text)).toEqual(["Arroz"]); // o que já tinha fica igual
    const dieta = lista.find((c) => c.name === "Dieta")!;
    expect(dieta.items.map((i) => i.text)).toEqual(["Feijão", "Frango grelhado"]); // "Arroz" já estava pendente: não repete
    expect(dieta.items.every((i) => typeof i.id === "string" && i.done === false)).toBe(true);
    expect(store.escritas).not.toContain("dieta-smart-list");
  });

  it("a lista antiga da Dieta continua visível; 'Levar pra lista da Casa' move os pendentes e deixa os comprados até limpar; reabrir mantém", () => {
    const antiga = [{ id: "1", text: "aveia", done: false }, { id: "2", text: "banana", done: true }];
    const store = criarStore({ "dieta-smart-list": antiga });
    montar(<ListaDeComprasDoCardapio descricoes={[]} />, store);
    expect(screen.getByTestId("lista-antiga-dieta")).toHaveTextContent("Aveia");
    expect(screen.getByTestId("lista-antiga-dieta")).toHaveTextContent("Banana");
    fireEvent.click(screen.getByTestId("mover-lista-antiga-dieta"));
    expect((store.dados["casa-grocery-categories"] as Cat[]).find((c) => c.name === "Dieta")!.items.map((i) => i.text)).toEqual(["Aveia"]);
    // mesmo formato: {id,text,done}[] — só o comprado ficou
    expect(store.dados["dieta-smart-list"]).toEqual([{ id: "2", text: "banana", done: true }]);
    reabrir(<ListaDeComprasDoCardapio descricoes={[]} />, store);
    expect(screen.getByTestId("lista-antiga-dieta")).toHaveTextContent("Banana");
    expect(screen.queryByTestId("mover-lista-antiga-dieta")).toBeNull();
  });

  it("Despensa: com 'Compras' antigas, elas aparecem e vão pro Mercado (o do 'Acabou' leva o canto); sem elas, o botão leva pro Mercado", () => {
    const store = criarStore({ "casa-shopping-list": [
      { id: "1", name: "Leite", checked: false, fromPantry: true, origemCategory: "geladeira" },
      { id: "2", name: "Pilhas", checked: false, fromPantry: false },
      { id: "3", name: "Sabão", checked: true, fromPantry: false },
    ] });
    const abrirMercado = vi.fn();
    montar(<SmartPantry onAbrirMercado={abrirMercado} />, store);
    fireEvent.click(screen.getByTestId("despensa-lista-antiga"));
    expect(screen.getByText("Leite")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("levar-lista-antiga-despensa"));
    const lista = store.dados["casa-grocery-categories"] as Cat[];
    expect(lista.find((c) => c.name === "Laticínios e Frios")!.items).toEqual([expect.objectContaining({ text: "Leite", origem: "geladeira", done: false })]);
    expect(lista.find((c) => c.name === "Mercearia")!.items).toEqual([expect.objectContaining({ text: "Pilhas", done: false })]);
    expect(lista.find((c) => c.name === "Mercearia")!.items[0]).not.toHaveProperty("origem");
    expect(store.dados["casa-shopping-list"]).toEqual([{ id: "3", name: "Sabão", checked: true, fromPantry: false }]);
    // sem lista antiga: o botão "Lista de compras →" abre o Mercado
    const vazia = criarStore();
    reabrir(<SmartPantry onAbrirMercado={abrirMercado} />, vazia);
    fireEvent.click(screen.getByTestId("despensa-abrir-mercado"));
    expect(abrirMercado).toHaveBeenCalled();
  });

  it("regras puras: nada duplica; valores tortos não derrubam", () => {
    expect(gerarListaDoCardapio(null, ["Ovos • Ovos"]).novos).toBe(1);
    expect(moverListaAntigaDaDieta(null, "lixo").movidos).toBe(0);
    expect(moverListaAntigaDaDespensa(undefined, [{ name: "Café", checked: false }]).novos).toBe(1);
  });
});

/* ================================================================== 4. TAREFAS */
describe("4. Uma lista do dia com tudo (Rotina + Trabalho + Estudos)", () => {
  // quarta, 28/10/2026
  const QUA = new Date(2026, 9, 28, 9, 0);
  const HOJE = "2026-10-28";
  const fixar = () => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(QUA); };
  const dados = () => ({
    "rotina-day-tasks": [{ id: "r1", texto: "Academia", feito: false, dia: HOJE }],
    "career-day-tasks": [
      { id: "c1", texto: "Mandar o relatório", feito: false, dia: HOJE },
      { id: "c2", texto: "De ontem sem prazo", feito: false, dia: "2026-10-27" },
    ],
    // a linha vazia antes da tarefa: o índice tem de ser o da lista CRUA (a aba pula linhas sem texto)
    "estudos-week-tasks": { SEGUNDA: [{ text: "Ler cap. 1", done: false }], QUARTA: [{ text: "", done: false }, { text: "Revisar inglês", done: false }] },
  });

  it("a lista da Rotina mostra as de hoje do Trabalho e dos Estudos com a etiqueta; ✓ grava na chave de ORIGEM; reabrir mantém", () => {
    fixar();
    const store = criarStore(dados());
    const ui = <TarefasDeHoje chave="rotina-day-tasks" onde="Rotina" />;
    montar(ui, store);
    expect(screen.getByText("Mandar o relatório")).toBeInTheDocument();
    expect(screen.getByText("Revisar inglês")).toBeInTheDocument();
    expect(screen.queryByText("Ler cap. 1")).toBeNull(); // segunda, não hoje
    expect(screen.getByText("Trabalho")).toBeInTheDocument();
    expect(screen.getByText("Estudos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Mandar o relatório" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Revisar inglês" }));
    const carreira = store.dados["career-day-tasks"] as { id: string; feito: boolean; feitoEm?: string }[];
    expect(carreira.find((t) => t.id === "c1")).toMatchObject({ feito: true, feitoEm: HOJE });
    expect(carreira.find((t) => t.id === "c2")).toMatchObject({ feito: false });
    expect(store.dados["estudos-week-tasks"]).toEqual({
      SEGUNDA: [{ text: "Ler cap. 1", done: false }],
      QUARTA: [{ text: "", done: false }, { text: "Revisar inglês", done: true }],
    });
    // nada foi copiado pra lista da Rotina
    expect(store.escritas).not.toContain("rotina-day-tasks");
    expect(store.dados["rotina-day-tasks"]).toEqual(dados()["rotina-day-tasks"]);
    reabrir(ui, store);
    expect(screen.getByRole("checkbox", { name: "Concluir Mandar o relatório" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Concluir Revisar inglês" })).toHaveAttribute("aria-checked", "true");
  });

  it("a lista da Carreira continua só com as dela (não puxa Estudos nem Rotina)", () => {
    fixar();
    montar(<TarefasDeHoje chave="career-day-tasks" onde="Carreira" />, criarStore(dados()));
    expect(screen.getByText("Mandar o relatório")).toBeInTheDocument();
    expect(screen.queryByText("Revisar inglês")).toBeNull();
    expect(screen.queryByText("Academia")).toBeNull();
  });

  it("o widget da Home junta os Estudos também, com as mesmas etiquetas", () => {
    fixar();
    const store = criarStore(dados());
    montar(<TasksWidget />, store);
    expect(screen.getByText("Revisar inglês")).toBeInTheDocument();
    expect(screen.getAllByText(/Trabalho/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Concluir Revisar inglês" }));
    expect((store.dados["estudos-week-tasks"] as Record<string, { done: boolean }[]>).QUARTA[1].done).toBe(true);
  });

  it("regras puras: sábado/domingo = FINAL DE SEMANA; valor torto devolve o mesmo", () => {
    expect(colunaDeHojeNosEstudos(new Date(2026, 9, 31))).toBe("FINAL DE SEMANA");
    expect(tarefasDeHojeDosEstudos(null, QUA)).toEqual([]);
    expect(alternarTarefaDosEstudos("lixo", "QUARTA", 0)).toBe("lixo");
  });
});

/* ================================================================== 5. POMODORO */
describe("5. Pomodoro: um timer só nos três lugares", () => {
  it("começar na Home = o mesmo tempo correndo no Pomodoro da Rotina/Carreira; a sessão conta UMA vez", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 28, 10, 0) });
    const store = criarStore({ "pomodoro-duracoes": { focus: 15, break: 5, longBreak: 15 } });
    montar(<><FocusTimerWidget /><PomodoroTimer /></>, store);
    fireEvent.click(screen.getByRole("button", { name: "Começar o foco" }));
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument(); // o grande também está rodando
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId("widget-foco-tempo")).toHaveTextContent("14:00");
    expect(screen.getAllByText("14:00")).toHaveLength(2); // o widget E o grande mostram o mesmo
    act(() => { vi.advanceTimersByTime(14 * 60_000 + 1000); });
    expect(store.dados["pomodoro-sessions-today"]).toBe(1); // não 2
    expect(store.dados["pomodoro-total-focus"]).toBe(15);
    expect(store.dados["pomodoro-log"]).toEqual({ "2026-10-28": 15 });
  });

  it("fechar e reabrir com o foco rodando continua contando (e conclui se acabou com o app fechado)", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 28, 10, 0) });
    const store = criarStore({ "pomodoro-duracoes": { focus: 25, break: 5, longBreak: 15 } });
    montar(<PomodoroTimer />, store);
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    cleanup();
    _reabrirPomodoro();
    vi.setSystemTime(new Date(2026, 9, 28, 10, 10));
    montar(<FocusTimerWidget />, store);
    expect(screen.getByTestId("widget-foco-tempo")).toHaveTextContent("15:00");
    cleanup();
    _reabrirPomodoro();
    vi.setSystemTime(new Date(2026, 9, 28, 10, 40));
    montar(<PomodoroTimer />, store);
    expect(store.dados["pomodoro-sessions-today"]).toBe(1);
    expect(screen.getByText(/POMODORO — PAUSA/)).toBeInTheDocument();
  });

  it("estado guardado torto vira o inicial (nunca derruba a tela)", () => {
    expect(lerEstado({ modo: "x", rodando: true, fimEm: "a" })).toEqual({ modo: "focus", rodando: false, fimEm: 0, restante: null });
  });
});

/* ================================================================== APP ANTIGO (o das lojas, lendo as mesmas chaves) */
describe("app antigo continua igual depois das ações do app novo", () => {
  it("Casa › Cardápio antigo: depois de editar/levar no novo, o antigo mostra o mesmo cardápio da Casa (casa-meal-plan intacto)", () => {
    const antigoCasa = { Segunda: { almoco: "r1", janta: "" } };
    const store = criarStore({ "casa-meal-plan": antigoCasa, "casa-recipes": [{ id: "r1", name: "Lasanha", emoji: "🍝", ingredients: [] }] });
    montar(<MealPlanner />, store);
    fireEvent.click(screen.getByTestId("levar-cardapio-antigo"));
    expect((store.dados["saude-meals"] as Record<string, Record<string, string>>).SEGUNDA["Almoço"]).toBe("Lasanha");
    reabrir(<MealPlannerAntigo />, store);
    expect((screen.getAllByRole("combobox")[0] as HTMLSelectElement).value).toBe("r1"); // Segunda › almoço = Lasanha, como antes
    expect(store.dados["casa-meal-plan"]).toEqual(antigoCasa);
  });

  it("Despensa antiga: depois de levar pro Mercado no novo, o antigo lê casa-shopping-list no mesmo formato (sobra o comprado)", () => {
    const store = criarStore({ "casa-shopping-list": [{ id: "1", name: "Leite", checked: false, fromPantry: true, origemCategory: "geladeira" }, { id: "3", name: "Sabão", checked: true, fromPantry: false }] });
    montar(<SmartPantry onAbrirMercado={() => {}} />, store);
    fireEvent.click(screen.getByTestId("despensa-lista-antiga"));
    fireEvent.click(screen.getByTestId("levar-lista-antiga-despensa"));
    reabrir(<SmartPantryAntigo />, store);
    fireEvent.click(screen.getByRole("button", { name: /Compras/ }));
    expect(screen.getByText("Sabão")).toBeInTheDocument();
    expect(screen.queryByText("Leite")).toBeNull(); // está no Mercado (que o app antigo também lê)
  });

  it("Pomodoro antigo lê as sessões gravadas pelo timer único (mesmas chaves, mesmo formato)", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 28, 10, 0) });
    const store = criarStore({ "pomodoro-duracoes": { focus: 15, break: 5, longBreak: 15 } });
    montar(<FocusTimerWidget />, store);
    fireEvent.click(screen.getByRole("button", { name: "Começar o foco" }));
    act(() => { vi.advanceTimersByTime(15 * 60_000 + 1000); });
    reabrir(<PomodoroAntigo />, store);
    expect(screen.getByText(/1 sessão hoje • 15min foco total/)).toBeInTheDocument();
  });
});
