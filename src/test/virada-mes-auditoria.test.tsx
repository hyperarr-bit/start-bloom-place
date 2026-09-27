/**
 * AUDITORIA DA VIRADA DO MÊS (26/09) — o que acontece de 30/09 23:59 pra
 * 01/10 00:01 e de 31/12 pra 01/01, com o relógio simulado no fuso de
 * Brasília. Rodar com:
 *   TZ=America/Sao_Paulo npx vitest run src/test/virada-mes-auditoria.test.tsx
 *
 * Três tipos de bloco:
 *  - "OK": comportamento que já estava certo, travado;
 *  - "CORRIGIDO (26/09)": defeito consertado nesta rodada (lib/virada-contas,
 *    lib/virada-do-mes, hooks/use-virada-do-mes, MonthTurnover) — o teste
 *    falhava com o código de antes;
 *  - "BUG ABERTO": defeito em arquivo fora desta rodada. O teste REPRODUZ o
 *    defeito como ele é hoje (passa porque o defeito existe); o comentário
 *    diz o que seria o certo. Quem consertar inverte a asserção.
 *
 * O "app" aqui é fiel no que importa: Router, um UserDataProvider que muda o
 * `get` a cada escrita e grava no localStorage na hora, o hook da virada no
 * PAI das telas (como em AnimatedRoutes) e, na rota /financas, um dublê da
 * tela de Finanças com o mesmo `usePersistedState` nas mesmas chaves.
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: "u-virada" } as { id: string } | null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}), upsert: async () => ({}), select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
}));
const barras: { month: string; Receitas: number }[][] = vi.hoisted(() => []);
vi.mock("@/components/finance/DashboardGraficos", () => ({
  GraficoReceitasDespesas: ({ dados }: { dados: { month: string; Receitas: number }[] }) => { barras.push(dados); return <div data-testid="grafico-receitas-despesas" />; },
  GraficoCategorias: () => null,
  GraficoPatrimonio: () => null,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useViradaDoMes, useVersaoDaVirada } from "@/hooks/use-virada-do-mes";
import {
  mesCorrenteId, viradaDeContas, mesDeNascimento, CHAVE_CARIMBO_CONTAS, type DiaDeContas,
} from "@/lib/virada-contas";
import { separarPorMes, viradaDeFixos, CHAVE_CARIMBO_FIXOS } from "@/lib/virada-do-mes";
import { syncFixedExpensesToBills } from "@/lib/finance-sync";
import { viradaDeParcelas, parcelaAtiva, parcelaQuitada, valorDaParcelaNoMes, type Parcela } from "@/lib/finance-parcelas";
import { mesDaFatura, variaveisDoMes, rotuloVencimento } from "@/lib/finance-fatura";
import { faturasDoMes, faturasAVencer, mesDeFechamento, venceNoMesSeguinte } from "@/lib/finance-faturas";
import { totaisDoMes, parPadrao } from "@/components/finance/MonthComparison";
import { buildWrappedData } from "@/components/wrapped/MonthlyWrapped";
import { MonthTurnover, copyToMonth, planoDeCopia } from "@/components/MonthTurnover";
import { MonthlyBudget } from "@/components/MonthlyBudget";
import Retrospectiva from "@/pages/Retrospectiva";
import { mesclarPerfil, mesclarPerfilDueDays, registrarPerfis, esquecerPerfis, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { monthsSince } from "@/components/casa/types";
import { planejarManutencao, planejarContas } from "@/lib/notificacoes";
import { lerDadosDosLembretes } from "@/lib/reagendar";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { Dashboard } from "@/components/Dashboard";

/** Mês em que os módulos foram carregados (constantes de módulo nascem aqui). */
const MES_DA_IMPORTACAO = new Date().getMonth();
const ANO_DA_IMPORTACAO = new Date().getFullYear();

const UID = "u-virada";
const lsKey = (k: string) => `u:${UID}:${k}`;
const semear = (dados: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(dados)) localStorage.setItem(lsKey(k), JSON.stringify(v));
};
/** Data LOCAL de Brasília (mês 1-12, como se fala). */
const em = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min);
/** Id de conta/fixo nascido nessa data — o formato real (`Date.now()`). */
const nascida = (a: number, m: number, d: number, h = 12) => String(em(a, m, d, h).getTime());
const contasDe = (dias: unknown) => (dias as DiaDeContas[]).flatMap((d) => d.bills);

/* ── Um UserDataProvider de verdade no que importa ─────────────────────── */
type Controle = { setLoaded: (v: boolean) => void; dados: () => Record<string, unknown>; set: (k: string, v: unknown) => void };
const Provedor = ({ inicial, loaded: loadedInicial = true, controle, children }: {
  inicial: Record<string, unknown>; loaded?: boolean; controle: Controle; children?: React.ReactNode;
}) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const [loaded, setLoaded] = useState(loadedInicial);
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.setLoaded = setLoaded;
  controle.dados = () => ref.current;
  controle.set = set;
  const valor = useMemo<UserDataContextType>(
    () => ({ get, set, loaded, isGuest: false, fetchKey: async () => null }), [get, set, loaded],
  );
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

/** Dublê da tela de Finanças: as mesmas chaves no mesmo `usePersistedState` do Index. */
const tela: {
  dueDays?: DiaDeContas[]; setDueDays?: (v: DiaDeContas[]) => void;
  expenses?: any[]; setExpenses?: (v: any[]) => void;
} = {};
const TelaDeFinancas = () => {
  const [dueDays, setDueDays] = usePersistedState<DiaDeContas[]>("finance-dueDays", []);
  const [expenses, setExpenses] = usePersistedState<any[]>("finance-expenses", []);
  tela.dueDays = dueDays; tela.setDueDays = setDueDays; tela.expenses = expenses; tela.setExpenses = setExpenses;
  return null;
};

const nav: { ir?: (rota: string) => void } = {};
const Navegador = () => { const navigate = useNavigate(); nav.ir = (r) => navigate(r); return null; };

/** Como o Index real (26/09): a versão da virada é a `key` da tela. */
const TelaComVersao = () => {
  const versao = useVersaoDaVirada();
  return <TelaDeFinancas key={versao} />;
};

/** O App: o hook da virada no pai; a tela de Finanças só existe na rota dela. */
const AppComVirada = () => {
  useViradaDoMes();
  return (
    <>
      <Navegador />
      <Routes>
        <Route path="/financas" element={<TelaComVersao />} />
        <Route path="*" element={null} />
      </Routes>
    </>
  );
};
const montarApp = (inicial: Record<string, unknown>, c: Controle, opcoes: { rota?: string; loaded?: boolean } = {}) =>
  render(
    <MemoryRouter initialEntries={[opcoes.rota ?? "/home"]}>
      <Provedor inicial={inicial} loaded={opcoes.loaded ?? true} controle={c}>
        <AppComVirada />
      </Provedor>
    </MemoryRouter>,
  );

beforeAll(() => {
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
  localStorage.clear();
  esquecerPerfis();
  auth.user = { id: UID };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* ======================================================================
 * 1. FUSO — a virada é à meia-noite de Brasília, não às 21h (UTC)
 * ==================================================================== */
describe("OK: fuso de Brasília", () => {
  it("o processo está mesmo em America/Sao_Paulo (senão o resto não prova nada)", () => {
    expect(new Date("2026-10-01T03:00:00Z").getHours()).toBe(0);
  });

  it("30/09 23:59 ainda é setembro; 01/10 00:01 é outubro; 21h de 30/09 (00h UTC) NÃO vira", () => {
    vi.setSystemTime(new Date("2026-10-01T02:59:00Z")); // 30/09 23:59 BRT
    expect(mesCorrenteId()).toBe("2026-09");
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z")); // 30/09 21:00 BRT = meia-noite UTC
    expect(mesCorrenteId()).toBe("2026-09");
    vi.setSystemTime(new Date("2026-10-01T03:01:00Z")); // 01/10 00:01 BRT
    expect(mesCorrenteId()).toBe("2026-10");
  });

  it("31/12 23:59 é dezembro; 01/01 00:01 é janeiro do ano seguinte", () => {
    expect(mesCorrenteId(em(2026, 12, 31, 23, 59))).toBe("2026-12");
    expect(mesCorrenteId(em(2027, 1, 1, 0, 1))).toBe("2027-01");
  });

  it("lançamento de 30/09 às 22h (01/10 01h UTC) fica em SETEMBRO na separação por mês", () => {
    const r = separarPorMes([{ id: "x", date: "2026-09-30" }, { id: "y", date: "2026-10-01" }], em(2026, 10, 1, 0, 1), "expenses");
    expect(r.arquivar["finance-2026-setembro-expenses"].map((i) => i.id)).toEqual(["x"]);
    expect(r.ficam.map((i) => i.id)).toEqual(["y"]);
  });
});

/* ======================================================================
 * 2. CONTAS DO MÊS: o que é copiado, o que zera, o que é arquivado
 * ==================================================================== */
describe("OK/CORRIGIDO: contas do mês na virada 30/09 → 01/10", () => {
  const aluguelFixo = { id: nascida(2026, 8, 3), description: "Aluguel", value: 2000, day: 5, category: "moradia" };
  const setembro: DiaDeContas[] = [
    { day: 5, color: "yellow", bills: [{ id: `fx-${aluguelFixo.id}`, name: "Aluguel", paid: true, value: 2000, fixedId: aluguelFixo.id }] },
    { day: 20, color: "slate", bills: [{ id: nascida(2026, 8, 10), name: "IPVA", paid: false, value: 900 }] },
  ];

  it("23:59 de 30/09 não faz nada; 00:01 de 01/10 zera o ✓, preserva a conta e arquiva setembro como ele foi", () => {
    expect(viradaDeContas(setembro, "2026-09", em(2026, 9, 30, 23, 59))).toBeNull();
    const v = viradaDeContas(setembro, "2026-09", em(2026, 10, 1, 0, 1))!;
    expect(v.carimbo).toBe("2026-10");
    expect(contasDe(v.zeradas).map((b) => [b.name, b.paid, b.id])).toEqual([
      ["Aluguel", false, `fx-${aluguelFixo.id}`], ["IPVA", false, setembro[1].bills[0].id],
    ]);
    expect(v.zeradas[0].bills[0].fixedId).toBe(aluguelFixo.id); // vínculo com o fixo intacto
    expect(v.arquivo!.chave).toBe("finance-2026-setembro-dueDays");
    expect(contasDe(v.arquivo!.contas).map((b) => b.paid)).toEqual([true, false]); // histórico como foi
  });

  it("conta que venceu e NÃO foi paga em setembro: não duplica nem vira 'atrasada' em outubro — vira a de outubro, e o não-pago fica só no arquivo", () => {
    const v = viradaDeContas(setembro, "2026-09", em(2026, 10, 1, 0, 1))!;
    const outubro = v.zeradas;
    expect(contasDe(outubro).filter((b) => b.name === "IPVA")).toHaveLength(1);
    // o sync de fixos não recria nem duplica nada depois da virada
    expect(syncFixedExpensesToBills([aluguelFixo], outubro)).toBeNull();
    expect(contasDe(v.arquivo!.contas).find((b) => b.name === "IPVA")!.paid).toBe(false);
  });

  it("virada de ano: carimbo 2026-12 em 01/01/2027 arquiva em finance-2026-dezembro-*", () => {
    const v = viradaDeContas(setembro, "2026-12", em(2027, 1, 1, 0, 1))!;
    expect(v.arquivo!.chave).toBe("finance-2026-dezembro-dueDays");
    expect(v.carimbo).toBe("2027-01");
  });

  it("quem só volta em NOVEMBRO: arquiva o último mês usado (setembro), carimba novembro, sem duplicar; 2ª abertura é no-op", () => {
    const v = viradaDeContas(setembro, "2026-09", em(2026, 11, 5, 9))!;
    expect(v.arquivo!.chave).toBe("finance-2026-setembro-dueDays");
    expect(v.carimbo).toBe("2026-11");
    expect(contasDe(v.zeradas)).toHaveLength(2);
    expect(viradaDeContas(v.zeradas, v.carimbo, em(2026, 11, 5, 9, 1))).toBeNull();
  });

  it("CORRIGIDO (26/09): carimbo do FUTURO (aparelho num fuso à frente já virou) não faz a virada andar pra trás", () => {
    // Lisboa vira o mês às 20h de Brasília: o celular em BRT, às 22h de 30/09,
    // via "2026-10" ≠ "2026-09", arquivava o balde EM OUTUBRO e voltava o carimbo.
    expect(viradaDeContas(setembro, "2026-10", em(2026, 9, 30, 22))).toBeNull();
  });

  it("CORRIGIDO (26/09): conta nascida no mês novo mantém o ✓ e fica fora do retrato; id ilegível (legado) segue zerando", () => {
    const hoje = em(2026, 10, 3, 9);
    const dias: DiaDeContas[] = [{ day: 1, color: "yellow", bills: [
      { id: nascida(2026, 10, 1, 8), name: "Internet", paid: true },   // criada e paga em outubro
      { id: nascida(2026, 9, 2), name: "Luz", paid: true },            // de setembro
      { id: "conta-legado", name: "Água", paid: true },                // não dá pra saber
    ] }];
    const v = viradaDeContas(dias, "2026-09", hoje)!;
    expect(contasDe(v.zeradas).map((b) => [b.name, b.paid])).toEqual([["Internet", true], ["Luz", false], ["Água", false]]);
    expect(contasDe(v.arquivo!.contas).map((b) => b.name)).toEqual(["Luz", "Água"]);
    expect(mesDeNascimento(`fx-${nascida(2026, 10, 1)}`, hoje)).toBe("2026-10");
    expect(mesDeNascimento(`${nascida(2026, 10, 1)}0.5341`, hoje)).toBe("2026-10"); // id da cópia do mês
    expect(mesDeNascimento("fx-jul-f1", hoje)).toBeNull();
  });
});

/* ======================================================================
 * 3. O 1º ✓ de quem acabou de chegar (CORRIGIDO) — fluxo real do hook
 * ==================================================================== */
describe("CORRIGIDO (26/09): o primeiro ✓ de conta de quem é novo não some", () => {
  it("tutorial em Finanças (renda, depois o aluguel já pago) → volta pra Home → o ✓ continua; na virada de 01/10 ele expira", () => {
    vi.setSystemTime(em(2026, 9, 26, 10, 0));
    const c = {} as Controle;
    montarApp({}, c, { rota: "/financas" });
    act(() => c.set("finance-incomes", [{ id: String(Date.now()), date: "2026-09-26", value: 3000, description: "Salário" }]));
    vi.setSystemTime(em(2026, 9, 26, 10, 5));
    act(() => tela.setDueDays!([{ day: 5, color: "yellow", bills: [{ id: String(Date.now()), name: "Aluguel", paid: true, value: 1500 }] }]));
    // o hook já se deu por atendido nesta sessão (na renda), sem conta → sem carimbo
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBeUndefined();

    // abre o app de novo no dia seguinte: sem carimbo = caminho "legado". Antes
    // de 26/09 esse caminho zerava TODO ✓ — o aluguel recém-pago voltava a "não pago".
    const fimDaSessao1 = { ...c.dados() };
    cleanup();
    vi.setSystemTime(em(2026, 9, 27, 9, 0));
    montarApp(fimDaSessao1, c);
    expect(contasDe(c.dados()["finance-dueDays"])[0].paid).toBe(true);
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-09");

    // e na virada de verdade o ✓ de setembro expira e vai pro retrato de setembro
    const fimDeSetembro = { ...c.dados() };
    cleanup();
    vi.setSystemTime(em(2026, 10, 1, 0, 1));
    montarApp(fimDeSetembro, c);
    expect(contasDe(c.dados()["finance-dueDays"])[0].paid).toBe(false);
    expect(contasDe(c.dados()["finance-2026-setembro-dueDays"])[0].paid).toBe(true);
  });
});

/* ======================================================================
 * 4. CUSTOS FIXOS de setembro depois da virada (CORRIGIDO no hook)
 * ==================================================================== */
describe("CORRIGIDO (26/09): o aluguel de setembro não some de setembro no dia 1º", () => {
  const fixos = [
    { id: nascida(2026, 8, 3), description: "Aluguel", value: 2000, day: 5, category: "moradia" },
    { id: nascida(2026, 8, 3, 13), description: "Netflix", value: 40, category: "assinaturas" },
  ];
  const movimentoDeSetembro = {
    "finance-incomes": [{ id: "r1", date: "2026-09-05", value: 5000, description: "Salário" }],
    "finance-expenses": [{ id: "e1", date: "2026-09-10", value: 1000, description: "Mercado", category: "mercado" }],
  };
  const base = {
    "finance-fixed-expenses": fixos,
    "finance-dueDays": [{ day: 5, color: "yellow", bills: [{ id: `fx-${fixos[0].id}`, name: "Aluguel", paid: true, value: 2000, fixedId: fixos[0].id }] }],
    [CHAVE_CARIMBO_CONTAS]: "2026-09",
    ...movimentoDeSetembro,
  };

  it("retrospectiva, Comparação Mensal e resumo leem setembro COM os fixos depois da virada", () => {
    vi.setSystemTime(em(2026, 9, 30, 23, 59));
    semear(base);
    expect(totaisDoMes({ ano: 2026, idx: 8 }, UID, PERFIL_PESSOAL).custosFixos).toBe(2040); // setembro corrente

    vi.setSystemTime(em(2026, 10, 1, 0, 1));
    const c = {} as Controle;
    montarApp(base, c);
    expect(c.dados()["finance-2026-setembro-fixed"]).toEqual(fixos);
    expect(c.dados()[CHAVE_CARIMBO_FIXOS]).toBe("2026-10");
    expect(totaisDoMes({ ano: 2026, idx: 8 }, UID, PERFIL_PESSOAL)).toMatchObject({ receitas: 5000, custosFixos: 2040, custosVariaveis: 1000 });
    // a retrospectiva do dia 1º (notificação das 10h) conta o aluguel
    expect(buildWrappedData("Setembro", UID, 2026)!.outflow).toBe(3040);
    // outubro começa com os mesmos fixos (chave única), nada duplicado
    expect(c.dados()["finance-fixed-expenses"]).toEqual(fixos);
  });

  it("vale também pra quem só tem fixo SEM dia (sem conta nenhuma no mês)", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 1));
    const c = {} as Controle;
    montarApp({ "finance-fixed-expenses": [fixos[1]], ...movimentoDeSetembro }, c);
    expect(c.dados()["finance-2026-setembro-fixed"]).toEqual([fixos[1]]);
    expect(totaisDoMes({ ano: 2026, idx: 8 }, UID, PERFIL_PESSOAL).custosFixos).toBe(40);
  });

  it("mês SEM receita nem gasto não ganha retrato (senão a retrospectiva diria 'saiu R$ 2.040, entrou R$ 0')", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 1));
    const c = {} as Controle;
    montarApp({ "finance-fixed-expenses": fixos, "finance-dueDays": base["finance-dueDays"], [CHAVE_CARIMBO_CONTAS]: "2026-09" }, c);
    expect(c.dados()["finance-2026-setembro-fixed"]).toBeUndefined();
    expect(c.dados()[CHAVE_CARIMBO_FIXOS]).toBe("2026-10");
    expect(buildWrappedData("Setembro", UID, 2026)).toBeNull();
  });

  it("planilha de setembro já editada (chave existe, mesmo vazia) nunca é sobrescrita; a 2ª abertura do mês não regrava", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 1));
    const c = {} as Controle;
    const editada = { ...base, "finance-2026-setembro-fixed": [] };
    semear(editada);
    montarApp(editada, c);
    expect(c.dados()["finance-2026-setembro-fixed"]).toEqual([]);
    const fim = { ...c.dados() };
    cleanup();
    localStorage.removeItem(lsKey("finance-2026-setembro-fixed"));
    vi.setSystemTime(em(2026, 10, 2, 9));
    montarApp({ ...fim, "finance-2026-setembro-fixed": undefined }, c);
    expect(c.dados()["finance-2026-setembro-fixed"]).toBeUndefined(); // carimbo já é outubro: não mexe
  });

  it("regra pura: sem carimbo (transição de 01/10/2026) usa o mês anterior; dez → jan vira o ano; carimbo do futuro não anda pra trás", () => {
    const sempre = () => true;
    expect(viradaDeFixos(fixos, "", em(2026, 10, 1, 0, 1), sempre)!.arquivo!.chave).toBe("finance-2026-setembro-fixed");
    expect(viradaDeFixos(fixos, "2026-12", em(2027, 1, 1, 0, 1), sempre)!.arquivo!.chave).toBe("finance-2026-dezembro-fixed");
    expect(viradaDeFixos(fixos, "2026-08", em(2026, 10, 1, 0, 1), sempre)!.arquivo!.chave).toBe("finance-2026-agosto-fixed");
    expect(viradaDeFixos(fixos, "2026-10", em(2026, 9, 30, 22), sempre)).toBeNull();
    expect(viradaDeFixos([], "", em(2026, 10, 1), sempre)).toBeNull(); // convidado vazio: nem carimbo
  });
});

/* ======================================================================
 * 5. APP ABERTO atravessando a meia-noite (CORRIGIDO no hook)
 * ==================================================================== */
describe("CORRIGIDO (26/09): o mês vira com o app aberto", () => {
  const dados = {
    "finance-dueDays": [
      { day: 1, color: "yellow", bills: [{ id: nascida(2026, 8, 2), name: "Internet", paid: false, value: 120 }] },
      { day: 5, color: "slate", bills: [{ id: nascida(2026, 8, 2, 13), name: "Aluguel", paid: true, value: 2000 }] },
    ],
    [CHAVE_CARIMBO_CONTAS]: "2026-09",
    "finance-incomes": [{ id: "r1", date: "2026-09-05", value: 5000, description: "Salário" }],
    "finance-expenses": [{ id: "e-set", date: "2026-09-28", value: 300, description: "Mercado" }],
  };

  it("app vivo na Home: na volta (focus) em 01/10 a virada roda na hora — antes esperava matar o app", () => {
    vi.setSystemTime(em(2026, 9, 30, 22, 0));
    semear(dados);
    const c = {} as Controle;
    montarApp(dados, c);
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-09");

    vi.setSystemTime(em(2026, 10, 1, 7, 30));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-10");
    expect(contasDe(c.dados()["finance-dueDays"]).every((b) => !b.paid)).toBe(true);
    expect(c.dados()["finance-2026-setembro-incomes"]).toHaveLength(1);
    expect(c.dados()["finance-2026-setembro-expenses"]).toHaveLength(1);
  });

  it("app vivo EM Finanças: na volta vira na hora e a tela REMONTA com outubro; o 1º toque não devolve setembro", () => {
    vi.setSystemTime(em(2026, 9, 30, 22, 0));
    semear(dados);
    const c = {} as Controle;
    montarApp(dados, c, { rota: "/financas" });
    expect(contasDe(tela.dueDays)[1].paid).toBe(true); // setembro, com o Aluguel pago

    vi.setSystemTime(em(2026, 10, 1, 7, 30));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-10");
    // a tela renasceu lendo o store virado (a `key` é a versão da virada)
    expect(contasDe(tela.dueDays).every((b) => !b.paid)).toBe(true);
    expect(tela.expenses).toEqual([]);

    // 1º toque: a padaria de outubro. Setembro não volta pro balde.
    act(() => tela.setExpenses!([...tela.expenses!, { id: "e-out", date: "2026-10-01", value: 50, description: "Padaria" }]));
    expect((c.dados()["finance-expenses"] as any[]).map((e) => e.id)).toEqual(["e-out"]);
    expect((c.dados()["finance-2026-setembro-expenses"] as any[]).map((e) => e.id)).toEqual(["e-set"]);
    expect(contasDe(c.dados()["finance-dueDays"]).filter((b) => b.paid)).toEqual([]);
  });
});

/* ======================================================================
 * 6. FINANÇAS COMO 1ª TELA DO DIA 1º (CORRIGIDO: remonta pela versão da virada)
 *    O mesmo cenário com o Index DE VERDADE: src/test/virada-mes-index.test.tsx
 * ==================================================================== */
describe("CORRIGIDO (26/09): Finanças como 1ª tela do dia 1º", () => {
  it("a tela monta com o cache de setembro; a virada roda na carga e ela remonta com outubro — o 1º toque não ressuscita setembro", () => {
    vi.setSystemTime(em(2026, 10, 1, 8, 0)); // toque no aviso "seu limite de hoje" (rota /financas), 8h
    const setembro = {
      "finance-dueDays": [
        { day: 5, color: "yellow", bills: [{ id: nascida(2026, 8, 3), name: "Aluguel", paid: true, value: 2000 }] },
        { day: 10, color: "slate", bills: [{ id: nascida(2026, 8, 4), name: "Luz", paid: true, value: 180 }] },
      ],
      [CHAVE_CARIMBO_CONTAS]: "2026-09",
      "finance-expenses": [{ id: "e-set", date: "2026-09-28", value: 300, description: "Mercado" }],
    };
    semear(setembro);
    const c = {} as Controle;
    // a carga do servidor ainda não terminou quando a tela monta
    montarApp(setembro, c, { rota: "/financas", loaded: false });
    expect(tela.expenses!.map((e) => e.id)).toEqual(["e-set"]); // cache: setembro
    act(() => c.setLoaded(true));
    // Antes de 26/09 a virada rodava aqui e a tela SEGUIA com setembro em
    // memória: o 1º toque devolvia Aluguel ✓ e Luz ✓ pra outubro já carimbado.
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-10");
    expect(tela.expenses).toEqual([]);
    expect(contasDe(tela.dueDays).every((b) => !b.paid)).toBe(true);

    act(() => {
      tela.setDueDays!([...tela.dueDays!, { day: 15, color: "indigo", bills: [{ id: String(Date.now()), name: "Internet", paid: false }] }]);
      tela.setExpenses!([...tela.expenses!, { id: "e-out", date: "2026-10-01", value: 50, description: "Padaria" }]);
    });
    const depois = c.dados();
    expect(contasDe(depois["finance-dueDays"]).filter((b) => b.paid)).toEqual([]);
    expect(contasDe(depois["finance-2026-setembro-dueDays"]).map((b) => [b.name, b.paid])).toEqual([["Aluguel", true], ["Luz", true]]);
    expect((depois["finance-2026-setembro-expenses"] as any[]).map((e) => e.id)).toEqual(["e-set"]);
    expect((depois["finance-expenses"] as any[]).map((e) => e.id)).toEqual(["e-out"]);
  });
});

/* ======================================================================
 * 7. PARCELAS
 * ==================================================================== */
describe("OK: parcelas na virada", () => {
  const p = (o: Partial<Parcela>): Parcela => ({
    id: "p1", description: "Geladeira", totalValue: 1200, installmentValue: 120, paidInstallments: 2, totalInstallments: 10,
    cardName: "nubank", category: "casa", date: "2026-07-15", startMonth: "2026-09", parcelaDoMes: 3, ...o,
  });

  it("a parcela de outubro entra sozinha (3→4 de 10) e o pago avança mesmo sem ✓ em setembro; setembro guarda o retrato", () => {
    const v = viradaDeParcelas([p({})], "2026-10")!;
    expect(v.lista[0]).toMatchObject({ startMonth: "2026-10", parcelaDoMes: 4, paidInstallments: 3 });
    expect(v.arquivos["2026-09"][0]).toMatchObject({ parcelaDoMes: 3, paidInstallments: 2, levada: true });
    expect(viradaDeParcelas(v.lista, "2026-10")).toBeNull(); // idempotente
  });

  it("parcelamento que termina em setembro: em outubro fica QUITADO (R$ 0 no mês), não some da lista", () => {
    const v = viradaDeParcelas([p({ totalInstallments: 3, parcelaDoMes: 3, paidInstallments: 3 })], "2026-10")!;
    const out = v.lista[0];
    expect(parcelaQuitada(out)).toBe(true);
    expect(parcelaAtiva(out)).toBe(false);
    expect(valorDaParcelaNoMes(out)).toBe(0);
  });

  it("virada de ano e mês pulado: dez→jan com retrato em finance-2026-dezembro; set→nov preenche outubro", () => {
    const dez = viradaDeParcelas([p({ startMonth: "2026-12" })], "2027-01")!;
    expect(Object.keys(dez.arquivos)).toEqual(["2026-12"]);
    expect(dez.lista[0]).toMatchObject({ startMonth: "2027-01", parcelaDoMes: 4 });
    const nov = viradaDeParcelas([p({})], "2026-11")!;
    expect(Object.keys(nov.arquivos).sort()).toEqual(["2026-09", "2026-10"]);
    expect(nov.lista[0].parcelaDoMes).toBe(5);
  });
});

/* ======================================================================
 * 8. FATURA DO CARTÃO
 * ==================================================================== */
describe("OK: fatura com fechamento na virada", () => {
  const cfg = { closingDay: 25, dueDay: 30 };
  const configOf = (c: string) => (c === "nubank" ? cfg : undefined);
  const compra = (id: string, date: string, value: number) => ({ id, date, value, paymentMethod: "credito", cardName: "nubank" });

  it("compra de 28/09 com fechamento dia 25 é da fatura de OUTUBRO: sai de setembro, entra em outubro", () => {
    expect(mesDaFatura("2026-09-28", 25)).toBe("2026-10");
    expect(mesDaFatura("2026-09-25", 25)).toBe("2026-09");
    const set = variaveisDoMes([compra("a", "2026-09-10", 100), compra("b", "2026-09-28", 50)], [], "2026-09", configOf);
    expect(set.total).toBe(100);
    expect(set.adiados.map((g) => g.id)).toEqual(["b"]);
    // em outubro o balde de setembro já está arquivado e é o "anterior"
    const out = variaveisDoMes([compra("c", "2026-10-03", 30)], [compra("a", "2026-09-10", 100), compra("b", "2026-09-28", 50)], "2026-10", configOf);
    expect(out.total).toBe(80);
    expect(out.doMesAnterior.map((g) => g.id)).toEqual(["b"]);
  });

  it("o 'pago' de setembro não vaza pra outubro (chave AAAA-MM:cartão); dez → jan vira o ano", () => {
    const base = { variaveis: [compra("c", "2026-10-03", 30)], variaveisAnterior: [], fixos: [], parcelas: [], cards: ["nubank"], configOf, labelOf: () => "Nubank" };
    expect(faturasDoMes({ ...base, mes: "2026-10", pagas: { "2026-09:nubank": true } })[0].paga).toBe(false);
    expect(faturasDoMes({ ...base, mes: "2026-10", pagas: { "2026-10:nubank": true } })[0].paga).toBe(true);
    expect(mesDaFatura("2026-12-28", 25)).toBe("2027-01");
  });

  it("CORRIGIDO (26/09): cartão que 'vence dia 5 do mês seguinte' mostra no dia 5/10 a fatura que FECHOU em 25/09", () => {
    // Fecha 25, vence 5: a conta que vence em 05/10 é a fatura de setembro —
    // compras de 26/08 a 25/09 (aqui: R$ 20 de 28/08 + R$ 100 de 10/09) + a
    // parcela de setembro + o fixo no cartão. Antes a linha do dia 5/10 somava
    // a fatura que fecha em 25/10 (R$ 50 de 28/09 + R$ 30 de 03/10), parcial.
    const cfg5 = { closingDay: 25, dueDay: 5 };
    const gastos: Record<string, any[]> = {
      "2026-08": [compra("ago", "2026-08-28", 20)],
      "2026-09": [compra("a", "2026-09-10", 100), compra("b", "2026-09-28", 50)],
      "2026-10": [compra("c", "2026-10-03", 30)],
    };
    const tv = { id: "tv", description: "TV", totalValue: 1200, installmentValue: 100, paidInstallments: 3, totalInstallments: 12, cardName: "nubank", category: "casa", date: "2026-07-10" };
    const parcelas: Record<string, any[]> = {
      "2026-09": [{ ...tv, startMonth: "2026-09", parcelaDoMes: 3, paidInstallments: 2 }],
      "2026-10": [{ ...tv, startMonth: "2026-10", parcelaDoMes: 4 }],
    };
    const entrada = {
      gastosDoMes: (m: string) => gastos[m] ?? [], parcelasDoMes: (m: string) => parcelas[m] ?? [],
      fixos: [{ paymentMethod: "credito", cardName: "nubank", value: 40 }], cards: ["nubank"],
      configOf: () => cfg5, labelOf: () => "Nubank",
    };
    expect(rotuloVencimento(cfg5)).toBe("vence dia 5 do mês seguinte");
    const out = faturasAVencer({ ...entrada, mes: "2026-10", pagas: { "2026-09:nubank": true } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ dueDay: 5, variaveis: 120, parcelas: 100, fixos: 40, total: 260, paga: false });
    // o "paguei" é do mês em que ela VENCE
    expect(faturasAVencer({ ...entrada, mes: "2026-10", pagas: { "2026-10:nubank": true } })[0].paga).toBe(true);
    expect(mesDeFechamento("2026-10", cfg5)).toBe("2026-09");
    expect(mesDeFechamento("2027-01", cfg5)).toBe("2026-12");
    // cartão que fecha e vence no mesmo mês (fecha 20, vence 27): nada muda
    const mesmoMes = { closingDay: 20, dueDay: 27 };
    expect(venceNoMesSeguinte(mesmoMes)).toBe(false);
    expect(faturasAVencer({ ...entrada, configOf: () => mesmoMes, mes: "2026-10", pagas: {} })[0])
      .toEqual(faturasDoMes({ mes: "2026-10", variaveis: gastos["2026-10"], variaveisAnterior: gastos["2026-09"], fixos: entrada.fixos, parcelas: parcelas["2026-10"], cards: ["nubank"], configOf: () => mesmoMes, labelOf: () => "Nubank", pagas: {} })[0]);
  });
});

/* ======================================================================
 * 9. RESUMO / CÓPIA DO MÊS (MonthTurnover) — CORRIGIDOS
 * ==================================================================== */
describe("CORRIGIDO (26/09): MonthTurnover na virada", () => {
  it("janeiro/2027 enxerga o dezembro de 2026 (antes lia finance-2027-dezembro-* e o cartão sumia)", () => {
    vi.setSystemTime(em(2027, 1, 5, 9));
    const dados = {
      "finance-2026-dezembro-incomes": [{ id: "r", date: "2026-12-05", value: 5000, description: "Salário" }],
      "finance-2026-dezembro-expenses": [{ id: "e", date: "2026-12-20", value: 1200, description: "Natal" }],
      "finance-last-seen-month": "Dezembro-2026",
    };
    semear(dados);
    render(<Provedor inicial={dados} controle={{} as Controle}><MonthTurnover /></Provedor>);
    expect(screen.getByText("Dezembro acabou!")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 5\.000/).length).toBeGreaterThan(0);
    // e a cópia traz o salário pro MESMO dia de janeiro
    expect(planoDeCopia(UID, "Dezembro", "Janeiro", 2026).receitas.map((r) => r.date)).toEqual(["2027-01-05"]);
  });

  it("saldo do resumo = receitas − (fixos + variáveis + PARCELA do mês), não menos a dívida inteira", () => {
    vi.setSystemTime(em(2026, 10, 2, 9));
    const dados = {
      "finance-2026-setembro-incomes": [{ id: "r", date: "2026-09-05", value: 5000, description: "Salário" }],
      "finance-2026-setembro-expenses": [{ id: "e", date: "2026-09-10", value: 1000, description: "Mercado" }],
      "finance-2026-setembro-fixed": [{ id: "f", description: "Aluguel", value: 2000, day: 5 }],
      "finance-2026-setembro-installments": [{
        id: "p", description: "Celular", totalValue: 1800, installmentValue: 150, paidInstallments: 2, totalInstallments: 12,
        cardName: "nubank", category: "eletronicos", date: "2026-07-10", startMonth: "2026-09", parcelaDoMes: 3, levada: true,
      }],
      "finance-last-seen-month": "Setembro-2026",
    };
    semear(dados);
    render(<Provedor inicial={dados} controle={{} as Controle}><MonthTurnover /></Provedor>);
    expect(screen.getByText("Setembro acabou!")).toBeInTheDocument();
    // 5000 − (1000 + 2000 + 150) = 1850. A fórmula antiga tirava os R$ 1.500
    // que FALTAM pagar do celular: 5000 − 2000 − 1000 − 1500 = 500.
    expect(screen.getByText("R$ 1.850,00")).toBeInTheDocument();
    expect(screen.queryByText("R$ 500,00")).toBeNull();
  });

  it("com a virada ainda pendente (setembro no balde), o resumo não abre com R$ 0 nem gasta a janela; arquivado, abre certo", () => {
    vi.setSystemTime(em(2026, 10, 1, 8));
    const pendente = {
      "finance-incomes": [{ id: "r", date: "2026-09-05", value: 5000, description: "Salário" }],
      "finance-last-seen-month": "Setembro-2026",
    };
    semear(pendente);
    const c = {} as Controle;
    // elemento NOVO a cada render: com o mesmo objeto o React pula a renderização
    const ui = () => <Provedor inicial={pendente} controle={c}><MonthTurnover /></Provedor>;
    const r = render(ui());
    expect(screen.queryByText("Setembro acabou!")).toBeNull();
    expect(c.dados()["finance-last-seen-month"]).toBe("Setembro-2026");
    // a virada roda (a pessoa saiu de Finanças e voltou)
    semear({ "finance-2026-setembro-incomes": pendente["finance-incomes"], "finance-incomes": [] });
    r.rerender(ui());
    expect(screen.getByText("Setembro acabou!")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 5\.000/).length).toBeGreaterThan(0);
  });

  /** 03/10: outubro já tem salário, aluguel pago no dia 1º e uma nota da
   *  empresa; setembro arquivado tem salário, freela e um IPVA avulso. */
  const cenarioDaCopia = () => {
    vi.setSystemTime(em(2026, 10, 3, 9));
    registrarPerfis([{ id: "pj1", nome: "Empresa" }]);
    const aluguelFixo = nascida(2026, 8, 3);
    const receitas: any[] = [
      { id: "o1", description: "Salário", value: 5500, date: "2026-10-01" },
      { id: "pj", description: "Nota fiscal", value: 900, date: "2026-10-02", perfil: "pj1" },
    ];
    const contas: any[] = [
      { day: 5, color: "yellow", bills: [{ id: `fx-${aluguelFixo}`, name: "Aluguel", paid: true, value: 2000, fixedId: aluguelFixo }] }, // pago em 01/10
      { day: 10, color: "slate", bills: [{ id: "luz-1", name: "Luz", paid: false }] },
    ];
    semear({
      "finance-incomes": receitas,
      "finance-dueDays": contas,
      "finance-2026-setembro-incomes": [
        { id: "s1", description: "Salário", value: 5000, date: "2026-09-05" },
        { id: "s2", description: "Freela", value: 800, date: "2026-09-20" },
      ],
      "finance-2026-setembro-dueDays": [
        { day: 5, color: "yellow", bills: [{ id: `fx-${aluguelFixo}`, name: "Aluguel", paid: true, fixedId: aluguelFixo }] },
        { day: 10, color: "slate", bills: [{ id: "luz-0", name: "Luz", paid: true }] },
        { day: 20, color: "indigo", bills: [{ id: "ipva-0", name: "IPVA", paid: true, value: 900 }] },
      ],
    });
    return { aluguelFixo, receitas, contas };
  };

  it("a cópia SÓ SOMA: salário de outubro, ✓ do aluguel e nota da empresa ficam; entra só o que falta", () => {
    const { aluguelFixo, receitas, contas } = cenarioDaCopia();
    let receitasTela = receitas;
    let contasTela = contas;
    // a porta do Index, idêntica: recompõe pelo perfil Pessoal
    const aplicarComoIndex = (chave: string, valor: any) => {
      if (chave === "finance-incomes") { receitasTela = mesclarPerfil(receitasTela, valor, PERFIL_PESSOAL); return true; }
      if (chave === "finance-dueDays") { contasTela = mesclarPerfilDueDays(contasTela, valor, PERFIL_PESSOAL); return true; }
      return false;
    };
    // o mecanismo do defeito: lista sem o item de outubro = "apagado na tela"
    expect(mesclarPerfil(receitas, [{ id: "novo", description: "Salário", value: 5000 }], PERFIL_PESSOAL).map((r) => r.id)).not.toContain("o1");

    copyToMonth(UID, "Setembro", "Outubro",
      { fixed: true, bills: true, incomes: true, categoryBudgets: true, notes: true, anoOrigem: 2026 }, aplicarComoIndex, () => {});
    // antes de 26/09: o1 sumia (trocado pela cópia de setembro) e o aluguel voltava a "não pago" com id novo
    expect(receitasTela.map((r) => r.id).slice(0, 2)).toEqual(["o1", "pj"]);
    expect(receitasTela.filter((r) => r.id === "pj")).toHaveLength(1);
    expect(receitasTela.map((r) => [r.description, r.date])).toContainEqual(["Freela", "2026-10-20"]);
    expect(receitasTela.filter((r) => r.description === "Salário")).toHaveLength(1);
    // as contas de outubro nem são tocadas: o IPVA que falta foi apagado em outubro
    expect(contasTela).toBe(contas);
    const todas = contasTela.flatMap((d) => d.bills);
    expect(todas.find((b) => b.name === "Aluguel")).toMatchObject({ paid: true, id: `fx-${aluguelFixo}` });
    expect(todas.find((b) => b.name === "Luz")!.id).toBe("luz-1");
    expect(todas.find((b) => b.name === "IPVA")).toBeUndefined();
  });

  it("as caixinhas contam só o que falta: só o Freela (fixos e contas já atravessaram o mês; o que falta ali foi apagado)", () => {
    cenarioDaCopia();
    const plano = planoDeCopia(UID, "Setembro", "Outubro", 2026);
    expect(plano.receitas.map((r) => r.description)).toEqual(["Freela"]);
    expect(plano.contas).toHaveLength(0);
    expect(plano.fixos).toHaveLength(0);
  });

  it("restauração: mês corrente sem conta nem fixo → oferece as avulsas e os fixos do retrato (a conta do fixo fica com o finance-sync)", () => {
    vi.setSystemTime(em(2026, 10, 3, 9));
    const fixo = { id: nascida(2026, 8, 3), description: "Aluguel", value: 2000, day: 5 };
    semear({
      "finance-2026-setembro-fixed": [fixo],
      "finance-2026-setembro-dueDays": [
        { day: 5, color: "yellow", bills: [{ id: `fx-${fixo.id}`, name: "Aluguel", paid: true, fixedId: fixo.id }] },
        { day: 20, color: "indigo", bills: [{ id: "ipva-0", name: "IPVA", paid: true, value: 900 }] },
      ],
    });
    const plano = planoDeCopia(UID, "Setembro", "Outubro", 2026);
    expect(plano.fixos.map((f) => f.description)).toEqual(["Aluguel"]);
    expect(plano.fixos[0].id).not.toBe(fixo.id);
    expect(plano.contas.map((c) => [c.day, c.bill.name, c.bill.paid])).toEqual([[20, "IPVA", false]]);
  });

  it("depois da virada das contas, 'Vencimentos' não aparece: não há nada que falte", () => {
    vi.setSystemTime(em(2026, 10, 1, 9));
    const contas = [{ day: 5, color: "yellow", bills: [{ id: "b1", name: "Aluguel", paid: false }] }];
    semear({ "finance-dueDays": contas, "finance-2026-setembro-dueDays": [{ ...contas[0], bills: [{ ...contas[0].bills[0], paid: true }] }] });
    expect(planoDeCopia(UID, "Setembro", "Outubro", 2026).contas).toHaveLength(0);
  });
});

/* ======================================================================
 * 10. BUGS ABERTOS — fora dos arquivos desta rodada
 * ==================================================================== */
describe("CORRIGIDO (26/09, notificacoes/reagendar): avisos de conta na virada", () => {
  it("a conta do dia 1º ganha aviso na véspera (30/09 9h): o plano cobre o mês seguinte, todo em aberto", () => {
    const plano = planejarContas([
      { ano: 2026, mes: 8, dueDays: [{ day: 1, bills: [{ name: "Aluguel", paid: true }] }, { day: 28, bills: [{ name: "Luz", paid: false }] }] },
      { ano: 2026, mes: 9, dueDays: [{ day: 1, bills: [{ name: "Aluguel", paid: false }] }, { day: 28, bills: [{ name: "Luz", paid: false }] }] },
    ], 9, em(2026, 9, 26, 10));
    expect(plano.map((a) => [a.quando.toLocaleString("pt-BR"), a.body, a.id])).toEqual([
      ["27/09/2026, 09:00:00", "Luz — dia 28", 100928],
      ["30/09/2026, 09:00:00", "Aluguel — dia 01", 101001],   // antes de 26/09: nunca existia
      ["27/10/2026, 09:00:00", "Luz — dia 28", 101028],
    ]);
    // ids na faixa das contas, sem invadir remédio/aniversário/limite
    expect(plano.every((a) => a.id >= 100000 && a.id < 110000)).toBe(true);
  });

  it("dia 31 em setembro vira 30 (e junta com a do dia 30 num aviso só); dia 30 em fevereiro vira 28", () => {
    const set = planejarContas([{ ano: 2026, mes: 8, dueDays: [{ day: 30, bills: [{ name: "Escola", paid: false }] }, { day: 31, bills: [{ name: "Cartão", paid: false }] }] }], 9, em(2026, 9, 26, 10));
    expect(set.map((a) => [a.quando.toLocaleString("pt-BR"), a.title, a.body])).toEqual([
      ["29/09/2026, 09:00:00", "2 contas vencem amanhã", "Escola, Cartão — dia 30"],
    ]);
    const fev = planejarContas([{ ano: 2027, mes: 1, dueDays: [{ day: 30, bills: [{ name: "Escola", paid: false }] }] }], 9, em(2027, 2, 10, 10));
    expect(fev.map((a) => [a.quando.toLocaleString("pt-BR"), a.body])).toEqual([["27/02/2027, 09:00:00", "Escola — dia 28"]]);
  });

  it("reagendar monta o mês seguinte em aberto, com a fatura que vence nele — e o plugin agenda os dois meses", async () => {
    vi.setSystemTime(em(2026, 9, 26, 10));
    const store: Record<string, unknown> = {
      "finance-dueDays": [{ day: 1, color: "yellow", bills: [{ id: "a", name: "Aluguel", paid: true }] }],
      "finance-card-config": { nubank: { closingDay: 25, dueDay: 5 } },
      "finance-expenses": [{ id: "g", date: "2026-09-10", value: 100, paymentMethod: "credito", cardName: "nubank" }],
    };
    const get = <T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb);
    const dados = lerDadosDosLembretes(get);
    expect(dados.dueDays.flatMap((d) => d.bills ?? []).map((b) => [b.name, b.paid])).toEqual([["Aluguel", true]]);
    // outubro: o aluguel em aberto e a fatura que fechou em 25/09, vencendo dia 5
    expect(dados.dueDaysProximoMes.map((d) => [d.day, (d.bills ?? []).map((b) => [b.name, b.paid])])).toEqual([
      [1, [["Aluguel", false]]],
      [5, [["Fatura Nubank", false]]],
    ]);

    const agendados: { id: number; body: string; schedule: { at: Date } }[] = [];
    vi.resetModules();
    vi.doMock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
    vi.doMock("@capacitor/local-notifications", () => ({
      LocalNotifications: {
        checkPermissions: async () => ({ display: "granted" }),
        createChannel: async () => {},
        getPending: async () => ({ notifications: [] }),
        cancel: async () => {},
        schedule: async ({ notifications }: { notifications: typeof agendados }) => { agendados.push(...notifications); },
      },
    }));
    try {
      const { agendarContas } = await import("@/lib/notificacoes");
      await agendarContas(dados.dueDays as never, { hora: 9, ligado: true }, dados.dueDaysProximoMes as never);
    } finally {
      vi.doUnmock("@/lib/native-shell");
      vi.doUnmock("@capacitor/local-notifications");
    }
    expect(agendados.map((a) => [a.schedule.at.toLocaleString("pt-BR"), a.body])).toEqual([
      ["30/09/2026, 09:00:00", "Aluguel — dia 01"],
      ["04/10/2026, 09:00:00", "Fatura Nubank — dia 05"],
    ]);
  });
});

describe("CORRIGIDO (26/09, Retrospectiva.tsx): aberta pela notificação do dia 1º antes do arquivamento", () => {
  it("abre setembro direto do balde corrente e acompanha a virada sem remontar", () => {
    vi.setSystemTime(em(2026, 10, 1, 10, 0));
    // o app acabou de abrir pelo toque: setembro ainda está no balde corrente
    const antes = {
      "finance-incomes": [{ id: "r1", date: "2026-09-05", value: 5000, description: "Salário" }],
      "finance-expenses": [{ id: "e1", date: "2026-09-10", value: 800, description: "Mercado" }],
    };
    semear(antes);
    const c = {} as Controle;
    render(
      <Provedor inicial={antes} controle={c}>
        <MemoryRouter initialEntries={["/retrospectiva?mes=Setembro"]}><Retrospectiva /></MemoryRouter>
      </Provedor>,
    );
    // antes de 26/09: "Sua primeira retrospectiva tá vindo" até remontar a tela
    expect(screen.queryByText(/Sua primeira retrospectiva tá vindo/)).toBeNull();
    // a capa (tema padrão "Páginas de dentro", 26/09) já aberta em setembro
    expect(screen.getByText(/toque pra virar a página/)).toBeInTheDocument();
    expect(document.querySelector("[data-tela]")?.textContent).toMatch(/O seu setembro/);
    // a carga do servidor termina e o hook do App arquiva setembro: a tela acompanha
    act(() => {
      c.set("finance-2026-setembro-incomes", antes["finance-incomes"]);
      c.set("finance-2026-setembro-expenses", antes["finance-expenses"]);
      c.set("finance-incomes", []);
      c.set("finance-expenses", []);
    });
    expect(document.querySelector("[data-tela]")?.getAttribute("data-tela")).toBe("capa");
    expect(buildWrappedData("Setembro", UID, 2026)).toMatchObject({ income: 5000, outflow: 800 });
  });
});

describe("OK (seeds relativas a hoje, frente paralela de 26/09): a demo da loja na virada", () => {
  /* Até 26/09 a demo arquivava maio–agosto FIXOS: em 01/10 a Comparação
   * Mensal abriria "set/2026: R$ 0" pra todo visitante do funil. A seed
   * passou a gerar os 4 meses anteriores a partir de HOJE — as seeds são
   * montadas na carga do módulo, então o teste recarrega o módulo JÁ no
   * relógio simulado (como o navegador faz ao abrir a página). */
  const seedsEm = async (quando: Date) => {
    vi.setSystemTime(quando);
    vi.resetModules();
    return (await import("@/lib/preview-seeds-financas")).FINANCAS_SEED;
  };

  it("em 01/10 o 'mês passado' (set/2026) tem salário e fixos; em 01/01/2027, dez/2026 também", async () => {
    for (const [quando, esperado] of [[em(2026, 10, 1, 9), { ano: 2026, idx: 8 }], [em(2027, 1, 1, 9), { ano: 2026, idx: 11 }]] as const) {
      (window as any).__PREVIEW_SEEDS__ = await seedsEm(quando);
      try {
        const [a] = parPadrao();
        expect(a).toEqual(esperado);
        expect(totaisDoMes(a, null, PERFIL_PESSOAL)).toMatchObject({ receitas: 6200, custosFixos: 3104 });
      } finally {
        delete (window as any).__PREVIEW_SEEDS__;
      }
    }
  });
});

describe("CORRIGIDO (26/09, casa/types.ts + notificacoes.ts): manutenção por mês completo", () => {
  it("filtro trocado em 30/09 (a cada 1 mês) NÃO fica atrasado em 01/10 — vence em 30/10, como o aviso", () => {
    // relógio simulado e chamada SEM data, como a tela (MaintenanceLog) chama
    const aos = (quando: Date, feito: string) => { vi.setSystemTime(quando); return monthsSince(feito); };
    expect(aos(em(2026, 10, 1, 9), "2026-09-30")).toBe(0);   // antes: 1 (atrasada no dia seguinte)
    expect(aos(em(2026, 10, 29, 9), "2026-09-30")).toBe(0);
    expect(aos(em(2026, 10, 30, 9), "2026-09-30")).toBe(1);
    // fim de mês: 31/08 + 1 mês fecha em 30/09 (na tela E no aviso)
    expect(aos(em(2026, 9, 29, 9), "2026-08-31")).toBe(0);
    expect(aos(em(2026, 9, 30, 9), "2026-08-31")).toBe(1);
    const [aviso] = planejarManutencao([{ tarefa: "Filtro", ultimaVez: "2026-08-31", frequenciaMeses: 1 }], 10, em(2026, 9, 26, 9));
    expect(aviso.quando.toLocaleString("pt-BR")).toBe("30/09/2026, 10:00:00"); // antes: 01/10 (transbordava)
  });
});

describe("CORRIGIDO (26/09, MonthlyBudget.tsx): Orçamento Mensal na virada", () => {
  const NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const cartao = (inicial: Record<string, unknown> = {}) => (
    <Provedor inicial={inicial} controle={{} as Controle}>
      <MonthlyBudget budgets={NOMES.map((month) => ({ month, value: 0, hasNote: false }))} setBudgets={() => {}} />
    </Provedor>
  );
  const linhaAtual = () => screen.getByText("(atual)").parentElement!.textContent;

  it("com o app aberto, o '(atual)' passa pra Outubro na volta ao app depois da meia-noite", () => {
    vi.setSystemTime(em(2026, 9, 30, 23, 50));
    render(cartao());
    expect(linhaAtual()).toContain("Setembro");
    vi.setSystemTime(em(2026, 10, 1, 0, 10));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(linhaAtual()).toContain("Outubro"); // antes: constante de módulo, ficava em Setembro
  });

  it("o ano guardado não prende no ano que passou; o formato antigo (número) segue valendo em 2026", () => {
    vi.setSystemTime(em(2027, 1, 5, 9));
    render(cartao({ "finance-orcamento-ano": 2026 }));                 // número puro, gravado em 2026
    expect(screen.getByText("2027")).toBeInTheDocument();
    expect(linhaAtual()).toContain("Janeiro");
    cleanup();
    render(cartao({ "finance-orcamento-ano": { ano: 2025, em: 2026 } })); // escolhido no ano passado
    expect(screen.getByText("2027")).toBeInTheDocument();
    cleanup();
    vi.setSystemTime(em(2026, 10, 1, 9));
    render(cartao({ "finance-orcamento-ano": 2025 }));                 // quem lança 2025 hoje continua em 2025
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText(/Você está em 2025/)).toBeInTheDocument();
  });
});

/* ======================================================================
 * 11. HOME e DASHBOARD (CORRIGIDOS 26/09)
 * ==================================================================== */
describe("CORRIGIDO (26/09, use-life-hub-data): 'próxima conta' da Home com mês de verdade", () => {
  const dias: Record<string, number | null> = {};
  const Espiao = () => { const d = useLifeHubData(); dias.ate = d.nextBillDaysUntil; return null; };
  const ate = (quando: Date, dia: number) => {
    vi.setSystemTime(quando);
    render(<Provedor inicial={{ "finance-dueDays": [{ day: dia, color: "yellow", bills: [{ id: "x", name: "Conta", paid: false }] }] }} controle={{} as Controle}><Espiao /></Provedor>);
    const v = dias.ate;
    cleanup();
    return v;
  };
  it("31/10 → conta do dia 1º vence AMANHÃ; 28/02 → amanhã; 30/09 → a do dia 31 vence HOJE", () => {
    expect(ate(em(2026, 10, 31, 9), 1)).toBe(1);   // antes: 0 ("vence hoje")
    expect(ate(em(2027, 2, 28, 9), 1)).toBe(1);    // antes: 3
    expect(ate(em(2026, 9, 30, 9), 31)).toBe(0);   // antes: 1 (o calendário mostra no dia 30)
    expect(ate(em(2026, 9, 26, 9), 28)).toBe(2);   // o caso comum não muda
  });
});

describe("CORRIGIDO (26/09, Dashboard.tsx): o gráfico do ano recalcula na virada", () => {
  it("aberto de 30/09 pra 01/10: na volta ao app o gráfico já tem setembro arquivado e outubro", async () => {
    vi.setSystemTime(em(2026, 9, 30, 22, 0));
    semear({ "finance-incomes": [{ id: "r-set", date: "2026-09-05", value: 5000, description: "Salário" }] });
    const props = {
      totalIncome: 5000, totalExpenses: 0, monthlyInstallments: 0, totalDebts: 0, totalInvestments: 0,
      expenses: [], fixedExpenses: [], dueDays: [], savingsRate: 100, incomes: [], onNavigate: () => {}, perfil: PERFIL_PESSOAL,
    };
    render(<MemoryRouter><Provedor inicial={{}} controle={{} as Controle}><Dashboard {...(props as any)} /></Provedor></MemoryRouter>);
    await screen.findByTestId("grafico-receitas-despesas");
    expect(barras.at(-1)!.map((b) => [b.month, b.Receitas])).toEqual([["Set", 5000]]);

    // a virada arquivou setembro e entrou o salário de outubro; a pessoa volta ao app
    vi.setSystemTime(em(2026, 10, 1, 8, 0));
    semear({
      "finance-2026-setembro-incomes": [{ id: "r-set", date: "2026-09-05", value: 5000, description: "Salário" }],
      "finance-incomes": [{ id: "r-out", date: "2026-10-01", value: 5200, description: "Salário" }],
    });
    act(() => { window.dispatchEvent(new Event("focus")); });
    // antes de 26/09: o cálculo só dependia de ano/usuário/perfil e o gráfico ficava em [Set]
    expect(barras.at(-1)!.map((b) => [b.month, b.Receitas])).toEqual([["Set", 5000], ["Out", 5200]]);
  });
});
