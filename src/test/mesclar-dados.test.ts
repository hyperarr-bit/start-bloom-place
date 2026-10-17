/**
 * Junção em 3 vias (16/10) — o que foi escrito antes de a conta chegar do servidor
 * entra SEM apagar o que já estava lá. Ver src/lib/mesclar-dados.ts.
 */
import { describe, it, expect } from "vitest";
import { iguais, mesclar3 } from "@/lib/mesclar-dados";

const A = { id: "a", v: 1 };
const B = { id: "b", v: 2 };
const C = { id: "c", v: 3 };

describe("mesclar3", () => {
  it("chave que não existe no servidor: vale o que a tela gravou", () => {
    expect(mesclar3(undefined, [A], undefined)).toEqual({ valor: [A], perdeu: false });
    expect(mesclar3([], [A], null)).toEqual({ valor: [A], perdeu: false });
  });

  it("a tela não mudou nada em relação à base: fica o servidor", () => {
    expect(mesclar3([], [], [A, B])).toEqual({ valor: [A, B], perdeu: false });
    expect(mesclar3(undefined, { favorites: [], hidden: [] }, { favorites: ["financas"], hidden: ["pet"] }))
      .toEqual({ valor: { favorites: ["financas"], hidden: ["pet"] }, perdeu: false });
  });

  it("base vazia (o vazio da tela) + item novo: servidor inteiro + o novo no fim", () => {
    expect(mesclar3([], [C], [A, B])).toEqual({ valor: [A, B, C], perdeu: false });
    expect(mesclar3(undefined, [C], [A, B])).toEqual({ valor: [A, B, C], perdeu: false });
  });

  it("novo posto NA FRENTE do que a tela já tinha: entra na frente", () => {
    expect(mesclar3([A], [C, A], [A, B])).toEqual({ valor: [C, A, B], perdeu: false });
  });

  it("servidor igual à base: a mudança da tela vale inteira (inclusive o que ela tirou)", () => {
    expect(mesclar3([A, B], [B], [A, B])).toEqual({ valor: [B], perdeu: false });
    expect(mesclar3({ x: 1, y: 2 }, { x: 5 }, { y: 2, x: 1 })).toEqual({ valor: { x: 5 }, perdeu: false });
  });

  it("a tela tirou um item que o servidor mudou: o do servidor fica e avisa", () => {
    const B2 = { id: "b", v: 20 };
    expect(mesclar3([A, B], [A], [A, B2, C])).toEqual({ valor: [A, B2, C], perdeu: true });
  });

  it("a tela mudou um item que o servidor não mexeu: vale a mudança da tela", () => {
    const A2 = { id: "a", v: 10 };
    expect(mesclar3([A, B], [A2, B], [A, B, C])).toEqual({ valor: [A2, B, C], perdeu: false });
  });

  it("lista de textos (dias anotados): une sem repetir", () => {
    expect(mesclar3(undefined, ["2026-10-16"], ["2026-10-14", "2026-10-15"]))
      .toEqual({ valor: ["2026-10-14", "2026-10-15", "2026-10-16"], perdeu: false });
    expect(mesclar3(undefined, ["2026-10-15"], ["2026-10-14", "2026-10-15"]))
      .toEqual({ valor: ["2026-10-14", "2026-10-15"], perdeu: false });
  });

  it("objeto por dia: dia novo entra, histórico fica; o mesmo dia com valor diferente fica com o servidor e avisa", () => {
    expect(mesclar3(undefined, { "2026-10-16": 2 }, { "2026-10-15": 8 }))
      .toEqual({ valor: { "2026-10-15": 8, "2026-10-16": 2 }, perdeu: false });
    expect(mesclar3(undefined, { "2026-10-16": 1 }, { "2026-10-15": 8, "2026-10-16": 3 }))
      .toEqual({ valor: { "2026-10-15": 8, "2026-10-16": 3 }, perdeu: true });
  });

  it("objeto aninhado (diário por dia → refeições): junta por dentro", () => {
    const servidor = { "2026-10-16": { meals: { CAFE: [A] }, followed: true }, "2026-10-15": { meals: {} } };
    const local = { "2026-10-16": { meals: { ALMOCO: [B] } } };
    expect(mesclar3(undefined, local, servidor)).toEqual({
      valor: { "2026-10-16": { meals: { CAFE: [A], ALMOCO: [B] }, followed: true }, "2026-10-15": { meals: {} } },
      perdeu: false,
    });
  });

  it("valor simples que os dois mudaram: fica o servidor e avisa", () => {
    expect(mesclar3(undefined, "pf", "pj")).toEqual({ valor: "pj", perdeu: true });
    expect(mesclar3(0, 1, 7)).toEqual({ valor: 7, perdeu: true });
    expect(mesclar3({ count: 0, lastDate: "" }, { count: 1, lastDate: "2026-10-16" }, { count: 57, lastDate: "2026-10-15" }))
      .toEqual({ valor: { count: 57, lastDate: "2026-10-15" }, perdeu: true });
  });

  it("formato trocado (lista × objeto): fica o servidor", () => {
    expect(mesclar3(undefined, [A], { a: 1 })).toEqual({ valor: { a: 1 }, perdeu: true });
  });

  it("padrão da tela como base: não ressuscita o item-padrão que a pessoa apagou no servidor", () => {
    const PADRAO = [{ id: "cozinha", nome: "Cozinha" }, { id: "sala", nome: "Sala" }];
    const servidor = [{ id: "sala", nome: "Sala de estar" }]; // apagou cozinha, renomeou sala
    const local = [...PADRAO, { id: "quarto", nome: "Quarto" }];
    expect(mesclar3(PADRAO, local, servidor)).toEqual({
      valor: [{ id: "sala", nome: "Sala de estar" }, { id: "quarto", nome: "Quarto" }],
      perdeu: false,
    });
  });

  it("id repetido na lista: compara por conteúdo (não funde itens diferentes)", () => {
    const x1 = { id: 1, t: "a" };
    const x2 = { id: 1, t: "b" };
    const r = mesclar3(undefined, [{ id: 2, t: "novo" }], [x1, x2]);
    expect(r.valor).toEqual([x1, x2, { id: 2, t: "novo" }]);
  });

  it("ordem das chaves do jsonb não conta como mudança", () => {
    expect(iguais({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(mesclar3(undefined, { b: 2, a: 1 }, { a: 1, b: 2 })).toEqual({ valor: { a: 1, b: 2 }, perdeu: false });
  });
});

/*
 * Formatos REAIS de chave (revisão 17/10). Lista de objetos SEM id comparada por conteúdo
 * duplicava a vaga: a conta posta no "Dia 5" padrão virava um 2º Dia 5 ao lado do Dia 5 do
 * servidor — e o calendário, que grava por dia, passava a pôr toda conta nova daquele dia 2×.
 */
const DUE_PADRAO = [
  { day: 5, color: "yellow", bills: [] as unknown[] },
  { day: 10, color: "slate", bills: [] as unknown[] },
  { day: 20, color: "indigo", bills: [] as unknown[] },
  { day: 30, color: "emerald", bills: [] as unknown[] },
];

describe("formatos reais: lista sem id com campo de vaga/nome", () => {
  it("finance-dueDays: conta nova no Dia 5 padrão × servidor com contas no Dia 5 → UM Dia 5 com as três", () => {
    const local = DUE_PADRAO.map((d) => (d.day === 5 ? { ...d, bills: [{ id: "n1", name: "Luz", paid: false }] } : d));
    const servidor = [
      { day: 5, color: "yellow", bills: [{ id: "s1", name: "Aluguel", paid: true }, { id: "s2", name: "Internet", paid: false }] },
      { day: 10, color: "slate", bills: [{ id: "s3", name: "Cartão", paid: false }] },
      { day: 20, color: "indigo", bills: [] },
      { day: 30, color: "emerald", bills: [] },
    ];
    const r = mesclar3(DUE_PADRAO, local, servidor);
    const dias = r.valor as { day: number; bills: { id: string }[] }[];
    expect(dias.filter((d) => d.day === 5)).toHaveLength(1);
    expect(dias.find((d) => d.day === 5)!.bills.map((b) => b.id)).toEqual(["s1", "s2", "n1"]);
    expect(dias.find((d) => d.day === 10)!.bills.map((b) => b.id)).toEqual(["s3"]);
    expect(dias.map((d) => d.day)).toEqual([5, 10, 20, 30]);
    expect(r.perdeu).toBe(false);
  });

  it("finance-dueDays: mudar a cor do Dia 10 padrão × servidor só com o Dia 10 (com conta) → um Dia 10, cor nova, conta mantida", () => {
    const local = DUE_PADRAO.map((d) => (d.day === 10 ? { ...d, color: "pink" } : d));
    const servidor = [{ day: 10, color: "slate", bills: [{ id: "s3", name: "Cartão", paid: false }] }];
    expect(mesclar3(DUE_PADRAO, local, servidor)).toEqual({
      valor: [{ day: 10, color: "pink", bills: [{ id: "s3", name: "Cartão", paid: false }] }],
      perdeu: false,
    });
  });

  it("treino (saude-workouts-v2): o plano vazio remontado sem rede não duplica o exercício do servidor", () => {
    const ex = (n: string, done = false) => ({ name: n, sets: "3", reps: "12", carga: "", done, obs: "" });
    const PLANO = { SEGUNDA: { muscles: [], exercises: [] as unknown[] }, "TERÇA": { muscles: [], exercises: [] as unknown[] } };
    const local = { ...PLANO, SEGUNDA: { muscles: ["Peito"], exercises: [ex("Supino")] } };
    const servidor = { SEGUNDA: { muscles: ["Peito"], exercises: [ex("Supino", true), ex("Crucifixo")] }, "TERÇA": { muscles: [], exercises: [] } };
    const r = mesclar3(PLANO, local, servidor);
    const exs = (r.valor as { SEGUNDA: { exercises: { name: string; done: boolean }[] } }).SEGUNDA.exercises;
    expect(exs.map((e) => `${e.name}:${e.done}`)).toEqual(["Supino:true", "Crucifixo:false"]); // o do servidor (feito) fica
    expect(r.perdeu).toBe(true); // o "não feito" da tela perdeu pro servidor — a pessoa é avisada
  });

  it("orçamento por mês e resumo anual (month), histórico dos desafios (weekStart), categoria (label)", () => {
    expect(mesclar3(undefined, [{ month: 9, value: 900 }], [{ month: 9, value: 800, hasNote: true }, { month: 8, value: 700 }]).valor)
      .toEqual([{ month: 9, value: 800, hasNote: true }, { month: 8, value: 700 }]);
    expect(mesclar3(undefined, [{ weekStart: "2026-10-12", key: "x", result: "ok" }], [{ weekStart: "2026-10-05", key: "x", result: "ok" }]).valor)
      .toEqual([{ weekStart: "2026-10-05", key: "x", result: "ok" }, { weekStart: "2026-10-12", key: "x", result: "ok" }]);
    expect(mesclar3(undefined, [{ label: "Pet", value: "pet", palette: 2 }], [{ label: "Pet", value: "pet", palette: 2 }, { label: "Mercado", value: "mercado", palette: 1 }]).valor)
      .toEqual([{ label: "Pet", value: "pet", palette: 2 }, { label: "Mercado", value: "mercado", palette: 1 }]);
  });

  it("histórico com DATA de registro (treino-exercise-history, exames) NÃO funde: dois registros no mesmo dia são dois", () => {
    const servidor = [{ date: "2026-10-16", exercise: "Supino", sets: 3 }];
    const local = [{ date: "2026-10-16", exercise: "Remada", sets: 4 }];
    expect(mesclar3([], local, servidor)).toEqual({ valor: [...servidor, ...local], perdeu: false });
    expect(mesclar3([], [{ date: "2026-10-16", value: 92 }], [{ date: "2026-10-16", value: 95 }]).valor)
      .toEqual([{ date: "2026-10-16", value: 95 }, { date: "2026-10-16", value: 92 }]);
  });

  it("nome repetido numa das listas não serve de identidade: volta pra comparação por conteúdo", () => {
    const servidor = [{ name: "Banana", calories: 90 }, { name: "Banana", calories: 90 }];
    const r = mesclar3([], [{ name: "Banana", calories: 120 }], servidor);
    expect(r).toEqual({ valor: [...servidor, { name: "Banana", calories: 120 }], perdeu: false });
  });

  it("objeto por data com lista dentro (dp-gratitude): o de hoje junta com o do servidor", () => {
    const r = mesclar3(undefined, { "2026-10-17": ["café"] }, { "2026-10-16": ["sol"], "2026-10-17": ["mãe"] });
    expect(r).toEqual({ valor: { "2026-10-16": ["sol"], "2026-10-17": ["mãe", "café"] }, perdeu: false });
  });

  it("seções com id do padrão (casa-cleaning-routine): item novo na seção renomeada no servidor; a seção apagada lá não volta", () => {
    const PADRAO = [{ id: "1", name: "LIMPEZA DIÁRIA", items: [] as unknown[] }, { id: "2", name: "LIMPEZA SEMANAL", items: [] as unknown[] }];
    const local = [{ ...PADRAO[0], items: [{ id: "x", text: "louça" }] }, PADRAO[1]];
    const servidor = [{ id: "1", name: "Diária", items: [{ id: "a", text: "cama" }] }];
    expect(mesclar3(PADRAO, local, servidor)).toEqual({
      valor: [{ id: "1", name: "Diária", items: [{ id: "a", text: "cama" }, { id: "x", text: "louça" }] }],
      perdeu: false,
    });
  });
});

describe("valor simples: vazio no servidor não tem o que proteger", () => {
  it("flag de tutorial concluído ('true') × servidor '' (não marcado): vale a da tela", () => {
    expect(mesclar3(undefined, "true", "")).toEqual({ valor: "true", perdeu: false });
    expect(mesclar3("", "true", "")).toEqual({ valor: "true", perdeu: false });
    expect(mesclar3(undefined, true, false)).toEqual({ valor: true, perdeu: false });
    expect(mesclar3(undefined, { "2026-10-16": 1 }, { "2026-10-16": 0 })).toEqual({ valor: { "2026-10-16": 1 }, perdeu: false });
  });

  it("sem mudança na tela, o vazio do servidor vale (ele foi desmarcado em outro aparelho)", () => {
    expect(mesclar3("true", "true", "")).toEqual({ valor: "", perdeu: false });
  });

  it("valor simples PREENCHIDO dos dois lados e diferente (ex.: last-seen de módulo): fica o do servidor, marcado como perdido", () => {
    // escolha consciente: o mesmo caminho protege contador (sequência 57 × 1 montado do vazio);
    // chave de marcador de tela não gera aviso (o provider só avisa dado da pessoa) e a próxima
    // abertura do módulo regrava o marcador
    expect(mesclar3(undefined, "2026-10-17", "2026-10-15")).toEqual({ valor: "2026-10-15", perdeu: true });
  });
});
