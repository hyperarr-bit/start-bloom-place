## Objetivo

Trocar o final do tutorial: em vez de jogar o usuário na tela de login/signup tradicional (com confirmação de e-mail), mostrar uma celebração + um mini-formulário em 1 tela (nome → e-mail → senha) que cria a conta e já leva direto pro app.

---

## Fluxo novo

1. Usuário termina o tutorial (todos os módulos vistos OU clica "criar conta" no final).
2. Aparece a tela de **Celebração + Cadastro Rápido** (substitui o `handleCelebrationDone` que hoje redireciona pra `/auth?signup=1`).
3. Formulário em 3 campos curtos numa única tela:
  - Nome
  - E-mail
  - Senha (sem confirmação)
4. Ao clicar no CTA: cria conta no Supabase, salva nome no `user_data`, migra dados do guest, e redireciona direto pra `/inicio` (ou rota do módulo escolhido).
5. Se já houver sessão (login social, etc), pula direto pro app.

---

## Copy proposta (pra você validar antes)

**Título (topo da tela):**

> Parabéns! Você desbloqueou o Aplicativo completo 🎉

**Subtítulo:**

> Falta só 1 passo pra salvar tudo que você configurou e começar a usar de verdade.

**Labels dos campos:**

- "Como podemos te chamar?" — placeholder: *Seu primeiro nome*
- "Seu melhor e-mail" — placeholder: *[voce@email.com](mailto:voce@email.com)*
- "Crie uma senha" — placeholder: *Mínimo 8 caracteres, com letras e números*

**CTA principal:**

> Criar conta e entrar 100% grátis  →

**Linha de apoio embaixo do botão (micro-copy):**

> Sem confirmação por e-mail. Você entra direto.

**Link discreto no rodapé:**

> Já tem conta? **Entrar**

**Toast de sucesso (ao criar):**

> Tudo pronto, {nome}! Bem-vindo ao CORE.

**Erros amigáveis:**

- E-mail já existe → "Esse e-mail já tem conta. Quer entrar?"
- Senha fraca → "Use pelo menos 8 caracteres, com letras e números."

---

## Mudanças técnicas

### 1. Novo componente `src/components/onboarding/QuickSignupStep.tsx`

- Recebe `onDone()`.
- 3 inputs (nome, email, senha) + botão.
- Chama `supabase.auth.signUp({ email, password, options: { data: { display_name: nome }, emailRedirectTo: window.location.origin } })`.
- Após sucesso, salva nome em `user_data` (chave `profile-name` via `useUserData.set`), dispara `trackEvent("quicksignup_completed")`, e chama `onDone()`.
- Lida com erro "User already registered" → mostra link "Entrar" que vai pra `/auth`.

### 2. `src/components/onboarding/QuickStartOnboarding.tsx`

- Adicionar novo step (`step = 2`) que renderiza `<QuickSignupStep />` quando `isGuest && allDone` no lugar de redirecionar pra `/auth?signup=1`.
- `handleCelebrationDone`: se `isGuest`, em vez de `navigate("/auth?...")`, faz `setStep(2)`.
- Após o signup concluir, navegar para `/inicio` (ou módulo escolhido se houver `quickstart-target-module`).

### 3. Confirmação de e-mail

- Pré-requisito: **desabilitar "Confirm email"** em Supabase → Authentication → Providers → Email.
- Vou avisar o usuário pra fazer isso (1 toggle no dashboard). Sem isso, o `signUp` não cria sessão imediata e o login direto não funciona.

### 4. Migração de dados do guest

- O fluxo de migração já existe no `useUserData` ao detectar login. Como o `signUp` (sem confirmação) já cria sessão na hora, a migração roda automaticamente. Nenhum código novo aqui.

---

## Fora de escopo

- Não mexer no `/auth` tradicional (continua funcionando pra quem já tem conta).
- Não trocar o `PreSignupTutorial` (slides) — só o final pós-celebração.
- Sem mudança no Google OAuth.

---

## Pergunta antes de implementar

A copy acima tá boa ou quer ajustar algum trecho (mais informal, mais curta, etc)?