Vou corrigir o autoplay atacando a causa mais provável: o overlay/poster está ficando por cima do vídeo e o estado só muda para “playing” quando o evento `playing` dispara. Se o vídeo estiver tocando, mas o poster continuar visível por causa de timing/evento, parece que autoplay falhou.

Plano de implementação:

1. Ajustar `src/components/WelcomeScreen.tsx`
   - Trocar o estado inicial para um fluxo mais confiável: `loading` → `playing` quando o vídeo realmente avançar.
   - Considerar autoplay bem-sucedido também quando `play()` resolver e/ou quando o evento `timeupdate` indicar `currentTime > 0`.
   - Esconder o poster assim que o vídeo começar a tocar de verdade, em vez de depender só de um evento.
   - Chamar `attemptPlay()` imediatamente no mount, não só quando `readyState >= 2` ou `canplay` disparar.
   - Remover a chamada `video.load()` dentro do retry automático, porque ela pode reiniciar o carregamento e atrapalhar o autoplay em alguns navegadores.
   - Manter `muted`, `defaultMuted`, `playsInline`, `autoPlay`, `loop`, `preload="auto"`, `disablePictureInPicture`, `disableRemotePlayback` e atributos iOS.

2. Corrigir a camada invisível sobre o iPhone
   - Manter uma camada invisível para impedir que clique no vídeo abra o player/aba nativa.
   - Essa camada não deve bloquear ou interferir no autoplay inicial.
   - Em toque/clique, ela apenas chama `attemptPlay()` como fallback, sem abrir o vídeo.

3. Restaurar o botão de play somente como fallback
   - O botão de play deve aparecer apenas quando o autoplay for realmente bloqueado/der erro.
   - Ele não aparece no carregamento normal.
   - Ele serve como plano B para Safari/iOS em modo economia de energia, onde o navegador pode bloquear autoplay mesmo com vídeo mudo.

4. Atualizar `.lovable/plan.md`
   - Registrar que a correção correta é: autoplay agressivo + detecção real de reprodução + poster não ficar preso por cima do vídeo + botão apenas fallback.

Observação importante: não existe como garantir 100% autoplay em todos os navegadores/dispositivos, porque iOS/Safari, modo economia de bateria, política de dados ou configuração do usuário podem bloquear reprodução automática. Mas com vídeo mudo, inline, preload, tentativa imediata e fallback visual, deixamos no máximo que o navegador permite.