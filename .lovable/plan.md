Você tem razão. O erro foi tentar tratar TikTok como Safari normal e ainda colocar camada/botão por cima do vídeo. No TikTok o player é controlado pelo WebView/app, então não dá para forçar a mesma experiência inline do Safari sem brigar com o player nativo.

Plano para corrigir:

1. Detectar ambiente corretamente
   - Criar uma detecção simples de navegador:
     - Safari/iOS normal: pode usar vídeo inline com autoplay mudo dentro do mockup.
     - TikTok/in-app WebView: mantém o vídeo, mas deixa o player nativo do TikTok/iOS cuidar da abertura.

2. Separar o comportamento do vídeo
   - No Safari/browser normal:
     - manter `autoPlay`, `muted`, `loop`, `playsInline` e o vídeo tocando dentro do iPhone.
     - manter uma UI mínima só se o autoplay falhar.
   - No TikTok:
     - remover autoplay programático (`v.play()` automático, `canplay`, `loadeddata`).
     - remover a camada invisível por cima (`gesture guard`).
     - remover o botão custom por cima do vídeo.
     - deixar o próprio `<video>` receber o clique/toque do usuário e abrir o player nativo uma única vez.

3. Corrigir o loop de reabertura
   - Quando o usuário sair do player nativo (`webkitendfullscreen`), pausar o vídeo e marcar que ele foi fechado.
   - No TikTok, depois disso, não tentar reproduzir de novo automaticamente em nenhum evento de carregamento/estado.
   - Só tocar de novo se o usuário tocar diretamente no vídeo.

4. Ajustar atributos por ambiente
   - Safari: vídeo inline com `playsInline` e sem controles visíveis.
   - TikTok: permitir interação direta com o vídeo, sem overlay customizado por cima e sem autoplay JS.

Resultado esperado:
- No Safari: continua com vídeo bonito/inline no mockup.
- No TikTok: ao tocar no vídeo, abre o player nativo como o TikTok quer; ao sair, ele não fica abrindo sozinho; se quiser ver de novo, o usuário toca no vídeo novamente.

Arquivos a alterar:
- `src/components/WelcomeScreen.tsx`

Observação técnica:
- O problema atual está em `WelcomeScreen.tsx`: o componente ainda chama `v.play()` automaticamente no mount e também nos eventos `canplay`/`loadeddata`. Em WebViews como TikTok isso pode reabrir o player nativo depois que o usuário acabou de sair. Além disso, a camada `data-video-gesture-guard` e o botão customizado competem com o player nativo no TikTok.