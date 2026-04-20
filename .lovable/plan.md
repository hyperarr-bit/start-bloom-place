

# Repaginar a Home — visual premium estilo Lovable/Linear

## Diagnóstico
A home atual funciona, mas parece um "feed empilhado" genérico:
- Tipografia muito pequena em todo lugar (`text-[11px]`, `text-[10px]`) — sem hierarquia.
- Cores frias e planas (`bg-card` + borda cinza repetido em tudo).
- Score, saudação e ações vivem em caixas separadas que competem visualmente.
- Sem "personalidade" — falta um hero, gradientes sutis, e um ritmo claro.

## Visão da nova Home
Um **hero único no topo** que junta saudação + score + insight do dia em um cartão com gradiente sutil (token-based, tema-aware), seguido por seções com hierarquia clara e respiração.

```text
┌──────────────────────────────────────────────┐
│  HERO (gradiente suave, full-width card)     │
│  ┌─────┐  Boa tarde, João 👋                │
│  │ 78  │  Você está 12% acima da média      │
│  │score│  🔥 5 dias seguidos                 │
│  └─────┘  [3 ações pendentes →]             │
│  ▰▰▰▰▰▰▰▱▱▱  progresso do dia              │
└──────────────────────────────────────────────┘

⚡ Ações rápidas         (chips com ícone colorido + label)
[💧 Água] [💪 Treino] [💸 Gasto] [😊 Humor] →

✨ Seus widgets          (grid 1col mobile / 2col desktop)
┌──────┐ ┌──────┐
│      │ │      │
└──────┘ └──────┘

🧩 Módulos               (grid colorido, atual)
[grid existente, com leve refino]

⏰ Pendências de hoje    (collapse atual, refinado)
```

## O que muda concretamente

### 1. Hero unificado (`src/components/home/HomeHero.tsx` — novo)
Substitui `GreetingHeader` + cartão do `DayScoreRing` por **um único cartão hero**:
- Fundo: `bg-gradient-to-br from-primary/10 via-card to-card` com `border-primary/10`.
- Lado esquerdo: ring de score (mantém `DayScoreRing`, levemente menor — 110px).
- Lado direito: saudação grande (`text-2xl font-bold`), mensagem contextual (`text-sm`), pill de streak.
- Rodapé do hero: barra de progresso do dia + chip "X pendências →" que rola até a seção.
- Avatar + theme toggle ficam no canto superior direito do hero (não em uma row separada).

### 2. Seções com cabeçalho real
Trocar os títulos `text-[11px] uppercase` por:
```tsx
<div className="flex items-center justify-between mb-3">
  <div>
    <h2 className="text-base font-semibold">Ações rápidas</h2>
    <p className="text-xs text-muted-foreground">Registre algo em 1 toque</p>
  </div>
  <button>Ver todas →</button>
</div>
```
Aplicar em: Ações rápidas, Widgets, Módulos, Pendências.

### 3. QuickActions refinado
- Aumentar chips: `px-4 py-2.5`, ícone `w-8 h-8`, label `text-xs font-medium`.
- Manter scroll horizontal, mas adicionar fade nas bordas (mask-image).
- Estado "Feito!" ganha animação de scale + checkmark verde mais visível.

### 4. Widgets — grid responsivo desktop
No `WidgetGrid` (dentro de `Home.tsx`):
- Mobile: comportamento atual (small pareia, large full).
- Desktop (`md:`): grid de 2 colunas para small, large ocupa 2 colunas.
- Botão "Adicionar widget" vira um **card tracejado** integrado ao grid em vez de barra full-width separada.

### 5. ModuleDrawer refinado
- Aumentar ícones para `w-12 h-12`, label `text-[11px]`.
- Hover com `hover:scale-105` e sombra sutil.
- Manter cores existentes (já estão boas).

### 6. Polimento global da Home
- Container: `space-y-6` → `space-y-8` para mais respiração.
- Substituir todas as bordas `border-border/50` por `border-border/40` + `shadow-sm` consistente.
- Footer "Core © 2026" ganha um separador sutil acima.

## Fora de escopo (não toca)
- Lógica de dados (`useLifeHubData`, `useHomeWidgets`).
- Componentes internos de cada widget.
- Páginas de módulos.
- Onboarding / Welcome.

## Arquivos
- **Novo**: `src/components/home/HomeHero.tsx` — hero unificado
- **Editar**: `src/pages/Home.tsx` — usa hero, novos cabeçalhos de seção, grid de widgets desktop
- **Editar**: `src/components/home/QuickActions.tsx` — chips maiores, fade nas bordas (apenas no JSX do scroll, sem mexer em lógica)
- **Editar**: `src/components/home/ModuleDrawer.tsx` — ícones maiores, hover refinado
- **Editar**: `src/components/home/DayScoreRing.tsx` — aceita prop `size` para versão hero
- **Manter**: `GreetingHeader` (lógica reaproveitada dentro do hero), `NextHoursTimeline`

Total: 1 arquivo novo + 5 edições. Mudanças puramente visuais, sem risco de quebrar dados.

