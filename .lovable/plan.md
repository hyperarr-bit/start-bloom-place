# Ajustes finais no mockup do iPhone (WelcomeScreen)

Alterações concentradas em `src/components/WelcomeScreen.tsx` e geração de um novo poster a partir do vídeo.

## 1. Tamanhos e insets separados (mobile vs desktop)

Hoje mobile e desktop compartilham os mesmos insets percentuais. Vou separar para permitir ajuste fino:

- **Mobile** (`w-[230px]`): insets `top: 13.4%`, `bottom: 13.4%`, `left: 19.6%`, `right: 19.6%`, `borderRadius: 9%`
- **Desktop** (`md:w-[300px]`): insets via classes responsivas (`md:top-[13.2%] md:bottom-[13.2%] md:left-[19.4%] md:right-[19.4%] md:rounded-[9.5%]`)

Vídeo sempre `object-cover` + `inset-0` dentro do container, garantindo centralização independente do tamanho.

## 2. Loop garantido sem travar

Além do atributo `loop`, adicionar listener `onEnded` que força:
```ts
video.currentTime = 0;
video.play().catch(() => setVideoState("blocked"));
```
Isso cobre casos (iOS Safari principalmente) onde o `loop` nativo falha após perda de foco/visibilidade.

Também adicionar listener `onPause` que tenta retomar automaticamente se a pausa não foi causada pelo usuário (quando `videoState === "playing"` e a aba está visível).

## 3. Poster = primeira frame do vídeo

Gerar um novo `app-preview-poster.jpg` extraindo a frame em `00:00:00.1` do `public/videos/app-preview.mp4` com ffmpeg, sobrescrevendo o atual. Assim a tela inicial mostra exatamente o que o vídeo vai começar a exibir, sem "salto" visual.

O poster continua sobreposto via `<img>` e some com `opacity-0` quando `videoState === "playing"` (transição 500ms já existente).

## 4. Botão de play manual quando autoplay falha

Quando `videoState === "blocked"` (ou `"error"`), exibir um botão sobreposto e centralizado dentro da moldura:

- Ícone `Play` (lucide-react) dentro de um círculo `bg-background/80 backdrop-blur` com `border`
- Tamanho `w-14 h-14`, sombra suave
- `aria-label="Tocar vídeo"`
- Ao clicar: chama `attemptPlay()` e impede propagação para o overlay externo

Quando `videoState === "loading"`, mostrar um spinner discreto (mesmo container, ícone `Loader2 animate-spin`).

Quando `playing`, nenhum overlay.

## Arquivos afetados

- `src/components/WelcomeScreen.tsx` — refator de insets responsivos, handlers `onEnded`/`onPause`, overlay de play/loading
- `public/videos/app-preview-poster.jpg` — regenerado a partir da 1ª frame do mp4

## Detalhes técnicos

- Sem mudança de API do componente (`onComplete`, `onLogin` permanecem)
- Sem novas dependências (Play e Loader2 já vêm do `lucide-react` usado no projeto)
- Mantém `playsInline`, `muted`, `webkit-playsinline`, `preload="auto"` para máxima compatibilidade iOS
- O clique no botão de play usa `e.stopPropagation()` para não disparar `handleScreenTap` do wrapper
