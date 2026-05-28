## Objetivo

Remover a tela inicial "Tenha controle da sua vida financeira" (WelcomeScreen) e fazer o app abrir já no passo 1 do onboarding ("Organize sua vida em 1 só lugar" com o botão "Quero começar").

## Mudança

**`src/App.tsx` — `RootGate`**

Trocar `<WelcomeScreen />` por `<QuickStartOnboarding />` para visitantes não logados (e usuários logados que ainda não passaram pelo spotlight de finanças).

- Importar `QuickStartOnboarding` em vez de `WelcomeScreen`.
- Renderizar `<QuickStartOnboarding onComplete={() => {}} />` no fallback do gate.
- Usuários logados que já concluíram (`spotlight-done-financas`) continuam sendo redirecionados para `/financas`.

O componente `QuickStartOnboarding` já cuida sozinho de:
- mostrar o passo 1 (logo CORE + "Organize sua vida em 1 só lugar" + "Quero começar")
- avançar para a escolha de módulo
- disparar `landing_view` / `pre_signup_tutorial_started` (mantendo o funil intacto)
- abrir o `QuickSignupModal` para visitantes ao final

## Fora do escopo

- `WelcomeScreen.tsx` e `pages/Inicio.tsx` permanecem no projeto (a rota `/inicio` continua existindo); só deixam de ser a porta de entrada do app. Posso remover depois se você quiser limpar.
- Nenhuma mudança de lógica de auth, trial ou tracking.