

# Plano: Melhorar cores do score nos temas Rose e Forest

## Problema

O score ring usa `--warning` e `--success`. Nos temas Rose e Forest esses tokens ficam com cores apagadas/feias:

- **Rose**: warning = `10 70% 55%` (vermelho opaco), success = `330 60% 55%` (rosa escuro)
- **Forest**: warning = `80 60% 42%` (verde-amarelo morto), success = `142 71% 45%` (verde escuro)

## Solucao

Ajustar os tokens `--warning` e `--success` nos temas Rose e Forest para tons mais vivos e bonitos, mantendo a identidade do tema:

### Rose (light + dark)
- **warning**: trocar para um coral/peach vibrante — `20 90% 62%` (light) / `20 90% 67%` (dark)
- **success**: trocar para um pink quente vibrante — `340 75% 62%` (light) / `340 75% 67%` (dark)

### Forest (light + dark)
- **warning**: trocar para um lima/chartreuse vibrante — `85 70% 48%` (light) / `85 70% 52%` (dark)
- **success**: trocar para um verde-esmeralda vibrante — `152 80% 42%` (light) / `152 80% 48%` (dark)

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/use-theme.tsx` | Atualizar valores de `--warning` e `--success` nos objetos `rose.light`, `rose.dark`, `forest.light`, `forest.dark` |

