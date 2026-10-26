/**
 * 1.0.19 — A HOME NOVA GARANTIDA PRA CONTA NOVA (26/10, lib/home-nova + components/home-nova/OrigemDaConta + pages/Home).
 *   · no app das lojas o PADRÃO (RevenueCat sem resposta, lento, com erro, sem a chave) é "novas+admin"; no site, "off";
 *   · a chave manda quando responde com valor válido — "off" é o desligar de emergência e vale da PRÓXIMA abertura
 *     (nunca troca a Home na frente da pessoa); o modo fica fixo na abertura;
 *   · conta NOVA vê a Home nova desde a 1ª Home e em toda reabertura — nem um quadro da Home antiga (vigia de DOM),
 *     nem o tour antigo; a Home espera a origem (tela de carregamento) em vez de cair na antiga;
 *   · conta ANTIGA nunca vê a Home nova (só o admin no "novas+admin");
 *   · a origem é gravada NA CONTA e lida em outro aparelho; o render de troca convidado→conta (loaded do convidado)
 *     não decide nada; sem created_at nada é gravado.
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

/* ================================================================== a chave e o padrão */
describe("home_nova — o padrão por plataforma e o desligar de emergência", () => {
  it("app das lojas: sem resposta / sem cache = novas+admin; site = off", () => {
    expect(padraoHomeNova()).toBe("novas+admin");
    expect(modoHomeNova()).toBe("novas+admin");
    plat.nativo = false;
    expect(padraoHomeNova()).toBe("off");
    expect(modoHomeNova()).toBe("off");
  });
  it("resposta SEM a chave (ou com lixo) não muda nada: segue o padrão / o guardado", () => {
    registrarHomeNovaRemoto(offerings({}));
    registrarHomeNovaRemoto(offerings({ home_nova: "talvez" }));
    expect(modoHomeNova()).toBe("novas+admin");
    expect(localStorage.getItem(CHAVE_HOME_NOVA_APARELHO)).toBeNull();
    expect(lerHomeNovaRemoto(offerings({}))).toBe("novas+admin");
  });
  it("RevenueCat 'off' = desligar de emergência: guardado, e vale da próxima abertura (a de agora já fixou)", () => {
    expect(fixarModoDaAbertura()).toBe("novas+admin"); // a Home já decidiu nesta abertura
    registrarHomeNovaRemoto(offerings({ home_nova: "off" }));
    expect(modoHomeNova()).toBe("novas+admin"); // nada troca na frente da pessoa
    expect(localStorage.getItem(CHAVE_HOME_NOVA_APARELHO)).toBe("off");
    _zerarHomeNova(); // próxima abertura, RevenueCat ainda sem resposta
    expect(modoHomeNova()).toBe("off");
    expect(homeNovaLigada(true, "nova")).toBe(false); // pra todo mundo
  });
  it("resposta que chega ANTES de qualquer decisão vale já nesta abertura", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "off" }));
    expect(fixarModoDaAbertura()).toBe("off");
  });
  it("novas+admin: nova só pra conta nova e pro admin", () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "novas+admin" }));
    expect(homeNovaLigada(false, "nova")).toBe(true);
    expect(homeNovaLigada(null, "antiga")).toBe(false);
    expect(homeNovaLigada(true, "antiga")).toBe(true);
    expect(homeNovaLigada(false, null)).toBe(false);
  });
});

/* ================================================================== a origem: quando dá pra decidir */
describe("origem da conta — decidida com a conta DESTA pessoa", () => {
  it("render de troca convidado→conta (loaded do convidado, contaCompleta false) não decide nada", () => {
    expect(contaCarregadaDeVerdade(true, false)).toBe(false);
    expect(contaCarregadaDeVerdade(false, true)).toBe(false);
    expect(contaCarregadaDeVerdade(true, true)).toBe(true);
    expect(contaCarregadaDeVerdade(true, undefined)).toBe(true);
  });
  it("sem created_at: indecidível — nada na memória, nada gravado (nunca liga a nova na dúvida)", () => {
    const r = decidirOrigemDaConta({ id: "u9" }, (_k, f) => f);
    expect(r).toEqual({ origem: null, faltaNaConta: false });
    expect(origemConhecida("u9")).toBeNull();
  });
  it("conta criada pela Porta/site e aberta no app dentro de 48 h: nova", () => {
    expect(decidirOrigemDaConta({ id: "u2", created_at: horasAtras(30) }, (_k, f) => f).origem).toBe("nova");
  });
  it("a missão em doses LOCAL de outra conta não vira esta em antiga", () => {
    localStorage.setItem("missao-doses", JSON.stringify({ v: 1, inicio: hoje, modulos: ["financas", "rotina", "saude"], feitos: {}, boasVindas: true, dono: "outra" }));
    expect(decidirOrigemDaConta({ id: "u3", created_at: horasAtras(2) }, (_k, f) => f).origem).toBe("nova");
  });
});

/* ================================================================== a Home de verdade */
describe("conta NOVA no app: a Home nova sempre, desde a 1ª Home, sem um quadro da antiga", () => {
  it("RevenueCat SEM resposta (nunca respondeu, sem cache): Home nova na 1ª abertura e nas seguintes", async () => {
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
    expect(viuAntiga.tour).toBe(false);
    expect(conta.estado.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "nova" }));
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u1:nova");
    for (let i = 0; i < 2; i++) {
      fechar();
      await abrir(conta);
      await waitFor(() => expect(nova()).toBe(true));
      expect(viuAntiga.v).toBe(false);
    }
  });

  it("RevenueCat LENTO: a conta chega antes, a resposta ('off') chega com a Home nova na tela — nada troca; desliga na próxima", async () => {
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    act(() => { registrarHomeNovaRemoto(offerings({ home_nova: "off" })); });
    await respirar(50);
    conta.mudar({}); // qualquer re-render
    await respirar(30);
    expect(nova()).toBe(true);
    expect(viuAntiga.v).toBe(false);
    fechar();
    await abrir(conta); // a próxima abertura: o "off" guardado vale (kill switch)
    await waitFor(() => expect(antiga()).toBe(true));
    expect(nova()).toBe(false);
  });

  it("RevenueCat com ERRO (resposta inútil) + conta demorando a chegar: tela de carregamento, depois direto a nova", async () => {
    registrarHomeNovaRemoto(null);
    registrarHomeNovaRemoto("erro");
    const conta = criarConta(BASE);
    conta.estado.loaded = false; conta.estado.contaCompleta = false;
    await abrir(conta);
    expect(nova()).toBe(false);
    expect(antiga()).toBe(false);
    await conta.mudar({ loaded: true, contaCompleta: true });
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
  });

  it("cadastro no app: o render com o `loaded` do CONVIDADO não decide nem mostra Home; a conta chega e é a nova", async () => {
    const conta = criarConta(BASE);
    conta.estado.contaCompleta = false; // loaded=true é o do convidado; a conta desta pessoa ainda não chegou
    await abrir(conta);
    await respirar(100);
    expect(antiga()).toBe(false);
    expect(nova()).toBe(false);
    expect(origemConhecida("u1")).toBeNull();
    expect(conta.estado.dados[CHAVE_ORIGEM_CONTA]).toBeUndefined();
    await conta.mudar({ loaded: false });
    await conta.mudar({ loaded: true, contaCompleta: true });
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
  });

  it("a Home decide a origem sozinha (sem o OrigemDaContaNaSessao na árvore): nova, sem piscar", async () => {
    const conta = criarConta(BASE);
    await abrir(conta, true);
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
  });

  it("reinstalou no mesmo dia (aparelho zerado, marcador na conta): nova", async () => {
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    fechar();
    localStorage.clear();
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
  });

  it("outro aparelho, dias depois (conta já com mais de 48 h): o marcador da conta vale — nova", async () => {
    auth.user = { id: "u1", email: "x@x.com", created_at: horasAtras(24 * 5), user_metadata: {} };
    const conta = criarConta({ ...BASE, [CHAVE_ORIGEM_CONTA]: { tipo: "nova", em: horasAtras(24 * 5), versao: "1.0.19", regra: "x" } });
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u1:nova");
  });

  it("RevenueCat 'novas+admin' explícito: conta nova vê a nova", async () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "novas+admin" }));
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    expect(viuAntiga.v).toBe(false);
  });

  it("RevenueCat 'off' guardado: conta nova fica com a Home de hoje (desligar de emergência)", async () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "off" }));
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true));
    expect(nova()).toBe(false);
  });
});

describe("conta ANTIGA no app: nunca a Home nova (só o admin)", () => {
  beforeEach(() => { auth.user = { id: "u1", email: "x@x.com", created_at: horasAtras(24 * 200), user_metadata: {} }; });

  it("RevenueCat sem resposta: Home de hoje, em toda abertura, sem nenhum nó da nova", async () => {
    const conta = criarConta(BASE);
    for (let i = 0; i < 2; i++) {
      await abrir(conta);
      await waitFor(() => expect(antiga()).toBe(true));
      await respirar(50);
      expect(nova()).toBe(false);
      fechar();
    }
    expect(conta.estado.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "antiga" }));
  });

  it("conta antiga com marcador 'antiga' na conta + data recente forjada: antiga", async () => {
    auth.user = { id: "u1", email: "x@x.com", created_at: horasAtras(1), user_metadata: {} };
    const conta = criarConta({ ...BASE, [CHAVE_ORIGEM_CONTA]: { tipo: "antiga" } });
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true));
    expect(nova()).toBe(false);
  });

  it("novas+admin: o dono (admin) com conta antiga vê a nova (o cliente antigo: o teste acima)", async () => {
    registrarHomeNovaRemoto(offerings({ home_nova: "novas+admin" }));
    adminMock.resposta = true;
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(nova()).toBe(true));
    expect(homeNovaLigadaSincrona("u1")).toBe(true);
  });
});

describe("site (navegador): a Home do site não muda", () => {
  it("conta nova no site: Home de hoje, nada decidido nem gravado", async () => {
    plat.nativo = false;
    const conta = criarConta(BASE);
    await abrir(conta);
    await waitFor(() => expect(antiga()).toBe(true));
    await respirar(50);
    expect(nova()).toBe(false);
    expect(conta.estado.dados[CHAVE_ORIGEM_CONTA]).toBeUndefined();
    expect(modoHomeNova()).toBe("off");
  });
});
