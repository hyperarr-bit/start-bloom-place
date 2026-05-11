## Objetivo

Deixar o tutorial igual ao print enviado: balão branco discreto acima do card/botão alvo, com uma setinha apontando pra baixo em direção ao alvo. Sem fundo escuro e sem o quadrado/anel azul piscando em volta do `+` ou do card.

## Mudanças em `src/components/onboarding/SpotlightOverlay.tsx`

1. **Remover o dim/escurecimento da tela**
   - Apagar todo o bloco SVG com máscara (`spot-mask-...`) e o fallback `bg-black/60`.
   - Remover a variável `dim` — o overlay nunca escurece nada.

2. **Remover o anel/quadrado destacando o alvo**
   - Apagar o `motion.div` com `border-2 border-primary`, `boxShadow` e animação de `scale` que desenha o retângulo arredondado em volta do elemento.
   - Sem highlight visual no alvo. O alvo permanece visível normalmente, sem moldura.

3. **Posicionar o balão sempre acima do card alvo**
   - Manter a lógica de medir o `rect` do alvo.
   - Forçar `labelBelow = false` quando há espaço acima (≥ 90px); só usar abaixo se realmente colado no topo.
   - Centralizar o balão horizontalmente em cima do alvo (mesma lógica de clamp já existente para não sair da tela).

4. **Setinha apontando pro card**
   - Manter apenas a seta `ArrowDown` embaixo do balão (entre o balão e o alvo), com leve animação de "bounce" pra baixo.
   - Quando o balão estiver abaixo (caso raro), usar `ArrowUp` no topo do balão.
   - Garantir que a seta fique alinhada com o centro do alvo (não com o centro do balão), pra ela realmente apontar pro card mesmo quando o balão está deslocado pelo clamp da borda da tela.

5. **Estilo do balão (igual ao print)**
   - Card branco/`bg-card`, borda fina, sombra suave, cantos arredondados.
   - Cabeçalho pequeno "PASSO X DE Y" em cinza/secundário.
   - Texto principal curto e em negrito.
   - Sem botão extra dentro do balão.

6. **Manter funcionalidades existentes**
   - Listener `core:activation` para avançar passos.
   - Auto-advance via `checkKey`.
   - Botão "Role pra baixo / pra cima" quando o alvo está fora da viewport (mantém como está).
   - Click-through no alvo continua funcionando (sem overlay bloqueando).

## Arquivos afetados

- `src/components/onboarding/SpotlightOverlay.tsx` (única alteração)

## Resultado esperado

Tela normal, sem escurecimento, sem moldura no `+` ou no card. Apenas um balão branco flutuante acima do alvo com uma seta pequena apontando pra baixo em direção ao card — exatamente como na imagem enviada.