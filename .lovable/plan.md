## Problema

Hoje `/` redireciona direto para `/financas`, então o usuário nunca vê a tela "Organize sua vida financeira". Além disso, o tutorial começa apontando para o Dashboard — mas o usuário já está nele, então a primeira seta não faz sentido.

## Mudanças

### 1. `src/App.tsx` — RootGate na rota `/`

Trocar `<Route path="/" element={<Navigate to="/financas" replace />} />` por um componente `RootGate` que decide o que renderizar:

- Se `loading` do auth: tela vazia (já é o padrão do ProtectedRoute).
- Se **não logado**: renderiza `<WelcomeScreen />` (mesma da `/inicio`).
- Se **logado** e `spotlight-done-financas === true` no `useUserData`: `<Navigate to="/financas" replace />`.
- Se **logado** e tutorial ainda não concluído: renderiza `<WelcomeScreen />` também — assim o fluxo "Quero começar → signup → tutorial" continua valendo, e quem já passou pelo tutorial vai direto pro app.

Observação: `WelcomeScreen.handleStart` já manda pra `/auth?signup=1`. Para usuários já logados que ainda não completaram o tutorial, vamos ajustar o `handleStart` para detectar `user` e ir direto pra `/financas` em vez de `/auth`.

### 2. `src/components/WelcomeScreen.tsx` — handleStart consciente de auth

Importar `useAuth`. No `handleStart`:
- Se `user` existe → `window.location.href = "/financas"`.
- Caso contrário → comportamento atual (`/auth?signup=1`).

### 3. `src/pages/Index.tsx` — primeiro passo do tutorial vira "Meu Financeiro"

No array `steps` do spotlight de finanças, remover o passo atual #1 (Dashboard) e colocar como passo inicial um apontando para a aba **Meu Financeiro** (`data-spotlight="financeiro"`), com cópia tipo:

> "Aqui é o seu Meu Financeiro — onde você lança receitas, custos fixos, contas e anotações do mês."

Os outros 12 passos permanecem iguais e na mesma ordem.

## O que NÃO muda

- Cópia do Welcome ("Organize sua vida financeira").
- Signup com campo Nome.
- Demais passos do tutorial e atributos `data-spotlight`.
- Rotas dos outros módulos, Home em `/home`, `/inicio` continua existindo.
- Chave `spotlight-done-financas` (sem replay forçado).
