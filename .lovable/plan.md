

# Plano: Tela de Boas-Vindas com iPhone Animado

## Resumo

Criar uma tela fullscreen de boas-vindas que aparece **apenas na primeira vez** que o usuário acessa o app (antes do onboarding). Um mockup de iPhone aparece com animação e dentro dele roda uma animação simulando telas do app (módulos, widgets, cards). Ao final, um botão "Começar" leva ao onboarding existente.

## Fluxo

```text
1º acesso → WelcomeScreen (iPhone animado) → Botão "Começar"
         → OnboardingWizard → Home

2º acesso em diante → Home (direto)
```

## Mudanças

### 1. Criar `src/components/WelcomeScreen.tsx`

- Tela fullscreen com fundo gradiente escuro (usando tokens CSS)
- Texto "Bem-vindo ao CORE" com fade-in
- Subtítulo "Organize toda a sua vida em um só lugar"
- Mockup de iPhone feito com CSS (bordas arredondadas, notch, moldura) — sem imagem externa
- Dentro do iPhone: animação automática que simula scroll entre "telas" do app (cards coloridos representando módulos: Finanças, Treino, Saúde, etc.) usando Framer Motion
- As "telas" fazem transição vertical automática a cada ~2s
- O iPhone entra com animação de scale + slide-up (spring)
- Botão "Começar" aparece após ~3s com fade-in
- Ao clicar "Começar", salva `core-welcome-done: "true"` via `useUserData` e chama `onComplete()`

### 2. Alterar `src/pages/Home.tsx`

- Adicionar estado `showWelcome` baseado em `get("core-welcome-done", "") === ""`
- Renderizar `<WelcomeScreen>` antes do `<OnboardingWizard>` quando `showWelcome === true`
- Quando WelcomeScreen completa → mostrar OnboardingWizard (se primeiro acesso)
- Fluxo: Welcome → Onboarding → Home

### 3. Ajustar `src/components/home/AccountDrawer.tsx`

- Na opção "Rever tutorial", também resetar `core-welcome-done` para que o usuário possa rever a tela de boas-vindas

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/WelcomeScreen.tsx` | Criar |
| `src/pages/Home.tsx` | Alterar (adicionar WelcomeScreen) |
| `src/components/home/AccountDrawer.tsx` | Alterar (resetar welcome no "Rever tutorial") |

