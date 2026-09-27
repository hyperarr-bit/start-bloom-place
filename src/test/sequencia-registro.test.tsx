/**
 * Registro do dia anotado no useUserData (26/09): a 1ª escrita de DADO do dia
 * acrescenta hoje em core-dias-anotados — uma escrita por dia, como
 * {system:true}; preferência/carimbo não contam; antes do servidor responder
 * não grava (senão apagaria a lista do servidor); migração do hub na 1ª vez.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

const chamadas: { upserts: Array<{ key: string; value: unknown }> } = { upserts: [] };
let linhasDoServidor: Array<{ key: string; value: unknown }> = [];
let segurarServidor: Promise<void> | null = null;

const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), markActivation: vi.fn() }));
const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastFn }));
vi.mock("@/integrations/supabase/client", () => {
  const selecao: Record<string, (...a: unknown[]) => unknown> = {
    eq: () => selecao,
    in: () => Promise.resolve({ data: [], error: null }),
    abortSignal: async () => {
      if (segurarServidor) await segurarServidor;
      return { data: linhasDoServidor, error: null };
    },
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
import { CHAVE_DIAS_ANOTADOS } from "@/lib/sequencia";

let api: UserDataContextType;
const Sonda = () => { api = useUserData(); return null; };

const montar = async () => {
  render(<UserDataProvider><Sonda /></UserDataProvider>);
  await waitFor(() => expect(api.loaded).toBe(true));
};
const lista = () => api.get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
const passaDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 320)); });
const gravacoesDaLista = () => chamadas.upserts.filter((u) => u.key === CHAVE_DIAS_ANOTADOS);

beforeEach(() => {
  chamadas.upserts = [];
  linhasDoServidor = [];
  segurarServidor = null;
  toastFn.mockClear();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0)); // 26/09 10:00 local
});
afterEach(() => { vi.useRealTimers(); });

describe("registro do dia anotado", () => {
  it("a 1ª anotação do dia entra na lista — uma gravação só, mesmo anotando de novo", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-24", "2026-09-25"] }];
    await montar();
    act(() => api.set("finance-expenses", [{ id: 1, value: 10 }]));
    await waitFor(() => expect(lista()).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]));
    act(() => api.set("finance-expenses", [{ id: 1, value: 10 }, { id: 2, value: 5 }]));
    act(() => api.set("mood-log", { "2026-09-26": { mood: 4 } }));
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(1);
    expect(gravacoesDaLista()[0].value).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
  });

  it("o 1º registro do dia avisa a sequência num toast (uma vez)", async () => {
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"] }];
    await montar();
    act(() => api.set("heatmap-log", { "2026-09-26": 2 }));
    act(() => api.set("heatmap-log", { "2026-09-26": 3 }));
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    // (o toast de outro teste pode cair aqui por causa do atraso de 700 ms: conta só o deste)
    expect(toastFn.mock.calls.filter((c) => c[0] === "🔥 5 dias seguidos")).toHaveLength(1);
  });

  it("preferência, navegação, carimbo e escrita de sistema não contam como dia", async () => {
    await montar();
    act(() => {
      api.set("spotlight-done-financas", "true");
      api.set("core-home-widgets-v2", [{ id: "habits" }]);
      api.set("gamification-lastCheckIn", "2026-09-26");
      api.set("core-hub-streak", { count: 3, lastDate: "2026-09-26" });
      api.set("rotina-habits-week", "2026-09-21");
      api.set("conquistas-capa", "vichy");
      api.set("finance-expenses", [{ id: 1 }], { system: true });
    });
    await passaDebounce();
    expect(lista()).toBeUndefined();
    expect(gravacoesDaLista()).toHaveLength(0);
  });

  it("limpar ou regravar o mesmo valor não anota nada", async () => {
    linhasDoServidor = [{ key: "finance-expenses", value: [{ id: 1 }] }];
    await montar();
    act(() => api.set("todo-list", []));
    act(() => api.set("finance-expenses", [{ id: 1 }]));
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(0);
  });

  it("escrita ANTES do servidor responder não grava a lista (apagaria o histórico do servidor)", async () => {
    let soltar!: () => void;
    segurarServidor = new Promise<void>((ok) => { soltar = ok; });
    linhasDoServidor = [{ key: CHAVE_DIAS_ANOTADOS, value: ["2026-09-20", "2026-09-25"] }];
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    act(() => api.set("finance-expenses", [{ id: 9 }]));
    await act(async () => { soltar(); });
    await waitFor(() => expect(api.loaded).toBe(true));
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(0);
    expect(lista()).toEqual(["2026-09-20", "2026-09-25"]);
    // a próxima anotação do dia registra normalmente
    act(() => api.set("finance-expenses", [{ id: 9 }, { id: 10 }]));
    await waitFor(() => expect(lista()).toEqual(["2026-09-20", "2026-09-25", "2026-09-26"]));
  });

  it("migração: sem lista, a 1ª anotação semeia a sequência do hub e soma hoje", async () => {
    linhasDoServidor = [{ key: "core-hub-streak", value: { count: 4, lastDate: "2026-09-25" } }];
    await montar();
    act(() => api.set("water-log", { "2026-09-26": 2 }));
    await waitFor(() => expect(lista()).toEqual(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]));
  });

  it("virada de dia com o app aberto: a anotação de amanhã entra como novo dia", async () => {
    await montar();
    act(() => api.set("finance-expenses", [{ id: 1 }]));
    await waitFor(() => expect(lista()).toEqual(["2026-09-26"]));
    vi.setSystemTime(new Date(2026, 8, 27, 0, 10)); // 00:10 do dia seguinte
    act(() => api.set("finance-expenses", [{ id: 1 }, { id: 2 }]));
    await waitFor(() => expect(lista()).toEqual(["2026-09-26", "2026-09-27"]));
    await passaDebounce();
    expect(gravacoesDaLista()).toHaveLength(1); // debounce junta as duas numa gravação no servidor
    expect(gravacoesDaLista()[0].value).toEqual(["2026-09-26", "2026-09-27"]);
  });
});
