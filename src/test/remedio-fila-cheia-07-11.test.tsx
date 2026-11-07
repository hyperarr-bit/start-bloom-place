/**
 * CRÍTICA DO REMÉDIO DE 8 EM 8 (07/11, 2ª rodada).
 *
 *  - iPhone com a fila de 64 avisos cheia das séries diárias: o remédio novo e a
 *    reunião marcada TÊM aviso, e continuam tendo depois de fechar e reabrir
 *    (antes: zero, porque os avisos velhos da rotina e do skincare ocupavam as vagas);
 *  - a caixa da linha marca a dose DA HORA (00:10 → a das 00:00; 08:05 → a das 08:00),
 *    e o aviso da dose seguinte continua armado;
 *  - a dose das 00:00 do último dia tem aviso e dá pra marcar; "terminou" só depois dela;
 *  - no Android o remédio não tem teto: cobre os 10 dias de sempre.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

type Agendado = { id: number; title?: string; schedule: { at: Date } };
const ln = vi.hoisted(() => ({ agendados: [] as Array<{ id: number; title?: string; schedule: { at: Date } }> }));
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
      return {};
    },
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getDeliveredNotifications: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: () => {} }),
  },
}));
const plataforma = vi.hoisted(() => ({ nativo: true, android: false }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isAndroid: () => plataforma.nativo && plataforma.android,
  isIOS: () => plataforma.nativo && !plataforma.android,
  plataformaApp: () => (plataforma.nativo ? (plataforma.android ? "android" : "ios") : "web"),
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
const toasts = vi.hoisted(() => ({ erros: [] as string[], sucessos: [] as string[] }));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, {
    success: (t: string) => { toasts.sucessos.push(t); },
    error: (t: string) => { toasts.erros.push(t); },
    info: vi.fn(), dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { BASES_LEMBRETES, TETO_IPHONE, planejarRemedios, repartirVagas } from "@/lib/notificacoes";
import { reagendarTudo, lerDadosDosLembretes } from "@/lib/reagendar";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { agruparRemedios, doseDaHora, dosesDoGrupoAgora, dosesEmVigor, tratamentoTerminou, type Remedio } from "@/lib/remedios";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";
import { diaPadraoDaReuniao } from "@/pages/Carreira";
import { localDayKey } from "@/lib/utils";

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
const naFaixa = (tipo: string) => (a: { id: number }) => a.id >= BASES_LEMBRETES[tipo] && a.id < BASES_LEMBRETES[tipo] + 10000;
const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDayKey(d); };

/** A conta da crítica: rotina, dieta, limite, leitura, rotina da manhã e skincare ligados. */
const contaCheia = (): Dados => ({
  [CHAVE_PREFS]: lerPrefs({ rotina: true, dieta: true, limite: true, leitura: true, compromissos: true }),
  "lib-books": [{ title: "Torto Arado", status: "lendo", pages: 260, currentPage: 40 }],
  "finance-expenses": [{ id: "g1", description: "Mercado", amount: 50 }],
  "rotina-habits": ["Beber água", "Caminhar"],
  "rotina-lembrete-manha-prefs": { ligado: true, hora: "07:15" },
  "skincare-lembrete-prefs": { manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } },
  "skincare-am-steps": [{ name: "Limpeza" }, { name: "Protetor" }],
  "skincare-pm-steps": [{ name: "Limpeza" }, { name: "Hidratante" }],
});

beforeEach(() => {
  ln.agendados = [];
  plataforma.nativo = true; plataforma.android = false;
  toasts.erros.length = 0; toasts.sucessos.length = 0;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ───────────────────────────── iPhone: a fila cheia ───────────────────────────── */
describe("iPhone com a fila de avisos cheia", () => {
  it("remédio de 8 em 8 e reunião amanhã 10:00 têm aviso; reabrir o app não tira; as séries diárias perdem os de longe", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 4, 18));
    const store = criarStore(contaCheia());
    const prefs = () => lerPrefs(store.get<unknown>(CHAVE_PREFS, undefined));

    await reagendarTudo(store.get, prefs());
    expect(ln.agendados.length).toBe(TETO_IPHONE); // a fila cheia, só de séries diárias

    // cadastra o remédio de 8 em 8 (3 linhas do mesmo grupo) e marca a reunião de amanhã 10:00
    store.estado.dados[CHAVE] = ["08:00", "16:00", "00:00"].map((time, i) => ({ id: `a${i}`, name: "Amoxicilina", time, stock: 21, dosesPerDay: 1, grupo: "g1" }));
    store.estado.dados["rotina-compromissos"] = [{ id: "r1", titulo: "Reunião com Ana", data: dia(1), hora: "10:00", aviso: 60 }];
    await reagendarTudo(store.get, prefs());

    const conferir = () => {
      const remedio = ln.agendados.filter(naFaixa("saude"));
      const reuniao = ln.agendados.filter(naFaixa("compromisso"));
      expect(ln.agendados.length).toBeLessThanOrEqual(TETO_IPHONE);
      // o remédio pega todas as vagas que precisa antes das séries diárias (10 dias de 8 em 8)
      expect(remedio.length).toBe(planejarRemedios(lerDadosDosLembretes(store.get).remedios).length);
      expect(remedio.map((a) => a.schedule.at.getTime()).sort((a, b) => a - b)[0]).toBe(new Date(2026, 10, 7, 8, 0).getTime());
      expect(reuniao).toHaveLength(1);
      expect(reuniao[0].schedule.at.getTime()).toBe(new Date(2026, 10, 8, 9, 0).getTime());
      // nenhuma série diária calou: todas seguem com os avisos mais próximos
      for (const tipo of ["rotina", "dieta", "limite", "leitura", "rotinaManha", "beleza"]) {
        const daSerie = ln.agendados.filter(naFaixa(tipo));
        expect(daSerie.length, tipo).toBeGreaterThan(0);
      }
    };
    conferir();

    // fecha e reabre: o useLembretes roda o reagendamento de novo com o mesmo dado
    await reagendarTudo(store.get, prefs());
    conferir();
  });

  it("piso: com 60 avisos avulsos pendentes, o remédio ainda arma as próximas 48 h", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 4, 18));
    ln.agendados = Array.from({ length: 60 }, (_, i) => ({ id: 700000 + i, title: "régua", schedule: { at: new Date(2026, 10, 7 + (i % 5), 12) } }));
    const store = criarStore({ [CHAVE]: ["08:00", "16:00", "00:00"].map((time, i) => ({ id: `a${i}`, name: "Amox", time, stock: 21, dosesPerDay: 1, grupo: "g1" })) });
    await reagendarTudo(store.get, lerPrefs(undefined));
    const remedio = ln.agendados.filter(naFaixa("saude")).map((a) => a.schedule.at.getTime());
    expect(remedio.length).toBe(6); // 07/11 08h e 16h, 08/11 0h, 8h, 16h, 09/11 0h
    expect(Math.max(...remedio)).toBe(new Date(2026, 10, 9, 0, 0).getTime());
  });

  it("repartirVagas: compromisso antes do resto do remédio; o corte cai nos avisos de longe das séries diárias", () => {
    const agora = new Date(2026, 10, 7, 4, 18);
    const em = (h: number) => new Date(agora.getTime() + h * 3600e3);
    const serie = (n: number, passo: number, ini = 1) => Array.from({ length: n }, (_, i) => ({ quando: em(ini + i * passo), title: "x", body: "" }));
    const r = repartirVagas([
      { tipo: "rotina", rota: "/", avisos: serie(11, 24) },
      { tipo: "beleza", rota: "/", avisos: serie(22, 12) },
      { tipo: "saude", rota: "/", avisos: serie(30, 8) },
      { tipo: "compromisso", rota: "/", avisos: serie(1, 1, 200) },
    ], 50, agora);
    expect(r.get("compromisso")).toHaveLength(1);
    expect(r.get("saude")).toHaveLength(30);
    expect((r.get("rotina")?.length ?? 0) + (r.get("beleza")?.length ?? 0)).toBe(19);
    expect(r.get("rotina")!.length).toBeGreaterThan(0);
    expect(r.get("beleza")!.length).toBeGreaterThan(0);
  });
});

/* ───────────────────────────── Android: sem teto ───────────────────────────── */
describe("Android: o remédio cobre os 10 dias", () => {
  it("6 em 6 h: todos os avisos dos próximos 10 dias, sem o corte de 30", async () => {
    plataforma.android = true;
    const agora = new Date(2026, 10, 7, 7, 0);
    const seis = ["06:00", "12:00", "18:00", "00:00"].map((hora, i) => ({ id: `s${i}`, nome: "Prednisona", hora, tomadoHoje: false }));
    const avisos = planejarRemedios(seis, agora);
    expect(avisos.length).toBe(42);
    expect(avisos[avisos.length - 1].quando.getDate()).toBe(17);
  });
});

/* ───────────────────────────── a caixa pelo relógio ───────────────────────────── */
describe("a caixa da linha marca a dose da hora", () => {
  const grupo8 = (): Remedio[] => ["08:00", "16:00", "00:00"].map((time, i) => ({ id: `a${i}`, name: "Amoxicilina", time, stock: 21, dosesPerDay: 1, grupo: "g1" }));
  const grupo12 = (): Remedio[] => ["20:00", "08:00"].map((time, i) => ({ id: `b${i}`, name: "Dipirona", time, stock: 20, dosesPerDay: 1, grupo: "g2" }));

  it("doseDaHora: a mais recente que já passou; se nenhuma passou, a primeira do dia", () => {
    const g = grupo8();
    expect(doseDaHora(g, new Date(2026, 10, 8, 0, 10))?.time).toBe("00:00");
    expect(doseDaHora(g, new Date(2026, 10, 8, 17, 0))?.time).toBe("16:00");
    expect(doseDaHora(g.slice(0, 2), new Date(2026, 10, 8, 7, 0))?.time).toBe("08:00");
  });

  it("8 em 8, 00:10: a caixa marca a das 00:00 e o aviso das 08:00 de hoje continua", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 0, 10));
    const store = criarStore({ [CHAVE]: grupo8() });
    const { unmount } = render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
    expect(screen.getByTestId("dose-a2")).toHaveAttribute("data-da-vez", "true");
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (00:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-08": ["a2"] });
    unmount();

    // reabre: continua marcada a das 00:00, e o plano ainda tem a das 08:00 de hoje
    render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
    expect(screen.getByTestId("dose-a2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("dose-a0")).toHaveAttribute("aria-pressed", "false");
    const plano = planejarRemedios(lerDadosDosLembretes(store.get).remedios);
    expect(plano[0].quando.getTime()).toBe(new Date(2026, 10, 8, 8, 0).getTime());
  });

  it("12 em 12 desde as 20:00, 08:05: a caixa marca a das 08:00 e o aviso das 20:00 de hoje continua", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 8, 8, 5));
    const store = criarStore({ [CHAVE]: grupo12() });
    render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Dipirona (08:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-08": ["b1"] });
    const plano = planejarRemedios(lerDadosDosLembretes(store.get).remedios);
    expect(plano[0].quando.getTime()).toBe(new Date(2026, 10, 8, 20, 0).getTime());
    // a pílula das 20:00, às 08:05, é a de ONTEM à noite (o dia do tratamento começa às 20:00): grava em 07/11
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Dipirona (20:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-08": ["b1"], "2026-11-07": ["b0"] });
    // com as duas marcadas, a caixa desmarca a da hora (a das 08:00), não a do cadastro
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Dipirona" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-08": [], "2026-11-07": ["b0"] });
  });
});

/* ───────────────────────────── a última dose da noite ───────────────────────────── */
describe("a dose das 00:00 do último dia", () => {
  const amox = (): Remedio[] => ["08:00", "16:00", "00:00"].map((time, i) => ({ id: `a${i}`, name: "Amoxicilina", time, stock: 21, dosesPerDay: 1, grupo: "g1", ate: "2026-11-13" }));

  it("tem aviso: às 16:30 do dia 13 o próximo é 14/11 00:00; cadastrado 07/11 07:50, são 21 avisos pras 21 doses", () => {
    const de = (agora: Date) => planejarRemedios(lerDadosDosLembretes(criarStore({ [CHAVE]: amox() }).get).remedios, agora);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 13, 16, 30));
    expect(de(new Date()).map((a) => a.quando.getTime())).toEqual([new Date(2026, 10, 14, 0, 0).getTime()]);
    vi.setSystemTime(new Date(2026, 10, 7, 7, 50));
    expect(de(new Date())).toHaveLength(21);
  });

  it("às 00:10 do dia 14 dá pra marcar a das 00:00 (as do dia 13 seguem como estavam); 'terminou' só às 08:00", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 14, 0, 10));
    const g = agruparRemedios(amox())[0];
    expect(tratamentoTerminou(g)).toBe(false);
    // ainda é o dia 13 do tratamento: as de 08:00 e 16:00 são as do dia 13; a das 00:00, a de agora
    expect(dosesDoGrupoAgora(g).map((s) => `${s.time}@${s.dia}`)).toEqual(["08:00@2026-11-13", "16:00@2026-11-13", "00:00@2026-11-14"]);
    const store = criarStore({ [CHAVE]: amox(), [LOG]: { "2026-11-13": ["a0", "a1"] } });
    const { unmount } = render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe("8 em 8 h · até 13/11");
    expect(screen.getByTestId("dose-a0")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("dose-a2")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (00:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-13": ["a0", "a1"], "2026-11-14": ["a2"] });
    expect(screen.getByText("Amoxicilina").className).toContain("line-through"); // as 3 doses do último dia foram
    unmount();

    vi.setSystemTime(new Date(2026, 10, 14, 8, 0));
    expect(tratamentoTerminou(g)).toBe(true);
    expect(dosesEmVigor(amox())).toEqual([]);
    render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe("8 em 8 h · terminou 13/11");
    expect(screen.getByTestId("dose-a2")).toBeDisabled();
  });

  it("remédio sem dose depois da meia-noite termina na virada, como antes", () => {
    const g = agruparRemedios([{ id: "x", name: "Vit D", time: "08:00", stock: 9, dosesPerDay: 1, ate: "2026-11-13" }])[0];
    expect(tratamentoTerminou(g, new Date(2026, 10, 13, 23, 59))).toBe(false);
    expect(tratamentoTerminou(g, new Date(2026, 10, 14, 0, 0))).toBe(true);
  });
});

/* ───────────────────────────── a reunião ───────────────────────────── */
describe("Marcar reunião: o dia em que o formulário abre", () => {
  it("o próximo dia útil em que 09:00 ainda não passou", () => {
    expect(diaPadraoDaReuniao(new Date(2026, 10, 9, 8, 0))).toBe("2026-11-09"); // segunda, antes das 9
    expect(diaPadraoDaReuniao(new Date(2026, 10, 9, 14, 0))).toBe("2026-11-10"); // segunda à tarde → terça
    expect(diaPadraoDaReuniao(new Date(2026, 10, 7, 14, 0))).toBe("2026-11-09"); // sábado → segunda
    expect(diaPadraoDaReuniao(new Date(2026, 10, 13, 10, 0))).toBe("2026-11-16"); // sexta depois das 9 → segunda
  });
});

