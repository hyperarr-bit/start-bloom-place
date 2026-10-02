/**
 * Conquistas "fantástico" (02/10) — a tela: o seletor de capas com cadeado
 * (Bordô · 14, Noite · 30), o card SEQUÊNCIA com o fogo por faixa, a ação da
 * pessoa com os chips, o "não gastei nada hoje" (grava e conta), a subida de
 * faixa (evento + comemoração), e o popup "Capa nova liberada" na orquestra.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: Record<string, unknown>) => { eventos.push([nome, dados]); },
}));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));
vi.mock("@/components/conquistas/video/AnimacaoAoVivo", () => ({ default: () => <canvas /> }));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock("sonner", () => ({ toast: Object.assign((m: string) => { toasts.push(m); }, { success: (m: string) => { toasts.push(m); }, error: (m: string) => { toasts.push(m); } }) }));

import { UserDataContext } from "@/hooks/use-user-data";
import { TelaConquistas } from "@/components/conquistas/TelaConquistas";
import { MomentosConquistas } from "@/components/conquistas/Momentos";
import { CHAVE_CAPA } from "@/components/conquistas/CapaPlanner";
import { CHAVE_SEM_GASTO } from "@/lib/acao-do-dia";
import { CHAVE_CAPAS_VISTAS, CHAVE_FOGO_VISTO } from "@/lib/fogo-sequencia";
import { somarDias } from "@/lib/sequencia";
import { CHAVE_NIVEL_PISO } from "@/components/gamification/types";
import { CHAVE_DICA_PLANNER } from "@/components/conquistas/DicaDoPlanner";

const HOJE = "2026-10-07"; // quarta
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
const abrir = (store: ReturnType<typeof montarStore>, extra?: ReactNode) =>
  render(
    <MemoryRouter initialEntries={["/conquistas"]}>
      <Provedor store={store}>
        <Routes>
          <Route path="/conquistas" element={<><TelaConquistas />{extra}</>} />
          <Route path="*" element={<p>outra tela</p>} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
/** Quem só usa Finanças: gasto em 11 dos últimos 14 dias; sequência de `dias` até ontem. */
const cenario = (dias: number, extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), dias),
  "finance-expenses": corrida(somarDias(HOJE, -1), 14).filter((_, i) => i % 5 !== 4).map((d, i) => ({ id: i, value: 10, date: d })),
  "conquistas-desbloqueadas": { "first-expense": "2026-09-20" },
  "conquistas-vistas": { adesivos: ["first-expense"], marcos: [7] },
  [CHAVE_NIVEL_PISO]: "Bronze",
  [CHAVE_DICA_PLANNER]: { vistas: 3, fim: true },
  [CHAVE_FOGO_VISTO]: 1,
  ...extra,
});

beforeEach(() => {
  eventos.length = 0;
  toasts.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 7, 10, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("capas que o tempo libera", () => {
  it("com 5 dias de recorde: Bordô e Noite com cadeado; tocar diz o requisito (toast + evento) e NÃO troca a capa", () => {
    const store = montarStore(cenario(5));
    abrir(store);
    const bordo = screen.getByRole("radio", { name: "Bordô — libera com 14 dias seguidos" });
    expect(bordo).toHaveAttribute("data-travada");
    expect(screen.getByRole("radio", { name: "Noite — libera com 30 dias seguidos" })).toHaveAttribute("data-travada");
    expect(screen.getByRole("radio", { name: "Vichy rosa" })).not.toHaveAttribute("data-travada");
    fireEvent.click(bordo);
    expect(toasts).toContainEqual("Bordô: libera com 14 dias seguidos — faltam 9 dias.");
    expect(eventos).toContainEqual(["capa_travada_toque", { capa: "bordo", recorde: 5 }]);
    expect(store.dados[CHAVE_CAPA]).toBeUndefined();
    expect(document.querySelector("[data-capa]")).toHaveAttribute("data-capa", "grafite");
  });

  it("com 20 dias de recorde: Bordô destravada e escolhível; Noite ainda não", () => {
    const store = montarStore(cenario(20));
    abrir(store);
    const bordo = screen.getByRole("radio", { name: "Bordô" });
    expect(bordo).not.toHaveAttribute("data-travada");
    fireEvent.click(bordo);
    expect(store.dados[CHAVE_CAPA]).toBe("bordo");
    expect(document.querySelector("[data-capa]")).toHaveAttribute("data-capa", "bordo");
    expect(screen.getByRole("radio", { name: "Noite — libera com 30 dias seguidos" })).toHaveAttribute("data-travada");
  });

  it("uma capa gravada que não está liberada cai na grafite", () => {
    abrir(montarStore(cenario(5, { [CHAVE_CAPA]: "noite" })));
    expect(document.querySelector("[data-capa]")).toHaveAttribute("data-capa", "grafite");
  });
});

describe("o card SEQUÊNCIA com o fogo por faixa e a ação da pessoa", () => {
  it("12 dias = fogo vermelho (cabeçalho, selo e 'faltam 2 dias pro fogo roxo'); a ação é da pessoa (só Finanças) com o chip 'não gastei'", () => {
    abrir(montarStore(cenario(12)));
    const card = screen.getByTestId("card-sequencia");
    expect(card).toHaveAttribute("data-faixa", "vermelho");
    expect(screen.getByTestId("sequencia-faixa")).toHaveTextContent("FOGO VERMELHO");
    expect(screen.getByTestId("sequencia-faixa")).toHaveTextContent("faltam 2 dias pro fogo roxo");
    expect(screen.getByTestId("acao-do-dia")).toHaveAttribute("data-acao", "financas");
    expect(screen.getByTestId("acao-principal")).toHaveTextContent("anote o gasto de hoje");
    expect(screen.getByTestId("acao-chips").querySelectorAll(".seq-chip")).toHaveLength(1);
    expect(eventos).toContainEqual(["acao_do_dia_vista", { acao: "financas", chips: "sem-gasto" }]);
    // a etiqueta da capa segue a faixa
    expect(document.querySelector("[data-tag-sequencia] [data-fogo]")).toHaveAttribute("data-fogo", "vermelho");
  });

  it("'não gastei nada hoje': grava finance-sem-gasto, o dia fica garantido e sai o evento acao_do_dia_toque", async () => {
    const store = montarStore(cenario(12));
    abrir(store);
    fireEvent.click(screen.getByRole("button", { name: /não gastei nada hoje/ }));
    expect(store.dados[CHAVE_SEM_GASTO]).toEqual({ [HOJE]: true });
    expect(eventos).toContainEqual(["acao_do_dia_toque", { acao: "sem-gasto", via: "chip" }]);
    expect(toasts.some((t) => /sem gasto anotado/.test(t))).toBe(true);
    // na tela de verdade o useUserData registra o dia ao gravar a chave; aqui o store de mentira faz o mesmo à mão
    act(() => { store.valor().set("core-dias-anotados", [...corrida(somarDias(HOJE, -1), 12), HOJE]); });
    await waitFor(() => expect(screen.getByText(/Hoje já tá garantido/)).toBeInTheDocument());
    expect(screen.getByText(/dia sem gasto anotado/)).toBeInTheDocument();
  });

  it("tocar na ação principal leva pro módulo e mede", () => {
    abrir(montarStore(cenario(12)));
    fireEvent.click(screen.getByTestId("acao-principal"));
    expect(eventos).toContainEqual(["acao_do_dia_toque", { acao: "financas", via: "principal" }]);
    expect(screen.getByText("outra tela")).toBeInTheDocument();
  });

  it("subiu de faixa (vista laranja, agora vermelho): comemora, manda sequencia_faixa e grava a faixa; igual ou desceu = só grava", () => {
    const store = montarStore(cenario(7, { [CHAVE_FOGO_VISTO]: 0 }));
    abrir(store);
    expect(screen.getByTestId("sequencia-subiu")).toBeInTheDocument();
    expect(eventos).toContainEqual(["sequencia_faixa", { faixa: "vermelho", dias: 7 }]);
    expect(store.dados[CHAVE_FOGO_VISTO]).toBe(1);
    cleanup();
    eventos.length = 0;
    const store2 = montarStore(cenario(3, { [CHAVE_FOGO_VISTO]: 2 }));
    abrir(store2);
    expect(screen.queryByTestId("sequencia-subiu")).toBeNull();
    expect(eventos.some(([n]) => n === "sequencia_faixa")).toBe(false);
    expect(store2.dados[CHAVE_FOGO_VISTO]).toBe(0);
  });

  it("0 dias: fogo apagado e 'Anote 1 coisa hoje pra começar'", () => {
    abrir(montarStore(cenario(0, { "core-dias-anotados": [], "finance-expenses": [] })));
    expect(screen.getByTestId("card-sequencia")).toHaveAttribute("data-faixa", "apagado");
    expect(screen.getByText(/pra começar/)).toBeInTheDocument();
    expect(screen.queryByTestId("sequencia-faixa")).toBeNull();
  });
});

describe("o popup 'Capa nova liberada' na orquestra dos momentos", () => {
  // (só a Data é de mentira; os relógios da fila são de verdade)
  it("recorde chegou a 14 e a Bordô ainda não foi comemorada: popup com a capa, capa_desbloqueada; 'Usar esta capa' grava e marca como vista", async () => {
    const store = montarStore(cenario(14, { [CHAVE_CAPAS_VISTAS]: [] }));
    abrir(store, <MomentosConquistas />);
    const popup = await screen.findByTestId("momento-capa", {}, { timeout: 4000 });
    expect(popup).toHaveAttribute("data-capa", "bordo");
    expect(popup).toHaveTextContent("Capa nova liberada");
    expect(popup).toHaveTextContent("14 dias seguidos");
    expect(eventos).toContainEqual(["capa_desbloqueada", { capa: "bordo", dias: 14 }]);
    fireEvent.click(screen.getByTestId("momento-capa-usar"));
    expect(store.dados[CHAVE_CAPA]).toBe("bordo");
    await waitFor(() => expect(store.dados[CHAVE_CAPAS_VISTAS]).toEqual(["bordo"]));
    await waitFor(() => expect(screen.queryByTestId("momento-capa")).toBeNull());
  });

  const abrirEm = (rota: string, store: ReturnType<typeof montarStore>) =>
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Provedor store={store}>
          <MomentosConquistas />
          <Routes>
            <Route path="*" element={<p>tela qualquer</p>} />
          </Routes>
        </Provedor>
      </MemoryRouter>,
    );

  it("FORA de Conquistas (Home, Treino) o popup não aparece, mesmo com a capa liberada e não vista (dono 02/10)", async () => {
    const store = montarStore(cenario(14));
    abrirEm("/home", store);
    await new Promise((r) => setTimeout(r, 2200));
    expect(screen.queryByTestId("momento-capa")).toBeNull();
    expect(store.dados[CHAVE_CAPAS_VISTAS]).toBeUndefined(); // nada de linha de base silenciosa
    cleanup();
    abrirEm("/treino", store);
    await new Promise((r) => setTimeout(r, 2200));
    expect(screen.queryByTestId("momento-capa")).toBeNull();
  }, 15000);

  it("quem JÁ tinha recorde ≥14 (sem a chave): ao abrir CONQUISTAS vê o popup UMA vez, com a capa liberada; depois não repete", async () => {
    const store = montarStore(cenario(14));
    abrirEm("/conquistas", store);
    const popup = await screen.findByTestId("momento-capa", {}, { timeout: 4000 });
    expect(popup).toHaveAttribute("data-capa", "bordo");
    expect(popup).toHaveTextContent("Capa nova liberada");
    fireEvent.click(screen.getByTestId("momento-capa-continuar"));
    await waitFor(() => expect(store.dados[CHAVE_CAPAS_VISTAS]).toEqual(["bordo"]));
    await waitFor(() => expect(screen.queryByTestId("momento-capa")).toBeNull());
    cleanup();
    abrirEm("/conquistas", store); // reabrir Conquistas: não repete
    await new Promise((r) => setTimeout(r, 2200));
    expect(screen.queryByTestId("momento-capa")).toBeNull();
  }, 20000);

  it("recorde 30: as duas capas liberadas e não vistas vêm num popup só (carrossel) ao abrir Conquistas", async () => {
    const store = montarStore(cenario(30, { "conquistas-vistas": { adesivos: ["first-expense"], marcos: [7, 14, 21, 30] } })); // os marcos já passaram: só a capa fica
    abrirEm("/conquistas", store);
    const popup = await screen.findByTestId("momento-capa", {}, { timeout: 4000 });
    expect(popup).toHaveTextContent("2 capas novas liberadas");
    expect(screen.getByTestId("momento-capa-item-bordo")).toBeInTheDocument();
    expect(screen.getByTestId("momento-capa-item-noite")).toBeInTheDocument();
  }, 15000);

  it("já comemorada (vista): nada aparece; sem recorde: nada aparece", async () => {
    abrir(montarStore(cenario(14, { [CHAVE_CAPAS_VISTAS]: ["bordo"] })), <MomentosConquistas />);
    await new Promise((r) => setTimeout(r, 2200));
    expect(screen.queryByTestId("momento-capa")).toBeNull();
    cleanup();
    abrir(montarStore(cenario(5, { [CHAVE_CAPAS_VISTAS]: [] })), <MomentosConquistas />);
    await new Promise((r) => setTimeout(r, 2200));
    expect(screen.queryByTestId("momento-capa")).toBeNull();
  }, 15000);
});
