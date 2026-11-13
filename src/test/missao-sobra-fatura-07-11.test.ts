/**
 * "SOBRA PRA HOJE" DA MISSÃO × CARD DO DASHBOARD (bug "missao-sobra-fatura", 07/11).
 *
 * Depois do 0f5b6021 (dois-numeros), a saída do mês da missão (lib/lembrete-dia2
 * `entradasDoCard`) segue a regra da fatura, mas o gasto de hoje ainda vinha do
 * `finance-expenses` cru. Compra no crédito HOJE depois do fechamento é da fatura
 * do mês seguinte: fica fora da saída e entrava no gasto de hoje — o `praHojeDoDia`
 * tirava da saída um gasto que ela não tinha. O balão dizia "R$ 760 por dia, sobra
 * R$ 520" e o card do Dashboard (Index: gastoDoDia(variaveisMes.noMes)) "R$ 700, sobra
 * R$ 700". Agora os dois leem o gasto de hoje da mesma lista.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/missao-sobra-fatura-07-11.test.ts
 */
process.env.TZ = "America/Sao_Paulo";
import { describe, it, expect, vi, afterEach } from "vitest";
import { praHojeDasFinancas } from "@/lib/lembrete-dia2";
import { praHojeDoDia, gastoDoDia } from "@/lib/montar-financas";
import { variaveisDoMesLidas } from "@/lib/finance-fatura";
import { computeLooseBillsOutflow, computeMonthlyOutflow } from "@/lib/finance-totals";

afterEach(() => { vi.useRealTimers(); });

const montar = (dados: Record<string, unknown>) => <T,>(k: string, padrao: T): T => (k in dados ? (dados[k] as T) : padrao);

/** A conta do card do Dashboard, como o Index monta. */
const doDashboard = (get: ReturnType<typeof montar>) => {
  const v = variaveisDoMesLidas("2026-11", (k) => get<unknown>(k, undefined));
  const saida = computeMonthlyOutflow(v.total, 0, 0, computeLooseBillsOutflow([], []));
  return praHojeDoDia(3000, saida, gastoDoDia(v.noMes), [], []);
};

describe("missão 'Sobra pra hoje' = card do Dashboard, com cartão que fecha no dia 25", () => {
  const base = {
    "finance-incomes": [{ id: "r1", description: "Salário", value: 3000, date: "2026-11-05" }],
    "finance-fixed-expenses": [],
    "finance-installments": [],
    "finance-dueDays": [],
    "finance-card-config": { nubank: { closingDay: 25, dueDay: 5 } },
  };

  it("compra no crédito HOJE (27/11) depois do fechamento: fatura de dezembro, os dois dizem o mesmo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 27, 10, 0));
    const get = montar({ ...base, "finance-expenses": [
      { id: "g1", description: "Mercado", value: 200, date: "2026-11-10", paymentMethod: "pix" },
      { id: "g2", description: "Tênis", value: 240, date: "2026-11-27", paymentMethod: "credito", cardName: "nubank" },
    ] });
    expect(praHojeDasFinancas(get)).toEqual(doDashboard(get));
    expect(praHojeDasFinancas(get)).toMatchObject({ doDia: 700, sobra: 700, gasto: 0 });
  });

  it("Pix hoje (conta na hora): os dois descontam igual, como antes", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 27, 10, 0));
    const get = montar({ ...base, "finance-expenses": [
      { id: "g1", description: "Mercado", value: 200, date: "2026-11-10", paymentMethod: "pix" },
      { id: "g3", description: "Padaria", value: 40, date: "2026-11-27", paymentMethod: "pix" },
    ] });
    expect(praHojeDasFinancas(get)).toEqual(doDashboard(get));
    expect(praHojeDasFinancas(get)?.gasto).toBe(40);
  });
});
