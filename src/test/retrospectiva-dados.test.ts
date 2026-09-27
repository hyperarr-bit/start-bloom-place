/**
 * RETROSPECTIVA DE 01/10 — a camada de dados (26/09).
 *
 * Rodada 1 (correção e privacidade):
 *  1. quem não lança renda via "faltaram R$ 377", "rombo" e "Mês Turbulento";
 *  2. o card compartilhado levava salário e gasto em R$;
 *  3. a água era somada das duas chaves (o mesmo número gravado em dobro);
 *  4. humor só de uma das três portas; chaves pesadas só no store;
 *  6. "% dos dias" sobre o mês inteiro pra quem começou no dia 20;
 *  7. no dia 1º, antes do arquivamento, o mês fechado saía sem Finanças;
 *  9. três dias de dado viravam retrospectiva completa com perfil.
 * Rodada 2 (redesenho aprovado — o planner): as páginas MEU MÊS, CORPO,
 * COMO VOCÊ ESTAVA e o CARD saem daqui prontas.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));

import {
  aguaDoMes, atividadeDoMes, buildWrappedData, conteudoDoCard, construirRetroMes, construirRetroVida, diaMaisForte,
  ehRetroCurta, fatoDaCurta, fatosDaRetroCurta, humorDoMes, lerDadosDaVida, mesSeguinte, nomeDaCapa, nomeDaPessoa, opcoesDeFoco,
  palavraDoHumor, perfilDoMes, primeiroNome, sequenciaDeDias, sugestoesDeFoco, textoDaBase, baseDoMes,
  type Leitor, type RetroVida, type WrappedData,
} from "@/lib/retrospectiva";

const UID = "u-retro-dados";
const leitor = (dados: Record<string, unknown>): Leitor => (chave) => dados[chave];
const ago = (dia: number) => `2026-08-${String(dia).padStart(2, "0")}`;
const jul = (dia: number) => `2026-07-${String(dia).padStart(2, "0")}`;
const set = (dia: number) => `2026-09-${String(dia).padStart(2, "0")}`;
/** 26/09/2026: agosto é o mês que acabou de fechar. */
const HOJE = new Date(2026, 8, 26, 12);
const retroDe = (dados: Record<string, unknown>, mesIdx = 7, agora = HOJE, ano = 2026) =>
  construirRetroMes(ano, mesIdx, UID, undefined, { ler: leitor(dados), agora })!;

beforeEach(() => localStorage.clear());

/* ======================================================================
 * 1. SEM RENDA REGISTRADA: nada de saldo, "faltou", rombo, % guardado
 * ==================================================================== */
describe("1. quem só lança gastos (sem renda) não recebe narrativa de prejuízo", () => {
  const gastos = Array.from({ length: 16 }, (_, i) => ({
    id: `g${i}`, date: ago(2 + i), value: 20 + i, description: "Compra",
    category: i % 2 ? "mercado" : "delivery", paymentMethod: i % 3 ? "pix" : "credito",
  }));
  const retro = () => retroDe({ "finance-2026-agosto-expenses": gastos });

  it("o dinheiro vira fatos neutros: gastos anotados, dias sem gasto (e quais) e pódio em %", () => {
    const r = retro();
    expect(r.curta).toBe(false); // 16 dias com registro, 16 registros
    const f = r.financas!;
    expect(f.temRenda).toBe(false);
    expect(f.ego).toEqual({ kind: "semRenda" });
    expect(f.gastosAnotados).toBe(16);
    // base = dia 2 (1º registro) até 31 = 30 dias; 16 com gasto
    expect(f.diasSemGasto).toBe(14);
    expect(f.diasComGasto).toEqual(Array.from({ length: 16 }, (_, i) => 2 + i));
    expect(f.topCategories.reduce((s, c) => s + c.pct, 0)).toBeCloseTo(100, 5);
  });

  it("perfil positivo e coerente com o que ela fez, nunca 'Mês Turbulento'", () => {
    // 16 dias seguidos anotando gasto é constância (a régua é "dia com a vida anotada")
    expect(retro().perfil).toMatchObject({ name: "Corrente Longa", area: "vida", line: "16 dias seguidos sem quebrar." });
    // gastos espaçados: o perfil é o do dinheiro, dito pelo lado bom
    const espacados = retroDe({ "finance-2026-agosto-expenses": gastos.slice(0, 8).map((g, i) => ({ ...g, date: ago(1 + i * 4) })) });
    expect(espacados.perfil).toMatchObject({ name: "Olho no Dinheiro", area: "dinheiro" });
    expect(espacados.perfil.line).toContain("8 gastos anotados");
  });

  it("o card não fala de saldo — nem com os valores ligados", () => {
    const r = retro();
    const semValores = JSON.stringify(conteudoDoCard(r));
    expect(semValores).not.toMatch(/R\$/);
    expect(semValores).not.toMatch(/sobrou|faltou|guardou|entrou|rombo/i);
    const comValores = conteudoDoCard(r, { valores: true });
    expect(comValores.numeros[0]).toEqual({ valor: "R$ 440", rotulo: "GASTOS" });
    expect(JSON.stringify(comValores)).not.toMatch(/sobrou|faltou|guardou|entrou|rombo/i);
  });

  it("perfil do mês nunca é negativo, em nenhuma combinação", () => {
    const f = (o: Partial<WrappedData>): WrappedData => ({
      month: "Agosto", income: 0, outflow: 500, balance: -500, savingsRate: 0, topCategories: [], biggestExpense: null,
      pixPct: 0, txCount: 3, ego: { kind: "semRenda" }, temRenda: false, gastosAnotados: 3, diasSemGasto: null, diasComGasto: [], ...o,
    });
    const v = (o: Partial<RetroVida>): RetroVida => ({
      diasAtivos: 0, diasPossiveis: 31, primeiroDia: 1, diasDoMes: 31, melhorSequencia: 0, treinos: 0, livros: [], paginas: 0,
      diasDeDiario: 0, humorMedio: null, diasComHumor: 0, melhorDia: null, copos: 0, habitosFeitos: 0, ...o,
    });
    const financas = [
      null,
      f({}),
      f({ gastosAnotados: 0, txCount: 2 }),
      f({ income: 1000, outflow: 1500, balance: -500, savingsRate: -50, temRenda: true, ego: { kind: "reality", deficit: 500, cut: null } }),
      f({ income: 1000, outflow: 950, balance: 50, savingsRate: 5, temRenda: true, ego: { kind: "modest", saved: 50 } }),
    ];
    const vidas = [null, v({ copos: 3 }), v({ diasAtivos: 2, diasPossiveis: 20 }), v({ diasComHumor: 1, humorMedio: 2 }), v({ treinos: 1 })];
    for (const a of financas) for (const b of vidas) {
      if (!a && !b) continue;
      const p = perfilDoMes(a, b);
      expect(p.name).not.toMatch(/Turbulento|Recomeço|Limite/);
      expect(p.line).not.toMatch(/Saiu mais do que entrou|por pouco|curto|poucos|elite/i);
    }
    // quem TEM renda e fechou no vermelho também não vira "Mês Turbulento"
    expect(perfilDoMes(financas[3], null).name).toBe("Olho no Dinheiro");
  });
});

/* ======================================================================
 * 2. O CARD: sem R$ por padrão; com o interruptor, a versão com dinheiro
 * ==================================================================== */
describe("2. o card (o que vai pros Stories)", () => {
  const dadosEngajada = {
    "finance-2026-agosto-incomes": [{ id: "r", date: ago(5), value: 6200 }],
    "finance-2026-agosto-expenses": [{ id: "e", date: ago(8), value: 640, category: "mercado", description: "Mercado" }],
    "finance-2026-agosto-fixed": [{ id: "f", value: 1850, category: "moradia" }],
    "heatmap-log": Object.fromEntries(Array.from({ length: 20 }, (_, i) => [ago(i + 1), true])),
    "saude-workout-log": [ago(2), ago(4), ago(6)],
    "month-retro": { "2026-08": "Agosto foi o mês em que eu parei de adiar as coisas." },
    "journal-entries": { [ago(9)]: { learned: "Aprendi a dizer não pro chefe" } },
    "core-gratitude-log": { [ago(10)]: ["Minha terapeuta, Dra. Luíza"] },
  };

  it("padrão: fita, abertura com o 1º nome, carimbo do perfil, 3 números sem R$ e a tira dos dias", () => {
    const c = conteudoDoCard(retroDe(dadosEngajada), { nome: "ana beatriz da silva" });
    expect(c.fita).toBe("AGOSTO · 2026");
    expect(c.abertura).toBe("O agosto de Ana foi");
    expect(c.carimbo).toBe("Cofre Forte");
    expect(c.area).toBe("dinheiro");
    expect(c.frase).toBe("Fechou agosto no azul.");
    expect(c.numeros).toEqual([
      { valor: "20", rotulo: "DIAS" }, { valor: "3", rotulo: "TREINOS" }, { valor: "1", rotulo: "GASTOS" },
    ]);
    expect(c.tira).toEqual({ total: 31, marcados: Array.from({ length: 20 }, (_, i) => i + 1) });
    expect(JSON.stringify(c)).not.toMatch(/R\$/);
  });

  it("o que a pessoa ESCREVEU (retrospectiva do mês, diário, gratidão) nunca entra no card", () => {
    const r = retroDe(dadosEngajada);
    expect(r.sentir?.frase?.texto).toBe("Agosto foi o mês em que eu parei de adiar as coisas."); // está na página do app…
    for (const valores of [false, true]) {
      const card = JSON.stringify(conteudoDoCard(r, { valores, nome: "Ana" }));
      expect(card).not.toMatch(/adiar|chefe|terapeuta|Luíza/); // …e nunca no card
    }
  });

  it("interruptor ligado: entrou, saiu, sobrou; no vermelho, a terceira casa volta a ser os dias (nada de 'faltou')", () => {
    expect(conteudoDoCard(retroDe(dadosEngajada), { valores: true }).numeros).toEqual([
      { valor: "R$ 6.200", rotulo: "ENTROU" }, { valor: "R$ 2.490", rotulo: "SAIU" }, { valor: "R$ 3.710", rotulo: "SOBROU" },
    ]);
    const noVermelho = retroDe({ ...dadosEngajada, "finance-2026-agosto-incomes": [{ id: "r", date: ago(5), value: 1000 }] });
    const c = conteudoDoCard(noVermelho, { valores: true });
    expect(c.numeros.map((n) => n.rotulo)).toEqual(["ENTROU", "SAIU", "DIAS"]);
    expect(JSON.stringify(c)).not.toMatch(/faltou|rombo|vermelho/i);
  });

  it("sem nome: 'O seu agosto foi'; o nome nunca sai do e-mail", () => {
    expect(conteudoDoCard(retroDe(dadosEngajada)).abertura).toBe("O seu agosto foi");
    expect(nomeDaPessoa(leitor({}), { full_name: "  maria clara " })).toBe("maria clara");
    expect(nomeDaPessoa(leitor({ "user-name": "Bia" }), { full_name: "Beatriz Souza" })).toBe("Bia");
    expect(nomeDaPessoa(leitor({ "core-user-name": "Ana", "user-name": "Bia" }))).toBe("Ana");
    expect(nomeDaPessoa(leitor({}), null)).toBeNull();
    expect(primeiroNome("joão victor")).toBe("João");
    expect(nomeDaCapa("ana beatriz da silva")).toBe("Ana Beatriz");
    expect(nomeDaCapa("João da Silva")).toBe("João");
    expect(nomeDaCapa("Maria Eduardaaaaaaaa Lima")).toBe("Maria");
  });
});

/* ======================================================================
 * 3. ÁGUA: o mesmo número em duas chaves não é o dobro de copos
 * ==================================================================== */
describe("3. água por dia = o MAIOR entre water-log e core-saude-water", () => {
  it("os dois lugares gravam o mesmo valor: conta uma vez", () => {
    const dados = lerDadosDaVida(leitor({
      "water-log": { [ago(1)]: 6, [ago(2)]: 4 },
      "core-saude-water": { [ago(1)]: 6, [ago(2)]: 5, [ago(3)]: 2, "2026-09-01": 8 },
    }));
    const a = aguaDoMes(2026, 7, dados);
    expect(a.copos).toBe(6 + 5 + 2);
    expect(a.dias).toEqual([1, 2, 3]);
    expect(construirRetroVida(2026, 7, dados, { agora: HOJE })!.copos).toBe(13); // antes: 23
  });
});

/* ======================================================================
 * 4. LEITURA: humor das três portas; chaves pesadas pelo store
 * ==================================================================== */
describe("4. humor junta Rotina, Desenvolvimento e Home numa média só", () => {
  it("média por dia (quem marcou em dois lugares não pesa em dobro), notas fora de 1–5 ignoradas", () => {
    const dados = lerDadosDaVida(leitor({
      "mood-log": { [ago(1)]: { mood: 4, note: "" }, [ago(2)]: { mood: 0, note: "só emoções", emocoes: ["Calmo"] } },
      "dp-mood-log": { [ago(1)]: 2, [ago(3)]: 2 },
      "core-mood-log": { [ago(4)]: { value: 5, emoji: "🤩", time: "09:00" }, [ago(5)]: { value: 9 } },
    }));
    const h = humorDoMes(2026, 7, dados);
    expect(h.dias).toEqual([1, 3, 4]);
    // dia 1 = (4 + 2) / 2 = 3; dia 3 = 2; dia 4 = 5
    expect(h.media).toBeCloseTo(10 / 3, 10);
    expect(h.melhorDia).toEqual({ dia: 4, nota: 5 });
  });

  it("humor registrado SÓ pela ação rápida da Home agora aparece (antes: em branco)", () => {
    const v = construirRetroVida(2026, 7, lerDadosDaVida(leitor({ "core-mood-log": { [ago(4)]: { value: 5, emoji: "🤩" } } })), { agora: HOJE });
    expect(v?.humorMedio).toBe(5);
    expect(v?.diasComHumor).toBe(1);
  });

  it("diário e acervo que moram só no store (≥50KB, fora do localStorage) entram pela leitura do store", () => {
    const heatmap = { [ago(1)]: true };
    localStorage.setItem(`u:${UID}:heatmap-log`, JSON.stringify(heatmap)); // o que o aparelho novo tem
    const store = {
      "heatmap-log": heatmap,
      "journal-entries": { [ago(3)]: { gratitude: ["x".repeat(60_000)] }, [ago(4)]: { learned: "algo" } },
      "lib-books": [{ title: "Tudo é Rio", author: "Carla Madeira", status: "lido", pages: 210, endDate: ago(27) }],
    };
    const doAparelho = construirRetroMes(2026, 7, UID, undefined, { agora: HOJE })!;
    expect(doAparelho.vida!.livros).toHaveLength(0);
    expect(doAparelho.vida!.diasDeDiario).toBe(0);
    const doStore = retroDe(store);
    expect(doStore.vida!.livros.map((l) => l.titulo)).toEqual(["Tudo é Rio"]);
    expect(doStore.vida!.diasDeDiario).toBe(2);
  });
});

/* ======================================================================
 * 6. DENOMINADOR: dias desde o 1º registro NO mês
 * ==================================================================== */
describe("6. '% dos dias' conta desde o 1º dia de uso no mês", () => {
  const heat = Object.fromEntries([20, 21, 22, 23, 24, 25, 26, 28, 29, 30].map((d) => [ago(d), true]));

  it("começou no dia 20: base de 12 dias (20→31), não 31", () => {
    const v = construirRetroVida(2026, 7, lerDadosDaVida(leitor({ "heatmap-log": heat })), { agora: HOJE })!;
    expect(v).toMatchObject({ primeiroDia: 20, diasPossiveis: 12, diasDoMes: 31, diasAtivos: 10 });
    expect(Math.round((v.diasAtivos / v.diasPossiveis) * 100)).toBe(83); // antes: 32%
    expect(textoDaBase(v)).toBe("dos 12 dias desde que você começou");
    const p = perfilDoMes(null, v);
    expect(p).toMatchObject({ name: "Constância de Ferro", area: "vida" });
    expect(p.line).toBe("Ativo em 10 dos 12 dias desde que você começou.");
  });

  it("o 1º registro de QUALQUER módulo abre a base (um gasto no dia 15 puxa o começo)", () => {
    const r = retroDe({ "heatmap-log": heat, "finance-2026-agosto-expenses": [{ id: "e", date: ago(15), value: 10 }] });
    expect(r.atividade.primeiroDia).toBe(15);
    expect(r.vida).toMatchObject({ primeiroDia: 15, diasPossiveis: 17 });
    expect(r.base).toMatchObject({ primeiroDia: 15, ultimoDia: 31, dias: 17 });
  });

  it("quem usou desde o dia 1º continua com o mês inteiro; o mês corrente não conta o futuro", () => {
    const cheio = construirRetroVida(2026, 7, lerDadosDaVida(leitor({ "heatmap-log": { [ago(1)]: true, [ago(9)]: true } })), { agora: HOJE })!;
    expect(cheio).toMatchObject({ primeiroDia: 1, diasPossiveis: 31 });
    expect(textoDaBase(cheio)).toBe("dos 31 dias do mês");
    const corrente = construirRetroVida(2026, 8, lerDadosDaVida(leitor({ "heatmap-log": { "2026-09-10": true } })), { agora: HOJE })!;
    expect(corrente).toMatchObject({ primeiroDia: 10, diasPossiveis: 17 }); // 10 → 26/09
  });
});

/* ======================================================================
 * 7. MÊS FRIO NO DIA 1º: setembro antes do arquivamento
 * ==================================================================== */
describe("7. no dia 1º, antes da virada, o mês que fechou lê o balde corrente pelas datas", () => {
  const DIA_1 = new Date(2026, 9, 1, 10, 0); // a notificação das 10h
  const salario = { id: "r1", date: "2026-09-05", value: 5000, description: "Salário" };
  const mercado = { id: "e1", date: "2026-09-10", value: 800, description: "Mercado", category: "mercado" };
  const padaria = { id: "e-out", date: "2026-10-01", value: 12, description: "Padaria" }; // já é de outubro
  const aluguel = { id: String(new Date(2026, 7, 3).getTime()), description: "Aluguel", value: 2000, category: "moradia" };
  const academiaNova = { id: String(new Date(2026, 9, 1, 8).getTime()), description: "Academia", value: 99, category: "academia" }; // criada hoje
  const celular = {
    id: "p1", description: "Celular", totalValue: 1800, installmentValue: 150, paidInstallments: 2, totalInstallments: 12,
    cardName: "nubank", category: "eletronicos", date: "2026-07-10", startMonth: "2026-09", parcelaDoMes: 3,
  };
  const antesDaVirada = {
    "finance-incomes": [salario],
    "finance-expenses": [mercado, padaria],
    "finance-fixed-expenses": [aluguel, academiaNova],
    "finance-installments": [celular],
  };

  it("antes do arquivamento: setembro com salário, mercado, aluguel e a parcela (sem o que é de outubro)", () => {
    const r = retroDe(antesDaVirada, 8, DIA_1);
    expect(r.financas).toMatchObject({ income: 5000, outflow: 800 + 2000 + 150, gastosAnotados: 1 });
  });

  it("depois do arquivamento: os mesmos números, e nada contado em dobro no meio do caminho", () => {
    const depois = {
      "finance-2026-setembro-incomes": [salario],
      "finance-2026-setembro-expenses": [mercado],
      "finance-2026-setembro-fixed": [aluguel],
      "finance-2026-setembro-installments": [{ ...celular, levada: true }],
      "finance-incomes": [],
      "finance-expenses": [padaria],
      "finance-fixed-expenses": [aluguel, academiaNova],
      "finance-installments": [{ ...celular, startMonth: "2026-10", parcelaDoMes: 4, paidInstallments: 3 }],
    };
    expect(retroDe(depois, 8, DIA_1).financas).toMatchObject({ income: 5000, outflow: 2950 });
    // arquivo gravado mas balde ainda cheio (o meio da virada): mescla por id
    const meio = { ...antesDaVirada, "finance-2026-setembro-incomes": [salario], "finance-2026-setembro-expenses": [mercado] };
    expect(retroDe(meio, 8, DIA_1).financas).toMatchObject({ income: 5000, outflow: 2950 });
  });

  it("a API antiga (buildWrappedData lendo o aparelho) também enxerga setembro no dia 1º", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(DIA_1);
    try {
      for (const [k, v] of Object.entries(antesDaVirada)) localStorage.setItem(`u:${UID}:${k}`, JSON.stringify(v));
      expect(buildWrappedData("Setembro", UID, 2026)).toMatchObject({ income: 5000, outflow: 2950 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("mês sem receita nem gasto não 'existe' só pelos fixos (mesma regra da virada)", () => {
    expect(construirRetroMes(2026, 8, UID, undefined, { ler: leitor({ "finance-fixed-expenses": [aluguel] }), agora: DIA_1 })).toBeNull();
  });

  it("o fallback do balde vale pro mês que ACABOU de fechar; agosto (dois meses atrás) não herda os fixos de hoje", () => {
    const r = retroDe({ ...antesDaVirada, "finance-2026-agosto-expenses": [{ id: "a1", date: "2026-08-20", value: 50 }] }, 7, DIA_1);
    expect(r.financas!.outflow).toBe(50);
  });
});

/* ======================================================================
 * 9. POUCO DADO: versão curta, com fatos reais
 * ==================================================================== */
describe("9. pouco dado = retrospectiva curta (sem perfil nem % do mês)", () => {
  it("pessoa nova com 3 dias: curta, com os 2 fatos que ela tem", () => {
    const r = retroDe({
      "finance-2026-agosto-expenses": [
        { id: "n1", date: ago(27), value: 23, category: "delivery" },
        { id: "n2", date: ago(28), value: 64, category: "mercado" },
        { id: "n3", date: ago(29), value: 19, category: "transporte" },
      ],
      "saude-workout-log": [ago(28), ago(29)],
      "heatmap-log": { [ago(28)]: true, [ago(29)]: true },
      "mood-log": { [ago(29)]: { mood: 4 } },
    });
    expect(r.atividade).toMatchObject({ diasComRegistro: 3, primeiroDia: 27, dias: [27, 28, 29] });
    expect(r.curta).toBe(true);
    expect(fatosDaRetroCurta(r)).toEqual([
      { valor: 2, rotulo: "treinos registrados", emoji: "🏋️", tipo: "treinos" },
      { valor: 2, rotulo: "dias de hábito marcados", emoji: "✅", tipo: "habitos" },
    ]);
    // (26/09, temas) a página "1 fato de verdade": o 1º fato, uma linha e o porquê
    expect(fatoDaCurta(r)).toMatchObject({ valor: 2, rotulo: "treinos registrados", tipo: "treinos", dinheiro: false });
    expect(fatoDaCurta(r)!.porque).toMatch(/histórico/);
  });

  it("o corte: menos de 5 dias OU menos de 15 registros", () => {
    expect(ehRetroCurta({ diasComRegistro: 5, registros: 15, modulos: ["financas"], primeiroDia: 1, dias: [] })).toBe(false);
    expect(ehRetroCurta({ diasComRegistro: 4, registros: 40, modulos: ["financas", "treino"], primeiroDia: 1, dias: [] })).toBe(true);
    expect(ehRetroCurta({ diasComRegistro: 12, registros: 14, modulos: ["financas"], primeiroDia: 1, dias: [] })).toBe(true);
  });

  it("registros somam os módulos; fixos e parcelas contam como registro mas não abrem dia; gratidão e sono contam", () => {
    const a = atividadeDoMes(2026, 7, lerDadosDaVida(leitor({
      "rotina-habit-log": { [ago(3)]: ["Ler", "Água"], [ago(4)]: ["Ler"] },
      "heatmap-log": { [ago(3)]: true, [ago(4)]: true },
      "water-log": { [ago(5)]: 3 }, "core-saude-water": { [ago(5)]: 3 },
      "core-gratitude-log": { [ago(8)]: ["Um dia de sol"] },
      "sleep-log": { [ago(9)]: 7 },
    })), { incomes: [], expenses: [{ date: ago(6), value: 1 }], fixed: [{ value: 5 }, { value: 7 }], parcelas: [] });
    expect(a).toEqual({
      diasComRegistro: 6, registros: 3 + 3 + 1 + 1 + 1, modulos: ["financas", "habitos", "agua", "gratidao", "sono"],
      primeiroDia: 3, dias: [3, 4, 5, 6, 8, 9],
    });
  });
});

/* ======================================================================
 * REDESENHO: as páginas do planner
 * ==================================================================== */
describe("MEU MÊS: dias anotados, sequência com datas, dia mais forte, hábito campeão e o post-it do mês anterior", () => {
  const anotados = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 21, 22, 23, 24, 25, 26];
  const dados = {
    "heatmap-log": Object.fromEntries(anotados.map((d) => [set(d), true])),
    "rotina-habit-log": {
      ...Object.fromEntries(anotados.slice(0, 19).map((d) => [set(d), ["Beber 2L de água", ...(d % 2 ? ["Ler 10 páginas"] : [])]])),
      [set(26)]: { "Meditar": true, "0": true },
    },
    // agosto teve 17 dias: setembro é +4
    "saude-workout-log": Array.from({ length: 17 }, (_, i) => ago(i + 1)),
  };
  const r = retroDe(dados, 8, new Date(2026, 9, 1, 10));

  it("21 dias com a vida anotada, a maior sequência de 8 a 16 e o calendário com os ✓", () => {
    expect(r.atividade.dias).toEqual(anotados);
    expect(r.meuMes).toMatchObject({ diasAnotados: 21, sequencia: { dias: 9, de: 8, ate: 16 } });
    expect(sequenciaDeDias([5, 1, 2, 3, 9])).toEqual({ dias: 3, de: 1, ate: 3 });
  });

  it("dia mais forte = a maior proporção (4 de 4 sextas; as terças foram 4 de 5), com o nome do dia pra cor da semana", () => {
    expect(r.meuMes!.diaForte).toEqual({ dia: "SEXTA", nome: "Sexta", plural: "sextas", feitos: 4, total: 4 });
    // um dia só não é "o mais forte"
    expect(diaMaisForte(2026, 8, [1], baseDoMes(2026, 8, 1, new Date(2026, 9, 1)))).toBeNull();
  });

  it("hábito campeão pelo rotina-habit-log (nome, não índice); +4 dias que em agosto", () => {
    expect(r.meuMes!.habitoCampeao).toEqual({ nome: "Beber 2L de água", dias: 19 });
    expect(r.meuMes!.aMaisQueAnterior).toEqual({ mes: "agosto", dias: 4 });
  });

  it("sem mês anterior, ou com o mês anterior maior, não tem post-it (nunca 'menos que')", () => {
    const semAgosto = retroDe({ ...dados, "saude-workout-log": [] }, 8, new Date(2026, 9, 1, 10));
    expect(semAgosto.meuMes!.aMaisQueAnterior).toBeNull();
    const agostoMaior = retroDe({ ...dados, "saude-workout-log": Array.from({ length: 30 }, (_, i) => ago(i + 1)) }, 8, new Date(2026, 9, 1, 10));
    expect(agostoMaior.meuMes!.aMaisQueAnterior).toBeNull();
  });
});

describe("CORPO: grupos pelo mapeamento do Treino, meta semanal, água na meta, sono vs mês anterior e recorde", () => {
  const treinos = [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27, 30];
  const exercicio = (i: number) => ["Agachamento livre", "Supino reto", "Remada curvada", "Esteira"][i % 4];
  const dados = {
    "saude-workout-log": treinos.map(ago),
    "treino-exercise-history": [
      { date: jul(20), exercise: "Supino reto", sets: "4", reps: "8", carga: "50" },
      ...treinos.map((d, i) => ({ date: ago(d), exercise: exercicio(i), sets: "4", reps: "8", carga: exercicio(i) === "Supino reto" ? (i >= 8 ? "55" : "50") : "40", ...(i % 4 === 3 ? { tipo: "cardio" } : {}) })),
    ],
    "treino-meta-semanal": 3,
    "core-saude-water-goal": 8,
    "water-log": { [ago(1)]: 8, [ago(2)]: 5, [ago(3)]: 9 },
    "sleep-log": { [ago(2)]: 7, [ago(3)]: 7.5, [jul(5)]: 6.5, [jul(6)]: 7 },
  };
  const c = retroDe(dados).corpo!;

  it("13 treinos, cada dia carimbado com o grupo que o Treino dá (agachamento = pernas, supino = superiores…)", () => {
    expect(c.treinos).toBe(13);
    expect(c.grupos).toEqual([
      { grupo: "pernas", emoji: "🦵", rotulo: "Pernas", dias: 4 },
      { grupo: "superiores", emoji: "💪", rotulo: "Superiores", dias: 3 },
      { grupo: "costas", emoji: "🚣", rotulo: "Costas", dias: 3 },
      { grupo: "cardio", emoji: "🏃", rotulo: "Cardio", dias: 3 },
    ]);
  });

  it("semanas de agosto que bateram a meta de 3, água na meta de 8 copos, sono 30 min a mais que julho", () => {
    expect(c.meta).toEqual({ porSemana: 3, semanas: 4 });
    expect(c.agua).toEqual({ diasNaMeta: 2, meta: 8, dias: [{ dia: 1, naMeta: true }, { dia: 2, naMeta: false }, { dia: 3, naMeta: true }] });
    expect(c.sono).toEqual({ mediaMin: 435, diferencaMin: 30, mesAnterior: "julho" });
  });

  it("recorde do mês pelo histórico do Treino (supino de 50 → 55 kg)", () => {
    expect(c.recorde).toEqual({ exercicio: "Supino reto", carga: 55, reps: 8 });
  });

  it("sem treino, sem água e sem sono: a página de corpo não existe", () => {
    expect(retroDe({ "heatmap-log": { [ago(1)]: true } }).corpo).toBeNull();
  });
});

describe("COMO VOCÊ ESTAVA: a palavra da maior parte dos dias, as barras e a frase da própria pessoa", () => {
  it("a moda do humor vira a palavra (sem gênero); maioria em 1–2 ganha a frase gentil", () => {
    expect(palavraDoHumor([{ nota: 4 }, { nota: 4 }, { nota: 5 }, { nota: 3 }]).palavra).toBe("bem");
    expect(palavraDoHumor([{ nota: 5 }, { nota: 5 }, { nota: 4 }]).palavra).toBe("muito bem");
    expect(palavraDoHumor([{ nota: 3 }]).palavra).toBe("no meio-termo");
    const pesado = retroDe({ "mood-log": { [ago(1)]: { mood: 2 }, [ago(2)]: { mood: 2 }, [ago(3)]: { mood: 4 } } }).sentir!;
    expect(pesado).toMatchObject({ palavra: "pra baixo", pesado: true });
  });

  it("frase: a retrospectiva escrita do mês ganha; senão o aprendizado; senão a gratidão mais recente", () => {
    const base = {
      "journal-entries": { [ago(9)]: { learned: "Aprendi a dizer não", gratitude: ["Café com a minha mãe"] } },
      "core-gratitude-log": { [ago(21)]: ["Dia de sol na praia"] },
      "dp-gratitude": { [ago(14)]: ["Treino bom", "Treino bom"] },
    };
    expect(retroDe({ ...base, "month-retro": { "2026-08": "Agosto foi leve." } }).sentir!.frase).toEqual({ texto: "Agosto foi leve.", quando: null });
    expect(retroDe(base).sentir!.frase).toEqual({ texto: "Aprendi a dizer não", quando: "9/08" });
    const soGratidao = retroDe({ "core-gratitude-log": base["core-gratitude-log"], "dp-gratitude": base["dp-gratitude"] }).sentir!;
    expect(soGratidao.frase).toEqual({ texto: "Dia de sol na praia", quando: "21/08" });
    // "Treino bom" duas vezes no mesmo dia conta uma
    expect(soGratidao.gratidoes).toBe(2);
  });
});

describe("FOCO: o mês seguinte e as sugestões a partir do que a pessoa já faz", () => {
  it("setembro → outubro; dezembro → janeiro do ano seguinte", () => {
    expect(mesSeguinte({ ano: 2026, mesIdx: 8 })).toEqual({ ano: 2026, mesIdx: 9, nome: "Outubro", id: "2026-10" });
    expect(mesSeguinte({ ano: 2026, mesIdx: 11 })).toEqual({ ano: 2027, mesIdx: 0, nome: "Janeiro", id: "2027-01" });
  });

  it("o hábito campeão e o treino viram sugestão; completa com as de sempre, sem repetir", () => {
    const r = retroDe({
      "rotina-habit-log": { [ago(1)]: ["Beber 2L de água"], [ago(2)]: ["Beber 2L de água"] },
      "saude-workout-log": [ago(3)],
      "treino-meta-semanal": 4,
    });
    expect(sugestoesDeFoco(r)).toEqual(["Beber 2L de água", "Treinar 3x por semana", "Dormir 7 horas", "Ler 10 páginas por dia"]);
    // (26/09, temas) as 3 opções da página, cada uma dizendo de onde veio
    expect(opcoesDeFoco(r)).toEqual([
      { texto: "Beber 2L de água", contexto: "2 dias em agosto" },
      { texto: "Treinar 3x por semana", contexto: "você fez 1 treino em agosto" },
      { texto: "Dormir 7 horas", contexto: "um cuidado por noite" },
    ]);
  });
});

/* ======================================================================
 * TEMAS (26/09): o que os 3 cards escrevem sai daqui, pronto e sem vazar
 * ==================================================================== */
describe("CARD DOS TEMAS: planner, revista e recortes a partir do mesmo conteúdo", () => {
  const dados = {
    "finance-2026-agosto-incomes": [{ id: "r", date: ago(5), value: 6200 }],
    "finance-2026-agosto-expenses": [
      { id: "e1", date: ago(8), value: 640, category: "mercado", description: "Mercado" },
      { id: "e2", date: ago(9), value: 120, category: "delivery", description: "iFood" },
    ],
    "finance-2026-agosto-fixed": [{ id: "f", value: 1850, category: "moradia" }],
    "heatmap-log": Object.fromEntries(Array.from({ length: 20 }, (_, i) => [ago(i + 1), true])),
    "saude-workout-log": [ago(2), ago(4), ago(6)],
    "lib-books": [{ title: "Tudo é Rio", status: "lido", endDate: ago(20), pages: 210 }],
    "month-retro": { "2026-08": "Agosto foi o mês em que eu parei de adiar as coisas." },
    "journal-entries": { [ago(9)]: { learned: "Aprendi a dizer não pro chefe" } },
  };

  it("etiqueta com o nome da capa, o resumo e o perfil em frase; sem R$ por padrão", () => {
    const c = conteudoDoCard(retroDe(dados), { nome: "ana beatriz da silva" });
    expect(c).toMatchObject({
      mes: "Agosto", ano: 2026, mesIdx: 7, nome: "Ana Beatriz", resumo: "20 dias anotados, 20 seguidos",
      diasAnotados: 20, seguidos: 20, primeiroDia: 1, perfil: "Cofre forte", dinheiro: null,
      adesivos: { treinos: 3, livros: 1, sequencia: 20, agua: 0 },
    });
    // a capa da revista: treino, dias sem gastar, o dia mais forte, livros — do que a pessoa fez
    expect(c.linhas).toEqual([
      { valor: "3", rotulo: "treinos" },
      { valor: "29", rotulo: "dias sem gastar nada" },
      { valor: "3/4", rotulo: "terças com a vida anotada" },
      { valor: "1", rotulo: "livro lido" },
    ]);
    expect(JSON.stringify(c)).not.toMatch(/R\$|adiar|chefe/);
  });

  it("com valores: entrou, saiu, sobrou na frente das linhas; no vermelho, sem 'sobrou' nem 'faltou'", () => {
    const c = conteudoDoCard(retroDe(dados), { valores: true });
    expect(c.dinheiro).toEqual([
      { valor: "R$ 6.200", rotulo: "entrou" }, { valor: "R$ 2.610", rotulo: "saiu" }, { valor: "R$ 3.590", rotulo: "sobrou" },
    ]);
    expect(c.linhas.map((l) => l.rotulo)).toEqual(["entrou", "saiu", "sobrou", "treinos"]);
    const vermelho = conteudoDoCard(retroDe({ ...dados, "finance-2026-agosto-incomes": [{ id: "r", date: ago(5), value: 1000 }] }), { valores: true });
    expect(vermelho.dinheiro!.map((d) => d.rotulo)).toEqual(["entrou", "saiu"]);
    expect(JSON.stringify(vermelho)).not.toMatch(/faltou|rombo|vermelho/i);
    // sem renda: só o que saiu
    const semRenda = conteudoDoCard(retroDe({ ...dados, "finance-2026-agosto-incomes": [] }), { valores: true });
    expect(semRenda.dinheiro).toEqual([{ valor: "R$ 2.610", rotulo: "saiu no mês" }]);
  });

  it("sem nome: etiqueta sem nome (a tela escreve 'O seu agosto'); gasto espalhado vira 'Olho no dinheiro'", () => {
    const c = conteudoDoCard(retroDe(dados));
    expect(c.nome).toBeNull();
    const r = retroDe({ "finance-2026-agosto-expenses": Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, date: ago(1 + i * 4), value: 30, category: "mercado" })) });
    expect(conteudoDoCard(r).perfil).toBe("Olho no dinheiro");
  });

  it("1 fato de verdade de quem só lançou gasto: o número, 'em N dias', as categorias da frente e o cadeado", () => {
    const r = retroDe({
      "finance-2026-agosto-expenses": [
        { id: "n1", date: ago(27), value: 23, category: "delivery" },
        { id: "n2", date: ago(28), value: 64, category: "mercado" },
        { id: "n3", date: ago(28), value: 19, category: "mercado" },
      ],
    });
    expect(r.curta).toBe(true);
    expect(fatoDaCurta(r)).toMatchObject({
      valor: 3, rotulo: "gastos anotados em 2 dias", tipo: "gastos", dinheiro: true,
      sub: "Mercado e Delivery na frente. Já dá pra ver pra onde vai.", porque: "Cada um deles é uma decisão que você viu acontecer.",
    });
  });
});
