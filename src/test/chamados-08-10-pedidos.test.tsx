/**
 * CHAMADOS DE 08/10 — os pedidos.
 *
 *  4) Tarefas: data de criação, checklist (subtarefas), prioridade e ordem.
 *  5) Compromissos: notas e editar (inclusive a hora) o que já existe.
 *  6) Finanças: ordenar gastos/fixos (só de exibição), ✓ de paga na lista de
 *     custos fixos, fixos previstos no mês futuro do Orçamento Mensal.
 *
 * E a régua de sempre: as chaves são as mesmas e o app antigo das lojas
 * (que só conhece os campos de antes) continua lendo e regravando sem perder nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, subLoaded: true, loading: false }) }));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock("sonner", () => ({ toast: { success: (m: string) => { toasts.push(m); }, error: (m: string) => { toasts.push(`ERRO: ${m}`); } } }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import {
  CHAVE_TAREFAS_ROTINA, dataDeCriacao, moverTarefaNoDia, posicaoNoDia, progressoDasSubtarefas, subtarefasDaTarefa, type TarefaDoDia,
} from "@/lib/tarefas";
import { TarefasDeHoje } from "@/components/tarefas/tarefas-do-dia";
import { CHAVE_COMPROMISSOS, editarCompromisso, compromissosValidos, type Compromisso } from "@/lib/compromissos";
import { compromissosValidos as compromissosValidosAntigo } from "./app-antigo/home/compromissos-antigo";
import { CompromissosDoDia } from "@/components/rotina/Compromissos";
import { ordenarGastos, ordenarFixos } from "@/components/finance/ordenar";
import { FixedExpensesTable, projetarFixos, type FixedExpense } from "@/components/FixedExpensesTable";
import { ExpenseTable } from "@/components/ExpenseTable";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  // como a nuvem: JSON (undefined some)
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
beforeEach(() => { toasts.length = 0; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 8, 10, 0)); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

const HOJE = "2026-10-08";

/* ------------------------------------------------------------------ 4) TAREFAS */
describe("4) tarefas — data de criação, checklist, prioridade, ordem", () => {
  const base = (extra: Partial<TarefaDoDia> & { id: string; texto: string }): TarefaDoDia => ({ feito: false, dia: HOJE, ...extra });

  it("dataDeCriacao: criadaEm quando tem; tarefa antiga cai em veioDe, depois no dia", () => {
    expect(dataDeCriacao(base({ id: "a", texto: "x", criadaEm: "2026-10-05T13:00:00.000Z" }))).toBe("2026-10-05");
    expect(dataDeCriacao(base({ id: "b", texto: "x", veioDe: "2026-10-02" }))).toBe("2026-10-02");
    expect(dataDeCriacao(base({ id: "c", texto: "x" }))).toBe(HOJE);
  });

  it("moverTarefaNoDia: troca só com a vizinha sem hora do mesmo dia e estado; quem tem hora não se move", () => {
    const lista: TarefaDoDia[] = [
      base({ id: "ontem", texto: "de ontem", dia: "2026-10-07" }),
      base({ id: "a", texto: "A" }),
      base({ id: "h", texto: "com hora", hora: "09:00" }),
      base({ id: "b", texto: "B" }),
      base({ id: "f", texto: "feita", feito: true }),
      base({ id: "c", texto: "C" }),
    ];
    const ids = (l: TarefaDoDia[]) => l.map((t) => t.id);
    expect(ids(moverTarefaNoDia(lista, "c", -1))).toEqual(["ontem", "a", "h", "c", "f", "b"]); // pula a com hora e a feita
    expect(ids(moverTarefaNoDia(lista, "a", -1))).toEqual(ids(lista)); // já é a primeira
    expect(ids(moverTarefaNoDia(lista, "c", 1))).toEqual(ids(lista)); // já é a última
    expect(ids(moverTarefaNoDia(lista, "h", 1))).toEqual(ids(lista)); // com hora: a ordem é a da hora
    expect(posicaoNoDia(lista, "b")).toEqual({ i: 2, total: 3 });
    expect(posicaoNoDia(lista, "h")).toBeNull();
    expect(posicaoNoDia(lista, "f")).toEqual({ i: 1, total: 1 });
  });

  it("subtarefas: só as legíveis; progresso conta as feitas", () => {
    const t = base({ id: "a", texto: "x", subtarefas: [{ id: "s1", texto: "um", feito: true }, { id: "s2", texto: "dois", feito: false }, { id: "x", texto: "", feito: false }, null as never] });
    expect(subtarefasDaTarefa(t)).toHaveLength(2);
    expect(progressoDasSubtarefas(t)).toEqual({ feitas: 1, total: 2 });
    expect(progressoDasSubtarefas(base({ id: "b", texto: "x" }))).toEqual({ feitas: 0, total: 0 });
  });

  it("tela: tarefa nova grava criadaEm; a ficha mostra 'Criada em'; checklist e prioridade entram pelo formulário e o passo marca na ficha", async () => {
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [{ id: "velha", texto: "Pagar o IPVA", feito: false, dia: HOJE, veioDe: "2026-10-03" }] });
    store.montar(<TarefasDeHoje chave={CHAVE_TAREFAS_ROTINA} onde="Rotina" />);

    // tarefa antiga (sem criadaEm): a ficha usa o veioDe
    fireEvent.click(screen.getByRole("button", { name: "Abrir Pagar o IPVA" }));
    expect((await screen.findByTestId("ficha-criada")).textContent).toMatch(/Criada em 03\/10/);
    expect(screen.getByTestId("ficha-ordem").textContent).toMatch(/1º de 1/);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // nova pela folha: prioridade + 2 passos (um "adicionado", outro só digitado — não se perde)
    fireEvent.click(screen.getByRole("button", { name: "Tarefa com horário ou detalhes" }));
    const form = await screen.findByTestId("form-tarefa");
    fireEvent.change(within(form).getByLabelText("O que precisa fazer"), { target: { value: "Entregar relatório" } });
    fireEvent.click(within(form).getByTestId("form-prioridade"));
    const passo = within(form).getByLabelText("Novo passo da checklist");
    fireEvent.change(passo, { target: { value: "Revisar números" } });
    fireEvent.keyDown(passo, { key: "Enter" });
    fireEvent.change(within(form).getByLabelText("Novo passo da checklist"), { target: { value: "Mandar pro chefe" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar tarefa" }));

    const lista = store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA);
    const nova = lista.find((t) => t.texto === "Entregar relatório")!;
    expect(nova.criadaEm?.slice(0, 10)).toBe(HOJE);
    expect(nova.prioridade).toBe("alta");
    expect(nova.subtarefas?.map((s) => s.texto)).toEqual(["Revisar números", "Mandar pro chefe"]);
    // a antiga continua exatamente como era (sem campo novo)
    expect(Object.keys(lista.find((t) => t.id === "velha")!).sort()).toEqual(["dia", "feito", "id", "texto", "veioDe"]);

    // na linha: bandeirinha e 0/2
    const linha = screen.getAllByTestId("linha-tarefa").find((l) => l.textContent?.includes("Entregar relatório"))!;
    expect(within(linha).getByTestId("prioridade-da-linha")).toBeTruthy();
    expect(within(linha).getByTestId("checklist-da-linha").textContent).toMatch(/0\/2/);

    // na ficha: marca o 1º passo → 1/2 gravado; "Criada hoje"
    fireEvent.click(within(linha).getByRole("button", { name: "Abrir Entregar relatório" }));
    const ficha = await screen.findByTestId("ficha-tarefa");
    expect(within(ficha).getByTestId("ficha-criada").textContent).toMatch(/Criada hoje/);
    fireEvent.click(within(ficha).getByRole("checkbox", { name: "Concluir Revisar números" }));
    const depois = store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA).find((t) => t.texto === "Entregar relatório")!;
    expect(depois.subtarefas?.map((s) => s.feito)).toEqual([true, false]);
    expect(depois.feito).toBe(false); // a tarefa em si não fecha sozinha
  });

  it("tela: Subir/Descer na ficha reordena as sem hora de hoje (e a lista gravada muda de ordem)", async () => {
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [
      { id: "a", texto: "Lavar roupa", feito: false, dia: HOJE },
      { id: "b", texto: "Ligar pro banco", feito: false, dia: HOJE },
      { id: "c", texto: "Estudar", feito: false, dia: HOJE },
    ] });
    store.montar(<TarefasDeHoje chave={CHAVE_TAREFAS_ROTINA} onde="Rotina" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Estudar" }));
    const ficha = await screen.findByTestId("ficha-tarefa");
    expect(within(ficha).getByTestId("ficha-ordem").textContent).toMatch(/3º de 3/);
    expect(within(ficha).getByRole("button", { name: "Descer Estudar" })).toBeDisabled();
    fireEvent.click(within(ficha).getByRole("button", { name: "Subir Estudar" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Subir Estudar" }));
    expect(within(ficha).getByTestId("ficha-ordem").textContent).toMatch(/1º de 3/);
    expect(within(ficha).getByRole("button", { name: "Subir Estudar" })).toBeDisabled();
    expect(store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA).map((t) => t.id)).toEqual(["c", "a", "b"]);
    fireEvent.click(within(ficha).getByRole("button", { name: "Fechar" }));
    const textos = screen.getAllByTestId("linha-tarefa").map((l) => within(l).getByRole("button", { name: /^Abrir / }).textContent);
    expect(textos.map((t) => t?.replace(/\s+/g, " ").trim())).toEqual(["Estudar", "Lavar roupa", "Ligar pro banco"]);
  });

  it("compat: o app antigo marca com {...x, feito} e apaga com filter — os campos novos sobrevivem", () => {
    const nova: TarefaDoDia = { id: "n", texto: "x", feito: false, dia: HOJE, criadaEm: "2026-10-08T13:00:00.000Z", prioridade: "alta", subtarefas: [{ id: "s", texto: "p", feito: false }] };
    const antigo = (lista: Array<{ id: string; feito: boolean }>) => lista.map((x) => (x.id === "n" ? { ...x, feito: !x.feito } : x));
    const regravada = JSON.parse(JSON.stringify(antigo([nova])))[0] as TarefaDoDia;
    expect(regravada.feito).toBe(true);
    expect(regravada.criadaEm).toBe(nova.criadaEm);
    expect(regravada.prioridade).toBe("alta");
    expect(regravada.subtarefas).toEqual(nova.subtarefas);
  });
});

/* ------------------------------------------------------------ 5) COMPROMISSOS */
describe("5) compromissos — notas e editar", () => {
  const medico: Compromisso = { id: "m", titulo: "Médico", data: HOJE, hora: "09:00", aviso: 60, local: "Clínica" };
  const trabalho: Compromisso = { id: "t", titulo: "Trabalho", data: "2026-09-28", hora: "07:30", repete: [0, 1, 2, 3, 4], aviso: 30, pula: ["2026-10-05"] };

  it("editarCompromisso: troca só o que veio; texto vazio sai do objeto; série mantém pula/ate; tirar a repetição limpa os dois", () => {
    const l1 = editarCompromisso([medico, trabalho], "m", { hora: "10:30", notas: "levar exames", local: "" });
    expect(l1[0]).toEqual({ id: "m", titulo: "Médico", data: HOJE, hora: "10:30", aviso: 60, notas: "levar exames" });
    expect(l1[1]).toBe(trabalho);
    const l2 = editarCompromisso([trabalho], "t", { titulo: "  Trabalho remoto ", repete: [0, 2, 4] });
    expect(l2[0]).toMatchObject({ titulo: "Trabalho remoto", repete: [0, 2, 4], pula: ["2026-10-05"], data: "2026-09-28" });
    const l3 = editarCompromisso([trabalho], "t", { repete: [] });
    expect(l3[0].repete).toBeUndefined();
    expect(l3[0].pula).toBeUndefined();
    expect(editarCompromisso([medico], "m", { titulo: "   " })[0].titulo).toBe("Médico");
  });

  it("compat: compromisso com notas passa no compromissosValidos de hoje E no do app antigo das lojas", () => {
    const c = { ...medico, notas: "levar exames" };
    expect(compromissosValidos([c])).toHaveLength(1);
    expect(compromissosValidosAntigo([c])).toHaveLength(1);
  });

  it("tela: lápis abre o formulário preenchido; salvar troca a hora e grava as notas; a linha mostra as notas", async () => {
    const store = criarStore({ [CHAVE_COMPROMISSOS]: [medico] });
    let lista: Compromisso[] = [medico];
    const onChange = vi.fn((nova: Compromisso[]) => { lista = nova; });
    // como a Rotina monta: a lista vive num estado do pai e volta pelo onChange
    const Pai = () => {
      const [l, setL] = useState<Compromisso[]>(lista);
      return <CompromissosDoDia dia={HOJE} lista={l} onChange={(nova) => { onChange(nova); setL(nova); }} />;
    };
    store.montar(<Pai />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Médico" }));
    const form = await screen.findByTestId("form-compromisso-editar");
    expect((within(form).getByLabelText("Nome do compromisso") as HTMLInputElement).value).toBe("Médico");
    expect((within(form).getByLabelText("Hora do compromisso") as HTMLInputElement).value).toBe("09:00");
    fireEvent.change(within(form).getByLabelText("Hora do compromisso"), { target: { value: "10:30" } });
    fireEvent.change(within(form).getByLabelText("Notas do compromisso"), { target: { value: "Levar exames\nJejum de 8h" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar alterações" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lista[0]).toMatchObject({ id: "m", hora: "10:30", notas: "Levar exames\nJejum de 8h", local: "Clínica", aviso: 60 });
    expect(toasts).toContain("Médico atualizado");

    const item = screen.getByTestId("compromisso-item");
    expect(item.textContent).toMatch(/10:30/);
    expect(within(item).getByTestId("notas-do-compromisso").textContent).toMatch(/Levar exames · Jejum de 8h/);
  });

  it("tela: compromisso que veio dos Estudos/Beleza (origem) não tem lápis — o horário é espelhado lá", () => {
    const store = criarStore({});
    store.montar(<CompromissosDoDia dia={HOJE} lista={[{ ...medico, id: "e", titulo: "Revisão", origem: "estudos" }]} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "Editar Revisão" })).toBeNull();
    expect(screen.getByRole("button", { name: "Apagar Revisão" })).toBeTruthy();
  });
});

/* --------------------------------------------------------------- 6) FINANÇAS */
describe("6) finanças — ordenar, ✓ de paga nos fixos, fixos previstos no mês futuro", () => {
  const gastos = [
    { id: "1", description: "Mercado", category: "alimentacao", value: 240, date: "2026-10-03", paymentMethod: "pix" },
    { id: "2", description: "Farmácia", category: "saude", value: 60, date: "2026-10-07", paymentMethod: "pix" },
    { id: "3", description: "Água", category: "casa", value: 90, date: "2026-10-05", paymentMethod: "debito", cardName: "nubank" },
  ];
  const fixos: FixedExpense[] = [
    { id: "f1", description: "Netflix", category: "lazer", value: 55, paymentMethod: "credito", cardName: "nubank" },
    { id: "f2", description: "Aluguel", category: "moradia", value: 1200, paymentMethod: "boleto", day: 5 },
    { id: "f3", description: "Internet", category: "casa", value: 120, paymentMethod: "debito_auto", day: 20 },
  ];

  it("ordenarGastos/ordenarFixos: só de exibição (lista nova), data mais recente primeiro, nome A→Z sem acento atrapalhar, dia com 'sem dia' no fim", () => {
    expect(ordenarGastos(gastos, "lancamento")).toBe(gastos);
    expect(ordenarGastos(gastos, "data").map((g) => g.id)).toEqual(["2", "3", "1"]);
    expect(ordenarGastos(gastos, "nome").map((g) => g.description)).toEqual(["Água", "Farmácia", "Mercado"]);
    expect(gastos.map((g) => g.id)).toEqual(["1", "2", "3"]); // a original não mexe
    expect(ordenarFixos(fixos, "dia").map((f) => f.id)).toEqual(["f2", "f3", "f1"]);
    expect(ordenarFixos(fixos, "nome").map((f) => f.description)).toEqual(["Aluguel", "Internet", "Netflix"]);
  });

  it("ExpenseTable: as pílulas reordenam a tela e NÃO regravam a lista", () => {
    const store = criarStore({});
    const setExpenses = vi.fn();
    store.montar(<ExpenseTable expenses={gastos} setExpenses={setExpenses} mes="2026-10" />);
    const nomes = () => screen.getAllByRole("button", { name: /^Editar / }).map((b) => b.getAttribute("aria-label")!.replace("Editar ", ""));
    expect(nomes()).toEqual(["Mercado", "Farmácia", "Água"]);
    fireEvent.click(within(screen.getByTestId("ordenar-gastos")).getByRole("button", { name: "Nome" }));
    expect(nomes()).toEqual(["Água", "Farmácia", "Mercado"]);
    fireEvent.click(within(screen.getByTestId("ordenar-gastos")).getByRole("button", { name: "Data" }));
    expect(nomes()).toEqual(["Farmácia", "Água", "Mercado"]);
    expect(setExpenses).not.toHaveBeenCalled();
    expect(store.ler<string>("finance-ordem-gastos")).toBe("data"); // a preferência fica guardada
  });

  it("FixedExpensesTable (mês corrente): ✓ do fixo com Dia é o paid da conta fx-<id>; sem Dia vira pagoEm do mês", () => {
    const store = criarStore({});
    let lista = [...fixos];
    let dueDays = [{ day: 5, color: "yellow", bills: [{ id: "fx-f2", name: "Aluguel", paid: false, fixedId: "f2" }] }, { day: 20, color: "slate", bills: [{ id: "fx-f3", name: "Internet", paid: true, fixedId: "f3" }] }];
    const setExpenses = vi.fn((l: FixedExpense[]) => { lista = l; });
    const setDueDays = vi.fn((d: typeof dueDays) => { dueDays = d; });
    store.montar(<FixedExpensesTable expenses={lista} setExpenses={setExpenses} dueDays={dueDays} setDueDays={setDueDays} mes="2026-10" />);
    // Internet já paga no MEU MÊS → ✓ aceso aqui
    expect(screen.getByRole("button", { name: "Desmarcar Internet como paga" })).toHaveAttribute("aria-pressed", "true");
    // Aluguel: marcar → mexe na conta, não no fixo
    fireEvent.click(screen.getByRole("button", { name: "Marcar Aluguel como paga" }));
    expect(setDueDays).toHaveBeenCalledTimes(1);
    expect(dueDays[0].bills[0].paid).toBe(true);
    expect(setExpenses).not.toHaveBeenCalled();
    // Netflix (sem Dia): marcar → pagoEm do mês no próprio fixo
    fireEvent.click(screen.getByRole("button", { name: "Marcar Netflix como paga" }));
    expect(setExpenses).toHaveBeenCalledTimes(1);
    expect(lista.find((f) => f.id === "f1")?.pagoEm).toBe("2026-10");
    expect(lista.find((f) => f.id === "f2")?.pagoEm).toBeUndefined();
  });

  it("FixedExpensesTable: pagoEm de outro mês não conta como pago (expira sozinho) e desmarcar tira o campo", () => {
    const store = criarStore({});
    let lista: FixedExpense[] = [{ ...fixos[0], pagoEm: "2026-09" }, { ...fixos[0], id: "f9", description: "Spotify", pagoEm: "2026-10" }];
    const setExpenses = vi.fn((l: FixedExpense[]) => { lista = l; });
    store.montar(<FixedExpensesTable expenses={lista} setExpenses={setExpenses} mes="2026-10" />);
    expect(screen.getByRole("button", { name: "Marcar Netflix como paga" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Spotify como paga" }));
    expect("pagoEm" in lista.find((f) => f.id === "f9")!).toBe(false);
  });

  it("projetarFixos: os do mês atual sem par (perfil + descrição) na lista do mês futuro", () => {
    const reais: FixedExpense[] = [{ id: "n1", description: "aluguel", category: "moradia", value: 1300, paymentMethod: "boleto", day: 5 }];
    expect(projetarFixos(fixos, reais).map((f) => f.id)).toEqual(["f1", "f3"]);
    expect(projetarFixos(fixos, [])).toHaveLength(3);
    expect(projetarFixos([], reais)).toEqual([]);
  });

  it("FixedExpensesTable (mês futuro): previstos aparecem só de leitura, somam no total; editar um vira item de verdade (id novo) na chave do mês", () => {
    const store = criarStore({});
    let lista: FixedExpense[] = [];
    const setExpenses = vi.fn((l: FixedExpense[]) => { lista = l; });
    store.montar(<FixedExpensesTable expenses={lista} setExpenses={setExpenses} mes="2026-11" projetados={fixos} />);
    expect(screen.getAllByTestId("fixo-previsto")).toHaveLength(3);
    expect(screen.queryAllByTestId("fixo-pago")).toHaveLength(0); // previsto não marca pago
    expect(screen.getByTestId("total-previsto").textContent).toMatch(/1\.375,00/);
    fireEvent.click(screen.getByRole("button", { name: "Editar Aluguel (previsto)" }));
    fireEvent.change(screen.getByDisplayValue("1200"), { target: { value: "1300" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(setExpenses).toHaveBeenCalledTimes(1);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ description: "Aluguel", value: 1300, day: 5, paymentMethod: "boleto" });
    expect(lista[0].id).not.toBe("f2");
  });

  it("compat: fixo com pagoEm continua um objeto com os campos de sempre — o app antigo lê igual", () => {
    const f: FixedExpense = { ...fixos[0], pagoEm: "2026-10" };
    const regravado = JSON.parse(JSON.stringify({ ...f, value: 60 })) as FixedExpense;
    expect(regravado).toMatchObject({ id: "f1", description: "Netflix", value: 60, pagoEm: "2026-10" });
  });
});
