

# Plano: Reverter textos do DayScoreRing para o original

## Problema
Os textos do score foram alterados. O usuario quer o estilo anterior com "Vamos la!" como label e "Score do dia baseado em suas atividades" como subtitulo fixo.

## Mudanca

No `src/components/home/DayScoreRing.tsx`:

1. **Remover `getScoreLabel()`** — substituir por texto fixo "Vamos la!"
2. **Remover `getMotivation()`** — substituir por texto fixo "Score do dia baseado em suas atividades"

Tudo mais (cores, ring, streak, animacoes) permanece identico.

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/home/DayScoreRing.tsx` | Reverter label para "Vamos la!" e subtitulo para "Score do dia baseado em suas atividades" |

