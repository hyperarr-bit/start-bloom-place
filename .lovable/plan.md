## Plano

1. Remover os bloqueios globais de gesto em `src/main.tsx`
   - Tirar os listeners de `gesturestart`, `gesturechange` e `gestureend` que fazem `preventDefault()`.
   - Tirar os bloqueios de `wheel` com `ctrlKey` e atalhos de zoom do teclado.
   - Tirar o bloqueio de duplo toque, porque ele também interfere em gestos nativos do navegador.

2. Ajustar CSS global em `src/index.css`
   - Remover a regra global `touch-action: pan-x pan-y` do `html`.
   - Remover `-ms-content-zooming: none`.
   - Manter `touch-action: manipulation` só nos elementos interativos se não atrapalhar navegação; se ainda travar, remover também.

3. Tirar comportamento de app instalado/PWA em `index.html` e `public/manifest.json`
   - Remover metas `apple-mobile-web-app-capable` e `mobile-web-app-capable`, que fazem o site se comportar como app em alguns celulares.
   - Trocar `display: "standalone"` para `display: "browser"`, para abrir como site normal com abas do navegador.

Resultado esperado: a pinça/gesto de sair da tela do app e mostrar abas do navegador volta a funcionar, e o site deixa de tentar prender o usuário em modo app.