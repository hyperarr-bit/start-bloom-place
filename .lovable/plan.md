

## Diagnóstico: por que o autoplay continua falhando

Identifiquei **duas causas reais**:

### 1. Vídeo começa invisível (`opacity-0`)
O iOS Safari recusa autoplay de vídeos que estão visualmente ocultos. No código atual, o vídeo começa com `opacity-0` e só muda para `opacity-100` depois que `play()` resolve — mas o Safari nem tenta reproduzir porque o elemento está invisível. **Isso cria um ciclo impossível**: o vídeo só fica visível quando toca, mas só toca quando está visível.

### 2. AnimatePresence do App.tsx passa `ref` para WelcomeScreen
O console mostra "Function components cannot be given refs" — o `AnimatePresence` das rotas no `App.tsx` tenta passar ref para o componente, o que pode interferir no ciclo de montagem e atrasar o carregamento do vídeo.

## Solução

### `src/components/WelcomeScreen.tsx`
- **Manter o vídeo SEMPRE com `opacity-100`** — ele fica atrás do poster, nunca invisível para o iOS
- **Poster fica por cima** e desaparece (`opacity-0`) quando o vídeo começa a tocar
- Inverter a lógica de camadas: vídeo embaixo (z-0), poster em cima (z-10)
- Adicionar `forwardRef` para resolver o warning do AnimatePresence
- Adicionar listener `onPlaying` direto no elemento `<video>` como gatilho adicional para detectar reprodução

### Resultado
- O vídeo começa **sempre visível** para o browser → autoplay funciona
- O poster cobre o vídeo até ele começar → sem tela preta
- Se ainda bloquear (edge case raro), o toque em qualquer lugar da tela dispara play
- Warning do console desaparece

