/**
 * A CAIXA SÓ MARCA A DOSE QUE JÁ CHEGOU (07/11, crítica de fora, 2ª rodada — decisão do dono).
 *
 *  - Remédio de várias doses: a caixa marca uma dose que já chegou (até agora + 15 min). Sem
 *    nenhuma, ela não grava nada: diz "Próxima dose de X às HH:MM" e o toque mostra um aviso
 *    curto ("A das HH:MM ainda não chegou. Pra marcar antes, toque no horário."). Antes, um 2º
 *    toque (de quem achou que o 1º não pegou) marcava a das 16:00 às 08:05, e às 23:55 um toque
 *    só marcava a das 02:00 de um 6 em 6: o aviso sumia e dava pra pular uma dose de antibiótico.
 *  - A pílula de cada horário continua marcando adiantado.
 *  - A memória do que a caixa marcou vale ao trocar de tela (Map no nível do módulo,
 *    lib/remedio-caixa): sair da Saúde entre os 2 toques não faz o 2º tirar a dose errada.
 *
 * Casos 1 a 6 = o repro da crítica (critica-caixa-r2.test.tsx), esperando a fila de avisos
 * completa e o registro só com a dose da hora.
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
import { agruparRemedios, doseDaHora, doseQueChegou, dosesDoGrupoAgora, gerarHorarios, montarLinhas, type Remedio } from "@/lib/remedios";
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

describe("a caixa só marca a dose que já chegou (casos 1 a 5 da crítica)", () => {
  it("1) 8 em 8, 08:05 de 07/11, ontem completo: o 1º toque marca a das 08:00; o 2º não grava nada, avisa e a fila fica inteira", () => {
    const novas = vezes(3, "08:00", agoraEm(6, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 8, 5);
    montar(store);
    const fila = avisos(store);
    expect(fila.slice(0, 2)).toEqual(["07/16:00", "08/00:00"]);
    expect(rotulo()).toBe("Marcar próxima dose de Amoxicilina (08:00)");
    fireEvent.click(caixa());
    expect(rotulo()).toBe("Próxima dose de Amoxicilina às 16:00");
    fireEvent.click(caixa());
    expect(falas).toEqual(["A das 16:00 ainda não chegou. Pra marcar antes, toque no horário."]);
    expect(limpo(store.estado.dados[LOG])).toEqual({ "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] });
    expect(linhas(store).map((l) => l.stock)).toEqual([15, 15, 15]);
    expect(avisos(store)).toEqual(fila); // a das 08:00 já tinha passado: nenhum aviso sai da fila
    // a pílula continua marcando adiantado
    fireEvent.click(screen.getByTestId(`dose-${d16}`));
    expect(limpo(store.estado.dados[LOG])["2026-11-07"]).toEqual([d00, d08, d16]);
  });

  it("2) 8 em 8, 15:05, a das 08:00 esquecida: o 1º toque marca a das 08:00, o 2º não marca a das 16:00", () => {
    const novas = vezes(3, "08:00", agoraEm(6, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 15, 5);
    montar(store);
    const fila = avisos(store);
    expect(fila[0]).toBe("07/16:00");
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    expect(falas).toEqual(["A das 16:00 ainda não chegou. Pra marcar antes, toque no horário."]);
    expect(limpo(store.estado.dados[LOG])).toEqual({ "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] });
    expect(avisos(store)).toEqual(fila);
  });

  it("3) 12 em 12, 08:05: o 2º toque não marca a das 20:00", () => {
    const novas = vezes(2, "08:00", agoraEm(6, 7, 50));
    const [d08, d20] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d20] } });
    agoraEm(7, 8, 5);
    montar(store);
    const fila = avisos(store);
    expect(fila[0]).toBe("07/20:00");
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    expect(falas).toEqual(["A das 20:00 ainda não chegou. Pra marcar antes, toque no horário."]);
    expect(limpo(store.estado.dados[LOG])).toEqual({ "2026-11-06": [d08, d20], "2026-11-07": [d08] });
    expect(avisos(store)).toEqual(fila);
  });

  it("4) 6 em 6, 23:55 de 07/11 com 08/14/20 marcadas: um toque não marca a das 02:00 (2 h antes)", () => {
    const novas = vezes(4, "08:00", agoraEm(6, 7, 50));
    const [d08, d14, d20, d02] = novas.map((l) => l.id);
    const antes = { "2026-11-07": [d02, d08, d14, d20] };
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: antes });
    agoraEm(7, 23, 55);
    montar(store);
    const fila = avisos(store);
    expect(fila[0]).toBe("08/02:00");
    expect(rotulo()).toBe("Próxima dose de Amoxicilina às 02:00");
    expect(screen.getByTestId(`dose-${d02}`)).toHaveAttribute("data-da-vez", "true"); // a pílula destacada segue a próxima
    fireEvent.click(caixa());
    expect(falas).toEqual(["A das 02:00 ainda não chegou. Pra marcar antes, toque no horário."]);
    expect(limpo(store.estado.dados[LOG])).toEqual(antes);
    expect(linhas(store).map((l) => l.stock)).toEqual([16, 16, 16, 16]);
    expect(avisos(store)).toEqual(fila);
  });

  it("5) 1º dia, cadastro 07:50 (1ª 08:00), 07:55: o 1º toque marca a das 08:00 (dentro dos 15 min), o 2º não marca a das 16:00", () => {
    const novas = vezes(3, "08:00", agoraEm(7, 7, 50));
    const [d08] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas });
    agoraEm(7, 7, 55);
    montar(store);
    const fila = avisos(store);
    expect(fila.slice(0, 3)).toEqual(["07/08:00", "07/16:00", "08/00:00"]);
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    expect(falas).toEqual(["A das 16:00 ainda não chegou. Pra marcar antes, toque no horário."]);
    expect(limpo(store.estado.dados[LOG])).toEqual({ "2026-11-07": [d08] });
    expect(avisos(store)).toEqual(fila.filter((a) => a !== "07/08:00")); // só o aviso da das 08:00 sai
  });

  it("doseQueChegou: a mais recente até agora + 15 min; sem nenhuma, nada (doseDaHora segue apontando a próxima)", () => {
    const g = agruparRemedios(vezes(3, "08:00", agoraEm(6, 7, 50)))[0];
    const as1544 = agoraEm(7, 15, 44);
    const semA08 = dosesDoGrupoAgora(g, as1544).filter((d) => d.time !== "08:00");
    expect(doseQueChegou(semA08, as1544)).toBeUndefined();
    expect(doseDaHora(semA08, as1544)?.time).toBe("16:00");
    const as1545 = agoraEm(7, 15, 45);
    expect(doseQueChegou(dosesDoGrupoAgora(g, as1545).filter((d) => d.time !== "08:00"), as1545)?.time).toBe("16:00");
    expect(doseQueChegou(dosesDoGrupoAgora(g, as1544), as1544)?.time).toBe("08:00");
    expect(doseQueChegou([], as1544)).toBeUndefined();
  });
});

describe("a memória da caixa vale ao trocar de tela (caso 6 da crítica)", () => {
  it("6) 8 em 8, 00:10 de 08/11, tela fechada e aberta entre os toques: o 2º tira a das 08:00 que a caixa marcou, não a das 00:00 tomada pela pílula", () => {
    const novas = vezes(3, "08:00", agoraEm(6, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const antes = { "2026-11-06": [d08, d16], "2026-11-07": [d00, d16], "2026-11-08": [d00] };
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 15 })), [LOG]: antes });
    agoraEm(8, 0, 10);
    const { unmount } = montar(store);
    const fila = avisos(store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (08:00)" }));
    unmount();
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Amoxicilina" }));
    expect(limpo(store.estado.dados[LOG])).toEqual(antes);
    expect(linhas(store).map((l) => l.stock)).toEqual([15, 15, 15]);
    expect(rotulo()).toBe("Marcar próxima dose de Amoxicilina (08:00)");
    expect(avisos(store)).toEqual(fila);
    expect(falas).toEqual([]);
  });
});
