/**
 * REMÉDIO DE 8 EM 8 / 12 EM 12 HORAS (07/11, pedido de cliente).
 *
 *  - lib/remedios: horários gerados da primeira dose, rótulo, grupos e linhas;
 *  - o plano dos avisos respeita a data de fim e o teto de avisos de remédio;
 *  - o cadastro: "Quantas vezes" + horários editáveis + "até quando"; a tabela
 *    mostra o grupo como UMA linha com uma pílula por dose; estoque e lixeira
 *    valem pro grupo inteiro; o formato da chave segue o de sempre;
 *  - Android com alarme exato negado: aviso no cadastro e reagenda ao liberar
 *    (no card e na central);
 *  - iPhone: o teto de 64 avisos pendentes corta os de longe, nunca os outros tipos
 *    (a fila cheia de séries diárias mora em remedio-fila-cheia-07-11).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

type Agendado = { id: number; title?: string; schedule: { at: Date; allowWhileIdle?: boolean } };
const ln = vi.hoisted(() => ({
  permissao: "granted" as "granted" | "denied" | "prompt",
  exato: "denied" as "granted" | "denied",
  aberturas: 0,
  agendados: [] as Array<{ id: number; title?: string; schedule: { at: Date; allowWhileIdle?: boolean } }>,
  chamadasSchedule: 0,
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: ln.permissao }),
    requestPermissions: async () => ({ display: ln.permissao }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: ln.agendados }),
    cancel: async (x: { notifications: Array<{ id: number }> }) => {
      const ids = new Set(x.notifications.map((n) => n.id));
      ln.agendados = ln.agendados.filter((n) => !ids.has(n.id));
    },
    schedule: async (x: { notifications: Agendado[] }) => {
      ln.chamadasSchedule++;
      ln.agendados.push(...x.notifications);
      return {};
    },
    checkExactNotificationSetting: async () => ({ exact_alarm: ln.exato }),
    changeExactNotificationSetting: async () => { ln.aberturas++; ln.exato = "granted"; return { exact_alarm: ln.exato }; },
    getDeliveredNotifications: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: () => {} }),
  },
}));
const plataforma = vi.hoisted(() => ({ nativo: false, android: false }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isAndroid: () => plataforma.nativo && plataforma.android,
  isIOS: () => plataforma.nativo && !plataforma.android,
  plataformaApp: () => (plataforma.nativo ? (plataforma.android ? "android" : "ios") : "web"),
}));
// o cadastro de várias doses está atrás da chave REMEDIO_VEZES (desligada no site até a build nova
// sair; ver remedio-chave-site-07-11.test.tsx): aqui ela fica LIGADA, como no app e no site depois
vi.mock("@/lib/remedio-vezes", async (orig) => ({
  ...(await orig<typeof import("@/lib/remedio-vezes")>()),
  remedioVezesLigado: () => true,
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown> | undefined]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d?: Record<string, unknown>) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: { id: "u1" }, subLoaded: true, loading: false }) }));
const toast = vi.hoisted(() => ({ ultimo: null as null | { texto: string; desfazer?: () => void } }));
vi.mock("sonner", () => ({
  toast: Object.assign((texto: string, o?: { action?: { onClick?: () => void } }) => { toast.ultimo = { texto, desfazer: o?.action?.onClick }; }, {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { agruparRemedios, dosesEmVigor, gerarHorarios, montarLinhas, remedioValeNoDia, rotuloDosHorarios } from "@/lib/remedios";
import { BASES_LEMBRETES, TETO_IPHONE, agendarRemedios, planejarRemedios } from "@/lib/notificacoes";
import { lerDadosDosLembretes } from "@/lib/reagendar";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";
import Notificacoes from "@/pages/Notificacoes";
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
  return { estado, Provedor };
}
const CHAVE = "core-saude-supplements";
const LOG = "core-saude-supplement-log";
type Linha = { id: string; name: string; time: string; stock: number; dosesPerDay: number; quem?: string; grupo?: string; ate?: string };
const linhas = (s: ReturnType<typeof criarStore>) => (s.estado.dados[CHAVE] ?? []) as Linha[];
const montar = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
const HOJE = localDayKey();
const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDayKey(d); };

beforeEach(() => {
  ln.permissao = "granted"; ln.exato = "denied"; ln.aberturas = 0; ln.agendados = []; ln.chamadasSchedule = 0;
  plataforma.nativo = false; plataforma.android = false;
  eventos.length = 0; toast.ultimo = null;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

/* ───────────────────────────── a conta pura ───────────────────────────── */
describe("lib/remedios: horários de N em N horas", () => {
  it("gera da primeira dose e passa da meia-noite", () => {
    expect(gerarHorarios("08:00", 1)).toEqual(["08:00"]);
    expect(gerarHorarios("08:00", 2)).toEqual(["08:00", "20:00"]);
    expect(gerarHorarios("08:00", 3)).toEqual(["08:00", "16:00", "00:00"]);
    expect(gerarHorarios("07:30", 4)).toEqual(["07:30", "13:30", "19:30", "01:30"]);
    expect(gerarHorarios("22:00", 2)).toEqual(["22:00", "10:00"]);
    expect(gerarHorarios("", 3)).toEqual([]);
  });

  it("rótulo: certinho vira '8 em 8 h'; editado vira '3× ao dia'", () => {
    expect(rotuloDosHorarios(["08:00"])).toBe("");
    expect(rotuloDosHorarios(["08:00", "20:00"])).toBe("12 em 12 h");
    expect(rotuloDosHorarios(["08:00", "16:00", "00:00"])).toBe("8 em 8 h");
    expect(rotuloDosHorarios(["07:30", "13:30", "19:30", "01:30"])).toBe("6 em 6 h");
    expect(rotuloDosHorarios(["08:00", "14:00", "20:00"])).toBe("3× ao dia");
  });

  it("montarLinhas: 1 horário = a linha de sempre (sem grupo/ate); 3 horários = 3 linhas do mesmo grupo", () => {
    const uma = montarLinhas({ name: "Ômega 3", quem: "", stock: 30 }, ["08:00"], undefined, 1700000000000);
    expect(uma).toEqual([{ id: "1700000000000", name: "Ômega 3", time: "08:00", stock: 30, dosesPerDay: 1 }]);
    const tres = montarLinhas({ name: "Amoxicilina", quem: "Mãe", stock: 21 }, ["08:00", "16:00", "00:00"], "2026-11-14", 1700000000000);
    expect(tres.map((l) => l.time)).toEqual(["08:00", "16:00", "00:00"]);
    expect(new Set(tres.map((l) => l.grupo)).size).toBe(1);
    expect(tres.every((l) => l.ate === "2026-11-14" && l.quem === "Mãe" && l.stock === 21 && l.dosesPerDay === 1)).toBe(true);
    expect(new Set(tres.map((l) => l.id)).size).toBe(3);
  });

  it("agrupar: linhas do grupo viram UMA, estoque = o menor; linha solta fica sozinha; vale no dia até o `ate`", () => {
    const g = agruparRemedios([
      { id: "a", name: "Amox", time: "08:00", stock: 20, dosesPerDay: 1, grupo: "g1", ate: "2026-11-14" },
      { id: "b", name: "Amox", time: "16:00", stock: 19, dosesPerDay: 1, grupo: "g1", ate: "2026-11-14" },
      { id: "c", name: "Ômega 3", time: "12:30", stock: 18, dosesPerDay: 1 },
    ]);
    expect(g.map((x) => [x.chave, x.itens.length, x.estoque, x.ate])).toEqual([["g:g1", 2, 19, "2026-11-14"], ["i:c", 1, 18, undefined]]);
    expect(remedioValeNoDia({ ate: "2026-11-14" }, "2026-11-14")).toBe(true);
    expect(remedioValeNoDia({ ate: "2026-11-14" }, "2026-11-15")).toBe(false);
    expect(remedioValeNoDia({}, "2099-01-01")).toBe(true);
  });
});

/* ───────────────────────────── o plano dos avisos ───────────────────────────── */
describe("planejarRemedios: 8 em 8, data de fim e o teto", () => {
  const agora = new Date(2026, 10, 7, 7, 0, 0); // 07/11/2026 07:00
  const amox = (ate?: string) => ["08:00", "16:00", "00:00"].map((hora, i) => ({ id: `a${i}`, nome: "Amoxicilina", hora, tomadoHoje: false, ...(ate ? { ate } : {}) }));

  it("3 avisos por dia, um por horário, ids únicos na faixa de saúde", () => {
    const avisos = planejarRemedios(amox(), agora);
    const hoje = avisos.filter((a) => a.quando.getDate() === 7);
    expect(hoje.map((a) => `${a.quando.getHours()}:${a.quando.getMinutes()}`)).toEqual(["8:0", "16:0"]); // a dose das 0h de "hoje" já passou; a próxima é a de amanhã 0h
    expect(avisos.filter((a) => a.quando.getDate() === 8).length).toBe(3);
    expect(avisos.every((a) => a.title === "💊 Hora do Amoxicilina")).toBe(true);
    const ids = avisos.map((a) => a.id!);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id >= BASES_LEMBRETES.saude && id < BASES_LEMBRETES.saude + 10000)).toBe(true);
  });

  it("'até quando' é o último dia: a dose das 0h dele ainda avisa (cai no dia 10), nada depois; o remédio sem fim continua", () => {
    // as linhas como estão gravadas (mesmo grupo); dosesEmVigor acha a dose da noite do último dia
    const gravadas = ["08:00", "16:00", "00:00"].map((time, i) => ({ id: `a${i}`, time, grupo: "g1", ate: "2026-11-09" }));
    const comFimDaDose = dosesEmVigor(gravadas, agora).map((l, i) => ({ ...amox()[i], ate: l.ate }));
    expect(comFimDaDose.map((l) => l.ate)).toEqual(["2026-11-09", "2026-11-09", "2026-11-10"]);
    const avisos = planejarRemedios([...comFimDaDose, { id: "o", nome: "Ômega 3", hora: "08:00", tomadoHoje: false }], agora);
    const ultimoAmox = avisos.filter((a) => a.title.includes("Amoxicilina")).map((a) => a.quando.getTime()).sort((a, b) => b - a)[0];
    expect(new Date(ultimoAmox).getDate()).toBe(10);
    expect(new Date(ultimoAmox).getHours()).toBe(0); // a 3ª dose do dia 9 (00:00 do dia 10)
    const dia10as8 = avisos.find((a) => a.quando.getDate() === 10 && a.quando.getHours() === 8)!;
    expect(dia10as8.title).toBe("💊 Hora do Ômega 3"); // só o que não acabou
    expect(avisos.some((a) => a.quando.getDate() === 17 && a.title === "💊 Hora do Ômega 3")).toBe(true);
  });

  it("tratamento que já acabou não entra no plano (lerDadosDosLembretes)", () => {
    const get = <T,>(k: string, f: T): T => (k === CHAVE
      ? ([{ id: "x", name: "Antigo", time: "08:00", stock: 3, ate: dia(-1) }, { id: "y", name: "Atual", time: "09:00", stock: 3, ate: dia(2) }, { id: "z", name: "Sempre", time: "10:00", stock: 3 }] as unknown as T)
      : f);
    const d = lerDadosDosLembretes(get);
    expect(d.remedios.map((r) => [r.nome, r.ate])).toEqual([["Atual", dia(2)], ["Sempre", undefined]]);
  });

  it("sem teto fixo (o corte é só do iPhone, na rodada): 6 em 6 h cobre os 10 dias, em ordem; 1× ao dia continua com os 11 de sempre", () => {
    const seis = ["06:00", "12:00", "18:00", "00:00"].map((hora, i) => ({ id: `s${i}`, nome: "Prednisona", hora, tomadoHoje: false }));
    const avisos = planejarRemedios(seis, agora);
    expect(avisos.length).toBe(42); // 44 menos as 00:00 e 06:00 de hoje, que já passaram
    for (let i = 1; i < avisos.length; i++) expect(avisos[i].quando.getTime()).toBeGreaterThan(avisos[i - 1].quando.getTime());
    expect(avisos[avisos.length - 1].quando.getDate()).toBe(17);
    expect(planejarRemedios([{ id: "o", nome: "Ômega 3", hora: "08:00", tomadoHoje: false }], agora).length).toBe(11);
  });
});

/* ───────────────────────────── o cadastro e a tabela ───────────────────────────── */
describe("Vitaminas e Remédios: cadastro de 8 em 8 h", () => {
  it("placeholder novo; 1× ao dia grava a linha de sempre (sem grupo, sem ate)", () => {
    const store = criarStore({});
    montar(store);
    const nome = screen.getByPlaceholderText("Novo remédio ou suplemento...");
    expect(screen.queryByTestId("remedio-horarios")).toBeNull(); // 1× ao dia: nada de horários extras
    fireEvent.change(nome, { target: { value: "Ômega 3" } });
    fireEvent.keyDown(nome, { key: "Enter" });
    expect(linhas(store)).toHaveLength(1);
    expect(linhas(store)[0]).toMatchObject({ name: "Ômega 3", time: "08:00", stock: 30, dosesPerDay: 1 });
    expect("grupo" in linhas(store)[0]).toBe(false);
    expect("ate" in linhas(store)[0]).toBe(false);
    expect(screen.getByLabelText("Horário de Ômega 3")).toHaveValue("08:00");
  });

  it("'8 em 8' mostra 08:00 · 16:00 · 00:00 editáveis; mudar a primeira dose gera de novo; salva 3 linhas do mesmo grupo com o 'até'", () => {
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    expect(screen.getByRole("button", { name: "8 em 8" })).toHaveAttribute("aria-pressed", "true");
    const caixa = screen.getByTestId("remedio-horarios");
    expect(within(caixa).getByLabelText("1ª dose")).toHaveValue("08:00");
    expect(within(caixa).getByLabelText("2ª dose")).toHaveValue("16:00");
    expect(within(caixa).getByLabelText("3ª dose")).toHaveValue("00:00");
    expect(caixa.textContent).toContain("8 em 8 h");

    // com 2+ doses o horário do topo some: a 1ª dose é a 1ª da linha "Horários", e mudar ela gera os três de novo
    expect(screen.queryByLabelText("Horário")).toBeNull();
    fireEvent.change(within(caixa).getByLabelText("1ª dose"), { target: { value: "07:00" } });
    expect(within(caixa).getByLabelText("2ª dose")).toHaveValue("15:00");
    // a pessoa ajusta a 3ª à mão → fica
    fireEvent.change(within(caixa).getByLabelText("3ª dose"), { target: { value: "22:00" } });
    expect(caixa.textContent).toContain("3× ao dia");

    fireEvent.change(screen.getByTestId("remedio-qtd"), { target: { value: "21" } });
    fireEvent.change(screen.getByTestId("remedio-ate"), { target: { value: dia(6) } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));

    const l = linhas(store);
    expect(l).toHaveLength(3);
    expect(l.map((x) => x.time)).toEqual(["07:00", "15:00", "22:00"]);
    expect(new Set(l.map((x) => x.grupo)).size).toBe(1);
    expect(l[0].grupo).toBeTruthy();
    expect(l.every((x) => x.name === "Amoxicilina" && x.stock === 21 && x.ate === dia(6) && x.dosesPerDay === 1)).toBe(true);
    // o formulário volta ao começo
    expect(screen.getByRole("button", { name: "1× ao dia" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("remedio-ate")).toHaveValue("");
    expect(eventos.some(([n, d]) => n === "remedio_vezes_cadastro" && d?.vezes === 3 && d?.ate === true)).toBe(true);

    // a tabela: UMA linha, o nome uma vez, três pílulas e o detalhe
    expect(screen.getAllByText("Amoxicilina")).toHaveLength(1);
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe(`3× ao dia · até ${dia(6).slice(8, 10)}/${dia(6).slice(5, 7)}`);
    expect(screen.getByRole("button", { name: "Marcar dose das 07:00 de Amoxicilina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar dose das 15:00 de Amoxicilina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar dose das 22:00 de Amoxicilina" })).toBeInTheDocument();
  });

  it("'12 em 12' às 22:00 gera 22:00 e 10:00; data de fim no passado é ignorada", () => {
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Dipirona" } });
    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "22:00" } });
    fireEvent.click(screen.getByRole("button", { name: "12 em 12" }));
    fireEvent.change(screen.getByTestId("remedio-ate"), { target: { value: dia(-3) } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    expect(linhas(store).map((x) => x.time)).toEqual(["22:00", "10:00"]);
    expect(linhas(store).every((x) => !("ate" in x))).toBe(true);
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe("12 em 12 h");
  });
});

describe("Vitaminas e Remédios: o grupo na tabela", () => {
  const grupo = (ate?: string): Linha[] => ["08:00", "16:00", "00:00"].map((time, i) => ({ id: `a${i}`, name: "Amoxicilina", time, stock: 21, dosesPerDay: 1, grupo: "g1", ...(ate ? { ate } : {}) }));

  it("marcar uma dose grava o id DAQUELA linha e baixa o estoque do grupo inteiro; desmarcar devolve", () => {
    // relógio fixo às 11:00: antes das 07:00 o dia do tratamento ainda é o de ontem (lib/remedios)
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 11, 0));
    const store = criarStore({ [CHAVE]: [...grupo(), { id: "o", name: "Ômega 3", time: "12:30", stock: 18, dosesPerDay: 1 }] });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar dose das 16:00 de Amoxicilina" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": ["a1"] });
    expect(linhas(store).map((x) => x.stock)).toEqual([20, 20, 20, 18]); // o Ômega 3 não mexe
    expect(screen.getByRole("button", { name: "Alterar estoque de Amoxicilina (20)" })).toBeInTheDocument();
    expect(screen.getByTestId("remedio-doses-feitas").textContent).toBe("1/3");
    expect(screen.getByRole("button", { name: "Desmarcar dose das 16:00 de Amoxicilina" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar dose das 16:00 de Amoxicilina" }));
    expect(linhas(store).map((x) => x.stock)).toEqual([21, 21, 21, 18]);
    expect(screen.queryByTestId("remedio-doses-feitas")).toBeNull();
  });

  it("a caixa da linha marca a dose DA HORA (a mais recente que passou); com todas marcadas, risca o nome e a caixa desfaz a que ainda não chegou (a das 00:00), não a das 16:00", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 22:30: a das 00:00 ainda está a mais de 1 h (até 1 h antes ela já é "a da hora" — conserto final 07/11,
    // remedio-dia-da-dose-07-11: "a caixa e a dose que vence em minutos")
    vi.setSystemTime(new Date(2026, 10, 7, 22, 30));
    try {
      const store = criarStore({ [CHAVE]: grupo() });
      montar(store);
      fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (16:00)" }));
      expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": ["a1"] });
      fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (08:00)" }));
      fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (00:00)" }));
      // a das 00:00 marcada às 22:30 é a de daqui a 1h30: grava no dia em que ela acontece (08/11)
      expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": ["a1", "a0"], "2026-11-08": ["a2"] });
      expect(linhas(store).map((x) => x.stock)).toEqual([18, 18, 18]);
      expect(screen.getByText("Amoxicilina").className).toContain("line-through");
      fireEvent.click(screen.getByRole("button", { name: "Desmarcar Amoxicilina" }));
      // crítica de fora 07/11: tirar a das 16:00 fazia o aviso das 00:00 sumir e a caixa pedir a das 16:00 de novo
      expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": ["a1", "a0"], "2026-11-08": [] });
      expect(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (00:00)" })).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it("estoque editado vale pras 3 linhas; linhas que o app antigo desencontrou mostram a menor", () => {
    const desencontradas = grupo().map((l, i) => ({ ...l, stock: [21, 19, 21][i] }));
    const store = criarStore({ [CHAVE]: desencontradas });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Alterar estoque de Amoxicilina (19)" }));
    fireEvent.change(screen.getByLabelText("Estoque de Amoxicilina"), { target: { value: "60" } });
    fireEvent.keyDown(screen.getByLabelText("Estoque de Amoxicilina"), { key: "Enter" });
    expect(linhas(store).map((x) => x.stock)).toEqual([60, 60, 60]);
  });

  it("apagar leva o grupo inteiro e o Desfazer traz as 3 linhas de volta no lugar", () => {
    const lista = [{ id: "v", name: "Vitamina D", time: "08:00", stock: 42, dosesPerDay: 1 }, ...grupo(), { id: "o", name: "Ômega 3", time: "12:30", stock: 18, dosesPerDay: 1 }];
    const store = criarStore({ [CHAVE]: lista });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Apagar Amoxicilina" }));
    expect(linhas(store).map((x) => x.id)).toEqual(["v", "o"]);
    expect(toast.ultimo?.texto).toBe("Amoxicilina apagado");
    act(() => { toast.ultimo?.desfazer?.(); });
    expect(linhas(store)).toEqual(lista);
  });

  it("editar horários na tabela: o lápis abre 3 campos + a data de fim; mudar grava na linha certa e no grupo", () => {
    const store = criarStore({ [CHAVE]: grupo(dia(5)) });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (2ª dose)"), { target: { value: "15:00" } });
    expect(linhas(store).map((x) => x.time)).toEqual(["08:00", "15:00", "00:00"]);
    fireEvent.change(screen.getByLabelText("Até quando de Amoxicilina"), { target: { value: dia(9) } });
    expect(linhas(store).every((x) => x.ate === dia(9))).toBe(true);
    fireEvent.change(screen.getByLabelText("Até quando de Amoxicilina"), { target: { value: "" } });
    expect(linhas(store).every((x) => !("ate" in x))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    expect(screen.queryByTestId("remedio-editar")).toBeNull();
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe("3× ao dia");
  });

  it("tratamento encerrado: 'terminou dd/mm', pílulas e caixa travadas, lixeira livre", () => {
    // dia -2: a dose das 0h do último dia também já passou (a véspera, pela manhã, ainda é dela — remedio-fila-cheia)
    const store = criarStore({ [CHAVE]: grupo(dia(-2)) });
    montar(store);
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe(`8 em 8 h · terminou ${dia(-2).slice(8, 10)}/${dia(-2).slice(5, 7)}`);
    expect(screen.getByRole("button", { name: "Marcar dose das 08:00 de Amoxicilina" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Marcar próxima dose de Amoxicilina/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apagar Amoxicilina" })).toBeEnabled();
  });

  it("conta vazia: cadastra 8 em 8, marca uma dose, FECHA e REABRE — tudo continua igual", () => {
    const store = criarStore({});
    const { unmount } = montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    fireEvent.change(screen.getByTestId("remedio-qtd"), { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar dose das 16:00 de Amoxicilina" }));
    unmount();

    montar(store); // reabriu: lê só o que está gravado
    expect(screen.getAllByText("Amoxicilina")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Desmarcar dose das 16:00 de Amoxicilina" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Marcar dose das 08:00 de Amoxicilina" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Alterar estoque de Amoxicilina (20)" })).toBeInTheDocument();
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe("8 em 8 h");
    expect(linhas(store)).toHaveLength(3);
  });

  it("linha simples com 'até' continua com o horário editável na linha e mostra 'até dd/mm'", () => {
    const store = criarStore({ [CHAVE]: [{ id: "d", name: "Dipirona", time: "09:00", stock: 10, dosesPerDay: 1, ate: dia(3) }] });
    montar(store);
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe(`até ${dia(3).slice(8, 10)}/${dia(3).slice(5, 7)}`);
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Dipirona" }));
    fireEvent.change(screen.getByLabelText("Horário de Dipirona"), { target: { value: "10:00" } });
    expect(linhas(store)[0].time).toBe("10:00");
    fireEvent.click(screen.getByRole("button", { name: "Marcar Dipirona como tomado" }));
    expect(linhas(store)[0].stock).toBe(9);
  });
});

/* ───────────────────────────── Android: alarme exato ───────────────────────────── */
describe("Android com alarme exato negado", () => {
  beforeEach(() => { plataforma.nativo = true; plataforma.android = true; ln.exato = "denied"; });

  it("o aviso aparece no cadastro depois de salvar; 'Liberar' abre a tela do sistema e REFAZ os avisos", async () => {
    const store = criarStore({});
    montar(store);
    expect(screen.queryByTestId("remedio-alarme-exato")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Losartana" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    await waitFor(() => expect(screen.getByTestId("remedio-alarme-exato")).toBeInTheDocument());
    await waitFor(() => expect(ln.agendados.filter((a) => a.id >= BASES_LEMBRETES.saude && a.id < BASES_LEMBRETES.saude + 10000).length).toBeGreaterThan(0));
    const antes = ln.chamadasSchedule;

    fireEvent.click(screen.getByRole("button", { name: "Liberar na hora certa" }));
    await waitFor(() => expect(ln.aberturas).toBe(1));
    await waitFor(() => expect(screen.queryByTestId("remedio-alarme-exato")).toBeNull());
    await waitFor(() => expect(ln.chamadasSchedule).toBeGreaterThan(antes)); // reagendou com o alarme exato
    expect(eventos.some(([n]) => n === "notif_alarme_exato_abrir")).toBe(true);
  });

  it("já com remédio cadastrado, o aviso aparece ao abrir o card; no iPhone e na web, nunca", async () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Losartana", time: "08:00", stock: 30, dosesPerDay: 1 }] });
    montar(store);
    await waitFor(() => expect(screen.getByTestId("remedio-alarme-exato")).toBeInTheDocument());
    cleanup();

    plataforma.android = false; // iPhone
    montar(criarStore({ [CHAVE]: [{ id: "r1", name: "Losartana", time: "08:00", stock: 30, dosesPerDay: 1 }] }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("remedio-alarme-exato")).toBeNull();
  });

  it("central: 'Liberar na hora certa' também refaz os avisos (antes só relia o estado)", async () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Losartana", time: "08:00", stock: 30, dosesPerDay: 1 }] });
    render(<MemoryRouter initialEntries={["/notificacoes"]}><store.Provedor><Notificacoes /></store.Provedor></MemoryRouter>);
    await screen.findByTestId("alarme-exato-negado");
    const antes = ln.chamadasSchedule;
    fireEvent.click(screen.getByRole("button", { name: /Liberar na hora certa/ }));
    await waitFor(() => expect(ln.aberturas).toBe(1));
    await waitFor(() => expect(ln.chamadasSchedule).toBeGreaterThan(antes));
    await waitFor(() => expect(screen.queryByTestId("alarme-exato-negado")).toBeNull());
    expect(ln.agendados.some((a) => a.id >= BASES_LEMBRETES.saude && a.id < BASES_LEMBRETES.saude + 10000)).toBe(true);
  });
});

/* ───────────────────────────── iPhone: o teto de 64 ───────────────────────────── */
describe("iPhone: teto de 64 avisos pendentes", () => {
  const amox = ["08:00", "16:00", "00:00"].map((hora, i) => ({ id: `a${i}`, nome: "Amoxicilina", hora, tomadoHoje: false }));
  const outros = (n: number, base: number) => Array.from({ length: n }, (_, i) => ({
    id: base + i, title: "outro", schedule: { at: new Date(Date.now() + (i + 1) * 3_600_000) },
  }));

  it("com 60 avisos de outros tipos sobram 4 vagas, mas as próximas 48 h do remédio entram sempre; os outros tipos ficam intactos", async () => {
    plataforma.nativo = true; plataforma.android = false;
    ln.agendados = outros(60, BASES_LEMBRETES.rotina);
    const n = await agendarRemedios(amox, { ligado: true });
    const piso = planejarRemedios(amox).filter((a) => a.quando.getTime() - Date.now() <= 48 * 3600e3).length;
    expect(n).toBe(Math.max(TETO_IPHONE - 60, piso));
    const meus = ln.agendados.filter((a) => a.id >= BASES_LEMBRETES.saude && a.id < BASES_LEMBRETES.saude + 10000);
    expect(meus).toHaveLength(n);
    expect(ln.agendados.filter((a) => a.id >= BASES_LEMBRETES.rotina && a.id < BASES_LEMBRETES.rotina + 10000)).toHaveLength(60);
    const plano = planejarRemedios(amox).slice(0, n).map((a) => a.id); // os mais próximos
    expect(meus.map((a) => a.id).sort()).toEqual([...plano].sort());
    expect(eventos.some(([n, d]) => n === "notif_teto_iphone" && d?.tipo === "saude")).toBe(true);
  });

  it("reagendar a MESMA série não conta a si mesma: com 40 de rotina + 30 de remédio já armados, o remédio volta com 24", async () => {
    plataforma.nativo = true; plataforma.android = false;
    ln.agendados = [...outros(40, BASES_LEMBRETES.rotina), ...outros(30, BASES_LEMBRETES.saude)];
    const n = await agendarRemedios(amox, { ligado: true });
    expect(n).toBe(24);
    expect(ln.agendados).toHaveLength(64);
  });

  it("no Android não há corte: os 30 do plano entram mesmo com 60 pendentes", async () => {
    plataforma.nativo = true; plataforma.android = true;
    ln.agendados = outros(60, BASES_LEMBRETES.rotina);
    const n = await agendarRemedios(amox, { ligado: true });
    expect(n).toBe(planejarRemedios(amox).length);
    expect(n).toBeGreaterThan(20);
  });
});
