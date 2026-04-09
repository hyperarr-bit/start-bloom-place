

# Plano: Reorganizar Fluxo de Onboarding

## Problema

O fluxo atual esta errado. Hoje:
1. Usuario abre o app → ProtectedRoute redireciona para `/auth` → login/cadastro
2. Apos login, vai para Home → WelcomeScreen (iPhone animado) → OnboardingWizard (16 modulos)

O usuario quer:
1. Usuario abre o app → **WelcomeScreen (iPhone animado)** com botao "Comecar" e link "Ja tem conta? Entrar"
2. Clicando "Comecar" → vai para `/auth` (cadastro)
3. Clicando "Ja tem conta? Entrar" → vai para `/auth` (login)
4. Apos login/cadastro → Home com **OnboardingWizard** (16 modulos, "tudo em branco e intencional")
5. Visitas seguintes → direto para Home

## Mudancas

### 1. Mover WelcomeScreen para ANTES do auth

- Criar nova rota `/welcome` ou usar logica na rota `/auth`
- WelcomeScreen aparece em `/auth` apenas se usuario nao esta logado e nunca viu a tela (localStorage `core-welcome-done`)
- Adicionar botao "Comecar" que mostra o formulario de cadastro
- Adicionar link "Ja tem uma conta? Entrar" que mostra o formulario de login

### 2. Alterar `src/pages/Auth.tsx`

- Integrar WelcomeScreen como tela inicial antes do formulario
- Controlar estado: `welcome` → `auth-form`
- Usar localStorage para saber se ja viu (nao depende de Supabase pois usuario ainda nao esta logado)
- Botao "Comecar" → mostra formulario de cadastro (`isLogin = false`)
- Link "Ja tem conta? Entrar" → mostra formulario de login (`isLogin = true`)

### 3. Alterar `src/pages/Home.tsx`

- Remover WelcomeScreen daqui (linhas 64, 70-74 e o render condicional)
- Manter OnboardingWizard (16 modulos) — aparece apos primeiro login
- O OnboardingWizard continua usando `core-onboarding-done` via useUserData (Supabase)

### 4. Alterar `src/components/WelcomeScreen.tsx`

- Adicionar link "Ja tem uma conta? Entrar" abaixo do botao "Comecar"
- Prop `onComplete` vira navegacao para cadastro
- Nova prop `onLogin` para ir direto ao login

### 5. Alterar `src/components/home/AccountDrawer.tsx`

- "Rever tutorial" reseta `core-onboarding-done` (onboarding dos modulos) e tambem `core-welcome-done` no localStorage

## Fluxo final

```text
[App abre]
   |
   v
[Nao logado?] --sim--> [Ja viu welcome?]
   |                        |
   |no                    nao → WelcomeScreen (iPhone + "Comecar" + "Ja tem conta?")
   |                        |
   |                      sim → Auth form direto
   v
[Home] → [Primeiro acesso?] → OnboardingWizard (16 modulos)
         [Ja viu?] → Home normal
```

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/pages/Auth.tsx` | Integrar WelcomeScreen antes do formulario |
| `src/components/WelcomeScreen.tsx` | Adicionar link "Ja tem conta? Entrar", usar localStorage |
| `src/pages/Home.tsx` | Remover WelcomeScreen, manter apenas OnboardingWizard |
| `src/components/home/AccountDrawer.tsx` | Ajustar reset do tutorial |

