import { describe, it, expect } from "vitest";
import { CHAVE_ULTIMA_IMPORTACAO as CHAVE_APP } from "@/components/finance/ImportExtrato";
import { CHAVE_ULTIMA_IMPORTACAO, montarGastos } from "@/pages/raiox/lancamentos";
import { classificarDescricao, detectarVazamentos } from "@/pages/raiox/vazamentos";
import type { ParsedTx } from "@/lib/extrato-parser";

const AGORA = new Date("2026-10-18T15:00:00");
const tx = (description: string, amount: number, date = "2026-10-10"): ParsedTx => ({ date, description, amount });

describe("vazamentos do extrato", () => {
  it("uber eats é delivery, não corrida", () => {
    expect(classificarDescricao("UBER EATS", -32)).toBe("delivery");
    const r = detectarVazamentos([tx("UBER EATS", -40), tx("UBER * TRIP", -22)], AGORA);
    expect(r.resumo.vazamentos.find((v) => v.chave === "delivery")?.mes).toBe(40);
    expect(r.resumo.vazamentos.find((v) => v.chave === "transporte_app")).toBeUndefined();
    expect(r.txs.find((t) => t.description.startsWith("UBER *"))?.chave).toBe("transporte_app");
  });

  it("amazon prime é assinatura; amazon sem prime é compra", () => {
    expect(classificarDescricao("Amazon Prime", -14.9)).toBe("assinaturas");
    expect(classificarDescricao("AMAZON MARKETPLACE", -80)).toBe("compras_online");
    const r = detectarVazamentos([tx("Amazon Prime", -14.9), tx("AMAZON MARKETPLACE", -88)], AGORA);
    expect(r.resumo.vazamentos.map((v) => v.chave)).toEqual(["compras_online"]);
  });

  it("reconhece os outros grupos e ignora entrada, valor antigo e formiga de R$ 20", () => {
    expect(classificarDescricao("99 POP", -18)).toBe("transporte_app");
    expect(classificarDescricao("99FOOD", -30)).toBe("delivery");
    expect(classificarDescricao("Zé Delivery", -25)).toBe("delivery");
    expect(classificarDescricao("PADARIA DO ZE", -8)).toBe("formiga");
    expect(classificarDescricao("PADARIA DO ZE", -20)).toBeNull();
    expect(classificarDescricao("NETFLIX.COM", -55)).toBe("assinaturas");
    const r = detectarVazamentos([
      tx("NETFLIX.COM", -55),
      tx("SHOPEE * LOJA", -70),
      tx("PADARIA DO ZE", -8),
      tx("SALARIO", 3000),
      tx("IFOOD", -90, "2026-08-01"),
    ], AGORA);
    expect(r.resumo.fonte).toBe("extrato");
    expect(r.resumo.vazamentos.map((v) => v.chave).sort()).toEqual(["assinaturas", "compras_online"]);
    expect(r.txs.some((t) => t.date.startsWith("2026-08"))).toBe(false);
    expect(r.resumo.vazou_mes).toBe(55 + 70);
  });

  it("o carimbo do gasto é o do ImportExtrato, pra desfazer", () => {
    expect(CHAVE_ULTIMA_IMPORTACAO).toBe(CHAVE_APP);
    const gastos = montarGastos([
      { date: "2026-10-10", description: "IFOOD PEDIDO", amount: -42.5, chave: "delivery", category: "delivery" },
    ], 1700000000000);
    expect(gastos[0]).toMatchObject({ id: "1700000000000-e0", value: 42.5, category: "delivery", description: "IFOOD PEDIDO" });
  });
});
