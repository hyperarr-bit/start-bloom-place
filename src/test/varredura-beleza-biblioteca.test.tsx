/**
 * Varredura da demo em BELEZA e BIBLIOTECA (26/09) — os achados de
 * /preview/beleza e /preview/biblioteca. Cada teste monta o componente real e
 * confere o DADO gravado (formato das chaves de conta real), não só a tela.
 *
 * Beleza lê as chaves direto do store a cada render (Espelho, Rotina e Diário
 * falam entre si), então aqui o store é REATIVO: gravar re-renderiza, como no
 * app e na demo.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) },
  },
}));

import Beleza from "@/pages/Beleza";
import Biblioteca, { paginaValida, metaDoRascunho, situacaoDevolucao } from "@/pages/Biblioteca";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { DailyMirror } from "@/components/beleza/DailyMirror";
import { ProductShelf } from "@/components/beleza/ProductShelf";
import { SkinDiary } from "@/components/beleza/SkinDiary";
import { conflitosDaRotina, faseDoCiclo, marcadosAposInserir, marcadosAposRemover, inserirEm } from "@/components/beleza/utils";

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

beforeEach(() => {
  toastMock.mockClear();
  toastMock.error.mockClear();
  window.history.pushState({}, "", "/beleza");
});
afterEach(() => { window.history.pushState({}, "", "/"); });

const HOJE = localDayKey();
const diaMais = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDayKey(d); };

/** Store reativo (Beleza): `dados` é o espelho pra asserção; `escritas` guarda as opções do set. */
const criarStoreReativo = (inicial: Record<string, unknown> = {}, { loaded = true } = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: { chave: string; valor: unknown; opts?: { system?: boolean } }[] = [];
  const Provider = ({ children }: { children: ReactNode }) => {
    const [estado, setEstado] = useState<Record<string, unknown>>(() => ({ ...dados }));
    const set = useCallback((chave: string, valor: unknown, opts?: { system?: boolean }) => {
      dados[chave] = valor;
      escritas.push({ chave, valor, opts });
      setEstado(p => ({ ...p, [chave]: valor }));
    }, []);
    const valor = useMemo<UserDataContextType>(() => ({
      get: <T,>(k: string, f: T) => (k in estado ? (estado[k] as T) : f),
      set, loaded, isGuest: true, fetchKey: async () => null,
    }), [estado, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode) => render(<MemoryRouter><Provider>{ui}</Provider></MemoryRouter>);
  return { dados, escritas, montar };
};

/** Store simples (Biblioteca usa usePersistedState, que guarda o próprio estado). */
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

/** O "Desfazer" do avisarApagado: o onClick da ação do último toast. */
const desfazerUltimo = () => {
  const ultimo = toastMock.mock.calls[toastMock.mock.calls.length - 1];
  expect(ultimo[1]?.action?.label).toBe("Desfazer");
  // o toque no toast vem de fora da árvore React: act pra tela acompanhar
  act(() => { ultimo[1].action.onClick(); });
};

const nomes = (v: unknown) => (v as { name: string }[]).map(s => s.name);
const linhaDe = (texto: string) => screen.getByText(texto).closest("div.group") as HTMLElement;
const marcado = (texto: string) => within(linhaDe(texto)).getByRole("checkbox").getAttribute("aria-checked") === "true";

/* ═════════════════════════════ BELEZA ═════════════════════════════ */

describe("Beleza 1 — modo Sensível: o X apaga o passo certo", () => {
  it("X no Hidratante noturno apaga ELE (não o Retinol escondido); o check anda junto; Desfazer devolve no lugar", () => {
    const store = criarStoreReativo({
      "skincare-pm-steps": [{ name: "Demaquilante" }, { name: "Retinol", isAcid: true }, { name: "Hidratante noturno" }],
      "skincare-night-checked": { [HOJE]: [2] },
      "skincare-daily-checkin": { [HOJE]: "sensivel" },
      "skincare-cycle-start": HOJE,
    });
    store.montar(<><DailyMirror /><SkincareRoutine /></>);

    expect(screen.queryByText("Retinol")).not.toBeInTheDocument(); // ácido escondido no sensível
    expect(marcado("Hidratante noturno")).toBe(true); // check pelo índice ORIGINAL (2)
    expect(marcado("Demaquilante")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Tirar Hidratante noturno da rotina" }));
    expect(nomes(store.dados["skincare-pm-steps"])).toEqual(["Demaquilante", "Retinol"]);
    expect((store.dados["skincare-night-checked"] as Record<string, number[]>)[HOJE]).toEqual([]);
    expect(toastMock).toHaveBeenLastCalledWith('"Hidratante noturno" saiu da rotina', expect.anything());

    desfazerUltimo();
    expect(nomes(store.dados["skincare-pm-steps"])).toEqual(["Demaquilante", "Retinol", "Hidratante noturno"]);
    expect((store.dados["skincare-night-checked"] as Record<string, number[]>)[HOJE]).toEqual([2]);

    // pele volta a "Boa": o Retinol reaparece DESMARCADO e o check segue no Hidratante
    fireEvent.click(screen.getByRole("button", { name: /Boa/ }));
    expect(marcado("Retinol")).toBe(false);
    expect(marcado("Hidratante noturno")).toBe(true);
  });

  it("apagar passo do meio corrige os índices marcados de hoje (funções puras)", () => {
    expect(marcadosAposRemover([0, 2, 3], 1)).toEqual([0, 1, 2]);
    expect(marcadosAposRemover([0, 1], 1)).toEqual([0]);
    expect(marcadosAposInserir([0, 1, 2], 1, true)).toEqual([0, 2, 3, 1]);
    expect(marcadosAposInserir([0], 1, false)).toEqual([0]);
    expect(inserirEm(["a", "c"], 1, "b")).toEqual(["a", "b", "c"]);
    expect(inserirEm(["a"], 9, "b")).toEqual(["a", "b"]); // lista encolheu: vai pro fim
  });
});

describe("Beleza 2 — skin cycling anda", () => {
  it("grava o início na 1ª vez (escrita de SISTEMA) e hoje é o Dia 1/4", () => {
    const store = criarStoreReativo({});
    store.montar(<SkincareRoutine />);
    expect(store.dados["skincare-cycle-start"]).toBe(HOJE);
    expect(store.escritas.find(e => e.chave === "skincare-cycle-start")?.opts).toEqual({ system: true });
    expect(screen.getByText("Skin Cycling: Esfoliação")).toBeInTheDocument();
    expect(screen.getByText("Dia 1/4")).toBeInTheDocument();
  });

  it("antes de carregar não grava nada (aparelho novo não atropela o início do servidor)", () => {
    const store = criarStoreReativo({}, { loaded: false });
    store.montar(<SkincareRoutine />);
    expect(store.escritas.filter(e => e.chave === "skincare-cycle-start")).toHaveLength(0);
  });

  it("início há 2 dias = Recuperação, Dia 3/4; quem já tem início não é regravado", () => {
    const store = criarStoreReativo({ "skincare-cycle-start": diaMais(-2) });
    store.montar(<SkincareRoutine />);
    expect(screen.getByText("Skin Cycling: Recuperação")).toBeInTheDocument();
    expect(screen.getByText("Dia 3/4")).toBeInTheDocument();
    expect(store.escritas).toHaveLength(0);
  });

  it("faseDoCiclo conta dias locais e nunca dá NaN", () => {
    expect(faseDoCiclo("2026-09-26", "2026-09-26")).toBe(0);
    expect(faseDoCiclo("2026-09-26", "2026-09-27")).toBe(1);
    expect(faseDoCiclo("2026-09-26", "2026-09-29")).toBe(3);
    expect(faseDoCiclo("2026-09-26", "2026-09-30")).toBe(0);
    expect(faseDoCiclo("2026-09-27", "2026-09-26")).toBe(3); // início "no futuro" não quebra
    expect(faseDoCiclo("", "2026-09-26")).toBe(0);
    expect(faseDoCiclo("lixo", "2026-09-26")).toBe(0);
  });
});

describe("Beleza 3 — passo ácido mostra o próprio nome", () => {
  it("\"Retinol\" aparece como Retinol, não como a fase do ciclo", () => {
    const store = criarStoreReativo({ "skincare-pm-steps": [{ name: "Retinol", isAcid: true }], "skincare-cycle-start": HOJE });
    store.montar(<SkincareRoutine />);
    expect(screen.getByText("Retinol")).toBeInTheDocument();
    expect(screen.queryByText(/\(Ácido Glicólico ou Lático\)/)).not.toBeInTheDocument();
  });
});

describe("Beleza 4 — conflito só dentro do mesmo período (ou dia, quando a dica é alternar dias)", () => {
  it("Vitamina C de manhã + Retinol à noite: sem alerta (é exatamente a dica)", () => {
    const store = criarStoreReativo({
      "skincare-am-steps": [{ name: "Vitamina C" }],
      "skincare-pm-steps": [{ name: "Retinol", isAcid: true }],
      "skincare-cycle-start": HOJE,
    });
    store.montar(<SkincareRoutine />);
    expect(screen.queryByText(/CONFLITOS DETECTADOS/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum conflito de ativos/)).toBeInTheDocument();
  });

  it("regras: mesmo período conflita; 'alterne os dias' conflita no mesmo dia", () => {
    expect(conflitosDaRotina(["Vitamina C"], ["Retinol"])).toEqual([]);
    expect(conflitosDaRotina([], ["Vitamina C", "Retinol"]).map(r => r.ingredients)).toEqual([["retinol", "vitamina c"]]);
    expect(conflitosDaRotina(["BHA"], ["Retinol"])).toEqual([]); // "BHA de manhã e Retinol à noite"
    expect(conflitosDaRotina(["Ácido glicólico"], ["Retinol"]).map(r => r.ingredients)).toEqual([["retinol", "ácido glicólico"]]);
  });
});

describe("Beleza 5 — Espelho, Rotina e Diário falam entre si na hora", () => {
  it("Sensível no Espelho esconde o ácido da noite SEM trocar de aba; marcar passo anda o anel", () => {
    const store = criarStoreReativo({
      "skincare-am-steps": [{ name: "Gel de limpeza" }],
      "skincare-pm-steps": [{ name: "Retinol", isAcid: true }, { name: "Hidratante" }],
      "skincare-cycle-start": HOJE,
    });
    store.montar(<Beleza />);
    expect(screen.getByText("Retinol")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sensível/ }));
    expect(screen.queryByText("Retinol")).not.toBeInTheDocument();
    expect(screen.getByText(/Pele sensível detectada/)).toBeInTheDocument();

    expect(screen.getByText("Comece sua sequência hoje!")).toBeInTheDocument();
    fireEvent.click(within(linhaDe("Gel de limpeza")).getByRole("checkbox"));
    expect(screen.getByText(/1 dia de rotina/)).toBeInTheDocument();
    expect(store.dados["skincare-morning-checked"]).toEqual({ [HOJE]: [0] });
  });

  it("'Pele hoje' do Diário é a mesma resposta do Espelho (abre com ela, escolher lá marca aqui, o registro leva junto)", () => {
    const store = criarStoreReativo({ "skincare-daily-checkin": { [HOJE]: "oleosa" }, "skincare-cycle-start": HOJE });
    store.montar(<Beleza />);
    fireEvent.click(screen.getByRole("button", { name: /Diário/ }));
    fireEvent.click(screen.getByRole("button", { name: /Registrar Hoje/ }));
    const form = screen.getByText("Pele hoje").closest("div.rounded-xl") as HTMLElement;
    expect(within(form).getByRole("button", { name: /Oleosa/ }).className).toMatch(/bg-emerald-100/);

    fireEvent.click(within(form).getByRole("button", { name: /Sensível/ }));
    expect(screen.getByText(/Pele sensível detectada/)).toBeInTheDocument(); // o Espelho acima já sabe
    fireEvent.change(within(form).getByPlaceholderText(/Observações/), { target: { value: "Ardência" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar Registro" }));
    expect((store.dados["skincare-diary"] as { skinStatus: string }[])[0].skinStatus).toBe("sensivel");
    expect(store.dados["skincare-daily-checkin"]).toEqual({ [HOJE]: "sensivel" });
  });

  it("registro salvo sem mexer na pele (padrão 'Boa') marca o Espelho com a mesma resposta", () => {
    const store = criarStoreReativo({});
    store.montar(<SkinDiary />);
    fireEvent.click(screen.getByRole("button", { name: /Registrar Hoje/ }));
    fireEvent.change(screen.getByPlaceholderText(/Observações/), { target: { value: "Tudo certo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Registro" }));
    expect(store.dados["skincare-daily-checkin"]).toEqual({ [HOJE]: "boa" });
  });
});

describe("Beleza 6 — produto da bancada pode ser editado", () => {
  it("Editar abre o formulário preenchido e grava no MESMO produto (id, 'acabou' e foto ficam)", () => {
    const store = criarStoreReativo({
      "beauty-products": [{ id: "p1", name: "Serum Niacinamida", brand: "Principia", category: "Skincare", opened: false, openedDate: "", paoMonths: 12, expiry: "", notes: "", rating: 4, repurchase: false, price: 0, sizeMl: 0, photoUrl: "https://x/foto.webp", frequency: "Diário", finished: false }],
    });
    store.montar(<ProductShelf />);
    fireEvent.click(screen.getByText("Serum Niacinamida"));
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    const nome = screen.getAllByPlaceholderText("Nome do produto").at(-1)!;
    const marca = screen.getAllByPlaceholderText("Marca").at(-1)!;
    expect(nome).toHaveValue("Serum Niacinamida");
    expect(marca).toHaveValue("Principia");
    fireEvent.change(nome, { target: { value: "Sérum Niacinamida 10%" } });
    fireEvent.change(marca, { target: { value: "Principia Skin" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const produtos = store.dados["beauty-products"] as Record<string, unknown>[];
    expect(produtos).toHaveLength(1);
    expect(produtos[0]).toMatchObject({ id: "p1", name: "Sérum Niacinamida 10%", brand: "Principia Skin", rating: 4, photoUrl: "https://x/foto.webp", finished: false });
  });
});

describe("Beleza 7 — pequenos", () => {
  it("sem passo de protetor, nada de 'Aplique o Protetor Solar'; com protetor pendente e o resto feito, aparece", () => {
    const sem = criarStoreReativo({ "skincare-am-steps": [{ name: "Vitamina C" }, { name: "Hidratante" }], "skincare-morning-checked": { [HOJE]: [0] }, "skincare-cycle-start": HOJE });
    const t = sem.montar(<SkincareRoutine />);
    expect(screen.queryByText(/Aplique o Protetor Solar/)).not.toBeInTheDocument();
    t.unmount();

    const com = criarStoreReativo({ "skincare-am-steps": [{ name: "Vitamina C" }, { name: "Protetor solar", isSunscreen: true }], "skincare-morning-checked": { [HOJE]: [0] }, "skincare-cycle-start": HOJE });
    com.montar(<SkincareRoutine />);
    expect(screen.getByText(/Aplique o Protetor Solar/)).toBeInTheDocument();
  });

  it("Diário mostra 'Sensível' com acento; o valor gravado continua 'sensivel'", () => {
    const store = criarStoreReativo({ "skincare-diary": [{ id: "d1", date: HOJE, skinStatus: "sensivel", mood: "😊", notes: "Ardência", photoUrl: "" }] });
    store.montar(<SkinDiary />);
    expect(screen.getByText(/🍅 Sensível/)).toBeInTheDocument();
    expect(screen.queryByText(/🍅 sensivel/)).not.toBeInTheDocument();
    expect((store.dados["skincare-diary"] as { skinStatus: string }[])[0].skinStatus).toBe("sensivel");
  });

  it("chips do Espelho quebram linha (não escondem 'Boa'/'Sensível' numa rolagem lateral)", () => {
    criarStoreReativo({}).montar(<DailyMirror />);
    const linha = screen.getByRole("button", { name: /Sensível/ }).parentElement!;
    expect(linha.className).toMatch(/flex-wrap/);
    expect(linha.className).not.toMatch(/overflow-x-auto/);
  });
});

describe("Beleza 8 — foto na demonstração", () => {
  it("em /preview avisa que a foto funciona depois de criar a conta, sem abrir a galeria", () => {
    window.history.pushState({}, "", "/preview/beleza");
    const clique = vi.spyOn(HTMLInputElement.prototype, "click");
    criarStoreReativo({}).montar(<SkinDiary />);
    fireEvent.click(screen.getByRole("button", { name: /Registrar Hoje/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tirar foto/ }));
    expect(toastMock).toHaveBeenCalledWith(expect.stringMatching(/demonstração.*criar sua conta/));
    expect(clique).not.toHaveBeenCalled();
    clique.mockRestore();
  });

  it("no app a galeria abre como antes; sem conta, escolher a foto avisa em vez de sumir calado", () => {
    const clique = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    criarStoreReativo({}).montar(<SkinDiary />);
    fireEvent.click(screen.getByRole("button", { name: /Registrar Hoje/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tirar foto/ }));
    expect(clique).toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "pele.jpg", { type: "image/jpeg" })] } });
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/entre na sua conta/));
    clique.mockRestore();
  });
});

describe("Beleza 9 — apagar com Desfazer", () => {
  it("produto: some da bancada e o Desfazer devolve no mesmo lugar", () => {
    const p = (id: string, name: string) => ({ id, name, brand: "", category: "Skincare", opened: false, openedDate: "", paoMonths: 12, expiry: "", notes: "", rating: 0, repurchase: false, price: 0, sizeMl: 0, photoUrl: "", frequency: "Diário", finished: false });
    const store = criarStoreReativo({ "beauty-products": [p("a", "Tônico"), p("b", "Sérum"), p("c", "Protetor")] });
    store.montar(<ProductShelf />);
    fireEvent.click(screen.getByText("Sérum"));
    fireEvent.click(screen.getByRole("button", { name: "Apagar produto" }));
    expect(nomes(store.dados["beauty-products"])).toEqual(["Tônico", "Protetor"]);
    expect(toastMock).toHaveBeenLastCalledWith('"Sérum" saiu da bancada', expect.anything());
    desfazerUltimo();
    expect(nomes(store.dados["beauty-products"])).toEqual(["Tônico", "Sérum", "Protetor"]);
  });

  it("registro do diário: some e volta com o Desfazer", () => {
    const d = (id: string, date: string, notes: string) => ({ id, date, skinStatus: "boa", mood: "😊", notes, photoUrl: "" });
    const store = criarStoreReativo({ "skincare-diary": [d("1", HOJE, "Hoje"), d("2", diaMais(-1), "Ontem")] });
    store.montar(<SkinDiary />);
    fireEvent.click(within(screen.getByText("Ontem").closest("div.grid") as HTMLElement).getByRole("button", { name: "Apagar registro" }));
    expect((store.dados["skincare-diary"] as { id: string }[]).map(x => x.id)).toEqual(["1"]);
    desfazerUltimo();
    expect((store.dados["skincare-diary"] as { id: string }[]).map(x => x.id)).toEqual(["1", "2"]);
  });
});

/* ═════════════════════════════ BIBLIOTECA ═════════════════════════════ */

type LivroSalvo = Record<string, unknown> & { id: string; title: string; currentPage?: number };
const livro = (extra: Record<string, unknown> & { id: string; title: string }) => ({
  author: "Autor", cover: "", status: "quero-ler", rating: 0, genre: "Ficção", pages: 0, currentPage: 0,
  notes: "", startDate: "", endDate: "", goalDate: "", quotes: [], lentTo: "", lentDate: "", lentReturnDate: "",
  ...extra,
});
const montarBiblioteca = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}><Biblioteca /></UserDataContext.Provider></MemoryRouter>);
const livrosDe = (store: ReturnType<typeof criarStore>) => (store.dados["lib-books"] ?? []) as LivroSalvo[];
const aba = (nome: RegExp) => fireEvent.click(screen.getByRole("button", { name: nome }));

describe("Biblioteca 10 — livro sem total aceita a página atual", () => {
  it("digitar 45 num livro sem total grava 45 (antes voltava vazio)", () => {
    const store = criarStore({ "lib-books": [livro({ id: "a", title: "Sem total", status: "lendo" })] });
    montarBiblioteca(store);
    const campo = screen.getByRole("spinbutton", { name: "Página atual de Sem total" });
    fireEvent.change(campo, { target: { value: "45" } });
    expect(livrosDe(store)[0].currentPage).toBe(45);
    expect(campo).toHaveValue(45);
  });

  it("paginaValida: sem total não tem teto; com total, não passa dele", () => {
    expect(paginaValida(45, 0)).toBe(45);
    expect(paginaValida(400, 320)).toBe(320);
    expect(paginaValida(-5, 100)).toBe(0);
    expect(paginaValida(12.7, 0)).toBe(12);
    expect(paginaValida(NaN, 100)).toBe(0);
  });
});

describe("Biblioteca 11 — meta anual editável", () => {
  it("apagar não vira '1'; digitar 5 fica 5 e só grava ao sair; vazio ao sair mantém a meta", () => {
    const store = criarStore({ "lib-year-goal": 12 });
    montarBiblioteca(store);
    aba(/Desafio/);
    const meta = screen.getByRole("spinbutton", { name: "Meta anual de livros" });
    fireEvent.change(meta, { target: { value: "" } });
    expect(meta).toHaveValue(null); // vazio de verdade
    expect(store.dados["lib-year-goal"]).toBe(12);
    fireEvent.change(meta, { target: { value: "5" } });
    expect(meta).toHaveValue(5);
    fireEvent.blur(meta);
    expect(store.dados["lib-year-goal"]).toBe(5);
    expect(screen.getByText("0 de 5 livros")).toBeInTheDocument();

    fireEvent.change(meta, { target: { value: "" } });
    fireEvent.blur(meta);
    expect(meta).toHaveValue(5);
    expect(store.dados["lib-year-goal"]).toBe(5);

    fireEvent.change(meta, { target: { value: "20" } });
    fireEvent.blur(meta);
    expect(store.dados["lib-year-goal"]).toBe(20);
  });

  it("metaDoRascunho: vazio/lixo mantém; entre 1 e 999", () => {
    expect(metaDoRascunho("", 12)).toBe(12);
    expect(metaDoRascunho("abc", 7)).toBe(7);
    expect(metaDoRascunho("5", 12)).toBe(5);
    expect(metaDoRascunho(" 20 ", 5)).toBe(20);
    expect(metaDoRascunho("0", 12)).toBe(1);
    expect(metaDoRascunho("5000", 12)).toBe(999);
  });
});

describe("Biblioteca 12 — devolução pra hoje não é atraso", () => {
  it("hoje: '⏰ hoje'; ontem: ATRASADO; amanhã: '⏰ 1d'", () => {
    const store = criarStore({
      "lib-books": [
        livro({ id: "h", title: "Vence hoje", lentTo: "Ana", lentReturnDate: HOJE }),
        livro({ id: "o", title: "Venceu ontem", lentTo: "Bia", lentReturnDate: diaMais(-1) }),
        livro({ id: "a", title: "Vence amanhã", lentTo: "Caio", lentReturnDate: diaMais(1) }),
      ],
    });
    montarBiblioteca(store);
    aba(/Emprestados/);
    const cartao = (t: string) => screen.getByText(t).closest("div.rounded-lg") as HTMLElement;
    expect(cartao("Vence hoje")).not.toHaveTextContent("ATRASADO");
    expect(cartao("Vence hoje")).toHaveTextContent("⏰ hoje");
    expect(cartao("Venceu ontem")).toHaveTextContent("ATRASADO");
    expect(cartao("Vence amanhã")).toHaveTextContent("⏰ 1d");
  });

  it("situacaoDevolucao compara dias locais", () => {
    expect(situacaoDevolucao("2026-09-26", "2026-09-26")).toEqual({ atrasado: false, diasRestantes: 0 });
    expect(situacaoDevolucao("2026-09-25", "2026-09-26")).toEqual({ atrasado: true, diasRestantes: -1 });
    expect(situacaoDevolucao("2026-09-27", "2026-09-26")).toEqual({ atrasado: false, diasRestantes: 1 });
    expect(situacaoDevolucao(undefined, "2026-09-26")).toEqual({ atrasado: false, diasRestantes: null });
    expect(situacaoDevolucao("lixo", "2026-09-26")).toEqual({ atrasado: false, diasRestantes: null });
  });
});

describe("Biblioteca 13 — página não passa do total; desafio só do ano", () => {
  it("salvar 400 num livro de 320 páginas grava 320", () => {
    const store = criarStore({ "lib-books": [livro({ id: "a", title: "Estourado", status: "lendo", pages: 320, currentPage: 100 })] });
    montarBiblioteca(store);
    aba(/Estante/);
    fireEvent.click(screen.getByRole("button", { name: "Editar Estourado" }));
    fireEvent.change(screen.getByPlaceholderText("Página atual"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Livro" }));
    expect(livrosDe(store)[0].currentPage).toBe(320);
  });

  it("a estante do Desafio do ano não mostra livro lido no ano passado", () => {
    const ano = new Date().getFullYear();
    const store = criarStore({
      "lib-books": [
        livro({ id: "v", title: "Lido ano passado", status: "lido", endDate: `${ano - 1}-11-10` }),
        livro({ id: "n", title: "Lido este ano", status: "lido", endDate: `${ano}-02-01` }),
      ],
    });
    montarBiblioteca(store);
    aba(/Desafio/);
    expect(screen.getByText("1 de 12 livros")).toBeInTheDocument();
    expect(document.querySelector('[title="Lido este ano"]')).not.toBeNull();
    expect(document.querySelector('[title="Lido ano passado"]')).toBeNull();
  });
});

describe("Biblioteca 14 — apagar livro com Desfazer e alvos separados", () => {
  it("lixeira apaga, avisa e o Desfazer devolve no mesmo lugar; lápis e lixeira têm 36 px", () => {
    const store = criarStore({ "lib-books": [livro({ id: "a", title: "A" }), livro({ id: "b", title: "B" }), livro({ id: "c", title: "C" })] });
    montarBiblioteca(store);
    aba(/Estante/);
    expect(screen.getByRole("button", { name: "Editar B" }).className).toMatch(/h-9 w-9/);
    expect(screen.getByRole("button", { name: "Remover B" }).className).toMatch(/h-9 w-9/);

    fireEvent.click(screen.getByRole("button", { name: "Remover B" }));
    expect(livrosDe(store).map(l => l.id)).toEqual(["a", "c"]);
    expect(toastMock).toHaveBeenLastCalledWith('"B" saiu da estante', expect.anything());
    desfazerUltimo();
    expect(livrosDe(store).map(l => l.id)).toEqual(["a", "b", "c"]);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("citação apagada também volta com o Desfazer", () => {
    const q = (id: string, text: string) => ({ id, text, page: 0, tags: [] });
    const store = criarStore({ "lib-books": [livro({ id: "a", title: "Lendo", status: "lendo", quotes: [q("1", "Primeira"), q("2", "Segunda")] })] });
    montarBiblioteca(store);
    const segunda = screen.getByText(/Segunda/).closest("div.rounded-lg") as HTMLElement;
    fireEvent.click(within(segunda).getByRole("button"));
    expect((livrosDe(store)[0].quotes as { id: string }[]).map(x => x.id)).toEqual(["1"]);
    desfazerUltimo();
    expect((livrosDe(store)[0].quotes as { id: string }[]).map(x => x.id)).toEqual(["1", "2"]);
  });
});

describe("Biblioteca 15 — 'Lendo agora' com dois livros", () => {
  it("mostra os dois; a página do segundo muda ali mesmo; um toque traz ele pro foco", () => {
    const store = criarStore({
      "lib-books": [
        livro({ id: "a", title: "Hábitos Atômicos", status: "lendo", pages: 320, currentPage: 208 }),
        livro({ id: "b", title: "O Poder do Hábito", status: "lendo", pages: 400, currentPage: 0 }),
      ],
    });
    montarBiblioteca(store);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Hábitos Atômicos");
    expect(screen.getByText("Também lendo")).toBeInTheDocument();
    expect(screen.getByText("O Poder do Hábito")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Página atual de O Poder do Hábito" }), { target: { value: "57" } });
    expect(livrosDe(store).find(l => l.id === "b")?.currentPage).toBe(57);

    fireEvent.click(screen.getByRole("button", { name: "Ver O Poder do Hábito" }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("O Poder do Hábito");
    expect(screen.getByRole("button", { name: "Ver Hábitos Atômicos" })).toBeInTheDocument();
  });

  it("um livro só: tela como antes, sem 'Também lendo'", () => {
    montarBiblioteca(criarStore({ "lib-books": [livro({ id: "a", title: "Único", status: "lendo", pages: 100 })] }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Único");
    expect(screen.queryByText("Também lendo")).not.toBeInTheDocument();
  });
});
