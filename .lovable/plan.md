

# Plano: Forçar autoplay do vídeo

## Problema
Em dispositivos móveis (especialmente Safari/iOS), mesmo com `autoPlay`, `muted` e `playsInline`, o vídeo pode não iniciar automaticamente. É necessário forçar o `.play()` via JavaScript.

## Mudança

### `src/components/WelcomeScreen.tsx`
- Adicionar um `useRef` no elemento `<video>`
- No `useEffect`, chamar `videoRef.current.play()` para garantir que o vídeo inicie sem interação do usuário
- Manter os atributos `autoPlay`, `loop`, `muted`, `playsInline` como fallback

