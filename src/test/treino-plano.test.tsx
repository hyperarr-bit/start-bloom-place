/**
 * 📋 PLANO do Treino (27/09, pedido do dono: configurar o treino e os
 * exercícios virou aba de verdade no lugar do ⚙️). Funções puras (modelos com
 * exercícios, sugestões, mover) e a tela: a aba na fila, o plano vazio abrindo
 * nela, o ciclo inteiro (montar a segunda → sair → reabrir → o HOJE da segunda
 * seguindo o plano), modelos com Desfazer, meta/descanso/bipe e o link da SEMANA.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, within, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { TabTrackContext } from "@/hooks/use-module-tracker";
import Treino from "@/pages/Treino";
import {
  MODELOS,
  aplicarModelo,
  moverNaLista,
  planoVazio,
  sugestoesDoDia,
  tipoPeloNome,
} from "@/lib/treino-plano";

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
  window.history.replaceState({}, "", "/");
});

type Ex = { name: string; sets: string; reps: string; carga: string; done: boolean; obs: string; tipo?: string; duracao?: string; distancia?: string };
type Plano = Record<string, { muscles: string[]; exercises: Ex[] }>;

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
const abrir = (store: ReturnType<typeof criarStore>, abas: string[] = []) =>
  render(
    <MemoryRouter>
      <UserDataContext.Provider value={store.valor}>
        <TabTrackContext.Provider value={(id) => abas.push(id)}>
          <Treino />
        </TabTrackContext.Provider>
      </UserDataContext.Provider>
    </MemoryRouter>,
  );
const plano = (store: ReturnType<typeof criarStore>) => store.dados["saude-workouts-v2"] as Plano;
const nomes = (store: ReturnType<typeof criarStore>, dia: string) => plano(store)[dia].exercises.map((e) => e.name);

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
const SABADO = new Date(2026, 8, 26, 9, 0);

describe("plano do treino — funções", () => {
  it("sugere por grupo, um de cada por rodada, e entrega agrupado na ordem dos grupos", () => {
    expect(sugestoesDoDia(["Peito", "Ombros", "Tríceps"], [], 5).map((s) => s.name)).toEqual([
      "Supino reto", "Supino inclinado", "Desenvolvimento", "Elevação lateral", "Tríceps corda",
    ]);
    // o que o dia já tem não volta — nem "Crucifixo" quando já existe "Crucifixo inclinado"
    expect(sugestoesDoDia(["Peito"], ["Supino reto", "crucifixo  inclinado"], 3).map((s) => s.name)).toEqual([
      "Supino inclinado", "Crossover", "Flexão de braço",
    ]);
    // sem grupo marcado: corpo todo; cardio vem como cardio, com o tempo
    expect(sugestoesDoDia([], [], 2).map((s) => s.name)).toEqual(["Agachamento livre", "Supino reto"]);
    expect(sugestoesDoDia(["Cardio"], [], 1)[0]).toMatchObject({ name: "Esteira", tipo: "cardio", duracao: "20" });
  });

  it("modelo: grupos e dias do modelo; dia com exercício fica com os dele, dia vazio ganha 5 do modelo", () => {
    const abc = MODELOS.find((m) => m.name === "ABC Clássico")!;
    const r = aplicarModelo({ SEGUNDA: PLANO.SEGUNDA }, abc);
    expect(r.diasAtivos).toEqual(["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"]);
    expect(r.plano.SEGUNDA).toEqual({ muscles: ["Peito", "Tríceps"], exercises: PLANO.SEGUNDA.exercises });
    expect(r.plano["TERÇA"].exercises.map((e) => e.name)).toEqual(["Puxada frente", "Remada curvada", "Remada baixa", "Rosca direta", "Rosca martelo"]);
    expect(r.plano["TERÇA"].exercises[0]).toEqual({ name: "Puxada frente", sets: "4", reps: "10", carga: "", done: false, obs: "" });
    expect(r.plano.DOMINGO).toEqual({ muscles: [], exercises: [] });
  });

  it("mover, cardio pelo nome e plano vazio", () => {
    expect(moverNaLista(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    const l = ["a", "b"];
    expect(moverNaLista(l, 0, 5)).toBe(l);
    expect(tipoPeloNome("Esteira")).toBe("cardio");
    expect(tipoPeloNome("Pular corda")).toBe("cardio");
    expect(tipoPeloNome("Tríceps corda")).toBeUndefined();
    expect(planoVazio(null)).toBe(true);
    expect(planoVazio({ SEGUNDA: { muscles: [], exercises: [] } })).toBe(true);
    expect(planoVazio({ SEGUNDA: { muscles: ["Peito"], exercises: [] } })).toBe(false);
  });
});

describe("Treino — a aba 📋 PLANO", () => {
  it("é a 2ª aba, abre no dia de hoje, mede como 'config' e o ⚙️ saiu do cabeçalho; abrir não grava nada", () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SEGUNDA", "SÁBADO"], "core-tip-seen-treino": "true" });
    const abas: string[] = [];
    abrir(store, abas);
    const fila = [...document.querySelectorAll("header [data-testid^='aba-']")].map((b) => b.getAttribute("data-testid"));
    expect(fila).toEqual(["aba-hoje", "aba-plano", "aba-semana", "aba-evolucao"]);
    expect(screen.getByTestId("aba-hoje")).toHaveAttribute("data-active", "true");
    expect(screen.queryByRole("button", { name: "Configurar treino" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("aba-plano"));
    expect(abas).toEqual(["config"]);
    expect(screen.getByTestId("plano-dia-SÁBADO")).toHaveAttribute("aria-pressed", "true");
    const dia = screen.getByTestId("plano-do-dia");
    expect(dia).toHaveTextContent("SÁBADO · HOJE");
    expect(dia).toHaveTextContent("Peito + Tríceps · 2 exercícios");
    expect(within(dia).getByLabelText("Carga de Supino reto")).toHaveValue("50kg");
    // cardio na grade: o tempo e a distância
    expect(within(dia).getByLabelText("Minutos de Esteira")).toHaveValue("20");
    expect(within(dia).getByLabelText("Distância de Esteira")).toHaveValue("2 km");
    // a semana: a segunda tem treino, o domingo é folga
    expect(screen.getByTestId("plano-dia-SEGUNDA")).toHaveAccessibleName("Segunda: Pernas, 1 exercício");
    expect(screen.getByTestId("plano-dia-DOMINGO")).toHaveAccessibleName("Domingo: descanso");
    fireEvent.click(screen.getByTestId("aba-semana"));
    expect(abas).toEqual(["config", "semana"]);
    expect(store.escritas.filter((k) => !k.startsWith("spotlight-"))).toEqual([]);
  });

  it("o ciclo inteiro: montar a segunda no PLANO → sair → reabrir mostra tudo → na segunda o HOJE segue o plano", async () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SEGUNDA", "SÁBADO"], "core-tip-seen-treino": "true" });
    abrir(store);
    fireEvent.click(screen.getByTestId("aba-plano"));
    fireEvent.click(screen.getByTestId("plano-dia-SEGUNDA"));
    const dia = screen.getByTestId("plano-do-dia");
    expect(dia).toHaveTextContent("SEGUNDA");

    // escreve na célula
    fireEvent.change(within(dia).getByLabelText("Carga de Agachamento"), { target: { value: "85kg" } });
    // adiciona digitando — e a esteira já nasce cardio
    fireEvent.change(within(dia).getByLabelText("Novo exercício de segunda"), { target: { value: "Leg press" } });
    fireEvent.click(within(dia).getByRole("button", { name: "Adicionar exercício" }));
    fireEvent.change(within(dia).getByLabelText("Novo exercício de segunda"), { target: { value: "Esteira" } });
    fireEvent.click(within(dia).getByRole("button", { name: "Adicionar exercício" }));
    // um toque numa sugestão (Pernas, sem o que o dia já tem): vem com séries e reps
    fireEvent.click(within(screen.getByTestId("plano-sugestoes")).getByRole("button", { name: "Adicionar Cadeira extensora" }));
    expect(nomes(store, "SEGUNDA")).toEqual(["Agachamento", "Leg press", "Esteira", "Cadeira extensora"]);

    // opções do exercício: subir, renomear, anotar
    fireEvent.click(within(dia).getByRole("button", { name: "Opções de Leg press" }));
    fireEvent.click(within(dia).getByRole("button", { name: "Subir Leg press" }));
    expect(nomes(store, "SEGUNDA")).toEqual(["Leg press", "Agachamento", "Esteira", "Cadeira extensora"]);
    const nome = within(dia).getByLabelText("Nome de Leg press");
    fireEvent.change(nome, { target: { value: "Leg press 45°" } });
    fireEvent.blur(nome);
    fireEvent.change(within(dia).getByLabelText("Anotação de Leg press 45°"), { target: { value: "banco no 3" } });
    fireEvent.click(within(dia).getByRole("button", { name: "Pronto" }));

    // remover tem Desfazer (volta no mesmo lugar)
    fireEvent.click(within(dia).getByRole("button", { name: "Opções de Esteira" }));
    fireEvent.click(within(dia).getByRole("button", { name: "Remover Esteira" }));
    expect(nomes(store, "SEGUNDA")).toEqual(["Leg press 45°", "Agachamento", "Cadeira extensora"]);
    const { avisarApagado } = await import("@/lib/desfazer");
    const aviso = vi.mocked(avisarApagado).mock.calls.at(-1)!;
    expect(aviso[0]).toBe('"Esteira" removido');
    act(() => aviso[1]());

    const segunda = plano(store).SEGUNDA.exercises;
    expect(segunda.map((e) => e.name)).toEqual(["Leg press 45°", "Agachamento", "Esteira", "Cadeira extensora"]);
    expect(segunda[0]).toMatchObject({ obs: "banco no 3" });
    expect(segunda[1]).toMatchObject({ sets: "4", reps: "8", carga: "85kg" });
    expect(segunda[2]).toMatchObject({ tipo: "cardio" });
    expect(segunda[3]).toMatchObject({ sets: "3", reps: "12", carga: "" });

    // SAI e REABRE: o PLANO mostra a segunda do jeito que ficou
    cleanup();
    abrir(store);
    expect(screen.getByTestId("aba-hoje")).toHaveAttribute("data-active", "true");
    fireEvent.click(screen.getByTestId("aba-plano"));
    fireEvent.click(screen.getByTestId("plano-dia-SEGUNDA"));
    const reaberto = screen.getByTestId("plano-do-dia");
    expect(within(screen.getByTestId("plano-exercicio-0")).getByRole("button", { name: "Opções de Leg press 45°" })).toBeInTheDocument();
    expect(within(reaberto).getByLabelText("Carga de Agachamento")).toHaveValue("85kg");
    expect(within(reaberto).getByLabelText("Minutos de Esteira")).toBeInTheDocument();
    expect(reaberto).toHaveTextContent("💬 banco no 3");
    expect(screen.getByTestId("plano-dia-SEGUNDA")).toHaveAccessibleName("Segunda: Pernas, 4 exercícios");

    // e na SEGUNDA, o HOJE é esse plano, nessa ordem, com a carga nova
    cleanup();
    vi.setSystemTime(new Date(2026, 8, 28, 9, 0));
    abrir(store);
    expect(screen.getByText("SEGUNDA · HOJE")).toBeInTheDocument();
    const hoje = screen.getByTestId("treino-hoje");
    expect(within(hoje).getByTestId("exercicio-aberto")).toHaveTextContent("Leg press 45°");
    expect(within(hoje).getByTestId("linha-Agachamento")).toHaveTextContent("4 × 8 · 85 kg");
    expect(within(hoje).getByTestId("cardio-Esteira")).toBeInTheDocument();
    expect(within(hoje).getByTestId("linha-Cadeira extensora")).toHaveTextContent("3 × 12");
  });

  it("plano vazio abre no PLANO com os modelos no topo; um toque monta a semana com exercícios; Desfazer volta", async () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({ "core-tip-seen-treino": "true" });
    const abas: string[] = [];
    abrir(store, abas);
    expect(screen.getByTestId("aba-plano")).toHaveAttribute("data-active", "true");
    expect(abas).toEqual(["config"]);
    const modelos = screen.getByTestId("modelos-prontos");
    expect(modelos).toHaveTextContent("COMECE COM UM MODELO PRONTO");
    // modelos ANTES da semana (é o jeito mais rápido de começar)
    expect(modelos.compareDocumentPosition(screen.getByTestId("plano-semana")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // no PLANO o "Próximo passo" não se repete
    expect(screen.queryByText("Monte seu treino da semana")).not.toBeInTheDocument();
    expect(store.escritas.filter((k) => !k.startsWith("spotlight-"))).toEqual([]);

    fireEvent.click(within(modelos).getByRole("button", { name: "Usar o modelo ABC Clássico" }));
    expect(plano(store).SEGUNDA.muscles).toEqual(["Peito", "Tríceps"]);
    expect(nomes(store, "SEGUNDA")).toEqual(["Supino reto", "Supino inclinado", "Crucifixo", "Tríceps corda", "Tríceps testa"]);
    expect(plano(store).DOMINGO.exercises).toEqual([]);
    expect(store.dados["treino-active-days"]).toEqual(["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"]);
    // hoje (sábado) é dia do modelo: o cartão aberto é ele; os modelos descem pro fim
    expect(screen.getByTestId("plano-do-dia")).toHaveTextContent("SÁBADO · HOJE");
    expect(screen.getByTestId("plano-do-dia")).toHaveTextContent("Ombros + Pernas · 5 exercícios");
    expect(screen.getByTestId("modelos-prontos")).toHaveTextContent("MODELOS PRONTOS");
    const { trackEvent } = await import("@/lib/analytics");
    expect(trackEvent).toHaveBeenCalledWith("treino_modelo", { modelo: "ABC Clássico", dias: 6 });

    const { avisarApagado } = await import("@/lib/desfazer");
    const aviso = vi.mocked(avisarApagado).mock.calls.at(-1)!;
    expect(aviso[0]).toBe('Modelo "ABC Clássico" aplicado');
    act(() => aviso[1]());
    expect(planoVazio(store.dados["saude-workouts-v2"])).toBe(true);
    expect(screen.getByTestId("modelos-prontos")).toHaveTextContent("COMECE COM UM MODELO PRONTO");

    // no HOJE, o plano vazio aponta pro PLANO
    fireEvent.click(screen.getByTestId("aba-hoje"));
    fireEvent.click(screen.getByRole("button", { name: "Montar meu plano" }));
    expect(screen.getByTestId("aba-plano")).toHaveAttribute("data-active", "true");
  });

  it("tutorial pendente: plano vazio continua no HOJE (o alvo do tutorial mora lá)", () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({ "core-tip-seen-treino": "true", "force-new-user-tutorial": "true", "quickstart-target-module": "treino" });
    abrir(store);
    expect(screen.getByTestId("aba-hoje")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("aba-plano")).toHaveAttribute("data-active", "false");
  });

  it("`?aba=` abre a aba pedida — e `config`, o id antigo, abre o PLANO", () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "core-tip-seen-treino": "true" });
    window.history.replaceState({}, "", "/treino?aba=semana");
    abrir(store);
    expect(screen.getByTestId("aba-semana")).toHaveAttribute("data-active", "true");
    cleanup();
    window.history.replaceState({}, "", "/treino?aba=config");
    const abas: string[] = [];
    abrir(store, abas);
    expect(screen.getByTestId("aba-plano")).toHaveAttribute("data-active", "true");
    expect(abas).toEqual(["config"]);
  });

  it("meta, descanso e bipe gravam; a SEMANA mostra a meta nova", () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({ "saude-workouts-v2": PLANO, "treino-active-days": ["SEGUNDA", "SÁBADO"], "core-tip-seen-treino": "true" });
    abrir(store);
    fireEvent.click(screen.getByTestId("aba-plano"));
    // meta padrão = nº de dias de treino
    expect(screen.getByTestId("plano-meta-valor")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "Mais um treino na meta" }));
    expect(store.dados["treino-meta-semanal"]).toBe(3);
    expect(screen.getByTestId("plano-meta-valor")).toHaveTextContent("3");

    const descanso = screen.getByTestId("plano-descanso");
    fireEvent.click(within(descanso).getByRole("button", { name: "90s" }));
    expect(store.dados["treino-descanso-padrao"]).toBe(90);
    expect(within(descanso).getByRole("button", { name: "90s" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(descanso).getByRole("switch", { name: "Bipe no fim do descanso" }));
    expect(store.dados["treino-sound"]).toBe(false);

    fireEvent.click(screen.getByTestId("aba-semana"));
    expect(screen.getByTestId("meta-semanal")).toHaveTextContent("META: 3 TREINOS POR SEMANA");
  });

  it("grupos do dia puxam sugestões; ligar o dia de treino tira do descanso", () => {
    vi.useFakeTimers({ now: SABADO, toFake: ["Date"] });
    const store = criarStore({
      "saude-workouts-v2": { ...PLANO, QUARTA: { muscles: [], exercises: [] } },
      "treino-active-days": ["SEGUNDA", "QUARTA", "SÁBADO"],
      "core-tip-seen-treino": "true",
    });
    abrir(store);
    fireEvent.click(screen.getByTestId("aba-plano"));

    // quarta: dia de treino ainda vazio — os grupos já abrem pra escolher
    fireEvent.click(screen.getByTestId("plano-dia-QUARTA"));
    expect(screen.getByTestId("plano-dia-QUARTA")).toHaveAccessibleName("Quarta: Monte o treino do dia");
    const grupos = screen.getByTestId("plano-grupos");
    fireEvent.click(within(grupos).getByRole("button", { name: /Costas/ }));
    expect(plano(store).QUARTA.muscles).toEqual(["Costas"]);
    fireEvent.click(within(screen.getByTestId("plano-sugestoes")).getByRole("button", { name: "Adicionar Puxada frente" }));
    expect(plano(store).QUARTA.exercises).toEqual([{ name: "Puxada frente", sets: "4", reps: "10", carga: "", done: false, obs: "" }]);

    // terça: descanso — o cartão é curto e o interruptor liga o dia
    fireEvent.click(screen.getByTestId("plano-dia-TERÇA"));
    const terca = screen.getByTestId("plano-do-dia");
    expect(terca).toHaveTextContent("Dia de descanso");
    expect(within(terca).queryByLabelText("Novo exercício de terça")).not.toBeInTheDocument();
    fireEvent.click(within(terca).getByRole("switch", { name: "TERÇA é dia de treino" }));
    expect(store.dados["treino-active-days"]).toEqual(expect.arrayContaining(["TERÇA"]));
    expect(within(screen.getByTestId("plano-do-dia")).getByLabelText("Novo exercício de terça")).toBeInTheDocument();
  });
});
