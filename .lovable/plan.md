## Problema

O `QuickSignupModal` só fica aberto enquanto `isGuest && quicksignup-pending === "true"`. Quando o `supabase.auth.signUp` retorna sessão, o usuário deixa de ser guest e o flag pendente é limpo, então o modal desmonta **antes** de o `QuickSignupStep` mostrar a tela de sucesso ("Você ganhou 7 dias grátis 🎉"). Resultado: o usuário cai direto no app sem ver a tela.

## Correção

### 1. `src/components/onboarding/QuickSignupModal.tsx`
- Adicionar estado local `keepOpen` que vira `true` quando o modal abre pela primeira vez e só volta a `false` quando o `QuickSignupStep` avisar que terminou (após o clique em "Aproveitar teste grátis").
- Calcular `open = keepOpen || (loaded && isGuest && pending)` para não fechar quando a sessão for criada.
- Passar um callback `onFinished` para `QuickSignupStep`.

### 2. `src/components/onboarding/QuickSignupStep.tsx`
- Aceitar prop opcional `onFinished?: () => void`.
- Chamar `onFinished()` dentro de `handleStartTrial`, depois da navegação/toast, para que o modal feche apenas após o usuário ver a tela de 7 dias e clicar no botão.

Nenhuma outra lógica (signUp, set de flags, navegação) é alterada.
