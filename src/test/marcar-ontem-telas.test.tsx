/**
 * "Esqueceu de marcar?" (02/10), as TELAS — Treino, hábitos da Rotina e
 * skincare da Beleza — com o useUserData de VERDADE (servidor simulado): abrir →
 * marcar ontem/anteontem → sair → REABRIR (o ciclo que o dono exige) e conferir
 * o que o cliente veria: a marca no dia certo, o dia na sequência e hoje intocado.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

let linhasDoServidor: Array<{ key: string; value: unknown }> = [];
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
const auth = { user: { id: "u1" }, session: null, loading: false, isSubscribed: true, subLoaded: true };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, p?: unknown) => { eventos.push([n, p]); },
  trackEventBeacon: () => {},
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastFn, Toaster: () => null }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, isIOS: () => false, isAndroid: () => false, plataformaApp: () => "web" }));
vi.mock("@/integrations/supabase/client", () => {
  const selecao: Record<string, (...a: unknown[]) => unknown> = {
    eq: () => selecao,
    in: () => Promise.resolve({ data: [], error: null }),
    abortSignal: async () => ({ data: linhasDoServidor, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return {
    supabase: {
      from: () => ({
        select: () => selecao,
        // o servidor guarda o que chega: o "REABRIR" lê o que foi gravado de verdade
        upsert: (linha: { key: string; value: unknown }) => {
          linhasDoServidor = [...linhasDoServidor.filter((l) => l.key !== linha.key), { key: linha.key, value: JSON.parse(JSON.stringify(linha.value)) }];
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      functions: { invoke: vi.fn() },
      auth: { getUser: async () => ({ data: { user: null } }) },
      storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
    },
  };
});

import { UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_DIAS_ANOTADOS } from "@/lib/sequencia";
import Treino from "@/pages/Treino";
import Rotina from "@/pages/Rotina";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";

let api: UserDataContextType;
const Sonda = () => { api = useUserData(); return null; };
const dados = <T,>(k: string, f: T) => api.get<T>(k, f);
const anotados = () => dados<string[]>(CHAVE_DIAS_ANOTADOS, []);

const montar = async (ui: ReactNode) => {
  const r = render(<MemoryRouter><UserDataProvider><Sonda />{ui}</UserDataProvider></MemoryRouter>);
  await waitFor(() => expect(api.loaded).toBe(true));
  return r;
};
const servidor = (m: Record<string, unknown>) => { linhasDoServidor = Object.entries(m).map(([key, value]) => ({ key, value })); };
const fixar = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => { eventos.length = 0; toastFn.mockClear(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const SEXTA = new Date(2026, 9, 2, 10, 0); // 02/10, sexta
const HOJE = "2026-10-02";
const ONTEM = "2026-10-01"; // quinta
const ANTEONTEM = "2026-09-30"; // quarta

/* ═══════════════════════════════ TREINO ═══════════════════════════════ */

const ex = (name: string, sets: string, reps: string, carga: string) => ({ name, sets, reps, carga, done: false, obs: "" });
const PLANO = {
  SEGUNDA: { muscles: [], exercises: [] }, "TERÇA": { muscles: [], exercises: [] },
  QUARTA: { muscles: ["Costas"], exercises: [ex("Remada curvada", "3", "10", "30")] },
  QUINTA: { muscles: ["Peito", "Tríceps"], exercises: [ex("Supino reto", "3", "10", "40"), ex("Crucifixo", "2", "12", "10")] },
  SEXTA: { muscles: ["Pernas"], exercises: [ex("Agachamento", "3", "8", "60")] },
  "SÁBADO": { muscles: [], exercises: [] }, DOMINGO: { muscles: [], exercises: [] },
};

describe("Treino: marcar o treino de ontem", () => {
  const abrirOntem = async () => {
    fireEvent.click(screen.getByTestId("treino-ontem"));
    await screen.findByTestId("folha-treino-ontem");
    return within(screen.getByTestId("folha-treino-ontem"));
  };

  it("ciclo completo: abre → marca (com uma série ajustada) → salva → REABRE e está lá; ontem entrou na sequência, hoje não", async () => {
    fixar(SEXTA);
    servidor({ "saude-workouts-v2": PLANO, "treino-active-days": ["QUARTA", "QUINTA", "SEXTA"], [CHAVE_DIAS_ANOTADOS]: ["2026-09-29", ANTEONTEM] });
    const { unmount } = await montar(<Treino />);

    // o pé discreto no HOJE; a tela de hoje segue sendo a de sexta
    // (espera o pé montar: na suíte inteira, com a máquina cheia, o Treino demora mais a carregar)
    expect(await screen.findByTestId("treino-esqueceu", {}, { timeout: 8000 })).toHaveTextContent("ESQUECEU?");
    expect(screen.getByTestId("treino-hoje")).toHaveTextContent("SEXTA");
    expect(screen.getByTestId("treino-ontem")).not.toHaveTextContent("✓");

    let folha = await abrirOntem();
    expect(screen.getByTestId("folha-treino-ontem")).toHaveTextContent("QUI · TREINO DE ONTEM");
    expect(screen.getByTestId("aviso-outro-dia")).toHaveTextContent("Marcando em ontem (qui 01/10)");
    // é o treino de QUINTA (o dia da semana daquela data), com o previsto
    expect(folha.getByTestId("ontem-Supino reto")).toHaveTextContent("3 × 10 · 40 kg");
    expect(folha.queryByText("Agachamento")).not.toBeInTheDocument();
    expect(folha.getByTestId("salvar-treino-ontem")).toBeDisabled(); // nada marcado ainda

    fireEvent.click(folha.getByRole("button", { name: "Marcar Supino reto inteiro em ontem" }));
    expect(folha.getByTestId("contagem-ontem")).toHaveTextContent("3/5 séries marcadas");
    // foi mais leve na 3ª série: abre o exercício, muda a carga e desmarca nada
    fireEvent.click(folha.getByRole("button", { name: "Ajustar as séries de Supino reto" }));
    fireEvent.click(within(folha.getByTestId("serie-Supino reto-3")).getAllByRole("cell")[1]); // a linha vira "ativa" (−/+ e digitar)
    fireEvent.click(folha.getByRole("button", { name: "Carga da série 3: 40. Toque pra digitar" }));
    const campo = folha.getByLabelText("Carga da série 3");
    fireEvent.change(campo, { target: { value: "35" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    fireEvent.click(folha.getByRole("button", { name: "Marcar Crucifixo inteiro em ontem" }));
    expect(folha.getByTestId("contagem-ontem")).toHaveTextContent("5/5 séries marcadas");

    fireEvent.click(folha.getByTestId("salvar-treino-ontem"));
    await waitFor(() => expect(screen.queryByTestId("folha-treino-ontem")).not.toBeInTheDocument());

    // o que gravou: o mesmo de um "Concluir", na DATA de ontem
    expect(dados<string[]>("saude-workout-log", [])).toEqual([ONTEM]);
    const hist = dados<Array<{ date: string; exercise: string; series?: Array<{ carga: number; reps: number }> }>>("treino-exercise-history", []);
    expect(hist.filter((h) => h.date === ONTEM).map((h) => h.exercise).sort()).toEqual(["Crucifixo", "Supino reto"]);
    expect(hist.find((h) => h.exercise === "Supino reto")?.series?.map((s) => s.carga)).toEqual([40, 40, 35]);
    expect(dados<Record<string, { dia: string }>>("treino-sessoes", {})[ONTEM]).toMatchObject({ dia: "QUINTA" });
    expect(dados<Record<string, number>>("treino-weekly-volume", {})[ONTEM]).toBe(40 * 10 * 2 + 35 * 10 + 10 * 12 * 2);
    // a sessão de HOJE não foi tocada
    expect(dados("treino-sessao", null)).toBeNull();
    // a sequência: ontem entrou, hoje NÃO
    expect(anotados()).toEqual(["2026-09-29", ANTEONTEM, ONTEM]);
    expect(eventos).toContainEqual(["marcou_ontem", { modulo: "treino", dias_atras: 1 }]);
    expect(toastFn.mock.calls.map((c) => c[0])).toContain("🔥 Ontem entrou na sequência · 3 dias seguidos");

    // SAI e REABRE: ✓ no ONTEM, e a folha mostra o que foi salvo
    unmount();
    await montar(<Treino />);
    expect(screen.getByRole("button", { name: /Marcar o treino de ontem, qui 01\/10 \(já marcado\)/ })).toBeInTheDocument();
    folha = await abrirOntem();
    expect(folha.getByTestId("contagem-ontem")).toHaveTextContent("5/5 séries marcadas");
    expect(folha.getByTestId("salvar-treino-ontem")).toHaveTextContent("Salvar treino de ontem");
    // e hoje segue sem treino e sem dia anotado
    expect(anotados()).not.toContain(HOJE);
    expect(screen.getByTestId("contagem-series")).toHaveTextContent("0/3 séries");
  });

  it("anteontem: troca no seletor, abre o treino de QUARTA, salva e a SEMANA mostra o dia feito", async () => {
    fixar(SEXTA);
    servidor({ "saude-workouts-v2": PLANO, "treino-active-days": ["QUARTA", "QUINTA", "SEXTA"] });
    await montar(<Treino />);
    const folha = await abrirOntem();
    fireEvent.click(folha.getByTestId("dia-anteontem"));
    expect(screen.getByTestId("folha-treino-ontem")).toHaveTextContent("QUA · TREINO DE ANTEONTEM");
    expect(folha.getByTestId("ontem-Remada curvada")).toBeInTheDocument();
    expect(folha.queryByTestId("ontem-Supino reto")).not.toBeInTheDocument();
    fireEvent.click(folha.getByRole("button", { name: "Marcar Remada curvada inteiro em anteontem" }));
    fireEvent.click(folha.getByTestId("salvar-treino-ontem"));
    await waitFor(() => expect(screen.queryByTestId("folha-treino-ontem")).not.toBeInTheDocument());
    expect(dados<string[]>("saude-workout-log", [])).toEqual([ANTEONTEM]);
    expect(anotados()).toEqual([ANTEONTEM]);
    expect(eventos).toContainEqual(["marcou_ontem", { modulo: "treino", dias_atras: 2 }]);
    fireEvent.click(screen.getByTestId("aba-semana"));
    const quarta = within(screen.getByTestId("treino-semana")).getByText("Costas").closest("tr") as HTMLElement;
    // 09/10: o ✓ de um dia feito virou botão (desmarcar o dia pela SEMANA)
    expect(within(quarta).getByRole("button", { name: /Desmarcar o treino de quarta/ })).toBeTruthy();
    expect(screen.getByTestId("treino-semana")).toHaveTextContent("1 de 3 feito");
  });

  it("dia sem treino montado oferece os treinos que existem ('Qual treino foi?'); plano vazio não mostra o pé", async () => {
    fixar(new Date(2026, 9, 3, 10, 0)); // sábado: ontem = sexta (tem), anteontem = quinta (tem)
    servidor({ "saude-workouts-v2": { ...PLANO, SEXTA: { muscles: [], exercises: [] } }, "treino-active-days": ["QUARTA", "QUINTA"] });
    await montar(<Treino />);
    const folha = await abrirOntem();
    // sexta (ontem) está vazia: abre no 1º que existe e deixa escolher
    expect(folha.getByText("QUAL TREINO FOI?")).toBeInTheDocument();
    expect(folha.getByTestId("ontem-Remada curvada")).toBeInTheDocument();
    fireEvent.click(folha.getByRole("button", { name: /Treino de quinta: Peito \+ Tríceps/ }));
    expect(folha.getByTestId("ontem-Supino reto")).toBeInTheDocument();
    cleanup();
    servidor({});
    await montar(<Treino />);
    expect(screen.queryByTestId("treino-esqueceu")).not.toBeInTheDocument();
  });

  it("tirar o treino: salvar sem nada marcado desfaz o dia (registro, histórico, volume) e não anota dia nenhum", async () => {
    fixar(SEXTA);
    servidor({
      "saude-workouts-v2": PLANO, "treino-active-days": ["QUINTA"],
      "saude-workout-log": [ONTEM], "treino-weekly-volume": { [ONTEM]: 800 }, "treino-sessoes": { [ONTEM]: { dia: "QUINTA" } },
      "treino-exercise-history": [{ date: ONTEM, exercise: "Supino reto", sets: "3", reps: "10", carga: "40kg", series: [{ carga: 40, reps: 10 }] }],
      [CHAVE_DIAS_ANOTADOS]: [ONTEM],
    });
    await montar(<Treino />);
    expect(screen.getByTestId("treino-ontem")).toHaveTextContent("ONTEM");
    const folha = await abrirOntem();
    // o que foi salvo vem de volta (1 série feita de 3): marca tudo e desmarca tudo = nada feito
    expect(folha.getByTestId("contagem-ontem")).toHaveTextContent("1/5 séries marcadas");
    fireEvent.click(folha.getByRole("button", { name: "Marcar Supino reto inteiro em ontem" }));
    fireEvent.click(folha.getByRole("button", { name: "Desmarcar Supino reto inteiro em ontem" }));
    expect(folha.getByTestId("contagem-ontem")).toHaveTextContent("0/5 séries marcadas");
    expect(folha.getByTestId("salvar-treino-ontem")).toHaveTextContent("Tirar o treino de ontem");
    fireEvent.click(folha.getByTestId("salvar-treino-ontem"));
    await waitFor(() => expect(screen.queryByTestId("folha-treino-ontem")).not.toBeInTheDocument());
    expect(dados<string[]>("saude-workout-log", [])).toEqual([]);
    expect(dados<unknown[]>("treino-exercise-history", [])).toEqual([]);
    expect(dados<Record<string, number>>("treino-weekly-volume", {})[ONTEM]).toBeUndefined();
    expect(eventos.filter(([n]) => n === "marcou_ontem")).toEqual([]);
  });
});

/* ═══════════════════════════ HÁBITOS DA ROTINA ═══════════════════════════ */

describe("Rotina: marcar na grade conta o dia certo na sequência", () => {
  it("tocar numa linha PASSADA da grade da semana também anota aquele dia (e não hoje); na linha de hoje, hoje", async () => {
    fixar(SEXTA);
    servidor({ "rotina-habits": ["Beber água"], "rotina-habits-week": "2026-09-28", "rotina-habits-checked": {}, [CHAVE_DIAS_ANOTADOS]: ["2026-09-29"] });
    await montar(<Rotina />);
    // 02/10 (dono): sem faixa "esqueceu?" nem rótulos HOJE/ONTEM/ANTEONTEM na grade — a própria grade já é a semana
    expect(screen.queryByTestId("esqueceu-de-marcar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("linha-hoje")).not.toBeInTheDocument();
    const caixa = (dia: string) => within(screen.getByText(dia, { selector: "td" }).closest("tr") as HTMLElement).getByRole("checkbox");
    fireEvent.click(caixa("QUINTA")); // ontem
    expect(anotados()).toEqual(["2026-09-29", ONTEM]);
    fireEvent.click(caixa("SEGUNDA")); // 4 dias atrás: grava na grade, mas não anota dia nenhum
    expect(anotados()).toEqual(["2026-09-29", ONTEM]);
    expect((dados<Record<string, boolean[]>>("rotina-habits-checked", {})).SEGUNDA).toEqual([true]);
    fireEvent.click(caixa("SEXTA")); // hoje
    expect(anotados()).toEqual(["2026-09-29", ONTEM, HOJE]);
  });
});

/* ═══════════════════════════ SKINCARE DA BELEZA ═══════════════════════════ */

describe("Beleza: skincare de ontem e anteontem", () => {
  const ROTINA = {
    "skincare-am-steps": [{ name: "Gel de limpeza" }, { name: "Protetor solar", isSunscreen: true }],
    "skincare-pm-steps": [{ name: "Demaquilante" }, { name: "Hidratante" }, { name: "Sérum" }],
  };

  it("ciclo completo: marca a NOITE de anteontem (28/09 do cliente) → sai e REABRE → está lá; anteontem entrou na sequência, hoje não", async () => {
    fixar(SEXTA);
    servidor({ ...ROTINA, [CHAVE_DIAS_ANOTADOS]: ["2026-09-28", "2026-09-29"] });
    const { unmount } = await montar(<SkincareRoutine />);
    const card = () => within(screen.getByTestId("skincare-do-dia"));
    // os três botões; hoje é o padrão e nada mudou na tela de hoje
    expect(card().getByRole("button", { name: "HOJE" })).toHaveAttribute("aria-pressed", "true");
    expect(card().queryByTestId("faixa-outro-dia")).not.toBeInTheDocument();

    fireEvent.click(card().getByRole("button", { name: "ANTEONTEM" }));
    expect(screen.getByTestId("skincare-do-dia")).toHaveTextContent("QUARTA · 30/09");
    expect(screen.getByTestId("skincare-do-dia")).toHaveTextContent("Skincare de anteontem");
    expect(card().getByTestId("faixa-outro-dia")).toHaveTextContent("Marcando em anteontem (qua 30/09). Conta na sua sequência.");
    const noite = within(card().getByTestId("periodo-noite"));
    fireEvent.click(noite.getByRole("checkbox", { name: "Marcar Demaquilante" }));
    fireEvent.click(noite.getByRole("checkbox", { name: "Marcar Hidratante" }));
    expect(card().getByTestId("contagem-skincare")).toHaveTextContent("2/5");
    expect(dados("skincare-night-checked", {})).toEqual({ [ANTEONTEM]: [0, 1] });
    expect(anotados()).toEqual(["2026-09-28", "2026-09-29", ANTEONTEM]);
    expect(eventos).toContainEqual(["marcou_ontem", { modulo: "beleza", dias_atras: 2 }]);
    // hoje continua vazio, e voltar pra hoje mostra 0
    fireEvent.click(card().getByTestId("voltar-pra-hoje"));
    expect(card().getByTestId("contagem-skincare")).toHaveTextContent("0/5");
    expect(card().queryByTestId("faixa-outro-dia")).not.toBeInTheDocument();
    expect(anotados()).not.toContain(HOJE);

    unmount();
    await montar(<SkincareRoutine />);
    fireEvent.click(card().getByRole("button", { name: "ANTEONTEM" }));
    expect(card().getByTestId("contagem-skincare")).toHaveTextContent("2/5");
    expect(within(card().getByTestId("periodo-noite")).getByRole("checkbox", { name: "Marcar Demaquilante" })).toHaveAttribute("aria-checked", "true");
    // desmarcar: tira a marca, não mexe na sequência
    fireEvent.click(within(card().getByTestId("periodo-noite")).getByRole("checkbox", { name: "Marcar Demaquilante" }));
    expect(card().getByTestId("contagem-skincare")).toHaveTextContent("1/5");
    expect(anotados()).toEqual(["2026-09-28", "2026-09-29", ANTEONTEM]);
  });

  it("ontem + o ✓ que fecha o buraco: a sequência vira uma corrente só", async () => {
    fixar(SEXTA);
    servidor({ ...ROTINA, [CHAVE_DIAS_ANOTADOS]: ["2026-09-28", "2026-09-29", ANTEONTEM, HOJE] });
    await montar(<SkincareRoutine />);
    fireEvent.click(within(screen.getByTestId("skincare-do-dia")).getByRole("button", { name: "ONTEM" }));
    fireEvent.click(within(screen.getByTestId("periodo-manha")).getByRole("checkbox", { name: "Marcar Gel de limpeza" }));
    expect(anotados()).toEqual(["2026-09-28", "2026-09-29", ANTEONTEM, ONTEM, HOJE]);
    expect(toastFn.mock.calls.map((c) => c[0])).toContain("🔥 Ontem entrou na sequência · 5 dias seguidos");
  });
});
