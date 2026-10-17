/**
 * LIMPEZA DO TOPO DE FINANÇAS (17/10, 1.0.16 — dono: "quebra o design").
 *
 * O link "Separar pessoa física e empresa" ficava no topo do MEU FINANCEIRO
 * pra todo mundo. Agora:
 *  - quem NÃO tem empresa não vê nada ali;
 *  - a entrada mora nos Ajustes de Finanças (⚙ no fim da fila de abas) e abre
 *    o MESMO formulário da barra de perfis, no topo do MEU FINANCEIRO — criar
 *    pelo menu é exatamente o que o link fazia (empresa nasce ativa);
 *  - quem JÁ tem empresa segue com a barra onde sempre esteve (troca de
 *    perfil, +, gerenciar);
 *  - eventos financas_pj_menu_abrir / financas_pj_criada, sem nome de empresa.
 *
 * A meta de calorias da Dieta (a outra metade da limpeza) está em
 * sugestoes-10-10.test.tsx, "3) Meta de calorias editável — tela da Dieta".
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }), Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-limpeza" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));

import { trackEvent } from "@/lib/analytics";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { esquecerPerfis, novoPerfil, type Perfil } from "@/lib/finance-perfil";
import { localDayKey } from "@/lib/utils";
import Index from "@/pages/Index";

type Dados = Record<string, unknown>;

/** Store como a nuvem (JSON; reativo) + as rotas do app e da demo. */
function montar(inicial: Dados, rota = "/financas") {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados, escritas: [] as string[] };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; estado.escritas.push(k); subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor>
        <Routes>
          <Route path="/financas" element={<Index />} />
          <Route path="/preview/financas" element={<Index />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return { estado, ler: <T,>(k: string) => estado.dados[k] as T };
}

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
beforeEach(() => { localStorage.clear(); vi.mocked(trackEvent).mockClear(); });
afterEach(() => { cleanup(); esquecerPerfis(); });

const hoje = localDayKey();
const BASE: Dados = {
  "spotlight-done-financas": "true", // sem o tutorial; a tela abre no Dashboard
  "finance-incomes": [{ id: "r1", date: hoje, value: 3000, description: "Salário" }],
  "finance-expenses": [{ id: "e1", date: hoje, value: 50, description: "Padaria", category: "alimentacao", paymentMethod: "pix" }],
};
const aba = (nome: RegExp) => screen.getByRole("button", { name: nome });
const abrirMeuFinanceiro = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /MEU FINANCEIRO/ }));
};
/** Dá a volta do relógio que o Radix usa pra devolver o foco quando a folha some. */
const umInstante = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe("novoPerfil — um caminho só pra criar empresa (barra e menu)", () => {
  it("nome em branco não cria; o nome entra limpo no fim da lista; id pj<base36>; a lista original não muda", () => {
    expect(novoPerfil([], "")).toBeNull();
    expect(novoPerfil([], "   ")).toBeNull();
    const antes: Perfil[] = [{ id: "pj-acme", nome: "Acme" }];
    const r = novoPerfil(antes, "  Ateliê da Ana ", 1760700000000);
    expect(r).toEqual({ id: `pj${(1760700000000).toString(36)}`, perfis: [{ id: "pj-acme", nome: "Acme" }, { id: `pj${(1760700000000).toString(36)}`, nome: "Ateliê da Ana" }] });
    expect(antes).toEqual([{ id: "pj-acme", nome: "Acme" }]);
    expect(novoPerfil(null as unknown as Perfil[], "X")?.perfis).toHaveLength(1); // lista torta não derruba
  });
});

describe("Finanças sem empresa — nada no topo, a entrada mora no ⚙", () => {
  it("o topo do MEU FINANCEIRO não tem o link antigo, nem barra, nem formulário; o ⚙ está na fila de abas", async () => {
    montar(BASE);
    await abrirMeuFinanceiro();
    expect(screen.queryByText("Separar pessoa física e empresa")).toBeNull();
    expect(screen.queryByTestId("seletor-de-perfil")).toBeNull();
    expect(screen.queryByRole("button", { name: "Adicionar empresa" })).toBeNull();
    expect(screen.queryByPlaceholderText("Nome da empresa")).toBeNull();
    expect(screen.getByRole("button", { name: "Ajustes de Finanças" })).toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalledWith("financas_pj_menu_abrir", expect.anything());
  });

  it("⚙ → 'Separar as finanças da empresa (PJ)': sai do Dashboard pro MEU FINANCEIRO com o formulário de sempre aberto (com foco); criar grava a empresa e já entra nela", async () => {
    const { ler } = montar(BASE);
    await screen.findByRole("button", { name: /MEU FINANCEIRO/ });
    expect(aba(/DASHBOARD/)).toHaveAttribute("data-active", "true");

    // no Chrome/WebView do Android o toque FOCA o botão — é pra ele que a folha devolveria o foco ao fechar
    screen.getByTestId("financas-ajustes").focus();
    fireEvent.click(screen.getByTestId("financas-ajustes"));
    const folha = await screen.findByTestId("financas-ajustes-folha");
    expect(within(folha).getByText("Ajustes de Finanças")).toBeInTheDocument();
    const entrada = within(folha).getByTestId("financas-pj-abrir");
    expect(entrada).toHaveTextContent("Separar as finanças da empresa (PJ)");
    expect(trackEvent).toHaveBeenCalledWith("financas_pj_menu_abrir", { passo: "menu", empresas: 0 });

    fireEvent.click(entrada);
    expect(trackEvent).toHaveBeenCalledWith("financas_pj_menu_abrir", { passo: "formulario", empresas: 0 });
    await waitFor(() => expect(screen.queryByTestId("financas-ajustes-folha")).toBeNull());
    expect(aba(/MEU FINANCEIRO/)).toHaveAttribute("data-active", "true");
    const barra = screen.getByTestId("seletor-de-perfil");
    // o formulário de sempre: [Pessoal] [+] · Nome da empresa · Criar · ×
    expect(within(barra).getByRole("button", { name: /Pessoal/ })).toHaveAttribute("aria-pressed", "true");
    const campo = within(barra).getByPlaceholderText("Nome da empresa");
    await umInstante();
    expect(campo).toHaveFocus(); // a folha não devolve o foco pro ⚙ (o teclado do iPhone ficaria fechando)

    fireEvent.change(campo, { target: { value: "  Ateliê da Ana  " } });
    fireEvent.click(within(barra).getByRole("button", { name: "Salvar empresa" }));
    const perfis = ler<Perfil[]>("finance-perfis");
    expect(perfis).toEqual([{ id: expect.stringMatching(/^pj[0-9a-z]+$/), nome: "Ateliê da Ana" }]);
    expect(ler("finance-perfil-ativo")).toBe(perfis[0].id);
    const barraDepois = screen.getByTestId("seletor-de-perfil");
    expect(within(barraDepois).getByRole("button", { name: /Ateliê da Ana/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(barraDepois).getByRole("button", { name: /Tudo junto/ })).toBeInTheDocument();
    expect(within(barraDepois).getByText("Gerenciar empresas")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Nome da empresa")).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("financas_pj_criada", { origem: "menu", empresas: 1 });
    // nenhum evento leva o nome da empresa
    for (const [, dados] of vi.mocked(trackEvent).mock.calls) expect(JSON.stringify(dados ?? {})).not.toMatch(/Ateli/);
  });

  it("cancelar o formulário aberto pelo menu: nada gravado, o topo volta limpo e o pedido não reabre ao voltar pra aba", async () => {
    const { estado } = montar(BASE);
    await abrirMeuFinanceiro();
    fireEvent.click(screen.getByTestId("financas-ajustes"));
    fireEvent.click(await screen.findByTestId("financas-pj-abrir"));
    await waitFor(() => expect(screen.queryByTestId("financas-ajustes-folha")).toBeNull());
    const barra = screen.getByTestId("seletor-de-perfil");
    fireEvent.change(within(barra).getByPlaceholderText("Nome da empresa"), { target: { value: "Quase" } });
    fireEvent.click(within(barra).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByTestId("seletor-de-perfil")).toBeNull();
    expect(estado.escritas).not.toContain("finance-perfis");
    expect(estado.escritas).not.toContain("finance-perfil-ativo");

    fireEvent.click(aba(/DASHBOARD/));
    fireEvent.click(aba(/MEU FINANCEIRO/));
    expect(screen.queryByPlaceholderText("Nome da empresa")).toBeNull();
    expect(screen.queryByTestId("seletor-de-perfil")).toBeNull();
    expect(trackEvent).not.toHaveBeenCalledWith("financas_pj_criada", expect.anything());
  });

  it("nome em branco no formulário do menu não cria nada", async () => {
    const { estado } = montar(BASE);
    await abrirMeuFinanceiro();
    fireEvent.click(screen.getByTestId("financas-ajustes"));
    fireEvent.click(await screen.findByTestId("financas-pj-abrir"));
    await waitFor(() => expect(screen.queryByTestId("financas-ajustes-folha")).toBeNull());
    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar empresa" }));
    expect(estado.escritas).not.toContain("finance-perfis");
    expect(screen.getByPlaceholderText("Nome da empresa")).toBeInTheDocument();
  });
});

describe("Finanças com empresa — a barra fica onde sempre esteve", () => {
  const COM_PJ: Dados = {
    ...BASE,
    "finance-perfis": [{ id: "pj-acme", nome: "Acme" }],
    "finance-perfil-ativo": "pessoal",
    "finance-expenses": [
      { id: "e1", date: hoje, value: 50, description: "Padaria", category: "alimentacao", paymentMethod: "pix" },
      { id: "e2", date: hoje, value: 900, description: "Notebook", category: "outros", paymentMethod: "pix", perfil: "pj-acme" },
    ],
  };

  it("barra no topo do MEU FINANCEIRO (antes do resumo), trocar de perfil filtra e grava, o + cria com origem 'barra'", async () => {
    const { ler } = montar(COM_PJ);
    await abrirMeuFinanceiro();
    const barra = screen.getByTestId("seletor-de-perfil");
    // no topo, como antes: vem antes do resumo do mês
    expect(barra.compareDocumentPosition(screen.getByText(/Receita Mensal/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(barra).getByRole("button", { name: /Pessoal/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(barra).getByRole("button", { name: /Acme/ })).toHaveAttribute("aria-pressed", "false");
    expect(within(barra).getByRole("button", { name: /Tudo junto/ })).toBeInTheDocument();
    // (o gasto aparece na tabela e no MEU MÊS — por isso "all")
    expect(screen.getAllByText("Padaria").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Notebook")).toHaveLength(0);

    fireEvent.click(within(barra).getByRole("button", { name: /Acme/ }));
    expect(ler("finance-perfil-ativo")).toBe("pj-acme");
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Padaria")).toHaveLength(0);

    fireEvent.click(within(screen.getByTestId("seletor-de-perfil")).getByRole("button", { name: "Adicionar empresa" }));
    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"), { target: { value: "Loja 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar empresa" }));
    expect(ler<Perfil[]>("finance-perfis").map((p) => p.nome)).toEqual(["Acme", "Loja 2"]);
    expect(trackEvent).toHaveBeenCalledWith("financas_pj_criada", { origem: "barra", empresas: 2 });
  });

  it("o ⚙ de quem já tem empresa oferece 'Adicionar outra empresa (PJ)' — e abre o mesmo formulário na barra", async () => {
    montar(COM_PJ);
    await screen.findByRole("button", { name: /MEU FINANCEIRO/ });
    fireEvent.click(screen.getByTestId("financas-ajustes"));
    const entrada = await screen.findByTestId("financas-pj-abrir");
    expect(entrada).toHaveTextContent("Adicionar outra empresa (PJ)");
    expect(trackEvent).toHaveBeenCalledWith("financas_pj_menu_abrir", { passo: "menu", empresas: 1 });
    fireEvent.click(entrada);
    await waitFor(() => expect(screen.queryByTestId("financas-ajustes-folha")).toBeNull());
    const barra = screen.getByTestId("seletor-de-perfil");
    expect(within(barra).getByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(within(barra).getByPlaceholderText("Nome da empresa")).toBeInTheDocument();
  });

  it("apagar a última empresa: a barra some de vez (o caminho de volta é o ⚙), e os lançamentos voltam pro Pessoal", async () => {
    const { ler } = montar(COM_PJ);
    await abrirMeuFinanceiro();
    fireEvent.click(within(screen.getByTestId("seletor-de-perfil")).getByText("Gerenciar empresas"));
    fireEvent.click(screen.getByRole("button", { name: "Apagar Acme" }));
    expect(ler<Perfil[]>("finance-perfis")).toEqual([]);
    expect(screen.queryByTestId("seletor-de-perfil")).toBeNull();
    expect(screen.queryByText("Separar pessoa física e empresa")).toBeNull();
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ajustes de Finanças" })).toBeInTheDocument();
  });
});

describe("Demo (/preview/financas)", () => {
  it("sem ⚙; a empresa semeada mostra a barra PF × PJ como antes; sem empresa, nada no topo", async () => {
    montar({ ...BASE, "finance-perfis": [{ id: "pj-demo", nome: "Minha empresa" }], "finance-perfil-ativo": "pessoal" }, "/preview/financas");
    await abrirMeuFinanceiro();
    expect(screen.queryByTestId("financas-ajustes")).toBeNull();
    expect(within(screen.getByTestId("seletor-de-perfil")).getByRole("button", { name: /Minha empresa/ })).toBeInTheDocument();
    cleanup();
    montar(BASE, "/preview/financas");
    await abrirMeuFinanceiro();
    expect(screen.queryByTestId("financas-ajustes")).toBeNull();
    expect(screen.queryByTestId("seletor-de-perfil")).toBeNull();
    expect(screen.queryByText("Separar pessoa física e empresa")).toBeNull();
  });
});
