/**
 * "VAMOS MONTAR SUAS FINANÇAS" (1.0.16) — o que este arquivo trava, com a conta VAZIA (sem seeds):
 *   · 3 perguntas até o número: renda → contas fixas → cartão de crédito (opcional) → "Você pode
 *     gastar R$ X por dia", e o número é o MESMO do card "QUANTO POSSO GASTAR HOJE" do Dashboard
 *     (computeDailyBudget) — com a fatura do cartão também (testes do cartão: montar-financas-cartao);
 *   · o que a pessoa responde vira dado REAL do módulo (finance-incomes / finance-fixed-expenses,
 *     no formato das tabelas) e aparece no Finanças de verdade depois;
 *   · Pular em toda pergunta; eventos sem valor em reais;
 *   · uma vez só: feito/pulado sobrevive a fechar e reabrir o app (vassoura da abertura), ao
 *     logout e a outro aparelho (a marca também mora na conta); 2 vistas sem decisão = fim;
 *   · quem não vê: conta antiga, conta com qualquer dado de Finanças, convidado, demo, site
 *     (chave web off), app com a metadata `montar_financas: "off"`;
 *   · REGRA DO DONO (17/10): abrir Finanças NÃO abre o quiz (`MONTAR_FINANCAS_NO_MODULO = false`) — nem
 *     tela em branco esperando o dado da conta; a única porta é a missão (origem "missao").
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-mf", created_at: "" } as { id: string; created_at?: string } | null, loading: false }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: auth.user, session: null, loading: auth.loading, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = {
    select: () => q, eq: () => q, in: () => Promise.resolve({ data: [], error: null }), order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q,
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

import { UserDataContext, UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { computeDailyBudget } from "@/lib/finance-totals";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { cartoesVistosNesteAparelho } from "@/lib/tour-home";
import {
  CHAVE_FORCA_MONTAR_FINANCAS, CHAVE_MONTAR_FINANCAS, EV_PASSO, EV_PRONTO, EV_PULAR, EV_VIEW, EVENTO_MONTAR_FINANCAS_FIM,
  _zerarRemotaMontar, calcularMontar, deveMostrarMontarFinancas, guardarForcaMontarDaUrl, itensParaGravar, lerChaveRemotaMontar,
  marcaDoAparelho, marcarMontarDecidido, montarFinancasLigado, montarJaDecidido, reaisDigitados, registrarChaveMontarFinancas,
  registrarVistaMontar, temDadosDeFinancas, _novaAberturaMontar, lerRascunhoMontar, montarAbertoPelaMissao,
  MONTAR_FINANCAS_NO_MODULO, EV_PRIMEIRO_GASTO,
} from "@/lib/montar-financas";
import { MontarFinancas } from "@/components/finance/montar/MontarFinancas";
import Index from "@/pages/Index";

const UID = "u-mf";
const HOJE = new Date(2026, 9, 16, 12, 0); // 16/10/2026: faltam 16 dias contando hoje
const HORA = 3600e3;

/* ── app das lojas × site ── */
const virarApp = () => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as any).Capacitor; };

/** Store em memória com `loaded` controlável, gravando o cache local como o provider real. */
type Controle = { setLoaded: (v: boolean) => void; dados: () => Record<string, unknown> };
const Provedor = ({ inicial, controle, loadedInicial = true, children }: { inicial: Record<string, unknown>; controle: Controle; loadedInicial?: boolean; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const [loaded, setLoaded] = useState(loadedInicial);
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: JSON.parse(JSON.stringify(v ?? null)) };
    localStorage.setItem(`u:${UID}:${k}`, JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.setLoaded = setLoaded;
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded, isGuest: !auth.user, fetchKey: async () => null }), [get, set, loaded]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const novoControle = (): Controle => ({ setLoaded: () => {}, dados: () => ({}) });

const montarIndex = (inicial: Record<string, unknown>, controle = novoControle(), loadedInicial = true) => {
  render(
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={inicial} controle={controle} loadedInicial={loadedInicial}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const montarTela = (props: Partial<React.ComponentProps<typeof MontarFinancas>> = {}, inicial: Record<string, unknown> = {}) => {
  const controle = novoControle();
  render(
    <MemoryRouter>
      <Provedor inicial={inicial} controle={controle}>
        <MontarFinancas agora={HOJE} esperaMs={0} {...props} />
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const respirar = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const nomes = () => eventos.map(([n]) => n);

/** As 3 perguntas (+ ajustes): faixa R$ 2 a 4 mil → Aluguel, Luz e uma "Outra" (Escola, 700) → "Não uso cartão" → resultado. */
const fazerOsTresToques = async () => {
  const tela = () => within(screen.getByTestId("montar-financas")); // Finanças pode estar montada por baixo
  fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  fireEvent.click(tela().getByRole("button", { name: /Aluguel/ }));
  fireEvent.click(tela().getByRole("button", { name: /Luz/ }));
  fireEvent.click(tela().getByRole("button", { name: /Outra/ }));
  fireEvent.change(tela().getByLabelText("Nome da conta"), { target: { value: "Escola" } });
  fireEvent.change(tela().getByLabelText("Valor de Escola"), { target: { value: "700" } });
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  expect(tela().getByText("Usa cartão de crédito?")).toBeTruthy();
  fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
  await respirar();
};

beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
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
  // 17/10 (merge com a intro dos módulos): estes testes são do Montar e do Dashboard — a intro guiada de Finanças
  // (que entra depois do Montar quando não há missão em volta, e procura o "+ Novo gasto" clicando na aba MEU
  // FINANCEIRO) disputava a aba com o clique no DASHBOARD na suíte carregada. Na missão de verdade a dose na tela
  // segura a intro (data-missao-dose); aqui, a intro já foi vista neste aparelho.
  localStorage.setItem("core-intro-vista-financas", "pulada@2026-10-17T00:00:00.000Z");
  eventos.length = 0;
  _zerarRemotaMontar();
  _novaAberturaMontar();
  auth.user = { id: UID, created_at: new Date(HOJE.getTime() - 2 * HORA).toISOString() };
  auth.loading = false;
  virarApp();
});
afterEach(() => {
  cleanup();
  virarSite();
  vi.useRealTimers();
});

/* ───────────────────────── a conta ───────────────────────── */
describe("a conta da tela é a conta do módulo", () => {
  it("R$ 3.000 − 5 contas (R$ 1.255) em 16/10 = R$ 109 por dia, igual ao computeDailyBudget do Dashboard", () => {
    const contas = [
      { id: "a", nome: "Aluguel", emoji: "", valor: 900, categoria: "moradia" },
      { id: "b", nome: "Luz", emoji: "", valor: 150, categoria: "contas_casa" },
      { id: "c", nome: "Internet", emoji: "", valor: 100, categoria: "internet_telefone" },
      { id: "d", nome: "Celular", emoji: "", valor: 60, categoria: "internet_telefone" },
      { id: "e", nome: "Streaming", emoji: "", valor: 45, categoria: "assinaturas" },
    ];
    const r = calcularMontar(3000, contas, HOJE);
    const painel = computeDailyBudget(3000, 1255, [], contas.map((c) => ({ id: c.id, value: c.valor })), HOJE);
    expect(r).toMatchObject({ fixos: 1255, contas: 5, livre: 1745, dias: 16, porDia: Math.round(painel.perDay), semFolga: false });
    expect(r.porDia).toBe(109);
  });
  it("contas maiores que a renda: R$ 0 e sem folga; conta sem nome ou sem valor não entra", () => {
    const r = calcularMontar(1500, [{ id: "a", nome: "Aluguel", emoji: "", valor: 2000, categoria: "moradia" }, { id: "x", nome: "", emoji: "", valor: 300, categoria: "outros" }, { id: "y", nome: "Gás", emoji: "", valor: 0, categoria: "outros" }], HOJE);
    expect(r).toMatchObject({ porDia: 0, semFolga: true, contas: 1, fixos: 2000 });
  });
  it("grava no formato das tabelas (IncomeTable / FixedExpensesTable), sem perfil", () => {
    const { receita, fixos } = itensParaGravar(3000, [{ id: "luz", nome: " Luz ", emoji: "💡", valor: 150, categoria: "contas_casa" }], HOJE);
    expect(receita).toEqual([{ id: expect.any(String), description: "Renda do mês", value: 3000, date: "2026-10-16" }]);
    expect(fixos).toEqual([{ id: expect.any(String), description: "Luz", category: "contas_casa", value: 150, paymentMethod: "boleto" }]);
    expect(fixos[0].id).not.toBe(receita[0].id);
  });
  it("valor digitado como gente digita", () => {
    expect(reaisDigitados("3.000")).toBe(3000);
    expect(reaisDigitados("R$ 2.500,90")).toBe(2500);
    expect(reaisDigitados("")).toBe(0);
    expect(reaisDigitados("abc")).toBe(0);
  });
});

/* ───────────────────────── a chave ───────────────────────── */
describe("a chave MONTAR_FINANCAS", () => {
  it("app: ligada; site: desligada; metadata do RevenueCat manda no app (a current vence)", () => {
    expect(montarFinancasLigado()).toBe(true);
    virarSite();
    expect(montarFinancasLigado()).toBe(false);
    virarApp();
    registrarChaveMontarFinancas({ current: { metadata: { montar_financas: "off" } }, all: {} });
    expect(montarFinancasLigado()).toBe(false);
    expect(lerChaveRemotaMontar({ current: { metadata: {} }, all: { a: { metadata: { montar_financas: "off" } } } })).toBe("off");
    expect(lerChaveRemotaMontar({ current: { metadata: { montar_financas: "on" } }, all: { a: { metadata: { montar_financas: "off" } } } })).toBe("on");
    expect(lerChaveRemotaMontar(null)).toBeNull();
  });
  it("QA no navegador: ?montar-financas=on liga no site e pula a régua de conta nova; recomecar apaga o 'já vi'", () => {
    virarSite();
    guardarForcaMontarDaUrl("?montar-financas=on");
    expect(montarFinancasLigado()).toBe(true);
    const get = <T,>(_k: string, f: T) => f;
    expect(deveMostrarMontarFinancas({ criadoEm: "2025-01-01T00:00:00Z", get, isGuest: false })).toBe(true);
    marcarMontarDecidido("pulou");
    expect(guardarForcaMontarDaUrl("?montar-financas=recomecar")).toBe(true);
    expect(marcaDoAparelho()).toBeNull();
    guardarForcaMontarDaUrl("?montar-financas=auto");
    expect(localStorage.getItem(CHAVE_FORCA_MONTAR_FINANCAS)).toBeNull();
  });
  it("a força de QA não existe no app da loja", () => {
    localStorage.setItem(CHAVE_FORCA_MONTAR_FINANCAS, "off");
    expect(montarFinancasLigado()).toBe(true);
  });
});

/* ───────────────────────── a régua ───────────────────────── */
describe("quem vê", () => {
  const vazio = <T,>(_k: string, f: T) => f;
  const com = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const criadoEm = () => auth.user!.created_at;

  it("conta nova + Finanças vazia (os 4 dias padrão do MEU MÊS sem conta) → vê", () => {
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: com({ "finance-dueDays": [{ day: 5, bills: [] }, { day: 10, bills: [] }] }), isGuest: false })).toBe(true);
  });
  it("conta antiga (≥ 48 h) → não", () => {
    expect(deveMostrarMontarFinancas({ criadoEm: new Date(HOJE.getTime() - 49 * HORA).toISOString(), get: vazio, isGuest: false })).toBe(false);
    expect(deveMostrarMontarFinancas({ criadoEm: undefined, get: vazio, isGuest: false })).toBe(false);
  });
  it("qualquer dado de Finanças → não", () => {
    for (const dados of [
      { "finance-incomes": [{ id: 1 }] }, { "finance-expenses": [{ id: 1 }] }, { "finance-fixed-expenses": [{ id: 1 }] },
      { "finance-installments": [{ id: 1 }] }, { "finance-investments": [{ id: 1 }] }, { "finance-dueDays": [{ day: 5, bills: [{ id: "b" }] }] },
    ]) {
      expect(temDadosDeFinancas(com(dados)), JSON.stringify(dados)).toBe(true);
      expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: com(dados), isGuest: false })).toBe(false);
    }
  });
  it("convidado e demo → não", () => {
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: vazio, isGuest: true })).toBe(false);
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: vazio, isGuest: false, isPreview: true })).toBe(false);
  });
  it("já decidido no aparelho OU na conta → não; 2 vistas sem decisão → não", () => {
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: com({ [CHAVE_MONTAR_FINANCAS]: { r: "pronto" } }), isGuest: false })).toBe(false);
    marcarMontarDecidido("pulou");
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(false);
    localStorage.clear();
    registrarVistaMontar();
    registrarVistaMontar(); // a mesma abertura do app não gasta a 2ª vista
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(true);
    _novaAberturaMontar();
    registrarVistaMontar();
    expect(deveMostrarMontarFinancas({ criadoEm: criadoEm(), get: vazio, isGuest: false })).toBe(false);
  });
});

/* ───────────────────────── a tela ───────────────────────── */
describe("a tela, com a conta vazia", () => {
  it("3 perguntas: renda → contas → 'Não uso cartão' → 'Você pode gastar R$ X por dia'; grava no módulo; eventos sem reais", async () => {
    const onPronto = vi.fn();
    const fim = vi.fn();
    window.addEventListener(EVENTO_MONTAR_FINANCAS_FIM, fim as EventListener);
    const controle = montarTela({ onPronto, origem: "missao" });

    expect(screen.getByText("Quanto entra por mês?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", true);
    expect(document.documentElement.hasAttribute("data-montar-financas")).toBe(true);
    await fazerOsTresToques();

    const d = controle.dados();
    expect(d["finance-incomes"]).toEqual([expect.objectContaining({ description: "Renda do mês", value: 3000, date: "2026-10-16" })]);
    expect((d["finance-fixed-expenses"] as any[]).map((f) => [f.description, f.value, f.category])).toEqual([
      ["Aluguel", 900, "moradia"], ["Luz", 150, "contas_casa"], ["Escola", 700, "outros"],
    ]);
    // 3000 − 1750 = 1250 ÷ 16 = 78,125 → R$ 78
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 78");
    expect(screen.getByText("até o fim do mês.")).toBeTruthy();
    expect(screen.queryByText(/\bIA\b/)).toBeNull();

    expect(screen.queryByTestId("montar-fatura")).toBeNull(); // sem cartão, sem linha de fatura
    expect(controle.dados()["finance-card-config"]).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" })); // pela missão: o 1º gasto é o tutorial, depois
    expect(onPronto).toHaveBeenCalledWith({ contas: 3, porDia: 78, semFolga: false, cartao: false });
    expect(fim).toHaveBeenCalledTimes(1);
    expect((fim.mock.calls[0][0] as CustomEvent).detail).toEqual({ resultado: "pronto", contas: 3, cartao: false });
    window.removeEventListener(EVENTO_MONTAR_FINANCAS_FIM, fim as EventListener);

    // + o passo 1 de Finanças da missão: a tela do número apareceu ("resultado") e o "Continuar"
    expect(nomes()).toEqual([EV_VIEW, EV_PASSO, EV_PASSO, EV_PASSO, EV_PRONTO, EV_PASSO, EV_PRIMEIRO_GASTO, EV_PRIMEIRO_GASTO]);
    expect(eventos.filter(([n]) => n === EV_PRIMEIRO_GASTO).map(([, e]) => e.acao)).toEqual(["resultado", "continuar"]);
    expect(eventos.filter(([n]) => n === EV_PASSO).map(([, e]) => e.n)).toEqual([1, 2, 3, 4]);
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toEqual({ contas: 3, faixa: "2a4", sem_folga: false, apertado: false, origem: "missao", cartao: false });
    for (const [, e] of eventos) expect(JSON.stringify(e)).not.toMatch(/3000|900|700|150|1750|78/);
    // feito: no aparelho e na conta
    expect(marcaDoAparelho()?.r).toBe("pronto");
    expect((d[CHAVE_MONTAR_FINANCAS] as any)?.r).toBe("pronto");
  });

  it("renda digitada (sem faixa) e 'Não tenho conta fixa' também chegam ao número", async () => {
    const controle = montarTela();
    fireEvent.change(screen.getByLabelText("Renda do mês em reais"), { target: { value: "4.800" } });
    expect((screen.getByLabelText("Renda do mês em reais") as HTMLInputElement).value).toBe("4.800");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(screen.getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 300");
    expect(controle.dados()["finance-fixed-expenses"]).toBeUndefined();
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ contas: 0, faixa: "digitou" });
  });

  it("Voltar da 2ª pergunta guarda a renda; tirar uma conta na tabela desmarca o chip", () => {
    montarTela();
    fireEvent.click(screen.getByRole("button", { name: "Até R$ 2 mil" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: /^📶 Internet/ }));
    expect(screen.getByRole("button", { name: /^📶 Internet/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Tirar Internet" }));
    expect(screen.getByRole("button", { name: /^📶 Internet/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect((screen.getByLabelText("Renda do mês em reais") as HTMLInputElement).value).toBe("1.500");
  });

  for (const passo of [1, 2] as const) {
    it(`Pular na pergunta ${passo}: nada gravado no módulo, marca 'pulou' no aparelho e na conta, evento com o passo`, () => {
      const onPular = vi.fn();
      const controle = montarTela({ onPular });
      if (passo === 2) {
        fireEvent.click(screen.getByRole("button", { name: "R$ 4 a 7 mil" }));
        fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      }
      fireEvent.click(screen.getByRole("button", { name: "Pular" }));
      expect(onPular).toHaveBeenCalledTimes(1);
      expect(controle.dados()["finance-incomes"]).toBeUndefined();
      expect(marcaDoAparelho()?.r).toBe("pulou");
      expect((controle.dados()[CHAVE_MONTAR_FINANCAS] as any)?.r).toBe("pulou");
      expect(eventos.find(([n]) => n === EV_PULAR)![1]).toEqual({ passo, origem: "modulo" });
    });
  }
});

/* ───────────────────────── no módulo de verdade ───────────────────────── */
describe("pages/Index (Finanças de verdade), app da loja", () => {
  it("REGRA DO DONO: conta nova vazia abrindo Finanças vê o módulo de sempre, na hora — nada de quiz, nem tela em branco esperando o dado da conta", { timeout: 40_000 }, async () => {
    expect(MONTAR_FINANCAS_NO_MODULO).toBe(false);
    const controle = montarIndex({}, novoControle(), false);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.getByRole("button", { name: /MEU FINANCEIRO/ })).toBeTruthy(); // o módulo já está na tela
    act(() => controle.setLoaded(true));
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(document.documentElement.hasAttribute("data-montar-financas")).toBe(false);
    expect(eventos.some(([n]) => n === EV_VIEW)).toBe(false);
    expect(marcaDoAparelho()).toBeNull(); // nenhuma vista gasta: a missão ainda pode abrir a tela
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: <T,>(_k: string, f: T) => f, isGuest: false })).toBe(true);
  });

  it("a MISSÃO abre a tela por cima de Finanças; no fim, o módulo mostra a renda, as contas e o MESMO número no Dashboard de sempre", { timeout: 40_000 }, async () => {
    const ComMissao = () => {
      const [missao, setMissao] = useState(true);
      return (
        <MemoryRouter initialEntries={["/financas"]}>
          <Provedor inicial={{}} controle={novoControle()}>
            <Routes><Route path="/financas" element={<Index />} /></Routes>
            {missao && <MontarFinancas origem="missao" agora={HOJE} esperaMs={0} onPronto={() => setMissao(false)} />}
          </Provedor>
        </MemoryRouter>
      );
    };
    render(<ComMissao />);
    await respirar();
    expect(screen.getAllByTestId("montar-financas")).toHaveLength(1);
    await fazerOsTresToques();
    const numero = screen.getByTestId("montar-por-dia").textContent!.match(/R\$ ([\d.]+)/)![1];
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await respirar();

    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.getAllByText("Renda do mês").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Escola").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /DASHBOARD/ }));
    await respirar();
    // (a suíte inteira carregada: o Dashboard pode levar mais que os 6 respiros pra montar)
    await screen.findByText("QUANTO POSSO GASTAR HOJE", {}, { timeout: 10_000 });
    // o Dashboard de sempre (painel limpo desligado na 1.0.16): o card mostra o MESMO número do Montar
    expect(screen.getByTestId("pode-gastar-valor").textContent).toBe(`R$ ${numero}`);
    expect(screen.queryByTestId("sobram-pra-hoje")).toBeNull(); // a linha "Sobram R$ X pra hoje" era do painel limpo
  });

  it("conta antiga, conta com dado, convidado e site: Finanças de sempre", { timeout: 40_000 }, async () => {
    auth.user = { id: UID, created_at: new Date(HOJE.getTime() - 30 * 24 * HORA).toISOString() };
    montarIndex({});
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    cleanup();

    auth.user = { id: UID, created_at: new Date(HOJE.getTime() - HORA).toISOString() };
    montarIndex({ "finance-expenses": [{ id: "e1", description: "Café", value: 12, date: "2026-10-16", category: "alimentacao", paymentMethod: "pix" }] });
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    cleanup();

    virarSite();
    montarIndex({});
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
  });
});

/* ───────────────────────── uma vez só, de verdade ───────────────────────── */
describe("feito/pulado sobrevive a fechar e reabrir o app, ao logout e a outro aparelho", () => {
  const abrirEFecharOApp = async () => {
    let carregou = false;
    const Sonda = () => { carregou = useUserData().loaded; return null; };
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    await waitFor(() => expect(carregou).toBe(true));
    cleanup();
  };

  it("a chave é do aparelho (nenhuma vassoura leva)", () => {
    expect(ehChaveDoAparelho(CHAVE_MONTAR_FINANCAS)).toBe(true);
    expect(vassouraLeva(CHAVE_MONTAR_FINANCAS)).toBe(false);
  });

  it("pronto → fechar → reabrir (2×) → sair da conta: continua decidido", async () => {
    vi.useRealTimers();
    marcarMontarDecidido("pronto");
    localStorage.setItem(`u:${UID}:finance-incomes`, "[]"); // cache da conta: a vassoura leva
    await abrirEFecharOApp();
    expect(montarJaDecidido()).toBe(true);
    expect(localStorage.getItem(`u:${UID}:finance-incomes`)).toBeNull();
    await abrirEFecharOApp();
    expect(montarJaDecidido()).toBe(true);
    purgeLocalUserCache();
    expect(marcaDoAparelho()?.r).toBe("pronto");
  });

  it("outro aparelho (localStorage vazio): a marca que voltou da conta basta", () => {
    const daConta = <T,>(k: string, f: T): T => (k === CHAVE_MONTAR_FINANCAS ? ({ r: "pulou", em: "2026-10-16T12:00:00Z" } as T) : f);
    expect(montarJaDecidido()).toBe(false);
    expect(montarJaDecidido(daConta)).toBe(true);
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: daConta, isGuest: false })).toBe(false);
  });

  it("o app fechou NO MEIO da tela da missão (sem decidir): volta 1 vez, com o que já tinha respondido, e a 2ª vista sem decisão é a última", async () => {
    const vazio = <T,>(_k: string, f: T) => f;
    montarTela({ origem: "missao" });
    expect(screen.getByTestId("montar-financas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "R$ 4 a 7 mil" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: /^🏠 Aluguel/ }));
    cleanup(); // fechou o app na 2ª pergunta
    _novaAberturaMontar();
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: vazio, isGuest: false })).toBe(true);
    montarTela({ origem: "missao" });
    // volta onde parou, com o que já tinha respondido
    expect(screen.getByText("Quais contas você paga todo mês?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^🏠 Aluguel/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect((screen.getByLabelText("Renda do mês em reais") as HTMLInputElement).value).toBe("5.500");
    expect(eventos.filter(([n]) => n === EV_VIEW).map(([, e]) => e.retomou)).toEqual([false, true]);
    cleanup();
    _novaAberturaMontar();
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: vazio, isGuest: false })).toBe(false);
  });
});

/* ───────────────────────── módulo × missão: uma tela por vez ───────────────────────── */
describe("a tela da missão (origem 'missao') e a do módulo nunca aparecem juntas", () => {
  const Ambos = ({ inicial, missao }: { inicial: Record<string, unknown>; missao: boolean }) => (
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={inicial} controle={novoControle()}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
        {missao && <MontarFinancas origem="missao" agora={HOJE} esperaMs={0} />}
      </Provedor>
    </MemoryRouter>
  );

  it("o módulo não abre a tela dele nem pra conta nova vazia; a da missão abre por cima e é a única", { timeout: 40_000 }, async () => {
    const { rerender } = render(<Ambos inicial={{}} missao={false} />);
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(document.documentElement.hasAttribute("data-montar-financas")).toBe(false);
    rerender(<Ambos inicial={{}} missao />);
    await respirar();
    expect(screen.getAllByTestId("montar-financas")).toHaveLength(1);
    expect(document.documentElement.getAttribute("data-montar-financas")).toBe("missao");
    expect(eventos.filter(([n]) => n === EV_VIEW).map(([, e]) => e.origem)).toEqual(["missao"]);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(eventos.find(([n]) => n === EV_PULAR)![1]).toEqual({ passo: 1, origem: "missao" });
  });

  it("código guardado (se a do módulo for religada): ela cede pra da missão sem decidir, e o que foi respondido passa junto", async () => {
    const Duas = ({ missao }: { missao: boolean }) => (
      <MemoryRouter>
        <Provedor inicial={{}} controle={novoControle()}>
          <MontarFinancas origem="modulo" agora={HOJE} esperaMs={0} />
          {missao && <MontarFinancas origem="missao" agora={HOJE} esperaMs={0} />}
        </Provedor>
      </MemoryRouter>
    );
    const { rerender } = render(<Duas missao={false} />);
    await respirar();
    expect(document.documentElement.getAttribute("data-montar-financas")).toBe("modulo");
    fireEvent.click(screen.getByRole("button", { name: "Mais de R$ 7 mil" }));
    rerender(<Duas missao />);
    await respirar();
    expect(screen.getAllByTestId("montar-financas")).toHaveLength(1);
    expect(document.documentElement.getAttribute("data-montar-financas")).toBe("missao");
    expect((screen.getByLabelText("Renda do mês em reais") as HTMLInputElement).value).toBe("8.000");
    expect(marcaDoAparelho()?.r).toBeUndefined(); // ceder não é pular
    expect(marcaDoAparelho()?.vistas).toBe(1); // nem gasta a 2ª vista
  });

  it("com a da missão já na tela, o módulo não abre a dele; quando ela termina, Finanças aparece cheia", { timeout: 40_000 }, async () => {
    render(<Ambos inicial={{}} missao />);
    await respirar();
    expect(screen.getAllByTestId("montar-financas")).toHaveLength(1);
    expect(eventos.filter(([n]) => n === EV_VIEW).map(([, e]) => e.origem)).toEqual(["missao"]);
    await fazerOsTresToques();
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(lerRascunhoMontar()).toBeNull(); // virou dado: o rascunho sai
    // a tela de Finanças por baixo já adotou o dado (avisarEscritaDeFora)
    expect(screen.getAllByText("Renda do mês").length).toBeGreaterThan(0);
  });
});

/* ───────────────────────── sair da conta e entrar de novo (conta VAZIA) ───────────────────────── */
describe("logout → login na mesma conta vazia", () => {
  it("pulou na tela da missão → sai da conta (vassoura do logout) → entra em outro aparelho (localStorage zerado): a missão não mostra de novo", { timeout: 40_000 }, async () => {
    const controle = novoControle();
    render(
      <MemoryRouter>
        <Provedor inicial={{}} controle={controle}>
          <MontarFinancas origem="missao" agora={HOJE} esperaMs={0} />
        </Provedor>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    const daConta = controle.dados()[CHAVE_MONTAR_FINANCAS]; // o que subiu pro user_data
    expect((daConta as any)?.r).toBe("pulou");
    cleanup();
    const vazio = <T,>(_k: string, f: T) => f;
    const comAConta = <T,>(k: string, f: T): T => (k === CHAVE_MONTAR_FINANCAS ? (daConta as T) : f);

    purgeLocalUserCache(); // logout: o aparelho guarda a marca dele
    _novaAberturaMontar();
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: vazio, isGuest: false })).toBe(false);

    localStorage.clear(); // outro aparelho / reinstalou: só a conta lembra
    _novaAberturaMontar();
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: vazio, isGuest: false })).toBe(true); // sem marca nenhuma, mostraria
    expect(deveMostrarMontarFinancas({ criadoEm: auth.user!.created_at, get: comAConta, isGuest: false })).toBe(false);

    // e o módulo, aberto depois do login, continua sem quiz
    montarIndex({ [CHAVE_MONTAR_FINANCAS]: daConta });
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
  });
});
