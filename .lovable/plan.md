## Problema

Nos passos com `placement: "above"` (add-investment, add-wish) o balão fica em `top: rect.top - 120`. Com altura ~110px, a borda inferior do balão encosta no alvo, e a `ArrowDown` (em `-bottom-5`) cai praticamente sobre a borda do card alvo — parecendo estar "dentro" dele em vez de apontar de fora.

## Mudança

### `src/components/onboarding/SpotlightOverlay.tsx`

Aumentar o gap entre o balão e o alvo quando posicionado acima, e mover a seta pra ficar claramente nesse espaço, apontando pro alvo:

- Trocar `top: Math.max(8, rect.top - 120)` por `top: Math.max(8, rect.top - 140)` (placement above).
- Trocar a classe da `ArrowDown` de `-bottom-5` pra `-bottom-7` (mantém a seta entre o balão e o alvo, não sobreposta a ele).
- Aplicar mudança espelhada no `labelBelow=true` (ArrowUp em `-top-5` → `-top-7`) e ajustar o `top` desse ramo de `rect.top + rect.height + PADDING + 18` pra `rect.top + rect.height + PADDING + 24` pra manter coerência visual.

Nenhum outro arquivo é tocado.
