/**
 * CRÍTICA DE FORA, RODADA 1 (07/11) — repro. Cada caso diz o que DEVIA acontecer e está em `it.fails`
 * enquanto o app faz diferente: quando o conserto entrar, o caso passa a falhar aqui e vira `it`.
 *
 *  R1 (MEDIA) 2 toques na caixa com uma dose esquecida mais cedo: o 2º marca a esquecida (que não foi
 *     tomada) — registro mostra 2 doses pra 1 comprimido e o estoque desce 2.
 *  R2 (BAIXA) "Começa amanhã 08:00": às 15:00 a caixa diz "A das 08:00 ainda não chegou" (a de hoje já passou).
 *  R3 (BAIXA) horários editados a menos de 30 min (08:00 e 08:20): a folga sai só das doses em aberto, e o
 *     2º toque às 08:05 marca a das 08:20 — o aviso dela sai da fila.
 *  R4 (BAIXA) estoque 0: marcar a das 00:00 às 23:50 (dia seguinte) apaga a anotação "sem baixa" de hoje,
 *     e desmarcar a das 16:00 depois cria um comprimido.
 */
/* crítica de fora, rodada 1 (07/11): repro */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const avisoCurto = vi.hoisted(() => ({ fn: (() => {}) as (...a: unknown[]) => void }));

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
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => false,
  isAndroid: () => false,
  isIOS: () => false,
  plataformaApp: () => "web",
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
  toast: Object.assign((...a: unknown[]) => avisoCurto.fn(...a), { success: () => {}, error: () => {}, info: () => {}, dismiss: () => {} }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { planejarRemedios } from "@/lib/notificacoes";
import { lerDadosDosLembretes } from "@/lib/reagendar";
import { gerarHorarios, montarLinhas, type Remedio } from "@/lib/remedios";
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
const agoraEm = (d: number, h: number, m = 0) => { vi.setSystemTime(new Date(2026, 10, d, h, m)); return new Date(); };
const fmt = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
const avisos = (s: Store) => planejarRemedios(lerDadosDosLembretes(s.get).remedios).map((a) => fmt(a.quando));
const linhas = (s: Store) => (s.estado.dados[CHAVE] ?? []) as Remedio[];
const limpo = (log: unknown) => Object.fromEntries(Object.entries((log ?? {}) as Record<string, string[]>).filter(([, ids]) => ids.length));
const vezes = (n: number, primeira: string, quando: Date) =>
  montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios(primeira, n), "2026-11-13", quando.getTime());
const caixa = () => screen.getByTestId(/^remedio-caixa-/);
const rotulo = () => caixa().getAttribute("aria-label");

let falas: string[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  falas = [];
  avisoCurto.fn = (texto: unknown) => { falas.push(String(texto)); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); esquecerMarcasDaCaixa(); });

const log = (s: Store) => limpo(s.estado.dados[LOG]);

describe("crítica de fora, rodada 1", () => {
  it.fails("R1 8 em 8, 16:05, a das 08:00 esquecida: 2 toques marcam só a das 16:00 (o 2º avisa), estoque desce 1", () => {
    const novas = vezes(3, "08:00", agoraEm(6, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 16, 5);
    montar(store);
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    // hoje: {"2026-11-07": [d00, d16, d08]} e estoque 14
    expect(log(store)).toEqual({ "2026-11-06": [d08, d16], "2026-11-07": [d00, d16] });
    expect(linhas(store).map((l) => l.stock)).toEqual([15, 15, 15]);
  });

  it.fails("R1b 8 em 8, 23:50, a das 16:00 esquecida: 2 toques marcam só a das 00:00", () => {
    const novas = vezes(3, "08:00", agoraEm(6, 7, 50));
    const [d08, , d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-07": [d00, d08] } });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    expect(log(store)).toEqual({ "2026-11-07": [d00, d08], "2026-11-08": [d00] });
  });

  it.fails("R2 'Começa amanhã 08:00' cadastrado às 10:00: às 15:00 o aviso e o rótulo dizem amanhã", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("08:00", 3), "2026-11-13", agoraEm(7, 10, 0).getTime(), "2026-11-08T08:00");
    const store = criarStore({ [CHAVE]: novas });
    agoraEm(7, 15, 0);
    montar(store);
    fireEvent.click(caixa());
    // hoje: "Próxima dose de Amoxicilina às 08:00" e "A das 08:00 ainda não chegou…"
    expect(rotulo()).toMatch(/amanhã/);
    expect(falas[0]).toMatch(/amanhã/);
  });

  it.fails("R3 horários 08:00/08:20/16:00/00:00, 08:05: o 2º toque não marca a das 08:20 e o aviso dela fica", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, ["08:00", "08:20", "16:00", "00:00"], undefined, agoraEm(6, 7, 50).getTime());
    const store = criarStore({ [CHAVE]: novas, [LOG]: {} });
    agoraEm(7, 8, 5);
    montar(store);
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    expect(avisos(store)[0]).toBe("07/08:20");
  });

  it.fails("R4 estoque 0: a das 00:00 marcada às 23:50 não apaga o 'sem baixa' de hoje; desmarcar a das 16:00 não cria comprimido", () => {
    const novas = vezes(3, "08:00", agoraEm(6, 7, 50));
    const [d08, d16] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 0 })), [LOG]: {} });
    agoraEm(7, 15, 50);
    montar(store);
    fireEvent.click(screen.getByTestId(`dose-${d08}`));
    fireEvent.click(screen.getByTestId(`dose-${d16}`));
    agoraEm(7, 23, 50);
    cleanup();
    montar(store);
    fireEvent.click(caixa()); // marca a das 00:00 (grava em 08/11)
    fireEvent.click(screen.getByTestId(`dose-${d16}`)); // desmarca a das 16:00 de hoje
    expect(linhas(store).map((l) => l.stock)).toEqual([0, 0, 0]); // hoje: [1, 1, 1]
  });
});
