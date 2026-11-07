/**
 * REMÉDIO DE 8 EM 8: O DIA DE CADA DOSE (07/11, 3ª rodada da crítica).
 *
 *  - `inicio` (a 1ª dose): cadastrado às 10:00 com 1ª dose às 20:00 não avisa às
 *    12:00, e a caixa não oferece a dose das 12:00 do 1º dia; 21 avisos pras 21 doses;
 *  - a dose das 00:00 marcada às 23:50 grava no dia em que acontece (amanhã): à 0h
 *    não há aviso dela, às 00:10 ela continua marcada e o estoque não desce de novo;
 *  - 1º dia, cadastro 07:50 e tomou às 07:55: a caixa marca a das 08:00, não a das 00:00;
 *  - mudar a 1ª dose depois de começado não faz a das 16:00 virar "da noite anterior";
 *  - a tabela: grade fixa das doses (marcar não mexe em nada), lápis fora da grade,
 *    caixa de 36 px.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

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
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { planejarRemedios } from "@/lib/notificacoes";
import { lerDadosDosLembretes } from "@/lib/reagendar";
import {
  agruparRemedios, doseDaHora, dosesDoGrupoAgora, dosesEmVigor, gerarHorarios, inicioAoMudarPrimeira, inicioDoCadastro, montarLinhas,
  tratamentoTerminou, type Remedio,
} from "@/lib/remedios";
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
const montar = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);
const agoraEm = (d: number, h: number, m = 0) => { vi.setSystemTime(new Date(2026, 10, d, h, m)); return new Date(); };
const fmt = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
const planoDe = (store: ReturnType<typeof criarStore>) => planejarRemedios(lerDadosDosLembretes(store.get).remedios);
const linhas = (s: ReturnType<typeof criarStore>) => (s.estado.dados[CHAVE] ?? []) as Remedio[];

/** As 3 linhas de um 8 em 8 cadastrado num momento (como o botão "Adicionar" grava). */
const cadastro = (quando: Date, primeira: string, ate = "2026-11-13") =>
  montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios(primeira, 3), ate, quando.getTime());

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("o início do tratamento (`inicio`)", () => {
  it("cadastrado às 10:00 com 1ª dose 20:00 → 1º aviso às 20:00 e 21 avisos pras 21 doses", () => {
    const agora = agoraEm(7, 10);
    const novas = cadastro(agora, "20:00");
    expect(novas.map((l) => l.time)).toEqual(["20:00", "04:00", "12:00"]);
    expect(novas.every((l) => l.inicio === "2026-11-07T20:00")).toBe(true);
    const store = criarStore({ [CHAVE]: novas });
    const plano = planoDe(store);
    expect(fmt(plano[0].quando)).toBe("07/20:00");
    expect(plano).toHaveLength(21);
    expect(fmt(plano[plano.length - 1].quando)).toBe("14/12:00"); // a 3ª dose do dia 13 do tratamento
  });

  it("às 13:00 do 1º dia a caixa oferece a das 20:00; a das 12:00 de hoje não existe (a pílula é a de amanhã)", () => {
    const novas = cadastro(agoraEm(7, 10), "20:00");
    agoraEm(7, 13);
    const g = agruparRemedios(novas)[0];
    expect(dosesDoGrupoAgora(g).map((d) => `${d.time}@${d.dia}`)).toEqual(["20:00@2026-11-07", "04:00@2026-11-08", "12:00@2026-11-08"]);
    const store = criarStore({ [CHAVE]: novas });
    montar(store);
    expect(screen.getByTestId(`dose-${novas[0].id}`)).toHaveAttribute("data-da-vez", "true");
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (20:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": [novas[0].id] });
  });

  it("o início do cadastro é a 1ª dose mais perto do relógio", () => {
    expect(inicioDoCadastro("20:00", new Date(2026, 10, 7, 10))).toBe("2026-11-07T20:00");
    expect(inicioDoCadastro("08:00", new Date(2026, 10, 7, 10))).toBe("2026-11-07T08:00"); // já começou hoje
    expect(inicioDoCadastro("00:30", new Date(2026, 10, 7, 23))).toBe("2026-11-08T00:30"); // a de daqui a pouco
    expect(montarLinhas({ name: "Vit D", stock: 9 }, ["08:00"], undefined, 1)[0]).not.toHaveProperty("inicio"); // 1 horário: a linha de sempre
  });
});

describe("a dose das 00:00 marcada antes da meia-noite", () => {
  it("marcou a das 00:00 às 23:50 → sem aviso à 0h; às 00:10 continua marcada e o estoque não desce de novo", () => {
    const novas = cadastro(agoraEm(7, 7, 50), "08:00");
    const [d08, d16, d00] = novas.map((l) => l.id);
    agoraEm(7, 23, 50);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 19 })), [LOG]: { "2026-11-07": [d08, d16] } });
    const { unmount } = montar(store);
    expect(screen.getByTestId(`dose-${d00}`)).toHaveAttribute("data-da-vez", "true");
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (00:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": [d08, d16], "2026-11-08": [d00] });
    expect(linhas(store).map((l) => l.stock)).toEqual([18, 18, 18]);
    // o aviso das 00:00 de 08/11 sai da fila: o próximo é o das 08:00
    expect(fmt(planoDe(store)[0].quando)).toBe("08/08:00");
    unmount();

    agoraEm(8, 0, 10); // fechou e reabriu depois da meia-noite
    montar(store);
    expect(screen.getByTestId(`dose-${d00}`)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(`dose-${d08}`)).toHaveAttribute("aria-pressed", "true"); // a de ontem 08:00, ainda do mesmo dia do tratamento
    expect(screen.getByRole("button", { name: "Desmarcar Amoxicilina" })).toBeInTheDocument(); // nada pedindo a das 00:00 de novo
    expect(linhas(store).map((l) => l.stock)).toEqual([18, 18, 18]);
    expect(fmt(planoDe(store)[0].quando)).toBe("08/08:00");

    agoraEm(8, 7, 30); // 1 h antes da 08:00 o dia do tratamento vira: 08:00 e 16:00 de hoje, 00:00 desta noite
    cleanup();
    montar(store);
    expect(screen.getByTestId(`dose-${d08}`)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(`dose-${d08}`)).toHaveAttribute("data-da-vez", "true");
    expect(screen.getByTestId(`dose-${d00}`)).toHaveAttribute("aria-pressed", "false");
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": [d08, d16], "2026-11-08": [d00] }); // o registro da noite segue lá
  });
});

describe("1º dia: tomou um pouco antes da 1ª dose", () => {
  it("cadastro 07:50, 8 em 8 a partir das 08:00: às 07:55 a caixa marca a das 08:00; a das 00:00 não fica marcada", () => {
    const novas = cadastro(agoraEm(7, 7, 50), "08:00");
    const [d08, , d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas });
    const { unmount } = montar(store);
    expect(screen.getByTestId(`dose-${d08}`)).toHaveAttribute("data-da-vez", "true");
    expect(screen.getByTestId(`dose-${d00}`)).not.toHaveAttribute("data-da-vez");
    agoraEm(7, 7, 55);
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (08:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": [d08] });
    // o aviso das 08:00 sai (já tomou); o das 00:00 (a da noite) continua
    const plano = planoDe(store).map((a) => fmt(a.quando));
    expect(plano.slice(0, 2)).toEqual(["07/16:00", "08/00:00"]);
    unmount();

    agoraEm(7, 23, 40);
    montar(store);
    expect(screen.getByTestId(`dose-${d00}`)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(`dose-${d08}`)).toHaveAttribute("aria-pressed", "true");
  });

  it("doseDaHora pelo momento de verdade: às 07:55 do 1º dia, entre 08:00, 16:00 e 00:00 da noite, é a das 08:00", () => {
    const g = agruparRemedios(cadastro(agoraEm(7, 7, 50), "08:00"))[0];
    const agora = agoraEm(7, 7, 55);
    expect(doseDaHora(dosesDoGrupoAgora(g, agora), agora)?.time).toBe("08:00");
  });
});

describe("editar a 1ª dose", () => {
  it("depois de começado, 08:00 → 17:00 não faz a das 16:00 virar 'da noite anterior' nem avisar além do fim", () => {
    const novas = cadastro(agoraEm(7, 7, 50), "08:00");
    agoraEm(9, 10);
    expect(inicioAoMudarPrimeira(novas[0].inicio, "17:00")).toBeUndefined(); // já começou: o início fica
    const editadas = novas.map((l, i) => (i === 0 ? { ...l, time: "17:00" } : l));
    expect(dosesEmVigor(editadas).map((l) => `${l.time}:${l.ate}`)).toEqual(["17:00:2026-11-13", "16:00:2026-11-13", "00:00:2026-11-14"]);
    const plano = planejarRemedios(lerDadosDosLembretes(criarStore({ [CHAVE]: editadas }).get).remedios);
    expect(fmt(plano[plano.length - 1].quando)).toBe("14/00:00");
  });

  it("antes de começar, o início vai junto (mesmo dia, hora nova) — na tela também", () => {
    const novas = cadastro(agoraEm(7, 10), "20:00");
    expect(inicioAoMudarPrimeira(novas[0].inicio, "19:00")).toBe("2026-11-07T19:00");
    const store = criarStore({ [CHAVE]: novas });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "19:00" } });
    expect(linhas(store).map((l) => [l.time, l.inicio])).toEqual([["19:00", "2026-11-07T19:00"], ["04:00", "2026-11-07T19:00"], ["12:00", "2026-11-07T19:00"]]);
    // mudar outra dose não mexe no início
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (2ª dose)"), { target: { value: "03:00" } });
    expect(linhas(store).every((l) => l.inicio === "2026-11-07T19:00")).toBe(true);
  });
});

describe("a tabela: nada se mexe ao marcar", () => {
  it("6 em 6: grade de 2 colunas, mesma classe antes e depois de marcar, lápis fora da grade, caixa de 36 px", () => {
    agoraEm(7, 14, 20);
    const novas = montarLinhas({ name: "Prednisona", stock: 30 }, gerarHorarios("08:00", 4), undefined, new Date(2026, 10, 7, 7).getTime());
    const store = criarStore({ [CHAVE]: novas });
    montar(store);
    const chave = `g:${novas[0].grupo}`;
    const grade = screen.getByTestId(`remedio-doses-${chave}`);
    expect(grade.className).toContain("min-[380px]:grid-cols-2");
    expect(within(grade).getAllByRole("button")).toHaveLength(4); // só as doses: o lápis mora na linha do nome
    expect(within(grade).queryByRole("button", { name: /Editar horários/ })).toBeNull();
    const pilula = screen.getByTestId(`dose-${novas[0].id}`);
    const largura = (el: HTMLElement) => el.className.split(" ").filter((c) => /^(w-|min-w-|px-|h-)/.test(c)).sort().join(" ");
    const antes = largura(pilula);
    expect(antes).toContain("w-[3.25rem]");
    fireEvent.click(pilula);
    expect(screen.getByTestId(`dose-${novas[0].id}`)).toHaveAttribute("aria-pressed", "true");
    expect(largura(screen.getByTestId(`dose-${novas[0].id}`))).toBe(antes);
    expect(screen.getByTestId(`dose-${novas[0].id}`).textContent).toBe("08:00"); // o ✓ é um selinho no canto, sem texto a mais
    const caixa = screen.getByTestId(`remedio-caixa-${chave}`);
    expect(caixa.className).toContain("w-9");
    expect(caixa.className).toContain("h-9");
  });

  it("tratamento encerrado continua travado", () => {
    agoraEm(20, 10);
    const g = agruparRemedios(cadastro(new Date(2026, 10, 7, 7, 50), "08:00"))[0];
    expect(tratamentoTerminou(g)).toBe(true);
    expect(dosesDoGrupoAgora(g)).toEqual([]);
  });
});
