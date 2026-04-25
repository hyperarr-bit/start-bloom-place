Plano para corrigir a tela bugada:

1. Corrigir a moldura do iPhone
- Desfazer o problema visual criado pelo recorte anterior do PNG, que deixou uma área preta grande atrás do iPhone.
- Usar a moldura como overlay limpo, sem “caixa” preta externa aparecendo nas laterais.
- Ajustar o vídeo para ficar somente dentro da tela do aparelho, centralizado e sem vazar para fora da moldura.

2. Recalibrar tamanho e proporção
- Reduzir o iPhone no mobile para não dominar a tela inteira nem esmagar o texto/botões.
- Manter o iPhone grande o suficiente para ser destaque, mas com proporção equilibrada com o título e CTA.
- Separar medidas mobile e desktop para evitar que um ajuste quebre o outro.

3. Corrigir espaçamentos da landing
- Diminuir o espaço morto no topo.
- Ajustar a distância entre iPhone, título, botão “Começar” e link “Entrar”.
- Garantir que tudo caiba bem em telas como 390x844, 414x896 e também desktop.

4. Corrigir o fundo cinza/preto indesejado
- Remover qualquer fundo de placeholder visível fora da área real da tela do iPhone.
- Manter o fundo do vídeo/poster apenas dentro do display do aparelho.
- Evitar bordas laterais, superiores ou inferiores aparecendo ao redor da moldura.

5. Preservar comportamento do vídeo
- Manter autoplay, loop forçado, poster inicial e botão manual de play quando autoplay falhar.
- Garantir que esses controles continuem funcionando após o ajuste visual.

Detalhes técnicos
- Arquivo principal: `src/components/WelcomeScreen.tsx`.
- Provável ajuste do asset `src/assets/iphone-mockup.png`, restaurando/recortando corretamente a moldura sem criar retângulo preto externo.
- Recalcular `aspectRatio`, `width`, `maxHeight`, `insets` e `borderRadius` do container do vídeo.
- Substituir os estilos atuais por medidas mais seguras, usando `clamp()`/breakpoints para mobile e desktop.
- Testar visualmente no viewport mobile atual do usuário e em pelo menos um desktop antes de finalizar.