## O problema

Hoje o fluxo do convidado é:

```text
WelcomeScreen → PreSignupTutorial (4 slides) → /auth?signup=1
                                              ↓
                                 (e além disso o Home renderiza
                                  QuickStartOnboarding por cima,
                                  com celebração + escolha de módulo)
```

Dois problemas:
1. O `QuickStartOnboarding` (tela de "Por onde quer começar / Parabéns") foi adicionado sem você pedir.
2. Mesmo sem ele, o `PreSignupTutorial` joga o usuário em `/auth?signup=1` (aba de login) em vez do popup sobre o app.

## O que vai mudar

Fluxo final:

```text
WelcomeScreen → PreSignupTutorial (4 slides) → navega pra /inicio
                                              + seta quicksignup-pending=true
                                              ↓
                            QuickSignupModal (popup global) abre por cima
                            do app borrado → cadastro → entra direto
```

### 1. `src/components/welcome/PreSignupTutorial.tsx`
- No clique do último slide ("Criar minha conta") e no botão "Pular":
  - Em vez de `navigate("/auth?signup=1")`, usar `useUserData().set("quicksignup-pending", "true")` e `navigate("/inicio")`.
- O `QuickSignupModal` já montado globalmente em `App.tsx` detecta a flag + `isGuest` e aparece sobre o app borrado.

### 2. `src/pages/Home.tsx` — remover o onboarding extra
- Remover import e uso de `QuickStartOnboarding` e do tipo `ModuleKey`.
- Remover estados/efeitos que só existiam pra ele: `pendingModules`, `setPendingModules`, `computePending`, `showOnboarding`, `setShowOnboarding`, `handleOnboardingComplete`, e o efeito do `ONBOARDING_RESET_KEY` que recalcula `shouldShow`.
- Remover o bloco `<AnimatePresence>{showOnboarding && <QuickStartOnboarding .../>}</AnimatePresence>`.
- Trocar `{!showOnboarding && <DailyNudge />}` por `<DailyNudge />`.
- `GreetingHeader`: remover a prop `onReplayTutorial` que apontava pro onboarding removido (passar nada). Mantém-se o resto da home intacto.

### 3. Arquivos que ficam intactos (não mexer)
- `QuickSignupModal.tsx` — já faz o popup com blur certo.
- `QuickSignupStep.tsx` — já cria conta sem confirmação de e-mail e fica na página atual após sucesso.
- `App.tsx` — modal já está montado globalmente.
- `WelcomeScreen.tsx` — fluxo de entrada permanece igual.
- `QuickStartOnboarding.tsx` — fica no repo mas sem usos (posso deletar se quiser, me avisa).

## Pré-requisito de Supabase (você já sabe)
Pra entrar direto sem confirmar e-mail, "Confirm email" precisa estar **desligado** em Authentication → Providers → Email. Se estiver ligado, o `signUp` não cria sessão e o `QuickSignupStep` cai pro `/auth` — não é bug de código.

## Fora de escopo
- Não mexer no `/auth`, no `WelcomeScreen`, nem na copy do tutorial ou do popup.
- Não mexer em `DailyNudge`, widgets ou qualquer outra parte da Home.
- Não criar nada novo.