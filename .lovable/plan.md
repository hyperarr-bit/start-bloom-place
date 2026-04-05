

# Plano: Horários até 0:00 + Diário/Revisão persistentes por data

## Mudanças

### 1. Rotina semanal — horários até 0:00
**Linha 19-22**: Expandir o array `hours` para incluir todos os horários até meia-noite:
```text
ANTES: "6:00" ... "19:00", "19:30"
DEPOIS: "6:00", "7:00", "8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "0:00"
```

### 2. Diário — salvar por data e navegar entre dias passados
Atualmente o `DailyJournal` só mostra "hoje" (`getDateKey()`). Depois que o dia passa, o usuário não consegue ver o que escreveu.

**Solução**: Adicionar navegação por data no Diário (botões ← →  e exibição da data). Os dados já estão salvos por chave de data no `journal-entries`, só falta a navegação para acessar dias anteriores. O campo continua editável para dias passados.

### 3. Revisão — salvar por semana e navegar entre semanas passadas
Atualmente o `WeeklyReview` só mostra a semana atual (`getWeekKey()`). Semana passada some.

**Solução**: Adicionar navegação por semana (botões ← →) no componente `WeeklyReview`. Os dados já estão salvos por chave de semana no `weekly-reviews`, só falta a UI de navegação.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Rotina.tsx` | (1) Expandir `hours` até "0:00". (2) No `DailyJournal`: adicionar estado `selectedDate` com navegação ← → entre dias, mostrando a data formatada. (3) No `WeeklyReview`: adicionar estado `weekOffset` com navegação ← → entre semanas, mostrando o intervalo de datas da semana. |

