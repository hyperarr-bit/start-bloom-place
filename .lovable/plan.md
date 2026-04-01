

# Análise da Identidade Visual — Módulo de Finanças

Analisei meticulosamente todos os componentes do módulo de finanças. Vou salvar as regras de design como memória do projeto para garantir consistência em tudo que for criado a partir de agora.

---

## Padrões Identificados

### Layout e Estrutura
- **Container**: `max-w-7xl mx-auto px-4 py-5 space-y-5`
- **Header fixo**: `border-b border-border bg-card sticky top-0 z-50`
- **Título**: `text-base font-bold tracking-tight`, formato "CORE — MÓDULO"
- **Tabs**: classe `notion-tab` (custom), texto `text-[11px]`, emojis apenas nas labels das tabs
- **Grid responsivo**: `grid grid-cols-2 lg:grid-cols-4 gap-3`

### Cards e Containers
- **Card padrão**: `bg-card rounded-lg border border-border p-4`
- **Animação de entrada**: `animate-fade-in` em todos os componentes
- **Card com cor semântica**: usa tokens `bg-card-receitas`, `bg-card-despesas`, `bg-card-dividas`, `bg-card-investimentos` com `border-*-border` e `text-*-text`

### Tabelas
- **Container**: `bg-card rounded-lg overflow-hidden border border-border`
- **Header colorido**: faixa com `bg-income py-2 px-4` + texto `font-bold text-sm tracking-wide`
- **Cabeçalho da tabela**: `border-b border-border bg-muted/30`, texto `text-xs font-medium text-muted-foreground`
- **Linha de input novo**: `bg-muted/20`, inputs transparentes `border-0 bg-transparent shadow-none px-0 focus-visible:ring-0`
- **Rodapé**: `border-t border-border`, label "SUM" ou "TOTAL" + valor em `font-bold tabular-nums`
- **Linhas**: `border-b border-border/50 hover:bg-muted/20 transition-colors`
- **Badges de categoria**: `category-badge` (custom class: `px-2.5 py-0.5 rounded-full text-xs font-medium`)

### Tipografia
- **Títulos de seção**: `text-xs font-bold`, UPPERCASE, com `tracking-wide` ou `tracking-widest`
- **Labels**: `text-xs text-muted-foreground`
- **Micro-texto**: `text-[10px] text-muted-foreground`
- **Valores monetários**: `tabular-nums`, formatados com `toLocaleString("pt-BR")`
- **Lucide icons**: `w-3.5 h-3.5` em ações, `w-4 h-4` em headers, `w-8 h-8` em stat cards (com opacidade `/30`)

### Cores (nunca hex hardcoded nos componentes novos)
- **Receitas/positivo**: `text-green-400` (dashboard) ou tokens `card-receitas`
- **Despesas/negativo**: `text-red-400` ou tokens `card-despesas`
- **Dívidas**: `text-orange-400` ou tokens `card-dividas`
- **Investimentos**: `text-purple-400` ou tokens `card-investimentos`
- **Alertas**: `bg-orange-500/10 border-orange-500/20` (warning), `bg-green-500/10` (success), `bg-blue-500/10` (info)

### Interações
- **Botão de ação**: ícone `Plus` em `text-muted-foreground hover:text-foreground`
- **Botão de deletar**: `Trash2` em `text-muted-foreground hover:text-destructive`, aparece com `opacity-0 group-hover:opacity-100`
- **Dialogs**: `max-w-md w-[92vw] p-0`, conteúdo com `p-6 space-y-5`, animação Framer Motion `opacity/y`
- **Empty states**: texto centralizado `text-xs text-muted-foreground` + subtexto `text-[10px]`

### Componentes UI usados
- `Button` (shadcn) com `variant="outline" size="sm" text-xs`
- `Input` com `h-7 text-xs`
- `Select` (shadcn) para dropdowns
- `Checkbox` com `h-3.5 w-3.5 rounded-full`
- `Progress` (shadcn) para barras
- `Dialog/DialogContent` para modais
- Recharts para gráficos (`PieChart`, `BarChart`, `AreaChart`)

---

## Plano de Implementação

Vou criar/atualizar um arquivo de memória detalhado com todas essas regras para que qualquer novo componente siga exatamente o mesmo padrão.

### Arquivo a criar
**`mem://design/finance-identity`** — Guia completo da identidade visual do módulo de finanças, incluindo todos os padrões de cards, tabelas, tipografia, cores, interações e componentes.

### Arquivo a atualizar
**`mem://index.md`** — Adicionar referência ao novo arquivo de memória.

