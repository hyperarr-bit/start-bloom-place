

## Ajustes visuais da WelcomeScreen (baseado na referência)

Comparando a tela atual com a imagem de referência, as mudanças são:

### Layout e posição dos textos
- **Remover** o logo "CORE" e subtítulo do topo — na referência, o texto fica **abaixo** do mockup do iPhone, não acima
- **Mover** o título para baixo do mockup: "Organize sua vida em um só lugar" — texto grande, bold, centralizado
- O mockup do iPhone fica na metade superior da tela, o texto e botões na metade inferior

### Botão e texto de login
- Botão "Começar" deve ser **full-width** (mesma largura do container ~90%), com fundo **preto** (`bg-foreground text-background`), cantos arredondados grandes (`rounded-2xl`), padding generoso (`py-4`), texto maior (`text-base font-semibold`)
- Texto "Já tem uma conta? **Entrar**" abaixo do botão, mesmo estilo atual mas com mais espaçamento

### Fundo
- Remover o gradiente (`bg-gradient-to-b from-primary/5 via-transparent to-primary/10`)
- Fundo uniforme: apenas `bg-background` (branco no light, escuro no dark) — cor sólida e limpa em toda a página

### Resumo das edições em `WelcomeScreen.tsx`
1. Remover o `<div>` do gradiente de fundo (linha 86)
2. Remover o bloco do logo/título do topo (linhas 89-99)
3. Adicionar título "Organize sua vida em um só lugar" entre o mockup e o botão — `text-2xl font-bold text-center`
4. Alterar botão para full-width, preto, arredondado, maior
5. Ajustar espaçamento: mockup mais para cima, texto+botão mais para baixo com `gap` adequado

