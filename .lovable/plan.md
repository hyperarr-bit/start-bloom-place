

# Plano: Adicionar "Por que quero parar?" aos hábitos do Detox

## Ideia

Cada hábito ganha um campo de **motivos/frases motivacionais** que o usuário cadastra. Ao expandir o hábito, aparece uma seção "Por que quero parar?" com os motivos listados como cards inspiracionais. Um motivo aleatório também aparece no dialog de confirmação de recaída para reforçar a determinação.

## Mudanças

### 1. Expandir interface `DetoxHabit`
- Adicionar `reasons?: string[]` — lista de motivos/frases

### 2. Seção "Por que quero parar?" no card expandido
- Aparece abaixo do botão de check-in, antes do calendário
- Lista os motivos como mini-cards com emoji 💪
- Input inline + botão para adicionar novo motivo
- Botão X discreto para remover motivo
- Placeholder: "Ex: Pela minha saúde, Pela minha família..."

### 3. Motivo no dialog de recaída
- Se o hábito tem motivos cadastrados, mostrar um aleatório no dialog de confirmação de recaída como lembrete antes de confirmar
- Ex: "Lembre-se: Pela minha saúde"

## Arquivo alterado (1)

| Arquivo | Mudança |
|---------|---------|
| `src/components/detox/DetoxTracker.tsx` | Adicionar `reasons` à interface, seção de motivos no card expandido, motivo aleatório no dialog de recaída |

