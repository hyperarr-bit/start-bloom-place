# Corrigir o design quebrado pela aba Uso

## O bug
O wrapper `TrackedCard` usa `display: contents`. Os pais no `Index.tsx` usam classes `space-y-*` do Tailwind, que aplicam `margin-top` nos irmãos diretos via `> * + *`. Como `display: contents` faz o wrapper não gerar caixa, a margem desaparece e os cards ficam colados — Anotações grudado em Vencimentos, faixa Receitas/Despesas/Dívidas/Invest. colada no card de baixo, etc.

## Correção
Trocar a estratégia do `TrackedCard` para não interferir no layout, mantendo o tracking funcionando igual:

1. Em `src/components/admin/TrackedCard.tsx`, remover `display: contents`. Renderizar um `<div>` real com `className="contents"` substituído por uma div neutra que herda o comportamento de bloco padrão — **mas** isso ainda muda layout em flex/grid. Solução real: manter um wrapper que se comporta como o filho.

   Abordagem escolhida: tornar `TrackedCard` um **componente sem DOM extra**, anexando os listeners via `cloneElement` no único filho. Assim o DOM final é idêntico ao de antes do tracking — zero impacto visual.

   - Aceitar exatamente 1 elemento filho.
   - Usar `React.cloneElement` para anexar `ref` (combinando com ref existente se houver) e `onClickCapture`.
   - `IntersectionObserver` continua observando o `ref` do filho real.
   - Throttle e dedup por sessão permanecem iguais.

2. Não alterar `Index.tsx` — os usos de `<TrackedCard>` continuam idênticos.

3. Não mexer em mais nada (sem refactors, sem "melhorias").

## Verificação
- Abrir `/` e conferir que Anotações, Vencimentos, faixa de receitas, e demais cards voltaram a ter o espaçamento original das imagens enviadas.
- Conferir que eventos `finance_card_view` / `finance_card_interact` continuam sendo enviados (sem mudança na lógica).

## Por que aconteceu
Usei `display: contents` sem testar o layout. Não vou mais adicionar/alterar nada que não foi pedido, e vou validar visualmente mudanças que tocam componentes existentes antes de marcar como prontas.
