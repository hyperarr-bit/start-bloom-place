/**
 * INSÍGNIAS v3 (27/09): o catálogo de 53 em 17 áreas com fonte honesta, as
 * contas do mês (cada uma da sua chave), a escolha do herói (orgulho ×
 * faixa × mês, áreas diferentes, nunca água/remédio), dinheiro em % por
 * padrão e R$/peso só com "mostrar valores", o mês que acabou congelado na
 * virada, a moldura do planner (a mesma fechada e aberta) — e os 4 consertos
 * da auditoria no `medirFinancas` dos adesivos.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AREAS, CATALOGO, CHAVE_MOSTRAR_VALORES, TOTAL_INSIGNIAS, candidatasAHeroi, chaveDoMesCongelado, congelarMesAnterior, fmtNum, fraseDe, herois,
  lerMesCongelado, linhaDe, medirInsignias, montarInsignia, montarInsignias, ordenarPagina, pontuar,
} from "@/components/conquistas/insignias";
import { COLUNA_HEROI, geometriaDaPagina, paginasDoResto } from "@/components/conquistas/PaginaInsignias";
import { molduraDoPlanner } from "@/components/conquistas/PlannerAberto";
import { artesDisponiveis } from "@/components/conquistas/SeletorDeArte";
import { deveMostrarDica, lerDica } from "@/components/conquistas/DicaDoPlanner";
import { buildBadgesFinancas, medirFinancas } from "@/components/gamification/badges-financas";
import { somarFocoDoDia } from "@/components/PomodoroTimer";
import { somarDias } from "@/lib/sequencia";
import type { DadosArtes } from "@/components/conquistas/artes-dados";

const HOJE = "2026-09-26";
const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
const dia = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("o catálogo", () => {
  it("53 insígnias em 17 áreas, ids únicos, faixas crescentes, 3 sensíveis, água e remédio nunca herói", () => {
    expect(TOTAL_INSIGNIAS).toBe(53);
    expect(new Set(CATALOGO.map((d) => d.id)).size).toBe(53);
    expect(new Set(CATALOGO.map((d) => d.area)).size).toBe(17);
    expect(Object.keys(AREAS)).toHaveLength(17);
    for (const d of CATALOGO) expect(d.faixas[0] < d.faixas[1] && d.faixas[1] < d.faixas[2]).toBe(true);
    expect(CATALOGO.filter((d) => d.sensivel).map((d) => d.id)).toEqual(["fin-sobrou", "fin-pago", "sau-peso"]);
    expect(CATALOGO.filter((d) => d.nuncaHeroi).map((d) => d.id)).toEqual(["sau-agua", "sau-remedio"]);
    expect(CATALOGO.filter((d) => d.periodo === "mes")).toHaveLength(36);
    expect(CATALOGO.filter((d) => d.periodo === "agora")).toHaveLength(3);
    expect(CATALOGO.filter((d) => d.periodo === "sempre")).toHaveLength(14);
    expect(CATALOGO.filter((d) => d.orgulho >= 4)).toHaveLength(30);
    // a de foco por mês nasceu com o registro por dia (27/09) e diz isso
    expect(CATALOGO.find((d) => d.id === "foc-mes")?.desde).toBe("2026-09-27");
  });

  it("formata como o objeto mostra: 19 · 40% · −12% · −2,1 kg · R$ 1.240 · 24 mil · 12,5 h", () => {
    expect(fmtNum(19, "int")).toBe("19");
    expect(fmtNum(40.4, "pct")).toBe("40%");
    expect(fmtNum(12, "pctneg")).toBe("−12%");
    expect(fmtNum(2.1, "kgneg")).toBe("−2,1 kg");
    expect(fmtNum(1240, "brl")).toBe("R$ 1.240");
    expect(fmtNum(24300, "kgmil")).toBe("24 mil");
    expect(fmtNum(12.4, "horas")).toBe("12,5 h");
    expect(fmtNum(1.83, "meses")).toBe("1,8");
  });

  it("monta a faixa, as estrelas e a próxima: 19 treinos = ouro (3★), 4 = sem faixa a 8 do bronze", () => {
    const tre = CATALOGO.find((d) => d.id === "tre-mes")!;
    const ouro = montarInsignia(tre, { valor: 19 });
    expect(ouro).toMatchObject({ faixa: "ouro", estrelas: 3, proxima: null, temDado: true, texto: "19", unid: "treinos", cor: "#2563eb", forma: "escudo" });
    const nada = montarInsignia(tre, { valor: 4 });
    expect(nada).toMatchObject({ faixa: null, estrelas: 0, proxima: { faixa: "bronze", alvo: 8 } });
    expect(montarInsignia(tre, undefined).valor).toBe(0);
    expect(linhaDe(ouro, 8)).toBe("19 treinos");
    expect(fraseDe(ouro, 8)).toBe("Setembro foi de academia.");
  });
});

describe("as contas do mês (cada número da sua chave)", () => {
  const dados: Record<string, unknown> = {
    "core-dias-anotados": corrida(somarDias(HOJE, -1), 17),
    "saude-workout-log": [...corrida("2026-08-30", 40).filter((_, i) => i % 2 === 0), dia(2), dia(4), dia(6), dia(8), dia(10), dia(12), dia(14), dia(16), dia(18), dia(20), dia(22), dia(24), dia(25)],
    "treino-weekly-volume": { [dia(2)]: 1200, [dia(4)]: 1300, "2026-08-30": 5000 },
    "treino-meta-semanal": 3,
    "dieta-diary-v2": Object.fromEntries(Array.from({ length: 21 }, (_, i) => [dia(i + 1), { meals: { cafe: { followed: true }, almoco: { followed: true } } }])),
    "finance-incomes": [{ id: "r1", description: "Salário", value: 4000, date: dia(5) }],
    "finance-expenses": [
      { id: "g1", value: 500, category: "mercado", date: dia(3) }, { id: "g2", value: 300, category: "delivery", date: dia(4) },
      { id: "g3", value: 200, category: "lazer", date: dia(10) }, { id: "g4", value: 100, category: "mercado", date: dia(12) }, { id: "g5", value: 100, category: "lazer", date: dia(20) },
      { id: "velho", value: 9999, category: "mercado", date: "2026-08-12" },
    ],
    "finance-fixed-expenses": [{ id: "f1", value: 1000 }],
    "finance-installments": [{ id: "p1", installmentValue: 100, paidInstallments: 2, totalInstallments: 10, startMonth: "2026-09", parcelaDoMes: 3 }, { id: "p2", installmentValue: 50, paidInstallments: 4, totalInstallments: 4 }],
    "finance-emergency-fund": { meses: 6, guardado: 4400, registrada: true },
    "finance-dividas-pessoas": [
      { id: "d1", pessoa: "Bia", direcao: "devo", lancamentos: [{ id: "a", data: "2026-07-10", valor: 500 }, { id: "b", data: dia(9), valor: -500 }] },
      { id: "d2", pessoa: "Caio", direcao: "devo", lancamentos: [{ id: "c", data: "2026-08-01", valor: 800 }, { id: "d", data: dia(15), valor: -150 }] },
      { id: "d3", pessoa: "Dé", direcao: "medevem", lancamentos: [{ id: "e", data: dia(1), valor: 300 }] },
    ],
    "water-log": Object.fromEntries(Array.from({ length: 23 }, (_, i) => [dia(i + 1), 8])),
    "core-saude-water-goal": 8,
    "sleep-log": { [dia(1)]: 8, [dia(2)]: 6, [dia(3)]: 9 },
    "core-saude-supplement-log": { [dia(1)]: ["x"], [dia(2)]: [] },
    "core-saude-measures": [{ date: dia(2), peso: "72,4" }, { date: dia(20), weight: 70.3 }],
    "heatmap-log": Object.fromEntries(Array.from({ length: 24 }, (_, i) => [dia(i + 1), true])),
    "rotina-habit-log": Object.fromEntries(Array.from({ length: 22 }, (_, i) => [dia(i + 1), i % 2 ? ["Meditar", "Ler"] : ["Meditar"]])),
    "ritual-morning-checked": { [dia(1)]: ["a"], [dia(2)]: [] },
    "journal-entries": { [dia(1)]: { gratitude: ["x"] }, [dia(2)]: { learned: "y" }, [dia(3)]: { gratitude: [] } },
    "pomodoro-total-focus": 660,
    "pomodoro-log": { [dia(20)]: 60, [dia(21)]: 90, "2026-08-30": 300 },
    "estudos-sessoes": [{ id: "s1", data: dia(3), cursoId: "c", cursoNome: "c", recall: { feitos: 5, acertos: 3 }, pomodoros: 1 }, { id: "s2", data: "2026-08-30", cursoId: "c", cursoNome: "c", recall: { feitos: 5, acertos: 3 }, pomodoros: 1 }],
    "estudos-aprendizados": { c: [{ id: "a1", data: dia(3), aprendi: "x" }, { id: "a2", data: dia(4), aprendi: "y" }] },
    "estudos-revisoes": { a1: { proxima: dia(30), degrau: 1, vezes: 3 }, a2: { proxima: dia(30), degrau: 0, vezes: 2 } },
    "lib-books": [{ id: "l1", status: "lido", pages: 320, endDate: dia(8) }, { id: "l2", status: "lido", pages: 200, endDate: dia(20) }, { id: "l3", status: "lido", pages: 100, endDate: "2026-03-01" }, { id: "l4", status: "lendo" }],
    "lib-read-log": [dia(1), dia(2), dia(2), "2026-08-30"],
    "lib-year-goal": 20,
    "month-goals": { "2026-09": [{ id: "m1", text: "a", done: true }, { id: "m2", text: "b", done: true }, { id: "m3", text: "c", done: false }] },
    "goals-timeline": { "1a": { items: [{ done: true }, { done: false }] } },
    "detox-habits": [{ id: "d1", name: "Instagram", icon: "x", startDate: "2026-09-10", relapses: [dia(12)], record: 0 }],
    "casa-utilities": [{ id: "u1", month: "2026-08", type: "luz", cost: 200, consumption: 200, unit: "kWh" }, { id: "u2", month: "2026-09", type: "luz", cost: 170, consumption: 170, unit: "kWh" }],
    "casa-maint-tasks": [{ id: "t1", task: "filtro", frequencyMonths: 3, lastDone: dia(5), icon: "x" }],
    "skincare-morning-checked": { [dia(1)]: [0], [dia(2)]: [] },
    "skincare-night-checked": { [dia(2)]: [1], [dia(3)]: [0] },
    "pet-list": [{ id: "p1", name: "Thor" }],
    [`pet-routine-${dia(2)}`]: { p1: { walk: true, food: true } },
    [`pet-routine-${dia(3)}`]: { p1: { walk: false } },
    "pet-diary": [{ id: "e1", petName: "Thor", date: "2026-09-05T15:00:00.000Z", text: "x", mood: "feliz" }],
    "travel-outings": [{ id: "o1", name: "Cinema", date: dia(6), type: "cinema", cost: 0, notes: "", photoUrl: "" }],
    "travel-bucket": [{ id: "b1", name: "Tóquio", country: "Japão", visited: true }, { id: "b2", name: "Kyoto", country: " japão", visited: true }, { id: "b3", name: "Lima", country: "Peru", visited: false }],
    "travel-trips-v2": { trips: [{ id: "v1", destination: "Rio", startDate: "2026-07-01", endDate: "2026-07-05", categories: {} }, { id: "v2", destination: "Bahia", startDate: "2026-12-01", endDate: "2026-12-10", categories: {} }], ativoId: "", migrouDoObjetoUnico: true },
    "rel-moments": [{ id: "1", date: dia(7), person: "Mãe", description: "x" }],
    "career-jobs": [{ id: "j1", company: "A", role: "r", status: "oferta", date: dia(2) }, { id: "j2", company: "B", role: "r", status: "aplicado", date: "2026-08-20" }],
  };

  it("mede as 53 com os números de verdade", () => {
    const m = medirInsignias(leitor(dados), HOJE);
    expect(m["seq-viva"].valor).toBe(17);
    expect(m["seq-mes"].valor).toBe(17);
    expect(m["seq-recorde"].valor).toBe(17);
    // finanças: 4.000 − (1.200 variáveis do mês + 1.000 fixos + 100 da parcela do mês) = 1.700 → 42,5%; o gasto de agosto no balde fica de fora
    expect(m["fin-guardei"].valor).toBeCloseTo(42.5, 1);
    expect(m["fin-sobrou"].valor).toBe(1700);
    // dias da base (do 1º registro de QUALQUER módulo — a rotina do dia 1 — até o 26) sem gasto anotado: 26 dias − 5 com gasto
    expect(m["fin-sem-gastar"].valor).toBe(21);
    // semanas cheias do mês (1–7, 8–14, 15–21): a 1ª tem delivery no dia 4
    expect(m["fin-delivery"].valor).toBe(2);
    expect(m["fin-reserva"].valor).toBeCloseTo(4400 / 2300, 2);
    // Bia quitada (500 − 500); Caio ainda deve; o parcelamento p2 100% pago
    expect(m["fin-dividas"].valor).toBe(2);
    expect(m["fin-pago"].valor).toBe(650);
    expect(m["tre-mes"].valor).toBe(13);
    expect(m["tre-volume"].valor).toBe(2500);
    expect(m["tre-total"].valor).toBe(33);
    expect(m["die-impecaveis"].valor).toBe(21);
    expect(m["die-refeicoes"].valor).toBe(42);
    expect(m["die-seguidos"].valor).toBe(21);
    expect(m["sau-agua"].valor).toBe(23);
    expect(m["sau-sono"].valor).toBe(2);
    expect(m["sau-remedio"].valor).toBe(1);
    expect(m["sau-peso"].valor).toBeCloseTo(2.1, 5);
    expect(m["rot-dias"].valor).toBe(24);
    expect(m["rot-campeao"]).toMatchObject({ valor: 22, sub: "Meditar" });
    expect(m["rot-recorde"].valor).toBe(24);
    expect(m["rot-ritual"].valor).toBe(1);
    expect(m["rot-diario"].valor).toBe(2);
    expect(m["foc-total"].valor).toBe(11);
    expect(m["foc-mes"].valor).toBe(2.5);
    expect(m["est-sessoes"].valor).toBe(1);
    expect(m["est-aprendizados"].valor).toBe(2);
    expect(m["est-revisoes"].valor).toBe(5);
    expect(m["lei-livros"].valor).toBe(2);
    expect(m["lei-paginas"].valor).toBe(520);
    expect(m["lei-dias"].valor).toBe(2);
    expect(m["lei-ano"]).toMatchObject({ valor: 3, faixas: [3, 20, 25] });
    expect(m["met-mes"]).toMatchObject({ valor: 2, sub: "de 3" });
    expect(m["met-feitas"].valor).toBe(1);
    // detox: do dia 10 ao 26 são 17 dias, 1 recaída → 16 limpos; sem recaída desde o dia 12 → 14
    expect(m["det-limpos"]).toMatchObject({ valor: 16, sub: "sem Instagram" });
    expect(m["det-sequencia"]).toMatchObject({ valor: 14, sub: "sem Instagram" });
    expect(m["cas-luz"].valor).toBe(15);
    expect(m["cas-manutencoes"].valor).toBe(1);
    expect(m["bel-skincare"].valor).toBe(3);
    expect(m["pet-passeios"]).toMatchObject({ valor: 1, sub: "com Thor" });
    expect(m["pet-diario"].valor).toBe(1);
    expect(m["via-passeios"].valor).toBe(1);
    expect(m["via-paises"].valor).toBe(1);
    expect(m["via-viagens"].valor).toBe(1);
    expect(m["rel-momentos"].valor).toBe(1);
    expect(m["car-candidaturas"].valor).toBe(1);
    expect(m["car-ofertas"].valor).toBe(1);
    expect(Object.keys(m)).toHaveLength(53);
  });

  it("sem nada gravado: tudo zero, ninguém quebra", () => {
    const lista = montarInsignias(leitor({}), HOJE);
    expect(lista).toHaveLength(53);
    expect(lista.every((i) => i.valor === 0 && i.faixa === null)).toBe(true);
    const p = ordenarPagina(lista);
    expect(p.heroi).toBeNull();
    expect(p.resto).toHaveLength(50);
    expect(p.escondidas).toBe(3);
  });

  it("a poupança só conta com o mês medido (receita, ≥ 5 gastos, saída > 0); outro perfil não entra", () => {
    const so = { "finance-incomes": [{ id: "r", description: "Salário", value: 1000, date: dia(5) }], "finance-expenses": [{ id: "g", value: 100, date: dia(6) }] };
    expect(medirInsignias(leitor(so), HOJE)["fin-guardei"].valor).toBe(0);
    const pj = { ...dados, "finance-incomes": [...(dados["finance-incomes"] as unknown[]), { id: "r2", description: "Cliente", value: 50000, date: dia(5), perfil: "pj-1" }] };
    expect(medirInsignias(leitor(pj), HOJE)["fin-guardei"].valor).toBeCloseTo(42.5, 1);
  });
});

describe("quem é o herói", () => {
  const monta = (id: string, valor: number, extra: Partial<Parameters<typeof montarInsignia>[1] & object> = {}) => montarInsignia(CATALOGO.find((d) => d.id === id)!, { valor, ...extra });

  it("orgulho × (estrelas + 1) × 1,25 no mês + a fração até a próxima; água, remédio e sensível (sem 'mostrar valores') pontuam zero", () => {
    const tre = monta("tre-mes", 19); // orgulho 5, ouro → 5 × 4 × 1,25 + 1
    expect(pontuar(tre)).toBeCloseTo(26, 5);
    const guardei = monta("fin-guardei", 40); // orgulho 5, prata (25) → 5 × 3 × 1,25 + 40/45
    expect(pontuar(guardei)).toBeCloseTo(18.75 + 40 / 45, 5);
    expect(pontuar(monta("sau-agua", 28))).toBe(0);
    expect(pontuar(monta("sau-remedio", 28))).toBe(0);
    expect(pontuar(monta("fin-sobrou", 3000))).toBe(0);
    expect(pontuar(monta("fin-sobrou", 3000), true)).toBeGreaterThan(0);
    expect(pontuar(monta("tre-mes", 4))).toBe(0); // sem faixa
    expect(pontuar(monta("seq-mes", 28))).toBe(0); // orgulho 3
  });

  it("as 3 melhores são de ÁREAS diferentes; o herói da página é a 1ª; a demo dá Treinos > Dias impecáveis > Guardei 40%", () => {
    const lista = [monta("tre-mes", 19), monta("tre-recordes", 3), monta("die-impecaveis", 21), monta("fin-guardei", 40), monta("sau-agua", 28), monta("lei-livros", 1)];
    expect(herois(lista, 3).map((i) => i.id)).toEqual(["tre-mes", "die-impecaveis", "fin-guardei"]);
    // 26 · 26 (empate: ordem do catálogo) · 19,6 (prata + 40/45) · 19,25 (prata + 3/6) · 13
    expect(candidatasAHeroi(lista).map((i) => i.id)).toEqual(["tre-mes", "die-impecaveis", "fin-guardei", "tre-recordes", "lei-livros"]);
    const p = ordenarPagina(lista);
    expect(p.heroi?.id).toBe("tre-mes");
    expect(p.heroiConquistado).toBe(true);
    expect(p.resto[0].id).toBe("die-impecaveis");
    expect(p.conquistadas).toBe(6);
    expect(p.deOuro).toBe(3);
  });

  it("pouco dado: sem nenhuma faixa, o herói é a com dado mais perto do bronze (e não conta como conquistado)", () => {
    const lista = [monta("seq-viva", 4), monta("sau-agua", 5), monta("tre-mes", 2), monta("rot-dias", 4)];
    const p = ordenarPagina(lista);
    expect(p.heroi?.id).toBe("seq-viva"); // 4/7 > 5/10 = 4/10 > 2/8
    expect(p.heroiConquistado).toBe(false);
    // o resto com dado vai por orgulho (5 · 3 · 2)
    expect(p.resto.map((i) => i.id)).toEqual(["tre-mes", "rot-dias", "sau-agua"]);
  });

  it("dinheiro em % por padrão: R$ e peso ficam fora das páginas (3 escondidas) e entram com 'mostrar valores'", () => {
    const lista = [monta("fin-guardei", 40), monta("fin-sobrou", 1240), monta("fin-pago", 650), monta("sau-peso", 4.5)];
    const desligado = ordenarPagina(lista);
    expect(desligado.heroi?.id).toBe("fin-guardei");
    expect(desligado.visiveis.map((i) => i.id)).toEqual(["fin-guardei"]);
    expect(desligado.escondidas).toBe(3);
    const ligado = ordenarPagina(lista, { valoresLigados: true });
    expect(ligado.escondidas).toBe(0);
    expect(ligado.visiveis).toHaveLength(4);
    // com valores ligados o peso (orgulho 5, ouro) vira o herói
    expect(ligado.heroi?.id).toBe("sau-peso");
    expect(linhaDe(monta("fin-guardei", 40), 8)).toBe("Guardei 40% do que ganhei");
    expect(linhaDe(monta("fin-sobrou", 1240), 8)).toBe("Sobraram R$ 1.240");
    expect(linhaDe(monta("sau-peso", 2.1), 8)).toBe("−2,1 kg no mês");
    expect(CHAVE_MOSTRAR_VALORES).toBe("conquistas-mostrar-valores");
  });
});

describe("a moldura do planner e a página", () => {
  it("a moldura é a mesma fechada e aberta: 358 × 270 no iPhone de 390, 328 × 247 no Android de 360", () => {
    expect(molduraDoPlanner(390 - 32)).toMatchObject({ w: 358, h: 269.85 });
    expect(molduraDoPlanner(360 - 32)).toMatchObject({ w: 328, h: 247.24 });
    expect(molduraDoPlanner(1000)).toMatchObject({ w: 398, h: 300 });
  });

  it("tudo cabe na moldura: cabeçalho + corpo + bolinhas + rodapé ≤ altura; pins ≥ 44 px nos dois tamanhos; 8 por página", () => {
    for (const [w, h] of [[358, 269.85], [328, 247.24], [398, 300]] as const) {
      const g = geometriaDaPagina(w, h);
      expect(g.cab + 5 + g.corpo + 4 + g.dots + 3 + g.rodape).toBeLessThanOrEqual(g.H + 0.01);
      expect(g.pinGrade).toBeGreaterThanOrEqual(44);
      expect(g.pinDireita).toBeGreaterThanOrEqual(44);
      expect(g.heroiPin).toBeGreaterThanOrEqual(90);
      // a coluna do herói cabe no corpo SEM o flex espremer nada (o acento de "MÊS" sumia no Android)
      expect(g.heroiPin + Object.values(COLUNA_HEROI).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(g.corpo);
      expect(g.heroiCol + 8 + g.gradeDir).toBeLessThanOrEqual(g.W);
      expect(g.porPagina).toBe(8);
    }
    expect(geometriaDaPagina(358, 269.85)).toMatchObject({ pinGrade: 66, pinDireita: 66, heroiPin: 117 });
    expect(geometriaDaPagina(328, 247.24)).toMatchObject({ pinGrade: 55, pinDireita: 55, heroiPin: 95 });
  });

  it("50 visíveis: com herói, 4 na 1ª página e depois páginas de 8; sem herói, 8 desde a 1ª", () => {
    const lista = montarInsignias(leitor({}), HOJE);
    const p = ordenarPagina(lista);
    expect(paginasDoResto(p.resto, true).map((x) => x.length)).toEqual([4, 8, 8, 8, 8, 8, 6]);
    expect(paginasDoResto(p.resto, false).map((x) => x.length)).toEqual([8, 8, 8, 8, 8, 8, 2]);
    const comHeroi = paginasDoResto(p.resto.slice(0, 49), true);
    expect(comHeroi[0]).toHaveLength(4);
    expect(comHeroi.reduce((s, x) => s + x.length, 0)).toBe(49);
  });
});

describe("o seletor de artes", () => {
  const dados = (extra: Partial<DadosArtes>): DadosArtes => ({
    nome: "Ana", membroDesde: "julho de 2026", dias: 12, nivel: "Ouro", xp: 1200, adesivos: 15, total: 65, ano: 2026, mesIdx: 8, mes: "SETEMBRO · 2026",
    maisRaros: [], proximos: [], figurinhas: [], porRaridade: { comum: { abertos: 0, total: 23 }, raro: { abertos: 0, total: 21 }, epico: { abertos: 0, total: 14 }, lendario: { abertos: 0, total: 7 } },
    heroi: null, tres: [], candidatas: [], valoresLigados: false, ...extra,
  });
  const ins = (id: string, valor: number) => montarInsignia(CATALOGO.find((d) => d.id === id)!, { valor });

  it("3 artes (conquista, 3 conquistas só com 3 candidatas, álbum) — sem Capa nem Carteirinha; a Roseta só no dia de um marco", () => {
    const tres = [ins("tre-mes", 19), ins("die-impecaveis", 21), ins("fin-guardei", 40)];
    expect(artesDisponiveis(dados({ heroi: tres[0], tres, candidatas: tres })).map((a) => a.id)).toEqual(["conquista", "tres", "album"]);
    expect(artesDisponiveis(dados({ heroi: tres[0], tres: tres.slice(0, 2) })).map((a) => a.id)).toEqual(["conquista", "album"]);
    const semHeroi = artesDisponiveis(dados({}));
    expect(semHeroi.map((a) => a.id)).toEqual(["conquista", "album"]);
    expect(semHeroi[0].bloqueio).toMatch(/1ª insígnia/);
    expect(artesDisponiveis(dados({ dias: 30 })).map((a) => a.id)).toContain("roseta");
    expect(artesDisponiveis(dados({ dias: 31 })).map((a) => a.id)).not.toContain("roseta");
  });
});

describe("congelar o mês que acabou", () => {
  it("na virada grava `conquistas-insignias-AAAA-MM` com os valores de agosto (do arquivo), uma vez só; sem dado nenhum não grava", () => {
    const store: Record<string, unknown> = {
      "finance-2026-agosto-incomes": [{ id: "r", description: "Salário", value: 3000, date: "2026-08-05" }],
      "finance-2026-agosto-expenses": [1, 2, 3, 4, 5].map((i) => ({ id: `g${i}`, value: 200, date: `2026-08-1${i}` })),
      "saude-workout-log": ["2026-08-02", "2026-08-04", "2026-08-06", dia(1)],
    };
    const get = leitor(store);
    const set = (k: string, v: unknown) => { store[k] = v; };
    const r = congelarMesAnterior(get, set, HOJE);
    expect(r?.mes).toBe("2026-08");
    expect(r?.valores["tre-mes"]).toBe(3);
    expect(r?.valores["fin-guardei"]).toBeCloseTo(66.67, 1);
    expect(store[chaveDoMesCongelado("2026-08")]).toMatchObject({ mes: "2026-08", congeladoEm: HOJE });
    expect(lerMesCongelado(get, "2026-08")?.valores["tre-mes"]).toBe(3);
    // a 2ª abertura não regrava
    expect(congelarMesAnterior(get, set, HOJE)).toBeNull();
    // sem dado: nada
    const vazio: Record<string, unknown> = {};
    expect(congelarMesAnterior(leitor(vazio), (k, v) => { vazio[k] = v; }, HOJE)).toBeNull();
    expect(Object.keys(vazio)).toHaveLength(0);
  });
});

describe("a dica do planner (3 primeiras visitas)", () => {
  it("mostra nas visitas 1–3, não na 4ª; 'fim' encerra pra sempre; dado torto vira zero", () => {
    expect(deveMostrarDica(undefined)).toBe(true);
    expect(deveMostrarDica({ vistas: 2, fim: false })).toBe(true);
    expect(deveMostrarDica({ vistas: 3, fim: false })).toBe(false);
    expect(deveMostrarDica({ vistas: 0, fim: true })).toBe(false);
    expect(lerDica("lixo")).toEqual({ vistas: 0, fim: false });
    expect(lerDica({ vistas: -2, fim: "sim" })).toEqual({ vistas: 0, fim: false });
  });
});

describe("os 4 consertos da auditoria no medirFinancas (adesivos)", () => {
  const badge = (dados: Record<string, unknown>, id: string) => buildBadgesFinancas(leitor(dados)).find((b) => b.id === id)!;

  it("1. Múltiplas Rendas conta FONTES (descrições distintas), não lançamentos", () => {
    const tres = { "finance-incomes": [{ id: 1, description: "Salário", value: 3000, date: dia(5) }, { id: 2, description: "salário ", value: 3000, date: dia(20) }, { id: 3, description: "Salário", value: 100, date: dia(21) }] };
    expect(medirFinancas(leitor(tres)).uniqueIncomes).toBe(1);
    expect(badge(tres, "multi-income").unlocked).toBe(false);
    const fontes = { "finance-incomes": [{ id: 1, description: "Salário", value: 3000, date: dia(5) }, { id: 2, description: "Freela", value: 800, date: dia(9) }], "finance-2026-agosto-incomes": [{ id: 9, description: "Aluguel recebido", value: 1200, date: "2026-08-10" }] };
    expect(medirFinancas(leitor(fontes)).uniqueIncomes).toBe(3);
    expect(badge(fontes, "multi-income").unlocked).toBe(true);
  });

  it("2. Comprador Consciente abre com o valor inteiro de um desejo juntado (ninguém grava `acquired`)", () => {
    expect(badge({ "finance-wishlist": [{ id: "w", name: "Fone", price: 500, savedAmount: 200 }] }, "conscious-buyer").unlocked).toBe(false);
    expect(badge({ "finance-wishlist": [{ id: "w", name: "Fone", price: 500, savedAmount: 500 }] }, "conscious-buyer").unlocked).toBe(true);
    expect(badge({ "finance-wishlist": [{ id: "w", name: "Fone", price: 0, savedAmount: 0 }] }, "conscious-buyer").unlocked).toBe(false);
    expect(badge({ "finance-wishlist": [{ id: "w", name: "Fone", price: 500, savedAmount: 0, acquired: true }] }, "conscious-buyer").unlocked).toBe(true);
  });

  it("3. a taxa de poupança inclui as PARCELAS do mês (como o Painel)", () => {
    const base = {
      "finance-incomes": [{ id: 1, description: "Salário", value: 1000, date: dia(5) }],
      "finance-expenses": [1, 2, 3, 4, 5].map((i) => ({ id: i, value: 100, date: dia(i) })),
    };
    expect(medirFinancas(leitor(base)).savingsRate).toBeCloseTo(50, 5);
    const comParcela = { ...base, "finance-installments": [{ id: "p", installmentValue: 300, paidInstallments: 0, totalInstallments: 3, startMonth: "2026-09", parcelaDoMes: 1 }] };
    const m = medirFinancas(leitor(comParcela));
    expect(m.saidaDoMes).toBe(800);
    expect(m.savingsRate).toBeCloseTo(20, 5);
    expect(badge(comParcela, "saver-20").unlocked).toBe(true);
    expect(badge(comParcela, "saver-40").unlocked).toBe(false);
    expect(badge(base, "saver-40").unlocked).toBe(true);
  });

  it("4. dinheiro do PERFIL ativo e do MÊS: a renda da empresa e o gasto de agosto ficam de fora; as contagens continuam somando tudo", () => {
    const dados = {
      "finance-incomes": [{ id: 1, description: "Salário", value: 1000, date: dia(5) }, { id: 2, description: "Cliente", value: 5000, date: dia(6), perfil: "pj-1" }],
      "finance-expenses": [
        ...[1, 2, 3, 4, 5].map((i) => ({ id: i, value: 100, category: "mercado", date: dia(i) })),
        { id: "velho", value: 900, category: "mercado", date: "2026-08-10" },
        { id: "pj", value: 4000, category: "mercado", date: dia(7), perfil: "pj-1" },
      ],
    };
    const m = medirFinancas(leitor(dados));
    expect(m.perfil).toBe("pessoal");
    expect(m.totalIncome).toBe(1000);
    expect(m.saidaDoMes).toBe(500);
    expect(m.savingsRate).toBeCloseTo(50, 5);
    // contagens: 2 receitas, 7 despesas (todas categorizadas)
    expect(badge(dados, "first-income").progresso).toEqual({ atual: 1, alvo: 1 });
    expect(medirFinancas(leitor(dados)).categorizedExpenses).toBe(7);
    // com a empresa ativa, a conta é da empresa
    const pj = { ...dados, "finance-perfil-ativo": "pj-1" };
    expect(medirFinancas(leitor(pj)).totalIncome).toBe(5000);
    expect(medirFinancas(leitor(pj)).mesAnotado).toBe(false); // 1 gasto só
  });
});

describe("o foco por dia (PomodoroTimer)", () => {
  it("soma os minutos do dia, ignora lixo e guarda só os últimos 400 dias", () => {
    expect(somarFocoDoDia(undefined, dia(1), 25)).toEqual({ [dia(1)]: 25 });
    expect(somarFocoDoDia({ [dia(1)]: 25, lixo: 5, [dia(2)]: "x" }, dia(1), 50)).toEqual({ [dia(1)]: 75 });
    const velho: Record<string, number> = {};
    for (let i = 0; i < 405; i++) velho[somarDias("2025-01-01", i)] = 10;
    const out = somarFocoDoDia(velho, HOJE, 25);
    expect(Object.keys(out)).toHaveLength(400);
    expect(out[HOJE]).toBe(25);
    expect(out["2025-01-01"]).toBeUndefined();
  });
});
