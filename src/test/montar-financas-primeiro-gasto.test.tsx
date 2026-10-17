/**
 * O 1º GASTO NA TELA DO NÚMERO (17/10, D1 do relatório 11 — só quando a MISSÃO abre o Montar). Conta VAZIA:
 *   · na tela "Você pode gastar hoje R$ X", o post-it "Já gastou com alguma coisa hoje?" — Café R$ 12 ·
 *     Uber R$ 23 · Almoço R$ 35 · ✎ outro · "Ainda não gastei nada hoje →" (a tela do módulo não tem);
 *   · 1 toque = 1 gasto variável DE VERDADE (`finance-expenses`, o mesmo objeto do "+ Novo gasto", à vista,
 *     hoje), UMA vez — toque duplo e o mesmo chip de novo não duplicam;
 *   · o número cai na frente dela: ~~R$ 66~~ R$ 54 pra hoje (o que dá por dia − o gasto de hoje), a linha
 *     "☕ Café · R$ 12 já está nas suas Finanças…", e o botão vira "Ver no meu mês →";
 *   · `onPronto` leva `primeiroGasto` ({ nome } · null no "Ainda não gastei" · ausente sem tocar);
 *   · fechar o app NA tela do número volta NELA (com os chips já tocados), só hoje e só nesta conta (B11);
 *   · eventos `missao_doses_gasto_no_numero` sem valor em reais;
 *   · no módulo de verdade: o gasto aparece em Finanças e o painel limpo diz "Sobram R$ 54 pra hoje".
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-pg", created_at: "" } as { id: string; created_at?: string } | null }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => {
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
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
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

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import {
  CHAVE_MONTAR_FINANCAS, EV_GASTO_NO_NUMERO, EV_PULAR, _novaAberturaMontar, _zerarRemotaMontar, deveMostrarMontarFinancas,
  lerTelaDoNumero, marcaDoAparelho, sobraPraHoje,
} from "@/lib/montar-financas";
import { MontarFinancas, type ResumoMontar } from "@/components/finance/montar/MontarFinancas";
import Index from "@/pages/Index";

const UID = "u-pg";
const HOJE = new Date(2026, 9, 16, 12, 0); // 16/10/2026: 16 dias contando hoje
const HORA = 3600e3;
const CRIADA = new Date(HOJE.getTime() - 2 * HORA).toISOString();

const virarApp = () => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as any).Capacitor; };

type Controle = { dados: () => Record<string, unknown>; escritas: () => string[] };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const escritas = useRef<string[]>([]);
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    escritas.current.push(k);
    ref.current = { ...ref.current, [k]: JSON.parse(JSON.stringify(v ?? null)) };
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.dados = () => ref.current;
  controle.escritas = () => escritas.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: !auth.user, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const novoControle = (): Controle => ({ dados: () => ({}), escritas: () => [] });

const montarTela = (props: Partial<React.ComponentProps<typeof MontarFinancas>> = {}, inicial: Record<string, unknown> = {}, controle = novoControle()) => {
  render(
    <MemoryRouter>
      <Provedor inicial={inicial} controle={controle}>
        <MontarFinancas origem="missao" agora={HOJE} esperaMs={0} {...props} />
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const respirar = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tela = () => within(screen.getByTestId("montar-financas"));
const postIt = () => within(screen.getByTestId("montar-postit-gasto"));

/** R$ 3.000 · Aluguel 900 + Luz 150 + Internet 100 · cartão Nubank R$ 800 dia 25 → R$ 66 por dia (1.050 ÷ 16). */
const ateONumero = async () => {
  fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  for (const c of [/^🏠 Aluguel/, /^💡 Luz/, /^📶 Internet/]) fireEvent.click(tela().getByRole("button", { name: c }));
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  fireEvent.click(tela().getByRole("button", { name: /Uso cartão/ }));
  fireEvent.click(tela().getByRole("button", { name: "Nubank" }));
  fireEvent.change(tela().getByLabelText("Fatura deste mês em reais"), { target: { value: "800" } });
  fireEvent.click(tela().getByRole("button", { name: "Dia 25" }));
  fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
  await respirar();
  expect(screen.getByTestId("montar-pronto")).toBeTruthy();
};
const gastosDe = (c: Controle) => ((c.dados()["finance-expenses"] ?? []) as any[]);
/** Os eventos da tela do número, sem o envelope da missão (eventoDaMissao: protótipo, plataforma, versão, braço). */
const doNumero = () => eventos.filter(([n]) => n === EV_GASTO_NO_NUMERO).map(([, e]) => {
  const { prototipo: _p, plataforma: _pl, versao: _v, variante: _b, ...resto } = e;
  return resto;
});
/** O texto como se lê (o "R$" vai preso ao número por um espaço que não quebra: \u00a0). */
const lido = (el: Element) => (el.textContent ?? "").replace(/\u00a0/g, " ");

beforeAll(() => {
  // "menos movimento": o número cai na hora (a animação não depende da velocidade da máquina)
  window.matchMedia = ((q: string) => ({ matches: /prefers-reduced-motion: reduce/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
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
  eventos.length = 0;
  _zerarRemotaMontar();
  _novaAberturaMontar();
  auth.user = { id: UID, created_at: CRIADA };
  virarApp();
});
afterEach(() => {
  cleanup();
  virarSite();
  vi.useRealTimers();
});

describe("a tela do número com o post-it do 1º gasto (só pela missão)", () => {
  it("a missão mostra o post-it logo abaixo do número; a tela do módulo não", async () => {
    montarTela();
    await ateONumero();
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 66");
    expect(postIt().getByText("Já gastou com alguma coisa hoje?")).toBeTruthy();
    for (const c of ["Café", "Uber", "Almoço"]) expect(postIt().getByRole("button", { name: new RegExp(`^${c},`) })).toBeTruthy();
    expect(postIt().getByRole("button", { name: "✎ outro" })).toBeTruthy();
    expect(postIt().getByRole("button", { name: "Ainda não gastei nada hoje →" })).toBeTruthy();
    expect(tela().getByRole("button", { name: "Ver minhas Finanças" })).toBeTruthy();
    expect(doNumero()).toEqual([{ acao: "view", ms: 0 }]);
    // o mesmo envelope dos outros eventos da missão (é por versão/braço que as 48 h se leem)
    expect(eventos.find(([n]) => n === EV_GASTO_NO_NUMERO)![1]).toMatchObject({ prototipo: "app", plataforma: "ios", versao: "dev" });
    cleanup();
    localStorage.clear();
    _novaAberturaMontar();
    montarTela({ origem: "modulo" });
    await respirar();
    await ateONumero();
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
  });

  it("Café: 1 gasto de verdade UMA vez (toque duplo e toque de novo não duplicam), ✓, o número cai pra R$ 54 pra hoje e o botão vira 'Ver no meu mês →'", async () => {
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto });
    await ateONumero();
    const cafe = postIt().getByRole("button", { name: /^Café,/ });
    fireEvent.click(cafe);
    fireEvent.click(cafe); // toque duplo
    await respirar();
    fireEvent.click(postIt().getByRole("button", { name: /^Café,/ })); // de novo, já ✓
    await respirar();

    expect(gastosDe(controle)).toEqual([{ id: expect.stringMatching(/^demo-/), description: "Café", category: "alimentacao", value: 12, date: "2026-10-16", paymentMethod: "pix" }]);
    expect(postIt().getByRole("button", { name: "Café, R$ 12, anotado" }).getAttribute("aria-pressed")).toBe("true");
    const numero = screen.getByTestId("montar-pra-hoje");
    expect(numero.getAttribute("data-valor")).toBe("54");
    expect(numero.getAttribute("aria-label")).toBe("Era R$ 66 por dia; sobram R$ 54 pra hoje");
    // ~~R$ 66~~ R$ 54 pra hoje (com "menos movimento", na hora) — o "R$" nunca fica sozinho no fim da linha
    expect(numero.textContent).toBe("R$\u00a066R$\u00a054pra hoje");
    expect(lido(screen.getByTestId("montar-pronto"))).toContain("Café · R$ 12 já está nas suas Finanças. Era R$ 66 por dia — hoje sobram R$ 54.");
    expect(screen.getByTestId("montar-pronto").textContent).toContain("Café · R$\u00a012 já está nas suas Finanças. Era R$\u00a066 por dia — hoje sobram R$\u00a054.");
    expect(postIt().getByText("Primeiro gasto no lugar.")).toBeTruthy();
    expect(postIt().queryByRole("button", { name: /Ainda não gastei/ })).toBeNull();
    expect(doNumero()).toEqual([{ acao: "view", ms: 0 }, { acao: "chip", ms: 0, chip: "Café" }]);

    fireEvent.click(tela().getByRole("button", { name: "Ver no meu mês →" }));
    expect(onPronto).toHaveBeenCalledWith({ contas: 3, porDia: 66, semFolga: false, cartao: true, primeiroGasto: { nome: "Café" } });
    expect(marcaDoAparelho()?.numero).toBeUndefined(); // saiu da tela: não volta mais
    for (const e of doNumero()) expect(JSON.stringify(e)).not.toMatch(/12|54|66/);
  });

  it("dois chips: os dois gravados, a soma sai do dia ('Café e Uber · R$ 35'); o 1º vai no onPronto", async () => {
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto });
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: /^Café,/ }));
    await respirar();
    fireEvent.click(postIt().getByRole("button", { name: /^Uber,/ }));
    await respirar();
    expect(gastosDe(controle).map((g) => [g.description, g.value])).toEqual([["Café", 12], ["Uber", 23]]);
    expect(screen.getByTestId("montar-pra-hoje").getAttribute("data-valor")).toBe("31");
    expect(lido(screen.getByTestId("montar-pronto"))).toContain("Café e Uber · R$ 35 já estão nas suas Finanças. Era R$ 66 por dia — hoje sobram R$ 31.");
    expect(postIt().getByText("Gastos de hoje no lugar.")).toBeTruthy();
    fireEvent.click(tela().getByRole("button", { name: "Ver no meu mês →" }));
    expect(onPronto.mock.calls[0][0].primeiroGasto).toEqual({ nome: "Café" });
  });

  it("✎ outro: nome e valor ali mesmo, sem sair da tela; vira gasto 'Outros' de hoje e um ✓", async () => {
    const controle = montarTela();
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: "✎ outro" }));
    const anotar = postIt().getByRole("button", { name: "Anotar" }) as HTMLButtonElement;
    expect(anotar.disabled).toBe(true);
    fireEvent.change(postIt().getByLabelText("Com o que você gastou"), { target: { value: "Padaria" } });
    expect(anotar.disabled).toBe(true);
    fireEvent.change(postIt().getByLabelText("Quanto foi, em reais"), { target: { value: "9" } });
    fireEvent.click(anotar);
    fireEvent.click(anotar); // toque duplo no Anotar
    await respirar();
    expect(gastosDe(controle)).toEqual([{ id: expect.stringMatching(/^demo-/), description: "Padaria", category: "outros", value: 9, date: "2026-10-16", paymentMethod: "pix" }]);
    expect(screen.queryByTestId("montar-outro-gasto")).toBeNull();
    expect(postIt().getByLabelText("Padaria, R$ 9, anotado")).toBeTruthy();
    expect(screen.getByTestId("montar-pra-hoje").getAttribute("data-valor")).toBe("57");
    expect(doNumero().map((e) => e.acao)).toEqual(["view", "outro"]);
  });

  it("✎ outro preenchido e o botão grande tocado direto (sem o 'Anotar'): anota 1 vez e sai com ele como 1º gasto", async () => {
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto });
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: "✎ outro" }));
    expect(tela().getByRole("button", { name: "Ver minhas Finanças" })).toBeTruthy(); // vazio: nada a anotar
    fireEvent.change(postIt().getByLabelText("Com o que você gastou"), { target: { value: "Farmácia" } });
    fireEvent.change(postIt().getByLabelText("Quanto foi, em reais"), { target: { value: "27" } });
    const cta = tela().getByRole("button", { name: "Ver no meu mês →" });
    fireEvent.click(cta);
    fireEvent.click(cta); // toque duplo
    await respirar();
    expect(gastosDe(controle).map((g) => [g.description, g.value, g.category, g.date])).toEqual([["Farmácia", 27, "outros", "2026-10-16"]]);
    expect(onPronto).toHaveBeenCalledTimes(1);
    expect(onPronto.mock.calls[0][0].primeiroGasto).toEqual({ nome: "Farmácia" });
    expect(doNumero().map((e) => e.acao)).toEqual(["view", "outro"]);
    for (const e of doNumero()) expect(JSON.stringify(e)).not.toMatch(/Farm|27/); // nem o nome digitado nem o valor
  });

  it("✎ outro: Enter no nome sem valor leva pro campo do valor; o X fecha sem gravar nada", async () => {
    const controle = montarTela();
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: "✎ outro" }));
    const nome = postIt().getByLabelText("Com o que você gastou");
    fireEvent.change(nome, { target: { value: "Pão" } });
    fireEvent.keyDown(nome, { key: "Enter" });
    expect(document.activeElement).toBe(postIt().getByLabelText("Quanto foi, em reais"));
    fireEvent.click(postIt().getByRole("button", { name: "Fechar" }));
    expect(screen.queryByTestId("montar-outro-gasto")).toBeNull();
    expect(gastosDe(controle)).toEqual([]);
    expect(tela().getByRole("button", { name: "Ver minhas Finanças" })).toBeTruthy();
  });

  it("'Ainda não gastei nada hoje →': sai com primeiroGasto null, nada gravado em gastos", async () => {
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto });
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: "Ainda não gastei nada hoje →" }));
    expect(onPronto).toHaveBeenCalledWith({ contas: 3, porDia: 66, semFolga: false, cartao: true, primeiroGasto: null });
    expect(gastosDe(controle)).toEqual([]);
    expect(doNumero().map((e) => e.acao)).toEqual(["view", "ainda_nao"]);
    expect(eventos.some(([n]) => n === EV_PULAR)).toBe(false); // a dose conta (o Montar gravou)
    expect(marcaDoAparelho()?.numero).toBeUndefined();
  });

  it("'Ver minhas Finanças' sem tocar em nada: onPronto SEM primeiroGasto (a missão segue com o 1º gasto dela)", async () => {
    const onPronto = vi.fn();
    montarTela({ onPronto });
    await ateONumero();
    fireEvent.click(tela().getByRole("button", { name: "Ver minhas Finanças" }));
    const r = onPronto.mock.calls[0][0] as ResumoMontar;
    expect("primeiroGasto" in r).toBe(false);
  });

  it("o gasto passa do que dá no dia: R$ 0 pra hoje e 'hoje já passou'", async () => {
    montarTela();
    fireEvent.click(tela().getByRole("button", { name: "Até R$ 2 mil" })); // 1.500
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ })); // 900 → 600 ÷ 16 = 38 por dia
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    fireEvent.click(postIt().getByRole("button", { name: /^Almoço,/ })); // 35
    await respirar();
    fireEvent.click(postIt().getByRole("button", { name: /^Uber,/ })); // + 23 = 58
    await respirar();
    expect(screen.getByTestId("montar-pra-hoje").getAttribute("data-valor")).toBe("0");
    expect(lido(screen.getByTestId("montar-pronto"))).toContain("Era R$ 38 por dia — hoje já passou R$ 20.");
    expect(sobraPraHoje(37.5, 58)).toBe(-20);
  });

  it("sem folga no mês: o chip grava igual, o número de cima fica e a frase vai pro post-it", async () => {
    const controle = montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "1000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ })); // 900
    fireEvent.click(tela().getByRole("button", { name: /^🏋️ Academia/ })); // 100 → 0 livre
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    fireEvent.click(postIt().getByRole("button", { name: /^Café,/ }));
    await respirar();
    expect(gastosDe(controle)).toHaveLength(1);
    expect(screen.queryByTestId("montar-pra-hoje")).toBeNull();
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 0");
    expect(postIt().getByText(/já está nas suas Finanças\./)).toBeTruthy();
  });
});

describe("fechar o app NA tela do número volta NELA (B11)", () => {
  it("fechou com o Café tocado → a missão pergunta de novo → volta no número, com o Café ✓ e o R$ 54 pra hoje; saindo, acabou", async () => {
    const controle = montarTela();
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: /^Café,/ }));
    await respirar();
    const dados = controle.dados();
    cleanup(); // fechou o app na tela do número
    _novaAberturaMontar();
    eventos.length = 0;

    const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
    // já decidido e o módulo já tem dado — mesmo assim a tela volta (a dose ainda não andou)
    expect(deveMostrarMontarFinancas({ criadoEm: CRIADA, get, isGuest: false })).toBe(true);
    const onPronto = vi.fn();
    const de = montarTela({ onPronto }, dados);
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(postIt().getByRole("button", { name: "Café, R$ 12, anotado" })).toBeTruthy();
    expect(screen.getByTestId("montar-pra-hoje").getAttribute("data-valor")).toBe("54");
    expect(screen.getByTestId("montar-pronto").textContent).toContain("Nubank");
    expect(doNumero()).toEqual([{ acao: "view", ms: 0, retomou: true }]);
    // tocar o Café de novo não grava outro
    fireEvent.click(postIt().getByRole("button", { name: /^Café,/ }));
    await respirar();
    expect(gastosDe(de)).toHaveLength(1);

    fireEvent.click(tela().getByRole("button", { name: "Ver no meu mês →" }));
    expect(onPronto).toHaveBeenCalledWith(expect.objectContaining({ primeiroGasto: { nome: "Café" } }));
    expect(deveMostrarMontarFinancas({ criadoEm: CRIADA, get: <T,>(k: string, f: T): T => (k in de.dados() ? (de.dados()[k] as T) : f), isGuest: false })).toBe(false);
  });

  it("fechou sem tocar em nada: volta no número com os chips; no dia seguinte ou em outra conta, não volta", async () => {
    montarTela();
    await ateONumero();
    cleanup();
    _novaAberturaMontar();
    expect(lerTelaDoNumero(CRIADA, HOJE)).not.toBeNull();
    expect(lerTelaDoNumero("2026-10-16T09:00:00.000Z", HOJE)).toBeNull(); // outra conta neste celular
    expect(lerTelaDoNumero(CRIADA, new Date(HOJE.getTime() + 24 * HORA))).toBeNull(); // outro dia
    montarTela();
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(postIt().getByText("Já gastou com alguma coisa hoje?")).toBeTruthy();
    cleanup();
    // outra pessoa entra neste celular: a tela dela começa do começo
    _novaAberturaMontar();
    auth.user = { id: "u-outra", created_at: new Date(HOJE.getTime() - HORA).toISOString() };
    montarTela();
    expect(screen.getByText("Quanto entra por mês, mais ou menos?")).toBeTruthy();
  });

  it("fechou no 'Montando…' (já gravou): volta no número", async () => {
    montarTela({ esperaMs: 60_000 });
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    expect(screen.getByText("Montando suas finanças…")).toBeTruthy();
    cleanup();
    _novaAberturaMontar();
    montarTela();
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 188"); // 3.000 ÷ 16
  });

  it("a marca da conta não leva a tela do número (só o aparelho, que sabe de quem é)", async () => {
    const controle = montarTela();
    await ateONumero();
    expect((controle.dados()[CHAVE_MONTAR_FINANCAS] as any)?.r).toBe("pronto");
    expect((controle.dados()[CHAVE_MONTAR_FINANCAS] as any)?.numero).toBeUndefined();
    expect(marcaDoAparelho()?.numero?.conta).toBe(CRIADA);
  });
});

describe("no módulo de verdade (a missão por cima de Finanças)", () => {
  it("Café na tela do número → 'Ver no meu mês' → o gasto está em Finanças e o painel limpo diz 'Sobram R$ 54 pra hoje'", { timeout: 40_000 }, async () => {
    const controle = novoControle();
    const ComMissao = () => {
      const [missao, setMissao] = useState(true);
      return (
        <MemoryRouter initialEntries={["/financas"]}>
          <Provedor inicial={{}} controle={controle}>
            <Routes><Route path="/financas" element={<Index />} /></Routes>
            {missao && <MontarFinancas origem="missao" agora={HOJE} esperaMs={0} onPronto={() => setMissao(false)} />}
          </Provedor>
        </MemoryRouter>
      );
    };
    render(<ComMissao />);
    await respirar();
    await ateONumero();
    fireEvent.click(postIt().getByRole("button", { name: /^Café,/ }));
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "Ver no meu mês →" }));
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.getAllByText("Café").length).toBeGreaterThan(0); // CUSTOS VARIÁVEIS de hoje
    fireEvent.click(screen.getByRole("button", { name: /DASHBOARD/ }));
    await respirar();
    expect(lido(screen.getByTestId("sobram-pra-hoje"))).toBe("Sobram R$ 54 pra hoje · já saiu R$ 12 dos R$ 66 do dia");
    expect(gastosDe(controle)).toHaveLength(1);
  });
});
