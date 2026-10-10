/**
 * Varredura da demo 26/09 — CASA + DIETA nas telas. Cada bloco reproduz o que
 * foi visto na /preview e confere o conserto (abrir → usar → reabrir quando o
 * buraco pode estar na remontagem).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { toast } from "sonner";
import { getSeedsForModule } from "@/lib/preview-seeds";
import GroceryList from "@/components/casa/GroceryList";
import SmartPantry from "@/components/casa/SmartPantry";
import CleaningRoutine from "@/components/casa/CleaningRoutine";
import MaintenanceLog from "@/components/casa/MaintenanceLog";
import SafetyChecks from "@/components/casa/SafetyChecks";
import HomeUtilities from "@/components/casa/HomeUtilities";
import MealPlanner from "@/components/casa/MealPlanner";
import RoomManager from "@/components/casa/RoomManager";
import Dieta from "@/pages/Dieta";

vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("sonner", async (orig) => {
  const real = await orig<typeof import("sonner")>();
  return { ...real, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => vi.clearAllMocks());

const criarStore = (inicial: Record<string, unknown> = {}, loaded = true) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; escritas.push(key); },
    loaded,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};
const montar = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);

type Cat = { id: string; name: string; color: string; items: { id: string; text: string; done: boolean; origem?: string; devolvidoId?: string }[] };
type Pantry = { id: string; name: string; category: string; status: string }[];
const desfazerDaUltimaChamada = () => {
  const calls = vi.mocked(avisarApagado).mock.calls;
  return calls[calls.length - 1];
};

/* ============================ CASA ============================ */

describe("Mercado (GroceryList)", () => {
  it("quem ficou só com a categoria 'Dieta' ganha as 9 do padrão de volta (e o item fica)", () => {
    const store = criarStore({ "casa-grocery-categories": [{ id: "dieta-auto", name: "Dieta", emoji: "🥗", color: "bg-green-500", items: [{ id: "a", text: "Aveia", done: false }] }] });
    montar(<GroceryList />, store);
    const salvas = store.dados["casa-grocery-categories"] as Cat[];
    expect(salvas).toHaveLength(10);
    expect(salvas[0].name).toBe("HortiFrutti");
    expect(salvas[9]).toMatchObject({ name: "Dieta", items: [{ text: "Aveia" }] });
    expect(screen.getByText("HortiFrutti")).toBeInTheDocument();
    expect(screen.getByText("Aveia")).toBeInTheDocument();
  });

  it("contraste: texto escuro do tema no verde/amarelo/ciano/laranja, branco no resto", () => {
    montar(<GroceryList />, criarStore());
    for (const nome of ["HortiFrutti", "Congelados", "Limpeza", "Padaria"]) {
      expect(screen.getByText(nome).className).toMatch(/text-foreground/);
      expect(screen.getByText(nome).className).not.toMatch(/text-white/);
    }
    for (const nome of ["Laticínios e Frios", "Bebidas", "Açougue e Peixaria"]) expect(screen.getByText(nome).className).toMatch(/text-white/);
  });

  it("item que veio da Despensa volta pra ela ao comprar; marcar/desmarcar/marcar não duplica", () => {
    const store = criarStore({
      "casa-grocery-categories": [{ id: "3", name: "Laticínios e Frios", emoji: "🧀", color: "bg-blue-600", items: [{ id: "desp-1", text: "Leite", done: false, origem: "geladeira" }] }],
    });
    montar(<GroceryList />, store);
    expect(screen.getByText("Despensa")).toBeInTheDocument();
    const caixa = screen.getAllByRole("checkbox")[0];
    fireEvent.click(caixa);
    fireEvent.click(caixa);
    fireEvent.click(caixa);
    const despensa = store.dados["casa-pantry"] as Pantry;
    expect(despensa).toHaveLength(1);
    expect(despensa[0]).toMatchObject({ name: "Leite", category: "geladeira", status: "cheio" });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Leite voltou pra Geladeira");
  });

  it("apagar categoria com itens oferece desfazer e devolve no mesmo lugar", () => {
    const store = criarStore();
    montar(<GroceryList />, store);
    fireEvent.click(screen.getByRole("button", { name: "Remover categoria Mercearia" }));
    expect((store.dados["casa-grocery-categories"] as Cat[]).map((c) => c.name)).not.toContain("Mercearia");
    const [texto, desfazer] = desfazerDaUltimaChamada();
    expect(texto).toBe('Categoria "Mercearia" apagada');
    act(() => desfazer());
    expect((store.dados["casa-grocery-categories"] as Cat[])[3].name).toBe("Mercearia");
  });
});

describe("Despensa (SmartPantry): 'Acabou' vai pro Mercado", () => {
  // substitui o "acabou na geladeira → lista de compras → comprado → volta pra
  // GELADEIRA" de 07/09 (avaliacoes-set2026-bugs): a lista agora é a do Mercado
  it("fluxo completo: acabou na geladeira → Mercado → comprado → volta pra GELADEIRA", () => {
    const store = criarStore({ "casa-pantry": [{ id: "1", name: "Leite", category: "geladeira", status: "cheio" }] });
    const tela = montar(<SmartPantry />, store);
    fireEvent.change(screen.getByDisplayValue("Cheio"), { target: { value: "acabou" } });
    expect(store.dados["casa-pantry"]).toHaveLength(0);
    tela.unmount();

    // sai, abre o Mercado e marca como comprado
    montar(<GroceryList />, store);
    const linha = screen.getByText("Leite").parentElement!;
    fireEvent.click(within(linha).getByRole("checkbox"));
    expect(store.dados["casa-pantry"] as Pantry).toEqual([expect.objectContaining({ name: "Leite", category: "geladeira", status: "cheio" })]);
  });

  it("Leite da geladeira acaba → aparece no Mercado em Laticínios e Frios (e não na lista da Despensa)", () => {
    const store = criarStore({ "casa-pantry": [{ id: "1", name: "Leite", category: "geladeira", status: "cheio" }] });
    montar(<SmartPantry onAbrirMercado={() => {}} />, store);
    fireEvent.change(screen.getByDisplayValue("Cheio"), { target: { value: "acabou" } });
    expect(store.dados["casa-pantry"]).toEqual([]);
    expect(store.dados["casa-shopping-list"]).toBeUndefined();
    const mercado = store.dados["casa-grocery-categories"] as Cat[];
    expect(mercado).toHaveLength(9);
    expect(mercado.find((c) => c.name === "Laticínios e Frios")!.items).toEqual([expect.objectContaining({ text: "Leite", origem: "geladeira", done: false })]);
    expect(vi.mocked(toast.success).mock.calls[0][0]).toBe("Leite foi pra lista do Mercado (Laticínios e Frios)");
  });

  it("acabar de novo com o Leite ainda na lista não repete no Mercado", () => {
    const store = criarStore({ "casa-pantry": [{ id: "1", name: "Leite", category: "geladeira", status: "cheio" }] });
    const tela = montar(<SmartPantry />, store);
    fireEvent.change(screen.getByDisplayValue("Cheio"), { target: { value: "acabou" } });
    tela.unmount();
    store.dados["casa-pantry"] = [{ id: "2", name: "leite", category: "geladeira", status: "cheio" }];
    montar(<SmartPantry />, store);
    fireEvent.change(screen.getByDisplayValue("Cheio"), { target: { value: "acabou" } });
    const todos = (store.dados["casa-grocery-categories"] as Cat[]).flatMap((c) => c.items);
    expect(todos.filter((i) => i.text.toLowerCase() === "leite")).toHaveLength(1);
    expect(vi.mocked(toast).mock.calls.at(-1)?.[0]).toBe("leite já está na lista do Mercado");
  });

  it("lista antiga da Despensa: marcar/desmarcar/marcar deixa UM Leite na geladeira", () => {
    const store = criarStore({ "casa-pantry": [], "casa-shopping-list": [{ id: "9", name: "Leite", checked: false, fromPantry: true, origemCategory: "geladeira" }] });
    montar(<SmartPantry />, store);
    fireEvent.click(screen.getByRole("button", { name: /Compras/i }));
    fireEvent.click(screen.getByRole("button", { name: /Comprei Leite/i }));
    fireEvent.click(screen.getByRole("button", { name: /Desmarcar Leite/i }));
    expect(store.dados["casa-pantry"]).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Comprei Leite/i }));
    expect(store.dados["casa-pantry"] as Pantry).toEqual([expect.objectContaining({ name: "Leite", category: "geladeira" })]);
  });
});

describe("Rotina de limpeza: a diária zera na virada do dia", () => {
  afterEach(() => vi.useRealTimers());

  it("marcada 23:57, desmarcada sozinha 00:07 — com a tela aberta — e gravada zerada (o widget lê `done`)", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 8, 26, 23, 57));
    const store = criarStore({ "casa-cleaning-routine": [{ id: "1", name: "LIMPEZA DIÁRIA", color: "bg-yellow-200 dark:bg-yellow-800/50", items: [{ id: "i", text: "Lavar a louça", done: false }] }] });
    montar(<CleaningRoutine />, store);
    const caixa = () => screen.getAllByRole("checkbox").find((c) => !c.hasAttribute("disabled"))!;
    fireEvent.click(caixa());
    expect(caixa()).toHaveAttribute("data-state", "checked");
    expect((store.dados["casa-cleaning-routine"] as { items: object[] }[])[0].items[0]).toEqual({ id: "i", text: "Lavar a louça", done: true, doneOn: "2026-09-26" });

    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(caixa()).toHaveAttribute("data-state", "unchecked");
    expect((store.dados["casa-cleaning-routine"] as { items: object[] }[])[0].items[0]).toEqual({ id: "i", text: "Lavar a louça", done: false });
  });

  it("antes da carga do servidor não grava nada sozinha (senão o cache velho ganharia do servidor)", () => {
    const secoes = [{ id: "1", name: "LIMPEZA DIÁRIA", color: "", items: [{ id: "i", text: "Louça", done: true, doneOn: "2020-01-01" }] }];
    const antes = criarStore({ "casa-cleaning-routine": secoes }, false);
    montar(<CleaningRoutine />, antes);
    expect(antes.escritas).toEqual([]);
    const soDieta = criarStore({ "casa-grocery-categories": [{ id: "dieta-auto", name: "Dieta", emoji: "🥗", color: "bg-green-500", items: [] }] }, false);
    montar(<GroceryList />, soDieta);
    expect(soDieta.escritas).toEqual([]);
  });

  it("item marcado no formato antigo (sem data) segue marcado hoje e ganha o carimbo", () => {
    const store = criarStore({ "casa-cleaning-routine": [{ id: "1", name: "LIMPEZA SEMANAL", color: "", items: [{ id: "i", text: "Trocar lençóis", done: true }] }] });
    montar(<CleaningRoutine />, store);
    expect(screen.getAllByRole("checkbox").find((c) => !c.hasAttribute("disabled"))).toHaveAttribute("data-state", "checked");
    expect((store.dados["casa-cleaning-routine"] as { items: { doneOn?: string }[] }[])[0].items[0].doneOn).toBe(localDayKey());
  });
});

describe("Manutenção e Segurança: dia certo", () => {
  it("'✅ Feito' hoje mostra HOJE (não ontem) e garantia sem data não diz 'Expirada'", () => {
    const store = criarStore({
      "casa-maint-tasks": [{ id: "1", task: "Filtro", frequencyMonths: 6, lastDone: "", icon: "💧" }],
      "casa-warranties": [{ id: "w", product: "Geladeira", purchaseDate: "", warrantyMonths: 12, photoUrl: "", notes: "" }],
    });
    montar(<MaintenanceLog />, store);
    fireEvent.click(screen.getByRole("button", { name: /Feito/ }));
    expect(screen.getByText(new RegExp(`Último: ${new Date().toLocaleDateString("pt-BR")}`))).toBeInTheDocument();
    expect(screen.getByText(/Sem data de compra/)).toBeInTheDocument();
    expect(screen.queryByText(/Expirada/)).not.toBeInTheDocument();
  });

  it("data gravada 29/04 aparece 29/04 (era 28/04)", () => {
    montar(<MaintenanceLog />, criarStore({ "casa-maint-tasks": [{ id: "1", task: "Ar", frequencyMonths: 6, lastDone: "2026-04-29", icon: "❄️" }] }));
    expect(screen.getByText(/Último: 29\/04\/2026/)).toBeInTheDocument();
  });

  it("estoque de emergência: 'Checado' no dia local", () => {
    montar(<SafetyChecks />, criarStore({ "casa-emergency-stock": [{ id: "e", name: "Velas", checked: true, lastChecked: "2026-09-25" }] }));
    expect(screen.getByText("Checado: 25/09/2026")).toBeInTheDocument();
  });
});

describe("Utilidades", () => {
  it("WhatsApp é botão (sem <a href=wa.me> pra UTMify reescrever) e não duplica o 55", () => {
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    const store = criarStore({ "casa-contacts": [{ id: "c", name: "Seu Zé", phone: "+55 (11) 99999-8888", tag: "Encanador", lastService: "", lastValue: "" }] });
    const { container } = montar(<HomeUtilities />, store);
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp de Seu Zé/ }));
    expect(abrir).toHaveBeenCalledWith("https://wa.me/5511999998888", "_blank");
    abrir.mockRestore();
  });

  it("consumo em real, mês por extenso curto e nomes com acento", () => {
    const store = criarStore({ "casa-utilities": [{ id: "u", month: "2026-09", type: "agua", cost: 150.5, consumption: 12.5, unit: "m³" }] });
    montar(<HomeUtilities />, store);
    expect(screen.getByText("Água")).toBeInTheDocument();
    expect(screen.getByText("Gás")).toBeInTheDocument();
    expect(screen.getByText("set/2026")).toBeInTheDocument();
    expect(screen.getByText((t) => t.replace(/\s/g, " ") === "R$ 150,50")).toBeInTheDocument();
    expect(screen.getByText("12,5 m³")).toBeInTheDocument();
    expect(screen.queryByText("2026-09")).not.toBeInTheDocument();
  });
});

describe("Cardápio da Casa e Cômodos", () => {
  it("'Sugerir Cardápio' sem receita avisa e abre o banco de receitas", () => {
    montar(<MealPlanner />, criarStore());
    fireEvent.click(screen.getByRole("button", { name: /Sugerir Cardápio/ }));
    expect(vi.mocked(toast)).toHaveBeenCalledWith(expect.stringMatching(/Cadastre pelo menos uma receita/));
    expect(screen.getByText("📖 BANCO DE RECEITAS")).toBeInTheDocument();
  });

  it("título certo e cômodo com tarefas pede 'apagar?' antes; desfazer devolve tudo", () => {
    const store = criarStore({
      "casa-rooms": [
        { id: "1", name: "COZINHA", color: "bg-yellow-200 dark:bg-yellow-900/40", tasks: [{ id: "t", text: "Limpar a geladeira", done: false }] },
        { id: "2", name: "SALA", color: "bg-blue-200 dark:bg-blue-900/40", tasks: [] },
      ],
    });
    montar(<RoomManager />, store);
    expect(screen.queryByText(/COMPRAS E AFAZERES/i)).not.toBeInTheDocument();
    expect(screen.getByText("Afazeres por cômodo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover COZINHA" }));
    expect(store.dados["casa-rooms"]).toHaveLength(2); // nada apagado no 1º toque
    expect(screen.getByText("apagar?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar: apagar COZINHA/ }));
    expect((store.dados["casa-rooms"] as { name: string }[]).map((r) => r.name)).toEqual(["SALA"]);
    const [texto, desfazer] = desfazerDaUltimaChamada();
    expect(texto).toBe('Cômodo "Cozinha" e 1 tarefa apagados');
    act(() => desfazer());
    expect(store.dados["casa-rooms"]).toEqual([
      expect.objectContaining({ name: "COZINHA", tasks: [expect.objectContaining({ text: "Limpar a geladeira" })] }),
      expect.objectContaining({ name: "SALA" }),
    ]);

    // cômodo vazio: sai no 1º toque, com desfazer
    fireEvent.click(screen.getByRole("button", { name: "Remover SALA" }));
    expect((store.dados["casa-rooms"] as { name: string }[]).map((r) => r.name)).toEqual(["COZINHA"]);
    expect(desfazerDaUltimaChamada()[0]).toBe('Cômodo "Sala" apagado');
  });
});

/* ============================ DIETA ============================ */

describe("Dieta", () => {
  const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
  const hojeNome = DIAS[(new Date().getDay() + 6) % 7];
  const outroDia = DIAS.find((d) => d !== hojeNome)!;
  const planoSimples = () => Object.fromEntries(DIAS.map((d) => [d, { "Almoço": `Frango ${d}`, "Janta": `Sopa ${d}` }]));
  const montarDieta = (extra: Record<string, unknown> = {}) => {
    const store = criarStore({ "dieta-meals-config": ["Almoço", "Janta"], "saude-meals": planoSimples(), ...extra });
    montar(<Dieta />, store);
    return store;
  };
  const plano = (store: ReturnType<typeof criarStore>) => store.dados["saude-meals"] as Record<string, Record<string, string>>;

  it("contraste dos dias: QUARTA e QUINTA com texto escuro do tema; os outros brancos", () => {
    montarDieta();
    const cabecalho = (d: string) => within(screen.getByTestId(`dia-${d}`)).getByRole("button", { name: new RegExp(`(Abrir|Recolher) ${d}`) }).parentElement!;
    expect(cabecalho("QUARTA").className).toMatch(/text-foreground/);
    expect(cabecalho("QUINTA").className).toMatch(/text-foreground/);
    expect(cabecalho("SEGUNDA").className).toMatch(/text-white/);
  });

  it("todos os dias nascem ABERTOS (dono 10/10); tocar no cabeçalho recolhe e mostra o resumo, tocar no resumo abre de novo", () => {
    montarDieta();
    expect(within(screen.getByTestId(`dia-${hojeNome}`)).queryByTestId(`resumo-${hojeNome}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`resumo-${outroDia}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Recolher ${outroDia}` }));
    const resumo = screen.getByTestId(`resumo-${outroDia}`);
    expect(resumo).toHaveTextContent("2 de 2 refeições");
    fireEvent.click(resumo);
    expect(screen.queryByTestId(`resumo-${outroDia}`)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Recolher ${outroDia}` })).toHaveAttribute("aria-expanded", "true");
  });

  it("digitar no Almoço e tocar na Janta SALVA o Almoço (texto e kcal); abrir e trocar sem mexer não grava", () => {
    const store = montarDieta();
    const dia = screen.getByTestId(`dia-${hojeNome}`);
    fireEvent.click(within(dia).getByText(`Frango ${hojeNome}`));
    fireEvent.click(within(dia).getByText(`Sopa ${hojeNome}`)); // trocou sem mexer
    expect(store.escritas).not.toContain("saude-meals");

    fireEvent.click(within(dia).getByText(`Frango ${hojeNome}`));
    fireEvent.change(within(dia).getByDisplayValue(`Frango ${hojeNome}`), { target: { value: "Frango com batata" } });
    fireEvent.change(screen.getByLabelText(`Calorias de Almoço de ${hojeNome}`), { target: { value: "650" } });
    fireEvent.click(within(dia).getByText(`Sopa ${hojeNome}`));
    expect(plano(store)[hojeNome]["Almoço"]).toBe("Frango com batata");
    expect((store.dados["saude-meals-kcal"] as Record<string, Record<string, number>>)[hojeNome]["Almoço"]).toBe(650);
    expect(within(dia).getByDisplayValue(`Sopa ${hojeNome}`)).toBeInTheDocument(); // a Janta abriu
  });

  it("'Copiar → Todos' avisa e o Desfazer devolve os 6 dias com kcal", () => {
    const kcal = { ...Object.fromEntries(DIAS.map((d) => [d, { "Almoço": 500 }])), SEGUNDA: { "Almoço": 900 } };
    const store = montarDieta({ "saude-meals-kcal": kcal });
    const seg = screen.getByTestId("dia-SEGUNDA");
    fireEvent.click(within(seg).getByTitle("Copiar cardápio para outros dias"));
    fireEvent.click(within(seg).getAllByRole("checkbox")[0]); // "Todos"
    fireEvent.click(within(seg).getByRole("button", { name: "Copiar (6)" }));
    expect(plano(store)["SÁBADO"]["Almoço"]).toBe("Frango SEGUNDA");
    expect((store.dados["saude-meals-kcal"] as Record<string, Record<string, number>>)["SÁBADO"]).toEqual({ "Almoço": 900 });
    const [texto, desfazer] = desfazerDaUltimaChamada();
    expect(texto).toBe("Cardápio de SEGUNDA copiado pra todos os dias");
    act(() => desfazer());
    expect(plano(store)["SÁBADO"]["Almoço"]).toBe("Frango SÁBADO");
    expect(plano(store)["SEGUNDA"]["Almoço"]).toBe("Frango SEGUNDA");
    expect((store.dados["saude-meals-kcal"] as Record<string, Record<string, number>>)["SÁBADO"]).toEqual({ "Almoço": 500 });
  });

  it("configurar refeições não promete arrastar", () => {
    montarDieta();
    fireEvent.click(screen.getByRole("button", { name: /Refeições \(/ }));
    expect(screen.getByText(/use as setas pra mudar a ordem/)).toBeInTheDocument();
    expect(screen.queryByText(/arraste/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descer Almoço" })).toBeInTheDocument();
  });

  it("aderência: 1 ✅ = parcial (1/2), com ❌ = furou, tudo ✅ = verde", () => {
    montarDieta();
    fireEvent.click(screen.getByRole("button", { name: /DIÁRIO/ }));
    const quadrado = () => screen.getByTestId(`aderencia-${localDayKey()}`);
    expect(quadrado()).toHaveAttribute("data-status", "vazio");
    const cards = () => screen.getAllByText("✅").filter((b) => b.tagName === "BUTTON");
    fireEvent.click(cards()[0]);
    expect(quadrado()).toHaveAttribute("data-status", "parcial");
    expect(quadrado()).toHaveTextContent("1/2");
    fireEvent.click(screen.getAllByText("❌").filter((b) => b.tagName === "BUTTON")[1]);
    expect(quadrado()).toHaveAttribute("data-status", "furou");
    fireEvent.click(cards()[1]);
    expect(quadrado()).toHaveAttribute("data-status", "tudo");
  });

  it("'Gerar do Cardápio' com o cardápio da demo: itens limpos, sem 'Refeição livre' nem capitalize", () => {
    const seeds = getSeedsForModule("dieta");
    const store = criarStore({ "dieta-meals-config": seeds["dieta-meals-config"], "saude-meals": seeds["saude-meals"] });
    const { container } = montar(<Dieta />, store);
    fireEvent.click(screen.getByRole("button", { name: /LISTA/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar do Cardápio/ }));
    const textos = (store.dados["dieta-smart-list"] as { text: string }[]).map((i) => i.text);
    expect(textos).toEqual(expect.arrayContaining(["Ovos mexidos", "Pão integral", "Frango grelhado", "Arroz", "Feijão", "Castanhas ou pasta de amendoim"]));
    // sem gramas, parênteses, "•", número de quantidade no começo nem a "Refeição livre"
    // (o "3" de "Omelete de 3 ovos com queijo" é parte do nome do prato)
    expect(textos.some((t) => /livre|\(|•|^\d|\d\s*g\b/i.test(t))).toBe(false);
    expect(textos).toHaveLength(20);
    expect(new Set(textos.map((t) => t.toLowerCase())).size).toBe(textos.length);
    expect(screen.getByText("Pão integral")).toBeInTheDocument();
    expect(container.querySelector(".capitalize")).toBeNull();
    expect(vi.mocked(toast)).toHaveBeenCalledWith(`${textos.length} itens entraram na lista`);
  });

  it("apagar receita oferece desfazer", () => {
    const store = montarDieta({
      "dieta-recipes-v2": [
        { id: "1", name: "Panqueca", ingredients: "", instructions: "", category: "Café", favorite: false, prepTime: "", servings: "" },
        { id: "2", name: "Frango cremoso", ingredients: "", instructions: "", category: "Almoço", favorite: false, prepTime: "", servings: "" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /RECEITAS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar Panqueca" }));
    expect((store.dados["dieta-recipes-v2"] as { name: string }[]).map((r) => r.name)).toEqual(["Frango cremoso"]);
    const [texto, desfazer] = desfazerDaUltimaChamada();
    expect(texto).toBe('Receita "Panqueca" apagada');
    act(() => desfazer());
    expect((store.dados["dieta-recipes-v2"] as { name: string }[]).map((r) => r.name)).toEqual(["Panqueca", "Frango cremoso"]);
  });
});
