/**
 * "ROTINA PRONTA EM 3 TOQUES" (1.0.16) — o que este arquivo trava, com a conta VAZIA (sem seeds):
 *   · os horários saem da hora de acordar (7h → água 7:00, treinar 7:30, estudar 19:00, dormir 22:30…),
 *     a agenda e os hábitos vão pras chaves REAIS da Rotina (e aparecem na Rotina e nas Pendências da Home);
 *   · 3 perguntas → "Montando" → o guia do 1º quadradinho; marcar é o toque normal da Rotina (grade, log,
 *     heatmap = sequência) e é contado uma vez (`_primeiro_marcado`); "Entendi" e marcar depois também conta;
 *   · a estrutura é escrita de SISTEMA (o dia anotado é o 1º quadradinho, não o "montar");
 *   · "Pular" nas perguntas 1 e 2 não grava nada; o lembrete pede a permissão do jeito do app e some quando
 *     ela já foi negada no sistema ou a missão combinou "sem aviso";
 *   · uma vez só: fechar e reabrir no meio volta preenchido 1 vez; pronto/pulou sobrevive à vassoura da
 *     abertura, ao logout e a outro aparelho; quem já tem Rotina, conta antiga, convidado e site não veem;
 *   · o dono (17/10): entrar na Rotina NÃO abre o quiz (só a missão abre); a do módulo cede pra da missão;
 *   · eventos sem dado pessoal (nem hora exata, nem nome de hábito).
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-mr", created_at: "" } as { id: string; created_at?: string } | null }));
const perm = vi.hoisted(() => ({ estado: "prompt" as "granted" | "denied" | "prompt" | "indisponivel", concede: true, pedidos: 0 }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- o encadeamento do cliente do Supabase, mockado
  const q: any = {
    select: () => q, eq: () => q, in: () => Promise.resolve({ data: [], error: null }), order: () => q, limit: () => q, gte: () => q, lte: () => q,
    abortSignal: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  };
  return {
    supabase: {
      from: () => q,
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: auth.user ? { access_token: "token-de-teste", user: { id: auth.user.id } } : null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      rpc: async () => ({ data: null, error: null }),
    },
  };
});
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoSePuder: async () => false }));
vi.mock("@/lib/notificacoes", async (orig) => ({
  ...(await orig<typeof import("@/lib/notificacoes")>()),
  estadoPermissao: vi.fn(async () => perm.estado),
  pedirPermissao: vi.fn(async () => { perm.pedidos += 1; return perm.concede; }),
  armarLembreteDoTesteSePuder: vi.fn(async () => false),
}));

import { UserDataContext, UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { cartoesVistosNesteAparelho } from "@/lib/tour-home";
import { EVENTO_DIA2 } from "@/lib/lembrete-dia2";
import { CHAVE_LEMBRETE_ROTINA_MANHA } from "@/lib/rotina-manha";
import {
  ATRIBUTO_NA_TELA, CHAVE_FORCA_MONTAR_ROTINA, CHAVE_MONTAR_ROTINA, EV_GUIA, EV_PASSO, EV_PERMISSAO, EV_PRIMEIRO, EV_PRONTO, EV_PULAR, EV_VIEW,
  EVENTO_MONTAR_ROTINA_FIM, MONTAR_ROTINA_NO_MODULO, _novaAberturaMontarRotina, _zerarRemotaMontarRotina, agendaParaGravar, deveMostrarMontarRotina,
  guardarForcaMontarRotinaDaUrl, habitosParaGravar, horaDaAgenda, horaFalada, horariosDosItens, inicioDaAgenda, lerChaveRemotaMontarRotina,
  lerRascunhoRotina, linhasDoDia, marcaDoAparelho, marcarMontarRotinaDecidido, montarRotinaJaDecidido, montarRotinaLigado, primeiroDiaMarcado, primeiroMarcadoHoje,
  reaproveitarDoOnboarding, registrarChaveMontarRotina, registrarVistaMontarRotina, temDadosDeRotina, type ItemId, type MarcaRotina,
} from "@/lib/montar-rotina";
import { MontarRotina, ehACelulaDoGuia, quadradinhoDeHoje, recorteDoQuadradinho, type ResumoMontarRotina } from "@/components/rotina/montar/MontarRotina";
import Rotina from "@/pages/Rotina";

const UID = "u-mr";
const HOJE = new Date(2026, 9, 17, 15, 0); // sábado 17/10/2026, 15h (a semana começa na segunda 12/10)
const HOJE_DIA = "2026-10-17";
const HORA = 3600e3;
const TODOS: ItemId[] = ["agua", "treinar", "estudar", "ler", "meditar", "focado", "dormir"];

/* ── app das lojas × site ── */
type ComCapacitor = { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } };
const virarApp = () => { (window as unknown as ComCapacitor).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as unknown as ComCapacitor).Capacitor; };
type Agenda = Record<string, Record<string, string>>;
const marcaDe = (v: unknown) => v as MarcaRotina | undefined;

/** Store em memória que grava o cache local como o provider real e anota as opções de cada escrita. */
type Controle = { dados: () => Record<string, unknown>; escritas: Array<[string, { system?: boolean } | undefined]> };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown, opts?: { system?: boolean }) => {
    ref.current = { ...ref.current, [k]: JSON.parse(JSON.stringify(v ?? null)) };
    controle.escritas.push([k, opts]);
    localStorage.setItem(`u:${UID}:${k}`, JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, [controle]);
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: !auth.user, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const novoControle = (): Controle => ({ dados: () => ({}), escritas: [] });

/** A Rotina de verdade + a tela por cima, como a missão abre (dentro da rota /rotina). */
const montarNaRotina = (props: Partial<React.ComponentProps<typeof MontarRotina>> = {}, inicial: Record<string, unknown> = {}, comTela = true) => {
  const controle = novoControle();
  const Home = () => {
    const d = useLifeHubData();
    const p = pendenciasDeHoje(d, []);
    return <ul data-testid="pendencias">{p.pending.map((x) => <li key={x.label}>{x.label}</li>)}</ul>;
  };
  render(
    <MemoryRouter initialEntries={["/rotina"]}>
      <Provedor inicial={{ "spotlight-done-rotina": "true", ...inicial }} controle={controle}>
        <Routes><Route path="/rotina" element={<><Rotina />{comTela && <MontarRotina origem="missao" esperaMs={0} {...props} />}<Home /></>} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const montarTela = (props: Partial<React.ComponentProps<typeof MontarRotina>> = {}, inicial: Record<string, unknown> = {}) => {
  const controle = novoControle();
  render(
    <MemoryRouter>
      <Provedor inicial={inicial} controle={controle}>
        <MontarRotina agora={HOJE} esperaMs={0} guiarPrimeiro={false} {...props} />
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const respirar = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const nomes = () => eventos.map(([n]) => n);
const tela = () => within(screen.getByTestId("montar-minha-rotina"));

/** As 3 perguntas: 7h (1 toque) → Beber água, Treinar, Estudar, Dormir cedo → lembrete → Montar. */
const responder = async ({ hora = "7h", itens = ["Beber água", "Treinar", "Estudar", "Dormir cedo"], lembrete = "Sim, quero" as string | null } = {}) => {
  await respirar(); // a permissão (estadoPermissao) chega
  fireEvent.click(tela().getByRole("button", { name: hora }));
  await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
  for (const n of itens) fireEvent.click(tela().getByRole("button", { name: n }));
  if (lembrete) {
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(tela().getByText("Quer um lembrete de manhã?")).toBeTruthy();
    fireEvent.click(tela().getByRole("button", { name: lembrete }));
    await respirar();
  }
  fireEvent.click(tela().getByRole("button", { name: "Montar minha rotina" }));
  await respirar();
};

beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  window.scrollBy = (() => {}) as typeof window.scrollBy;
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
  localStorage.clear();
  eventos.length = 0;
  perm.estado = "prompt"; perm.concede = true; perm.pedidos = 0;
  _zerarRemotaMontarRotina();
  _novaAberturaMontarRotina();
  auth.user = { id: UID, created_at: new Date(HOJE.getTime() - 2 * HORA).toISOString() };
  virarApp();
});
afterEach(() => {
  cleanup();
  virarSite();
  vi.useRealTimers();
  document.documentElement.removeAttribute(ATRIBUTO_NA_TELA);
});

/* ───────────────────────── os horários ───────────────────────── */
describe("os horários saem da hora de acordar", () => {
  const ver = (acordar: string, itens: ItemId[]) => horariosDosItens(acordar, itens).map(({ item, min }) => `${horaDaAgenda(min)} ${item.habito}`);

  it("7h com tudo: água 7:00 · treinar 7:30 · trabalho 9:00 · estudar 19:00 · ler 21:30 · meditar 22:00 · dormir 22:30 (na ordem do dia)", () => {
    expect(ver("07:00", TODOS)).toEqual([
      "7:00 Beber água", "7:30 Treinar", "9:00 Trabalhar focado", "19:00 Estudar", "21:30 Ler", "22:00 Meditar", "22:30 Dormir cedo",
    ]);
  });
  it("6h e 8h andam junto; sem 'Dormir cedo' a noite de referência é 8 h antes (ler 22:00, meditar 22:30)", () => {
    expect(ver("06:00", ["agua", "treinar", "dormir"])).toEqual(["6:00 Beber água", "6:30 Treinar", "21:30 Dormir cedo"]);
    expect(ver("08:00", ["estudar", "dormir"])).toEqual(["20:00 Estudar", "23:30 Dormir cedo"]);
    expect(ver("07:00", ["ler", "meditar"])).toEqual(["22:00 Ler", "22:30 Meditar"]);
  });
  it("'Outro' com hora quebrada: tudo cai em meia hora cheia, só o 'Acordar' fica na hora dela", () => {
    expect(ver("06:45", ["treinar", "estudar", "dormir"])).toEqual(["7:30 Treinar", "19:00 Estudar", "22:30 Dormir cedo"]);
    expect(linhasDoDia("06:45", ["agua"])[0]).toEqual({ min: 405, texto: "Acordar · beber água", soSemana: false });
  });
  it("acordar tarde (10h) passa da meia-noite sem quebrar a ordem", () => {
    expect(ver("10:00", ["estudar", "ler", "dormir"])).toEqual(["22:00 Estudar", "0:30 Ler", "1:30 Dormir cedo"]);
  });
  it("como a gente fala: 7h, 7h30, 19h, 0h30", () => {
    expect([420, 450, 1140, 30].map(horaFalada)).toEqual(["7h", "7h30", "19h", "0h30"]);
  });
});

describe("o que vira dado na Rotina", () => {
  it("a ROTINA SEMANAL: cada item na hora, Treinar/Estudar/Trabalho de segunda a sexta, o resto todo dia; célula que já existia não some", () => {
    const agenda = agendaParaGravar("07:00", ["agua", "treinar", "estudar", "dormir"], { "7:00": { Segunda: "Café" } });
    expect(agenda["7:00"]).toEqual({
      Segunda: "Café · Acordar · beber água", Terça: "Acordar · beber água", Quarta: "Acordar · beber água", Quinta: "Acordar · beber água",
      Sexta: "Acordar · beber água", Sábado: "Acordar · beber água", Domingo: "Acordar · beber água",
    });
    expect(agenda["7:30"]).toEqual({ Segunda: "Treinar", Terça: "Treinar", Quarta: "Treinar", Quinta: "Treinar", Sexta: "Treinar" });
    expect(agenda["19:00"].Sábado).toBeUndefined();
    expect(Object.keys(agenda["22:30"])).toHaveLength(7);
  });
  it("os hábitos: na ordem do dia, sem repetir o que já existe", () => {
    expect(habitosParaGravar("07:00", ["dormir", "agua", "estudar"])).toEqual(["Beber água", "Estudar", "Dormir cedo"]);
    expect(habitosParaGravar("07:00", ["agua", "ler"], ["beber água"])).toEqual(["beber água", "Ler"]);
  });
  it("o 'começa às' da agenda: a hora cheia de acordar, dentro da grade (3:00–9:00); 6:00 é o padrão e não grava", () => {
    expect(["06:00", "07:00", "08:30", "02:00", "11:00"].map(inicioDaAgenda)).toEqual([null, "7:00", "8:00", "3:00", "9:00"]);
  });
});

/* ───────────────────────── a chave ───────────────────────── */
describe("a chave MONTAR_ROTINA", () => {
  it("app: ligada; site: desligada; metadata do RevenueCat manda no app (a current vence)", () => {
    expect(montarRotinaLigado()).toBe(true);
    virarSite();
    expect(montarRotinaLigado()).toBe(false);
    virarApp();
    registrarChaveMontarRotina({ current: { metadata: { montar_rotina: "off" } }, all: {} });
    expect(montarRotinaLigado()).toBe(false);
    expect(lerChaveRemotaMontarRotina({ current: { metadata: {} }, all: { a: { metadata: { montar_rotina: "off" } } } })).toBe("off");
    expect(lerChaveRemotaMontarRotina({ current: { metadata: { montar_rotina: "on" } }, all: { a: { metadata: { montar_rotina: "off" } } } })).toBe("on");
    expect(lerChaveRemotaMontarRotina(null)).toBeNull();
  });
  it("QA no navegador: ?montar-rotina=on liga no site e pula a régua de conta nova; recomecar apaga o 'já vi'; não existe no app", () => {
    virarSite();
    guardarForcaMontarRotinaDaUrl("?montar-rotina=on");
    expect(montarRotinaLigado()).toBe(true);
    const vazio = <T,>(_k: string, f: T) => f;
    expect(deveMostrarMontarRotina({ criadoEm: "2025-01-01T00:00:00Z", get: vazio, isGuest: false })).toBe(true);
    marcarMontarRotinaDecidido("pulou", "missao");
    expect(guardarForcaMontarRotinaDaUrl("?montar-rotina=recomecar")).toBe(true);
    expect(marcaDoAparelho()).toBeNull();
    guardarForcaMontarRotinaDaUrl("?montar-rotina=auto");
    expect(localStorage.getItem(CHAVE_FORCA_MONTAR_ROTINA)).toBeNull();
    virarApp();
    localStorage.setItem(CHAVE_FORCA_MONTAR_ROTINA, "off");
    expect(montarRotinaLigado()).toBe(true);
  });
});

/* ───────────────────────── a régua ───────────────────────── */
describe("quem vê", () => {
  const vazio = <T,>(_k: string, f: T) => f;
  const com = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const criadoEm = () => auth.user!.created_at;

  it("conta nova + Rotina vazia (a agenda padrão em branco não conta) → vê", () => {
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: com({ "rotina-schedule": { "6:00": { Segunda: "" } }, "rotina-habits": [] }), isGuest: false })).toBe(true);
  });
  it("conta antiga (≥ 48 h), convidado e demo → não", () => {
    expect(deveMostrarMontarRotina({ criadoEm: new Date(HOJE.getTime() - 49 * HORA).toISOString(), get: vazio, isGuest: false })).toBe(false);
    expect(deveMostrarMontarRotina({ criadoEm: undefined, get: vazio, isGuest: false })).toBe(false);
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: vazio, isGuest: true })).toBe(false);
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: vazio, isGuest: false, isPreview: true })).toBe(false);
  });
  it("QUALQUER dado de Rotina → não (cliente que já usa nunca vê)", () => {
    for (const dados of [
      { "rotina-habits": ["Ler"] }, { "rotina-habit-log": { [HOJE_DIA]: ["Ler"] } }, { "heatmap-log": { [HOJE_DIA]: true } },
      { "rotina-habits-checked": { SEGUNDA: [true] } }, { "rotina-schedule": { "7:00": { Segunda: "Academia" } } },
      { "ritual-morning-items": [{ id: "1", text: "Café", icon: "☕" }] }, { "ritual-night-items": [{ id: "1", text: "Ler", icon: "📖" }] },
      { "rotina-day-tasks": [{ id: "t", texto: "x", feito: false, dia: HOJE_DIA }] }, { "rotina-urgencies": [{ id: "u", text: "x", done: false }] },
      { "rotina-compromissos": [{ id: "c" }] }, { "month-goals": { "2026-10": [{ id: "g", text: "x", done: false }] } },
    ]) {
      expect(temDadosDeRotina(com(dados)), JSON.stringify(dados)).toBe(true);
      expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: com(dados), isGuest: false })).toBe(false);
    }
  });
  it("já decidido no aparelho OU na conta → não; 2 vistas sem decisão → não", () => {
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: com({ [CHAVE_MONTAR_ROTINA]: { r: "pronto" } }), isGuest: false })).toBe(false);
    marcarMontarRotinaDecidido("pulou", "missao");
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(false);
    localStorage.clear();
    registrarVistaMontarRotina();
    registrarVistaMontarRotina(); // a mesma abertura do app não gasta a 2ª vista
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(true);
    _novaAberturaMontarRotina();
    registrarVistaMontarRotina();
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(false);
  });
  it("o dono (17/10): entrar na Rotina NÃO abre o quiz — conta nova e vazia, chave ligada, e a Rotina abre como sempre", async () => {
    expect(MONTAR_ROTINA_NO_MODULO).toBe(false);
    expect(deveMostrarMontarRotina({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(true); // a missão abriria
    montarNaRotina({}, {}, false);
    await respirar();
    expect(screen.queryByTestId("montar-minha-rotina")).toBeNull();
    expect(screen.getByText("HÁBITOS DIÁRIOS")).toBeTruthy();
    expect(marcaDoAparelho()).toBeNull(); // nada contado, nada gravado
  });
});

/* ───────────────────────── o que o onboarding já respondeu ───────────────────────── */
describe("reaproveita o que já foi respondido", () => {
  const com = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const local = (dados: Record<string, string>) => (k: string) => dados[k] ?? null;
  it("permissão negada no sistema → a pergunta do lembrete sai; 'sem aviso' na missão também", () => {
    expect(reaproveitarDoOnboarding({ get: com({}), permissao: "denied", ler: local({}) }).lembrete).toBe("negado");
    expect(reaproveitarDoOnboarding({ get: com({}), permissao: "granted", ler: local({ "core-dia2": JSON.stringify({ horaEscolhida: "sem" }) }) }).lembrete).toBe("sem_aviso");
    expect(reaproveitarDoOnboarding({ get: com({}), permissao: "prompt", ler: local({}) }).lembrete).toBe("perguntar");
  });
  it("o 'começa às' da agenda vem marcado; respostas de quiz que citam um item marcam o chip", () => {
    const r = reaproveitarDoOnboarding({
      get: com({ "rotina-agenda-inicio": "5:30" }),
      ler: local({
        "funnel-quiz-answers": JSON.stringify({ atrapalha: "Beber água", vitoria: "Dormir melhor essa semana" }),
        "core-funil-w-respostas": JSON.stringify({ v: { vitoria: "Treinar a semana sem furar" }, t: Date.now() }),
      }),
    });
    expect(r).toMatchObject({ opcao: "outro", outro: "05:30", itens: ["agua", "treinar", "dormir"] });
    expect(reaproveitarDoOnboarding({ get: com({ "rotina-agenda-inicio": "8:00" }), ler: local({}) }).opcao).toBe("8h");
  });
  it("na tela: com a permissão já negada, a 2ª pergunta é a última e monta direto (sem lembrete)", async () => {
    perm.estado = "denied";
    const controle = montarTela();
    await respirar();
    expect(tela().getByText(/1 de 2/)).toBeTruthy();
    await responder({ lembrete: null });
    expect(controle.dados()[CHAVE_LEMBRETE_ROTINA_MANHA]).toBeUndefined();
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ lembrete: false, lembrete_pulado: "negado" });
    expect(perm.pedidos).toBe(0);
  });
  it("na tela: chips que o quiz citou já vêm marcados (e o evento conta o reaproveitamento)", async () => {
    localStorage.setItem("funnel-quiz-answers", JSON.stringify({ atrapalha: "Beber água" }));
    montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "8h" }));
    await waitFor(() => expect(tela().getByRole("button", { name: "Beber água" }).getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Agora não" }));
    fireEvent.click(tela().getByRole("button", { name: "Montar minha rotina" }));
    await respirar();
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ itens: 1, acordar: "8h", reaproveitou: ["itens"] });
  });
});

/* ───────────────────────── a tela ───────────────────────── */
describe("a tela, com a conta vazia", () => {
  it("3 perguntas → grava hábitos, agenda, 'começa às' e o lembrete nas chaves da Rotina; eventos sem dado pessoal", async () => {
    const onPronto = vi.fn();
    const fim = vi.fn();
    window.addEventListener(EVENTO_MONTAR_ROTINA_FIM, fim as EventListener);
    const controle = montarTela({ onPronto, origem: "missao" });
    expect(document.documentElement.getAttribute(ATRIBUTO_NA_TELA)).toBe("missao");
    expect(screen.getByText("Que horas você acorda?")).toBeTruthy();
    await responder();

    const d = controle.dados();
    expect(d["rotina-habits"]).toEqual(["Beber água", "Treinar", "Estudar", "Dormir cedo"]);
    const agenda = d["rotina-schedule"] as Record<string, Record<string, string>>;
    expect(agenda["7:00"].Quarta).toBe("Acordar · beber água");
    expect(agenda["7:30"].Quarta).toBe("Treinar");
    expect(agenda["19:00"].Quarta).toBe("Estudar");
    expect(agenda["22:30"].Domingo).toBe("Dormir");
    expect(d["rotina-agenda-inicio"]).toBe("7:00");
    expect(d[CHAVE_LEMBRETE_ROTINA_MANHA]).toEqual({ ligado: true, hora: "07:15" });
    // a estrutura vai como escrita de SISTEMA: não é o dia anotado (o 1º quadradinho é)
    for (const k of ["rotina-habits", "rotina-schedule", "rotina-agenda-inicio", CHAVE_LEMBRETE_ROTINA_MANHA]) {
      expect(controle.escritas.find(([c]) => c === k)?.[1], k).toEqual({ system: true });
    }
    expect(d["core-dias-anotados"]).toBeUndefined();
    // feito: no aparelho e na conta; as boas-vindas da Rotina não voltam
    expect(marcaDoAparelho()?.r).toBe("pronto");
    expect(marcaDe(d[CHAVE_MONTAR_ROTINA])?.r).toBe("pronto");
    expect(cartoesVistosNesteAparelho("rotina")).toBe(true);
    expect(d["core-tip-seen-rotina"]).toBe("true");
    expect(lerRascunhoRotina()).toBeNull();

    expect(fim).toHaveBeenCalledTimes(1);
    expect((fim.mock.calls[0][0] as CustomEvent).detail).toEqual({ resultado: "pronto", itens: 4 });
    window.removeEventListener(EVENTO_MONTAR_ROTINA_FIM, fim as EventListener);
    await waitFor(() => expect(onPronto).toHaveBeenCalledTimes(1));
    expect(onPronto.mock.calls[0][0] as ResumoMontarRotina).toEqual({
      itens: 4, acordar: "7h", hora: "07:00", lembrete: true, primeiroMarcado: false,
      primeiro: { id: "agua", nome: "Beber água", hora: "07:00" },
    });
    expect(screen.queryByTestId("montar-minha-rotina")).toBeNull();
    expect(document.documentElement.hasAttribute(ATRIBUTO_NA_TELA)).toBe(false);

    expect(nomes()).toEqual([EV_VIEW, EV_PASSO, EV_PASSO, EV_PASSO, EV_PERMISSAO, EV_PRONTO, EV_PASSO]);
    expect(eventos.filter(([n]) => n === EV_PASSO).map(([, e]) => e.n)).toEqual([1, 2, 3, 4]);
    expect(eventos.find(([n]) => n === EV_VIEW)![1]).toEqual({ origem: "missao", retomou: false });
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toEqual({ itens: 4, lembrete: true, acordar: "7h", origem: "missao" });
    for (const [, e] of eventos) expect(JSON.stringify(e)).not.toMatch(/07:00|07:15|Beber|Treinar|Estudar|Dormir/);
  });

  it("o 'Sim' do lembrete pede a permissão UMA vez, do jeito do app, e acorda quem esperava por ela (dia 2 / aviso do teste)", async () => {
    const dia2 = vi.fn();
    window.addEventListener(EVENTO_DIA2, dia2);
    montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "6h" }));
    await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
    fireEvent.click(tela().getByRole("button", { name: "Ler" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(tela().getByText(/Um aviso às 6h15/)).toBeTruthy();
    expect(screen.getByTestId("montar-rotina-previa-aviso").textContent).toContain("Ler");
    fireEvent.click(tela().getByRole("button", { name: "Sim, quero" }));
    await respirar();
    expect(perm.pedidos).toBe(1);
    expect(dia2).toHaveBeenCalledTimes(1);
    expect(tela().getByText(/Combinado: todo dia às 6h15/)).toBeTruthy();
    window.removeEventListener(EVENTO_DIA2, dia2);
  });

  it("negou no pedido do sistema: fica na pergunta, 'Agora não' marcado, e monta sem lembrete", async () => {
    perm.concede = false;
    const controle = montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "7h" }));
    await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
    fireEvent.click(tela().getByRole("button", { name: "Meditar" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Sim, quero" }));
    await respirar();
    expect(tela().getByText(/desligadas neste celular/)).toBeTruthy();
    expect(tela().getByRole("button", { name: "Agora não" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tela().getByRole("button", { name: "Montar minha rotina" }));
    await respirar();
    expect(controle.dados()[CHAVE_LEMBRETE_ROTINA_MANHA]).toBeUndefined();
    expect(eventos.find(([n]) => n === EV_PERMISSAO)![1]).toEqual({ concedida: false, origem: "modulo" });
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ lembrete: false });
  });

  it("'Outro horário' abre o relógio; sem hora não segue; o evento diz 'outro' (nunca a hora)", async () => {
    const controle = montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "Outro horário" }));
    expect(tela().getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", true);
    fireEvent.change(tela().getByLabelText("Hora em que você acorda"), { target: { value: "05:30" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Treinar" }));
    expect(screen.getByTestId("montar-rotina-previa").textContent).toContain("6:00Treinar");
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Agora não" }));
    fireEvent.click(tela().getByRole("button", { name: "Montar minha rotina" }));
    await respirar();
    expect(controle.dados()["rotina-agenda-inicio"]).toBe("5:00");
    expect((controle.dados()["rotina-schedule"] as Agenda)["5:30"].Sábado).toBe("Acordar");
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ acordar: "outro", itens: 1 });
  });

  it("a 2ª pergunta não segue sem nenhum item; Voltar guarda as respostas", async () => {
    montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "8h" }));
    await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
    expect(tela().getByRole("button", { name: "Escolhe pelo menos um" })).toHaveProperty("disabled", true);
    fireEvent.click(tela().getByRole("button", { name: "Estudar" }));
    fireEvent.click(tela().getByRole("button", { name: /Voltar/ }));
    expect(tela().getByRole("button", { name: "8h" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(tela().getByRole("button", { name: "Estudar" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("montar-rotina-previa").textContent).toContain("20:00Estudar");
  });

  for (const passo of [1, 2] as const) {
    it(`Pular na pergunta ${passo}: nada gravado na Rotina, marca 'pulou' no aparelho e na conta, evento com o passo`, async () => {
      const onPular = vi.fn();
      const fim = vi.fn();
      window.addEventListener(EVENTO_MONTAR_ROTINA_FIM, fim as EventListener);
      const controle = montarTela({ onPular });
      await respirar();
      if (passo === 2) {
        fireEvent.click(tela().getByRole("button", { name: "7h" }));
        await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
        fireEvent.click(tela().getByRole("button", { name: "Ler" }));
      }
      fireEvent.click(tela().getByRole("button", { name: "Pular" }));
      expect(onPular).toHaveBeenCalledTimes(1);
      for (const k of ["rotina-habits", "rotina-schedule", "rotina-agenda-inicio", CHAVE_LEMBRETE_ROTINA_MANHA]) expect(controle.dados()[k]).toBeUndefined();
      expect(marcaDoAparelho()?.r).toBe("pulou");
      expect(marcaDe(controle.dados()[CHAVE_MONTAR_ROTINA])?.r).toBe("pulou");
      expect(eventos.find(([n]) => n === EV_PULAR)![1]).toEqual({ passo, origem: "modulo" });
      expect((fim.mock.calls[0][0] as CustomEvent).detail).toEqual({ resultado: "pulou", itens: 0 });
      window.removeEventListener(EVENTO_MONTAR_ROTINA_FIM, fim as EventListener);
      expect(screen.queryByTestId("montar-minha-rotina")).toBeNull();
    });
  }
});

/* ───────────────────────── o alvo do guia, sem tela ───────────────────────── */
describe("o alvo do guia: só o quadradinho de hoje do 1º hábito", () => {
  it("a marca guiada é SÓ esse quadradinho: outro hábito hoje ou outro dia não contam", () => {
    const base = { habitos: ["Beber água", "Treinar"], semana: "2026-10-12", habitLog: {}, indice: 0, hoje: HOJE_DIA };
    expect(primeiroMarcadoHoje({ ...base, checked: { "SÁBADO": [true, false] } })).toBe(true);
    expect(primeiroMarcadoHoje({ ...base, checked: { "SÁBADO": [false, true] } })).toBe(false); // outro hábito, hoje
    expect(primeiroMarcadoHoje({ ...base, checked: { SEXTA: [true, false] } })).toBe(false); // outro dia
    // grade de outra semana não vale; o log por data de hoje vale
    expect(primeiroMarcadoHoje({ ...base, semana: "2026-10-05", checked: { "SÁBADO": [true, true] }, habitLog: { [HOJE_DIA]: ["Beber água"] } })).toBe(true);
    expect(primeiroMarcadoHoje({ ...base, semana: "2026-10-05", checked: { "SÁBADO": [true, true] }, habitLog: { "2026-10-16": ["Beber água"] } })).toBe(false);
    expect(primeiroMarcadoHoje({ ...base, indice: 5, checked: { "SÁBADO": [true, true] } })).toBe(false);
  });
  it("o anel é um quadrado justo em volta do checkbox (não a célula, não a coluna); sem tamanho, zero (o post-it fica solto)", () => {
    const td = document.createElement("td");
    const caixa = document.createElement("button");
    caixa.setAttribute("role", "checkbox");
    td.appendChild(caixa);
    const medida = (left: number, top: number, w: number, h: number) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    caixa.getBoundingClientRect = () => medida(100, 200, 16, 16);
    td.getBoundingClientRect = () => medida(60, 190, 100, 36);
    expect(recorteDoQuadradinho(td)).toEqual({ top: 194, left: 94, width: 28, height: 28, bottom: 222 });
    caixa.getBoundingClientRect = () => medida(0, 0, 0, 0);
    expect(recorteDoQuadradinho(td).width).toBe(0);
  });
  it("a célula do guia é conferida pela posição (linha de hoje × coluna do 1º hábito), não pelo nó", () => {
    const tabela = document.createElement("table");
    tabela.innerHTML = "<tbody><tr><td>SEXTA</td><td></td><td></td></tr><tr><td>SÁBADO</td><td></td><td></td></tr></tbody>";
    const [sexta, sabado] = Array.from(tabela.querySelectorAll("tr"));
    expect(ehACelulaDoGuia(sabado.children[1], 0)).toBe(true);
    expect(ehACelulaDoGuia(sabado.children[2], 0)).toBe(false);
    expect(ehACelulaDoGuia(sabado.children[2], 1)).toBe(true);
    expect(ehACelulaDoGuia(sexta.children[1], 0)).toBe(false);
  });
});

/* ───────────────────────── na Rotina de verdade: o guia do 1º quadradinho ───────────────────────── */
describe("na Rotina de verdade (como a missão abre): cheia, nas Pendências, e o 1º quadradinho guiado", () => {
  const linhaDeHoje = () => screen.getByText("SÁBADO").closest("tr")!;

  it("depois do 'Montando' a Rotina já mostra os hábitos e a agenda, a Home conta os pendentes, e o guia aponta o quadradinho de hoje", async () => {
    const onPronto = vi.fn();
    montarNaRotina({ onPronto });
    await responder();
    // a Rotina por baixo adotou o dado na hora
    const colunas = Array.from(linhaDeHoje().closest("table")!.querySelectorAll("thead th")).map((th) => th.textContent?.trim());
    expect(colunas).toEqual(["DIA", "Beber água", "Treinar", "Estudar", "Dormir cedo"]);
    expect(screen.getAllByText("Acordar · beber água").length).toBe(7);
    expect(screen.getAllByText("Treinar").length).toBeGreaterThan(5);
    expect(within(screen.getByTestId("pendencias")).getByText("4 hábitos pendentes")).toBeTruthy();
    // o alvo do guia: a célula de hoje (sábado) na coluna do 1º hábito
    const alvo = quadradinhoDeHoje(0)!;
    expect(alvo).toBe(linhaDeHoje().children[1]);
    expect(within(alvo as HTMLElement).getByRole("checkbox")).toBeTruthy();
    // no jsdom nada tem tamanho: o anel solta e o post-it fica solto (fail-open), com a frase do dono
    await waitFor(() => expect(screen.getByTestId("montar-rotina-postit")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText("Sua rotina está pronta.")).toBeTruthy();
    expect(screen.getByText("Marca o primeiro quando fizer.")).toBeTruthy();
    expect(document.documentElement.getAttribute(ATRIBUTO_NA_TELA)).toBe("missao");
    expect(onPronto).not.toHaveBeenCalled();
  });

  it("marcar o quadradinho de hoje é o registro normal da Rotina (grade + log + heatmap), conta uma vez e fecha o guia", async () => {
    const onPronto = vi.fn();
    const controle = montarNaRotina({ onPronto });
    await responder();
    await waitFor(() => expect(screen.getByTestId("montar-rotina-postit")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(within(linhaDeHoje().children[1] as HTMLElement).getByRole("checkbox"));
    await respirar();
    expect(screen.getByText("Primeiro do dia ✓")).toBeTruthy();
    const d = controle.dados();
    expect((d["rotina-habit-log"] as Record<string, string[]>)[HOJE_DIA]).toEqual(["Beber água"]);
    expect((d["heatmap-log"] as Record<string, unknown>)[HOJE_DIA]).toBe(true);
    expect(d["rotina-habits-week"]).toBe("2026-10-12");
    expect(controle.escritas.find(([k]) => k === "rotina-habits-checked")?.[1]).toBeUndefined(); // gesto da pessoa: conta como dia anotado
    expect(within(screen.getByTestId("pendencias")).getByText("3 hábitos pendentes")).toBeTruthy();
    expect(screen.getByText(/1 dia seguido/)).toBeTruthy();
    await waitFor(() => expect(onPronto).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect((onPronto.mock.calls[0][0] as ResumoMontarRotina).primeiroMarcado).toBe(true);
    expect(eventos.filter(([n]) => n === EV_PRIMEIRO).map(([, e]) => e)).toEqual([{ origem: "missao", guiado: true, dias: 0 }]);
    expect(eventos.find(([n]) => n === EV_GUIA)![1]).toMatchObject({ acao: "marcou", origem: "missao" });
    expect(marcaDoAparelho()?.primeiro).toBeTruthy();
    expect(marcaDe(d[CHAVE_MONTAR_ROTINA])?.primeiro).toBeTruthy();
    expect(screen.queryByTestId("montar-rotina-postit")).toBeNull();
    expect(document.documentElement.hasAttribute(ATRIBUTO_NA_TELA)).toBe(false);
    // tudo continua editável: apagar o hábito é o caminho normal da Rotina
    fireEvent.click(screen.getByRole("button", { name: "Apagar o hábito Treinar" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: apagar o hábito Treinar/ }));
    expect(controle.dados()["rotina-habits"]).toEqual(["Beber água", "Estudar", "Dormir cedo"]);
  });

  it("durante o guia, os OUTROS quadradinhos ficam segurados (outro dia, outro hábito): nada marcado sem querer; o post-it diz qual é", async () => {
    const onPronto = vi.fn();
    const controle = montarNaRotina({ onPronto });
    await responder({ lembrete: "Agora não" });
    await waitFor(() => expect(screen.getByTestId("montar-rotina-postit")).toBeTruthy(), { timeout: 3000 });
    const linhaDeSexta = () => screen.getByText("SEXTA").closest("tr")!;
    fireEvent.click(within(linhaDeSexta().children[1] as HTMLElement).getByRole("checkbox")); // ontem, na coluna certa
    await respirar();
    fireEvent.click(within(linhaDeHoje().children[2] as HTMLElement).getByRole("checkbox")); // hoje, outro hábito
    await respirar();
    const d = controle.dados();
    for (const k of ["rotina-habit-log", "rotina-habits-checked", "heatmap-log", "core-dias-anotados"]) expect(d[k], k).toBeUndefined();
    expect(within(linhaDeSexta().children[1] as HTMLElement).getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Esse não. É o quadradinho de hoje, sábado, na coluna de Beber água.")).toBeTruthy();
    expect(screen.queryByText("Primeiro do dia ✓")).toBeNull();
    expect(nomes()).not.toContain(EV_PRIMEIRO);
    // o do guia passa
    fireEvent.click(within(linhaDeHoje().children[1] as HTMLElement).getByRole("checkbox"));
    await respirar();
    expect(screen.getByText("Primeiro do dia ✓")).toBeTruthy();
    expect((controle.dados()["rotina-habit-log"] as Record<string, string[]>)[HOJE_DIA]).toEqual(["Beber água"]);
    await waitFor(() => expect(onPronto).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect((onPronto.mock.calls[0][0] as ResumoMontarRotina).primeiroMarcado).toBe(true);
    // o guia saiu: a tabela volta inteira (ontem marca, como sempre)
    fireEvent.click(within(linhaDeSexta().children[1] as HTMLElement).getByRole("checkbox"));
    await respirar();
    expect((controle.dados()["rotina-habit-log"] as Record<string, string[]>)["2026-10-16"]).toEqual(["Beber água"]);
  });

  it("'Entendi' fecha sem marcar; marcar DEPOIS é contado pelo vigia da Rotina (uma vez, como não guiado)", async () => {
    const onPronto = vi.fn();
    montarNaRotina({ onPronto });
    await responder({ lembrete: "Agora não" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Entendi" })).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await respirar();
    expect(onPronto).toHaveBeenCalledTimes(1);
    expect((onPronto.mock.calls[0][0] as ResumoMontarRotina).primeiroMarcado).toBe(false);
    expect(eventos.find(([n]) => n === EV_GUIA)![1]).toMatchObject({ acao: "entendi" });
    expect(nomes()).not.toContain(EV_PRIMEIRO);
    // mais tarde, ela marca o 2º hábito
    fireEvent.click(within(linhaDeHoje().children[2] as HTMLElement).getByRole("checkbox"));
    await respirar();
    fireEvent.click(within(linhaDeHoje().children[3] as HTMLElement).getByRole("checkbox"));
    await respirar();
    expect(eventos.filter(([n]) => n === EV_PRIMEIRO).map(([, e]) => e)).toEqual([{ origem: "missao", guiado: false, dias: 0 }]);
  });

  it("com guiarPrimeiro={false} (a missão guia com o anel dela): onPronto logo depois do 'Montando', sem post-it", async () => {
    const onPronto = vi.fn();
    montarNaRotina({ onPronto, guiarPrimeiro: false });
    await responder();
    await waitFor(() => expect(onPronto).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("montar-rotina-postit")).toBeNull();
    expect(nomes()).not.toContain(EV_GUIA);
  });
});

/* ───────────────────────── uma vez só, de verdade ───────────────────────── */
describe("pronto/pulou sobrevive a fechar e reabrir o app, ao logout e a outro aparelho", () => {
  const abrirEFecharOApp = async () => {
    let carregou = false;
    const Sonda = () => { carregou = useUserData().loaded; return null; };
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    await waitFor(() => expect(carregou).toBe(true));
    cleanup();
  };

  it("a chave é do aparelho (nenhuma vassoura leva)", () => {
    expect(ehChaveDoAparelho(CHAVE_MONTAR_ROTINA)).toBe(true);
    expect(vassouraLeva(CHAVE_MONTAR_ROTINA)).toBe(false);
  });

  it("pronto → fechar → reabrir (2×) → sair da conta: continua decidido", async () => {
    vi.useRealTimers();
    marcarMontarRotinaDecidido("pronto", "missao");
    localStorage.setItem(`u:${UID}:rotina-habits`, "[]"); // cache da conta: a vassoura leva
    await abrirEFecharOApp();
    expect(montarRotinaJaDecidido()).toBe(true);
    expect(localStorage.getItem(`u:${UID}:rotina-habits`)).toBeNull();
    await abrirEFecharOApp();
    expect(montarRotinaJaDecidido()).toBe(true);
    purgeLocalUserCache();
    expect(marcaDoAparelho()?.r).toBe("pronto");
  });

  it("outro aparelho (localStorage vazio): a marca que voltou da conta basta", () => {
    const daConta = <T,>(k: string, f: T): T => (k === CHAVE_MONTAR_ROTINA ? ({ r: "pulou", em: "2026-10-17T12:00:00Z" } as T) : f);
    expect(montarRotinaJaDecidido()).toBe(false);
    expect(montarRotinaJaDecidido(daConta)).toBe(true);
    expect(deveMostrarMontarRotina({ criadoEm: auth.user!.created_at, get: daConta, isGuest: false })).toBe(false);
  });

  it("o app fechou NO MEIO: volta 1 vez, preenchido e na pergunta em que parou; a 2ª vista sem decisão é a última", async () => {
    montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "7h" }));
    await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
    fireEvent.click(tela().getByRole("button", { name: "Treinar" }));
    fireEvent.click(tela().getByRole("button", { name: "Ler" }));
    cleanup(); // fechou o app na 2ª pergunta
    // a vassoura da abertura não leva o rascunho (mora na chave do aparelho)
    purgeLocalUserCache();
    _novaAberturaMontarRotina();
    expect(deveMostrarMontarRotina({ criadoEm: auth.user!.created_at, get: <T,>(_k: string, f: T) => f, isGuest: false })).toBe(true);
    montarTela();
    await respirar();
    expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy();
    expect(tela().getByRole("button", { name: "Treinar" }).getAttribute("aria-pressed")).toBe("true");
    expect(tela().getByRole("button", { name: "Ler" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tela().getByRole("button", { name: /Voltar/ }));
    expect(tela().getByRole("button", { name: "7h" }).getAttribute("aria-pressed")).toBe("true");
    expect(eventos.filter(([n]) => n === EV_VIEW).map(([, e]) => e.retomou)).toEqual([false, true]);
    cleanup();
    _novaAberturaMontarRotina();
    expect(deveMostrarMontarRotina({ criadoEm: auth.user!.created_at, get: <T,>(_k: string, f: T) => f, isGuest: false })).toBe(false);
  });

  it("virou o dia com o rascunho guardado: volta preenchido no dia seguinte (a conta ainda é nova) e monta", async () => {
    montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "6h" }));
    await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
    fireEvent.click(tela().getByRole("button", { name: "Beber água" }));
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 18, 6, 30)); // domingo de manhã, conta com 17 h
    _novaAberturaMontarRotina();
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto, agora: new Date(2026, 9, 18, 6, 30) });
    await respirar();
    expect(tela().getByRole("button", { name: "Beber água" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    // acordou às 6h → o aviso é às 6h15; já são 6h30, então o 1º chega amanhã
    expect(screen.getByTestId("montar-rotina-previa-aviso").textContent).toContain("Amanhã · 6h15");
    fireEvent.click(tela().getByRole("button", { name: "Sim, quero" }));
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "Montar minha rotina" }));
    await waitFor(() => expect(onPronto).toHaveBeenCalled());
    expect(controle.dados()["rotina-habits"]).toEqual(["Beber água"]);
  });

  it("o 1º quadradinho conta pelo DIA do log desde o 'pronto' (marcou no dia seguinte = dias 1; antes do 'pronto' não vale)", () => {
    expect(primeiroDiaMarcado({ "2026-10-16": ["Ler"], "2026-10-18": ["Ler"] }, "2026-10-17T18:00:00.000Z")).toEqual({ dia: "2026-10-18", dias: 1 });
    expect(primeiroDiaMarcado({ "2026-10-16": ["Ler"], "2026-10-17": [] }, "2026-10-17T18:00:00.000Z")).toBeNull();
    // 23h50 do dia 17 em São Paulo é 02h50Z do dia 18: o dia do "pronto" é o LOCAL
    expect(primeiroDiaMarcado({ "2026-10-17": ["Ler"] }, new Date(2026, 9, 17, 23, 50).toISOString())).toEqual({ dia: "2026-10-17", dias: 0 });
  });
});

/* ───────────────────────── logout → login na mesma conta vazia ───────────────────────── */
describe("logout → login", () => {
  it("pulou → sai da conta (vassoura do logout) → entra de novo e em outro aparelho: não volta", async () => {
    const controle = montarTela();
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "Pular" }));
    const daConta = controle.dados()[CHAVE_MONTAR_ROTINA];
    expect(marcaDe(daConta)?.r).toBe("pulou");
    cleanup();
    purgeLocalUserCache();
    _novaAberturaMontarRotina();
    expect(deveMostrarMontarRotina({ criadoEm: auth.user!.created_at, get: <T,>(_k: string, f: T) => f, isGuest: false })).toBe(false);
    localStorage.clear(); // outro aparelho / reinstalou: só a conta lembra
    const get = <T,>(k: string, f: T): T => (k === CHAVE_MONTAR_ROTINA ? (daConta as T) : f);
    expect(deveMostrarMontarRotina({ criadoEm: auth.user!.created_at, get, isGuest: false })).toBe(false);
  });
});

/* ───────────────────────── módulo × missão: uma tela por vez ───────────────────────── */
describe("a tela da missão e a de origem 'modulo' nunca aparecem juntas", () => {
  const Ambos = ({ missao, controle }: { missao: boolean; controle: Controle }) => (
    <MemoryRouter>
      <Provedor inicial={{}} controle={controle}>
        <MontarRotina origem="modulo" agora={HOJE} esperaMs={0} />
        {missao && <MontarRotina origem="missao" agora={HOJE} esperaMs={0} />}
      </Provedor>
    </MemoryRouter>
  );
  it("a missão abre a dela com a do módulo na tela: a do módulo cede sem decidir nem gastar vista, e o rascunho passa junto", async () => {
    const controle = novoControle();
    const { rerender } = render(<Ambos missao={false} controle={controle} />);
    await respirar();
    expect(screen.getAllByTestId("montar-minha-rotina")).toHaveLength(1);
    expect(document.documentElement.getAttribute(ATRIBUTO_NA_TELA)).toBe("modulo");
    fireEvent.click(screen.getByRole("button", { name: "Outro horário" }));
    fireEvent.change(screen.getByLabelText("Hora em que você acorda"), { target: { value: "06:30" } });
    rerender(<Ambos missao controle={controle} />);
    await respirar();
    expect(screen.getAllByTestId("montar-minha-rotina")).toHaveLength(1);
    expect(document.documentElement.getAttribute(ATRIBUTO_NA_TELA)).toBe("missao");
    expect((screen.getByLabelText("Hora em que você acorda") as HTMLInputElement).value).toBe("06:30");
    expect(marcaDoAparelho()?.r).toBeUndefined();
    expect(marcaDoAparelho()?.vistas).toBe(1);
    expect(eventos.filter(([n]) => n === EV_VIEW).map(([, e]) => e)).toEqual([{ origem: "modulo", retomou: false }, { origem: "missao", retomou: true }]);
  });
});
