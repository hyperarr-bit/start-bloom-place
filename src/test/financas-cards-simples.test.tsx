/**
 * CARDS SIMPLES do Dashboard de Finanças (desenho 17/10, lib/financas-cards-simples) — o que este arquivo trava:
 *   · PADRÃO = HOJE: sem a força de QA, o DOM dos dois cards (QUANTO POSSO GASTAR HOJE e PREVISÃO FIM DO MÊS) e a
 *     ordem (previsão antes) são exatamente os de antes — nenhum marcador do desenho novo aparece;
 *   · COM A FORÇA: os NÚMEROS são os mesmos (R$ 123 por dia, sobram R$ 111, +R$ 1.828), o card de gastar sobe pra
 *     antes da previsão, a conta fica atrás de "Como chegamos nesse número" / "Ver a conta", "Disponível livre" só
 *     com conta reservada, nada de "contas pagas", e o caso "falta" fica vermelho com a conta certa;
 *   · a chave: constante desligada; `?cards-simples=on|off|auto` só é lido fora do app; a força guardada vale.
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: { id: "u-cs", created_at: "2026-03-02T15:00:00Z" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
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
import { Dashboard } from "@/components/Dashboard";
import {
  CARDS_SIMPLES, CHAVE_FORCA_CARDS_SIMPLES, EV_CARD_CONTA_ABRIR, _zerarBuscaCards, cardsSimplesLigados, guardarForcaCardsDaUrl,
} from "@/lib/financas-cards-simples";

const HOJE = new Date(2026, 9, 17, 10, 0); // 17/10: 15 dias contando hoje, 14 pela frente

const Provedor = ({ children }: { children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>({});
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => setStore((prev) => ({ ...prev, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

/** A conta da Marina (prints): renda 3.000, Aluguel 900 + Luz 150 + Internet 100, um café de R$ 12 hoje. */
const FIXOS = [
  { id: "f1", description: "Aluguel", category: "moradia", value: 900, paymentMethod: "boleto", day: 5 },
  { id: "f2", description: "Luz", category: "contas_casa", value: 150, paymentMethod: "boleto", day: 10 },
  { id: "f3", description: "Internet", category: "internet_telefone", value: 100, paymentMethod: "boleto", day: 15 },
];
const CAFE = { id: "e1", description: "Café", category: "alimentacao", value: 12, date: "2026-10-17" };
const props = (extra: Partial<React.ComponentProps<typeof Dashboard>> = {}): React.ComponentProps<typeof Dashboard> => ({
  totalIncome: 3000, totalExpenses: 1162, totalDebts: 0, totalInvestments: 0, expenses: [CAFE], fixedExpenses: FIXOS, dueDays: [],
  savingsRate: 0, incomes: [{ id: "i1", description: "Renda do mês", value: 3000, date: "2026-10-17" }], gastoDeHoje: 12, ...extra,
});
const montar = (extra: Partial<React.ComponentProps<typeof Dashboard>> = {}) =>
  render(<MemoryRouter><Provedor><Dashboard {...props(extra)} /></Provedor></MemoryRouter>);
/** O texto como se lê na tela: elementos irmãos separados por espaço (textContent cola "Entra" em "R$ 3.000" dentro do
 *  flex), nós de texto colados como estão ("+" + "R$ " + "1.828" = "+R$ 1.828"). */
const texto = (el: Element | null) => {
  const rec = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
    let s = "";
    n.childNodes.forEach((c) => { s += c.nodeType === Node.ELEMENT_NODE ? ` ${rec(c)} ` : rec(c); });
    return s;
  };
  return el ? rec(el).replace(/\s+/g, " ").trim() : "";
};
const corpo = () => texto(document.body);
const antesDe = (a: string, b: string) => { const t = corpo(); expect(t.indexOf(a)).toBeGreaterThanOrEqual(0); expect(t.indexOf(b)).toBeGreaterThanOrEqual(0); expect(t.indexOf(a)).toBeLessThan(t.indexOf(b)); };
const ligar = () => localStorage.setItem(CHAVE_FORCA_CARDS_SIMPLES, "on");
const virarApp = () => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as any).Capacitor; };

beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = () => {};
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
  _zerarBuscaCards();
  virarSite();
});
afterEach(() => { cleanup(); virarSite(); vi.useRealTimers(); });

describe("padrão = hoje (a chave desligada)", () => {
  it("a constante nasce desligada e o Dashboard não muda nada: cards de sempre, previsão ANTES do gastar", () => {
    expect(CARDS_SIMPLES).toBe("off");
    expect(cardsSimplesLigados()).toBe(false);
    montar();
    expect(document.querySelector('[data-testid="pode-gastar-simples"]')).toBeNull();
    expect(document.querySelector('[data-testid="previsao-simples"]')).toBeNull();
    const t = corpo();
    for (const s of ["Saldo atual", "Disponível livre", "÷ 15 dias", "= R$ 123/dia", "Receita total", "Já gasto (fixos + variáveis)", "Projeção variável (14d × R$ 1)", "Saldo projetado", "já saiu R$ 12 dos R$ 123 do dia", "15 dias restantes no mês, contando hoje"]) {
      expect(t).toContain(s);
    }
    antesDe("PREVISÃO FIM DO MÊS", "QUANTO POSSO GASTAR HOJE");
  });
  it("com a força 'off' guardada o DOM é byte a byte o mesmo do padrão", () => {
    const { container, unmount } = montar();
    const padrao = container.innerHTML;
    unmount();
    localStorage.setItem(CHAVE_FORCA_CARDS_SIMPLES, "off");
    const { container: c2 } = montar();
    expect(c2.innerHTML).toBe(padrao);
  });
});

describe("com a força: as mesmas contas, apresentação simples", () => {
  it("QUANTO POSSO GASTAR HOJE sobe pra antes da previsão; herói 'R$ 123 por dia', 'Sobram R$ 111 pra hoje' com a barrinha, '15 dias até o fim do mês'", () => {
    ligar();
    montar();
    const card = document.querySelector('[data-testid="pode-gastar-simples"]')!;
    expect(card).not.toBeNull();
    expect(card.getAttribute("data-spotlight")).toBe("pode-gastar"); // a âncora da missão continua
    expect(card.getAttribute("data-missao")).toBe("posso-gastar");
    antesDe("QUANTO POSSO GASTAR HOJE", "PREVISÃO DO FIM DO MÊS");
    expect(texto(card.querySelector('[data-testid="pode-gastar-valor"]'))).toBe("R$ 123");
    expect(texto(card.querySelector('[data-testid="sobram-pra-hoje"]'))).toBe("Sobram R$ 111 pra hoje");
    const barra = card.querySelector('[data-testid="sobram-pra-hoje-barra"]')!;
    expect(barra.getAttribute("aria-valuenow")).toBe("10"); // 12 de 123
    expect(barra.getAttribute("aria-label")).toBe("Já saiu R$ 12 dos R$ 123 do dia");
    expect(texto(card)).toContain("15 dias até o fim do mês");
    // a conta escondida; sem conta reservada não existe "Disponível livre"
    expect(card.querySelector('[data-testid="pode-gastar-conta"]')).toBeNull();
    expect(texto(card)).not.toContain("Saldo atual");
    fireEvent.click(card.querySelector('[data-testid="pode-gastar-ver-conta"]')!);
    expect(texto(card.querySelector('[data-testid="pode-gastar-conta"]'))).toBe("Entra R$ 3.000 Sai −R$ 1.162 Livre = R$ 1.838 ÷ 15 dias = R$ 123 por dia");
    expect(texto(card)).not.toContain("Disponível livre");
    expect(eventos).toContainEqual([EV_CARD_CONTA_ABRIR, { card: "pode_gastar" }]);
  });
  it("sem gasto hoje: sem a linha e sem a barrinha (como no card de sempre)", () => {
    ligar();
    montar({ gastoDeHoje: 0, expenses: [], totalExpenses: 1150 });
    const card = document.querySelector('[data-testid="pode-gastar-simples"]')!;
    expect(card.querySelector('[data-testid="sobram-pra-hoje"]')).toBeNull();
    expect(texto(card.querySelector('[data-testid="pode-gastar-valor"]'))).toBe("R$ 123");
  });
  it("'Disponível livre' só quando há conta reservada (avulsa sem valor)", () => {
    ligar();
    montar({ dueDays: [{ day: 25, bills: [{ id: "b1", name: "Seguro", paid: false }] }] });
    const card = document.querySelector('[data-testid="pode-gastar-simples"]')!;
    fireEvent.click(card.querySelector('[data-testid="pode-gastar-ver-conta"]')!);
    // reserva = média dos fixos (1.150 / 3 = 383) → 1.838 − 383 = 1.455 ÷ 15 = 97
    expect(texto(card.querySelector('[data-testid="pode-gastar-conta"]'))).toBe("Entra R$ 3.000 Sai −R$ 1.162 Saldo = R$ 1.838 Contas sem valor (reserva) −R$ 383 Disponível livre = R$ 1.455 ÷ 15 dias = R$ 97 por dia");
    expect(texto(card.querySelector('[data-testid="pode-gastar-valor"]'))).toBe("R$ 97");
  });
  it("PREVISÃO vira a frase 'sobra R$ 1.828 no fim do mês' + ritmo; 'Ver a conta' com rótulos simples, sem explicação cinza e sem 'contas pagas'", () => {
    ligar();
    montar();
    const card = document.querySelector('[data-testid="previsao-simples"]')!;
    expect(texto(card.querySelector('[data-testid="previsao-frase"]'))).toBe("Se continuar assim, sobra R$ 1.828 no fim do mês");
    expect(texto(card)).toContain("no seu ritmo de R$ 1 por dia");
    expect(card.className).toContain("green");
    expect(card.querySelector('[data-testid="previsao-conta"]')).toBeNull();
    fireEvent.click(card.querySelector('[data-testid="previsao-ver-conta"]')!);
    expect(texto(card.querySelector('[data-testid="previsao-conta"]'))).toBe("Entrou R$ 3.000 Já saiu −R$ 1.162 Gastos até o fim do mês (estimativa) −R$ 10 Sobra no fim do mês +R$ 1.828");
    expect(texto(card)).not.toMatch(/contas pagas|Receita total|Saldo projetado|Projeção variável/);
    expect(eventos).toContainEqual([EV_CARD_CONTA_ABRIR, { card: "previsao" }]);
  });
  it("caso 'falta' (conserto do carro de R$ 1.500 no dia 10): vermelho, 'falta R$ 907', ritmo R$ 89, conta com 'Falta no fim do mês'", () => {
    ligar();
    montar({ totalExpenses: 2662, expenses: [CAFE, { id: "e2", description: "Conserto do carro", category: "transporte", value: 1500, date: "2026-10-10" }] });
    const card = document.querySelector('[data-testid="previsao-simples"]')!;
    expect(texto(card.querySelector('[data-testid="previsao-frase"]'))).toBe("Se continuar assim, falta R$ 907 no fim do mês");
    expect(texto(card)).toContain("no seu ritmo de R$ 89 por dia");
    expect(card.className).toContain("red");
    fireEvent.click(card.querySelector('[data-testid="previsao-ver-conta"]')!);
    expect(texto(card.querySelector('[data-testid="previsao-conta"]'))).toBe("Entrou R$ 3.000 Já saiu −R$ 2.662 Gastos até o fim do mês (estimativa) −R$ 1.245 Falta no fim do mês −R$ 907");
    // e o gastar fica em alerta, com a mesma conta de sempre (338 ÷ 15 = 23)
    const gastar = document.querySelector('[data-testid="pode-gastar-simples"]')!;
    expect(texto(gastar.querySelector('[data-testid="pode-gastar-valor"]'))).toBe("R$ 23");
    expect(texto(gastar)).toContain("Atenção: ritmo de gastos acima do ideal");
  });
  it("os números do simples são os do card de sempre (mesma conta)", () => {
    const { unmount } = montar();
    const valorSempre = texto(document.querySelector('[data-testid="pode-gastar-valor"]'));
    const sobraSempre = texto(document.querySelector('[data-testid="sobram-pra-hoje"] .font-semibold'));
    const temPrevisaoSempre = corpo().includes("+R$ 1.828");
    unmount();
    ligar();
    montar();
    expect(texto(document.querySelector('[data-testid="pode-gastar-valor"]'))).toBe(valorSempre);
    expect(texto(document.querySelector('[data-testid="sobram-pra-hoje"]'))).toBe(sobraSempre);
    expect(temPrevisaoSempre).toBe(true);
    expect(texto(document.querySelector('[data-testid="previsao-frase"]'))).toContain("R$ 1.828");
  });
});

describe("a chave", () => {
  it("?cards-simples=on|off|auto só é lido fora do app; a força guardada vale em qualquer shell", () => {
    guardarForcaCardsDaUrl("?cards-simples=on");
    expect(localStorage.getItem(CHAVE_FORCA_CARDS_SIMPLES)).toBe("on");
    expect(cardsSimplesLigados()).toBe(true);
    virarApp();
    expect(cardsSimplesLigados()).toBe(true); // o harness de prints finge o iPhone e liga por aqui
    guardarForcaCardsDaUrl("?cards-simples=auto"); // no app a URL é ignorada
    expect(localStorage.getItem(CHAVE_FORCA_CARDS_SIMPLES)).toBe("on");
    virarSite();
    guardarForcaCardsDaUrl("?cards-simples=auto");
    expect(localStorage.getItem(CHAVE_FORCA_CARDS_SIMPLES)).toBeNull();
    expect(cardsSimplesLigados()).toBe(false);
    guardarForcaCardsDaUrl("?cards-simples=off");
    expect(cardsSimplesLigados()).toBe(false);
  });
  it("o Dashboard lê a URL uma vez ao montar (só navegador)", () => {
    window.history.replaceState({}, "", "/financas?cards-simples=on");
    montar();
    expect(document.querySelector('[data-testid="pode-gastar-simples"]')).not.toBeNull();
    window.history.replaceState({}, "", "/");
  });
});
