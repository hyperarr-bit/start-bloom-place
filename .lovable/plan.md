## O que muda

Hoje, quando o convidado termina o tutorial e clica em "Criar conta para salvar", o `QuickStartOnboarding` troca para `step === 2` e renderiza o `QuickSignupStep` ocupando a tela inteira (fundo sólido `bg-background`), sem mostrar o app atrás. Você quer:

1. O usuário cai direto no módulo escolhido (ou no `/inicio`) — não numa "página de cadastro".
2. Por cima desse app, aparece um **popup centralizado** com os 3 campos (nome, e-mail, senha).
3. O fundo (app real) fica visível porém **borrado** (backdrop-blur) e bloqueado.

## Como implementar

### 1. `QuickStartOnboarding.tsx` — parar de renderizar o signup inline
- Remover o bloco `step === 2` e o estado `2` do tipo.
- No `handleCelebrationDone`, se `isGuest`:
  - Salvar flag `quicksignup-pending = "true"` via `useUserData`.
  - Decidir rota destino: se existir `quickstart-target-module`, usar a rota correspondente; senão `/inicio`.
  - Chamar `onComplete()` (fecha o overlay do onboarding) e `navigate(rota)`.
- Isso resolve o bug "tá indo pra página errada" — hoje fica preso no overlay; com a flag, o usuário aterrissa no app de verdade.

### 2. Novo componente `src/components/onboarding/QuickSignupModal.tsx`
- Lê `quicksignup-pending` e `isGuest` do `useUserData`.
- Se ambos verdadeiros, renderiza overlay fixo:
  - `fixed inset-0 z-[100]` com `bg-background/40 backdrop-blur-md` (fundo do app visível e borrado).
  - Card centralizado (`max-w-md`, `rounded-2xl`, `bg-card`, `shadow-2xl`, `p-6`) com o `<QuickSignupStep />` dentro.
  - Sem botão de fechar (é gate obrigatório), mas com link "Já tem conta? Entrar" que já existe no step.
- Bloqueia scroll do body enquanto aberto.

### 3. `QuickSignupStep.tsx` — pequenas adaptações
- Após `signUp` com sessão criada: limpar flag `quicksignup-pending` e **não** navegar (o usuário já está no módulo certo). Só fechar via flag e mostrar toast.
- Remover o `py-6` externo (o modal controla padding).
- Manter fallback de navegação pro `/auth` quando não houver sessão (confirmação de e-mail ativa).

### 4. Montar o `QuickSignupModal` global
- Adicionar `<QuickSignupModal />` em `src/App.tsx` (junto com `<Toaster />` etc.), pra ele estar disponível em qualquer rota do app autenticável.

## Arquivos tocados
- `src/components/onboarding/QuickStartOnboarding.tsx` — remove step 2, seta flag + navega.
- `src/components/onboarding/QuickSignupStep.tsx` — não navega após sucesso, limpa flag, ajusta spacing.
- `src/components/onboarding/QuickSignupModal.tsx` — **novo**, overlay com blur.
- `src/App.tsx` — monta o modal global.

## Fora de escopo
- Mudar o fluxo `/auth` tradicional.
- Mexer no `PreSignupTutorial` ou no celebration screen em si.
- Trocar a copy (já validada na rodada anterior).
