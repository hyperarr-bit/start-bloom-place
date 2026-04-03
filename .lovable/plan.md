

# Corrigir Campo de Data no WishlistItems

## Problema
O campo de data no formulário de desejos (`WishlistItems.tsx`) mostra um input `type="date"` sem placeholder visível — igual ao problema que já foi corrigido nos investimentos.

## Solução
Padronizar o campo de data do WishlistItems com o mesmo estilo usado no InvestmentsTracker: input `type="date"` com `h-8 text-xs` e dimensões proporcionais aos outros campos do grid.

O campo de data em `type="date"` no mobile já mostra o seletor nativo do sistema, então o placeholder não aparece nativamente. Manter consistente com investimentos — sem wrapper extra, apenas garantir que o tamanho (`h-8 text-xs`) esteja correto e proporcional.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/WishlistItems.tsx` | Garantir que o input de data (linha 274) tenha o mesmo padrão visual do InvestmentsTracker — `h-8 text-xs` sem wrappers extras, proporcional aos demais campos |

