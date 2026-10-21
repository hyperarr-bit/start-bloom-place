/**
 * "VAMOS MONTAR SUAS FINANÇAS" — O 3º PASSO, CARTÃO DE CRÉDITO (1.0.16, 16/10). Conta VAZIA, sem seeds:
 *   · a conta da tela com a fatura é a do card "QUANTO POSSO GASTAR HOJE" (a fatura é mais um fixo);
 *   · grava nas estruturas DE CARTÃO do módulo: vencimento em `finance-card-config`, a fatura como
 *     custo fixo no crédito do cartão (marcado `faturaDoCartao`), "Cartão" personalizado sem banco,
 *     e — vencimento deste mês já passou — a de agora paga (`finance-faturas-pagas` + ✓ do fixo);
 *   · NÃO conta duas vezes: o chip "Cartão" saiu das contas fixas; a estimativa não vira conta
 *     própria no MEU MÊS (nem com "Dia"); compra anotada depois vai pra fatura seguinte;
 *   · o módulo mostra: linha "Fatura Nubank · R$ X" no MEU MÊS (com o valor no "a vencer"), TOTAL POR
 *     CARTÃO NO MÊS, ALERTAS INTELIGENTES "1 conta vence em N dias", e o aviso de véspera do celular
 *     (este mês e o seguinte);
 *   · o "paguei" é um só: a linha do MEU MÊS e o ✓ do custo fixo andam juntos;
 *   · dia 29–31 em mês curto, rascunho (fechar no meio e voltar), "Pular" e "Não uso cartão".
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-mfc", created_at: "" } as { id: string; created_at?: string } | null }));
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

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { computeDailyBudget } from "@/lib/finance-totals";
import { DEFAULT_CARDS } from "@/lib/finance-cards";
import { CHAVE_FATURAS_PAGAS, ehEstimativaDaFatura, faturasDoMes, injetarFaturas } from "@/lib/finance-faturas";
import { lerDadosDosLembretes } from "@/lib/reagendar";
import { planejarContas } from "@/lib/notificacoes";
import {
  BANCOS_DO_CARTAO, CHAVE_MONTAR_FINANCAS, CONTAS_SUGERIDAS, EV_PASSO, EV_PRONTO, EV_PULAR, _novaAberturaMontar, _zerarRemotaMontar,
  calcularMontar, cartaoCompleto, faturaJaVenceu, fixoDaFatura, lerRascunhoMontar, marcaDoAparelho,
} from "@/lib/montar-financas";
import { MontarFinancas, dicaDoVencimento } from "@/components/finance/montar/MontarFinancas";
import { TotalPorCartao } from "@/components/finance/TotalPorCartao";
import Index from "@/pages/Index";
import { instalarTecladoIphone } from "./helpers/teclado-iphone";

const UID = "u-mfc";
const HOJE = new Date(2026, 9, 16, 12, 0); // 16/10/2026 (sexta): faltam 16 dias contando hoje
const HORA = 3600e3;

const virarApp = () => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as any).Capacitor; };

type Controle = { dados: () => Record<string, unknown> };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: JSON.parse(JSON.stringify(v ?? null)) };
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: !auth.user, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const novoControle = (): Controle => ({ dados: () => ({}) });

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
const montarIndex = (inicial: Record<string, unknown>, controle = novoControle()) => {
  render(
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={inicial} controle={controle}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
const respirar = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tela = () => within(screen.getByTestId("montar-financas"));

/** Renda R$ 2 a 4 mil (3.000) → Aluguel 900 + Luz 150 → até a pergunta do cartão. */
const ateOCartao = () => {
  fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  fireEvent.click(tela().getByRole("button", { name: /Aluguel/ }));
  fireEvent.click(tela().getByRole("button", { name: /Luz/ }));
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  expect(tela().getByText("Usa cartão de crédito?")).toBeTruthy();
};
const responderCartao = ({ banco, valor, dia }: { banco?: string; valor?: string; dia?: number }) => {
  fireEvent.click(tela().getByRole("button", { name: /Uso cartão/ }));
  if (banco) fireEvent.click(tela().getByRole("button", { name: banco }));
  if (valor) fireEvent.change(tela().getByLabelText("Fatura deste mês em reais"), { target: { value: valor } });
  if (dia) fireEvent.click(tela().getByRole("button", { name: `Dia ${dia}` }));
};
const fixos = (d: Record<string, unknown>) => (d["finance-fixed-expenses"] ?? []) as any[];
const fatura = (d: Record<string, unknown>) => fixos(d).find((f) => f.faturaDoCartao);

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
  virarApp();
});
afterEach(() => {
  cleanup();
  virarSite();
  vi.useRealTimers();
});

/* ───────────────────────── a conta ───────────────────────── */
describe("a conta com a fatura", () => {
  const contas = [
    { id: "aluguel", nome: "Aluguel", emoji: "", valor: 900, categoria: "moradia" },
    { id: "luz", nome: "Luz", emoji: "", valor: 150, categoria: "contas_casa" },
  ];
  it("R$ 3.000 − contas R$ 1.050 − fatura R$ 800 em 16/10 = R$ 72 por dia — a MESMA conta do Dashboard com a fatura como fixo", () => {
    const r = calcularMontar(3000, contas, HOJE, { usa: true, banco: "nubank", valor: 800, dia: 25 });
    const painel = computeDailyBudget(3000, 1850, [], [{ id: "a", value: 900 }, { id: "l", value: 150 }, { id: "f", value: 800 }], HOJE);
    expect(r).toMatchObject({ fixos: 1050, fatura: 800, cartao: true, livre: 1150, dias: 16, porDia: Math.round(painel.perDay), semFolga: false });
    expect(r.porDia).toBe(72); // 1150 ÷ 16 = 71,875
  });
  it("sem cartão completo (não usa, sem valor ou sem dia) a fatura não entra", () => {
    for (const c of [{ usa: false, banco: null, valor: 800, dia: 10 }, { usa: true, banco: null, valor: 0, dia: 10 }, { usa: true, banco: null, valor: 800, dia: null }, { usa: null, banco: null, valor: 800, dia: 10 }]) {
      expect(cartaoCompleto(c)).toBe(false);
      expect(calcularMontar(3000, contas, HOJE, c)).toMatchObject({ fatura: 0, cartao: false, livre: 1950 });
    }
  });
  it("fatura que leva a renda toda: R$ 0 e sem folga", () => {
    expect(calcularMontar(1500, contas, HOJE, { usa: true, banco: null, valor: 600, dia: 5 })).toMatchObject({ porDia: 0, semFolga: true });
  });
  it("o chip '💳 Cartão' saiu das contas fixas (era a mesma fatura duas vezes)", () => {
    expect(CONTAS_SUGERIDAS.some((c) => c.id === "cartao" || c.categoria === "fatura_cartao")).toBe(false);
  });
  it("os bancos do chip são as bandeiras de sempre (mesmo value e nome — o dado já gravado continua resolvendo)", () => {
    for (const b of BANCOS_DO_CARTAO) expect(DEFAULT_CARDS.find((c) => c.value === b.value)?.label).toBe(b.label);
  });
  it("o custo fixo da fatura: crédito do cartão, Fatura Cartão, sem dia; já venceu este mês → carimbo de paga", () => {
    expect(fixoDaFatura({ usa: true, banco: "nubank", valor: 800, dia: 25 }, "nubank", HOJE)).toEqual({
      id: expect.stringMatching(/^mf-\d+-cartao$/), description: "Fatura do cartão", category: "fatura_cartao", value: 800,
      paymentMethod: "credito", cardName: "nubank", faturaDoCartao: true,
    });
    expect(fixoDaFatura({ usa: true, banco: "nubank", valor: 800, dia: 10 }, "nubank", HOJE).pagoEm).toBe("2026-10");
  });
});

describe("dia do vencimento: o que ele quer dizer neste mês", () => {
  it("passado, hoje, amanhã e daqui a uns dias", () => {
    expect(dicaDoVencimento(10, HOJE)).toBe("Já passou neste mês, então a de outubro entra como paga.");
    expect(dicaDoVencimento(16, HOJE)).toBe("Vence hoje.");
    expect(dicaDoVencimento(17, HOJE)).toBe("Vence amanhã.");
    expect(dicaDoVencimento(25, HOJE)).toBe("Faltam 9 dias. O CORE avisa quando estiver perto.");
  });
  it("dia 29–31 em mês curto vira o último dia do mês (como o MEU MÊS e o aviso de véspera)", () => {
    const novembro28 = new Date(2026, 10, 28, 12);
    expect(dicaDoVencimento(31, novembro28)).toBe("Este mês não tem dia 31: conta o dia 30. Faltam 2 dias. O CORE avisa quando estiver perto.");
    expect(faturaJaVenceu(31, new Date(2026, 10, 30, 12))).toBe(false); // vence HOJE (30), não "amanhã"
    expect(dicaDoVencimento(31, new Date(2026, 10, 30, 12))).toBe("Este mês não tem dia 31: conta o dia 30. Vence hoje.");
    const fevereiro27 = new Date(2027, 1, 27, 12);
    expect(dicaDoVencimento(30, fevereiro27)).toBe("Este mês não tem dia 30: conta o dia 28. Vence amanhã.");
  });
});

/* ───────────────────────── a tela ───────────────────────── */
describe("a pergunta do cartão, com a conta vazia", () => {
  it("Nubank, R$ 800, dia 25: resultado com a fatura, grava nas estruturas de cartão, 3 de 3, eventos sem reais", async () => {
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto });
    await respirar(); // a do módulo conta a vista na volta seguinte
    ateOCartao();
    expect(document.querySelectorAll(".mf-barra i[data-on]")).toHaveLength(3); // a 3ª pergunta (a barra; 1.0.17 sem o "3 de 3" escrito)
    responderCartao({ banco: "Nubank", valor: "800", dia: 25 });
    expect(tela().getByText("Faltam 9 dias. O CORE avisa quando estiver perto.")).toBeTruthy();
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    await respirar();

    fireEvent.click(screen.getByTestId("montar-ver-conta")); // 1.0.17: a conta fica fechada até ela abrir
    const linha = screen.getByTestId("montar-fatura");
    expect(linha.textContent).toContain("Fatura do Nubank");
    expect(linha.textContent).toContain("vence dia 25");
    expect(linha.textContent).toContain("R$ 800");
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 72");
    expect(screen.getByText("até o fim do mês.")).toBeTruthy();

    const d = controle.dados();
    expect(fatura(d)).toMatchObject({ description: "Fatura do cartão", value: 800, paymentMethod: "credito", cardName: "nubank", category: "fatura_cartao", faturaDoCartao: true });
    expect(fatura(d).day).toBeUndefined();
    expect(fatura(d).pagoEm).toBeUndefined();
    expect(fixos(d).map((f) => f.description)).toEqual(["Aluguel", "Luz", "Fatura do cartão"]);
    expect(d["finance-card-config"]).toEqual({ nubank: { dueDay: 25, mesDoVencimento: true } });
    expect(d[CHAVE_FATURAS_PAGAS]).toBeUndefined();
    expect(d["finance-custom-cards"]).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Ver minhas Finanças" }));
    expect(onPronto).toHaveBeenCalledWith({ contas: 2, porDia: 72, semFolga: false, cartao: true });
    expect(eventos.filter(([n]) => n === EV_PASSO).map(([, e]) => e.n)).toEqual([1, 2, 3, 4]);
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toEqual({ contas: 2, faixa: "2a4", sem_folga: false, apertado: false, origem: "modulo", cartao: true });
    for (const [, e] of eventos) expect(JSON.stringify(e)).not.toMatch(/800|nubank|"dia"/);
  });

  it("o botão só acende com valor E dia; 'Uso cartão' de novo não apaga o que foi respondido", () => {
    montarTela();
    ateOCartao();
    const cta = () => tela().getByRole("button", { name: "Ver quanto posso gastar" }) as HTMLButtonElement;
    expect(cta().disabled).toBe(true);
    responderCartao({ valor: "1.200" });
    expect((tela().getByLabelText("Fatura deste mês em reais") as HTMLInputElement).value).toBe("1.200");
    expect(cta().disabled).toBe(true);
    fireEvent.click(tela().getByRole("button", { name: "Dia 5" }));
    expect(cta().disabled).toBe(false);
    expect(tela().getByRole("button", { name: "Dia 5" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("vencimento deste mês já passou (dia 10): a de outubro entra PAGA — no '✓' do fixo e no 'paguei' da fatura", async () => {
    const controle = montarTela();
    ateOCartao();
    responderCartao({ banco: "Itaú", valor: "650", dia: 10 });
    expect(tela().getByText("Já passou neste mês, então a de outubro entra como paga.")).toBeTruthy();
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    await respirar();
    fireEvent.click(screen.getByTestId("montar-ver-conta"));
    expect(screen.getByTestId("montar-fatura").textContent).toContain("já paga");
    const d = controle.dados();
    expect(fatura(d)).toMatchObject({ cardName: "itau", value: 650, pagoEm: "2026-10" });
    expect(d[CHAVE_FATURAS_PAGAS]).toEqual({ "2026-10:itau": true });
    // ainda sai do mês: o dinheiro já saiu da renda de outubro
    expect(screen.getByTestId("montar-por-dia").textContent).toContain(`R$ ${Math.round((3000 - 1050 - 650) / 16)}`);
  });

  it("sem banco (ou 'Outro'): cartão personalizado 'Cartão' — e o mesmo, se já existir", async () => {
    let controle = montarTela();
    ateOCartao();
    responderCartao({ valor: "500", dia: 20 });
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    await respirar();
    let d = controle.dados();
    const criados = d["finance-custom-cards"] as { value: string; label: string }[];
    expect(criados).toHaveLength(1);
    expect(criados[0].label).toBe("Cartão");
    expect(fatura(d).cardName).toBe(criados[0].value);
    expect(d["finance-card-config"]).toEqual({ [criados[0].value]: { dueDay: 20, mesDoVencimento: true } });
    fireEvent.click(screen.getByTestId("montar-ver-conta"));
    expect(screen.getByTestId("montar-fatura").textContent).toContain("Fatura do cartão");
    cleanup();

    // outra conta vazia que já tinha um "Cartão" (e um Nubank com FECHAMENTO): reaproveita, e o fechamento fica
    localStorage.clear();
    _novaAberturaMontar();
    controle = montarTela({}, {
      "finance-custom-cards": [{ value: "k_meu", label: "Cartão", palette: 0 }],
      "finance-card-config": { nubank: { closingDay: 3, dueDay: 12 } },
    });
    ateOCartao();
    responderCartao({ banco: "Outro", valor: "300", dia: 8 });
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    await respirar();
    d = controle.dados();
    expect(d["finance-custom-cards"]).toEqual([{ value: "k_meu", label: "Cartão", palette: 0 }]); // nada criado
    expect(fatura(d).cardName).toBe("k_meu");
    expect(d["finance-card-config"]).toEqual({ nubank: { closingDay: 3, dueDay: 12 }, k_meu: { dueDay: 8, mesDoVencimento: true } });
  });

  it("cartão que já tinha FECHAMENTO: o fechamento fica, o vencimento muda e não liga o 'conta no mês do vencimento'", async () => {
    const controle = montarTela({}, { "finance-card-config": { nubank: { closingDay: 3, dueDay: 12 } } });
    ateOCartao();
    responderCartao({ banco: "Nubank", valor: "800", dia: 25 });
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    await respirar();
    expect(controle.dados()["finance-card-config"]).toEqual({ nubank: { closingDay: 3, dueDay: 25 } });
  });

  it("'Não uso cartão': 1 toque até o número, nada de cartão gravado", async () => {
    const controle = montarTela();
    ateOCartao();
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    const d = controle.dados();
    expect(fatura(d)).toBeUndefined();
    expect(d["finance-card-config"]).toBeUndefined();
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ cartao: false });
    expect(eventos.find(([n]) => n === EV_PRONTO)![1].cartao_pulou).toBeUndefined();
  });

  it("'Pular' na pergunta do cartão pula SÓ o cartão: renda e contas respondidas ficam (sem montar_financas_pular)", async () => {
    const onPular = vi.fn();
    const onPronto = vi.fn();
    const controle = montarTela({ onPular, onPronto });
    ateOCartao();
    responderCartao({ banco: "Nubank", valor: "800" }); // começou e desistiu
    fireEvent.click(tela().getByRole("button", { name: "Pular" }));
    await respirar();
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    const d = controle.dados();
    expect(d["finance-incomes"]).toEqual([expect.objectContaining({ value: 3000 })]);
    expect(fixos(d).map((f) => f.description)).toEqual(["Aluguel", "Luz"]);
    expect(d["finance-card-config"]).toBeUndefined();
    expect(eventos.some(([n]) => n === EV_PULAR)).toBe(false);
    expect(eventos.find(([n]) => n === EV_PRONTO)![1]).toMatchObject({ cartao: false, cartao_pulou: true });
    expect(marcaDoAparelho()?.r).toBe("pronto");
    expect(onPular).not.toHaveBeenCalled();
  });

  it("Voltar da pergunta do cartão guarda as contas; voltando, o cartão respondido continua lá", () => {
    montarTela();
    ateOCartao();
    responderCartao({ banco: "Inter", valor: "400", dia: 12 });
    fireEvent.click(tela().getByRole("button", { name: /Voltar/ }));
    expect(tela().getByRole("button", { name: /^🏠 Aluguel/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(tela().getByRole("button", { name: "Inter" }).getAttribute("aria-pressed")).toBe("true");
    expect((tela().getByLabelText("Fatura deste mês em reais") as HTMLInputElement).value).toBe("400");
    expect(tela().getByRole("button", { name: "Dia 12" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("fechou o app NA PERGUNTA DO CARTÃO: volta nela, com banco, valor e dia", () => {
    montarTela();
    ateOCartao();
    responderCartao({ banco: "Santander", valor: "950", dia: 3 });
    cleanup(); // fechou o app
    _novaAberturaMontar();
    montarTela();
    expect(tela().getByText("Usa cartão de crédito?")).toBeTruthy();
    expect(tela().getByRole("button", { name: /Uso cartão/ }).getAttribute("aria-pressed")).toBe("true");
    expect(tela().getByRole("button", { name: "Santander" }).getAttribute("aria-pressed")).toBe("true");
    expect((tela().getByLabelText("Fatura deste mês em reais") as HTMLInputElement).value).toBe("950");
    expect(tela().getByRole("button", { name: "Dia 3" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("rascunho de antes do passo do cartão com o chip '💳 Cartão': vira a resposta do cartão (e sai das contas)", () => {
    localStorage.setItem(CHAVE_MONTAR_FINANCAS, JSON.stringify({
      vistas: 1,
      rascunho: { etapa: "contas", faixa: "2a4", renda: 3000, contas: [{ id: "aluguel", nome: "Aluguel", emoji: "🏠", valor: 900, categoria: "moradia" }, { id: "cartao", nome: "Cartão", emoji: "💳", valor: 500, categoria: "fatura_cartao" }] },
    }));
    const r = lerRascunhoMontar()!;
    expect(r.contas.map((c) => c.id)).toEqual(["aluguel"]);
    expect(r.cartao).toEqual({ usa: true, banco: null, valor: 500, dia: null });
  });
});

/* ───────────────────────── teclado do iPhone ───────────────────────── */
describe("teclado aberto no iPhone (visualViewport encolhe)", () => {
  const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
  afterEach(() => {
    if (original) Object.defineProperty(window, "visualViewport", original);
    else delete (window as any).visualViewport;
    document.documentElement.removeAttribute("data-missao-doses-faixa");
  });
  const fingirTeclado = () => {
    const vv = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0, width: 390 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    return vv;
  };

  it("a folha passa a ocupar só a área visível (o campo e o botão acima do teclado) e volta quando o teclado fecha", async () => {
    const vv = fingirTeclado();
    montarTela();
    const folha = screen.getByTestId("montar-financas");
    expect(folha.hasAttribute("data-teclado")).toBe(false);
    vv.height = window.innerHeight - 330; // teclado abriu
    vv.offsetTop = 120; // o iOS empurrou a página pra cima
    vv.dispatchEvent(new Event("resize"));
    await respirar();
    expect(folha.hasAttribute("data-teclado")).toBe(true);
    expect(folha.style.top).toBe("120px");
    expect(folha.style.height).toBe(`${window.innerHeight - 330}px`);
    vv.height = window.innerHeight; // fechou
    vv.offsetTop = 0;
    vv.dispatchEvent(new Event("resize"));
    await respirar();
    expect(folha.hasAttribute("data-teclado")).toBe(false);
    expect(folha.style.top).toBe("");
    expect(folha.style.height).toBe("");
  });

  it("com a faixa da missão visível em cima, a folha começa embaixo dela", async () => {
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    document.documentElement.style.setProperty("--missao-doses-faixa-h", "44px");
    const vv = fingirTeclado();
    montarTela({ origem: "missao" });
    vv.height = window.innerHeight - 300;
    vv.offsetTop = 0;
    vv.dispatchEvent(new Event("resize"));
    await respirar();
    const folha = screen.getByTestId("montar-financas");
    expect(folha.style.top).toBe("44px");
    expect(folha.style.height).toBe(`${window.innerHeight - 300 - 44}px`);
    document.documentElement.style.removeProperty("--missao-doses-faixa-h");
  });
  it("1.0.17 — dia 1 SEM a faixa (atributo '0', altura 0): com o TECLADO DO iPHONE de verdade no campo da renda, a folha começa no topo da área visível (não 40 px abaixo, o `|| 40` de antes) e o botão fica acima do teclado", async () => {
    document.documentElement.setAttribute("data-missao-doses-faixa", "0");
    document.documentElement.style.setProperty("--missao-doses-faixa-h", "0px"); // o que o CSS faz com o atributo "0"
    const teclado = instalarTecladoIphone();
    try {
      montarTela({ origem: "missao" });
      const campo = screen.getByLabelText("Renda do mês em reais") as HTMLElement;
      teclado.abrir(campo, 0, 0);
      await respirar();
      const folha = screen.getByTestId("montar-financas");
      expect(folha.hasAttribute("data-teclado")).toBe(true);
      expect(folha.style.top).toBe("0px");
      expect(folha.style.height).toBe(`${teclado.altura}px`); // 844 − 336: a folha inteira acima do teclado
      teclado.soltarFoco();
      teclado.assentar();
      await respirar();
      expect(folha.hasAttribute("data-teclado")).toBe(false);
    } finally {
      teclado.desinstalar();
      document.documentElement.style.removeProperty("--missao-doses-faixa-h");
    }
  });
});

describe("1.0.17 — iPhone SE com o teclado de verdade no passo do cartão", () => {
  it("teclado na 'Fatura deste mês' (372 px visíveis): os dias de 'Vence todo dia' ficavam atrás do botão colado 'Ver quanto posso gastar' — o bloco do cartão sobe até terminar acima do rodapé, e o campo da fatura continua à vista", async () => {
    const teclado = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 295 });
    try {
      montarTela({ origem: "missao" });
      ateOCartao();
      responderCartao({ banco: "Nubank", valor: "850" });
      const corpo = screen.getByTestId("montar-financas").querySelector<HTMLElement>(".mf-corpo")!;
      corpo.style.overflowY = "auto"; // o CSS do .mf-corpo (o jsdom não carrega o .css)
      const rodape = screen.getByTestId("montar-financas").querySelector<HTMLElement>("[data-teclado-rodape]")!;
      const bloco = screen.getByTestId("montar-cartao");
      const campo = screen.getByLabelText("Fatura deste mês em reais") as HTMLElement;
      // as posições do print se1-fatura (com o cabeçalho escondido pelo teclado): o campo 180–220, o bloco até 340
      // (os dias terminam em 318), o rodapé colado em 296 (372 visíveis − 76 do botão)
      const r = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 375, width: 375, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
      const rects = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        const s = corpo.scrollTop;
        if (this === corpo) return r(0, 372);
        if (this === rodape) return r(296, 372);
        if (this === bloco) return r(30 - s, 340 - s);
        if (this === campo) return r(180 - s, 220 - s);
        return r(0, 0);
      });
      try {
        teclado.abrir(campo, 0, 0);
        await act(async () => { await new Promise((ok) => setTimeout(ok, 80)); });
        expect(screen.getByTestId("montar-financas").hasAttribute("data-teclado")).toBe(true);
        expect(bloco.getBoundingClientRect().bottom).toBeLessThanOrEqual(296); // os dias acima do botão
        expect(campo.getBoundingClientRect().top).toBeGreaterThanOrEqual(8); // o campo da fatura segue à vista
        expect(within(bloco).getByRole("button", { name: "Dia 1" })).toBeTruthy();
      } finally { rects.mockRestore(); }
    } finally { teclado.desinstalar(); }
  });
});

/* ───────────────────────── no módulo de verdade ───────────────────────── */
describe("pages/Index com a fatura do Montar (conta nova, app da loja)", () => {
  /** A tela da MISSÃO (a única porta desde 17/10) por cima de Finanças, com o cartão vencendo dia 19
   *  (daqui a 3 dias); "Continuar" fecha a tela e o módulo por baixo já adotou o dado. */
  const montarComCartao = async (dia = 19) => {
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
    expect(screen.getAllByTestId("montar-financas")).toHaveLength(1); // só a da missão: o módulo não abre a dele
    ateOCartao();
    responderCartao({ banco: "Nubank", valor: "800", dia });
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    await waitFor(() => expect(screen.getByTestId("montar-pronto")).toBeTruthy(), { timeout: 4000 });
    const numero = screen.getByTestId("montar-por-dia").textContent!.match(/R\$ ([\d.]+)/)![1];
    fireEvent.click(screen.getByRole("button", { name: "Continuar" })); // a tela do número pela missão: só o número
    fireEvent.click(screen.getByTestId("montar-ponte-ir")); // 1.0.17: a ponte pro 1º gasto
    await respirar();
    return { controle, numero };
  };
  const cardComTitulo = (titulo: RegExp) => screen.getByText(titulo).closest(".rounded-lg, .rounded-2xl") as HTMLElement;

  it("MEU FINANCEIRO: custo fixo, linha da fatura no MEU MÊS (valor no 'a vencer'), TOTAL POR CARTÃO com o vencimento", { timeout: 40_000 }, async () => {
    await montarComCartao();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.getAllByText("Fatura do cartão").length).toBeGreaterThan(0); // custos fixos
    const meuMes = document.querySelector('[data-missao="meu-mes"]') as HTMLElement;
    expect(within(meuMes).getByText("Fatura Nubank · R$ 800,00 vence em 3 dias")).toBeTruthy(); // aviso do cabeçalho
    expect(within(meuMes).getByText(/⏳ A vencer/).textContent).toMatch(/R\$\s?800/); // a estimativa no "a vencer" (sem ela: a média dos fixos)
    fireEvent.click(within(meuMes).getByRole("button", { name: "Dia 19" }));
    expect(within(meuMes).getByText("Fatura Nubank · R$ 800,00")).toBeTruthy();
    expect(within(meuMes).queryByText("Fatura do cartão")).toBeNull(); // a estimativa NÃO vira conta própria
    const total = screen.getByTestId("total-por-cartao");
    expect(within(total).getByText("Nubank")).toBeTruthy();
    expect(within(total).getByText("Fatura de outubro · vence dia 19")).toBeTruthy();
    expect(within(total).getAllByText("R$ 800,00").length).toBeGreaterThan(0);
    expect(within(total).queryByTestId("aviso-estimativa")).toBeNull();
  });

  it("DASHBOARD de sempre (painel limpo desligado na 1.0.16): o MESMO número do Montar e o alerta 'vence em 3 dias'", { timeout: 40_000 }, async () => {
    const { numero } = await montarComCartao();
    fireEvent.click(screen.getByRole("button", { name: /DASHBOARD/ }));
    await respirar();
    await screen.findByText(/QUANTO POSSO GASTAR HOJE/, {}, { timeout: 10_000 }); // a suíte carregada: o Dashboard pode demorar
    const pode = cardComTitulo(/QUANTO POSSO GASTAR HOJE/);
    expect(within(pode).getByTestId("pode-gastar-valor").textContent).toBe(`R$ ${numero}`);
    expect(within(pode).queryByTestId("sobram-pra-hoje")).toBeNull(); // a linha "Sobram R$ X pra hoje" era do painel limpo
    const alertas = cardComTitulo(/ALERTAS INTELIGENTES/);
    expect(within(alertas).getByText("1 conta vence em 3 dias: Fatura Nubank · R$ 800,00")).toBeTruthy();
  });

  it("o 'paguei' é um só: marcar a linha do MEU MÊS dá ✓ no custo fixo; desmarcar o ✓ do fixo reabre a fatura", { timeout: 40_000 }, async () => {
    const { controle } = await montarComCartao();
    const meuMes = document.querySelector('[data-missao="meu-mes"]') as HTMLElement;
    fireEvent.click(within(meuMes).getByRole("button", { name: "Dia 19" }));
    const linha = within(meuMes).getByText("Fatura Nubank · R$ 800,00").closest("label")!;
    fireEvent.click(within(linha).getByRole("checkbox"));
    await respirar();
    let d = controle.dados();
    expect(d[CHAVE_FATURAS_PAGAS]).toEqual({ "2026-10:nubank": true });
    expect(fatura(d).pagoEm).toBe("2026-10");
    expect(screen.getByRole("button", { name: "Desmarcar Fatura do cartão como paga" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Fatura do cartão como paga" }));
    await respirar();
    d = controle.dados();
    expect(fatura(d).pagoEm).toBeUndefined();
    expect(d[CHAVE_FATURAS_PAGAS]).toEqual({});
    // e de novo pelo ✓ do fixo: a fatura acompanha
    fireEvent.click(screen.getByRole("button", { name: "Marcar Fatura do cartão como paga" }));
    await respirar();
    expect(controle.dados()[CHAVE_FATURAS_PAGAS]).toEqual({ "2026-10:nubank": true });
  });

  it("pôr um 'Dia' na estimativa não cria a mesma fatura duas vezes no MEU MÊS", { timeout: 40_000 }, async () => {
    montarIndex({
      "finance-incomes": [{ id: "r", description: "Renda do mês", value: 3000, date: "2026-10-16" }],
      "finance-fixed-expenses": [{ id: "fx", description: "Fatura do cartão", category: "fatura_cartao", value: 800, paymentMethod: "credito", cardName: "nubank", faturaDoCartao: true, day: 19 }],
      "finance-card-config": { nubank: { dueDay: 19, mesDoVencimento: true } },
      [CHAVE_MONTAR_FINANCAS]: { r: "pronto" },
    });
    await respirar();
    fireEvent.click(screen.getByRole("button", { name: /MEU FINANCEIRO/ }));
    await respirar();
    const meuMes = document.querySelector('[data-missao="meu-mes"]') as HTMLElement;
    fireEvent.click(within(meuMes).getByRole("button", { name: "Dia 19" }));
    expect(within(meuMes).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(meuMes).getByText("Fatura Nubank · R$ 800,00")).toBeTruthy();
  });
});

/* ───────────────────────── o aviso do celular ───────────────────────── */
describe("o aviso de véspera (lembretes do celular) sai da mesma estrutura", () => {
  const dados = {
    "finance-fixed-expenses": [
      { id: "a", description: "Aluguel", category: "moradia", value: 900, paymentMethod: "boleto" },
      { id: "fx", description: "Fatura do cartão", category: "fatura_cartao", value: 800, paymentMethod: "credito", cardName: "nubank", faturaDoCartao: true },
    ],
    "finance-card-config": { nubank: { dueDay: 19, mesDoVencimento: true } },
  } as Record<string, unknown>;
  const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);

  it("véspera do dia 19 deste mês e do dia 19 do mês que vem (a fatura volta todo mês)", () => {
    const l = lerDadosDosLembretes(get);
    const avisos = planejarContas([{ ano: 2026, mes: 9, dueDays: l.dueDays as never }, { ano: 2026, mes: 10, dueDays: l.dueDaysProximoMes as never }], 9, HOJE);
    expect(avisos.map((a) => [a.quando.getDate(), a.quando.getMonth(), a.title, a.body])).toEqual([
      [18, 9, "1 conta vence amanhã", "Fatura Nubank — dia 19"],
      [18, 10, "1 conta vence amanhã", "Fatura Nubank — dia 19"],
    ]);
  });
  it("a de outubro paga: só a de novembro", () => {
    const pagos = { ...dados, [CHAVE_FATURAS_PAGAS]: { "2026-10:nubank": true } };
    const l = lerDadosDosLembretes(<T,>(k: string, f: T): T => (k in pagos ? (pagos[k] as T) : f));
    const avisos = planejarContas([{ ano: 2026, mes: 9, dueDays: l.dueDays as never }, { ano: 2026, mes: 10, dueDays: l.dueDaysProximoMes as never }], 9, HOJE);
    expect(avisos.map((a) => a.quando.getMonth())).toEqual([10]);
  });
});

/* ───────────────────────── TOTAL POR CARTÃO ───────────────────────── */
describe("TOTAL POR CARTÃO NO MÊS com a estimativa", () => {
  const ESTIMATIVA = { id: "fx", description: "Fatura do cartão", category: "fatura_cartao", value: 800, paymentMethod: "credito", cardName: "nubank", faturaDoCartao: true };
  const total = (props: Partial<React.ComponentProps<typeof TotalPorCartao>>, inicial: Record<string, unknown> = { "finance-card-config": { nubank: { dueDay: 20, mesDoVencimento: true } } }) => {
    render(<Provedor inicial={inicial} controle={novoControle()}><TotalPorCartao parcelas={[]} mes="2026-10" {...props} /></Provedor>);
  };
  it("a estimativa entra nos gastos do cartão; custo fixo comum no cartão continua fora (como sempre)", () => {
    total({ fixos: [ESTIMATIVA, { id: "n", description: "Netflix", value: 40, paymentMethod: "credito", cardName: "nubank" }] });
    const linha = screen.getByText("Nubank").closest("tr")!;
    expect(within(linha).getAllByText("R$ 800,00")).toHaveLength(2); // gastos e total — sem os R$ 40 da Netflix
    expect(screen.queryByTestId("aviso-estimativa")).toBeNull();
  });
  it("cliente sem estimativa: nada muda (fixo no cartão não entra, sem compra o card nem aparece)", () => {
    total({ fixos: [{ id: "n", description: "Netflix", value: 40, paymentMethod: "credito", cardName: "nubank" }] });
    expect(screen.queryByTestId("total-por-cartao")).toBeNull();
  });
  it("compra do mês passado que cai NESTA fatura + estimativa = aviso pra apagar a estimativa (senão conta duas vezes)", () => {
    total({ fixos: [ESTIMATIVA], variableExpensesAnterior: [{ id: "c", description: "Mercado", value: 120, date: "2026-09-20", paymentMethod: "credito", cardName: "nubank" }] });
    expect(screen.getByTestId("aviso-estimativa").textContent).toBe("Se você anota todas as compras do cartão Nubank aqui, apaga a “Fatura do cartão” dos custos fixos — senão a fatura conta duas vezes.");
  });
  it("compra de HOJE no mesmo cartão vai pra fatura do mês que vem: no mês do Montar, sem aviso", () => {
    total({ fixos: [ESTIMATIVA], variableExpenses: [{ id: "c", description: "Mercado", value: 120, date: "2026-10-16", paymentMethod: "credito", cardName: "nubank" }] });
    expect(screen.queryByTestId("aviso-estimativa")).toBeNull();
    const linha = screen.getByText("Nubank").closest("tr")!;
    expect(within(linha).getAllByText("R$ 800,00")).toHaveLength(2); // a compra de hoje não entra nesta fatura
  });
  it("parcela no cartão não dispara o aviso (conta no mês em que é lançada — avisaria cedo demais)", () => {
    total({ fixos: [ESTIMATIVA], parcelas: [{ id: "p", description: "Celular", totalValue: 1200, installmentValue: 100, paidInstallments: 0, totalInstallments: 12, cardName: "nubank", category: "eletronicos", date: "2026-10-10", startMonth: "2026-10", parcelaDoMes: 1 }] });
    expect(screen.queryByTestId("aviso-estimativa")).toBeNull();
  });
  it("cartão 'Cartão' (sem banco): o aviso diz 'do cartão', sem repetir", () => {
    total(
      { fixos: [{ ...ESTIMATIVA, cardName: "k_meu" }], variableExpensesAnterior: [{ id: "c", description: "Farmácia", value: 50, date: "2026-09-25", paymentMethod: "credito", cardName: "k_meu" }] },
      { "finance-custom-cards": [{ value: "k_meu", label: "Cartão", palette: 0 }], "finance-card-config": { k_meu: { dueDay: 8, mesDoVencimento: true } } },
    );
    expect(screen.getByTestId("aviso-estimativa").textContent).toMatch(/^Se você anota todas as compras do cartão aqui,/);
  });
});

/* ───────────────────────── a estrutura ───────────────────────── */
describe("lib/finance-faturas com a estimativa", () => {
  it("a estimativa entra no valor da linha (o 'a vencer'); fixo comum no cartão continua como sempre", () => {
    const base = { mes: "2026-10", variaveis: [], variaveisAnterior: [], parcelas: [], cards: [], configOf: (c: string) => (c === "nubank" ? { dueDay: 19 } : undefined), labelOf: () => "Nubank", pagas: {} };
    const so = faturasDoMes({ ...base, fixos: [{ paymentMethod: "credito", cardName: "nubank", value: 800, faturaDoCartao: true }] });
    expect(so).toEqual([expect.objectContaining({ total: 800, fixos: 800, estimativa: 800 })]);
    expect(injetarFaturas([], so)[0].bills[0]).toMatchObject({ id: "fatura:nubank", value: 800 });
    const comum = faturasDoMes({ ...base, fixos: [{ paymentMethod: "credito", cardName: "nubank", value: 40 }] });
    expect(comum[0]).not.toHaveProperty("estimativa");
    expect(injetarFaturas([], comum)[0].bills[0].value).toBe(0); // exatamente como antes
  });
  it("só conta como estimativa o fixo marcado, no crédito, com cartão", () => {
    expect(ehEstimativaDaFatura({ faturaDoCartao: true, paymentMethod: "credito", cardName: "nubank" })).toBe(true);
    expect(ehEstimativaDaFatura({ faturaDoCartao: true, paymentMethod: "boleto", cardName: "nubank" })).toBe(false);
    expect(ehEstimativaDaFatura({ faturaDoCartao: true, paymentMethod: "credito" })).toBe(false);
    expect(ehEstimativaDaFatura({ paymentMethod: "credito", cardName: "nubank" })).toBe(false);
  });
});
