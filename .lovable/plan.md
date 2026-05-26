## Objetivo

Refazer `src/components/WelcomeScreen.tsx` para ficar igual à referência enviada: logo wordmark "CORE" no topo, headline grande em negrito, subtítulo, mockup de iPhone com a tela de Finanças, CTA "Começar grátis", link "Já tem uma conta? Entrar" e linha de confiança "7 dias grátis. Sem complicação.".

## Mudanças

### `src/components/WelcomeScreen.tsx`

Estrutura nova (mobile-first, 430x697):

```
[CORE wordmark] (topo, pequeno)
[Tenha controle da sua vida financeira] (h1, bold, ~32px, 2 linhas)
[Acompanhe receitas, despesas e investimentos em um só lugar.] (subtítulo muted, 2 linhas)
[Mockup iPhone com cena Finanças] (flex-1, centralizado)
[Começar grátis] (botão preto full-width arredondado)
[Já tem uma conta? Entrar] (link)
[🛡 7 dias grátis. Sem complicação.] (trust line muted pequeno)
```

- Trocar logo png pelo wordmark "CORE" em texto (font-black tracking-tight) — bate com a referência.
- Headline: `text-3xl md:text-4xl font-bold leading-[1.1]` — "Tenha controle da sua vida financeira".
- Subtítulo: `text-base text-muted-foreground` — "Acompanhe receitas, despesas e investimentos em um só lugar."
- Mockup: reutilizar `AnimatedAppMockup` dentro de uma moldura de iPhone simples (rounded-[2.5rem] border, dynamic island já existe no mockup), fixar na cena "financas" (sem ciclar) para combinar com a copy. Adicionar prop `scene?: "home" | "financas" | "dieta"` opcional em `AnimatedAppMockup` pra travar a cena; default mantém o ciclo atual (não quebra outros usos).
- CTA: "Começar grátis" (em vez de "Quero começar"), mesmo `handleStart` → `/financas`.
- Trust line nova: ícone shield-check do lucide + texto muted `text-xs`.
- Layout: `flex flex-col` com header (logo+texto) no topo, mockup `flex-1 min-h-0` no meio com overflow hidden, e footer (CTA+link+trust) embaixo. Padding lateral `px-6`, safe-area top/bottom mantidos.

### `src/components/welcome/AnimatedAppMockup.tsx`

- Adicionar prop opcional `scene?: "home" | "financas" | "dieta"`. Se passada, renderiza só aquela cena sem `setInterval`.

## O que NÃO muda

- Rota destino do CTA (`/financas`), analytics, fluxo de auth.
- Cópia do trust line é nova mas curta, sem mexer em backend.
- Outras telas/componentes.
