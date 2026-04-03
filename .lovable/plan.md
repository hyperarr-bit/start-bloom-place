

# Correções: Patrimônio, Orçamento Mensal/Anual com Ano

## Problemas Identificados

1. **Evolução do Patrimônio**: usa fórmula arbitrária (`saving * 0.2`), não reflete dados reais
2. **Orçamento Mensal e Anual**: as storage keys não incluem o ano — dados de Set/Nov/Dez de 2025 aparecem como se fossem de 2026
3. **Virada de ano**: precisa preservar dados antigos e separar por ano

## Solução

### 1. Storage keys com ano (`storage-keys.ts`)

Mudar a lógica para incluir o ano nas chaves de meses que NÃO são o mês atual:
- Mês atual: continua usando chaves base (`finance-incomes`, etc.)
- Outros meses do ano corrente: `finance-2026-janeiro-incomes`
- Meses de anos anteriores: `finance-2025-setembro-incomes`

Adicionar **migração automática**: na primeira vez que roda, detectar chaves antigas (`finance-month-setembro-incomes`) e renomear para o formato com ano. Como o app lançou em 2025 e estamos em abril de 2026, dados de Set/Nov/Dez seriam migrados para `finance-2025-*` e dados de Jan-Mar para `finance-2026-*`.

Adicionar `getFinanceStorageKeys(month, year?)` com parâmetro de ano opcional (default: ano atual).

Funções auxiliares:
- `getMonthTotals(month, year?)` — já aceita ano
- `getCurrentYear()` — retorna ano corrente

### 2. Orçamento Mensal (`MonthlyBudget.tsx`)

- `hasMonthData()` usa as novas chaves com ano corrente
- Meses futuros do ano corrente não mostram "ativo" a menos que tenham dados

### 3. Orçamento Anual (`AnnualBudget.tsx`)

- Passa ano corrente para `getMonthTotals`
- Só mostra dados do ano corrente (2026)
- Comentário no código sobre futura feature de seletor de ano

### 4. Evolução do Patrimônio (`Dashboard.tsx`)

Substituir a fórmula `saving * 0.2` por acúmulo real:
- Patrimônio = soma acumulada dos saldos mensais (receitas - custos fixos - variáveis)
- Começa do mês mais antigo com dados até o mês atual
- Se o usuário tem `totalInvestments`, soma como base inicial
- Gráfico mostra a curva real de quanto sobrou/faltou acumulado

### 5. MonthTurnover e MonthlySheet

Atualizar referências às chaves de `finance-month-*` para o novo formato com ano.

## Preparação para virada de ano

- Dados de 2026 ficam em `finance-2026-*`
- Quando virar 2027, o mês atual usa chaves base, meses anteriores de 2027 usam `finance-2027-*`
- Dados de 2026 permanecem intactos em `finance-2026-*`
- Comentário `// TODO: adicionar seletor de ano para visualizar anos anteriores`

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/finance/storage-keys.ts` | Adicionar ano nas chaves, migração automática de chaves antigas, `getMonthTotals(month, year?)` |
| `src/components/AnnualBudget.tsx` | Passar ano corrente, só mostrar dados do ano atual |
| `src/components/MonthlyBudget.tsx` | Usar novas chaves com ano |
| `src/components/Dashboard.tsx` | Corrigir patrimonyData para acúmulo real; passar ano para `getMonthTotals` |
| `src/components/MonthTurnover.tsx` | Atualizar chaves de category-budgets para formato com ano |
| `src/components/MonthlySheet.tsx` | Se usa storage-keys, atualizar para formato com ano |

