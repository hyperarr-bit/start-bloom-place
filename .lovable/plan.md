Entendi o bug: no primeiro carregamento/reload, a tela de boas-vindas aparece antes do mockup do iPhone ficar pronto, então por alguns instantes sobra só o texto/CTA lá em cima/fora do lugar. Pelo código, isso vem da combinação de animações do `WelcomeScreen`, vídeo/poster carregando e layout flex que renderiza texto e iPhone em momentos diferentes.

Plano de correção:

1. Corrigir a tela de boas-vindas para renderizar como um bloco estável desde o primeiro frame
   - Ajustar o container principal do `WelcomeScreen` para não depender do vídeo carregar para reservar espaço do iPhone.
   - Definir altura/largura do mockup de forma mais previsível em mobile usando CSS/clamp, evitando que o texto “suba” antes do iPhone aparecer.

2. Evitar que o texto apareça antes do iPhone
   - Remover ou reduzir o delay da animação do iPhone.
   - Sincronizar a entrada do texto com o mockup, ou deixar ambos visíveis sem esse salto inicial.
   - Manter o texto abaixo do iPhone no celular e ao lado no desktop.

3. Melhorar o carregamento do vídeo/poster
   - Garantir que o poster esteja visível imediatamente dentro da tela do iPhone enquanto o vídeo carrega.
   - Manter o botão/loader dentro do mockup, sem causar mudança de layout.
   - Preservar autoplay/loop/muted/playsInline para iPhone real.

4. Ajustar a rota usada no teste
   - A rota `/index` cai no 404 porque o app usa `/` para Home e `/financas` para o antigo `Index`. Não vou criar uma rota nova sem necessidade, mas vou testar em `/auth`, que é onde a tela do iPhone realmente aparece.

5. Validação visual
   - Testar em viewport mobile próximo ao seu caso: 430x697.
   - Testar também em iPhone menor, desktop e reload inicial.
   - Confirmar que o iPhone aparece de primeira, sem flash só do texto e sem vídeo vazando da borda arredondada.