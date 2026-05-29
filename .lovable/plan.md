Vou ajustar `src/components/WelcomeScreen.tsx` para ficar idêntico aos mockups, sem mexer em mais nada.

## Ajustes por slide

**Slide 1 — "Organize sua vida financeira"**
- Trocar os 4 cards floating para pills coloridas sólidas (sem borda), arredondamento `rounded-2xl` grande, com leves rotações:
  - Receitas: fundo amarelo claro (`--chart-3 / 0.25`), ícone DollarSign em círculo amarelo
  - Despesas: fundo lilás (`--chart-2 / 0.22`), ícone TrendingDown em círculo roxo
  - Investimentos: fundo verde menta (`--chart-1 / 0.22`), ícone BarChart3 em círculo verde
  - Desejos: fundo rosa (`--chart-5 / 0.22`), ícone Heart em círculo rosa
- Adicionar pontinhos decorativos espalhados em volta
- Card "Resumo do mês" em baixo: mais limpo, sem borda forte, fundo card normal

**Slide 2 — "Veja seu mês com clareza"**
- Os 4 cards de stats: cores mais suaves (amarelo, lilás, verde menta, azul), ícone à direita pequeno
- Card de alertas: layout idêntico (já está bem próximo)
- Adicionar mini donut chart "Gastos por categoria" abaixo dos alertas (lista com bolinhas coloridas: Moradia, Educação, Contas da Casa, Lazer, Outros + donut multicolorido à esquerda)

**Slide 3 — "Controle seus gastos e limites"**
- Limites por categoria: nome com cor (Transporte azul, Alimentação amarelo, Vestuário roxo, Lazer verde, Pets cinza), barras coloridas
- Chips de categorias populares: já está próximo, garantir cores variadas e estilo "+ Nome"

**Slide 4 — "Planeje seus desejos e objetivos"**
- Substituir placeholder por imagem real de iPad (usar emoji/placeholder visual de tablet azul)
- Coração no canto superior direito
- Layout exato: nome do produto, chip "Tecnologia", Guardado/Falta, barra de progresso rosa→vermelho, 35%, cards Tempo estimado/Faltam, alerta verde

**Slide 5 — "Comece pela sua primeira receita"**
- Formulário "Nova receita": já está próximo
- Card "Ótimo começo!" amarelo claro com estrela
- Botão "Começar agora" preto sólido no rodapé (já existe)

## Navegação (rodapé)
- Slides 1 e 2: "Pular" à esquerda + dots + botão "Continuar" preto à direita
- Slides 3 e 4: "Voltar" à esquerda + dots + botão "Continuar" preto à direita
- Slide 5: "Voltar" à esquerda + dots, botão "Começar agora" largura total acima

Atualmente slide 2 mostra "Voltar" — corrigir para "Pular".

## Tipografia
- Título maior e mais bold (já está em 26px, ajustar para ~28px)
- "CORE" wordmark mais grosso (já black)

## Não muda
- Nada do tutorial, Index.tsx, rotas, props `onComplete`/`onLogin`, analytics, redirect `/financas`.
- Só edita `src/components/WelcomeScreen.tsx`.