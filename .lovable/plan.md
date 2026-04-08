

# Plano: Restaurar emoji na aba Estratégia e manter card sem emoji

## Problema
O emoji ♟️ foi removido da aba (header/tab) quando deveria ter sido removido apenas do card interno. A aba ficou sem emoji enquanto todas as outras têm.

## Mudanças

### 1. `src/pages/Hiperfoco.tsx` — Restaurar emoji na tab
- Linha 18: trocar `icon: ""` por `icon: "♟️"`

### 2. `src/components/hiperfoco/StrategyPanel.tsx` — Já está OK
- O card já usa ícone Lucide `Target` sem emoji. Nenhuma mudança necessária.

## Arquivo alterado (1)

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Hiperfoco.tsx` | Restaurar `icon: "♟️"` na tab estratégia |

