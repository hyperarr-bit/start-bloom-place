/**
 * O LEMBRETE DE MANHÃ DA ROTINA no sistema e na central de notificações (1.0.16):
 *   · agendado pelo plugin de verdade (mockado): ids na faixa 1820000, allowWhileIdle, toque abre /rotina;
 *   · a central tem a linha "Rotina de manhã" (nasce desligada, no grupo Rotina; a hora na folha): liga, muda a hora e desliga — cada um
 *     reagenda pelo MESMO caminho do resto (reagendarTudo) e desligar limpa a faixa.
 */
process.env.TZ = "America/Sao_Paulo";

import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  agendados: [] as Array<{ id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle?: boolean }; extra?: { rota?: string } }>,
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => ({ display: ln.permissao }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.agendados }),
    cancel: async (x: { notifications: Array<{ id: number }> }) => {
      const fora = new Set(x.notifications.map((n) => n.id));
      ln.agendados = ln.agendados.filter((n) => !fora.has(n.id));
    },
    schedule: async (x: { notifications: typeof ln.agendados }) => { ln.agendados.push(...x.notifications); return {}; },
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getDeliveredNotifications: async () => ({ notifications: [] }),
  },
}));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => true,
  isAndroid: () => false,
  isIOS: () => true,
}));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, subLoaded: true, loading: false }) }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { BASES_LEMBRETES, agendarRotinaManha } from "@/lib/notificacoes";
import { CHAVE_LEMBRETE_ROTINA_MANHA } from "@/lib/rotina-manha";
import Notificacoes from "@/pages/Notificacoes";

const BASE = BASES_LEMBRETES.rotinaManha;
const daFaixa = () => ln.agendados.filter((n) => n.id >= BASE && n.id < BASE + 10000);

function criarStore(inicial: Record<string, unknown>) {
  const estado = { dados: { ...inicial } as Record<string, unknown> };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}

beforeEach(() => {
  ln.permissao = "granted";
  ln.agendados = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 17, 6, 0)); // sábado, 6h
});
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe("no sistema", () => {
  it("11 avisos (hoje 07:15 + 10 dias), na faixa, acordando o aparelho, com o toque na Rotina", async () => {
    const n = await agendarRotinaManha({ prefs: { ligado: true, hora: "07:15" }, habitos: ["Beber água", "Treinar"], feitosHoje: [] });
    expect(n).toBe(11);
    expect(daFaixa()).toHaveLength(11);
    for (const a of daFaixa()) {
      expect(a.schedule.allowWhileIdle).toBe(true);
      expect(a.extra?.rota).toBe("/rotina");
      expect(a.title).toBe("☀️ Bom dia! Sua rotina de hoje");
    }
    expect(daFaixa()[0].schedule.at).toEqual(new Date(2026, 9, 17, 7, 15));
    // reagendar substitui (não duplica); desligar limpa a faixa
    await agendarRotinaManha({ prefs: { ligado: true, hora: "08:15" }, habitos: ["Beber água"], feitosHoje: [] });
    expect(daFaixa()).toHaveLength(11);
    expect(daFaixa()[0].schedule.at).toEqual(new Date(2026, 9, 17, 8, 15));
    await agendarRotinaManha({ prefs: { ligado: false, hora: "08:15" }, habitos: ["Beber água"], feitosHoje: [] });
    expect(daFaixa()).toHaveLength(0);
  });
  it("sem permissão não agenda nada (e não pede)", async () => {
    ln.permissao = "prompt";
    expect(await agendarRotinaManha({ prefs: { ligado: true, hora: "07:15" }, habitos: ["Ler"], feitosHoje: [] })).toBe(0);
    expect(daFaixa()).toHaveLength(0);
  });
});

describe("na central de notificações", () => {
  const abrir = (dados: Record<string, unknown>) => {
    const store = criarStore(dados);
    render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
    return store;
  };
  // 29/10 (A6): a linha mora no grupo Rotina (sanfona); o texto completo e a hora com minuto, na folha do lembrete
  const linha = async () => {
    const grupo = await screen.findByTestId("grupo-rotina");
    if (!grupo.dataset.aberto) fireEvent.click(within(grupo).getByRole("button", { expanded: false }));
    return screen.getByTestId("lembrete-rotina_manha");
  };
  const abrirFolha = async () => {
    fireEvent.click(within(await linha()).getByRole("button", { name: "Detalhes: Rotina de manhã" }));
    return screen.findByTestId("folha-lembrete");
  };

  it("nasce desligada; ligar grava a chave própria e agenda pela régua de sempre", async () => {
    const store = abrir({ "rotina-habits": ["Beber água", "Treinar"] });
    const l = await linha();
    expect(within(l).getByText("Rotina de manhã")).toBeTruthy();
    expect(within(l).getByRole("button", { name: /Horário: Rotina de manhã, 07:15/ })).toBeTruthy();
    const folha = await abrirFolha();
    expect(within(folha).getByText(/Todo dia às 07:15/)).toBeTruthy();
    fireEvent.click(within(folha).getByRole("button", { name: "Pronto" }));
    const chave = within(l).getByRole("switch", { name: "Rotina de manhã" });
    expect(chave.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(chave);
    await waitFor(() => expect(store.estado.dados[CHAVE_LEMBRETE_ROTINA_MANHA]).toEqual({ ligado: true, hora: "07:15" }));
    await waitFor(() => expect(daFaixa()).toHaveLength(11));
  });

  it("a hora muda na folha (com minuto) e desligar limpa", async () => {
    const store = abrir({ "rotina-habits": ["Ler"], [CHAVE_LEMBRETE_ROTINA_MANHA]: { ligado: true, hora: "07:15" } });
    const folha = await abrirFolha();
    fireEvent.change(within(folha).getByLabelText("Horário do lembrete de manhã"), { target: { value: "06:45" } });
    await waitFor(() => expect(store.estado.dados[CHAVE_LEMBRETE_ROTINA_MANHA]).toEqual({ ligado: true, hora: "06:45" }));
    await waitFor(() => expect(daFaixa()[0]?.schedule.at).toEqual(new Date(2026, 9, 17, 6, 45)));
    fireEvent.click(within(await linha()).getByRole("switch", { name: "Rotina de manhã" }));
    await waitFor(() => expect(store.estado.dados[CHAVE_LEMBRETE_ROTINA_MANHA]).toEqual({ ligado: false, hora: "06:45" }));
    await waitFor(() => expect(daFaixa()).toHaveLength(0));
  });
});
