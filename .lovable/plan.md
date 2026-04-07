

# Plano: Redesenhar PetRoutine com avatar do pet + habitos customizaveis

## Problema atual
- Cards de rotina sao genericos sem identificacao visual do pet
- Tarefas sao fixas (hardcoded) — usuario nao pode adicionar/remover
- Nao tem emoji junto dos habitos customizados

## Mudancas

### 1. Avatar do pet no header do card
Adicionar foto/emoji do pet ao lado do nome (mesmo estilo do PetList — foto circular ou emoji baseado na especie via `getEmoji`).

### 2. Habitos customizaveis com emoji
- Manter os 6 defaults como sugestao inicial (so aparecem se usuario nao tem habitos salvos)
- Novo storage key `pet-routine-tasks-{petId}` para habitos customizados por pet
- Input inline no final do grid: campo emoji (selector simples com emojis comuns) + campo texto + botao Add
- Cada habito customizado tem: `id`, `label`, `emoji`
- Botao X discreto no hover para remover habito

### 3. Header do card melhorado
- Foto/emoji circular a esquerda
- Nome do pet em bold
- Badge de progresso a direita (mesmo de agora)
- Barra de progresso abaixo

## Arquivo alterado (1)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/pet/PetRoutine.tsx` | Avatar pet no header, habitos customizaveis por pet com emoji, input inline para adicionar, funcao getEmoji reutilizada |

