// 18/11 (revisor da 1.0.28): editar um valor com centavos mostrava "1234.5"; quem digitava a vírgula gravava 10× (12345).
// O rascunho da edição agora usa textoBR ("1234,5") nas 5 telas de Finanças que faltavam.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { IncomeTable } from "@/components/IncomeTable";

describe("editar valor com centavos e digitar vírgula", () => {
  it("receita 1234,50 → editar → mostra 1234,5 e, com a vírgula a mais, grava 1234,5 (não 12345)", () => {
    let atual: any[] = [{ id: "1763400000000", description: "Salário", value: 1234.5, date: "2026-11-05" }];
    const set = (v: any) => { atual = typeof v === "function" ? v(atual) : v; };
    const { rerender } = render(<IncomeTable incomes={atual} setIncomes={set} />);
    fireEvent.click(screen.getByLabelText(/Editar Salário/));
    const campo = screen.getByDisplayValue("1234,5") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "1234,50" } });
    const salvar = screen.getAllByRole("button").find((b) => /salvar/i.test(b.getAttribute("aria-label") || b.textContent || ""));
    fireEvent.click(salvar!);
    rerender(<IncomeTable incomes={atual} setIncomes={set} />);
    expect(atual[0].value).toBe(1234.5);
  });

  it("as 5 telas montam o rascunho com textoBR (nunca String(valor) com ponto)", () => {
    const ler = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
    expect(ler("components/IncomeTable.tsx")).toMatch(/value: textoBR\(i\.value\)/);
    expect(ler("components/ExpenseTable.tsx")).toMatch(/value: textoBR\(e\.value\)/);
    expect(ler("components/FixedExpensesTable.tsx")).toMatch(/value: textoBR\(e\.value\)/);
    expect(ler("components/InstallmentTracker.tsx")).toMatch(/installmentValue: .*textoBR\(Math\.round/);
    expect(ler("components/finance/MonthCalendar.tsx")).toMatch(/textoBR\(b\.value\)/);
  });
});
