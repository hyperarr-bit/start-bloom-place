# Corrigir overflow do widget "Sono de Hoje"

## Bug
Em `src/components/home/widgets/SleepLogWidget.tsx`, o texto "Não registrado" (linha 38) é `nowrap` por padrão no flex e fica em uma única linha. Combinado com `gap-4` e `min-w-[3rem]`, o widget excede a largura do container, quebra a proporção da Home e cria a borda branca lateral com scroll horizontal.

## Solução
Tornar o widget verdadeiramente contido e o texto truncável:

1. Container: adicionar `w-full max-w-full overflow-hidden`.
2. Linha do flex: trocar `gap-4` por `gap-3` e adicionar `min-w-0` (permite filho truncar).
3. Bloco dos botões +/−: marcar como `flex-shrink-0` para nunca encolher.
4. Span do status: adicionar `truncate min-w-0 text-right` para que ele encolha em vez de transbordar.
5. Reduzir `min-w-[3rem]` do número para `min-w-[2.5rem]`.

## Arquivo alterado
- `src/components/home/widgets/SleepLogWidget.tsx`
