/**
 * Varredura da demo 26/09 — FINANÇAS (telas periféricas), a parte de conta.
 * Cada bloco trava um número que a /preview/financas mostrava errado.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { diaDoFixo, erroDoFixo } from "@/components/FixedExpensesTable";
import { erroDaReceita } from "@/components/IncomeTable";
import { erroDoGasto } from "@/components/ExpenseTable";
import { valorDeCusto } from "@/components/travel/TravelBudget";
import { calcular, formatarVisor } from "@/components/Calculator";
import {
  tempoParaJuntar, independenciaFinanceira, jurosCompostos, prazoPorExtenso, reaisComSinal as simSinal, REGRA_DOS_4,
} from "@/components/Simulators";
import { previsaoDoMes } from "@/components/WishlistItems";
import { parcelasDoMesDe, totaisDoMes, getExpensesByCategory, fmt } from "@/components/finance/MonthComparison";
import { totaisDoAno } from "@/components/finance/YearComparison";
import { buildWrappedData } from "@/components/wrapped/MonthlyWrapped";
import { linhasDeDespesa, montarCSV } from "@/components/Reports";
import { parcelasComoGastos } from "@/components/CategoryBudgets";
import { reais, reaisComSinal, pct } from "@/components/InvestmentsTracker";
import { computeDailyBudget, computeMonthlyOutflow } from "@/lib/finance-totals";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import type { Parcela } from "@/lib/finance-parcelas";

/* ============================================================
 * 1. Custo fixo: "Dia" em branco não vira "vence dia 1"
 * ============================================================ */
describe("Dia do custo fixo", () => {
  it("em branco = sem vencimento (não vira dia 1 nem conta atrasada)", () => {
    expect(diaDoFixo("")).toBeUndefined();
    expect(diaDoFixo("   ")).toBeUndefined();
  });
  it("1 a 31 vale; fora disso é erro dito, não dia inventado", () => {
    expect(diaDoFixo("5")).toBe(5);
    expect(diaDoFixo(" 31 ")).toBe(31);
    expect(diaDoFixo("0")).toBeNull();
    expect(diaDoFixo("32")).toBeNull();
    expect(diaDoFixo("2.5")).toBeNull();
  });
});

/* ============================================================
 * 9. Valores inválidos
 * ============================================================ */
describe("Valor inválido não entra", () => {
  it("receita: negativa, zero e sem nome são barradas com mensagem", () => {
    expect(erroDaReceita("Estorno", "-500")).toMatch(/maior que zero/);
    expect(erroDaReceita("Zero", "0")).toMatch(/maior que zero/);
    expect(erroDaReceita("   ", "100")).toMatch(/nome/);
    expect(erroDaReceita("", "")).toMatch(/nome e o valor/);
    expect(erroDaReceita("Salário", "6200")).toBeNull();
    expect(erroDaReceita("Freela", "1.250,50")).toBeNull();
  });
  it("gasto e custo fixo: mesma régua", () => {
    expect(erroDoGasto("Devolução", "-50")).toMatch(/maior que zero/);
    expect(erroDoGasto("  ", "10")).toMatch(/nome/);
    expect(erroDoGasto("Padaria", "32")).toBeNull();
    expect(erroDoFixo("Spotify", "-21.90")).toMatch(/maior que zero/);
    expect(erroDoFixo("Spotify", "21.90")).toBeNull();
  });
  it("viagem: custo negativo não entra; vazio é zero", () => {
    expect(valorDeCusto("-300")).toBeNull();
    expect(valorDeCusto("")).toBe(0);
    expect(valorDeCusto("1200")).toBe(1200);
  });
});

/* ============================================================
 * 10. Calculadora
 * ============================================================ */
describe("Calculadora", () => {
  it("divide, eleva e não inventa 0 na divisão por zero", () => {
    expect(calcular(12, 4, "/")).toBe(3);
    expect(calcular(2, 10, "^")).toBe(1024);
    expect(calcular(5, 0, "/")).toBeNaN();
    expect(calcular(0.1, 0.2, "+")).toBe(0.3);
  });
  it("visor em pt-BR, sem engolir o que está sendo digitado", () => {
    expect(formatarVisor("1234.5")).toBe("1.234,5");
    expect(formatarVisor("0.")).toBe("0,");
    expect(formatarVisor("0.05")).toBe("0,05");
    expect(formatarVisor("-5")).toBe("-5");
    expect(formatarVisor("Erro")).toBe("Erro");
  });
});

/* ============================================================
 * 11. Simuladores
 * ============================================================ */
describe("Simuladores", () => {
  it("aporte 0: diz que não alcança (antes: '50 ano(s) (600 meses)')", () => {
    expect(tempoParaJuntar(10000, 0, 8).alcanca).toBe(false);
    const ok = tempoParaJuntar(10000, 500, 8);
    expect(ok.alcanca).toBe(true);
    expect(ok.meses).toBeGreaterThan(12);
    expect(ok.meses).toBeLessThan(24);
  });
  it("independência com aporte e retorno 0: não alcança (antes: '100 anos')", () => {
    const r = independenciaFinanceira(5000, 50000, 0, 0);
    expect(r.alcanca).toBe(false);
    expect(r.rendaPassiva).toBe(0);
  });
  it("renda passiva usa a regra dos 4% da própria meta (≈ gastos mensais), não o retorno de 8%", () => {
    const r = independenciaFinanceira(5000, 50000, 2000, 8);
    expect(r.meta).toBe(1_500_000);
    expect(r.alcanca).toBe(true);
    expect(REGRA_DOS_4).toBe(0.04);
    // patrimônio ≥ meta → renda ≥ 5.000, mas nada perto dos 10.043 de antes
    expect(r.rendaPassiva).toBeGreaterThanOrEqual(5000);
    expect(r.rendaPassiva).toBeLessThan(5200);
    expect(independenciaFinanceira(5000, 2_000_000, 0, 8).jaAlcancou).toBe(true);
  });
  it("taxa negativa: rendimento com sinal de menos (antes '+R$ -49.067')", () => {
    const j = jurosCompostos(1000, 500, -50, 10);
    expect(j.rendimento).toBeLessThan(0);
    expect(simSinal(j.rendimento)).toMatch(/^-R\$ \d/);
    expect(simSinal(1234)).toBe("+R$ 1.234,00");
  });
  it("prazo por extenso sem 'ano(s)'", () => {
    expect(prazoPorExtenso(1)).toBe("1 mês");
    expect(prazoPorExtenso(12)).toBe("1 ano");
    expect(prazoPorExtenso(27)).toBe("2 anos e 3 meses");
  });
});

/* ============================================================
 * 12. Formatação
 * ============================================================ */
describe("Formatação de dinheiro e percentual", () => {
  it("2 casas, sinal antes do R$, vírgula no percentual", () => {
    expect(reais(-500)).toBe("-R$ 500,00");
    expect(reais(3807.9)).toBe("R$ 3.807,90");
    expect(reaisComSinal(900)).toBe("+R$ 900,00");
    expect(reaisComSinal(-400)).toBe("-R$ 400,00");
    expect(pct(13.5, 1)).toBe("13,5%");
    expect(pct(6.338, 2)).toBe("6,34%");
  });
  it("comparação mensal: centavo com 2 casas, redondo sem ',00', negativo com o sinal na frente", () => {
    expect(fmt(3807.9)).toBe("R$ 3.807,90");
    expect(fmt(9000)).toBe("R$ 9.000");
    expect(fmt(-500)).toBe("-R$ 500");
  });
});

/* ============================================================
 * 3. Desejos: a previsão é a do Dashboard
 * ============================================================ */
describe("Previsão dos Desejos = previsão do Dashboard", () => {
  // setembro da demo: renda 6.200, fixos 3.104, variáveis 464, parcela 150
  const fixos = [
    { id: "f1", value: 1850, day: 5 }, { id: "f2", value: 420, day: 8 }, { id: "f3", value: 320, day: 15 },
    { id: "f4", value: 178, day: 10 }, { id: "f5", value: 120, day: 3 }, { id: "f6", value: 99, day: 10 },
    { id: "f7", value: 62, day: 18 }, { id: "f8", value: 55, day: 20 },
  ];
  const dueDays = [
    { day: 10, bills: [{ id: "b-4", name: "Internet", paid: false, value: 99, fixedId: "f6" }] },
    { day: 18, bills: [{ id: "fx-f7", name: "Água", paid: false, value: 62, fixedId: "f7" }] },
    { day: 28, bills: [{ id: "avulsa", name: "IPVA", paid: false, value: 300 }] },
  ];
  const agora = new Date(2026, 8, 26);

  it("saída do mês inclui a parcela (3.718, não 3.568) e as contas vêm de lib/finance-totals", () => {
    const p = previsaoDoMes(6200, 3104 + 464, 150, fixos, dueDays, agora);
    expect(p.saidaDoMes).toBe(computeMonthlyOutflow(464, 3104, 150));
    expect(p.saidaDoMes).toBe(3718);
    const base = computeDailyBudget(6200, 3718, dueDays, fixos);
    expect(p.contasPendentes).toBe(base.unpaidBillsEstimate);
    // nunca mais "quantidade × média dos fixos" (3 × 388 = 1.164)
    expect(p.contasPendentes).not.toBe(3 * (3104 / 8));
    const projecao = (464 / 26) * 4;
    expect(p.projecaoVariavel).toBeCloseTo(projecao, 6);
    expect(p.saldoProjetado).toBeCloseTo(6200 - 3718 - base.unpaidBillsEstimate - projecao, 6);
  });
});

/* ============================================================
 * 4. Comparação mensal/anual e retrospectiva com as parcelas
 * ============================================================ */
const UID = "uid-varredura-financas";
const gravar = (chave: string, v: unknown) => localStorage.setItem(`u:${UID}:${chave}`, JSON.stringify(v));
const celular = (paid: number, extra: Partial<Parcela> = {}): Parcela => ({
  id: "inst-1", date: "2025-11-15", cardName: "nubank", category: "eletronicos", totalValue: 1800,
  description: "Celular novo", installmentValue: 150, paidInstallments: paid, totalInstallments: 12, ...extra,
});

describe("Parcelas do mês nas comparações e na retrospectiva", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 26, 12));
    // setembro (vivo) e agosto (arquivado), como na demo
    gravar("finance-incomes", [{ id: "i", value: 6200 }]);
    gravar("finance-fixed-expenses", [{ id: "f", value: 3104, category: "moradia" }]);
    gravar("finance-expenses", [{ id: "e", value: 464, category: "alimentacao" }]);
    gravar("finance-installments", [celular(9), { ...celular(0, { id: "pj", perfil: "acme", category: "servicos" }) }]);
    gravar("finance-2026-agosto-incomes", [{ id: "ai", value: 6200 }]);
    gravar("finance-2026-agosto-fixed", [{ id: "af", value: 3104, category: "moradia" }]);
    gravar("finance-2026-agosto-expenses", [{ id: "ae", value: 1371, category: "alimentacao" }]);
    gravar("finance-2026-agosto-installments", [celular(9)]);
  });
  afterEach(() => vi.useRealTimers());

  it("setembro: 3.104 + 464 + 150 = 3.718 — o mesmo 'Despesas' do Dashboard", () => {
    const set = totaisDoMes({ ano: 2026, idx: 8 }, UID, PERFIL_PESSOAL);
    expect(set.parcelas).toBe(150);
    expect(set.despesas).toBe(3718);
    expect(set.receitas - set.despesas).toBe(2482);
  });

  it("agosto arquivado também leva a parcela dele (4.475 + 150)", () => {
    expect(totaisDoMes({ ano: 2026, idx: 7 }, UID, PERFIL_PESSOAL).despesas).toBe(3104 + 1371 + 150);
  });

  it("a parcela entra na categoria dela; a da empresa fica fora do pessoal", () => {
    const cats = getExpensesByCategory({ ano: 2026, idx: 8 }, UID, PERFIL_PESSOAL);
    expect(cats.eletronicos).toBe(150);
    expect(cats.servicos).toBeUndefined();
    expect(parcelasDoMesDe({ ano: 2026, idx: 8 }, UID, "acme").map((p) => p.id)).toEqual(["pj"]);
  });

  it("mês que ainda não chegou não recebe parcela projetada (comparação é do que aconteceu)", () => {
    expect(parcelasDoMesDe({ ano: 2026, idx: 9 }, UID, PERFIL_PESSOAL)).toEqual([]);
  });

  it("comparação anual soma as parcelas mês a mês", () => {
    const ano = totaisDoAno(2026, UID, PERFIL_PESSOAL, 9);
    expect(ano.despesas).toBe(3104 + 1371 + 150 + 3718);
    expect(ano.categorias.eletronicos).toBe(300);
  });

  it("retrospectiva de agosto: 'saiu' inclui a parcela", () => {
    const w = buildWrappedData("Agosto", UID, 2026);
    expect(w?.outflow).toBe(3104 + 1371 + 150);
  });
});

/* ============================================================
 * 5. Relatório e CSV
 * ============================================================ */
describe("Relatório fecha e o CSV abre no Excel pt-BR", () => {
  const variaveis = [{ id: "e1", description: "Mercado \"do mês\"", category: "alimentacao", value: 235, date: "2026-09-02", paymentMethod: "pix" }];
  const fixos = [{ id: "f1", description: "Aluguel", category: "moradia", value: 1850, paymentMethod: "debito", day: 5 }];
  const parcelas = [celular(9, { startMonth: "2026-09", parcelaDoMes: 10 })];
  const rotulo = (c: string) => ({ alimentacao: "Alimentação", moradia: "Moradia", eletronicos: "Eletrônicos" } as Record<string, string>)[c] ?? c;

  it("as linhas trazem dia a dia + fixos + parcelas e somam o total", () => {
    const linhas = linhasDeDespesa(variaveis, fixos, parcelas);
    expect(linhas.map((l) => l.tipo)).toEqual(["Variável", "Fixo", "Parcela"]);
    expect(linhas.reduce((s, l) => s + l.valor, 0)).toBe(235 + 1850 + 150);
    expect(linhas[2].detalhe).toBe("10 de 12");
  });

  it("BOM, ponto e vírgula, decimal com vírgula, rótulos de gente e aspas escapadas", () => {
    const csv = montarCSV("all", [{ id: "i", description: "Salário", value: 6200, date: "2026-09-01" }], linhasDeDespesa(variaveis, fixos, parcelas), rotulo);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Salário";6200,00;01/09/2026');
    expect(csv).toContain('Variável;"Mercado ""do mês""";"Alimentação";235,00;02/09/2026;"Pix"');
    expect(csv).toContain('Fixo;"Aluguel";"Moradia";1850,00;;"Cartão de débito"');
    expect(csv).toContain('Parcela;"Celular novo (10 de 12)";"Eletrônicos";150,00;15/11/2025;"Cartão de crédito"');
    expect(csv).toContain("TOTAL;;;2235,00;;");
    expect(csv).not.toMatch(/alimentacao|"credito"/);
  });
});

/* ============================================================
 * 13. Limites por categoria contam a parcela
 * ============================================================ */
describe("Parcela no limite da categoria", () => {
  it("vira gasto da categoria dela; quitada não conta", () => {
    const g = parcelasComoGastos([celular(9), celular(12, { id: "q" }), celular(3, { id: "r", category: "roupa" })]);
    expect(g).toEqual([
      { category: "eletronicos", value: 150, perfil: undefined },
      { category: "vestuario", value: 150, perfil: undefined },
    ]);
  });
});
