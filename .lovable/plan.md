

# Plano: Corrigir autoplay e tela preta do vídeo

## Problemas

1. **Autoplay não funciona no mobile**: O `.play()` é chamado no mount, mas o vídeo pode ainda não estar carregado. No Safari/iOS, o vídeo precisa estar pronto (`canplay` event) antes de chamar `.play()`.
2. **Tela preta nos primeiros segundos**: O vídeo demora a carregar e mostra fundo preto. Solução: usar um poster (primeiro frame) ou mostrar um placeholder enquanto o vídeo não está pronto.

## Mudanças em `src/components/WelcomeScreen.tsx`

### Autoplay robusto
- Escutar o evento `canplay` ou `loadeddata` no `<video>` antes de chamar `.play()`
- Adicionar retry com `setInterval` — tentar `.play()` a cada 200ms até conseguir (max 10 tentativas)
- Adicionar atributo `preload="auto"` para forçar o carregamento imediato

### Eliminar tela preta
- Adicionar estado `videoReady` (default `false`)
- Enquanto `videoReady === false`, mostrar um fundo cinza claro ou skeleton dentro do frame do iPhone (em vez de `bg-black`)
- Quando o evento `onCanPlay` ou `onLoadedData` disparar, setar `videoReady = true` e chamar `.play()`
- Usar transição suave de opacidade no vídeo (opacity 0 → 1 quando ready)

### Código resumido
```tsx
const [videoReady, setVideoReady] = useState(false);
const videoRef = useRef<HTMLVideoElement>(null);

useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  
  const tryPlay = () => {
    video.play().catch(() => {});
  };

  if (video.readyState >= 3) {
    setVideoReady(true);
    tryPlay();
  } else {
    video.addEventListener('canplay', () => {
      setVideoReady(true);
      tryPlay();
    }, { once: true });
  }
  
  // Fallback: retry every 300ms
  const interval = setInterval(() => {
    if (video.readyState >= 3) {
      setVideoReady(true);
      tryPlay();
      clearInterval(interval);
    }
  }, 300);
  
  return () => clearInterval(interval);
}, []);
```

Vídeo com `opacity: videoReady ? 1 : 0` e transição CSS, fundo do frame muda de `bg-black` para `bg-muted` até o vídeo estar pronto.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/WelcomeScreen.tsx` | Alterar (autoplay robusto + eliminar tela preta) |

