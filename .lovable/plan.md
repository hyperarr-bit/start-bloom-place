## Escopo

Refazer **somente** a primeira tela (slide 1) do onboarding do app CORE no layout **mobile**, seguindo a direção "Editorial — hero embaixo" escolhida. Os slides 2–5 e o layout desktop ficam inalterados. Identidade visual, tokens (`--chart-1..5`, `--foreground`, `--muted-foreground`, `--card`, `--border`) e tracking de eventos ficam inalterados.

Arquivo único modificado: `src/components/WelcomeScreen.tsx`.

## O que muda visualmente (apenas slide 1 mobile)

Hoje o slide 1 no mobile mostra: logo → título → subtítulo → mock → nav/dots/CTA. Vamos reorganizar para:

```text
┌──────────────────────────────┐
│ CORE                         │  ← logo topo-esquerda
│                              │
│      ┌──────────────────┐    │
│ [$]  │  Resumo do mês   │    │  ← Resumo do mês como card
│      │  Saldo +5.765    │    │    central + 4 mini cards
│      │  Contas a pagar 2│    │    flutuando ao redor
│      │  Alertas       2 │ [↓]│    (leve rotação, sombras
│      └──────────────────┘    │    sutis, accents nas cores
│ [▮]                     [♥]  │    chart-1..4)
│                              │
│ Tenha controle da            │  ← hero text EMBAIXO
│ sua vida financeira          │
│ Acompanhe receitas, ...      │
│                              │
│         • · · ·              │  ← dots
│ ┌──────────────────────────┐ │
│ │     Começar grátis       │ │  ← CTA pill full-width
│ └──────────────────────────┘ │
│     Já tem uma conta? Entrar │
└──────────────────────────────┘
```

Slides 2–5 continuam usando o layout atual (título em cima, mock embaixo).

## Implementação técnica

No `WelcomeScreen.tsx`:

1. **Novo componente `SlideOneHero`** com mockup compacto: `Resumo do mês` (card branco central, `bg-card border-border/60 rounded-3xl`, sombra leve `shadow-[0_20px_50px_rgba(0,0,0,0.06)]`) + 4 mini-cards posicionados absolutamente ao redor (Receitas `--chart-3`, Despesas `--chart-4`, Investimentos `--chart-2`, Desejos `--chart-1`), com pílula pequena (`px-3 py-2 rounded-2xl`), leve rotação (±3°), ícone redondo colorido + label uppercase 9px + valor bold 11px. Animação de entrada em stagger (mantém padrão `motion` atual).

2. **Branch condicional no layout mobile** (dentro do `md:hidden`): se `step === 0`, renderiza a nova ordem (logo → mock-area → hero text → nav → loginLink). Se `step > 0`, mantém o layout atual (logo → hero text → mock → nav).

3. **CTA do slide 0**: muda o botão "Começar grátis" para full-width (`w-full py-4 rounded-2xl`) — hoje ele é compacto à direita. Os dots ficam centralizados acima do CTA, em vez de na mesma linha. Mantém o handler `goNext` / `finish` / tracking.

4. **Tokens**: tudo via CSS vars existentes (`hsl(var(--chart-N))`, `bg-card`, `border-border/60`, `text-muted-foreground`, `bg-foreground text-background`). Zero hex hardcoded — respeita a memória Core do projeto.

5. **Sem mexer em**: desktop layout (`md:grid`), slides 2–5, eventos de analytics (`landing_view`, `onboarding_step_view`, `start_clicked`, `onboarding_step_exit`), props do componente, `useUserData`, Supabase, ou qualquer outro arquivo.

## Fora de escopo

- Slides 2, 3, 4, 5 (mantidos como estão)
- Layout desktop/tablet (mantido)
- Pixel TikTok, admin, funil, qualquer backend
- Nenhuma nova dependência, nenhum refactor além do slide 1

Quando aprovado, faço a edição direta no `WelcomeScreen.tsx`.