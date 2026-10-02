/**
 * "Esqueceu de marcar?" (02/10) no useUserData de VERDADE: marcar ontem/anteontem
 * anota AQUELE dia em core-dias-anotados (não hoje), a sequência se recompõe, e
 * desmarcar, dia velho demais ou chave de interface não anotam nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

const chamadas: { upserts: Array<{ key: string; value: unknown }> } = { upserts: [] };
let linhasDoServidor: Array<{ key: string; value: unknown }> = [];

const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, p?: unknown) => { eventos.push([n, p]); },
  markActivation: vi.fn(),
}));
const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastFn }));
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
        upsert: (linha: { key: string; value: unknown }) => { chamadas.upserts.push(linha); return Promise.resolve({ error: null }); },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    },
  };
});

import { UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { useMarcarOntem } from "@/hooks/use-marcar-ontem";
import { CHAVE_DIAS_ANOTADOS, calcularSequencia } from "@/lib/sequencia";

let api: UserDataContextType;
let marcar: ReturnType<typeof useMarcarOntem>;
const Sonda = () => { api = useUserData(); marcar = useMarcarOntem(); return null; };

const HOJE = "2026-10-02";
const montar = async () => {
  render(<UserDataProvider><Sonda /></UserDataProvider>);
  await waitFor(() => expect(api.loaded).toBe(true));
};
const lista = () => api.get<string[] | undefined>(CHAVE_DIAS_ANOTADOS, undefined);
const passaDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 320)); });
const gravacoesDaLista = () => chamadas.upserts.filter((u) => u.key === CHAVE_DIAS_ANOTADOS);
const textosDeToast = () => toastFn.mock.calls.map((c) => c[0]);

beforeEach(() => {
  chamadas.upserts = [];
  linhasDoServidor = [];
  eventos.length = 0;
  toastFn.mockClear();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0)); // sexta 02/10 10:00 local
});
afterEach(() => { vi.useRealTimers(); });

describe("marcar ontem anota ONTEM — nunca hoje", () => {
  it("marcou ontem: o dia entra na lista, hoje NÃO, e a sequência se recompõe (toast diz quanto)", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-28", "2026-09-29", "2026-09-30"] }];
    await montar();
    act(() => marcar("beleza", "2026-10-01", true, () => api.set("skincare-feitos-noite", { "2026-10-01": [0, 1] })));
    await waitFor(() => expect(lista()).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]));
    expect(lista()).not.toContain(HOJE);
    expect(calcularSequencia(lista(), HOJE)).toMatchObject({ dias: 4, hojeFeito: false });
    expect(textosDeToast()).toContain("🔥 Ontem entrou na sequência · 4 dias seguidos");
    expect(eventos).toContainEqual(["marcou_ontem", { modulo: "beleza", dias_atras: 1 }]);
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(1);
  });

  it("sequência de 1 dia só: o aviso não fala '1 dia seguido' (diz só que ontem entrou)", async () => {
    await montar();
    act(() => marcar("beleza", "2026-10-01", true, () => api.set("skincare-feitos-noite", { "2026-10-01": [0] })));
    await waitFor(() => expect(lista()).toEqual(["2026-10-01"]));
    expect(textosDeToast()).toContain("🔥 Ontem entrou na sequência");
  });

  it("depois, marcar HOJE ainda registra hoje (as duas escritas convivem) e a corrente fica inteira", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-30"] }];
    await montar();
    act(() => marcar("rotina", "2026-10-01", true, () => api.set("rotina-habit-log", { "2026-10-01": ["Água"] })));
    await waitFor(() => expect(lista()).toEqual(["2026-09-30", "2026-10-01"]));
    act(() => api.set("rotina-habit-log", { "2026-10-01": ["Água"], [HOJE]: ["Água"] }));
    await waitFor(() => expect(lista()).toEqual(["2026-09-30", "2026-10-01", HOJE]));
    expect(calcularSequencia(lista(), HOJE).dias).toBe(3);
  });

  it("anteontem entra com dias_atras 2; o buraco entre dois dias fecha", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-29", "2026-10-01", HOJE] }];
    await montar();
    expect(calcularSequencia(lista(), HOJE).dias).toBe(2); // 30/09 vazio e sem protetor
    act(() => marcar("treino", "2026-09-30", true, () => api.set("saude-workout-log", ["2026-09-30"])));
    await waitFor(() => expect(lista()).toContain("2026-09-30"));
    expect(calcularSequencia(lista(), HOJE).dias).toBe(4);
    expect(eventos).toContainEqual(["marcou_ontem", { modulo: "treino", dias_atras: 2 }]);
  });

  it("um gesto que grava várias chaves (o treino) anota o dia UMA vez só", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-30"] }];
    await montar();
    act(() => marcar("treino", "2026-10-01", true, () => {
      api.set("treino-exercise-history", [{ date: "2026-10-01", exercise: "Supino" }]);
      api.set("saude-workout-log", ["2026-10-01"]);
      api.set("treino-weekly-volume", { "2026-10-01": 800 });
      api.set("treino-sessoes", { "2026-10-01": { dia: "QUINTA" } });
    }));
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(1);
    expect(lista()).toEqual(["2026-09-30", "2026-10-01"]);
  });

  it("marcar o mesmo dia de novo não grava de novo, nem repete o aviso de sequência", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-30"] }];
    await montar();
    act(() => marcar("beleza", "2026-10-01", true, () => api.set("skincare-feitos-manha", { "2026-10-01": [0] })));
    await waitFor(() => expect(lista()).toContain("2026-10-01"));
    act(() => marcar("beleza", "2026-10-01", true, () => api.set("skincare-feitos-manha", { "2026-10-01": [0, 1] })));
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(1);
    expect(lista()).toEqual(["2026-09-30", "2026-10-01"]);
    expect(textosDeToast().filter((t) => String(t).includes("entrou na sequência"))).toHaveLength(1);
    expect(textosDeToast()).toContain("✓ Marcado em ontem (qui 01/10)"); // a 2ª vez só diz onde a marca caiu
  });
});

describe("o que NÃO anota dia", () => {
  it("desmarcar (marcando=false) não anota ontem — e também não anota hoje", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-30"] }];
    await montar();
    act(() => marcar("beleza", "2026-10-01", false, () => api.set("skincare-feitos-noite", { "2026-10-01": [1] })));
    await passaDebounce();
    expect(lista()).toEqual(["2026-09-30"]);
    expect(gravacoesDaLista()).toHaveLength(0);
    expect(eventos.filter(([n]) => n === "marcou_ontem")).toEqual([]);
  });

  it("3 dias atrás (fora da janela) e dia futuro: a escrita acontece, nenhum dia é anotado", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-30"] }];
    await montar();
    act(() => marcar("rotina", "2026-09-29", true, () => api.set("rotina-habit-log", { "2026-09-29": ["Água"] })));
    act(() => marcar("rotina", "2026-10-03", true, () => api.set("heatmap-log", { "2026-10-03": true })));
    await passaDebounce();
    expect(api.get("rotina-habit-log", null)).toEqual({ "2026-09-29": ["Água"] }); // gravou
    expect(lista()).toEqual(["2026-09-30"]); // mas não anotou dia
    expect(eventos.filter(([n]) => n === "marcou_ontem")).toEqual([]);
  });

  it("chave de interface dentro do escopo (carimbo da semana) não anota nada", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-30"] }];
    await montar();
    act(() => marcar("rotina", "2026-10-01", true, () => api.set("rotina-habits-week", "2026-09-28")));
    await passaDebounce();
    expect(lista()).toEqual(["2026-09-30"]);
  });

  it("hoje pelo mesmo caminho é o caminho de sempre: registra hoje, sem aviso de 'ontem'", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-10-01"] }];
    await montar();
    act(() => marcar("rotina", HOJE, true, () => api.set("rotina-habit-log", { [HOJE]: ["Água"] })));
    await waitFor(() => expect(lista()).toEqual(["2026-10-01", HOJE]));
    expect(eventos.filter(([n]) => n === "marcou_ontem")).toEqual([]);
    expect(textosDeToast().filter((t) => String(t).includes("ontem"))).toEqual([]);
  });

  it("antes do servidor responder não grava a lista (apagaria o histórico do servidor)", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-20", "2026-09-25"] }];
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    act(() => marcar("beleza", "2026-10-01", true, () => api.set("skincare-feitos-noite", { "2026-10-01": [0] })));
    await waitFor(() => expect(api.loaded).toBe(true));
    await passaDebounce();
    expect(lista()).toEqual(["2026-09-20", "2026-09-25"]);
  });
});
