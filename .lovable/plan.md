# Plano — Landing page /lp espelhando a referência

Vou substituir o conteúdo de `src/pages/lp/LandingPage.tsx` por uma landing que reproduz **exatamente** o layout da imagem enviada, ajustando proporções pra ficar excelente no mobile (430px) e responsiva até desktop.

## Estrutura (na ordem da imagem)

1. **Header fixo**
   - Logo "◐ CORE" à esquerda
   - Nav desktop: Recursos · Benefícios · Depoimentos · Preços · Perguntas
   - Botão outline verde "Entrar" → `/auth`
   - Mobile: apenas logo + botão Entrar (nav oculta)

2. **Hero**
   - Pill verde claro: "✓ TUDO PARA SUA VIDA. EM UM SÓ LUGAR."
   - H1 grande e bold: "Organize sua vida em um só lugar."
   - Sub: "Finanças, rotina e desenvolvimento pessoal em um app simples, bonito e feito para o seu dia a dia."
   - Dois CTAs: verde sólido "Testar grátis por 7 dias →" e outline "Ver como funciona →"
   - 3 mini-trust badges (ícone + título + sub): "7 dias grátis / Sem compromisso", "Cancelamento fácil / Cancele quando quiser", "Seus dados seguros / Privacidade em primeiro lugar"
   - **Trio de iPhones em leque**: phone esquerdo (Rotina) levemente atrás/abaixo, central (Finanças) à frente e maior, direito (Desenvolvimento Pessoal) atrás/abaixo — mockups de UI fiéis aos prints (header com hora, status bar, tabs, cards de receitas/despesas, donut de gastos, hábitos com checks verdes, frase do dia, etc.)
   - **Mobile**: hero empilhado (texto em cima, phones embaixo); no mobile usar **1 iPhone central** com 2 laterais menores cortados nas bordas pra manter a sensação do leque sem espremer

3. **Trio de cards de módulos** (Finanças laranja, Rotina verde, Dev. Pessoal roxo)
   - Cada card: ícone colorido + título + subtítulo + mini-preview (donut/saldos, tabela de hábitos, lista "Minhas forças")
   - Desktop: 3 colunas. Mobile: stack vertical

4. **"Tudo no seu celular"**
   - Título + sub à esquerda, trio de 3 iPhones menores à direita mostrando 3 módulos
   - Mobile: título em cima, phones em carrossel horizontal com snap

5. **"Feito para o seu dia a dia"**
   - Título grande à esquerda
   - 4 features com ícone colorido pequeno: Interface simples e intuitiva, Módulos para diferentes áreas, Visual limpo e agradável, Organização sem complicação
   - Desktop: 4 colunas. Mobile: 2x2

6. **Pricing "Escolha o plano ideal para você"**
   - Título à esquerda + "7 dias grátis · Cancele quando quiser"
   - 2 cards lado a lado: **Anual** (com badge "🌿 MELHOR CUSTO-BENEFÍCIO", R$ 3,90/mês, "Pago anualmente R$ 46,80/ano", CTA verde "Começar agora") e **Mensal** (R$ 14,90/mês, CTA outline)
   - Mobile: stack vertical, Anual em cima

7. **Faixa CTA final verde claro**
   - "Pare de se perder entre mil apps e anotações." + sub + botão verde "Quero testar o CORE →"

## Proporções mobile (viewport 430px)

- Container `max-w-[1200px]` com padding `px-5 md:px-8`
- Hero H1: `text-[34px] leading-[1.05] md:text-6xl`
- Mockups iPhone: usar wrapper com `aspect-[9/19.5]`, largura ~62% no mobile pro central e ~38% pros laterais sobrepostos com `-mx-6` e leve `rotate-[-6deg]`/`rotate-[6deg]`. Bezel preto com `rounded-[2.2rem]` + notch.
- Cards: `rounded-2xl border` com sombra suave. Padding `p-5 md:p-6`.
- Pricing cards: full-width no mobile, 2 col desktop.
- Espaçamento vertical entre seções: `py-14 md:py-24`.

## Sistema de design

- **Cores via tokens existentes** (`--background`, `--foreground`, `--muted-foreground`, `chart-1..5`, `success`, `primary`). O verde da referência mapeia pra `success` / `chart-1`. Laranja Finanças = `chart-2`, roxo Dev = `chart-4`. Sem hex hardcoded.
- Fundo geral `bg-background`, seções alternadas usando `bg-muted/30`.
- Fonte: Inter (já é a global).
- Sem emojis em headers; ícones lucide nos títulos de seção e cards de feature, conforme regra do projeto.

## Mockups iPhone (componentes internos no mesmo arquivo)

- `PhoneFrame` reutilizável (bezel + notch + status bar 10:36)
- 3 variantes de tela: `FinancePhone` (tabs, cards Receitas/Despesas/Saldo/Investimentos, alertas, donut Gastos por categoria), `RoutinePhone` (tabela Hábitos Diários com checks verdes + heatmap Consistência), `DevPhone` (frase do dia, "O que me motiva", afirmações). Tudo renderizado com Tailwind + tokens — sem imagens externas.

## Animações

- `framer-motion`: fade+slide nos blocos ao entrar (whileInView)
- Phones do hero com stagger
- Hover sutil nos cards de pricing

## Arquivos

- **Editar**: `src/pages/lp/LandingPage.tsx` (rewrite completo, mantendo a rota `/lp` já registrada em `App.tsx`)
- Sem novos arquivos, sem mudar `App.tsx`.

## Fora de escopo

- Não mexer em backend, auth ou outros módulos
- Não adicionar imagens externas / assets binários
- Não alterar copy do app — só a landing
