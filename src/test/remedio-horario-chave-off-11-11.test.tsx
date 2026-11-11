/**
 * REMÉDIO, MUDAR O HORÁRIO COM A CHAVE REMEDIO_VEZES DESLIGADA (11/11, regra simples do dono).
 *
 * Com a chave off (como on), a próxima dose é o 1º horário novo a pelo menos meio intervalo do último
 * comprimido marcado (1× ao dia: 12 h), nunca no passado (lib/remedios, mudarHorarios). A tela e o
 * toast dizem o dia e a hora exatos: "Próxima dose: hoje às 20:00".
 */
process.env.TZ = "America/Sao_Paulo";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const falas = vi.hoisted(() => ({ lista: [] as string[] }));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    schedule: async () => ({}),
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getDeliveredNotifications: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: () => {} }),
  },
}));
const plataforma = vi.hoisted(() => ({ nativo: false }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isAndroid: () => false,
  isIOS: () => plataforma.nativo,
  plataformaApp: () => (plataforma.nativo ? "ios" : "web"),
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({
  toast: Object.assign((t: unknown) => { falas.lista.push(String(t)); }, { success: () => {}, error: () => {}, info: () => {}, dismiss: () => {} }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { planejarRemedios } from "@/lib/notificacoes";
import { lerDadosDosLembretes } from "@/lib/reagendar";
import { REMEDIO_VEZES_APP, REMEDIO_VEZES_WEB, remedioVezesLigado } from "@/lib/remedio-vezes";
import type { Remedio } from "@/lib/remedios";
import { esquecerMarcasDaCaixa } from "@/lib/remedio-caixa";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const get = <T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f);
  return { estado, Provedor, get };
}
const CHAVE = "core-saude-supplements";
const LOG = "core-saude-supplement-log";
type Store = ReturnType<typeof criarStore>;
const montar = (store: Store) => render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
const agoraEm = (d: number, h: number, m = 0) => vi.setSystemTime(new Date(2026, 10, d, h, m));
const fmt = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
const avisos = (s: Store) => planejarRemedios(lerDadosDosLembretes(s.get).remedios).map((a) => fmt(a.quando));
const simples = (time: string, extra: Partial<Remedio> = {}): Remedio[] => [{ id: "r1", name: "Losartana", time, stock: 30, dosesPerDay: 1, ...extra }];
const linhas = (s: Store) => s.get<Remedio[]>(CHAVE, []);

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); falas.lista = []; plataforma.nativo = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); esquecerMarcasDaCaixa(); });

describe("remédio: mudar o horário com a chave REMEDIO_VEZES desligada (regra simples, 11/11)", () => {
  it("a chave está desligada no app e no site", () => {
    expect(REMEDIO_VEZES_APP).toBe("off");
    expect(REMEDIO_VEZES_WEB).toBe("off");
    plataforma.nativo = true;
    expect(remedioVezesLigado()).toBe(false);
    plataforma.nativo = false;
    expect(remedioVezesLigado()).toBe(false);
  });

  for (const nativo of [false, true]) {
    const onde = nativo ? "app" : "site";
    it(`${onde}: 1× 00:00 tomada à 00:00, ao meio-dia muda pra 20:00 → próxima dose hoje às 20:00`, () => {
      plataforma.nativo = nativo;
      const store = criarStore({ [CHAVE]: simples("00:00"), [LOG]: { "2026-11-07": ["r1"] } });
      agoraEm(7, 12, 10);
      montar(store);
      fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "20:00" } });
      expect(linhas(store)[0]).toMatchObject({ time: "20:00", horaAntes: "00:00", novoDesde: "2026-11-07T20:00" });
      expect(avisos(store)[0]).toBe("07/20:00");
      expect(falas.lista).toContain("Próxima dose: hoje às 20:00.");
      expect(screen.getByRole("button", { name: "Desmarcar Losartana" })).toBeTruthy(); // o ✓ de hoje continua
      expect(screen.getByTestId("remedio-horario-hoje").textContent).toBe("Próxima dose: hoje às 20:00");
      expect(store.get<Record<string, string[]>>(LOG, {})).toEqual({ "2026-11-07": ["r1"] }); // nenhuma marca muda
    });
  }

  it("1× 23:00 tomada às 23:00, às 23:10 muda pra 00:30 → 00:30 do dia 9 (25 h 30)", () => {
    const store = criarStore({ [CHAVE]: simples("23:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 23, 10);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "00:30" } });
    expect(falas.lista).toContain("Próxima dose: 09/11 às 00:30.");
    expect(avisos(store)[0]).toBe("09/00:30");
  });

  it("1× 08:00 tomada, às 10:00 muda pra 23:00 → hoje às 23:00", () => {
    const store = criarStore({ [CHAVE]: simples("08:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 10, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    expect(falas.lista).toContain("Próxima dose: hoje às 23:00.");
    expect(avisos(store)[0]).toBe("07/23:00");
  });

  it("sem marca nas últimas 48 h: 08:00 → 11:00 às 10:00 é hoje às 11:00", () => {
    const store = criarStore({ [CHAVE]: simples("08:00"), [LOG]: {} });
    agoraEm(7, 10, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "11:00" } });
    expect(falas.lista).toContain("Próxima dose: hoje às 11:00.");
    expect(avisos(store)[0]).toBe("07/11:00");
  });

  it("J3 1× 20:00 tomado às 23:30 e mudado pra 02:00: a próxima fica a 12 h da dose marcada e a marca de hoje fica", () => {
    const store = criarStore({ [CHAVE]: simples("20:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 23, 35);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "02:00" } });
    expect(linhas(store)[0].novoDesde).toBe("2026-11-09T02:00");
    expect(store.get<Record<string, string[]>>(LOG, {})["2026-11-07"]).toEqual(["r1"]);
  });

  it("mesmo horário de antes: não grava nada", () => {
    const inicial = simples("08:00");
    const store = criarStore({ [CHAVE]: inicial });
    agoraEm(7, 12, 10);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "08:00" } });
    expect(linhas(store)).toBe(inicial);
  });
});
