/**
 * CRÍTICA DE FORA, 08/11, RODADA 3 — repro. Cada caso diz o que DEVIA acontecer e está em `it.fails`
 * até o conserto (o comentário "hoje:" diz o que acontece agora). Os "(controle)" e "(medida)" passam hoje.
 *
 *  H1 (ALTA) 1× ao dia de madrugada (00:30) marcado antes da meia-noite grava no dia SEGUINTE (A3, certo).
 *     Se logo depois a pessoa muda o horário pra antes da meia-noite (23:00), a marca fica no dia seguinte:
 *     a tela pede a das 23:00 de hoje (o comprimido que ela acabou de tomar), o toque baixa o estoque de
 *     novo (1 comprimido = 2 marcas, 30 → 28), e o dia seguinte aparece tomado o dia inteiro, SEM o aviso
 *     das 23:00: a pessoa pula a dose do dia seguinte. Mudar o horário de remédio de 1 linha não leva a
 *     marca junto (PharmacyChecklist changeTime só move marcas de grupo). Só no ramo (o main grava sempre hoje).
 *  H2 (MÉDIA) O G1 só vale numa abertura da fileira de edição: 08:00 tomada, às 08:20 08:00 → 11:00
 *     (a marca vai pra 11:00), "Pronto" (ou trocar de tela), reabre e 11:00 → 11:30: a marca das 11:00 é
 *     tratada como "adiantada" e sai — a das 11:30 fica devida e o aviso toca 3 h 30 depois do comprimido.
 *     De uma vez (08:00 → 11:30) a marca vai pra 11:30. Fura a guarda do G1 (nunca menos de meio intervalo).
 *  H3 (BAIXA) A Home conta remédio por toda linha em vigor, sem o `inicio`: com "Começa amanhã", hoje a Home
 *     diz "3 suplementos pendentes" de um tratamento que não começou (dosesEmVigor não olha o começo).
 *  H4 (BAIXA) A foto da fileira de edição não vê marca que chega de fora depois de aberta (outro aparelho,
 *     conta relida ao voltar pro app): mudar a 1ª dose grava o registro do grupo a partir da foto e apaga a
 *     marca que a tela já mostrava.
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

describe("crítica de fora, 08/11, rodada 3 — repro", () => {
  /* H1: 1× ao dia de madrugada (00:30), tomado às 23:50 (grava amanhã, A3). Às 23:55 a pessoa muda o
     horário pra 23:00. A marca fica no dia 8: o dia 8 aparece tomado e o aviso das 23:00 do dia 8 some. */
  it.fails("H1 1× ao dia 00:30 tomado às 23:50, horário mudado pra 23:00 às 23:55: o dia 8 NÃO fica tomado e o aviso das 23:00 do dia 8 existe", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixaSimples()); // a das 00:30 de daqui a 40 min (grava no dia 8)
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": ["r1"] });
    agoraEm(7, 23, 55);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    // hoje: log fica {07: [r1], 08: [r1]} — às 23:00 o comprimido das 23:50 é a dose do dia 7
    agoraEm(8, 9, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Marcar Losartana como tomado");
    expect(avisos(store)).toContain("08/23:00");
  });

  it.fails("H1b sem registro antes: logo depois de mudar pra 23:00 a caixa diz 'Marcar' (o comprimido das 23:50 sumiu da tela) e a fila de 23:56 não tem o aviso das 23:00 do dia 8", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: {} });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixaSimples());
    agoraEm(7, 23, 55);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    agoraEm(7, 23, 56);
    voltarProApp();
    // hoje: 'Marcar Losartana como tomado' (a das 23:00 do dia 7, que é o comprimido das 23:50) — um toque
    // baixa o estoque de novo (30 → 28 com 1 comprimido) e o dia 8 continua marcado
    expect(caixaSimples().getAttribute("aria-label")).toBe("Desmarcar Losartana");
    expect(avisos(store)).toContain("08/23:00");
  });

  it("H1b (medida) o que acontece hoje: 1 comprimido, 2 marcas, estoque 28, sem aviso no dia 8", () => {
    const store = criarStore({ [CHAVE]: [simples("00:30")], [LOG]: {} });
    agoraEm(7, 23, 50);
    montar(store);
    fireEvent.click(caixaSimples());
    agoraEm(7, 23, 55);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "23:00" } });
    agoraEm(7, 23, 56);
    voltarProApp();
    fireEvent.click(caixaSimples()); // a tela pediu a das 23:00 do dia 7
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": ["r1"] });
    expect(estoque(store)).toEqual([28]);
    expect(avisos(store).filter((a) => a.startsWith("08/"))).toEqual([]);
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

  /* H2: G1 depende de a mudança ser numa abertura só. 8 em 8, 08:00 tomada. Às 08:20: 08:00 → 11:00
     (a marca vai pra 11:00, G1), "Pronto"; reabre e acerta 11:00 → 11:30. Na 2ª conta a marca das 11:00
     é "adiantada" (ainda vem, mais de 1 h) e sai: a das 11:30 fica devida, 3 h 30 depois do comprimido.
     Numa abertura só (08:00 → 11:30) a marca vai pra 11:30. */
  it.fails("H2 08:00 tomada; às 08:20 08:00 → 11:00, Pronto, reabre, 11:00 → 11:30: a das 11:30 fica tomada (igual a fazer de uma vez)", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 20);
    montar(store);
    mudarPrimeira("11:00");
    expect(marcasNoRelogio(store)).toContain("07/11:00");
    agoraEm(7, 8, 21);
    mudarPrimeira("11:30");
    // hoje: "07/11:30" não está marcada, o 1º aviso é 07/11:30 (3 h 30 depois do comprimido das 08:00)
    expect(marcasNoRelogio(store)).toContain("07/11:30");
    expect(avisos(store)[0]).toBe("07/19:30");
  });

  it.fails("H2b o mesmo trocando de tela entre as duas mudanças (desmonta e monta de novo)", () => {
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
    expect(avisos(store)[0]).toBe("07/19:30");
  });

  it("H2 (controle) numa abertura só, 08:00 → 11:30: 11:30 ✓, 1º aviso 19:30", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 20);
    montar(store);
    mudarPrimeira("11:30");
    expect(marcasNoRelogio(store)).toContain("07/11:30");
    expect(avisos(store)[0]).toBe("07/19:30");
  });

  it("H2 (controle) desfazer em 2 aberturas: 08:00 → 11:00, Pronto, 11:00 → 08:00 volta a marca pra 08:00", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 20);
    montar(store);
    mudarPrimeira("11:00");
    mudarPrimeira("08:00");
    expect(marcasNoRelogio(store)).toEqual(["06/08:00", "06/16:00", "07/00:00", "07/08:00"]);
    expect(avisos(store)[0]).toBe("07/16:00");
  });

  /* H4: a foto da fileira de edição não vê marca que chega de FORA depois de aberta (outro aparelho, a
     conta relida ao voltar pro app). Fileira aberta às 07:50; às 08:05 chega do celular a marca da 08:00;
     às 08:10 a 1ª dose muda pra 08:30 (na mesma fileira): a conta parte da foto sem a 08:00 e grava o
     registro do grupo inteiro por cima — a marca do celular some e a das 08:30 fica devida. */
  it.fails("H4 marca que chega de outro aparelho com a fileira de edição aberta não some ao mudar a 1ª dose", async () => {
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
    // hoje: a marca some (a 08:30 fica devida, o aviso das 08:30 toca 25 min depois do comprimido)
    expect(marcasNoRelogio(store)).toContain("07/08:30");
  });

  /* H3: a Home conta remédio pelo dia do CALENDÁRIO e por toda linha em vigor, sem olhar o `inicio`:
     com "Começa amanhã", hoje a Home diz "3 suplementos pendentes" de um tratamento que não começou. */
  it.fails("H3 'Começa amanhã': hoje nenhuma dose está em vigor pra Home", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("08:00", 3), "2026-11-13", agoraEm(7, 21, 0).getTime(), "2026-11-08T08:00");
    expect(dosesEmVigor(novas, agoraEm(7, 21, 30))).toHaveLength(0);
  });
});
