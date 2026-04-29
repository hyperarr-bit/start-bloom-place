## Problema

Ao abrir o app pela primeira vez, aparece por uma fração de segundo uma tela quase vazia (cor creme) com apenas o título "Organize sua vida em um só lugar" no topo e uma faixa preta fininha (topo do iPhone) — exatamente o que o print mostra.

## Causa raiz

Olhando o `WelcomeScreen.tsx` e o session replay, o problema é uma combinação de três coisas que acontecem na primeira renderização:

1. **Animação atrasada do mockup**: o iPhone entra com `initial={{ opacity: 0, y: 60, scale: 0.9 }}` + `delay: 0.2s` + spring lento. Durante ~500–700 ms ele fica invisível, mas o título e os botões já apareceram — daí o "buraco" cream no meio da tela.
2. **Poster do vídeo não pré-carregado**: `/videos/app-preview-poster.jpg` (43 KB) só é baixado quando o `<img>` é montado. Se a rede estiver lenta, mesmo depois da animação o "interior" do iPhone fica preto/vazio até o poster aparecer.
3. **Loader full-screen do `ProtectedRoute` antes do Welcome**: o replay mostra um spinner centralizado em fundo creme imediatamente antes do WelcomeScreen montar. Esse spinner some abruptamente e a animação do Welcome começa do zero, criando o efeito de "dois flashes".

## Mudanças

### 1. `src/components/WelcomeScreen.tsx` — eliminar o gap visual da animação
- Reduzir `delay` do mockup de `0.2` para `0` e trocar o spring por uma transição mais curta (≈ 280 ms `ease-out`).
- Já renderizar o `<img>` poster com `opacity: 1` desde o início (sem esperar o vídeo) — o poster vira o "estado base" enquanto o vídeo carrega, então o interior do iPhone nunca fica preto vazio.
- Manter o overlay do loader/play apenas quando realmente houver erro/bloqueio, nunca no estado inicial "loading" (já temos o poster para isso).

### 2. `index.html` — pré-carregar o poster
- Adicionar `<link rel="preload" as="image" href="/videos/app-preview-poster.jpg">` no `<head>` para que o poster esteja em cache antes do React montar o WelcomeScreen.

### 3. `src/components/ProtectedRoute.tsx` — suavizar a transição loader → Welcome
- Conferir o componente (não foi lido ainda no plano) e, se ele renderiza um spinner centralizado em fundo `bg-background`, trocar por um placeholder vazio (sem spinner) ou por um fade-out curto, para que a transição para o WelcomeScreen não pareça um "salto".

### 4. (Opcional, se necessário) `src/index.css`
- Garantir que o `.iphone-screen` tenha um `background` neutro (já tem `#000`) — sem mudança, mas verificar se está tudo certo após as alterações acima.

## Resultado esperado

Ao abrir o app pela primeira vez:
- Não aparece mais o "quadro vazio cream" entre o loader e o WelcomeScreen.
- O iPhone mockup já aparece com o poster visível em ~280 ms (em vez de ~700 ms).
- O vídeo continua tocando por cima do poster assim que estiver pronto, sem flash.

Nada da estrutura visual ou de conteúdo do WelcomeScreen muda — apenas o timing e o estado inicial dos elementos.