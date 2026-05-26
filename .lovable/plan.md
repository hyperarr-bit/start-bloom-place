# Correções nos passos finais do tutorial Finanças

## 1. Passo "Limites" — texto pouco claro
Atualizar o label do passo `tab-limites` em `src/pages/Index.tsx` para instruir explicitamente:

> "Toque em LIMITES embaixo e adicione um limite pra uma categoria."

## 2. Passo 13 ("Toque no menu") — aparece "Role pra cima" sem precisar
Em `src/components/onboarding/SpotlightOverlay.tsx`, a detecção de "offscreen acima" usa o limiar `rect.top + rect.height < 60`. O botão de menu fica no header sticky (top ≈ 13, height ≈ 28 → 41), caindo na regra incorretamente.

Reduzir o limiar para `< 10` (só dispara quando o alvo está realmente fora da viewport), mantendo a detecção para conteúdo abaixo.

## 3. Passo 14 ("Minha conta") — balão fora da tela quando drawer está fechado
Causa: se o usuário fecha o drawer durante o passo 14, o alvo `[data-spotlight="minha-conta"]` deixa de existir e o card de fallback aparece no canto inferior, parcialmente cortado.

Solução: em `src/components/home/AccountDrawer.tsx`, quando o drawer for fechado E o passo atual do spotlight for `minha-conta`, voltar o passo para `menu` (regredir um passo). Implementar via um pequeno mecanismo:

- Expor um evento global `core:spotlight-regress` que o `SpotlightOverlay` escuta para chamar `setStepIdx(Math.max(0, stepIdx - 1))`.
- No `AccountDrawer`, no `onOpenChange(false)`, despachar esse evento se o passo atual da Finanças for o último (minha-conta).

Alternativa mais simples (preferida): no `SpotlightOverlay`, quando o alvo do passo está ausente por > 400ms E o passo anterior tem um alvo presente, regredir automaticamente para o passo anterior em vez de mostrar fallback. Isso resolve o caso de forma genérica.

## 4. Após clicar nos 3 traços e fechar, menu fica "travado" (não dá pra clicar de novo)
Causa: em `SpotlightOverlay.tsx`, o `onPageClick` bloqueia qualquer clique em elementos com `[data-spotlight]` que não sejam o alvo do passo atual. Como o passo atual passa a ser `minha-conta` (dentro do drawer fechado), o `target` é `null` e o clique no botão `menu` é bloqueado por `preventDefault`/`stopPropagation`.

Solução: alterar a condição para NÃO bloquear quando `target` é `null` — permitir cliques livres se o alvo do passo atual não existe na DOM. Isso resolve o problema e também combina bem com a correção #3 (a regressão automática para o passo `menu` reativa o avanço normal pelo clique).

## Arquivos alterados
- `src/pages/Index.tsx` — texto do passo `tab-limites`.
- `src/components/onboarding/SpotlightOverlay.tsx` — limiar de off-screen acima; não bloquear cliques quando o alvo do passo está ausente; auto-regressão de passo quando alvo some e o anterior existe.

Sem mudanças de backend, dados ou auth.
