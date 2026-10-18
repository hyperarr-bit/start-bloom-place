/**
 * A conta do /funil-d. Salário ÷ 220 (CLT) ou ÷ 110 (meio período).
 * Nada de faixa chutada: o número é divisão do que a pessoa digitou.
 */
import { describe, it, expect } from "vitest";
import {
  HORAS_CLT, PRECO_ANUAL_CENTAVOS, PRECO_MES_CENTAVOS, ancora, calcularDia, centavosDe, duracao, faixaPreco,
  faixaSalario, fatiaDoDia, reais, salarioAceito, traduzir,
} from "@/pages/funil-d/horas";

const HOJE = new Date(2026, 9, 18); // 18/10/2026, domingo, outubro tem 31 dias
const SALARIO = 320_000; // R$ 3.200

describe("ler o que a pessoa digitou", () => {
  it("aceita real inteiro, milhar com ponto e centavo com vírgula", () => {
    expect(centavosDe("3200")).toBe(320_000);
    expect(centavosDe("3.200")).toBe(320_000);
    expect(centavosDe("R$ 3.200,50")).toBe(320_050);
    expect(centavosDe("3200,5")).toBe(320_050);
    expect(centavosDe("1.518,00")).toBe(151_800);
    expect(centavosDe("14,90")).toBe(1_490);
    expect(centavosDe("14.90")).toBe(1_490);
    expect(centavosDe("45")).toBe(4_500);
  });
  it("rejeita vazio, texto e zero", () => {
    expect(centavosDe("")).toBeNull();
    expect(centavosDe("abc")).toBeNull();
    expect(centavosDe("0")).toBeNull();
    expect(centavosDe("R$")).toBeNull();
  });
});

describe("a hora e o dia", () => {
  it("R$ 3.200 em 18/10/2026: hora R$ 14,55, dia R$ 106,67, 14 dias, o ano cabe em 6h 44min", () => {
    const c = calcularDia(SALARIO, "44h", HOJE)!;
    expect(HORAS_CLT).toBe(220);
    expect(c.horaCentavos).toBe(1_455);
    expect(reais(c.horaCentavos)).toBe("R$ 14,55");
    expect(c.diaCentavos).toBe(10_667);
    expect(reais(c.diaCentavos)).toBe("R$ 106,67");
    expect(c.dia).toBe(18);
    expect(c.mes).toBe("outubro");
    expect(c.restantes).toBe(14);
    expect(c.diasNoMes).toBe(31);
    expect(c.cabeCentavos).toBe(149_333);
    expect(reais(c.cabeCentavos)).toBe("R$ 1.493,33");
    expect(c.planoMinutos).toBe(404);
    expect(duracao(c.planoMinutos)).toBe("6h 44min");
    expect(c.mesMinutos).toBe(34);
    expect(duracao(c.mesMinutos)).toBe("34 min");
    expect(c.faixa).toBe("3000_5000");
    expect(PRECO_ANUAL_CENTAVOS).toBe(9790);
    expect(PRECO_MES_CENTAVOS).toBe(816);
  });

  it("meio período usa 110 horas: a mesma pessoa vale R$ 29,09", () => {
    const c = calcularDia(SALARIO, "22h", HOJE)!;
    expect(c.horaCentavos).toBe(2_909);
    expect(reais(c.horaCentavos)).toBe("R$ 29,09");
  });

  it("salário curto demais ou longo demais não gera conta", () => {
    expect(salarioAceito(centavosDe("50"))).toBe(false);
    expect(calcularDia(5_000, "44h", HOJE)).toBeNull();
    expect(calcularDia(30_000_000, "44h", HOJE)).toBeNull();
  });

  it("as faixas não devolvem o valor", () => {
    expect(faixaSalario(149_900)).toBe("ate_1500");
    expect(faixaSalario(150_000)).toBe("1500_3000");
    expect(faixaSalario(800_000)).toBe("8000_mais");
    expect(faixaPreco(1_900)).toBe("ate_20");
    expect(faixaPreco(4_500)).toBe("20_50");
    expect(faixaPreco(30_000)).toBe("300_mais");
  });
});

describe("traduzir um preço e a âncora", () => {
  const conta = calcularDia(SALARIO, "44h", HOJE)!;

  it("R$ 45 viram 3h 6min e 42% de um dia", () => {
    const t = traduzir(4_500, conta)!;
    expect(t.minutos).toBe(186);
    expect(duracao(t.minutos)).toBe("3h 6min");
    expect(fatiaDoDia(4_500, conta.diaCentavos)).toBe("42% de um dia seu");
    expect(t.faixa).toBe("20_50");
  });

  it("um mês de CORE cabe dentro de R$ 45, e não cabe dentro de um café de R$ 5", () => {
    const ifood = traduzir(4_500, conta)!;
    const cafe = traduzir(500, conta)!;
    expect(ancora(conta, ifood).comparacao).toBe("Um mês de CORE (34 min) cabe dentro desse preço de R$ 45,00 (3h 6min).");
    expect(ancora(conta, cafe).comparacao).toBeNull();
    expect(ancora(conta, null).ano).toBe("São 6h 44min do seu trabalho no ano. Por mês, 34 min.");
  });

  it("um preço de mais de um dia fala em dias, não em porcentagem", () => {
    expect(fatiaDoDia(conta.diaCentavos, conta.diaCentavos)).toBe("1 dia seu");
    expect(fatiaDoDia(conta.diaCentavos * 2, conta.diaCentavos)).toBe("2 dias seus");
  });
});
