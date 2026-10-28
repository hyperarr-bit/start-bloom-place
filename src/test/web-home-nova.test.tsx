/**
 * 27/10 — HOME NOVA NO SITE PRA CONTA NOVA (lib/web-home-nova, chave WEB_HOME_NOVA).
 *   · site, chave "on": conta criada há < 48 h (sem missão de antes) → origem "nova" decidida e GRAVADA na conta → Home
 *     nova desde a 1ª Home (nem um quadro da antiga), fluxo enxuto (sem intro/montar/tour) e festas com calma;
 *   · site, conta antiga (inclusive admin) → Home de hoje, marcador "antiga" gravado, sem enxuto;
 *   · chave "off" → o site exatamente como antes (nada classificado, nada gravado, Home de hoje);
 *   · app do iPhone → igual a antes (a chave do site não vale lá); Android → igual.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const plat = vi.hoisted(() => ({ nativo: true }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plat.nativo, plataformaApp: () => (plat.nativo ? "ios" : "web"), isIOS: () => plat.nativo, isAndroid: () => false,
}));
vi.mock("@/lib/att-ios", async (orig) => ({ ...(await orig<typeof import("@/lib/att-ios")>()), pedirRastreamentoIos: async () => "nao_ios" }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: () => {} }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "", user_metadata: {} } as { id: string; email: string; created_at?: string; user_metadata: Record<string, unknown> } | null,
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, useAuthOpcional: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
const adminMock = vi.hoisted(() => ({ resposta: false as boolean }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => adminMock.resposta) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    abortSignal: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  });
  return {
    supabase: {
      from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn(),
    },
  };
});

import HomePage from "@/pages/Home";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { OrigemDaContaNaSessao, contaCarregadaDeVerdade, decidirOrigemDaConta } from "@/components/home-nova/OrigemDaConta";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import { __zerarPilhaDaBarraVidro } from "@/components/home-nova/e/BarraVidroGlobal";
import {
  CHAVE_HOME_NOVA_APARELHO, CHAVE_ORIGEM_APARELHO, CHAVE_ORIGEM_CONTA, _zerarHomeNova, fixarModoDaAbertura, homeNovaLigada, homeNovaLigadaSincrona,
  lerHomeNovaRemoto, modoHomeNova, origemConhecida, padraoHomeNova, registrarHomeNovaRemoto,
} from "@/lib/home-nova";
import { localDayKey } from "@/lib/utils";
import { webHomeNovaLigada } from "@/lib/web-home-nova";
import { fluxoEnxutoLigado, camposFluxoEnxuto } from "@/lib/fluxo-enxuto";
import { introLigada } from "@/lib/intro-modulo";
import { montarFinancasLigado } from "@/lib/montar-financas";
import { montarRotinaLigado } from "@/lib/montar-rotina";
import { calmaDasFestasVale } from "@/lib/festas-calma";
import { prepararJsdom } from "./compat-comum";

const offerings = (meta: Record<string, unknown>) => ({ current: { metadata: meta }, all: {} });
const horasAtras = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const hoje = localDayKey();
const BASE = { "core-user-name": "Ana", "core-onboarding-done": "true", "core-all-modules-celebrated": "true", "gamification-lastCheckIn": hoje };

/* ------------------------------------------------- a nuvem com `loaded`/`contaCompleta` controláveis (como o provider) */
function criarConta(inicial: Record<string, unknown>) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Record<string, unknown>, loaded: true, contaCompleta: true as boolean | undefined };
  let acordar = () => {};
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [n, subir] = useReducer((x: number) => x + 1, 0);
    acordar = subir;
    const retrato = estado.dados;
    const get = useCallback(<T,>(k: string, f: T): T => (estado.loaded && k in retrato ? (retrato[k] as T) : f), [retrato, n]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => {
      estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v ?? null)) };
      subir();
    }, []);
    const valor = useMemo<UserDataContextType>(
      () => ({ get, set, loaded: estado.loaded, contaCompleta: estado.contaCompleta, isGuest: !auth.user, fetchKey: async () => null }),
      [get, set, n], // eslint-disable-line react-hooks/exhaustive-deps
    );
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const mudar = (p: Partial<typeof estado>) => act(() => { Object.assign(estado, p); acordar(); });
  return { estado, Provedor, mudar };
}
type Conta = ReturnType<typeof criarConta>;

/* ------------------------------------------------- o vigia: alguma vez a Home antiga (ou o tour antigo) apareceu? */
const viuAntiga = { v: false, tour: false };
let vigia: MutationObserver | null = null;
const olhar = () => {
  if (document.querySelector('[data-tour="acoes-rapidas"]')) viuAntiga.v = true;
  if (document.querySelector('[data-testid="tour-popup"], [data-testid="tour-veu"], [data-camada-guia="tour-home"]')) viuAntiga.tour = true;
};
const vigiar = () => {
  viuAntiga.v = false; viuAntiga.tour = false;
  vigia?.disconnect();
  vigia = new MutationObserver(olhar);
  vigia.observe(document.body, { childList: true, subtree: true, attributes: true });
};
const nova = () => !!document.querySelector('[data-layout="e"]');
const antiga = () => !!document.querySelector('[data-tour="acoes-rapidas"]');

const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
/** O App: a origem na sessão ANTES das rotas (como o App de verdade) e a Home. `semOrigem`: só a Home (ordem da árvore não importa). */
const abrir = async (conta: Conta, semOrigem = false) => {
  vigiar();
  const r = render(
    <MemoryRouter initialEntries={["/home"]}>
      <conta.Provedor>
        {!semOrigem && <OrigemDaContaNaSessao />}
        <Routes><Route path="/home" element={<HomePage />} /><Route path="*" element={<div />} /></Routes>
      </conta.Provedor>
    </MemoryRouter>,
  );
  await respirar(30);
  return r;
};
/** Fecha o app: desmonta e esquece a memória da abertura (o aparelho — localStorage — fica). */
const fechar = () => { cleanup(); vigia?.disconnect(); _zerarHomeNova(); _zerarConsultaAdmin(); __zerarPilhaDaBarraVidro(); };

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  _zerarHomeNova(); _zerarConsultaAdmin(); __zerarPilhaDaBarraVidro();
  plat.nativo = true; adminMock.resposta = false;
  auth.user = { id: "u1", email: "fulana@exemplo.com.br", created_at: horasAtras(1), user_metadata: {} };
});
afterEach(() => { fechar(); document.body.className = ""; });

beforeAll(async () => { await import("@/components/home-nova/e/HomeE"); }, 60_000);

const G = globalThis as { __WEB_HOME_NOVA__?: string };
const site = (chave: "on" | "off" | null) => { plat.nativo = false; if (chave === null) delete G.__WEB_HOME_NOVA__; else G.__WEB_HOME_NOVA__ = chave; };
afterEach(() => { G.__WEB_HOME_NOVA__ = "off"; });

describe("site com WEB_HOME_NOVA 'on' — conta NOVA", () => {
  it("a constante do código está ligada e só vale no site", () => {
    site(null);
    expect(webHomeNovaLigada()).toBe(true);
    expect(padraoHomeNova()).toBe("novas");
    plat.nativo = true;
    expect(webHomeNovaLigada()).toBe(false);
  });
  it("cadastro no site → origem 'nova' gravada na conta → Home nova desde a 1ª Home, sem tutorial", async () => {
    site("on");
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true), { timeout: 8000 });
    expect(viuAntiga.v).toBe(false);
    expect(viuAntiga.tour).toBe(false);
    expect((conta.estado.dados[CHAVE_ORIGEM_CONTA] as { tipo: string }).tipo).toBe("nova");
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u1:nova");
    // fluxo enxuto: nenhum tutorial/intro/montar
    expect(fluxoEnxutoLigado()).toBe(true);
    expect(introLigada()).toBe(false);
    expect(montarFinancasLigado()).toBe(false);
    expect(montarRotinaLigado()).toBe(false);
    expect(camposFluxoEnxuto()).toEqual({ fluxo_enxuto: "enxuto" });
    // festas com calma nos 3 primeiros dias
    expect(calmaDasFestasVale(auth.user!.created_at)).toBe(true);
  });
  it("fechar e reabrir (mesmo navegador ou outro): continua nova, sem reclassificar", async () => {
    site("on");
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true), { timeout: 8000 });
    fechar();
    localStorage.clear(); // outro navegador: o marcador vem da conta
    auth.user = { ...auth.user!, created_at: horasAtras(100) }; // mesmo depois das 48 h
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true), { timeout: 8000 });
    expect(viuAntiga.v).toBe(false);
  });
  it("conta com missão em doses de ANTES (sem carimbo) fica antiga — a mesma régua do app", async () => {
    site("on");
    const missao = { v: 1, inicio: hoje, modulos: ["financas", "rotina", "saude"], feitos: {}, boasVindas: true };
    const conta = criarConta({ ...BASE, "missao-doses-conta": missao });
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
    expect((conta.estado.dados[CHAVE_ORIGEM_CONTA] as { tipo: string }).tipo).toBe("antiga");
  });
});

describe("site com WEB_HOME_NOVA 'on' — conta ANTIGA", () => {
  it("conta com mais de 48 h → Home de hoje, marcador 'antiga', sem enxuto", async () => {
    site("on");
    auth.user = { ...auth.user!, created_at: horasAtras(24 * 40) };
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
    expect(nova()).toBe(false);
    expect((conta.estado.dados[CHAVE_ORIGEM_CONTA] as { tipo: string }).tipo).toBe("antiga");
    expect(fluxoEnxutoLigado()).toBe(false);
    expect(camposFluxoEnxuto()).toEqual({});
  });
  it("admin antigo também fica com a Home de hoje (o site é 'novas', não 'novas+admin')", async () => {
    site("on");
    adminMock.resposta = true;
    auth.user = { ...auth.user!, created_at: horasAtras(24 * 300) };
    const conta = criarConta(BASE);
    await abrir(conta);
    await respirar(50);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
    expect(nova()).toBe(false);
  });
  it("marcador 'antiga' já na conta (veio do app) manda, mesmo com a conta < 48 h", async () => {
    site("on");
    const conta = criarConta({ ...BASE, [CHAVE_ORIGEM_CONTA]: { tipo: "antiga", em: "x", versao: "1.0.19", regra: "r" } });
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
    expect(fluxoEnxutoLigado()).toBe(false);
  });
});

describe("site com WEB_HOME_NOVA 'off' — exatamente como antes", () => {
  it("conta nova: nada classificado nem gravado, Home de hoje, sem enxuto", async () => {
    site("off");
    expect(padraoHomeNova()).toBe("off");
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
    expect(nova()).toBe(false);
    expect(conta.estado.dados[CHAVE_ORIGEM_CONTA]).toBeUndefined();
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBeNull();
    expect(fluxoEnxutoLigado()).toBe(false);
    expect(calmaDasFestasVale(auth.user!.created_at)).toBe(false);
  });
  it("conta que ganhou 'nova' no site enquanto a chave estava on volta pra Home de hoje no site", async () => {
    site("off");
    const conta = criarConta({ ...BASE, [CHAVE_ORIGEM_CONTA]: { tipo: "nova", em: "x", versao: "1.0.19", regra: "r" } });
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
    expect(fluxoEnxutoLigado()).toBe(false);
  });
});

describe("app das lojas — a chave do site não muda nada", () => {
  it("iPhone: padrão novas+admin, conta nova vê a nova como antes; o enxuto segue a regra do app", async () => {
    plat.nativo = true; G.__WEB_HOME_NOVA__ = "on";
    expect(webHomeNovaLigada()).toBe(false);
    expect(padraoHomeNova()).toBe("novas+admin");
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true), { timeout: 8000 });
    // a suíte roda com o padrão do enxuto no app = "off" (setup): a chave do site não liga o enxuto no app
    expect(fluxoEnxutoLigado()).toBe(false);
  });
  it("iPhone: conta antiga continua com a Home de hoje", async () => {
    plat.nativo = true; G.__WEB_HOME_NOVA__ = "on";
    auth.user = { ...auth.user!, created_at: horasAtras(24 * 40) };
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true), { timeout: 8000 });
  });
});
