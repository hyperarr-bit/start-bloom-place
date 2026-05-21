# Ajustes nos cards de Custos (Fixos e Variáveis)

## 1. Tutorial / Spotlight do botão "+"

O atributo `data-spotlight="add-expense"` e `add-fixed` continua no botão `+` no novo layout, então o `SpotlightOverlay` já segue o elemento. Vou apenas validar visualmente para garantir que a seta aponta corretamente para a nova posição (canto superior direito do card, ao lado do campo de valor) e ajustar offset se necessário.

## 2. "Mais opções" aberto por padrão

- `showMore` passa a iniciar como `true` em `ExpenseTable.tsx` e `FixedExpensesTable.tsx`.
- Ao adicionar um item, **não** fechar mais o bloco (remover o `setShowMore(false)` do `addExpense`).
- Usuário só recolhe se clicar manualmente em "Menos opções".

## 3. Bug do campo de data (Custos Variáveis)

No print, o input `type="date"` aparece em branco (sem o texto "Data") e estoura para fora do card. Causa: em mobile o input `date` tem largura intrínseca maior que a célula do grid e não tem placeholder.

Correções em `ExpenseTable.tsx`:
- Adicionar `w-full min-w-0 block` no input de data para respeitar a coluna do grid.
- Garantir que o grid `grid-cols-2` aplique `min-w-0` nos filhos (wrap em um `div className="min-w-0"` ou aplicar direto).
- Adicionar um label visível acima ou um prefixo "Data:" para que o campo nunca fique "vazio" visualmente quando não há valor.

## Arquivos

- `src/components/ExpenseTable.tsx`
- `src/components/FixedExpensesTable.tsx`

Nenhuma mudança em storage, dados, categorias ou IncomeTable.
