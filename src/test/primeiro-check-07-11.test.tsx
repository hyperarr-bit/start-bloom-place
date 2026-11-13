/**
 * O PRIMEIRO ✓ QUE SUMIA AO REABRIR (07/11, bug "primeiro-check").
 *
 * A pessoa tem um custo fixo de outubro (o Aluguel, cadastrado sem Dia — ou
 * vindo do "Vamos montar", que nasce sem Dia). Em novembro ela dá o Dia 5 ao
 * aluguel: o finance-sync cria a conta `fx-<id do fixo>` no MEU MÊS. Ela marca
 * ✓ (o "momento de valor" do teste grátis), fecha o app e reabre: o ✓ sumiu.
 *
 * Por quê: o balde de contas estava VAZIO na abertura, então o hook não
 * carimbou o mês (regra do convidado, lib/virada-contas `temContas`). Na
 * reabertura o carimbo está ausente (ou parado num mês velho) e a virada roda:
 * ela guarda só o ✓ de conta que NASCEU neste mês, lendo o nascimento pelo id
 * — e o id `fx-<id do fixo>` carrega o nascimento do FIXO (outubro), não da
 * conta (novembro). Pior: o fixo do "Vamos montar" tem id `mf-<ms>-n`, que o
 * leitor nem entendia (`fx-mf-…` = "não sei" = zera), e com carimbo parado a
 * conta ainda entrava no retrato do mês velho como paga.
 *
 * Agora: a conta que o finance-sync cria nasce com o carimbo `nasceuEm`
 * ("YYYY-MM", campo NOVO e opcional — o app antigo ignora e carrega adiante no
 * `...b`), e a virada prefere ele ao id. O leitor do id passou a entender o
 * `mf-` do Montar. Conta gravada ANTES deste conserto não ganha carimbo
 * retroativo: inventar "nasceu agora" devolveria o bug de 08/08 (✓ de julho
 * vivendo em agosto) pra quem está parado há meses.
 *
 * Rodar: TZ=America/Sao_Paulo npx vitest run src/test/primeiro-check-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-check" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useViradaDoMes } from "@/hooks/use-virada-do-mes";
import {
  viradaDeContas, mesDeNascimento, CHAVE_CARIMBO_CONTAS, CHAVE_CONTAS, type DiaDeContas,
} from "@/lib/virada-contas";
import { syncFixedExpensesToBills } from "@/lib/finance-sync";
import { itensParaGravar } from "@/lib/montar-financas";

const UID = "u-check";
const lsKey = (k: string) => `u:${UID}:${k}`;
/** Data LOCAL de Brasília (mês 1-12, como se fala). */
const em = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min);
/** Id de conta/fixo nascido nessa data — o formato real (`Date.now()`). */
const nascida = (a: number, m: number, d: number, h = 12) => String(em(a, m, d, h).getTime());
const contasDe = (dias: unknown) => (dias as DiaDeContas[]).flatMap((d) => d.bills);
/** O mesmo gesto do ✓ no MEU MÊS, nos Vencimentos e na lista de fixos: `{ ...b, paid: !b.paid }`. */
const marcarPaga = (dias: DiaDeContas[], id: string): DiaDeContas[] =>
  dias.map((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b)) }));

/* ── Um UserDataProvider de verdade no que importa (como virada-mes-auditoria) ── */
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
/** O App: o hook da virada no pai das telas (como em AnimatedRoutes). */
const AppComVirada = () => { useViradaDoMes(); return null; };
const montarApp = (inicial: Record<string, unknown>, c: Controle) => {
  // o hook lê pelo leitor da tela (localStorage) e cai no store de reserva — semeia os dois
  for (const [k, v] of Object.entries(inicial)) localStorage.setItem(lsKey(k), JSON.stringify(v));
  return render(<Provedor inicial={inicial} controle={c}><AppComVirada /></Provedor>);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* ======================================================================
 * 1. A regra (lib/virada-contas + lib/finance-sync)
 * ==================================================================== */
describe("primeiro-check: o ✓ da primeira conta nascida de um fixo antigo fica ao reabrir", () => {
  const novembro = em(2026, 11, 6, 9);
  const aluguelDeOutubro = () => ({ id: nascida(2026, 10, 12), description: "Aluguel", value: 1500, day: 5 });

  it("fixo de outubro ganha Dia em novembro: a conta nasce AGORA e o ✓ é deste mês — sem carimbo, fica", () => {
    vi.setSystemTime(em(2026, 11, 5, 10));
    const fixo = aluguelDeOutubro();
    const contas = marcarPaga(syncFixedExpensesToBills([fixo], [])!, `fx-${fixo.id}`);
    // antes: o id `fx-<id do fixo>` dizia "nasceu em outubro" → a virada zerava
    const v = viradaDeContas(contas, "", novembro)!;
    expect(contasDe(v.zeradas)[0]).toMatchObject({ name: "Aluguel", paid: true });
    expect(v.zerou).toBe(false);
    expect(v.carimbo).toBe("2026-11");
  });

  it("carimbo PARADO em setembro (balde ficou vazio): o ✓ fica e a conta NÃO entra no retrato de setembro", () => {
    vi.setSystemTime(em(2026, 11, 5, 10));
    const fixo = aluguelDeOutubro();
    const contas = marcarPaga(syncFixedExpensesToBills([fixo], [])!, `fx-${fixo.id}`);
    const v = viradaDeContas(contas, "2026-09", novembro)!;
    expect(contasDe(v.zeradas)[0].paid).toBe(true);
    expect(v.zerou).toBe(false);
    // a conta não existia em setembro: nada a arquivar
    expect(v.arquivo).toBeNull();
  });

  it("fixo do 'Vamos montar' (id mf-…) ganha Dia: a conta é fx-mf-… — era ilegível e zerava; agora fica, e nada vai pro retrato velho", () => {
    const { fixos } = itensParaGravar(3000, [{ id: "aluguel", nome: "Aluguel", emoji: "🏠", valor: 1500, categoria: "moradia" }], em(2026, 10, 20, 9));
    expect(fixos[0].id).toMatch(/^mf-\d{13}-1$/);
    vi.setSystemTime(em(2026, 11, 5, 10));
    const fixo = { ...fixos[0], day: 5 }; // a pessoa dá o Dia em novembro
    const contas = marcarPaga(syncFixedExpensesToBills([fixo], [])!, `fx-${fixo.id}`);
    expect(contas[0].bills[0].id).toMatch(/^fx-mf-\d{13}-1$/);
    const v = viradaDeContas(contas, "2026-09", novembro)!;
    expect(contasDe(v.zeradas)[0].paid).toBe(true);
    // antes: id ilegível "entrava no retrato como sempre entrou" — setembro ganhava um aluguel pago que não existia
    expect(v.arquivo).toBeNull();
  });

  it("o id do fixo do Montar é legível (mf-<Date.now()>-n): o mês de nascimento sai dele quando a conta não tem carimbo", () => {
    const hoje = em(2026, 11, 5, 9);
    expect(mesDeNascimento(`fx-mf-${nascida(2026, 10, 20)}-1`, hoje)).toBe("2026-10");
    expect(mesDeNascimento(`fx-mf-${nascida(2026, 10, 20)}-cartao`, hoje)).toBe("2026-10");
    expect(mesDeNascimento(`mf-${nascida(2026, 10, 20)}`, hoje)).toBe("2026-10");
    expect(mesDeNascimento(`fx-${nascida(2026, 10, 1)}`, hoje)).toBe("2026-10"); // como antes
    expect(mesDeNascimento("fx-jul-f1", hoje)).toBeNull(); // seed: continua "não sei"
  });

  it("a conta nova do fixo nasce carimbada com o mês; conta que já existia não ganha carimbo (não dá pra saber de quando é)", () => {
    const fixoVelho = { id: nascida(2026, 8, 3), description: "Internet", value: 99, day: 10 };
    const existentes: DiaDeContas[] = [{ day: 10, color: "slate", bills: [{ id: `fx-${fixoVelho.id}`, name: "Internet", paid: true, value: 99, fixedId: fixoVelho.id }] }];
    const fixoNovo = aluguelDeOutubro();
    const out = syncFixedExpensesToBills([fixoVelho, fixoNovo], existentes, em(2026, 11, 5, 10))!;
    const todas = contasDe(out);
    expect(todas.find((b) => b.name === "Aluguel")).toMatchObject({ id: `fx-${fixoNovo.id}`, paid: false, fixedId: fixoNovo.id, nasceuEm: "2026-11" });
    expect(todas.find((b) => b.name === "Internet")).not.toHaveProperty("nasceuEm");
    expect(todas.find((b) => b.name === "Internet")!.paid).toBe(true);
    // nada mudou de novo → null (a trava contra loop de render do Index)
    expect(syncFixedExpensesToBills([fixoVelho, fixoNovo], out, em(2026, 11, 5, 10))).toBeNull();
  });

  it("o que deve zerar continua zerando: ✓ de outubro numa conta nascida em outubro expira em novembro e vai pro retrato de outubro", () => {
    const fixo = aluguelDeOutubro();
    const contas = marcarPaga(syncFixedExpensesToBills([fixo], [], em(2026, 10, 12, 9))!, `fx-${fixo.id}`); // nasceu e foi paga em outubro
    const v = viradaDeContas(contas, "2026-10", novembro)!;
    expect(contasDe(v.zeradas)[0].paid).toBe(false);
    expect(v.zerou).toBe(true);
    expect(v.arquivo?.chave).toBe("finance-2026-outubro-dueDays");
    expect(contasDe(v.arquivo!.contas)[0]).toMatchObject({ name: "Aluguel", paid: true });
  });

  it("carimbo da conta à frente do relógio (outro aparelho num fuso adiantado) não vale: cai no id, como antes", () => {
    const fixo = aluguelDeOutubro();
    const contas = marcarPaga(syncFixedExpensesToBills([fixo], [], em(2026, 12, 1, 0, 30))!, `fx-${fixo.id}`); // Lisboa já em dezembro
    const v = viradaDeContas(contas, "2026-10", em(2026, 11, 30, 21))!; // Brasília ainda em novembro
    // sem o carimbo (implausível), o id diz outubro → o ✓ de outubro expira em novembro, como sempre
    expect(contasDe(v.zeradas)[0].paid).toBe(false);
  });

  it("conta antiga SEM carimbo e com id ilegível (seed, legado) segue zerando — o que sempre foi", () => {
    const contas: DiaDeContas[] = [{ day: 5, color: "yellow", bills: [{ id: "fx-jul-f1", name: "Luz", paid: true }] }];
    const v = viradaDeContas(contas, "", novembro)!;
    expect(contasDe(v.zeradas)[0].paid).toBe(false);
  });

  it("LIMITE: conta de fixo antigo gravada ANTES deste conserto (sem carimbo na conta) ainda lê o mês pelo id e zera uma vez", () => {
    // Preço de não inventar carimbo retroativo: quem deu o Dia e o ✓ neste mês, numa versão sem o
    // conserto, perde esse ✓ uma vez (remarca com um toque); quem está parado há meses não ganha
    // um ✓ velho de presente. Daqui em diante toda conta do finance-sync nasce carimbada.
    const fixo = aluguelDeOutubro();
    const contas: DiaDeContas[] = [{ day: 5, color: "yellow", bills: [{ id: `fx-${fixo.id}`, name: "Aluguel", paid: true, value: 1500, fixedId: fixo.id }] }];
    const v = viradaDeContas(contas, "", novembro)!;
    expect(contasDe(v.zeradas)[0].paid).toBe(false);
  });
});

/* ======================================================================
 * 2. O fluxo real do hook: abre → dá Dia ao fixo → ✓ → fecha → reabre
 * ==================================================================== */
describe("primeiro-check: fluxo real do hook da virada", () => {
  it("o ✓ continua na reabertura, o carimbo vira novembro, e em 01/12 o ✓ expira pro retrato de novembro", () => {
    vi.setSystemTime(em(2026, 11, 5, 10));
    const fixo = { id: nascida(2026, 10, 12), description: "Aluguel", value: 1500, category: "moradia" }; // de outubro, SEM Dia
    const c = {} as Controle;
    montarApp({
      "finance-fixed-expenses": [fixo],
      "finance-incomes": [{ id: nascida(2026, 11, 1, 8), date: "2026-11-01", value: 3000, description: "Salário" }],
    }, c);
    // o hook rodou e se deu por atendido (tinha renda); sem conta nenhuma, sem carimbo
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBeUndefined();

    // a pessoa dá o Dia 5 ao aluguel → o sync do Index cria a conta fx-<id do fixo>…
    vi.setSystemTime(em(2026, 11, 5, 10, 5));
    const fixoComDia = { ...fixo, day: 5 };
    act(() => c.set("finance-fixed-expenses", [fixoComDia]));
    const sincronizadas = syncFixedExpensesToBills([fixoComDia], [])!;
    act(() => c.set(CHAVE_CONTAS, sincronizadas));
    // …e marca ✓ (o "momento de valor")
    act(() => c.set(CHAVE_CONTAS, marcarPaga(sincronizadas, `fx-${fixo.id}`)));
    expect(contasDe(c.dados()[CHAVE_CONTAS])[0].paid).toBe(true);
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBeUndefined();

    // fecha e reabre no dia seguinte: antes, o ✓ tinha sumido
    const fimDaSessao1 = { ...c.dados() };
    cleanup();
    vi.setSystemTime(em(2026, 11, 6, 9));
    montarApp(fimDaSessao1, c);
    expect(contasDe(c.dados()[CHAVE_CONTAS])[0]).toMatchObject({ name: "Aluguel", paid: true, id: `fx-${fixo.id}` });
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-11");

    // 01/12: o ✓ de novembro expira e vai pro retrato de novembro
    const fimDeNovembro = { ...c.dados() };
    cleanup();
    vi.setSystemTime(em(2026, 12, 1, 0, 1));
    montarApp(fimDeNovembro, c);
    expect(contasDe(c.dados()[CHAVE_CONTAS])[0].paid).toBe(false);
    expect(contasDe(c.dados()["finance-2026-novembro-dueDays"])[0]).toMatchObject({ name: "Aluguel", paid: true });
    expect(c.dados()[CHAVE_CARIMBO_CONTAS]).toBe("2026-12");
  });
});
