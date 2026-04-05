

# Plano: Cores mais vibrantes nos headers das seções

## Problema
Todos os headers de seção (PLANO DE AÇÃO, VISÃO, PROBLEMAS, MURAL) usam a mesma cor marrom/bege morta (`hsl(30 20% 78% / 0.35)`). Fica monótono.

## Solução
Dar uma cor diferente e mais viva para cada seção, tanto na home quanto no detail:

### Home view
- PLANO DE AÇÃO → marrom quente `hsl(30 35% 72% / 0.4)` (manter, é o 🎯)
- Frase motivacional → já tem cor própria ✓
- MURAL DOS SONHOS → roxo suave `hsl(270 40% 75% / 0.35)`

### Detail view (cada seção com cor diferente)
- PLANO DE AÇÃO → azul claro `#93C5FD` (blue-300)
- REFERÊNCIAS → verde menta `#86EFAC` (green-300)
- VISÃO → amarelo quente `#FDE68A` (amber-200)
- PROBLEMAS E SOLUÇÕES → rosa/coral `#FCA5A5` (red-300)
- GALERIA → lilás `#C4B5FD` (violet-300)

Cada `SectionHeader` receberá um prop `color` ao invés de usar a cor fixa.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/components/hiperfoco/GoalsBoardV2.tsx` | (1) `SectionHeader` recebe prop `color` (string hex). (2) Aplicar cores distintas em cada chamada de `SectionHeader` no detail view. (3) Na home, MURAL DOS SONHOS recebe header roxo em vez de marrom. |

