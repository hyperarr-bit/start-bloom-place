

# Plano: Exercícios sem valores padrão + Progressão funcional

## Problema 1: "3 de 12 automático"
Quando o usuário adiciona um exercício, os campos já vêm preenchidos com `sets: "3", reps: "12", carga: "—"`. O usuário quer adicionar os valores manualmente.

**Solução**: Mudar o default para campos vazios (`sets: "", reps: "", carga: ""`). Mostrar placeholder "0" nos inputs para indicar onde digitar.

Linhas afetadas: ~396, ~519 (dois locais onde exercícios são criados com `{ name: ..., sets: "3", reps: "12", carga: "—", ... }`).

## Problema 2: Progressão — Select não mostra exercícios
O dropdown de exercícios na aba PROGRESSÃO usa `uniqueExercises`, que vem de `exerciseHistory`. Se o usuário nunca finalizou uma sessão, o histórico está vazio e o Select não tem opções.

**Solução**: Além do `exerciseHistory`, também incluir os exercícios do plano atual (todos os dias) no Select. Assim o usuário vê os exercícios que já cadastrou, mesmo sem histórico.

Linha ~276: expandir `uniqueExercises` para incluir exercícios do `workoutPlan` atual.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Treino.tsx` | (1) Trocar default de novos exercícios de `sets:"3", reps:"12", carga:"—"` para `sets:"", reps:"", carga:""` nos dois pontos de criação. (2) Expandir `uniqueExercises` para incluir exercícios do plano atual além do histórico. (3) Adicionar placeholders nos inputs de sets/reps/carga ("S", "R", "kg"). |

