/**
 * CRÍTICA DE FORA, 10/11, RODADA 1 — repro da regra "mudar o horário vale a partir de amanhã"
 * (lib/remedios, mudarHorarios). Cada caso diz o que DEVIA acontecer; consertados em 10/11 (eram
 * `it.fails`). Os casos "(depois do conserto)" eram os "(o que acontece hoje)" e agora descrevem a regra nova.
 *
 *  I1 (ALTA) 1× ao dia mudado pra MAIS DE 12 h antes (20:00 → 07:00, 22:00 → 08:00, 12:00 → 00:00):
 *     o dia seguinte fica SEM dose e sem aviso — a 1ª dose nova vai pra DEPOIS de amanhã, e a tela diz
 *     "Os horários novos valem a partir de amanhã." Com "Até" = amanhã, o último dia do tratamento fica
 *     sem dose e a tela oferece uma dose DEPOIS do fim.
 *  I2 (MÉDIA) entre a virada do dia e a 1ª dose nova, a caixa do 1× ao dia marca a dose nova que ainda
 *     vem (até quase 1 dia antes) e o aviso dela some. Sem troca de horário, ela nunca marca mais de
 *     3 h adiantado.
 *  I3 (MÉDIA) mudar o horário no ÚLTIMO dia de um tratamento com "Até": a tela e os avisos discordam —
 *     a dose da noite do horário de antes perde o aviso (e na hora dela a tela diz "terminou"), ou o
 *     horário novo avisa uma dose depois do fim (a tela diz "terminou").
 *  I4 (MÉDIA) 1× ao dia: a linha mostra o horário NOVO enquanto a dose de hoje ainda é a do horário de
 *     antes — às 08:00 toca "Hora da Losartana" e a linha diz 22:00, sem marcar.
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
import { agruparRemedios, dosesDoGrupoAgora, gerarHorarios, montarLinhas, mudarHorarios, tratamentoTerminou, type Remedio } from "@/lib/remedios";
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
const log = (s: Store) => Object.fromEntries(Object.entries((s.estado.dados[LOG] ?? {}) as Record<string, string[]>).filter(([, ids]) => ids.length));
const voltarProApp = () => {
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("focus"));
  fireEvent(window, new Event("pageshow"));
};
const simples = (time: string, ate?: string): Remedio => ({ id: "r1", name: "Losartana", time, stock: 30, dosesPerDay: 1, ...(ate ? { ate } : {}) });
const caixaSimples = () => screen.getByRole("button", { name: /^(Desmarcar Losartana|Marcar Losartana como tomado)$/ });
/** tratamento de várias doses que começou no dia 1, com "Até" */
const tratamento = (n: number, primeira: string, ate: string): Remedio[] =>
  montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios(primeira, n), ate, new Date(2026, 10, 1, 7, 0).getTime(), `2026-11-01T${primeira}`);
/** a lista de avisos e as doses que a tela mostra (de agora até 2 dias), com os horários de `lista` */
const telaEAvisos = (lista: Remedio[], desde: Date) => {
  const get = <T,>(k: string, f: T): T => (k === CHAVE ? (lista as unknown as T) : f);
  const fila = new Set(planejarRemedios(lerDadosDosLembretes(get).remedios, desde).map((a) => fmt(a.quando)));
  const tela = new Set<string>();
  for (let t = desde.getTime(); t < desde.getTime() + 2 * 86400_000; t += 15 * 60_000) {
    const g = agruparRemedios(lista)[0];
    if (tratamentoTerminou(g, new Date(t))) continue;
    for (const d of dosesDoGrupoAgora(g, new Date(t))) if (d.quando > desde.getTime()) tela.add(fmt(new Date(d.quando)));
  }
  return { fila: [...fila].sort(), tela: [...tela].sort() };
};

let falas: string[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  falas = [];
  avisoCurto.fn = (texto: unknown) => { falas.push(String(texto)); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); esquecerMarcasDaCaixa(); });

describe("crítica de fora, 10/11, rodada 1", () => {
  /* I1: Losartana 1× ao dia às 20:00, tomada às 20:00 do dia 7. Às 21:00 a pessoa passa pra 07:00
     (vai tomar de manhã). A tela diz "a partir de amanhã", mas a 1ª dose nova cai no dia 9: o dia 8
     não tem dose nem aviso (35 h sem remédio). A guarda de "meio intervalo" (12 h no 1× ao dia) joga
     a das 07:00 do dia 8 (11 h depois da última) pra frente um dia inteiro. */
  it("I1 1× ao dia 20:00 → 07:00 (tomada às 20:00): o dia 8 tem a dose das 07:00, com aviso", () => {
    const store = criarStore({ [CHAVE]: [simples("20:00")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 21, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "07:00" } });
    expect(falas).toContain("Os horários novos valem a partir de amanhã, às 07:00.");
    expect(avisos(store)[0]).toBe("08/07:00"); // era "09/07:00"
  });

  it("I1 (depois do conserto) 20:00 → 07:00: novoDesde é o dia 8; às 07:00 do dia 8 a caixa é a das 07:00, em aberto, e marca no dia 8", () => {
    const store = criarStore({ [CHAVE]: [simples("20:00")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 21, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "07:00" } });
    expect(linhas(store)[0].novoDesde).toBe("2026-11-08T07:00");
    // até a virada, a caixa segue o ✓ das 20:00 de hoje
    agoraEm(7, 23, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Desmarcar Losartana");
    agoraEm(8, 7, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Marcar Losartana como tomado");
    fireEvent.click(caixaSimples());
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": [linhas(store)[0].id] });
    expect(avisos(store)[0]).toBe("09/07:00");
  });

  it("I1d 1× ao dia 23:00 → 00:30 às 10:00: a das 00:30 de amanhã ficaria 1 h 30 depois da das 23:00; a 1ª nova é a do dia 9 e a tela diz o dia", () => {
    const store = criarStore({ [CHAVE]: [simples("23:00")], [LOG]: {} });
    agoraEm(7, 10, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "00:30" } });
    expect(linhas(store)[0].novoDesde).toBe("2026-11-09T00:30");
    expect(falas).toContain("Os horários novos valem a partir de 09/11, às 00:30.");
    expect(avisos(store).slice(0, 2)).toEqual(["07/23:00", "09/00:30"]);
  });

  it("I1b o mesmo mudado de MANHÃ, antes da dose das 20:00 (dia 7 09:00): amanhã já é 07:00", () => {
    const store = criarStore({ [CHAVE]: [simples("20:00")], [LOG]: {} });
    agoraEm(7, 9, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "07:00" } });
    expect(avisos(store).slice(0, 2)).toEqual(["07/20:00", "08/07:00"]); // hoje: 07/20:00 e 09/07:00
  });

  it("I1c com 'Até' = dia 8: o último dia tem a dose das 07:00, e nenhuma dose depois do fim", () => {
    const lista = mudarHorarios([simples("20:00", "2026-11-08")], ["07:00"], agoraEm(7, 21, 0)).itens;
    const { fila, tela } = telaEAvisos(lista, agoraEm(7, 21, 0));
    // hoje: fila [] (nenhuma dose no dia 8) e a tela mostra "09/07:00", depois do fim, sem aviso
    expect(fila).toEqual(["08/07:00"]);
    expect(tela).toEqual(["08/07:00"]);
  });

  /* I2: 1× ao dia 08:00, tomada às 08:00 do dia 7; às 09:00 passa pra 20:00 (vale amanhã, dia 8 às
     20:00). Dia 8 às 08:00, por costume, a pessoa abre o app: a caixa está em aberto e marca a dose
     das 20:00 — 12 h antes. O aviso das 20:00 sai da fila. Sem troca de horário a caixa do 1× ao dia
     não marca nada a mais de 3 h (diaDaDoseUnica). Com o I1, a caixa marca a das 07:00 do dia 9 às
     20:00 do dia 8 (11 h antes) e o dia 9 amanhece ✓ e sem aviso. */
  it("I2 dia 8 08:00: a caixa não marca a dose das 20:00 (12 h adiantado) e o aviso dela fica", () => {
    const store = criarStore({ [CHAVE]: [simples("08:00")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 9, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "20:00" } });
    expect(avisos(store)[0]).toBe("08/20:00");
    agoraEm(8, 8, 0);
    voltarProApp();
    fireEvent.click(caixaSimples());
    expect(log(store)).toEqual({ "2026-11-07": ["r1"] }); // hoje: grava "2026-11-08" (a das 20:00)
    expect(avisos(store)[0]).toBe("08/20:00"); // hoje: "09/20:00"
  });

  it("I2 (depois do conserto, com o I1) dia 8 20:00, por costume: a caixa marca a das 07:00 do DIA 8 (atrasada) e o dia 9 amanhece em aberto, com aviso", () => {
    const store = criarStore({ [CHAVE]: [simples("20:00")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 21, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "07:00" } });
    agoraEm(8, 20, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Marcar Losartana como tomado");
    fireEvent.click(caixaSimples());
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": [linhas(store)[0].id] });
    expect(avisos(store)[0]).toBe("09/07:00");
    agoraEm(9, 7, 0);
    voltarProApp();
    expect(caixaSimples().getAttribute("aria-label")).toBe("Marcar Losartana como tomado");
  });

  it("I2b na janela antes da 1ª dose nova a caixa só diz quando é; a menos de 3 h, marca", () => {
    const store = criarStore({ [CHAVE]: [simples("08:00")], [LOG]: { "2026-11-07": ["r1"] } });
    agoraEm(7, 9, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "20:00" } });
    agoraEm(8, 8, 0);
    voltarProApp();
    fireEvent.click(caixaSimples());
    expect(falas).toContain("A próxima de Losartana é hoje, às 20:00.");
    agoraEm(8, 17, 30);
    voltarProApp();
    fireEvent.click(caixaSimples());
    expect(log(store)).toEqual({ "2026-11-07": ["r1"], "2026-11-08": [linhas(store)[0].id] });
    expect(avisos(store)[0]).toBe("09/20:00");
  });

  /* I3: mudar o horário no ÚLTIMO dia do tratamento ("Até" = dia 7). */
  it("I3 12 em 12 20:00 (20:00 e 08:00) até o dia 7, mudado pra 08:00 às 10:00 do dia 7: a das 08:00 do dia 8 (a última) tem aviso", () => {
    const lista = mudarHorarios(tratamento(2, "20:00", "2026-11-07"), ["08:00", "20:00"], agoraEm(7, 10, 0)).itens;
    const { fila, tela } = telaEAvisos(lista, agoraEm(7, 10, 0));
    expect(tela).toEqual(["07/20:00", "08/08:00"]); // passa: a tela mostra a última dose
    expect(fila).toEqual(["07/20:00", "08/08:00"]); // hoje: só "07/20:00"
  });

  it("I3 (depois do conserto) na hora da última dose (dia 8 08:00) a tela não diz 'terminou', a caixa marca a das 08:00 e às 20:00 do dia 8 terminou", () => {
    const store = criarStore({ [CHAVE]: tratamento(2, "20:00", "2026-11-07"), [LOG]: {} });
    agoraEm(7, 10, 0);
    montar(store);
    fireEvent.click(screen.getByLabelText("Editar horários de Amoxicilina"));
    fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByText("Pronto"));
    expect(falas).toContain("O tratamento termina antes de os horários novos começarem: até o fim valem os de antes.");
    agoraEm(8, 8, 0);
    voltarProApp();
    expect(screen.getByTestId("remedio-detalhe").textContent).not.toContain("terminou");
    expect(screen.getByTestId(/^remedio-caixa-/).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByTestId(/^remedio-caixa-/));
    expect(log(store)["2026-11-08"]).toHaveLength(1);
    agoraEm(8, 20, 0);
    voltarProApp();
    expect(screen.getByTestId("remedio-detalhe").textContent).toContain("terminou");
  });

  it("I3b 12 em 12 08:00 (08:00 e 20:00) até o dia 7, mudado pra 20:00 às 10:00 do dia 7: nenhum aviso depois do fim", () => {
    const lista = mudarHorarios(tratamento(2, "08:00", "2026-11-07"), ["20:00", "08:00"], agoraEm(7, 10, 0)).itens;
    const { fila, tela } = telaEAvisos(lista, agoraEm(7, 10, 0));
    expect(tela).toEqual(["07/20:00"]); // passa: a última dose é a das 20:00 do dia 7
    expect(fila).toEqual(["07/20:00"]); // hoje: ["07/20:00", "08/08:00"] — 1 comprimido a mais, com a tela dizendo "terminou"
  });

  /* I4: 1× ao dia 08:00; às 07:00 (antes de tomar) a pessoa muda pra 22:00. Hoje ainda vale 08:00 (é a
     regra) e o aviso das 08:00 toca — mas a linha mostra "22:00" e a caixa em aberto. Num remédio de
     várias doses a pílula mostra a hora de hoje (08:00); no de 1× ao dia não há nada na tela que diga
     que hoje ainda é 08:00 (o toast "a partir de amanhã" some em 4 s). Às 22:00 não toca nada. */
  it("I4 1× ao dia 08:00 → 22:00 às 07:00: às 08:00 a linha mostra a hora da dose de hoje (08:00)", () => {
    const store = criarStore({ [CHAVE]: [simples("08:00")], [LOG]: {} });
    agoraEm(7, 7, 0);
    montar(store);
    fireEvent.change(screen.getByLabelText("Horário de Losartana"), { target: { value: "22:00" } });
    expect(avisos(store)[0]).toBe("07/08:00"); // a regra: hoje ainda é 08:00
    agoraEm(7, 8, 0);
    voltarProApp();
    expect(screen.getByTestId("remedio-horario-hoje").textContent).toBe("hoje 08:00 · 22:00 a partir de amanhã"); // era só o campo com "22:00"
    expect(screen.getByText(/08:00/)).toBeTruthy();
    expect(falas).toContain("Os horários novos valem a partir de amanhã, às 22:00.");
  });
});

describe("crítica de fora, 10/11, rodada 1 — varreduras de guarda", () => {
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  /** tela × avisos até `horas` depois de `desde` (a tela é olhada de 30 em 30 min por 2 dias) */
  const conferir = (lista: Remedio[], desde: Date, horas = 30) => {
    const fim = desde.getTime() + horas * 3600_000;
    const get = <T,>(k: string, f: T): T => (k === CHAVE ? (lista as unknown as T) : f);
    const fila = new Set(planejarRemedios(lerDadosDosLembretes(get).remedios, desde).filter((a) => a.quando.getTime() < fim).map((a) => fmt(a.quando)));
    const tela = new Set<string>();
    for (let t = desde.getTime(); t < desde.getTime() + 2 * 86400_000; t += 30 * 60_000) {
      const g = agruparRemedios(lista)[0];
      if (tratamentoTerminou(g, new Date(t))) continue;
      for (const d of dosesDoGrupoAgora(g, new Date(t))) if (d.quando > desde.getTime() && d.quando < fim) tela.add(fmt(new Date(d.quando)));
    }
    return { semAviso: [...tela].filter((x) => !fila.has(x)), semTela: [...fila].filter((x) => !tela.has(x)) };
  };

  it("toda dose da tela tem aviso e todo aviso tem dose na tela: 1 a 4 doses por dia, com e sem 'Até', mudando no dia 7", () => {
    const problemas: string[] = [];
    for (const n of [1, 2, 3, 4]) {
      for (const de of ["00:30", "07:00", "08:00", "12:00", "20:00", "23:00"]) {
        for (const ate of [undefined, "2026-11-07", "2026-11-08"]) {
          for (const pra of ["00:30", "04:00", "07:00", "10:00", "16:00", "19:00", "22:00", "23:30"]) {
            if (pra === de) continue;
            for (const quando of [60, 7 * 60, 10 * 60, 15 * 60, 21 * 60, 23 * 60 + 30]) {
              const agora = agoraEm(7, 0, quando);
              const base = n === 1 ? [simples(de, ate)] : montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios(de, n), ate, new Date(2026, 10, 1, 7, 0).getTime(), `2026-11-01T${de}`);
              const novos = n === 1 ? [pra] : gerarHorarios(pra, n);
              const { itens } = mudarHorarios(base, novos, agora);
              const { semAviso, semTela } = conferir(itens, agora);
              const onde = `${n}× ${de} → ${pra} às ${hhmm(quando)}${ate ? ` até ${ate.slice(8)}` : ""}`;
              if (semAviso.length) problemas.push(`${onde}: na tela sem aviso ${semAviso}`);
              if (semTela.length) problemas.push(`${onde}: aviso sem tela ${semTela}`);
            }
          }
        }
      }
    }
    expect(problemas.slice(0, 10)).toEqual([]);
  }, 180_000);

  it("1× ao dia: a 1ª nova nunca fica a menos de 6 h da última de antes, e o dia seguinte do calendário tem a dose nova (a não ser que ela caísse a menos de 6 h)", () => {
    const problemas: string[] = [];
    for (let de = 0; de < 24 * 60; de += 120) {
      for (let pra = 30; pra < 24 * 60; pra += 120) {
        for (let quando = 30; quando < 24 * 60; quando += 150) {
          const agora = agoraEm(7, 0, quando);
          const linha = [simples(hhmm(de))];
          const { itens, novoDesde } = mudarHorarios(linha, [hhmm(pra)], agora);
          const onde = `${hhmm(de)} → ${hhmm(pra)} às ${hhmm(quando)}`;
          const [a, me, d] = String(itens[0].antesAte).split("-").map(Number);
          const L = new Date(a, me - 1, d, Math.floor(de / 60), de % 60).getTime();
          const F = new Date(String(novoDesde)).getTime();
          if (F - L < 6 * 3600_000) problemas.push(`${onde}: 1ª nova ${novoDesde} a menos de 6 h`);
          // o dia seguinte do calendário tem a dose nova — só fica pro outro se ela cairia a menos de 6 h da última
          const amanha = new Date(a, me - 1, d + 1, Math.floor(pra / 60), pra % 60).getTime();
          if (F > amanha && amanha - L >= 6 * 3600_000) problemas.push(`${onde}: o dia seguinte (${fmt(new Date(amanha))}) ficou sem dose; 1ª nova ${novoDesde}`);
        }
      }
    }
    expect(problemas.slice(0, 10)).toEqual([]);
  }, 60_000);
});
