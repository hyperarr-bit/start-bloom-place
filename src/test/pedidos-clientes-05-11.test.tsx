/**
 * Três pedidos de cliente (05/11), todos dentro das telas que já existem:
 *  1. antecipar parcela (pagou 2 do carro de uma vez);
 *  2. categorias em ordem alfabética na hora de escolher;
 *  3. lançar ou corrigir água em dia anterior.
 * O ciclo é sempre o de verdade: abrir, usar, sair (unmount), reabrir lendo do store em JSON.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState, type ReactNode } from "react";
import { render, screen, fireEvent, cleanup, renderHook, within } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { normalizeForKey } from "@/lib/data-normalizers";
import { FIXED_CATEGORIES, VARIABLE_CATEGORIES, ordenarCategorias, useFinanceCategories } from "@/lib/finance-categories";
import {
  type Parcela, adiantarParcela, avancarPara, desfazerAdiantada, marcarParcelaDoMes, parcelaPagaNoMes, parcelaQuitada,
  parcelasAdiantadas, podeAdiantar, projetarParcelas, somaParcelasDoMes, valorDaParcelaNoMes, viradaDeParcelas,
} from "@/lib/finance-parcelas";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (JSON.parse(JSON.stringify(dados[key])) as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true, isGuest: true, fetchKey: async () => null,
  } as unknown as UserDataContextType;
  return { dados, valor };
};
const comStore = (store: ReturnType<typeof criarStore>, ui: ReactNode) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

const carro = (extra: Partial<Parcela> = {}): Parcela => ({
  id: "carro", description: "Carro", totalValue: 6000, installmentValue: 1000, paidInstallments: 3, totalInstallments: 6,
  cardName: "outro", category: "transporte", date: "2026-06-10", startMonth: "2026-10", parcelaDoMes: 4, ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 10, 0));
  vi.mocked(toast).mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("1. antecipar parcela: a conta", () => {
  it("adiantar só anda o pago; a parcela do mês e o valor do mês ficam iguais", () => {
    const paga = marcarParcelaDoMes(carro(), true, "2026-10");
    const adiantada = adiantarParcela(paga, "2026-10");
    expect(adiantada).toMatchObject({ paidInstallments: 5, parcelaDoMes: 4, startMonth: "2026-10" });
    expect(parcelasAdiantadas(adiantada)).toBe(1);
    expect(valorDaParcelaNoMes(adiantada)).toBe(1000);
    expect(somaParcelasDoMes([adiantada])).toBe(somaParcelasDoMes([carro()]));
  });

  it("com a do mês em aberto, adiantar dá baixa nas duas", () => {
    expect(adiantarParcela(carro(), "2026-10").paidInstallments).toBe(5);
  });

  it("nunca passa do total e só oferece o que ainda existe", () => {
    const tudo = adiantarParcela(adiantarParcela(adiantarParcela(carro({ paidInstallments: 4 }), "2026-10"), "2026-10"), "2026-10");
    expect(tudo.paidInstallments).toBe(6);
    expect(parcelaQuitada(tudo)).toBe(true);
    expect(podeAdiantar(tudo)).toBe(false);
    expect(valorDaParcelaNoMes(tudo)).toBe(1000); // quitou adiantado, mas a de outubro segue no mês
    expect(podeAdiantar(carro())).toBe(false); // a do mês em aberto: primeiro o ✓
  });

  it("a virada leva o adiantado: novembro nasce paga e com o valor no mês; dezembro volta a ficar em aberto", () => {
    const adiantada = adiantarParcela(carro({ paidInstallments: 4 }), "2026-10");
    const v = viradaDeParcelas([adiantada], "2026-11");
    const nov = v!.lista[0];
    expect(nov).toMatchObject({ startMonth: "2026-11", parcelaDoMes: 5, paidInstallments: 5 });
    expect(parcelaPagaNoMes(nov)).toBe(true);
    expect(valorDaParcelaNoMes(nov)).toBe(1000);
    expect(v!.arquivos["2026-10"][0]).toMatchObject({ parcelaDoMes: 4, paidInstallments: 5, levada: true });
    expect(parcelaPagaNoMes(viradaDeParcelas([nov], "2026-12")!.lista[0])).toBe(false);
  });

  it("no mês futuro ela aparece prevista, paga e com o valor", () => {
    const adiantada = adiantarParcela(carro({ paidInstallments: 4 }), "2026-10");
    const [nov] = projetarParcelas([{ mes: "2026-10", itens: [adiantada] }], "2026-11", []);
    expect(parcelaPagaNoMes(nov)).toBe(true);
    expect(valorDaParcelaNoMes(nov)).toBe(1000);
  });

  it("volta atrás uma de cada vez, sem tocar na parcela do mês", () => {
    const duas = adiantarParcela(adiantarParcela(carro({ paidInstallments: 4 }), "2026-10"), "2026-10");
    const uma = desfazerAdiantada(duas, "2026-10");
    expect(uma.paidInstallments).toBe(5);
    expect(desfazerAdiantada(uma, "2026-10").paidInstallments).toBe(4);
    expect(desfazerAdiantada(carro({ paidInstallments: 4 }), "2026-10").paidInstallments).toBe(4); // nada adiantado: não mexe
  });

  it("registro legado (sem carimbo) ganha o carimbo certo ao adiantar", () => {
    const { startMonth: _s, parcelaDoMes: _p, ...legado } = carro({ paidInstallments: 3 });
    expect(adiantarParcela(legado, "2026-10")).toMatchObject({ startMonth: "2026-10", parcelaDoMes: 4, paidInstallments: 5 });
  });

  it("APP ANTIGO: nenhum campo novo nem tipo novo, e o que ele faz (ler, marcar, virar) continua valendo", () => {
    const gravada = JSON.parse(JSON.stringify(adiantarParcela(carro({ paidInstallments: 4 }), "2026-10")));
    expect(Object.keys(gravada).sort()).toEqual(Object.keys(carro()).sort());
    expect(typeof gravada.paidInstallments).toBe("number");
    const lida = (normalizeForKey("finance-installments", [gravada]) as Parcela[])[0];
    expect(lida.paidInstallments).toBe(5); // o normalizador não corta o adiantado
    expect(marcarParcelaDoMes(lida, true, "2026-10").paidInstallments).toBe(5);
    expect(avancarPara(lida, "2026-10", "2026-11")?.paidInstallments).toBe(5);
  });
});

/** O pai de verdade guarda a lista em estado; aqui o estado espelha no store como o usePersistedState faz. */
const Planilha = ({ store, mes = "2026-10", projetadas }: { store: ReturnType<typeof criarStore>; mes?: string; projetadas?: Parcela[] }) => {
  const [lista, setLista] = useState<Parcela[]>(() => store.valor.get<Parcela[]>("finance-installments", []));
  return <InstallmentTracker installments={lista} setInstallments={(l) => { store.dados["finance-installments"] = l; setLista(l); }} mes={mes} projetadas={projetadas} />;
};
const lido = (store: ReturnType<typeof criarStore>) => (store.dados["finance-installments"] as Parcela[])[0];

describe("1. antecipar parcela: a tela", () => {
  it("o ciclo do cliente: ✓ de outubro, baixa em novembro, sai, reabre e continua; o total do mês não muda", () => {
    const store = criarStore({ "finance-installments": [carro()] });
    const r = comStore(store, <Planilha store={store} />);
    const total = () => screen.getAllByText(/R\$ 1\.000,00/).length;
    const antes = total();
    expect(screen.queryByTestId("adiantar-parcela")).toBeNull(); // sem o ✓ não aparece nada novo
    fireEvent.click(screen.getByRole("checkbox", { name: /Marcar parcela 4 de Carro/ }));
    fireEvent.click(screen.getByText("+ Paguei a de nov"));
    expect(lido(store)).toMatchObject({ paidInstallments: 5, parcelaDoMes: 4 });
    expect(screen.getByText("Paga até nov")).toBeInTheDocument();
    expect(total()).toBe(antes);
    r.unmount();
    comStore(store, <Planilha store={store} />);
    expect(screen.getByText("Paga até nov")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Desmarcar parcela 4 de Carro/ })).toBeChecked();
    fireEvent.click(screen.getByText("Desfazer"));
    expect(lido(store).paidInstallments).toBe(4);
    expect(screen.getByText("+ Paguei a de nov")).toBeInTheDocument();
  });

  it("adiantar até o fim fica 'quitado' mas dá pra voltar, pelo Desfazer e pelo ✓", () => {
    const store = criarStore({ "finance-installments": [carro({ paidInstallments: 5, parcelaDoMes: 5, totalInstallments: 6 })] });
    comStore(store, <Planilha store={store} />);
    fireEvent.click(screen.getByText("+ Paguei a de nov"));
    expect(lido(store).paidInstallments).toBe(6);
    expect(screen.getByText("Paga até nov")).toBeInTheDocument();
    expect(screen.queryByText(/^\+ /)).toBeNull(); // acabaram as parcelas: nada mais a adiantar
    fireEvent.click(screen.getByRole("checkbox", { name: /Desmarcar parcela 5 de Carro/ }));
    expect(lido(store).paidInstallments).toBe(4); // a baixa é em sequência: o mês leva as de depois
    expect(toast).toHaveBeenCalledWith("As parcelas adiantadas também foram desmarcadas", expect.objectContaining({ action: expect.objectContaining({ label: "Desfazer" }) }));
    const { onClick } = vi.mocked(toast).mock.calls[0][1]!.action as unknown as { onClick: () => void };
    onClick();
    expect(lido(store).paidInstallments).toBe(6);
  });

  it("editar o nome de uma parcela adiantada não empurra a parcela do mês (a dívida acabaria antes)", () => {
    const store = criarStore({ "finance-installments": [carro({ paidInstallments: 6 })] });
    comStore(store, <Planilha store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Carro" }));
    fireEvent.change(screen.getByPlaceholderText("Descrição"), { target: { value: "Carro novo" } });
    fireEvent.click(screen.getByText("Salvar"));
    expect(lido(store)).toMatchObject({ description: "Carro novo", paidInstallments: 6, parcelaDoMes: 4 });
  });

  it("editar 'Já paguei' sem adiantado segue como sempre: a parcela do mês acompanha", () => {
    const store = criarStore({ "finance-installments": [carro()] });
    comStore(store, <Planilha store={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Carro" }));
    fireEvent.change(screen.getByLabelText("Já paguei"), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Salvar"));
    expect(lido(store)).toMatchObject({ paidInstallments: 4, parcelaDoMes: 5 });
  });

  it("mês passado é história: sem adiantar nem desfazer, e o ✓ da quitada fica como era", () => {
    const retrato = carro({ startMonth: "2026-09", parcelaDoMes: 6, paidInstallments: 6, levada: true });
    const aberto = carro({ id: "b", description: "Geladeira", startMonth: "2026-09", parcelaDoMes: 3, paidInstallments: 4, levada: true });
    const store = criarStore({ "finance-installments": [retrato, aberto] });
    comStore(store, <Planilha store={store} mes="2026-09" />);
    expect(screen.queryByTestId("adiantar-parcela")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Carro/ })).toBeNull();
  });

  it("mês futuro: a parcela prevista mostra 'paga' e continua sem botão", () => {
    const adiantada = carro({ paidInstallments: 5 });
    const [nov] = projetarParcelas([{ mes: "2026-10", itens: [adiantada] }], "2026-11", []);
    const store = criarStore({ "finance-installments": [] });
    comStore(store, <Planilha store={store} mes="2026-11" projetadas={[nov]} />);
    const linha = screen.getByText("Carro").closest("tr")!;
    expect(within(linha).getByText("paga")).toBeInTheDocument();
    expect(within(linha).queryByRole("checkbox")).toBeNull();
    expect(within(linha).queryByRole("button")).toBeNull();
  });
});

describe("2. categorias em ordem alfabética", () => {
  const rotulos = (l: { label: string }[]) => l.map((c) => c.label);
  const hook = (dados: Record<string, unknown> = {}) => {
    const store = criarStore(dados);
    return renderHook(() => useFinanceCategories(), {
      wrapper: ({ children }) => <UserDataContext.Provider value={store.valor}>{children}</UserDataContext.Provider>,
    }).result.current;
  };

  it("acento não joga pro fim, e as personalizadas entram junto, com Outros por último", () => {
    const { variableCats, fixedCats, allCats } = hook({
      "finance-custom-categories": [
        { value: "c_1", label: "Água", palette: 0 }, { value: "c_2", label: "zoológico", palette: 1 },
        { value: "c_3", label: "Ótica", palette: 2 }, { value: "c_4", label: "Antiga", palette: 3, archived: true },
      ],
    });
    for (const lista of [variableCats, fixedCats, allCats]) {
      const r = rotulos(lista);
      expect(r).toEqual([...r.slice(0, -1)].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })).concat("Outros"));
      expect(r).not.toContain("Antiga");
    }
    const r = rotulos(variableCats);
    expect(r[0]).toBe("Água"); // "Ag" vem antes de "Al": o acento não joga pro fim
    expect(r.indexOf("Educação")).toBeLessThan(r.indexOf("Eletrônicos"));
    expect(r.indexOf("Ótica")).toBeLessThan(r.indexOf("Outros"));
    expect(r.indexOf("Ótica")).toBeGreaterThan(r.indexOf("Mercado"));
    expect(r.at(-2)).toBe("zoológico");
  });

  it("não muda o guardado: catálogos na ordem de sempre, personalizadas sem reescrita e label/cor resolvem igual", () => {
    const custom = [{ value: "c_1", label: "Zebra", palette: 0 }, { value: "c_2", label: "Abacaxi", palette: 1 }];
    const store = criarStore({ "finance-custom-categories": custom });
    const set = vi.spyOn(store.valor, "set");
    const { result } = renderHook(() => useFinanceCategories(), {
      wrapper: ({ children }) => <UserDataContext.Provider value={store.valor}>{children}</UserDataContext.Provider>,
    });
    expect(set).not.toHaveBeenCalled();
    expect(result.current.custom.map((c) => c.value)).toEqual(["c_1", "c_2"]);
    expect(result.current.labelOf("c_1")).toBe("Zebra");
    expect(VARIABLE_CATEGORIES[0].value).toBe("alimentacao");
    expect(VARIABLE_CATEGORIES.at(-1)?.value).toBe("outros");
    expect(FIXED_CATEGORIES[0].value).toBe("moradia");
  });

  it("ordenarCategorias não altera a lista que recebe", () => {
    const base = [{ value: "outros", label: "Outros" }, { value: "b", label: "Beta" }, { value: "a", label: "Álcool" }];
    expect(ordenarCategorias(base).map((c) => c.value)).toEqual(["a", "b", "outros"]);
    expect(base[0].value).toBe("outros");
  });
});

describe("3. água em dia anterior", () => {
  const HOJE = "2026-10-15";
  const ONTEM = "2026-10-14";
  const saude = (s: ReturnType<typeof criarStore>) => s.dados["core-saude-water"] as Record<string, number>;
  const rotina = (s: ReturnType<typeof criarStore>) => s.dados["water-log"] as Record<string, number>;
  const anterior = () => fireEvent.click(screen.getByRole("button", { name: /Dia anterior/ }));

  it("conta sem registro nenhum não vê nada novo (a miniatura de quem chega fica igual)", () => {
    comStore(criarStore(), <HydrationTracker />);
    expect(screen.queryByTestId("agua-dia")).toBeNull();
  });

  it("lança em ontem nas duas chaves, sem tocar no hoje; sair e reabrir volta pro hoje com o número guardado", () => {
    const store = criarStore({ "core-saude-water": { [HOJE]: 2 }, "water-log": { [HOJE]: 2 } });
    const r = comStore(store, <HydrationTracker />);
    anterior();
    expect(screen.getByText("Ontem")).toBeInTheDocument();
    const mais = screen.getByRole("button", { name: /em ontem/ });
    fireEvent.click(mais); fireEvent.click(mais); fireEvent.click(mais);
    expect(saude(store)).toEqual({ [HOJE]: 2, [ONTEM]: 3 });
    expect(rotina(store)).toEqual({ [HOJE]: 2, [ONTEM]: 3 });
    r.unmount();
    comStore(store, <HydrationTracker />);
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar meta/ }).textContent).toContain("500ml");
    fireEvent.click(screen.getByRole("button", { name: /\+250ml/ }));
    expect(saude(store)).toEqual({ [HOJE]: 3, [ONTEM]: 3 });
    anterior();
    expect(screen.getByRole("button", { name: /Editar meta/ }).textContent).toContain("750ml"); // o de ontem voltou
  });

  it("corrigir pra baixo vale nas duas chaves, mesmo com elas divergentes (o Math.max não ressuscita)", () => {
    const store = criarStore({ "core-saude-water": { [ONTEM]: 5 }, "water-log": { [ONTEM]: 2 } });
    comStore(store, <HydrationTracker />);
    anterior();
    fireEvent.click(screen.getByRole("button", { name: /Tirar um registro/ }));
    expect(saude(store)[ONTEM]).toBe(4);
    expect(rotina(store)[ONTEM]).toBe(4);
    fireEvent.click(screen.getByText("Zerar este dia"));
    expect(saude(store)[ONTEM]).toBe(0);
    expect(rotina(store)[ONTEM]).toBe(0);
    expect(saude(store)[HOJE]).toBeUndefined();
  });

  it("sem dia futuro: em hoje o Próximo dia fica travado; depois de voltar, para no hoje", () => {
    comStore(criarStore({ "water-log": { [HOJE]: 1 } }), <HydrationTracker />);
    const proximo = () => screen.getByRole("button", { name: /Próximo dia/ });
    expect(proximo()).toBeDisabled();
    anterior();
    fireEvent.click(proximo());
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(proximo()).toBeDisabled();
  });

  it("volta no máximo 30 dias", () => {
    comStore(criarStore({ "water-log": { [HOJE]: 1 } }), <HydrationTracker />);
    for (let i = 0; i < 30; i++) anterior();
    expect(screen.getByRole("button", { name: /Dia anterior/ })).toBeDisabled();
    expect(screen.getByText("Ter, 15 set")).toBeInTheDocument();
  });

  it("o toque de hoje segue idêntico: só o dia de hoje, nas duas chaves, com o rótulo de sempre", () => {
    const store = criarStore({ "core-saude-water": { [ONTEM]: 8 }, "water-log": { [ONTEM]: 8 } });
    comStore(store, <HydrationTracker />);
    fireEvent.click(screen.getByRole("button", { name: "+250ml" }));
    expect(saude(store)).toEqual({ [ONTEM]: 8, [HOJE]: 1 });
    expect(rotina(store)).toEqual({ [ONTEM]: 8, [HOJE]: 1 });
    expect(screen.getByText("Zerar o dia e começar de novo")).toBeInTheDocument();
  });

  it("passou da meia-noite com um dia escolhido: nunca escreve no futuro e 'ontem' continua sendo o dia guardado", () => {
    const store = criarStore({ "water-log": { [HOJE]: 1 } });
    const r = comStore(store, <HydrationTracker />);
    anterior();
    vi.setSystemTime(new Date(2026, 9, 16, 0, 5));
    r.rerender(<UserDataContext.Provider value={store.valor}><HydrationTracker /></UserDataContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: /\+250ml/ }));
    expect(saude(store)[ONTEM]).toBe(1);
    expect(saude(store)["2026-10-16"]).toBeUndefined();
  });
});
