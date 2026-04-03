

# Corrigir Score de Saúde Financeira

## Problemas encontrados

### 1. `totalExpenses` NÃO inclui despesas fixas
Na linha 81 do `Index.tsx`, `totalExpenses` soma apenas `expenses` (variáveis). As `fixedExpenses` são completamente ignoradas. Isso faz:
- **Taxa de poupança** parecer muito maior do que é (ex: se ganha 5000, gasta 1000 variável e 3000 fixo → mostra 80% de poupança quando deveria ser 20%)
- **Saldo real mensal** e **projeção anual** ficam inflados
- **Reserva de emergência meta** (`totalExpenses * 6`) fica baixa demais

### 2. `investmentRate` usa valor total da carteira vs renda anual
Linha 92: `(totalInvestments / (totalIncome * 12)) * 100` — compara patrimônio acumulado com renda. Deveria comparar **aportes mensais** vs renda mensal para medir disciplina de investimento.

### 3. Score dá 10 pontos de graça (base)
Linha 134: `score += 10` — infla o score sem motivo. Um usuário sem dados já começa em ~25 (10 base + 15 contas em dia default).

### 4. Parcelas não entram no cálculo de despesas totais
O `monthlyInstallments` é calculado em Index.tsx mas NÃO é passado nem somado no `totalExpenses` que vai para o FinancialHealth.

## Solução

### `src/pages/Index.tsx`
- Criar `totalAllExpenses = totalExpenses + totalFixedExpenses + monthlyInstallments` e passar como prop ou passar `fixedExpenses` e `monthlyInstallments` separados
- Passar `fixedExpenses` como prop para o FinancialHealth

### `src/components/FinancialHealth.tsx`
- Receber `fixedExpenses` e `monthlyInstallments` como props
- Recalcular `totalRealExpenses = totalExpenses + fixedExpensesTotal + monthlyInstallments`
- **Savings rate**: usar `(totalIncome - totalRealExpenses) / totalIncome`
- **Investment rate**: usar `monthlyContributions / totalIncome * 100` (aportes mensais vs renda mensal)
- **Reserva de emergência meta**: usar `totalRealExpenses * 6`
- **Saldo real mensal**: `totalIncome - totalRealExpenses`
- **Remover base de 10 pontos** — redistribuir: Poupança 20pts, Contas 15pts, Emergência 15pts, Investimentos 15pts, Metas 10pts, Dívidas -15pts, Parcelas 5pts, Desejos 5pts, Diversificação 5pts, Aportes 5pts
- Ajustar as dicas para refletir os valores reais

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Calcular `totalFixedExpenses`, passar junto com `monthlyInstallments` como props ao FinancialHealth |
| `src/components/FinancialHealth.tsx` | Receber novas props; usar despesa real total no score; corrigir investmentRate para usar aportes; remover base 10; recalibrar pesos |

