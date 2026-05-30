## Resumo
Substituir a lógica de cores discretas (verde/amarelo/vermelho) na barra de progresso dos limites por categoria por um gradiente contínuo baseado na porcentagem de gasto vs limite.

## Problema Atual
A função `getBarColor` no `CategoryBudgets.tsx` tem apenas 3 estados:
- < 75% → verde
- 75-99% → amarelo
- ≥ 100% → vermelho

O usuário quer transições suaves: verde fraco quando está muito longe do limite, verde forte quando se aproxima, amarelo/laranja variando conforme chega perto, e vermelho ao ultrapassar.

## Solução
Implementar interpolação de cores HSL na função `getBarColor`:
- 0% → verde claro/fraco
- ~50% → verde médio
- ~75% → verde forte
- ~85% → amarelo
- ~95% → laranja
- 100% → vermelho
- > 100% → vermelho escuro/forte

## Arquivo a modificar
- `src/components/CategoryBudgets.tsx` — função `getBarColor` (linha 79-83)

## Detalhes Técnicos
Usar interpolação HSL (hue, saturation, lightness) para criar transições suaves entre as cores conforme a porcentagem aumenta. A cor será calculada dinamicamente com base no `pct`, sem classes Tailwind fixas — será um style inline `backgroundColor` com HSL gerado via função JavaScript.

Também ajustar o texto de alerta "Limite excedido" para manter coerência visual.