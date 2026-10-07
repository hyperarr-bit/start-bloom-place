/**
 * Chamados do iPhone 1.0.9 e do Android (07/10), Beleza:
 *  (b) "produto que eu já incluí nos 'meus produtos' não me aparece como sugestão
 *      pra colocar naquele passo" + "os produtos que eu adiciono não ficam guardados
 *      pra usar outra vez" — o bloco NOS SEUS PRODUTOS só mostrava o que veio da
 *      lista curada E encaixava no passo; o produto digitado em Meus produtos (ou
 *      dentro de um passo) nunca voltava, e digitar de novo duplicava.
 *  (c) "passo novo fica sempre embaixo; teria que ter como editar a ordem sem
 *      excluir tudo" — setas Subir/Descer na ficha do passo, checks do dia andam junto.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => true, plataformaApp: () => "ios" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) } },
}));

import { guardarNaBancada, marcadosAposMover, meusProdutosParaOPasso, type PassoDaRotina, type ProdutoDaBancada, type ProdutoDoCatalogo } from "@/lib/beleza-rotina";
import catalogoBruto from "@/data/produtos-beleza.json";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";

const CATALOGO = catalogoBruto as unknown as ProdutoDoCatalogo[];
const SEG = new Date(2026, 9, 5, 9, 40); // segunda, 05/10/2026
const HOJE = "2026-10-05";

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
afterEach(() => { vi.useRealTimers(); });
const fixarData = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const Provider = ({ children }: { children: ReactNode }) => {
    const [estado, setEstado] = useState<Record<string, unknown>>(() => ({ ...dados }));
    const set = useCallback((chave: string, valor: unknown) => { dados[chave] = valor; setEstado((p) => ({ ...p, [chave]: valor })); }, []);
    const valor = useMemo<UserDataContextType>(() => ({
      get: <T,>(k: string, f: T) => (k in estado ? (estado[k] as T) : f),
      set, loaded: true, isGuest: true, fetchKey: async () => null,
    }), [estado, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode) => render(<MemoryRouter><Provider>{ui}</Provider></MemoryRouter>);
  return { dados, montar };
};

/** Produto digitado à mão em Meus produtos (o formato que o ProductShelf grava). */
const meuProduto = (id: string, name: string, brand = "", extra: Partial<ProdutoDaBancada> = {}): ProdutoDaBancada => ({
  id, name, brand, category: "Skincare", opened: false, openedDate: "", paoMonths: 12, expiry: "", notes: "", rating: 0,
  repurchase: false, price: 0, sizeMl: 0, photoUrl: "", frequency: "Diário", finished: false, ...extra,
});

const PASSOS_MANHA: PassoDaRotina[] = [
  { name: "Limpeza", tipo: "limpeza" },
  { name: "Hidratante", tipo: "hidratante" },
  { name: "Protetor solar", tipo: "protetor", isSunscreen: true },
];
const PASSOS_NOITE: PassoDaRotina[] = [{ name: "Limpeza", tipo: "limpeza" }, { name: "Hidratante noturno", tipo: "hidratante" }];

/* ═══════════════════ (b) o produto que a pessoa tem aparece no passo ═══════════════════ */

describe("(b) NOS SEUS PRODUTOS mostra o que a pessoa tem — digitado ou da lista", () => {
  it("regra: tudo de pele que não acabou; o que encaixa no passo vem primeiro; cabelo/maquiagem ficam fora; busca filtra", () => {
    const hidratanteDaLista = CATALOGO.find((c) => c.categoria === "hidratante")!;
    const bancada: ProdutoDaBancada[] = [
      meuProduto("a", "Sérum de vitamina C", "Farmácia"),
      meuProduto("b", hidratanteDaLista.nome, hidratanteDaLista.marca, { catalogoId: hidratanteDaLista.id, ativos: [...hidratanteDaLista.ativos] }),
      meuProduto("c", "Shampoo", "Marca", { category: "Cabelo" }),
      meuProduto("d", "Batom", "Marca", { category: "Maquiagem" }),
      meuProduto("e", "Acabou", "Marca", { finished: true }),
      meuProduto("f", "Hidratante do app antigo", "", { category: "" }),
    ];
    const ids = (l: ProdutoDaBancada[]) => l.map((p) => p.id);
    expect(ids(meusProdutosParaOPasso(bancada, CATALOGO, "hidratante"))[0]).toBe("b"); // o da lista que encaixa vem primeiro
    expect([...ids(meusProdutosParaOPasso(bancada, CATALOGO, "hidratante"))].sort()).toEqual(["a", "b", "f"]);
    expect([...ids(meusProdutosParaOPasso(bancada, CATALOGO, "limpeza"))].sort()).toEqual(["a", "b", "f"]); // nada encaixa: por marca/nome
    expect(ids(meusProdutosParaOPasso(bancada, CATALOGO, undefined))).toHaveLength(3);
    expect(ids(meusProdutosParaOPasso(bancada, CATALOGO, "hidratante", "vitamina"))).toEqual(["a"]);
    expect(ids(meusProdutosParaOPasso(bancada, null, "hidratante", "ANTIGO"))).toEqual(["f"]);
    expect(meusProdutosParaOPasso([null as unknown as ProdutoDaBancada, {} as ProdutoDaBancada], CATALOGO, "limpeza")).toEqual([]);
  });

  it("digitar o mesmo produto outra vez NÃO duplica em Meus produtos (marca e nome, sem acento/caixa)", () => {
    const bancada = [meuProduto("x", "Retinol 0,5% manipulado", "Farmácia de manipulação")];
    const r = guardarNaBancada(bancada, { marca: "farmacia de MANIPULACAO ", nome: "retinol 0,5% manipulado" }, "novo");
    expect(r.id).toBe("x");
    expect(r.bancada).toBe(bancada);
    const r2 = guardarNaBancada(bancada, { marca: "Outra", nome: "Retinol 0,5% manipulado" }, "novo");
    expect(r2.id).toBe("novo");
    expect(r2.bancada).toHaveLength(2);
  });

  it("na tela: o produto cadastrado em Meus produtos aparece no passo e, escolhido, liga sem criar outro", async () => {
    fixarData(SEG);
    const store = criarStore({
      "skincare-am-steps": PASSOS_MANHA,
      "skincare-pm-steps": PASSOS_NOITE,
      "beauty-products": [meuProduto("meu-1", "Sérum de vitamina C", "Farmácia")],
    });
    store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Hidratante" }));
    fireEvent.click(await screen.findByTestId("abrir-lista"));
    const meus = await screen.findByTestId("nos-seus-produtos");
    expect(within(meus).getByText("Sérum de vitamina C")).toBeInTheDocument();
    // buscando, o meu continua aparecendo quando bate com o nome
    fireEvent.change(screen.getByLabelText("Buscar produto"), { target: { value: "vitamina" } });
    expect(within(screen.getByTestId("nos-seus-produtos")).getByText("Sérum de vitamina C")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar produto"), { target: { value: "" } });
    fireEvent.click(within(screen.getByTestId("nos-seus-produtos")).getByRole("button", { name: "Farmácia Sérum de vitamina C" }));
    await screen.findByTestId("produto-na-ficha");
    expect(store.dados["beauty-products"]).toHaveLength(1);
    expect((store.dados["skincare-am-steps"] as PassoDaRotina[])[1].produtoId).toBe("meu-1");
    expect(toastMock.success).toHaveBeenCalledWith("Produto no passo", expect.anything());
  });
});

/* ═══════════════════ (c) ordem dos passos ═══════════════════ */

describe("(c) mover passo: setas na ficha, checks do dia andam junto", () => {
  it("regra dos checks: o marcado continua marcado no MESMO passo depois de mover", () => {
    expect(marcadosAposMover([0, 2], 2, 0)).toEqual([1, 0]);
    expect(marcadosAposMover([0, 2], 0, 2)).toEqual([2, 1]);
    expect(marcadosAposMover([1], 0, 2)).toEqual([0]);
    expect(marcadosAposMover([3], 0, 1)).toEqual([3]);
    expect(marcadosAposMover([1], 1, 1)).toEqual([1]);
  });

  it("na tela: 'Subir' leva o passo de baixo pra cima, a ficha segue o passo, o check de hoje acompanha; nas pontas a seta desliga", async () => {
    fixarData(SEG);
    const store = criarStore({
      "skincare-am-steps": PASSOS_MANHA,
      "skincare-pm-steps": PASSOS_NOITE,
      "skincare-morning-checked": { [HOJE]: [2] }, // o protetor (3º) já foi marcado hoje
    });
    store.montar(<SkincareRoutine />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Protetor solar" }));
    const ficha = await screen.findByTestId("ficha-passo");
    expect(within(ficha).getByTestId("ordem-do-passo")).toHaveTextContent("3º de 3");
    expect(within(ficha).getByRole("button", { name: "Descer Protetor solar" })).toBeDisabled();
    fireEvent.click(within(ficha).getByRole("button", { name: "Subir Protetor solar" }));
    expect((store.dados["skincare-am-steps"] as PassoDaRotina[]).map((p) => p.name)).toEqual(["Limpeza", "Protetor solar", "Hidratante"]);
    expect((store.dados["skincare-morning-checked"] as Record<string, number[]>)[HOJE]).toEqual([1]);
    // a ficha continua no protetor, agora 2º
    expect(within(screen.getByTestId("ficha-passo")).getByTestId("ordem-do-passo")).toHaveTextContent("2º de 3");
    fireEvent.click(within(screen.getByTestId("ficha-passo")).getByRole("button", { name: "Subir Protetor solar" }));
    expect((store.dados["skincare-am-steps"] as PassoDaRotina[]).map((p) => p.name)).toEqual(["Protetor solar", "Limpeza", "Hidratante"]);
    expect((store.dados["skincare-morning-checked"] as Record<string, number[]>)[HOJE]).toEqual([0]);
    expect(within(screen.getByTestId("ficha-passo")).getByRole("button", { name: "Subir Protetor solar" })).toBeDisabled();
    // o formato das chaves não mudou: array de passos, mapa dia → índices
    expect(Array.isArray(store.dados["skincare-am-steps"])).toBe(true);
    expect(typeof store.dados["skincare-morning-checked"]).toBe("object");
  });
});
