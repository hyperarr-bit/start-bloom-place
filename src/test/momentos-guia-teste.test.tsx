/**
 * Festa de adesivo × tutorial/Missão do teste (28/09). Na 1.0.7 a festa em tela cheia caía 0,8 s
 * depois do "Primeiro registro feito! Dia 1 da missão" e cobria a tela — e o toast "1º dia da sua
 * sequência" ainda ia por cima do "Continuar". O teste grátis converte bem SEM festa (1.0.6):
 *  - durante a Missão: nenhuma festa, o adesivo cola quieto;
 *  - camada de guia na tela (tutorial, holofote): a festa espera ela sair;
 *  - conta nova (< 24 h): uma festa só por vez;
 *  - o toast da sequência não entra por cima de festa, guia ou diálogo.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: () => {} }));
const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock("sonner", () => ({ toast: Object.assign((t: string) => { toasts.push(t); }, { success: () => {}, error: () => {} }) }));

import { UserDataContext } from "@/hooks/use-user-data";
import { MomentosConquistas } from "@/components/conquistas/Momentos";
import { avisarSequencia } from "@/components/conquistas/aviso-sequencia";
import { somarDias } from "@/lib/sequencia";

const HOJE = "2026-09-26";
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));
function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
// "Primeira Despesa" e "Primeiro Salário" abertos e ainda não comemorados
const cenario = () => ({
  "core-user-name": "Ana",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 2),
  "conquistas-desbloqueadas": { "leitura-1": "2026-09-21" },
  "conquistas-vistas": { adesivos: ["leitura-1"], marcos: [] },
  "finance-expenses": [{ id: 1, value: 10, date: "2026-09-26" }],
  "finance-incomes": [{ id: 1, value: 3000 }],
  "lib-books": [{ status: "lido" }],
});
const montar = (store: ReturnType<typeof montarStore>, contaNova = false) =>
  render(<MemoryRouter initialEntries={["/financas"]}><Provedor store={store}><MomentosConquistas contaNova={contaNova} /></Provedor></MemoryRouter>);
const espera = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  toasts.length = 0;
  nativo.v = false;
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); document.querySelectorAll("[data-camada-guia],[data-momento-falso]").forEach((e) => e.remove()); });

describe("festa do adesivo × teste grátis e tutorial", () => {
  it("durante a Missão do teste: nenhuma festa; os adesivos entram como vistos (igual à 1.0.6)", async () => {
    nativo.v = true;
    localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 3 * 86400e3));
    localStorage.setItem("core-missao", JSON.stringify({ inicio: Date.now(), area: "dinheiro", d1: false, d2: false, d3: false, vista: true, holofote: "feito" }));
    const store = montarStore(cenario());
    montar(store);
    await espera(2400);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    await waitFor(() => expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toEqual(expect.arrayContaining(["first-expense", "first-income"])));
  });

  it("camada de guia na tela: a festa espera; quando ela sai, aparece", async () => {
    const guia = document.createElement("div");
    guia.setAttribute("data-camada-guia", "spotlight");
    document.body.appendChild(guia);
    montar(montarStore(cenario()));
    await espera(2200);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    guia.remove();
    expect(await screen.findByTestId("momento-adesivo", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("conta nova: uma festa só — o outro adesivo cola quieto", async () => {
    const store = montarStore(cenario());
    montar(store, true);
    expect(await screen.findByTestId("momento-adesivo", {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(screen.queryByTestId("momento-adesivo")).toBeNull());
    await espera(2200);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toEqual(expect.arrayContaining(["first-expense", "first-income"]));
  });

  it("toast da sequência: some se já tem festa/guia/diálogo na tela; sozinho, aparece", async () => {
    const festa = document.createElement("div");
    festa.setAttribute("data-momento", "");
    festa.setAttribute("data-momento-falso", "");
    document.body.appendChild(festa);
    avisarSequencia(1);
    await espera(2600);
    expect(toasts).toEqual([]);
    festa.remove();
    avisarSequencia(1);
    await espera(2600);
    expect(toasts).toEqual(["🔥 1º dia da sua sequência"]);
  });
});
