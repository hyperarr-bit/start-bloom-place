/** 11/11 (velocidade 1.0.26): os gráficos do Dashboard de Finanças animam em 280 ms (antes: o padrão da recharts, até 1,5 s). */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

const props: Record<string, Record<string, unknown>[]> = { Pie: [], Bar: [], Area: [] };
vi.mock("recharts", () => {
  const Caixa = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Nada = () => null;
  const anota = (nome: string) => (p: Record<string, unknown> & { children?: ReactNode }) => { props[nome].push(p); return <div>{p.children}</div>; };
  return { ResponsiveContainer: Caixa, PieChart: Caixa, BarChart: Caixa, AreaChart: Caixa, Pie: anota("Pie"), Cell: Nada, Bar: anota("Bar"), Area: anota("Area"), XAxis: Nada, YAxis: Nada, Tooltip: Nada, Legend: Nada };
});

import { GraficoCategorias, GraficoReceitasDespesas, GraficoPatrimonio, ANIMACAO_CURTA } from "@/components/finance/DashboardGraficos";

describe("Dashboard de Finanças: animação curta dos gráficos", () => {
  it("pizza, barras e área animam em 280 ms com ease-out (e ainda animam)", () => {
    render(<>
      <GraficoCategorias dados={[{ name: "Mercado", value: 300 }]} cores={["#f00"]} />
      <GraficoReceitasDespesas dados={[{ month: "nov", Receitas: 5000, Despesas: 3000 }]} corReceita="#0f0" corDespesa="#f00" />
      <GraficoPatrimonio dados={[{ month: "nov", Patrimônio: 2000 }]} cor="#00f" />
    </>);
    expect(ANIMACAO_CURTA.animationDuration).toBeLessThanOrEqual(300);
    const todos = [...props.Pie, ...props.Bar, ...props.Area];
    expect(props.Pie.length).toBeGreaterThan(0);
    expect(props.Bar.length).toBe(2);
    expect(props.Area.length).toBeGreaterThan(0);
    for (const p of todos) {
      expect(p.isAnimationActive).toBe(true);
      expect(p.animationDuration).toBe(280);
      expect(p.animationEasing).toBe("ease-out");
    }
  });
});
