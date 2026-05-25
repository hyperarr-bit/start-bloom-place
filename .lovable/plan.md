# Corrigir seta de voltar exigindo vários toques durante o tutorial

## Causa

Em `src/components/onboarding/SpotlightOverlay.tsx`, o wrapper da bolha do passo ("Passo X de N") usa `className="absolute pointer-events-auto"`. Quando essa bolha é posicionada perto do topo da tela, ela passa por cima do header — incluindo a seta de voltar no canto superior esquerdo. Como a bolha captura ponteiro mas não tem nada clicável dentro, os toques na seta de voltar são engolidos. Só depois de a bolha se reposicionar (ou de o usuário acertar fora dela) é que o clique passa.

## Correção

Trocar `pointer-events-auto` por `pointer-events-none` no wrapper da bolha (linha 225). A bolha continua aparecendo igual, mas deixa de bloquear cliques na seta de voltar e em qualquer outro elemento atrás dela. O botão rosa "Role pra cima/baixo" e o card de fallback continuam com `pointer-events-auto` próprios, então seguem funcionando normalmente.

## Arquivo afetado

- `src/components/onboarding/SpotlightOverlay.tsx` — 1 linha alterada
