

# 4 Novos Gráficos no Dashboard

Adicionar ao final do Dashboard (após Fixos vs Variáveis), seguindo a identidade visual: `bg-card rounded-lg border border-border p-4`, título `emoji + UPPERCASE text-xs font-bold mb-3`, cores semânticas, `tabular-nums`.

---

## 1. 💸 Fluxo de Caixa Diário

**AreaChart** (Recharts) mostrando gastos acumulados dia a dia no mês atual.
- Eixo X: dias (1–30)
- Linha sólida: gastos reais acumulados (cor `#ef4444`)
- Linha tracejada: ritmo ideal (receita total / dias do mês × dia) — cor `#3b82f6` com opacidade
- Agrupa `expenses` por campo `date`, soma valores, acumula dia a dia
- Gradiente de preenchimento sob a linha de gastos

## 2. 🏆 TOP 5 MAIORES GASTOS

**Barras horizontais CSS** (sem Recharts, igual ao card de Método de Pagamento).
- Combina `expenses` + `fixedExpenses`, ordena por valor DESC, pega os 5 maiores
- Cada barra: descrição truncada + valor `tabular-nums` + barra proporcional ao maior gasto
- Cor: `bg-red-400`

## 3. 📅 GASTOS POR DIA DA SEMANA

**BarChart** (Recharts) com 7 barras (Seg–Dom).
- Agrupa `expenses` pelo dia da semana extraído do campo `date`
- Labels: Seg, Ter, Qua, Qui, Sex, Sáb, Dom
- Cor única: `#8b5cf6`
- Destaca visualmente o dia com maior gasto

## 4. 💰 COMPOSIÇÃO DA RENDA + 📈 TENDÊNCIA

Card dividido em **grid 2 colunas** (lg):

**Coluna 1 — Composição da Renda**: PieChart (donut) com as fontes de receita.
- Agrupa `incomes` por `description` (cada income tem descrição como "Salário", "Freelance")
- Mesma paleta `COLORS` do pie de categorias
- Legenda ao lado com valores

**Coluna 2 — Tendência Mensal**: LineChart comparando ritmo de gastos do mês atual vs mês anterior.
- Eixo X: dias (1–30)
- Linha azul: mês atual (gastos acumulados por dia)
- Linha cinza tracejada: mês anterior (dados do `getMonthTotals` dividido por 30, como estimativa linear)
- Se não houver dados do mês anterior, mostra apenas mês atual

---

## Dados necessários

- `incomes` — já passado ao Dashboard? **Não.** Precisa adicionar como nova prop.
- `expenses.date` — já tem, para agrupar por dia/semana
- `fixedExpenses` — já passado

## Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Adicionar prop `incomes`, 4 novos blocos com `useMemo` para cada dataset, JSX no final |
| `src/pages/Index.tsx` | Passar `incomes={incomes}` ao `<Dashboard>` |

## Layout final do Dashboard (de cima para baixo)

1. Quick Stats (existente)
2. Alertas Inteligentes (existente)
3. Gastos por Categoria + Receitas vs Despesas (existente)
4. Evolução do Patrimônio (existente)
5. Progresso do Mês (existente)
6. Últimas Transações + Gasto por Método (existente)
7. Fixos vs Variáveis (existente)
8. **Fluxo de Caixa Diário** (novo — largura total)
9. **Grid 2 colunas: Top 5 Maiores Gastos + Gastos por Dia da Semana** (novo)
10. **Grid 2 colunas: Composição da Renda + Tendência Mensal** (novo)

