/**
 * Varredura da demo (26/09) — Rotina, Desenvolvimento, Carreira e Estudos.
 * Cada bloco trava um defeito que foi reproduzido na /preview antes do conserto:
 * carta que abria na véspera e se apagava num toque, humor sem barras,
 * sequência zerada de manhã e que não desmarcava, revisão que sumia no
 * domingo, quadradinho de 4 px, "0 cartões" depois de revisar, datas em
 * AAAA-MM-DD, apagar sem volta e a seta ← que caía no login.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { responder } from "@/components/estudos/revisao";
import { ultimaRevisao } from "@/components/estudos/revisao";
import { resumoDaSemana } from "@/components/estudos/metodo-contas";
import { BlocoDeFases } from "@/components/fases/BlocoDeFases";
import { HabitsWidget } from "@/components/home/widgets/HabitsWidget";
import DesenvolvimentoPessoal, { cartaPodeAbrir, amanhaLocal } from "@/pages/DesenvolvimentoPessoal";
import Rotina, { sequenciaDoCard, marcaDoDia, semanaDaRevisao, lerRevisaoDaSemana } from "@/pages/Rotina";
import Estudos, { corDaProva, ordenarProvas, provaPassou } from "@/pages/Estudos";
import Carreira, { dataCurtaCarreira } from "@/pages/Carreira";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/avaliacao", () => ({ pedirAvaliacaoSePuder: async () => false }));
vi.mock("@/hooks/use-life-hub-data", () => ({ useLifeHubData: () => ({ tasksCompleted: 0, tasksTotal: 1 }) }));
// O toast com Desfazer: guarda a função de desfazer pra o teste chamar.
const desfazeres: Array<() => void> = [];
vi.mock("@/lib/desfazer", () => ({ avisarApagado: (_t: string, desfazer: () => void) => { desfazeres.push(desfazer); } }));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { "spotlight-done-metas": "true", "spotlight-done-rotina": "true", ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

/** Mostra onde a navegação parou (pra seta ←). */
const Onde = () => <p data-testid="onde">{useLocation().pathname}</p>;
const montar = (store: ReturnType<typeof criarStore>, rota: string, Pagina: React.ComponentType) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <UserDataContext.Provider value={store.valor}>
        <Routes>
          <Route path={rota.split("?")[0]} element={<Pagina />} />
          <Route path="*" element={<Onde />} />
        </Routes>
      </UserDataContext.Provider>
    </MemoryRouter>,
  );

/** Relógio só do Date (os timers do React seguem reais). */
const fixarData = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };
afterEach(() => { vi.useRealTimers(); desfazeres.length = 0; window.history.replaceState({}, "", "/"); });

const dias = (fim: Date, n: number) => Array.from({ length: n }, (_, i) => localDayKey(new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - i)));

// ─────────────────────────────── 1 · CARTA ───────────────────────────────
describe("Carta pro futuro", () => {
  it("abre no DIA local escolhido — não na véspera às 21h", () => {
    expect(cartaPodeAbrir("2026-12-25", "2026-12-24")).toBe(false);
    expect(cartaPodeAbrir("2026-12-25", "2026-12-25")).toBe(true);
    expect(cartaPodeAbrir("2026-12-25", "2027-01-02")).toBe(true);
    expect(cartaPodeAbrir("", "2026-12-25")).toBe(false);
    expect(cartaPodeAbrir(undefined, "2026-12-25")).toBe(false);
    expect(cartaPodeAbrir("2020-01-01T10:00:00Z")).toBe(true); // formato antigo: não fica trancada
    expect(amanhaLocal(new Date(2026, 8, 26, 23, 30))).toBe("2026-09-27");
    expect(amanhaLocal(new Date(2026, 11, 31, 22, 0))).toBe("2027-01-01");
  });

  it("não sela no passado, mostra as datas certas e só apaga com dois toques", () => {
    fixarData(new Date(2026, 8, 26, 10, 0));
    window.history.replaceState({}, "", "/preview/desenvolvimento?tab=carta");
    const store = criarStore();
    montar(store, "/preview/desenvolvimento", DesenvolvimentoPessoal);
    const campoData = screen.getByLabelText("Abrir em") as HTMLInputElement;
    expect(campoData.min).toBe("2026-09-27");
    fireEvent.change(screen.getByPlaceholderText("Querido(a) eu do futuro..."), { target: { value: "Guardar 10 mil" } });
    fireEvent.change(campoData, { target: { value: "2026-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: /Selar carta/ }));
    expect(screen.queryByText("Carta selada!")).not.toBeInTheDocument();
    expect((store.dados["dp-future-letter"] as { text?: string } | undefined)?.text ?? "").toBe("");

    fireEvent.change(screen.getByLabelText("Abrir em"), { target: { value: "2026-12-25" } });
    fireEvent.click(screen.getByRole("button", { name: /Selar carta/ }));
    expect(screen.getByText("Carta selada!")).toBeInTheDocument();
    expect(screen.getByText("Será aberta em: 25/12/2026")).toBeInTheDocument();
    expect(store.dados["dp-future-letter"]).toEqual({ text: "Guardar 10 mil", openDate: "2026-12-25", written: "2026-09-26" });

    // 1º toque: só pergunta — a carta continua selada
    fireEvent.click(screen.getByRole("button", { name: "Escrever nova carta" }));
    expect(screen.getByText(/ainda não foi aberta/)).toBeInTheDocument();
    expect((store.dados["dp-future-letter"] as { text: string }).text).toBe("Guardar 10 mil");
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    expect(screen.getByText("Carta selada!")).toBeInTheDocument();
    // 2º toque confirmado: apaga, e o rascunho NÃO traz o texto selado
    fireEvent.click(screen.getByRole("button", { name: "Escrever nova carta" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar a carta e escrever outra" }));
    expect((store.dados["dp-future-letter"] as { text: string }).text).toBe("");
    expect((screen.getByPlaceholderText("Querido(a) eu do futuro...") as HTMLTextAreaElement).value).toBe("");
  });

  it("carta aberta mostra 'Escrita em' no dia em que foi escrita", () => {
    fixarData(new Date(2026, 11, 25, 0, 5));
    window.history.replaceState({}, "", "/preview/desenvolvimento?tab=carta");
    const store = criarStore({ "dp-future-letter": { text: "Oi, eu do futuro", openDate: "2026-12-25", written: "2026-09-26" } });
    montar(store, "/preview/desenvolvimento", DesenvolvimentoPessoal);
    expect(screen.getByText("Oi, eu do futuro")).toBeInTheDocument();
    expect(screen.getByText("Escrita em: 26/09/2026")).toBeInTheDocument();
  });
});

// ──────────────────── 3 · HUMOR  ·  7 · emojis  ·  6 · desafio ────────────────────
describe("Desenvolvimento: humor e desafios", () => {
  it("coluna do gráfico tem altura (h-full) e a barra mora numa faixa flex-1 — senão a % resolve contra 'auto'", () => {
    window.history.replaceState({}, "", "/preview/desenvolvimento?tab=humor");
    const hoje = localDayKey();
    montar(criarStore({ "dp-mood-log": { [hoje]: 5 } }), "/preview/desenvolvimento", DesenvolvimentoPessoal);
    const colunas = screen.getAllByTestId("humor-coluna");
    expect(colunas).toHaveLength(14);
    const ultima = colunas[13];
    expect(ultima.className).toContain("h-full");
    const faixa = ultima.firstElementChild as HTMLElement;
    expect(faixa.className).toContain("flex-1");
    expect((faixa.firstElementChild as HTMLElement).style.height).toBe("100%");
    // emojis menores até o sm: cabem nos 296 px do card a 360
    const otimo = screen.getByRole("button", { name: "Ótimo" });
    expect(otimo.className).toContain("text-2xl");
    expect(otimo.className).toContain("sm:text-3xl");
    expect(otimo).toHaveAttribute("aria-pressed", "true");
  });

  it("desafio de 30 dias só sai no segundo toque", () => {
    window.history.replaceState({}, "", "/preview/desenvolvimento?tab=desafios");
    const store = criarStore({ "dp-challenges": [{ name: "Ler 10 páginas", days: Array(30).fill(false).map((_, i) => i < 3) }] });
    montar(store, "/preview/desenvolvimento", DesenvolvimentoPessoal);
    fireEvent.click(screen.getByRole("button", { name: "Apagar o desafio Ler 10 páginas" }));
    expect(store.dados["dp-challenges"]).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: apagar o desafio Ler 10 páginas/ }));
    expect(store.dados["dp-challenges"]).toHaveLength(0);
  });
});

// ─────────────────────────── 4 · SEQUÊNCIA ───────────────────────────
describe("Rotina: sequência do card CONSISTÊNCIA", () => {
  it("hoje sem marca conta até ontem (mesma conta do lembrete); por hábito também", () => {
    fixarData(new Date(2026, 8, 27, 8, 0)); // domingo de manhã
    const ontem = new Date(2026, 8, 26);
    const log = Object.fromEntries(dias(ontem, 41).map((d, i) => [d, i % 2 ? true : 1]));
    expect(sequenciaDoCard(log)).toBe(41);
    expect(sequenciaDoCard({ ...log, "2026-09-27": true })).toBe(42);
    const porHabito = Object.fromEntries(dias(ontem, 5).map((d) => [d, ["Ler"]]));
    expect(sequenciaDoCard(log, porHabito, "Ler")).toBe(5);
    expect(sequenciaDoCard(log, porHabito, "Treinar")).toBe(0);
    expect(sequenciaDoCard({ "2026-09-25": true })).toBe(0); // buraco ontem = acabou
  });

  it("marca do dia segue a grade: marca, não rebaixa nível, e desmarca quando nada sobra", () => {
    expect(marcaDoDia({}, "2026-09-27", 1)).toEqual({ "2026-09-27": true });
    const comNivel = { "2026-09-27": 3 };
    expect(marcaDoDia(comNivel, "2026-09-27", 2)).toBe(comNivel);
    expect(marcaDoDia({ "2026-09-26": true, "2026-09-27": true }, "2026-09-27", 0)).toEqual({ "2026-09-26": true });
    const semHoje = { "2026-09-26": true };
    expect(marcaDoDia(semHoje, "2026-09-27", 0)).toBe(semHoje);
  });

  it("na tela: de manhã mostra 41; marcar vira 42; desmarcar volta a 41 e tira o dia do heatmap", () => {
    fixarData(new Date(2026, 8, 27, 8, 0)); // domingo
    const ontem = new Date(2026, 8, 26);
    const store = criarStore({
      "rotina-habits": ["Ler"],
      "rotina-habits-week": "2026-09-21",
      "rotina-habits-checked": {},
      "heatmap-log": Object.fromEntries(dias(ontem, 41).map((d) => [d, true])),
    });
    montar(store, "/preview/rotina", Rotina);
    expect(screen.getByText("41 dias seguidos")).toBeInTheDocument();
    const linhaDomingo = screen.getByText("DOMINGO").closest("tr")!;
    const caixa = within(linhaDomingo).getByRole("checkbox");
    fireEvent.click(caixa);
    expect(screen.getByText("42 dias seguidos")).toBeInTheDocument();
    expect((store.dados["heatmap-log"] as Record<string, unknown>)["2026-09-27"]).toBe(true);
    fireEvent.click(caixa);
    expect(screen.getByText("41 dias seguidos")).toBeInTheDocument();
    expect(store.dados["heatmap-log"]).not.toHaveProperty("2026-09-27");
  });

  it("apagar hábito pede o segundo toque (leva as marcações da semana)", () => {
    const store = criarStore({ "rotina-habits": ["Ler", "Treinar"] });
    montar(store, "/preview/rotina", Rotina);
    fireEvent.click(screen.getByRole("button", { name: "Apagar o hábito Treinar" }));
    expect(store.dados["rotina-habits"] ?? ["Ler", "Treinar"]).toEqual(["Ler", "Treinar"]);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: apagar o hábito Treinar/ }));
    expect(store.dados["rotina-habits"]).toEqual(["Ler"]);
  });
});

// ─────────────────────────── 5 · REVISÃO ───────────────────────────
describe("Rotina: revisão da semana de segunda a domingo", () => {
  it("sábado e domingo são a MESMA semana; a chave antiga (domingo anterior) ainda é lida", () => {
    fixarData(new Date(2026, 8, 26, 20, 0)); // sábado
    expect(semanaDaRevisao(0)).toMatchObject({ chave: "2026-09-21", chaveAntiga: "2026-09-20" });
    fixarData(new Date(2026, 8, 27, 10, 0)); // domingo
    expect(semanaDaRevisao(0).chave).toBe("2026-09-21");
    fixarData(new Date(2026, 8, 28, 9, 0)); // segunda: semana nova, a de antes na seta
    expect(semanaDaRevisao(0).chave).toBe("2026-09-28");
    expect(semanaDaRevisao(-1).chave).toBe("2026-09-21");
    const antiga = { wins: "Treinei 4x", improve: "", focus: "", rating: 4 };
    expect(lerRevisaoDaSemana({ "2026-09-20": antiga }, -1)).toEqual(antiga);
    const nova = { ...antiga, wins: "Treinei 5x" };
    expect(lerRevisaoDaSemana({ "2026-09-20": antiga, "2026-09-21": nova }, -1)).toEqual(nova);
    expect(lerRevisaoDaSemana(undefined, 0)).toEqual({ wins: "", improve: "", focus: "", rating: 0 });
  });

  it("na tela: revisão gravada no formato antigo aparece no domingo e a edição grava na chave nova", () => {
    fixarData(new Date(2026, 8, 27, 10, 0)); // domingo
    // a aba vem do window.location (o MemoryRouter não mexe nele)
    window.history.replaceState({}, "", "/preview/rotina?aba=revisao");
    const antiga = { wins: "Treinei 4x e li 2 livros", improve: "", focus: "", rating: 4 };
    const store = criarStore({ "weekly-reviews": { "2026-09-20": antiga } });
    montar(store, "/preview/rotina", Rotina);
    expect(screen.getByText("Esta semana")).toBeInTheDocument();
    const vitorias = screen.getByPlaceholderText("O que conquistei...") as HTMLTextAreaElement;
    expect(vitorias.value).toBe("Treinei 4x e li 2 livros");
    fireEvent.change(screen.getByPlaceholderText("Onde posso melhorar..."), { target: { value: "Dormir cedo" } });
    const salvas = store.dados["weekly-reviews"] as Record<string, typeof antiga>;
    expect(salvas["2026-09-21"]).toEqual({ ...antiga, improve: "Dormir cedo" });
    expect(salvas["2026-09-20"]).toEqual(antiga); // a antiga fica como estava
  });
});

// ─────────────────── 7 · FOCO a 360 · 10 · prioridade / notas ───────────────────
describe("Rotina: foco, tarefas e mês", () => {
  it("notas do dia com a data em dd/mm (a chave segue AAAA-MM-DD)", () => {
    fixarData(new Date(2026, 8, 26, 10, 0));
    window.history.replaceState({}, "", "/preview/rotina?aba=mes");
    montar(criarStore(), "/preview/rotina", Rotina);
    fireEvent.click(screen.getAllByRole("button", { name: "28" })[0]);
    expect(screen.getByText("📝 Notas — 28/09")).toBeInTheDocument();
  });

  it("Atividade em linha própria; prioridade 'média' com acento; seta ← da demo vai pra LP", () => {
    window.history.replaceState({}, "", "/preview/rotina?aba=foco");
    const store = criarStore({ "todo-list": [{ id: "1", text: "Responder e-mail", priority: "media", done: false }] });
    montar(store, "/preview/rotina", Rotina);
    const atividade = screen.getByPlaceholderText("Atividade");
    expect(atividade.className).toContain("w-full");
    // as horas moram na linha de baixo, não ao lado do nome
    expect(screen.getByLabelText("Começa às").parentElement).not.toBe(atividade.parentElement);
    expect(screen.getByText("média")).toBeInTheDocument();
    expect(screen.queryByText("media")).not.toBeInTheDocument();
    expect((store.dados["todo-list"] as { priority: string }[])[0].priority).toBe("media"); // valor gravado igual
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/lp");
  });
});

// ─────────────────────────── ESTUDOS ───────────────────────────
describe("Estudos", () => {
  it("provas: cor forte vira a clara do mesmo tom; passadas/feitas no fim", () => {
    expect(corDaProva("bg-blue-500")).toContain("bg-blue-50 ");
    expect(corDaProva("bg-green-500")).toContain("bg-green-50 ");
    const paleta = corDaProva("bg-pink-50 dark:bg-pink-950/20 border-l-4 border-l-pink-400");
    expect(paleta).toContain("bg-pink-50 ");
    const existente = "border-l-4 border-l-purple-400 bg-purple-50 dark:bg-purple-950/20";
    expect(corDaProva(existente)).toBe(existente);
    expect(corDaProva("bg-indigo-200 dark:bg-indigo-500/20 border-indigo-300", 1)).toContain("bg-blue-50 "); // tom fora da paleta: pela posição
    expect(corDaProva(undefined, 0)).toContain("bg-pink-50 ");
    const hoje = "2026-09-26";
    const l = [
      { id: "a", date: "2026-08-10" }, { id: "b", date: "2026-10-09" }, { id: "c", date: "" },
      { id: "d", date: "2026-10-02" }, { id: "e", date: "2026-10-20", done: true }, { id: "f", date: "2026-09-26" },
    ];
    expect(ordenarProvas(l, hoje).map((x) => x.id)).toEqual(["f", "d", "b", "c", "e", "a"]);
    expect(provaPassou({ date: "2026-09-25" }, hoje)).toBe(true);
    expect(provaPassou({ date: "2026-09-26" }, hoje)).toBe(false);
  });

  const estudosStore = () => criarStore({
    "estudos-cursos-andamento": [{ id: "c1", name: "Inglês" }, { id: "c2", name: "Excel", aulasFeitas: 12, aulasTotal: 30, notes: "Certificado até dezembro" }],
    "estudos-cursos-desejo": [{ id: "d1", name: "Oratória", link: "https://ex.com/oratoria" }],
    "estudos-exams": [
      { id: "1", title: "Prova antiga", date: "2026-08-10", time: "", color: "bg-blue-500", done: false },
      { id: "2", title: "Prova de inglês", date: "2026-10-02", time: "19:00", color: "bg-green-500", done: false },
    ],
    "estudos-week-tasks": { SEGUNDA: [{ text: "Ler capítulo 3", done: false }] },
    "estudos-notebooks": [{ id: "n1", date: "2026-09-25", curso: "Inglês", materia: "Present perfect", resumo: "Resumo", planoLeitura: "", duvidas: "", frases: "" }],
  });

  it("tarefas: quadradinho de 20 px num alvo de 36 px (w-4.5 não existe no Tailwind)", () => {
    const store = estudosStore();
    montar(store, "/preview/estudos", Estudos);
    fireEvent.click(document.querySelector('[data-spotlight="tab-tarefas"]')!);
    const botao = screen.getByRole("button", { name: "Marcar Ler capítulo 3" });
    expect(botao.className).toContain("h-9 w-9");
    expect((botao.firstElementChild as HTMLElement).className).toContain("w-5 h-5");
    expect(document.querySelector('[class*="w-4.5"], [class*="h-4.5"]')).toBeNull();
    fireEvent.click(botao);
    expect((store.dados["estudos-week-tasks"] as Record<string, { done: boolean }[]>).SEGUNDA[0].done).toBe(true);
  });

  it("provas: título em linha própria, marcar feita manda pro fim, cor legível", () => {
    fixarData(new Date(2026, 8, 26, 10, 0));
    const store = estudosStore();
    montar(store, "/preview/estudos", Estudos);
    const titulo = screen.getByPlaceholderText("Título");
    expect(titulo.className).toContain("w-full");
    const ordem = () => screen.getAllByRole("button", { name: /^Editar Prova/ }).map((b) => b.getAttribute("aria-label"));
    expect(ordem()).toEqual(["Editar Prova de inglês", "Editar Prova antiga"]);
    const card = screen.getByRole("button", { name: "Editar Prova de inglês" }).closest("div.rounded-lg") as HTMLElement;
    expect(card.className).toContain("bg-green-50");
    expect(card.className).not.toContain("bg-green-500");
    fireEvent.click(screen.getByRole("button", { name: "Marcar Prova de inglês como feita" }));
    expect((store.dados["estudos-exams"] as { id: string; done: boolean }[]).find((e) => e.id === "2")!.done).toBe(true);
    expect(ordem()).toEqual(["Editar Prova de inglês", "Editar Prova antiga"]); // as duas já passaram/feitas: mais recente primeiro
    const feita = screen.getByRole("button", { name: "Editar Prova de inglês" }).closest("div.rounded-lg") as HTMLElement;
    expect(feita.className).toContain("opacity-70");
  });

  it("curso em andamento apaga com Desfazer que devolve progresso e notas no mesmo lugar", () => {
    const store = estudosStore();
    montar(store, "/preview/estudos", Estudos);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Excel" }));
    expect((store.dados["estudos-cursos-andamento"] as { id: string }[]).map((c) => c.id)).toEqual(["c1"]);
    expect(desfazeres).toHaveLength(1);
    act(() => desfazeres[0]());
    expect(store.dados["estudos-cursos-andamento"]).toEqual([{ id: "c1", name: "Inglês" }, { id: "c2", name: "Excel", aulasFeitas: 12, aulasTotal: 30, notes: "Certificado até dezembro" }]);
  });

  it("'Comecei' leva o curso desejado pra em andamento, com o link", () => {
    const store = estudosStore();
    montar(store, "/preview/estudos", Estudos);
    fireEvent.click(screen.getByRole("button", { name: "Comecei Oratória" }));
    expect(store.dados["estudos-cursos-desejo"]).toEqual([]);
    expect((store.dados["estudos-cursos-andamento"] as { id: string; link?: string }[]).at(-1)).toEqual({ id: "d1", name: "Oratória", link: "https://ex.com/oratoria" });
  });

  it("caderno: data em dd/mm/aaaa e apagar anotação tem Desfazer; seta ← da demo vai pra LP", () => {
    const store = estudosStore();
    montar(store, "/preview/estudos", Estudos);
    fireEvent.click(document.querySelector('[data-spotlight="tab-caderno"]')!);
    expect(screen.getByText("Data: 25/09/2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apagar anotação" }));
    expect(store.dados["estudos-notebooks"]).toEqual([]);
    act(() => desfazeres[0]());
    expect((store.dados["estudos-notebooks"] as { id: string }[]).map((n) => n.id)).toEqual(["n1"]);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/lp");
  });
});

// ─────────────────────────── 11 · MÉTODO ───────────────────────────
describe("Método: 'Esta semana' conta a revisão feita fora da sessão", () => {
  it("a última resposta sai da própria agenda; a semana é a local (segunda em diante)", () => {
    for (const r of ["nao", "quase", "sim"] as const) expect(ultimaRevisao(responder(undefined, r, "2026-09-22"))).toBe("2026-09-22");
    const revisoes = {
      a: responder(undefined, "sim", "2026-09-22"),
      b: responder(undefined, "quase", "2026-09-26"),
      c: responder(undefined, "sim", "2026-09-20"), // domingo passado: fora
    };
    expect(resumoDaSemana([], new Date(2026, 8, 26, 12), revisoes)).toEqual({ sessoes: 0, pomodoros: 0, cartoes: 2, lembrados: 1 });
    expect(resumoDaSemana([], new Date(2026, 8, 26, 12))).toEqual({ sessoes: 0, pomodoros: 0, cartoes: 0, lembrados: 0 }); // sem revisões: conta antiga
  });

  it("na tela: 'Revisar agora' em 2 cartões → 'Esta semana: … 2 cartões (2 lembrados)'", () => {
    const store = criarStore({
      "estudos-cursos-andamento": [{ id: "1", name: "Inglês" }],
      "estudos-aprendizados": { "1": [
        { id: "a1", data: "2026-09-01", aprendi: "Present perfect", pergunta: "Quando usar?" },
        { id: "a2", data: "2026-09-02", aprendi: "Used to", pergunta: "Hábito do passado?" },
      ] },
    });
    montar(store, "/preview/estudos", Estudos);
    fireEvent.click(document.querySelector('[data-spotlight="tab-metodo"]')!);
    const semana = () => screen.getByText(/^Esta semana:/).closest("p")!.textContent;
    expect(semana()).toContain("0 cartões");
    fireEvent.click(screen.getByRole("button", { name: "Revisar agora" }));
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Mostrar resposta/ }));
      fireEvent.click(screen.getByRole("button", { name: /Lembrei/ }));
    }
    expect(semana()).toContain("2 cartões (2 lembrados)");
  });
});

// ─────────────────────────── CARREIRA ───────────────────────────
describe("Carreira", () => {
  it("datas em dd/mm (dd/mm/aa fora do ano)", () => {
    const agora = new Date(2026, 8, 26);
    expect(dataCurtaCarreira("2026-09-23", agora)).toBe("23/09");
    expect(dataCurtaCarreira("2025-12-01", agora)).toBe("01/12/25");
    expect(dataCurtaCarreira("", agora)).toBe("—");
    expect(dataCurtaCarreira(undefined, agora)).toBe("—");
  });

  it("contato do 'Detalhado' nasce com último contato hoje (fora do follow-up) e dá pra editar", () => {
    const store = criarStore();
    montar(store, "/preview/carreira", Carreira);
    fireEvent.click(screen.getByRole("button", { name: /Rede/ }));
    fireEvent.click(screen.getByRole("button", { name: /Detalhado/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome"), { target: { value: "Carla Dias" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const lista = () => store.dados["career-contacts"] as { id: string; name: string; role: string; lastContact: string }[];
    expect(lista()[0].lastContact).toBe(localDayKey());
    expect(screen.getByText("Nenhum follow-up pendente 🎉")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Carla Dias" }));
    fireEvent.change(screen.getByPlaceholderText("Cargo"), { target: { value: "Recrutadora" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(lista()).toHaveLength(1);
    expect(lista()[0]).toMatchObject({ name: "Carla Dias", role: "Recrutadora" });
  });

  it("skills: nível desce também, e o formulário detalhado tem porta", () => {
    const store = criarStore({ "career-skills": [{ id: "s1", name: "SQL", category: "técnica", level: 3, targetLevel: 5, notes: "" }] });
    montar(store, "/preview/carreira", Carreira);
    fireEvent.click(screen.getByRole("button", { name: /Skills/ }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar nível de SQL" }));
    expect((store.dados["career-skills"] as { level: number }[])[0].level).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Subir nível de SQL" }));
    fireEvent.click(screen.getByRole("button", { name: "Subir nível de SQL" }));
    expect((store.dados["career-skills"] as { level: number }[])[0].level).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: /Skill detalhada/ }));
    expect(screen.getByPlaceholderText("Nome da skill")).toBeInTheDocument();
  });

  it("vagas mostram a data em dd/mm; seta ← da demo vai pra LP", () => {
    const store = criarStore({ "career-jobs": [{ id: "1", company: "Studio Norte", role: "Designer", link: "", status: "aplicado", date: `${new Date().getFullYear()}-09-23`, salary: "", notes: "", favorite: false }] });
    montar(store, "/preview/carreira", Carreira);
    fireEvent.click(screen.getByRole("button", { name: /Vagas/ }));
    expect(screen.getByText("23/09")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/lp");
  });
});

// ─────────────────────── BLOCO DE FASES · HÁBITOS (home) ───────────────────────
describe("Bloco de fases e widget de hábitos", () => {
  it("fase com contagem só sai no segundo toque; mês sem 'De' maiúsculo", () => {
    fixarData(new Date(2026, 8, 26, 10, 0));
    const store = criarStore({ "career-day-phases": [{ id: "f1", nome: "Prospecção", memo: "", counts: { "2026-09-26": 6 } }] });
    render(<UserDataContext.Provider value={store.valor}><BlocoDeFases chaveFases="career-day-phases" chaveTarefas="career-day-tasks" fasesPadrao={[]} /></UserDataContext.Provider>);
    const mes = screen.getByText("Setembro de 2026");
    expect(mes.className).not.toContain("capitalize");
    fireEvent.click(screen.getByRole("button", { name: "Apagar fase" }));
    expect(store.dados["career-day-phases"]).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: apagar a fase Prospecção/ }));
    expect(store.dados["career-day-phases"]).toHaveLength(0);
  });

  it("quadradinho do widget de hábitos com 20 px", () => {
    const store = criarStore({ "core-rotina-habits": ["Ler"] });
    render(<MemoryRouter><UserDataContext.Provider value={store.valor}><HabitsWidget size="large" /></UserDataContext.Provider></MemoryRouter>);
    const caixa = screen.getByText("Ler").previousElementSibling as HTMLElement;
    expect(caixa.className).toContain("w-5 h-5");
    expect(caixa.className).not.toContain("4.5");
  });
});
