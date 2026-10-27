/**
 * 1.0.21 — FLUXO ENXUTO × a missão de 3 dias (lib/fluxo-enxuto). A missão continua, leve:
 *   · sem o "Tá dentro! / Seu plano de 3 dias" (a TelaParabens do cadastro foi a boas-vindas): a missão nasce já com as
 *     boas-vindas dadas, em qualquer rota, 1x (reabrir não repete);
 *   · a dose 1 de Finanças aponta a AÇÃO direto (o 1º gasto no post-it), sem o "Vamos montar suas Finanças";
 *   · o dia 2 "escolhe o seu" continua com opções e a dose do módulo escolhido é a dose simples (não a intro).
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
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString(), assina: true }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, isSubscribed: conta.assina }) }));
const notif = vi.hoisted(() => ({ pedirDia2: vi.fn(async (_o: string) => "concedeu" as const), regua: vi.fn(async () => {}), pedir: vi.fn(async () => true) }));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: (...a: unknown[]) => notif.regua(...(a as [])),
  pedirPermissao: () => notif.pedir(),
  pedirPermissaoDia2: (o: string) => notif.pedirDia2(o),
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { CardSeuDia } from "@/components/missao-doses/CardSeuDia";
import { CHAVE_ESTADO_MISSAO_DOSES, iniciarMissao, lerMissao, opcoesDoDia2, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { porQueNaoMostrar } from "@/lib/intro-modulo";
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
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
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

const G = globalThis as { __FLUXO_ENXUTO_PADRAO_APP__?: string };
let padraoDaSuite: string | undefined;
beforeEach(() => {
  localStorage.clear();
  padraoDaSuite = G.__FLUXO_ENXUTO_PADRAO_APP__;
  delete G.__FLUXO_ENXUTO_PADRAO_APP__; // o padrão de verdade do iPhone: enxuto LIGADO
  eventos.length = 0;
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  conta.assina = true;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = false;
  localStorage.setItem("core-funnel-area", "dinheiro");
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 19, 10));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete (window as { Capacitor?: unknown }).Capacitor; G.__FLUXO_ENXUTO_PADRAO_APP__ = padraoDaSuite; });

describe("conta nova no iPhone com o enxuto (padrão)", () => {
  it("a missão nasce SEM o 'Tá dentro!': boas-vindas dadas sozinhas (evento acao 'enxuto'), a Home fica livre; reabrir não repete", () => {
    const store = montarStore(dados());
    const r = montar(store, "/home");
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    const m = lerMissao();
    expect(m?.modulos).toEqual(["financas", "rotina", "saude"]);
    expect(m?.boasVindas).toBe(true);
    expect(m?.explorou).toBeFalsy(); // não é "Explorar por conta própria": as doses continuam abrindo nos módulos
    expect(eventos.filter(([n, d]) => n === "missao_doses_boas_vindas" && d.acao === "enxuto")).toHaveLength(1);
    expect(screen.getByText("home de sempre")).toBeInTheDocument();
    r.unmount();
    montar(store, "/home");
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(eventos.filter(([n]) => n === "missao_doses_boas_vindas")).toHaveLength(1);
  });

  it("a missão nascendo com a pessoa já num módulo também entra sem boas-vindas", () => {
    montar(montarStore(dados()), "/financas");
    expect(lerMissao()?.boasVindas).toBe(true);
  });

  it("dose 1 em Finanças: a AÇÃO direto (o post-it do 1º gasto), sem o 'Vamos montar suas Finanças'", () => {
    const store = montarStore(dados());
    montar(store, "/financas");
    expect(document.querySelector("[data-montar-financas]")).toBeNull();
    expect(screen.queryByText(/Vamos montar suas Finanças/)).toBeNull();
    const postIt = esperarPostIt();
    expect(within(postIt).getAllByTestId("demo-guia-chip").length).toBeGreaterThan(0);
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect((store.dados["finance-expenses"] as unknown[]).length).toBe(1); // o gasto entrou de verdade
  });

  it("dia 2 (escolhe o seu): as opções continuam (módulos zerados) mesmo sem intro", () => {
    const s = montarStore(dados());
    const m: EstadoMissaoDoses = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-02", undefined, "A"), boasVindas: true, feitos: { 1: { dia: "2026-10-02", rotulo: "Café" } } };
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(m));
    const r = porQueNaoMostrar("casa", s.valor().get);
    expect(r).toBe("desligada");
    const opcoes = opcoesDoDia2(m, "dinheiro", (mod) => { const x = porQueNaoMostrar(mod, s.valor().get, { ignorarChave: true }); return x === null || x === "missao" || x === "outra_guia"; });
    expect(opcoes).toEqual(["casa", "beleza", "estudos"]);
  });
});
