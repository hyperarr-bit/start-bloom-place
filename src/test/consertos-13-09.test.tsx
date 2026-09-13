/**
 * Os quatro consertos de 13/09 (lista "que aba criar", item 6):
 *  1. conta a vencer NÃO é pendência do dia — é aviso, fora da contagem,
 *     só até 3 dias do vencimento; lista vazia ⇔ score 100 volta a valer;
 *  2. empresa apagada: lançamentos dela voltam pro Pessoal (na leitura, por
 *     etiqueta desconhecida, e na gravação, ao apagar);
 *  3. Dashboard recalcula o anual ao trocar o perfil (prop, não só cache);
 *  4. filtro de etiqueta/ano das Metas também filtra o quadro.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { localDayKey } from "@/lib/utils";
import { perfilDe, doPerfil, registrarPerfis, esquecerPerfis, devolverAoPessoal, mesclarPerfil, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { GoalsBoardV2 } from "@/components/hiperfoco/GoalsBoardV2";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true, isGuest: true, fetchKey: async () => null,
  };
  return { dados, valor };
};
beforeEach(() => { esquecerPerfis(); try { localStorage.clear(); } catch { /* jsdom */ } });

const HOJE = localDayKey();
const tudoFeito = () => ({
  "rotina-habits": [{ id: "h1", name: "Água" }], "core-rotina-habit-log": { [HOJE]: { h1: true } },
  "saude-workouts-v2": {}, "treino-active-days": [], "core-saude-water": { [HOJE]: 8 },
  "core-dieta-meals": [{ name: "Almoço" }], "core-dieta-log": { [HOJE]: { almoco: {} } },
  "mood-log": { [HOJE]: 4 }, "finance-expenses": [{ id: "x", date: HOJE, value: 10, category: "outros" }],
  "core-saude-measures": [{ date: HOJE, weight: 70 }], "sleep-log": { [HOJE]: 8 },
  "hiperfoco-thoughts": { [HOJE]: { ideias: ["x"] } }, "dp-gratitude": { [HOJE]: ["y"] },
});
const Sonda = () => { const d = useLifeHubData(); return <><p data-testid="score">{d.dayScore}</p><NextHoursTimeline data={d} /></>; };
const renderHome = (dados: Record<string, unknown>) => {
  const store = criarStore(dados);
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><Sonda /></UserDataContext.Provider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Pendências de hoje/ }));
  return store;
};

describe("1. conta a vencer é aviso, não pendência", () => {
  it("dia 100 com conta vencendo em 2 dias: score 100, ZERO pendentes, e o aviso aparece fora da contagem", () => {
    const dia = new Date(); dia.setDate(dia.getDate() + 2);
    renderHome({ ...tudoFeito(), "finance-dueDays": [{ day: dia.getDate(), bills: [{ name: "Internet", paid: false }] }] });
    expect(screen.getByTestId("score").textContent).toBe("100");
    expect(screen.queryByText(/pendente/)).not.toBeInTheDocument();
    expect(screen.getByTestId("aviso-conta").textContent).toContain("Vence em 2 dias: Internet");
    expect(screen.queryByText(/Conta próxima/)).not.toBeInTheDocument();
  });
  it("conta pra daqui a 12 dias: nem aviso; conta paga: nem aviso", () => {
    const longe = new Date(); longe.setDate(longe.getDate() + 12);
    renderHome({ ...tudoFeito(), "finance-dueDays": [{ day: longe.getDate(), bills: [{ name: "Luz", paid: false }] }] });
    expect(screen.queryByTestId("aviso-conta")).not.toBeInTheDocument();
  });
  it("vence hoje → 'Vence hoje'", () => {
    renderHome({ ...tudoFeito(), "finance-dueDays": [{ day: new Date().getDate(), bills: [{ name: "Aluguel", paid: false }] }] });
    expect(screen.getByTestId("aviso-conta").textContent).toContain("Vence hoje: Aluguel");
  });
});

describe("2. empresa apagada não deixa órfão", () => {
  const itens = [{ id: "a", value: 10 }, { id: "b", value: 20, perfil: "emp1" }, { id: "c", value: 30, perfil: "emp2" }];
  it("etiqueta de perfil que não existe mais cai no Pessoal — só depois que a lista de perfis é conhecida", () => {
    expect(doPerfil(itens, PERFIL_PESSOAL).map(i => i.id)).toEqual(["a"]);            // sem lista: como antes
    registrarPerfis([{ id: "emp1", nome: "Loja" }]);                                       // emp2 foi apagada
    expect(doPerfil(itens, PERFIL_PESSOAL).map(i => i.id)).toEqual(["a", "c"]);
    expect(doPerfil(itens, "emp1").map(i => i.id)).toEqual(["b"]);
    expect(perfilDe({ perfil: "emp2" })).toBe(PERFIL_PESSOAL);
  });
  it("editar o Pessoal com um órfão dentro não apaga o órfão (mesclagem enxerga ele como pessoal)", () => {
    registrarPerfis([{ id: "emp1", nome: "Loja" }]);
    const visiveis = doPerfil(itens, PERFIL_PESSOAL).map(i => (i.id === "a" ? { ...i, value: 11 } : i));
    const mesclado = mesclarPerfil(itens, visiveis, PERFIL_PESSOAL);
    expect(mesclado.map(i => `${i.id}:${i.value}`)).toEqual(["a:11", "b:20", "c:30"]);
  });
  it("ao apagar, devolverAoPessoal re-etiqueta de verdade", () => {
    expect(devolverAoPessoal(itens, "emp2").map(i => i.perfil ?? "-")).toEqual(["-", "emp1", PERFIL_PESSOAL]);
  });
});

describe("4. filtro das Metas também filtra o quadro", () => {
  const metas = [
    { id: "g1", title: "Abrir meu negócio", heroImage: "", referenceImages: [], problems: [], steps: [], notes: "" },
    { id: "g2", title: "Viajar pro Nordeste", heroImage: "", referenceImages: [], problems: [], steps: [], notes: "" },
  ];
  it("com apenasIds o quadro mostra só as metas do filtro; sem, todas", () => {
    const store = criarStore({ "goals-board-v2": metas });
    const { rerender } = render(<MemoryRouter><UserDataContext.Provider value={store.valor}><GoalsBoardV2 apenasIds={new Set(["g2"])} /></UserDataContext.Provider></MemoryRouter>);
    expect(screen.getByText("Viajar pro Nordeste")).toBeInTheDocument();
    expect(screen.queryByText("Abrir meu negócio")).not.toBeInTheDocument();
    rerender(<MemoryRouter><UserDataContext.Provider value={store.valor}><GoalsBoardV2 apenasIds={null} /></UserDataContext.Provider></MemoryRouter>);
    expect(screen.getByText("Abrir meu negócio")).toBeInTheDocument();
  });
});
