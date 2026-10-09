/**
 * Treino, a tela (26/09, redesenho): o ciclo inteiro com dado gravado de
 * verdade — começar → subir a carga pelo post-it → marcar fora de ordem →
 * descanso → concluir → FECHAR E REABRIR o módulo (e abrir de novo na semana
 * seguinte). Formato antigo do histórico entra, formato de sempre sai.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, within, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Treino from "@/pages/Treino";

vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  return { ...real, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: vi.fn(), trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, isIOS: () => false, isAndroid: () => false, plataformaApp: () => "web" }));

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const criarStore = (inicial: Record<string, unknown>) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; escritas.push(key); },
    loaded: true,
    isGuest: false,
    fetchKey: async () => null,
  } as UserDataContextType;
  return { dados, valor, escritas };
};
const abrir = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><Treino /></UserDataContext.Provider></MemoryRouter>);

const PLANO = {
  "SÁBADO": {
    muscles: ["Peito", "Tríceps"],
    exercises: [
      { name: "Supino reto", sets: "3", reps: "10", carga: "50kg", done: false, obs: "" },
      { name: "Esteira", sets: "", reps: "", carga: "", done: false, obs: "", tipo: "cardio", duracao: "20", distancia: "2 km" },
    ],
  },
  SEGUNDA: { muscles: ["Pernas"], exercises: [{ name: "Agachamento", sets: "4", reps: "8", carga: "80kg", done: false, obs: "" }] },
};

describe("Treino — o ciclo inteiro, fechando e reabrindo", () => {
  it("começa, sobe, marca fora de ordem, conclui; ao reabrir tudo está lá; na semana seguinte a 'última vez' é a de hoje", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 9, 0), toFake: ["Date"] }); // sábado
    const store = criarStore({
      "saude-workouts-v2": PLANO,
      "treino-active-days": ["SEGUNDA", "QUARTA", "SÁBADO"],
      // histórico no formato ANTIGO (só o resumo): fechou 3 × 10 com 50 kg
      "treino-exercise-history": [{ date: "2026-09-19", exercise: "Supino reto", sets: "3", reps: "10", carga: "50kg" }],
      "saude-workout-log": ["2026-09-19"],
      "saude-workout-notes": { "SÁBADO": "Dormi bem" },
      "core-tip-seen-treino": "true",
    });
    abrir(store);

    // a folha do dia: última vez em cinza, post-it, rodapé "Começar treino"
    expect(screen.getByText("SÁBADO · HOJE")).toBeInTheDocument();
    expect(screen.getByText("50 kg × 10·10·10")).toBeInTheDocument();
    const postit = screen.getByTestId("postit-progressao");
    expect(postit).toHaveTextContent("Semana passada você fechou 3×10. Sobe pra 52,5 kg?");
    // abrir o módulo não grava nada do Treino (nem o carimbo da semana, nem a
    // meta) — o spotlight-done-* é o tutorial se marcando como visto, de sempre
    expect(store.escritas.filter((k) => !k.startsWith("spotlight-"))).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Começar treino" }));
    expect((store.dados["treino-sessao"] as { inicio: string | null }).inicio).toBeTruthy();

    fireEvent.click(within(postit).getByRole("button", { name: "Subir" }));
    expect(screen.queryByTestId("postit-progressao")).not.toBeInTheDocument();

    // fora de ordem: a 2ª antes da 1ª — o descanso começa
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 2 de Supino reto" }));
    expect(screen.getByTestId("descanso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(screen.queryByTestId("descanso")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 1 de Supino reto" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 3 de Supino reto" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar Esteira" }));
    expect(screen.getByTestId("contagem-series")).toHaveTextContent("4/4 séries");

    fireEvent.click(screen.getByRole("button", { name: "Concluir treino" }));
    const folha = screen.getByTestId("treino-concluido");
    expect(within(folha).getByText("Treino concluído ✓")).toBeInTheDocument();
    expect(within(folha).getByTestId("adesivo-recorde")).toBeInTheDocument();
    expect(folha).toHaveTextContent("52,5 kg × 10");
    expect(folha).toHaveTextContent("1.575 kg");

    // o que foi gravado: formato de sempre + `series`
    const hist = store.dados["treino-exercise-history"] as Record<string, unknown>[];
    expect(hist[0]).toMatchObject({ date: "2026-09-26", exercise: "Supino reto", sets: "3", reps: "10", carga: "52,5kg", series: [{ carga: 52.5, reps: 10 }, { carga: 52.5, reps: 10 }, { carga: 52.5, reps: 10 }] });
    expect(hist.find((h) => h.exercise === "Esteira")).toMatchObject({ date: "2026-09-26", tipo: "cardio", duracao: "20", carga: "" });
    expect(hist).toHaveLength(3);
    expect(store.dados["saude-workout-log"]).toEqual(["2026-09-19", "2026-09-26"]);
    expect((store.dados["treino-weekly-volume"] as Record<string, number>)["2026-09-26"]).toBe(1575);
    expect((store.dados["treino-notas-sessoes"] as Record<string, string>)["2026-09-26"]).toBe("Dormi bem");
    expect((store.dados["saude-workout-notes"] as Record<string, string>)["SÁBADO"]).toBe("");
    expect((store.dados["treino-sessoes"] as Record<string, unknown>)["2026-09-26"]).toMatchObject({ dia: "SÁBADO", musculos: ["Peito", "Tríceps"] });
    // o ✓ do plano acompanha as séries (é o que versões antigas do app e a virada da semana leem)
    const plano = store.dados["saude-workouts-v2"] as typeof PLANO;
    expect(plano["SÁBADO"].exercises.map((e) => e.done)).toEqual([true, true]);
    expect(store.dados["treino-semana-dos-checks"]).toBe("2026-09-21");

    // FECHA e REABRE o módulo no mesmo dia
    cleanup();
    abrir(store);
    expect(screen.getByTestId("rodape-treino")).toHaveTextContent("Treino concluído ✓");
    expect(screen.getByRole("button", { name: "Ver resumo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /SEMANA/ }));
    const sabado = screen.getByTestId("semana-SÁBADO");
    // 09/10: o ✓ de um dia feito virou botão (desmarcar o dia pela SEMANA)
    expect(within(sabado).getByRole("button", { name: "Desmarcar o treino de sábado, 26/09" })).toBeInTheDocument();
    expect(sabado).toHaveTextContent("1.575 kg");
    expect(screen.getByTestId("dia-2026-09-26")).toHaveTextContent("💪");
    fireEvent.click(screen.getByRole("button", { name: /EVOLUÇÃO/ }));
    expect(screen.getByTestId("evolucao-treinos")).toHaveTextContent("1/3");
    expect(screen.getByTestId("recorde-Supino reto")).toHaveTextContent("52,5 kg × 10");
    expect(screen.getByTestId("recorde-Supino reto")).toHaveTextContent("+2,5");

    // NA SEMANA SEGUINTE: a sessão velha se descarta, o ✓ zera, a última vez é a de 26/09
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 3, 9, 0));
    abrir(store);
    expect(store.dados["treino-sessao"]).toBeNull();
    expect((store.dados["saude-workouts-v2"] as typeof PLANO)["SÁBADO"].exercises.map((e) => e.done)).toEqual([false, false]);
    expect(screen.getByText("52,5 kg × 10·10·10")).toBeInTheDocument();
    expect(screen.getByTestId("postit-progressao")).toHaveTextContent("Semana passada você fechou 3×10. Sobe pra 55 kg?");
    expect(screen.getByRole("button", { name: "Começar treino" })).toBeInTheDocument();
  });

  it("mexeu depois de concluir: o botão vira 'Salvar de novo' e o dia é SUBSTITUÍDO (sem duplicar)", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 9, 0), toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SÁBADO"], "core-tip-seen-treino": "true" });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 1 de Supino reto" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir treino" }));
    // [0]: o × padrão do Sheet (escondido por CSS no app) também se chama "Fechar" no jsdom
    fireEvent.click(within(screen.getByTestId("treino-concluido")).getAllByRole("button", { name: "Fechar" })[0]);
    expect(screen.getByRole("button", { name: "Ver resumo" })).toBeInTheDocument();
    // esqueceu de marcar a 2ª série (o supino segue aberto: ainda não terminou)
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 2 de Supino reto" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar de novo" }));
    const doDia = (store.dados["treino-exercise-history"] as { date: string; exercise: string; sets: string }[]).filter((h) => h.date === "2026-09-26");
    expect(doDia).toEqual([expect.objectContaining({ exercise: "Supino reto", sets: "2" })]);
    expect(store.dados["saude-workout-log"]).toEqual(["2026-09-26"]);
    expect((store.dados["treino-weekly-volume"] as Record<string, number>)["2026-09-26"]).toBe(1000);
  });

  it("concluir sem nenhuma série marcada não grava nada", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 9, 0), toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SÁBADO"], "core-tip-seen-treino": "true" });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Começar treino" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir treino" }));
    const { toast } = await import("sonner");
    expect(toast).toHaveBeenCalledWith("Marque pelo menos uma série pra concluir o treino.");
    expect(store.dados["treino-exercise-history"]).toBeUndefined();
    expect(store.dados["saude-workout-log"]).toBeUndefined();
  });

  it("dia de descanso: dá pra treinar o plano de outro dia; o tutorial acha onde adicionar", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 27, 9, 0), toFake: ["Date"] }); // domingo
    const store = criarStore({
      "saude-workouts-v2": { SEGUNDA: PLANO.SEGUNDA, QUARTA: { muscles: [], exercises: [] } },
      "treino-active-days": ["SEGUNDA", "QUARTA"],
      "core-tip-seen-treino": "true",
    });
    const { container } = abrir(store);
    expect(screen.getByText("DOMINGO · DESCANSO")).toBeInTheDocument();
    // o 1º dia de treino vazio (quarta) recebe o alvo do tutorial
    expect(container.querySelector('[data-spotlight="add-exercise"]')).toHaveTextContent("");
    expect(screen.getByLabelText("Novo exercício de quarta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /SEG\s*Pernas/ }));
    expect(screen.getByText("DOMINGO · HOJE")).toBeInTheDocument();
    expect(screen.getByText(/treino de segunda/)).toBeInTheDocument();
    expect((store.dados["treino-sessao"] as { dia: string }).dia).toBe("SEGUNDA");
    expect(screen.getByTestId("tabela-Agachamento")).toBeInTheDocument();
    // concluído no domingo: grava no domingo, com os músculos da segunda; a
    // SEMANA mostra o domingo como "Treino extra" (e não "Descanso" com ✓)
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 1 de Agachamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir treino" }));
    expect(store.dados["saude-workout-log"]).toEqual(["2026-09-27"]);
    expect((store.dados["treino-sessoes"] as Record<string, unknown>)["2026-09-27"]).toMatchObject({ dia: "SEGUNDA", musculos: ["Pernas"] });
    // o ✓ da segunda NÃO é marcado (senão a segunda abriria já feita)
    expect((store.dados["saude-workouts-v2"] as typeof PLANO).SEGUNDA.exercises[0].done).toBe(false);
    fireEvent.click(within(screen.getByTestId("treino-concluido")).getAllByRole("button", { name: "Fechar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /SEMANA/ }));
    expect(screen.getByTestId("semana-DOMINGO")).toHaveTextContent("Treino extra");
    expect(screen.getByTestId("treino-semana")).toHaveTextContent("1 de 2 feito");
  });

  it("SEMANA: tocar num dia abre esse dia no 📋 PLANO; remover tem Desfazer; copiar pra outro dia liga o dia", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 9, 0), toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SEGUNDA", "SÁBADO"], "core-tip-seen-treino": "true" });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: /SEMANA/ }));
    fireEvent.click(screen.getByRole("button", { name: "Editar o treino de segunda" }));
    // 27/09: a folha do editor deu lugar à aba PLANO, já com a segunda aberta
    expect(screen.getByTestId("aba-plano")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("plano-dia-SEGUNDA")).toHaveAttribute("aria-pressed", "true");
    const editor = screen.getByTestId("plano-do-dia");
    fireEvent.change(within(editor).getByLabelText("Novo exercício de segunda"), { target: { value: "Leg press" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Adicionar exercício" }));
    expect((store.dados["saude-workouts-v2"] as typeof PLANO).SEGUNDA.exercises.map((e) => e.name)).toEqual(["Agachamento", "Leg press"]);
    fireEvent.click(within(editor).getByRole("button", { name: "Opções de Agachamento" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Remover Agachamento" }));
    const { avisarApagado } = await import("@/lib/desfazer");
    const ultima = vi.mocked(avisarApagado).mock.calls.at(-1)!;
    expect(ultima[0]).toBe('"Agachamento" removido');
    act(() => ultima[1]());
    expect((store.dados["saude-workouts-v2"] as typeof PLANO).SEGUNDA.exercises.map((e) => e.name)).toEqual(["Agachamento", "Leg press"]);
    fireEvent.click(within(editor).getByTestId("copiar-treino-SEGUNDA"));
    const painel = within(editor).getByTestId("painel-copiar-treino");
    fireEvent.click(within(painel).getByText("QUINTA"));
    fireEvent.click(within(painel).getByRole("button", { name: "Copiar (1)" }));
    expect((store.dados["saude-workouts-v2"] as Record<string, { exercises: { name: string }[] }>).QUINTA.exercises.map((e) => e.name)).toEqual(["Agachamento", "Leg press"]);
    expect(store.dados["treino-active-days"]).toEqual(expect.arrayContaining(["QUINTA"]));
    expect(vi.mocked(avisarApagado).mock.calls.at(-1)![0]).toBe("Treino de segunda copiado pra 1 dia");
  });

  it("DESMARCAR (07/10): dia marcado pelo atalho da Home (sem sessão) tem como tirar, com Desfazer", async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 9, 0), toFake: ["Date"] });
    const store = criarStore({
      "saude-workouts-v2": PLANO, "treino-active-days": ["SÁBADO"], "core-tip-seen-treino": "true",
      "saude-workout-log": ["2026-09-25", "2026-09-26"],
    });
    abrir(store);
    fireEvent.click(within(screen.getByTestId("treino-registrado")).getByRole("button", { name: "Desmarcar" }));
    expect(store.dados["saude-workout-log"]).toEqual(["2026-09-25"]);
    expect(screen.queryByTestId("treino-registrado")).toBeNull();
    const { avisarApagado } = await import("@/lib/desfazer");
    const chamada = vi.mocked(avisarApagado).mock.calls.at(-1)!;
    expect(chamada[0]).toBe("Treino de hoje desmarcado");
    act(() => chamada[1]());
    expect(store.dados["saude-workout-log"]).toEqual(["2026-09-25", "2026-09-26"]);
  });

  it("DESMARCAR (07/10): concluiu, desmarcou tudo e 'Salvar de novo' tira o dia (antes: nada saía)", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 9, 0), toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SÁBADO"], "core-tip-seen-treino": "true" });
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar a série 1 de Supino reto" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir treino" }));
    fireEvent.click(within(screen.getByTestId("treino-concluido")).getAllByRole("button", { name: "Fechar" })[0]);
    expect(store.dados["saude-workout-log"]).toEqual(["2026-09-26"]);
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar a série 1 de Supino reto" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar de novo" }));
    expect(store.dados["saude-workout-log"]).toEqual([]);
    expect(store.dados["treino-weekly-volume"]).toEqual({});
    expect((store.dados["treino-exercise-history"] as { date: string }[]).filter((h) => h.date === "2026-09-26")).toEqual([]);
    expect(screen.queryByTestId("treino-registrado")).toBeNull();
    expect(screen.getByRole("button", { name: "Começar treino" })).toBeInTheDocument();
  });
});
