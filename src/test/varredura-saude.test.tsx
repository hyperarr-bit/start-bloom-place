/**
 * Varredura da demo em Saúde (26/09) — os achados de /preview/saude.
 * Cada teste monta o componente real com o store in-memory (o mesmo formato
 * da demo) e confere o DADO gravado, não só a tela.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
  },
}));

import { BodyEvolution } from "@/components/saude/BodyEvolution";
import { MedicalLog } from "@/components/saude/MedicalLog";
import { PharmacyChecklist, CHAVE_SEM_BAIXA } from "@/components/saude/PharmacyChecklist";
import Saude from "@/pages/Saude";

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
type Store = ReturnType<typeof criarStore>;
const montar = (ui: React.ReactElement, store: Store) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

/** O "Desfazer" do avisarApagado: o onClick da ação do último toast. */
const desfazerUltimo = () => {
  const ultimo = toastMock.mock.calls[toastMock.mock.calls.length - 1];
  expect(ultimo[1]?.action?.label).toBe("Desfazer");
  act(() => ultimo[1].action.onClick());
};

const HOJE = localDayKey();
const ddmm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const vazia = { peso: "", bf: "", cintura: "", bracoD: "", bracoE: "", pernaD: "", pernaE: "", peito: "" };

beforeEach(() => {
  toastMock.mockClear();
  toastMock.error.mockClear();
  window.history.pushState({}, "", "/saude");
});
afterEach(() => { window.history.pushState({}, "", "/"); });

/* ── 1 + 4: Evolução — medidas ─────────────────────────────────────────── */
describe("Evolução: medidas", () => {
  it("duas medidas no MESMO dia: a lixeira da coluna apaga só aquela, e o Desfazer devolve no lugar", () => {
    const a = { ...vazia, date: HOJE, peso: "80" };
    const b = { ...vazia, date: HOJE, peso: "81" };
    const store = criarStore({ "core-saude-measures": [a, b] });
    montar(<BodyEvolution />, store);

    const lixeiras = screen.getAllByRole("button", { name: `Apagar medida de ${ddmm(HOJE)}` });
    expect(lixeiras).toHaveLength(2); // uma por coluna, no cabeçalho
    // a registrada por último é a 1ª coluna
    fireEvent.click(lixeiras[0]);
    expect(store.dados["core-saude-measures"]).toEqual([a]);
    expect(toastMock).toHaveBeenLastCalledWith(`Medida de ${ddmm(HOJE)} apagada`, expect.anything());

    desfazerUltimo();
    expect(store.dados["core-saude-measures"]).toEqual([a, b]);
  });

  it("salva com qualquer medida (só BF%), avisa quando nada foi preenchido e recusa lixo", () => {
    const store = criarStore();
    montar(<BodyEvolution />, store);
    fireEvent.click(screen.getByRole("button", { name: /Registrar Medidas/ }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar Medidas" }));
    expect(toastMock.error).toHaveBeenLastCalledWith("Preencha pelo menos uma medida");
    expect(store.dados["core-saude-measures"]).toBeUndefined();

    fireEvent.change(screen.getByPlaceholderText("PESO"), { target: { value: "abc" } });
    fireEvent.change(screen.getByPlaceholderText("BF%"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Medidas" }));
    expect(toastMock.error).toHaveBeenLastCalledWith("Confira PESO: só números (ex.: 80,5)");
    expect(store.dados["core-saude-measures"]).toBeUndefined();

    fireEvent.change(screen.getByPlaceholderText("PESO"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("BRAÇO D"), { target: { value: " 35,5 " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Medidas" }));
    expect(store.dados["core-saude-measures"]).toEqual([{ ...vazia, date: HOJE, bf: "18", bracoD: "35,5" }]);
    // exibição com vírgula, mesmo pra valor gravado com ponto
    expect(screen.getByText("35,5 cm")).toBeInTheDocument();
    expect(screen.getByText("18%")).toBeInTheDocument();
  });

  it("valor com ponto aparece com vírgula; o peso da ação rápida da Home (weight) aparece na tabela", () => {
    const store = criarStore({ "core-saude-measures": [{ ...vazia, date: "2026-09-01", cintura: "90.5" }, { date: "2026-09-02", weight: 70, id: "q1" }] });
    montar(<BodyEvolution />, store);
    expect(screen.getByText("90,5 cm")).toBeInTheDocument();
    expect(screen.getByText("70kg")).toBeInTheDocument();
  });
});

/* ── 8: foto na demo ───────────────────────────────────────────────────── */
describe("Foto na demo", () => {
  it("em /preview o 'Adicionar' explica em vez de abrir a galeria; fora da demo abre", () => {
    const clique = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    window.history.pushState({}, "", "/preview/saude");
    const { unmount } = montar(<BodyEvolution />, criarStore());
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(toastMock).toHaveBeenLastCalledWith("Fotos funcionam depois de criar a conta", expect.anything());
    expect(clique).not.toHaveBeenCalled();
    unmount();

    toastMock.mockClear();
    window.history.pushState({}, "", "/saude");
    montar(<BodyEvolution />, criarStore());
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(clique).toHaveBeenCalledTimes(1);
    expect(toastMock).not.toHaveBeenCalled();
    clique.mockRestore();
  });

  it("anexo de exame na demo também só explica", () => {
    const clique = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    window.history.pushState({}, "", "/preview/saude");
    montar(<MedicalLog />, criarStore({ "core-saude-exams-v2": [{ id: "e1", name: "Hemograma", date: "2026-09-01", time: "", location: "", notes: "", done: true }] }));
    fireEvent.click(screen.getByRole("button", { name: "Fotos e observações de Hemograma" }));
    fireEvent.click(screen.getByRole("button", { name: /^Foto$/ }));
    expect(toastMock).toHaveBeenLastCalledWith("Fotos funcionam depois de criar a conta", expect.anything());
    expect(clique).not.toHaveBeenCalled();
    clique.mockRestore();
  });
});

/* ── 2 + 5: Log médico — biomarcadores ─────────────────────────────────── */
describe("Log médico: biomarcadores", () => {
  const biomarcadores = (s: Store) => s.dados["core-saude-biomarkers"] as { name: string; refMin: number; refMax: number; entries: { date: string; value: number }[] }[] | undefined;

  const cadastrar = (nome: string, min: string, max: string) => {
    fireEvent.click(screen.getByRole("button", { name: /Novo Biomarcador/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Testosterona"), { target: { value: nome } });
    fireEvent.change(screen.getByPlaceholderText("Unidade"), { target: { value: "mUI/L" } });
    fireEvent.change(screen.getByPlaceholderText("Mín"), { target: { value: min } });
    fireEvent.change(screen.getByPlaceholderText("Máx"), { target: { value: max } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
  };

  it("faixa com vírgula (0,4 – 4,0) é gravada certa e TSH 8,5 fica VERMELHO, exibido com vírgula", () => {
    const store = criarStore();
    montar(<MedicalLog />, store);
    cadastrar("TSH", "0,4", "4,0");
    expect(biomarcadores(store)?.[0]).toMatchObject({ name: "TSH", refMin: 0.4, refMax: 4 });

    fireEvent.change(screen.getByPlaceholderText("Valor (mUI/L)"), { target: { value: "8.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar medição de TSH" }));
    expect(biomarcadores(store)?.[0].entries.map(e => e.value)).toEqual([8.5]);

    expect(screen.getByText("Ref: 0,4 – 4 mUI/L")).toBeInTheDocument();
    const ultimo = screen.getAllByText("8,5 mUI/L")[0];
    expect(ultimo.className).toContain("text-destructive");
    expect(document.body.textContent).not.toContain("8.5");
  });

  it("faixa com lixo ou mínimo acima do máximo avisa e não grava", () => {
    const store = criarStore();
    montar(<MedicalLog />, store);
    cadastrar("Ferritina", "abc", "300");
    expect(toastMock.error).toHaveBeenLastCalledWith("Faixa de referência: use só números (ex.: 0,4 e 4,0)");
    expect(biomarcadores(store)).toBeUndefined();

    fireEvent.change(screen.getByPlaceholderText("Mín"), { target: { value: "300" } });
    fireEvent.change(screen.getByPlaceholderText("Máx"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(toastMock.error).toHaveBeenLastCalledWith("O mínimo da faixa está maior que o máximo");
    expect(biomarcadores(store)).toBeUndefined();
  });

  it("apagar o biomarcador (com o histórico junto) pede o segundo toque", () => {
    const store = criarStore({ "core-saude-biomarkers": [{ id: "b1", name: "Vitamina D", unit: "ng/mL", refMin: 30, refMax: 100, entries: [{ date: "2026-09-01", value: 25 }] }] });
    montar(<MedicalLog />, store);
    fireEvent.click(screen.getByRole("button", { name: "Apagar biomarcador Vitamina D" }));
    expect(store.dados["core-saude-biomarkers"]).toHaveLength(1); // 1º toque não apaga
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão do biomarcador Vitamina D" }));
    expect(store.dados["core-saude-biomarkers"]).toEqual([]);
  });

  it("apagar UMA medição tem Desfazer e ela volta pro mesmo lugar", () => {
    const entries = [{ date: "2026-08-01", value: 20 }, { date: "2026-09-01", value: 25.5 }];
    const store = criarStore({ "core-saude-biomarkers": [{ id: "b1", name: "Vitamina D", unit: "ng/mL", refMin: 30, refMax: 100, entries }] });
    montar(<MedicalLog />, store);
    fireEvent.click(screen.getByRole("button", { name: /2 medições/ }));
    expect(screen.getAllByText("25,5 ng/mL").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Apagar medição de 1 de ago/ }));
    expect(biomarcadores(store)?.[0].entries).toEqual([entries[1]]);
    desfazerUltimo();
    expect(biomarcadores(store)?.[0].entries).toEqual(entries);
  });
});

/* ── 3 + 5: Log médico — consultas e exames ────────────────────────────── */
describe("Log médico: consultas e exames", () => {
  const consultas = [
    { id: "c1", doctor: "Dra. Ana", specialty: "Dermatologista", date: "2026-10-05", time: "14:30", address: "", questions: "" },
    { id: "c2", doctor: "Dr. Bruno", specialty: "Dentista", date: "2026-09-01", time: "", address: "", questions: "" },
  ];

  it("data curta numa linha só (05/10/26), sem o '5 de out. de 2026' que quebrava em 4 linhas", () => {
    montar(<MedicalLog />, criarStore({ "core-saude-appointments": consultas }));
    const celula = screen.getByText("05/10/26");
    expect(celula.className).toContain("whitespace-nowrap");
    expect(document.body.textContent).not.toContain("de out. de 2026");
    // a coluna de ações gruda na direita com o fundo do card
    const acoes = screen.getByRole("button", { name: "Apagar consulta com Dra. Ana" }).closest("td")!;
    expect(acoes.className).toMatch(/sticky/);
    expect(acoes.className).toMatch(/right-0/);
    expect(acoes.className).toMatch(/bg-card/);
  });

  it("apagar consulta tem Desfazer e volta na mesma posição", () => {
    const store = criarStore({ "core-saude-appointments": consultas });
    montar(<MedicalLog />, store);
    fireEvent.click(screen.getByRole("button", { name: "Apagar consulta com Dra. Ana" }));
    expect(store.dados["core-saude-appointments"]).toEqual([consultas[1]]);
    desfazerUltimo();
    expect(store.dados["core-saude-appointments"]).toEqual(consultas);
  });

  it("apagar exame tem Desfazer (com as fotos junto)", () => {
    const exame = { id: "e1", name: "Hemograma", date: "2026-09-01", time: "", location: "", notes: "", done: false, fotos: ["u-1/saude/a.webp"] };
    const store = criarStore({ "core-saude-exams-v2": [exame] });
    montar(<MedicalLog />, store);
    fireEvent.click(screen.getByRole("button", { name: "Apagar exame Hemograma" }));
    expect(store.dados["core-saude-exams-v2"]).toEqual([]);
    desfazerUltimo();
    expect(store.dados["core-saude-exams-v2"]).toEqual([exame]);
  });
});

/* ── 5 + 6: Remédios ───────────────────────────────────────────────────── */
describe("Remédios: estoque e apagar", () => {
  type Remedio = { id: string; name: string; time: string; stock: number; dosesPerDay: number };
  const CHAVE = "core-saude-supplements";
  const estoque = (s: Store) => ((s.dados[CHAVE] ?? []) as Remedio[]).map(r => r.stock);

  it("estoque 0: marcar e desmarcar NÃO cria comprimido (continua 0)", () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Ômega 3", time: "12:30", stock: 0, dosesPerDay: 1 }] });
    montar(<PharmacyChecklist />, store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar Ômega 3 como tomado" }));
    expect(store.dados["core-saude-supplement-log"]).toEqual({ [HOJE]: ["r1"] });
    expect(estoque(store)).toEqual([0]); // não existe estoque negativo
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Ômega 3" }));
    expect(estoque(store)).toEqual([0]); // antes do conserto virava 1
    expect(store.dados[CHAVE_SEM_BAIXA]).toEqual({ dia: HOJE, ids: [] });
    expect(screen.getByRole("button", { name: "Alterar estoque de Ômega 3 (0)" })).toBeInTheDocument();
  });

  it("estoque 0 → marca → pessoa corrige pra 30 → desmarca: fica 30 (desmarcar só devolve o que o marcar tirou)", () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Ômega 3", time: "12:30", stock: 0, dosesPerDay: 1 }] });
    montar(<PharmacyChecklist />, store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar Ômega 3 como tomado" }));
    fireEvent.click(screen.getByRole("button", { name: "Alterar estoque de Ômega 3 (0)" }));
    fireEvent.change(screen.getByLabelText("Estoque de Ômega 3"), { target: { value: "30" } });
    fireEvent.keyDown(screen.getByLabelText("Estoque de Ômega 3"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Ômega 3" }));
    expect(estoque(store)).toEqual([30]);
  });

  it("estoque 1 → marca (0) → desmarca (1): o caso normal continua igual", () => {
    const store = criarStore({ [CHAVE]: [{ id: "r1", name: "Creatina", time: "17:00", stock: 1, dosesPerDay: 1 }] });
    montar(<PharmacyChecklist />, store);
    fireEvent.click(screen.getByRole("button", { name: "Marcar Creatina como tomado" }));
    expect(estoque(store)).toEqual([0]);
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar Creatina" }));
    expect(estoque(store)).toEqual([1]);
    expect(store.dados[CHAVE_SEM_BAIXA]).toBeUndefined(); // a chave só nasce no caso do estoque 0
  });

  it("apagar remédio avisa com Desfazer e ele volta no mesmo lugar, com o estoque", () => {
    const lista = [
      { id: "r1", name: "Vitamina D3", time: "08:00", stock: 42, dosesPerDay: 1 },
      { id: "r2", name: "Ômega 3", time: "12:30", stock: 18, dosesPerDay: 1 },
      { id: "r3", name: "Creatina", time: "17:00", stock: 60, dosesPerDay: 1 },
    ];
    const store = criarStore({ [CHAVE]: lista });
    montar(<PharmacyChecklist />, store);
    fireEvent.click(screen.getByRole("button", { name: "Apagar Ômega 3" }));
    expect(store.dados[CHAVE]).toEqual([lista[0], lista[2]]);
    expect(toastMock).toHaveBeenLastCalledWith("Ômega 3 apagado", expect.anything());
    desfazerUltimo();
    expect(store.dados[CHAVE]).toEqual(lista);
    expect(screen.getByRole("button", { name: "Alterar estoque de Ômega 3 (18)" })).toBeInTheDocument();
  });
});

/* ── 7: Sono e IMC ─────────────────────────────────────────────────────── */
describe("Hoje: sono e IMC", () => {
  it("'Faltam 0,5h' com vírgula; apagar o campo apaga o registro de hoje (e a mensagem some)", () => {
    const store = criarStore({ "core-saude-sleep": { "2026-09-20": 7, [HOJE]: 7.5 }, "core-saude-sleep-goal": 8 });
    montar(<Saude />, store);
    expect(screen.getByText("Faltam 0,5h para a meta")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Horas"), { target: { value: "" } });
    expect(store.dados["core-saude-sleep"]).toEqual({ "2026-09-20": 7 });
    expect(screen.queryByText(/Faltam .*para a meta/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Horas"), { target: { value: "6" } });
    expect(store.dados["core-saude-sleep"]).toEqual({ "2026-09-20": 7, [HOJE]: 6 });
    expect(screen.getByText("Faltam 2h para a meta")).toBeInTheDocument();
  });

  it("IMC com vírgula (24,1) sem mudar o que foi digitado", () => {
    const store = criarStore({ "saude-bmi-height": "178", "saude-bmi-weight": "76.4" });
    montar(<Saude />, store);
    expect(screen.getByText("24,1")).toBeInTheDocument();
    expect(screen.queryByText("24.1")).toBeNull();
    expect(store.dados["saude-bmi-weight"]).toBe("76.4");
  });
});
