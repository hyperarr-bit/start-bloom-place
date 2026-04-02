

# 4 Novas Funcionalidades no Dashboard

Adicionar 4 novos cards ao `Dashboard.tsx`, seguindo rigorosamente a identidade visual existente: `bg-card rounded-lg border border-border p-4`, títulos `text-xs font-bold` UPPERCASE, valores `tabular-nums`, cores semânticas (`green-400`, `red-400`, `purple-400`, `orange-400`).

---

## 1. Barra de Progresso do Mês (tempo vs gastos)

Duas barras horizontais lado a lado:
- **Tempo do mês**: % dos dias passados (ex: dia 15 = 50%). Cor `blue-400`.
- **Orçamento gasto**: % das despesas vs receitas. Cor `green-400` se abaixo do tempo, `orange-400` se próximo, `red-400` se acima.
- Indicador textual: "Dia X de 30 — Y% do orçamento usado"
- Usa `Progress` (shadcn) com cor dinâmica.

## 2. Últimas Transações (5 mais recentes)

- Lista das 5 despesas mais recentes (variáveis + fixas), ordenadas por data.
- Cada linha: ícone colorido da categoria, descrição truncada, valor em `text-red-400`, data em `text-muted-foreground text-[10px]`.
- Link "Ver todas →" no rodapé que muda `activeTab` para `"financeiro"`.
- Requer passar `onNavigate` callback como nova prop no Dashboard.

## 3. Gasto por Método de Pagamento

- Barras horizontais com percentual. Agrupa `expenses` + `fixedExpenses` por `paymentMethod`.
- Labels: Pix, Crédito, Débito, Dinheiro, Boleto.
- Barra com `div` estilizado (cor única por método), percentual à direita.
- Sem dependência de Recharts — barras CSS puras para consistência visual.

## 4. Resumo Fixos vs Variáveis

- Dois blocos lado a lado no estilo dos stat cards existentes.
- **Custos Fixos**: soma de `fixedExpenses`, cor `orange-400`, ícone `Lock`.
- **Custos Variáveis**: soma de `expenses`, cor `blue-400`, ícone `ShoppingCart`.
- Barra de proporção visual (% fixo vs % variável) embaixo.

---

## Arquivos Editados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Dashboard.tsx` | Adicionar os 4 novos blocos após os Alertas e antes dos Charts. Adicionar prop `onNavigate` para o link "Ver todas". Adicionar labels de métodos de pagamento. |
| `src/pages/Index.tsx` | Passar `onNavigate={() => setActiveTab("financeiro")}` ao Dashboard. |

## Layout no Dashboard

Ordem dos blocos (de cima para baixo):
1. Quick Stats (4 cards — já existe)
2. **Barra de Progresso do Mês** (novo — largura total)
3. Alertas Inteligentes (já existe)
4. **Grid 2 colunas**: Últimas Transações | Gasto por Método de Pagamento (novos)
5. **Resumo Fixos vs Variáveis** (novo — largura total)
6. Charts Grid (já existe)
7. Evolução do Patrimônio (já existe)

