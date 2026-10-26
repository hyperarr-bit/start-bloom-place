import { describe, it, expect } from "vitest";
import { MODULOS } from "@/lib/modulos";
import { ORDEM_POR_USO, modulosPorUso } from "@/components/home-nova/e/ordem-modulos";

describe("Home nova — ordem de fábrica dos módulos pelos mais usados (dono 26/10)", () => {
  it("todos os módulos do catálogo estão na ordem por uso (nenhum some, nenhum id errado)", () => {
    const ids = MODULOS.map((m) => m.id).sort();
    expect([...ORDEM_POR_USO].sort()).toEqual(ids);
  });
  it("os 4 primeiros são Finanças, Rotina, Saúde e Treino; Viagens por último", () => {
    const ordem = modulosPorUso().map((m) => m.id);
    expect(ordem.slice(0, 4)).toEqual(["financas", "rotina", "saude", "treino"]);
    expect(ordem[ordem.length - 1]).toBe("viagens");
    expect(ordem).toHaveLength(MODULOS.length);
  });
  it("módulo novo (fora da lista) entra no fim, sem quebrar", () => {
    const lista = [...MODULOS, { ...MODULOS[0], id: "novo-modulo" }];
    const ordem = modulosPorUso(lista).map((m) => m.id);
    expect(ordem[ordem.length - 1]).toBe("novo-modulo");
  });
  it("não muda a lista original (a Home antiga usa o catálogo como está)", () => {
    const antes = MODULOS.map((m) => m.id).join(",");
    modulosPorUso();
    expect(MODULOS.map((m) => m.id).join(",")).toBe(antes);
  });
});
