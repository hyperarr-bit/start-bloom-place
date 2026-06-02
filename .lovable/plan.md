## Objetivo

Voltar o fluxo de entrada do app pros 6 slides do `WelcomeScreen` (rota `/inicio`) antes de cair no passo 1 ("Adicione sua receita") do tutorial em `/financas`. Hoje o `/` redireciona direto pra `/financas`, pulando os slides — inclusive quando o usuário do TikTok clica em "Abrir no navegador".

## O que muda

### 1. `src/App.tsx` — `RootGate`

Hoje:
```ts
const RootGate = () => {
  return <Navigate to="/financas" replace />;
};
```

Trocar por: usuário logado → `/financas`; visitante (sem sessão) → `/inicio` (onde já moram os 6 slides do `WelcomeScreen`). Usa `useAuth()` que já existe.

```ts
const RootGate = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/financas" : "/inicio"} replace />;
};
```

### 2. `src/components/AccessGateUI.tsx` — link do navegador (gate TikTok)

Hoje o link "Abrir no navegador" e o "Copiar link" usam `/financas`, então o usuário do TikTok pula os slides. Trocar pra raiz `/`, que vai cair no `RootGate` e levar pro `/inicio` (slide 1).

```ts
const url = `${window.location.origin}/`;
```

(Mantém o `RootGate` como ponto único de decisão; assim usuário já logado que abre o link também é direcionado certo.)

### 3. Nada muda no WelcomeScreen

`src/components/WelcomeScreen.tsx` já tem os 6 slides e o último (`SlideSixHero` — "Comece pela sua primeira receita") já chama `finish()` que redireciona pra `/financas`, onde o `SpotlightOverlay` do `Index.tsx` mostra o passo 1 "Adicione sua receita (salário, freelas...)".

## Fluxo final

```text
TikTok → AccessGateUI ("Abrir no navegador")
       → /  (RootGate)
       → /inicio  (6 slides do WelcomeScreen)
       → último slide: "Começar agora"
       → /financas  (SpotlightOverlay passo 1: Adicione sua receita)
```

## Arquivos tocados

- `src/App.tsx` (apenas o `RootGate`)
- `src/components/AccessGateUI.tsx` (apenas a `url`)

Nada de backend, nada de admin, nada nos cards do app.
