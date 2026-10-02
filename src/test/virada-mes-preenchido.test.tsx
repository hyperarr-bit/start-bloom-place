/**
 * O MÊS PRÉ-PREENCHIDO NA VIRADA (02/10) — chamado de cliente da web:
 * "deixo Receitas, Custos Fixos e Variáveis pré-preenchidos para o próximo
 * mês; quando vira, ele copia e cola sozinho e perco tudo o que inseri.
 * Respondo NÃO na pergunta de copiar e acontece mesmo assim."
 *
 * Em setembro a planilha de "Outubro" grava em `finance-2026-outubro-*`; no
 * dia 1º "Outubro" vira o mês corrente e a tela lê `finance-incomes` etc.
 * Ninguém lia a chave datada do próprio mês corrente → o planejado sumia da
 * tela. Aqui: a regra pura (`adotarMesPreenchido`) e o app inteiro (hook da
 * virada no pai + dublê da tela), com o relógio em Brasília.
 *
 *   TZ=America/Sao_Paulo npx vitest run src/test/virada-mes-preenchido.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ user: { id: "u-pre" } as { id: string } | null }));
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
const eventos = vi.hoisted(() => [] as { nome: string; dados: Record<string, unknown> }[]);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn((nome: string, dados: Record<string, unknown>) => { eventos.push({ nome, dados }); }),
  trackEventBeacon: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useViradaDoMes, useVersaoDaVirada } from "@/hooks/use-virada-do-mes";
import { adotarMesPreenchido, chavesDatadasDoMes, temMesPreenchido } from "@/lib/virada-do-mes";
import { CHAVE_CARIMBO_CONTAS, type DiaDeContas } from "@/lib/virada-contas";
import { syncFixedExpensesToBills } from "@/lib/finance-sync";
import { copyToMonth, planoDeCopia } from "@/components/MonthTurnover";
import { type Parcela } from "@/lib/finance-parcelas";

const UID = "u-pre";
const lsKey = (k: string) => `u:${UID}:${k}`;
const em = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min);
const nascida = (a: number, m: number, d: number, h = 12) => String(em(a, m, d, h).getTime());
const OUT = chavesDatadasDoMes("2026-10");
const SET = chavesDatadasDoMes("2026-09");
const OUT_INSTALLMENTS = "finance-2026-outubro-installments";
const contasDe = (dias: unknown) => (dias as DiaDeContas[]).flatMap((d) => d.bills);
const descs = (l: unknown) => (l as { description: string }[]).map((i) => i.description).sort();

/* ── O que a cliente tinha no dia 30/09 à noite ──────────────────────── */
const aluguelId = nascida(2026, 7, 3);
const luzId = nascida(2026, 7, 4);
const SETEMBRO_NO_BALDE = () => ({
  "finance-incomes": [{ id: "s-sal", description: "Salário", value: 5000, date: "2026-09-05" }],
  "finance-expenses": [
    { id: "s-merc", description: "Mercado", value: 800, date: "2026-09-10", category: "alimentacao" },
    { id: "s-uber", description: "Uber", value: 40, date: "2026-09-28", category: "transporte" },
  ],
  "finance-fixed-expenses": [
    { id: aluguelId, description: "Aluguel", value: 2000, day: 5, category: "moradia" },
    { id: luzId, description: "Luz", value: 150, day: 10, category: "moradia" },
  ],
  "finance-dueDays": [
    { day: 5, color: "yellow", bills: [{ id: `fx-${aluguelId}`, name: "Aluguel", paid: true, value: 2000, fixedId: aluguelId }] },
    { day: 10, color: "slate", bills: [{ id: `fx-${luzId}`, name: "Luz", paid: true, value: 150, fixedId: luzId }] },
    { day: 20, color: "indigo", bills: [{ id: nascida(2026, 8, 10), name: "IPVA", paid: false, value: 900 }] },
  ],
  [CHAVE_CARIMBO_CONTAS]: "2026-09",
  "finance-fixed-expenses-mes": "2026-09",
  "finance-installments": [
    { id: "p-tv", description: "TV", totalValue: 1200, installmentValue: 100, paidInstallments: 2, totalInstallments: 12, cardName: "nu", category: "casa", date: "2026-07-10", startMonth: "2026-09", parcelaDoMes: 3 },
  ] as Parcela[],
});
/* …e o que ela deixou pré-preenchido na planilha de OUTUBRO, ainda em setembro
   (a data dos itens é o dia em que digitou — o formulário põe "hoje"). */
const OUTUBRO_PREENCHIDO = () => ({
  [OUT.incomes]: [
    { id: "o-sal", description: "Salário", value: 5200, date: "2026-09-26" },
    { id: "o-free", description: "Freela", value: 900, date: "2026-10-15" },
  ],
  [OUT.expenses]: [
    { id: "o-merc", description: "Mercado", value: 850, date: "2026-09-26", category: "alimentacao" },
    { id: "o-esc", description: "Escola", value: 700, date: "2026-10-08", category: "educacao" },
  ],
  [OUT.fixed]: [
    { id: "o-luz", description: "Luz", value: 180, day: 10, category: "moradia" }, // mesmo nome, valor novo
    { id: "o-net", description: "Internet", value: 99, day: 15, category: "moradia" }, // novo
  ],
  [OUT.dueDays]: [
    { day: 15, color: "slate", bills: [{ id: "fx-o-net", name: "Internet", paid: false, value: 99, fixedId: "o-net" }] },
    { day: 25, color: "emerald", bills: [{ id: "o-cond", name: "Condomínio", paid: false, value: 400 }] },
  ],
  [OUT.notes]: [{ id: "o-n1", text: "Guardar 500 pra viagem" }],
  // parcela criada "por antecipação" dentro da planilha de outubro
  [OUT_INSTALLMENTS]: [
    { id: "o-cel", description: "Celular", totalValue: 2400, installmentValue: 200, paidInstallments: 0, totalInstallments: 12, cardName: "nu", category: "tech", date: "2026-10-01", startMonth: "2026-10", parcelaDoMes: 1 },
  ] as Parcela[],
});

/* ── Um UserDataProvider fiel no que importa ─────────────────────────── */
type Controle = { dados: () => Record<string, unknown>; set: (k: string, v: unknown) => void };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.dados = () => ref.current;
  controle.set = set;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const tela: { incomes?: any[]; expenses?: any[]; fixed?: any[]; setIncomes?: (v: any[]) => void } = {};
const TelaDeFinancas = () => {
  const [incomes, setIncomes] = usePersistedState<any[]>("finance-incomes", []);
  const [expenses] = usePersistedState<any[]>("finance-expenses", []);
  const [fixed] = usePersistedState<any[]>("finance-fixed-expenses", []);
  tela.incomes = incomes; tela.expenses = expenses; tela.fixed = fixed; tela.setIncomes = setIncomes;
  return null;
};
const TelaComVersao = () => { const v = useVersaoDaVirada(); return <TelaDeFinancas key={v} />; };
const App = () => { useViradaDoMes(); return <Routes><Route path="/financas" element={<TelaComVersao />} /><Route path="*" element={null} /></Routes>; };
const semear = (dados: Record<string, unknown>) => { for (const [k, v] of Object.entries(dados)) localStorage.setItem(lsKey(k), JSON.stringify(v)); };
const montar = (inicial: Record<string, unknown>, c: Controle, rota = "/home") => {
  semear(inicial);
  return render(<MemoryRouter initialEntries={[rota]}><Provedor inicial={inicial} controle={c}><App /></Provedor></MemoryRouter>);
};

beforeAll(() => { Element.prototype.scrollIntoView = () => {}; });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); localStorage.clear(); eventos.length = 0; auth.user = { id: UID }; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ======================================================================
 * 1. A regra pura
 * ==================================================================== */
describe("adotarMesPreenchido — a regra", () => {
  const baldes = () => {
    const s = SETEMBRO_NO_BALDE();
    return {
      incomes: [] as any[], expenses: [] as any[], // já arquivados pra setembro
      fixed: s["finance-fixed-expenses"],
      dueDays: s["finance-dueDays"].map((d) => ({ ...d, bills: d.bills.map((b) => ({ ...b, paid: false })) })), // já zeradas
      notes: [] as any[],
    };
  };
  const pre = () => { const o = OUTUBRO_PREENCHIDO(); return { incomes: o[OUT.incomes], expenses: o[OUT.expenses], fixed: o[OUT.fixed], dueDays: o[OUT.dueDays], notes: o[OUT.notes] }; };

  it("nada pré-preenchido = null (o caminho de toda abertura normal)", () => {
    expect(adotarMesPreenchido({ incomes: [], expenses: [], fixed: [], dueDays: [{ day: 5, color: "x", bills: [] }], notes: [] }, baldes(), "2026-10")).toBeNull();
    expect(temMesPreenchido({ incomes: [], expenses: [], fixed: null, dueDays: undefined, notes: [] })).toBe(false);
  });

  it("receitas e gastos planejados entram no balde; data de setembro vira o mesmo dia em outubro; a chave datada esvazia", () => {
    const a = adotarMesPreenchido(pre(), baldes(), "2026-10")!;
    expect(descs(a.gravar["finance-incomes"])).toEqual(["Freela", "Salário"]);
    expect(descs(a.gravar["finance-expenses"])).toEqual(["Escola", "Mercado"]);
    const sal = (a.gravar["finance-incomes"] as any[]).find((i) => i.id === "o-sal");
    expect(sal.date).toBe("2026-10-26"); // era 2026-09-26 (dia em que digitou)
    expect((a.gravar["finance-incomes"] as any[]).find((i) => i.id === "o-free").date).toBe("2026-10-15"); // já era de outubro: fica
    expect(a.gravar[OUT.incomes]).toEqual([]);
    expect(a.gravar[OUT.expenses]).toEqual([]);
    expect(a.adotados).toMatchObject({ incomes: 2, expenses: 2 });
  });

  it("fixos: o pré-preenchido manda no valor e o balde manda no id (a conta fx-<id> e o ✓ sobrevivem); o novo entra; o de setembro que ela não planejou NÃO é apagado", () => {
    const a = adotarMesPreenchido(pre(), baldes(), "2026-10")!;
    const fixos = a.gravar["finance-fixed-expenses"] as any[];
    expect(descs(fixos)).toEqual(["Aluguel", "Internet", "Luz"]);
    const luz = fixos.find((f) => f.description === "Luz");
    expect(luz.value).toBe(180);
    expect(luz.id).toBe(luzId); // id do balde, não "o-luz"
    expect(fixos.find((f) => f.description === "Aluguel").value).toBe(2000);
    expect(a.adotados.fixed).toBe(1);
    // o sync de fixos → contas depois disso não cria nada (Internet já veio
    // pré-preenchida ligada ao fixo o-net); só leva o valor novo da Luz pra conta dela
    const contas = a.gravar["finance-dueDays"] as DiaDeContas[];
    expect(contasDe(contas).map((b) => b.name).sort()).toEqual(["Aluguel", "Condomínio", "IPVA", "Internet", "Luz"]);
    expect(contasDe(contas).find((b) => b.name === "Luz")!.id).toBe(`fx-${luzId}`);
    const sincronizadas = syncFixedExpensesToBills(fixos, contas)!;
    expect(contasDe(sincronizadas)).toHaveLength(5);
    expect(contasDe(sincronizadas).find((b) => b.name === "Luz")!.value).toBe(180);
    expect(syncFixedExpensesToBills(fixos, sincronizadas)).toBeNull();
  });

  it("conta ligada a fixo que NÃO existe no balde é pulada (o finance-sync é quem a cria); conta avulsa repetida por dia+nome não duplica", () => {
    const b = baldes();
    b.dueDays.push({ day: 25, color: "emerald", bills: [{ id: "ja", name: "condomínio", paid: true, value: 400 }] });
    const p = pre();
    p.fixed = []; // sem o fixo Internet pré-preenchido…
    const a = adotarMesPreenchido(p, b, "2026-10")!;
    const contas = a.gravar["finance-dueDays"];
    expect(contas).toBeUndefined(); // …nada entrou nas contas: Internet (fixo ausente) pulada, Condomínio já existia
    expect(a.gravar[OUT.dueDays]).toEqual([{ day: 15, color: "slate", bills: [] }, { day: 25, color: "emerald", bills: [] }]);
  });

  it("nunca duplica: id igual, ou mesma descrição+valor (contando repetidos)", () => {
    const b = baldes();
    b.incomes = [{ id: "o-sal", description: "Salário", value: 5200, date: "2026-10-01" }, { id: "x1", description: "freela", value: 900, date: "2026-10-02" }];
    b.expenses = [{ id: "u1", description: "Uber", value: 25, date: "2026-10-01" }];
    const p = pre();
    p.expenses = [{ id: "p1", description: "Uber", value: 25, date: "2026-09-29" }, { id: "p2", description: "Uber", value: 25, date: "2026-09-30" }];
    const a = adotarMesPreenchido(p, b, "2026-10")!;
    expect(a.gravar["finance-incomes"]).toBeUndefined(); // Salário pelo id, Freela por descrição+valor
    expect((a.gravar["finance-expenses"] as any[]).map((e) => e.id)).toEqual(["u1", "p2"]); // 2 Uber de 25 pré, 1 no balde → falta 1
    expect(a.adotados).toMatchObject({ incomes: 0, expenses: 1 });
  });

  it("idempotente: aplicar o resultado e rodar de novo não encontra nada (origem vazia)", () => {
    const b = baldes();
    const a = adotarMesPreenchido(pre(), b, "2026-10")!;
    const depois = {
      incomes: a.gravar["finance-incomes"] ?? b.incomes, expenses: a.gravar["finance-expenses"] ?? b.expenses,
      fixed: a.gravar["finance-fixed-expenses"] ?? b.fixed, dueDays: a.gravar["finance-dueDays"] ?? b.dueDays, notes: a.gravar["finance-notes"] ?? b.notes,
    };
    const preVazio = { incomes: a.gravar[OUT.incomes], expenses: a.gravar[OUT.expenses], fixed: a.gravar[OUT.fixed], dueDays: a.gravar[OUT.dueDays], notes: a.gravar[OUT.notes] };
    expect(adotarMesPreenchido(preVazio, depois, "2026-10")).toBeNull();
    // e um SEGUNDO aparelho que ainda tem a origem cheia (não sincronizou) chega no mesmo balde
    const b2 = adotarMesPreenchido(pre(), depois, "2026-10");
    expect(b2?.gravar["finance-incomes"]).toBeUndefined();
    expect(b2?.gravar["finance-expenses"]).toBeUndefined();
    expect(b2?.gravar["finance-fixed-expenses"]).toBeUndefined();
    expect(b2?.gravar["finance-dueDays"]).toBeUndefined();
    expect(b2?.gravar["finance-notes"]).toBeUndefined();
    expect(b2?.gravar[OUT.incomes]).toEqual([]); // só esvazia a origem
  });

  it("balde vazio (pessoa nova que só planejou) = o planejado vira o mês", () => {
    const a = adotarMesPreenchido(pre(), { incomes: [], expenses: [], fixed: [], dueDays: [], notes: [] }, "2026-10")!;
    expect(descs(a.gravar["finance-fixed-expenses"])).toEqual(["Internet", "Luz"]);
    expect(contasDe(a.gravar["finance-dueDays"]).map((b) => b.name)).toEqual(["Internet", "Condomínio"]);
    expect(a.gravar["finance-notes"]).toEqual([{ id: "o-n1", text: "Guardar 500 pra viagem" }]);
  });
});

/* ======================================================================
 * 2. O app inteiro na madrugada de 01/10
 * ==================================================================== */
describe("virada 30/09 → 01/10 com outubro pré-preenchido", () => {
  const seed = () => ({ ...SETEMBRO_NO_BALDE(), ...OUTUBRO_PREENCHIDO() });

  it("REPRODUZ o relato e prova o conserto: o que ela planejou está no balde de outubro; setembro foi arquivado; nada da origem se perdeu", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 5));
    const c = {} as Controle;
    montar(seed(), c);
    const d = c.dados();
    // setembro arquivado como sempre
    expect((d[SET.expenses] as any[]).map((e) => e.id)).toEqual(["s-merc", "s-uber"]);
    expect((d[SET.incomes] as any[]).map((e) => e.id)).toEqual(["s-sal"]);
    // o balde de outubro é o que ela planejou (e nada do que atravessa o mês foi apagado)
    expect(descs(d["finance-incomes"])).toEqual(["Freela", "Salário"]);
    expect((d["finance-incomes"] as any[]).find((i) => i.description === "Salário").value).toBe(5200);
    expect(descs(d["finance-expenses"])).toEqual(["Escola", "Mercado"]);
    expect(descs(d["finance-fixed-expenses"])).toEqual(["Aluguel", "Internet", "Luz"]);
    expect((d["finance-fixed-expenses"] as any[]).find((f) => f.description === "Luz").value).toBe(180);
    const contas = contasDe(d["finance-dueDays"]);
    expect(contas.map((b) => [b.name, b.paid]).sort()).toEqual([["Aluguel", false], ["Condomínio", false], ["IPVA", false], ["Internet", false], ["Luz", false]]);
    expect(d["finance-notes"]).toEqual([{ id: "o-n1", text: "Guardar 500 pra viagem" }]);
    // a origem ficou vazia (o dado mudou de endereço, não sumiu)
    expect(d[OUT.incomes]).toEqual([]);
    expect(d[OUT.expenses]).toEqual([]);
    expect(d[OUT.fixed]).toEqual([]);
    expect(contasDe(d[OUT.dueDays])).toEqual([]);
    expect(d[OUT.notes]).toEqual([]);
    // as parcelas continuam funcionando: a de setembro avançou (3→4) e a antecipada de outubro entrou no balde
    const parcelas = d["finance-installments"] as Parcela[];
    expect(parcelas.map((p) => [p.description, p.parcelaDoMes])).toEqual([["TV", 4], ["Celular", 1]]);
    expect((d[OUT_INSTALLMENTS] as Parcela[])[0].levada).toBe(true);
    // medido
    const ad = eventos.find((e) => e.nome === "virada_mes_adotou")!;
    expect(ad.dados).toMatchObject({ incomes: 2, expenses: 2, fixed: 1, dueDays: 2, notes: 1, mes: "2026-10" });
  });

  it("a tela de Finanças aberta no dia 1º mostra o planejado (remonta com a virada) e o próximo toque dela não apaga nada", () => {
    vi.setSystemTime(em(2026, 10, 1, 8, 0));
    const c = {} as Controle;
    montar(seed(), c, "/financas");
    expect(descs(tela.incomes)).toEqual(["Freela", "Salário"]);
    expect(descs(tela.fixed)).toEqual(["Aluguel", "Internet", "Luz"]);
    act(() => { tela.setIncomes!([...(tela.incomes as any[]), { id: "novo", description: "Bônus", value: 300, date: "2026-10-01" }]); });
    expect(descs(c.dados()["finance-incomes"])).toEqual(["Bônus", "Freela", "Salário"]);
  });

  it("rodar de novo (fechar e abrir o app no mesmo dia) não duplica nem apaga", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 5));
    const c = {} as Controle;
    const r = montar(seed(), c);
    const antes = JSON.stringify(c.dados());
    r.unmount();
    const c2 = {} as Controle;
    // segunda sessão: o store nasce do que a primeira gravou
    const inicial = JSON.parse(antes);
    localStorage.clear();
    montar(inicial, c2);
    const d2 = c2.dados();
    expect(descs(d2["finance-incomes"])).toEqual(["Freela", "Salário"]);
    expect(descs(d2["finance-expenses"])).toEqual(["Escola", "Mercado"]);
    expect(descs(d2["finance-fixed-expenses"])).toEqual(["Aluguel", "Internet", "Luz"]);
    expect(contasDe(d2["finance-dueDays"])).toHaveLength(5);
    expect((d2["finance-installments"] as Parcela[]).map((p) => p.description)).toEqual(["TV", "Celular"]);
    expect(eventos.filter((e) => e.nome === "virada_mes_adotou")).toHaveLength(1);
  });

  it("dois aparelhos partindo do mesmo retrato de 30/09 chegam no MESMO balde (sem duplicar)", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 5));
    const a = {} as Controle;
    const ra = montar(seed(), a);
    const deA = a.dados();
    ra.unmount();
    localStorage.clear();
    const b = {} as Controle;
    montar(seed(), b);
    const deB = b.dados();
    for (const k of ["finance-incomes", "finance-expenses", "finance-fixed-expenses", "finance-dueDays", "finance-notes", "finance-installments"]) {
      expect(JSON.stringify(deB[k])).toBe(JSON.stringify(deA[k]));
    }
    // e o aparelho B recebendo depois o balde de A (sync) + ainda tendo a origem cheia: rodar de novo não duplica
    const c = {} as Controle;
    localStorage.clear();
    montar({ ...seed(), "finance-incomes": deA["finance-incomes"], "finance-expenses": deA["finance-expenses"], "finance-fixed-expenses": deA["finance-fixed-expenses"], "finance-dueDays": deA["finance-dueDays"], "finance-notes": deA["finance-notes"], [CHAVE_CARIMBO_CONTAS]: "2026-10", "finance-fixed-expenses-mes": "2026-10" }, c);
    const d = c.dados();
    expect(descs(d["finance-incomes"])).toEqual(["Freela", "Salário"]);
    expect(descs(d["finance-fixed-expenses"])).toEqual(["Aluguel", "Internet", "Luz"]);
    expect(contasDe(d["finance-dueDays"])).toHaveLength(5);
  });

  it("dia 1º com o mês novo SEM nada pré-preenchido: nada muda em relação a antes (sem evento, sem chave datada criada)", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 5));
    const c = {} as Controle;
    montar(SETEMBRO_NO_BALDE(), c);
    const d = c.dados();
    expect(eventos.some((e) => e.nome === "virada_mes_adotou")).toBe(false);
    expect(OUT.incomes in d).toBe(false);
    expect(OUT.fixed in d).toBe(false);
    expect(descs(d["finance-fixed-expenses"])).toEqual(["Aluguel", "Luz"]);
  });

  it("zerar as contas de setembro não toca no outubro pré-preenchido; o retrato dos fixos de setembro é gravado mesmo com a chave de setembro já existindo vazia", () => {
    vi.setSystemTime(em(2026, 10, 1, 0, 5));
    const c = {} as Controle;
    // ela também tinha pré-preenchido setembro em agosto (chave existe e já foi adotada → vazia)
    montar({ ...seed(), [SET.fixed]: [], [SET.dueDays]: [{ day: 5, color: "yellow", bills: [] }] }, c);
    const d = c.dados();
    expect(descs(d[SET.fixed])).toEqual(["Aluguel", "Luz"]); // retrato de setembro como ele foi
    expect(contasDe(d[SET.dueDays]).map((b) => [b.name, b.paid])).toEqual([["Aluguel", true], ["Luz", true], ["IPVA", false]]);
    expect(descs(d["finance-fixed-expenses"])).toEqual(["Aluguel", "Internet", "Luz"]);
  });

  it("virada de ano: dezembro pré-preenche janeiro de 2027 e janeiro adota", () => {
    vi.setSystemTime(em(2027, 1, 1, 0, 5));
    const JAN = chavesDatadasDoMes("2027-01");
    const c = {} as Controle;
    montar({
      "finance-incomes": [{ id: "d-sal", description: "Salário", value: 5000, date: "2026-12-05" }],
      "finance-expenses": [], "finance-fixed-expenses": [], "finance-dueDays": [],
      [JAN.incomes]: [{ id: "j-sal", description: "Salário", value: 5300, date: "2026-12-20" }],
      [JAN.expenses]: [{ id: "j-ipva", description: "IPVA", value: 1200, date: "2027-01-10" }],
    }, c);
    const d = c.dados();
    expect((d["finance-incomes"] as any[]).map((i) => [i.id, i.date])).toEqual([["j-sal", "2027-01-20"]]);
    expect((d["finance-expenses"] as any[]).map((i) => i.id)).toEqual(["j-ipva"]);
    expect((d["finance-2026-dezembro-incomes"] as any[]).map((i) => i.id)).toEqual(["d-sal"]);
  });
});

/* ======================================================================
 * 3. O diálogo de copiar depois da adoção: NÃO = intocado; SIM = só soma
 * ==================================================================== */
describe("o cartão 'copiar setembro em outubro' depois da adoção", () => {
  it("não copiar = outubro fica exatamente como ela planejou; copiar = acrescenta só o que falta, sem apagar nem duplicar", () => {
    vi.setSystemTime(em(2026, 10, 2, 9, 0));
    const c = {} as Controle;
    montar({ ...SETEMBRO_NO_BALDE(), ...OUTUBRO_PREENCHIDO(),
      "finance-incomes": [{ id: "s-sal", description: "Salário", value: 5000, date: "2026-09-05" }, { id: "s-vale", description: "Vale", value: 400, date: "2026-09-20" }] }, c);
    const antes = JSON.stringify([c.dados()["finance-incomes"], c.dados()["finance-fixed-expenses"], c.dados()["finance-dueDays"]]);

    // "não": ninguém chama copyToMonth — nada muda
    expect(JSON.stringify([c.dados()["finance-incomes"], c.dados()["finance-fixed-expenses"], c.dados()["finance-dueDays"]])).toBe(antes);

    // o plano da cópia só oferece o que FALTA (fixos/contas não são oferecidos: o destino já tem)
    const plano = planoDeCopia(UID, "Setembro", "Outubro", 2026);
    expect(plano.fixos).toEqual([]);
    expect(plano.contas).toEqual([]);
    expect(plano.receitas.map((r) => r.description)).toEqual(["Vale"]); // Salário já existe em outubro (por descrição)

    // "sim": entra só o Vale, com id novo e dia 20 de outubro; o planejado continua
    copyToMonth(UID, "Setembro", "Outubro", { fixed: true, bills: true, incomes: true, categoryBudgets: false, notes: false, anoOrigem: 2026 }, undefined, (k, v) => c.set(k, v));
    const d = c.dados();
    expect(descs(d["finance-incomes"])).toEqual(["Freela", "Salário", "Vale"]);
    expect((d["finance-incomes"] as any[]).find((i) => i.description === "Salário").value).toBe(5200);
    expect((d["finance-incomes"] as any[]).find((i) => i.description === "Vale").date).toBe("2026-10-20");
    expect(descs(d["finance-fixed-expenses"])).toEqual(["Aluguel", "Internet", "Luz"]);
    expect(contasDe(d["finance-dueDays"])).toHaveLength(5);
    // setembro arquivado intacto
    expect((d[SET.incomes] as any[]).map((i) => i.id)).toEqual(["s-sal", "s-vale"]);
  });
});
