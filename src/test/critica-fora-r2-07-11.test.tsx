/**
 * CRÍTICA DE FORA, RODADA 2 (07/11) — repro. Cada caso diz o que DEVIA acontecer e está em `it.fails`
 * enquanto o app faz diferente: quando o conserto entrar, o caso passa a falhar aqui e vira `it`.
 * A1/A1b/A1c/A1d/A2 consertados (conserto final, 07/11): o dia do tratamento vira no MEIO do caminho
 * entre a última dose do dia e a 1ª (04:00 em 8 em 8 desde 08:00), não 1 h antes. A3 consertado em 08/11 (F2 da crítica de fora 08/11).
 *
 *  A1 (ALTA) Antes de 1 h da 1ª dose a tela ainda é a de ONTEM (lib/remedios, ANTECEDENCIA_MIN). Quem toma
 *     a das 08:00 às 06:30 e toca a pílula 08:00 (ou a caixa, que aparece marcada) DESMARCA a de ontem:
 *     o estoque sobe 1, o histórico perde uma dose tomada, às 07:00 a das 08:00 aparece em aberto e o
 *     aviso das 08:00 toca — 2 comprimidos em 1 h e meia. Vale pra 12 em 12 e 6 em 6.
 *  A2 (MEDIA) Mesma fronteira: com a das 00:00 esquecida, às 06:50 a caixa marca a das 00:00 (6 h 50
 *     atrasada) no lugar da da manhã; o aviso das 08:00 continua e pede outro comprimido 70 min depois.
 *  A3 (BAIXA) Remédio de 1× ao dia perto da meia-noite (00:30) tomado às 23:50: grava em hoje, o aviso
 *     das 00:30 toca 40 min depois e às 00:35 a caixa aparece em aberto (o conserto dos grupos não vale aqui).
 */
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

const pilula = (id: string) => screen.getByTestId(`dose-${id}`);
const estoque = (s: Store) => linhas(s).map((l) => l.stock);

describe("crítica de fora, rodada 2", () => {
  it("A1 8 em 8, tudo de ontem marcado: às 06:30 a pílula 08:00 marca a de HOJE, não desmarca a de ontem", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 6, 30);
    montar(store);
    fireEvent.click(pilula(d08));
    // hoje: {"2026-11-06": [d16], "2026-11-07": [d00]}, estoque 17 e o aviso das 08:00 de hoje segue na fila
    expect(log(store)).toEqual({ "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] });
    expect(estoque(store)).toEqual([15, 15, 15]);
    expect(avisos(store)[0]).toBe("07/16:00");
  });

  it("A1 (depois do conserto) às 06:30 a tela já é a de hoje: pílula 08:00 em aberto e a caixa diz que ainda não chegou", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 6, 30);
    montar(store);
    // antes: "Desmarcar dose das 08:00" (era a de ONTEM) e o toque desmarcava uma dose tomada
    expect(pilula(d08).getAttribute("aria-label")).toBe("Marcar dose das 08:00 de Amoxicilina");
    expect(pilula(d00).getAttribute("aria-pressed")).toBe("false"); // a das 00:00 de hoje à noite, ainda não tomada
    expect(rotulo()).toBe("Próxima dose de Amoxicilina às 08:00");
    fireEvent.click(caixa()); // a caixa não grava nada antes da hora, só avisa
    expect(falas).toContain("A das 08:00 ainda não chegou. Pra marcar antes, toque no horário.");
    expect(log(store)).toEqual({ "2026-11-06": [d08, d16], "2026-11-07": [d00] });
    expect(estoque(store)).toEqual([16, 16, 16]);
    // às 03:55 a tela ainda é a de ontem (a das 00:00 marcada); às 04:00 vira
    cleanup();
    agoraEm(7, 3, 55);
    montar(store);
    expect(pilula(d00).getAttribute("aria-pressed")).toBe("true");
    expect(rotulo()).toBe("Desmarcar Amoxicilina");
    cleanup();
    agoraEm(7, 4, 0);
    montar(store);
    expect(pilula(d08).getAttribute("aria-pressed")).toBe("false");
    expect(pilula(d00).getAttribute("aria-pressed")).toBe("false");
  });

  it("A1b a caixa marcou a das 00:00 às 23:55; troca de tela; às 06:55 o toque não desmarca a das 00:00", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16] } });
    agoraEm(6, 23, 55);
    montar(store);
    fireEvent.click(caixa());
    expect(log(store)).toEqual({ "2026-11-06": [d08, d16], "2026-11-07": [d00] });
    cleanup();
    agoraEm(7, 6, 55);
    montar(store);
    fireEvent.click(caixa());
    // hoje: a das 00:00 (tomada) sai do registro e o estoque volta pra 16
    expect(log(store)["2026-11-07"]).toContain(d00);
    expect(estoque(store)).toEqual([15, 15, 15]);
  });

  it("A1c 12 em 12 desde 20:00, às 18:30 a pílula 20:00 não desmarca a de ontem", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 16 }, gerarHorarios("20:00", 2), "2026-11-13", agoraEm(5, 19, 50).getTime());
    const [d20, d08] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d20], "2026-11-07": [d08] } });
    agoraEm(7, 18, 30);
    montar(store);
    fireEvent.click(pilula(d20));
    // hoje: {"2026-11-07": [d08]} e estoque 17
    expect(log(store)["2026-11-06"]).toEqual([d20]);
  });

  it("A1d 6 em 6 desde 08:00, tudo marcado: às 06:30 a caixa não desmarca a das 02:00", () => {
    const novas = vezes(4, "08:00", agoraEm(5, 7, 50));
    const [a, b, c, d] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [a, b, c], "2026-11-07": [d] } });
    agoraEm(7, 6, 30);
    montar(store);
    fireEvent.click(caixa());
    // hoje: {"2026-11-06": [a, b, c]} e estoque 17
    expect(log(store)["2026-11-07"]).toEqual([d]);
  });

  it("A2 8 em 8, a das 00:00 esquecida: às 06:50 a caixa não marca a das 00:00 como se fosse a da manhã", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16] } });
    agoraEm(7, 6, 50);
    montar(store);
    // antes o rótulo era "Marcar próxima dose de Amoxicilina (00:00)" e o toque gravava d00 em 07/11
    expect(rotulo()).toBe("Próxima dose de Amoxicilina às 08:00");
    fireEvent.click(caixa());
    expect(log(store)["2026-11-07"] ?? []).not.toContain(d00);
    expect(falas).toContain("A das 08:00 ainda não chegou. Pra marcar antes, toque no horário.");
    expect(avisos(store)[0]).toBe("07/08:00");
  });

  // consertado em 08/11 (crítica de fora 08/11, F2): o 1× ao dia usa a ocorrência mais perto da meia-noite (lib/remedios, diaDaDoseUnica)
  it("A3 1× ao dia às 00:30, tomado às 23:50: o aviso das 00:30 sai da fila e às 00:35 segue marcado", () => {
    const novas = montarLinhas({ name: "Melatonina", stock: 10 }, ["00:30"], undefined, agoraEm(1, 10).getTime());
    const store = criarStore({ [CHAVE]: novas, [LOG]: {} });
    agoraEm(6, 23, 50);
    montar(store);
    fireEvent.click(caixa());
    // antes: gravava em 06/11, o 1º aviso era 07/00:30 e às 00:35 a caixa dizia "Marcar Melatonina como tomado"
    expect(avisos(store)[0]).toBe("08/00:30");
    cleanup();
    agoraEm(7, 0, 35);
    montar(store);
    expect(rotulo()).toBe("Desmarcar Melatonina");
  });
});
