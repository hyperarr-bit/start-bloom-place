/**
 * 26/10 — A FOLHA DA TAREFA × O TECLADO DO iPHONE (achado do QA no Simulador, PRÉ-EXISTENTE na 1.0.18): o campo
 * "O que precisa fazer" ficava FORA DA TELA quando o teclado subia — `autoFocus` durante a animação de abrir + folha
 * de 92dvh + o WebKit arrastando a janela visível (visualViewport 471@403) pela altura do teclado.
 * Agora (hooks/use-area-visivel + tarefas-do-dia):
 *   · o foco espera a folha ASSENTAR (animationend, ou 600 ms sem animação) e não rola nada (preventScroll);
 *   · com o teclado aberto a folha se ancora acima do que ele cobre (`bottom` = coberto) e nunca passa da área
 *     visível (`maxHeight` = visualViewport.height − margem) — sem teclado, nada muda (vale a classe);
 *   · focar um campo dentro da folha rola o campo pra dentro (scrollIntoView nearest, depois do teclado assentar).
 * É o MESMO componente nos 3 caminhos: "+" da Home nova, Ações rápidas da Home de hoje, "+ Nova tarefa" da Rotina.
 * A folha do "+" da Home nova usa a mesma régua (antes: "100dvh − teclado", que no iOS não encolhe nada).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn() }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  });
  return {
    supabase: {
      from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn(),
    },
  };
});

import { FolhaNovaTarefa } from "@/components/tarefas/tarefas-do-dia";
import { FolhaMaisE } from "@/components/home-nova/e/FolhaMaisE";
import { estiloDaFolhaComTeclado, lerAreaVisivel } from "@/hooks/use-area-visivel";
import { criarNuvem, prepararJsdom } from "./compat-comum";

/** a visualViewport do iPhone 17 Pro (tela de 874 pt): sem teclado 874@0; teclado de texto 471@0 ou, arrastada, 471@403 */
class VV extends EventTarget { height = 874; offsetTop = 0; width = 402; offsetLeft = 0; scale = 1; pageTop = 0; pageLeft = 0; }
const vv = new VV();
const teclado = (altura: number, offsetTop: number) => {
  vv.height = altura; vv.offsetTop = offsetTop;
  act(() => { vv.dispatchEvent(new Event("resize")); vv.dispatchEvent(new Event("scroll")); });
};
const scrollIntoView = vi.fn();

beforeAll(() => {
  prepararJsdom();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 874 });
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => { vv.height = 874; vv.offsetTop = 0; localStorage.clear(); scrollIntoView.mockClear(); });
afterEach(() => cleanup());

const montarTarefa = (props: Partial<Parameters<typeof FolhaNovaTarefa>[0]> = {}) => {
  const n = criarNuvem({});
  const onFechar = vi.fn();
  const onSalvar = vi.fn();
  const r = render(<MemoryRouter><n.Provedor><FolhaNovaTarefa aberta onFechar={onFechar} onSalvar={onSalvar} {...props} /></n.Provedor></MemoryRouter>);
  return { ...r, onFechar, onSalvar };
};

describe("a régua da área visível (use-area-visivel)", () => {
  it("sem teclado: nada; teclado sem arrasto: bottom = o que ele cobre; arrasto inteiro: bottom 0; e nunca mais alta que a área visível", () => {
    expect(lerAreaVisivel()).toEqual({ altura: 874, coberto: 0, teclado: false, topo: 0 });
    expect(estiloDaFolhaComTeclado(lerAreaVisivel())).toBeUndefined();
    vv.height = 471; vv.offsetTop = 0;
    expect(lerAreaVisivel()).toEqual({ altura: 471, coberto: 403, teclado: true, topo: 0 });
    expect(estiloDaFolhaComTeclado(lerAreaVisivel())).toEqual({ bottom: 403, maxHeight: 463 });
    vv.offsetTop = 403; // o WebKit arrastou a janela visível até o fundo
    expect(lerAreaVisivel()).toEqual({ altura: 471, coberto: 0, teclado: true, topo: 403 });
    vv.offsetTop = 200; // arrasto parcial
    expect(lerAreaVisivel().coberto).toBe(203);
    vv.height = 800; vv.offsetTop = 0; // barra de busca/endereço, não teclado
    expect(lerAreaVisivel().teclado).toBe(false);
  });

  it("no celular (`--app-safe-top` gravado no <html>): sem arrasto a folha fica abaixo do relógio; arrastada até o fundo, não precisa", () => {
    document.documentElement.style.setProperty("--app-safe-top", "59px");
    try {
      expect(estiloDaFolhaComTeclado({ altura: 471, coberto: 403, teclado: true, topo: 0 })).toEqual({ bottom: 403, maxHeight: 404 });
      expect(estiloDaFolhaComTeclado({ altura: 471, coberto: 0, teclado: true, topo: 403 })).toEqual({ bottom: 0, maxHeight: 463 });
      expect(estiloDaFolhaComTeclado({ altura: 471, coberto: 373, teclado: true, topo: 30 })).toEqual({ bottom: 373, maxHeight: 434 });
    } finally {
      document.documentElement.style.removeProperty("--app-safe-top");
    }
    expect(estiloDaFolhaComTeclado({ altura: 471, coberto: 403, teclado: true, topo: 0 })).toEqual({ bottom: 403, maxHeight: 463 });
  });
});

describe("FolhaNovaTarefa — os 3 caminhos ('+' da Home nova, Ações rápidas, '+ Nova tarefa' da Rotina) usam este componente", () => {
  it("o campo NÃO foca na hora (o autoFocus saiu): foca quando a folha assenta (animationend), sem rolar a página (preventScroll)", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    montarTarefa();
    const campo = await screen.findByLabelText("O que precisa fazer");
    expect(document.activeElement).not.toBe(campo);
    fireEvent.animationEnd(screen.getByTestId("folha-nova-tarefa"));
    await waitFor(() => expect(document.activeElement).toBe(campo));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it("sem animação (sem animationend) o foco vem sozinho em ~600 ms", async () => {
    montarTarefa();
    const campo = await screen.findByLabelText("O que precisa fazer");
    await new Promise((r) => setTimeout(r, 250));
    expect(document.activeElement).not.toBe(campo);
    await waitFor(() => expect(document.activeElement).toBe(campo), { timeout: 1500 });
  });

  it("com texto inicial (a Rotina mandou o que a pessoa já digitou) não foca sozinho — como antes", async () => {
    montarTarefa({ textoInicial: "Ligar pro dentista" });
    const campo = await screen.findByLabelText("O que precisa fazer");
    fireEvent.animationEnd(screen.getByTestId("folha-nova-tarefa"));
    await new Promise((r) => setTimeout(r, 700));
    expect(document.activeElement).not.toBe(campo);
    expect((campo as HTMLInputElement).value).toBe("Ligar pro dentista");
  });

  it("com o teclado aberto a folha se ancora acima do teclado e cabe na área visível; arrastada, ancora no fundo; fechado o teclado, volta ao normal", async () => {
    montarTarefa();
    const folha = screen.getByTestId("folha-nova-tarefa");
    expect(folha.style.maxHeight).toBe("");
    expect(folha.style.bottom).toBe("");
    teclado(471, 0);
    await waitFor(() => expect(folha.style.bottom).toBe("403px"));
    expect(folha.style.maxHeight).toBe("463px");
    expect(folha.getAttribute("data-teclado")).toBe("1");
    teclado(471, 403);
    await waitFor(() => expect(folha.style.bottom).toBe("0px"));
    expect(folha.style.maxHeight).toBe("463px");
    teclado(874, 0);
    await waitFor(() => expect(folha.style.maxHeight).toBe(""));
    expect(folha.style.bottom).toBe("");
    expect(folha.getAttribute("data-teclado")).toBeNull();
  });

  it("focar um campo dentro da folha rola o campo pra dentro da área visível (depois do teclado assentar)", async () => {
    montarTarefa();
    const detalhes = await screen.findByPlaceholderText(/Passo a passo, telefone/);
    fireEvent.focus(detalhes);
    expect(scrollIntoView).not.toHaveBeenCalled(); // espera o teclado
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" }), { timeout: 1500 });
  });

  it("salvar continua igual: grava o texto e fecha", async () => {
    const { onSalvar, onFechar } = montarTarefa();
    const campo = await screen.findByLabelText("O que precisa fazer");
    fireEvent.change(campo, { target: { value: "Comprar pão" } });
    fireEvent.click(screen.getByText("Salvar tarefa"));
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ texto: "Comprar pão" }));
    expect(onFechar).toHaveBeenCalled();
  });
});

describe("a folha do '+' da Home nova usa a mesma régua", () => {
  it("teclado aberto: bottom = o coberto e altura máxima = a área visível (não '100dvh − teclado'); sem teclado, 88dvh", async () => {
    const n = criarNuvem({});
    const hub = { waterGlasses: 0, waterGoal: 8, dayScore: 0 } as unknown as import("@/hooks/use-life-hub-data").LifeHubData;
    render(<MemoryRouter><n.Provedor><FolhaMaisE aberta onFechar={() => {}} data={hub} /></n.Provedor></MemoryRouter>);
    const folha = screen.getByTestId("hn-folha-mais");
    expect(folha.style.maxHeight).toBe("88dvh");
    teclado(498, 376); // o que o Simulador mostrou no Gasto (teclado numérico, janela arrastada)
    await waitFor(() => expect(folha.style.bottom).toBe("0px"));
    expect(folha.style.maxHeight).toBe("486px");
    teclado(498, 0);
    await waitFor(() => expect(folha.style.bottom).toBe("376px"));
    teclado(874, 0);
    await waitFor(() => expect(folha.style.maxHeight).toBe("88dvh"));
  });
});
