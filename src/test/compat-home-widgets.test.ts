/**
 * HOME — COMPATIBILIDADE dos widgets novos com o app antigo das lojas (30/09).
 *
 * Pet, Beleza e Relações ganharam widget (`pet`, `skincare`, `cuidados`, `relacoes`) e o "Pôr na
 * Home" dos módulos grava em `core-home-widgets-v2` — a MESMA lista que a Home do app antigo
 * (78883beb: iPhone 1.0.7/1.0.8, Android 125) lê e REGRAVA a cada abertura. Aqui:
 *  - o useHomeWidgets ANTIGO (cópia congelada) regrava a lista com os ids que não conhece, e
 *    mexer na Home antiga (tamanho, pôr, tirar, reordenar) não apaga nenhum deles;
 *  - a grade da Home antiga (trecho congelado de Home.tsx) pula id sem componente, sem erro;
 *  - o que o "Pôr na Home" do app novo grava é o `{ id, size }` de sempre, no fim da lista.
 * Arquivo .ts (sem JSX): as telas montam com createElement.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { act, cleanup, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CHAVE_WIDGETS_HOME, WIDGET_CATALOG, comWidget } from "@/hooks/use-home-widgets";
import { useHomeWidgets as useHomeWidgetsAntigo, WIDGET_CATALOG as CATALOGO_ANTIGO } from "./app-antigo/home/use-home-widgets";
import { WidgetGrid, WIDGET_COMPONENTS as COMPONENTES_ANTIGOS } from "./app-antigo/home/widget-grid";
import { criarNuvem, prepararJsdom, vigiarConsole } from "./compat-comum";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null, session: null, loading: false }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

beforeAll(prepararJsdom);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
// restoreAllMocks: solta o console.error do vigiarConsole mesmo se a tela quebrar no meio (os vi.fn dos mocks ficam como estão)
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); });

const NOVOS = ["pet", "relacoes", "skincare", "cuidados"] as const;
type Widget = { id: string; size: "small" | "large" };

/** Uma Home mista: widgets de sempre + os 4 novos, intercalados (a ordem é da pessoa). */
const LISTA: Widget[] = [
  { id: "finances", size: "small" },
  { id: "pet", size: "large" },
  { id: "habits", size: "small" },
  { id: "relacoes", size: "large" },
  { id: "skincare", size: "large" },
  { id: "motivational-quote", size: "large" },
  { id: "cuidados", size: "large" },
];

/** A grade da Home antiga como a Home antiga monta (dentro do DndContext + SortableContext). */
const grade = (ativos: Widget[], editing: boolean) =>
  createElement(DndContext, {
    children: createElement(SortableContext, {
      items: ativos.map((w) => w.id),
      strategy: rectSortingStrategy,
      // os ids novos não existem no tipo do app antigo: é justamente o caso testado
      children: createElement(WidgetGrid, { activeWidgets: ativos as never, editing, onRemove: () => {}, onToggleSize: () => {} }),
    }),
  });

/** Monta o hook ANTIGO num componente de sonda e devolve a API dele (atualizada a cada render). */
function montarHookAntigo(nuvem: ReturnType<typeof criarNuvem>) {
  const ref: { atual: ReturnType<typeof useHomeWidgetsAntigo> | null } = { atual: null };
  const Sonda = () => { ref.atual = useHomeWidgetsAntigo(); return null; };
  nuvem.montar(createElement(Sonda));
  return ref;
}

describe("o useHomeWidgets do app antigo com os widgets novos na lista", () => {
  it("os 4 ids novos não existem no app antigo (é o caso a proteger)", () => {
    for (const id of NOVOS) {
      expect(CATALOGO_ANTIGO.some((w) => (w.id as string) === id), id).toBe(false);
      expect(id in COMPONENTES_ANTIGOS, id).toBe(false);
      expect(WIDGET_CATALOG.some((w) => w.id === id), `catálogo novo: ${id}`).toBe(true);
    }
  });

  it("ao abrir, a Home antiga regrava a lista INTEIRA — os ids que ela não conhece continuam, na mesma ordem", () => {
    const nuvem = criarNuvem({ [CHAVE_WIDGETS_HOME]: LISTA });
    const api = montarHookAntigo(nuvem);
    // o hook antigo sempre regrava depois de hidratar (é o comportamento dele): tem que ser a mesma lista
    expect(nuvem.estado.escritas).toContain(CHAVE_WIDGETS_HOME);
    expect(nuvem.ler(CHAVE_WIDGETS_HOME)).toEqual(LISTA);
    expect(api.atual!.activeWidgets).toEqual(LISTA);
    expect(api.atual!.isActive("pet" as never)).toBe(true);
  });

  it("mexer na Home antiga (tamanho, pôr, tirar, reordenar) não apaga pet, relacoes, skincare nem cuidados", () => {
    const nuvem = criarNuvem({ [CHAVE_WIDGETS_HOME]: LISTA });
    const api = montarHookAntigo(nuvem);
    act(() => api.atual!.toggleSize("finances"));
    act(() => api.atual!.addWidget("tasks"));
    act(() => api.atual!.removeWidget("habits"));
    act(() => api.atual!.reorder(0, 3));
    // o app antigo não sabe pôr o widget novo (não está no catálogo dele): pedir não faz nada, e não quebra
    act(() => api.atual!.addWidget("pet" as never));

    const gravada = nuvem.ler<Widget[]>(CHAVE_WIDGETS_HOME);
    const ids = gravada.map((w) => w.id);
    for (const id of NOVOS) expect(ids, id).toContain(id);
    expect(ids.filter((id) => id === "pet")).toHaveLength(1);
    expect(ids).not.toContain("habits");
    expect(ids).toContain("tasks");
    expect(gravada.find((w) => w.id === "finances")?.size).toBe("large");
    for (const id of NOVOS) expect(gravada.find((w) => w.id === id), id).toEqual(LISTA.find((w) => w.id === id));
    // e continua o formato de sempre: lista de { id, size }
    for (const w of gravada) expect(Object.keys(w).sort()).toEqual(["id", "size"]);
  });

  it("a Home antiga remonta (abrir de novo) com a lista que ela mesma regravou: nada some", () => {
    const nuvem = criarNuvem({ [CHAVE_WIDGETS_HOME]: LISTA });
    montarHookAntigo(nuvem);
    cleanup();
    montarHookAntigo(nuvem);
    expect(nuvem.ler(CHAVE_WIDGETS_HOME)).toEqual(LISTA);
  });
});

describe("a grade de widgets da Home antiga", () => {
  it("pula o id sem componente (pet, relacoes, skincare, cuidados) sem erro e desenha o que conhece", () => {
    const nuvem = criarNuvem({});
    const vigia = vigiarConsole();
    nuvem.montar(grade(LISTA.filter((w) => w.id === "motivational-quote" || (NOVOS as readonly string[]).includes(w.id)), true));
    vigia.parar();
    expect(vigia.erros()).toEqual([]);
    // no modo de edição cada widget desenhado vira um "sortable": só o que o app antigo conhece
    expect(document.querySelectorAll('[aria-roledescription="sortable"]')).toHaveLength(1);
    expect(screen.getAllByText(/^— /)).toHaveLength(1); // o autor da "Frase do Dia"
  });

  it("uma Home só com widgets novos: a grade antiga fica vazia, sem erro", () => {
    const nuvem = criarNuvem({});
    const vigia = vigiarConsole();
    const { container } = nuvem.montar(grade(NOVOS.map((id) => ({ id, size: "large" })), false));
    vigia.parar();
    expect(vigia.erros()).toEqual([]);
    // uma linha por widget grande, todas vazias (o DndContext só deixa o texto de acessibilidade dele)
    const linhas = Array.from(container.querySelectorAll(".space-y-3 > .grid"));
    expect(linhas).toHaveLength(NOVOS.length);
    for (const l of linhas) expect(l.childElementCount).toBe(0);
  });
});

describe("o 'Pôr na Home' do app novo grava o formato que a Home antiga lê", () => {
  it("{ id, size } no fim da lista antiga, sem duplicar e sem sobrescrever lista torta", () => {
    const antiga: Widget[] = [{ id: "finances", size: "small" }, { id: "tasks", size: "large" }];
    let lista: unknown = antiga;
    for (const id of NOVOS) {
      const nova = comWidget(lista, id, "large");
      expect(nova, id).not.toBeNull();
      lista = nova;
    }
    expect(lista).toEqual([...antiga, ...NOVOS.map((id) => ({ id, size: "large" }))]);
    expect(comWidget(lista, "pet", "small")).toBeNull(); // já está: não duplica
    expect(comWidget({ torto: true }, "pet", "large")).toBeNull(); // lixo: não sobrescreve
    expect(comWidget(undefined, "cuidados", "large")).toEqual([{ id: "cuidados", size: "large" }]); // sem lista: a antiga também começava vazia

    // e a Home antiga abre essa lista e regrava igual
    const nuvem = criarNuvem({ [CHAVE_WIDGETS_HOME]: lista });
    montarHookAntigo(nuvem);
    expect(nuvem.ler(CHAVE_WIDGETS_HOME)).toEqual(lista);
  });
});
