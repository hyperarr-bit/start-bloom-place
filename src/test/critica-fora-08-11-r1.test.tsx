/**
 * CRÍTICA DE FORA, 08/11, RODADA 1 — repro. Cada caso diz o que DEVIA acontecer e está em `it.fails`
 * até o conserto (o comentário "hoje:" diz o que acontece agora).
 *
 *  F1 (ALTA) Mudar a 1ª dose de um 8 em 8 já começado pra um horário MAIS TARDE que a metade do
 *     intervalo leva a marca de "tomado" pra frente no tempo: a mesma linha no mesmo dia do tratamento
 *     (lib/remedios, moverMarcasDoGrupo). 08:00 → 23:00 às 15:00 (horários 23/07/15) deixa a das 15:00
 *     de AGORA marcada (era a marca da 00:00) e apaga a da 08:00 tomada; o próximo aviso é 23:00 — 15 h
 *     depois do último comprimido. Os MESMOS horários digitados como 08:00 → 07:00 dão 07 ✓, 15 em
 *     aberto. Ao contrário (08:00 → 02:00 = 02/10/18), a caixa pede a das 10:00 às 15:00 e o aviso das
 *     18:00 vem 3 h depois: 2 comprimidos em 3 h.
 *  F2 (ALTA) 1× ao dia à noite (23:00), esquecida no dia 7 e tomada às 00:30 do dia 8: a caixa grava no
 *     dia 8, o aviso das 23:00 do dia 8 some e a caixa fica ✓ o dia 8 inteiro — a pessoa pula a dose do
 *     dia 8 (anticoncepcional, remédio da noite). Gêmeo do A3 (rodada 2), que segue aberto; também no main.
 *  F3 (MÉDIA) "Começa amanhã" é guardado como "amanhã" (booleano), não como o dia: escolhido às 23:58,
 *     e o + tocado depois da meia-noite, o tratamento começa DEPOIS de amanhã — um dia inteiro sem aviso.
 *  F4 (MÉDIA) Antes de começar ("Começa hoje 20:00", cadastrado às 10:00), mudar a 1ª dose pra 08:00 às
 *     10:30 faz o tratamento ter começado HOJE às 08:00 (antes do cadastro): a caixa pede a das 08:00
 *     como devida, saem avisos às 16:00 e 00:00 de hoje, e a fileira de edição não mostra mais "começa"
 *     (não dá pra voltar pra amanhã). O empate (hoje 08:00 e amanhã 08:00 a 12 h do início antigo) fica
 *     com hoje, que já passou, e cai no "cadastro agora".
 *  F5 (BAIXA) Marcar/desmarcar uma dose não rearma os avisos no toque (só o useLembretes, 0,8–3 s depois
 *     ou ao ir pro 2º plano), embora o use-lembretes diga que o remédio é rearmado no próprio toque.
 */
process.env.TZ = "America/Sao_Paulo";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
import { agruparRemedios, dosesDoGrupoAgora, gerarHorarios, montarLinhas, moverMarcasDoGrupo, type Remedio } from "@/lib/remedios";
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
/** o app volta pro 1º plano: o relógio de 1 min ainda não rodou (só a data andou) */
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
/** as pílulas por hora, em ordem de hora: "07:00✓ 15:00 23:00" */
const pilulas = () => screen.getAllByTestId(/^dose-/)
  .map((b) => `${(b.textContent ?? "").slice(0, 5)}${b.getAttribute("aria-pressed") === "true" ? "✓" : ""}`)
  .sort().join(" ");
/** 8 em 8 desde 08:00 começado no dia 3; tomou 08 e 16 do dia 6, a 00:00 e a 08:00 do dia 7; às 15:00 do dia 7 muda a 1ª dose */
function mudouAs15(nova: string) {
  const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
  const [d08, d16, d00] = novas.map((l) => l.id);
  const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
  agoraEm(7, 15, 0);
  montar(store);
  mudarPrimeira(nova);
  const r = { horas: linhas(store).map((l) => l.time).sort().join("/"), marcas: marcasNoRelogio(store), caixa: rotulo(), aviso: avisos(store)[0] };
  pilulasDaUltima = pilulas();
  cleanup();
  esquecerMarcasDaCaixa();
  return r;
}
/** as marcas de "tomado" pelo MOMENTO da dose ("06/23:00"), não pela linha: o mesmo horário digitado de outro
 *  jeito troca qual linha é a 1ª (e o dia do tratamento que a tela mostra), mas não o que foi tomado e quando */
const marcasNoRelogio = (s: Store) => {
  const hora = new Map(linhas(s).map((l) => [l.id, l.time]));
  return Object.entries(log(s)).flatMap(([dia, ids]) => ids.filter((id) => hora.has(id)).map((id) => `${dia.slice(8, 10)}/${hora.get(id)}`)).sort();
};
let pilulasDaUltima = "";

describe("crítica de fora, 08/11, rodada 1", () => {
  afterEach(() => { nativo.on = false; rearmes.n = 0; });

  /* Conserto (08/11): a marca vai pra dose do desenho novo mais perto NO RELÓGIO (lib/remedios,
     moverMarcasDoGrupo). Os casos comparam o que foi tomado e quando (`marcas`), a caixa e o 1º aviso.
     As pílulas da tela não entram na igualdade: com a 1ª dose às 23:00, a pílula 23:00 das 15:00 é a de
     ONTEM à noite (o dia do tratamento começa na 1ª dose) — ✓, porque a 00:00 tomada virou ela; com a
     1ª às 07:00 é a de hoje à noite, em aberto. Cada caso confere as pílulas à parte. */
  it("F1 (controle) 08:00 → 07:00 às 15:00: 07 ✓, a das 15:00 é a da vez", () => {
    expect(mudouAs15("07:00")).toEqual({
      horas: "07:00/15:00/23:00", marcas: ["06/07:00", "06/15:00", "06/23:00", "07/07:00"],
      caixa: "Marcar próxima dose de Amoxicilina (15:00)", aviso: "07/23:00",
    });
    expect(pilulasDaUltima).toBe("07:00✓ 15:00 23:00");
  });

  it("F1 08:00 → 23:00 às 15:00 (os mesmos 07/15/23): a das 15:00 não fica marcada", () => {
    // antes: pílulas "07:00✓ 15:00✓ 23:00✓", caixa "Desmarcar Amoxicilina" — a das 15:00 de agora aparecia tomada
    const r = mudouAs15("23:00");
    expect(pilulasDaUltima).toBe("07:00✓ 15:00 23:00✓"); // 23:00 = a de ontem à noite (a 00:00 tomada)
    expect(r).toEqual(mudouAs15("07:00"));
  });

  it("F1 08:00 → 22:00 às 15:00 (os mesmos 06/14/22 que 08:00 → 06:00): a das 14:00 não fica marcada", () => {
    // antes: "06:00✓ 14:00✓ 22:00✓" com 22:00; com 06:00: "06:00✓ 14:00 22:00" e a caixa marca a das 14:00
    const r = mudouAs15("22:00");
    expect(pilulasDaUltima).toBe("06:00✓ 14:00 22:00✓"); // 22:00 = a de ontem à noite
    expect(r).toEqual(mudouAs15("06:00"));
    expect(r.caixa).toBe("Marcar próxima dose de Amoxicilina (14:00)");
  });

  it("F1 08:00 → 02:00 às 15:00 (os mesmos 02/10/18 que 08:00 → 10:00): a caixa não pede a das 10:00 3 h antes da das 18:00", () => {
    // antes: com 02:00 "02:00✓ 10:00 18:00" e a caixa "Marcar próxima dose (10:00)"; com 10:00 "02:00✓ 10:00✓ 18:00"
    const r = mudouAs15("02:00");
    expect(pilulasDaUltima).toBe("02:00✓ 10:00✓ 18:00");
    expect(r).toEqual(mudouAs15("10:00"));
    expect(pilulasDaUltima).toBe("02:00 10:00✓ 18:00"); // 02:00 = a de amanhã de madrugada, que ainda vem
    expect(r).toMatchObject({ caixa: "Próxima dose de Amoxicilina às 18:00", aviso: "07/18:00" });
  });

  it("F2 1× ao dia 23:00, esquecida no dia 7 e tomada às 00:30 do dia 8: o aviso das 23:00 do dia 8 fica e a caixa do dia 8 fica em aberto", () => {
    const novas = montarLinhas({ name: "Losartana", stock: 30 }, ["23:00"], undefined, agoraEm(1, 10).getTime());
    const id = novas[0].id;
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [id] } });
    agoraEm(8, 0, 30);
    montar(store);
    fireEvent.click(caixa());
    // hoje: {"2026-11-06": [id], "2026-11-08": [id]} e o 1º aviso é 09/23:00
    expect(avisos(store)[0]).toBe("08/23:00");
    cleanup();
    agoraEm(8, 22, 0);
    montar(store);
    // hoje: "Desmarcar Losartana" — o ✓ das 00:30 vale pelo dia 8 inteiro
    expect(rotulo()).toBe("Marcar Losartana como tomado");
  });

  it("F3 'Começa amanhã' escolhido às 23:58 e o + tocado às 00:01: começa no dia 8, não no 9", () => {
    agoraEm(7, 23, 58);
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa hoje 08:00");
    fireEvent.click(screen.getByTestId("remedio-comeca"));
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa amanhã 08:00");
    agoraEm(8, 0, 1);
    fireEvent.change(screen.getByTestId("remedio-qtd"), { target: { value: "21" } }); // qualquer toque refaz a tela
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    // hoje: "2026-11-09T08:00" — e nenhum aviso no dia 8
    expect(linhas(store)[0].inicio).toBe("2026-11-08T08:00");
    expect(avisos(store)[0]).toBe("08/08:00");
  });

  it("F4 'Começa hoje 20:00' cadastrado às 10:00; às 10:30 a 1ª dose vira 08:00: começa amanhã 08:00, sem dose devida nem aviso hoje", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("20:00", 3), "2026-11-13", agoraEm(7, 10).getTime());
    expect(novas[0].inicio).toBe("2026-11-07T20:00");
    const store = criarStore({ [CHAVE]: novas, [LOG]: {} });
    agoraEm(7, 10, 30);
    montar(store);
    mudarPrimeira("08:00");
    // hoje: inicio "2026-11-07T08:00", caixa "Marcar próxima dose de Amoxicilina (08:00)", 1º aviso 07/16:00
    expect(linhas(store)[0].inicio).toBe("2026-11-08T08:00");
    expect(rotulo()).toBe("Próxima dose de Amoxicilina às 08:00");
    expect(avisos(store)[0]).toBe("08/08:00");
  });

  it.fails("F5 marcar uma dose pela pílula rearma os avisos no próprio toque", async () => {
    nativo.on = true;
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const store = criarStore({ [CHAVE]: novas, [LOG]: {} });
    agoraEm(7, 23, 50);
    montar(store);
    await new Promise((r) => setTimeout(r, 50));
    const antes = rearmes.n;
    fireEvent.click(pilula(novas[2].id)); // a das 00:00, tomada às 23:50
    // hoje: nenhum rearme — o aviso das 00:00 fica na fila até o useLembretes rodar
    await vi.waitFor(() => expect(rearmes.n).toBeGreaterThan(antes), { timeout: 500 });
  });

  it("F5 (controle, passa hoje) mudar a hora rearma no próprio toque — o mesmo caminho nativo funciona", async () => {
    nativo.on = true;
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const store = criarStore({ [CHAVE]: novas, [LOG]: {} });
    agoraEm(7, 23, 50);
    montar(store);
    await new Promise((r) => setTimeout(r, 50));
    const antes = rearmes.n;
    mudarPrimeira("09:00");
    await vi.waitFor(() => expect(rearmes.n).toBeGreaterThan(antes), { timeout: 500 });
  });
});

/* Conserto 08/11: casos em volta dos 4 consertos. */
describe("crítica de fora, 08/11, rodada 1 — em volta do conserto", () => {
  it("F1 a marca não vai pra uma dose que ainda vem: às 08:30, 08:00 tomada e a 1ª dose mudada pra 10:00 → a das 10:00 fica em aberto", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 30);
    montar(store);
    mudarPrimeira("10:00");
    // a 00:00 vira a 02:00 de hoje (já passou); a 08:00 não vira a 10:00 (que ainda vem): sai
    expect(marcasNoRelogio(store)).toEqual(["06/10:00", "06/18:00", "07/02:00"]);
    expect(avisos(store)[0]).toBe("07/10:00");
  });

  it("F1 a marca muda de linha e a anotação 'sem baixa' vai junto (desmarcar não cria comprimido)", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50)).map((l) => ({ ...l, stock: 0 }));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [d00, d08] }, "core-saude-supplement-sem-baixa": { dia: "2026-11-07", ids: [d08] } });
    agoraEm(7, 15, 0);
    montar(store);
    mudarPrimeira("23:00"); // 23/07/15: a 08:00 de hoje vira a 07:00, que agora é a linha d16
    expect(log(store)["2026-11-07"]).toContain(d16);
    expect(store.estado.dados["core-saude-supplement-sem-baixa"]).toEqual({ dia: "2026-11-07", ids: [d16] });
    fireEvent.click(pilula(d16)); // desmarca a 07:00
    expect(estoque(store)).toEqual([0, 0, 0]);
  });

  it("F1 conta pura: de 08:00 pra qualquer hora às 15:00, nunca fica marcada uma dose que ainda vem, e as tomadas não somem", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const log0 = { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] };
    const agora = agoraEm(7, 15, 0);
    const antes = agruparRemedios(novas)[0];
    for (let h = 0; h < 24; h++) {
      const hora = `${String(h).padStart(2, "0")}:00`;
      const horas = gerarHorarios(hora, 3);
      const depois = agruparRemedios(novas.map((l, i) => ({ ...l, time: horas[i] })))[0];
      const { log: novo } = moverMarcasDoGrupo(antes, depois, log0, agora);
      const hora2 = new Map(depois.itens.map((l) => [l.id, l.time]));
      const momentos = Object.entries(novo).flatMap(([dia, ids]) => ids.map((id) => {
        const [a, m, d] = dia.split("-").map(Number);
        const [hh, mm] = String(hora2.get(id)).split(":").map(Number);
        return new Date(a, m - 1, d, hh, mm).getTime();
      }));
      expect([hora, momentos.length]).toEqual([hora, 4]); // as 4 tomadas continuam no histórico
      expect([hora, momentos.every((t) => t <= agora.getTime() + 3600_000)]).toEqual([hora, true]);
    }
  });

  it("F2 1× ao dia: a dose da vez perto da meia-noite (23:00 às 00:30 = ontem; às 11:00 já é a de hoje; 00:30 às 21:30 = amanhã, às 21:29 ainda hoje)", () => {
    const g23 = agruparRemedios(montarLinhas({ name: "Losartana", stock: 30 }, ["23:00"], undefined, 1))[0];
    expect(dosesDoGrupoAgora(g23, agoraEm(8, 0, 30))[0].dia).toBe("2026-11-07");
    expect(dosesDoGrupoAgora(g23, agoraEm(8, 10, 59))[0].dia).toBe("2026-11-07");
    expect(dosesDoGrupoAgora(g23, agoraEm(8, 11, 0))[0].dia).toBe("2026-11-08");
    const g0030 = agruparRemedios(montarLinhas({ name: "Melatonina", stock: 30 }, ["00:30"], undefined, 1))[0];
    expect(dosesDoGrupoAgora(g0030, agoraEm(7, 21, 29))[0].dia).toBe("2026-11-07");
    expect(dosesDoGrupoAgora(g0030, agoraEm(7, 21, 30))[0].dia).toBe("2026-11-08");
    // o das 08:00 olhado às 22:00 continua o de hoje (rodada 3, B1)
    const g08 = agruparRemedios(montarLinhas({ name: "Vit D", stock: 30 }, ["08:00"], undefined, 1))[0];
    expect(dosesDoGrupoAgora(g08, agoraEm(7, 22, 0))[0].dia).toBe("2026-11-07");
    // no último dia (até 07/11) a das 00:30 de amanhã não existe: às 23:50 continua a de hoje
    const gAte = agruparRemedios(montarLinhas({ name: "Melatonina", stock: 30 }, ["00:30"], "2026-11-07", 1))[0];
    expect(dosesDoGrupoAgora(gAte, agoraEm(7, 23, 50))[0].dia).toBe("2026-11-07");
  });

  it("F3 'Começa hoje' escolhido às 23:58 e o + às 00:01: o dia já passou — não grava, volta a sugestão e avisa", () => {
    agoraEm(7, 23, 58);
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    fireEvent.click(screen.getByTestId("remedio-comeca")); // amanhã
    fireEvent.click(screen.getByTestId("remedio-comeca")); // hoje (07/11), escolhido
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa hoje 08:00");
    agoraEm(8, 0, 1);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    expect(linhas(store)).toEqual([]);
    expect(falas.some((f) => f.startsWith("O dia escolhido pra começar já passou."))).toBe(true);
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa hoje 08:00"); // a sugestão das 00:01: hoje (08/11)
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    expect(linhas(store)[0].inicio).toBe("2026-11-08T08:00");
  });
});
