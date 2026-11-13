/**
 * REMÉDIO, MUDAR O HORÁRIO COM A CHAVE REMEDIO_VEZES DESLIGADA (11/11, crítica da build 1.0.25).
 *
 * A regra "os horários novos valem a partir de amanhã" (lib/remedios, mudarHorarios) tem erro aberto
 * no 1× ao dia (critica-fora-10-11-r2: J1 e J3). Ela fica atrás da chave, junto com o cadastro de
 * várias doses. Com a chave off (a 1.0.25/137 e o site), mudar o horário vale NA HORA, como na 1.0.24:
 * a hora troca e o próximo aviso já é no horário novo.
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

describe("remédio: mudar o horário com a chave REMEDIO_VEZES desligada (1.0.25/137 e site)", () => {
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
    it(`${onde}: 1× 00:00 → 20:00 ao meio-dia: o próximo aviso é HOJE às 20:00, sem "a partir de amanhã"`, () => {
      plataforma.nativo = nativo;
      const store = criarStore({ [CHAVE]: simples("00:00") });
      agoraEm(7, 12, 10);
      montar(store);
      fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "20:00" } });
      expect(linhas(store)).toEqual(simples("20:00")); // só a hora mudou: sem horaAntes, antesAte, novoDesde nem id novo
      expect(avisos(store)[0]).toBe("07/20:00");
      expect(falas.lista.some((t) => t.includes("a partir de"))).toBe(false); // a tela não promete "a partir de amanhã"
    });
  }

  /* J1 com a dose de hoje já marcada (tomada à 00:00): igual à 1.0.24 — a caixa de hoje continua marcada
     (o 1× do dia já foi), o próximo aviso é amanhã às 20:00 e a tela não promete nada sobre esta noite.
     A diferença pra regra nova: nada some sem aparecer na tela, e quem quiser a de hoje desmarca. */
  it("J1 1× 00:00 → 20:00 ao meio-dia, tomada à 00:00: como na 1.0.24 (hoje segue marcado, sem aviso enganoso)", () => {
    const store = criarStore({ [CHAVE]: simples("00:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 12, 10);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "20:00" } });
    expect(linhas(store)).toEqual(simples("20:00"));
    expect(screen.getByRole("button", { name: "Desmarcar Losartana" })).toBeTruthy();
    expect(avisos(store)[0]).toBe("08/20:00");
    expect(falas.lista.some((t) => t.includes("a partir de"))).toBe(false);
  });

  it("J3 1× 20:00 tomado às 23:30 e mudado pra 02:00: muda na hora (como na 1.0.24), sem id novo, e a marca de hoje fica", () => {
    const store = criarStore({ [CHAVE]: simples("20:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 23, 35);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "02:00" } });
    expect(linhas(store)).toEqual(simples("02:00"));
    expect(store.get<Record<string, string[]>>(LOG, {})["2026-11-07"]).toEqual(["r1"]);
  });

  it("uma troca gravada antes (campos horaAntes/antesAte/novoDesde/idAntes) sai da linha ao mudar com a chave off", () => {
    const store = criarStore({
      [CHAVE]: simples("20:00", { id: "r1~abc", idAntes: "r1", horaAntes: "00:00", antesAte: "2026-11-07", novoDesde: "2026-11-08T20:00" }),
    });
    agoraEm(7, 12, 10);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "21:00" } });
    expect(linhas(store)).toEqual(simples("21:00", { id: "r1~abc" }));
    expect(avisos(store)[0]).toBe("07/21:00");
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
