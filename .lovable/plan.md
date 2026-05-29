Vou ajustar apenas o slide 1 do `src/components/WelcomeScreen.tsx` para bater pixel a pixel com a referência. Sem mexer em outros slides, lógica, rotas ou backend.

## Mudanças no slide 1

**Texto:**
- Título: "Tenha controle da sua vida financeira" (substitui o atual "Organize sua vida financeira em um só lugar").
- Subtítulo: "Acompanhe receitas, despesas, contas, cartões, investimentos e metas em um só lugar."

**Card "Resumo do mês" (SlideOneMock):**
- Adicionar divisórias `border-t` finas entre as 3 linhas, como na referência.
- Trocar ícones por linha:
  - Saldo do mês → `Calendar` verde (`--chart-2`)
  - Contas a pagar → `Calendar` laranja/amarelo (`--chart-4`)
  - Alertas inteligentes → `Bell` rosa (`--chart-5`)
- Valor "Contas a pagar" e "Alertas inteligentes" mostrando "2" alinhado à direita, na cor do ícone.
- Aumentar levemente padding interno e tamanho do título "Resumo do mês".

**Cards flutuantes:**
- Manter as 4 categorias (Receitas, Despesas, Investimentos, Desejos) com mesmas cores e rotações.
- Aumentar levemente largura útil (mock até ~340px) para casar com a referência.

**Rodapé do slide 1 (só quando step === 0):**
- Adicionar linha centralizada "7 dias grátis. Sem complicação." em `text-muted-foreground` acima da linha de Pular/dots/CTA.
- Trocar o botão "Continuar" por "Começar grátis" só no slide 1, com pill preto arredondado mais largo (mais próximo do mock).
- Manter "Pular" à esquerda e dots centralizados.
- Link "Já tem uma conta? Entrar" continua abaixo.

**Layout:**
- Manter logo "CORE" no topo, hierarquia tipográfica, margens laterais e proporção mobile já existentes.
- Não alterar slides 2, 3, 4 e 5.
- Não tocar em lógica de navegação, analytics, autenticação ou imagem do iPad.
