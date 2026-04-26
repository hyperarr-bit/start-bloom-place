## Problema

Na tela do print, a tela de "Trial expirado" aparece bugada: o botão "Ver planos" e o texto aparecem **misturados** com o conteúdo da home (saudação, score, módulos, ações rápidas). O overlay deveria cobrir tudo, mas não está cobrindo.

## Causa raiz

O `TrialBanner` está sendo renderizado **dentro** do `<PageTransition>`, que é um `motion.div` com animação de `opacity` e `y` (transform). 

Dois problemas combinados:

1. **`position: fixed` quebra dentro de elementos com `transform`** — uma regra do CSS: quando um ancestral tem `transform`, qualquer filho com `position: fixed` passa a se posicionar em relação a esse ancestral, não à viewport. Resultado: o overlay `fixed inset-0` não cobre a tela inteira de forma confiável.

2. **Stacking context isolado** — o `motion.div` cria seu próprio stacking context, então o `z-40` do overlay fica preso dentro do PageTransition, podendo ficar atrás de outros elementos da home renderizados depois.

Foi exatamente isso que o ajuste anterior (mudar de `z-50` pra `z-40`) acabou expondo.

## Correção

Tirar o `TrialBanner` de dentro do `PageTransition` em todas as rotas, e renderizar ele uma única vez no nível raiz do `App` (igual ao `GlobalWinback` já é hoje). Assim o overlay fica solto na árvore, sem ancestral com transform, e o `fixed inset-0` cobre a viewport inteira como deveria.

### Mudanças técnicas

**`src/App.tsx`**
- Remover `<TrialBanner />` de cada uma das ~18 rotas.
- Renderizar `<TrialBanner />` uma única vez fora do `<BrowserRouter>` ou logo após `<AnimatedRoutes />`, no mesmo nível do `<GlobalWinback />`.
- Como o `TrialBanner` usa `useNavigate`, ele precisa ficar dentro do `<BrowserRouter>` — então o lugar certo é logo após `<AnimatedRoutes />`, junto do `GlobalWinback`.

**`src/components/TrialBanner.tsx`**
- Voltar o overlay de trial expirado para `z-50` (o `WinbackFlow` usa `z-[200]` no DialogContent do Radix, então continua por cima sem conflito).
- Garantir que o `motion.div` do overlay expirado não esteja dentro de fragmento desnecessário.

**`src/components/retention/GlobalWinback.tsx`**
- Sem mudanças (continua funcionando porque já está fora do PageTransition).

### Resultado esperado

- Trial expirado: tela preta/background cobre 100% da viewport, sem vazar conteúdo da home por baixo nem por cima.
- Roleta winback: continua aparecendo por cima do trial expirado (z-[200] > z-50).
- Banners de trial não-expirado (dia 1-7): continuam funcionando normalmente porque são inline (não fixed), não dependem de stacking context.
