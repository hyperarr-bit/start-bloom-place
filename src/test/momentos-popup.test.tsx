/**
 * ADESIVO COMUM EM POPUP (01/10, pedido do dono): o comum abre num cartão
 * central com confete (não tela cheia), com "Ver em tela cheia" e "Continuar";
 * vários comuns juntos = UM popup em carrossel; raro+ segue em tela cheia; e
 * nada aparece no meio de um registro (campo com foco / folha aberta).
 * Medição: festa_view {raridade, formato}, festa_fechada {ms, como}, festa_tela_cheia_click.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); },
}));
vi.mock("@/lib/native-shell", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));

import { UserDataContext } from "@/hooks/use-user-data";
import { MomentosConquistas, formatoDaFesta, registroEmAndamento } from "@/components/conquistas/Momentos";
import { somarDias } from "@/lib/sequencia";

const HOJE = "2026-09-26";
const dia = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
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
const base = () => ({
  "core-user-name": "Ana",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 2),
  "conquistas-desbloqueadas": { "leitura-1": "2026-09-21" },
  "conquistas-vistas": { adesivos: ["leitura-1"], marcos: [] },
  "lib-books": [{ status: "lido" }],
});
// 1 comum: Primeira Despesa
const umComum = () => ({ ...base(), "finance-expenses": [{ id: 1, value: 10, date: HOJE }] });
// 3 comuns: Primeira Despesa + Primeiro Salário + Lista de Desejos
const tresComuns = () => ({ ...umComum(), "finance-incomes": [{ id: 1, value: 3000, date: dia(5) }], "finance-wishlist": [{ id: "w1", name: "Fone", price: 300, savedAmount: 0 }] });
// 1 raro (Múltiplas Rendas) + 2 comuns (Primeiro Salário, Primeira Despesa)
const raroEComuns = () => ({ ...umComum(), "finance-incomes": [{ id: 1, description: "Salário", value: 3000, date: dia(5) }, { id: 2, description: "Freela", value: 100, date: dia(6) }, { id: 3, description: "Aluguel", value: 100, date: dia(7) }] });

const montar = (store: ReturnType<typeof montarStore>, contaNova = false, rota = "/financas") =>
  render(<MemoryRouter initialEntries={[rota]}><Provedor store={store}><MomentosConquistas contaNova={contaNova} /></Provedor></MemoryRouter>);
const espera = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const vistas = (store: ReturnType<typeof montarStore>) => (store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos;

beforeEach(() => {
  eventos.length = 0;
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });

describe("formato da festa pela raridade", () => {
  it("comum = popup; raro, épico e lendário = tela cheia", () => {
    expect(formatoDaFesta({ xp: 50 })).toBe("popup");
    expect(formatoDaFesta({ xp: 50, raridade: "comum" })).toBe("popup");
    expect(formatoDaFesta({ xp: 100 })).toBe("tela_cheia");
    expect(formatoDaFesta({ xp: 50, raridade: "epico" })).toBe("tela_cheia");
    expect(formatoDaFesta({ xp: 400 })).toBe("tela_cheia");
  });
});

describe("adesivo comum → popup", () => {
  it("1 comum: cartão central (não tela cheia), com 'Ver em tela cheia' e 'Continuar'; Continuar marca visto e mede festa_fechada", async () => {
    const store = montarStore(umComum());
    montar(store);
    const popup = await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    expect(popup).toHaveTextContent("Primeira Despesa");
    expect(popup).toHaveAttribute("data-quantidade", "1");
    expect(popup).toHaveAttribute("data-momento"); // o toast da sequência fica quieto
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect(screen.getByText("Adesivo novo")).toBeInTheDocument();
    expect(screen.getByTestId("momento-popup-tela-cheia")).toBeInTheDocument();
    expect(eventos).toContainEqual(["festa_view", expect.objectContaining({ raridade: "comum", formato: "popup", quantidade: 1 })]);
    fireEvent.click(screen.getByTestId("momento-popup-continuar"));
    await waitFor(() => expect(vistas(store)).toContain("first-expense"));
    await waitFor(() => expect(screen.queryByTestId("momento-popup")).toBeNull());
    const fechada = eventos.find((e) => e[0] === "festa_fechada")?.[1];
    expect(fechada).toMatchObject({ formato: "popup", como: "continuar", raridade: "comum" });
    expect(typeof fechada?.ms).toBe("number");
  });

  it("3 comuns juntos: UM popup com os 3 em carrossel (não 3 telas seguidas); Continuar marca os 3", async () => {
    const store = montarStore(tresComuns());
    montar(store);
    const popup = await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    expect(popup).toHaveAttribute("data-quantidade", "3");
    expect(screen.getByText("3 adesivos novos")).toBeInTheDocument();
    for (const id of ["first-expense", "first-income", "wishlist"]) expect(within(popup).getByTestId(`momento-popup-item-${id}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo adesivo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo adesivo" }));
    const itens = within(popup).getAllByTestId(/^momento-popup-item-/);
    expect(itens).toHaveLength(3);
    expect(itens[1]).toHaveAttribute("data-ativo");
    expect(itens[0]).not.toHaveAttribute("data-ativo");
    fireEvent.click(screen.getByTestId("momento-popup-continuar"));
    await waitFor(() => expect(vistas(store)).toEqual(expect.arrayContaining(["first-expense", "first-income", "wishlist"])));
    await waitFor(() => expect(screen.queryByTestId("momento-popup")).toBeNull());
    // nenhuma tela cheia depois: era UMA peça só
    await espera(2200);
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect(eventos.filter((e) => e[0] === "festa_view")).toHaveLength(1);
    expect(eventos.find((e) => e[0] === "festa_fechada")?.[1]).toMatchObject({ como: "continuar", quantidade: 3, vistos: 2 });
  });

  it("'Ver em tela cheia' abre a festa de hoje do adesivo (origem popup), mede o clique, e 'Voltar' devolve ao cartão sem marcar visto", async () => {
    const store = montarStore(umComum());
    montar(store);
    await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    fireEvent.click(screen.getByTestId("momento-popup-tela-cheia"));
    const cheia = await screen.findByTestId("momento-adesivo");
    expect(cheia).toHaveTextContent("Primeira Despesa");
    expect(cheia).toHaveAttribute("data-raridade", "comum");
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect(eventos).toContainEqual(["festa_tela_cheia_click", expect.objectContaining({ id: "first-expense", raridade: "comum", quantidade: 1 })]);
    expect(eventos).toContainEqual(["festa_view", expect.objectContaining({ formato: "tela_cheia", origem: "popup", id: "first-expense" })]);
    expect(vistas(store)).not.toContain("first-expense");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByTestId("momento-popup")).toBeInTheDocument();
    expect(vistas(store)).not.toContain("first-expense");
    fireEvent.click(screen.getByTestId("momento-popup-continuar"));
    await waitFor(() => expect(vistas(store)).toContain("first-expense"));
  });

  it("toque fora do cartão também continua (como: fora)", async () => {
    const store = montarStore(umComum());
    montar(store);
    await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    fireEvent.click(screen.getByTestId("momento-popup-fora"));
    await waitFor(() => expect(vistas(store)).toContain("first-expense"));
    expect(eventos.find((e) => e[0] === "festa_fechada")?.[1]).toMatchObject({ como: "fora" });
  });

  it("'Meus adesivos' fora das Conquistas: marca visto e mede como ver_adesivos", async () => {
    const store = montarStore(umComum());
    montar(store);
    await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /Meus adesivos/ }));
    await waitFor(() => expect(vistas(store)).toContain("first-expense"));
    expect(eventos.find((e) => e[0] === "festa_fechada")?.[1]).toMatchObject({ como: "ver_adesivos" });
  });
});

describe("raro, épico e lendário seguem em tela cheia", () => {
  it("raro + 2 comuns: primeiro a tela cheia do raro (festa_view tela_cheia), depois UM popup com os comuns", async () => {
    const store = montarStore(raroEComuns());
    montar(store);
    const cheia = await screen.findByTestId("momento-adesivo", {}, { timeout: 3000 });
    expect(cheia).toHaveTextContent("Múltiplas Rendas");
    expect(cheia).toHaveAttribute("data-raridade", "raro");
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect(eventos).toContainEqual(["festa_view", expect.objectContaining({ raridade: "raro", formato: "tela_cheia", origem: "direto" })]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(vistas(store)).toContain("multi-income"));
    const popup = await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    expect(popup).toHaveAttribute("data-quantidade", "2");
    expect(eventos.find((e) => e[0] === "festa_fechada")?.[1]).toMatchObject({ formato: "tela_cheia", como: "continuar", raridade: "raro" });
  });
});

describe("conta nova", () => {
  it("só 1 comum no popup; os outros 2 colam quietos", async () => {
    const store = montarStore(tresComuns());
    montar(store, true);
    const popup = await screen.findByTestId("momento-popup", {}, { timeout: 3000 });
    expect(popup).toHaveAttribute("data-quantidade", "1");
    const tres = ["first-expense", "first-income", "wishlist"];
    const quietos = tres.filter((id) => vistas(store).includes(id));
    expect(quietos).toHaveLength(2);
    const noPopup = tres.find((id) => !quietos.includes(id))!;
    expect(within(popup).getByTestId(`momento-popup-item-${noPopup}`)).toBeInTheDocument();
  });
  it("com um raro: só a tela cheia dele; os comuns colam quietos", async () => {
    const store = montarStore(raroEComuns());
    montar(store, true);
    expect(await screen.findByTestId("momento-adesivo", {}, { timeout: 3000 })).toHaveTextContent("Múltiplas Rendas");
    expect(vistas(store)).toEqual(expect.arrayContaining(["first-income", "first-expense"]));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await espera(2200);
    expect(screen.queryByTestId("momento-popup")).toBeNull();
  });
});

describe("nunca no meio de um registro", () => {
  it("registroEmAndamento: campo com foco ou folha aberta = em andamento; checkbox não", () => {
    expect(registroEmAndamento()).toBe(false);
    const input = document.createElement("input"); document.body.appendChild(input); input.focus();
    expect(registroEmAndamento()).toBe(true);
    input.blur(); input.remove();
    const check = document.createElement("input"); check.type = "checkbox"; document.body.appendChild(check); check.focus();
    expect(registroEmAndamento()).toBe(false);
    check.remove();
    const folha = document.createElement("div"); folha.setAttribute("role", "dialog"); folha.setAttribute("data-state", "open"); document.body.appendChild(folha);
    expect(registroEmAndamento()).toBe(true);
    folha.remove();
    expect(registroEmAndamento()).toBe(false);
  });

  it("a pessoa está digitando: o popup espera; quando ela sai do campo, aparece", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const store = montarStore(umComum());
    montar(store);
    await espera(2200);
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    input.blur();
    expect(await screen.findByTestId("momento-popup", {}, { timeout: 3000 })).toBeInTheDocument();
    input.remove();
  });
});
