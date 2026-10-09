/**
 * CHAMADOS DE 09/10.
 *
 *  1) DEFEITO — widget de calorias "0/2000 apesar de inserir as refeições":
 *     refeições do diário da Dieta (dieta-diary-v2) sem entrada no log contam
 *     pelas kcal do cardápio; nada em dobro; a meta é a do cardápio do dia.
 *  2) DEFEITO — desmarcar treino de dia passado: o ✓ da SEMANA pergunta e tira
 *     o dia pela mesma função do Desmarcar de hoje, com Desfazer.
 *  3) Recomeçar o plano de treino do zero (histórico e recordes ficam).
 *  4) Prazo na tarefa: aparece todo dia até ser feita (fora da janela de 7 dias
 *     do "Ficou de ontem"), selo vence/atrasada, aviso no dia do prazo.
 *
 * E a régua de sempre: chaves iguais; o app antigo das lojas (que só conhece os
 * campos de antes) continua lendo e regravando sem perder nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, session: null, subLoaded: true, loading: false }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, isIOS: () => false, isAndroid: () => false, plataformaApp: () => "web" }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn(), apagarComDesfazer: vi.fn() }));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  const toast = Object.assign((m: string) => { toasts.push(m); }, { success: (m: string) => { toasts.push(m); }, error: (m: string) => { toasts.push(`ERRO: ${m}`); } });
  return { ...real, toast };
});

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { avisarApagado } from "@/lib/desfazer";
import { consumoDoDia, kcalDoPlano, nomeDoDiaDieta, refeicoesSeguidas } from "@/lib/dieta-consumo";
import { idDoPlano } from "@/lib/dieta-macros";
import { CaloriesWidget } from "@/components/home/widgets/CaloriesWidget";
import { MacroBalanceWidget } from "@/components/home/widgets/MacroBalanceWidget";
import { TreinoSemana, linhasDaSemana, rotuloDoDiaDaSemana } from "@/components/treino/TreinoSemana";
import Treino from "@/pages/Treino";
import {
  CHAVE_TAREFAS_ROTINA, apareceHoje, diaDoAviso, estadoDoPrazo, prazoDaTarefa, tarefasAgendaveis, planejarTarefas, type TarefaDoDia,
} from "@/lib/tarefas";
import { tarefasQueFicaram } from "@/lib/ficou-de-ontem";
import { TarefasDeHoje } from "@/components/tarefas/tarefas-do-dia";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";

type Dados = Record<string, unknown>;
/** Como a nuvem: JSON (undefined some); reativo (cada set re-renderiza quem lê). */
function criarStore(inicial: Dados) {
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
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
// sexta-feira, 09/10/2026 10:00 (07/10 é quarta)
beforeEach(() => { toasts.length = 0; vi.mocked(avisarApagado).mockClear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 9, 10, 0)); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

const HOJE = "2026-10-09";
const QUARTA7 = "2026-10-07";

/* ------------------------------------------------------------------ 1) CALORIAS */
describe("1) widget de calorias — refeições do diário da Dieta e meta do cardápio", () => {
  it("nomeDoDiaDieta e kcalDoPlano: a mesma indexação do cardápio", () => {
    expect(nomeDoDiaDieta(new Date(2026, 9, 9))).toBe("SEXTA");
    expect(nomeDoDiaDieta(new Date(2026, 9, 11))).toBe("DOMINGO");
    expect(kcalDoPlano({ "Almoço": 650, Janta: "500", Lanche: "x", Ceia: -3 })).toBe(1150);
    expect(refeicoesSeguidas({ meals: { "Almoço": { followed: true }, Janta: { followed: false }, Lanche: null as never } })).toEqual(["Almoço"]);
  });

  it("só o log: soma as kcal e, sem cardápio com kcal, a meta é a chave antiga (2000)", () => {
    const r = consumoDoDia({ log: { "quick-1": { name: "Pão", calories: 300 }, "taco-2": { name: "Arroz", calories: 200, protein: 4, carbs: 40, fat: 1 } }, metaAntiga: 2000 });
    expect(r.kcal).toBe(500);
    expect(r.meta).toBe(2000);
    expect(r.refeicoes).toBe(2);
    expect(r.macros).toEqual({ p: 4, c: 40, g: 1 });
  });

  it("DEFEITO: refeição marcada como 'segui' no diário sem entrada no log conta pelas kcal (e gramas) do cardápio; a meta é o total do cardápio do dia", () => {
    const r = consumoDoDia({
      log: {},
      diario: { meals: { "Café da Manhã": { followed: true, note: "" }, "Almoço": { followed: true, note: "" }, Janta: { followed: false, note: "comi fora" } } },
      kcalPlano: { "Café da Manhã": 350, "Almoço": 700, Janta: 600 },
      macrosPlano: { "Almoço": { p: 40, c: 80, g: 15 } },
      metaAntiga: 2000,
    });
    expect(r.kcal).toBe(1050); // café + almoço; janta "não segui" não entra
    expect(r.meta).toBe(1650); // o cardápio do dia, não o 2000 cravado
    expect(r.refeicoes).toBe(2);
    expect(r.macros).toEqual({ p: 40, c: 80, g: 15 });
  });

  it("sem contar em dobro: a refeição que o diário já gravou no log (plano-<refeição>, sync de 18/09) entra uma vez só", () => {
    const r = consumoDoDia({
      log: { [idDoPlano("Almoço")]: { name: "Almoço: arroz e frango", calories: 700, protein: 40 }, "quick-9": { name: "Bolo", calories: 250 } },
      diario: { meals: { "Almoço": { followed: true, note: "" }, Lanche: { followed: true, note: "" } } },
      kcalPlano: { "Almoço": 700, Lanche: 200 },
      metaAntiga: 2000,
    });
    expect(r.kcal).toBe(700 + 250 + 200);
    expect(r.refeicoes).toBe(3);
    expect(r.macros.p).toBe(40);
  });

  it("cardápio sem kcal: as refeições contam, as kcal ficam em 0 e a meta cai no 2000 — é o caso em que o widget explica em vez de parecer quebrado", () => {
    const r = consumoDoDia({ log: {}, diario: { meals: { "Almoço": { followed: true, note: "" } } }, kcalPlano: { "Almoço": 0 }, metaAntiga: undefined });
    expect(r).toMatchObject({ kcal: 0, refeicoes: 1, kcalPlanejadas: 0, meta: 2000 });
    // chaves tortas não derrubam
    expect(consumoDoDia({ log: "x" as never, diario: [] as never, kcalPlano: 7 as never, metaAntiga: "abc" }).meta).toBe(2000);
  });

  it("tela: o widget Calorias mostra 1050 / 1650 kcal com o diário marcado e o log vazio; Macros do Dia mostra as gramas do cardápio", () => {
    const store = criarStore({
      "saude-meals": { SEXTA: { "Café da Manhã": "Pão com ovo", "Almoço": "Arroz, feijão e frango", Janta: "Sopa" } },
      "saude-meals-kcal": { SEXTA: { "Café da Manhã": 350, "Almoço": 700, Janta: 600 } },
      "saude-meals-macros": { SEXTA: { "Almoço": { p: 40, c: 80, g: 15 } } },
      "dieta-diary-v2": { [HOJE]: { meals: { "Café da Manhã": { followed: true, note: "" }, "Almoço": { followed: true, note: "" } }, extraFood: { had: false, description: "" } } },
    });
    store.montar(<><CaloriesWidget size="large" /><MacroBalanceWidget /></>);
    expect(screen.getByText("1050")).toBeInTheDocument();
    expect(screen.getByText("/ 1650 kcal")).toBeInTheDocument();
    expect(screen.queryByTestId("calorias-sem-kcal")).toBeNull();
    expect(screen.getByTestId("calorias-macros").textContent).toMatch(/P 40g.*C 80g.*G 15g/);
    expect(screen.getByText("40g")).toBeInTheDocument();
    expect(screen.queryByTestId("macros-vazio")).toBeNull();
  });

  it("tela: refeições marcadas e cardápio SEM kcal — o widget mostra '2 de 3 refeições' e diz onde anotar as kcal (nada de 0/2000 mudo)", () => {
    const store = criarStore({
      "core-dieta-meals": ["Café da Manhã", "Almoço", "Janta"],
      "saude-meals": { SEXTA: { "Café da Manhã": "Pão", "Almoço": "Arroz", Janta: "Sopa" } },
      "dieta-diary-v2": { [HOJE]: { meals: { "Café da Manhã": { followed: true, note: "" }, "Almoço": { followed: true, note: "" } }, extraFood: { had: false, description: "" } } },
    });
    store.montar(<CaloriesWidget size="small" />);
    const bloco = screen.getByTestId("calorias-sem-kcal");
    expect(bloco.textContent).toMatch(/2 de 3/);
    expect(screen.getByText(/Anote as kcal no cardápio da Dieta/)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ 2) DESMARCAR TREINO DE OUTRO DIA */
const PLANO_TREINO = {
  QUARTA: { muscles: ["Costas"], exercises: [{ name: "Remada", sets: "3", reps: "10", carga: "40kg", done: false, obs: "" }] },
  SEXTA: { muscles: ["Pernas"], exercises: [{ name: "Agachamento", sets: "4", reps: "8", carga: "80kg", done: false, obs: "" }] },
};
const storeTreino = (extra: Dados = {}) => criarStore({
  "saude-workouts-v2": PLANO_TREINO,
  "treino-active-days": ["QUARTA", "SEXTA"],
  "saude-workout-log": ["2026-09-30", QUARTA7],
  "treino-weekly-volume": { "2026-09-30": 900, [QUARTA7]: 1200 },
  "treino-sessoes": { "2026-09-30": { dia: "QUARTA", musculos: ["Peito"] }, [QUARTA7]: { dia: "QUARTA", musculos: ["Costas"] } },
  "treino-exercise-history": [
    { date: "2026-09-30", exercise: "Supino", sets: "3", reps: "10", carga: "50kg" },
    { date: QUARTA7, exercise: "Remada", sets: "3", reps: "10", carga: "40kg" },
  ],
  "core-tip-seen-treino": "true",
  "spotlight-done-treino": "true",
  ...extra,
});

describe("2) SEMANA — desmarcar o treino de um dia que passou", () => {
  it("rotuloDoDiaDaSemana: 'quarta, 07/10'", () => {
    expect(rotuloDoDiaDaSemana("QUARTA", QUARTA7)).toBe("quarta, 07/10");
    expect(rotuloDoDiaDaSemana("SÁBADO", "2026-10-10")).toBe("sábado, 10/10");
  });

  it("componente: o ✓ de um dia treinado vira botão; pergunta com o dia por extenso; Cancelar não chama; confirmar chama com a data; dia futuro e dia sem treino ficam só leitura", () => {
    const linhas = linhasDaSemana({
      plano: PLANO_TREINO as never, diasAtivos: ["QUARTA", "SEXTA", "SÁBADO"], hoje: new Date(2026, 9, 9), hojeNome: "SEXTA",
      log: [QUARTA7, "2026-10-10"], volumePorDia: { [QUARTA7]: 1200 }, progressoHoje: { feitas: 0, total: 4, rotulo: "séries" },
    });
    const onDesmarcar = vi.fn();
    const onAbrirDia = vi.fn();
    render(<TreinoSemana linhas={linhas} onAbrirDia={onAbrirDia} onDesmarcar={onDesmarcar} hoje={HOJE} />);
    // sábado 10/10 está no log (dado torto, futuro) e NÃO dá pra desmarcar; sexta (hoje) não foi feita
    expect(screen.queryByTestId("desmarcar-SÁBADO")).toBeNull();
    expect(screen.queryByTestId("desmarcar-SEXTA")).toBeNull();
    fireEvent.click(screen.getByTestId("desmarcar-QUARTA"));
    expect(screen.getByTestId("confirmar-desmarcar").textContent).toMatch(/Desmarcar o treino de quarta, 07\/10\?/);
    expect(onAbrirDia).not.toHaveBeenCalled(); // o toque no ✓ não abriu o dia no PLANO
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByTestId("confirmar-desmarcar")).toBeNull();
    expect(onDesmarcar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("desmarcar-QUARTA"));
    fireEvent.click(screen.getByTestId("desmarcar-confirmar"));
    expect(onDesmarcar).toHaveBeenCalledWith(QUARTA7, "QUARTA");
  });

  it("página: confirmar tira quarta do registro, volume, carimbo e histórico (a quarta anterior fica); Desfazer devolve tudo", async () => {
    const store = storeTreino();
    store.montar(<Treino />);
    fireEvent.click(screen.getByTestId("aba-semana"));
    const linha = await screen.findByTestId("semana-QUARTA");
    expect(within(linha).getByText(/1.200 kg|1200 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("desmarcar-QUARTA"));
    fireEvent.click(screen.getByTestId("desmarcar-confirmar"));

    expect(store.ler<string[]>("saude-workout-log")).toEqual(["2026-09-30"]);
    expect(store.ler<Record<string, number>>("treino-weekly-volume")).toEqual({ "2026-09-30": 900 });
    expect(Object.keys(store.ler<Record<string, unknown>>("treino-sessoes"))).toEqual(["2026-09-30"]);
    expect(store.ler<{ date: string }[]>("treino-exercise-history").map((h) => h.date)).toEqual(["2026-09-30"]);
    // o plano (grupos e exercícios) não foi tocado
    expect(store.ler<typeof PLANO_TREINO>("saude-workouts-v2").QUARTA.exercises).toHaveLength(1);
    expect(screen.queryByTestId("confirmar-desmarcar")).toBeNull();
    expect(screen.queryByTestId("desmarcar-QUARTA")).toBeNull(); // o ✓ saiu

    const [texto, desfazer] = vi.mocked(avisarApagado).mock.calls.at(-1) as [string, () => void];
    expect(texto).toBe("Treino de quarta, 07/10 desmarcado");
    act(() => desfazer());
    expect(store.ler<string[]>("saude-workout-log")).toEqual(["2026-09-30", QUARTA7]);
    expect(store.ler<Record<string, number>>("treino-weekly-volume")[QUARTA7]).toBe(1200);
    expect(store.ler<{ date: string }[]>("treino-exercise-history")).toHaveLength(2);
    expect(await screen.findByTestId("desmarcar-QUARTA")).toBeInTheDocument();
  });

  it("página: o de HOJE continua desmarcando pela SEMANA também (mesma função)", async () => {
    const store = storeTreino({ "saude-workout-log": [QUARTA7, HOJE], "treino-weekly-volume": { [QUARTA7]: 1200, [HOJE]: 500 } });
    store.montar(<Treino />);
    fireEvent.click(screen.getByTestId("aba-semana"));
    fireEvent.click(await screen.findByTestId("desmarcar-SEXTA"));
    expect(screen.getByTestId("confirmar-desmarcar").textContent).toMatch(/sexta, 09\/10/);
    fireEvent.click(screen.getByTestId("desmarcar-confirmar"));
    expect(store.ler<string[]>("saude-workout-log")).toEqual([QUARTA7]);
    expect(vi.mocked(avisarApagado).mock.calls.at(-1)?.[0]).toBe("Treino de hoje desmarcado");
  });
});

/* ------------------------------------------------------------------ 3) RECOMEÇAR O PLANO */
describe("3) PLANO — recomeçar do zero", () => {
  it("o botão só existe com plano; confirmar zera grupos, exercícios e dias de treino; histórico, registro, volume e recordes ficam; Desfazer volta", async () => {
    const store = storeTreino({ "saude-prs": [{ exercise: "Remada", carga: "40kg", date: QUARTA7 }] });
    store.montar(<Treino />);
    fireEvent.click(screen.getByTestId("aba-plano"));
    const botao = await screen.findByTestId("recomecar-plano");
    expect(botao.textContent).toMatch(/Recomeçar plano do zero/);
    expect(botao.textContent).toMatch(/histórico e recordes continuam/);
    fireEvent.click(botao);
    const caixa = screen.getByRole("alertdialog");
    expect(caixa.textContent).toMatch(/Apaga os grupos e os exercícios dos 7 dias/);
    expect(caixa.textContent).toMatch(/histórico, a evolução e os recordes continuam/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(store.ler<typeof PLANO_TREINO>("saude-workouts-v2").QUARTA.exercises).toHaveLength(1);

    fireEvent.click(screen.getByTestId("recomecar-plano"));
    fireEvent.click(screen.getByTestId("recomecar-confirmar"));
    const plano = store.ler<Record<string, { muscles: string[]; exercises: unknown[] }>>("saude-workouts-v2");
    expect(Object.keys(plano).sort()).toEqual(["DOMINGO", "QUARTA", "QUINTA", "SEGUNDA", "SEXTA", "SÁBADO", "TERÇA"].sort());
    expect(Object.values(plano).every((d) => d.muscles.length === 0 && d.exercises.length === 0)).toBe(true);
    expect(store.ler<string[]>("treino-active-days")).toEqual([]);
    expect(store.ler<unknown[]>("treino-exercise-history")).toHaveLength(2);
    expect(store.ler<string[]>("saude-workout-log")).toEqual(["2026-09-30", QUARTA7]);
    expect(store.ler<Record<string, number>>("treino-weekly-volume")[QUARTA7]).toBe(1200);
    expect(store.ler<unknown[]>("saude-prs")).toHaveLength(1);
    // o PLANO vazio mostra os modelos no topo e o botão de recomeçar some
    expect(await screen.findByTestId("modelos-prontos")).toBeInTheDocument();
    expect(screen.queryByTestId("recomecar-plano")).toBeNull();

    const [texto, desfazer] = vi.mocked(avisarApagado).mock.calls.at(-1) as [string, () => void];
    expect(texto).toBe("Plano de treino zerado");
    act(() => desfazer());
    expect(store.ler<typeof PLANO_TREINO>("saude-workouts-v2").QUARTA.exercises).toHaveLength(1);
    expect(store.ler<string[]>("treino-active-days")).toEqual(["QUARTA", "SEXTA"]);
    expect(await screen.findByTestId("recomecar-plano")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ 4) PRAZO NA TAREFA */
describe("4) tarefas — prazo (data limite)", () => {
  const base = (extra: Partial<TarefaDoDia> & { id: string; texto: string }): TarefaDoDia => ({ feito: false, dia: HOJE, ...extra });

  it("prazoDaTarefa/diaDoAviso: só data legível; o aviso é do dia do prazo", () => {
    expect(prazoDaTarefa(base({ id: "a", texto: "x", prazo: "2026-10-10" }))).toBe("2026-10-10");
    expect(prazoDaTarefa(base({ id: "b", texto: "x", prazo: "10/10" as never }))).toBeNull();
    expect(prazoDaTarefa(base({ id: "c", texto: "x" }))).toBeNull();
    expect(diaDoAviso(base({ id: "d", texto: "x", dia: "2026-10-01", prazo: "2026-10-10" }))).toBe("2026-10-10");
    expect(diaDoAviso(base({ id: "e", texto: "x", dia: "2026-10-01" }))).toBe("2026-10-01");
  });

  it("estadoDoPrazo: 'vence hoje', 'vence amanhã', 'vence sexta', 'vence 20/10', 'atrasada' (vermelho); feita não tem selo", () => {
    const em = (prazo: string) => estadoDoPrazo(base({ id: "x", texto: "x", prazo }), HOJE);
    expect(em(HOJE)).toMatchObject({ hoje: true, atrasada: false, rotulo: "vence hoje", texto: "Vence hoje" });
    expect(em("2026-10-10")).toMatchObject({ rotulo: "vence amanhã", texto: "Vence amanhã (sábado, 10/10)", dias: 1 });
    expect(em("2026-10-13")).toMatchObject({ rotulo: "vence terça", texto: "Vence terça, 13/10 (em 4 dias)" });
    expect(em("2026-10-20")).toMatchObject({ rotulo: "vence 20/10", dias: 11 });
    expect(em(QUARTA7)).toMatchObject({ atrasada: true, rotulo: "atrasada", texto: "Atrasada — venceu quarta, 07/10 (há 2 dias)", dias: -2 });
    expect(em("2026-10-08")?.texto).toBe("Atrasada — venceu quinta, 08/10 (ontem)");
    expect(estadoDoPrazo(base({ id: "f", texto: "x", prazo: QUARTA7, feito: true }), HOJE)).toBeNull();
    expect(estadoDoPrazo(base({ id: "g", texto: "x" }), HOJE)).toBeNull();
  });

  it("apareceHoje: a de hoje sempre; a com prazo pendente de qualquer dia passado (até além dos 7 dias); a feita hoje fica riscada até amanhã; sem prazo, só hoje", () => {
    expect(apareceHoje(base({ id: "a", texto: "x" }), HOJE)).toBe(true);
    expect(apareceHoje(base({ id: "b", texto: "x", feito: true }), HOJE)).toBe(true);
    expect(apareceHoje(base({ id: "c", texto: "x", dia: "2026-09-20", prazo: "2026-10-15" }), HOJE)).toBe(true); // 19 dias atrás
    expect(apareceHoje(base({ id: "d", texto: "x", dia: "2026-09-20", prazo: "2026-10-01" }), HOJE)).toBe(true); // atrasada, segue
    expect(apareceHoje(base({ id: "e", texto: "x", dia: "2026-09-20", prazo: "2026-10-01", feito: true, feitoEm: HOJE }), HOJE)).toBe(true);
    expect(apareceHoje(base({ id: "f", texto: "x", dia: "2026-09-20", prazo: "2026-10-01", feito: true, feitoEm: "2026-10-08" }), HOJE)).toBe(false);
    expect(apareceHoje(base({ id: "g", texto: "x", dia: "2026-09-20", prazo: "2026-10-01", feito: true }), HOJE)).toBe(false);
    expect(apareceHoje(base({ id: "h", texto: "x", dia: "2026-10-08" }), HOJE)).toBe(false); // sem prazo: é do "Ficou de ontem"
    expect(apareceHoje(base({ id: "i", texto: "x", dia: "2026-10-12", prazo: "2026-10-15" }), HOJE)).toBe(false); // dia no futuro: não
  });

  it("Ficou de ontem não repete a tarefa com prazo (ela já está na lista de hoje); a sem prazo continua lá, com a janela de 7 dias de sempre", () => {
    const lista: TarefaDoDia[] = [
      base({ id: "p", texto: "Entregar o relatório", dia: "2026-10-05", prazo: "2026-10-15" }),
      base({ id: "s", texto: "Lavar o carro", dia: "2026-10-05" }),
      base({ id: "v", texto: "Velha demais", dia: "2026-09-30" }),
    ];
    const itens = tarefasQueFicaram([{ chave: CHAVE_TAREFAS_ROTINA, lista }], HOJE);
    expect(itens.map((i) => i.tarefa.id)).toEqual(["s"]);
  });

  it("aviso: com prazo e horário, a tarefa pendente agenda no DIA DO PRAZO (mesma faixa de id, nada novo); prazo passado não agenda", () => {
    const comPrazo = base({ id: "p", texto: "Entregar o relatório", dia: "2026-10-05", prazo: "2026-10-13", hora: "09:00", aviso: 30 });
    const vencida = base({ id: "v", texto: "Vencida", dia: "2026-10-05", prazo: "2026-10-08", hora: "09:00", aviso: 0 });
    const ag = tarefasAgendaveis([{ chave: CHAVE_TAREFAS_ROTINA, lista: [comPrazo, vencida] }], HOJE);
    expect(ag).toHaveLength(1);
    expect(ag[0]).toMatchObject({ id: "p", dia: "2026-10-13", hora: "09:00", aviso: 30, rota: "/rotina" });
    const avisos = planejarTarefas(ag, 1600000, new Date(2026, 9, 9, 10, 0));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].quando).toEqual(new Date(2026, 9, 13, 8, 30));
    expect(avisos[0].id).toBe(1600000);
  });

  it("tela (Rotina): a tarefa com prazo de 19 dias atrás aparece na lista de hoje com 'atrasada' e NÃO no Ficou de ontem; a que vence sexta mostra o selo; a ficha diz por extenso", async () => {
    const store = criarStore({
      [CHAVE_TAREFAS_ROTINA]: [
        { id: "atr", texto: "Renovar a CNH", feito: false, dia: "2026-09-20", prazo: "2026-10-01" },
        { id: "sex", texto: "Entregar o relatório", feito: false, dia: "2026-10-06", prazo: "2026-10-10", hora: "09:00", aviso: 0 },
        { id: "ontem", texto: "Lavar o carro", feito: false, dia: "2026-10-08" },
        { id: "hoje", texto: "Comprar pão", feito: false, dia: HOJE },
      ],
    });
    store.montar(<TarefasDeHoje chave={CHAVE_TAREFAS_ROTINA} onde="Rotina" />);
    const lista = screen.getByTestId("tarefas-de-hoje");
    const textos = within(lista).getAllByTestId("linha-tarefa").map((l) => l.textContent ?? "");
    expect(textos.some((t) => /Renovar a CNH/.test(t) && /atrasada/.test(t))).toBe(true);
    expect(textos.some((t) => /Entregar o relatório/.test(t) && /vence amanhã/.test(t))).toBe(true);
    expect(textos.some((t) => /Lavar o carro/.test(t))).toBe(false); // sem prazo: fica no Ficou de ontem
    expect(within(screen.getByTestId("ficou-de-ontem")).getByText("Lavar o carro")).toBeInTheDocument();
    expect(within(lista).getByText("0/3")).toBeInTheDocument();
    const selos = within(lista).getAllByTestId("prazo-da-linha");
    expect(selos.find((s) => /atrasada/.test(s.textContent ?? ""))).toHaveAttribute("data-atrasada", "true");

    fireEvent.click(screen.getByRole("button", { name: "Abrir Renovar a CNH" }));
    const ficha = await screen.findByTestId("ficha-tarefa");
    expect(within(ficha).getByTestId("ficha-prazo").textContent).toMatch(/Atrasada — venceu quinta, 01\/10 \(há 8 dias\)/);
    expect(ficha.textContent).toMatch(/Tarefa com prazo · Rotina/);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // marcar a atrasada: `feitoEm` de hoje e ela continua na lista, riscada, sem selo
    fireEvent.click(within(lista).getByRole("checkbox", { name: "Concluir Renovar a CNH" }));
    const gravada = store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA).find((t) => t.id === "atr") as TarefaDoDia;
    expect(gravada).toMatchObject({ feito: true, feitoEm: HOJE, prazo: "2026-10-01", dia: "2026-09-20" });
    const linhaFeita = within(screen.getByTestId("tarefas-de-hoje")).getAllByTestId("linha-tarefa").find((l) => /Renovar a CNH/.test(l.textContent ?? "")) as HTMLElement;
    expect(linhaFeita).toBeTruthy();
    expect(within(linhaFeita).queryByTestId("prazo-da-linha")).toBeNull();
    // desmarcar tira o feitoEm
    fireEvent.click(within(linhaFeita).getByRole("checkbox", { name: "Concluir Renovar a CNH" }));
    const devolta = store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA).find((t) => t.id === "atr") as TarefaDoDia;
    expect(devolta.feito).toBe(false);
    expect("feitoEm" in devolta).toBe(false);
  });

  it("tela (formulário): o campo PRAZO grava `prazo` na tarefa nova; a dica do aviso diz que toca no dia do prazo; tirar o prazo apaga o campo", async () => {
    const store = criarStore({ [CHAVE_TAREFAS_ROTINA]: [] });
    store.montar(<TarefasDeHoje chave={CHAVE_TAREFAS_ROTINA} onde="Rotina" />);
    fireEvent.click(screen.getByRole("button", { name: "Tarefa com horário ou detalhes" }));
    const form = await screen.findByTestId("form-tarefa");
    expect(within(form).getByTestId("dica-do-prazo").textContent).toMatch(/continua na lista todo dia/);
    fireEvent.change(within(form).getByLabelText("O que precisa fazer"), { target: { value: "Pagar o IPVA" } });
    fireEvent.change(within(form).getByLabelText("Prazo da tarefa"), { target: { value: "2026-10-13" } });
    expect(within(form).getByTestId("prazo-da-linha").textContent).toMatch(/vence terça/);
    fireEvent.change(within(form).getByLabelText("Horário da tarefa"), { target: { value: "14:00" } });
    expect(within(form).getByTestId("dica-do-aviso").textContent).toBe("O aviso toca terça às 14:00.");
    fireEvent.click(within(form).getByRole("button", { name: "Salvar tarefa" }));
    const [t] = store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA);
    expect(t).toMatchObject({ texto: "Pagar o IPVA", dia: HOJE, prazo: "2026-10-13", hora: "14:00", aviso: 0 });
    expect(typeof t.criadaEm).toBe("string");

    // editar: tirar o prazo apaga o campo (não fica "" nem null)
    fireEvent.click(screen.getByRole("button", { name: "Abrir Pagar o IPVA" }));
    const ficha = await screen.findByTestId("ficha-tarefa");
    expect(within(ficha).getByTestId("ficha-prazo").textContent).toMatch(/Vence terça, 13\/10 \(em 4 dias\)/);
    expect(within(ficha).getByTestId("ficha-aviso").textContent).toMatch(/Avisa às 14:00, na hora, terça/);
    fireEvent.click(within(ficha).getByRole("button", { name: "Editar tarefa" }));
    const form2 = await screen.findByTestId("form-tarefa");
    expect((within(form2).getByLabelText("Prazo da tarefa") as HTMLInputElement).value).toBe("2026-10-13");
    fireEvent.click(within(form2).getByRole("button", { name: "Tirar o prazo" }));
    fireEvent.click(within(form2).getByRole("button", { name: "Salvar alterações" }));
    const [t2] = store.ler<TarefaDoDia[]>(CHAVE_TAREFAS_ROTINA);
    expect("prazo" in t2).toBe(false);
    expect(t2.hora).toBe("14:00");
  });

  it("tela (Home): o widget Tarefas de hoje mostra a tarefa com prazo de outra data, com o selo", () => {
    const store = criarStore({
      [CHAVE_TAREFAS_ROTINA]: [{ id: "p", texto: "Renovar a CNH", feito: false, dia: "2026-09-20", prazo: HOJE }],
      "career-day-tasks": [{ id: "c", texto: "Fechar a proposta", feito: false, dia: "2026-10-01", prazo: "2026-10-16" }],
    });
    store.montar(<TasksWidget />);
    const w = screen.getByTestId("tasks-widget");
    const linhas = within(w).getAllByTestId("linha-tarefa").map((l) => l.textContent ?? "");
    expect(linhas.some((t) => /Renovar a CNH/.test(t) && /vence hoje/.test(t))).toBe(true);
    expect(linhas.some((t) => /Fechar a proposta/.test(t) && /vence 16\/10/.test(t))).toBe(true);
    expect(screen.getByTestId("contagem-tarefas").textContent).toBe("0/2 feitas");
    expect(screen.queryByTestId("ficou-de-ontem")).toBeNull();
  });

  it("compat: o app antigo das lojas marca com {...x, feito: !x.feito}, filtra por dia === hoje e apaga com filter — `prazo` e `feitoEm` sobrevivem e nada quebra", () => {
    const lista: TarefaDoDia[] = [
      { id: "p", texto: "Renovar a CNH", feito: false, dia: "2026-09-20", prazo: "2026-10-01" },
      { id: "h", texto: "Comprar pão", feito: true, dia: HOJE, feitoEm: HOJE },
    ];
    // o que o app antigo faz: só enxerga as de hoje e regrava a lista inteira
    const antigoHoje = lista.filter((t) => t.dia === HOJE);
    expect(antigoHoje.map((t) => t.id)).toEqual(["h"]); // a com prazo não aparece lá (como nunca apareceu), mas não some
    const regravada = lista.map((x) => (x.id === "h" ? { ...x, feito: !x.feito } : x));
    expect(regravada.find((t) => t.id === "p")).toEqual(lista[0]);
    expect(regravada.find((t) => t.id === "h")).toMatchObject({ feito: false, feitoEm: HOJE });
    // de volta no app novo: a com prazo segue aparecendo; a de hoje desmarcada pelo antigo fica com feitoEm "velho", que só vale com feito=true
    expect(apareceHoje(regravada[0], HOJE)).toBe(true);
    expect(estadoDoPrazo(regravada[0], HOJE)?.atrasada).toBe(true);
    expect(regravada.filter((t) => t.id !== "p")).toHaveLength(1);
  });
});
