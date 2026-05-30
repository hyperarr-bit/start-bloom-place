## Contexto
Atualmente, no `FixedExpensesTable.tsx`, a funcao `addExpense` (linha 70) so adiciona o item se `newExpense.description && newExpense.value` forem preenchidos. Caso contrario, silencia — nada acontece e o usuario nao recebe feedback.

## O que mudar
No `src/components/FixedExpensesTable.tsx`:

1. **Importar `toast` do `sonner`** para exibir mensagens.
2. **Na funcao `addExpense`**, antes do `if`, verificar quais campos obrigatorios estao vazios:
   - Se `description` vazio → `toast.error("Adicione o nome")`
   - Se `value` vazio → `toast.error("Adicione o valor para ir")`
   - Se ambos → priorizar uma mensagem (ex: "Adicione o nome e o valor")
3. **Nao alterar** layout, campos, sugestoes, lista, nem outros componentes.

## Resultado esperado
Ao clicar no "+" sem preencher o nome, aparece "Adicione o nome". Ao clicar sem preencher o valor, aparece "Adicione o valor para ir". So adiciona quando ambos estao preenchidos.