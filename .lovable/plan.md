## Escopo

Apenas o slide 0 no layout **mobile** (`md:hidden`) do `WelcomeScreen.tsx`. Desktop e slides 2–5 ficam inalterados.

## Mudança

Substituir o `SlideOneHero` atual (mini cards flutuantes 2x2 + Resumo do mês) e a ordem mock→texto pelo layout exato da foto enviada.

### Nova ordem do slide 0 (de cima para baixo)

```text
• dots (7 bolinhas, ativa = primeira, largas)
CORE                       (mega título, font-black, ~64px)
Controle sua vida financeira
em um só lugar             (h1 bold ~26px, 2 linhas, centro)
Acompanhe receitas, gastos, contas,
metas e investimentos sem complicação.   (subtítulo cinza ~14px, centro)

[ $  Receitas       R$ 3.000,00       ↗ ]     ← card branco, ícone verde
[ ↘  Gastos         R$ 635,00         ↘ ]     ← ícone vermelho
[ ↗  Saldo do mês   +R$ 2.365,00      ↗ ]     ← ícone verde

[       Começar agora              → ]   ← pill preto full-width
🕐 Leva menos de 2 minutos para configurar.
```

### Detalhes visuais (idênticos à foto)

- **Dots no topo** do slide (acima do CORE), centralizados — mover do `mobileNav` para o topo só no slide 0
- **CORE**: `text-[64px] sm:text-[72px] font-black tracking-tight`, centralizado, peso máximo
- **Título**: `text-[26px] font-bold leading-[1.2]`, centro, ~2 linhas
- **Subtítulo**: `text-[14px] text-muted-foreground`, centro
- **3 cards** (não 4 mini flutuantes): `bg-card border border-border/60 rounded-2xl px-4 py-3.5`, layout `flex items-center gap-3`:
  - Tile do ícone à esquerda: `w-12 h-12 rounded-2xl` com bg `hsl(var(--chart-X)/0.18)` e ícone colorido
  - Coluna central: label pequena cinza (`text-xs`) + valor `text-[20px] font-extrabold` colorido (verde/vermelho/verde)
  - Mini ícone de tendência à direita (mesmo da esquerda em versão outline)
  - Card 1: `DollarSign` + verde (`--chart-2`) — Receitas / R$ 3.000,00 / ↗
  - Card 2: `TrendingDown` + vermelho (`--chart-1`) — Gastos / R$ 635,00 / ↘
  - Card 3: `TrendingUp` + verde (`--chart-2`) — Saldo do mês / +R$ 2.365,00 / ↗
- **CTA**: pill preto full-width `h-[56px] rounded-2xl bg-foreground text-background font-semibold` com label "Começar agora" e seta `→` à direita (ícone `ArrowRight`)
- **Microcopy embaixo**: `flex items-center justify-center gap-2 text-xs text-muted-foreground` com ícone `Clock` outline + "Leva menos de 2 minutos para configurar."
- Link "Já tem uma conta? Entrar" some do slide 0 (não aparece na foto). Manter só nos outros slides? → **remover do slide 0**.

### Implementação

1. Reescrever `SlideOneHero` para retornar **apenas os 3 cards** (sem dots, sem texto, sem CTA — esses ficam no shell).
2. No bloco mobile (`md:hidden`), criar um branch dedicado para `step === 0` com:
   - dots no topo (largura ativa 20px, inativos 6px)
   - CORE, título, subtítulo (centro)
   - `<SlideOneHero />` (3 cards empilhados)
   - CTA "Começar agora" com `ArrowRight`
   - linha "Leva menos de 2 minutos para configurar"
3. Para `step > 0`, manter o layout mobile atual (mock em cima, texto, `mobileNav`).
4. Importar `ArrowRight`, `Clock` de lucide-react.

## Fora de escopo

- Desktop (`md:grid`)
- Slides 2–5 (mobile e desktop)
- Conteúdo dos mocks dos outros slides, tracking, rotas, `useUserData`
