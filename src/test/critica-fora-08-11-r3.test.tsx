/**
 * CRÍTICA DE FORA, 08/11, RODADA 3 — repro, e depois da SIMPLIFICAÇÃO 08/11 (decisão do dono): mudar o
 * horário de um remédio vale A PARTIR DE AMANHÃ — nenhuma marca de "tomado" muda de lugar e as doses de
 * hoje seguem os horários de antes até o dia do tratamento virar (lib/remedios, mudarHorarios). Saiu a
 * lógica de mover marcas (moverMarcasDoGrupo e a "foto" da fileira de edição). H1, H2 e H4 eram buracos
 * dela e viraram casos do comportamento novo (passam). H3 (Home) não tem a ver com mudar o horário e
 * segue em `it.fails` até o conserto dele.
 *
 *  H1 1× ao dia de madrugada (00:30) marcado antes da meia-noite grava no dia SEGUINTE (A3, certo). Se
 *     logo depois a pessoa muda o horário pra 23:00, a marca fica onde está (a das 00:30 do dia 8, já
 *     tomada) e o horário novo começa às 23:00 do dia 8 — com aviso. Antes, a tela pedia de novo o
 *     comprimido que ela acabou de tomar e o dia 8 ficava sem aviso.
 *  H2 Mudar a 1ª dose em 2 aberturas da fileira (ou trocando de tela no meio) dá o mesmo que de uma vez.
 *  H3 (BAIXA, segue aberto) A Home conta remédio por toda linha em vigor, sem o `inicio`: com "Começa
 *     amanhã", hoje a Home diz "3 suplementos pendentes" de um tratamento que não começou.
 *  H4 Marca que chega de fora (outro aparelho) com a fileira de edição aberta não some ao mudar a 1ª
 *     dose: mudar o horário não grava o registro de "tomado".
 */
process.env.TZ = "America/Sao_Paulo";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const avisoCurto = vi.hoisted(() => ({ fn: (() => {}) as (...a: unknown[]) => void }));
const nativo = vi.hoisted(() => ({ on: false }));
const rearmes = vi.hoisted(() => ({ n: 0 }));

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
  isNativeShell: () => nativo.on,
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
import { dosesEmVigor, gerarHorarios, montarLinhas, type Remedio } from "@/lib/remedios";
import { esquecerMarcasDaCaixa } from "@/lib/remedio-caixa";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
vi.mock("@/lib/reagendar", async (orig) => {
  const m = await orig<typeof import("@/lib/reagendar")>();
  return { ...m, reagendarTudo: (...a: Parameters<typeof m.reagendarTudo>) => { rearmes.n++; return m.reagendarTudo(...a); } };
});
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
const voltarProApp = () => {
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("focus"));
  fireEvent(window, new Event("pageshow"));
};
const mudarPrimeira = (hora: string) => {
  fireEvent.click(screen.getByLabelText("Editar horários de Amoxicilina"));
  fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: hora } });
  fireEvent.click(screen.getByText("Pronto"));
};
const marcasNoRelogio = (s: Store) => {
  const hora = new Map(linhas(s).map((l) => [l.id, l.time]));
  return Object.entries(log(s)).flatMap(([dia, ids]) => ids.filter((id) => hora.has(id)).map((id) => `${dia.slice(8, 10)}/${hora.get(id)}`)).sort();
};
const simples = (time: string) => ({ id: "r1", name: "Losartana", time, stock: 30, dosesPerDay: 1 });
const caixaSimples = () => screen.getByRole("button", { name: /^(Desmarcar Losartana|Marcar Losartana como tomado)$/ });

describe("crítica de fora, 08/11, rodada 3 — depois da simplificação", () => {
  /* H1: 1× ao dia de madrugada (00:30), tomado às 23:50 (grava no dia 8, A3). Às 23:55 a pessoa muda o
     horário pra 23:00. A marca fica no dia 8 (é a das 00:30, tomada); o 23:00 começa no dia 8 com aviso. */
  it("H1 1× ao dia 00:30 tomado às 23:50, horário mudado pra 23:00 às 23:55: a marca fica, o dia 8 segue ✓ até a virada e o aviso das 23:00 do dia 8 existe", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixaSimples()); // a das 00:30 de daqui a 40 min (grava no dia 8)
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": ["r1"] });
    agoraEm(7, 23, 55);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    expect(falas).toContain("Os horários novos valem a partir de amanhã.");
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": ["r1"] });
    expect(estoque(store)).toEqual([29]);
    expect(avisos(store)).toContain("08/23:00");
    // no dia 8 de dia a caixa mostra o ✓ do comprimido das 23:50 (a das 00:30 do dia 8); perto das 23:00, a nova
    agoraEm(8, 9, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Desmarcar Losartana");
    agoraEm(8, 22, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Marcar Losartana como tomado");
    fireEvent.click(caixaSimples());
    expect(estoque(store)).toEqual([28]); // 2 comprimidos, 2 baixas
    expect(avisos(store).filter((a) => a.startsWith("08/"))).toEqual([]);
    expect(avisos(store)[0]).toBe("09/23:00");
  });

  it("H1b sem registro antes: logo depois de mudar pra 23:00 a caixa segue ✓ (o comprimido das 23:50), um toque não baixa de novo e a fila tem o aviso das 23:00 do dia 8", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: {} });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixaSimples());
    agoraEm(7, 23, 55);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    agoraEm(7, 23, 56);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Desmarcar Losartana");
    expect(log(store)).toEqual({ "2026-11-08": ["r1"] });
    expect(estoque(store)).toEqual([29]);
    expect(avisos(store)).toContain("08/23:00");
  });

  it("H1c 1× ao dia 00:30 (tomado hoje cedo) mudado pra 23:00 às 15:00: começa hoje às 23:00 (a linha ganha id novo); até a virada a caixa desmarca e marca a das 00:30 de hoje, no id de antes", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 15, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    expect(falas).toContain("Os horários novos valem a partir de hoje, às 23:00.");
    expect(linhas(store)[0]).toMatchObject({ time: "23:00", horaAntes: "00:30", idAntes: "r1", novoDesde: "2026-11-07T23:00" });
    expect(linhas(store)[0].id).not.toBe("r1");
    expect(avisos(store)[0]).toBe("07/23:00"); // 22 h 30 depois do comprimido das 00:30
    agoraEm(7, 16, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Desmarcar Losartana");
    fireEvent.click(caixaSimples()); // desmarca a das 00:30 de hoje (id de antes)
    expect(log(store)).toEqual({});
    expect(estoque(store)).toEqual([31]);
    fireEvent.click(caixaSimples());
    expect(log(store)).toEqual({ "2026-11-07": ["r1"] });
    expect(estoque(store)).toEqual([30]);
    agoraEm(7, 22, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Marcar Losartana como tomado");
    fireEvent.click(caixaSimples());
    expect(log(store)).toEqual({ "2026-11-07": ["r1", linhas(store)[0].id] });
    expect(estoque(store)).toEqual([29]);
  });

  it("H1 (controle) o mesmo sem mudar o horário: o dia 8 fica tomado (é a das 00:30 do dia 8)", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: {} });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixaSimples());
    agoraEm(8, 9, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Desmarcar Losartana");
  });

  /* H2: 8 em 8, 08:00 tomada. Às 08:20: 08:00 → 11:00, "Pronto"; reabre e acerta 11:00 → 11:30. Dá o
     mesmo que 08:00 → 11:30 de uma vez: hoje segue 08:00 ✓, 16:00 e 00:00; amanhã 11:30, 19:30 e 03:30. */
  const hojeSegue = (store: Store) => {
    expect(log(store)["2026-11-07"]).toEqual(expect.arrayContaining([linhas(store)[0].id]));
    expect(avisos(store).slice(0, 3)).toEqual(["07/16:00", "08/00:00", "08/11:30"]);
  };

  it("H2 08:00 tomada; às 08:20 08:00 → 11:00, Pronto, reabre, 11:00 → 11:30: o mesmo que de uma vez", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const logIni = { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] };
    const store = criarStore({ [CHAVE]: novas, [LOG]: logIni });
    agoraEm(7, 8, 20);
    montar(store);
    mudarPrimeira("11:00");
    agoraEm(7, 8, 21);
    mudarPrimeira("11:30");
    expect(log(store)).toEqual(logIni);
    hojeSegue(store);
    const deUmaVez = criarStore({ [CHAVE]: novas, [LOG]: logIni });
    cleanup();
    montar(deUmaVez);
    mudarPrimeira("11:30");
    expect(linhas(store).map((l) => [l.time, l.horaAntes, l.novoDesde])).toEqual(linhas(deUmaVez).map((l) => [l.time, l.horaAntes, l.novoDesde]));
  });

  it("H2b o mesmo trocando de tela entre as duas mudanças (desmonta e monta de novo)", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 20);
    const r = montar(store);
    fireEvent.click(screen.getByLabelText("Editar horários de Amoxicilina"));
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "11:00" } });
    r.unmount(); // foi pra outra tela sem tocar em "Pronto"
    agoraEm(7, 8, 22);
    montar(store);
    mudarPrimeira("11:30");
    hojeSegue(store);
  });

  it("H2 (controle) desfazer em 2 aberturas: 08:00 → 11:00, Pronto, 11:00 → 08:00 volta ao que era (sem troca gravada)", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 20);
    montar(store);
    mudarPrimeira("11:00");
    mudarPrimeira("08:00");
    expect(linhas(store)).toEqual(novas);
    expect(marcasNoRelogio(store)).toEqual(["06/08:00", "06/16:00", "07/00:00", "07/08:00"]);
    expect(avisos(store)[0]).toBe("07/16:00");
  });

  /* H4: a marca que chega de FORA (outro aparelho) com a fileira de edição aberta não some: mudar a 1ª
     dose não grava o registro de "tomado". */
  it("H4 marca que chega de outro aparelho com a fileira de edição aberta não some ao mudar a 1ª dose", async () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 7, 50);
    montar(store);
    fireEvent.click(screen.getByLabelText("Editar horários de Amoxicilina"));
    agoraEm(7, 8, 5);
    const vindo = { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] };
    act(() => { store.estado.dados = { ...store.estado.dados, [LOG]: vindo }; avisarEscritaDeFora(LOG, vindo); });
    await act(async () => { await Promise.resolve(); });
    expect(pilula(d08).getAttribute("aria-pressed")).toBe("true"); // a tela já mostra a marca do celular
    agoraEm(7, 8, 10);
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "08:30" } });
    expect(log(store)).toEqual(vindo);
    expect(pilula(d08).getAttribute("aria-pressed")).toBe("true");
    expect(avisos(store)[0]).toBe("07/16:00");
  });

  /* H3: a Home conta remédio pelo dia do CALENDÁRIO e por toda linha em vigor, sem olhar o `inicio`:
     com "Começa amanhã", hoje a Home diz "3 suplementos pendentes" de um tratamento que não começou. */
  it.fails("H3 'Começa amanhã': hoje nenhuma dose está em vigor pra Home", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("08:00", 3), "2026-11-13", agoraEm(7, 21, 0).getTime(), "2026-11-08T08:00");
    expect(dosesEmVigor(novas, agoraEm(7, 21, 30))).toHaveLength(0);
  });
});
