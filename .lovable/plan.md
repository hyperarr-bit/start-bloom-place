## Novo fluxo de cadastro + tutorial

### 1. Landing Page (`src/pages/lp/LandingPage.tsx`)
Trocar todos os CTAs "Teste grátis / Testar grátis / Começar agora" que hoje apontam para `/auth` para `/auth?signup=1`, garantindo que o Auth abra direto em modo cadastro (a página já lê `searchParams.get("signup") === "1"`).

Linhas afetadas: 631, 657, 1029, 1045, 1082 (mantém o link "Entrar / Criar Conta" do rodapé como `/auth`).

### 2. Página Auth (`src/pages/Auth.tsx`)
- Remover o card "Tudo que você configurou no tutorial será salvo na sua conta." (bloco `hasGuest` em ~175–189).
- Após `signUp` com sucesso **e** sessão criada, em vez de `navigate("/financas")`, redirecionar para `/inicio` marcando uma flag nova `force-new-user-tutorial = "true"` em `useUserData` (linha ~104). Isso faz o Home disparar o tutorial mesmo para usuários logados.

### 3. Home / gating do tutorial (`src/pages/Home.tsx`)
Hoje o tutorial só roda para `isGuest`. Alterar o `useEffect` (~83–124) para também rodar quando `force-new-user-tutorial === "true"`:

- Quando a flag estiver setada, NÃO marcar automaticamente `core-onboarding-done`/`core-all-modules-celebrated` como `true`; tratar igual ao fluxo guest (calcular `pendingModules`, mostrar `QuickStartOnboarding`).
- Limpar a flag quando o tutorial terminar (`handleOnboardingComplete`).

### 4. QuickStartOnboarding (`src/components/onboarding/QuickStartOnboarding.tsx`)
- Pular o passo de welcome ("Quero começar") sempre que o usuário **não** for convidado. Hoje `step` inicial é `skipWelcome || allDone ? 1 : 0`; trocar para `(skipWelcome || allDone || !isGuest) ? 1 : 0`.
- Em `handleCelebrationDone`, quando o usuário **não** for guest, NÃO setar `quicksignup-pending` e NÃO disparar o modal de signup. Em vez disso, exibir um novo popup de celebração antes de chamar `onComplete()`.

### 5. Novo popup de celebração
Criar `src/components/onboarding/TutorialDonePopup.tsx` (modal simples com framer-motion):
- Título: "Parabéns! Você terminou o tutorial 🎉"
- Subtítulo: "Você desbloqueou o app. Aproveite seus 7 dias grátis."
- Botão único "Começar a usar" que fecha o popup e chama `onComplete()` (que leva ao Home final).

`QuickStartOnboarding` renderiza esse popup como overlay quando `allDone && !isGuest`, em vez de redirecionar imediatamente.

### 6. QuickSignupModal
Sem alterações no componente — ele só dispara via `quicksignup-pending` para guests, e o passo 4 garante que essa flag nunca seja setada para usuários já logados.

### Resumo do fluxo final
```
LP "Teste grátis" 
  → /auth?signup=1 (sem banner de guest)
  → Criar conta (sessão criada)
  → /inicio com flag force-new-user-tutorial
  → QuickStartOnboarding direto no passo "Por onde você quer começar?"
  → Pick módulo → spotlight no módulo → volta → repete até completar
  → Popup "Parabéns! Você terminou o tutorial. Aproveite seu teste grátis"
  → Home final
```

### Pontos técnicos
- `force-new-user-tutorial` fica em `useUserData` (Supabase user_data), então sobrevive ao reload.
- `QuickSignupModal` continua montado globalmente, mas inerte para usuários logados (passo 4).
- O fluxo guest atual (sem conta) permanece inalterado.