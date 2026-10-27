/**
 * 1.0.21 — CONQUISTAS COM CALMA NOS 3 PRIMEIROS DIAS (lib/festas-calma, atrás do FLUXO ENXUTO e fixa no modo 1.0.12).
 * REGRA DO DONO (27/10, no lugar da de 1/abertura e 2/dia nas 72 h): dia 1 até 3 festas, dias 2 e 3 até 2 por dia,
 * no máximo 1 por abertura; a figurinha RARA sempre comemora (não conta); o resto entra quieto no álbum; reabrir não
 * repete; do 4º dia em diante, a fila de sempre. O visual das festas não muda.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";

const conta = vi.hoisted(() => ({ criadoEm: "2026-09-26T09:00:00-03:00" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u-calma", created_at: conta.criadoEm, email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

import { UserDataContext } from "@/hooks/use-user-data";
import { MomentosConquistas } from "@/components/conquistas/Momentos";
import { CHAVE_FESTAS_CALMA, MAX_FESTAS_DIAS_2_E_3, MAX_FESTAS_POR_ABERTURA, _novaAberturaFestas, aplicarCalma, calmaDasFestasVale, registrarFestaNaCalma } from "@/lib/festas-calma";

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; }, mexer: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const abrirApp = (store: Store) => {
  _novaAberturaFestas();
  return render(<MemoryRouter initialEntries={["/home"]}><Provedor store={store}><MomentosConquistas contaNova /></Provedor></MemoryRouter>);
};
const espera = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const festa = () => document.querySelector(".cf-chegada");

beforeEach(() => {
  cleanup();
  eventos.length = 0;
  localStorage.clear();
  localStorage.setItem("conquistas2-force", "on"); // as festas de hoje (Conquistas 2 / Codex)
  localStorage.setItem("fluxo-enxuto-force", "on");
  conta.criadoEm = "2026-09-26T09:00:00-03:00";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); cleanup(); });

const gastos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, value: 10 + i, date: "2026-09-26", category: "alimentacao", description: `Gasto ${i}` }));
const rendas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, value: 1000, description: ["Salário", "Freela", "Aluguel"][i] }));
/** 7 coisas que dão figurinha no dia 1, uma de cada vez */
const ACOES: Array<(s: Store) => void> = [
  (s) => s.mexer("finance-expenses", gastos(1)), // Primeira Despesa
  (s) => s.mexer("finance-incomes", rendas(1)), // Primeiro Salário
  (s) => s.mexer("lib-books", [{ status: "lido" }]), // 1º Livro Lido (rara)
  (s) => s.mexer("finance-investments", [{ name: "CDB", type: "cdb", value: 1500 }]), // Investidor
  (s) => s.mexer("finance-incomes", rendas(3)), // + rendas (Reserva de emergência etc.)
  (s) => s.mexer("finance-expenses", gastos(10)), // + gastos
  (s) => s.mexer("finance-investments", [{ name: "CDB", type: "cdb", value: 6000 }, { name: "Tesouro", type: "tesouro", value: 3000 }, { name: "Ações", type: "acoes", value: 3000 }]), // Investidor Pro + Diversificado
];

/** Faz a ação, espera a festa (se vier) e fecha. Devolve se apareceu festa. */
async function fazer(store: Store, acao: (s: Store) => void): Promise<boolean> {
  await act(async () => { acao(store); });
  await espera(2300);
  const f = festa();
  if (!f) return false;
  fireEvent.click(screen.getByRole("button", { name: "Guardar para depois" }));
  await espera(400);
  return true;
}

describe("a regra (pura)", () => {
  it("só com o enxuto e nos 3 primeiros dias da conta", () => {
    const agora = new Date(2026, 8, 26, 10, 0).getTime();
    expect(calmaDasFestasVale("2026-09-26T09:00:00-03:00", agora)).toBe(true);
    expect(calmaDasFestasVale("2026-09-23T09:00:00-03:00", agora)).toBe(false); // 4º dia
    expect(calmaDasFestasVale(null, agora)).toBe(false);
    localStorage.setItem("fluxo-enxuto-force", "off");
    expect(calmaDasFestasVale("2026-09-26T09:00:00-03:00", agora)).toBe(false);
  });
  it("1 por abertura; dias 2–3 até 2 por dia; o que já está na tela fica; marcos não contam", () => {
    _novaAberturaFestas();
    const it = (k: string, tipo = "adesivo") => ({ k, tipo });
    const ap = (fila: Array<{ k: string; tipo: string }>) => aplicarCalma(fila, (i) => i.k, (i) => [i.k], (i) => i.tipo !== "marco", "2026-09-26", 2);
    expect(ap([it("a"), it("b"), it("m", "marco")])).toEqual({ fila: [it("a"), it("m", "marco")], silenciar: ["b"] });
    registrarFestaNaCalma("a", "2026-09-26");
    expect(ap([it("a"), it("c")])).toEqual({ fila: [it("a")], silenciar: ["c"] });
    _novaAberturaFestas();
    expect(ap([it("d")]).fila).toEqual([it("d")]);
    registrarFestaNaCalma("d", "2026-09-26");
    _novaAberturaFestas();
    expect(ap([it("e")])).toEqual({ fila: [], silenciar: ["e"] }); // 2 no dia
    expect(JSON.parse(localStorage.getItem(CHAVE_FESTAS_CALMA)!)).toEqual({ dia: "2026-09-26", n: MAX_FESTAS_DIAS_2_E_3 });
    expect(ap([it("f")]).fila.length).toBe(0);
    expect(aplicarCalma([it("g")], (i) => i.k, (i) => [i.k], () => true, "2026-09-27", 3).fila.length).toBe(MAX_FESTAS_POR_ABERTURA); // dia novo
    // dia 1 da conta: o 3º ainda passa
    _novaAberturaFestas();
    expect(aplicarCalma([it("h")], (i) => i.k, (i) => [i.k], () => true, "2026-09-26", 1).fila.length).toBe(1);
  });
});

describe("conta nova faz 7 coisas que dão figurinha no dia 1", () => {
  it("dia 1: no máximo 1 festa comum por abertura e 3 no dia; a rara sempre comemora; o resto entra quieto; reabrir não repete", { timeout: 60_000 }, async () => {
    const store = montarStore({ "core-user-name": "Ana" });
    let r = abrirApp(store);
    await espera(2000);
    expect(festa()).toBeNull(); // linha de base: nada
    const comunsPorAbertura: number[] = [];
    const comuns = () => eventos.filter(([e, d]) => e === "festa_view" && d.raridade === "comum").length;
    const raras = () => eventos.filter(([e, d]) => e === "festa_view" && d.raridade !== "comum").length;
    // 4 aberturas no dia 1, as 7 ações espalhadas
    const lotes = [ACOES.slice(0, 3), ACOES.slice(3, 5), ACOES.slice(5, 6), ACOES.slice(6)];
    for (const [i, lote] of lotes.entries()) {
      if (i > 0) { r.unmount(); r = abrirApp(store); await espera(2000); if (festa()) { fireEvent.click(screen.getByRole("button", { name: "Guardar para depois" })); await espera(400); } }
      const antes = comuns();
      for (const a of lote) await fazer(store, a);
      comunsPorAbertura.push(comuns() - antes);
    }
    r.unmount();
    expect(comunsPorAbertura.every((n) => n <= 1)).toBe(true);
    expect(comuns()).toBeLessThanOrEqual(3);
    expect(comuns()).toBeGreaterThanOrEqual(2);
    expect(raras()).toBeGreaterThanOrEqual(1); // "1º Livro Lido" (rara) comemora mesmo com a comum da abertura já vista
    // tudo o que destravou está "visto" (no álbum, esperando ser colado) — nada vira festa atrasada
    const vistas = (store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos;
    expect(vistas).toEqual(expect.arrayContaining(["first-expense", "first-income", "leitura-1", "investor-1k"]));
    // mais uma abertura sem fazer nada: nenhuma festa repete
    const total = eventos.filter(([e]) => e === "festa_view").length;
    r = abrirApp(store);
    await espera(2600);
    expect(festa()).toBeNull();
    r.unmount();
    expect(eventos.filter(([e]) => e === "festa_view")).toHaveLength(total);
  });

  it("fora da calma (4º dia da conta): a fila de sempre (mais de 1 festa por abertura)", { timeout: 30_000 }, async () => {
    conta.criadoEm = "2026-09-20T09:00:00-03:00";
    const store = montarStore({ "core-user-name": "Ana" });
    const r = abrirApp(store);
    await espera(2000);
    let n = 0;
    for (const a of ACOES.slice(0, 3)) if (await fazer(store, a)) n++;
    expect(n).toBeGreaterThan(1);
    r.unmount();
  });
});
