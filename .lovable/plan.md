
Objetivo: resolver de forma robusta o autoplay da WelcomeScreen no mobile e eliminar o botão/play overlay e a tela preta inicial.

1. Diagnóstico do problema
- O código atual tenta `video.play()` no `useEffect`, mas isso continua sujeito às regras do Safari/iOS.
- O asset atual veio de um `.mov` e foi tratado como `app-preview.mp4`; isso pode significar container/codec incompatível ou não otimizado para streaming/autoplay.
- A tela preta vem da ausência de `poster`/fallback visual enquanto o vídeo carrega.
- Há um warning de `AnimatePresence` passando `ref` para `WelcomeScreen`, o que pode atrapalhar o ciclo de montagem.
- Mesmo sem `controls`, o iPhone/Safari pode mostrar overlay de play quando o vídeo está pausado ou bloqueado.

2. Solução definitiva que vou implementar
- Normalizar o vídeo para um MP4 real e compatível com iPhone/Safari:
  - H.264 + AAC
  - `yuv420p`
  - `+faststart` para carregar o começo imediatamente
- Gerar uma imagem `poster` do primeiro frame para nunca aparecer tela preta.
- Ajustar a WelcomeScreen para trabalhar com estados claros:
  - `loading`
  - `autoplay-ok`
  - `autoplay-blocked`
  - `error`
- Tentar autoplay em múltiplos momentos corretos:
  - assim que montar
  - em `loadedmetadata`
  - em `canplay`
  - em `playing`
  - quando a aba voltar a ficar visível (`visibilitychange`)
- Configurar o vídeo com atributos mais seguros para mobile:
  - `autoPlay`
  - `muted`
  - `defaultMuted`
  - `playsInline`
  - `preload="auto"`
  - `<source type="video/mp4">`
  - `disablePictureInPicture`
  - `pointer-events-none` no vídeo para evitar interação visual indesejada
- Se o navegador bloquear autoplay mesmo assim:
  - esconder o overlay do vídeo mantendo o `poster` visível
  - registrar um “primeiro toque” na tela inteira para disparar `play()` via gesto real do usuário sem exigir apertar o botão do player
  - isso remove a dependência do botão/play nativo
- Corrigir o warning do Framer Motion:
  - remover o `AnimatePresence` direto em volta de `<WelcomeScreen />` no `Auth.tsx`, ou envolver a WelcomeScreen num `motion.div`
  - isso limpa o erro de `ref` e deixa a montagem previsível

3. Arquivos que vou ajustar
- `src/components/WelcomeScreen.tsx`
  - refatorar a lógica de autoplay/fallback
  - adicionar `poster`
  - adicionar listeners de readiness/visibility
  - esconder estado pausado com fallback elegante
- `src/pages/Auth.tsx`
  - corrigir o uso de `AnimatePresence` com `WelcomeScreen`
- `public/videos/app-preview.mp4`
  - substituir por versão realmente compatível e otimizada
- `public/videos/app-preview-poster.jpg` (ou `.webp`)
  - novo poster para eliminar a tela preta

4. Resultado esperado
- Em navegadores que permitem autoplay: o vídeo já entra rodando.
- Em Safari/iPhone com bloqueio eventual: o usuário não vê tela preta nem botão/play nativo; vê o frame inicial limpo e o vídeo começa no primeiro toque válido da tela.
- O warning de console desaparece.
- A experiência fica consistente na preview, aba anônima e versão publicada.

5. Validação final
- Testar no preview mobile
- Testar em Safari/aba anônima
- Testar primeira carga sem cache
- Publicar a versão atualizada e validar no domínio publicado
