

## Redesign da Retrospectiva de Mês — Alinhamento Visual

### Problemas identificados

1. **Cores hardcoded** — O modal usa `emerald-500`, `red-500`, `amber-500` diretamente, enquanto o resto do app usa tokens semânticos (`card-receitas`, `card-despesas`, `success`, `destructive`, `accent`).
2. **Emojis inconsistentes** — Mistura de emojis Unicode (📊✅🏆📋📑📝💰🚀🤝⚖️💪) com ícones Lucide, sem critério claro. O app usa emojis nas tabs mas Lucide icons nos cards.
3. **Gradientes destoantes** — O modal usa gradientes coloridos (`from-amber-400/20`, `from-emerald-400/20`) que não existem em nenhum outro lugar do app. O app é flat com `bg-card`, `bg-muted`, borders sutis.
4. **Tipografia inconsistente** — `text-[9px]`, `text-[10px]`, `text-[11px]` excessivos. O app usa `text-xs` e `text-sm` padrão.
5. **Estilo do banner** — Gradiente `from-primary/5 to-primary/10` destoa dos cards do `FinancialSummary` que usam os tokens `card-receitas`, etc.

### Plano de correção (1 arquivo: `MonthTurnover.tsx`)

**Banner:**
- Trocar gradiente por estilo flat `bg-card border-border` consistente com o app
- Usar ícone Lucide `CalendarCheck` em vez de emoji `📊`

**Modal - Step Recap:**
- Header: trocar gradiente colorido por `bg-muted/50 border-border` — limpo e neutro
- Cards de Receita/Despesa: usar tokens do app (`bg-card-receitas`, `text-card-receitas-text`, `border-card-receitas-border` / `bg-card-despesas`, etc.)
- Card de Saldo: usar `bg-card-investimentos` (positivo) ou `bg-card-dividas` (negativo) com os respectivos tokens
- Stats extras (contas pagas, economia): manter `bg-muted/30` com ícones Lucide sem emojis
- Mensagem motivacional: `bg-muted/50 border-border` em vez de gradientes coloridos
- Remover emojis soltos no texto (📊, 🤝) — usar apenas ícones Lucide coerentes
- Botões: manter estilo atual (já usa Button do shadcn)

**Modal - Step Copy:**
- Trocar emojis nos labels (✅📑📝💰) por ícones Lucide inline pequenos ou simplesmente remover
- Manter checkboxes como estão (já usam shadcn)
- Mensagem de sucesso: trocar `✅` por ícone `CheckCircle` Lucide

**Modal - Step Badges:**
- Cards de badge: trocar `bg-amber-500/10 border-amber-500/20` por `bg-accent/10 border-accent/20` (usa o accent rosa do app)
- Trocar emoji 🏆 do header por ícone `Trophy` Lucide (já importado)

**Emojis mantidos apenas onde fazem sentido semântico:**
- Nos ícones de badge (`badge.icon`) — pois são badges/conquistas, emojis são o conteúdo
- Remover todos os outros emojis decorativos

**Tipografia:**
- Padronizar para `text-xs` e `text-sm`, eliminar `text-[9px]`, `text-[10px]`, `text-[11px]`

### Resultado
Modal e banner visualmente integrados com o design system do app — cores semânticas, ícones Lucide consistentes, sem gradientes estranhos, tipografia padronizada.

