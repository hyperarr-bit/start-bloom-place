/**
 * 28/10 — duas promessas do dono a uma cliente:
 *  1. FERIADOS NACIONAIS no calendário (chamados 14/10 e 27/10) — calculados em código pra qualquer
 *     ano; marca no dia + nome no dia aberto; linha informativa na lista do dia (não é tarefa, não
 *     conta, não avisa); interruptor "Mostrar feriados" (padrão ligado) numa chave NOVA.
 *  2. TAREFA PRA OUTRO DIA (chamado 18/10: "uma tarefa para fazer daqui a dois dias") — Hoje ·
 *     Amanhã · Escolher dia no formulário; usa o campo `dia` que já existe; futura não aparece hoje,
 *     aparece no dia dela; aviso no dia certo; editar move; prazo junto; fechar e reabrir.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_FERIADOS_PREFS, feriadoDoDia, feriadosDoAno, feriadosDoMes, mostrarFeriados, pascoa, textoDoFeriado } from "@/lib/feriados";
import { contaComoAnotacao } from "@/lib/sequencia";
import {
  CHAVE_TAREFAS_ROTINA, apareceHoje, planejarTarefas, rotuloDoDia, tarefasAgendaveis, tarefasFuturas, type TarefaDoDia,
} from "@/lib/tarefas";
import { tarefasQueFicaram } from "@/lib/ficou-de-ontem";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { TarefasDeHoje } from "@/components/tarefas/tarefas-do-dia";
import { FeriadoETarefasDoDia, InterruptorFeriados, useMarcasDoMes } from "@/components/rotina/DiaDoMes";
import { WeekCalendarWidget } from "@/components/home/widgets/WeekCalendarWidget";
import { BASES_LEMBRETES } from "@/lib/notificacoes";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

const fixarData = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };
afterEach(() => { vi.useRealTimers(); });

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
const montar = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

/* ═════════════════════════════ 1. FERIADOS ═════════════════════════════ */

describe("feriados nacionais — cálculo", () => {
  it("Páscoa: 2025 = 20/04, 2026 = 05/04, 2027 = 28/03 (e anos de borda)", () => {
    const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(k(pascoa(2025))).toBe("2025-04-20");
    expect(k(pascoa(2026))).toBe("2026-04-05");
    expect(k(pascoa(2027))).toBe("2027-03-28");
    expect(k(pascoa(2019))).toBe("2019-04-21");
    expect(k(pascoa(2038))).toBe("2038-04-25");
    expect(k(pascoa(2285))).toBe("2285-03-22"); // a mais cedo possível
  });

  it.each([
    [2025, ["2025-03-03", "2025-03-04"], "2025-04-18", "2025-06-19"],
    [2026, ["2026-02-16", "2026-02-17"], "2026-04-03", "2026-06-04"],
    [2027, ["2027-02-08", "2027-02-09"], "2027-03-26", "2027-05-27"],
  ])("móveis de %i: Carnaval, Sexta-feira Santa, Corpus Christi", (ano, carnaval, sexta, corpus) => {
    const lista = feriadosDoAno(ano);
    expect(lista.filter((f) => f.nome === "Carnaval").map((f) => f.dia)).toEqual(carnaval);
    expect(lista.find((f) => f.nome === "Sexta-feira Santa")?.dia).toBe(sexta);
    expect(lista.find((f) => f.nome === "Corpus Christi")?.dia).toBe(corpus);
  });

  it("Carnaval e Corpus Christi são ponto facultativo; Sexta-feira Santa é feriado", () => {
    expect(feriadoDoDia("2026-02-16")).toMatchObject({ nome: "Carnaval", facultativo: true });
    expect(feriadoDoDia("2026-06-04")).toMatchObject({ nome: "Corpus Christi", facultativo: true });
    expect(feriadoDoDia("2026-04-03")).toMatchObject({ nome: "Sexta-feira Santa", facultativo: false });
    expect(textoDoFeriado(feriadoDoDia("2026-02-17")!)).toBe("Ponto facultativo: Carnaval");
    expect(textoDoFeriado(feriadoDoDia("2026-11-15")!)).toBe("Feriado: Proclamação da República");
  });

  it("os 9 fixos; Consciência Negra só a partir de 2024", () => {
    const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
    for (const md of fixos) expect(feriadoDoDia(`2026-${md}`)?.facultativo).toBe(false);
    expect(feriadoDoDia("2026-11-20")?.nome).toBe("Dia da Consciência Negra");
    expect(feriadoDoDia("2023-11-20")).toBeNull();
    expect(feriadosDoAno(2026)).toHaveLength(13);
    expect([...feriadosDoMes(2026, 10).keys()]).toEqual(["2026-11-02", "2026-11-15", "2026-11-20"]);
  });

  it("dia comum ou torto = null, sem derrubar", () => {
    expect(feriadoDoDia("2026-10-28")).toBeNull();
    expect(feriadoDoDia("28/10/2026")).toBeNull();
    expect(feriadoDoDia(undefined as unknown as string)).toBeNull();
  });

  it("a preferência: ausente/torta = ligado; só { mostrar: false } desliga; a chave não conta pra sequência", () => {
    expect(mostrarFeriados(undefined)).toBe(true);
    expect(mostrarFeriados("lixo")).toBe(true);
    expect(mostrarFeriados({ mostrar: true })).toBe(true);
    expect(mostrarFeriados({ mostrar: false })).toBe(false);
    expect(CHAVE_FERIADOS_PREFS).toBe("rotina-feriados-prefs");
    expect(contaComoAnotacao(CHAVE_FERIADOS_PREFS)).toBe(false);
  });
});

/** O grid do Meu mês reduzido ao que importa: as marcas de useMarcasDoMes. */
const GradeDoMes = ({ ano, mes }: { ano: number; mes: number }) => {
  const { feriados, diasComTarefa } = useMarcasDoMes(ano, mes);
  return (
    <div>
      {[...Array(30)].map((_, i) => {
        const dia = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        return (
          <span key={dia} data-testid={`dia-${dia}`} data-feriado={feriados.has(dia) ? "true" : undefined} data-tarefa={diasComTarefa.has(dia) ? "true" : undefined} />
        );
      })}
      <InterruptorFeriados />
    </div>
  );
};

describe("feriados nas telas", () => {
  it("Meu mês de novembro marca 02, 15 e 20; o interruptor desliga e grava a chave nova", async () => {
    fixarData(new Date(2026, 9, 28, 10, 0));
    const store = criarStore();
    montar(<GradeDoMes ano={2026} mes={10} />, store);
    const marcados = () => screen.getAllByTestId(/^dia-/).filter((e) => e.dataset.feriado).map((e) => e.dataset.testid?.slice(4));
    expect(marcados()).toEqual(["2026-11-02", "2026-11-15", "2026-11-20"]);
    expect(store.dados[CHAVE_FERIADOS_PREFS]).toBeUndefined(); // padrão ligado, nada gravado
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar feriados" }));
    expect(store.dados[CHAVE_FERIADOS_PREFS]).toEqual({ mostrar: false });
    await waitFor(() => expect(marcados()).toEqual([])); // a outra tela da mesma chave recebe o aviso (microtarefa)
  });

  it("o dia aberto diz 'Feriado: Proclamação da República'", () => {
    fixarData(new Date(2026, 9, 28, 10, 0));
    montar(<FeriadoETarefasDoDia dia="2026-11-15" feriado={feriadoDoDia("2026-11-15")!} />, criarStore());
    expect(screen.getByTestId("feriado-do-dia")).toHaveTextContent("Feriado: Proclamação da República");
  });

  it("na lista do dia: linha informativa, sem caixinha, fora da contagem; nada gravado; some com o interruptor desligado", () => {
    fixarData(new Date(2026, 10, 2, 9, 0)); // Finados
    const tarefa: TarefaDoDia = { id: "a", texto: "Comprar flores", feito: false, dia: "2026-11-02" };
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [tarefa] });
    const { unmount } = montar(<TasksWidget />, store);
    const w = screen.getByTestId("tasks-widget");
    expect(within(w).getByTestId("linha-feriado")).toHaveTextContent("Feriado: Finados");
    expect(within(w).getAllByTestId("linha-tarefa")).toHaveLength(1); // o feriado não é linha de tarefa
    expect(within(w).getByTestId("contagem-tarefas")).toHaveTextContent("0/1 feitas");
    expect(within(within(w).getByTestId("linha-feriado")).queryByRole("checkbox")).toBeNull();
    expect(Object.keys(store.dados)).toEqual([CHAVE_TAREFAS_ROTINA]); // feriado não escreve nada (sequência/score não veem)
    unmount();
    store.dados[CHAVE_FERIADOS_PREFS] = { mostrar: false };
    montar(<TasksWidget />, store);
    expect(screen.queryByTestId("linha-feriado")).toBeNull();
  });

  it("feriado não vira aviso (o agendador só vê tarefas)", () => {
    expect(tarefasAgendaveis([{ chave: CHAVE_TAREFAS_ROTINA, lista: [] }], "2026-11-02")).toEqual([]);
  });

  it("Visão da Semana da Home: ponto no feriado e o nome embaixo", () => {
    fixarData(new Date(2026, 10, 16, 9, 0)); // semana de 16 a 22/11
    montar(<WeekCalendarWidget />, criarStore());
    expect(screen.getAllByTestId("ponto-feriado")).toHaveLength(1);
    expect(screen.getByTestId("feriados-da-semana")).toHaveTextContent("20/11 Feriado: Dia da Consciência Negra");
  });
});

/* ═════════════════════════ 2. TAREFA PRA OUTRO DIA ═════════════════════════ */

const QUA_28 = new Date(2026, 9, 28, 10, 0); // quarta, 28/10/2026
const HOJE = "2026-10-28";

describe("tarefa pra outro dia — regras", () => {
  const sexta: TarefaDoDia = { id: "f", texto: "Ligar pro contador", feito: false, dia: "2026-10-30", hora: "09:00", aviso: 0 };

  it("futura não aparece hoje, aparece no dia dela; não vira 'Ficou de ontem' antes da hora", () => {
    expect(apareceHoje(sexta, HOJE)).toBe(false);
    expect(apareceHoje(sexta, "2026-10-29")).toBe(false);
    expect(apareceHoje(sexta, "2026-10-30")).toBe(true);
    expect(tarefasQueFicaram([{ chave: CHAVE_TAREFAS_ROTINA, lista: [sexta] }], HOJE)).toEqual([]);
    // passou do dia sem fazer: aí sim fica de ontem (continua funcionando)
    expect(tarefasQueFicaram([{ chave: CHAVE_TAREFAS_ROTINA, lista: [sexta] }], "2026-10-31")).toHaveLength(1);
    expect(tarefasFuturas([sexta], HOJE).map((t) => t.id)).toEqual(["f"]);
  });

  it("o lembrete toca no dia dela, na hora", () => {
    const ag = tarefasAgendaveis([{ chave: CHAVE_TAREFAS_ROTINA, lista: [sexta] }], HOJE);
    expect(ag).toHaveLength(1);
    const [aviso] = planejarTarefas(ag, BASES_LEMBRETES.tarefa, QUA_28);
    expect(aviso.quando.getFullYear()).toBe(2026);
    expect(aviso.quando.getMonth()).toBe(9);
    expect(aviso.quando.getDate()).toBe(30);
    expect(aviso.quando.getHours()).toBe(9);
  });

  it("dia futuro + prazo: aparece a partir do dia dela até ser feita", () => {
    const comPrazo: TarefaDoDia = { id: "p", texto: "Entregar relatório", feito: false, dia: "2026-10-30", prazo: "2026-11-04" };
    expect(apareceHoje(comPrazo, HOJE)).toBe(false);
    expect(apareceHoje(comPrazo, "2026-10-30")).toBe(true);
    expect(apareceHoje(comPrazo, "2026-11-02")).toBe(true);
    expect(apareceHoje(comPrazo, "2026-11-06")).toBe(true); // atrasada, segue até feita
    expect(apareceHoje({ ...comPrazo, feito: true, feitoEm: "2026-11-02" }, "2026-11-03")).toBe(false);
  });

  it("o dia em palavras", () => {
    expect(rotuloDoDia("2026-10-28", HOJE)).toBe("hoje");
    expect(rotuloDoDia("2026-10-29", HOJE)).toBe("amanhã");
    expect(rotuloDoDia("2026-10-30", HOJE)).toBe("sexta, 30/10");
  });
});

describe("tarefa pra outro dia — a folha (Hoje · Amanhã · Escolher dia)", () => {
  it("padrão Hoje: grava como sempre (dia de hoje), sem campo novo", () => {
    fixarData(QUA_28);
    const store = criarStore();
    montar(<TasksWidget />, store);
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    expect(within(folha).getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "Pagar a luz" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    const [t] = store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[];
    expect(t.dia).toBe(HOJE);
    expect(Object.keys(t).sort()).toEqual(["criadaEm", "dia", "feito", "id", "texto"]);
  });

  it("Amanhã: some de hoje, a faixa diz 'Tarefa de amanhã', o aviso é de amanhã; no dia seguinte (app reaberto) ela está lá", () => {
    fixarData(QUA_28);
    const store = criarStore();
    const { unmount } = montar(<TasksWidget />, store);
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "Ir ao banco" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Amanhã" }));
    expect(folha).toHaveTextContent("Tarefa de amanhã, 29/10");
    fireEvent.change(within(folha).getByLabelText("Horário da tarefa"), { target: { value: "08:00" } });
    // 08:00 já passou HOJE, mas é amanhã: o aviso vai tocar
    expect(within(folha).getByTestId("dica-do-aviso")).toHaveTextContent("O aviso toca amanhã às 08:00.");
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    const [t] = store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[];
    expect(t).toMatchObject({ texto: "Ir ao banco", dia: "2026-10-29", hora: "08:00", aviso: 0 });
    expect(screen.queryByText("Ir ao banco")).toBeNull(); // não está na lista de hoje

    // fecha o app e reabre HOJE: continua fora de hoje
    unmount(); cleanup();
    montar(<TasksWidget />, store);
    expect(screen.queryByText("Ir ao banco")).toBeNull();
    cleanup();

    // reabre AMANHÃ: está na lista
    fixarData(new Date(2026, 9, 29, 7, 0));
    montar(<TasksWidget />, store);
    expect(within(screen.getByTestId("tasks-widget")).getAllByTestId("linha-tarefa")[0]).toHaveTextContent("Ir ao banco");
  });

  it("Escolher dia: data qualquer; na Rotina a tarefa vai pro 'Nos próximos dias' e a ficha permite mover pra outro dia", () => {
    fixarData(QUA_28);
    const store = criarStore();
    montar(<TarefasDeHoje chave={CHAVE_TAREFAS_ROTINA} onde="Rotina" />, store);
    fireEvent.click(screen.getByRole("button", { name: "Tarefa com horário ou detalhes" }));
    const folha = screen.getByTestId("folha-nova-tarefa");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "Reunião com a Ana" } });
    fireEvent.change(within(folha).getByLabelText("Escolher dia"), { target: { value: "2026-10-30" } });
    expect(within(folha).getByTestId("chip-escolher-dia")).toHaveTextContent("sex, 30/10");
    expect(folha).toHaveTextContent("Tarefa de sexta, 30/10");
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    expect((store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[])[0].dia).toBe("2026-10-30");

    expect(within(screen.getByTestId("tarefas-de-hoje")).queryByText("Reunião com a Ana")).toBeNull();
    const prox = screen.getByTestId("proximos-dias");
    expect(prox).toHaveTextContent("1 tarefa nos próximos dias");
    fireEvent.click(within(prox).getByRole("button", { name: /próximos dias/ }));
    fireEvent.click(within(prox).getByTestId("tarefa-futura"));
    const ficha = screen.getByTestId("ficha-tarefa");
    expect(ficha).toHaveTextContent("Tarefa de sexta, 30/10");
    // editar: muda pra amanhã
    fireEvent.click(within(ficha).getByRole("button", { name: "Editar tarefa" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Amanhã" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Salvar alterações" }));
    expect((store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[])[0].dia).toBe("2026-10-29");
    // e de volta pra hoje: aparece na lista
    fireEvent.click(within(ficha).getByRole("button", { name: "Editar tarefa" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Hoje" }));
    fireEvent.click(within(ficha).getByRole("button", { name: "Salvar alterações" }));
    expect((store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[])[0].dia).toBe(HOJE);
    expect(within(screen.getByTestId("tarefas-de-hoje")).getByText("Reunião com a Ana")).toBeTruthy();
  });

  it("editar sem mexer no dia não muda o `dia` (tarefa antiga com prazo, nascida ontem)", () => {
    fixarData(QUA_28);
    const antiga: TarefaDoDia = { id: "x", texto: "Relatório", feito: false, dia: "2026-10-27", prazo: "2026-10-31" };
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [antiga] });
    montar(<TarefasDeHoje chave={CHAVE_TAREFAS_ROTINA} onde="Rotina" />, store);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Relatório" }));
    const ficha = screen.getByTestId("ficha-tarefa");
    fireEvent.click(within(ficha).getByRole("button", { name: "Editar tarefa" }));
    fireEvent.change(within(ficha).getByLabelText("O que precisa fazer"), { target: { value: "Relatório final" } });
    fireEvent.click(within(ficha).getByRole("button", { name: "Salvar alterações" }));
    expect((store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[])[0]).toMatchObject({ texto: "Relatório final", dia: "2026-10-27", prazo: "2026-10-31" });
  });

  it("escolher um dia depois do prazo tira o prazo (prazo antes do dia não faz sentido)", () => {
    fixarData(QUA_28);
    const store = criarStore();
    montar(<TasksWidget />, store);
    fireEvent.click(screen.getByTestId("nova-tarefa"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "Prova" } });
    fireEvent.change(within(folha).getByLabelText("Prazo da tarefa"), { target: { value: "2026-10-29" } });
    fireEvent.change(within(folha).getByLabelText("Escolher dia"), { target: { value: "2026-11-03" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    const [t] = store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[];
    expect(t.dia).toBe("2026-11-03");
    expect(t.prazo).toBeUndefined();
  });

  it("no Meu mês: o dia da tarefa ganha o ponto, o dia aberto lista a tarefa e cria tarefa naquele dia", () => {
    fixarData(QUA_28);
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [{ id: "f", texto: "Ligar pro contador", feito: false, dia: "2026-10-30" }] });
    montar(<><GradeDoMes ano={2026} mes={9} /><FeriadoETarefasDoDia dia="2026-10-30" /></>, store);
    expect(screen.getByTestId("dia-2026-10-30").dataset.tarefa).toBe("true");
    expect(screen.getByTestId("dia-2026-10-28").dataset.tarefa).toBeUndefined();
    expect(screen.getByTestId("tarefas-do-dia-aberto")).toHaveTextContent("Ligar pro contador");
    fireEvent.click(screen.getByTestId("tarefa-pra-esse-dia"));
    const folha = screen.getByTestId("folha-nova-tarefa");
    expect(folha).toHaveTextContent("Tarefa de sexta, 30/10");
    fireEvent.change(within(folha).getByLabelText("O que precisa fazer"), { target: { value: "Levar documentos" } });
    fireEvent.click(within(folha).getByRole("button", { name: "Salvar tarefa" }));
    const salvas = store.dados[CHAVE_TAREFAS_ROTINA] as TarefaDoDia[];
    expect(salvas.map((t) => [t.texto, t.dia])).toEqual([["Ligar pro contador", "2026-10-30"], ["Levar documentos", "2026-10-30"]]);
  });
});
