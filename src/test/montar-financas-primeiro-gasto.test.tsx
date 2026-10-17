/**
 * O PASSO 1 DE FINANÇAS DA MISSÃO (17/10, revisão do dono no Simulador: "quando mostra o 'quanto posso gastar hoje'
 * ele deveria ser o foco, só que ele é dividido pelo 'já gastou alguma coisa hoje?'. Isso deveria aparecer no
 * tutorial em si, não no montar o plano"). Conta VAZIA, Dashboard de sempre (painel limpo DESLIGADO):
 *   · a tela do número (o Montar pela missão) é SÓ o número: "VOCÊ PODE GASTAR HOJE / R$ X por dia" (sobe de 0 em
 *     ~0,6 s; direto pra quem pediu menos movimento), a linha curta, A CONTA DO SEU MÊS e "Continuar →" — nada de
 *     post-it, chips, "Ainda não gastei" nem "✓ Já está tudo nas suas Finanças";
 *   · "Continuar →" leva pro TUTORIAL no formulário de verdade de Finanças (aba MEU FINANCEIRO): a faixa da missão,
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
} from "@/lib/montar-financas";
import { MontarFinancas, SUBIDA_DO_NUMERO_MS, type ResumoMontar } from "@/components/finance/montar/MontarFinancas";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
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
  it("o número de herói, a linha curta, A CONTA DO SEU MÊS e 'Continuar →' — nada de post-it, chips, 'Ainda não gastei' nem '✓ Já está tudo…'", async () => {
    expect(PAINEL_LIMPO).toBe("off"); // o Dashboard de sempre (dono, 17/10)
    montarTela();
    await ateONumero();
    const numero = screen.getByTestId("montar-por-dia");
    expect(numero.getAttribute("data-valor")).toBe("66");
    expect(numero.querySelector(".sr-only")!.textContent).toBe("R$ 66 por dia"); // o leitor de tela lê o número final
    expect(lido(numero)).toContain("R$ 66por dia");
    expect(screen.getByTestId("montar-pronto").hasAttribute("data-heroi")).toBe(true);
    expect(tela().getByText(/até o fim do mês \(16 dias, contando hoje\), já tirando as contas fixas e a fatura/)).toBeTruthy();
    expect(tela().getByText(/A conta do seu mês/i)).toBeTruthy();
    expect(tela().getByText("Livre pro mês")).toBeTruthy();
    // o 1º gasto saiu daqui
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(screen.queryByText("Já gastou com alguma coisa hoje?")).toBeNull();
    expect(screen.queryByText(/Ainda não gastei/)).toBeNull();
    expect(screen.queryByText(/Café/)).toBeNull();
    expect(screen.queryByText(/Já está tudo nas suas Finanças/)).toBeNull();
    expect(tela().getByRole("button", { name: "Continuar →" })).toBeTruthy();
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
    expect(screen.getByText(/Já está tudo nas suas Finanças/)).toBeTruthy();
    expect(tela().getByRole("button", { name: "Ver minhas Finanças" })).toBeTruthy();
    expect(doPasso1()).toEqual([]);
  });

  it("'Continuar →': onPronto UMA vez (toque duplo) e sem primeiroGasto; nada gravado em gastos; evento 'continuar' com o tempo desde o número, sem reais", async () => {
    const onPronto = vi.fn();
    const controle = montarTela({ onPronto });
    await ateONumero();
    vi.setSystemTime(HOJE.getTime() + 2500); // 2,5 s olhando o número
    const cta = tela().getByRole("button", { name: "Continuar →" });
    fireEvent.click(cta);
    fireEvent.click(cta);
    expect(onPronto).toHaveBeenCalledTimes(1);
    const r = onPronto.mock.calls[0][0] as ResumoMontar;
    expect(r).toEqual({ contas: 3, porDia: 66, semFolga: false, cartao: true });
    expect("primeiroGasto" in r).toBe(false);
    expect(controle.dados()["finance-expenses"]).toBeUndefined();
    expect(doPasso1()).toEqual([expect.objectContaining({ acao: "resultado" }), { acao: "continuar", ms: 2500 }]);
    for (const [, e] of eventos) expect(JSON.stringify(e)).not.toMatch(/3000|1050|800|66/);
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
    await act(async () => { await new Promise((r) => setTimeout(r, SUBIDA_DO_NUMERO_MS + 250)); });
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

  it("sem folga no mês: 'R$ 0 por dia', a frase de onde apertar e 'Continuar →' (nada anima)", async () => {
    montarTela();
    fireEvent.change(tela().getByLabelText("Renda do mês em reais"), { target: { value: "1000" } });
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: /^🏠 Aluguel/ })); // 900
    fireEvent.click(tela().getByRole("button", { name: /^🏋️ Academia/ })); // 100 → 0 livre
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    await respirar();
    expect(screen.getByTestId("montar-por-dia").textContent).toContain("R$ 0");
    expect(screen.getByText(/Suas contas fixas já levam a renda do mês inteira/)).toBeTruthy();
    expect(tela().getByRole("button", { name: "Continuar →" })).toBeTruthy();
  });
});

describe("fechar o app: o número que ainda não apareceu volta; o que apareceu, não (B11)", () => {
  it("morreu no 'Montando…' (já gravou, o número ainda não apareceu) → reabre DIRETO no número; aí o número foi visto e não volta mais", async () => {
    const controle = montarTela({ esperaMs: 60_000 });
    fireEvent.click(tela().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
    fireEvent.click(tela().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(tela().getByRole("button", { name: "Não uso cartão" }));
    expect(screen.getByText("Montando suas finanças…")).toBeTruthy();
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
    // APARECEU: é tela de uma vez — reabrir de novo não volta nela (a missão retoma no tutorial do 1º gasto)
    expect(lerTelaDoNumero(CRIADA, HOJE)).toBeNull();
    expect(deveMostrarMontarFinancas({ criadoEm: CRIADA, get, isGuest: false })).toBe(false);
  });

  it("fechou NA tela do número (já vista): não volta — nem no mesmo dia; e a marca da conta nunca levou a tela do número", async () => {
    const controle = montarTela();
    await ateONumero();
    const dados = controle.dados();
    const daConta = dados[CHAVE_MONTAR_FINANCAS] as { r?: string; numero?: unknown } | undefined;
    expect(daConta?.r).toBe("pronto");
    expect(daConta?.numero).toBeUndefined();
    cleanup();
    _novaAberturaMontar();
    expect(lerTelaDoNumero(CRIADA, HOJE)).toBeNull();
    expect(deveMostrarMontarFinancas({ criadoEm: CRIADA, get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f), isGuest: false })).toBe(false);
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
/** O número do card QUANTO POSSO GASTAR HOJE do Dashboard de sempre (a aba DASHBOARD do módulo de verdade). */
const numeroDoDashboard = async () => {
  await tocar(screen.getByRole("button", { name: /DASHBOARD/ }));
  await avancar(300);
  expect(screen.queryByTestId("sobram-pra-hoje")).toBeNull(); // a linha "Sobram R$ X pra hoje" era do painel limpo
  return Number((screen.getByTestId("pode-gastar-valor").textContent ?? "").replace(/\D/g, ""));
};

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

  it("braço A, Café: o número sem chips → 'Continuar →' → o tutorial na aba MEU FINANCEIRO (faixa, anel no '+ Novo gasto', post-it) → o Café DE VERDADE na lista → UM balão: 'Saiu no mês' somou + 'Hoje ainda dá pra gastar R$ X' = o card do Dashboard → festa", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    expect(screen.getByTestId("montar-financas")).toBeTruthy();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 1 de 3");
    await responderOMontar();
    await avancar(2500); // "Montando…" → o número
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(screen.queryByText("Já gastou com alguma coisa hoje?")).toBeNull();
    const doMontar = numeroDoMontar();
    expect(doMontar).toBe(calcularMontar(3000, [{ id: "a", nome: "Aluguel", emoji: "", valor: 900, categoria: "moradia" }, { id: "l", nome: "Luz", emoji: "", valor: 150, categoria: "contas_casa" }, { id: "i", nome: "Internet", emoji: "", valor: 100, categoria: "internet_telefone" }], HOJE).porDia);
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar →" }));
    expect(lerMissao()?.feitos[1]?.rotulo).toBe(`Pode gastar R$ ${doMontar} por dia`); // a dose já conta
    // o TUTORIAL no formulário de verdade
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.getByTestId("missao-doses-anel")).toBeTruthy();
    expect(document.querySelector('[data-spotlight="financeiro"]')!.getAttribute("data-active")).toBe("true"); // aba MEU FINANCEIRO
    const postIt = postItDoTutorial()!;
    expect(postIt).toHaveTextContent("Agora · 1 toque");
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip").map((c) => lido(c))).toEqual(["☕Café· R$ 12", "🚗Uber· R$ 23", "🍔Almoço· R$ 35"]);
    expect(within(postIt).getByTestId("demo-guia-escrever")).toHaveTextContent("✎ escrever o meu");
    expect(within(postIt).getByTestId("missao-doses-ainda-nao")).toHaveTextContent("Ainda não gastei nada hoje →");
    // 1 toque = o gasto DE VERDADE na lista de Finanças
    await tocar(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect(controle.dados()["finance-expenses"]).toEqual([expect.objectContaining({ description: "Café", value: 12, date: "2026-10-16" })]);
    expect(screen.getAllByText("Café").length).toBeGreaterThan(0); // CUSTOS VARIÁVEIS
    // UM balão, no MEU MÊS, sem passar pelo Dashboard
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    expect(document.querySelector('[data-spotlight="financeiro"]')!.getAttribute("data-active")).toBe("true");
    const balao = screen.getByTestId("missao-doses-olhar");
    expect(balao).toHaveAttribute("data-olha", "financas");
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Olha o seu mês");
    expect(screen.getByTestId("missao-doses-olhar-saiu")).toHaveTextContent("Saiu no mês");
    expect(lido(screen.getByTestId("missao-doses-olhar-saiu"))).toContain("R$ 1.150"); // o de antes, riscado → R$ 1.162
    const pode = screen.getByTestId("missao-doses-olhar-pode");
    expect(pode).toHaveTextContent("Hoje ainda dá pra gastar");
    const noBalao = Number(pode.getAttribute("data-valor"));
    expect(noBalao).toBe(Math.round(porDiaExato(<T,>(k: string, f: T): T => (k in controle.dados() ? (controle.dados()[k] as T) : f))!));
    // 16 dias pela frente: R$ 12 tiram R$ 0,75 por dia — o número arredondado CAI 1 (~~R$ 116~~ R$ 115); quando não cai, fica sem risco
    expect(noBalao).toBe(doMontar - 1);
    expect(lido(pode.querySelector("s")!)).toBe(`R$ ${doMontar}`);
    expect(screen.queryByTestId("missao-doses-pular-passo")).toBeNull(); // curto: só o "Entendi"
    expect(screen.queryByTestId("missao-doses-olhar-tempo")).toBeNull(); // sem "Olha · 1 de 2"
    // a festa entra sozinha
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-gasto-extra")).toHaveTextContent("E o gasto de hoje (Café, R$ 12) já entrou no seu mês.");
    // o número do balão É o do card QUANTO POSSO GASTAR HOJE do Dashboard de sempre
    expect(await numeroDoDashboard()).toBe(noBalao);
    // os eventos do passo 1, na ordem, sem reais
    expect(doPasso1().map((e) => e.acao)).toEqual(["resultado", "continuar", "tutorial", "chip", "gasto", "olha"]);
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
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar →" }));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    const ainda = within(postItDoTutorial()!).getByTestId("missao-doses-ainda-nao");
    fireEvent.click(ainda);
    await tocar(ainda); // toque duplo: 1 registro
    expect(controle.dados()[CHAVE_SEM_GASTO]).toEqual({ "2026-10-16": true });
    expect(controle.dados()["finance-expenses"]).toBeUndefined();
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    expect(screen.getByTestId("missao-doses-olhar")).toHaveAttribute("data-sem-gasto");
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Dia sem gasto anotado ✓");
    expect(screen.queryByTestId("missao-doses-olhar-saiu")).toBeNull();
    expect(screen.getByTestId("missao-doses-olhar-pode")).toHaveTextContent(`Hoje ainda dá pra gastar`);
    expect(Number(screen.getByTestId("missao-doses-olhar-pode").getAttribute("data-valor"))).toBe(doMontar);
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(await numeroDoDashboard()).toBe(doMontar);
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.pulados).toBeUndefined(); // não é dose pulada
    expect(lerMissao()?.gastoGuiado).toBeUndefined(); // reabrir não volta no tutorial
    expect(doPasso1().map((e) => e.acao)).toEqual(["resultado", "continuar", "tutorial", "nao_gastei", "olha"]);
    expect(doPasso1().find((e) => e.acao === "olha")).toMatchObject({ com_gasto: false, numero: true, caiu: false });
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "ainda_nao" })]);
  });

  it("braço B: o mesmo caminho — número sem chips → tutorial → Almoço → o balão com o número do Dashboard → 'Primeira dose feita!' que leva pra Rotina", { timeout: 40_000 }, async () => {
    missao("B");
    const controle = montarAppEmFinancas();
    await avancar(300);
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dose 1 de 4");
    await responderOMontar();
    await avancar(2500);
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar →" }));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    await tocar(within(postItDoTutorial()!).getAllByTestId("demo-guia-chip")[2]); // 🍔 Almoço · R$ 35
    expect(controle.dados()["finance-expenses"]).toEqual([expect.objectContaining({ description: "Almoço", value: 35 })]);
    expect(await ate(() => !!screen.queryByTestId("missao-doses-olhar"))).toBe(true);
    const noBalao = Number(screen.getByTestId("missao-doses-olhar-pode").getAttribute("data-valor"));
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 5000)).toBe(true);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-agora-o")).toHaveTextContent("Agora a Rotina");
    expect(await numeroDoDashboard()).toBe(noBalao);
  });

  it("fechar o app no MEIO do tutorial (o post-it na tela) e reabrir: volta NO TUTORIAL — o Montar não se repete, a renda não duplica; o gasto entra e fecha a dose", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(2500);
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar →" }));
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
    expect(postItDoTutorial()).toHaveTextContent("Já gastou com alguma coisa hoje?");
    await tocar(within(postItDoTutorial()!).getAllByTestId("demo-guia-chip")[1]); // 🚗 Uber
    expect(await ate(() => !!screen.queryByTestId("missao-doses-festa"), 8000)).toBe(true);
    expect((de.dados()["finance-incomes"] as unknown[]).length).toBe(1); // a renda do Montar, uma só
    expect(de.dados()["finance-expenses"]).toEqual([expect.objectContaining({ description: "Uber", value: 23 })]);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(eventos).toContainEqual([EV_PRIMEIRO_GASTO, expect.objectContaining({ acao: "tutorial", retomada: true })]);
  });

  it("o app morreu no 'Montando…' (o número ainda não apareceu): reabrir volta NO NÚMERO (não nas perguntas), e o 'Continuar →' segue pro tutorial", { timeout: 40_000 }, async () => {
    missao("A");
    const controle = montarAppEmFinancas();
    await avancar(300);
    await responderOMontar();
    await avancar(500); // ainda no "Montando…"
    expect(screen.getByText("Montando suas finanças…")).toBeTruthy();
    const dados = controle.dados();
    cleanup();
    _novaAberturaMontar();
    montarAppEmFinancas(dados);
    await avancar(300);
    expect(screen.getByTestId("montar-pronto")).toBeTruthy();
    expect(screen.queryByText("Quanto entra por mês, mais ou menos?")).toBeNull();
    await tocar(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Continuar →" }));
    expect(await ate(() => !!postItDoTutorial())).toBe(true);
    expect(postItDoTutorial()).toHaveTextContent("Já gastou com alguma coisa hoje?");
  });
});

/* ── o fim da tela do número nunca fica atrás do botão colado (revisão tela a tela #15) ── */

describe("o fim da tela do número fica inteiro acima do botão 'Continuar →'", () => {
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
    expect(lido(pronto.lastElementChild!)).toContain("Livre pro mês");
    const rodape = pronto.nextElementSibling as HTMLElement;
    expect(rodape.className).toBe("mf-rodape");
    expect(within(rodape).getByRole("button", { name: "Continuar →" })).toBeTruthy();
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
