/**
 * O EXEMPLO "SALÁRIO 3000" VOLTAVA AO REABRIR (bug "receita-exemplo", 07/11).
 *
 * Conta nova: ela lança o Salário 3000, fecha o app e reabre. No primeiro desenho a lista de
 * receitas ainda está vazia (o cache não chegou), o Index passa `prefillExample` e o useState do
 * IncomeTable guarda o exemplo. Quando o Salário chega, o formulário segue com "Salário / 3000" e
 * um toque no + duplica a renda.
 *
 * Conserto: quando a lista deixa de estar vazia e o formulário ainda é exatamente o exemplo que
 * ela não mexeu, o formulário volta a ficar vazio. O que ela digitou nunca é apagado.
 *
 * Rodar com: npx vitest run src/test/receita-exemplo-07-11.test.tsx
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { IncomeTable } from "@/components/IncomeTable";

afterEach(cleanup);
const salario = { id: "sal", description: "Salário", value: 3000, date: "2026-11-05" };
const campos = () => [
  (screen.getByPlaceholderText("+ Nova receita") as HTMLInputElement).value,
  (screen.getByPlaceholderText("Valor") as HTMLInputElement).value,
];

describe("receita-exemplo (07/11): o exemplo não volta quando o Salário já está salvo", () => {
  it("1º desenho com a lista vazia (cache não chegou), 2º com o Salário: o formulário fica vazio", () => {
    const { rerender } = render(<IncomeTable incomes={[]} setIncomes={() => {}} prefillExample />);
    expect(campos()).toEqual(["Salário", "3000"]);
    rerender(<IncomeTable incomes={[salario]} setIncomes={() => {}} prefillExample={false} />);
    expect(campos()).toEqual(["", ""]);
  });
  it("conta nova de verdade (lista vazia) segue vendo o exemplo", () => {
    const { rerender } = render(<IncomeTable incomes={[]} setIncomes={() => {}} prefillExample />);
    rerender(<IncomeTable incomes={[]} setIncomes={() => {}} prefillExample />);
    expect(campos()).toEqual(["Salário", "3000"]);
  });
  it("o que ela digitou em cima do exemplo fica, mesmo quando a lista chega", () => {
    const { rerender } = render(<IncomeTable incomes={[]} setIncomes={() => {}} prefillExample />);
    fireEvent.change(screen.getByPlaceholderText("Valor"), { target: { value: "3500" } });
    rerender(<IncomeTable incomes={[salario]} setIncomes={() => {}} prefillExample={false} />);
    expect(campos()).toEqual(["Salário", "3500"]);
  });
});
