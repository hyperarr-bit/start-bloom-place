/**
 * CRÍTICA DE FORA, 08/11, RODADA 2 — repro. Cada caso diz o que DEVIA acontecer e está em `it.fails`
 * até o conserto (o comentário "hoje:" diz o que acontece agora). As varreduras do fim passam hoje
 * e ficam de guarda.
 *
 *  G1 (MÉDIA) Mudar a 1ª dose pra mais tarde logo depois de tomar: a marca da dose tomada SOME (a dose
 *     nova mais perto dela ainda vem, a mais de 1 h) e o aviso dela fica — 8 em 8, 08:00 tomada, às
 *     08:20 a 1ª dose vira 09:30: a pílula 09:30 fica em aberto e o aviso toca às 09:30, 1 h 30 depois
 *     do comprimido; a pessoa toma de novo. Na varredura (12/12, 8/8, 6/6; agora de 30 em 30 min; toda
 *     1ª dose nova de 30 em 30 min) são 591 de 9.216 trocas com o 1º aviso a menos de meio intervalo do
 *     último comprimido, todas por marca que sumiu; a pior, 90 min num 12 em 12. Quando o conserto
 *     entrar, o caso "F1 a marca não vai pra uma dose que ainda vem" (rodada 1) muda junto.
 *  G2 (BAIXA) "Começa": o toque troca pelo dia do RELÓGIO, não pelo dia que está na tela — "Começa hoje
 *     08:00" desenhado às 23:59 (dia 7) e tocado às 00:00:30 vira o dia 9 (era pra ser o 8, o "amanhã"
 *     que a pessoa viu). O dia 8 inteiro fica sem dose nem aviso. Gêmeo do F3, que consertou só o +.
 *  G3 (BAIXA) "Até quando" antes do começo: "Começa amanhã 08:00" com "Até" = hoje grava um tratamento
 *     sem nenhuma dose, sem aviso e sem dizer nada; no dia seguinte aparece "terminou".
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
import { agruparRemedios, gerarHorarios, montarLinhas, moverMarcasDoGrupo, type Remedio } from "@/lib/remedios";
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
const mudarPrimeira = (hora: string) => {
  fireEvent.click(screen.getByLabelText("Editar horários de Amoxicilina"));
  fireEvent.change(screen.getByLabelText("Horário de Amoxicilina (1ª dose)"), { target: { value: hora } });
  fireEvent.click(screen.getByText("Pronto"));
};
/** as pílulas por hora, em ordem de hora: "07:00✓ 15:00 23:00" */
const pilulas = () => screen.getAllByTestId(/^dose-/)
  .map((b) => `${(b.textContent ?? "").slice(0, 5)}${b.getAttribute("aria-pressed") === "true" ? "✓" : ""}`)
  .sort().join(" ");
/** as marcas de "tomado" pelo MOMENTO da dose ("06/23:00"), não pela linha: o mesmo horário digitado de outro
 *  jeito troca qual linha é a 1ª (e o dia do tratamento que a tela mostra), mas não o que foi tomado e quando */
const marcasNoRelogio = (s: Store) => {
  const hora = new Map(linhas(s).map((l) => [l.id, l.time]));
  return Object.entries(log(s)).flatMap(([dia, ids]) => ids.filter((id) => hora.has(id)).map((id) => `${dia.slice(8, 10)}/${hora.get(id)}`)).sort();
};

/** o que foi tomado e quando, pelo relógio ("07/08:00"), de qualquer linha */
const tomadas = (s: Store) => marcasNoRelogio(s);

describe("crítica de fora, 08/11, rodada 2", () => {
  afterEach(() => { nativo.on = false; rearmes.n = 0; });

  it.fails("G1 8 em 8: 08:00 tomada; às 08:20 a 1ª dose vira 09:30 — a marca vai pra 09:30 e o próximo aviso é 17:30", () => {
    const novas = vezes(3, "08:00", agoraEm(3, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00, d08] } });
    agoraEm(7, 8, 20);
    montar(store);
    mudarPrimeira("09:30");
    // hoje: ["06/09:30", "06/17:30", "07/01:30"] — a 08:00 tomada sumiu; pílula 09:30 em aberto; 1º aviso 07/09:30
    expect(tomadas(store)).toEqual(["06/09:30", "06/17:30", "07/01:30", "07/09:30"]);
    expect(pilulas()).toContain("09:30✓");
    expect(avisos(store)[0]).toBe("07/17:30");
  });

  it.fails("G1 12 em 12: 08:00 tomada às 08:00; às 08:10 a 1ª dose vira 09:30 — sem aviso 1 h 30 depois do comprimido", () => {
    const novas = vezes(2, "08:00", agoraEm(3, 7, 50));
    const [d08, d20] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-06": [d08, d20], "2026-11-07": [d08] } });
    agoraEm(7, 8, 10);
    montar(store);
    mudarPrimeira("09:30");
    // hoje: 1º aviso 07/09:30 e a caixa diz "Próxima dose de Amoxicilina às 09:30"
    expect(avisos(store)[0]).toBe("07/21:30");
    expect(tomadas(store)).toHaveLength(3);
  });

  it.fails("G2 'Começa hoje 08:00' desenhado às 23:59 e tocado às 00:00:30: vira o dia 8 (o amanhã da tela), não o 9", () => {
    agoraEm(7, 23, 59);
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa hoje 08:00"); // dia 7, já começou
    vi.setSystemTime(new Date(2026, 10, 8, 0, 0, 30));
    fireEvent.click(screen.getByTestId("remedio-comeca")); // a pessoa quer "amanhã" = dia 8
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    // hoje: "2026-11-09T08:00" — o dia 8 inteiro sem dose nem aviso
    expect(linhas(store)[0].inicio).toBe("2026-11-08T08:00");
  });

  it.fails("G3 'Começa amanhã 08:00' com 'Até' = hoje: não grava um tratamento sem dose nenhuma calado", () => {
    agoraEm(7, 22, 0);
    const store = criarStore({});
    montar(store);
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Amoxicilina" } });
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    fireEvent.click(screen.getByTestId("remedio-comeca")); // amanhã
    expect(screen.getByTestId("remedio-comeca").textContent).toBe("Começa amanhã 08:00");
    fireEvent.change(screen.getByTestId("remedio-ate"), { target: { value: "2026-11-07" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    // hoje: grava as 3 linhas (início 08/11 08:00, até 07/11), nenhum aviso, nenhuma fala; dia 8 às 08:00 = "terminou"
    const gravou = linhas(store).length > 0;
    expect(gravou ? avisos(store).length > 0 : falas.length > 0).toBe(true);
  });
});

/* ---------- guarda: 1× ao dia perto da meia-noite (F2), a fila nunca perde a próxima dose ---------- */
const dk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const marcasDe = (l: Record<string, string[]>) => new Set(Object.entries(l).flatMap(([d, ids]) => ids.map((i) => `${d}|${i}`)));
function varrerUmaVez(hora: string): string[] {
  const problemas: string[] = [];
  const novas = montarLinhas({ name: "Losartana", stock: 90 }, [hora], undefined, new Date(2026, 10, 1, 9, 0).getTime());
  const id = novas[0].id;
  const [h, m] = hora.split(":").map(Number);
  const occ = Array.from({ length: 12 }, (_, i) => new Date(2026, 10, 3 + i, h, m)).map((q) => ({ dia: dk(q), quando: q.getTime() }));
  for (let min = 0; min < 48 * 60; min += 30) {
    const t = new Date(2026, 10, 7, 0, min).getTime();
    for (const estado of ["emdia", "atrasado", "nada"] as const) {
      const lim = estado === "emdia" ? t : estado === "atrasado" ? t - 30 * 60_000 : -Infinity;
      const logIni: Record<string, string[]> = {};
      for (const o of occ) if (o.quando <= lim && o.quando > new Date(2026, 10, 4).getTime()) (logIni[o.dia] ??= []).push(id);
      const store = criarStore({ [CHAVE]: novas, [LOG]: JSON.parse(JSON.stringify(logIni)) });
      vi.setSystemTime(new Date(t));
      montar(store);
      const onde = `${hora} ${estado} ${fmt(new Date(t))}`;
      const marcadoAntes = (rotulo() ?? "").startsWith("Desmarcar");
      fireEvent.click(caixa());
      const depois = marcasDe(log(store));
      const novos = [...depois].filter((k) => !marcasDe(logIni).has(k));
      // marcou: a de hoje (como sempre) ou a mais perto do relógio, a menos de 12 h (a de ontem/amanhã perto da meia-noite)
      for (const k of novos) {
        const o = occ.find((x) => `${x.dia}|${id}` === k);
        if (!o) problemas.push(`${onde}: marcou ${k}, que não existe`);
        else if (o.dia !== dk(new Date(t)) && Math.abs(o.quando - t) > 12 * 3600_000) problemas.push(`${onde}: marcou ${k}, a mais de 12 h`);
      }
      if (!marcadoAntes && novos.length !== 1) problemas.push(`${onde}: 1 toque com a caixa vazia marcou ${novos.length}`);
      // a fila: o 1º aviso é a próxima ocorrência ainda não marcada
      const prox = occ.find((o) => o.quando > t && !depois.has(`${o.dia}|${id}`));
      if (prox && avisos(store)[0] !== fmt(new Date(prox.quando))) problemas.push(`${onde}: 1º aviso ${avisos(store)[0]}, devia ${fmt(new Date(prox.quando))}`);
      cleanup();
      esquecerMarcasDaCaixa();
    }
  }
  return problemas;
}

describe("crítica de fora, 08/11, rodada 2 — varredura de guarda (passa hoje)", () => {
  it("1× ao dia: 00:00, 00:30, 08:00, 12:00, 20:00, 23:00 e 23:59, de 30 em 30 min por 48 h", () => {
    const todos = ["00:00", "00:30", "08:00", "12:00", "20:00", "23:00", "23:59"].flatMap(varrerUmaVez);
    expect(todos).toEqual([]);
  }, 120_000);
});

/* ---------- guarda: mudar a 1ª dose de um remédio de várias doses nunca tira da fila a próxima dose em aberto ---------- */
describe("crítica de fora, 08/11, rodada 2 — mudar a 1ª dose e a fila (passa hoje)", () => {
  it("12/12, 8/8 e 6/6, em dia: de 30 em 30 min por um dia, toda 1ª dose nova de 30 em 30 min — o 1º aviso é a próxima dose sem marca, e nenhuma dose a mais de meio intervalo à frente fica marcada", () => {
    const problemas: string[] = [];
    for (const [n, p] of [[2, "08:00"], [3, "08:00"], [4, "06:00"], [2, "20:00"]] as const) {
      const novas = montarLinhas({ name: "A", stock: 50 }, gerarHorarios(p, n), undefined, new Date(2026, 10, 3, 7, 0).getTime(), `2026-11-03T${p}`);
      const antes = agruparRemedios(novas)[0];
      for (let nowMin = 0; nowMin < 24 * 60; nowMin += 30) {
        const agora = new Date(2026, 10, 7, 0, nowMin);
        vi.setSystemTime(agora);
        const log0: Record<string, string[]> = {};
        for (let d = 3; d <= 8; d++) for (const l of novas) {
          const [h, m] = l.time.split(":").map(Number);
          const q = new Date(2026, 10, d, h, m);
          if (q.getTime() <= agora.getTime() && q.getTime() > new Date(2026, 10, 5).getTime()) (log0[dk(q)] ??= []).push(l.id);
        }
        for (let novaMin = 0; novaMin < 24 * 60; novaMin += 30) {
          const hora = `${String(Math.floor(novaMin / 60)).padStart(2, "0")}:${String(novaMin % 60).padStart(2, "0")}`;
          const horas = gerarHorarios(hora, n);
          const lista: Remedio[] = novas.map((l, i) => ({ ...l, time: horas[i], inicio: `2026-11-03T${hora}` }));
          const { log: novo } = moverMarcasDoGrupo(antes, agruparRemedios(lista)[0], log0, agora);
          const get = <T,>(k: string, f: T): T => (k === CHAVE ? lista as T : k === LOG ? novo as T : f);
          const plano = planejarRemedios(lerDadosDosLembretes(get).remedios, agora);
          const occ = [7, 8].flatMap((d) => lista.map((l) => {
            const [h, m] = l.time.split(":").map(Number);
            const q = new Date(2026, 10, d, h, m);
            return { k: `${dk(q)}|${l.id}`, quando: q.getTime() };
          })).sort((a, b) => a.quando - b.quando);
          const marcadas = marcasDe(novo);
          const onde = `${n}x ${p} ${fmt(agora)} → ${hora}`;
          const prox = occ.find((o) => o.quando > agora.getTime() && !marcadas.has(o.k));
          if (prox && (!plano[0] || fmt(plano[0].quando) !== fmt(new Date(prox.quando)))) problemas.push(`${onde}: 1º aviso ${plano[0] ? fmt(plano[0].quando) : "nenhum"}, devia ${fmt(new Date(prox.quando))}`);
          // (vale também depois do conserto do G1: a marca de um comprimido tomado anda no máximo meio intervalo)
          for (const o of occ) if (o.quando > agora.getTime() + (12 * 60 / n) * 60_000 && marcadas.has(o.k)) problemas.push(`${onde}: marcada ${o.k}, que ainda vem`);
        }
      }
    }
    expect(problemas).toEqual([]);
  }, 120_000);
});
