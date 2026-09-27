/**
 * Tela nova de Conquistas (26/09): capa do planner, sequência, folha de
 * adesivos, detalhe; a linha da Home; e os momentos (adesivo novo uma vez só,
 * nunca na 1ª abertura desta versão).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: unknown) => { eventos.push([nome, dados]); },
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { TelaConquistas } from "@/components/conquistas/TelaConquistas";
import { LinhaSequencia } from "@/components/conquistas/LinhaSequencia";
import { MomentosConquistas } from "@/components/conquistas/Momentos";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { somarDias } from "@/lib/sequencia";
import { localDayKey } from "@/lib/utils";
import { ACAO_PADRAO } from "@/lib/conquistas-acao";

const HOJE = "2026-09-26";
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));

/** Store em memória que re-renderiza quem lê (como o provedor de verdade). */
function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const gravacoes: Array<[string, unknown, unknown]> = [];
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown, o?: unknown) => { dados[k] = v; gravacoes.push([k, v, o]); ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, gravacoes, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}

const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  const v = store.valor();
  return <UserDataContext.Provider value={{ ...v }}>{children}</UserDataContext.Provider>;
};

const cenario = (extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
  "conquistas-desbloqueadas": { "sequencia-7": "2026-09-20", "leitura-1": "2026-09-21" },
  "conquistas-vistas": { adesivos: ["sequencia-7", "leitura-1"], marcos: [7] },
  "finance-expenses": [{ id: 1, value: 10, date: "2026-09-20" }, { id: 2, value: 12, date: "2026-09-22" }],
  "lib-books": [{ status: "lido" }],
  ...extra,
});

beforeEach(() => {
  eventos.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("tela de Conquistas", () => {
  const abrir = (store: ReturnType<typeof montarStore>, origem?: string) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/conquistas", state: origem ? { origem } : undefined }]}>
        <Provedor store={store}>
          <Routes>
            <Route path="/conquistas" element={<TelaConquistas />} />
            <Route path="*" element={<p>outra tela</p>} />
          </Routes>
        </Provedor>
      </MemoryRouter>,
    );

  it("mostra a capa, a sequência com protetor e a folha de adesivos", () => {
    expect(localDayKey()).toBe(HOJE);
    abrir(montarStore(cenario()), "home");
    expect(screen.getAllByText("Ana Beatriz").length).toBeGreaterThan(0);
    expect(screen.getByText(/membro desde julho de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/SEQUÊNCIA · 12 DIAS/)).toBeInTheDocument();
    expect(screen.getByText(/1 protetor/)).toBeInTheDocument();
    expect(screen.getByText(/Hoje falta/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "registrar um gasto" })).toBeInTheDocument();
    expect(screen.getByText("MEUS ADESIVOS")).toBeInTheDocument();
    expect(screen.getByText(/de 39/)).toBeInTheDocument();
    expect(eventos).toContainEqual(["conquistas_open", { origem: "home" }]);
  });

  it("origem desconhecida vira 'outro'", () => {
    abrir(montarStore(cenario()));
    expect(eventos).toContainEqual(["conquistas_open", { origem: "outro" }]);
  });

  it("trocar a capa grava conquistas-capa e manda capa_trocar", () => {
    const store = montarStore(cenario());
    abrir(store);
    fireEvent.click(screen.getByRole("radio", { name: "Vichy rosa" }));
    expect(store.dados["conquistas-capa"]).toBe("vichy");
    expect(eventos).toContainEqual(["capa_trocar", { capa: "vichy" }]);
    expect(screen.getByRole("radio", { name: "Vichy rosa" })).toHaveAttribute("aria-checked", "true");
  });

  it("hoje já anotado: 'Hoje já tá garantido'", () => {
    abrir(montarStore(cenario({ "core-dias-anotados": corrida(HOJE, 13) })));
    expect(screen.getByText(/SEQUÊNCIA · 13 DIAS/)).toBeInTheDocument();
    expect(screen.getByText(/Hoje já tá garantido/)).toBeInTheDocument();
  });

  it("toque no adesivo abre o detalhe com compartilhar; o que falta mostra o que falta", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(document.querySelector('[data-adesivo-celula="leitura-1"]')!);
    expect(await screen.findByRole("button", { name: /Compartilhar nos Stories/ })).toBeInTheDocument();
    expect(screen.getByText(/Colado no seu planner em 21 de setembro de 2026/)).toBeInTheDocument();
  });

  it("a ação sugerida leva pro módulo", () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByRole("button", { name: "registrar um gasto" }));
    expect(screen.getByText("outra tela")).toBeInTheDocument();
  });
});

describe("linha da sequência na Home", () => {
  const seq = (p: Partial<Sequencia>): Sequencia => ({ dias: 12, hojeFeito: false, saldo: 1, usados: [], recorde: 12, hoje: HOJE, acao: ACAO_PADRAO, protegidoOntem: false, ...p });
  const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}|{JSON.stringify(l.state)}</p>; };

  it("'12 dias · falta 1 coisa hoje' e abre as Conquistas com origem home", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<LinhaSequencia seq={seq({})} />} />
          <Route path="/conquistas" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
    const linha = screen.getByTestId("linha-sequencia");
    expect(linha).toHaveTextContent("12 dias");
    expect(linha).toHaveTextContent("falta 1 coisa hoje");
    fireEvent.click(linha);
    expect(screen.getByTestId("onde")).toHaveTextContent('/conquistas|{"origem":"home"}');
  });

  it("garantido hoje e o convite de começo", () => {
    const { rerender } = render(<MemoryRouter><LinhaSequencia seq={seq({ dias: 13, hojeFeito: true })} /></MemoryRouter>);
    expect(screen.getByTestId("linha-sequencia")).toHaveTextContent("garantido hoje");
    rerender(<MemoryRouter><LinhaSequencia seq={seq({ dias: 0 })} /></MemoryRouter>);
    expect(screen.getByTestId("linha-sequencia")).toHaveTextContent("Comece sua sequência");
  });
});

describe("momentos", () => {
  const montar = (store: ReturnType<typeof montarStore>) =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Provedor store={store}>
          <MomentosConquistas />
        </Provedor>
      </MemoryRouter>,
    );

  it("1ª abertura desta versão: o que já estava conquistado entra como visto, sem festa", async () => {
    const store = montarStore(cenario({ "conquistas-desbloqueadas": undefined, "conquistas-vistas": undefined }));
    delete store.dados["conquistas-desbloqueadas"];
    delete store.dados["conquistas-vistas"];
    montar(store);
    await waitFor(() => expect(store.dados["conquistas-vistas"]).toBeTruthy());
    const vistas = store.dados["conquistas-vistas"] as { adesivos: string[]; marcos: number[] };
    expect(vistas.adesivos).toEqual(expect.arrayContaining(["leitura-1", "first-expense", "sequencia-7"]));
    expect(vistas.marcos).toEqual([7]);
    await act(async () => { await new Promise((r) => setTimeout(r, 1300)); });
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect(screen.queryByTestId("momento-marco")).toBeNull();
  });

  it("adesivo novo: aparece uma vez, e Continuar marca como visto", async () => {
    // "Primeiro Salário" abriu agora (há receita) e ainda não foi comemorado
    const store = montarStore(cenario({ "finance-expenses": [], "finance-incomes": [{ id: 1, value: 3000 }] }));
    montar(store);
    expect(await screen.findByTestId("momento-adesivo", {}, { timeout: 3000 })).toHaveTextContent("Primeiro Salário");
    expect(eventos).toContainEqual(["adesivo_desbloqueado", { id: "first-income" }]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toContain("first-income"));
    await waitFor(() => expect(screen.queryByTestId("momento-adesivo")).toBeNull());
  });

  it("marco de 7 dias: roseta (não o adesivo da sequência) e sequencia_marco", async () => {
    const store = montarStore(cenario({ "conquistas-vistas": { adesivos: ["leitura-1", "first-expense"], marcos: [] } }));
    montar(store);
    expect(await screen.findByTestId("momento-marco", {}, { timeout: 3000 })).toHaveTextContent("7 dias seguidos!");
    expect(eventos).toContainEqual(["sequencia_marco", { dias: 7 }]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      const v = store.dados["conquistas-vistas"] as { adesivos: string[]; marcos: number[] };
      expect(v.marcos).toContain(7);
      expect(v.adesivos).toContain("sequencia-7");
    });
  });
});
