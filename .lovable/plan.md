Ajustar moldura CSS do iPhone para ficar igual à imagem de referência:

1. Remover a Dynamic Island em CSS
- Apagar o elemento `.iphone-island` do componente e o estilo correspondente em `src/index.css` (já aparece dentro do vídeo, não precisa duplicar).

2. Bordas pretas mais finas
- Reduzir o `padding` do bezel preto (`.iphone-bezel`) para deixar a faixa preta entre a moldura metálica e a tela bem mais fina.
- Remover o "anel" extra escuro do `box-shadow` do bezel.

3. Cantos mais arredondados
- Aumentar o `border-radius` do `.iphone-frame`, `.iphone-bezel` e `.iphone-screen` para deixar os cantos suaves como na imagem (curva mais contínua, no estilo iPhone 15/16).
- Diminuir levemente o `padding` da moldura externa para reforçar o look "fino" do aparelho.

4. Botões laterais
- Manter o conjunto de botões (silent, volume, power) com tamanhos um pouco mais discretos para combinar com a moldura mais fina.

Detalhes técnicos
- Arquivos: `src/index.css` (classes `.iphone-frame`, `.iphone-bezel`, `.iphone-screen`, `.iphone-island`, `.iphone-btn-*`) e `src/components/WelcomeScreen.tsx` (remover `<div className="iphone-island" />`).
- Sem mudanças no comportamento do vídeo (autoplay, loop, poster, botão manual).
- Validar visualmente em viewport mobile depois da alteração.