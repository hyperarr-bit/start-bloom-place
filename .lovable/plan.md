## Problema

1. Clicar em "Quero começar" manda pra `/auth?signup=1` em vez de levar pro tutorial de finanças. A ordem correta combinada antes é: **Quero começar → tutorial de finanças (como guest) → no fim, signup (nome + email + senha) → usar o app**.
2. Proporções da `WelcomeScreen` no viewport 430x697 estão estranhas (logo enorme, espaços desbalanceados pra mobile).

## Mudanças

### 1. `src/components/WelcomeScreen.tsx` — handleStart vai pro tutorial

- Remover a checagem de `useAuth` no `handleStart`.
- `handleStart` sempre faz `window.location.href = "/financas"` (com `?tutorial=1` se precisar forçar replay, mas a chave `spotlight-done-financas` já controla isso pra primeira visita).
- Manter "Já tem conta? Entrar" indo pra `/auth`.

### 2. `src/pages/Index.tsx` — signup no fim do tutorial

No último passo do spotlight de finanças (atualmente o 12º), no `onExit`/`onComplete`, se o usuário **não estiver logado**, redirecionar pra `/auth?signup=1` (com a mensagem "Tudo que você configurou no tutorial será salvo na sua conta", que já existe na tela de Auth). Se já estiver logado, fica no `/financas` normalmente.

### 3. `src/components/WelcomeScreen.tsx` — ajustar proporções mobile

- Reduzir logo no mobile: `w-24 h-24 md:w-32 md:h-32` (em vez de `w-32 h-32 md:w-40 md:h-40`).
- Trocar `justify-between` por layout mais controlado: padding-top menor (`pt-16`), conteúdo central com `gap-8`, CTAs com `mt-auto pb-8`.
- Garantir que título + tagline + CTA cabem sem scroll em 430x697.

## O que NÃO muda

- Cópia "Organize sua vida financeira".
- Fluxo de signup (campo Nome, validação, etc.).
- Passos do tutorial e `data-spotlight`.
- `RootGate` em `/` (continua mostrando Welcome pra quem não terminou o tutorial e redirecionando os que já terminaram pra `/financas`).
