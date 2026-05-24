Remover o label externo "Data" e fazer o input de data mostrar "Data" como placeholder dentro do campo (igual o "Valor" mostra dentro do campo).

Como o input type="date" não aceita placeholder nativamente, a abordagem será:
- Quando o campo estiver vazio, renderizar como `type="text"` mostrando "Data" como placeholder.
- Ao focar, trocar para `type="date"` para abrir o seletor nativo.
- Largura igual à do campo "Valor" (`w-20`) para combinar visualmente.

Arquivo: `src/components/IncomeTable.tsx` — substituir o bloco do label+input de data por um único input com troca de tipo no focus.