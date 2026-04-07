

# Plano: Reverter cor do score baixo para amarelo-alaranjado

## Problema
Quando o score esta abaixo de 50, a cor do ring usa `hsl(var(--accent))` que e rosa/vermelho. Antes era amarelo-alaranjado.

## Mudanca

No `src/components/home/DayScoreRing.tsx`, linha 17:
- Trocar `return "hsl(var(--accent))"` por `return "hsl(var(--warning))"`

Assim o ring fica amarelo-alaranjado para scores baixos e medios, e verde para scores altos (>=80).

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/home/DayScoreRing.tsx` | Trocar fallback de `--accent` para `--warning` na funcao getScoreColor |

