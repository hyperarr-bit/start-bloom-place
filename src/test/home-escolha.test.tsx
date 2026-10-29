/**
 * ESCOLHA DA HOME (1.0.22, dono 28/10 — lib/home-nova › ESCOLHA DA HOME, components/home-nova/EscolhaDaHome):
 *   · a regra pura (a escolha vence a origem; "off"/"admin" no iPhone e o Android ignoram; a força de QA vence tudo);
 *   · o convite "Tem uma Home nova": 1x por conta, só na clássica, nunca no 1º dia, nunca por cima de outra camada;
 *   · "Experimentar" troca pra nova e grava na CONTA; FECHAR E REABRIR o app não traz o convite de volta (regra da casa);
 *   · a escolha vale entre aparelhos (vem com a conta); Android sem convite e sem linha; a cor volta na clássica.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const plat = vi.hoisted(() => ({ p: "web" as "web" | "ios" | "android" }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plat.p !== "web", plataformaApp: () => plat.p, isIOS: () => plat.p === "ios", isAndroid: () => plat.p === "android",
}));
vi.mock("@/lib/att-ios", async (orig) => ({ ...(await orig<typeof import("@/lib/att-ios")>()), pedirRastreamentoIos: async () => "nao_ios" }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} } as { id: string; email: string; created_at?: string; user_metadata: Record<string, unknown> },
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
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn(),
    },
  };
});

import HomePage from "@/pages/Home";
import Voce from "@/pages/Voce";
import { ThemeProvider } from "@/hooks/use-theme";
import { OrigemDaContaNaSessao } from "@/components/home-nova/OrigemDaConta";
import { _zerarConviteNestaAbertura } from "@/components/home-nova/EscolhaDaHome";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import {
  CHAVE_FORCA_HOME_NOVA, CHAVE_HOME_CONVITE, CHAVE_HOME_CONVITE_APARELHO, CHAVE_HOME_ESCOLHA, CHAVE_HOME_ESCOLHA_APARELHO, CHAVE_HOME_NOVA_APARELHO,
  CHAVE_ORIGEM_APARELHO, _zerarHomeNova, deveConvidarHomeNova, escolhaConhecida, homeNovaLigada, homeNovaLigadaSincrona, lerEscolhaDaHome, registrarEscolhaDaHome,
} from "@/lib/home-nova";
import { registrarMomentoRuim } from "@/lib/momento-ruim";
import { localDayKey } from "@/lib/utils";
import { criarNuvem, prepararJsdom, type Dados, type Nuvem } from "./compat-comum";

const hoje = localDayKey();
const BASE: Dados = {
  "core-user-name": "Ana", "core-onboarding-done": "true", "core-all-modules-celebrated": "true", "gamification-lastCheckIn": hoje,
};
const Sonda = () => { const { pathname } = useLocation(); return <div data-testid="sonda" data-rota={pathname} />; };
const Arvore = ({ n, rota }: { n: Nuvem; rota: string }) => (
  <ThemeProvider>
    <MemoryRouter initialEntries={[rota]}>
      <n.Provedor>
        <OrigemDaContaNaSessao />
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/voce" element={<Voce />} />
        </Routes>
        <Sonda />
      </n.Provedor>
    </MemoryRouter>
  </ThemeProvider>
);
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
/** Uma "abertura do app": zera o que vive em memória (como um app que acabou de abrir) e monta a árvore. */
const abrir = async (n: Nuvem, rota = "/home") => {
  _zerarHomeNova(); _zerarConsultaAdmin(); _zerarConviteNestaAbertura();
  const r = render(<Arvore n={n} rota={rota} />);
  await respirar(30);
  return r;
};
const classica = () => !document.querySelector('[data-layout="e"]') && !!document.querySelector('[data-testid="sonda"]');
const nova = () => !!document.querySelector('[data-layout="e"]');
const ESPERA = { timeout: 6000 };

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  window.confirm = () => false;
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); eventos.length = 0; plat.p = "ios"; // 1.0.22: a escolha é só do app do iPhone
  auth.user = { ...auth.user, created_at: "2026-08-01T12:00:00Z" };
});
afterEach(() => { cleanup(); document.querySelectorAll("[data-teste-camada]").forEach((e) => e.remove()); });

/* ------------------------------------------------------------------ a regra pura */

describe("a regra (lib/home-nova)", () => {
  const base = { userId: "u1", contaCarregada: true, ligada: false, escolha: null, conviteNaConta: null, criadoEm: "2026-08-01T12:00:00Z" };
  // 1.0.22 (dono 28/10): o convite/a escolha só existem pra conta ANTIGA confirmada
  beforeEach(() => { localStorage.setItem(CHAVE_ORIGEM_APARELHO, "u1:antiga"); _zerarHomeNova(); });
  it("conta NOVA (já na Home nova) e origem desconhecida nunca veem o convite", () => {
    localStorage.setItem(CHAVE_ORIGEM_APARELHO, "u1:nova"); _zerarHomeNova();
    expect(deveConvidarHomeNova(base)).toBe(false);
    localStorage.removeItem(CHAVE_ORIGEM_APARELHO); _zerarHomeNova();
    expect(deveConvidarHomeNova(base)).toBe(false);
    expect(homeNovaLigada(false, null, "classica")).toBe(false); // desconhecida: a escolha não vale (a regra de origem decide)
  });
  it("o convite: só conta logada, na clássica, sem escolha, sem convite visto, fora do 1º dia e sem aviso de cobrança recente", () => {
    expect(deveConvidarHomeNova(base)).toBe(true);
    expect(deveConvidarHomeNova({ ...base, convidado: true })).toBe(false);
    expect(deveConvidarHomeNova({ ...base, contaCarregada: false })).toBe(false);
    expect(deveConvidarHomeNova({ ...base, ligada: true })).toBe(false); // conta nova / já na nova
    expect(deveConvidarHomeNova({ ...base, escolha: "classica" })).toBe(false);
    expect(deveConvidarHomeNova({ ...base, conviteNaConta: { em: "x", resposta: "agora-nao" } })).toBe(false);
    expect(deveConvidarHomeNova({ ...base, criadoEm: new Date(Date.now() - 3 * 3600e3).toISOString() })).toBe(false); // 1º dia
    expect(deveConvidarHomeNova({ ...base, diaDaConta: hoje, diaDeHoje: hoje })).toBe(false);
    expect(deveConvidarHomeNova({ ...base, momentoRuim: true })).toBe(false); // cartão recusado tem prioridade
    localStorage.setItem(CHAVE_HOME_CONVITE_APARELHO, "u9,u1");
    expect(deveConvidarHomeNova(base)).toBe(false); // já viu neste aparelho
  });
  it("plataforma: iPhone sim; Android nunca; iPhone com a chave remota 'off' ou 'admin', nunca", () => {
    const base2 = { ...base };
    plat.p = "ios"; _zerarHomeNova();
    expect(deveConvidarHomeNova(base2)).toBe(true);
    plat.p = "android"; _zerarHomeNova();
    expect(deveConvidarHomeNova(base2)).toBe(false);
    plat.p = "ios"; _zerarHomeNova(); localStorage.setItem(CHAVE_HOME_NOVA_APARELHO, "off");
    expect(deveConvidarHomeNova(base2)).toBe(false);
    _zerarHomeNova(); localStorage.setItem(CHAVE_HOME_NOVA_APARELHO, "admin");
    expect(deveConvidarHomeNova(base2)).toBe(false);
  });
  it("a escolha vence a origem só na conta ANTIGA (antiga→nova); conta nova fica na nova; 'off' no iPhone, o Android e a força de QA mandam mais", () => {
    plat.p = "ios"; _zerarHomeNova();
    expect(homeNovaLigada(false, "antiga", null)).toBe(false);
    expect(homeNovaLigada(false, "antiga", "nova")).toBe(true);
    expect(homeNovaLigada(false, "nova", null)).toBe(true);
    expect(homeNovaLigada(false, "nova", "classica")).toBe(true); // dono 28/10: conta NOVA é só a Home nova — a escolha não vale pra ela
    localStorage.setItem(CHAVE_HOME_NOVA_APARELHO, "off"); _zerarHomeNova();
    expect(homeNovaLigada(false, "antiga", "nova")).toBe(false); // desligar de emergência
    localStorage.clear(); plat.p = "android"; _zerarHomeNova();
    expect(homeNovaLigada(false, "antiga", "nova")).toBe(false); // Android: a Home de sempre
    plat.p = "web"; _zerarHomeNova();
    expect(homeNovaLigada(null, null, "nova")).toBe(false); // 1.0.22: no site a escolha não vale (só iPhone nesta versão)
  });
  it("o formato gravado: objeto { home, em, via } (e a palavra solta); lixo = nada; o espelho é por conta", () => {
    expect(lerEscolhaDaHome({ home: "nova", em: "x", via: "voce" })).toBe("nova");
    expect(lerEscolhaDaHome("classica")).toBe("classica");
    expect(lerEscolhaDaHome({ home: 1 })).toBeNull();
    expect(lerEscolhaDaHome(null)).toBeNull();
    _zerarHomeNova();
    registrarEscolhaDaHome("u1", "nova");
    expect(localStorage.getItem(CHAVE_HOME_ESCOLHA_APARELHO)).toBe("u1:nova");
    _zerarHomeNova(); // outra abertura: o espelho segura até a conta chegar
    expect(escolhaConhecida("u1")).toBe("nova");
    expect(escolhaConhecida("u2")).toBeNull();
    expect(homeNovaLigadaSincrona("u1")).toBe(true);
  });
});

/* ------------------------------------------------------------------ na tela */

describe("o convite na Home clássica (site)", () => {
  it("aparece 1x, grava na conta e no aparelho; 'Experimentar' troca pra nova e grava a escolha; REABRIR não traz o convite e a nova fica", async () => {
    const n = criarNuvem(BASE);
    await abrir(n);
    expect(classica()).toBe(true);
    expect(screen.queryByTestId("home-convite")).toBeNull(); // espera a Home assentar
    await waitFor(() => expect(screen.getByTestId("home-convite")).toBeTruthy(), ESPERA);
    expect(screen.getByText("Tem uma Home nova")).toBeTruthy();
    expect(screen.getByText(/Dá pra voltar quando quiser em Você/)).toBeTruthy();
    expect(n.ler<{ resposta: string }>(CHAVE_HOME_CONVITE).resposta).toBe("visto");
    expect(localStorage.getItem(CHAVE_HOME_CONVITE_APARELHO)).toBe("u1");
    expect(eventos.filter(([e]) => e === "home_escolha_convite_visto")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("home-convite-experimentar"));
    await waitFor(() => expect(nova()).toBe(true), ESPERA);
    expect(n.ler<{ home: string; via: string }>(CHAVE_HOME_ESCOLHA)).toMatchObject({ home: "nova", via: "convite" });
    expect(eventos.find(([e]) => e === "home_escolha")?.[1]).toEqual({ de: "classica", para: "nova", via: "convite" });

    // fechar e REABRIR o app
    cleanup();
    await abrir(n);
    await waitFor(() => expect(nova()).toBe(true), ESPERA);
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
    expect(eventos.filter(([e]) => e === "home_escolha_convite_visto")).toHaveLength(1);
  });

  it("'Agora não' fecha e fica na clássica; reabrir (mesmo com o aparelho limpo — outro celular) não mostra de novo", async () => {
    const n = criarNuvem(BASE);
    await abrir(n);
    await waitFor(() => expect(screen.getByTestId("home-convite")).toBeTruthy(), ESPERA);
    fireEvent.click(screen.getByTestId("home-convite-agora-nao"));
    await waitFor(() => expect(screen.queryByTestId("home-convite")).toBeNull());
    expect(classica()).toBe(true);
    expect(n.ler<{ resposta: string }>(CHAVE_HOME_CONVITE).resposta).toBe("agora-nao");
    expect(n.ler(CHAVE_HOME_ESCOLHA)).toBeUndefined();
    cleanup();
    localStorage.clear(); // outro aparelho: só a conta sabe
    await abrir(n);
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
    expect(classica()).toBe(true);
  });

  it("FECHAR o app com o convite na tela (sem responder) não o repete na próxima abertura", async () => {
    const n = criarNuvem(BASE);
    await abrir(n);
    await waitFor(() => expect(screen.getByTestId("home-convite")).toBeTruthy(), ESPERA);
    cleanup();
    await abrir(n);
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
  });

  it("nunca por cima de outra camada: com uma folha aberta ele espera; a folha sai, ele aparece", async () => {
    const outra = document.createElement("div");
    outra.setAttribute("role", "dialog"); outra.setAttribute("data-teste-camada", "");
    document.body.appendChild(outra);
    const n = criarNuvem(BASE);
    await abrir(n);
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
    expect(n.ler(CHAVE_HOME_CONVITE)).toBeUndefined(); // não conta como visto
    outra.remove();
    await waitFor(() => expect(screen.getByTestId("home-convite")).toBeTruthy(), ESPERA);
  });

  it("sem convite no 1º dia da conta, nem depois de um aviso de cobrança (cartão recusado tem prioridade)", async () => {
    auth.user = { ...auth.user, created_at: new Date(Date.now() - 2 * 3600e3).toISOString() };
    const n = criarNuvem(BASE);
    await abrir(n);
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
    cleanup();
    auth.user = { ...auth.user, created_at: "2026-08-01T12:00:00Z" };
    registrarMomentoRuim("aviso_cobranca_view");
    await abrir(n);
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
  });
});

describe("a escolha entre aparelhos, o Android, a chave remota e a cor", () => {
  it("a escolha 'nova' feita em outro aparelho vem com a conta: este aparelho (limpo) abre direto na nova, sem convite", async () => {
    const n = criarNuvem({ ...BASE, [CHAVE_HOME_ESCOLHA]: { home: "nova", em: "2026-10-28T10:00:00Z", via: "voce" } });
    await abrir(n);
    await waitFor(() => expect(nova()).toBe(true), ESPERA);
    expect(localStorage.getItem(CHAVE_HOME_ESCOLHA_APARELHO)).toBe("u1:nova");
    await respirar(2900);
    expect(screen.queryByTestId("home-convite")).toBeNull();
  });

  it("iPhone, conta antiga: o convite aparece; com `home_nova` = 'off' no RevenueCat, nem convite nem a escolha valem", async () => {
    plat.p = "ios";
    const n = criarNuvem(BASE);
    await abrir(n);
    await waitFor(() => expect(screen.getByTestId("home-convite")).toBeTruthy(), ESPERA);
    cleanup();
    const n2 = criarNuvem({ ...BASE, [CHAVE_HOME_ESCOLHA]: { home: "nova", em: "x", via: "voce" } });
    localStorage.clear();
    localStorage.setItem(CHAVE_HOME_NOVA_APARELHO, "off");
    await abrir(n2);
    await respirar(2900);
    expect(classica()).toBe(true);
    expect(screen.queryByTestId("home-convite")).toBeNull();
  });

  it("Android: nem convite, nem a linha 'Home' no menu da conta — e uma escolha 'nova' de outro aparelho é ignorada", async () => {
    plat.p = "android";
    const n = criarNuvem({ ...BASE, [CHAVE_HOME_ESCOLHA]: { home: "nova", em: "x", via: "voce" } });
    await abrir(n);
    await respirar(2900);
    expect(classica()).toBe(true);
    expect(screen.queryByTestId("home-convite")).toBeNull();
    fireEvent.click(screen.getByLabelText("Minha conta"));
    await waitFor(() => expect(screen.getByTestId("menu-novo")).toBeTruthy());
    expect(screen.queryByTestId("menu-home")).toBeNull();
  });

  it("a linha 'Home' fica SEMPRE no menu da conta (clássica) e em Você (nova); trocar pra Clássica devolve a cor da pessoa", async () => {
    localStorage.setItem("core-theme-palette", "rose");
    const n = criarNuvem({ ...BASE, [CHAVE_HOME_CONVITE]: { em: "x", resposta: "agora-nao" } });
    await abrir(n);
    // clássica: o menu da conta tem "Home · Clássica" → escolher Nova
    fireEvent.click(screen.getByLabelText("Minha conta"));
    await waitFor(() => expect(screen.getByTestId("home-escolha-estado").textContent).toBe("Clássica"));
    fireEvent.click(screen.getByTestId("menu-home"));
    await waitFor(() => expect(screen.getByTestId("home-escolha-painel")).toBeTruthy());
    expect(screen.getByTestId("home-escolha-classica").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("home-escolha-nova"));
    await waitFor(() => expect(nova()).toBe(true), ESPERA);
    expect(eventos.find(([e]) => e === "home_escolha")?.[1]).toEqual({ de: "classica", para: "nova", via: "voce" });
    await waitFor(() => expect(localStorage.getItem("core-theme-palette")).toBe("default")); // a nova força o Original
    expect(n.ler<string>("core-cor-antes-home-nova")).toBe("rose");

    // Você (nova): "Home · Nova" → Clássica; volta pra /home clássica com a cor de antes
    cleanup();
    await abrir(n, "/voce");
    await waitFor(() => expect(screen.getByTestId("voce-home").textContent).toContain("Nova"), ESPERA);
    fireEvent.click(screen.getByTestId("voce-home"));
    await waitFor(() => expect(screen.getByTestId("home-escolha-classica")).toBeTruthy());
    fireEvent.click(screen.getByTestId("home-escolha-classica"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"), ESPERA);
    await waitFor(() => expect(classica()).toBe(true), ESPERA);
    expect(n.ler<{ home: string }>(CHAVE_HOME_ESCOLHA).home).toBe("classica");
    await waitFor(() => expect(localStorage.getItem("core-theme-palette")).toBe("rose"));
    expect(eventos.filter(([e]) => e === "home_escolha").at(-1)?.[1]).toEqual({ de: "nova", para: "classica", via: "voce" });
  });
});
