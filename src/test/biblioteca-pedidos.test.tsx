/**
 * Biblioteca — pedido de uma cliente PAGANTE (09/09):
 *
 *   "estou adicionando meus livros no catálogo para ter uma meta de leitura.
 *    Vi que tem anotações. Mas abre um campo abaixo das anotações para a
 *    SINOPSE, pois estou usando as anotações para isso. Também um campo para
 *    separar livro FÍSICO e E-BOOK, e o que é APOSTILA DE CURSO. E que tenha
 *    como adicionar FOTO do livro, se não acharmos o link."
 *
 * E o que ela NÃO disse mas estava por trás do "para ter uma meta de
 * leitura": livro marcado "lido" sem data de fim nunca entrava na meta do
 * ano — o campo FIM não se preenchia sozinho.
 *
 * Ciclo completo (regra da casa, 19/07): abrir → usar → SAIR → REABRIR.
 * Rede, upload e Storage são mockados: aqui se testa a tela e a chave
 * lib-books, não o Supabase.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { localDayKey } from "@/lib/utils";
import Biblioteca, { rotuloDoFormato } from "@/pages/Biblioteca";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));

const uploadFromInput = vi.fn();
vi.mock("@/lib/image-upload", () => ({
  uploadFromInput: (...a: unknown[]) => uploadFromInput(...a),
}));

// A página puxa auth e telemetria; aqui não há sessão nem rede.
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

/* Radix Select no jsdom: o trigger abre por TECLADO (ArrowDown — o
   pointerdown exige pointerType "mouse", que o jsdom não tem) e a opção
   seleciona no click (pointerType padrão do item é "touch"). O que falta no
   jsdom é scrollIntoView, pointer capture e ResizeObserver (popper). */
beforeAll(() => {
  // framer-motion (ModuleTip) mede keyframes com window.scrollTo — só ruído no jsdom
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

beforeEach(() => {
  invoke.mockReset();
  uploadFromInput.mockReset();
});

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

type LivroSalvo = Record<string, unknown> & { id: string; endDate?: string; synopsis?: string; format?: string; cover?: string };
const livrosDe = (store: ReturnType<typeof criarStore>) => (store.dados["lib-books"] ?? []) as LivroSalvo[];

/** Livro no formato COMPLETO que o formulário grava desde sempre. */
const livro = (extra: Record<string, unknown> & { id: string; title: string }) => ({
  author: "Autor", cover: "", status: "quero-ler", rating: 0, genre: "Ficção", pages: 0, currentPage: 0,
  notes: "", startDate: "", endDate: "", goalDate: "", quotes: [], lentTo: "", lentDate: "", lentReturnDate: "",
  ...extra,
});

const montar = (store: ReturnType<typeof criarStore>) =>
  render(
    <MemoryRouter>
      <UserDataContext.Provider value={store.valor}><Biblioteca /></UserDataContext.Provider>
    </MemoryRouter>,
  );

const aba = (nome: RegExp) => fireEvent.click(screen.getByRole("button", { name: nome }));

const escolherNoSelect = async (nome: string, opcao: RegExp) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name: nome }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
};

/* ============================================================
 * SINOPSE — "abre um campo abaixo das anotações para a SINOPSE"
 * ============================================================ */
describe("Sinopse", () => {
  it("tem campo próprio ABAIXO das anotações, grava em lib-books, aparece ao expandir a linha e sobrevive ao REABRIR", () => {
    const store = criarStore();
    const tela = montar(store);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.change(screen.getByPlaceholderText("Título"), { target: { value: "Hábitos Atômicos" } });
    fireEvent.change(screen.getByPlaceholderText("Autor"), { target: { value: "James Clear" } });

    const anotacoes = screen.getByLabelText("Anotações");
    const sinopse = screen.getByLabelText("Sinopse");
    // é literalmente onde ela pediu: a sinopse vem DEPOIS das anotações
    expect(anotacoes.compareDocumentPosition(sinopse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(anotacoes, { target: { value: "Reler o cap. 3 antes da prova" } });
    fireEvent.change(sinopse, { target: { value: "Pequenas mudanças, resultados impressionantes." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));

    const [salvo] = livrosDe(store);
    expect(salvo.synopsis).toBe("Pequenas mudanças, resultados impressionantes.");
    expect(salvo.notes).toBe("Reler o cap. 3 antes da prova");

    // lista FECHADA: só o toque, sem o texto poluindo a estante
    expect(screen.getByText("Hábitos Atômicos")).toBeInTheDocument();
    expect(screen.queryByText(/Pequenas mudanças/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reler o cap/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sinopse e anotações" }));
    expect(screen.getByText(/Pequenas mudanças/)).toBeInTheDocument();
    expect(screen.getByText(/Reler o cap/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(screen.queryByText(/Pequenas mudanças/)).not.toBeInTheDocument();

    // SAI e REABRE
    tela.unmount();
    montar(store);
    aba(/Estante/);
    fireEvent.click(screen.getByRole("button", { name: "Sinopse e anotações" }));
    expect(screen.getByText(/Pequenas mudanças/)).toBeInTheDocument();
    expect(screen.getByText(/Reler o cap/)).toBeInTheDocument();
  });

  it("só sinopse OU só anotações: o toque diz o que tem; sem nenhum, não há toque", () => {
    const store = criarStore({
      "lib-books": [
        livro({ id: "a", title: "Só sinopse", synopsis: "Do que trata." }),
        livro({ id: "b", title: "Só anotações", notes: "Minha nota." }),
        livro({ id: "c", title: "Nada" }),
      ],
    });
    montar(store);
    aba(/Estante/);
    expect(screen.getByRole("button", { name: "Sinopse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anotações" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(Sinopse|Anotações|Sinopse e anotações)$/ })).toHaveLength(2);
  });
});

/* ============================================================
 * FORMATO — "separar livro FÍSICO e E-BOOK, e o que é APOSTILA DE CURSO"
 * ============================================================ */
describe("Formato", () => {
  it("selo na linha (com o gênero, que já era gravado e nunca aparecia) e filtro na Estante", async () => {
    const store = criarStore({
      "lib-books": [
        livro({ id: "a", title: "Clean Code", format: "fisico" }),
        livro({ id: "b", title: "Deep Work", format: "ebook", status: "lido", endDate: "2026-02-01" }),
        livro({ id: "c", title: "Apostila de Excel", format: "apostila", genre: "Técnico" }),
      ],
    });
    montar(store);
    aba(/Estante/);
    expect(screen.getByText("📕 Físico")).toBeInTheDocument();
    expect(screen.getByText("📱 E-book")).toBeInTheDocument();
    expect(screen.getByText("📎 Apostila de curso")).toBeInTheDocument();
    expect(screen.getByText("Técnico")).toBeInTheDocument();

    // filtro por formato com status "Todos": só a apostila sobra, nos grupos
    await escolherNoSelect("Filtrar por formato", /Apostila/);
    expect(screen.getByText("Apostila de Excel")).toBeInTheDocument();
    expect(screen.queryByText("Clean Code")).not.toBeInTheDocument();
    expect(screen.queryByText("Deep Work")).not.toBeInTheDocument();

    // formato sem livro nenhum: mensagem, não tela em branco
    await escolherNoSelect("Filtrar por formato", /Audiobook/);
    expect(screen.getByText(/Nenhum livro encontrado/)).toBeInTheDocument();
  });

  it("o formulário grava o formato escolhido; sem escolher, o livro fica sem formato (não 'undefined')", async () => {
    const store = criarStore();
    montar(store);
    aba(/Estante/);
    fireEvent.click(screen.getByRole("button", { name: "Novo livro" }));
    fireEvent.change(screen.getByPlaceholderText("Título"), { target: { value: "Apostila de Excel" } });
    await escolherNoSelect("Formato", /Apostila/);
    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));
    expect(livrosDe(store)[0].format).toBe("apostila");

    fireEvent.click(screen.getByRole("button", { name: "Novo livro" }));
    fireEvent.change(screen.getByPlaceholderText("Título"), { target: { value: "Sem formato" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));
    expect(livrosDe(store)[1].format).toBeUndefined();
    expect(document.body.textContent).not.toMatch(/undefined/);
  });
});

/* ============================================================
 * META DE LEITURA — "para ter uma meta de leitura"
 * ============================================================ */
describe("Meta de leitura conta de verdade", () => {
  it("virar 'lido' preenche o FIM com HOJE (dia local, nunca UTC) e a meta do ano sobe", async () => {
    const store = criarStore({
      "lib-books": [livro({ id: "a", title: "Essencialismo", status: "lendo", pages: 200, currentPage: 200, startDate: "2026-08-01" })],
    });
    montar(store);
    aba(/Desafio/);
    expect(screen.getByText("0 de 12 livros")).toBeInTheDocument();

    aba(/Estante/);
    fireEvent.click(screen.getByRole("button", { name: "Editar Essencialismo" }));
    await escolherNoSelect("Status", /Lido/);
    expect(screen.getByLabelText("Data de fim")).toHaveValue(localDayKey());
    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));
    expect(livrosDe(store)[0].endDate).toBe(localDayKey());

    aba(/Desafio/);
    expect(screen.getByText("1 de 12 livros")).toBeInTheDocument();
  });

  it("livros 'lido' de antes, SEM data: aviso na aba Desafio e um toque conta eles no ano — sem mexer em quem já tinha data", () => {
    const store = criarStore({
      "lib-books": [
        livro({ id: "a", title: "Sapiens", status: "lido" }),
        livro({ id: "b", title: "Mindset", status: "lido" }),
        livro({ id: "c", title: "Duna", status: "lido", endDate: "2024-05-10" }),
      ],
    });
    montar(store);
    aba(/Desafio/);
    expect(screen.getByText("0 de 12 livros")).toBeInTheDocument();
    expect(screen.getByText(/2 livros lidos sem data não entram na meta/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contar como lidos este ano" }));
    expect(screen.getByText("2 de 12 livros")).toBeInTheDocument();
    expect(screen.queryByText(/sem data não entra/)).not.toBeInTheDocument();

    const livros = livrosDe(store);
    expect(livros.find(l => l.id === "a")?.endDate).toBe(localDayKey());
    expect(livros.find(l => l.id === "b")?.endDate?.startsWith(String(new Date().getFullYear()))).toBe(true);
    expect(livros.find(l => l.id === "c")?.endDate).toBe("2024-05-10");
  });
});

/* ============================================================
 * RETROCOMPATIBILIDADE — livro antigo e a demo pública
 * ============================================================ */
describe("Livro antigo", () => {
  it("no formato das seeds (sem gênero, formato, páginas, citações) renderiza sem 'undefined', sem selo e sem toque de detalhe", () => {
    const store = criarStore({
      "lib-books": [
        { id: "1", title: "Hábitos Atômicos", author: "James Clear", status: "lendo", progress: 65 },
        { id: "2", title: "Mindset", author: "Carol Dweck", status: "lido", progress: 100 },
      ],
    });
    montar(store);
    aba(/Estante/);
    expect(screen.getByText("Mindset")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
    expect(screen.queryByText(/Físico|E-book|Audiobook|Apostila/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Sinopse|Anotações|Sinopse e anotações)$/ })).not.toBeInTheDocument();

    expect(rotuloDoFormato(undefined)).toBeNull();
    expect(rotuloDoFormato("kindle")).toBeNull();
    expect(rotuloDoFormato("ebook")).toBe("📱 E-book");
  });

  it("a demo pública /preview/biblioteca continua montando com as seeds", () => {
    render(
      <MemoryRouter>
        <PreviewUserDataProvider moduleKey="biblioteca"><Biblioteca /></PreviewUserDataProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Hábitos Atômicos").length).toBeGreaterThan(0);
    expect(document.querySelector('[data-spotlight="tab-estante"]')).not.toBeNull();
    aba(/Estante/);
    expect(screen.getByText("Mindset")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });
});

/* ============================================================
 * IMPORT POR LINK — a function sempre devolveu description; o app descartava
 * ============================================================ */
describe("Import por link", () => {
  it("preenche a sinopse com a description da function (e título, autor, capa)", async () => {
    invoke.mockResolvedValue({
      data: { success: true, data: { title: "Hábitos Atômicos", author: "James Clear", cover: "https://capa.exemplo/x.jpg", description: "Pequenas mudanças, resultados impressionantes." } },
      error: null,
    });
    const store = criarStore();
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.change(screen.getByPlaceholderText("Cole o link do livro aqui..."), { target: { value: "https://www.amazon.com.br/dp/8550807567" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar dados do link" }));

    await waitFor(() => expect(screen.getByLabelText("Sinopse")).toHaveValue("Pequenas mudanças, resultados impressionantes."));
    expect(invoke).toHaveBeenCalledWith("fetch-book-metadata", { body: { url: "https://www.amazon.com.br/dp/8550807567" } });
    expect(screen.getByPlaceholderText("Título")).toHaveValue("Hábitos Atômicos");
    expect(screen.getByPlaceholderText("Autor")).toHaveValue("James Clear");
    expect(screen.getByRole("img", { name: "Capa" })).toHaveAttribute("src", "https://capa.exemplo/x.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));
    expect(livrosDe(store)[0].synopsis).toBe("Pequenas mudanças, resultados impressionantes.");
  });

  it("function sem description (resposta antiga) deixa a sinopse vazia, nunca 'undefined'", async () => {
    invoke.mockResolvedValue({ data: { success: true, data: { title: "Sem sinopse", author: "", cover: "" } }, error: null });
    montar(criarStore());
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.change(screen.getByPlaceholderText("Cole o link do livro aqui..."), { target: { value: "https://www.goodreads.com/book/show/1" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar dados do link" }));
    await waitFor(() => expect(screen.getByPlaceholderText("Título")).toHaveValue("Sem sinopse"));
    expect(screen.getByLabelText("Sinopse")).toHaveValue("");
  });
});

/* ============================================================
 * FOTO DA CAPA — "adicionar FOTO do livro, se não acharmos o link"
 * ============================================================ */
describe("Foto da capa", () => {
  it("sobe pro Storage (bucket dream-board, pasta biblioteca) e vira o cover — nunca base64 dentro de lib-books", async () => {
    uploadFromInput.mockResolvedValue("https://itoylenzvahbscgjgtqf.supabase.co/storage/v1/object/sign/dream-board/uid-1/biblioteca/1.webp?token=x");
    const store = criarStore();
    montar(store);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.change(screen.getByPlaceholderText("Título"), { target: { value: "Livro sem link" } });

    const arquivo = new File(["x"], "capa.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Escolher foto da capa"), { target: { files: [arquivo] } });

    await waitFor(() => expect(screen.getByRole("img", { name: "Capa" })).toHaveAttribute("src", expect.stringContaining("/biblioteca/")));
    expect(uploadFromInput).toHaveBeenCalledWith(expect.anything(), "dream-board", "biblioteca");

    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));
    const [salvo] = livrosDe(store);
    expect(salvo.cover).toContain("/dream-board/");
    expect(String(salvo.cover).startsWith("data:")).toBe(false);
  });

  it("sem conta (demo/convidado) o upload devolve null: a tela AVISA em vez de sumir com a foto", async () => {
    uploadFromInput.mockResolvedValue(null);
    montar(criarStore());
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.change(screen.getByLabelText("Escolher foto da capa"), { target: { files: [new File(["x"], "capa.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText(/Não deu pra subir a foto/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Capa" })).not.toBeInTheDocument();
  });
});
