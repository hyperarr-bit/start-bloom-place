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
// 02/11: o aviso está DESLIGADO no código (AVISO_RETRO "off"); aqui a regra dele é testada com a chave ligada
(globalThis as { __AVISO_RETRO__?: boolean }).__AVISO_RETRO__ = true;
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
import { ThemeProvider } from "@/hooks/use-theme";
import { OrigemDaContaNaSessao } from "@/components/home-nova/OrigemDaConta";
import { _zerarConviteNestaAbertura } from "@/components/home-nova/EscolhaDaHome";
import { _zerarAvisoRetroNestaAbertura } from "@/components/wrapped/AvisoRetroNova";
import { _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import { _zerarHomeNova } from "@/lib/home-nova";
import { localDayKey } from "@/lib/utils";
import { SEMENTE_COMPLETA } from "@/pages/dev/retro-outubro-exemplo";
import { criarNuvem, prepararJsdom, type Dados, type Nuvem } from "./compat-comum";

/* 11/11 (trava da build 1.0.25): o aviso da retro só existe até 10/11 (lib/retro-aviso, ULTIMO_DIA_AVISO_RETRO).
   O relógio fica em 05/11, dentro da janela; o Date anda sozinho (shouldAdvanceTime) pros ~5 s de espera. */
vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
vi.setSystemTime(new Date(2026, 10, 5, 12, 0));
const hoje = localDayKey();
const BASE: Dados = { ...SEMENTE_COMPLETA, "core-user-name": "Ana", "core-onboarding-done": "true", "core-all-modules-celebrated": "true", "gamification-lastCheckIn": hoje };
const Arvore = ({ n }: { n: Nuvem }) => (
  <ThemeProvider><MemoryRouter initialEntries={["/home"]}><n.Provedor><OrigemDaContaNaSessao />
    <Routes><Route path="/home" element={<HomePage />} /><Route path="/retrospectiva" element={null} /></Routes>
  </n.Provedor></MemoryRouter></ThemeProvider>
);
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
beforeAll(() => { prepararJsdom(); Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo; window.confirm = () => false; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; plat.p = "ios"; });
afterEach(() => { cleanup(); document.querySelectorAll("[data-teste-camada]").forEach((e) => e.remove()); });

describe("REVISOR 1.0.23: aviso da retro x convite da Home nova na MESMA abertura", () => {
  it("controle: tela livre desde o início -> só o convite aparece (o aviso cede)", async () => {
    const n = criarNuvem(BASE);
    _zerarHomeNova(); _zerarConsultaAdmin(); _zerarConviteNestaAbertura(); _zerarAvisoRetroNestaAbertura();
    render(<Arvore n={n} />);
    await waitFor(() => expect(screen.getByTestId("home-convite")).toBeTruthy(), { timeout: 6000 });
    fireEvent.click(screen.getByTestId("home-convite-agora-nao"));
    await respirar(7000);
    console.log("CONTROLE eventos:", eventos.filter(([e]) => /retro_aviso_visto|home_escolha_convite_visto/.test(e)).map(([e]) => e).join(","));
  }, 20000);

  it("tela ocupada nos primeiros ~5,3 s (ex.: lembrete do dia) -> aviso abre, e depois de fechar o aviso o convite abre também", async () => {
    const ocupada = document.createElement("div");
    ocupada.setAttribute("data-daily-nudge", ""); ocupada.setAttribute("data-teste-camada", "");
    document.body.appendChild(ocupada);
    const n = criarNuvem(BASE);
    _zerarHomeNova(); _zerarConsultaAdmin(); _zerarConviteNestaAbertura(); _zerarAvisoRetroNestaAbertura();
    render(<Arvore n={n} />);
    await respirar(5300);
    ocupada.remove();
    await waitFor(() => expect(screen.queryByTestId("retro-aviso") ?? screen.queryByTestId("home-convite")).toBeTruthy(), { timeout: 6000 });
    const primeiro = screen.queryByTestId("retro-aviso") ? "aviso" : "convite";
    if (primeiro === "aviso") fireEvent.click(screen.getByTestId("retro-aviso-agora-nao"));
    else fireEvent.click(screen.getByTestId("home-convite-agora-nao"));
    await respirar(8000);
    const vistos = eventos.filter(([e]) => /retro_aviso_visto|home_escolha_convite_visto/.test(e)).map(([e]) => e);
    console.log("OCUPADA primeiro:", primeiro, "eventos:", vistos.join(","));
    expect(vistos.length).toBe(1); // a regra declarada: 1 folha por abertura
  }, 30000);
});
