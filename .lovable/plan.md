## Objetivo
Quando o usuário clicar no link de confirmação enviado por e-mail, ele deve cair direto na **Home (`/`)** já logado — nunca mais na tela de "Criar conta" / "Confirme seu e-mail".

## Causa do problema
Hoje o `emailRedirectTo` aponta para `/`, mas:
1. A **Site URL** no painel do Supabase pode estar apontando para `/auth` ou `/inicio`, e o Supabase usa a Site URL como fallback quando o `redirect_to` não está na allow-list.
2. Mesmo quando cai em `/`, o app não tem um handler explícito para os tokens de confirmação que vêm no hash da URL (`#access_token=...&type=signup`), então em alguns casos o `AuthProvider` ainda não terminou de processar a sessão antes de qualquer outro redirect.

## Mudanças

### 1. Criar rota dedicada `/auth/callback`
Novo arquivo `src/pages/AuthCallback.tsx`:
- Lê os tokens do `window.location.hash` (`access_token`, `refresh_token`, `type`).
- Chama `supabase.auth.setSession({ access_token, refresh_token })` para garantir que a sessão fique persistida antes de navegar.
- Mostra um loader curto ("Confirmando sua conta...").
- Após sucesso → `navigate("/", { replace: true })`.
- Em erro → `navigate("/auth", { replace: true })` com toast.

Registrar a rota em `src/App.tsx` como pública (fora do `ProtectedRoute`).

### 2. Apontar o `emailRedirectTo` para o callback
Em `src/hooks/use-auth.tsx`, no `signUp`:
```ts
options: { emailRedirectTo: getAuthRedirectUrl("/auth/callback") }
```

### 3. Mesmo tratamento para Google OAuth (consistência)
Em `src/pages/Auth.tsx`, no `signInWithOAuth({ provider: "google" })`, trocar o `redirectTo` para `getAuthRedirectUrl("/auth/callback")` — o callback já joga em `/`.

### 4. Garantir que `/` aceite usuário recém-confirmado
A rota `/` já usa `ProtectedRoute allowGuest`, então não precisa mudar — assim que a sessão for setada no callback, o `AuthProvider` atualiza e a Home renderiza normalmente.

## Ação manual necessária pelo usuário (fora do código)
No painel do Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://www.coreaplicativo.com.br`
- **Redirect URLs** (allow-list): adicionar
  - `https://www.coreaplicativo.com.br/auth/callback`
  - `https://www.coreaplicativo.com.br/`
  - `https://coreaplicativo.lovable.app/auth/callback` (preview publicado)

Sem isso, o Supabase ignora o `emailRedirectTo` e usa a Site URL.

## Arquivos afetados
- `src/pages/AuthCallback.tsx` (novo)
- `src/App.tsx` (nova rota pública)
- `src/hooks/use-auth.tsx` (signUp redirect)
- `src/pages/Auth.tsx` (Google OAuth redirect)