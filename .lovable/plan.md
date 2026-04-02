

# Melhorias no Dashboard e Meu Financeiro

Adicionar 3 funcionalidades escolhidas pelo usuário, seguindo a identidade visual existente.

---

## 1. Barra de Progresso do Mês (Dashboard)

Card mostrando visualmente o progresso de gastos no mês:
- Indicador: "Dia 15/30 — 45% do orçamento gasto"
- Barra dupla: progresso do tempo (dias) vs progresso dos gastos
- Alerta visual se gastos estão acima do esperado para o dia
- Posição: logo após os 4 cards de stats rápidos no Dashboard

## 2. Últimas Transações Rápidas (Dashboard)

Card com as 5 últimas despesas (variáveis + fixas) ordenadas por data:
- Cada linha: emoji da categoria, descrição, valor, data
- Badge colorido do método de pagamento
- Link "Ver todas →" que muda para aba financeiro
- Posição: no grid de gráficos, ao lado do pie chart de categorias

## 3. Gasto por Método de Pagamento (Dashboard)

Gráfico de barras horizontais ou donut mostrando distribuição por método:
- Pix, Cartão de Crédito, Débito, Dinheiro, Boleto
- Cada método com cor distinta e valor total
- Dados vêm do campo `paymentMethod` das despesas variáveis e `fixedExpenses`
- Posição: abaixo do gráfico Receitas vs Despesas

---

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Adicionar os 3 novos cards/seções com dados computados |
| `src/pages/Index.tsx` | Passar `setActiveTab` como prop ao Dashboard para o link "Ver todas" |

## Detalhes Técnicos

- Todos os dados já existem nos props do Dashboard (`expenses`, `fixedExpenses`) — campo `paymentMethod` já está nas interfaces
- Cores e espaçamento seguem o padrão: `bg-card rounded-lg border border-border p-4`, títulos `text-xs font-bold mb-3` com ícone Lucide
- Gráficos via Recharts (já instalado)
- Nenhuma mudança de banco de dados necessária

