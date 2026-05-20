# UX dos cards de Custos Fixos e Variáveis

## Problema
Hoje as tabelas de Custos Fixos e Custos Variáveis usam `overflow-x-auto` com `min-w-[600/650px]`. No mobile, o botão "+" e várias colunas ficam escondidos à direita — o usuário não percebe que precisa rolar para o lado para adicionar um gasto.

## Solução
Replicar o padrão de Receitas: tudo visível "de cara", sem scroll horizontal, e o botão de adicionar sempre alcançável.

### Form de adicionar (sempre visível, no topo da lista)
- Extrair o input/selects da última linha da tabela para um bloco dedicado de "Adicionar gasto" logo abaixo do header (CUSTOS FIXOS / CUSTOS VARIÁVEIS).
- Layout em 2 linhas compactas no mobile:
  - Linha 1: input de Descrição (flex-1) + input de Valor (w-24) + botão "+" (w-9, primário, sempre visível).
  - Linha 2 (collapse / expansível "mais opções"): selects de Categoria, Data (só variável), Forma de pagamento e Cartão (condicional).
- No desktop (≥sm) tudo cabe numa linha só.

### Lista de gastos cadastrados (substitui a tabela)
- Trocar `<table>` por uma lista de cards/linhas responsivos — sem `min-w` e sem `overflow-x-auto`.
- Cada item mostra: descrição, badge de categoria, valor à direita, e abaixo metadados em texto pequeno (data · pagamento · cartão). Botão de lixeira à direita.
- Mantém o mesmo visual minimal Notion-like (bordas, hover, tabular-nums).

### Rodapé TOTAL
- Linha simples full-width com "TOTAL" à esquerda e valor à direita.

## Arquivos a editar
- `src/components/ExpenseTable.tsx` — refatorar para form + lista de cards.
- `src/components/FixedExpensesTable.tsx` — mesma refatoração (sem coluna Data).

## Não muda
- Estrutura de dados, storage keys, spotlight tags (`data-spotlight="add-expense"` / `add-fixed`), categorias, cores, totais.
- IncomeTable (Receitas) permanece como referência visual.
