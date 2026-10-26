/**
 * P1 DA VARREDURA "NOVATO" (26/10, BLOQUEAVA A LOJA) — o CADASTRO DENTRO DO APP caía na Home ANTIGA pra sempre.
 *
 * A ordem do bug (log do Simulador): cadastro → no render em que o convidado vira conta, o `loaded` ainda era o do
 * convidado (o provider só zera no efeito dele) → a MissaoDosesNaWeb criava a missão (com o dono desta conta) → só
 * então a conta era lida → OrigemDaConta via essa missão como "missão de antes" → origem "antiga" gravada na conta →
 * Home antiga, tour antigo, pontos de graça.
 *
 * Consertado nas duas pontas (e provado aqui, braços A e B):
 *   a) a missão só nasce com a conta DESTA pessoa lida (contaCarregadaDeVerdade) — a origem é decidida antes;
 *   b) só a missão SEM o carimbo `criadaNa` (de antes da 1.0.19) conta como "missão de antes" — quem começou o teste na
 *      1.0.18 continua "antiga".
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const plat = vi.hoisted(() => ({ nativo: true }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plat.nativo, plataformaApp: () => (plat.nativo ? "ios" : "web"), isIOS: () => plat.nativo, isAndroid: () => false,
}));
vi.mock("@/lib/att-ios", async (orig) => ({ ...(await orig<typeof import("@/lib/att-ios")>()), pedirRastreamentoIos: async () => "nao_ios" }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/notificacoes", async (orig) => ({
  ...(await orig<typeof import("@/lib/notificacoes")>()),
  agendarReguaDaMissao: vi.fn(async () => {}), pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu"), agendarProximaDose: vi.fn(async () => ({ ok: true })),
}));
type Usuario = { id: string; email: string; created_at?: string; user_metadata: Record<string, unknown> };
const auth = vi.hoisted(() => ({
  user: null as Usuario | null,
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, useAuthOpcional: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
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
import { OrigemDaContaNaSessao, decidirOrigemDaConta } from "@/components/home-nova/OrigemDaConta";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import { __zerarPilhaDaBarraVidro } from "@/components/home-nova/e/BarraVidroGlobal";
import { CHAVE_ORIGEM_APARELHO, CHAVE_ORIGEM_CONTA, _zerarHomeNova } from "@/lib/home-nova";
import { CHAVE_ESTADO_MISSAO_DOSES, CHAVE_MISSAO_NA_CONTA, MISSAO_CRIADA_NA, definirDonoDaMissao, donoDaConta, iniciarMissao, lerMissao, missaoDeAntesDa1019 } from "@/lib/missao-doses";
import { guardarForcaDia1Cheio } from "@/lib/dia1-cheio";
import { localDayKey } from "@/lib/utils";
import { prepararJsdom } from "./compat-comum";

const horasAtras = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const hoje = localDayKey();

/* ---------------- a nuvem com `loaded`/`contaCompleta` controláveis, como o UserDataProvider de verdade:
   convidado = loaded true + contaCompleta false (o provider devolve false sem user); a troca pra conta acontece com o
   `loaded` do convidado ainda true (o provider só zera no efeito dele), depois loaded false, depois a conta chega. */
function criarNuvem() {
  const estado = { dados: {} as Record<string, unknown>, loaded: true, contaCompleta: false };
  let acordar = () => {};
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [n, subir] = useReducer((x: number) => x + 1, 0);
    acordar = subir;
    const retrato = estado.dados;
    const get = useCallback(<T,>(k: string, f: T): T => (estado.loaded && k in retrato ? (retrato[k] as T) : f), [retrato, n]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v ?? null)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(
      () => ({ get, set, loaded: estado.loaded, contaCompleta: auth.user ? estado.contaCompleta : false, isGuest: !auth.user, fetchKey: async () => null }),
      [get, set, n], // eslint-disable-line react-hooks/exhaustive-deps
    );
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const mudar = (p: Partial<typeof estado>, usuario?: Usuario | null) => act(() => { if (usuario !== undefined) auth.user = usuario; Object.assign(estado, p); acordar(); });
  return { estado, Provedor, mudar };
}
type Nuvem = ReturnType<typeof criarNuvem>;

const viu = { antiga: false, tour: false };
let vigia: MutationObserver | null = null;
const olhar = () => {
  if (document.querySelector('[data-tour="acoes-rapidas"]')) viu.antiga = true;
  const t = document.querySelector('[data-tour="score"], [data-testid="tour-popup"], [data-testid="tour-veu"], [data-camada-guia="tour-home"]');
  if (t) viu.tour = true;
};
const nova = () => !!document.querySelector('[data-layout="e"]');
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));

/** o funil do app (/app): o convidado está aqui; depois do cadastro o app leva pra /home */
const ir = { para: (_r: string) => {} };
const Funil = () => { const navigate = useNavigate(); ir.para = (r) => navigate(r); return <div data-testid="funil">funil</div>; };
/** O App: a origem na sessão e a missão ANTES das rotas (a ordem do App de verdade), a Home em /home. */
const abrirApp = async (nuvem: Nuvem, rota = "/home") => {
  viu.antiga = false; viu.tour = false;
  vigia?.disconnect(); vigia = new MutationObserver(olhar); vigia.observe(document.body, { childList: true, subtree: true, attributes: true });
  render(
    <MemoryRouter initialEntries={[rota]}>
      <nuvem.Provedor>
        <OrigemDaContaNaSessao />
        <MissaoDosesNaWeb />
        <Routes><Route path="/home" element={<HomePage />} /><Route path="/app" element={<Funil />} /><Route path="*" element={<div />} /></Routes>
      </nuvem.Provedor>
    </MemoryRouter>,
  );
  await respirar(30);
};
const fechar = () => { cleanup(); vigia?.disconnect(); _zerarHomeNova(); _zerarConsultaAdmin(); __zerarPilhaDaBarraVidro(); };

/** o cadastro dentro do app: convidado → (mesmo render) conta com o loaded do convidado → loaded false → a conta chega */
const cadastrar = async (nuvem: Nuvem, usuario: Usuario) => {
  await nuvem.mudar({}, usuario);         // a troca: user já é a conta nova, `loaded` ainda é o do convidado
  await respirar(30);
  await nuvem.mudar({ loaded: false });   // o efeito do provider zera
  await respirar(30);
  await nuvem.mudar({ loaded: true, contaCompleta: true }); // a conta (vazia) chega
  await respirar(60);
  await act(async () => { ir.para("/home"); });      // "Tá dentro" → Home
  await respirar(30);
};

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); eventos.length = 0;
  _zerarHomeNova(); _zerarConsultaAdmin(); __zerarPilhaDaBarraVidro();
  plat.nativo = true; auth.user = null;
  definirDonoDaMissao(undefined);
});
afterEach(() => { fechar(); document.body.className = ""; });

const NOVA_CONTA: Usuario = { id: "u-novo", email: "nova@exemplo.com.br", created_at: "", user_metadata: {} };

describe.each([["a"], ["b"]])("cadastro DENTRO do app, braço %s da missão", (braco) => {
  it("origem 'nova', Home nova sem um quadro da antiga, sem tour antigo, sem pontos de graça — e a missão nasce (com dono e carimbo) depois da origem", async () => {
    guardarForcaDia1Cheio(`?dia1-cheio=${braco}`);
    const nuvem = criarNuvem();
    await abrirApp(nuvem, "/app"); // convidado no funil
    expect(lerMissao()).toBeNull();
    await cadastrar(nuvem, { ...NOVA_CONTA, created_at: horasAtras(0.05) });

    // a origem: "nova", na conta e no aparelho
    await waitFor(() => expect(nuvem.estado.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "nova" })));
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u-novo:nova");

    // a missão funciona: nasceu, é desta conta, do braço pedido, carimbada — e a cópia subiu pra conta
    await waitFor(() => expect(lerMissao()).not.toBeNull());
    const m = lerMissao()!;
    expect(m.dono).toBe(donoDaConta("u-novo"));
    expect(m.braco).toBe(braco.toUpperCase());
    expect(m.criadaNa).toBe(MISSAO_CRIADA_NA);
    expect(m.inicio).toBe(hoje);
    await waitFor(() => expect(nuvem.estado.dados[CHAVE_MISSAO_NA_CONTA]).toEqual(expect.objectContaining({ dono: donoDaConta("u-novo") })));
    expect(eventos.some(([n]) => n === "missao_doses_inicio")).toBe(true);

    // a Home: a nova, nunca a antiga, sem tour antigo; score sem os pontos de graça (conta vazia = 0)
    await waitFor(() => expect(nova()).toBe(true));
    expect(viu.antiga).toBe(false);
    expect(viu.tour).toBe(false);
    const numero = document.querySelector('[data-testid="he-score-numero"]');
    if (numero) expect(numero.textContent?.trim()).toBe("0");

    // fechar e reabrir: continua nova (a missão carimbada não muda a decisão)
    fechar();
    await abrirApp(nuvem);
    await waitFor(() => expect(nova()).toBe(true));
    expect(viu.antiga).toBe(false);
    expect(nuvem.estado.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "nova" }));
  });
});

describe("a missão espera a conta desta pessoa (MissaoDosesNaWeb)", () => {
  it("no render de troca (loaded do convidado) a missão NÃO nasce; nasce quando a conta chega", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=b");
    const nuvem = criarNuvem();
    await abrirApp(nuvem, "/app");
    await nuvem.mudar({}, { ...NOVA_CONTA, created_at: horasAtras(0.05) });
    await respirar(60);
    expect(lerMissao()).toBeNull();
    expect(nuvem.estado.dados[CHAVE_ORIGEM_CONTA]).toBeUndefined();
    await nuvem.mudar({ loaded: false });
    await nuvem.mudar({ loaded: true, contaCompleta: true });
    await waitFor(() => expect(lerMissao()).not.toBeNull());
  });

  it("2ª leitura da conta que falha (contaCompleta volta a false com loaded true) não some com a missão já lida", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=a");
    const nuvem = criarNuvem();
    await abrirApp(nuvem, "/app");
    await cadastrar(nuvem, { ...NOVA_CONTA, created_at: horasAtras(0.05) });
    await waitFor(() => expect(lerMissao()).not.toBeNull());
    await nuvem.mudar({ contaCompleta: false });
    await respirar(30);
    expect(lerMissao()).not.toBeNull();
  });
});

describe("a regra da origem: 'missão de antes' = missão SEM o carimbo da 1.0.19", () => {
  // iniciarMissao também grava no aparelho: aqui só se quer o objeto (o aparelho começa limpo em cada caso)
  const missao = (extra: Record<string, unknown>) => { const m = iniciarMissao(["financas", "rotina", "saude"], hoje); localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES); return { ...m, boasVindas: true, ...extra }; };

  it("missão local desta conta CRIADA na 1.0.19 (carimbada): conta < 48 h continua 'nova'", () => {
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(missao({ dono: donoDaConta("u5"), braco: "B", criadaNa: MISSAO_CRIADA_NA })));
    expect(decidirOrigemDaConta({ id: "u5", created_at: horasAtras(1) }, (_k, f) => f).origem).toBe("nova");
  });

  it("cópia carimbada na conta: 'nova'", () => {
    const copia = missao({ dono: donoDaConta("u6"), braco: "A", criadaNa: MISSAO_CRIADA_NA });
    const get = <T,>(k: string, f: T): T => (k === CHAVE_MISSAO_NA_CONTA ? (copia as T) : f);
    expect(decidirOrigemDaConta({ id: "u6", created_at: horasAtras(3) }, get).origem).toBe("nova");
  });

  it("quem começou o teste na 1.0.18 (missão SEM carimbo, local ou na conta): continua 'antiga'", () => {
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(missao({ dono: donoDaConta("u7"), braco: "B" })));
    expect(decidirOrigemDaConta({ id: "u7", created_at: horasAtras(20) }, (_k, f) => f).origem).toBe("antiga");
    localStorage.clear(); _zerarHomeNova();
    const copia = missao({ dono: donoDaConta("u8"), braco: "A" });
    const get = <T,>(k: string, f: T): T => (k === CHAVE_MISSAO_NA_CONTA ? (copia as T) : f);
    expect(decidirOrigemDaConta({ id: "u8", created_at: horasAtras(20) }, get).origem).toBe("antiga");
  });

  it("marcador 'antiga' já gravado na conta nunca é reclassificado (cliente antigo nunca vira 'nova')", () => {
    const get = <T,>(k: string, f: T): T => (k === CHAVE_ORIGEM_CONTA ? ({ tipo: "antiga", versao: "1.0.19" } as T) : f);
    expect(decidirOrigemDaConta({ id: "u9", created_at: horasAtras(1) }, get).origem).toBe("antiga");
  });

  it("missaoDeAntesDa1019", () => {
    expect(missaoDeAntesDa1019(null)).toBe(false);
    expect(missaoDeAntesDa1019(missao({}) as never)).toBe(true);
    expect(missaoDeAntesDa1019(missao({ criadaNa: "1.0.19" }) as never)).toBe(false);
  });
});
