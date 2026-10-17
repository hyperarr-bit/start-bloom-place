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
