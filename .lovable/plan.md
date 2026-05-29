Foco: deixar o slide 1 visualmente idêntico à referência. Só `src/components/WelcomeScreen.tsx`. Sem mudar outros slides, lógica, rotas ou backend.

## Problemas atuais vs referência

1. Cores dos cards trocadas:
   - Despesas está verde → deveria ser lilás (`--chart-4`).
   - Investimentos está rosa → deveria ser verde (`--chart-2`).
   - Desejos está amarelo → deveria ser rosa (`--chart-1`).
   - Receitas mantém amarelo/dourado (`--chart-3`).
2. Cards estão pequenos demais, com layout apertado e o "Resumo do mês" some/sobrepõe.
3. Forma dos cards não bate: a referência tem cards tipo "pill" largos com ícone circular grande à esquerda, label cinza em cima e valor preto em baixo, com sombra suave.
4. Ícone do "Despesas" deve ser uma seta para baixo dentro de círculo (Download/ArrowDown), não TrendingDown.
5. Resumo do mês: ícones devem ser outline grandes (~16px), divisórias finas entre linhas, valor "Saldo do mês" verde em destaque, "2" laranja e "2" rosa.

## Mudanças no SlideOneMock

- Aumentar o container do mock para ocupar a largura útil e altura suficiente para 4 cards + resumo sem sobrepor.
- Trocar de `absolute` puro para um layout em 2 colunas escalonadas que reproduza a composição da referência:
  - Coluna esquerda mais alta: Receitas (topo) e Investimentos (meio-baixo), levemente rotacionados para a esquerda.
  - Coluna direita deslocada para baixo: Despesas (meio-topo) e Desejos (baixo), rotacionados para a direita.
- Card "pill":
  - `rounded-2xl`, padding maior, sombra suave (`shadow-md`).
  - Círculo de ícone ~36px com cor sólida do token e ícone branco dentro.
  - Texto: label pequeno cinza acima, valor `font-bold` preto abaixo.
- Ícones:
  - Receitas: `DollarSign` em círculo `--chart-3`.
  - Despesas: `ArrowDown` em círculo `--chart-4`.
  - Investimentos: `BarChart3` em círculo `--chart-2`.
  - Desejos: `Heart` (filled) em círculo `--chart-1`.
- Fundo de cada card usando o mesmo token com baixa opacidade (ex.: `hsl(var(--chart-x)/0.18)`).
- Manter os dots decorativos espalhados para reforçar o "confetti".

## Resumo do mês

- Card branco com borda sutil, raio grande, padding generoso.
- Título "Resumo do mês" em `font-semibold` preto.
- 3 linhas separadas por `border-t border-border/60`:
  - Saldo do mês — ícone Calendar verde outline + label cinza, valor `+R$ 5.765,00` em verde forte (`--chart-2`).
  - Contas a pagar — Calendar laranja (`--chart-3`), valor `2` laranja.
  - Alertas inteligentes — Bell rosa (`--chart-1`), valor `2` rosa.
- Ícones ~16px com `strokeWidth={1.75}`.

## Layout geral do slide 1

- Garantir altura mínima do mock para não sobrepor o resumo (≈ 360px) e o resumo ficar visivelmente abaixo dos 4 cards, como na imagem.
- Não tocar nos textos do header, rodapé, "7 dias grátis", botão "Começar grátis" e link "Entrar" — já estão corretos.

## Fora do escopo

- Slides 2 a 5 ficam como estão.
- Lógica de navegação, analytics, tokens globais e outros componentes não são alterados.
