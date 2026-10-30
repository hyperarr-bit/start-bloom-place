/**
 * 29/10 (print do dono): "Desafio cumprido! 2 dias sem gastar. Monge 🧘" logo que o desafio aparece — ele contava os dias
 * da semana ANTERIORES à escolha. Agora: `active.meta.desde` (o dia da escolha) e os "dias sem gastar" só contam dali;
 * o que já foi conquistado (histórico, e o desafio escolhido antes do conserto, sem `desde`) não muda.
 * + o card espera o 1º gasto (conta sem gasto nenhum não vê o Desafio nem grava opções)
 * + o "Dicas para começar" com a lâmpada (desenho da 1.0.12) em 3 módulos, Beleza na paleta dela, mantendo o toque.
 * Fixtures no formato real das chaves do user_data: `finance-expenses` (lista de gastos), `finance-sem-gasto`
 * ({ "AAAA-MM-DD": true }), `finance-challenges` ({ active, history, ofertas }).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, afterEach, type Mock } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-desde" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));
vi.mock("@/lib/demo-do-funil", () => ({ useDemoDoFunil: () => null }));

import { trackEvent } from "@/lib/analytics";
import { WeeklyChallenge } from "@/components/challenges/WeeklyChallenge";
import { type ChallengesState } from "@/components/challenges/challenges";
import { avaliarNoCatalogo, defDoCatalogo, montarDados } from "@/components/challenges/catalogo";
import { escolher, fecharSemana, ofertasVisiveis } from "@/components/challenges/rodizio";
import { ModuleTip } from "@/components/ModuleTip";
import { DicasDaBeleza } from "@/components/beleza/kit";
import { EVENTO_ABRIR_ABA, type DetalheAbrirAba } from "@/lib/dicas-do-modulo";

beforeAll(() => { Element.prototype.scrollIntoView = () => {}; });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  (trackEvent as Mock).mockClear();
  localStorage.clear();
});

const quando = (a: number, m: number, d: number, h = 10) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(a, m - 1, d, h, 0));
};
/** Um gasto como o app grava em `finance-expenses`. */
let seq = 0;
const gasto = (date: string, value: number, category = "restaurante") =>
  ({ id: `g${++seq}`, description: category, value, date, category, paymentMethod: "pix" });
const SEMANA = "2026-10-12"; // seg 12 → dom 18/10
const dados = (store: Record<string, unknown>, hoje: Date, meta: Record<string, unknown> = {}) =>
  montarDados({ ler: (k) => store[k], weekStart: SEMANA, perfil: "pessoal", hoje, meta });
const zero = () => defDoCatalogo("tres-dias-zero")!;

const criarStore = (inicial: Record<string, unknown>) => {
  const dadosStore: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const sistema: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dadosStore ? (dadosStore[key] as T) : fallback),
    set: (key: string, value: unknown, opts?: { system?: boolean }) => { dadosStore[key] = JSON.parse(JSON.stringify(value)); if (opts?.system) sistema.push(key); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  return { dados: dadosStore, sistema, valor };
};
const montar = (store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}><WeeklyChallenge expenses={(store.dados["finance-expenses"] as never) ?? []} /></UserDataContext.Provider>);
const desafios = (d: Record<string, unknown>) => d["finance-challenges"] as ChallengesState;
const eventos = (nome: string) => (trackEvent as Mock).mock.calls.filter((c) => c[0] === nome).map((c) => c[1]);

describe("BUG: 'dias sem gastar' não conta dias de antes da escolha", () => {
  it("escolhido na QUARTA com seg/ter sem nada anotado: 0 de 2 (antes: 'cumprido' na hora); quinta conta a quarta; sexta marcada fecha", () => {
    const store = { "finance-expenses": [gasto("2026-10-08", 35)] }; // só um gasto na semana anterior (o da conta nova)
    const quarta = new Date(2026, 9, 14, 10);
    // como era: sem `desde`, seg e ter (sem gasto) já valiam 2 → vitória na 1ª abertura
    expect(avaliarNoCatalogo(zero(), 1, dados(store, quarta)).done).toBe(true);

    const ativo = escolher({ key: "tres-dias-zero", nivel: 1 }, dados(store, quarta));
    expect(ativo.meta).toEqual({ desde: "2026-10-14" });
    const naHora = avaliarNoCatalogo(zero(), 1, dados(store, quarta, ativo.meta));
    expect(naHora).toMatchObject({ done: false, failed: false, statusText: "0 de 2 dias zerados", pct: 0 });

    // quinta: a quarta passou sem gasto → 1 de 2
    const quinta = new Date(2026, 9, 15, 10);
    expect(avaliarNoCatalogo(zero(), 1, dados(store, quinta, ativo.meta)).statusText).toBe("1 de 2 dias zerados");
    // sexta marcada "não gastei nada hoje" → 2 de 2
    const sexta = new Date(2026, 9, 16, 10);
    const comMarca = { ...store, "finance-sem-gasto": { "2026-10-16": true } };
    expect(avaliarNoCatalogo(zero(), 1, dados(comMarca, sexta, ativo.meta))).toMatchObject({ done: true, statusText: "2 dias sem gastar. Monge 🧘" });
  });

  it("nível 2 (3 dias) na sexta: sem gasto hoje ainda dá (sex marcado + sáb + dom) e a opção aparece; com gasto hoje não cabe mais e a opção some", () => {
    const sexta = new Date(2026, 9, 16, 10);
    const store = { "finance-expenses": [gasto("2026-10-16", 20)] };
    const estado: ChallengesState = { active: null, history: [], ofertas: { weekStart: SEMANA, itens: [{ key: "tres-dias-zero", nivel: 2 }] } };
    expect(ofertasVisiveis(estado, SEMANA, dados(store, sexta))).toEqual([]);
    const semGastoHoje = { "finance-expenses": [gasto("2026-10-13", 20)] };
    expect(ofertasVisiveis(estado, SEMANA, dados(semGastoHoje, sexta))).toHaveLength(1);
    const ativo2 = escolher({ key: "tres-dias-zero", nivel: 2 }, dados(semGastoHoje, sexta));
    expect(avaliarNoCatalogo(zero(), 2, dados(semGastoHoje, sexta, ativo2.meta))).toMatchObject({ statusText: "0 de 3 dias zerados", failed: false });
  });

  it("o que já foi conquistado não muda: desafio escolhido ANTES do conserto (sem `desde`) segue a regra de antes, e a vitória no histórico fica", () => {
    const quarta = new Date(2026, 9, 14, 10);
    const antigo: ChallengesState = {
      active: { key: "tres-dias-zero", weekStart: SEMANA, nivel: 1 },
      history: [{ key: "tres-dias-zero", weekStart: SEMANA, result: "win", nivel: 1, motivo: "cumpriu" }, { key: "sem-outros", weekStart: "2026-10-05", result: "win", nivel: 1, motivo: "cumpriu" }],
    };
    expect(avaliarNoCatalogo(zero(), 1, dados({}, quarta, antigo.active!.meta ?? {})).done).toBe(true);
    // a virada fecha sem apagar nada do histórico
    const segunda = new Date(2026, 9, 19, 9);
    const fechado = fecharSemana(antigo, (ws, meta) => montarDados({ ler: () => undefined, weekStart: ws, perfil: "pessoal", hoje: segunda, meta }), segunda);
    expect(fechado?.estado.history).toEqual(antigo.history);
  });

  it("no card: conta nova escolhe '2 dias sem gastar' na quarta → '0 de 2 dias zerados', sem 'Desafio cumprido!', sem vitória gravada", async () => {
    quando(2026, 10, 14);
    const store = criarStore({ "finance-expenses": [gasto("2026-10-08", 35)] });
    montar(store);
    await act(async () => {});
    fireEvent.click(screen.getByTestId("oferta-tres-dias-zero"));
    await act(async () => {});
    expect(desafios(store.dados).active).toEqual({ key: "tres-dias-zero", weekStart: SEMANA, nivel: 1, meta: { desde: "2026-10-14" } });
    expect(screen.queryByText("Desafio cumprido!")).toBeNull();
    expect(screen.getByTestId("desafio-status")).toHaveTextContent("0 de 2 dias zerados");
    expect(desafios(store.dados).history).toEqual([]);
    expect(eventos("challenge_won")).toHaveLength(0);
  });

  it("no card: quem já tinha o 'cumprido' (ativo antigo sem `desde`, vitória no histórico) continua vendo a vitória — nada é apagado", async () => {
    quando(2026, 10, 14);
    const historico = [{ key: "tres-dias-zero", weekStart: SEMANA, result: "win", nivel: 1, motivo: "cumpriu" }];
    const store = criarStore({
      "finance-expenses": [gasto("2026-10-08", 35)],
      "finance-challenges": { active: { key: "tres-dias-zero", weekStart: SEMANA, nivel: 1 }, history: historico },
    });
    montar(store);
    await act(async () => {});
    expect(screen.getByText("Desafio cumprido!")).toBeInTheDocument();
    expect(screen.getByText("1 vencido 🏆")).toBeInTheDocument();
    expect(desafios(store.dados).history).toEqual(historico);
  });

  it("domingo: '2 dias sem gastar' não aparece pra escolher (só cabe 1 dia); as outras seguem", () => {
    const domingo = new Date(2026, 9, 18, 10);
    const d = dados({ "finance-expenses": [gasto("2026-10-08", 35)] }, domingo);
    const estado: ChallengesState = { active: null, history: [], ofertas: { weekStart: SEMANA, itens: [{ key: "tres-dias-zero", nivel: 1 }, { key: "sem-outros", nivel: 1 }, { key: "registro-5-dias", nivel: 1 }] } };
    expect(ofertasVisiveis(estado, SEMANA, d).map((o) => o.key)).toEqual(["sem-outros", "registro-5-dias"]);
    const sabado = dados({}, new Date(2026, 9, 17, 10));
    expect(ofertasVisiveis(estado, SEMANA, sabado).map((o) => o.key)).toContain("tres-dias-zero");
    // sem os dados (chamada antiga), nada muda
    expect(ofertasVisiveis(estado, SEMANA)).toHaveLength(3);
  });
});

describe("o Desafio da semana espera o 1º gasto", () => {
  it("conta sem gasto nenhum: sem card, sem opções gravadas, sem desafio_ofertas", async () => {
    quando(2026, 10, 14);
    const store = criarStore({ "finance-incomes": [{ id: "i1", description: "Salário", value: 3000, date: "2026-10-05" }] });
    const { container } = montar(store);
    await act(async () => {});
    expect(container.textContent).toBe("");
    expect(store.dados["finance-challenges"]).toBeUndefined();
    expect(eventos("desafio_ofertas")).toHaveLength(0);
  });

  it("o 1º gasto (só na semana anterior, ou num mês arquivado) já mostra as opções", async () => {
    quando(2026, 10, 14);
    const store = criarStore({ "finance-expenses": [gasto("2026-10-13", 18)] });
    montar(store);
    await act(async () => {});
    expect(screen.getByTestId("desafio-ofertas")).toBeInTheDocument();
    expect(store.sistema).toEqual(["finance-challenges"]);
  });

  it("quem já viu o card (opções gravadas), ocultou ou tem desafio continua vendo — mesmo sem gasto", async () => {
    quando(2026, 10, 14);
    const comOfertas = criarStore({ "finance-challenges": { active: null, history: [], ofertas: { weekStart: SEMANA, itens: [{ key: "registro-5-dias", nivel: 1 }] } } });
    montar(comOfertas);
    await act(async () => {});
    expect(screen.getByTestId("desafio-ofertas")).toBeInTheDocument();
    cleanup();
    const oculto = criarStore({ "finance-challenges-hidden": true });
    montar(oculto);
    await act(async () => {});
    expect(screen.getByTestId("desafios-desligados")).toBeInTheDocument();
  });
});

describe("Dicas para começar com a lâmpada (desenho da 1.0.12) — o toque continua levando à aba", () => {
  const Store = ({ children }: { children: React.ReactNode }) => (
    <UserDataContext.Provider value={criarStore({}).valor}>{children}</UserDataContext.Provider>
  );
  for (const modulo of ["financas", "rotina", "saude"]) {
    it(`${modulo}: lâmpada, título, dicas com marcador e seta; tocar abre a aba da dica`, () => {
      vi.useFakeTimers(); // o toque procura o alvo com setTimeout: sem isto ele roda depois do fim do arquivo
      render(<Store><ModuleTip moduleId={modulo} /></Store>);
      const cartao = screen.getByTestId("dicas-modulo");
      expect(cartao.getAttribute("data-modo")).toBe("toque");
      expect(screen.getByTestId("dicas-lampada").querySelector("svg.lucide-lightbulb")).not.toBeNull();
      expect(cartao.className).toMatch(/bg-primary\/5/);
      expect(screen.getByText("Dicas para começar")).toBeInTheDocument();
      const abertas: DetalheAbrirAba[] = [];
      const ouvir = (e: Event) => abertas.push((e as CustomEvent<DetalheAbrirAba>).detail);
      window.addEventListener(EVENTO_ABRIR_ABA, ouvir);
      fireEvent.click(screen.getByTestId("dica-1"));
      window.removeEventListener(EVENTO_ABRIR_ABA, ouvir);
      expect(abertas).toHaveLength(1);
      expect(abertas[0].modulo).toBe(modulo);
      expect(eventos("dica_toque")[0]).toMatchObject({ modulo, dica: 1, modo: "toque" });
      vi.clearAllTimers();
    });
  }
  it("Beleza: o mesmo desenho, na paleta dela", () => {
    render(<Store><DicasDaBeleza /></Store>);
    const cartao = screen.getByTestId("dicas-beleza");
    expect(cartao.className).toMatch(/bg-bz-dica/);
    expect(screen.getByTestId("dicas-lampada").className).toMatch(/text-bz-acento/);
    expect(screen.getByText("Dicas pra começar")).toBeInTheDocument();
  });
});
