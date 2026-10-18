/**
 * O cálculo do /funil-a é o produto da página: o número tem que bater com a folha de pagamento.
 * Valores de referência feitos à mão com as tabelas de 2026 (Portaria MPS/MF 13/2026 e Lei 15.270/2025).
 */
import { describe, it, expect } from "vitest";
import {
  DATA_PARCELA_1, DATA_PARCELA_2, calcular13, diasAte, faixaDoSalario, inss, irDo13, irMensal, lerSalario, reducaoLei15270,
} from "@/pages/funil-a/calculo";
import { DESTINOS, avosDoMes, dividir, percentualDoPreco } from "@/pages/funil-a/conteudo";
import { funilALiberadoNoHost } from "@/pages/funil-a/liberado";

describe("INSS 2026 (progressivo, teto 8.475,55)", () => {
  it("faixas", () => {
    expect(inss(1621)).toBe(121.57);
    expect(inss(3000)).toBe(248.6);
    expect(inss(4000)).toBe(368.6);
    expect(inss(6000)).toBe(641.51);
  });
  it("teto", () => {
    expect(inss(8475.55)).toBe(inss(20000));
    expect(inss(20000)).toBe(988.09);
  });
});

describe("IR 2026 com a redução da Lei 15.270/2025", () => {
  it("até R$ 5.000 zera no mês; no 13º a redução para em 312,89 (sem desconto simplificado)", () => {
    expect(irMensal(4000)).toBe(0);
    expect(irMensal(5000)).toBe(0);
    expect(irDo13(4000)).toBe(0);
    expect(irDo13(5000)).toBe(23.78);
  });
  it("sem a redução (regra de 2025), 4.000 pagava 114,76 por mês", () => {
    expect(irMensal(4000, false)).toBe(114.76);
  });
  it("entre 5.000,01 e 7.350 a redução cai em linha", () => {
    expect(reducaoLei15270(6000)).toBe(179.75);
    expect(irMensal(6000)).toBe(385.1);
    expect(reducaoLei15270(7350)).toBe(0);
    expect(reducaoLei15270(9000)).toBe(0);
  });
});

describe("13º", () => {
  it("R$ 3.000: 1ª inteira, 2ª com o INSS", () => {
    const r = calcular13(3000);
    expect(r.parcela1).toBe(1500);
    expect(r.inss13).toBe(248.6);
    expect(r.ir13).toBe(0);
    expect(r.liquido13).toBe(2751.4);
    expect(r.parcela2).toBe(1251.4);
    expect(r.parcela1 + r.parcela2).toBeCloseTo(r.liquido13, 2);
  });
  it("R$ 4.000: a isenção nova aparece no mês e no ano", () => {
    const r = calcular13(4000);
    expect(r.economiaIrMes).toBe(114.76);
    expect(r.economiaIrAno).toBe(1527.67);
    expect(r.liquidoMes).toBe(3631.4);
  });
  it("quem entrou no ano recebe proporcional", () => {
    expect(avosDoMes(null)).toBe(12);
    expect(avosDoMes(7)).toBe(6);
    expect(calcular13(3000, 6).bruto13).toBe(1500);
  });
  it("FGTS do ano = 8% dos 12 salários + 13º", () => {
    expect(calcular13(3000).fgtsAno).toBe(3120);
  });
});

describe("datas de 2026", () => {
  it("30/11 é segunda; a 2ª vai pra sexta 18/12 (20/12 é domingo)", () => {
    expect(DATA_PARCELA_1.getDay()).toBe(1);
    expect(new Date(2026, 11, 20).getDay()).toBe(0);
    expect(DATA_PARCELA_2.getDay()).toBe(5);
    expect(diasAte(DATA_PARCELA_1, new Date(2026, 9, 18, 15))).toBe(43);
  });
});

describe("entrada e privacidade", () => {
  it("lê o salário do jeito que a pessoa digita", () => {
    expect(lerSalario("2.500")).toBe(2500);
    expect(lerSalario("2500,50")).toBe(2500.5);
    expect(lerSalario("R$ 3.500,00")).toBe(3500);
    expect(lerSalario("3500")).toBe(3500);
    expect(lerSalario("abc")).toBeNaN();
  });
  it("analytics só recebe a faixa", () => {
    expect(faixaDoSalario(1800)).toBe("ate_2k");
    expect(faixaDoSalario(4999)).toBe("3k_5k");
    expect(faixaDoSalario(6000)).toBe("5k_7k");
  });
});

describe("plano", () => {
  it("os potes somam exatamente o 13º líquido", () => {
    for (const d of DESTINOS) {
      const potes = dividir(2751.4, d);
      expect(potes.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(2751.4, 2);
      expect(potes.length).toBe(3);
    }
  });
  it("âncora do preço no 13º dela", () => {
    expect(percentualDoPreco(2751.4)).toBe("3,6");
    expect(percentualDoPreco(50)).toBeNull();
  });
});

describe("só fora do domínio de produção", () => {
  it("coreaplicativo.com.br e www ficam de fora; preview e localhost abrem", () => {
    expect(funilALiberadoNoHost("coreaplicativo.com.br")).toBe(false);
    expect(funilALiberadoNoHost("www.coreaplicativo.com.br")).toBe(false);
    expect(funilALiberadoNoHost("WWW.coreaplicativo.com.br.")).toBe(false);
    expect(funilALiberadoNoHost("core-git-cursor-funil-a.vercel.app")).toBe(true);
    expect(funilALiberadoNoHost("localhost")).toBe(true);
  });
});
