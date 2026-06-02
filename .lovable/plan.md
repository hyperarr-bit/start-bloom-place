## Problema

Mudei o posicionamento padrão do balão (`autoBelow`) sem ser pedido — agora ele aparece abaixo cobrindo o card de receita. Antes ficava acima.

## Mudança

### `src/components/onboarding/SpotlightOverlay.tsx`

Reverter a lógica `autoBelow` para o comportamento original: preferir **acima** do alvo, só ir abaixo se não houver espaço em cima.

```ts
const spaceAbove = rect ? rect.top : 0;
const autoBelow = rect ? spaceAbove < 130 : false;
```

Nada mais é alterado — placement explícito (`above`/`below`) por step continua respeitado.
