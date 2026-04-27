# Correção de Cores no Modo Escuro - Módulo Rotina

## Problema Identificado
O módulo Rotina utiliza dezenas de cores hardcoded que não se adaptam ao tema escuro, criando contrastes ruins e elementos difíceis de visualizar.

## Lista de Correções Necessárias

### 1. Gradientes de Header Cards (12 componentes)
Converter gradientes hardcoded para usar classes do Tailwind que respeitem o tema:

| Componente | Gradiente Atual | Solução |
|------------|-----------------|---------|
| PomodoroTimer | `from-red-500 to-orange-500` etc. | Usar `bg-primary` com opacidade ou cores semânticas |
| MoodTracker | `from-purple-400 to-pink-400` | Substituir por `bg-secondary` ou similar |
| HealthTracker | `from-cyan-400 to-blue-500` | Usar tokens de cor do tema |
| TodoList | `from-violet-500 to-purple-600` | Usar `bg-muted` ou similar |
| Rituals (manhã) | `from-amber-400 to-orange-500` | Tema warm neutral |
| Rituals (noite) | `from-indigo-500 to-purple-600` | Tema cool neutral |
| HabitHeatmap | `from-green-500 to-emerald-600` | Usar `bg-success` |
| MonthlyPlanning cal | `from-teal-500 to-cyan-500` | `bg-primary` |
| MonthlyPlanning goals | `from-amber-500 to-yellow-500` | `bg-warning` |
| MonthlyPlanning retro | `from-rose-500 to-pink-500` | `bg-accent` |
| DailyJournal | `from-pink-400 to-rose-500` | `bg-accent` |
| EnergyTracker | `from-yellow-400 to-orange-500` | `bg-warning` |
| FocusZones | `from-slate-600 to-slate-800` | `bg-muted` |
| WeeklyReview | `from-emerald-500 to-teal-600` | `bg-success` |
| Rotina header | `bg-green-100` + `text-green-900` | `bg-muted` + `text-foreground` |

### 2. Tabela de Hábitos Diários
Substituir sistema de cores hardcoded por variáveis do tema:
- `bg-green-100` → `bg-muted` ou `bg-secondary`
- `bg-green-50` → `bg-muted/50`
- `border-green-200` → `border-border`
- `text-green-900` → `text-foreground`
- `text-green-800` → `text-muted-foreground`
- `border-green-100` → `border-border`
- Checkbox: `border-blue-400` → `border-primary`

### 3. Priority Colors (TodoList)
Converter para sistema que funcione em ambos os temas:
- `bg-red-100 text-red-700 border-red-200` → usar `bg-destructive/10` etc.
- `bg-yellow-100 text-yellow-700 border-yellow-200` → usar `bg-warning/10` etc.
- `bg-blue-100 text-blue-700 border-blue-200` → usar `bg-primary/10` etc.

### 4. Health Tracker (Água)
- `bg-blue-100 border-blue-300 text-blue-600` → `bg-primary/10 border-primary/20 text-primary`

### 5. Focus Zones (Blocos de Cor)
Cores hardcoded para diferentes tipos de blocos precisam de alternativa dark-friendly:
- `bg-red-200 border-red-400` → `bg-destructive/20 border-destructive`
- `bg-blue-200 border-blue-400` → `bg-primary/20 border-primary`
- `bg-purple-200 border-purple-400` → `bg-accent/20 border-accent`
- `bg-green-200 border-green-400` → `bg-success/20 border-success`
- `bg-yellow-200 border-yellow-400` → `bg-warning/20 border-warning`
- `bg-pink-200 border-pink-400` → `bg-accent/20 border-accent`

### 6. Energy Tracker
Níveis de energia com cores fixas:
- `bg-red-400`, `bg-yellow-400`, `bg-green-400` → manter mas adicionar classes dark apropriadas ou usar sistema de cor semântico

### 7. Mood Emojis Background
Cores hardcoded para cada humor:
- `bg-green-400`, `bg-green-300`, `bg-yellow-300`, `bg-orange-300`, `bg-red-300` → usar opacidade ou sistema de tokens

### 8. Habit Heatmap
- `bg-green-500` para dias ativos → `bg-success` ou similar

## Abordagem Técnica

### Opção A: CSS Variables + Tailwind (Recomendada)
Aproveitar as variáveis já definidas em `index.css`:
- `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`

### Opção B: Classes Dark Específicas
Usar notação dark: para sobrescrever no modo escuro:
```
bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300
```

## Estrutura do Arquivo
Arquivo alvo: `src/pages/Rotina.tsx` (~1265 linhas)

## Resultado Esperado
Módulo Rotina visualmente consistente com o resto da aplicação em ambos os temas claro e escuro.