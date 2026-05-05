## Problema

No TikTok WebView o vídeo não aparece (só o poster) e, quando aparece e o usuário fecha o player nativo, ele reabre sozinho.

Causa: hoje em WebView desligamos `autoPlay` e qualquer `play()` programático, então o vídeo nunca começa. E quando o usuário toca, o WebView do TikTok intercepta e abre o player nativo fullscreen — ao fechar, qualquer evento residual reabre.

## Solução em `src/components/WelcomeScreen.tsx`

1. **Voltar a tocar o vídeo inline também no TikTok**, mas de forma segura:
   - Manter `autoPlay`, `muted`, `playsInline`, `loop`, `preload="auto"` para todos os ambientes.
   - Manter o overlay `data-video-gesture-guard` (touch-none, pointer-events bloqueados) por cima do vídeo em TODOS os ambientes — isso impede que o toque chegue no `<video>` e dispare o player nativo do TikTok.
   - Remover a branch `isInAppWebView` que tirava `pointer-events` e o overlay.

2. **Blindar contra reabertura do player nativo** (caso o WebView ainda assim consiga abrir):
   - Manter `userDismissedRef` + listeners `webkitendfullscreen` / `fullscreenchange` / `webkitbeginfullscreen`.
   - Quando detectar saída do fullscreen: setar `userDismissedRef = true`, pausar, e a partir daí qualquer `tryPlay()` é ignorado (já está implementado, só estender pra rodar também em WebView).
   - Adicionar listener `webkitbeginfullscreen`: se disparar sem o usuário ter clicado no botão custom, chamar `v.pause()` imediatamente para abortar o player nativo.

3. **Botão de play custom** continua visível em todos os ambientes quando `!isVideoPlaying`, com os mesmos handlers que chamam `playPreviewVideo()` (que reseta `userDismissedRef`).

4. **Detecção `detectInAppWebView`**: mantida apenas como flag informativa, mas não usada mais para mudar o DOM/atributos do vídeo. O comportamento passa a ser único.

## Resultado esperado

- TikTok/Instagram: vídeo toca inline mutado em loop dentro do mockup, gestos bloqueados, player nativo não abre. Se em algum device específico ele tentar abrir, é abortado via `webkitbeginfullscreen` + pause.
- Safari/Chrome: continua igual, sem regressão.
