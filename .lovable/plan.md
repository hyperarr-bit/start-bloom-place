## O que muda

Voltar pro fluxo antigo (4-módulo picker → tutorial in-app → signup 7 dias → home), mantendo as melhorias visuais já feitas. Logado abre na Home (16 módulos), não mais direto no Finanças. No header do Finanças, troco o ícone de perfil por um voltar.

## Passos

### 1. `src/App.tsx` — RootGate
- Logado: `<Navigate to="/home" replace />` (era `/financas`).
- Convidado (sem login): renderizar `<Navigate to="/home" replace />` no lugar de `<WelcomeScreen />`. Como `/home` é `allowGuest`, ele cai no Home, e o `QuickStartOnboarding` já existente assume o picker dos 4 módulos automaticamente (pendingModules calculado por `spotlight-done-*`).
- Remover o import de `WelcomeScreen` no App.tsx (não é mais usado em lugar nenhum).

### 2. `src/pages/Index.tsx` (Finanças) — botão voltar
No header (linhas ~157-168), trocar:
- O botão com `Menu` que abre `AccountDrawer` → por um botão com `ArrowLeft` que faz `navigate("/home")`.
- Remover o `<AccountDrawer ... />` e o state `menuOpen` deste arquivo (e os imports `Menu`, `AccountDrawer`, `useUserData`'s `displayName` se ficar órfão — manter `useUserData` pois é usado em outros pontos).
- Manter todo o resto da página intacto (tabs, spotlight, etc.).

### 3. Tutorial dos 4 módulos
Já existe e funciona via `QuickStartOnboarding` em `src/pages/Home.tsx` (mostra picker → navega pro módulo escolhido → SpotlightOverlay roda → QuickSignupModal aparece pra convidados). Nenhuma mudança de código aqui, só passa a aparecer porque RootGate agora joga todo mundo em `/home`.

### 4. Arquivos não usados
- `src/pages/Inicio.tsx` e `src/components/welcome/PreSignupTutorial.tsx`: não vou tocar (Inicio ainda é rota `/inicio` no App.tsx — deixo como está pra não quebrar links salvos; PreSignupTutorial não é importado em lugar nenhum, mas também não tira pra não causar diff fora do escopo). Idem `WelcomeScreen` (fica como arquivo morto mas sem import).

## Detalhes técnicos

- `/home` já é `<ProtectedRoute allowGuest>`, então convidado pode entrar.
- `QuickStartOnboarding` salva `quickstart-target-module` e navega pra rota do módulo escolhido. Ao fim do `SpotlightOverlay` em Finanças, `isGuest` dispara `quicksignup-pending=true` (já está no Index.tsx linhas 132-139), e `QuickSignupModal` global mostra o cadastro com 7 dias.
- Logado: `RootGate` → `/home` → `useEffect` em Home seta `core-onboarding-done=true` e não mostra picker (linhas 91-102 de Home.tsx). Cai direto no grid dos 16 módulos via `ModuleDrawer`.

## Fora de escopo

- Não mexer no `WelcomeScreen` em si (fica como arquivo não usado).
- Não mexer em `PreSignupTutorial`.
- Não mexer em nenhum outro módulo além do header do Finanças.
