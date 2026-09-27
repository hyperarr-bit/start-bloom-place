/**
 * A semana do card SEQUÊNCIA (27/09): os 7 estados dos discos, a semana
 * completa e o "+1 protetor" honesto (só quando o saldo subiu de verdade).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { calcularSequencia, somarDias } from "@/lib/sequencia";
import { protetorGanhoNaSemana, segundaDaSemana, semanaCompleta, semanaDaSequencia } from "@/lib/sequencia-semana";

const SABADO = "2026-09-26";
const DOMINGO = "2026-09-27";
const corrida = (fim: string, n: number, pular: string[] = []) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i))).filter((d) => !pular.includes(d));
const estados = (lista: string[], hoje: string) => {
  const seq = calcularSequencia(lista, hoje);
  return semanaDaSequencia(lista, seq.usados, hoje).map((d) => d.estado);
};

describe("semana da sequência", () => {
  it("começa na segunda-feira", () => {
    expect(segundaDaSemana(SABADO)).toBe("2026-09-21");
    expect(segundaDaSemana(DOMINGO)).toBe("2026-09-21");
    expect(segundaDaSemana("2026-09-21")).toBe("2026-09-21");
  });

  it("feito · gelo (protetor) · hoje em aberto · futuro", () => {
    // 08/09 a 25/09 sem a quarta 23/09: 2 protetores ganhos, 1 gasto na quarta
    const lista = corrida("2026-09-25", 18, ["2026-09-23"]);
    const seq = calcularSequencia(lista, SABADO);
    expect(seq.usados).toEqual(["2026-09-23"]);
    expect(seq.saldo).toBe(1);
    expect(estados(lista, SABADO)).toEqual(["feito", "feito", "gelo", "feito", "feito", "hoje", "futuro"]);
    expect(semanaDaSequencia(lista, seq.usados, SABADO).map((d) => d.rotulo)).toEqual(["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]);
  });

  it("hoje anotado vira feito; dia vazio sem protetor vira 'vazio' (a sequência quebrou ali)", () => {
    expect(estados(["2026-09-25", "2026-09-26"], SABADO)).toEqual(["vazio", "vazio", "vazio", "vazio", "feito", "feito", "futuro"]);
  });

  it("semana completa só com os 7 discos cheios (feito ou gelo) — no domingo, com hoje garantido", () => {
    const lista = corrida("2026-09-27", 20, ["2026-09-23"]);
    const seq = calcularSequencia(lista, DOMINGO);
    const semana = semanaDaSequencia(lista, seq.usados, DOMINGO);
    expect(semana.map((d) => d.estado)).toEqual(["feito", "feito", "gelo", "feito", "feito", "feito", "feito"]);
    expect(semanaCompleta(semana)).toBe(true);
    const semDomingo = calcularSequencia(lista.slice(0, -1), DOMINGO);
    expect(semanaCompleta(semanaDaSequencia(lista.slice(0, -1), semDomingo.usados, DOMINGO))).toBe(false);
  });

  it("'+1 protetor' só quando o saldo subiu em algum dia da semana", () => {
    // corrente chega a 14 na segunda 21/09 → ganhou o 2º protetor nesta semana
    const lista = corrida("2026-09-27", 20, ["2026-09-23"]);
    expect(protetorGanhoNaSemana(lista, DOMINGO)).toBe(true);
    // 3 dias só: nenhum protetor ainda
    expect(protetorGanhoNaSemana(["2026-09-24", "2026-09-25", "2026-09-26"], SABADO)).toBe(false);
    // saldo já no máximo (2) não sobe mais: semana cheia sem "+1"
    const longa = corrida("2026-09-27", 40);
    expect(calcularSequencia(longa, DOMINGO).saldo).toBe(2);
    expect(protetorGanhoNaSemana(longa, DOMINGO)).toBe(false);
  });
});
