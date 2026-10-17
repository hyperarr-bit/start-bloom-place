/**
 * PAINEL LIMPO DE FINANÇAS (1.0.16) — o que este arquivo trava:
 *   · CLIENTE ANTIGO NÃO MUDA: o Dashboard de quem já usava sai com as mesmas seções, na mesma ordem,
 *     e nada é gravado na conta dele (nem no aparelho);
 *   · conta NOVA (passou pelo Montar, ou criada desde o corte sem dado / com menos de 48 h) abre com
 *     QUANTO POSSO GASTAR HOJE → ALERTAS → MEU MÊS → GASTOS POR CATEGORIA → TOTAL POR CARTÃO → DESAFIO
 *     DA SEMANA, e o resto atrás de "Mais gráficos" (fechado; abrir manda financas_mais_graficos_abrir);
 *   · decidido uma vez e lembrado: aparelho (por conta) + conta — fechar e abrir o app (o dado da conta
 *     ainda não chegou), sair e entrar, outro aparelho; outra conta no mesmo celular não herda;
 *   · a chave: app ligado, site desligado, metadata `financas_painel_limpo: "off"` do RevenueCat volta pro
 *     de sempre sem esquecer quem é elegível; força de QA só no navegador.
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-pl", created_at: "" } as { id: string; created_at?: string } | null }));
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
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CHAVE_MONTAR_FINANCAS, _novaAberturaMontar, _zerarRemotaMontar } from "@/lib/montar-financas";
import {
  CHAVE_FORCA_PAINEL_LIMPO, CHAVE_PAINEL_LIMPO, EV_MAIS_GRAFICOS, PREFIXO_PAINEL_LIMPO_APARELHO, _zerarRemotaPainel,
  contaElegivelAoPainelLimpo, guardarForcaPainelDaUrl, lembrarPainelLimpo, lerChaveRemotaPainel, mostrarPainelLimpo,
  painelLimpoLigado, registrarChavePainelLimpo,
} from "@/lib/financas-painel-limpo";
import Index from "@/pages/Index";

const UID = "u-pl";
const OUTRA = "u-outra";
const HOJE = new Date(2026, 9, 16, 12, 0);
const HORA = 3600e3;
const CHAVE_APARELHO = `${PREFIXO_PAINEL_LIMPO_APARELHO}${UID}`;

const virarApp = () => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as any).Capacitor; };
const contaNova = () => { auth.user = { id: UID, created_at: new Date(HOJE.getTime() - 2 * HORA).toISOString() }; };
const contaAntiga = () => { auth.user = { id: UID, created_at: "2026-03-02T15:00:00Z" }; };

/** Um mês de cliente de verdade (e a marca do tutorial feito: abre no DASHBOARD). */
const MES_COM_DADO: Record<string, unknown> = {
  "spotlight-done-financas": "true",
  "finance-incomes": [{ id: "i1", description: "Salário", value: 4200, date: "2026-10-05" }],
  "finance-expenses": [
    { id: "e1", description: "Mercado", value: 380, date: "2026-10-10", category: "mercado", paymentMethod: "debito" },
    { id: "e2", description: "Farmácia", value: 72, date: "2026-10-14", category: "farmacia", paymentMethod: "pix" },
  ],
  "finance-fixed-expenses": [{ id: "f1", description: "Aluguel", value: 1300, category: "moradia", paymentMethod: "boleto", day: 5 }],
};

type Controle = { dados: () => Record<string, unknown>; escritas: () => { k: string; system?: boolean }[] };
const Provedor = ({ inicial, controle, loaded = true, children }: { inicial: Record<string, unknown>; controle: Controle; loaded?: boolean; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const escritas = useRef<{ k: string; system?: boolean }[]>([]);
  const get = useCallback(<T,>(k: string, fb: T): T => (!loaded ? fb : k in store ? (store[k] as T) : fb), [store, loaded]);
  const set = useCallback((k: string, v: unknown, opts?: { system?: boolean }) => {
    escritas.current.push({ k, system: opts?.system });
    ref.current = { ...ref.current, [k]: JSON.parse(JSON.stringify(v ?? null)) };
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.dados = () => ref.current;
  controle.escritas = () => escritas.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded, isGuest: !auth.user, fetchKey: async () => null }), [get, set, loaded]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const novoControle = (): Controle => ({ dados: () => ({}), escritas: () => [] });
const montarIndex = (inicial: Record<string, unknown>, { loaded = true, rota = "/financas" } = {}) => {
  const controle = novoControle();
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor inicial={inicial} controle={controle} loaded={loaded}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const respirar = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const abrirDashboard = async () => {
  const aba = screen.queryByRole("button", { name: /DASHBOARD/ });
  if (aba) fireEvent.click(aba);
  await respirar();
};
/** As seções que aparecem, na ordem da tela. */
const SECOES = [
  "DESAFIO DA SEMANA", "QUANTO POSSO GASTAR HOJE", "ALERTAS INTELIGENTES", "MEU MÊS —", "GASTOS POR CATEGORIA", "TOTAL POR CARTÃO NO MÊS",
  "MAIS GRÁFICOS", "Saldo do Mês", "RECEITAS VS DESPESAS", "PREVISÃO FIM DO MÊS", "EVOLUÇÃO DO PATRIMÔNIO", "PROGRESSO DO MÊS",
  "GASTO POR MÉTODO", "FIXOS VS VARIÁVEIS", "TOP 5 MAIORES GASTOS", "ÚLTIMAS TRANSAÇÕES", "COMPARAÇÃO MENSAL", "COMPARAÇÃO ANUAL",
];
const secoesNaTela = (): string[] => {
  const texto = document.body.textContent ?? "";
  return SECOES.map((s) => [s, texto.indexOf(s)] as const).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([s]) => s);
};
const contexto = (dados: Record<string, unknown> = {}, extra: Partial<Parameters<typeof contaElegivelAoPainelLimpo>[0]> = {}) => ({
  uid: auth.user?.id, criadoEm: auth.user?.created_at, get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
  loaded: true, isGuest: false, ...extra,
});

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
  eventos.length = 0;
  _zerarRemotaPainel();
  _zerarRemotaMontar();
  _novaAberturaMontar();
  contaNova();
  virarApp();
});
afterEach(() => {
  cleanup();
  virarSite();
  vi.useRealTimers();
});

/* ───────────────────────── a régua ───────────────────────── */
describe("quem é elegível", () => {
  it("conta antiga NUNCA (nem vazia); conta nova vazia sim", () => {
    contaAntiga();
    expect(contaElegivelAoPainelLimpo(contexto())).toBe(false);
    expect(contaElegivelAoPainelLimpo(contexto(MES_COM_DADO))).toBe(false);
    contaNova();
    expect(contaElegivelAoPainelLimpo(contexto())).toBe(true);
  });
  it("conta nova com dado: até 48 h sim (lançou pela Home antes de abrir Finanças); depois, só se não tem dado", () => {
    expect(contaElegivelAoPainelLimpo(contexto(MES_COM_DADO))).toBe(true);
    const tresDias = HOJE.getTime() + 72 * HORA;
    expect(contaElegivelAoPainelLimpo(contexto(MES_COM_DADO, { agora: tresDias }))).toBe(false);
    expect(contaElegivelAoPainelLimpo(contexto({}, { agora: tresDias }))).toBe(true);
  });
  it("passou pelo Montar (marca DA CONTA, pronto ou pulou) → sim; a marca do APARELHO, que pode ser de outra conta, não conta", () => {
    contaAntiga();
    expect(contaElegivelAoPainelLimpo(contexto({ [CHAVE_MONTAR_FINANCAS]: { r: "pulou", em: "x" } }))).toBe(true);
    localStorage.setItem(CHAVE_MONTAR_FINANCAS, JSON.stringify({ r: "pronto" }));
    expect(contaElegivelAoPainelLimpo(contexto())).toBe(false);
  });
  it("convidado e demo /preview: não", () => {
    expect(contaElegivelAoPainelLimpo(contexto({}, { isGuest: true }))).toBe(false);
    expect(contaElegivelAoPainelLimpo(contexto({}, { isPreview: true }))).toBe(false);
  });
  it("dado da conta ainda não chegou: 'não sei' — a não ser que o aparelho lembre ESTA conta", () => {
    expect(contaElegivelAoPainelLimpo(contexto({}, { loaded: false }))).toBeNull();
    localStorage.setItem(`${PREFIXO_PAINEL_LIMPO_APARELHO}${OUTRA}`, "1");
    expect(contaElegivelAoPainelLimpo(contexto({}, { loaded: false }))).toBeNull();
    localStorage.setItem(CHAVE_APARELHO, "1");
    contaAntiga(); // o aparelho manda: decidido antes
    expect(contaElegivelAoPainelLimpo(contexto({}, { loaded: false }))).toBe(true);
  });
  it("a conta lembra (outro aparelho, reinstalou): { limpo: true } basta", () => {
    contaAntiga();
    expect(contaElegivelAoPainelLimpo(contexto({ [CHAVE_PAINEL_LIMPO]: { limpo: true, em: "x" } }))).toBe(true);
  });
  it("guardar é idempotente: aparelho por conta + conta (escrita de sistema), uma vez", () => {
    const dados: Record<string, unknown> = {};
    const set = vi.fn((k: string, v: unknown) => { dados[k] = v; });
    const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
    lembrarPainelLimpo(UID, get, set);
    lembrarPainelLimpo(UID, get, set);
    expect(localStorage.getItem(CHAVE_APARELHO)).toBe("1");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(CHAVE_PAINEL_LIMPO, { limpo: true, em: expect.any(String) }, { system: true });
  });
  it("a memória do aparelho sobrevive às vassouras (abertura, logout); a da conta é dado da conta", () => {
    expect(ehChaveDoAparelho(CHAVE_APARELHO)).toBe(true);
    expect(vassouraLeva(CHAVE_APARELHO)).toBe(false);
    localStorage.setItem(CHAVE_APARELHO, "1");
    purgeLocalUserCache();
    expect(localStorage.getItem(CHAVE_APARELHO)).toBe("1");
    expect(vassouraLeva(CHAVE_PAINEL_LIMPO)).toBe(true);
  });
});

/* ───────────────────────── a chave ───────────────────────── */
describe("a chave financas_painel_limpo", () => {
  it("app: DESLIGADA por padrão (dono 17/10); a metadata 'on' do RevenueCat liga (a current vence); site: desligada", () => {
    expect(painelLimpoLigado()).toBe(false);
    expect(mostrarPainelLimpo(true)).toBe(false);
    registrarChavePainelLimpo({ current: { metadata: { financas_painel_limpo: "on" } }, all: {} });
    expect(painelLimpoLigado()).toBe(true);
    expect(mostrarPainelLimpo(true)).toBe(true);
    expect(mostrarPainelLimpo(false)).toBe(false);
    expect(mostrarPainelLimpo(null)).toBe(false);
    registrarChavePainelLimpo({ current: { metadata: { financas_painel_limpo: "off" } }, all: {} });
    expect(mostrarPainelLimpo(true)).toBe(false);
    expect(lerChaveRemotaPainel({ current: { metadata: {} }, all: { x: { metadata: { financas_painel_limpo: "off" } } } })).toBe("off");
    expect(lerChaveRemotaPainel({ current: { metadata: { financas_painel_limpo: "on" } }, all: { x: { metadata: { financas_painel_limpo: "off" } } } })).toBe("on");
    expect(lerChaveRemotaPainel(undefined)).toBeNull();
    _zerarRemotaPainel();
    virarSite();
    expect(painelLimpoLigado()).toBe(false);
    expect(mostrarPainelLimpo(true)).toBe(false);
  });
  it("QA no navegador: ?painel-limpo=on mostra pra qualquer conta, off esconde, auto volta à regra; no app não existe", () => {
    virarSite();
    guardarForcaPainelDaUrl("?painel-limpo=on");
    expect(mostrarPainelLimpo(false)).toBe(true);
    guardarForcaPainelDaUrl("?painel-limpo=off");
    expect(mostrarPainelLimpo(true)).toBe(false);
    guardarForcaPainelDaUrl("?painel-limpo=auto");
    expect(localStorage.getItem(CHAVE_FORCA_PAINEL_LIMPO)).toBeNull();
    virarApp();
    registrarChavePainelLimpo({ current: { metadata: { financas_painel_limpo: "on" } }, all: {} });
    localStorage.setItem(CHAVE_FORCA_PAINEL_LIMPO, "off");
    expect(mostrarPainelLimpo(true)).toBe(true); // no app a força de QA não vale: segue a chave
  });
});

/* ───────────────────────── no módulo ───────────────────────── */
describe("pages/Index — cliente antigo fica com o painel de hoje", () => {
  it("mesmas seções, mesma ordem, sem 'Mais gráficos' — e nada gravado (nem na conta, nem no aparelho)", { timeout: 40_000 }, async () => {
    contaAntiga();
    const controle = montarIndex(MES_COM_DADO);
    await abrirDashboard();
    expect(secoesNaTela()).toEqual([
      "DESAFIO DA SEMANA", "Saldo do Mês", "ALERTAS INTELIGENTES", "GASTOS POR CATEGORIA", "RECEITAS VS DESPESAS", "EVOLUÇÃO DO PATRIMÔNIO",
      "PROGRESSO DO MÊS", "GASTO POR MÉTODO", "FIXOS VS VARIÁVEIS", "TOP 5 MAIORES GASTOS", "ÚLTIMAS TRANSAÇÕES", "PREVISÃO FIM DO MÊS",
      "QUANTO POSSO GASTAR HOJE", "COMPARAÇÃO MENSAL", "COMPARAÇÃO ANUAL",
    ]);
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
    expect(screen.queryByTestId("sobram-pra-hoje")).toBeNull(); // a linha "pra hoje" é só do painel limpo
    expect(controle.escritas().map((e) => e.k)).not.toContain(CHAVE_PAINEL_LIMPO);
    expect(Object.keys(localStorage).some((k) => k.startsWith(PREFIXO_PAINEL_LIMPO_APARELHO))).toBe(false);
  });
  it("com gasto HOJE: o QUANTO POSSO GASTAR HOJE do cliente antigo é o de sempre (sem a linha 'Sobram R$ X pra hoje')", { timeout: 40_000 }, async () => {
    contaAntiga();
    const comCafeHoje = [...(MES_COM_DADO["finance-expenses"] as unknown[]), { id: "e3", description: "Café", value: 12, date: "2026-10-16", category: "alimentacao", paymentMethod: "pix" }];
    montarIndex({ ...MES_COM_DADO, "finance-expenses": comCafeHoje });
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
    const card = screen.getByText("QUANTO POSSO GASTAR HOJE").closest("div.rounded-lg") as HTMLElement;
    expect(card).toBeTruthy();
    expect(screen.queryByTestId("sobram-pra-hoje")).toBeNull();
    expect(card.textContent).not.toMatch(/pra hoje|Sobram|já saiu/);
    expect(card.textContent).toMatch(/dias restantes no mês, contando hoje/);
  });
  it("mesmo com o Montar feito NO APARELHO por outra conta: o antigo continua igual", { timeout: 40_000 }, async () => {
    contaAntiga();
    localStorage.setItem(CHAVE_MONTAR_FINANCAS, JSON.stringify({ r: "pronto", em: "x" }));
    localStorage.setItem(`${PREFIXO_PAINEL_LIMPO_APARELHO}${OUTRA}`, "1");
    montarIndex(MES_COM_DADO);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
  });
});

describe("pages/Index — padrão da 1.0.16 (dono 17/10): conta nova TAMBÉM abre o Dashboard de sempre", () => {
  it("passou pelo Montar e abriu o Dashboard: sem painel limpo, sem 'Mais gráficos'", { timeout: 40_000 }, async () => {
    montarIndex({ ...MES_COM_DADO, [CHAVE_MONTAR_FINANCAS]: { r: "pronto", em: "x" } });
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /MAIS GRÁFICOS/ })).toBeNull();
  });
});

describe("pages/Index — conta nova abre com o painel limpo QUANDO a chave é ligada (metadata 'on')", () => {
  const NOVA = { ...MES_COM_DADO, [CHAVE_MONTAR_FINANCAS]: { r: "pronto", em: "x" } };
  beforeEach(() => {
    registrarChavePainelLimpo({ current: { metadata: { financas_painel_limpo: "on" } }, all: {} });
  });

  it("os mais usados no topo, Desafio à vista, o resto no 'Mais gráficos' (fechado); abrir manda o evento", { timeout: 40_000 }, async () => {
    const controle = montarIndex(NOVA);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
    expect(secoesNaTela()).toEqual(["QUANTO POSSO GASTAR HOJE", "ALERTAS INTELIGENTES", "MEU MÊS —", "GASTOS POR CATEGORIA", "DESAFIO DA SEMANA", "MAIS GRÁFICOS"]);
    expect(screen.queryByTestId("mais-graficos")).toBeNull();

    const botao = screen.getByRole("button", { name: /MAIS GRÁFICOS/ });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(botao);
    await respirar();
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(eventos.filter(([n]) => n === EV_MAIS_GRAFICOS)).toEqual([[EV_MAIS_GRAFICOS, {}]]);
    expect(secoesNaTela()).toEqual([
      "QUANTO POSSO GASTAR HOJE", "ALERTAS INTELIGENTES", "MEU MÊS —", "GASTOS POR CATEGORIA", "DESAFIO DA SEMANA", "MAIS GRÁFICOS",
      "Saldo do Mês", "RECEITAS VS DESPESAS", "PREVISÃO FIM DO MÊS", "EVOLUÇÃO DO PATRIMÔNIO", "PROGRESSO DO MÊS", "GASTO POR MÉTODO",
      "FIXOS VS VARIÁVEIS", "TOP 5 MAIORES GASTOS", "ÚLTIMAS TRANSAÇÕES", "COMPARAÇÃO MENSAL", "COMPARAÇÃO ANUAL",
    ]);
    fireEvent.click(botao); // fecha de novo
    expect(screen.queryByTestId("mais-graficos")).toBeNull();
    // lembrado: aparelho (desta conta) + conta, escrita de sistema
    expect(localStorage.getItem(CHAVE_APARELHO)).toBe("1");
    expect(controle.escritas().find((e) => e.k === CHAVE_PAINEL_LIMPO)).toEqual({ k: CHAVE_PAINEL_LIMPO, system: true });
  });

  it("com cartão: o TOTAL POR CARTÃO NO MÊS entra no topo, depois de Gastos por categoria", { timeout: 40_000 }, async () => {
    montarIndex({
      ...NOVA,
      "finance-fixed-expenses": [
        ...(MES_COM_DADO["finance-fixed-expenses"] as unknown[]),
        { id: "fx", description: "Fatura do cartão", category: "fatura_cartao", value: 800, paymentMethod: "credito", cardName: "nubank", faturaDoCartao: true },
      ],
      "finance-card-config": { nubank: { dueDay: 25, mesDoVencimento: true } },
    });
    await abrirDashboard();
    expect(secoesNaTela().slice(0, 6)).toEqual(["QUANTO POSSO GASTAR HOJE", "ALERTAS INTELIGENTES", "MEU MÊS —", "GASTOS POR CATEGORIA", "TOTAL POR CARTÃO NO MÊS", "DESAFIO DA SEMANA"]);
    const total = screen.getByTestId("total-por-cartao");
    expect(within(total).getByText("Fatura de outubro · vence dia 25")).toBeTruthy();
  });

  it("sem Montar nenhum (entrou em Finanças por curiosidade — o módulo não abre o quiz): decidido na 1ª abertura, e o limpo FICA depois do 1º lançamento", { timeout: 40_000 }, async () => {
    const controle = montarIndex({ "spotlight-done-financas": "true" });
    await respirar();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(localStorage.getItem(CHAVE_APARELHO)).toBe("1");
    expect(controle.escritas().find((e) => e.k === CHAVE_PAINEL_LIMPO)).toEqual({ k: CHAVE_PAINEL_LIMPO, system: true });
    cleanup();
    // dias depois, já com dado e fora das 48 h: continua limpo (decidido e lembrado)
    vi.setSystemTime(HOJE.getTime() + 5 * 24 * HORA);
    montarIndex(MES_COM_DADO);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
  });

  it("fez o Montar PELA MISSÃO e só abriu Finanças dias depois (já com dado, fora das 48 h): elegível pela marca da conta", { timeout: 40_000 }, async () => {
    vi.setSystemTime(HOJE.getTime() + 4 * 24 * HORA);
    montarIndex({ ...MES_COM_DADO, [CHAVE_MONTAR_FINANCAS]: { r: "pronto", em: new Date(HOJE).toISOString() } });
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
    expect(localStorage.getItem(CHAVE_APARELHO)).toBe("1");
  });

  it("conta criada desde o corte que lançou antes de abrir Finanças e passou das 48 h, sem Montar: painel de sempre (a regra não mudou)", { timeout: 40_000 }, async () => {
    vi.setSystemTime(HOJE.getTime() + 4 * 24 * HORA);
    montarIndex(MES_COM_DADO);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
    expect(localStorage.getItem(CHAVE_APARELHO)).toBeNull();
  });

  it("conta nova que pulou tudo (sem dado): o card do topo mostra o caminho, não 'você não pode gastar'", { timeout: 40_000 }, async () => {
    montarIndex({ "spotlight-done-financas": "true", [CHAVE_MONTAR_FINANCAS]: { r: "pulou", em: "x" } });
    await abrirDashboard();
    const vazio = screen.getByTestId("pode-gastar-vazio");
    expect(within(vazio).getByText(/aqui aparece quanto dá pra gastar por dia/)).toBeTruthy();
    expect(screen.queryByText(/Você não pode gastar/)).toBeNull();
    fireEvent.click(within(vazio).getByRole("button", { name: /Anotar minha renda/ }));
    await respirar();
    expect(screen.getByRole("button", { name: /MEU FINANCEIRO/ }).getAttribute("data-active")).toBe("true");
  });

  it("metadata 'off' no RevenueCat: painel de sempre — e religando, volta o limpo pra mesma conta", { timeout: 40_000 }, async () => {
    registrarChavePainelLimpo({ current: { metadata: { financas_painel_limpo: "off" } }, all: {} });
    montarIndex(NOVA);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
    expect(localStorage.getItem(CHAVE_APARELHO)).toBe("1"); // continua elegível
    cleanup();
    registrarChavePainelLimpo({ current: { metadata: { financas_painel_limpo: "on" } }, all: {} });
    montarIndex(NOVA);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
  });

  it("site: painel de sempre (chave web desligada)", { timeout: 40_000 }, async () => {
    virarSite();
    montarIndex(NOVA);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
  });

  it("fechar e abrir o app (dado da conta ainda chegando): já abre limpo; sair e entrar; outro aparelho; outra conta no mesmo celular não herda", { timeout: 40_000 }, async () => {
    const controle = montarIndex(NOVA);
    await abrirDashboard();
    const daConta = controle.dados()[CHAVE_PAINEL_LIMPO];
    expect(daConta).toEqual({ limpo: true, em: expect.any(String) });
    cleanup();

    // reabriu: a vassoura levou o cache da conta e o servidor ainda não respondeu
    montarIndex({}, { loaded: false });
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
    cleanup();

    // logout → login no mesmo aparelho
    purgeLocalUserCache();
    montarIndex(NOVA);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
    cleanup();

    // outro aparelho (nada no localStorage), conta antiga em idade mas que já foi marcada
    localStorage.clear();
    vi.setSystemTime(HOJE.getTime() + 10 * 24 * HORA);
    montarIndex({ ...MES_COM_DADO, [CHAVE_PAINEL_LIMPO]: daConta });
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeTruthy();
    cleanup();

    // outra pessoa entra neste celular (conta antiga): painel de sempre
    auth.user = { id: OUTRA.replace("outra", "antiga"), created_at: "2026-02-01T12:00:00Z" };
    montarIndex(MES_COM_DADO);
    await abrirDashboard();
    expect(document.querySelector('[data-painel="limpo"]')).toBeNull();
  });
});
