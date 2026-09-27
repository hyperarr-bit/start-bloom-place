import { describe, it, expect } from "vitest";
import { computeDailyBudget, computeMonthlyOutflow, computeUnpaidBillsEstimate, computeUnpaidOutsideOutflow } from "@/lib/finance-totals";
import { injetarFaturas } from "@/lib/finance-faturas";

/* "Quanto posso gastar hoje" (varredura 26/09): a conta de um custo fixo e a
 * fatura do cartão já estão na saída do mês — não podem ser descontadas de
 * novo como "pendentes". E hoje conta como dia de gastar. */
const dia26 = new Date(2026, 8, 26, 10); // setembro tem 30 dias

describe("quanto posso gastar hoje", () => {
  const fixos = [{ id: "seg", description: "Seguro", value: 100, day: 28 }];
  const contas = [{ day: 28, bills: [{ id: "fx-seg", name: "Seguro", paid: false, value: 100, fixedId: "seg" }] }];

  it("fixo de R$ 100 não pago tira R$ 100 do disponível (e não R$ 200)", () => {
    const sem = computeDailyBudget(3000, computeMonthlyOutflow(500, 0, 0), [], [], dia26);
    const com = computeDailyBudget(3000, computeMonthlyOutflow(500, 100, 0), contas, fixos, dia26);
    expect(sem.availableReal - com.availableReal).toBe(100);
    expect(com.unpaidBillsEstimate).toBe(0);
  });

  it("a conta avulsa do calendário (sem fixo) continua reservada", () => {
    const avulsa = [{ day: 29, bills: [{ id: "ipva", name: "IPVA", paid: false, value: 800 }] }];
    const b = computeDailyBudget(3000, 500, avulsa, [], dia26);
    expect(b.unpaidBillsEstimate).toBe(800);
    expect(b.availableReal).toBe(1700);
  });

  it("conta com fixedId de um fixo que não existe mais conta como avulsa", () => {
    const orfa = [{ day: 28, bills: [{ id: "fx-x", name: "Velho", paid: false, value: 50, fixedId: "apagado" }] }];
    expect(computeUnpaidOutsideOutflow(orfa, fixos)).toBe(50);
  });

  it("fatura derivada do cartão não é descontada de novo", () => {
    const comFatura = injetarFaturas([], [{ card: "Nubank", label: "Nubank", dueDay: 29, total: 450, variaveis: 300, parcelas: 150, fixos: 0, paga: false, mes: "2026-09" } as never]);
    expect(computeUnpaidOutsideOutflow(comFatura, [])).toBe(0);
    // pra MOSTRAR "a pagar", o total continua contando a fatura
    expect(computeUnpaidBillsEstimate(comFatura, [])).toBe(450);
  });

  it("divide pelos dias que faltam CONTANDO HOJE; no último dia não divide por zero", () => {
    expect(computeDailyBudget(3000, 500, [], [], dia26).remainingDays).toBe(5);
    const ultimo = computeDailyBudget(3000, 500, [], [], new Date(2026, 8, 30, 20));
    expect(ultimo.remainingDays).toBe(1);
    expect(ultimo.perDay).toBe(2500);
  });
});
