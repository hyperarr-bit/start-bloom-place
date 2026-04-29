# Corrigir redirect "localhost" após confirmar email — usar coreaplicativo.com.br

## Problema
Quando o usuário cria conta e clica em "Confirmar" no email, o Safari abre `localhost` e mostra "não pôde se conectar ao servidor". A conta É criada e confirmada — só o redirect final está errado.

## Causa
`src/hooks/use-auth.tsx` envia `emailRedirectTo: window.location.origin` no `signUp`. Se a conta foi criada a partir do preview ou ambiente local, esse valor é gravado no link do email — e ao clicar, o Supabase volta para esse host (localhost).

Além disso, a **Site URL** no Supabase provavelmente está configurada como `http://localhost:3000`, então mesmo links sem `redirect_to` válido caem nela.

## Domínio de produção (definitivo)
`https://www.coreaplicativo.com.br`

## Correções

### 1. Forçar o domínio de produção no redirect (código)
Criar helper `getAuthRedirectUrl(path?: string)` em `src/lib/utils.ts`:
- Se `window.location.hostname` for `localhost`, `127.0.0.1`, contiver `id-preview--`, `lovableproject.com` ou `lovable.app` → usar `https://www.coreaplicativo.com.br` como base.
- Caso contrário (já está no domínio real) → usar `window.location.origin`.
- Concatena o `path` opcional (ex.: `/update-password`).

Aplicar em:
- `src/hooks/use-auth.tsx` → `signUp` usa `emailRedirectTo: getAuthRedirectUrl()`
- `src/pages/ResetPassword.tsx` → `redirectTo: getAuthRedirectUrl('/update-password')`
- `src/components/home/AccountDrawer.tsx` → mesmo do reset

### 2. Configuração no Supabase (você precisa fazer manualmente)
Painel Supabase → **Authentication → URL Configuration**:

- **Site URL:**
  ```
  https://www.coreaplicativo.com.br
  ```

- **Redirect URLs (adicionar todas):**
  ```
  https://www.coreaplicativo.com.br/**
  https://coreaplicativo.com.br/**
  https://coreaplicativo.lovable.app/**
  https://id-preview--a6b9b632-5e9d-4f08-912f-dce2025b543a.lovable.app/**
  http://localhost:8080/**
  ```

Sem isso, mesmo que o código mande o redirect certo, o Supabase rejeita URLs fora da allow list e cai no fallback (Site URL).

## Resultado esperado
- Cadastros pelo site, preview ou local → email sempre leva para `https://www.coreaplicativo.com.br`.
- Reset de senha → mesma lógica, abre `/update-password` no domínio certo.
- Fim do erro "Safari não pôde se conectar ao servidor".

## Arquivos a editar
- `src/lib/utils.ts` (novo helper)
- `src/hooks/use-auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/components/home/AccountDrawer.tsx`

## Sua ação manual
Atualizar Site URL + Redirect URLs no painel Supabase conforme item 2. Sem esse passo, o código sozinho não resolve.
