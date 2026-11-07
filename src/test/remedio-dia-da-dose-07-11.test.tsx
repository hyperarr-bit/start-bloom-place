/**
 * REMÉDIO DE 8 EM 8: O DIA DE CADA DOSE (07/11, 3ª rodada da crítica).
 *
 *  - `inicio` (a 1ª dose): cadastrado às 10:00 com 1ª dose às 20:00 não avisa às
 *    12:00, e a caixa não oferece a dose das 12:00 do 1º dia; 21 avisos pras 21 doses;
 *  - a dose das 00:00 marcada às 23:50 grava no dia em que acontece (amanhã): à 0h
 *    não há aviso dela, às 00:10 ela continua marcada e o estoque não desce de novo;
 *  - 1º dia, cadastro 07:50 e tomou às 07:55: a caixa marca a das 08:00, não a das 00:00;
 *  - mudar a 1ª dose ajusta as outras e o `inicio` (retomada): adiantar 08:00 → 07:00
 *    depois de começado não faz a das 07:00 virar "dose da noite" (o aviso da manhã
 *    seguia sumindo todo dia); o dia do tratamento vira na hora ATUAL da 1ª linha;
 *  - cadastro às 20:30 de um 8 em 8 desde as 08:00 começa hoje (a das 00:00 tem aviso);
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
// o cadastro de várias doses está atrás da chave REMEDIO_VEZES (desligada no site até a build nova
// sair; ver remedio-chave-site-07-11.test.tsx): aqui ela fica LIGADA, como no app e no site depois
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

/** Abre a edição do grupo na tela e muda a 1ª dose (como a pessoa faz no lápis). */
const mudarPrimeiraNaTela = (store: ReturnType<typeof criarStore>, hora: string) => {
  const { unmount } = montar(store);
  fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
  fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: hora } });
  unmount();
};

describe("editar a 1ª dose", () => {
  it("08:00 vira 07:00 depois de começar: às 07:20 do dia seguinte a das 07:00 é de hoje e o aviso de amanhã 07:00 continua", () => {
    const novas = cadastro(agoraEm(5, 7, 50), "08:00");
    const [d1] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas });
    agoraEm(7, 10);
    mudarPrimeiraNaTela(store, "07:00");
    // a 1ª ajusta as outras (como no cadastro) e o início só troca a hora
    expect(linhas(store).map((l) => [l.time, l.inicio])).toEqual([["07:00", "2026-11-05T07:00"], ["15:00", "2026-11-05T07:00"], ["23:00", "2026-11-05T07:00"]]);

    agoraEm(8, 7, 20); // fechou e reabriu
    const g = agruparRemedios(linhas(store))[0];
    expect(dosesDoGrupoAgora(g).map((d) => `${d.time}@${d.dia}`)).toEqual(["07:00@2026-11-08", "15:00@2026-11-08", "23:00@2026-11-08"]);
    montar(store);
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("data-da-vez", "true");
    expect(screen.getByTestId("remedio-detalhe").textContent).toBe("8 em 8 h · até 13/11");
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (07:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-08": [d1] });
    const plano = planoDe(store).map((a) => fmt(a.quando));
    expect(plano.slice(0, 3)).toEqual(["08/15:00", "08/23:00", "09/07:00"]);
    expect(plano[plano.length - 1]).toBe("13/23:00"); // nada depois do fim
  });

  it("o app antigo mudou só a 1ª linha (08:00 → 07:00): o dia do tratamento vira na hora ATUAL da 1ª linha", () => {
    const novas = cadastro(agoraEm(5, 7, 50), "08:00");
    const editadas = novas.map((l, i) => (i === 0 ? { ...l, time: "07:00" } : l)); // o `inicio` ficou com 08:00
    const agora = agoraEm(8, 7, 20);
    const g = agruparRemedios(editadas)[0];
    expect(dosesDoGrupoAgora(g, agora).map((d) => `${d.time}@${d.dia}`)).toEqual(["07:00@2026-11-08", "16:00@2026-11-08", "00:00@2026-11-09"]);
    expect(doseDaHora(dosesDoGrupoAgora(g, agora), agora)?.time).toBe("07:00");
  });

  it("no 1º dia, editou às 15:00 pra 07:00; reaberto em 08/11 às 07:05 a caixa marca a das 07:00 de 08/11, e o estoque desce uma vez", () => {
    const novas = cadastro(agoraEm(7, 10), "08:00");
    const [d1, d2] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [d1] } });
    agoraEm(7, 15);
    mudarPrimeiraNaTela(store, "07:00");
    expect(linhas(store).map((l) => [l.time, l.inicio])).toEqual([["07:00", "2026-11-07T07:00"], ["15:00", "2026-11-07T07:00"], ["23:00", "2026-11-07T07:00"]]);
    agoraEm(8, 7, 5);
    montar(store);
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("data-da-vez", "true");
    expect(screen.getByTestId(`dose-${d2}`)).not.toHaveAttribute("data-da-vez");
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (07:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-07": [d1], "2026-11-08": [d1] });
    expect(linhas(store).map((l) => l.stock)).toEqual([20, 20, 20]);
    const plano = planoDe(store).map((a) => fmt(a.quando));
    expect(plano[plano.length - 1]).toBe("13/23:00");
    expect(plano.some((x) => x.startsWith("14/"))).toBe(false);
  });

  it("08:00 → 17:00 depois de começado: as outras vão junto (17, 01, 09) e o fim continua no dia 13 (a da noite dele)", () => {
    const novas = cadastro(agoraEm(7, 7, 50), "08:00");
    const store = criarStore({ [CHAVE]: novas });
    agoraEm(9, 10);
    expect(inicioAoMudarPrimeira(novas[0].inicio, "17:00")).toBe("2026-11-07T17:00"); // já começou: a data fica
    mudarPrimeiraNaTela(store, "17:00");
    expect(linhas(store).map((l) => l.time)).toEqual(["17:00", "01:00", "09:00"]);
    expect(dosesEmVigor(linhas(store)).map((l) => `${l.time}:${l.ate}`)).toEqual(["17:00:2026-11-13", "01:00:2026-11-14", "09:00:2026-11-14"]);
    const plano = planoDe(store);
    expect(fmt(plano[plano.length - 1].quando)).toBe("14/09:00");
  });

  it("antes de começar, o início vai junto (hora nova) — na tela também; mudar outra dose não mexe no início", () => {
    const novas = cadastro(agoraEm(7, 10), "20:00");
    expect(inicioAoMudarPrimeira(novas[0].inicio, "19:00")).toBe("2026-11-07T19:00");
    const store = criarStore({ [CHAVE]: novas });
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "19:00" } });
    expect(linhas(store).map((l) => [l.time, l.inicio])).toEqual([["19:00", "2026-11-07T19:00"], ["03:00", "2026-11-07T19:00"], ["11:00", "2026-11-07T19:00"]]);
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (2ª dose)"), { target: { value: "02:00" } });
    expect(linhas(store).map((l) => l.time)).toEqual(["19:00", "02:00", "11:00"]);
    expect(linhas(store).every((l) => l.inicio === "2026-11-07T19:00")).toBe(true);
  });

  it("dose da noite colada na 1ª (07:30 e 08:00): às 07:20 a das 07:30 ainda é a desta noite, não a de amanhã", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, ["08:00", "16:00", "07:30"], "2026-11-13", new Date(2026, 10, 7, 7, 50).getTime());
    const agora = agoraEm(8, 7, 20);
    const g = agruparRemedios(novas)[0];
    expect(dosesDoGrupoAgora(g, agora).map((d) => `${d.time}@${d.dia}`)).toEqual(["08:00@2026-11-07", "16:00@2026-11-07", "07:30@2026-11-08"]);
    expect(doseDaHora(dosesDoGrupoAgora(g, agora).filter((d) => d.time === "07:30"), agora)?.dia).toBe("2026-11-08");
    expect(dosesDoGrupoAgora(g, agoraEm(8, 7, 50)).map((d) => d.dia)).toEqual(["2026-11-08", "2026-11-08", "2026-11-09"]);
  });
});

describe("cadastro à noite", () => {
  it("20:30, 8 em 8 desde as 08:00: começa hoje — a das 00:00 desta noite tem aviso e é a da vez às 23:58", () => {
    const agora = agoraEm(7, 20, 30);
    const novas = montarLinhas({ name: "Cefalexina", stock: 12 }, gerarHorarios("08:00", 3), "2026-11-09", agora.getTime());
    expect(novas[0].inicio).toBe("2026-11-07T08:00");
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [novas[0].id, novas[1].id] } }); // já tinha tomado as de hoje
    expect(fmt(planoDe(store)[0].quando)).toBe("08/00:00");
    agoraEm(7, 23, 58);
    montar(store);
    expect(screen.getByTestId(`dose-${novas[2].id}`)).toHaveAttribute("data-da-vez", "true");
  });

  it("23:00 com 1ª dose 00:30: continua sendo a de daqui a pouco (amanhã)", () => {
    expect(inicioDoCadastro("00:30", new Date(2026, 10, 7, 23), gerarHorarios("00:30", 3))).toBe("2026-11-08T00:30");
    expect(inicioDoCadastro("20:00", new Date(2026, 10, 7, 10), gerarHorarios("20:00", 3))).toBe("2026-11-07T20:00");
  });

  it("no site, o formulário avisa que o celular precisa do app novo (só com várias doses ou data de fim)", () => {
    montar(criarStore({}));
    expect(screen.queryByTestId("remedio-aviso-app")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    expect(screen.getByTestId("remedio-aviso-app").textContent).toContain("atualize o app");
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
    expect(antes).toContain("w-12"); // 48 px abaixo de 380 px
    expect(pilula.className).toContain("min-[380px]:w-[3.25rem]");
    fireEvent.click(pilula);
    expect(screen.getByTestId(`dose-${novas[0].id}`)).toHaveAttribute("aria-pressed", "true");
    expect(largura(screen.getByTestId(`dose-${novas[0].id}`))).toBe(antes);
    expect(screen.getByTestId(`dose-${novas[0].id}`).textContent).toBe("08:00"); // o ✓ é um selinho no canto, sem texto a mais
    // marcada: hora em verde escuro sobre verde claro (branco sobre verde não se lia no escuro)
    expect(screen.getByTestId(`dose-${novas[0].id}`).className).not.toContain("text-white");
    expect(screen.getByTestId(`dose-${novas[0].id}`).className).toContain("dark:text-emerald-300");
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

/* 4ª rodada da crítica (07/11): mudar a hora refaz as doses, e a marca de "tomado" tem que ir
   junto — senão o que foi tomado ontem à noite (gravado hoje) passa a valer pra outra dose de hoje,
   e o aviso dela some. */
describe("mudar a hora com o registro cheio: a marca vai junto com a dose", () => {
  it("tomou 00:00 e 08:00, mudou pra 07:00 às 15:00 → a das 23:00 de hoje NÃO está marcada e o aviso das 23:00 existe", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [d1, d2, d3] = novas.map((l) => l.id);
    const log = { "2026-11-05": [d1, d2], "2026-11-06": [d3, d1, d2], "2026-11-07": [d3, d1] }; // quem toma tudo
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 14 })), [LOG]: log });
    agoraEm(7, 15);
    mudarPrimeiraNaTela(store, "07:00");
    expect(linhas(store).map((l) => l.time)).toEqual(["07:00", "15:00", "23:00"]);
    // a das 07:00 (a de 08:00 de hoje, tomada) segue marcada; a das 00:00 de ontem à noite não vira a das 23:00
    expect((store.estado.dados[LOG] as Record<string, string[]>)["2026-11-07"]).toEqual([d1]);
    expect(linhas(store).map((l) => l.stock)).toEqual([14, 14, 14]); // só a marca muda de lugar
    for (const [h, m] of [[15, 10], [22, 30]]) {
      cleanup();
      agoraEm(7, h, m);
      montar(store);
      expect(screen.getByTestId(`dose-${d3}`)).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("aria-pressed", "true");
      expect(lerDadosDosLembretes(store.get).remedios.filter((r) => r.tomadoHoje).map((r) => r.hora)).toEqual(["07:00"]);
      expect(planoDe(store).map((a) => fmt(a.quando))).toContain("07/23:00");
    }
  });

  it("1º dia: tomou a das 08:00 e às 15:00 atrasou pra 20:00 → às 19:55 a das 20:00 não está marcada e tem aviso", () => {
    const novas = cadastro(agoraEm(7, 7, 50), "08:00");
    const [d1] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 20 })), [LOG]: { "2026-11-07": [d1] } });
    agoraEm(7, 15);
    mudarPrimeiraNaTela(store, "20:00");
    expect(linhas(store).map((l) => l.time)).toEqual(["20:00", "04:00", "12:00"]);
    expect((store.estado.dados[LOG] as Record<string, string[]>)["2026-11-07"] ?? []).toEqual([]);
    expect(linhas(store).map((l) => l.stock)).toEqual([20, 20, 20]);
    agoraEm(7, 19, 55);
    montar(store);
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("data-da-vez", "true");
    expect(fmt(planoDe(store)[0].quando)).toBe("07/20:00");
  });

  it("tomou a das 08:00 um pouco antes (07:50) e às 07:55 mudou pra 08:30 → continua marcada (é a mesma dose)", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [d1] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [d1] } });
    agoraEm(7, 7, 55);
    mudarPrimeiraNaTela(store, "08:30");
    expect((store.estado.dados[LOG] as Record<string, string[]>)["2026-11-07"]).toEqual([d1]);
  });

  it("a das 00:00 marcada às 23:50 e a 1ª mudada pra 07:00 às 23:55 → a marca vai pra das 23:00 de hoje (sai de amanhã)", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [d1, d2, d3] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [d1, d2], "2026-11-08": [d3] } });
    agoraEm(7, 23, 55);
    mudarPrimeiraNaTela(store, "07:00");
    const log = store.estado.dados[LOG] as Record<string, string[]>;
    expect(log["2026-11-07"]).toEqual([d1, d2, d3]);
    expect(log["2026-11-08"] ?? []).toEqual([]);
  });

  it("estoque zerado: a marca sem baixa vai junto, e desmarcar depois não cria comprimido", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [, , d3] = novas.map((l) => l.id);
    const store = criarStore({
      [CHAVE]: novas.map((l) => ({ ...l, stock: 0 })),
      [LOG]: { "2026-11-07": [novas[0].id, novas[1].id], "2026-11-08": [d3] },
      "core-saude-supplement-sem-baixa": { dia: "2026-11-08", ids: [d3] },
    });
    agoraEm(7, 23, 55);
    mudarPrimeiraNaTela(store, "07:00");
    expect(store.estado.dados["core-saude-supplement-sem-baixa"]).toEqual({ dia: "2026-11-07", ids: [d3] });
    montar(store);
    fireEvent.click(screen.getByTestId(`dose-${d3}`));
    expect(linhas(store).map((l) => l.stock)).toEqual([0, 0, 0]);
  });
});

/* 4ª rodada da crítica (07/11): o começo do tratamento aparece no cadastro, numa linha curta da
   fileira "Horários" — "Começa hoje 08:00" / "Começa amanhã 08:00" — e um toque troca o dia. */
describe("cadastro: 'Começa hoje/amanhã'", () => {
  const cadastrarNaTela = (store: ReturnType<typeof criarStore>, vezes: string, primeira?: string) => {
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: vezes }));
    if (primeira) fireEvent.change(within(screen.getByTestId("remedio-horarios")).getByLabelText("1ª dose"), { target: { value: primeira } });
  };

  it("a 1ª dose depois do relógio começa hoje, nunca ontem (06:00 com 20:00; 09:00 com 22:00)", () => {
    expect(inicioDoCadastro("20:00", new Date(2026, 10, 7, 6), gerarHorarios("20:00", 2))).toBe("2026-11-07T20:00");
    expect(inicioDoCadastro("22:00", new Date(2026, 10, 7, 9), gerarHorarios("22:00", 3))).toBe("2026-11-07T22:00");
  });

  it("23:30, 8 em 8 desde 08:00: mostra 'Começa hoje 08:00'; um toque vira amanhã, e não há aviso à meia-noite", () => {
    agoraEm(7, 23, 30);
    const store = criarStore({});
    cadastrarNaTela(store, "8 em 8");
    const linha = screen.getByTestId("remedio-comeca");
    expect(linha.textContent).toBe("Começa hoje 08:00");
    expect(within(screen.getByTestId("remedio-horarios")).getByTestId("remedio-comeca")).toBe(linha); // na fileira Horários
    fireEvent.click(linha);
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa amanhã 08:00");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    expect(linhas(store).map((l) => l.inicio)).toEqual(["2026-11-08T08:00", "2026-11-08T08:00", "2026-11-08T08:00"]);
    expect(fmt(planoDe(store)[0].quando)).toBe("08/08:00");
  });

  it("20:30, 8 em 8 desde 08:00: continua 'hoje' sem tocar (a das 00:00 desta noite tem aviso)", () => {
    agoraEm(7, 20, 30);
    const store = criarStore({});
    cadastrarNaTela(store, "8 em 8");
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa hoje 08:00");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    expect(linhas(store)[0].inicio).toBe("2026-11-07T08:00");
    expect(fmt(planoDe(store)[0].quando)).toBe("08/00:00");
  });

  it("06:00, 12 em 12 com 1ª dose 20:00: sugere 'hoje 20:00' — a das 08:00 de hoje não aparece como devida", () => {
    agoraEm(7, 6);
    const store = criarStore({});
    cadastrarNaTela(store, "12 em 12", "20:00");
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa hoje 20:00");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    expect(linhas(store)[0].inicio).toBe("2026-11-07T20:00");
    const g = agruparRemedios(linhas(store))[0];
    expect(dosesDoGrupoAgora(g).map((d) => `${d.time}@${d.dia}`)).toEqual(["20:00@2026-11-07", "08:00@2026-11-08"]);
    expect(fmt(planoDe(store)[0].quando)).toBe("07/20:00");
  });

  it("1× ao dia não mostra a linha (a linha de sempre, sem início)", () => {
    agoraEm(7, 10);
    montar(criarStore({}));
    expect(screen.queryByTestId("remedio-comeca")).toBeNull();
  });
});

/* Conserto final da crítica (07/11): a troca de hora feita ANTES da dose da manhã — quando o dia do
   tratamento vira por causa da troca — levava a marca de ontem pra dose de hoje (a pessoa pulava uma
   dose de antibiótico) ou apagava marcas verdadeiras de ontem. A marca agora vai da MESMA ocorrência
   (o mesmo dia do tratamento) com as horas velhas pra ela com as horas novas. */
describe("mudar a hora antes da dose da manhã (o dia do tratamento vira com a troca)", () => {
  const ordenado = (v: unknown) => [...((v as string[] | undefined) ?? [])].sort();
  const logDe = (store: ReturnType<typeof criarStore>) => store.estado.dados[LOG] as Record<string, string[]>;
  const quemTomaTudo = (ids: string[]) => {
    const [d1, d2, d3] = ids;
    return { "2026-11-05": [d1, d2], "2026-11-06": [d3, d1, d2], "2026-11-07": [d3] };
  };

  it("(B) às 06:50, 08:00 → 07:00: a das 07:00 de hoje NÃO está marcada, tem aviso, e ontem continua completo", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [d1, d2, d3] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 14 })), [LOG]: quemTomaTudo([d1, d2, d3]) });
    agoraEm(7, 6, 50);
    mudarPrimeiraNaTela(store, "07:00");
    expect(linhas(store).map((l) => l.time)).toEqual(["07:00", "15:00", "23:00"]);
    expect(ordenado(logDe(store)["2026-11-06"])).toEqual([d1, d2, d3].sort());
    expect(logDe(store)["2026-11-07"] ?? []).toEqual([]);
    expect(linhas(store).map((l) => l.stock)).toEqual([14, 14, 14]);
    expect(planoDe(store).map((a) => fmt(a.quando)).slice(0, 2)).toEqual(["07/07:00", "07/15:00"]);
    agoraEm(7, 6, 59);
    montar(store);
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("data-da-vez", "true");
  });

  it("(D) às 06:30, 08:00 → 06:00: a das 06:00 de hoje (que já passou) aparece por tomar, não tomada", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [d1, d2, d3] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: quemTomaTudo([d1, d2, d3]) });
    agoraEm(7, 6, 30);
    mudarPrimeiraNaTela(store, "06:00");
    expect(ordenado(logDe(store)["2026-11-06"])).toEqual([d1, d2, d3].sort());
    expect(logDe(store)["2026-11-07"] ?? []).toEqual([]);
    montar(store);
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (06:00)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    expect(screen.queryByTestId("remedio-editar-comeca")).toBeNull(); // já começou: sem "começa"
  });

  it("(C) às 07:30, 08:00 → 12:00: as marcas de 06/11 e 07/11 continuam; nenhuma dose que já passou fica 'por tomar'", () => {
    const novas = cadastro(agoraEm(5, 10), "08:00");
    const [d1, d2, d3] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: quemTomaTudo([d1, d2, d3]) });
    agoraEm(7, 7, 30);
    mudarPrimeiraNaTela(store, "12:00");
    expect(linhas(store).map((l) => l.time)).toEqual(["12:00", "20:00", "04:00"]);
    expect(ordenado(logDe(store)["2026-11-06"])).toEqual([d1, d2, d3].sort());
    expect(logDe(store)["2026-11-07"]).toEqual([d3]);
    agoraEm(7, 7, 35);
    montar(store);
    for (const id of [d1, d2, d3]) expect(screen.getByTestId(`dose-${id}`)).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Marcar próxima dose/ })).toBeNull();
    // o próximo aviso é o da dose de hoje com a hora nova
    expect(fmt(planoDe(store)[0].quando)).toBe("07/12:00");
  });

  it("(E) 12 em 12, às 06:40, 08:00 → 07:00: ontem não fica vazio, e a das 07:00 de hoje tem aviso e não está marcada", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("08:00", 2), "2026-11-13", new Date(2026, 10, 5, 10).getTime());
    const [d1, d2] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-05": [d1, d2], "2026-11-06": [d1, d2] } });
    agoraEm(7, 6, 40);
    mudarPrimeiraNaTela(store, "07:00");
    expect(logDe(store)["2026-11-06"]).toEqual([d1, d2]);
    expect(logDe(store)["2026-11-07"] ?? []).toEqual([]);
    expect(fmt(planoDe(store)[0].quando)).toBe("07/07:00");
    montar(store);
    expect(screen.getByTestId(`dose-${d1}`)).toHaveAttribute("aria-pressed", "false");
  });
});

/* Conserto final da crítica (07/11): "Começa amanhã" escolhido no cadastro não pode se perder quando a
   pessoa acerta o horário da 1ª dose antes do tratamento começar. */
describe("'Começa amanhã' e depois mudar a 1ª dose", () => {
  it("amanhã 08:00 → 09:00 às 21:35 continua amanhã (09:00); 00:30 → 23:30 às 23:00 ainda começa hoje", () => {
    expect(inicioAoMudarPrimeira("2026-11-08T08:00", "09:00", new Date(2026, 10, 7, 21, 35), gerarHorarios("09:00", 3))).toBe("2026-11-08T09:00");
    expect(inicioAoMudarPrimeira("2026-11-08T08:00", "07:00", new Date(2026, 10, 7, 21, 35), gerarHorarios("07:00", 3))).toBe("2026-11-08T07:00");
    expect(inicioAoMudarPrimeira("2026-11-08T00:30", "23:30", new Date(2026, 10, 7, 23), gerarHorarios("23:30", 3))).toBe("2026-11-07T23:30");
    // a ocorrência mais perto do início antigo já passou: aí vale o cadastro de agora
    expect(inicioAoMudarPrimeira("2026-11-07T20:00", "09:00", new Date(2026, 10, 7, 10), gerarHorarios("09:00", 3))).toBe("2026-11-07T09:00");
  });

  it("na tela: cadastrou às 21:30 com 'Começa amanhã 08:00' e às 21:35 mudou pra 09:00 → sem aviso de madrugada, 1º aviso amanhã 09:00", () => {
    agoraEm(7, 21, 30);
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    fireEvent.click(screen.getByTestId("remedio-comeca"));
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa amanhã 08:00");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    cleanup();
    agoraEm(7, 21, 35);
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    expect(screen.getByTestId("remedio-editar-comeca").textContent).toBe(" · começa amanhã 08:00"); // a fileira mostra o começo
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "09:00" } });
    expect(screen.getByTestId("remedio-editar-comeca").textContent).toBe(" · começa amanhã 09:00");
    cleanup();
    expect(linhas(store).map((l) => [l.time, l.inicio])).toEqual([["09:00", "2026-11-08T09:00"], ["17:00", "2026-11-08T09:00"], ["01:00", "2026-11-08T09:00"]]);
    expect(planoDe(store).map((a) => fmt(a.quando)).slice(0, 3)).toEqual(["08/09:00", "08/17:00", "09/01:00"]);
    agoraEm(7, 23);
    montar(store);
    expect(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (09:00)" })).toBeInTheDocument();
  });
});

/* Conserto final da crítica (07/11): a caixa marca a dose que vence em minutos (até 1 h antes,
   o mesmo "tomar um pouco antes" do dia do tratamento), não a atrasada mais antiga. */
describe("a caixa e a dose que vence em minutos", () => {
  it("23:55 com a das 16:00 em aberto → a das 00:00; 21:31 com a das 21:00 em aberto → continua a das 21:00", () => {
    const g = agruparRemedios(cadastro(agoraEm(7, 7, 50), "08:00"))[0];
    const agora = agoraEm(7, 23, 55);
    const semA08 = dosesDoGrupoAgora(g, agora).filter((d) => d.time !== "08:00");
    expect(doseDaHora(semA08, agora)?.time).toBe("00:00");
    const g21 = agruparRemedios(cadastro(agoraEm(7, 20, 50), "21:00"))[0];
    const as2131 = agoraEm(7, 21, 31);
    expect(doseDaHora(dosesDoGrupoAgora(g21, as2131), as2131)?.time).toBe("21:00");
  });

  it("na tela: cadastrado às 21:30 com o 08:00 do campo; às 23:55 a caixa marca a das 00:00 e o aviso das 00:00 sai", () => {
    const novas = cadastro(agoraEm(7, 21, 30), "08:00");
    const [, , d3] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas });
    agoraEm(7, 23, 55);
    montar(store);
    expect(screen.getByTestId(`dose-${d3}`)).toHaveAttribute("data-da-vez", "true");
    fireEvent.click(screen.getByRole("button", { name: "Marcar próxima dose de Amoxicilina (00:00)" }));
    expect(store.estado.dados[LOG]).toEqual({ "2026-11-08": [d3] });
    expect(planoDe(store).map((a) => fmt(a.quando))).not.toContain("08/00:00");
  });
});
