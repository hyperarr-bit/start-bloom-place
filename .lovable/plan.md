

# Verificacao: Widgets da Home e Conexao com Modulos

## Resultado da Analise

Revisados todos os 16 widgets. A maioria esta corretamente conectada, mas encontrei **3 problemas reais**:

### Problema 1: Chave de treino duplicada (BUG)
- **WorkoutWidget** e **Treino.tsx** usam `saude-workout-log` (array de strings)
- **WeekCalendarWidget** e **QuickActions** usam `core-treino-log` (objeto `{date: boolean}`)
- Resultado: marcar treino pelo widget nao reflete no calendario semanal, e vice-versa

**Correcao**: Unificar tudo para `saude-workout-log` (a chave do modulo real). Alterar `WeekCalendarWidget` e `QuickActions` para ler/escrever `saude-workout-log`.

### Problema 2: WeekProgressWidget usa dados aleatorios (BUG)
- Le `core-week-scores` que **nunca e escrito** em nenhum lugar do app
- Fallback gera numeros aleatorios — dados falsos mostrados ao usuario

**Correcao**: Calcular o score real de cada dia da semana usando a mesma logica do `dayScore` no `use-life-hub-data.ts`, lendo hábitos, agua, treino etc. dos ultimos 7 dias.

### Problema 3: QuickActions marca treino em chave errada (BUG)
- Escreve em `core-treino-log` em vez de `saude-workout-log`
- Treino marcado via acao rapida nao aparece no widget de Treino nem no modulo

**Correcao**: Mudar para `saude-workout-log` com formato array (igual ao modulo).

## Widgets OK (sem problemas)
- Financas, Calorias, Saude, Habitos, Leitura, Orcamento Restante, Ofensiva de Habitos, Frase do Dia, Notas Rapidas, Timer de Foco, Macros, Sono, Contagem Regressiva — todos leem/escrevem as mesmas chaves dos seus modulos.

## Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/home/widgets/WeekCalendarWidget.tsx` | Trocar `core-treino-log` por `saude-workout-log` e adaptar leitura (array → includes) |
| `src/components/home/widgets/WeekProgressWidget.tsx` | Calcular scores reais dos ultimos 7 dias em vez de ler chave inexistente |
| `src/components/home/QuickActions.tsx` | Trocar `core-treino-log` por `saude-workout-log` (formato array) |

