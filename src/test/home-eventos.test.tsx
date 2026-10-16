/**
 * EVENTOS DA HOME (16/10). A Home não gravava nada do que a pessoa toca — não dava pra
 * saber se ações rápidas, pendências, widgets ou a grade de módulos levam alguém pra
 * dentro. Agora cada toque vira um evento `home_*` (sem mudar nada na tela):
 *   home_acao_rapida {acao} · home_pendencias_abrir {pendentes} · home_pendencia {tipo, destino} · home_pendencia_menu {tipo, escolha}
 *   home_widget {widget, tamanho} · home_modulo {modulo, posicao, favorito} · home_modulos_editar {origem}
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", created_at: new Date().toISOString() }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) } },
}));

import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { QuickActions } from "@/components/home/QuickActions";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { ModuleDrawer } from "@/components/home/ModuleDrawer";
import { SortableWidget } from "@/components/home/SortableWidget";
import { localDayKey } from "@/lib/utils";
import { prepararJsdom } from "./compat-comum";

type Dados = Record<string, unknown>;
function montar(ui: ReactNode, inicial: Dados = {}) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return render(<MemoryRouter><Provedor>{ui}</Provedor></MemoryRouter>);
}
const dos = (nome: string) => eventos.filter(([n]) => n === nome).map(([, d]) => d);

const Pendencias = () => {
  const life = useLifeHubData();
  return <NextHoursTimeline data={life} />;
};

const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

beforeAll(prepararJsdom);
beforeEach(() => { localStorage.clear(); eventos.length = 0; });
afterEach(() => { cleanup(); });

describe("eventos home_* (sem mudar a tela)", () => {
  it("ação rápida: home_acao_rapida com qual ação", () => {
    montar(<QuickActions />);
    fireEvent.click(screen.getByRole("button", { name: /Água/ }));
    fireEvent.click(screen.getByRole("button", { name: /Registrar Gasto/ }));
    expect(dos("home_acao_rapida")).toEqual([{ acao: "water" }, { acao: "expense" }]);
  });

  it("pendência: home_pendencia com o tipo; 'Ocultar sempre' vira home_pendencia_menu", () => {
    montar(<Pendencias />, {
      "rotina-habits": [{ id: "h1", name: "Meditar" }],
      "saude-meals": { [DIAS[new Date().getDay()]]: { "Café da Manhã": "Pão" } },
      "core-saude-water": { [localDayKey()]: 0 },
    });
    // a lista nasce fechada: abrir também conta
    fireEvent.click(screen.getByText(/Pendências de hoje/));
    expect(dos("home_pendencias_abrir")).toHaveLength(1);
    const linhas = screen.getAllByTestId("pendencia");
    expect(linhas.length).toBeGreaterThan(0);
    fireEvent.click(linhas[0]);
    const [primeiro] = dos("home_pendencia");
    expect(primeiro).toBeTruthy();
    expect(typeof primeiro.tipo).toBe("string");
    expect(primeiro).toHaveProperty("destino");
    // menu "…" de uma linha automática → ocultar
    const opcoes = screen.getAllByTestId(/^opcoes-/)[0];
    const tipo = opcoes.getAttribute("data-testid")!.replace("opcoes-", "");
    fireEvent.click(opcoes);
    fireEvent.click(screen.getByTestId(`ocultar-${tipo}`));
    expect(dos("home_pendencia_menu")).toEqual([{ tipo, escolha: "ocultar" }]);
  });

  it("grade de módulos: home_modulo com o módulo e a posição; a engrenagem vira home_modulos_editar", () => {
    montar(<ModuleDrawer />);
    fireEvent.click(screen.getByText("Finanças"));
    const [m] = dos("home_modulo");
    expect(m).toMatchObject({ modulo: "financas", favorito: false });
    expect(typeof m.posicao).toBe("number");
    fireEvent.click(screen.getByLabelText("Editar módulos"));
    expect(dos("home_modulos_editar")).toEqual([{ origem: "engrenagem" }]);
    // em edição, tocar no módulo não navega nem conta
    fireEvent.click(screen.getByText("Finanças"));
    expect(dos("home_modulo")).toHaveLength(1);
  });

  it("widget: home_widget com qual widget (qualquer toque dentro); editando, não conta", () => {
    const Widget = ({ editing }: { editing: boolean }) => (
      <DndContext>
        <SortableContext items={["finances"]}>
          <SortableWidget id="finances" size="small" editing={editing} onRemove={() => {}} onToggleSize={() => {}}>
            <button type="button">dentro do widget</button>
          </SortableWidget>
        </SortableContext>
      </DndContext>
    );
    const { rerender } = render(<Widget editing={false} />);
    fireEvent.click(screen.getByText("dentro do widget"));
    expect(dos("home_widget")).toEqual([{ widget: "finances", tamanho: "small" }]);
    rerender(<Widget editing />);
    fireEvent.click(screen.getByText("dentro do widget"));
    expect(dos("home_widget")).toHaveLength(1);
  });
});
