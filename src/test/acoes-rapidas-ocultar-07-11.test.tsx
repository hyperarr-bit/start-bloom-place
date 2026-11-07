/**
 * OCULTAR / ORDENAR AÇÕES RÁPIDAS NA HOME DE HOJE — dono 07/11 ("enxutar").
 *
 * A fileira "Ações rápidas" ganha a MESMA folha "Organizar" das abas dos módulos (hooks/use-abas-ocultas +
 * components/ui/abas-ocultaveis): interruptor por ação, ↑↓ pra ordem, "Mostrar todas as ações". A porta é o botão ao
 * lado do título (como o Personalizar das Pendências); com algo oculto, o chip "+N ocultas" no fim da fileira também abre.
 * Só muda pra quem escolher esconder: sem nada gravado, as 12 de sempre e nenhuma chave gravada. Chaves novas, prefixo
 * "abas-": `abas-ocultas:acoes-rapidas` (string[]) e `abas-ordem:acoes-rapidas`. O link de fora (Pendências/tour) abre o
 * formulário de uma ação oculta mesmo assim. Ciclo: abre → oculta → fecha → reabre (mesma conta; e o provider de
 * verdade com servidor em memória) → continua oculta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const ativacoes = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: (a: string) => { ativacoes.push(a); return Promise.resolve(); },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { QuickActions, MODULO_ACOES_RAPIDAS, abrirAcaoRapida } from "@/components/home/QuickActions";
import { _zerarTodasAsAbas, segurarTodasAsAbas } from "@/lib/abas-ocultas";
import { ABAS_POUCO_USO } from "@/lib/abas-enxutas";

const TODAS = ["water", "mood", "expense", "income", "weight", "workout", "sleep", "meal", "idea", "task", "gratitude", "detox"];
const CHAVE = "abas-ocultas:acoes-rapidas";
const CHAVE_ORDEM = "abas-ordem:acoes-rapidas";

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { escritas.push(key); dados[key] = JSON.parse(JSON.stringify(value)); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};
type Store = ReturnType<typeof criarStore>;
const renderHome = (store: Store, props: { titulo?: string } = { titulo: "Ações rápidas" }) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><QuickActions {...props} /></UserDataContext.Provider></MemoryRouter>);
const naFileira = () => Array.from(document.querySelectorAll<HTMLElement>("[data-acao-rapida]")).map((b) => b.getAttribute("data-acao-rapida"));
const abrirFolha = () => fireEvent.click(screen.getByTestId("acoes-organizar-abrir"));
const linha = (id: string) => document.querySelector<HTMLElement>(`[data-testid="abas-organizar-linha"][data-aba="${id}"]`)!;
const interruptor = (id: string) => linha(id).querySelector<HTMLElement>('[role="switch"]')!;
const formulario = (id: string) => document.querySelector(`[data-track-bloco="acao:${id}"]`);
const chavesAbas = (store: Store) => store.escritas.filter((k) => k.startsWith("abas-"));

beforeEach(() => { eventos.length = 0; ativacoes.length = 0; localStorage.clear(); _zerarTodasAsAbas(); });
afterEach(() => cleanup());

describe("Ações rápidas: a fileira de sempre pra quem não mexeu", () => {
  it("conta vazia: as 12 ações, nenhuma chave gravada; a porta é o botão ao lado do título; sem chip; sem padrão enxuto", () => {
    const store = criarStore();
    renderHome(store);
    expect(naFileira()).toEqual(TODAS);
    expect(screen.getByRole("heading", { name: "Ações rápidas" })).toBeInTheDocument();
    expect(screen.getByTestId("acoes-organizar-abrir")).toHaveAccessibleName("Organizar ações rápidas");
    expect(screen.queryByTestId("acoes-ocultas")).not.toBeInTheDocument();
    expect(chavesAbas(store)).toEqual([]);
    expect(store.dados[CHAVE]).toBeUndefined();
    // nenhuma lista de "pouco uso" pra este id: conta nova também vê as 12
    expect(ABAS_POUCO_USO[MODULO_ACOES_RAPIDAS]).toBeUndefined();
  });

  it("sem título (a folha do '+' da Home nova e os testes antigos): nem cabeçalho nem porta — a fileira de antes", () => {
    renderHome(criarStore(), {});
    expect(naFileira()).toEqual(TODAS);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("acoes-organizar-abrir")).not.toBeInTheDocument();
  });

  it("só formulários (o '+' da Home nova): sem fileira, sem porta, sem folha — e com ação oculta gravada nada muda", () => {
    const store = criarStore({ [CHAVE]: ["weight"] });
    render(<MemoryRouter><UserDataContext.Provider value={store.valor}><QuickActions apenasFormularios titulo="Ações rápidas" /></UserDataContext.Provider></MemoryRouter>);
    expect(naFileira()).toEqual([]);
    expect(screen.queryByTestId("acoes-organizar-abrir")).not.toBeInTheDocument();
    act(() => abrirAcaoRapida("weight"));
    expect(formulario("weight")).not.toBeNull();
  });
});

describe("a folha 'Organizar ações rápidas'", () => {
  it("ocultar 2 pela folha: somem da fileira, grava SÓ abas-ocultas:acoes-rapidas, chip '+2 ocultas'; eventos; religar e 'Mostrar todas'", () => {
    const store = criarStore({ "core-saude-copo-ml": 1000 });
    renderHome(store);
    abrirFolha();
    expect(eventos).toContainEqual(["abas_organizar_aberto", { modulo: "acoes-rapidas", ocultas: 0, origem: "cabecalho" }]);
    const folha = screen.getByRole("dialog", { name: "Organizar ações rápidas" });
    expect(folha).toBeInTheDocument();
    expect(folha).toHaveTextContent("Ocultar não apaga nada — a ação volta quando você liga.");
    expect(document.querySelectorAll('[data-testid="abas-organizar-linha"]')).toHaveLength(12);
    // os nomes são os dos botões — a água com o copo/garrafa da pessoa
    expect(linha("water")).toHaveTextContent("+ 1L Água");
    expect(linha("expense")).toHaveTextContent("Registrar Gasto");
    // nada de "segurar uma aba" aqui
    expect(folha).not.toHaveTextContent("segurar");

    fireEvent.click(interruptor("weight"));
    fireEvent.click(interruptor("detox"));
    expect(naFileira()).toEqual(TODAS.filter((id) => id !== "weight" && id !== "detox"));
    expect(store.dados[CHAVE]).toEqual(["weight", "detox"]);
    expect(new Set(chavesAbas(store))).toEqual(new Set([CHAVE]));
    expect(eventos).toContainEqual(["aba_ocultada", { modulo: "acoes-rapidas", aba: "weight" }]);
    expect(eventos).toContainEqual(["aba_ocultada", { modulo: "acoes-rapidas", aba: "detox" }]);
    expect(linha("weight").getAttribute("data-oculta")).toBe("1");

    // o chip no fim da fileira: conta e abre a mesma folha
    const chip = screen.getByTestId("acoes-ocultas");
    expect(chip).toHaveAccessibleName("2 ações ocultas");
    expect(chip).toHaveTextContent("+2 ocultas");
    fireEvent.click(screen.getByTestId("abas-organizar-pronto"));
    fireEvent.click(chip);
    expect(eventos).toContainEqual(["abas_organizar_aberto", { modulo: "acoes-rapidas", ocultas: 2, origem: "fileira" }]);

    // religa uma; "Mostrar todas as ações" grava [] (explícito) e o chip some
    fireEvent.click(interruptor("weight"));
    expect(store.dados[CHAVE]).toEqual(["detox"]);
    expect(eventos).toContainEqual(["aba_mostrada", { modulo: "acoes-rapidas", aba: "weight" }]);
    expect(screen.getByTestId("abas-organizar-mostrar-todas")).toHaveTextContent("Mostrar todas as ações");
    fireEvent.click(screen.getByTestId("abas-organizar-mostrar-todas"));
    expect(store.dados[CHAVE]).toEqual([]);
    expect(naFileira()).toEqual(TODAS);
    expect(screen.queryByTestId("acoes-ocultas")).not.toBeInTheDocument();
  });

  it("a última visível fica travada (interruptor desligado, hook recusa): nunca uma fileira vazia", () => {
    const store = criarStore({ [CHAVE]: TODAS.filter((id) => id !== "expense") });
    renderHome(store);
    expect(naFileira()).toEqual(["expense"]);
    abrirFolha();
    expect(interruptor("expense")).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Pelo menos uma ação fica sempre à vista.");
    fireEvent.click(interruptor("expense"));
    expect(naFileira()).toEqual(["expense"]);
    expect(chavesAbas(store)).toEqual([]);
    // gravação suja que esconderia tudo: a 1ª fica
    cleanup();
    renderHome(criarStore({ [CHAVE]: TODAS }));
    expect(naFileira()).toEqual(["water"]);
  });

  it("ocultar a ação cujo formulário está aberto fecha o formulário", async () => {
    renderHome(criarStore());
    fireEvent.click(screen.getByRole("button", { name: "Pesar Agora" }));
    expect(formulario("weight")).not.toBeNull();
    abrirFolha();
    fireEvent.click(interruptor("weight"));
    expect(naFileira()).not.toContain("weight");
    // o formulário sai com a animação de fechar (AnimatePresence) — espera ela terminar
    await waitFor(() => expect(formulario("weight")).toBeNull());
  });

  it("LINK DE FORA (Pendências de hoje / tour) abre o formulário de uma ação oculta mesmo assim; a fileira segue sem ela", () => {
    renderHome(criarStore({ [CHAVE]: ["weight", "sleep"] }));
    expect(naFileira()).not.toContain("sleep");
    act(() => abrirAcaoRapida("sleep"));
    expect(formulario("sleep")).not.toBeNull();
    expect(screen.getByPlaceholderText("Quantas horas dormiu?")).toBeInTheDocument();
    expect(naFileira()).not.toContain("sleep");
  });

  it("↑↓ grava a ordem em abas-ordem:acoes-rapidas e a fileira segue; as ocultas não entram na fileira", () => {
    const store = criarStore({ [CHAVE]: ["water"] });
    renderHome(store);
    expect(naFileira()[0]).toBe("mood");
    abrirFolha();
    fireEvent.click(screen.getByRole("button", { name: "Mover Registrar Gasto pra cima" }));
    expect(store.dados[CHAVE_ORDEM]).toEqual(["water", "expense", "mood", ...TODAS.slice(3)]);
    expect(eventos).toContainEqual(["aba_movida", { modulo: "acoes-rapidas", aba: "expense", para: 1 }]);
    expect(naFileira().slice(0, 2)).toEqual(["expense", "mood"]);
    expect(store.dados[CHAVE]).toEqual(["water"]); // a lista de ocultas não muda com a ordem
  });

  it("tutorial aberto (holofote) mostra as 12; ao fechar, voltam a ficar ocultas", () => {
    renderHome(criarStore({ [CHAVE]: ["weight"] }));
    expect(naFileira()).not.toContain("weight");
    let soltar: () => void = () => {};
    act(() => { soltar = segurarTodasAsAbas(); });
    expect(naFileira()).toEqual(TODAS);
    act(() => soltar());
    expect(naFileira()).not.toContain("weight");
  });

  it("DEMO de venda (/preview, /organizar/demo): sem a porta e sem o chip — a fileira de antes", () => {
    const store = criarStore({ [CHAVE]: ["weight"] });
    for (const rota of ["/preview/home", "/organizar/demo"]) {
      window.history.pushState({}, "", rota);
      renderHome(store);
      expect(screen.getByRole("heading", { name: "Ações rápidas" })).toBeInTheDocument();
      expect(screen.queryByTestId("acoes-organizar-abrir")).not.toBeInTheDocument();
      expect(screen.queryByTestId("acoes-ocultas")).not.toBeInTheDocument();
      cleanup();
    }
    window.history.pushState({}, "", "/home");
    renderHome(store);
    expect(screen.getByTestId("acoes-organizar-abrir")).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
});

describe("fechar e reabrir", () => {
  it("mesma conta: oculta → fecha → reabre: continua oculta, a ordem também; a chave não muda de formato", () => {
    const store = criarStore();
    renderHome(store);
    abrirFolha();
    fireEvent.click(interruptor("gratitude"));
    fireEvent.click(screen.getByRole("button", { name: "Mover Check de Humor pra cima" }));
    cleanup();

    renderHome(store);
    expect(naFileira()).toEqual(["mood", "water", ...TODAS.slice(2).filter((id) => id !== "gratitude")]);
    expect(screen.getByTestId("acoes-ocultas")).toHaveTextContent("+1 oculta");
    expect(Array.isArray(store.dados[CHAVE])).toBe(true);
    expect(store.dados[CHAVE]).toEqual(["gratitude"]);
    expect(Array.isArray(store.dados[CHAVE_ORDEM])).toBe(true);
  });

  it("provider de verdade (servidor em memória): oculta → fecha (cache varrido) → reabre: continua oculta; a chave vai pra conta e não vira ativação", async () => {
    vi.resetModules();
    const servidor = new Map<string, unknown>();
    const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
    vi.doMock("@/hooks/use-auth", async (orig) => ({ ...(await orig<typeof import("@/hooks/use-auth")>()), useAuth: () => auth }));
    vi.doMock("@/integrations/supabase/client", () => {
      const linhas = () => Promise.resolve({ data: [...servidor.entries()].map(([key, value]) => ({ key, value })), error: null });
      const selecao: Record<string, unknown> = {};
      Object.assign(selecao, {
        eq: () => selecao, order: () => selecao, range: () => selecao, in: () => Promise.resolve({ data: [], error: null }),
        abortSignal: linhas, then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => linhas().then(ok, erro),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      });
      return {
        supabase: {
          from: () => ({
            select: () => selecao,
            upsert: (row: { key: string; value: unknown } | Array<{ key: string; value: unknown }>) => {
              for (const r of Array.isArray(row) ? row : [row]) servidor.set(r.key, JSON.parse(JSON.stringify(r.value)));
              return Promise.resolve({ error: null });
            },
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }),
          auth: { getSession: async () => ({ data: { session: { access_token: "t", user: auth.user } } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
          functions: { invoke: async () => ({ data: null, error: null }) },
          rpc: async () => ({ data: null, error: null }),
        },
      };
    });
    const { UserDataProvider, useUserData } = await import("@/hooks/use-user-data");
    const { QuickActions: Acoes } = await import("@/components/home/QuickActions");

    const HomeReal = () => {
      const { loaded } = useUserData();
      return <div data-carregou={loaded ? "1" : "0"}><Acoes titulo="Ações rápidas" /></div>;
    };
    const abrirOApp = async () => {
      render(<MemoryRouter><UserDataProvider><HomeReal /></UserDataProvider></MemoryRouter>);
      await waitFor(() => expect(document.querySelector('[data-carregou="1"]')).not.toBeNull());
    };
    const fecharOApp = () => { cleanup(); localStorage.clear(); /* o pior caso: nada no aparelho, tudo volta do servidor */ };

    await abrirOApp();
    expect(naFileira()).toEqual(TODAS);
    abrirFolha();
    for (const id of ["weight", "meal", "detox"]) fireEvent.click(interruptor(id));
    await waitFor(() => expect(servidor.get(CHAVE)).toEqual(["weight", "meal", "detox"]), { timeout: 3000 });
    fecharOApp();

    await abrirOApp();
    await waitFor(() => expect(naFileira()).not.toContain("weight"));
    expect(naFileira()).toEqual(TODAS.filter((id) => !["weight", "meal", "detox"].includes(id)));
    expect(screen.getByTestId("acoes-ocultas")).toHaveTextContent("+3 ocultas");
    abrirFolha();
    fireEvent.click(interruptor("meal"));
    await waitFor(() => expect(servidor.get(CHAVE)).toEqual(["weight", "detox"]), { timeout: 3000 });
    fecharOApp();

    await abrirOApp();
    await waitFor(() => expect(naFileira()).toContain("meal"));
    expect(naFileira()).not.toContain("weight");
    // a chave da fileira foi pra conta e não virou ativação nenhuma (o prefixo "abas-" fica fora das regras)
    expect(servidor.has(CHAVE)).toBe(true);
    expect([...servidor.keys()].filter((k) => k.startsWith("abas-"))).toEqual([CHAVE]);
    expect(ativacoes).toEqual([]);
  });
});
