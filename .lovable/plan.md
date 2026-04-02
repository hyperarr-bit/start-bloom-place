

# Metas de Economia por Categoria

Criar um componente `CategoryBudgets` que permite definir limites de gasto por categoria e acompanhar o progresso com barras visuais.

---

## Como funciona

O usuário define um teto de gasto para cada categoria (Alimentação, Transporte, Lazer, etc.). O componente calcula automaticamente quanto já foi gasto no mês atual com base nos dados de `expenses` e exibe barras de progresso coloridas por categoria.

---

## Interface

- Header com faixa colorida (`bg-accent/20`) e título "LIMITES POR CATEGORIA" + ícone `Gauge` (Lucide)
- Lista de categorias com:
  - Badge colorido da categoria (reutilizando as cores já definidas em `ExpenseTable`)
  - Barra de progresso: verde se < 75%, amarelo se 75-99%, vermelho se >= 100%
  - Texto: "R$ gasto / R$ limite" em `tabular-nums text-xs`
- Botão para adicionar/editar limite de cada categoria via input inline
- Empty state: "Defina limites para controlar seus gastos por categoria"

---

## Detalhes técnicos

### Novo arquivo
**`src/components/CategoryBudgets.tsx`**
- Props: `expenses` (array de despesas do mês), categorias com cores do `ExpenseTable`
- Estado persistido via `usePersistedState("finance-category-budgets", {})`
- Formato: `Record<string, number>` (ex: `{ alimentacao: 500, transporte: 200 }`)
- Calcula gasto por categoria com `expenses.filter(e => e.category === cat).reduce(...)`
- Segue todos os padrões: `animate-fade-in`, `bg-card rounded-lg border border-border`, ícones `w-3.5 h-3.5`, inputs `h-7 text-xs`

### Integração em `Index.tsx`
- Adicionar nova aba nos tabs: `{ id: "limites", label: "🎯 LIMITES" }`
- Renderizar `<CategoryBudgets expenses={expenses} />` quando `activeTab === "limites"`
- Também pode ser adicionado dentro da aba "financeiro" como seção extra (abaixo de BillsDueCards)

### Persistência
- Usa `usePersistedState` (localStorage) como todos os outros componentes
- Se o usuário estiver logado, o `useUserData` hook sincroniza com Supabase automaticamente via a chave `finance-category-budgets`

---

## Escopo
- 1 arquivo novo (`CategoryBudgets.tsx`)
- 1 arquivo editado (`Index.tsx` — adicionar aba e renderizar componente)
- Sem mudanças no banco de dados

