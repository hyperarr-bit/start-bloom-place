

# Plano: 3 ajustes — emoji 🔞 no Detox, metas vazia, mural vertical

## 1. Detox — adicionar emoji 🔞 à lista de ícones
No `src/components/detox/DetoxTracker.tsx`, linha 17, o array `iconOptions` tem `["🚬", "🍺", "📱", "🍔", "🎮", "☕", "🍫", "💊"]`. Adicionar `"🔞"` ao array.

## 2. Metas — começar sem meta pré-cadastrada
No `src/components/hiperfoco/GoalsBoardV2.tsx`, linha 43, mudar `defaultGoals` de `[emptyGoal("Minha Meta")]` para `[]`. O usuário verá a planilha vazia e usará o botão "Nova meta" para criar a primeira.

## 3. Mural dos Sonhos — fotos empilhadas verticalmente
No `src/components/hiperfoco/GoalsBoardV2.tsx`, linhas 200-207, trocar o layout de `grid grid-cols-3 gap-2` para `space-y-3` (vertical). Cada imagem muda de `h-24 object-cover` para `w-full rounded-lg` com altura automática, ficando uma embaixo da outra em tamanho grande.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/detox/DetoxTracker.tsx` | Adicionar `"🔞"` ao array `iconOptions` |
| `src/components/hiperfoco/GoalsBoardV2.tsx` | (1) `defaultGoals = []` (2) Mural: trocar grid 3 colunas por stack vertical com imagens full-width |

