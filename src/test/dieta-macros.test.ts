import { describe, expect, it } from "vitest";
import {
  comoMacros, entradaDoPlano, formatarMacros, idDoPlano, kcalDasMacros, lerGramas,
  macrosDoPlano, macrosRegistradas, sincronizarLogDoDiario, temMacros,
} from "@/lib/dieta-macros";

/* MACROS NA DIETA (18/09) — pedido do dono: o widget "Macros do Dia" da Home
 * existia e ficava em branco porque ninguém escrevia protein/carbs/fat. */
describe("dieta: macros por refeição", () => {
  it("lê gramas com vírgula, unidade e lixo", () => {
    expect(lerGramas("32")).toBe(32);
    expect(lerGramas("32,6 g")).toBe(33);
    expect(lerGramas("")).toBe(0);
    expect(lerGramas("abc")).toBe(0);
    expect(lerGramas(-4)).toBe(0);
    expect(lerGramas(undefined)).toBe(0);
  });

  it("normaliza o que vier do storage", () => {
    expect(comoMacros({ p: "30" as unknown as number, c: undefined, g: 12.4 })).toEqual({ p: 30, c: 0, g: 12 });
    expect(temMacros({ p: 0, c: 0, g: 0 })).toBe(false);
    expect(temMacros({ p: 0, c: 5, g: 0 })).toBe(true);
    expect(temMacros(undefined)).toBe(false);
  });

  it("soma o plano do dia e o registrado do dia com a MESMA conta do widget", () => {
    expect(macrosDoPlano({ "Café": { p: 20, c: 40, g: 10 }, "Almoço": { p: 35, c: 60, g: 15 }, "Janta": undefined }))
      .toEqual({ p: 55, c: 100, g: 25 });
    expect(macrosRegistradas({ a: { name: "x", protein: 20, carbs: 40, fat: 10 }, b: { name: "y", calories: 300 } }))
      .toEqual({ p: 20, c: 40, g: 10 });
  });

  it("formata só o que existe", () => {
    expect(formatarMacros({ p: 32, c: 45, g: 12 })).toBe("P 32g · C 45g · G 12g");
    expect(formatarMacros({ p: 0, c: 45, g: 0 })).toBe("C 45g");
    expect(formatarMacros(undefined)).toBe("");
    expect(kcalDasMacros({ p: 10, c: 10, g: 10 })).toBe(170);
  });

  it("entrada do plano carrega nome, kcal e gramas — e omite o que é zero", () => {
    expect(entradaDoPlano("Almoço", "arroz, feijão e frango", 650, { p: 40, c: 70, g: 0 }))
      .toEqual({ name: "Almoço: arroz, feijão e frango", calories: 650, protein: 40, carbs: 70 });
    expect(entradaDoPlano("Lanche", "fruta", 0, undefined)).toEqual({ name: "Lanche: fruta" });
  });

  it("diário e Home escrevem a MESMA entrada (id determinístico) — nunca soma em dobro", () => {
    const e = entradaDoPlano("Almoço", "x", 600, { p: 40, c: 70, g: 20 });
    let log = sincronizarLogDoDiario({}, "2026-09-18", "Almoço", true, e);
    log = sincronizarLogDoDiario(log, "2026-09-18", "Almoço", true, e); // marcou de novo / registrou na Home
    expect(Object.keys(log["2026-09-18"])).toEqual([idDoPlano("Almoço")]);
    expect(macrosRegistradas(log["2026-09-18"])).toEqual({ p: 40, c: 70, g: 20 });
  });

  it("desmarcar apaga só a entrada do plano; o que foi registrado por fora fica; dia vazio some", () => {
    const e = entradaDoPlano("Almoço", "x", 600, { p: 40, c: 70, g: 20 });
    const fora = { "quick-1": { name: "Bolo", calories: 300 } };
    let log = sincronizarLogDoDiario({ "2026-09-18": fora }, "2026-09-18", "Almoço", true, e);
    expect(Object.keys(log["2026-09-18"]).sort()).toEqual([idDoPlano("Almoço"), "quick-1"].sort());
    log = sincronizarLogDoDiario(log, "2026-09-18", "Almoço", false, e);
    expect(log["2026-09-18"]).toEqual(fora);
    const so = sincronizarLogDoDiario({ "2026-09-18": { [idDoPlano("Almoço")]: e } }, "2026-09-18", "Almoço", false, e);
    expect(so).toEqual({});
  });
});
