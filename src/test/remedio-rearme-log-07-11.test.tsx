/**
 * MUDAR A HORA E O REARME DOS AVISOS (07/11, crítica do conserto final).
 *
 * Mudar a hora de um remédio de 8 em 8 move as marcas de "tomado" (moverMarcasDoGrupo) e
 * rearma os avisos na hora, no toque. O rearme lia o registro de "tomado" do render
 * ANTERIOR (o `get` do app fecha sobre o estado daquele render): às 06:50, 08:00 → 07:00
 * com o registro cheio, a marca velha da das 00:00 (gravada hoje) contava como a das 23:00
 * de hoje, e o aviso das 23:00 ficava fora da fila do iPhone até o useLembretes rodar de
 * novo. Aqui o `get` é preso ao render, como no app (use-user-data).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

type Agendado = { id: number; title?: string; schedule: { at: Date } };
const ln = vi.hoisted(() => ({ agendados: [] as Array<{ id: number; title?: string; schedule: { at: Date } }>, rodadas: 0 }));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.agendados }),
    cancel: async (x: { notifications: Array<{ id: number }> }) => {
      const ids = new Set(x.notifications.map((n) => n.id));
      ln.agendados = ln.agendados.filter((n) => !ids.has(n.id));
    },
    schedule: async (x: { notifications: Agendado[] }) => {
      const novos = new Set(x.notifications.map((n) => n.id));
      ln.agendados = [...ln.agendados.filter((n) => !novos.has(n.id)), ...x.notifications];
      ln.rodadas += 1;
      return {};
    },
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getDeliveredNotifications: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: () => {} }),
  },
}));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => true,
  isAndroid: () => false,
  isIOS: () => true,
  plataformaApp: () => "ios",
}));
vi.mock("@/lib/remedio-vezes", async (orig) => ({
  ...(await orig<typeof import("@/lib/remedio-vezes")>()),
  remedioVezesLigado: () => true,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { BASES_LEMBRETES } from "@/lib/notificacoes";
import { gerarHorarios, montarLinhas, type Remedio } from "@/lib/remedios";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";

type Dados = Record<string, unknown>;
/** Como o app: o `get` de cada render enxerga o estado DAQUELE render (não o que foi gravado depois). */
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const snap = estado.dados;
    const get = useCallback(<T,>(k: string, f: T): T => (k in snap ? (snap[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}
const CHAVE = "core-saude-supplements";
const LOG = "core-saude-supplement-log";
const agoraEm = (d: number, h: number, m = 0) => { vi.setSystemTime(new Date(2026, 10, d, h, m)); return new Date(); };
const fmt = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
const doRemedio = (a: { id: number }) => a.id >= BASES_LEMBRETES.saude && a.id < BASES_LEMBRETES.saude + 10000;
const fila = () => ln.agendados.filter(doRemedio).map((a) => new Date(a.schedule.at)).sort((a, b) => a.getTime() - b.getTime()).map(fmt);

beforeEach(() => { ln.agendados = []; ln.rodadas = 0; vi.useFakeTimers({ toFake: ["Date"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("mudar a hora rearma os avisos com o registro de 'tomado' NOVO", () => {
  it("às 06:50, 08:00 → 07:00 com o registro cheio: a fila do iPhone tem o aviso das 23:00 de hoje", async () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 14 }, gerarHorarios("08:00", 3), "2026-11-13", new Date(2026, 10, 5, 10).getTime());
    const [d1, d2, d3] = novas.map((l) => l.id);
    const store = criarStore({
      [CHAVE]: novas,
      [LOG]: { "2026-11-05": [d1, d2], "2026-11-06": [d3, d1, d2], "2026-11-07": [d3] },
    });
    agoraEm(7, 6, 50);
    render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "07:00" } });
    expect((store.estado.dados[CHAVE] as Remedio[]).map((l) => l.time)).toEqual(["07:00", "15:00", "23:00"]);
    expect((store.estado.dados[LOG] as Record<string, string[]>)["2026-11-07"] ?? []).toEqual([]);
    await waitFor(() => expect(ln.rodadas).toBeGreaterThan(0));
    expect(fila().slice(0, 4)).toEqual(["07/07:00", "07/15:00", "07/23:00", "08/07:00"]);
  });
});
