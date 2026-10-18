import { describe, it, expect } from "vitest";
import { SERVICOS, VALORES_OUTRA } from "./conteudo";
import {
  PRECO_CORE_ANUAL, ancoraPreco, anosDeCore, brl, cupom, economia, equivalencia, faixaTotal, maisCara, mesRotulo, totalAno, totalMes,
} from "./somatorio";

describe("brl", () => {
  it("inteiro sem centavos, quebrado com vírgula", () => {
    expect(brl(347)).toBe("R$ 347");
    expect(brl(347.79)).toBe("R$ 347,79");
    expect(brl(97.9)).toBe("R$ 97,90");
    expect(brl(0)).toBe("R$ 0");
    expect(brl(1240)).toBe("R$ 1.240");
  });
});

describe("mesRotulo", () => {
  it("mês curto + ano", () => {
    expect(mesRotulo(new Date("2026-10-18T15:00:00-03:00"))).toBe("out/2026");
  });
});

describe("totalMes / totalAno", () => {
  it("soma exata dos serviços escolhidos", () => {
    expect(totalMes(["netflix", "spotify"], [])).toBe(66.8); // 44,90 + 21,90
    expect(totalMes([], [])).toBe(0);
  });
  it("ignora id desconhecido e soma os extras", () => {
    expect(totalMes(["netflix", "nao-existe"], [9.9, 19.9])).toBeCloseTo(74.7, 2);
  });
  it("ano = mês × 12", () => {
    expect(totalAno(66.8)).toBe(801.6);
  });
  it("todos os preços da tabela são positivos e plausíveis", () => {
    for (const s of SERVICOS) {
      expect(s.preco).toBeGreaterThan(0);
      expect(s.preco).toBeLessThan(500);
      expect(s.nome.length).toBeGreaterThan(1);
    }
    expect(new Set(SERVICOS.map((s) => s.id)).size).toBe(SERVICOS.length);
    for (const v of VALORES_OUTRA) expect(v).toBeGreaterThan(0);
  });
});

describe("cupom", () => {
  it("ordena por preço e lista os extras como 'Outra assinatura'", () => {
    const c = cupom(["spotify", "netflix"], [9.9]);
    expect(c.map((i) => i.nome)).toEqual(["Netflix", "Spotify", "Outra assinatura"]);
    expect(c[0].preco).toBe(44.9);
    expect(c[2].chave).toBe("extra-0");
  });
});

describe("economia / maisCara", () => {
  it("soma as não usadas, por mês e por ano", () => {
    const e = economia([{ preco: 44.9 }, { preco: 21.9 }]);
    expect(e).toEqual({ n: 2, mes: 66.8, ano: 801.6 });
  });
  it("maisCara devolve a de maior preço (null se vazia)", () => {
    expect(maisCara([])).toBeNull();
    expect(maisCara([{ chave: "a", nome: "A", preco: 10 }, { chave: "b", nome: "B", preco: 30 }])?.chave).toBe("b");
  });
});

describe("anosDeCore / ancoraPreco", () => {
  it("anos de CORE com 1 casa, truncado", () => {
    expect(anosDeCore(262.8)).toBe(2.6); // 21,90 × 12
    expect(anosDeCore(97.9)).toBe(1);
  });
  it("âncora da não usada quando cobre ≥ 1 ano", () => {
    const a = ancoraPreco({ totalMes: 200, caraNaoUsada: { nome: "Netflix", preco: 44.9 } });
    expect(a).toContain("Netflix");
    expect(a).toContain("5,5 anos de CORE");
  });
  it("âncora do total quando nenhuma não usada cobre", () => {
    expect(ancoraPreco({ totalMes: 120, caraNaoUsada: null })).toBe("Você paga R$ 120 por MÊS em assinaturas. O CORE é R$ 97,90 por ANO.");
    expect(ancoraPreco({ totalMes: 97.9, caraNaoUsada: { nome: "iCloud+", preco: 3.9 } })).toContain("por MÊS");
  });
  it("sem âncora quando o total é baixo e nada foi marcado", () => {
    expect(ancoraPreco({ totalMes: 50, caraNaoUsada: null })).toBeNull();
    expect(ancoraPreco({ totalMes: 50, caraNaoUsada: { nome: "iCloud+", preco: 3.9 } })).toBeNull();
  });
  it("o preço do CORE na âncora é o a97", () => {
    expect(PRECO_CORE_ANUAL).toBe(97.9);
  });
});

describe("equivalencia / faixaTotal", () => {
  it("equivalência por faixa, sem inventar preço de produto", () => {
    expect(equivalencia(9000)).toBe("uma viagem em família");
    expect(equivalencia(4500)).toBe("um celular novo");
    expect(equivalencia(2500)).toBe("4 meses de mercado");
    expect(equivalencia(1200)).toBe("2 meses de mercado");
    expect(equivalencia(500)).toBeNull();
  });
  it("faixas pro analytics", () => {
    expect(faixaTotal(50)).toBe("ate_100");
    expect(faixaTotal(150)).toBe("100_200");
    expect(faixaTotal(300)).toBe("200_350");
    expect(faixaTotal(400)).toBe("350_600");
    expect(faixaTotal(700)).toBe("600_mais");
  });
});
