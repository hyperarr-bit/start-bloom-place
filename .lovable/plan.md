# Carrossel de módulos no estilo da referência

Manter um módulo por vez com setas (← →) e dots, mas redesenhar cada card para ficar **idêntico ao print enviado**.

## Mudanças em `src/pages/lp/LandingPage.tsx`

### 1. Visual do card (igual à referência)
Cada slide do `ModulesCarousel` vira um card grande tipo "post-it" colorido:
- Fundo tonal suave (ex.: `bg-orange-50`, `bg-emerald-50`, `bg-violet-50` …) com borda da mesma família mais escura (`border-orange-100`).
- `rounded-2xl`, padding generoso (`p-6 md:p-8`), `min-h-[420px]`.
- Header do card: ícone `Lucide` + **TÍTULO EM CAIXA ALTA** colorido (ex.: `text-orange-700`), tracking largo, peso bold. Sem círculo de fundo no ícone — só o ícone na cor do título, igual à imagem.
- Abaixo: descrição em 2 linhas, texto cinza escuro (`text-black/70`), tamanho `text-[15px] md:text-base`.
- Embaixo: **mini-mockup do módulo** (preview visual) dentro de um cartão branco `rounded-xl border` com sombra leve — replicando o estilo dos 3 exemplos da referência.

### 2. Mini-previews por módulo
Componentes inline pequenos, sem dados reais, só visual:
- **Finanças**: "Saldo do Mês +R$ 2.365" + donut colorido + 3 linhas de categoria (Moradia/Educação/Contas).
- **Rotina**: tabela "HÁBITOS DIÁRIOS" com colunas (Beber 2L, Treinar, Ler 30min) e linhas SEG/TER com checkboxes verdes/vazios.
- **Dev. Pessoal**: card "MINHAS FORÇAS" com 3 pills (Comunicação, Persistência, Curiosidade) e botãozinho ×.
- **Dieta**: barra de macros (P/C/G) + "1.840 / 2.000 kcal".
- **Treino**: lista de 3 exercícios com séries × reps.
- **Saúde**: copo d'água 6/8 + barra de hidratação.
- **Hiperfoco**: 3 "ideias capturadas" como sticky notes.
- **Estudos**: matérias com barra de progresso.
- **Carreira**: lista de metas com check.
- **Biblioteca**: 3 lombadas de livro coloridas + título "Lendo agora".
- **Casa**: checklist de tarefas + "Despensa".
- **Viagens**: countdown "Faltam 12 dias" + bandeirinha de destino.
- **Relacionamentos**: 3 avatares circulares + próxima data.
- **Pet**: card pet com próxima vacina.
- **Beleza**: rotina AM/PM com 3 passos.
- **Detox**: "7 dias limpo" + barra de streak.

Cada mini-preview é uma função pequena que retorna JSX, mapeada por `key` do módulo.

### 3. Setas e dots
- Setas continuam no topo direito (como já está).
- Dots embaixo do card mostrando `idx` atual de 16.
- Contador `1/16` no canto do card removido (a referência não tem).

### 4. Sem mudanças em outras seções
Hero, pricing, header e CTA final permanecem como estão.

## Arquivos afetados
- `src/pages/lp/LandingPage.tsx` (único arquivo).

Nada de backend, rotas ou tokens novos.
