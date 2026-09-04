/**
 * O que os clientes pediram, virado em trava (01/09).
 *
 * Cada bloco aqui existe por causa de uma frase específica de uma pessoa real
 * — avaliação na Play ou mensagem no WhatsApp. O comentário cita a frase, pra
 * que um dia alguém saiba o que quebrou se apagar o teste.
 *
 * Ciclo completo (regra da casa, 19/07): onde a feature é de UI, o teste
 * abre → usa → SAI → REABRE, porque o buraco costuma estar na remontagem.
 */
import { syncFixedExpensesToBills } from "@/lib/finance-sync";
import { getMonthTotals } from "@/components/finance/storage-keys";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import {
  DividasEntrePessoas, saldoDaDivida, type DividaPessoal,
} from "@/components/finance/DividasEntrePessoas";
import {
  mediaDeCiclo, faseDoDia, diasEntre, somarDias, type RegistroCiclo,
} from "@/components/saude/CicloMenstrual";
import { getFinanceStorageKeys, getCurrentYear, getCurrentMonthName } from "@/components/finance/storage-keys";
import { doPerfil, mesclarPerfil, perfilDe, PERFIL_PESSOAL, PERFIL_TODOS, doPerfilDueDays, mesclarPerfilDueDays, perfilAtivoLocal, etiquetar } from "@/lib/finance-perfil";

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

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

/* ============================================================
 * DIVISÃO DE CONTAS — avaliação 5★ de 31/08
 * "gostaria de separar nos custos fixos de casa, a parte do meu marido e
 *  minha já que dividimos tudo meio a meio. daí então eu tiraria um relatório
 *  de tudo o que ele tem que pagar"
 * ============================================================ */
describe("Divisão de contas do casal", () => {
  const custos = [
    { id: "1", description: "Aluguel", category: "moradia", value: 2000, paymentMethod: "boleto" },
    { id: "2", description: "Academia dele", category: "academia", value: 100, paymentMethod: "pix" },
    { id: "3", description: "Meu celular", category: "internet_telefone", value: 60, paymentMethod: "pix" },
  ];

  it("nasce DESLIGADA — quem não divide vê a tela de sempre", () => {
    const store = criarStore();
    renderComStore(<FixedExpensesTable expenses={custos} setExpenses={() => {}} />, store);
    expect(screen.queryByText(/Cabe a você/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aluguel.*Você/i })).not.toBeInTheDocument();
  });

  it("rateia meio a meio e mostra quanto cabe a cada um", () => {
    // Aluguel dividido, academia dele, celular meu.
    const comQuem = [
      { ...custos[0], quem: "ambos" as const },
      { ...custos[1], quem: "outro" as const },
      { ...custos[2], quem: "eu" as const },
    ];
    const store = criarStore({ "finance-divisao-contas": { ligado: true, nome: "Ricardo" } });
    renderComStore(<FixedExpensesTable expenses={comQuem} setExpenses={() => {}} />, store);

    // Ela: 1000 (metade do aluguel) + 60 (celular) = 1.060,00
    expect(screen.getByText("R$ 1.060,00")).toBeInTheDocument();
    // Ele: 1000 (metade do aluguel) + 100 (academia) = 1.100,00
    expect(screen.getByText("R$ 1.100,00")).toBeInTheDocument();
    // E o total do card não muda — o rateio não inventa nem some dinheiro.
    expect(screen.getByText("R$ 2.160,00")).toBeInTheDocument();
    expect(screen.getByText(/Cabe a Ricardo/i)).toBeInTheDocument();
  });

  it("item sem classificação conta como SEU — retrocompatível com quem já tinha custos", () => {
    const store = criarStore({ "finance-divisao-contas": { ligado: true, nome: "Ricardo" } });
    renderComStore(<FixedExpensesTable expenses={custos} setExpenses={() => {}} />, store);
    // Nada classificado: tudo cai no lado dela, nada no dele. O valor aparece
    // duas vezes de propósito — no TOTAL e no "cabe a você", que coincidem.
    expect(screen.getAllByText("R$ 2.160,00")).toHaveLength(2);
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("um toque no selo cicla você → meio a meio → a outra pessoa", () => {
    let atual = [{ ...custos[0] }] as Record<string, unknown>[];
    const store = criarStore({ "finance-divisao-contas": { ligado: true, nome: "Ricardo" } });
    const tela = renderComStore(
      <FixedExpensesTable expenses={atual as never} setExpenses={(e) => { atual = e as never; }} />,
      store,
    );
    fireEvent.click(screen.getByRole("button", { name: /Quem paga Aluguel/i }));
    expect(atual[0].quem).toBe("ambos");

    tela.rerender(
      <UserDataContext.Provider value={store.valor}>
        <FixedExpensesTable expenses={atual as never} setExpenses={(e) => { atual = e as never; }} />
      </UserDataContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Quem paga Aluguel/i }));
    expect(atual[0].quem).toBe("outro");
  });
});

/* ============================================================
 * DÍVIDAS ENTRE PESSOAS — pedido por WhatsApp
 * "dívidas de dever pra alguma pessoa. Exemplo 5 mil na pessoa. Aí vai
 *  parcelando é que NÃO ENVOLVA a questão do gráfico e despesas."
 * "Emprestei o dinheiro pra tal pessoa e ela me deve SEM MEXER NO CAIXA."
 * ============================================================ */
describe("Dívidas entre pessoas", () => {
  it("saldo é a soma dos lançamentos — nunca um campo salvo que pode dessincronizar", () => {
    const d: DividaPessoal = {
      id: "x", pessoa: "João", direcao: "devo", criadaEm: "2026-08-01",
      lancamentos: [
        { id: "a", data: "2026-08-01", valor: 5000 },
        { id: "b", data: "2026-08-15", valor: -1500 },
        { id: "c", data: "2026-08-28", valor: -500 },
      ],
    };
    expect(saldoDaDivida(d)).toBe(3000);
  });

  it('"vai entrando" — lançamento positivo aumenta a dívida existente', () => {
    const d: DividaPessoal = {
      id: "x", pessoa: "João", direcao: "devo", criadaEm: "2026-08-01",
      lancamentos: [
        { id: "a", data: "2026-08-01", valor: 5000 },
        { id: "b", data: "2026-08-10", valor: -1000 },
        { id: "c", data: "2026-08-20", valor: 800 },
      ],
    };
    expect(saldoDaDivida(d)).toBe(4800);
  });

  it("grava numa chave PRÓPRIA, fora de despesas e parcelamentos", () => {
    const store = criarStore();
    renderComStore(<DividasEntrePessoas />, store);

    fireEvent.change(screen.getByPlaceholderText(/Devo para quem/i), { target: { value: "João" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));

    expect(store.dados["finance-dividas-pessoas"]).toBeDefined();
    // A regra do pedido: nada disso encosta no caixa do mês.
    expect(store.dados["finance-expenses"]).toBeUndefined();
    expect(store.dados["finance-installments"]).toBeUndefined();
    expect(store.dados["finance-fixed-expenses"]).toBeUndefined();
  });

  it("registra, abate e SOBREVIVE a fechar e reabrir a tela", () => {
    const store = criarStore();
    const tela = renderComStore(<DividasEntrePessoas />, store);

    fireEvent.change(screen.getByPlaceholderText(/Devo para quem/i), { target: { value: "João" } });
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar dívida" }));
    // Aparece na linha e no rodapé "Você deve" — as duas leituras do mesmo valor.
    expect(screen.getAllByText("R$ 5.000,00")).toHaveLength(2);

    // abre a dívida e paga uma parte
    fireEvent.click(screen.getByText("João"));
    fireEvent.click(screen.getByRole("button", { name: /Paguei uma parte/i }));
    fireEvent.change(screen.getByPlaceholderText(/Quanto foi abatido/i), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar" }));

    // SAIR e REABRIR — o dado tem que voltar da chave certa
    tela.unmount();
    renderComStore(<DividasEntrePessoas />, store);
    expect(screen.getAllByText("R$ 3.500,00").length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$ 1\.500,00 de R\$ 5\.000,00 já pagos/i)).toBeInTheDocument();
  });
});

/* ============================================================
 * CICLO MENSTRUAL — avaliação 4★ de 29/08 + pedido da Stephanie
 * "acompanhar os ciclos menstruais... o ciclo auxilia muito no humor, no
 *  quanto a gente gasta dinheiro, no quanto a gente dorme"
 * ============================================================ */
describe("Ciclo menstrual", () => {
  const ciclosDe = (...inicios: string[]): RegistroCiclo[] => inicios.map(inicio => ({ inicio }));

  it("sem dois ciclos registrados a média é ESTIMADA, e a tela precisa poder dizer isso", () => {
    expect(mediaDeCiclo([], 28)).toEqual({ media: 28, estimado: true, amostras: 0 });
    expect(mediaDeCiclo(ciclosDe("2026-08-01"), 30)).toEqual({ media: 30, estimado: true, amostras: 0 });
  });

  it("com histórico, a média passa a ser a DELA", () => {
    // 30 e 32 dias → média 31
    const r = mediaDeCiclo(ciclosDe("2026-06-01", "2026-07-01", "2026-08-02"), 28);
    expect(r).toEqual({ media: 31, estimado: false, amostras: 2 });
  });

  it("descarta intervalo absurdo em vez de deixar entortar a previsão", () => {
    // Um registro esquecido cria um vão de ~6 meses. Só o gap válido conta.
    const r = mediaDeCiclo(ciclosDe("2026-01-01", "2026-07-01", "2026-07-29"), 28);
    expect(r.media).toBe(28);
    expect(r.amostras).toBe(1);
  });

  it("ovulação é contada de trás pra frente — não é 'sempre o dia 14'", () => {
    // Ciclo de 35 dias: ovulação por volta do dia 21, não do 14.
    expect(faseDoDia(14, 35, 5)).toBe("folicular");
    expect(faseDoDia(21, 35, 5)).toBe("ovulatoria");
    expect(faseDoDia(30, 35, 5)).toBe("lutea");
    // Ciclo de 28: aí sim cai no 14.
    expect(faseDoDia(14, 28, 5)).toBe("ovulatoria");
  });

  it("os dias de fluxo mandam no começo do ciclo", () => {
    expect(faseDoDia(1, 28, 5)).toBe("menstrual");
    expect(faseDoDia(5, 28, 5)).toBe("menstrual");
    expect(faseDoDia(6, 28, 5)).toBe("folicular");
    // Quem configurou 7 dias de fluxo continua menstruada no dia 7.
    expect(faseDoDia(7, 28, 7)).toBe("menstrual");
  });

  it("conta dias no fuso LOCAL — sem escorregar na virada do mês nem no horário de verão", () => {
    expect(diasEntre("2026-08-30", "2026-09-02")).toBe(3);
    expect(somarDias("2026-08-30", 3)).toBe("2026-09-02");
    expect(diasEntre("2026-02-01", "2026-03-01")).toBe(28);
  });
});

/* ============================================================
 * ANOS ANTERIORES — pedido por WhatsApp
 * "quer voltar a ano de finanças tipo botar 2024 2025, trazer do app antigo
 *  dele pra cá pq ele organizou 2024 2025"
 * ============================================================ */
describe("Planilha de anos anteriores", () => {
  it("cada ano tem chave PRÓPRIA — Janeiro/2024 não escreve por cima de Janeiro/2025", () => {
    const k24 = getFinanceStorageKeys("Janeiro", 2024);
    const k25 = getFinanceStorageKeys("Janeiro", 2025);
    expect(k24.expenses).toBe("finance-2024-janeiro-expenses");
    expect(k25.expenses).toBe("finance-2025-janeiro-expenses");
    expect(k24.expenses).not.toBe(k25.expenses);
  });

  it("mês com acento vira chave sem acento — Março não pode gerar duas chaves", () => {
    expect(getFinanceStorageKeys("Março", 2024).fixed).toBe("finance-2024-marco-fixed");
  });

  it("o mês corrente do ano corrente continua no balde vivo, não numa cópia arquivada", () => {
    expect(getFinanceStorageKeys(getCurrentMonthName(), getCurrentYear()).expenses).toBe("finance-expenses");
  });

  it("o MESMO mês num ano passado é arquivo — este era o bug de abrir 2024 e ver 2026", () => {
    const passado = getFinanceStorageKeys(getCurrentMonthName(), 2024);
    expect(passado.expenses).not.toBe("finance-expenses");
    expect(passado.expenses).toMatch(/^finance-2024-[a-z]+-expenses$/);
  });
});

/* ============================================================
 * PF / PJ — pedido por WhatsApp
 * "separar a questão da pf e pj... fazer o controle do pj igual do pf,
 *  isso aqui é da empresa x isso aqui é da empresa y"
 *
 * Estes são os testes mais importantes do arquivo: `mesclarPerfil` é a função
 * que pode APAGAR lançamento de outro perfil em silêncio se estiver errada.
 * ============================================================ */
describe("Perfis PF/PJ nas Finanças", () => {
  const tudo = [
    { id: "1", desc: "Salário", perfil: PERFIL_PESSOAL },
    { id: "2", desc: "NF Acme", perfil: "acme" },
    { id: "3", desc: "Mercado" },              // sem etiqueta = pessoal (legado)
    { id: "4", desc: "NF Beta", perfil: "beta" },
  ];

  it("item sem etiqueta conta como pessoal — a base inteira de hoje continua valendo", () => {
    expect(perfilDe({ id: "3" })).toBe(PERFIL_PESSOAL);
    expect(doPerfil(tudo, PERFIL_PESSOAL).map(i => i.id)).toEqual(["1", "3"]);
    expect(doPerfil(tudo, "acme").map(i => i.id)).toEqual(["2"]);
    expect(doPerfil(tudo, PERFIL_TODOS)).toHaveLength(4);
  });

  it("EDITAR dentro de um perfil não encosta nos lançamentos dos outros", () => {
    const visiveis = [{ id: "2", desc: "NF Acme — corrigida", perfil: "acme" }];
    const fora = mesclarPerfil(tudo, visiveis, "acme");
    expect(fora).toHaveLength(4);
    expect(fora.find(i => i.id === "2")?.desc).toBe("NF Acme — corrigida");
    expect(fora.find(i => i.id === "1")?.desc).toBe("Salário");
    expect(fora.find(i => i.id === "4")?.desc).toBe("NF Beta");
  });

  it("APAGAR dentro de um perfil apaga só ali — e não ressuscita o item", () => {
    const fora = mesclarPerfil(tudo, [], "acme");
    expect(fora.map(i => i.id)).toEqual(["1", "3", "4"]);
  });

  it("item NOVO nasce etiquetado com o perfil ativo", () => {
    const visiveis = [
      { id: "2", desc: "NF Acme", perfil: "acme" },
      { id: "9", desc: "NF nova" },
    ];
    const fora = mesclarPerfil(tudo, visiveis, "acme");
    expect(fora.find(i => i.id === "9")?.perfil).toBe("acme");
    expect(fora).toHaveLength(5);
  });

  it("na visão consolidada a lista passa direto — sem etiquetar nada à força", () => {
    const visiveis = [{ id: "1", desc: "Salário", perfil: PERFIL_PESSOAL }];
    expect(mesclarPerfil(tudo, visiveis, PERFIL_TODOS)).toEqual(visiveis);
  });

  it("um ciclo inteiro no perfil pessoal preserva o PJ — o caso que apagaria dinheiro", () => {
    // Edita, apaga e cria dentro do pessoal, tudo de uma vez.
    const visiveis = [
      { id: "1", desc: "Salário novo", perfil: PERFIL_PESSOAL },
      { id: "7", desc: "Farmácia" },
    ];
    const fora = mesclarPerfil(tudo, visiveis, PERFIL_PESSOAL);
    // "3" (Mercado) foi apagado; "2" e "4" seguem intactos.
    expect(fora.map(i => i.id).sort()).toEqual(["1", "2", "4", "7"]);
    expect(fora.find(i => i.id === "2")?.perfil).toBe("acme");
    expect(fora.find(i => i.id === "4")?.perfil).toBe("beta");
    expect(fora.find(i => i.id === "7")?.perfil).toBe(PERFIL_PESSOAL);
  });

  it("aguenta lista vazia e item sem id sem estourar", () => {
    expect(mesclarPerfil([], [], "acme")).toEqual([]);
    const semId = mesclarPerfil(tudo, [{ desc: "sem id" } as never], "acme");
    expect(semId.find(i => (i as { desc?: string }).desc === "sem id")?.perfil).toBe("acme");
    // e os outros perfis continuam lá
    expect(semId.filter(i => i.id === "1" || i.id === "4")).toHaveLength(2);
  });
});

/* ============================================================
 * 03/09 — reclamação de cliente: "o custo da empresa altera o pessoal"
 * O vazamento era nas CONTAS do mês e nos leitores fora da tela.
 * ============================================================ */
describe("Perfis PF/PJ — contas do mês e leitores fora da tela", () => {
  const dias = [
    { day: 5, color: "slate", bills: [
      { id: "a", name: "Aluguel", paid: false, value: 1500 },                 // pessoal (legado)
      { id: "b", name: "Escritório", paid: false, value: 900, perfil: "acme" },
    ] },
    { day: 20, color: "slate", bills: [
      { id: "c", name: "Contador", paid: true, value: 300, perfil: "acme" },
    ] },
  ];

  it("custo fixo da empresa vira conta ETIQUETADA — e acompanha se o perfil do fixo mudar", () => {
    const fixos = [{ id: "f1", description: "Sala comercial", value: 900, day: 10, perfil: "acme" }, { id: "f2", description: "Luz", value: 200, day: 15 }];
    const out = syncFixedExpensesToBills(fixos, [])!;
    const sala = out.flatMap((d) => d.bills).find((b) => b.fixedId === "f1")!;
    const luz = out.flatMap((d) => d.bills).find((b) => b.fixedId === "f2")!;
    expect(sala.perfil).toBe("acme");
    expect(luz.perfil).toBeUndefined();
    // o fixo passou pra pessoal: a conta perde a etiqueta
    const out2 = syncFixedExpensesToBills([{ ...fixos[0], perfil: undefined }, fixos[1]], out)!;
    expect(out2.flatMap((d) => d.bills).find((b) => b.fixedId === "f1")!.perfil).toBeUndefined();
  });

  it("o calendário do PESSOAL não mostra conta da empresa (e vice-versa)", () => {
    expect(doPerfilDueDays(dias, PERFIL_PESSOAL).flatMap((d) => d.bills).map((b) => b.id)).toEqual(["a"]);
    expect(doPerfilDueDays(dias, "acme").flatMap((d) => d.bills).map((b) => b.id)).toEqual(["b", "c"]);
    expect(doPerfilDueDays(dias, PERFIL_TODOS).flatMap((d) => d.bills)).toHaveLength(3);
  });

  it("um ciclo inteiro no pessoal (paga, apaga, cria) preserva as contas da empresa — o caso que apagaria dinheiro", () => {
    const visivel = doPerfilDueDays(dias, PERFIL_PESSOAL);
    // marca o aluguel como pago e cria uma conta nova no dia 20
    const editado = [
      { ...visivel[0], bills: [{ ...visivel[0].bills[0], paid: true }] },
      { day: 20, color: "slate", bills: [{ id: "n", name: "Internet", paid: false, value: 120 }] },
    ];
    const fora = mesclarPerfilDueDays(dias, editado, PERFIL_PESSOAL);
    const todas = fora.flatMap((d) => d.bills);
    expect(todas.map((b) => b.id).sort()).toEqual(["a", "b", "c", "n"]);
    expect(todas.find((b) => b.id === "a")!.paid).toBe(true);
    expect(todas.find((b) => b.id === "b")!.perfil).toBe("acme");
    expect(todas.find((b) => b.id === "c")!.paid).toBe(true);
    expect(todas.find((b) => b.id === "n")!.perfil).toBe(PERFIL_PESSOAL);
  });

  it("apagar TODAS as contas visíveis de um dia não leva as contas dos outros perfis junto", () => {
    const fora = mesclarPerfilDueDays(dias, [{ day: 5, color: "slate", bills: [] }], PERFIL_PESSOAL);
    expect(fora.find((d) => d.day === 5)!.bills.map((b) => b.id)).toEqual(["b"]);
    expect(fora.find((d) => d.day === 20)!.bills.map((b) => b.id)).toEqual(["c"]);
  });

  it("os totais do mês seguem o perfil ativo gravado — e 'todos' soma tudo", () => {
    const uid = "cliente-pj";
    localStorage.setItem(`u:${uid}:finance-incomes`, JSON.stringify([{ id: "1", value: 5000 }, { id: "2", value: 20000, perfil: "acme" }]));
    localStorage.setItem(`u:${uid}:finance-expenses`, JSON.stringify([{ id: "3", value: 800 }, { id: "4", value: 7000, perfil: "acme" }]));
    localStorage.setItem(`u:${uid}:finance-fixed-expenses`, JSON.stringify([]));
    localStorage.setItem(`u:${uid}:finance-installments`, JSON.stringify([]));
    const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long" });
    const mes = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);
    localStorage.setItem(`u:${uid}:finance-perfil-ativo`, JSON.stringify(PERFIL_PESSOAL));
    expect(perfilAtivoLocal(uid)).toBe(PERFIL_PESSOAL);
    expect(getMonthTotals(mes, uid).receitas).toBe(5000);
    expect(getMonthTotals(mes, uid).custosVariaveis).toBe(800);
    localStorage.setItem(`u:${uid}:finance-perfil-ativo`, JSON.stringify("acme"));
    expect(perfilAtivoLocal(uid)).toBe("acme");
    expect(getMonthTotals(mes, uid).receitas).toBe(20000);
    expect(getMonthTotals(mes, uid, undefined, PERFIL_TODOS).receitas).toBe(25000);
  });

  it("lançamento criado fora da tela (widget/ação rápida) nasce etiquetado quando a empresa está ativa", () => {
    const gasto: { id: string; value: number; perfil?: string } = { id: "x", value: 10 };
    expect(etiquetar(gasto, "acme").perfil).toBe("acme");
    expect(etiquetar(gasto, PERFIL_PESSOAL).perfil).toBeUndefined();
  });
});

import { AnchorCard } from "@/pages/funis/dia14/PaywallDia14";
describe("âncora do paywall pra quem 'não faz ideia' (04/09)", () => {
  it("renderiza a dor em vez de sumir — e some só quando não há resposta", () => {
    const { container, unmount } = render(<AnchorCard gasto="Não faço ideia" preco="97,90" />);
    expect(container.textContent).toMatch(/Pra onde vai/);
    expect(container.textContent).toMatch(/97,90/);
    expect(container.textContent).not.toMatch(/R\$ ?\d.*somem/i); // nenhum número inventado
    unmount();
    const vazio = render(<AnchorCard gasto="" preco="97,90" />);
    expect(vazio.container.textContent).toBe("");
  });
});
