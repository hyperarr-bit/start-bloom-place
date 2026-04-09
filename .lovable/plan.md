

# Plano: Substituir mock screens pelo vídeo real do app

## Resumo

Substituir todo o conteúdo fake (mock screens, AnimatePresence, ícones) dentro do iPhone por um `<video>` com o vídeo enviado pelo usuário. O vídeo já contém a Dynamic Island (com indicador de gravação vermelho), então o frame do iPhone NÃO deve adicionar uma Dynamic Island própria — o vídeo já cobre isso.

## Mudanças

### 1. Copiar vídeo para `public/videos/app-preview.mp4`

Copiar `user-uploads://copy_ADA6DC93-25DF-4AE6-BC9B-941F009B092D.mov` para `public/videos/app-preview.mp4`.

### 2. Reescrever `src/components/WelcomeScreen.tsx`

- **Remover**: Todos os mock screens (HomeScreen, FinanceScreen, HealthScreen, HabitsScreen), array SCREENS, lógica de `currentScreen`, dots indicator, bottom nav bar, imports de ícones não usados
- **Remover Dynamic Island**: O vídeo já tem a Dynamic Island visível, não precisa de overlay
- **Adicionar**: Tag `<video>` com autoPlay, loop, muted, playsInline dentro do frame do iPhone
- **Proporção**: O vídeo é uma gravação de iPhone (aspect ratio ~9:19.5 / 1170x2532px). O frame vai usar `w-[240px]` e calcular a altura proporcional (~520px) para que o vídeo preencha 100% sem cortes. O `<video>` usa `object-fit: cover` e `border-radius` matching o frame
- **Frame simplificado**: Apenas a borda preta do iPhone (rounded corners, sombra) + home indicator. Sem Dynamic Island artificial
- **Manter**: Logo "CORE", subtítulo, botões "Começar" e "Já tem conta?", animação de entrada do iPhone

## Arquivos

| Arquivo | Ação |
|---------|------|
| `public/videos/app-preview.mp4` | Criar (copiar upload) |
| `src/components/WelcomeScreen.tsx` | Reescrever (vídeo real, sem mocks) |

