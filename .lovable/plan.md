# Tutorial de Finanças — incluir Custos Variáveis e reordenar

## Nova ordem dos passos

1. Abra "Meu Financeiro" (`financeiro`)
2. Adicione sua receita (`add-income`)
3. Cadastre um custo fixo (`add-fixed`)
4. Cadastre um custo variável (`add-expense`) — **novo passo**
5. Escreva uma anotação financeira (`add-note`)
6. Adicione 1 conta no vencimento (`add-bill`)

Hoje o tutorial tem 5 passos e nunca chega em "custos variáveis", além de mostrar vencimentos antes das anotações. A mudança insere o passo de custo variável e troca a ordem entre anotações e vencimentos, conforme pedido.

## Implementação

Arquivo: `src/pages/Index.tsx` — array `steps` do `SpotlightOverlay`.

- Inserir entre `add-fixed` e `add-note`:
  ```
  { selector: '[data-spotlight="add-expense"]',
    label: 'Cadastre um custo variável (mercado, lazer...).',
    advanceOnAction: 'first_expense',
    checkKey: 'finance-expenses' }
  ```
- Mover o passo `add-note` para antes do `add-bill`.

Verificar em `src/components/ExpenseTable.tsx` se o evento de ativação disparado ao adicionar despesa variável é `first_expense` e a chave de storage é `finance-expenses`. Se forem outros nomes, ajustar o `advanceOnAction`/`checkKey` para os reais (sem mudar o componente).

Nenhuma outra alteração de UI/lógica.
