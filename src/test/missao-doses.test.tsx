/**
 * MISSÃO EM DOSES + card "SEU DIA" — protótipo na web (02/10, src/lib/missao-doses.ts).
 * O que este arquivo trava:
 *   · a CHAVE desligada (`MISSAO_DOSES = "off"`, sem força) = o app de hoje, byte a byte:
 *     nenhum card, nenhuma faixa, nenhum evento, nada no localStorage;
 *   · no app das lojas a chave é ignorada nesta etapa (mesmo com a força ligada);
 *   · a força de QA pelo link (`?missao-doses=on|off|auto|recomecar`, `?missao-doses-dia=1|2|3`);
 *   · o fluxo: boas-vindas (D1) com a área da porta primeiro e os 3 módulos SÓ pra missão,
 *     a troca dos 3 (D2), o passo do dia 1 com chip = registro DE VERDADE na conta, a
 *     comemoração com o amanhã combinado e a hora, o card na Home (1/3), os dias 2 e 3
 *     pelo QA, "O que você construiu" e o card depois da missão;
 *   · pular: "Explorar por conta própria" (o card fica), "Pular" da faixa só depois de
 *     20 s (ou 2º toque) e "Pular este passo" no olhar — com o evento `missao_pular`.
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
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-09-01T12:00:00Z", email: "ana@x.com" }, isSubscribed: true }) }));
vi.mock("@/lib/notificacoes", () => ({ agendarReguaDaMissao: vi.fn(async () => {}), pedirPermissao: vi.fn(async () => true) }));
const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));

import { UserDataContext } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { CardSeuDia } from "@/components/missao-doses/CardSeuDia";
import { PULAR_DEPOIS_DE_MS } from "@/components/missao-doses/PassoDoDia";
import { CHAVE_ESTADO_MISSAO_DOSES, CHAVE_FORCA_MISSAO_DOSES, MISSAO_DOSES, lerMissao, missaoDosesLigada, guardarForcaDaUrl, diaDaMissao, modulosPadrao, rotuloDoPasso, iniciarMissao } from "@/lib/missao-doses";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { diaDeHoje } from "@/components/demo-guiada/alvos";

/* ------------------------------------------------------------ o aparelho de mentira */

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
const SEQ = { dias: 2, hoje: "2026-10-02", lista: ["2026-09-30", "2026-10-01"], garantido: false, usados: [], recorde: 2, protegidoOntem: false, acao: null } as unknown as Sequencia;

const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const HomeFalsa = () => <div><Rota /><CardSeuDia lifeData={LIFE} sequencia={SEQ} /><p>home de sempre</p></div>;
/** Finanças de mentira: o formulário do gasto (âncora da missão) e o "Meu mês" (âncora do olhar). */
const FinancasFalsa = () => (
  <div>
    <Rota />
    <header className="sticky">FINANÇAS</header>
    <div><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div>
    <section data-spotlight="add-bill"><h3>MEU MÊS</h3><p>resumo</p></section>
  </div>
);
const ModuloFalso = ({ nome }: { nome: string }) => <div><Rota /><header className="sticky">{nome}</header><button type="button" data-spotlight="add-habit">+</button><button type="button" data-spotlight="add-water">+</button></div>;

const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeFalsa />} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="/rotina" element={<ModuloFalso nome="ROTINA" />} />
          <Route path="/saude" element={<ModuloFalso nome="SAÚDE" />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );

const conta = () => ({ "core-user-name": "Ana", "rotina-habits": ["Água", "Andar"], "finance-expenses": [] as unknown[] });
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const rota = () => screen.getByTestId("rota").textContent;
/**
 * O passo acha a âncora (300 ms), o anel monta e assenta (300 + 200 + 200 ms) e o post-it
 * aparece. Dois avanços: o estado que um relógio muda só vira tela no fim do act.
 */
const esperarPostIt = () => { avancar(400); avancar(3000); return screen.getByTestId("demo-guia-postit"); };
/** Depois do registro: 550 ms → o olhar (anel assenta em ~700 ms) ou direto a comemoração. */
const esperarOlharOuFesta = () => { avancar(700); avancar(1000); };
const passarPeloOlhar = () => { esperarOlharOuFesta(); const b = screen.queryByTestId("missao-doses-entendi"); if (b) fireEvent.click(b); };

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  nativo.v = false;
  // o jsdom não tem tamanho: o anel/olhar se posicionam por getBoundingClientRect
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0)); // sexta, 02/10/2026
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

/* ------------------------------------------------------------ a chave */

describe("a chave desligada = o app de hoje, byte a byte", () => {
  it("MISSAO_DOSES nasce 'off'", () => {
    expect(MISSAO_DOSES).toBe("off");
    expect(missaoDosesLigada()).toBe(false);
  });

  it("na Home e no módulo: nenhum card, nenhuma faixa, nenhum evento, nada gravado", () => {
    const store = montarStore(conta());
    montar(store, "/home");
    expect(screen.queryByTestId("seu-dia")).toBeNull();
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(screen.getByText("home de sempre")).toBeInTheDocument();
    cleanup();
    montar(store, "/financas");
    avancar(6000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(document.documentElement.hasAttribute("data-missao-doses-faixa")).toBe(false);
    expect(eventos.filter(([n]) => /missao|seu_dia/.test(n))).toEqual([]);
    expect(localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)).toBeNull();
  });

  it("no app das lojas a chave é ignorada nesta etapa, mesmo com a força ligada", () => {
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    nativo.v = true;
    expect(missaoDosesLigada("on")).toBe(false);
    montar(montarStore(conta()), "/home");
    expect(screen.queryByTestId("seu-dia")).toBeNull();
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
  });

  it("a força de QA pelo link: on liga, off força desligado (mesmo com a chave 'on'), auto desfaz, recomecar apaga a missão e segue ligado; o dia simulado 1|2|3|auto", () => {
    guardarForcaDaUrl("?missao-doses=on");
    expect(missaoDosesLigada()).toBe(true);
    guardarForcaDaUrl("?missao-doses=off");
    expect(missaoDosesLigada("on")).toBe(false);
    guardarForcaDaUrl("?missao-doses=auto");
    expect(missaoDosesLigada()).toBe(false);
    expect(missaoDosesLigada("on")).toBe(true);
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    expect(diaDaMissao(m, "2026-10-02")).toBe(1);
    expect(diaDaMissao(m, "2026-10-03")).toBe(2);
    expect(diaDaMissao(m, "2026-10-04")).toBe(3);
    guardarForcaDaUrl("?missao-doses-dia=3");
    expect(diaDaMissao(m, "2026-10-02")).toBe(3);
    guardarForcaDaUrl("?missao-doses-dia=auto");
    expect(diaDaMissao(m, "2026-10-02")).toBe(1);
    guardarForcaDaUrl("?missao-doses=recomecar");
    expect(lerMissao()).toBeNull();
    expect(missaoDosesLigada()).toBe(true);
  });

  it("os 3 padrão: a área da porta primeiro, depois Finanças → Rotina → Saúde sem repetir; os rótulos HOJE/AMANHÃ/DIA 3", () => {
    expect(modulosPadrao("rotina")).toEqual(["rotina", "financas", "saude"]);
    expect(modulosPadrao("corpo")).toEqual(["treino", "financas", "rotina"]);
    expect(modulosPadrao(null)).toEqual(["financas", "rotina", "saude"]);
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    expect([1, 2, 3].map((n) => rotuloDoPasso(n as 1 | 2 | 3, m, "2026-10-02"))).toEqual(["HOJE", "AMANHÃ", "DIA 3"]);
    m.feitos[1] = { dia: "2026-10-02", rotulo: "Café · R$ 12" };
    expect([1, 2, 3].map((n) => rotuloDoPasso(n as 1 | 2 | 3, m, "2026-10-02"))).toEqual(["HOJE", "AMANHÃ", "DIA 3"]);
    expect([1, 2, 3].map((n) => rotuloDoPasso(n as 1 | 2 | 3, m, "2026-10-03"))).toEqual(["ONTEM", "HOJE", "AMANHÃ"]);
  });
});

/* ------------------------------------------------------------ o fluxo com a força ligada */

describe("com a força ligada: o fluxo tela a tela", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on"); localStorage.setItem("core-funnel-area", "dinheiro"); });

  it("D1: boas-vindas na Home com a área da porta primeiro, os 3 módulos SÓ pra missão (os outros 13 seguem abertos); D2 troca o 3º por Treino; 'Fazer o toque de hoje' leva pra Finanças", () => {
    montar(montarStore(conta()), "/home");
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    expect(boas).toHaveTextContent("Os 16 módulos já estão liberados");
    expect(boas).toHaveTextContent("os outros 13 seguem abertos");
    expect(boas).toHaveTextContent("Você escolheu Dinheiro na porta");
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveTextContent("Hoje · 💰 Finanças");
    expect(screen.getByTestId("missao-doses-linha-2")).toHaveTextContent("Amanhã · 📅 Rotina");
    expect(screen.getByTestId("missao-doses-linha-3")).toHaveTextContent("Domingo · ❤️ Saúde");
    expect(eventos).toContainEqual(["missao_doses_inicio", { modulos: ["financas", "rotina", "saude"], area: "dinheiro", prototipo: "web" }]);
    // o card ainda não aparece por baixo das boas-vindas? aparece (a Home é a mesma) — mas a missão manda na tela
    fireEvent.click(screen.getByTestId("missao-doses-trocar"));
    const escolha = screen.getByTestId("missao-doses-escolha");
    expect(escolha).toHaveTextContent("Os outros 13 continuam liberados.");
    expect(escolha.querySelectorAll("[data-modulo]")).toHaveLength(16);
    expect(escolha.querySelectorAll("[data-marcado]")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("missao-doses-tile-treino")); // entra no lugar do 3º
    expect(screen.getByTestId("missao-doses-tile-treino")).toHaveAttribute("data-marcado");
    expect(screen.getByTestId("missao-doses-tile-saude")).not.toHaveAttribute("data-marcado");
    expect(screen.getByTestId("missao-doses-escolha-lista")).toHaveTextContent("🏋️ Treino");
    fireEvent.click(screen.getByTestId("missao-doses-pronto"));
    expect(screen.getByTestId("missao-doses-linha-3")).toHaveTextContent("Treino");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(rota()).toBe("/financas");
    expect(lerMissao()?.modulos).toEqual(["financas", "rotina", "treino"]);
    expect(lerMissao()?.boasVindas).toBe(true);
    expect(eventos).toContainEqual(["missao_doses_modulos", { de: ["financas", "rotina", "saude"], para: ["financas", "rotina", "treino"], prototipo: "web" }]);
    expect(eventos).toContainEqual(["missao_doses_boas_vindas", { acao: "comecar", modulos: ["financas", "rotina", "treino"], prototipo: "web" }]);
  });

  it("dia 1 em Finanças: faixa + post-it com chips; o chip 'Café' vira um gasto DE VERDADE na conta; o olhar explica o painel; a comemoração combina o amanhã (Rotina) e a hora; 'Combinado' volta pra Home com o card 1/3", () => {
    const store = montarStore(conta());
    iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    const m = lerMissao()!; m.boasVindas = true; localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(m));
    montar(store, "/financas");
    const faixa = screen.getByTestId("missao-doses-faixa");
    expect(faixa).toHaveTextContent("Missão · dia 1 de 3 · Finanças");
    expect(document.documentElement.getAttribute("data-missao-doses-faixa")).toBe("1");
    expect(screen.queryByTestId("missao-doses-pular")).toBeNull(); // sem "pular tudo" nos primeiros 20 s
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Agora · 1 toque");
    expect(postIt).toHaveTextContent("Qual foi o seu último gasto?");
    const chips = within(postIt).getAllByTestId("demo-guia-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["☕Café· R$ 12", "🚗Uber· R$ 23", "🍔Almoço· R$ 35"]);
    fireEvent.click(chips[0]);
    // o registro de verdade, no formato do módulo
    const gastos = store.dados["finance-expenses"] as Array<Record<string, unknown>>;
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ description: "Café", value: 12, category: "alimentacao", date: "2026-10-02" });
    expect(eventos).toContainEqual(["missao_doses_passo", { dia: 1, modulo: "financas", passo: "toque", acao: "feito", via: "chip", segundos: expect.any(Number), prototipo: "web" }]);
    // o olhar: o "Meu mês" explicado, com Entendi e Pular este passo
    esperarOlharOuFesta();
    const olhar = screen.getByTestId("missao-doses-olhar");
    expect(olhar).toHaveTextContent("Esse painel soma sozinho");
    expect(within(olhar).getByTestId("missao-doses-pular-passo")).toBeInTheDocument();
    fireEvent.click(within(olhar).getByTestId("missao-doses-entendi"));
    // a comemoração
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveTextContent("Dia 1 da missão ✓");
    expect(festa).toHaveTextContent("Primeiro registro feito!");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("Café · R$ 12 já está nas suas Finanças.");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã · 📅 Rotina");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Marca 1 hábito no quadradinho");
    expect(lerMissao()?.feitos[1]).toEqual({ dia: "2026-10-02", rotulo: "Café · R$ 12" });
    expect(eventos).toContainEqual(["missao_doses_dia_feito", { dia: 1, dia_relogio: 1, modulo: "financas", segundos: expect.any(Number), rotulo: "Café · R$ 12", prototipo: "web" }]);
    // a faixa agora marca 1 de 3
    expect(screen.getByTestId("missao-doses-faixa").querySelector("[role=img]")).toHaveAttribute("aria-label", "1 de 3 feitos");
    fireEvent.click(screen.getByTestId("missao-doses-hora-20h"));
    fireEvent.click(screen.getByTestId("missao-doses-combinado"));
    expect(lerMissao()?.lembrete).toBe("20h");
    expect(eventos).toContainEqual(["missao_doses_lembrete", { dia: 1, hora: "20h", prototipo: "web" }]);
    expect(rota()).toBe("/home");
    expect(document.documentElement.hasAttribute("data-missao-doses-faixa")).toBe(false);
    // o card SEU DIA: 1/3, a linha 1 feita e riscada, a 2 é AMANHÃ, o botão vira "amanhã agora"
    const card = screen.getByTestId("seu-dia");
    expect(screen.getByTestId("seu-dia-resumo")).toHaveTextContent("Dia 1 de 3 · missão 1/3");
    expect(screen.getByTestId("seu-dia-linha-1")).toHaveTextContent("HOJE · 💰 Finanças");
    expect(screen.getByTestId("seu-dia-linha-1")).toHaveTextContent("Café · R$ 12");
    expect(screen.getByTestId("seu-dia-linha-1")).toHaveTextContent("Feito");
    expect(screen.getByTestId("seu-dia-linha-2")).toHaveTextContent("AMANHÃ · 📅 Rotina");
    expect(screen.getByTestId("seu-dia-fazer")).toHaveTextContent("Quero fazer o toque de amanhã agora");
    expect(card).toHaveTextContent("Pendências de hoje");
    expect(screen.getByTestId("seu-dia-score")).toHaveTextContent("30");
    expect(screen.getByTestId("seu-dia-sequencia")).toHaveTextContent("2");
    expect(screen.getByTestId("seu-dia-qa")).toBeInTheDocument(); // só com a força
    expect(eventos).toContainEqual(["seu_dia_view", expect.objectContaining({ dia: 1, missao: "1/3", score: 30 })]);
  });

  it("dias 2 e 3 pelo QA: o card diz 'Dia 2 de 3', 'Fazer o toque de hoje' abre a Rotina (o quadradinho marcado conta); dia 3 em Saúde pelo chip; 'Missão cumprida' → 'O que você construiu' → o card depois da missão", () => {
    const store = montarStore(conta());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, feitos: { 1: { dia: "2026-10-02", rotulo: "Café · R$ 12" } } }));
    // dia 2
    montar(store, "/home?missao-doses-dia=2");
    expect(screen.getByTestId("seu-dia-resumo")).toHaveTextContent("Dia 2 de 3 · missão 1/3");
    expect(screen.getByTestId("seu-dia-linha-2")).toHaveTextContent("HOJE · 📅 Rotina");
    expect(screen.getByTestId("seu-dia-fazer")).toHaveTextContent("Fazer o toque de hoje");
    fireEvent.click(screen.getByTestId("seu-dia-fazer"));
    expect(rota()).toBe("/rotina");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3 · Rotina");
    esperarPostIt();
    // ela marca o quadradinho de hoje (o módulo grava a chave de sempre)
    act(() => { store.valor().set("rotina-habits-checked", { [diaDeHoje()]: [true, false] }); });
    passarPeloOlhar();
    const festa2 = screen.getByTestId("missao-doses-festa");
    expect(festa2).toHaveTextContent("Dia 2 feito!");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("Água já está na sua Rotina.");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã · ❤️ Saúde");
    fireEvent.click(screen.getByTestId("missao-doses-combinado"));
    expect(rota()).toBe("/home");
    cleanup();
    // dia 3
    montar(store, "/home?missao-doses-dia=3");
    expect(screen.getByTestId("seu-dia-resumo")).toHaveTextContent("Dia 3 de 3 · missão 2/3");
    fireEvent.click(screen.getByTestId("seu-dia-fazer"));
    expect(rota()).toBe("/saude");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getByTestId("demo-guia-chip"));
    expect((store.dados["core-saude-water"] as Record<string, number>)["2026-10-02"]).toBe(1);
    passarPeloOlhar();
    const festa3 = screen.getByTestId("missao-doses-festa");
    expect(festa3).toHaveTextContent("Missão cumprida!");
    expect(screen.queryByTestId("missao-doses-amanha")).toBeNull();
    fireEvent.click(screen.getByTestId("missao-doses-ver-fim"));
    const fim = screen.getByTestId("missao-doses-fim");
    expect(fim).toHaveTextContent("O que você construiu em 3 dias");
    expect(screen.getByTestId("missao-doses-fim-missao")).toHaveTextContent("Café · R$ 12");
    expect(screen.getByTestId("missao-doses-fim-missao")).toHaveTextContent("1 copo d'água");
    expect(screen.getByTestId("missao-doses-fim-sequencia")).toBeInTheDocument();
    expect(screen.getByTestId("missao-doses-fim-conquistas")).toBeInTheDocument();
    expect(screen.getByTestId("missao-doses-fim-pendencias")).toHaveTextContent("Pendências de amanhã");
    expect(eventos).toContainEqual(["missao_doses_fim", expect.objectContaining({ modulos: ["financas", "rotina", "saude"] })]);
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    expect(screen.queryByTestId("missao-doses-fim")).toBeNull();
    expect(lerMissao()?.fimVisto).toBe(true);
    expect(rota()).toBe("/home");
    expect(screen.getByTestId("seu-dia-resumo")).toHaveTextContent("Missão cumprida · 3 de 3");
    expect(screen.queryByTestId("seu-dia-fazer")).toBeNull();
  });

  it("'Quero fazer o toque de amanhã agora' leva direto pro próximo módulo, com o passo do dia 2", () => {
    const store = montarStore(conta());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true }));
    montar(store, "/financas");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[1]); // Uber
    passarPeloOlhar();
    fireEvent.click(screen.getByTestId("missao-doses-amanha-agora"));
    expect(rota()).toBe("/rotina");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3 · Rotina");
    expect(eventos).toContainEqual(["missao_doses_amanha_agora", { dia: 1, prototipo: "web" }]);
  });
});

/* ------------------------------------------------------------ pular */

describe("pular, sem trava dura", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on"); });

  it("'Explorar por conta própria' nas boas-vindas: mede missao_pular (link_boas_vindas) e a missão CONTINUA no card", () => {
    montar(montarStore(conta()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-explorar"));
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(eventos).toContainEqual(["missao_pular", { dia: 1, passo: "boas_vindas", segundos: 0, via: "link_boas_vindas", prototipo: "web" }]);
    expect(lerMissao()?.explorou).toBe(true);
    const card = screen.getByTestId("seu-dia");
    expect(card).toHaveTextContent("Dia 1 de 3 · missão 0/3");
    expect(screen.getByTestId("seu-dia-fazer")).toHaveTextContent("Fazer o toque de hoje");
  });

  it("dentro do módulo: sem 'Pular' nos primeiros 20 s; aos 20 s (ou no 2º toque na faixa) ele aparece; pular mede faixa_20s, volta pra Home e o card diz 'Hoje: ainda não' — e o botão do card traz o passo de volta", () => {
    const store = montarStore(conta());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true }));
    montar(store, "/financas");
    esperarPostIt();
    expect(screen.queryByTestId("missao-doses-pular")).toBeNull();
    avancar(PULAR_DEPOIS_DE_MS);
    fireEvent.click(screen.getByTestId("missao-doses-pular"));
    expect(eventos).toContainEqual(["missao_pular", { dia: 1, passo: "toque", segundos: expect.any(Number), via: "faixa_20s", prototipo: "web" }]);
    expect(rota()).toBe("/home");
    expect(lerMissao()?.pulados).toEqual({ 1: "2026-10-02" });
    expect(screen.getByTestId("seu-dia")).toHaveTextContent("Hoje: ainda não");
    // o passo não volta sozinho hoje…
    fireEvent.click(screen.getByTestId("seu-dia-linha-1")); // a linha de hoje também leva ao passo
    expect(rota()).toBe("/financas");
    // …mas pelo card ele volta (o pulo de hoje é desfeito)
    expect(lerMissao()?.pulados).toEqual({});
    expect(screen.getByTestId("missao-doses-faixa")).toBeInTheDocument();
    // 2º toque na faixa: o Pular aparece sem esperar 20 s
    fireEvent.click(screen.getByTestId("missao-doses-faixa"));
    fireEvent.click(screen.getByTestId("missao-doses-faixa"));
    expect(screen.getByTestId("missao-doses-pular")).toBeInTheDocument();
  });

  it("depois de pular hoje, abrir o módulo por conta própria NÃO traz o passo (o toque registrado por ela ainda conta amanhã pelo card)", () => {
    const store = montarStore(conta());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, pulados: { 1: "2026-10-02" } }));
    montar(store, "/financas");
    avancar(6000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
  });

  it("'Pular este passo' no olhar: mede missao_pular (passo) e segue pra comemoração — o dia conta", () => {
    const store = montarStore(conta());
    const m = iniciarMissao(["financas", "rotina", "saude"], "2026-10-02");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true }));
    montar(store, "/financas");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    esperarOlharOuFesta();
    fireEvent.click(screen.getByTestId("missao-doses-pular-passo"));
    expect(eventos).toContainEqual(["missao_pular", { dia: 1, passo: "olhar", segundos: expect.any(Number), via: "passo", prototipo: "web" }]);
    expect(screen.getByTestId("missao-doses-festa")).toBeInTheDocument();
    expect(lerMissao()?.feitos[1]?.rotulo).toBe("Café · R$ 12");
  });
});
