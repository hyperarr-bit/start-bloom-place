/**
 * SUGESTÕES DE CLIENTES DE 10/10.
 *
 *  1) Pendências de hoje editáveis (Home): "aparece pra registrar o peso, eu
 *     não quero fazer isso diariamente, prefiro semanalmente. Também não
 *     gostaria que aparecesse anotar as refeições." — cada tipo automático
 *     tem "Não mostrar isso"; o que está oculto sai da lista, da contagem e do
 *     Score do Dia (dá pra chegar a 100 com o que sobra); peso 1x por semana.
 *  2) Saldo em conta (Finanças): "receitas menos o que é pago via pix/débito,
 *     aí bate certinho com o saldo que tenho em conta" — faturas que vencem no
 *     mês entram; compra no crédito deste mês não.
 *  3) Meta de calorias editável (Dieta): "como faço para alterar a meta de
 *     calorias diárias?" — automática (soma do cardápio) ou fixa (chave antiga).
 *
 * Régua de sempre: chaves existentes intocadas; chaves novas opcionais; o app
 * antigo das lojas lê o mesmo que antes.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline, pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import {
  CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, inicioDaSemana, normalizarPrefs, pesoCobradoHoje, scoreDosBlocos, tiposCobradosHoje,
  type PendenciasPrefs,
} from "@/lib/home-pendencias";
import { calcularSaldoEmConta } from "@/lib/finance-saldo-conta";
import { faturasAVencer } from "@/lib/finance-faturas";
import { variaveisDoMes, type CardConfig } from "@/lib/finance-fatura";
import { Dashboard } from "@/components/Dashboard";
import { CHAVE_META_KCAL_ANTIGA, CHAVE_META_KCAL_MODO, consumoDoDia, metaDoDia, normalizarModoMeta } from "@/lib/dieta-consumo";
import { CaloriesWidget } from "@/components/home/widgets/CaloriesWidget";
import { localDayKey } from "@/lib/utils";

type Dados = Record<string, unknown>;
/** Como a nuvem: JSON (undefined some); reativo (cada set re-renderiza quem lê). */
function criarStore(inicial: Dados) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados, escritas: [] as string[] };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; estado.escritas.push(k); subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode) => render(<MemoryRouter><Provedor>{ui}</Provedor></MemoryRouter>);
  const ler = <T,>(k: string) => estado.dados[k] as T;
  return { estado, montar, ler };
}

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const hoje = () => localDayKey();
const diaDaSemana = () => DIAS[new Date().getDay()];

/** O mesmo fixture do pendencias-score.test: tudo feito, sem suplemento, sem livro, sem plano de refeições. */
const tudoFeitoBasico = (): Dados => ({
  "rotina-habits": [{ id: "h1", name: "Meditar" }, { id: "h2", name: "Alongar" }],
  "core-rotina-habit-log": { [hoje()]: { h1: true, h2: true } },
  "saude-workouts-v2": { [diaDaSemana()]: { muscles: ["Peito"] } },
  "treino-active-days": [diaDaSemana()],
  "saude-workout-log": [hoje()],
  "core-saude-water": { [hoje()]: 8 },
  "core-dieta-log": { [hoje()]: { cafe: { calories: 300 }, almoco: {}, lanche: {}, jantar: {} } },
  "mood-log": { [hoje()]: 4 },
  "dp-gratitude": { [hoje()]: ["família"] },
  "hiperfoco-thoughts": { [hoje()]: { ideias: ["app novo"] } },
  "core-saude-measures": [{ date: hoje(), weight: 70 }],
  "sleep-log": { [hoje()]: 7.5 },
  "finance-expenses": [{ date: hoje(), value: 12.5, category: "Alimentação" }],
});

const Sonda = () => {
  const d = useLifeHubData();
  return (<><p data-testid="score">{d.dayScore}</p><NextHoursTimeline data={d} /></>);
};
const renderHome = (dados: Dados) => {
  const store = criarStore(dados);
  store.montar(<Sonda />);
  fireEvent.click(screen.getByRole("button", { name: /Pendências de hoje/ }));
  return store;
};
const score = () => Number(screen.getByTestId("score").textContent);
const pendentes = () => screen.queryAllByTestId("pendencia").map((b) => b.textContent || "");

/* ------------------------------------------------------------------ 1) PENDÊNCIAS */
describe("1) Pendências de hoje editáveis — lib", () => {
  it("normalizarPrefs: lixo vira padrão; tipos desconhecidos e repetidos somem; dia fora de 0–6 cai no padrão", () => {
    expect(normalizarPrefs(null)).toEqual(PREFS_PADRAO);
    expect(normalizarPrefs("x")).toEqual(PREFS_PADRAO);
    expect(normalizarPrefs({ ocultos: ["peso", "peso", "xpto", 3], peso: { frequencia: "semanal", diaSemana: 9 } }))
      .toEqual({ ocultos: ["peso"], peso: { frequencia: "semanal", diaSemana: 1 } });
    expect(normalizarPrefs({ peso: { frequencia: "semanal", diaSemana: 5 } }).peso).toEqual({ frequencia: "semanal", diaSemana: 5 });
  });

  it("scoreDosBlocos: com os 12 cobrados é a soma de sempre; escondendo tipos, quem fez o resto fecha em 100; tudo escondido = 100", () => {
    const blocos = [
      { tipo: "treino" as const, pontos: 15, max: 15 }, { tipo: "habitos" as const, pontos: 20, max: 20 }, { tipo: "agua" as const, pontos: 15, max: 15 },
      { tipo: "refeicoes" as const, pontos: 0, max: 10 }, { tipo: "leitura" as const, pontos: 5, max: 5 }, { tipo: "humor" as const, pontos: 5, max: 5 },
      { tipo: "gratidao" as const, pontos: 5, max: 5 }, { tipo: "ideia" as const, pontos: 5, max: 5 }, { tipo: "peso" as const, pontos: 0, max: 5 },
      { tipo: "suplementos" as const, pontos: 5, max: 5 }, { tipo: "sono" as const, pontos: 5, max: 5 }, { tipo: "gasto" as const, pontos: 5, max: 5 },
    ];
    const todos = tiposCobradosHoje(PREFS_PADRAO, true);
    expect(scoreDosBlocos(blocos, todos)).toBe(85); // 100 − refeições 10 − peso 5
    expect(scoreDosBlocos(blocos, tiposCobradosHoje({ ...PREFS_PADRAO, ocultos: ["refeicoes"] }, true))).toBe(Math.round(85 / 90 * 100)); // 94
    expect(scoreDosBlocos(blocos, tiposCobradosHoje({ ...PREFS_PADRAO, ocultos: ["refeicoes", "peso"] }, true))).toBe(100);
    // peso semanal fora do dia: sai da conta como se estivesse oculto
    expect(scoreDosBlocos(blocos, tiposCobradosHoje({ ...PREFS_PADRAO, ocultos: ["refeicoes"] }, false))).toBe(100);
    expect(scoreDosBlocos(blocos, new Set())).toBe(100);
  });

  it("pesoCobradoHoje: diária sempre; semanal só no dia escolhido e só se não pesou antes na semana (pesar hoje mesmo não esconde)", () => {
    const sexta = new Date(2026, 9, 9, 10); // sexta 09/10/2026
    expect(inicioDaSemana(sexta)).toBe("2026-10-05");
    expect(inicioDaSemana(new Date(2026, 9, 5, 10))).toBe("2026-10-05"); // segunda = ela mesma
    expect(inicioDaSemana(new Date(2026, 9, 11, 10))).toBe("2026-10-05"); // domingo fecha a semana
    const semanal = (dia: number): PendenciasPrefs => ({ ocultos: [], peso: { frequencia: "semanal", diaSemana: dia } });
    expect(pesoCobradoHoje(PREFS_PADRAO, [], sexta)).toBe(true);
    expect(pesoCobradoHoje(undefined, [], sexta)).toBe(true);
    expect(pesoCobradoHoje(semanal(5), [], sexta)).toBe(true);
    expect(pesoCobradoHoje(semanal(3), [], sexta)).toBe(false); // quarta é o dia; hoje é sexta
    expect(pesoCobradoHoje(semanal(5), ["2026-10-07"], sexta)).toBe(false); // já pesou quarta
    expect(pesoCobradoHoje(semanal(5), ["2026-10-02"], sexta)).toBe(true); // semana passada não conta
    expect(pesoCobradoHoje(semanal(5), ["2026-10-09"], sexta)).toBe(true); // pesou HOJE: aparece como feito
  });

  it("pendenciasDeHoje: sem `pendenciasCobradas` (fixture antiga) cobra tudo; com ela, filtra por tipo e o compromisso fica", () => {
    const base = {
      dayScore: 0, streak: 0, monthBalance: 0, nextBillName: null, nextBillDate: null, nextBillDaysUntil: null,
      todayWorkoutGroup: "Peito", workoutDone: false, workoutTime: null, workoutStatus: "treino" as const,
      caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 0, mealsTotal: 4, waterGlasses: 0, waterGoal: 8, sleepHours: null,
      supplementsTaken: 0, supplementsTotal: 0, currentBook: null, readingProgress: 0, booksReadThisYear: 0,
      tasksCompleted: 0, tasksTotal: 1, habits: [{ name: "Ler", done: false }], userName: "",
      registrosHoje: { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false },
    };
    const agora = new Date(); agora.setHours(8, 0, 0, 0);
    const compromissos = [{ id: "c1", titulo: "Dentista", data: hoje(), hora: "15:00" }] as never[];
    const tudo = pendenciasDeHoje(base, compromissos, agora);
    expect(tudo.pending.map((p) => p.tipo ?? "compromisso")).toEqual(["compromisso", "habitos", "treino", "refeicoes", "agua", "humor", "gasto", "peso", "sono", "ideia", "gratidao"]);
    const filtrado = pendenciasDeHoje({ ...base, pendenciasCobradas: ["habitos", "agua"] }, compromissos, agora);
    expect(filtrado.pending.map((p) => p.tipo ?? "compromisso")).toEqual(["compromisso", "habitos", "agua"]);
    expect(filtrado.avisoTreino).toBe(false); // treino escondido esconde a dica também
  });
});

describe("1) Pendências de hoje editáveis — tela", () => {
  it("sem preferência gravada a Home é a de sempre: refeições pendentes, score 90 (sem refeições e sem peso = 85)", () => {
    renderHome({ ...tudoFeitoBasico(), "core-dieta-log": {}, "core-saude-measures": [] });
    expect(score()).toBe(85);
    expect(pendentes()).toEqual([expect.stringMatching(/4 refeições para registrar/), expect.stringMatching(/Pesar hoje/)]);
    expect(screen.getByText("2 pendentes")).toBeInTheDocument();
  });

  it("⋯ → 'Ocultar sempre' nas refeições: grava a chave nova, a linha some, a contagem cai e o score sobe (90 → só o peso falta → 94)", () => {
    const store = renderHome({ ...tudoFeitoBasico(), "core-dieta-log": {}, "core-saude-measures": [] });
    fireEvent.click(screen.getByTestId("opcoes-refeicoes"));
    expect(screen.getByTestId("menu-refeicoes")).toHaveTextContent(/Não mostrar isso/);
    fireEvent.click(screen.getByTestId("ocultar-refeicoes"));
    expect(store.ler<PendenciasPrefs>(CHAVE_PENDENCIAS_PREFS)).toEqual({ ocultos: ["refeicoes"], peso: { frequencia: "diaria", diaSemana: 1 } });
    expect(pendentes()).toEqual([expect.stringMatching(/Pesar hoje/)]);
    expect(screen.getByText("1 pendente")).toBeInTheDocument();
    expect(score()).toBe(Math.round(85 / 90 * 100));
    // só as chaves de preferência foram escritas — nada das chaves antigas
    expect(store.estado.escritas).toEqual([CHAVE_PENDENCIAS_PREFS]);
    // o resumo "1 tipo oculto · personalizar" aparece no pé
    expect(screen.getByTestId("ocultos-resumo")).toHaveTextContent("1 tipo oculto");
  });

  it("ocultar refeições E peso: quem fez tudo o que sobrou fecha em 100 com lista vazia (o score não cobra o que a pessoa escondeu)", () => {
    renderHome({ ...tudoFeitoBasico(), "core-dieta-log": {}, "core-saude-measures": [], [CHAVE_PENDENCIAS_PREFS]: { ocultos: ["refeicoes", "peso"] } });
    expect(score()).toBe(100);
    expect(pendentes()).toEqual([]);
    expect(screen.queryByText(/pendente/)).not.toBeInTheDocument();
  });

  it("peso 1x por semana: no dia escolhido aparece 'Pesar hoje (semanal)' e vale ponto; em outro dia não aparece e o score fecha em 100 sem pesar", () => {
    const d = new Date().getDay();
    renderHome({ ...tudoFeitoBasico(), "core-saude-measures": [], [CHAVE_PENDENCIAS_PREFS]: { peso: { frequencia: "semanal", diaSemana: d } } });
    expect(pendentes()).toEqual([expect.stringMatching(/Pesar hoje \(semanal\)/)]);
    expect(score()).toBe(95);
    cleanup();
    renderHome({ ...tudoFeitoBasico(), "core-saude-measures": [], [CHAVE_PENDENCIAS_PREFS]: { peso: { frequencia: "semanal", diaSemana: (d + 1) % 7 } } });
    expect(pendentes()).toEqual([]);
    expect(score()).toBe(100);
  });

  it("peso semanal: já pesou num dia anterior da semana → no dia escolhido não cobra; pesou hoje → 'Peso da semana registrado'", () => {
    const d = new Date().getDay();
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    const ontemK = localDayKey(ontem);
    const prefs = { peso: { frequencia: "semanal", diaSemana: d } };
    // "ontem" só está na mesma semana se hoje não for segunda
    if (d !== 1) {
      renderHome({ ...tudoFeitoBasico(), "core-saude-measures": [{ date: ontemK, weight: 70 }], [CHAVE_PENDENCIAS_PREFS]: prefs });
      expect(pendentes()).toEqual([]);
      expect(score()).toBe(100);
      cleanup();
    }
    renderHome({ ...tudoFeitoBasico(), [CHAVE_PENDENCIAS_PREFS]: prefs });
    expect(screen.getByText("Peso da semana registrado")).toBeInTheDocument();
    expect(score()).toBe(100);
  });

  it("menu do peso: 'Só 1x por semana' grava a frequência com o dia de hoje e abre a folha Personalizar", () => {
    const store = renderHome({ ...tudoFeitoBasico(), "core-saude-measures": [] });
    fireEvent.click(screen.getByTestId("opcoes-peso"));
    fireEvent.click(screen.getByTestId("peso-semanal"));
    expect(store.ler<PendenciasPrefs>(CHAVE_PENDENCIAS_PREFS).peso).toEqual({ frequencia: "semanal", diaSemana: new Date().getDay() });
    expect(screen.getByTestId("personalizar-pendencias")).toBeInTheDocument();
    expect(screen.getByTestId("peso-frequencia")).toHaveTextContent(/Só aparece nesse dia/);
  });

  it("Personalizar: religar o que estava oculto volta pra lista e pro score; compromissos não estão na folha", () => {
    const store = renderHome({ ...tudoFeitoBasico(), "sleep-log": {}, [CHAVE_PENDENCIAS_PREFS]: { ocultos: ["sono"] } });
    expect(score()).toBe(100);
    expect(pendentes()).toEqual([]);
    fireEvent.click(screen.getByTestId("personalizar-pendencias-abrir"));
    const folha = screen.getByTestId("personalizar-pendencias");
    expect(within(folha).getByText("1 tipo oculto")).toBeInTheDocument();
    expect(within(folha).queryByText(/Compromisso/)).toBeInTheDocument(); // só no rodapé: "sempre aparecem — são seus"
    expect(within(folha).queryByTestId("pref-compromissos")).toBeNull();
    const sw = within(screen.getByTestId("pref-sono")).getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(store.ler<PendenciasPrefs>(CHAVE_PENDENCIAS_PREFS).ocultos).toEqual([]);
    expect(pendentes()).toEqual([expect.stringMatching(/Registrar sono/)]);
    expect(score()).toBe(95);
  });

  it("compat: o app antigo não conhece home-pendencias-prefs — a chave fica intacta e nenhuma chave antiga muda de forma", () => {
    const store = renderHome({ ...tudoFeitoBasico(), [CHAVE_PENDENCIAS_PREFS]: { ocultos: ["refeicoes"], peso: { frequencia: "semanal", diaSemana: 2 }, extra: 1 } });
    // o que o app novo lê, normalizado; o que está gravado, intacto (o campo extra sobrevive)
    expect(store.ler<Record<string, unknown>>(CHAVE_PENDENCIAS_PREFS).extra).toBe(1);
    expect(store.estado.escritas).toEqual([]);
    expect(Array.isArray(store.ler("core-saude-measures"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ 2) SALDO EM CONTA */
describe("2) Saldo em conta — lib", () => {
  const cfg: Record<string, CardConfig> = {
    nubank: { closingDay: 25, dueDay: 5 }, // fecha 25, vence dia 5 do mês seguinte
    inter: { dueDay: 15 },                 // sem fechamento, com vencimento (conta no mês da compra, fatura vence dia 15)
    outro: {},                             // nada cadastrado
  };
  const configOf = (c: string) => cfg[c];
  const temVencimento = (c: string) => Number.isInteger(cfg[c]?.dueDay);

  it("só Pix/débito: saldo em conta = saldo do mês; gasto sem forma de pagamento conta como 'sai da conta' e é avisado", () => {
    const r = calcularSaldoEmConta({
      receitas: 3000,
      variaveis: [{ value: 200, paymentMethod: "pix" }, { value: 100, paymentMethod: "debito" }, { value: 50 }],
      fixos: [{ value: 1000, paymentMethod: "boleto" }, { value: 80, paymentMethod: "dinheiro" }],
      parcelas: [], faturas: [], temVencimento,
    });
    expect(r).toMatchObject({ saldo: 1570, debitoDireto: 1430, faturas: 0, creditoSemFatura: 0, semForma: 1, cartoesSemVencimento: [] });
  });

  it("cartão COM fechamento: a compra no crédito deste mês não sai da conta; o que sai é a fatura que VENCE neste mês (a que fechou no mês passado)", () => {
    const setembro = [{ id: "s1", value: 400, date: "2026-09-10", paymentMethod: "credito", cardName: "nubank" }, { id: "s2", value: 90, date: "2026-09-28", paymentMethod: "credito", cardName: "nubank" }];
    const outubro = [{ id: "o1", value: 250, date: "2026-10-03", paymentMethod: "credito", cardName: "nubank" }, { id: "o2", value: 120, date: "2026-10-04", paymentMethod: "pix" }];
    const gastosDoMes = (mes: string) => (mes === "2026-10" ? outubro : mes === "2026-09" ? setembro : []);
    const faturas = faturasAVencer({ mes: "2026-10", gastosDoMes, parcelasDoMes: () => [], fixos: [], cards: ["nubank"], configOf, labelOf: (c) => c, pagas: {} });
    expect(faturas.map((f) => [f.card, f.total])).toEqual([["nubank", 400]]); // a de 28/09 já é da fatura que fecha 25/10 (vence em nov)
    const vars = variaveisDoMes(outubro, setembro, "2026-10", configOf);
    const r = calcularSaldoEmConta({ receitas: 3000, variaveis: vars.noMes, fixos: [], parcelas: [], faturas, temVencimento });
    // 3000 − pix 120 − fatura 400; o crédito de 03/10 (250) e o de 28/09 (90) não saem da conta em outubro
    expect(r).toMatchObject({ saldo: 2480, debitoDireto: 120, faturas: 400, creditoSemFatura: 0, cartoesSemVencimento: [] });
  });

  it("cartão SEM fechamento mas com vencimento: fatura do mês = compras do mês; sem vencimento nenhum: o crédito conta no mês e a ⚙️ é apontada", () => {
    const outubro = [
      { id: "a", value: 300, date: "2026-10-02", paymentMethod: "credito", cardName: "inter" },
      { id: "b", value: 70, date: "2026-10-06", paymentMethod: "credito", cardName: "outro" },
      { id: "c", value: 40, date: "2026-10-06", paymentMethod: "pix" },
    ];
    const faturas = faturasAVencer({ mes: "2026-10", gastosDoMes: (m) => (m === "2026-10" ? outubro : []), parcelasDoMes: () => [], fixos: [], cards: ["inter", "outro"], configOf, labelOf: (c) => c, pagas: {} });
    expect(faturas.map((f) => [f.card, f.total])).toEqual([["inter", 300]]);
    const r = calcularSaldoEmConta({ receitas: 1000, variaveis: variaveisDoMes(outubro, [], "2026-10", configOf).noMes, fixos: [], parcelas: [], faturas, temVencimento });
    expect(r).toMatchObject({ saldo: 1000 - 40 - 300 - 70, debitoDireto: 40, faturas: 300, creditoSemFatura: 70, cartoesSemVencimento: ["outro"] });
  });

  it("parcelas: em cartão com vencimento já estão dentro da fatura; em cartão sem vencimento saem da conta no mês; fixo no crédito idem", () => {
    const parcelas = [
      { id: "p1", description: "Celular", totalValue: 1200, installmentValue: 100, paidInstallments: 2, totalInstallments: 12, cardName: "nubank", category: "eletronicos", date: "2026-08-01", startMonth: "2026-10", parcelaDoMes: 3 },
      { id: "p2", description: "Sofá", totalValue: 600, installmentValue: 60, paidInstallments: 0, totalInstallments: 10, cardName: "outro", category: "casa", date: "2026-10-01", startMonth: "2026-10", parcelaDoMes: 1 },
    ];
    const faturas = faturasAVencer({ mes: "2026-10", gastosDoMes: () => [], parcelasDoMes: (m) => (m === "2026-09" || m === "2026-10" ? parcelas : []), fixos: [{ value: 55, paymentMethod: "credito", cardName: "nubank" }], cards: ["nubank"], configOf, labelOf: (c) => c, pagas: {} });
    // nubank vence dia 5 do mês seguinte: a fatura que vence em out. fechou em set. (parcela 100 + fixo 55)
    expect(faturas.map((f) => [f.card, f.total])).toEqual([["nubank", 155]]);
    const r = calcularSaldoEmConta({ receitas: 2000, variaveis: [], fixos: [{ value: 55, paymentMethod: "credito", cardName: "nubank" }, { value: 30, paymentMethod: "credito", cardName: "outro" }], parcelas, faturas, temVencimento });
    expect(r).toMatchObject({ saldo: 2000 - 155 - 60 - 30, faturas: 155, creditoSemFatura: 90, cartoesSemVencimento: ["outro"] });
  });
});

describe("2) Saldo em conta — tela", () => {
  const props = {
    totalIncome: 3000, totalExpenses: 1770, totalDebts: 0, totalInvestments: 0, expenses: [], fixedExpenses: [], dueDays: [], savingsRate: 41, incomes: [],
  };
  it("sem a prop o Dashboard é o de sempre (nada de Saldo em conta)", () => {
    criarStore({}).montar(<Dashboard {...props} />);
    expect(screen.getByText("Saldo do Mês")).toBeInTheDocument();
    expect(screen.queryByTestId("saldo-em-conta")).toBeNull();
  });

  it("com a prop: Saldo do Mês +R$ 1.230 e Saldo em conta +R$ 2.480; o ⓘ abre a explicação com a diferença, as parcelas da conta e o aviso do dado que falta", () => {
    const saldo = calcularSaldoEmConta({
      receitas: 3000, variaveis: [{ value: 120, paymentMethod: "pix" }, { value: 250, paymentMethod: "credito", cardName: "nubank" }, { value: 15 }],
      fixos: [], parcelas: [], faturas: [{ card: "nubank", total: 400 }], temVencimento: () => true,
    });
    criarStore({}).montar(<Dashboard {...props} saldoEmConta={saldo} />);
    expect(screen.getByText("Saldo do Mês").parentElement).toHaveTextContent(/\+R\$ 1\.230(,00)?$/);
    expect(screen.getByTestId("saldo-em-conta-valor")).toHaveTextContent(/\+R\$ 2\.465(,00)?$/);
    expect(screen.queryByTestId("saldo-em-conta-explicacao")).toBeNull();
    fireEvent.click(screen.getByTestId("saldo-em-conta-info"));
    const exp = screen.getByTestId("saldo-em-conta-explicacao");
    expect(exp).toHaveTextContent(/Saldo do Mês.*quanto do mês já está comprometido/);
    expect(exp).toHaveTextContent(/Saldo em conta.*quanto sobra na conta/);
    expect(exp).toHaveTextContent(/Faturas que vencem no mês− R\$ 400(,00)?/);
    expect(exp).toHaveTextContent(/Sai da conta \(Pix, débito, boleto…\)− R\$ 135(,00)?/);
    expect(exp).toHaveTextContent(/1 lançamento sem forma de pagamento entrou como "sai da conta"/);
  });
});

/* ------------------------------------------------------------------ 3) META DE CALORIAS */
describe("3) Meta de calorias editável — lib", () => {
  it("modo auto (padrão, chave ausente ou lixo): soma do cardápio, senão a antiga, senão 2000 — a regra de sempre", () => {
    expect(normalizarModoMeta(undefined)).toBe("auto");
    expect(normalizarModoMeta("xpto")).toBe("auto");
    expect(metaDoDia({ kcalPlanejadas: 1650, metaAntiga: 2000 })).toBe(1650);
    expect(metaDoDia({ kcalPlanejadas: 0, metaAntiga: 1800 })).toBe(1800);
    expect(metaDoDia({ kcalPlanejadas: 0, metaAntiga: "abc" })).toBe(2000);
    expect(consumoDoDia({ log: {}, kcalPlano: { Almoço: 700 }, metaAntiga: 1800 }).meta).toBe(700);
  });

  it("modo fixa: a chave antiga vence o cardápio (e lixo na antiga cai no 2000)", () => {
    expect(metaDoDia({ kcalPlanejadas: 1650, metaAntiga: 1800, modo: "fixa" })).toBe(1800);
    expect(metaDoDia({ kcalPlanejadas: 1650, metaAntiga: 1800.4, modo: "fixa" })).toBe(1800);
    expect(metaDoDia({ kcalPlanejadas: 1650, metaAntiga: 0, modo: "fixa" })).toBe(2000);
    const r = consumoDoDia({ log: { q: { calories: 500 } }, kcalPlano: { Almoço: 700, Janta: 500 }, metaAntiga: 1800, modoMeta: "fixa" });
    expect(r).toMatchObject({ kcal: 500, kcalPlanejadas: 1200, meta: 1800 });
  });
});

describe("3) Meta de calorias editável — widget da Home segue a mesma regra", () => {
  const DIA = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][new Date().getDay()];
  const dieta = {
    "saude-meals-kcal": { [DIA]: { "Café da Manhã": 350, Almoço: 700, Janta: 600 } },
    "core-dieta-log": { [hoje()]: { "quick-1": { name: "Pão", calories: 300 } } },
  };
  it("automática: 300 / 1650 kcal (soma do cardápio)", () => {
    criarStore(dieta).montar(<CaloriesWidget size="large" />);
    expect(screen.getByText("/ 1650 kcal")).toBeInTheDocument();
  });
  it("fixa 1800 (chave antiga + flag nova): 300 / 1800 kcal — o app antigo, que só lê a chave antiga, vê o mesmo 1800", () => {
    criarStore({ ...dieta, [CHAVE_META_KCAL_ANTIGA]: 1800, [CHAVE_META_KCAL_MODO]: "fixa" }).montar(<CaloriesWidget size="large" />);
    expect(screen.getByText("/ 1800 kcal")).toBeInTheDocument();
  });
  it("chave antiga 1800 SEM a flag (quem gravou no app antigo ou nunca mexeu): cardápio continua mandando — nada muda sozinho", () => {
    criarStore({ ...dieta, [CHAVE_META_KCAL_ANTIGA]: 1800 }).montar(<CaloriesWidget size="large" />);
    expect(screen.getByText("/ 1650 kcal")).toBeInTheDocument();
  });
});
