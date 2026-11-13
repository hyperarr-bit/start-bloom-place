/**
 * CRÍTICA DE FORA, 10/11, RODADA 2 — repro da regra "mudar o horário vale a partir de amanhã"
 * (lib/remedios, mudarHorarios). Cada caso diz o que DEVIA acontecer; `it.fails` até o conserto.
 * Os casos "(controle)" passam hoje e mostram o vizinho que funciona.
 *
 *  J1 (ALTA) 1× ao dia da MEIA-NOITE (00:00–02:59) passado pra NOITE (de ~06:00 até 3 h antes dele):
 *     a dose desta noite some, sem aviso, e a 1ª nova fica pra noite de amanhã — 44 h sem remédio.
 *     A tela diz "a partir de amanhã, às 20:00" e quem confia ainda espera a das 00:00 desta noite.
 *     Mudar pra 21:00 dá certo (hoje 21:00, 21 h depois) — 1 hora na escolha muda o resultado em 23 h.
 *  J2 (ALTA) mudar o horário perto do fim ("O tratamento termina antes de os horários novos começarem")
 *     e DEPOIS estender o "Até" (o médico manda mais dias): os horários de antes seguem até o fim velho
 *     E os novos começam no dia que tinha sido calculado — 2 comprimidos com 1 h 30 (1× ao dia) ou 4 h 30
 *     (12 em 12), com aviso pros dois. No 12 em 12 a fila avisa dose que a tela não tem ("ainda não
 *     chegou") e no aviso seguinte a caixa está ✓.
 *  J3 (MÉDIA) 1× ao dia tomado ATRASADO e mudado logo depois: a folga de 6 h conta da hora marcada da
 *     dose (20:00), não de quando a pessoa tomou — tomada às 23:30 e mudada pra 02:00, a 1ª nova toca
 *     às 02:00, 2 h 30 depois do comprimido.
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
import { agruparRemedios, dosesDoGrupoAgora, gerarHorarios, montarLinhas, mudarHorarios, type Remedio } from "@/lib/remedios";
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
const avisosEm = (s: Store) => planejarRemedios(lerDadosDosLembretes(s.get).remedios);
const avisos = (s: Store) => avisosEm(s).map((a) => fmt(a.quando));
const simples = (time: string, ate?: string): Remedio[] => [{ id: "r1", name: "Losartana", time, stock: 30, dosesPerDay: 1, ...(ate ? { ate } : {}) }];
const caixaSimples = () => screen.getByRole("button", { name: /^(Desmarcar Losartana|Marcar Losartana como tomado)$/ });
const horasEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3600_000;
let falas: string[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  falas = [];
  avisoCurto.fn = (texto: unknown) => { falas.push(String(texto)); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); esquecerMarcasDaCaixa(); });

describe("crítica de fora, 10/11, rodada 2", () => {
  /* J1: Losartana 1× ao dia às 00:00 (a pessoa dorme tarde), tomada à 00:00 do dia 7. Ao meio-dia ela
     passa pra 20:00. A virada do dia da dose das 00:00 é às 21:00 (3 h antes da de amanhã), então a 1ª
     nova tem que ser depois das 21:00 do dia 7 — 20:00 de hoje não serve e vai pra 20:00 do dia 8. E a
     das 00:00 desta noite (dia 8) não existe mais (antesAte = dia 7). */
  it.fails("J1 1× 00:00 → 20:00 ao meio-dia (tomada à 00:00): a próxima dose vem em até 24 h, não 44 h", () => {
    const store = criarStore({ [CHAVE]: simples("00:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 12, 10);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "20:00" } });
    expect(falas).toContain("Os horários novos valem a partir de amanhã, às 20:00."); // passa: é o que a tela diz
    const proxima = avisosEm(store)[0].quando;
    // hoje: "08/20:00" — nada às 00:00 desta noite, 44 h depois do último comprimido
    expect(horasEntre(new Date(2026, 10, 7, 0, 0), proxima)).toBeLessThanOrEqual(24);
  });

  it("J1 (controle) o mesmo pra 21:00: hoje 21:00, 21 h depois — 1 hora na escolha muda o resultado em 23 h", () => {
    const store = criarStore({ [CHAVE]: simples("00:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 12, 10);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "21:00" } });
    expect(avisos(store)[0]).toBe("07/21:00");
    expect(falas).toContain("Os horários novos valem a partir de hoje, às 21:00.");
  });

  it.fails("J1b 00:30 → 21:00 (e às 21:40, perto da meia-noite, 00:00 → 19:00): nunca mais de 24 h + a diferença entre os horários", () => {
    const a = mudarHorarios(simples("00:30"), ["21:00"], agoraEm(7, 12, 10));
    // hoje: 2026-11-08T21:00 — 44 h 30 depois da das 00:30 do dia 7
    expect(a.novoDesde).toBe("2026-11-07T21:00");
    const b = mudarHorarios(simples("00:00"), ["19:00"], agoraEm(7, 21, 40));
    // hoje: a das 00:00 desta noite fica e a 1ª nova é 09/19:00 — 43 h depois dela (o dia 8 fica sem a das 19:00)
    expect(b.novoDesde).toBe("2026-11-08T19:00");
  });

  /* J2: Losartana 1× ao dia às 23:00 com "Até" dia 8. No dia 7, ao meio-dia, a pessoa passa pra 00:30.
     A 1ª nova seria 09/00:30 (depois do fim): a tela avisa que até o fim valem os de antes, e o antesAte
     é empurrado pro dia 8. Aí o médico manda mais 4 dias e ela muda o "Até" pra 12: os de antes seguem
     até 08/23:00 E os novos começam 09/00:30. */
  it.fails("J2 1× 23:00 até 08 → 00:30, depois 'Até' 12: nunca 2 comprimidos a menos de 6 h", () => {
    const store = criarStore({ [CHAVE]: simples("23:00", "2026-11-08"), [LOG]: {} });
    agoraEm(7, 12, 10);
    montar(store);
    fireEvent.click(screen.getByLabelText("Editar horários de Losartana"));
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "00:30" } });
    expect(falas).toContain("O tratamento termina antes de os horários novos começarem: até o fim valem os de antes.");
    agoraEm(7, 12, 20);
    fireEvent.change(screen.getByLabelText("Até quando de Losartana"), { target: { value: "2026-11-12" } });
    const fila = avisosEm(store).map((a) => a.quando);
    const colados = fila.slice(1).map((q, i) => [fila[i], q] as const).filter(([a, b]) => horasEntre(a, b) < 6).map(([a, b]) => `${fmt(a)} e ${fmt(b)}`);
    expect(colados).toEqual([]); // hoje: ["08/23:00 e 09/00:30"]
  });

  it.fails("J2b 12 em 12 20:00 até 08 → 00:30, depois sem 'Até': nunca 2 avisos a menos de 6 h, e a dose de cada aviso está na tela na hora dele", () => {
    const base = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("20:00", 2), "2026-11-08", new Date(2026, 10, 1, 7, 0).getTime(), "2026-11-01T20:00");
    const r = mudarHorarios(base, gerarHorarios("00:30", 2), agoraEm(7, 12, 10));
    expect(r.semDoseNova).toBe(true); // passa: "até o fim valem os de antes"
    const semFim = r.itens.map(({ ate: _a, ...s }) => s as Remedio);
    const desde = agoraEm(7, 12, 20);
    const get = <T,>(k: string, f: T): T => (k === CHAVE ? (semFim as unknown as T) : f);
    const fila = planejarRemedios(lerDadosDosLembretes(get).remedios, desde).map((a) => a.quando).filter((q) => q.getTime() < new Date(2026, 10, 11).getTime());
    const colados = fila.slice(1).map((q, i) => [fila[i], q] as const).filter(([a, b]) => horasEntre(a, b) < 6).map(([a, b]) => `${fmt(a)} e ${fmt(b)}`);
    // hoje: ["08/20:00 e 09/00:30", "09/08:00 e 09/12:30"] — e às 09/00:30 a tela mostra 08/20:00 e 09/08:00 (a caixa diz
    // "ainda não chegou"); às 09/12:30, as duas marcadas = caixa ✓; às 14:30 aparecem 09/00:30 e 09/12:30 atrasadas
    expect(colados).toEqual([]);
    const semDoseNaTela = fila.filter((q) => !dosesDoGrupoAgora(agruparRemedios(semFim)[0], q).some((d) => d.quando === q.getTime())).map(fmt);
    expect(semDoseNaTela).toEqual([]); // hoje: ["09/00:30", "09/12:30"]
  });

  /* J3: Losartana 1× ao dia às 20:00, tomada atrasada às 23:30 (a caixa marca a de hoje). Às 23:35 ela
     passa pra 02:00. A folga de 6 h conta das 20:00 (hora da dose), então 08/02:00 vale — 2 h 30 depois
     do comprimido. O registro não guarda a hora em que foi tomado; quando a última de antes já está
     marcada na hora da mudança, a única conta segura é a partir de agora. */
  it.fails("J3 1× 20:00 tomada às 23:30 e mudada pra 02:00 às 23:35: a 1ª nova fica a 6 h ou mais do comprimido", () => {
    const store = criarStore({ [CHAVE]: simples("20:00"), [LOG]: {} });
    agoraEm(7, 23, 30);
    montar(store);
    fireEvent.click(caixaSimples());
    expect((store.estado.dados[LOG] as Record<string, string[]>)["2026-11-07"]).toEqual(["r1"]);
    agoraEm(7, 23, 35);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "02:00" } });
    // hoje: "Os horários novos valem a partir de amanhã, às 02:00." e o 1º aviso é 08/02:00
    expect(horasEntre(new Date(2026, 10, 7, 23, 30), avisosEm(store)[0].quando)).toBeGreaterThanOrEqual(6);
  });

  it("J3 (controle) tomada na hora (20:00) e mudada às 20:05 pra 02:00: 6 h, o mínimo combinado", () => {
    const store = criarStore({ [CHAVE]: simples("20:00"), [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 20, 5);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "02:00" } });
    expect(avisos(store)[0]).toBe("08/02:00");
  });
});
