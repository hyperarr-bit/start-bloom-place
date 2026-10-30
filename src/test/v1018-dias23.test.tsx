/**
 * 1.0.18 (22/10) — DIAS 2 E 3 DO TESTE (chave remota `dias23`, lib/dias23), sempre com CONTA VAZIA (sem seeds):
 *   · off (padrão): o teste de hoje, igual — "Amanhã: Rotina" no dia 1, "Dia 2: Rotina" no dia 2, nada de resumo ao
 *     abrir no dia 3, nenhum campo/evento novo;
 *   · on, dia 1: a folha "Dia 1 feito" promete o que fica pronto amanhã (com Finanças: "Quanto dá pra gastar amanhã");
 *   · on, dia 2: ao abrir, 1x, "Ficou pronto · Hoje dá pra gastar R$ X" + "Dia 2: escolhe o seu" (3 módulos pessoais);
 *     escolher abre o módulo e a INTRO dele é a dose 2 (nunca o passo guiado por cima; o fim da intro grava a dose);
 *   · on, dia 3: "Você construiu isso em 3 dias" ao ABRIR (sem a 3ª dose), 1x; o convite da dose 3 não vem por cima;
 *   · reabrir o app (e sair da conta) não repete nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString(), user_metadata: {} as Record<string, unknown> }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: vi.fn(async () => true) }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, user_metadata: conta.user_metadata }, isSubscribed: true }),
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu"),
  agendarProximaDose: vi.fn(async () => ({ ok: true, quando: new Date() })),
  estadoPermissao: vi.fn(async () => "granted"),
  armarLembreteDoTesteSePuder: vi.fn(async () => {}),
}));
/* o resumo de verdade usa Home/Conquistas inteiras — aqui uma tela com o mesmo contrato (o bloco 6 testa a de verdade) */
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", async (orig) => {
  const real = await orig<typeof import("@/components/missao-doses/ConstruiuEm3Dias")>();
  return {
    ...real,
    ConstruiuEm3Dias: function ConstruiuFalso({ aoContinuar, aoAbrir, aoVer, aoFazerDose, missao, braco }: { aoContinuar: () => void; aoAbrir?: boolean; aoVer?: () => void; aoFazerDose?: (p: { n: 1 | 2 | 3; modulo: string }) => void; missao: { feitos: Record<number, unknown>; modulos: string[] }; braco?: string }) {
      const { useEffect } = require("react") as typeof import("react");
      useEffect(() => { aoVer?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
      const n = ([1, 2, 3] as const).find((k) => !missao.feitos[k]);
      return (
        <div data-testid="construiu" data-ao-abrir={aoAbrir ? "1" : "0"} data-braco={braco ?? ""}>
          <button type="button" data-testid="construiu-continuar" onClick={aoContinuar}>Continuar</button>
          {aoFazerDose && n && <button type="button" data-testid="construiu-dose" onClick={() => aoFazerDose({ n, modulo: missao.modulos[n - 1] })}>Dose</button>}
        </div>
      );
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } } }));

import { UserDataContext } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { PlanoDeAmanhaA } from "@/components/missao-doses/PlanoDeAmanhaA";
import { EVENTO_ABRIR_ESCOLHA_DIA2 } from "@/components/missao-doses/LinhaDoseDeHoje";
import { linhaDoFeitoNoResumo } from "@/components/missao-doses/ConstruiuEm3Dias";
import {
  CHAVE_ESTADO_MISSAO_DOSES, ROTULO_DOSE_PELA_INTRO, comEscolha2, construiuAoAbrirDevido, definirDonoDaMissao, escolhaDoDia2Devida, eventoDaMissao, iniciarMissao,
  introEhADoseDoDia2, lerMissao, missaoEmAndamento, moduloDaMissaoHoje, opcoesDoDia2,
} from "@/lib/missao-doses";
import { _zerarUmPorDiaRemoto, registrarUmPorDiaRemoto } from "@/lib/dia1-cheio";
import { CHAVE_DIAS23_APARELHO, CHAVE_FORCA_DIAS23, _zerarDias23Remoto, dias23Ligado, guardarForcaDias23, lerDias23Remoto, modoDias23, registrarDias23Remoto } from "@/lib/dias23";
import { _novaAberturaDoTour, marcarTourFeito } from "@/lib/tour-home";
import { avisarFimDaIntro, porQueNaoMostrar } from "@/lib/intro-modulo";
import { conteudoDaMissao } from "@/lib/lembrete-dia2";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

/* ------------------------------------------------------------ o aparelho de mentira (o mesmo do v1016-missao-1-por-dia) */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const set = (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); };
  return { dados, get, set, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [versao, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  const get = useCallback(<T,>(k: string, f: T): T => store.get(k, f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const valor = useMemo(() => ({ get, set: store.set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, store.set]);
  return <UserDataContext.Provider value={valor as never}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const offerings = (meta: Record<string, unknown>) => {
  const current = { identifier: "default", metadata: meta };
  return { current, all: { default: current } };
};
/** braço A pra todos (missao_1_por_dia on) + a chave nova */
const ligar = (dias23?: "on" | "off") => {
  const meta: Record<string, unknown> = { missao_1_por_dia: "on" };
  if (dias23) meta.dias23 = dias23;
  registrarUmPorDiaRemoto(offerings(meta));
  registrarDias23Remoto(offerings(meta));
};
const missaoA = (feitos: Record<number, { dia: string; rotulo: string }>, extra: Record<string, unknown> = {}) =>
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, lembrete: "8h", feitos, ...extra }));
const iphone = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
/** Finanças montada no dia 1: renda + 1 conta fixa (o "quanto dá pra gastar" existe) */
const comFinancas = () => montarStore({ "finance-incomes": [{ id: 1, value: 3000 }], "finance-fixed-expenses": [{ id: 2, name: "Aluguel", value: 1200 }] });
const DIA1 = { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } };

beforeEach(() => {
  localStorage.clear();
  definirDonoDaMissao(null);
  _novaAberturaDoTour();
  marcarTourFeito(); // o tour curto da Home já foi (o bloco 9 do v1016 cobre a ordem tour → plano)
  eventos.length = 0;
  _zerarUmPorDiaRemoto();
  _zerarDias23Remoto();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  conta.user_metadata = {};
  iphone();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026 — dia 1 da missão
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ 0: a chave */

describe("0. a chave remota `dias23`", () => {
  it("ausente/estranha = off; 'on' em qualquer offering (a current vence); a última resposta fica no aparelho; QA ?dias23=", () => {
    expect(lerDias23Remoto(null)).toBe("off");
    expect(lerDias23Remoto(offerings({}))).toBe("off");
    expect(lerDias23Remoto(offerings({ dias23: "talvez" }))).toBe("off");
    expect(lerDias23Remoto(offerings({ dias23: "ON" }))).toBe("on");
    const o = { current: { metadata: { dias23: "off" } }, all: { a: { metadata: { dias23: "on" } } } };
    expect(lerDias23Remoto(o)).toBe("off");
    expect(modoDias23()).toBe("off");
    registrarDias23Remoto(offerings({ dias23: "on" }));
    expect(dias23Ligado()).toBe(true);
    expect(localStorage.getItem(CHAVE_DIAS23_APARELHO)).toBe("on");
    _zerarDias23Remoto(); // nova abertura, RevenueCat ainda não respondeu: vale a cópia do aparelho
    expect(dias23Ligado()).toBe(true);
    expect(vassouraLeva(CHAVE_DIAS23_APARELHO)).toBe(false);
    guardarForcaDias23("?dias23=off");
    expect(dias23Ligado()).toBe(false);
    guardarForcaDias23("?dias23=auto");
    expect(localStorage.getItem(CHAVE_FORCA_DIAS23)).toBeNull();
    expect(dias23Ligado()).toBe(true);
  });

  it("só no braço A: com a missão do braço B (ou sem braço) nada muda, mesmo com a chave ligada", () => {
    registrarDias23Remoto(offerings({ dias23: "on" }));
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true, feitos: DIA1 }));
    vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
    expect(escolhaDoDia2Devida(lerMissao())).toBe(false);
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
    expect(construiuAoAbrirDevido(lerMissao())).toBe(false);
  });
});

/* ------------------------------------------------------------ 1: off = o de hoje */

describe("1. chave desligada (padrão) = o teste de hoje", () => {
  it("dia 1: 'Amanhã: Rotina' sem promessa; dia 2: 'Dia 2: Rotina'; dia 3 sem a 3ª dose: nada de resumo; nenhum campo/evento novo", () => {
    ligar(); // missao_1_por_dia on, dias23 ausente
    const store = comFinancas();
    render(<Provedor store={store}><PlanoDeAmanhaA missao={(missaoA(DIA1), lerMissao()!)} aoCombinar={() => {}} aoSemLembrete={() => {}} /></Provedor>);
    expect(screen.getByTestId("plano-amanha-a-amanha")).toHaveTextContent(/^Amanhã: Rotina$/);
    expect(screen.queryByTestId("plano-amanha-a-promessa")).toBeNull();
    expect(screen.getByTestId("plano-amanha-a")).toHaveTextContent("Que horas te lembro?");
    cleanup();

    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-convite-depois"));
    cleanup();

    vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
    montar(store, "/home");
    avancar(1500);
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
    const m = lerMissao()!;
    expect(m.escolha2).toBeUndefined();
    expect(m.fimAoAbrir).toBeUndefined();
    expect(eventoDaMissao({})).not.toHaveProperty("dias23");
    for (const n of ["dia1_promessa_view", "dia2_pronto_view", "dia2_escolha_view", "dia2_escolhido", "dia3_construiu_view"]) expect(eventos.map((e) => e[0])).not.toContain(n);
    // o lembrete do dia 2 é o de sempre (aponta pra dose)
    expect(conteudoDaMissao({ ...m, feitos: DIA1, convites: {} }, "2026-10-03")?.rota).toBe("/rotina");
  });
});

/* ------------------------------------------------------------ 2: dia 1 promete */

describe("2. on, dia 1: a folha do fim do dia promete o que fica pronto amanhã", () => {
  it("com Finanças montada: 'Amanhã fica pronto · Quanto dá pra gastar amanhã' com a hora escolhida; evento dia1_promessa_view", () => {
    ligar("on");
    missaoA(DIA1);
    render(<Provedor store={comFinancas()}><PlanoDeAmanhaA missao={lerMissao()!} aoCombinar={() => {}} aoSemLembrete={() => {}} /></Provedor>);
    expect(screen.getByTestId("plano-amanha-a-titulo")).toHaveTextContent(/^Dia 1 feito 💛$/);
    const p = screen.getByTestId("plano-amanha-a-promessa");
    expect(p).toHaveAttribute("data-promessa", "numero");
    expect(p).toHaveTextContent("Quanto dá pra gastar amanhã");
    expect(p).toHaveTextContent("com o que você anotou hoje");
    expect(screen.getByTestId("plano-amanha-a")).toHaveTextContent("Amanhã fica pronto");
    expect(screen.getByTestId("plano-amanha-a")).toHaveTextContent("Que horas te aviso?");
    expect(screen.queryByTestId("plano-amanha-a-amanha")).toBeNull(); // sem "Amanhã: Rotina" — o dia 2 é a escolha dela
    expect(screen.getByTestId("plano-amanha-a-promessa-hora")).toHaveTextContent("Amanhã · 12h"); // 15:10 → 12h
    fireEvent.click(screen.getByTestId("plano-a-hora-8h"));
    expect(screen.getByTestId("plano-amanha-a-promessa-hora")).toHaveTextContent("Amanhã · 8h");
    expect(eventos).toContainEqual(["dia1_promessa_view", expect.objectContaining({ promessa: "numero", dia_do_teste: 1, dias23: "on" })]);
    // nada de "Apple cobra" nem ponto final no título
    expect(screen.getByTestId("plano-amanha-a")).not.toHaveTextContent(/Apple|24 h/);
  });

  it("sem Finanças (área corpo, conta vazia): a promessa é a escolha do 2º módulo", () => {
    ligar("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Treino A" } });
    render(<Provedor store={montarStore({})}><PlanoDeAmanhaA missao={lerMissao()!} aoCombinar={() => {}} aoSemLembrete={() => {}} /></Provedor>);
    const p = screen.getByTestId("plano-amanha-a-promessa");
    expect(p).toHaveAttribute("data-promessa", "escolha");
    expect(p).toHaveTextContent("Você escolhe o seu 2º módulo");
  });
});

/* ------------------------------------------------------------ 3: dia 2 */

describe("3. on, dia 2: o número pronto + 'escolhe o seu' (1x) → a intro do módulo escolhido é a dose 2", () => {
  it("abre → 'Ficou pronto · Hoje dá pra gastar R$ X' + 3 módulos da área → 'Começar Beleza' → /beleza; a intro abre (não o passo guiado); 'Pronto' grava a dose 2", () => {
    ligar("on");
    const store = comFinancas();
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
    montar(store, "/home");
    expect(screen.queryByTestId("dia2-escolha")).toBeNull(); // espera a Home assentar
    avancar(1500);
    expect(screen.getByTestId("dia2-pronto-valor")).toHaveTextContent(/^Hoje dá pra gastar R\$ \d+$/);
    expect(screen.getByTestId("dia2-escolha-titulo")).toHaveTextContent(/^Dia 2: escolhe o seu$/);
    // área dinheiro (padrão): Casa · Beleza · Estudos
    for (const mod of ["casa", "beleza", "estudos"]) expect(screen.getByTestId(`dia2-opcao-${mod}`)).toBeInTheDocument();
    expect(screen.queryByTestId("dia2-opcao-rotina")).toBeNull();
    expect(screen.queryByTestId("missao-doses-convite-titulo")).toBeNull(); // nada de "Dia 2: Rotina"
    expect(screen.getByTestId("dia2-escolha-comecar")).toHaveTextContent(/^Começar Casa$/);
    expect(eventos).toContainEqual(["dia2_pronto_view", expect.objectContaining({ dia_do_teste: 2, dias23: "on" })]);
    expect(eventos).toContainEqual(["dia2_escolha_view", expect.objectContaining({ dia_do_teste: 2, opcoes: ["casa", "beleza", "estudos"], via: "abertura" })]);
    // nunca valor em reais em evento
    for (const [n, d] of eventos) if (n.startsWith("dia2")) expect(JSON.stringify(d)).not.toMatch(/R\$/);

    fireEvent.click(screen.getByTestId("dia2-opcao-beleza"));
    expect(screen.getByTestId("dia2-escolha-comecar")).toHaveTextContent(/^Começar Beleza$/);
    fireEvent.click(screen.getByTestId("dia2-escolha-comecar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/beleza");
    const m = lerMissao()!;
    expect(m.modulos).toEqual(["financas", "beleza", "rotina"]); // Rotina vai pro dia 3
    expect(m.escolha2).toMatchObject({ modulo: "beleza", via: "comecar", de: "rotina", dia: "2026-10-04" });
    expect(m.convites).toEqual({ "2026-10-04": "foi" });
    expect(eventos).toContainEqual(["dia2_escolhido", expect.objectContaining({ modulo: "beleza", posicao: 2, de: "rotina", dia_do_teste: 2 })]);

    // no módulo: a INTRO da Beleza abre (a missão não bloqueia) e o passo guiado da missão NÃO monta
    avancar(3000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull();
    expect(introEhADoseDoDia2(m, "beleza")).toBe(true);
    expect(porQueNaoMostrar("beleza", store.get)).toBeNull();
    expect(moduloDaMissaoHoje()).toBe("beleza");

    // a intro termina ("Pronto") → a dose 2 está feita, com o rótulo neutro
    act(() => { avisarFimDaIntro("beleza", "feita"); });
    const depois = lerMissao()!;
    expect(depois.feitos[2]).toEqual({ dia: "2026-10-04", rotulo: ROTULO_DOSE_PELA_INTRO });
    expect(introEhADoseDoDia2(depois, "beleza")).toBe(false);
    expect(eventos).toContainEqual(["dia2_dose_feita", expect.objectContaining({ modulo: "beleza", dia_do_teste: 2 })]);
    expect(eventos).toContainEqual(["missao_dose_concluida", expect.objectContaining({ indice: 2, modulo: "beleza", via: "intro" })]);

    // fechar e reabrir no mesmo dia: nada volta
    cleanup();
    montar(store, "/home");
    avancar(4000);
    for (const t of ["dia2-escolha", "missao-doses-convite", "plano-amanha-a", "construiu"]) expect(screen.queryByTestId(t), t).toBeNull();
  });

  it("a intro de OUTRO módulo (aberto por curiosidade) não grava a dose; 'Pular' na intro escolhida deixa a dose pulada hoje", () => {
    ligar("on");
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(comEscolha2(lerMissao()!, "casa", "comecar", "2026-10-04")));
    act(() => { avisarFimDaIntro("dieta", "feita"); });
    expect(lerMissao()!.feitos[2]).toBeUndefined();
    montar(montarStore({}), "/home");
    act(() => { avisarFimDaIntro("casa", "pulada"); });
    expect(lerMissao()!.feitos[2]).toBeUndefined();
    expect(lerMissao()!.pulados).toEqual({ 2: "2026-10-04" });
    expect(eventos).toContainEqual(["dia2_dose_pulada", expect.objectContaining({ modulo: "casa" })]);
  });

  it("'Agora não': nada escolhido, a folha não volta ao reabrir nem depois do logout; a linha das Pendências reabre (toque dela)", () => {
    ligar("on");
    const store = comFinancas();
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 4, 20, 0));
    montar(store, "/home");
    avancar(1500);
    fireEvent.click(screen.getByTestId("dia2-escolha-depois"));
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
    expect(lerMissao()!.escolha2).toBeUndefined();
    expect(lerMissao()!.convites).toEqual({ "2026-10-04": "depois" });
    expect(eventos).toContainEqual(["dia2_escolha_agora_nao", expect.objectContaining({ dia_do_teste: 2 })]);
    cleanup();
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
    cleanup();
    purgeLocalUserCache();
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
    // o toque na linha "Dose de hoje · escolhe o seu" reabre
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ESCOLHA_DIA2)); });
    expect(screen.getByTestId("dia2-escolha")).toBeInTheDocument();
    expect(eventos).toContainEqual(["dia2_escolha_view", expect.objectContaining({ via: "pendencias" })]);
  });

  it("fechou o app com a folha aberta, sem decidir: volta 1 vez naquele dia, depois nunca mais", () => {
    ligar("on");
    const store = comFinancas();
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
    for (let vez = 1; vez <= 2; vez++) {
      montar(store, "/home");
      avancar(1500);
      expect(screen.getByTestId("dia2-escolha"), `abertura ${vez}`).toBeInTheDocument();
      cleanup();
    }
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
    expect(lerMissao()!.convitesVistos).toEqual({ "2026-10-04": 2 });
  });

  it("as opções: sem o módulo da dose 1, sem módulo com intro já vista ou com dado; a área manda (corpo: Dieta · Beleza · Casa)", () => {
    ligar("on");
    missaoA(DIA1);
    const m = lerMissao()!;
    const pode = (vistos: string[]) => (mod: string) => !vistos.includes(mod);
    expect(opcoesDoDia2(m, "dinheiro", pode([]))).toEqual(["casa", "beleza", "estudos"]);
    expect(opcoesDoDia2(m, "dinheiro", pode(["casa"]))).toEqual(["beleza", "estudos", "dieta"]);
    expect(opcoesDoDia2(m, "corpo", pode([]))).toEqual(["dieta", "beleza", "casa"]);
    expect(opcoesDoDia2({ ...m, modulos: ["desenvolvimento", "financas", "rotina"] }, "metas", pode([]))).toEqual(["estudos", "beleza", "casa"]);
    expect(opcoesDoDia2(m, "dinheiro", () => false)).toEqual([]);
  });

  it("sem opção (todas as intros já vistas): cai no convite de sempre 'Dia 2: Rotina'", () => {
    ligar("on");
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
    montar(montarStore({ "core-intro-vistas": ["casa", "beleza", "estudos", "dieta", "desenvolvimento", "detox"] }), "/home");
    avancar(1500);
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
  });

  it("o lembrete do dia 2 (agendado no dia 1) leva o número pronto e abre a Home", () => {
    ligar("on");
    missaoA(DIA1);
    const c = conteudoDaMissao(lerMissao(), "2026-10-03", comFinancas().get);
    expect(c?.title).toMatch(/^Hoje dá pra gastar até R\$ \d+$/);
    expect(c?.body).toBe("Ficou pronto. E hoje você escolhe o seu 2º módulo.");
    expect(c?.rota).toBe("/home");
    const sem = conteudoDaMissao(lerMissao(), "2026-10-03", montarStore({}).get);
    expect(sem?.title).toBe("Dia 2: escolhe o seu");
  });
});

/* ------------------------------------------------------------ 4: dia 3 */

describe("4. on, dia 3: 'Você construiu isso em 3 dias' AO ABRIR (sem a 3ª dose), 1x", () => {
  it("abre no dia 3 com 2 doses → resumo (aoAbrir) → Continuar → reabrir não volta; o convite da dose 3 não vem por cima no mesmo dia", () => {
    ligar("on");
    const store = comFinancas();
    missaoA({ ...DIA1, 2: { dia: "2026-10-04", rotulo: ROTULO_DOSE_PELA_INTRO } }, { modulos: ["financas", "beleza", "rotina"], escolha2: { modulo: "beleza", dia: "2026-10-04", via: "comecar", de: "rotina" } });
    vi.setSystemTime(new Date(2026, 9, 5, 8, 30));
    expect(missaoEmAndamento(lerMissao())).toBe(true); // o tour/dicas esperam o resumo
    montar(store, "/home");
    expect(screen.queryByTestId("construiu")).toBeNull(); // espera a Home assentar
    avancar(1500);
    expect(screen.getByTestId("construiu")).toHaveAttribute("data-ao-abrir", "1");
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    fireEvent.click(screen.getByTestId("construiu-continuar"));
    expect(lerMissao()).toMatchObject({ fimVisto: true, fimAoAbrir: "2026-10-05" });
    avancar(4000);
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // uma camada por abertura
    cleanup();
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    cleanup();
    purgeLocalUserCache();
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("construiu")).toBeNull();
    // no dia seguinte a dose 3 (Rotina) volta a ser convidada, como sempre
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
    montar(store, "/home");
    avancar(1500);
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 3: Rotina");
  });

  it("29/10: fechou o app com o resumo na tela, sem 'Continuar': NÃO volta (vista = vista)", () => {
    ligar("on");
    const store = comFinancas();
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
    avancar(3000); // a vista contada não tira a tela que está aberta
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
    cleanup();
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // e o convite não entra no lugar dele no mesmo dia
    expect(lerMissao()).toMatchObject({ fimAoAbrirVistas: 1, fimAoAbrir: "2026-10-05" });
  });

  it("29/10 (A/B): no dia 3 o botão É a dose de hoje — grava visto, leva direto pro módulo da dose 3, conta o toque com `botao` e o braço; reabrir não volta", () => {
    ligar("on");
    const store = comFinancas();
    missaoA({ ...DIA1, 2: { dia: "2026-10-04", rotulo: "Beber água ao acordar" } });
    vi.setSystemTime(new Date(2026, 9, 5, 8, 30));
    montar(store, "/home");
    avancar(1500);
    const tela = screen.getByTestId("construiu");
    expect(tela.getAttribute("data-braco")).toMatch(/^[ab]$/);
    fireEvent.click(screen.getByTestId("construiu-dose"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/saude");
    expect(lerMissao()).toMatchObject({ fimVisto: true, fimAoAbrir: "2026-10-05", convites: { "2026-10-05": "foi" } });
    expect(eventos).toContainEqual(["missao_doses_fim_fechou", expect.objectContaining({ ao_abrir: true, botao: "dose", dose: 3, modulo: "saude", braco_construiu: tela.getAttribute("data-braco") })]);
    cleanup();
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("construiu")).toBeNull();
  });

  it("29/10: o resumo depois da 3ª dose (sem dias23) também não volta depois de visto — fechou o app sem 'Continuar' → vira visto", () => {
    ligar("off");
    const store = comFinancas();
    missaoA({ ...DIA1, 2: { dia: "2026-10-04", rotulo: "Beber água ao acordar" }, 3: { dia: "2026-10-05", rotulo: "1 copo d'água · meta 8" } });
    vi.setSystemTime(new Date(2026, 9, 5, 20, 0));
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("construiu")).toHaveAttribute("data-ao-abrir", "0");
    avancar(3000);
    expect(screen.getByTestId("construiu")).toBeInTheDocument(); // a vista contada não tira a tela aberta
    expect(lerMissao()).toMatchObject({ fimVistas: 1 });
    cleanup(); // fechou o app sem o "Continuar"
    montar(store, "/home");
    avancar(4000);
    expect(screen.queryByTestId("construiu")).toBeNull();
    expect(lerMissao()?.fimVisto).toBe(true);
  });

  it("29/10 (A/B): o 'Continuar' conta o toque com `botao: continuar` e o braço", () => {
    ligar("on");
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 5, 8, 30));
    montar(comFinancas(), "/home");
    avancar(1500);
    fireEvent.click(screen.getByTestId("construiu-continuar"));
    expect(eventos).toContainEqual(["missao_doses_fim_fechou", expect.objectContaining({ ao_abrir: true, botao: "continuar", braco_construiu: expect.stringMatching(/^[ab]$/) })]);
  });

  it("faltou o dia 2 (só a dose 1): o resumo abre mesmo assim no dia 3; nunca no dia 2; nunca depois do 7º dia", () => {
    ligar("on");
    missaoA(DIA1);
    expect(construiuAoAbrirDevido(lerMissao(), "2026-10-04")).toBe(false);
    expect(construiuAoAbrirDevido(lerMissao(), "2026-10-05")).toBe(true);
    expect(construiuAoAbrirDevido(lerMissao(), "2026-10-09")).toBe(true);
    expect(construiuAoAbrirDevido(lerMissao(), "2026-10-10")).toBe(false);
    vi.setSystemTime(new Date(2026, 9, 5, 21, 0));
    montar(comFinancas(), "/home");
    avancar(1500);
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
    expect(screen.queryByTestId("dia2-escolha")).toBeNull();
  });

  it("a tela de verdade, aberta no dia 3: título, os 3 números e a linha de cada dose feita (Finanças com o número); dia3_construiu_view", async () => {
    ligar("on");
    missaoA({ ...DIA1, 2: { dia: "2026-10-04", rotulo: ROTULO_DOSE_PELA_INTRO } }, { modulos: ["financas", "beleza", "rotina"] });
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
    const { ConstruiuEm3Dias: Real } = await vi.importActual<typeof import("@/components/missao-doses/ConstruiuEm3Dias")>("@/components/missao-doses/ConstruiuEm3Dias");
    render(<MemoryRouter><Provedor store={comFinancas()}><Real missao={lerMissao()!} aoAbrir aoContinuar={() => {}} /></Provedor></MemoryRouter>);
    expect(screen.getByTestId("missao-doses-fim-titulo")).toHaveTextContent("Seu CORE começou.");
    expect(screen.getByTestId("missao-doses-fim-modulo-financas")).toHaveTextContent("R$ 61 por dia");
    expect(screen.getByTestId("missao-doses-fim-modulo-beleza")).toHaveTextContent("1º passo feito");
    expect(screen.queryByTestId("missao-doses-fim-modulo-rotina")).toBeNull();
    expect(eventos).toContainEqual(["dia3_construiu_view", expect.objectContaining({ dia_do_teste: 3, doses: 2, dias23: "on", braco_construiu: expect.stringMatching(/^[ab]$/) })]);
  });

  it("a linha de cada dose no resumo: Finanças mostra o número, a intro o rótulo neutro", () => {
    missaoA({ ...DIA1, 2: { dia: "2026-10-04", rotulo: ROTULO_DOSE_PELA_INTRO } });
    const m = lerMissao()!;
    expect(linhaDoFeitoNoResumo(m, 1)).toBe("R$ 61 por dia");
    expect(linhaDoFeitoNoResumo(m, 2)).toBe("1º passo feito");
    expect(linhaDoFeitoNoResumo(m, 3)).toBeNull();
  });
});
