/**
 * 1.0.19 — A PÍLULA DO FOGO CHAPADO e a FOLHA DA SEQUÊNCIA da Home nova (home-nova/e/PilulaFogoE + FolhaSequencia):
 *   · o toque na pílula abre a folha (não vai mais pra Conquistas): título, "N dias", a semana real, o estado;
 *   · dia GARANTIDO: fogo aceso, "Hoje já conta." + a próxima faixa (fraseDaProximaFaixa);
 *   · dia NÃO garantido: fogo apagado, "Pra continuar hoje: <ação do dia>" leva pra fazer (evento + rota da ação);
 *   · "Ver conquistas" leva pra /conquistas com origem home; eventos sequencia_folha_aberta / sequencia_folha_acao.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
const auth = vi.hoisted(() => ({ user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} }, session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {} }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, { select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q, abortSignal: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }), update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r) });
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) }, auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u1" } } } }), resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) }, channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn() } };
});

import HomePage from "@/pages/Home";
import { CHAVE_FORCA_HOME_NOVA, _zerarHomeNova } from "@/lib/home-nova";
import { localDayKey, semanaAtualId } from "@/lib/utils";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

const hoje = localDayKey();
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDayKey(d); };
const base = (anotados: string[]): Dados => ({
  "core-user-name": "João Victor", "core-onboarding-done": "true", "core-all-modules-celebrated": "true",
  "rotina-habits": ["Água de manhã", "Ler 10 min"], "rotina-habits-week": semanaAtualId(),
  "core-dias-anotados": anotados, "core-hub-streak": { count: anotados.length, lastDate: anotados[anotados.length - 1] },
  // a ação do dia nasce dos módulos vivos nos últimos 14 dias: hábitos marcados em dias recentes = Rotina viva
  "rotina-habit-log": Object.fromEntries(anotados.map((d) => [d, ["Água de manhã"]])),
});
const Sonda = () => { const { pathname, state } = useLocation(); return <div data-testid="sonda" data-rota={pathname} data-origem={(state as { origem?: string } | null)?.origem ?? ""} />; };
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const montar = async (dados: Dados) => {
  const n = criarNuvem(dados);
  render(<MemoryRouter initialEntries={["/home"]}><n.Provedor><Routes><Route path="/home" element={<HomePage />} /><Route path="*" element={<div data-testid="outra" />} /></Routes><Sonda /></n.Provedor></MemoryRouter>);
  await respirar(30);
  await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
  return n;
};

beforeAll(() => { prepararJsdom(); Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; _zerarHomeNova(); localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on"); });
afterEach(() => { cleanup(); document.body.className = ""; });

describe("Home nova — pílula do fogo e folha da sequência", () => {
  it("dia garantido: fogo aceso; o toque abre a folha com os dias, a semana real e 'Hoje já conta' + a próxima faixa", async () => {
    await montar(base([diasAtras(1), hoje]));
    const pilula = screen.getByTestId("hn-pilula-fogo");
    expect(pilula.getAttribute("data-fogo")).toBe("aceso");
    // 26/10: o fogo unificado (components/fogo) — a faixa e o estado no invólucro, o desenho do Codex dentro
    expect(pilula.querySelector("[data-testid='fg-seq'][data-fogo='aceso'][data-faixa='ambar'] svg.core-fire[data-tone='amber'][data-status='done']")).toBeTruthy();
    expect(screen.getByTestId("hn-pilula-dias").textContent).toBe("2");
    fireEvent.click(pilula);
    await waitFor(() => expect(screen.getByTestId("he-folha-sequencia")).toBeTruthy());
    expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"); // não foi pra Conquistas
    // 26/10: a folha unificada (components/fogo/FolhaSequencia — a mesma das Conquistas), vinda da Home
    expect(screen.getByTestId("he-folha-sequencia").getAttribute("data-origem")).toBe("home");
    expect(screen.getByText(/dias seguidos/)).toBeTruthy();
    expect(screen.getByTestId("he-seq-dias").textContent).toBe("2");
    expect(screen.queryByTestId("he-seq-recorde")).toBeNull(); // recorde = sequência atual: não mostra
    const dias = Array.from(document.querySelectorAll('[data-testid="he-seq-dia"]'));
    expect(dias).toHaveLength(7);
    const deHoje = dias.find((d) => d.getAttribute("data-hoje") === "1");
    expect(deHoje?.getAttribute("data-estado")).toBe("feito");
    expect(dias.filter((d) => d.getAttribute("data-estado") === "feito").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("he-seq-garantido").textContent).toContain("Hoje já conta.");
    // a próxima faixa nos nomes da sequência das Conquistas (paleta do caderno): com 2 dias, o petróleo vem aos 3
    expect(screen.getByTestId("he-seq-garantido").textContent).toContain("Falta 1 dia pro fogo petróleo");
    expect(screen.queryByTestId("he-seq-acao")).toBeNull();
    expect(eventos.some(([e, d]) => e === "sequencia_folha_aberta" && d.garantido === true && d.dias === 2 && d.origem === "home")).toBe(true);
    // a evolução com as figurinhas da sequência, aberta no próximo marco (3 dias), e os protetores numa linha
    expect(screen.getByTestId("he-seq-evolucao").getAttribute("data-destaque")).toBe("sequencia-3");
    expect(screen.getByTestId("he-seq-protetores").textContent).toMatch(/protetor/);
    expect(screen.queryByText(/Últimas 4 semanas/)).toBeNull();
  });

  it("dia NÃO garantido: fogo apagado; a folha mostra 'Pra continuar hoje: <ação do dia>' e o toque leva pra fazer", async () => {
    await montar(base([diasAtras(2), diasAtras(1)]));
    const pilula = screen.getByTestId("hn-pilula-fogo");
    expect(pilula.getAttribute("data-fogo")).toBe("apagado");
    expect(pilula.classList.contains("he-acende")).toBe(false);
    fireEvent.click(pilula);
    await waitFor(() => expect(screen.getByTestId("he-folha-sequencia").getAttribute("data-garantido")).toBe("0"));
    const deHoje = Array.from(document.querySelectorAll('[data-testid="he-seq-dia"]')).find((d) => d.getAttribute("data-hoje") === "1");
    expect(deHoje?.getAttribute("data-estado")).toBe("hoje"); // o anel tracejado
    const acao = screen.getByTestId("he-seq-acao");
    expect(acao.textContent).toContain("Pra continuar hoje");
    expect(screen.queryByTestId("he-seq-garantido")).toBeNull();
    fireEvent.click(acao);
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).not.toBe("/home"));
    const ev = eventos.find(([e]) => e === "sequencia_folha_acao");
    expect(ev).toBeTruthy();
    expect(String(ev![1].destino)).toBe(screen.getByTestId("sonda").getAttribute("data-rota"));
  });

  it("tocar numa figurinha da evolução leva pras Conquistas ampliando ela (state.figurinha, origem home)", async () => {
    await montar(base([hoje]));
    fireEvent.click(screen.getByTestId("hn-pilula-fogo"));
    await waitFor(() => expect(screen.getAllByTestId("he-seq-marco").length).toBeGreaterThan(0));
    const marcos = screen.getAllByTestId("he-seq-marco");
    expect(marcos.length).toBeGreaterThanOrEqual(5); // 1 · 3 · 7 · 14 · 30 · 100 (sem o "Voltei")
    fireEvent.click(marcos[0]);
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/conquistas"));
    expect(screen.getByTestId("sonda").getAttribute("data-origem")).toBe("home");
    expect(eventos.some(([e, d]) => e === "sequencia_folha_acao" && d.acao === "figurinha" && d.origem === "home")).toBe(true);
  });

  it("sem sequência: fogo neutro e a folha diz 0 dias", async () => {
    await montar(base([]));
    expect(screen.getByTestId("hn-pilula-fogo").getAttribute("data-fogo")).toBe("neutro");
    fireEvent.click(screen.getByTestId("hn-pilula-fogo"));
    await waitFor(() => expect(screen.getByTestId("he-seq-dias").textContent).toBe("0"));
  });
});
