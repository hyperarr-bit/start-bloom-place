

# Plano: Melhorar WelcomeScreen

## Mudancas

### 1. `src/components/WelcomeScreen.tsx`

**Logo**: Remover o icone `Brain`. Manter apenas `<h1>CORE</h1>` centralizado.

**Video dentro do iPhone**: Substituir todo o conteudo fake (MOCK_SCREENS, AnimatePresence com cards) por um `<video>` real tocando em loop dentro do frame do iPhone. O video sera copiado do upload do usuario para `public/videos/app-preview.mp4` e referenciado via `staticFile` ou path direto.

**Frame do iPhone mais realista**: Atualizar o CSS do mockup para parecer um iPhone real:
- Bordas mais grossas e arredondadas (como iPhone 15)
- Dynamic Island no topo (pilula preta centralizada, nao notch oval)
- Sombra mais pronunciada
- Barra inferior (home indicator) mais fiel
- Proporcoes corretas (~9:19.5 aspect ratio)
- Fundo preto no frame (como iPhone real)

**Remover**: Array `MOCK_SCREENS`, imports de icones nao usados (DollarSign, Dumbbell, etc.), dots indicator, logica de `currentScreen`.

### 2. Copiar video do usuario

Copiar `user-uploads://ScreenRecording_04-08-2026_20-49-38_1-2.mp4` para `public/videos/app-preview.mp4`.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `public/videos/app-preview.mp4` | Criar (copiar upload) |
| `src/components/WelcomeScreen.tsx` | Reescrever (remover Brain, mock screens; adicionar video real, iPhone realista) |

