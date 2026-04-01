

## Auditoria Visual Completa + Guia de Padronização

### Diagnóstico: O que está errado

Analisei **todos os módulos** do app. A identidade original é clara: **Notion-like, minimalista, Inter font, cards com `bg-card` + `border-border`, emojis como ícones semânticos nas tabs, cores neutras com acentos sutis via tokens CSS.**

O módulo de Finanças está destoando porque:

1. **Dashboard com cores hardcoded de circo** — `COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#6366f1", "#14b8a6"]` para o PieChart. São 8 cores vibrantes arbitrárias que não pertencem ao design system.

2. **Gráficos duplicados e excessivos** — A Dashboard tem "Receitas vs Despesas" + "Evolução do Patrimônio", e logo abaixo o MonthlyHistory repete "Receitas vs Despesas" + "Evolução do Saldo". São **4 gráficos** dizendo a mesma coisa em estilos diferentes.

3. **MonthComparison** — Um componente pesado com seletores, barras e detalhamentos que quebra o ritmo minimalista. Ele pertence à aba Relatórios, não à Dashboard.

4. **Emojis na Dashboard** — `📊 GASTOS POR CATEGORIA`, `📈 RECEITAS VS DESPESAS`, `💰 EVOLUÇÃO DO PATRIMÔNIO` — emojis decorativos em headers. Nos outros módulos (Saúde, Rotina), emojis aparecem **apenas nas tabs** e em quick actions com função semântica, nunca como decoração de títulos de seção.

5. **Padrão dos outros módulos** — Saúde usa `text-xs font-bold uppercase tracking-wider` sem emojis nos títulos internos. Cards com tokens semânticos (`--saude-blue`, `--saude-green`). O Dashboard financeiro deveria seguir o mesmo tom.

### O que os outros módulos fazem certo

```text
Módulo       | Emojis                        | Cores           | Estilo
─────────────┼───────────────────────────────┼─────────────────┼──────────────
Saúde        | Só nas tabs (⚡⚖️🏥🛠️)        | Tokens semânticos | Cards 2xl, sóbrio
Rotina       | Mood emojis (função)          | Tailwind padrão  | Grid limpo
Dieta        | Meal emojis (🌅🍽️🍎🌙)       | Suaves com dark   | Notion-like
Treino       | Muscle emojis (🦵🍑💪)        | Exercise colors   | Listas limpas
Finanças     | Em todos os títulos!!          | Hardcoded hex     | Gráficos demais
```

### Plano de Correção

**Arquivo: `src/components/Dashboard.tsx`**

1. **Remover emojis dos títulos** — `📊 GASTOS POR CATEGORIA` → `GASTOS POR CATEGORIA` (usar ícone Lucide `PieChart` inline como os alertas já fazem)
2. **Cores do PieChart** — trocar os 8 hex hardcoded por uma paleta derivada dos chart tokens + tons neutros:
   - `hsl(var(--chart-1))` (rosa), `hsl(var(--chart-2))` (verde), `hsl(var(--chart-3))` (amarelo), `hsl(var(--chart-4))` (roxo), `hsl(var(--chart-5))` (dourado), mais 3 tons de `--muted-foreground` com opacidades
3. **Remover gráfico "Receitas vs Despesas"** da Dashboard — já existe no MonthlyHistory abaixo, duplicação
4. **Manter "Evolução do Patrimônio"** pois é único e útil
5. **Padronizar headers** — usar `<div className="flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground" /><h3 className="text-xs font-bold uppercase tracking-wider">TÍTULO</h3></div>`

**Arquivo: `src/components/finance/MonthlyHistory.tsx`**

6. **Manter como está** — já usa tokens corretos (`chart-1`, `chart-2`, `primary`), sem emojis, design limpo

**Arquivo: `src/pages/Index.tsx`**

7. **Mover MonthComparison** da aba Dashboard para a aba Relatórios — é uma ferramenta de análise, não um resumo rápido
8. **Tabs** — manter emojis nas tabs (📊💰📈❤️✈️🧮🏆📋💚) pois seguem o padrão dos outros módulos

**Arquivo: `src/components/finance/BillReminderBanner.tsx`**

9. Verificar se segue o padrão visual (sem emojis decorativos, usar ícones Lucide)

### Resultado esperado

Dashboard financeiro com a mesma energia do resto do app: limpo, Notion-like, cards sóbrios com acentos de cor sutis via tokens. Emojis **apenas** nas tabs. Gráficos sem duplicação. MonthComparison na aba certa (Relatórios).

