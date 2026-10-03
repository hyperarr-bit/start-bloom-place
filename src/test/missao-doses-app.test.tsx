/**
 * MISSÃO EM DOSES LIGADA NO APP DAS LOJAS (03/10, versão 1.0.10) — o que este arquivo trava:
 *   · `MISSAO_DOSES_APP = "on"`; no shell nativo a força de QA do link não manda;
 *   · ela NASCE só pra quem é novo (conta < 48 h): boas-vindas na Home, card SEU DIA, eventos
 *     com `prototipo: "app"` + plataforma + versão (pra separar a turma da 1.0.10 da 1.0.9);
 *   · cliente antigo: nada (nenhum card, nenhum evento, nada gravado);
 *   · SUBSTITUI a Missão antiga do iPhone pra quem é novo: a MissaoDoTrial não nasce (nem grava
 *     `core-missao`); quem já tem a antiga em andamento (veio da 1.0.9) termina a antiga — a nova
 *     não aparece;
 *   · a hora combinada na comemoração vira a hora do Lembrete do dia 2 e pede a permissão UMA vez
 *     (lembrete único: a notificação é o passo de amanhã);
 *   · a web continua como estava (o arquivo missao-doses.test.tsx trava o "off" byte a byte).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, isSubscribed: true }) }));
const notif = vi.hoisted(() => ({ pedirDia2: vi.fn(async (_o: string) => "concedeu" as const), regua: vi.fn(async () => {}), pedir: vi.fn(async () => true) }));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: (...a: unknown[]) => notif.regua(...(a as [])),
  pedirPermissao: () => notif.pedir(),
  pedirPermissaoDia2: (o: string) => notif.pedirDia2(o),
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { CardSeuDia } from "@/components/missao-doses/CardSeuDia";
import { MissaoDoTrial } from "@/components/missao/MissaoDoTrial";
import { CHAVE_ESTADO_MISSAO_DOSES, CHAVE_FORCA_MISSAO_DOSES, MISSAO_DOSES_APP, iniciarMissao, lerMissao, missaoDosesLigada, missaoDosesMandaNoApp } from "@/lib/missao-doses";
import { EVENTO_DIA2, lerDia2, registrarAbertura } from "@/lib/lembrete-dia2";
import { missaoAtual, type Missao } from "@/lib/teste-gratis";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { Sequencia } from "@/components/conquistas/use-conquistas";

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const LIFE: LifeHubData = {
  dayScore: 30, streak: 2, monthBalance: 0, nextBillName: null, nextBillDaysUntil: null, nextBillDate: null, todayWorkoutGroup: null, workoutDone: false, workoutTime: null, workoutStatus: "vazio",
  caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 0, mealsTotal: 4, waterGlasses: 0, waterGoal: 8, sleepHours: null, supplementsTaken: 0, supplementsTotal: 0, currentBook: null, readingProgress: 0,
  booksReadThisYear: 0, tasksCompleted: 0, tasksTotal: 0, habits: [{ name: "Água", done: false }], userName: "Ana",
  registrosHoje: { humor: false, gasto: true, peso: false, sono: false, gratidao: false, ideia: false },
};
const SEQ = { dias: 2, hoje: "2026-10-03", lista: ["2026-10-01", "2026-10-02"], garantido: false, usados: [], recorde: 2, protegidoOntem: false, acao: null } as unknown as Sequencia;
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const HomeFalsa = () => <div><Rota /><CardSeuDia lifeData={LIFE} sequencia={SEQ} /><p>home de sempre</p></div>;
const FinancasFalsa = () => (
  <div><Rota /><header className="sticky">FINANÇAS</header><div><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div><section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
);
const montar = (store: Store, rota: string, comAntiga = false) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        {comAntiga && <MissaoDoTrial />}
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeFalsa />} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const dados = () => ({ "core-user-name": "Ana", "rotina-habits": ["Água", "Andar"], "finance-expenses": [] as unknown[] });
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const esperarPostIt = () => { avancar(400); avancar(3000); return screen.getByTestId("demo-guia-postit"); };
const missaoAntiga = (inicio: number): Missao => ({ inicio, area: "dinheiro", d1: true, d2: false, d3: false, vista: true, holofote: "dispensado" });

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  notif.pedirDia2.mockClear(); notif.regua.mockClear(); notif.pedir.mockClear();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString(); // a conta nasceu hoje de manhã (compra → cadastro)
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = false;
  localStorage.setItem("core-funnel-area", "dinheiro");
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 19, 10)); // sábado 03/10/2026, 19:10
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("a chave do app", () => {
  it("MISSAO_DOSES_APP nasce 'on'; no shell a força de QA do link não manda", () => {
    expect(MISSAO_DOSES_APP).toBe("on");
    expect(missaoDosesLigada()).toBe(true);
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "off");
    expect(missaoDosesLigada()).toBe(true);
    expect(missaoDosesLigada("off", "off")).toBe(false);
  });

  it("missaoDosesMandaNoApp: conta nova → sim; conta antiga → não; Missão antiga em andamento → não; já nasceu → sim até o fim", () => {
    expect(missaoDosesMandaNoApp(conta.created_at)).toBe(true);
    expect(missaoDosesMandaNoApp("2026-09-01T12:00:00Z")).toBe(false);
    expect(missaoDosesMandaNoApp(null)).toBe(false);
    localStorage.setItem("core-missao", JSON.stringify(missaoAntiga(Date.now() - 3600e3)));
    expect(missaoDosesMandaNoApp(conta.created_at)).toBe(false);
    localStorage.removeItem("core-missao");
    iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    expect(missaoDosesMandaNoApp("2026-09-01T12:00:00Z")).toBe(true);
    // fora do shell a chave do app não vale
    delete (window as { Capacitor?: unknown }).Capacitor;
    expect(missaoDosesMandaNoApp(conta.created_at)).toBe(false);
  });
});

describe("quem é novo no app vê a missão em doses", () => {
  it("conta nova: boas-vindas na Home (área da porta primeiro), evento com prototipo 'app' + plataforma, e o card SEU DIA depois", () => {
    montar(montarStore(dados()), "/home");
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    expect(boas).toHaveTextContent("Os 16 módulos já estão liberados");
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveTextContent("Hoje · 💰 Finanças");
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ modulos: ["financas", "rotina", "saude"], area: "dinheiro", prototipo: "app", plataforma: "ios", versao: expect.any(String) })]);
    expect(lerMissao()?.modulos).toEqual(["financas", "rotina", "saude"]);
    fireEvent.click(screen.getByTestId("missao-doses-explorar"));
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(screen.getByTestId("seu-dia")).toHaveTextContent("Dia 1 de 3 · missão 0/3");
    expect(screen.queryByTestId("seu-dia-qa")).toBeNull(); // a régua de QA é só da web
  });

  it("cliente antigo (conta de setembro) no app: nada — nenhum card, nenhum evento, nada gravado", () => {
    conta.created_at = "2026-09-01T12:00:00Z";
    montar(montarStore(dados()), "/home");
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(screen.queryByTestId("seu-dia")).toBeNull();
    expect(screen.getByText("home de sempre")).toBeInTheDocument();
    expect(eventos.filter(([n]) => /missao|seu_dia/.test(n))).toEqual([]);
    expect(localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)).toBeNull();
  });
});

describe("a Missão antiga do iPhone × a missão em doses — nunca duas na tela", () => {
  it("quem é NOVO no teste grátis do iPhone não recebe mais a Missão antiga: a MissaoDoTrial não nasce (core-missao fica vazia) e a nova aparece", () => {
    localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 3 * 86_400_000));
    montar(montarStore(dados()), "/home", true);
    expect(screen.getByTestId("missao-doses-boas-vindas")).toBeInTheDocument();
    expect(screen.queryByText(/Seu primeiro registro em/)).toBeNull(); // o B1 da antiga
    expect(missaoAtual()).toBeNull();
    expect(eventos.find(([n]) => n === "missao_area")).toBeUndefined();
  });

  it("quem já estava com a Missão antiga em andamento (veio da 1.0.9) termina a antiga: a nova NÃO nasce", async () => {
    localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 2 * 86_400_000));
    localStorage.setItem("core-missao", JSON.stringify({ ...missaoAntiga(Date.now() - 20 * 3600e3), vista: false }));
    montar(montarStore(dados()), "/home", true);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Seu primeiro registro em Dinheiro/)).toBeInTheDocument(); // o B1 da antiga segue
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(lerMissao()).toBeNull();
    expect(localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)).toBeNull();
  });
});

describe("a comemoração combina a hora — e essa hora é a do Lembrete do dia 2", () => {
  it("dia 1 em Finanças: o chip pré-marcado é o mais perto da abertura (19:10 → 20h); 'Combinado, me lembra às 20h' grava a hora, pede a permissão UMA vez (origem missao) e avisa o reagendador", async () => {
    registrarAbertura(new Date(2026, 9, 3, 19, 10), conta.created_at);
    const store = montarStore(dados());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-03");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true }));
    const reagendou = vi.fn();
    window.addEventListener(EVENTO_DIA2, reagendou);
    montar(store, "/financas");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    avancar(700); avancar(1000);
    const entendi = screen.queryByTestId("missao-doses-entendi");
    if (entendi) fireEvent.click(entendi);
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveTextContent("Primeiro registro feito!");
    expect(screen.getByTestId("missao-doses-hora-20h")).toHaveAttribute("aria-checked", "true");
    const botao = screen.getByTestId("missao-doses-combinado");
    expect(botao).toHaveTextContent("Combinado, me lembra às 20h");
    fireEvent.click(botao);
    expect(lerMissao()?.lembrete).toBe("20h");
    expect(lerDia2()?.horaEscolhida).toBe(20 * 60);
    expect(eventos).toContainEqual(["missao_doses_lembrete", expect.objectContaining({ dia: 1, hora: "20h", prototipo: "app" })]);
    // a permissão é pedida num microtask (fora do clique) e o reagendador é avisado no fim
    await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
    expect(notif.pedirDia2).toHaveBeenCalledWith("missao");
    expect(notif.pedirDia2).toHaveBeenCalledTimes(1);
    expect(reagendou).toHaveBeenCalled();
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    window.removeEventListener(EVENTO_DIA2, reagendou);
  });

  it("'sem aviso' na comemoração: grava 'sem' e NÃO pede permissão (ela disse que não quer)", async () => {
    registrarAbertura(new Date(2026, 9, 3, 19, 10), conta.created_at);
    const store = montarStore(dados());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-03");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true }));
    montar(store, "/financas");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    avancar(700); avancar(1000);
    const entendi = screen.queryByTestId("missao-doses-entendi");
    if (entendi) fireEvent.click(entendi);
    fireEvent.click(screen.getByTestId("missao-doses-hora-sem"));
    expect(screen.getByTestId("missao-doses-combinado")).toHaveTextContent("Combinado, até amanhã");
    fireEvent.click(screen.getByTestId("missao-doses-combinado"));
    expect(lerDia2()?.horaEscolhida).toBe("sem");
    await act(async () => { await Promise.resolve(); });
    expect(notif.pedirDia2).not.toHaveBeenCalled();
  });
});
