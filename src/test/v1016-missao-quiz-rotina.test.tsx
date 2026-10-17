/**
 * 1.0.16 (17/10) — A 1ª DOSE DE QUEM ESCOLHEU ROTINA, na Rotina DE VERDADE (pages/Rotina) com a missão de verdade
 * (MissaoDosesNaWeb), conta VAZIA, nos dois braços:
 *   · o quiz "Rotina pronta em 3 toques" (ramo v1016-rotina) abre por cima, SÓ como 1ª dose — nada da missão por cima
 *     dele (nem post-it, nem o "Pular" da faixa), `<html data-montar-rotina="missao">` e `<html data-missao-dose="1">`;
 *   · marcou o 1º quadradinho no guia da própria tela → a dose está feita (a comemoração entra na hora, uma só);
 *   · "Entendi" sem marcar → o post-it da missão segue no mesmo quadradinho ("Sua rotina está pronta. Marca o
 *     primeiro quando fizer.") e marcar fecha a dose;
 *   · "Pular" no quiz → nunca mais (a missão guarda) e a dose guiada simples; fechar o app no meio → volta 1 vez só.
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const auth = vi.hoisted(() => ({ user: { id: "u-mq", created_at: "" } as { id: string; created_at?: string } }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: auth.user, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- o encadeamento do cliente do Supabase, mockado
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
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoSePuder: async () => false, pedirAvaliacaoPorMissao: vi.fn(async () => true) }));
vi.mock("@/lib/notificacoes", async (orig) => ({
  ...(await orig<typeof import("@/lib/notificacoes")>()),
  estadoPermissao: vi.fn(async () => "prompt"),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu"),
  armarLembreteDoTesteSePuder: vi.fn(async () => false),
  agendarProximaDose: vi.fn(async () => ({ ok: false, motivo: "sem_plugin" })),
}));
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", () => ({ ConstruiuEm3Dias: () => <div data-testid="construiu">O que você construiu</div> }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { CHAVE_ESTADO_MISSAO_DOSES, definirDonoDaMissao, iniciarMissao, lerMissao, MAX_VISTAS_DO_SETUP } from "@/lib/missao-doses";
import { registrarUmPorDiaRemoto, _zerarUmPorDiaRemoto, CHAVE_BRACO_DIA1 } from "@/lib/dia1-cheio";
import { _novaAberturaMontarRotina, _zerarRemotaMontarRotina, ATRIBUTO_NA_TELA } from "@/lib/montar-rotina";
import Rotina from "@/pages/Rotina";

const UID = "u-mq";
const HOJE = new Date(2026, 9, 17, 15, 0); // sábado 17/10/2026, 15h
const HOJE_DIA = "2026-10-17";
type ComCapacitor = { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } };

/** Store em memória que grava o cache local como o provider real (o mesmo molde do montar-rotina.test). */
const Provedor = ({ store, children }: { store: { atual: Record<string, unknown> }; children?: React.ReactNode }) => {
  const [dados, setDados] = useState<Record<string, unknown>>(() => ({ ...store.atual }));
  const ref = useRef(store);
  const get = useCallback(<T,>(k: string, fb: T): T => (k in dados ? (dados[k] as T) : fb), [dados]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current.atual = { ...ref.current.atual, [k]: JSON.parse(JSON.stringify(v ?? null)) };
    try { localStorage.setItem(`u:${UID}:${k}`, JSON.stringify(v)); } catch { /* noop */ }
    setDados((prev) => ({ ...prev, [k]: v }));
  }, []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const montar = (store: { atual: Record<string, unknown> }) => render(
  <MemoryRouter initialEntries={["/rotina"]}>
    <Provedor store={store}>
      <MissaoDosesNaWeb />
      <Routes>
        <Route path="/rotina" element={<><Rotina /><Rota /></>} />
        <Route path="*" element={<Rota />} />
      </Routes>
    </Provedor>
  </MemoryRouter>,
);
const respirar = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tela = () => within(screen.getByTestId("montar-minha-rotina"));
const linhaDeHoje = () => screen.getAllByText("SÁBADO").map((el) => el.closest("tr")).find(Boolean)!;
const ligar = (braco: "A" | "B") => {
  registrarUmPorDiaRemoto({ current: { identifier: "default", metadata: { missao_1_por_dia: braco === "A" ? "on" : "ab" } }, all: {} });
  if (braco === "B") localStorage.setItem(CHAVE_BRACO_DIA1, "B");
};
const missaoNaRotina = (braco: "A" | "B") =>
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], HOJE_DIA, undefined, braco), boasVindas: true }));
/** 7h → Beber água + Treinar → (lembrete) Agora não → Montar minha rotina */
const responder = async () => {
  await waitFor(() => expect(tela().getByRole("button", { name: "7h" })).toBeTruthy(), { timeout: 4000 });
  await respirar();
  fireEvent.click(tela().getByRole("button", { name: "7h" }));
  await waitFor(() => expect(tela().getByText("O que não pode faltar no seu dia?")).toBeTruthy());
  for (const n of ["Beber água", "Treinar"]) fireEvent.click(tela().getByRole("button", { name: n }));
  fireEvent.click(tela().getByRole("button", { name: "Continuar" }));
  await waitFor(() => expect(tela().getByText("Quer um lembrete de manhã?")).toBeTruthy());
  fireEvent.click(tela().getByRole("button", { name: "Agora não" }));
  fireEvent.click(tela().getByRole("button", { name: "Montar minha rotina" }));
  await respirar();
};

beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  window.scrollBy = (() => {}) as typeof window.scrollBy;
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
  definirDonoDaMissao(null);
  _zerarUmPorDiaRemoto();
  _zerarRemotaMontarRotina();
  _novaAberturaMontarRotina();
  vi.stubEnv("VITE_V14_LOJA", "1");
  auth.user = { id: UID, created_at: new Date(HOJE.getTime() - 2 * 3600e3).toISOString() };
  (window as unknown as ComCapacitor).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as ComCapacitor).Capacitor;
  vi.useRealTimers();
  document.documentElement.removeAttribute(ATRIBUTO_NA_TELA);
});

describe("a 1ª dose da Rotina = 'Rotina pronta em 3 toques' (os dois braços, conta vazia, Rotina de verdade)", () => {
  for (const braco of ["A", "B"] as const) {
    it(`braço ${braco}: o quiz abre sozinho (nada da missão por cima), o guia da própria tela leva ao 1º quadradinho, marcar = a dose — a comemoração entra uma vez`, async () => {
      ligar(braco);
      missaoNaRotina(braco);
      const store = { atual: {} as Record<string, unknown> };
      montar(store);
      await waitFor(() => expect(screen.getByTestId("montar-minha-rotina")).toBeTruthy(), { timeout: 4000 });
      expect(document.documentElement.getAttribute(ATRIBUTO_NA_TELA)).toBe("missao");
      expect(document.documentElement.getAttribute("data-missao-dose")).toBe("1");
      expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0);
      expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "setup", setup: "montar-rotina", acao: "view" })]);
      await responder();
      await waitFor(() => expect(screen.getByTestId("montar-rotina-postit")).toBeTruthy(), { timeout: 4000 });
      expect(screen.queryByTestId("missao-doses-festa")).toBeNull(); // criar os hábitos NÃO é a dose
      fireEvent.click(within(linhaDeHoje().children[1] as HTMLElement).getByRole("checkbox"));
      await respirar();
      await waitFor(() => expect(screen.getByTestId("missao-doses-festa")).toBeTruthy(), { timeout: 6000 });
      if (braco === "A") {
        expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
        expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("“Beber água” já está na sua Rotina, com o quadradinho de hoje marcado.");
        expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã: 💰 Finanças · 10 s"); // em 2º, Finanças é o gasto de hoje
      } else {
        expect(screen.getByTestId("missao-doses-agora-o")).toHaveTextContent("Agora as Finanças — 10 s");
      }
      const m = lerMissao()!;
      expect(m.feitos[1]).toMatchObject({ dia: HOJE_DIA, rotulo: "Beber água" });
      expect(m.setupVistas?.["montar-rotina"]).toBe(1);
      expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "setup", setup: "montar-rotina", acao: "feito", dose_no_pronto: true })]);
      expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    });
  }

  it("'Entendi' no guia sem marcar: o post-it da MISSÃO segue no mesmo quadradinho (com o nome do 1º hábito) e marcar fecha a dose", { timeout: 30_000 }, async () => {
    ligar("A");
    missaoNaRotina("A");
    montar({ atual: {} });
    await waitFor(() => expect(screen.getByTestId("montar-minha-rotina")).toBeTruthy(), { timeout: 4000 });
    await responder();
    await waitFor(() => expect(screen.getByRole("button", { name: "Entendi" })).toBeTruthy(), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await respirar();
    // (no jsdom nada tem tamanho: a missão procura o alvo ~5 s e segue com o post-it solto — fail-open)
    await waitFor(() => expect(screen.getAllByTestId("demo-guia-postit").length).toBeGreaterThan(0), { timeout: 9000 });
    const postIt = screen.getAllByTestId("demo-guia-postit").at(-1)!;
    expect(postIt).toHaveTextContent("Sua rotina está pronta. Marca o primeiro quando fizer.");
    expect(postIt).toHaveTextContent("É o quadradinho de hoje, na coluna de Beber água.");
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    fireEvent.click(within(linhaDeHoje().children[1] as HTMLElement).getByRole("checkbox"));
    await respirar();
    await waitFor(() => expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅"), { timeout: 6000 });
    expect(lerMissao()?.feitos[1]?.rotulo).toBe("Beber água");
  });

  it("'Pular' no quiz: a missão guarda (nunca mais), a dose guiada simples (criar o 1º hábito) — e reabrir não mostra o quiz", { timeout: 30_000 }, async () => {
    ligar("A");
    missaoNaRotina("A");
    montar({ atual: {} });
    await waitFor(() => expect(screen.getByTestId("montar-minha-rotina")).toBeTruthy(), { timeout: 4000 });
    await respirar();
    fireEvent.click(tela().getByRole("button", { name: /Pular/ }));
    await respirar();
    expect(lerMissao()?.setupPulado?.["montar-rotina"]).toBe(HOJE_DIA);
    await waitFor(() => expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).toHaveTextContent("Qual hábito você quer começar hoje?"), { timeout: 9000 });
    cleanup();
    _novaAberturaMontarRotina();
    montar({ atual: {} });
    await waitFor(() => expect(screen.getAllByTestId("demo-guia-postit").length).toBeGreaterThan(0), { timeout: 9000 });
    expect(screen.queryByTestId("montar-minha-rotina")).toBeNull();
  });

  it("fechou o app no meio do quiz: volta 1 vez; na 3ª abertura sem decidir, a dose guiada simples (nunca insiste)", { timeout: 30_000 }, async () => {
    ligar("A");
    missaoNaRotina("A");
    for (let abertura = 1; abertura <= MAX_VISTAS_DO_SETUP; abertura++) {
      _novaAberturaMontarRotina();
      montar({ atual: {} });
      await waitFor(() => expect(screen.getByTestId("montar-minha-rotina")).toBeTruthy(), { timeout: 4000 });
      cleanup();
    }
    expect(lerMissao()?.setupVistas?.["montar-rotina"]).toBe(MAX_VISTAS_DO_SETUP);
    _novaAberturaMontarRotina();
    montar({ atual: {} });
    await waitFor(() => expect(screen.getAllByTestId("demo-guia-postit").length).toBeGreaterThan(0), { timeout: 9000 });
    expect(screen.queryByTestId("montar-minha-rotina")).toBeNull();
  });
});
