## Pular tela "Parabéns 🎉" após o tutorial

A tela "Parabéns! Você liberou todos os 16 módulos" está em `src/components/onboarding/QuickStartOnboarding.tsx` (bloco `allDone`, linhas 156–189). Quando o usuário termina os 4 módulos do tutorial, ela aparece com o botão "Criar conta para salvar", que ao ser clicado chama `handleCelebrationDone()` e leva à tela de signup da foto (`QuickSignupStep` — "Parabéns! Você desbloqueou o app completo 🎉" com nome / e-mail / senha).

### Mudança
Remover o passo de celebração intermediário. Assim que `allDone` for `true`, disparar `handleCelebrationDone()` automaticamente (via `useEffect`), pulando direto para a página de cadastro da foto.

### Arquivo alterado
- `src/components/onboarding/QuickStartOnboarding.tsx`
  - Adicionar `useEffect` que, quando `allDone === true` e o usuário ainda não foi redirecionado, chama `handleCelebrationDone()` uma única vez (guard com `useRef` para evitar duplo disparo).
  - Remover (ou deixar inacessível) o bloco JSX da celebração — sem ele, durante o frame intermediário não aparece nada visível além do fundo, e logo o redirect acontece. Para evitar qualquer flash, mantenho o `Loader2` (`transitioning`) ativo enquanto navega.

### Fora de escopo
- Nenhuma mudança no texto/layout da tela de signup (a da foto continua igual).
- Nenhuma alteração nos eventos de analytics existentes além do que já é disparado por `handleCelebrationDone`.
