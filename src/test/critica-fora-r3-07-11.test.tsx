/**
 * CRÍTICA DE FORA, RODADA 3 (07/11) — repro. Cada caso diz o que DEVIA acontecer e está em `it.fails`
 * enquanto o app faz diferente: quando o conserto entrar, o caso passa a falhar aqui e vira `it`.
 * A varredura no fim (caixa com 1 e 2 toques, de 30 em 30 min, 8 desenhos de dose, meio do tratamento,
 * último dia e 1º dia) passa hoje: fica de guarda pro conserto.
 *
 *  B1 (ALTA) A tela não refaz a conta ao voltar pro app (ou pra aba): o dia e a dose da vez são os do
 *     último desenho. Remédio de 1× ao dia não tem relógio nenhum — deixado aberto na Saúde à noite, de
 *     manhã mostra o ✓ de ONTEM (a pessoa acha que já tomou e pula) e o toque desmarca a de ontem. Grupo
 *     (8 em 8…) tem o relógio de 1 min, mas no app suspenso ele pode demorar até 1 min pra rodar depois de
 *     abrir — e é nesse 1º minuto que a pessoa, vinda do aviso das 08:00, toca: a pílula 08:00 desmarca a
 *     de ontem (estoque +1, histórico perde uma dose, 08:00 de hoje em aberto).
 *  B2 (MEDIA) "A das 08:00 ficou pra trás" depende da memória do que a CAIXA marcou. Quando a dose mais
 *     nova foi marcada pela pílula, quando o app foi reaberto, ou depois de mexer na hora da 1ª dose (a
 *     memória é apagada), o toque seguinte na caixa marca a esquecida: 1 comprimido vira 2 doses, o
 *     estoque desce 2 e o furo some do histórico (é o R1 da rodada 1 por outros caminhos).
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
import { gerarHorarios, montarLinhas, type Remedio } from "@/lib/remedios";
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

describe("crítica de fora, rodada 3", () => {
  it("B1 1× ao dia: aberto na Saúde à noite, de manhã a caixa não mostra o ✓ de ontem e o toque marca a de hoje", () => {
    const novas = montarLinhas({ name: "Losartana", stock: 30 }, ["08:00"], undefined, agoraEm(1, 10).getTime());
    const id = novas[0].id;
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [id] } });
    agoraEm(7, 22, 0);
    montar(store);
    expect(rotulo()).toBe("Desmarcar Losartana"); // a de hoje (07/11), tomada
    agoraEm(8, 8, 5); // a noite passou com o app/aba aberto; o aviso das 08:00 tocou
    voltarProApp();
    // hoje: "Desmarcar Losartana" — o ✓ de ontem, e quem olha acha que já tomou
    expect(rotulo()).toBe("Marcar Losartana como tomado");
    fireEvent.click(caixa());
    // hoje: tira 07/11 do registro e devolve o comprimido
    expect(log(store)).toEqual({ "2026-11-07": [id], "2026-11-08": [id] });
    expect(estoque(store)).toEqual([29]);
  });

  it("B1 8 em 8: vinda do aviso das 08:00, antes do relógio de 1 min rodar, a pílula 08:00 marca a de hoje (não desmarca a de ontem)", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-07": [d08, d16] } });
    agoraEm(7, 23, 58);
    montar(store);
    fireEvent.click(caixa()); // a das 00:00, tomada às 23:58
    expect(log(store)).toEqual({ "2026-11-07": [d08, d16], "2026-11-08": [d00] });
    agoraEm(8, 8, 2); // o celular dormiu com o app na Saúde
    voltarProApp();
    fireEvent.click(pilula(d08));
    // hoje: {"2026-11-07": [d16], "2026-11-08": [d00]} e estoque 16 — a de ontem some, a de hoje segue em aberto
    expect(log(store)).toEqual({ "2026-11-07": [d08, d16], "2026-11-08": [d00, d08] });
    expect(estoque(store)).toEqual([14, 14, 14]);
    expect(avisos(store)[0]).toBe("08/16:00");
  });

  it("B1 8 em 8: no mesmo caso, a caixa às 08:02 marca a das 08:00 (não a das 00:00 esquecida do desenho velho)", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-07": [d08, d16] } });
    agoraEm(7, 23, 50); // desenho das 23:50: a das 00:00 (de daqui a 10 min) com contorno verde
    montar(store);
    agoraEm(8, 8, 2);
    voltarProApp();
    fireEvent.click(caixa());
    // hoje: marca a das 00:00 (que passou sem ser tomada) — o aviso das 08:00 já tocou, e às 08:03 a tela pede a das 08:00 de novo
    expect(log(store)["2026-11-08"]).toEqual([d08]);
    expect(log(store)["2026-11-08"]).not.toContain(d00);
  });

  it("B1 no toque: o dia virou sem nenhum aviso de volta (nem o relógio rodou) — a caixa do 1× ao dia só refaz a tela e não grava", () => {
    const novas = montarLinhas({ name: "Losartana", stock: 30 }, ["08:00"], undefined, agoraEm(1, 10).getTime());
    const id = novas[0].id;
    const store = criarStore({ [CHAVE]: novas, [LOG]: { "2026-11-07": [id] } });
    agoraEm(7, 22, 0);
    montar(store);
    agoraEm(8, 8, 5);
    fireEvent.click(caixa()); // o desenho ainda é o de ontem (✓): o toque não desmarca a de ontem
    expect(log(store)).toEqual({ "2026-11-07": [id] });
    expect(estoque(store)).toEqual([30]);
    expect(rotulo()).toBe("Marcar Losartana como tomado");
    fireEvent.click(caixa()); // agora com a tela de hoje
    expect(log(store)).toEqual({ "2026-11-07": [id], "2026-11-08": [id] });
    expect(estoque(store)).toEqual([29]);
  });

  it("B1 no toque: 8 em 8 com o desenho das 23:58 e nenhum aviso de volta — a pílula 08:00 e a caixa às 08:02 só refazem a tela", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-07": [d08, d16] } });
    agoraEm(7, 23, 58);
    montar(store);
    fireEvent.click(caixa()); // a das 00:00, tomada às 23:58
    agoraEm(8, 8, 2);
    fireEvent.click(pilula(d08)); // desenho velho: a 08:00 era a de ontem, marcada
    expect(log(store)).toEqual({ "2026-11-07": [d08, d16], "2026-11-08": [d00] });
    expect(estoque(store)).toEqual([15, 15, 15]);
    fireEvent.click(pilula(d08)); // a tela já é a de hoje
    expect(log(store)).toEqual({ "2026-11-07": [d08, d16], "2026-11-08": [d00, d08] });
    expect(estoque(store)).toEqual([14, 14, 14]);
  });

  it("B1 no toque: dentro do mesmo dia do tratamento, a caixa decide pela hora do toque (desenho das 07:40, toque às 08:02 marca a das 08:00)", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-07": [d08, d16], "2026-11-08": [d00] } });
    agoraEm(8, 7, 40); // às 07:40 nenhuma chegou: a caixa só diria "ainda não chegou"
    montar(store);
    agoraEm(8, 8, 2);
    fireEvent.click(caixa());
    expect(log(store)["2026-11-08"]).toEqual([d00, d08]);
    expect(falas).toEqual([]);
  });

  it.fails("B2 a das 16:00 marcada pela PÍLULA, a das 08:00 esquecida: a caixa não marca a esquecida", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 16, 5);
    montar(store);
    fireEvent.click(pilula(d16));
    fireEvent.click(caixa()); // "confirmar" na caixa
    // hoje: grava d08 também — 2 doses pra 1 comprimido, estoque 14
    expect(log(store)["2026-11-07"]).toEqual([d00, d16]);
    expect(estoque(store)).toEqual([15, 15, 15]);
    expect(falas).toContain("A das 08:00 ficou pra trás. Se tomou, toque no horário.");
  });

  it.fails("B2 a caixa marcou a das 16:00; o app foi fechado e aberto; o 2º toque não marca a das 08:00 esquecida", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 16, 5);
    montar(store);
    fireEvent.click(caixa());
    expect(log(store)["2026-11-07"]).toEqual([d00, d16]);
    cleanup();
    esquecerMarcasDaCaixa(); // app aberto de novo: a memória do módulo nasce vazia
    agoraEm(7, 16, 7);
    montar(store);
    fireEvent.click(caixa());
    // hoje: marca d08 — estoque 14
    expect(log(store)["2026-11-07"]).toEqual([d00, d16]);
    expect(estoque(store)).toEqual([15, 15, 15]);
  });

  it.fails("B2 a caixa marcou a das 16:00; mexeu na 1ª dose e voltou (08:00 → 08:30 → 08:00); a caixa não marca a das 08:00 esquecida", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 16, 5);
    montar(store);
    fireEvent.click(caixa());
    fireEvent.click(screen.getByLabelText("Editar horários de Amoxicilina"));
    const primeira = () => screen.getByLabelText("Horário de Amoxicilina (1ª dose)");
    fireEvent.change(primeira(), { target: { value: "08:30" } });
    fireEvent.change(primeira(), { target: { value: "08:00" } });
    fireEvent.click(screen.getByText("Pronto"));
    expect(log(store)["2026-11-07"]).toEqual([d00, d16]);
    fireEvent.click(caixa());
    // hoje: marca d08 — estoque 14
    expect(log(store)["2026-11-07"]).toEqual([d00, d16]);
    expect(estoque(store)).toEqual([15, 15, 15]);
  });

  it("B2 (o que fica) marcada ADIANTADO pela pílula, a mais nova não conta: às 08:05 com a das 16:00 marcada antes, a caixa marca a das 08:00", () => {
    const novas = vezes(3, "08:00", agoraEm(5, 7, 50));
    const [d08, d16, d00] = novas.map((l) => l.id);
    const store = criarStore({ [CHAVE]: novas.map((l) => ({ ...l, stock: 16 })), [LOG]: { "2026-11-06": [d08, d16], "2026-11-07": [d00] } });
    agoraEm(7, 8, 5);
    montar(store);
    fireEvent.click(pilula(d16)); // engano: tocou a vizinha
    fireEvent.click(caixa());
    expect(log(store)["2026-11-07"]).toEqual([d00, d16, d08]);
  });
});

// ---------- varredura de guarda ----------
type Occ = { id: string; dia: string; quando: number };
const dk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** as ocorrências de verdade: cada linha em cada dia do calendário, desde o `inicio` e até a dose da noite do `ate` */
function ocorrencias(ls: Remedio[]): Occ[] {
  const p = ls[0].time;
  const i = ls[0].inicio;
  const ini = i ? new Date(+i.slice(0, 4), +i.slice(5, 7) - 1, +i.slice(8, 10), +i.slice(11, 13), +i.slice(14, 16)).getTime() : -Infinity;
  const out: Occ[] = [];
  for (let d = 3; d <= 16; d++) for (const l of ls) {
    const [h, m] = l.time.split(":").map(Number);
    const q = new Date(2026, 10, d, h, m);
    const trat = l.time < p ? dk(new Date(2026, 10, d - 1)) : dk(q);
    if (q.getTime() < ini || (l.ate && trat > l.ate)) continue;
    out.push({ id: l.id, dia: dk(q), quando: q.getTime() });
  }
  return out.sort((a, b) => a.quando - b.quando);
}
const ESQUEMAS: Array<[string, number, string]> = [
  ["12/12 08", 2, "08:00"], ["12/12 20", 2, "20:00"], ["8/8 08", 3, "08:00"], ["8/8 00", 3, "00:00"],
  ["8/8 22", 3, "22:00"], ["6/6 08", 4, "08:00"], ["6/6 00", 4, "00:00"], ["6/6 05", 4, "05:00"],
];
const marcas = (l: Record<string, string[]>) => new Set(Object.entries(l).flatMap(([d, ids]) => ids.map((i) => `${d}|${i}`)));
function varrer(fazer: (n: number, p: string) => Remedio[], diaIni: number, desdeMin: number, ateMin: number): string[] {
  const problemas: string[] = [];
  for (const [nome, n, p] of ESQUEMAS) {
    const novas = fazer(n, p);
    const occ = ocorrencias(novas);
    for (let min = desdeMin; min < ateMin; min += 30) {
      const t = new Date(2026, 10, diaIni, 0, min).getTime();
      for (const estado of ["emdia", "nada", "atrasado"] as const) {
        const lim = estado === "emdia" ? t : estado === "atrasado" ? t - 30 * 60_000 : -Infinity;
        const logIni: Record<string, string[]> = {};
        for (const o of occ) if (o.quando <= lim && o.quando > new Date(2026, 10, 5).getTime()) (logIni[o.dia] ??= []).push(o.id);
        const store = criarStore({ [CHAVE]: novas, [LOG]: JSON.parse(JSON.stringify(logIni)) });
        vi.setSystemTime(new Date(t));
        montar(store);
        const onde = `${nome} ${estado} ${fmt(new Date(t))}`;
        const antes = marcas(logIni);
        const marcadoAntes = (rotulo() ?? "").startsWith("Desmarcar");
        fireEvent.click(caixa());
        const d1 = marcas(log(store));
        for (const x of [...d1].filter((k) => !antes.has(k))) {
          const o = occ.find((oo) => `${oo.dia}|${oo.id}` === x);
          if (!o) problemas.push(`${onde}: marcou dose que não existe ${x}`);
          else if (o.quando > t + 15 * 60_000) problemas.push(`${onde}: a caixa marcou dose que ainda vem ${x}`);
        }
        if (estado !== "nada" && !marcadoAntes && [...antes].some((k) => !d1.has(k))) problemas.push(`${onde}: 1 toque tirou uma dose tomada`);
        const prox = occ.find((o) => o.quando > t && !d1.has(`${o.dia}|${o.id}`));
        if (prox && avisos(store)[0] !== fmt(new Date(prox.quando))) problemas.push(`${onde}: 1º aviso ${avisos(store)[0]}, devia ${fmt(new Date(prox.quando))}`);
        fireEvent.click(caixa());
        const d2 = marcas(log(store));
        const novos2 = [...d2].filter((k) => !antes.has(k));
        const tirados2 = [...antes].filter((k) => !d2.has(k));
        if (novos2.length > 1) problemas.push(`${onde}: 2 toques marcaram ${novos2.length} doses`);
        if (estado !== "nada" && !marcadoAntes && tirados2.length) problemas.push(`${onde}: 2 toques tiraram dose tomada`);
        cleanup();
        esquecerMarcasDaCaixa();
      }
    }
  }
  return problemas;
}
const doDia5 = (n: number, p: string) => montarLinhas({ name: "Amoxicilina", stock: 50 }, gerarHorarios(p, n), "2026-11-13", new Date(2026, 10, 5, 7, 50).getTime(), `2026-11-05T${p}`);

describe("crítica de fora, rodada 3 — varredura da caixa (passa hoje)", () => {
  it("meio do tratamento (07/11 e 08/11)", () => { expect(varrer(doDia5, 7, 0, 48 * 60)).toEqual([]); }, 120_000);
  it("último dia e a noite dele (13/11 e 14/11)", () => { expect(varrer(doDia5, 13, 0, 48 * 60)).toEqual([]); }, 120_000);
  it("1º dia: cadastro às 21:30 com a sugestão e com 'Começa amanhã'", () => {
    const sugestao = (n: number, p: string) => montarLinhas({ name: "Amoxicilina", stock: 50 }, gerarHorarios(p, n), "2026-11-13", new Date(2026, 10, 7, 21, 30).getTime());
    const amanha = (n: number, p: string) => montarLinhas({ name: "Amoxicilina", stock: 50 }, gerarHorarios(p, n), "2026-11-13", new Date(2026, 10, 7, 21, 30).getTime(), `2026-11-08T${p}`);
    expect([...varrer(sugestao, 7, 21 * 60 + 40, 48 * 60), ...varrer(amanha, 7, 21 * 60 + 40, 48 * 60)]).toEqual([]);
  }, 120_000);
});
