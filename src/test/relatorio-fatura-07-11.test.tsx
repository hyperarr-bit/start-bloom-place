/**
 * RELATÓRIOS FECHA COM O PRÓPRIO CARD "DESPESAS" (bug "relatorio-fatura", 07/11).
 *
 * Nubank fecha dia 25. TV de R$ 1.000 no crédito em 28/10 = fatura de NOVEMBRO; Cinema R$ 60 no crédito
 * em 26/11 = fatura de DEZEMBRO. O card "Despesas" do relatório seguia a regra da fatura (R$ 1.000), mas
 * "Despesas por Categoria", a lista "Despesas (n)" e o TOTAL do CSV somavam os gastos CRUS do balde
 * (só o Cinema, R$ 60). E a conta avulsa do MEU MÊS (Netflix R$ 40, 17/10) entrava no card escondida
 * dentro do "dia a dia", que era calculado por subtração.
 *
 * Conserto: o Index passa `despesasDoMes` (variaveisMes.noMes, a mesma lista do Dashboard e dos LIMITES)
 * e `contasAvulsas`; o relatório monta categorias, lista e CSV com elas. `expenses` cru fica só pro
 * ImportExtrato.
 *
 * Rodar com: npx vitest run src/test/relatorio-fatura-07-11.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const UID = "u-relatorio-fatura";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-relatorio-fatura", created_at: "2026-10-01T00:00:00.000Z" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const q: any = {
        select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, gte: () => q, lte: () => q,
        maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
        update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
      };
      return q;
    },
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));
vi.mock("@/lib/avaliacao", async (orig) => ({
  ...(await orig<typeof import("@/lib/avaliacao")>()),
  pedirAvaliacaoSePuder: vi.fn(async () => false),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Index from "@/pages/Index";

const hoje = new Date(2026, 10, 7, 10); // 07/11/2026 — mês da tela: 2026-11
const cartoes = { nubank: { closingDay: 25, dueDay: 5 } };
const mercado = { id: "mercado", description: "Mercado", category: "mercado", value: 200, date: "2026-10-10", paymentMethod: "pix" };
const tv = { id: "tv", description: "TV", category: "eletronicos", value: 1000, date: "2026-10-28", paymentMethod: "credito", cardName: "nubank" };
const cinema = { id: "cinema", description: "Cinema", category: "lazer", value: 60, date: "2026-11-26", paymentMethod: "credito", cardName: "nubank" };
const salario = { id: "sal", description: "Salário", value: 3000, date: "2026-11-05" };

const dados: Record<string, unknown> = {
  "finance-card-config": cartoes,
  "finance-2026-outubro-expenses": [mercado, tv],
  "finance-expenses": [cinema],
  "finance-incomes": [salario],
  "spotlight-done-financas": "true",
};
const lsKey = (k: string) => `u:${UID}:${k}`;

/* ── provider de mentira: store em memória (o que o Index e a Home leem) ── */
const Provedor = ({ inicial, loaded = true, children }: { inicial: Record<string, unknown>; loaded?: boolean; children?: ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const getS = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => {
    ref.current = { ...ref.current, [k]: v };
    localStorage.setItem(lsKey(k), JSON.stringify(v));
    setStore((prev) => ({ ...prev, [k]: v }));
  }, []);
  const valor = useMemo<UserDataContextType>(
    () => ({ get: getS, set, loaded, isGuest: false, fetchKey: async () => null }), [getS, set, loaded],
  );
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {}; // o chat do Pergunte ao CORE rola sozinho
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(hoje);
  localStorage.clear();
  // os leitores de localStorage (Comparação, Balanço, retrospectiva sem `ler`) leem pelo id do usuário
  for (const [k, v] of Object.entries(dados)) localStorage.setItem(lsKey(k), JSON.stringify(v));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });


const abrirIndex = (inicial: Record<string, unknown>) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(inicial)) localStorage.setItem(lsKey(k), JSON.stringify(v));
  return render(
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={inicial} loaded={false}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
};

/** O CSV que o botão baixa no site (blob do <a download>). */
const baixarCSV = async (botao: RegExp): Promise<string> => {
  let blob: Blob | null = null;
  const criar = vi.fn((b: Blob) => { blob = b; return "blob:teste"; });
  const urlOriginal = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = criar as never;
  URL.revokeObjectURL = (() => {}) as never;
  const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    fireEvent.click(screen.getByRole("button", { name: botao }));
    await vi.waitFor(() => expect(criar).toHaveBeenCalled());
  } finally {
    clique.mockRestore();
    URL.createObjectURL = urlOriginal.create;
    URL.revokeObjectURL = urlOriginal.revoke;
  }
  return await new Promise<string>((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.readAsText(blob as unknown as Blob);
  });
};

const reaisDoTexto = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));

describe("RELATÓRIOS de novembro (TV 28/10 = fatura de nov.; Cinema 26/11 = fatura de dez.)", () => {
  it("categorias, lista e TOTAL do CSV somam o card Despesas (R$ 1.000)", async () => {
    abrirIndex(dados);
    fireEvent.click(screen.getByRole("button", { name: /RELATÓRIOS/ }));
    const rel = document.getElementById("monthly-report") as HTMLElement;
    const cardDespesas = within(rel).getByText("Despesas").parentElement as HTMLElement;
    expect(cardDespesas.textContent).toMatch(/1\.000,00/);

    const grade = within(rel).getByText("Despesas por Categoria").parentElement!.querySelector(".grid") as HTMLElement;
    expect(grade.textContent).toMatch(/Eletr.nicos/);  // a TV conta em novembro
    expect(grade.textContent).not.toMatch(/Lazer/);    // o cinema é da fatura de dezembro
    const somaCategorias = Array.from(grade.children).reduce((s, el) => s + reaisDoTexto(el.lastElementChild?.textContent ?? ""), 0);
    expect(somaCategorias).toBe(1000);

    expect(within(rel).getByText("Despesas (1)")).toBeInTheDocument();
    expect(within(rel).getByText("TV")).toBeInTheDocument();
    expect(within(rel).queryByText("Cinema")).not.toBeInTheDocument();
    expect(within(rel).getByTestId("despesas-composicao").textContent)
      .toBe("Despesas = custos fixos R$ 0,00 + dia a dia R$ 1.000,00 + parcelas R$ 0,00");

    const csv = await baixarCSV(/^Despesas$/);
    expect(csv).toMatch(/TOTAL;;;1000,00;;/);
    expect(csv).not.toMatch(/Cinema/);
  });

  it("a conta avulsa do MEU MÊS vira linha própria: card = categorias = CSV = R$ 1.040", async () => {
    abrirIndex({
      ...dados,
      "finance-dueDays": [{ day: 15, color: "slate", bills: [{ id: "net", name: "Netflix", value: 40, paid: true }] }],
    });
    fireEvent.click(screen.getByRole("button", { name: /RELATÓRIOS/ }));
    const rel = document.getElementById("monthly-report") as HTMLElement;
    const cardDespesas = within(rel).getByText("Despesas").parentElement as HTMLElement;
    expect(cardDespesas.textContent).toMatch(/1\.040,00/);
    expect(within(rel).getByTestId("despesas-composicao").textContent)
      .toBe("Despesas = custos fixos R$ 0,00 + dia a dia R$ 1.000,00 + parcelas R$ 0,00 + contas avulsas R$ 40,00");

    const grade = within(rel).getByText("Despesas por Categoria").parentElement!.querySelector(".grid") as HTMLElement;
    const somaCategorias = Array.from(grade.children).reduce((s, el) => s + reaisDoTexto(el.lastElementChild?.textContent ?? ""), 0);
    expect(somaCategorias).toBe(1040);
    expect(within(rel).getByText("Despesas (2)")).toBeInTheDocument();
    expect(within(rel).getByText("Netflix")).toBeInTheDocument();

    const csv = await baixarCSV(/^Despesas$/);
    expect(csv).toMatch(/Conta;"Netflix"/);
    expect(csv).toMatch(/TOTAL;;;1040,00;;/);
  });
});
