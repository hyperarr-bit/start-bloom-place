/**
 * Dois avisos de um cliente na WEB (11/09):
 *
 *   1. "as ações rápidas não tá dando pra arrastar pro lado" — o app foi
 *      desenhado pro dedo; com mouse não existe arrasto nativo e a barra
 *      está escondida. Agora QUALQUER faixa que rola pro lado arrasta com o
 *      mouse (instalado uma vez no boot), e o click que fecha o arrasto é
 *      engolido pra não abrir o botão em que o arrasto começou.
 *
 *   2. "em biblioteca quando clica em editar, a aba de editar cria lá em cima
 *      e tem que rolar até em cima" — o formulário de EDITAR agora nasce logo
 *      abaixo do livro clicado; o de NOVO segue no topo.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { instalarArrastarComMouse } from "@/lib/arrastar-com-mouse";
import Biblioteca from "@/pages/Biblioteca";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) } },
}));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

const rolagens: Element[] = [];
beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = function () { rolagens.push(this); };
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => { rolagens.length = 0; });

describe("arrastar com o mouse (web/PC)", () => {
  const faixa = (larguraConteudo: number, larguraVisivel: number) => {
    const el = document.createElement("div");
    el.style.overflowX = "auto";
    Object.defineProperty(el, "scrollWidth", { value: larguraConteudo, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: larguraVisivel, configurable: true });
    const botao = document.createElement("button");
    botao.textContent = "Registrar um gasto";
    el.appendChild(botao);
    document.body.appendChild(el);
    return { el, botao };
  };
  const mouse = (tipo: string, alvo: EventTarget, x: number) =>
    alvo.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, button: 0 }));

  beforeAll(() => {
    window.matchMedia = ((q: string) => ({ matches: q === "(pointer: fine)", media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    instalarArrastarComMouse();
  });

  it("segurar e mover 80 px rola a faixa 80 px e ENGOLE o click do fim do arrasto", () => {
    const { el, botao } = faixa(1600, 400);
    const clicou = vi.fn();
    botao.addEventListener("click", clicou);
    el.scrollLeft = 100;

    mouse("mousedown", botao, 300);
    mouse("mousemove", document, 260);
    mouse("mousemove", document, 220);
    expect(el.scrollLeft).toBe(180);
    expect(el.style.cursor).toBe("grabbing");
    mouse("mouseup", document, 220);
    mouse("click", botao, 220);
    expect(clicou).not.toHaveBeenCalled();
    expect(el.style.cursor).toBe("");
    el.remove();
  });

  it("click parado (menos de 6 px) continua sendo click", () => {
    const { el, botao } = faixa(1600, 400);
    const clicou = vi.fn();
    botao.addEventListener("click", clicou);
    mouse("mousedown", botao, 300);
    mouse("mousemove", document, 297);
    mouse("mouseup", document, 297);
    mouse("click", botao, 297);
    expect(clicou).toHaveBeenCalledTimes(1);
    expect(el.scrollLeft).toBe(0);
    el.remove();
  });

  it("faixa que CABE na tela não vira arrasto (texto continua selecionável)", () => {
    const { el, botao } = faixa(300, 400);
    mouse("mousedown", botao, 300);
    mouse("mousemove", document, 200);
    expect(el.style.cursor).toBe("");
    expect(el.style.userSelect).toBe("");
    el.remove();
  });
});

describe("Biblioteca: editar abre no lugar", () => {
  const livro = (id: string, title: string) => ({
    id, title, author: "Autor", cover: "", status: "lido", rating: 4, genre: "Ficção", pages: 200, currentPage: 200,
    notes: "", startDate: "", endDate: "2026-03-01", goalDate: "", quotes: [], lentTo: "", lentDate: "", lentReturnDate: "",
  });
  const montar = () => {
    const dados: Record<string, unknown> = { "lib-books": [livro("a", "Primeiro da estante"), livro("b", "Do meio"), livro("c", "Último lá embaixo")] };
    const valor: UserDataContextType = {
      get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
      set: (key: string, value: unknown) => { dados[key] = value; },
      loaded: true, isGuest: true, fetchKey: async () => null,
    };
    return render(<MemoryRouter><UserDataContext.Provider value={valor}><Biblioteca /></UserDataContext.Provider></MemoryRouter>);
  };

  it("lápis do ÚLTIMO livro: o formulário nasce logo abaixo dele, não no topo da aba", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Estante/ }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Último lá embaixo" }));

    const form = screen.getByText(/EDITAR LIVRO/).closest("div.rounded-xl") as HTMLElement;
    const ultimo = screen.getByText("Último lá embaixo");
    const primeiro = screen.getByText("Primeiro da estante");
    // DOM order: primeiro < último < formulário
    expect(ultimo.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primeiro.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // e o formulário fica DENTRO do grupo do livro (mesmo cartão-pai da linha)
    expect(form.parentElement).toBe(ultimo.closest("div.space-y-2"));
    // a página rola até ele
    expect(rolagens).toContain(form);
    // campo já vem com o livro certo
    expect((screen.getByDisplayValue("Último lá embaixo") as HTMLInputElement).value).toBe("Último lá embaixo");
  });

  it("'Adicionar livro' continua no topo, e a página rola até o formulário (o + flutuante fica no pé)", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Estante/ }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    const form = screen.getByText(/NOVO LIVRO/).closest("div.rounded-xl") as HTMLElement;
    const primeiro = screen.getByText("Primeiro da estante");
    expect(form.compareDocumentPosition(primeiro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rolagens).toContain(form);
  });
});
