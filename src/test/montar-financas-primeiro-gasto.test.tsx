/**
 * O PASSO 1 DE FINANÇAS DA MISSÃO (17/10, revisão do dono no Simulador: "quando mostra o 'quanto posso gastar hoje'
 * ele deveria ser o foco, só que ele é dividido pelo 'já gastou alguma coisa hoje?'. Isso deveria aparecer no
 * tutorial em si, não no montar o plano"). Conta VAZIA, Dashboard de sempre (painel limpo DESLIGADO):
 *   · a tela do número (o Montar pela missão) é SÓ o número: "VOCÊ PODE GASTAR HOJE / R$ X por dia" (sobe de 0 em
 *     ~0,6 s; direto pra quem pediu menos movimento), a linha curta, A CONTA DO SEU MÊS e "Continuar" — nada de
 *     post-it, chips, "Ainda não gastei" nem "✓ Já está tudo nas suas Finanças";
 *   · "Continuar" leva pro TUTORIAL no formulário de verdade de Finanças (aba MEU FINANCEIRO): a faixa da missão,
 *     o anel no "+ Novo gasto", o post-it "Já gastou com alguma coisa hoje?" com Café · Uber · Almoço · ✎ escrever o
 *     meu e "Ainda não gastei nada hoje →"; 1 toque = o gasto DE VERDADE na lista;
 *   · depois do toque, UM balão no MEU MÊS: o "Saiu" do mês somou e "Hoje ainda dá pra gastar R$ X" — o MESMO número
 *     do card QUANTO POSSO GASTAR HOJE do Dashboard; "Ainda não gastei nada hoje" grava o dia sem gasto (o mesmo
 *     registro da Home) e o balão só com o número → a festa; os dois braços;
 *   · fechar o app: no "Montando…" (número ainda não visto) volta NO NÚMERO; depois de ver o número, volta no
 *     TUTORIAL (o Montar nunca se repete, o gasto nunca se perde);
 *   · eventos `missao_doses_primeiro_gasto` (resultado → continuar → tutorial → chip/nao_gastei → gasto → olha), sem
 *     valor em reais.
 */
process.env.TZ = "America/Sao_Paulo";

import fs from "node:fs";
import path from "node:path";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-pg", created_at: "" } as { id: string; created_at?: string; user_metadata?: Record<string, unknown> } | null }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {
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
// a missão por cima de Finanças (o fluxo inteiro): nada de avaliação nem notificação de verdade
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: vi.fn(async () => true) }));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu"),
  agendarProximaDose: vi.fn(async () => ({ ok: true, quando: new Date() })),
  estadoPermissao: vi.fn(async () => "granted"),
  armarLembreteDoTesteSePuder: vi.fn(async () => {}),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import {
  CHAVE_MONTAR_FINANCAS, EV_PRIMEIRO_GASTO, _novaAberturaMontar, _zerarRemotaMontar, _zerarResultadoVisto, calcularMontar,
  deveMostrarMontarFinancas, lerTelaDoNumero, marcaDoAparelho,
  exemploDaPonte, EVENTO_MONTAR_FINANCAS_FIM,
} from "@/lib/montar-financas";
import { MontarFinancas, SUBIDA_DO_NUMERO_MS, LINHA_DA_CONTA_MS, CONTA_SAI_MS, PONTE_CENA_MS, type ResumoMontar } from "@/components/finance/montar/MontarFinancas";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { fraseDoFeito, porDiaNaTela, rotuloDoNumero } from "@/components/missao-doses/PassoDoDia";
import { GUARDA_DE_TOQUE_MS } from "@/hooks/use-guarda-de-toque";
import { CHAVE_ESTADO_MISSAO_DOSES, definirDonoDaMissao, donoDaConta, iniciarMissao, lerMissao } from "@/lib/missao-doses";
import { CHAVE_BRACO_DIA1, _zerarUmPorDiaRemoto, registrarUmPorDiaRemoto } from "@/lib/dia1-cheio";
import { CHAVE_SEM_GASTO } from "@/lib/acao-do-dia";
import { porDiaExato } from "@/lib/lembrete-dia2";
import { PAINEL_LIMPO } from "@/lib/financas-painel-limpo";
import Index from "@/pages/Index";

const UID = "u-pg";
const HOJE = new Date(2026, 9, 16, 12, 0); // 16/10/2026: 16 dias contando hoje
const HORA = 3600e3;
const CRIADA = new Date(HOJE.getTime() - 2 * HORA).toISOString();

type ComCapacitor = { Capacitor?: unknown };
const virarApp = () => { (window as unknown as ComCapacitor).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const virarSite = () => { delete (window as unknown as ComCapacitor).Capacitor; };

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
/** Os eventos do passo 1, sem o envelope da missão (eventoDaMissao: protótipo, plataforma, versão, braço). */
const doPasso1 = () => eventos.filter(([n]) => n === EV_PRIMEIRO_GASTO).map(([, e]) => {
  const { prototipo: _p, plataforma: _pl, versao: _v, variante: _b, braco: _br, missao_id: _id, missao_1_por_dia: _m, dia_cal: _d, ...resto } = e;
  return resto;
});
/** O texto como se lê (o "R$" vai preso ao número por um espaço que não quebra: \u00a0). */
const lido = (el: Element) => (el.textContent ?? "").replace(/\u00a0/g, " ");
const comMenosMovimento = ((q: string) => ({ matches: /prefers-reduced-motion: reduce/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
const semMenosMovimento = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  window.scrollBy = (() => {}) as typeof window.scrollBy;
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
  // "menos movimento": o número aparece na hora (a animação não depende da velocidade da máquina)
  window.matchMedia = comMenosMovimento;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
  localStorage.clear();
  eventos.length = 0;
  _zerarRemotaMontar();
  _novaAberturaMontar();
  _zerarResultadoVisto();
  auth.user = { id: UID, created_at: CRIADA, user_metadata: {} };
  virarApp();
});
afterEach(() => {
  cleanup();
  virarSite();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/* ───────────────────────── a tela do número ───────────────────────── */

describe("a tela do número pela missão: SÓ o número (o 1º gasto é o tutorial, depois)", () => {
  it("o número de herói, a linha curta, A CONTA DO SEU MÊS e 'Continuar' — nada de post-it, chips, 'Ainda não gastei' nem '✓ Já está tudo…'", async () => {
    expect(PAINEL_LIMPO).toBe("off"); // o Dashboard de sempre (dono, 17/10)
    montarTela();
    await ateONumero();
    const numero = screen.getByTestId("montar-por-dia");
    expect(numero.getAttribute("data-valor")).toBe("66");
    expect(numero.querySelector(".sr-only")!.textContent).toBe("R$ 66 por dia"); // o leitor de tela lê o número final
    expect(lido(numero)).toContain("R$ 66por dia");
    expect(screen.getByTestId("montar-pronto").hasAttribute("data-heroi")).toBe(true);
    expect(tela().getByText("até o fim do mês.")).toBeTruthy();
    // 1.0.17 (dono: "joga informação na cara"): a conta do mês fica FECHADA — "Ver a conta" abre
    expect(tela().queryByText("Livre pro mês")).toBeNull();
    fireEvent.click(screen.getByTestId("montar-ver-conta"));
    expect(tela().getByText("Livre pro mês")).toBeTruthy();
    // o 1º gasto saiu daqui
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(screen.queryByText("Já gastou com alguma coisa hoje?")).toBeNull();
    expect(screen.queryByText(/Ainda não gastei/)).toBeNull();
    expect(screen.queryByText(/Café/)).toBeNull();
    expect(screen.queryByText(/Já está tudo nas suas Finanças/)).toBeNull();
    expect(tela().getByRole("button", { name: "Continuar" })).toBeTruthy();
    // o evento do passo 1 começa aqui (o mesmo envelope dos outros eventos da missão)
    expect(doPasso1()).toEqual([expect.objectContaining({ acao: "resultado", ms: 0 })]);
    expect(eventos.find(([n]) => n === EV_PRIMEIRO_GASTO)![1]).toMatchObject({ prototipo: "app", plataforma: "ios", versao: "dev" });
  });

  it("a tela do MÓDULO (desligada, mas o código fica): sem post-it também, com o '✓ Já está tudo…' e 'Ver minhas Finanças'; nenhum evento do passo 1", async () => {
    montarTela({ origem: "modulo" });
    await respirar();
    await ateONumero();
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(screen.getByTestId("montar-pronto").hasAttribute("data-heroi")).toBe(false);
    expect(screen.getByText(/Já está nas suas Finanças/)).toBeTruthy();
    expect(tela().getByRole("button", { name: "Ver minhas Finanças" })).toBeTruthy();
    expect(doPasso1()).toEqual([]);
  });

  it("'Continuar' → a PONTE (1.0.17): 'Você já viu quanto pode gastar hoje' / 'Agora vamos anotar seu primeiro gasto' com o número; 'Ir pro app' chama onPronto UMA vez (toque duplo) e sem primeiroGasto; nada gravado em gastos; eventos sem reais", async () => {
    const onPronto = vi.fn();
    const naoGastei = vi.fn();
    const controle = montarTela({ onPronto, onAindaNaoGastei: naoGastei });
    await ateONumero();
    vi.setSystemTime(HOJE.getTime() + 2500); // 2,5 s olhando o número
    const cta = tela().getByRole("button", { name: "Continuar" });
    fireEvent.click(cta);
    fireEvent.click(cta);
    expect(onPronto).not.toHaveBeenCalled();
    // 1.0.17 (ponte "versão 1"): sem ponto final; a cena = o número dela → ☕ Café − R$ 12 → ~~R$ 66~~ R$ 54 hoje
    expect(lido(screen.getByTestId("montar-ponte-viu"))).toBe("Você já viu quanto pode gastar hoje");
    expect(lido(screen.getByTestId("montar-ponte-titulo"))).toBe("Agora vamos anotar seu primeiro gasto");
    expect(lido(screen.getByTestId("montar-ponte-numero"))).toBe("R$ 66 por dia");
    expect(screen.getByTestId("montar-ponte-nao-gastei")).toHaveTextContent("Ainda não gastei");
    vi.setSystemTime(HOJE.getTime() + 4000);
    const ir = screen.getByTestId("montar-ponte-ir");
    expect(ir).toHaveTextContent("Ir pro app");
    fireEvent.click(ir);
    fireEvent.click(ir);
    expect(onPronto).toHaveBeenCalledTimes(1);
    expect(naoGastei).not.toHaveBeenCalled();
    const r = onPronto.mock.calls[0][0] as ResumoMontar;
    expect(r).toEqual({ contas: 3, porDia: 66, semFolga: false, cartao: true });
    expect("primeiroGasto" in r).toBe(false);
    expect(controle.dados()["finance-expenses"]).toBeUndefined();
    expect(doPasso1()).toEqual([expect.objectContaining({ acao: "resultado" }), { acao: "continuar", ms: 2500 }, { acao: "ponte", ms: 2500 }, { acao: "ponte_saiu", via: "ir_pro_app", ms: 4000 }]);
    for (const [, e] of eventos) expect(JSON.stringify(e)).not.toMatch(/3000|1050|800|66/);
  });

  it("a ponte: 'Ainda não gastei' chama onAindaNaoGastei (não o onPronto), uma vez; a ponte não volta mais", async () => {
    const onPronto = vi.fn();
    const naoGastei = vi.fn();
    montarTela({ onPronto, onAindaNaoGastei: naoGastei });
    await ateONumero();
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(lerTelaDoNumero(CRIADA, HOJE)?.ponte).toBe(true); // fechar o app aqui volta NA ponte
    fireEvent.click(screen.getByTestId("montar-ponte-nao-gastei"));
    fireEvent.click(screen.getByTestId("montar-ponte-nao-gastei"));
    expect(naoGastei).toHaveBeenCalledTimes(1);
    expect(naoGastei).toHaveBeenCalledWith({ contas: 3, porDia: 66, semFolga: false, cartao: true });
    expect(onPronto).not.toHaveBeenCalled();
    expect(doPasso1().at(-1)).toMatchObject({ acao: "ponte_saiu", via: "ainda_nao" });
    expect(lerTelaDoNumero(CRIADA, HOJE)).toBeNull();
  });

  /* 1.0.17 — a ponte "versão 1" (mockup ponte2, aprovado pelo dono 20/10) */
  const cenaDaPonte = () => {
    const numero = screen.queryByTestId("montar-ponte-numero");
    const hoje = screen.queryByTestId("montar-ponte-hoje");
    return {
      viu: lido(screen.getByTestId("montar-ponte-viu")),
      titulo: lido(screen.getByTestId("montar-ponte-titulo")),
      numero: numero ? lido(numero) : null,
      gasto: lido(screen.getByTestId("montar-ponte-gasto")),
      riscado: hoje ? lido(hoje.querySelector("s")!) : null,
      hoje: hoje ? lido(hoje.querySelector("b")!) : null,
      folga: screen.queryByTestId("montar-ponte-folga") ? lido(screen.getByTestId("montar-ponte-folga")) : null,
    };
  };
  it("a ponte normal: a cena ligada por tracejado — 'R$ X por dia' → '☕ Café − R$ 12' → '~~R$ X~~ R$ X−12 hoje', com o MESMO número da tela anterior; nada de ponto final; botões embaixo", async () => {
    montarTela();
    await ateONumero();
    const doNumero = Number(screen.getByTestId("montar-por-dia").getAttribute("data-valor"));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    const c = cenaDaPonte();
    expect(c).toEqual({
      viu: "Você já viu quanto pode gastar hoje", titulo: "Agora vamos anotar seu primeiro gasto",
      numero: `R$ ${doNumero} por dia`, gasto: "☕ Café− R$ 12", riscado: `R$ ${doNumero}`, hoje: `R$ ${doNumero - 12}`, folga: null,
    });
    expect(doNumero).toBe(66);
    expect(screen.getByTestId("montar-ponte-hoje")).toHaveAttribute("data-valor", "54");
    expect(screen.getByTestId("montar-ponte-hoje").querySelector(".sr-only")!.textContent).toBe("R$\u00a054 hoje");
    for (const t of [c.viu, c.titulo]) expect(t).not.toMatch(/\.\s*$/);
    expect(screen.getByTestId("montar-ponte-cena").querySelectorAll(".mf-ponte-linha")).toHaveLength(2);
    expect(screen.getByTestId("montar-ponte-ir")).toHaveTextContent("Ir pro app");
    expect(screen.getByTestId("montar-ponte-nao-gastei")).toHaveTextContent("Ainda não gastei");
  });
  it("a ponte com pouca folga (R$ 15–23 por dia): o café de exemplo é R$ 6 — a conta nunca dá zero nem negativo", async () => {
    expect(exemploDaPonte(66)).toEqual({ gasto: 12, depois: 54 });
    expect(exemploDaPonte(24)).toEqual({ gasto: 12, depois: 12 });
    expect(exemploDaPonte(23)).toEqual({ gasto: 6, depois: 17 });
    expect(exemploDaPonte(15)).toEqual({ gasto: 6, depois: 9 });
    montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "1300" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ }));
    fireEvent.change(tela().getByLabelText("Valor de Aluguel"), { target: { value: "1000" } }); // 300 ÷ 16 = 19
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    const doNumero = Number(screen.getByTestId("montar-por-dia").getAttribute("data-valor"));
    expect(doNumero).toBeGreaterThanOrEqual(15);
    expect(doNumero).toBeLessThan(24);
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    const c = cenaDaPonte();
    expect(c.gasto).toBe("☕ Café− R$ 6");
    expect(c.riscado).toBe(`R$ ${doNumero}`);
    expect(c.hoje).toBe(`R$ ${doNumero - 6}`);
    expect(doNumero - 6).toBeGreaterThan(0);
  });
  it("a ponte do mês apertado: 'Você já viu como tá seu mês' + o café → tracejado → '🔍 anotar mostra onde tem folga' (sem número nenhum)", async () => {
    montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "1000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ }));
    fireEvent.click(tela().getByRole("button", { name: /^🏋️ Academia/ })); // → 0 livre
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("montar-ponte")).toHaveAttribute("data-apertado");
    expect(cenaDaPonte()).toEqual({
      viu: "Você já viu como tá seu mês", titulo: "Agora vamos anotar seu primeiro gasto",
      numero: null, gasto: "☕ Café− R$ 12", riscado: null, hoje: null, folga: "🔍anotar mostra onde tem folga",
    });
    expect(screen.getByTestId("montar-ponte-cena").querySelectorAll(".mf-ponte-linha")).toHaveLength(1);
    expect(lido(screen.getByTestId("montar-ponte"))).not.toMatch(/R\$ 0/);
  });
  it("a ponte anima peça por peça (atrasos em ordem, o número de hoje CONTA pra baixo); com 'menos movimento' tudo parado no estado final", async () => {
    window.matchMedia = semMenosMovimento;
    montarTela();
    await ateONumero();
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    const cena = screen.getByTestId("montar-ponte-cena");
    expect(cena).not.toHaveAttribute("data-parado");
    const atrasos = Array.from(cena.children).map((el) => parseInt((el as HTMLElement).style.animationDelay || "0", 10));
    expect(atrasos).toEqual([0, PONTE_CENA_MS.linha1, PONTE_CENA_MS.cafe, PONTE_CENA_MS.linha2, PONTE_CENA_MS.hoje]);
    expect(lido(screen.getByTestId("montar-ponte-hoje").querySelector("b")!)).toBe("R$ 66"); // começa no antigo
    await act(async () => { await new Promise((r) => setTimeout(r, PONTE_CENA_MS.conta + PONTE_CENA_MS.contaDura + 200)); });
    expect(lido(screen.getByTestId("montar-ponte-hoje").querySelector("b")!)).toBe("R$ 54"); // contou até o novo
    cleanup();
    window.matchMedia = comMenosMovimento;
    localStorage.clear();
    _novaAberturaMontar();
    _zerarResultadoVisto();
    montarTela();
    await ateONumero();
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    const parada = screen.getByTestId("montar-ponte-cena");
    expect(parada).toHaveAttribute("data-parado");
    expect(Array.from(parada.children).every((el) => !(el as HTMLElement).style.animationDelay)).toBe(true);
    expect(lido(screen.getByTestId("montar-ponte-hoje").querySelector("b")!)).toBe("R$ 54"); // já no final
    const css = fs.readFileSync(path.resolve(__dirname, "../components/finance/montar/montar-financas.css"), "utf8");
    expect(css).toMatch(/\.mf-ponte-cena:not\(\[data-parado\]\) > \.mf-ponte-cafe \{ animation: mf-ponte-cai/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.mf-ponte-cena > \*/);
  });

  it("o número SOBE de 0 até o 'por dia' (~0,6 s) quando a tela aparece — digitar a renda não roda quadro a quadro; com 'menos movimento', direto", async () => {
    window.matchMedia = semMenosMovimento;
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const quadros = () => raf.mock.calls.filter(([cb]) => (cb as { name?: string }).name === "passo").length;
    montarTela();
    for (const v of ["2", "25", "250", "2500", "3000"]) fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: v } });
    await respirar();
    expect(quadros()).toBe(0); // o "por dia" muda a cada tecla, mas fora da tela do número nada anima
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar(2);
    const visivel = () => lido(screen.getByTestId("montar-por-dia").querySelector("[aria-hidden]")!);
    expect(quadros()).toBeGreaterThan(0);
    expect(Number(visivel().replace(/\D/g, ""))).toBeLessThan(188); // começou de baixo (3.000 ÷ 16 = 188)
    expect(screen.getByTestId("montar-por-dia").querySelector(".sr-only")!.textContent).toBe("R$ 188 por dia"); // o leitor de tela: o final
    // 1.0.17: vindo da conta linha por linha, o número espera a conta sumir (CONTA_SAI_MS) e então sobe
    await act(async () => { await new Promise((r) => setTimeout(r, CONTA_SAI_MS + SUBIDA_DO_NUMERO_MS + 250)); });
    expect(visivel()).toBe("R$ 188");
    cleanup();
    // menos movimento: o número final na hora, sem quadro a quadro
    window.matchMedia = comMenosMovimento;
    raf.mockClear();
    localStorage.clear();
    _novaAberturaMontar();
    montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "3000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar(2);
    expect(visivel()).toBe("R$ 188");
    expect(quadros()).toBe(0);
  });

  /* 1.0.17 (dono 20/10, mockups b2 e c1) */
  it("o cartão de contexto: 'Tutorial · Finanças · 3 perguntas' SÓ na 1ª pergunta e SÓ pela missão (sem toque a mais); nas outras, só a barra", () => {
    montarTela();
    expect(screen.getByTestId("montar-contexto")).toHaveTextContent("Tutorial · Finanças · 3 perguntas");
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Quais contas você paga todo mês?")).toBeTruthy();
    expect(screen.queryByTestId("montar-contexto")).toBeNull();
    cleanup();
    localStorage.clear();
    _novaAberturaMontar();
    montarTela({ origem: "modulo" });
    expect(screen.queryByTestId("montar-contexto")).toBeNull();
  });

  it("no lugar do 'Calculando…' (bola girando): a conta DELA entra linha por linha — Entra no mês → Contas fixas (N) → a fatura (com cartão), 250 ms entre elas; o tempo do 'Montando' é o de sempre; com 'menos movimento', paradas", () => {
    window.matchMedia = semMenosMovimento;
    montarTela({ esperaMs: 60_000 });
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    for (const c of [/^🏠 Aluguel/, /^💡 Luz/]) fireEvent.click(tela().getByRole("button", { name: c }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /Uso cartão/ }));
    fireEvent.click(tela().getByRole("button", { name: "Nubank" }));
    fireEvent.change(tela().getByLabelText("Fatura deste mês em reais"), { target: { value: "600" } });
    fireEvent.click(tela().getByRole("button", { name: "Dia 20" }));
    fireEvent.click(tela().getByRole("button", { name: "Ver quanto posso gastar" }));
    const montando = screen.getByTestId("montar-montando");
    expect(screen.queryByText("Calculando…")).toBeNull();
    expect(montando.querySelector(".mf-orbe")).toBeNull();
    const linhas = Array.from(montando.querySelectorAll<HTMLElement>("[data-entra]"));
    expect(linhas.map((l) => lido(l))).toEqual(["Entra no mêsR$ 3.000", "Contas fixas (2)− R$ 1.050", "Fatura do Nubank− R$ 600"]);
    expect(linhas.map((l) => l.style.animationDelay)).toEqual(["0ms", `${LINHA_DA_CONTA_MS}ms`, `${2 * LINHA_DA_CONTA_MS}ms`]);
    expect(LINHA_DA_CONTA_MS).toBe(250);
    cleanup();
    // menos movimento: as mesmas linhas, sem atraso nenhum (e o CSS tira a animação delas)
    window.matchMedia = comMenosMovimento;
    localStorage.clear();
    _novaAberturaMontar();
    montarTela({ esperaMs: 60_000 });
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "3000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    const paradas = Array.from(screen.getByTestId("montar-montando").querySelectorAll<HTMLElement>("[data-entra]"));
    expect(paradas.map((l) => lido(l))).toEqual(["Entra no mêsR$ 3.000", "Contas fixas (0)− R$ 0"]);
    expect(paradas.every((l) => !l.style.animationDelay)).toBe(true);
    const css = fs.readFileSync(path.resolve(__dirname, "../components/finance/montar/montar-financas.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.mf-conta\[data-entra\]\s*\{\s*animation:\s*none/);
  });

  it("a conta → o número na MESMA tela (sem deslizar): o número só começa a subir depois de a conta sumir", async () => {
    window.matchMedia = semMenosMovimento;
    montarTela({ esperaMs: 0 });
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "3000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar(2);
    const pronto = screen.getByTestId("montar-pronto");
    expect(pronto.hasAttribute("data-de-montando")).toBe(true); // entra parado (sem o "sobe" da tela)
    const visivel = () => lido(screen.getByTestId("montar-por-dia").querySelector("[aria-hidden]")!);
    expect(visivel()).toBe("R$ 0"); // ainda esperando a conta sumir
    await act(async () => { await new Promise((r) => setTimeout(r, CONTA_SAI_MS + SUBIDA_DO_NUMERO_MS + 250)); });
    expect(visivel()).toBe("R$ 188");
  });

  /* 1.0.17: 18% terminavam com "Você pode gastar R$ 0" como herói — o mês apertado troca o herói pelo acolhimento
     e o número vai pra conta do mês ("Ver a conta" → "Por dia"). */
  it("sem folga no mês: 'Seu mês tá apertado' no lugar do R$ 0 gigante; o número fica na conta do mês; 'Continuar' (nada anima)", async () => {
    montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "1000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ })); // 900
    fireEvent.click(tela().getByRole("button", { name: /^🏋️ Academia/ })); // 100 → 0 livre
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    expect(screen.queryByTestId("montar-por-dia")).toBeNull();
    expect(screen.getByTestId("montar-apertado").textContent).toMatch(/Seu mês tá apertado\s*Vamos achar folga juntos/);
    expect(screen.getByTestId("montar-apertado").querySelector("h2")!.textContent).toBe("Seu mês tá apertado"); // 1.0.17: título sem ponto final
    expect(screen.queryByText(/VOCÊ PODE GASTAR HOJE/)).toBeNull();
    // 1.0.17 (p2): a conta do mês fica fechada; o número do mês apertado mora nela
    expect(screen.queryByTestId("montar-por-dia-apertado")).toBeNull();
    fireEvent.click(screen.getByTestId("montar-ver-conta"));
    expect(screen.getByTestId("montar-por-dia-apertado").textContent).toMatch(/Por dia\s*R\$\s*0/);
    expect(tela().getByRole("button", { name: "Continuar" })).toBeTruthy();
    expect(eventos.find(([n]) => n === "montar_financas_pronto")?.[1]).toMatchObject({ sem_folga: true, apertado: true });
  });

  it("folga pequena (< R$ 15/dia): também 'apertado', com o '÷ N dias' na conta; folga normal segue com o número herói", async () => {
    montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "1100" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ })); // 900
    fireEvent.click(tela().getByRole("button", { name: /^🏋️ Academia/ })); // 100 → ~100 livre no mês
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    expect(screen.getByTestId("montar-apertado")).toBeTruthy();
    expect(screen.queryByTestId("montar-por-dia")).toBeNull();
    fireEvent.click(screen.getByTestId("montar-ver-conta"));
    expect(screen.getByText(/÷ \d+ dias/)).toBeTruthy();
  });
});

describe("1.0.17 — toque duplo nos 'Continuar' do Montar não pula passo", () => {
  afterEach(() => { (globalThis as { __CORE_GUARDA_TOQUE_MS?: number }).__CORE_GUARDA_TOQUE_MS = 0; });
  const esperar = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  const etapa = () => screen.getByTestId("montar-financas").getAttribute("data-etapa");
  it("renda → 2 cliques no 'Continuar': o 2º cairia no 'Não tenho conta fixa' (mesmo lugar) e pularia as contas — fica nas contas; número → 2 cliques: o 2º cairia no 'Ir pro app' — fica na ponte", async () => {
    (globalThis as { __CORE_GUARDA_TOQUE_MS?: number }).__CORE_GUARDA_TOQUE_MS = GUARDA_DE_TOQUE_MS;
    const onPronto = vi.fn();
    montarTela({ onPronto });
    await esperar(GUARDA_DE_TOQUE_MS + 80); // a tela acabou de abrir
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(etapa()).toBe("contas");
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" })); // o 2º toque
    expect(etapa()).toBe("contas");
    await esperar(GUARDA_DE_TOQUE_MS + 80);
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(etapa()).toBe("cartao");
    fireEvent.click(tela().getByRole("button", { name: "Pular" })); // o 2º toque cairia no "Pular" do cartão
    expect(etapa()).toBe("cartao");
    await esperar(GUARDA_DE_TOQUE_MS + 80);
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    expect(etapa()).toBe("pronto");
    await esperar(GUARDA_DE_TOQUE_MS + 80);
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(etapa()).toBe("ponte");
    fireEvent.click(screen.getByTestId("montar-ponte-ir")); // o 2º toque
    expect(onPronto).not.toHaveBeenCalled();
    expect(etapa()).toBe("ponte");
    await esperar(GUARDA_DE_TOQUE_MS + 80);
    fireEvent.click(screen.getByTestId("montar-ponte-ir"));
    expect(onPronto).toHaveBeenCalledTimes(1);
  });
  it("a guarda é por TEMPO (nunca espera animação): sem requestAnimationFrame nenhum, o botão volta a valer sozinho", async () => {
    (globalThis as { __CORE_GUARDA_TOQUE_MS?: number }).__CORE_GUARDA_TOQUE_MS = GUARDA_DE_TOQUE_MS;
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0); // nenhum quadro roda
    montarTela();
    await esperar(GUARDA_DE_TOQUE_MS + 80);
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    await esperar(GUARDA_DE_TOQUE_MS + 80);
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    expect(etapa()).toBe("cartao");
    raf.mockRestore();
  });
});

describe("1.0.17 — trocar de passo com o teclado aberto", () => {
  it("o 'Continuar' com o campo da renda focado solta o campo ANTES de trocar o passo (nada de campo focado sumindo do DOM); o fundo da folha continua atrás do teclado", () => {
    montarTela();
    const renda = tela().getByLabelText("Renda do mês em reais") as HTMLInputElement;
    renda.focus();
    fireEvent.change(renda, { target: { value: "3000" } });
    expect(document.activeElement).toBe(renda);
    const blur = vi.fn();
    renda.addEventListener("blur", blur);
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    expect(blur).toHaveBeenCalled();
    expect(screen.getByTestId("montar-financas")).toHaveAttribute("data-etapa", "contas");
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
    const css = fs.readFileSync(path.resolve(__dirname, "../components/finance/montar/montar-financas.css"), "utf8");
    expect(css).toMatch(/\.mf\[data-teclado\]::after \{ content: ""; position: absolute;[^}]*top: 100%;[^}]*background: hsl\(var\(--background\)\)/);
  });
});

describe("1.0.17 — o número do dia 1 é UM só (número, ponte, festa)", () => {
  it("R$ 103,6 por dia: o rótulo da missão, a festa e a ponte dizem R$ 104 (nada de Math.floor de um lado e Math.round do outro)", () => {
    expect(porDiaNaTela(103.6)).toBe(104);
    expect(rotuloDoNumero(103.6, 3)).toBe("Pode gastar R$ 104 por dia");
    expect(fraseDoFeito("financas", rotuloDoNumero(103.6, 3))).toBe("R$ 104 por dia, já nas suas Finanças.");
    expect(fraseDoFeito("financas", rotuloDoNumero(103.6, 3), 103.6)).toBe("R$ 104 por dia, já nas suas Finanças.");
    expect(exemploDaPonte(porDiaNaTela(103.6))).toEqual({ gasto: 12, depois: 92 });
    expect(rotuloDoNumero(0, 2)).toBe("Renda e 2 contas do mês");
    expect(rotuloDoNumero(0.4, 1)).toBe("Renda e 1 conta do mês");
  });
  it("o EVENTO_MONTAR_FINANCAS_FIM leva o número que a tela mostra (o rótulo do dia gravado no 'Montando' usa ESTE)", async () => {
    const recebidos: Array<Record<string, unknown>> = [];
    const ouvir = (e: Event) => recebidos.push((e as CustomEvent).detail);
    window.addEventListener(EVENTO_MONTAR_FINANCAS_FIM, ouvir);
    try {
      montarTela();
      await ateONumero();
    } finally {
      window.removeEventListener(EVENTO_MONTAR_FINANCAS_FIM, ouvir);
    }
    const doNumero = Number(screen.getByTestId("montar-por-dia").getAttribute("data-valor"));
    expect(recebidos.find((d) => d.resultado === "pronto")).toMatchObject({ resultado: "pronto", porDia: doNumero });
  });
});

describe("fechar o app: o número que ainda não apareceu volta; o que apareceu, não (B11)", () => {
  it("morreu no 'Montando…' (já gravou, o número ainda não apareceu) → reabre DIRETO no número; aí o número foi visto e não volta mais", async () => {
    const controle = montarTela({ esperaMs: 60_000 });
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    expect(screen.getByTestId("montar-montando")).toBeTruthy();
    expect(marcaDoAparelho()?.r).toBe("pronto"); // o Montar já decidiu (e gravou) na entrada do "Montando…"
    const dados = controle.dados();
    cleanup();
    _novaAberturaMontar();
    eventos.length = 0;
    const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
    expect(lerTelaDoNumero(CRIADA, HOJE)).not.toBeNull();
    expect(deveMostrarMontarFinancas({ criadoEm: CRIADA, get, isGuest: false })).toBe(true);
    montarTela({}, dados);
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 188"); // 3.000 ÷ 16
    expect(doPasso1()).toEqual([expect.objectContaining({ acao: "resultado", retomou: true })]);
    // APARECEU: é tela de uma vez — a marca agora aponta pra PONTE (1.0.17): reabrir volta na ponte, nunca no número
    expect(lerTelaDoNumero(CRIADA, HOJE)?.ponte).toBe(true);
    cleanup();
    _novaAberturaMontar();
    eventos.length = 0;
    montarTela({}, dados);
    expect(screen.queryByTestId("montar-pronto")).toBeNull();
    expect(screen.getByTestId("montar-ponte")).toBeTruthy();
    expect(doPasso1()).toEqual([expect.objectContaining({ acao: "ponte", retomou: true })]);
    // saiu da ponte: a marca some — reabrir agora é o tutorial do 1º gasto (a missão retoma o passo do gasto)
    fireEvent.click(screen.getByTestId("montar-ponte-ir"));
    expect(lerTelaDoNumero(CRIADA, HOJE)).toBeNull();
    expect(deveMostrarMontarFinancas({ criadoEm: CRIADA, get, isGuest: false })).toBe(false);
  });

  it("fechou NA tela do número (já vista): o número não volta — reabre na PONTE (1.0.17), só no mesmo dia; e a marca da conta nunca levou a tela do número", async () => {
    const controle = montarTela();
    await ateONumero();
    const dados = controle.dados();
    const daConta = dados[CHAVE_MONTAR_FINANCAS] as { r?: string; numero?: unknown } | undefined;
    expect(daConta?.r).toBe("pronto");
    expect(daConta?.numero).toBeUndefined();
    cleanup();
    _novaAberturaMontar();
    expect(lerTelaDoNumero(CRIADA, HOJE)?.ponte).toBe(true);
    expect(lerTelaDoNumero(CRIADA, new Date(HOJE.getTime() + 24 * HORA))).toBeNull(); // outro dia: nada
    montarTela({}, dados);
    expect(screen.queryByTestId("montar-pronto")).toBeNull();
    expect(screen.getByTestId("montar-ponte")).toBeTruthy();
  });

  it("morreu no 'Montando…': no dia seguinte ou em OUTRA conta deste celular, o número não volta (a outra pessoa começa do começo)", () => {
    montarTela({ esperaMs: 60_000 });
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    cleanup();
    _novaAberturaMontar();
    expect(lerTelaDoNumero(CRIADA, HOJE)).not.toBeNull();
    expect(lerTelaDoNumero("2026-10-16T09:00:00.000Z", HOJE)).toBeNull(); // outra conta neste celular
    expect(lerTelaDoNumero(CRIADA, new Date(HOJE.getTime() + 24 * HORA))).toBeNull(); // outro dia
  });
});

/* ───────────────────────── o fluxo inteiro, no Finanças de verdade ───────────────────────── */

/** O relógio anda E os microtasks rodam: o aviso de escrita pro módulo aberto (avisarEscritaDeFora) sai num microtask —
 *  sem isso o Finanças de verdade nunca adotava a renda do Montar nem o gasto do chip. */
const avancar = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const ate = async (cond: () => boolean, maxMs = 8000) => { for (let t = 0; t < maxMs && !cond(); t += 100) await avancar(100); return cond(); };
const tocar = async (el: Element) => { fireEvent.click(el); await avancar(0); };
/** A missão do braço A (ou B) nascida hoje, com as boas-vindas vistas — a 1ª dose é Finanças (área dinheiro). */
const missao = (braco: "A" | "B") => {
  vi.stubEnv("VITE_V14_LOJA", "1");
  registrarUmPorDiaRemoto({ current: { metadata: { missao_1_por_dia: braco === "A" ? "on" : "ab" } }, all: {} });
  if (braco === "B") localStorage.setItem(CHAVE_BRACO_DIA1, "B");
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-16", undefined, braco), boasVindas: true, dono: donoDaConta(UID) }));
};
/** A missão por cima do Finanças DE VERDADE (pages/Index, o Dashboard de sempre). */
const montarAppEmFinancas = (inicial: Record<string, unknown> = {}, controle = novoControle()) => {
  render(
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={inicial} controle={controle}>
        <MissaoDosesNaWeb />
        <Routes><Route path="/financas" element={<Index />} /><Route path="*" element={<p data-testid="outra-rota" />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return controle;
};
/** Renda R$ 3.000 · Aluguel + Luz + Internet (1.150) · sem cartão → o número; devolve o "por dia" da tela. */
const responderOMontar = async () => {
  const mf = () => within(screen.getByTestId("montar-financas"));
  fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
  fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
  for (const c of [/Aluguel/, /Luz/, /Internet/]) fireEvent.click(mf().getByRole("button", { name: c }));
  fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
  await tocar(mf().getByRole("button", { name: "Não uso cartão" })); // grava renda e contas (o módulo aberto adota)
};
const numeroDoMontar = () => Number(screen.getByTestId("montar-por-dia").getAttribute("data-valor"));
const postItDoTutorial = () => screen.queryAllByTestId("demo-guia-postit").at(-1) ?? null;
/** O card QUANTO POSSO GASTAR HOJE do Dashboard de sempre (a aba DASHBOARD do módulo de verdade): o número grande e a
 *  linha discreta "Sobram R$ X pra hoje" (17/10, opção 3: só com gasto HOJE; sem gasto, `linha` = null). */
const cardDoDashboard = async () => {
  await tocar(screen.getByRole("button", { name: /DASHBOARD/ }));
  await avancar(300);
  const linha = screen.queryByTestId("sobram-pra-hoje");
  return {
    numero: Number((screen.getByTestId("pode-gastar-valor").textContent ?? "").replace(/\D/g, "")),
    // 17/10: no card simples (lib/financas-cards-simples) a frase e o detalhe são elementos irmãos (barrinha no meio)
    linha: linha ? [linha.querySelector(".font-semibold"), linha.querySelector('[data-testid="sobram-pra-hoje-detalhe"]')].map((e) => lido(e!)).join(" ") : null,
  };
};
const linhaEsperada = (sobra: number, gasto: number, doDia: number) => `Sobram R$ ${sobra} pra hoje já saiu R$ ${gasto} dos R$ ${doDia} do dia`;

describe("o fluxo inteiro no Finanças de verdade: número → tutorial no formulário → 1 toque → o balão do MEU MÊS → a festa", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(HOJE);
    definirDonoDaMissao(null);
    _zerarUmPorDiaRemoto();
    // os pedaços de tela todos "à vista" (o jsdom não tem layout): o anel e o balão acham as âncoras
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return { top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect;
    });
  });

  it("braço A, Café: o número sem chips → 'Continuar' → o tutorial na aba MEU FINANCEIRO (faixa, anel no '+ Novo gasto', post-it) → o Café DE VERDADE na lista → UM balão: 'Saiu no mês' somou + 'Hoje ainda dá pra gastar R$ X' = o card do Dashboard → festa", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    expect(screen.getByTestId("montar-financas")).toBeTruthy();
    // 1.0.17 (dono 20/10): o dia 1 roda SEM a faixa preta (o atributo fica, com a altura zerada)
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(document.documentElement.getAttribute("data-missao-doses-faixa")).toBe("0");
    expect(screen.getByTestId("montar-contexto")).toHaveTextContent("Tutorial · Finanças · 3 perguntas");
    await responderOMontar();
    await avancar(2500); // "Montando…" → o número
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(screen.queryByText("Já gastou com alguma coisa hoje?")).toBeNull();
    const doMontar = numeroDoMontar();
    expect(doMontar).toBe(calcularMontar(3000, [{ id: "a", nome: "Aluguel", emoji: "", valor: 900, categoria: "moradia" }, { id: "l", nome: "Luz", emoji: "", valor: 150, categoria: "contas_casa" }, { id: "i", nome: "Internet", emoji: "", valor: 100, categoria: "internet_telefone" }], HOJE).porDia);
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    expect(lerMissao()?.feitos[1]?.rotulo).toBe(`Pode gastar R$ ${doMontar} por dia`); // a dose já conta
    // 1.0.17: a ponte pro 1º gasto — o MESMO número da tela anterior
    expect(lido(screen.getByTestId("montar-ponte-numero"))).toBe(`R$ ${doMontar} por dia`);
    await tocar(screen.getByTestId("montar-ponte-ir"));
    // o TUTORIAL no formulário de verdade
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.getByTestId("missao-doses-anel")).toBeTruthy();
    expect(document.querySelector('[data-spotlight="financeiro"]')!.getAttribute("data-active")).toBe("true"); // aba MEU FINANCEIRO
    const postIt = postItDoTutorial()!;
    // 1.0.17 (dono: "minimalista"): a pergunta, os chips, "+ Outro" (campo ali mesmo, com o R$) e a saída quieta "Ainda não"
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    expect(postIt).not.toHaveTextContent("Toca num");
    expect(within(postIt).getAllByTestId("demo-guia-chip").map((c) => lido(c))).toEqual(["☕Café· R$ 12", "🚗Uber· R$ 23", "🍔Almoço· R$ 35"]);
    expect(within(postIt).getByTestId("demo-guia-outro")).toHaveTextContent("Outro");
    expect(within(postIt).getByTestId("missao-doses-ainda-nao")).toHaveTextContent("Ainda não");
    // 1 toque = o gasto DE VERDADE na lista de Finanças
    await tocar(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect(controle.dados()["finance-expenses"]).toEqual([expect.objectContaining({ description: "Café", value: 12, date: "2026-10-16" })]);
    expect(screen.getAllByText("Café").length).toBeGreaterThan(0); // CUSTOS VARIÁVEIS
    // UM balão, no MEU MÊS, sem passar pelo Dashboard
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    expect(document.querySelector('[data-spotlight="financeiro"]')!.getAttribute("data-active")).toBe("true");
    const balao = screen.getByTestId("missao-doses-olhar");
    expect(balao).toHaveAttribute("data-olha", "financas");
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Seu mês");
    expect(screen.getByTestId("missao-doses-olhar-saiu")).toHaveTextContent("Saiu no mês");
    expect(lido(screen.getByTestId("missao-doses-olhar-saiu"))).toContain("R$ 1.150"); // o de antes, riscado → R$ 1.162
    // (17/10, opção 3) com gasto: "Sobra pra hoje ~~R$ 116~~ R$ 104" — o que dava no começo do dia − o Café (a linha do card)
    const pode = screen.getByTestId("missao-doses-olhar-pode");
    expect(pode).toHaveTextContent("Sobra hoje");
    expect(pode).not.toHaveTextContent("Dá pra gastar hoje");
    const noBalao = Number(pode.getAttribute("data-valor"));
    expect(noBalao).toBe(doMontar - 12);
    expect(lido(pode.querySelector("s")!)).toBe(`R$ ${doMontar}`);
    const leitor = <T,>(k: string, f: T): T => (k in controle.dados() ? (controle.dados()[k] as T) : f);
    // o número grande do card (a média do mês refeita): 16 dias pela frente, R$ 12 tiram R$ 0,75 por dia
    const numeroGrande = Math.round(porDiaExato(leitor)!);
    expect(numeroGrande).toBe(doMontar - 1);
    expect(screen.queryByTestId("missao-doses-pular-passo")).toBeNull(); // curto: só o "Entendi"
    expect(screen.queryByTestId("missao-doses-olhar-tempo")).toBeNull(); // sem "Olha · 1 de 2"
    // a festa entra sozinha
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    // 1.0.17 (item 7): a dose 1 comemora o módulo — "Finanças pronta 💛" + 1 linha do que ficou + 1 botão (o dia fecha no plano)
    expect(screen.getByTestId("missao-doses-festa-titulo")).toHaveTextContent(/^Finanças pronta 💛$/);
    /* 1.0.17 (prints do dono: "R$ 104 por dia" no número e "R$ 103 por dia" na festa): a festa diz o MESMO número do
       número, da ponte e do riscado do "Seu mês" — não a média refeita com o café (aqui 115,6 → 116 antes, 114,9 → 115 depois) */
    expect(numeroGrande).not.toBe(doMontar);
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(`R$ ${doMontar} por dia, já nas suas Finanças.`);
    expect(lerMissao()?.feitos[1]?.rotulo).toBe(`Pode gastar R$ ${doMontar} por dia`);
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(screen.queryByTestId("missao-doses-amanha")).toBeNull(); // "Amanhã: Rotina" mora no plano de amanhã (item 7)
    expect(screen.getByTestId("missao-doses-continuar")).toHaveTextContent(/^(Conhecer minha Home|Continuar)$/);
    // o card QUANTO POSSO GASTAR HOJE do Dashboard de sempre: o número grande de sempre + a linha com a MESMA sobra do balão
    expect(await cardDoDashboard()).toEqual({ numero: numeroGrande, linha: linhaEsperada(noBalao, 12, doMontar) });
    // os eventos do passo 1, na ordem, sem reais
    expect(doPasso1().map((e) => e.acao)).toEqual(["resultado", "continuar", "ponte", "ponte_saiu", "tutorial", "chip", "gasto", "olha"]);
    expect(doPasso1().find((e) => e.acao === "chip")).toMatchObject({ chip: "Café" });
    expect(doPasso1().find((e) => e.acao === "gasto")).toMatchObject({ via: "chip", ms_tutorial: expect.any(Number) });
    expect(doPasso1().find((e) => e.acao === "olha")).toMatchObject({ com_gasto: true, numero: true });
    for (const e of doPasso1()) expect(JSON.stringify(e)).not.toMatch(/"(valor|reais)"|1\.150|1150/);
    // e o resto da medição de sempre continua
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "chip" })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "meu_mes", contou: true })]);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
  });

  it("braço A, 'Ainda não gastei nada hoje': o MESMO registro do 'não gastei' da Home (finance-sem-gasto, hoje) → balão só com 'Hoje ainda dá pra gastar R$ X' (o número do Montar = o do Dashboard) → festa; nenhum gasto inventado", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(2500);
    const doMontar = numeroDoMontar();
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    await tocar(screen.getByTestId("montar-ponte-ir"));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    const ainda = within(postItDoTutorial()!).getByTestId("missao-doses-ainda-nao");
    fireEvent.click(ainda);
    await tocar(ainda); // toque duplo: 1 registro
    expect(controle.dados()[CHAVE_SEM_GASTO]).toEqual({ "2026-10-16": true });
    expect(controle.dados()["finance-expenses"]).toBeUndefined();
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    expect(screen.getByTestId("missao-doses-olhar")).toHaveAttribute("data-sem-gasto");
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Dia sem gasto ✓");
    expect(screen.queryByTestId("missao-doses-olhar-saiu")).toBeNull();
    expect(screen.getByTestId("missao-doses-olhar-pode")).toHaveTextContent(`Dá pra gastar hoje`);
    expect(Number(screen.getByTestId("missao-doses-olhar-pode").getAttribute("data-valor"))).toBe(doMontar);
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    expect(screen.getByTestId("missao-doses-festa-titulo")).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(await cardDoDashboard()).toEqual({ numero: doMontar, linha: null }); // sem gasto hoje: o card de sempre, sem a linha
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.pulados).toBeUndefined(); // não é dose pulada
    expect(lerMissao()?.gastoGuiado).toBeUndefined(); // reabrir não volta no tutorial
    expect(doPasso1().map((e) => e.acao)).toEqual(["resultado", "continuar", "ponte", "ponte_saiu", "tutorial", "nao_gastei", "olha"]);
    expect(doPasso1().find((e) => e.acao === "olha")).toMatchObject({ com_gasto: false, numero: true, caiu: false });
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "ainda_nao" })]);
  });

  it("1.0.17 — 'Ainda não gastei' NA PONTE: o mesmo do 'Ainda não' do post-it — o dia sem gasto, o balão 'Dia sem gasto ✓' no MEU MÊS e a festa; a dose conta, nada de gasto, reabrir não volta em nada", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(2500);
    const doMontar = numeroDoMontar();
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    await tocar(screen.getByTestId("montar-ponte-nao-gastei"));
    expect(controle.dados()[CHAVE_SEM_GASTO]).toEqual({ "2026-10-16": true });
    expect(controle.dados()["finance-expenses"]).toBeUndefined();
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(postItDoTutorial()).toBeNull(); // nada do tutorial do gasto
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Dia sem gasto ✓");
    expect(Number(screen.getByTestId("missao-doses-olhar-pode").getAttribute("data-valor"))).toBe(doMontar);
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    expect(screen.getByTestId("missao-doses-festa-titulo")).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.pulados).toBeUndefined();
    expect(lerMissao()?.gastoGuiado).toBeUndefined();
    expect(lerTelaDoNumero(CRIADA, HOJE)).toBeNull();
    expect(doPasso1().map((e) => e.acao)).toEqual(["resultado", "continuar", "ponte", "ponte_saiu", "nao_gastei", "olha"]);
  });

  it("1.0.17 — fechar o app NA PONTE e reabrir: volta na ponte (nunca no Montar, nunca no número); 'Ir pro app' segue pro tutorial do gasto", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(2500);
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("montar-ponte")).toBeTruthy();
    const dados = controle.dados();
    cleanup(); // o iOS matou o app
    _novaAberturaMontar();
    const de = montarAppEmFinancas(dados);
    await avancar(300);
    expect(screen.getByTestId("montar-ponte")).toBeTruthy();
    expect(screen.queryByTestId("montar-pronto")).toBeNull();
    expect(screen.queryByText("Quanto entra por mês?")).toBeNull();
    await tocar(screen.getByTestId("montar-ponte-ir"));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(postItDoTutorial()).toHaveTextContent("Gastou algo hoje?");
    expect((de.dados()["finance-incomes"] as unknown[]).length).toBe(1); // a renda do Montar, uma só
    // passou da ponte: reabrir de novo é o tutorial (a ponte não volta)
    const dados2 = de.dados();
    cleanup();
    _novaAberturaMontar();
    montarAppEmFinancas(dados2);
    await avancar(300);
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
  });

  it("braço B: o mesmo caminho — número sem chips → tutorial → Almoço → o balão com o número do Dashboard → 'Primeira dose feita!' que leva pra Rotina", { timeout: 40_000 }, async () => {
    missao("B");
    const controle = montarAppEmFinancas();
    await avancar(300);
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dose 1 de 4"); // o B segue com a faixa
    await responderOMontar();
    await avancar(2500);
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    await tocar(screen.getByTestId("montar-ponte-ir"));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    await tocar(within(postItDoTutorial()!).getAllByTestId("demo-guia-chip")[2]); // 🍔 Almoço · R$ 35
    expect(controle.dados()["finance-expenses"]).toEqual([expect.objectContaining({ description: "Almoço", value: 35 })]);
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    const noBalao = Number(screen.getByTestId("missao-doses-olhar-pode").getAttribute("data-valor"));
    expect(screen.getByTestId("missao-doses-olhar-pode")).toHaveTextContent("Sobra hoje");
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-agora-o")).toHaveTextContent("Agora a Rotina");
    const card = await cardDoDashboard();
    expect(card.linha).toBe(linhaEsperada(noBalao, 35, noBalao + 35)); // a MESMA sobra do balão (o que dava − R$ 35)
  });

  it("fechar o app no MEIO do tutorial (o post-it na tela) e reabrir: volta NO TUTORIAL — o Montar não se repete, a renda não duplica; o gasto entra e fecha a dose", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(2500);
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    await tocar(screen.getByTestId("montar-ponte-ir"));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    const dados = controle.dados();
    cleanup(); // o iOS matou o app
    _novaAberturaMontar();
    expect(lerMissao()?.gastoGuiado).toMatchObject({ n: 1, dia: "2026-10-16" });
    vi.setSystemTime(HOJE.getTime() + 3 * HORA);
    const de = montarAppEmFinancas(dados);
    await avancar(300);
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(screen.queryByTestId("montar-financas")).toBeNull(); // nunca o Montar de novo (nem o número: já foi visto)
    expect(postItDoTutorial()).toHaveTextContent("Gastou algo hoje?");
    await tocar(within(postItDoTutorial()!).getAllByTestId("demo-guia-chip")[1]); // 🚗 Uber
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 8000)).toBe(true);
    expect((de.dados()["finance-incomes"] as unknown[]).length).toBe(1); // a renda do Montar, uma só
    expect(de.dados()["finance-expenses"]).toEqual([expect.objectContaining({ description: "Uber", value: 23 })]);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(eventos).toContainEqual([EV_PRIMEIRO_GASTO, expect.objectContaining({ acao: "tutorial", retomada: true })]);
  });

  it("o app morreu no 'Montando…' (o número ainda não apareceu): reabrir volta NO NÚMERO (não nas perguntas), e o 'Continuar' segue pro tutorial", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(500); // ainda no "Montando…" (a conta entrando linha por linha)
    expect(screen.getByTestId("montar-montando")).toBeTruthy();
    const dados = controle.dados();
    cleanup();
    _novaAberturaMontar();
    montarAppEmFinancas(dados);
    await avancar(300);
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(screen.queryByText("Quanto entra por mês?")).toBeNull();
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar" }));
    await tocar(screen.getByTestId("montar-ponte-ir"));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(postItDoTutorial()).toHaveTextContent("Gastou algo hoje?");
  });
});

/* ── o fim da tela do número nunca fica atrás do botão colado (revisão tela a tela #15) ── */

describe("o fim da tela do número fica inteiro acima do botão 'Continuar'", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../components/finance/montar/montar-financas.css"), "utf8");
  /** O corpo da regra cujo seletor é EXATAMENTE `seletor` (no começo da linha). */
  const regra = (seletor: string): string => {
    const re = new RegExp(`(?:^|\\n)${seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
    return re.exec(css)?.[1] ?? "";
  };
  const valor = (corpo: string, prop: string): string => new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`).exec(corpo)?.[1].trim() ?? "";
  const px = (v: string): number => Number(/(-?[\d.]+)px/.exec(v)?.[1] ?? NaN);

  it("o botão é colado NO FLUXO (sticky, logo depois do conteúdo que rola): a última coisa da tela é A CONTA DO SEU MÊS", async () => {
    montarTela();
    await ateONumero();
    const pronto = screen.getByTestId("montar-pronto");
    expect(pronto.lastElementChild?.className).toBe("mf-folha");
    expect(lido(pronto.lastElementChild!)).toContain("Ver a conta"); // 1.0.17: fechada; abre ali mesmo
    fireEvent.click(screen.getByTestId("montar-ver-conta"));
    expect(lido(pronto.lastElementChild!)).toContain("Livre pro mês");
    const rodape = pronto.nextElementSibling as HTMLElement;
    expect(rodape.className).toBe("mf-rodape");
    expect(within(rodape).getByRole("button", { name: "Continuar" })).toBeTruthy();
    expect(pronto.parentElement?.className).toBe("mf-corpo"); // o que rola
    expect(valor(regra(".mf-corpo"), "overflow-y")).toBe("auto");
    expect(valor(regra(".mf-rodape"), "position")).toBe("sticky");
  });

  it("o RESPIRO: o conteúdo termina com mais espaço que o degradê do botão; o número de herói é maior; o post-it saiu do CSS", () => {
    const rodape = regra(".mf-rodape");
    const degrade = px(/hsl\(var\(--background\)\)\s+(\d+px)\)/.exec(valor(rodape, "background"))?.[1] ?? "");
    expect(degrade).toBeGreaterThan(0);
    const padding = valor(regra(".mf-pronto"), "padding").split(/\s+/);
    const embaixo = px(padding.length >= 3 ? padding[2] : padding[0]);
    expect(embaixo).toBeGreaterThanOrEqual(degrade + 4);
    expect(valor(regra(".mf"), "padding-bottom")).toContain("--app-safe-bottom");
    expect(px(valor(regra(".mf-pronto[data-heroi] .mf-grande strong"), "font-size"))).toBeGreaterThan(px(valor(regra(".mf-grande strong"), "font-size")));
    expect(css).not.toMatch(/\.mf-postit|\.mf-antes|data-pra-hoje/);
  });
});
