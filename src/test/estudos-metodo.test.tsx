/**
 * MÉTODO DE ESTUDO (22/09, dono): "Time Blocking → Pomodoro → Active Recall →
 * Feynman → Repetição espaçada". A costura entre o que já existia, com teste.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import {
  aprendizadoDeFeynman, blocoParaCompromisso, blocosDeEstudo, cartoesDaSessao, compromissoDeRevisaoDiaria, lembreteDiario,
  proximaData, resumoDaSemana, revisaoDeAmanha, CHAVE_SESSOES, cartoesSocraticos, PERGUNTAS_SOCRATICAS, intervalosDasRespostas, proximoPasso, rotuloIntervalo,
} from "@/components/estudos/metodo-contas";
import { Metodo } from "@/components/estudos/Metodo";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";

vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true, isGuest: true, fetchKey: async () => null,
  };
  return { dados, valor };
};

describe("metodo.ts", () => {
  it("bloco de tempo vira compromisso repetido, na próxima data dos dias marcados", () => {
    // 22/09/2026 é terça; seg/qua/sex a partir de hoje → quarta 23/09
    const c = blocoParaCompromisso({ cursoId: "1", cursoNome: "Inglês", hora: "19:30", dias: [4, 0, 2], aviso: 30 }, "b1", new Date(2026, 8, 22, 10));
    expect(c).toMatchObject({ titulo: "Estudar Inglês", data: "2026-09-23", hora: "19:30", repete: [0, 2, 4], aviso: 30, origem: "estudos", ref: "1" });
    expect(proximaData([1], new Date(2026, 8, 22))).toBe("2026-09-22"); // terça é hoje mesmo
    expect(proximaData([6], new Date(2026, 8, 22))).toBe("2026-09-27");
    expect(blocosDeEstudo([c, { id: "x", titulo: "Médico", data: "2026-09-29", hora: "09:00" }])).toHaveLength(1);
  });

  it("lembrete diário de revisão é um compromisso todo dia, na hora, sem antecedência", () => {
    const l = compromissoDeRevisaoDiaria("20:00", "r1", new Date(2026, 8, 22));
    expect(l).toMatchObject({ titulo: "Revisão dos flashcards", data: "2026-09-22", hora: "20:00", repete: [0, 1, 2, 3, 4, 5, 6], aviso: 0, origem: "estudos" });
    expect(lembreteDiario([l])?.id).toBe("r1");
    expect(blocosDeEstudo([l])).toHaveLength(0); // não é bloco de estudo
  });

  it("cartões da sessão: vencidos primeiro, depois os mais recentes, no máximo 5", () => {
    const mapa = { "1": [
      { id: "a", data: "2026-09-10", aprendi: "A" }, { id: "b", data: "2026-09-20", aprendi: "B" }, { id: "c", data: "2026-09-21", aprendi: "C" },
      { id: "d", data: "2026-09-15", aprendi: "D" }, { id: "e", data: "2026-09-16", aprendi: "E" }, { id: "f", data: "2026-09-17", aprendi: "F" },
    ], "2": [{ id: "z", data: "2026-09-01", aprendi: "outro curso" }] };
    const revisoes = { a: { proxima: "2026-09-30", degrau: 3, vezes: 2 }, b: { proxima: "2026-09-21", degrau: 0, vezes: 1 } };
    const fila = cartoesDaSessao(mapa, "1", "Inglês", revisoes, "2026-09-22");
    expect(fila.map((x) => x.id)).toEqual(["d", "e", "f", "b", "c"]); // sem estado = vence no dia seguinte ao registro; ordem = mais atrasado primeiro
    expect(fila.every((x) => x.cursoId === "1")).toBe(true);
  });

  it("Feynman vira cartão com pergunta 'explique…'; travar gera revisão amanhã", () => {
    const a = aprendizadoDeFeynman("present perfect", "É o passado que ainda vale hoje", true, "since vs for", "f1", "2026-09-22");
    expect(a).toMatchObject({ referencia: "Feynman", aprendi: "É o passado que ainda vale hoje", porque: "Travei em: since vs for", pergunta: "Explique com suas palavras: present perfect" });
    const r = revisaoDeAmanha("Inglês", "present perfect", "19:30", "r2", new Date(2026, 8, 22));
    expect(r).toMatchObject({ titulo: "Revisar Inglês: present perfect", data: "2026-09-23", hora: "19:30", aviso: 60, origem: "estudos" });
  });

  it("resumo da semana soma só a semana corrente", () => {
    const s = (data: string, feitos: number, acertos: number, pomodoros: number) => ({ id: data, data, cursoId: "1", cursoNome: "x", recall: { feitos, acertos }, pomodoros });
    const r = resumoDaSemana([s("2026-09-21", 5, 3, 2), s("2026-09-22", 4, 4, 1), s("2026-09-13", 9, 9, 9)], new Date(2026, 8, 22));
    expect(r).toEqual({ sessoes: 2, pomodoros: 3, cartoes: 9, lembrados: 7 });
  });
});

describe("referências (Anki/RemNote)", () => {
  it("cada botão diz quando o cartão volta, pela mesma régua que grava", () => {
    expect(intervalosDasRespostas(undefined, "2026-09-22")).toEqual({ nao: "amanhã", quase: "3 dias", sim: "7 dias" });
    expect(intervalosDasRespostas({ proxima: "2026-09-22", degrau: 3, vezes: 4 }, "2026-09-22")).toEqual({ nao: "amanhã", quase: "3 dias", sim: "1 mês" });
    expect(rotuloIntervalo(14)).toBe("2 sem");
    expect(rotuloIntervalo(120)).toBe("4 meses");
  });
  it("próximo passo: curso > revisão vencida > horário > sessão", () => {
    expect(proximoPasso({ temCurso: false, venceHoje: 3, blocos: 0, sessoesHoje: 0 }).acao).toBe("cursos");
    expect(proximoPasso({ temCurso: true, venceHoje: 3, blocos: 0, sessoesHoje: 0 })).toMatchObject({ acao: "revisao", botao: "Revisar agora" });
    expect(proximoPasso({ temCurso: true, venceHoje: 0, blocos: 0, sessoesHoje: 0 }).acao).toBe("blocos");
    expect(proximoPasso({ temCurso: true, venceHoje: 0, blocos: 2, sessoesHoje: 0 }).botao).toBe("Começar sessão");
  });
});

describe("socrático", () => {
  it("seis perguntas; cada resposta vira cartão, vazia não; a última vira 'dúvida em aberto'", () => {
    expect(PERGUNTAS_SOCRATICAS).toHaveLength(6);
    const r = ["Juros sobre juros", "", "R$100 a 10% vira 121 em 2 anos", "", "", "Como fica com aporte mensal?"];
    const c = cartoesSocraticos(" juros compostos ", r, "s1", "2026-09-22");
    expect(c.map((x) => x.id)).toEqual(["s1-0", "s1-2", "s1-5"]);
    expect(c[0]).toMatchObject({ pergunta: "O que é juros compostos, numa frase sua?", aprendi: "Juros sobre juros", referencia: "Socrático · Clareza", data: "2026-09-22" });
    expect(c[2]).toMatchObject({ pergunta: "Dúvida em aberto sobre juros compostos", referencia: "Socrático · A pergunta que falta" });
  });
});

describe("Metodo (tela)", () => {
  const cursos = [{ id: "1", name: "Inglês" }];
  const mapa = { "1": [{ id: "a1", data: "2026-09-01", aprendi: "Present perfect = passado que ainda vale", pergunta: "Quando usar present perfect?" }] };
  const pomodoro = { tempo: 25 * 60, rodando: false, concluidos: 3, iniciar: vi.fn(), pausar: vi.fn(), definir: vi.fn() };

  it("cria um bloco de tempo que vira compromisso da Rotina", () => {
    const store = criarStore();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={vi.fn()} onRegistrar={vi.fn()} pomodoro={pomodoro} /></UserDataContext.Provider>);
    fireEvent.click(screen.getByTestId("ferramenta-blocos"));
    fireEvent.click(screen.getByTestId("novo-bloco"));
    fireEvent.change(screen.getByLabelText("Hora do bloco"), { target: { value: "19:30" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar bloco/i }));
    const lista = store.dados[CHAVE_COMPROMISSOS] as Compromisso[];
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ titulo: "Estudar Inglês", hora: "19:30", repete: [0, 2, 4], origem: "estudos", ref: "1" });
    expect(screen.getByTestId("bloco-item")).toHaveTextContent("seg, qua, sex");
  });

  it("sessão inteira: recall responde o cartão, pomodoro, Feynman registra o aprendizado, revisões e histórico", () => {
    const store = criarStore();
    const onResponder = vi.fn();
    const onRegistrar = vi.fn();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={onResponder} onRegistrar={onRegistrar} pomodoro={pomodoro} /></UserDataContext.Provider>);
    fireEvent.click(screen.getByTestId("comecar-sessao"));
    const recall = screen.getByTestId("etapa-recall");
    expect(recall).toHaveTextContent("Quando usar present perfect?");
    fireEvent.click(within(recall).getByRole("button", { name: /Mostrar resposta/i }));
    fireEvent.click(within(recall).getByRole("button", { name: /Lembrei/i }));
    expect(onResponder).toHaveBeenCalledWith("a1", "sim");
    expect(recall).toHaveTextContent("1 de 1 lembrados");
    fireEvent.click(screen.getByTestId("ir-pomodoro"));
    fireEvent.click(within(screen.getByTestId("etapa-pomodoro")).getByRole("button", { name: /Iniciar/i }));
    expect(pomodoro.iniciar).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ir-feynman"));
    fireEvent.change(screen.getByLabelText("Tema"), { target: { value: "present perfect" } });
    fireEvent.change(screen.getByLabelText("Explicação"), { target: { value: "É o passado que ainda conta agora" } });
    fireEvent.click(screen.getByRole("button", { name: /Travei em algo/i }));
    fireEvent.change(screen.getByLabelText("Onde travou"), { target: { value: "since vs for" } });
    fireEvent.click(screen.getByTestId("salvar-feynman"));
    expect(onRegistrar).toHaveBeenCalledWith("1", expect.objectContaining({ pergunta: "Explique com suas palavras: present perfect", porque: "Travei em: since vs for" }));
    // travou → compromisso de revisão amanhã
    expect((store.dados[CHAVE_COMPROMISSOS] as Compromisso[]).some((c) => /^Revisar Inglês: present perfect/.test(c.titulo))).toBe(true);
    const rev = screen.getByTestId("etapa-revisoes");
    expect(rev).toHaveTextContent("1 de 1");
    fireEvent.click(screen.getByTestId("lembrete-diario"));
    expect((store.dados[CHAVE_COMPROMISSOS] as Compromisso[]).some((c) => c.titulo === "Revisão dos flashcards")).toBe(true);
    fireEvent.click(screen.getByTestId("terminar-sessao"));
    const sessoes = store.dados[CHAVE_SESSOES] as { recall: { feitos: number; acertos: number }; travei?: boolean }[];
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]).toMatchObject({ recall: { feitos: 1, acertos: 1 }, travei: true, cursoNome: "Inglês" });
    expect(screen.getByTestId("historico-sessoes")).toHaveTextContent("Inglês · present perfect · 1/1 lembrados");
  });

  it("sem curso: explica e oferece o caminho", () => {
    const store = criarStore();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={[]} mapa={{}} revisoes={{}} onResponder={vi.fn()} onRegistrar={vi.fn()} pomodoro={pomodoro} onIrParaCursos={vi.fn()} /></UserDataContext.Provider>);
    expect(screen.getByText(/precisa de um curso/i)).toBeInTheDocument();
    expect(screen.queryByTestId("comecar-sessao")).not.toBeInTheDocument();
    // o Pomodoro funciona mesmo sem curso
    fireEvent.click(screen.getByTestId("ferramenta-pomodoro"));
    expect(screen.getByTestId("painel-pomodoro")).toHaveTextContent("25:00");
  });

  it("as 6 técnicas aparecem como botões; cada uma abre a ferramenta na própria aba", () => {
    const store = criarStore();
    const onIrPara = vi.fn();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={vi.fn()} onRegistrar={vi.fn()} pomodoro={pomodoro} onIrPara={onIrPara} /></UserDataContext.Provider>);
    for (const id of ["blocos", "pomodoro", "recall", "feynman", "revisao", "socratico"]) {
      fireEvent.click(screen.getByTestId(`ferramenta-${id}`));
      expect(screen.getByTestId(`painel-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`ferramenta-${id}`)).toHaveAttribute("aria-pressed", "true");
    }
    // tocar de novo fecha
    fireEvent.click(screen.getByTestId("ferramenta-socratico"));
    expect(screen.queryByTestId("painel-socratico")).not.toBeInTheDocument();
    // pomodoro leva pra aba dele
    fireEvent.click(screen.getByTestId("ferramenta-pomodoro"));
    fireEvent.click(screen.getByRole("button", { name: /Abrir a aba Pomodoro/i }));
    expect(onIrPara).toHaveBeenCalledWith("pomodoro");
  });

  it("recall avulso responde o cartão do curso", () => {
    const store = criarStore();
    const onResponder = vi.fn();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={onResponder} onRegistrar={vi.fn()} pomodoro={pomodoro} /></UserDataContext.Provider>);
    fireEvent.click(screen.getByTestId("ferramenta-recall"));
    const painel = screen.getByTestId("painel-recall");
    expect(painel).toHaveTextContent("Quando usar present perfect?");
    fireEvent.click(within(painel).getByRole("button", { name: /Mostrar resposta/i }));
    fireEvent.click(within(painel).getByRole("button", { name: /Quase/i }));
    expect(onResponder).toHaveBeenCalledWith("a1", "quase");
    expect(painel).toHaveTextContent("0 de 1 lembrados");
  });

  it("Feynman avulso salva o cartão sem abrir a sessão", () => {
    const store = criarStore();
    const onRegistrar = vi.fn();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={vi.fn()} onRegistrar={onRegistrar} pomodoro={pomodoro} /></UserDataContext.Provider>);
    fireEvent.click(screen.getByTestId("ferramenta-feynman"));
    fireEvent.change(screen.getByLabelText("Tema"), { target: { value: "used to" } });
    fireEvent.change(screen.getByLabelText("Explicação"), { target: { value: "Hábito do passado que acabou" } });
    fireEvent.click(screen.getByRole("button", { name: /Consegui explicar/i }));
    fireEvent.click(screen.getByTestId("salvar-feynman-avulso"));
    expect(onRegistrar).toHaveBeenCalledWith("1", expect.objectContaining({ referencia: "Feynman", pergunta: "Explique com suas palavras: used to" }));
    expect(store.dados[CHAVE_COMPROMISSOS]).toBeUndefined(); // não travou: sem revisão extra
  });

  it("socrático: uma pergunta por vez, pular funciona, respostas viram cartões do curso", () => {
    const store = criarStore();
    const onRegistrar = vi.fn();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={vi.fn()} onRegistrar={onRegistrar} pomodoro={pomodoro} /></UserDataContext.Provider>);
    fireEvent.click(screen.getByTestId("ferramenta-socratico"));
    fireEvent.change(screen.getByLabelText("Tema do socrático"), { target: { value: "fotossíntese" } });
    fireEvent.click(screen.getByTestId("comecar-socratico"));
    expect(screen.getByTestId("socratico-pergunta")).toHaveTextContent("O que é fotossíntese, numa frase sua?");
    fireEvent.change(screen.getByLabelText("Resposta"), { target: { value: "Planta faz açúcar com luz" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(screen.getByTestId("socratico-fim")).toHaveTextContent("Planta faz açúcar com luz");
    fireEvent.click(screen.getByTestId("salvar-socratico"));
    expect(onRegistrar).toHaveBeenCalledTimes(1);
    expect(onRegistrar).toHaveBeenCalledWith("1", expect.objectContaining({ referencia: "Socrático · Clareza", aprendi: "Planta faz açúcar com luz" }));
  });

  it("recall mostra quando cada resposta volta e aceita o teclado (espaço, 3)", () => {
    const store = criarStore();
    const onResponder = vi.fn();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={onResponder} onRegistrar={vi.fn()} pomodoro={pomodoro} /></UserDataContext.Provider>);
    fireEvent.click(screen.getByTestId("ferramenta-recall"));
    fireEvent.keyDown(window, { key: " " });
    const painel = screen.getByTestId("painel-recall");
    expect(painel).toHaveTextContent("volta amanhã");
    expect(painel).toHaveTextContent("volta em 7 dias");
    fireEvent.keyDown(window, { key: "3" });
    expect(onResponder).toHaveBeenCalledWith("a1", "sim");
  });

  it("próximo passo no topo abre a técnica certa", () => {
    const store = criarStore();
    render(<UserDataContext.Provider value={store.valor}><Metodo cursos={cursos} mapa={mapa} revisoes={{}} onResponder={vi.fn()} onRegistrar={vi.fn()} pomodoro={pomodoro} /></UserDataContext.Provider>);
    // o cartão a1 é de 01/09, sem estado → vencido → revisar
    expect(screen.getByTestId("proximo-passo")).toHaveTextContent("1 cartão vence hoje");
    fireEvent.click(within(screen.getByTestId("proximo-passo")).getByRole("button", { name: "Revisar agora" }));
    expect(screen.getByTestId("painel-revisao")).toBeInTheDocument();
  });
});
