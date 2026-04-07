

# Plano: Excluir Iniciar Foco, integrar Nova Tarefa com Rotina, adicionar 4 novas ações

## Resumo

- Remover "Iniciar Foco" das ações rápidas
- Integrar "Nova Tarefa" com o módulo Rotina (salvar em `rotina-urgencies` que é a lista de tarefas urgentes)
- Adicionar 4 novas ações: Marcar Treino, Registrar Sono, Registrar Refeição, Check-in Detox

## Mudanças detalhadas

### 1. Remover "Iniciar Foco"
- Remover da lista `actions` e remover a função `startFocus()`
- Remover import do `Timer`

### 2. Integrar "Nova Tarefa" com Rotina
- Trocar storage key de `core-quick-tasks` para `rotina-urgencies`
- Formato: `{ id: string, text: string, done: false }` (mesmo formato usado em Rotina.tsx)
- Toast com ação "Ver em Rotina" que navega para `/rotina`

### 3. Adicionar 4 novas ações rápidas

| Ação | Icone | Storage Key | Formato | Integração |
|------|-------|-------------|---------|------------|
| Marcar Treino | Dumbbell | `core-treino-log` | `{ [date]: true }` | WeekCalendarWidget, DayScore |
| Registrar Sono | Moon | `core-saude-sleep` | `{ [date]: hours }` | SleepLogWidget, DayScore, Saude |
| Registrar Refeição | Utensils | `core-dieta-log` | `{ [date]: { [id]: {name, calories} } }` | CaloriesWidget, MacroBalanceWidget, DayScore |
| Check-in Detox | Shield | `detox-habits` | Incrementa checkins do dia nos hábitos existentes | DetoxTracker, DayScore |

### 4. Forms inline para as novas ações
- **Treino**: Botão direto (1 toque registra treino do dia), similar ao "Água"
- **Sono**: Input numérico "Quantas horas dormiu?" + botão confirmar
- **Refeição**: Input nome + input calorias + botão confirmar
- **Detox**: Lista os hábitos detox existentes como botões, cada clique faz check-in

### 5. Ordem final das ações (11 total)
Água, Humor, Gasto, Peso, Treino, Sono, Refeição, Ideia, Tarefa, Gratidão, Detox

## Arquivo alterado (1)

| Arquivo | Mudança |
|---------|---------|
| `src/components/home/QuickActions.tsx` | Remover foco, integrar tarefa com rotina-urgencies, adicionar 4 novas ações com forms inline |

