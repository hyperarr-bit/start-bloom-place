

# Plano: Animação de entrada do iPhone igual ao vídeo de referência

## O que muda

A animação atual do iPhone é tímida — começa com `y: 80, scale: 0.8`. O vídeo de referência mostra o iPhone **subindo de fora da tela** (completamente abaixo) com uma animação suave e dramática, como nas apresentações da Apple.

## Mudança em `src/components/WelcomeScreen.tsx`

**Animação do iPhone (motion.div que envolve o frame):**
- `initial`: Começar completamente fora da tela → `y: "100vh"`, `scale: 0.85`, `opacity: 0`
- `animate`: Subir até a posição final → `y: 0`, `scale: 1`, `opacity: 1`
- `transition`: Spring suave e elegante com `type: "spring"`, `stiffness: 60`, `damping: 18`, `delay: 0.3`, `duration: 1.2`
- Isso faz o iPhone deslizar de baixo da tela até o centro com um efeito de mola natural

**Logo "CORE":**
- Aparece com fade-in mais rápido (`delay: 0.1`) para estar visível quando o iPhone chega
- Leve scale de `0.95` → `1` para dar vida

**Botões (CTA):**
- Delay do `showButton` ajustado para `2500ms` (dar tempo da animação do iPhone completar)
- Animação de entrada com `y: 30` → `0` para acompanhar o movimento de baixo pra cima

## Arquivo

| Arquivo | Ação |
|---------|------|
| `src/components/WelcomeScreen.tsx` | Alterar animações de entrada |

