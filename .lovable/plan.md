

## Plano: Corrigir banner de lembretes + melhorar cores dos gráficos

### Problema 1: Banner não aparece
O `BillReminderBanner` está renderizado **apenas na Dashboard** (linha 181 do Index.tsx). O código e a lógica estão corretos — ele busca todas as contas do mês via `getAllMonthBills()`. O problema pode ser que os dados não estão sendo lidos corretamente via `useUserData` (Supabase) ou o componente está montando antes dos dados carregarem.

**Correção:**
- Adicionar o banner **também na aba "Meu Financeiro"** (antes do `FinancialSummary`, após o `MonthTurnover`)
- No hook `use-bill-reminders.ts`, adicionar um re-check quando os dados do Supabase carregarem (o `useEffect` atual roda uma vez mas pode executar antes do fetch completar)
- No `BillReminderBanner`, trocar o `useEffect` com `useState` por um `useMemo` direto, ou adicionar dependency no loading state do userData

### Problema 2: Cores feias no gráfico Receitas x Despesas
O `MonthlyHistory` usa `hsl(var(--card-receitas-text))` e `hsl(var(--card-despesas-text))` para as barras. No modo claro, receitas-text é um amarelo escuro (`45 60% 30%`) e despesas-text é um roxo escuro (`250 50% 35%`) — cores opacas e sem vida para barras de gráfico.

**Correção:**
- Receitas: usar um verde vibrante `hsl(142 55% 42%)` (chart-2, verde investimentos) — mais intuitivo que amarelo para "ganhos"
- Despesas: usar o rosa/vermelho do design system `hsl(330 65% 50%)` (chart-1, cor de dívidas) — intuitivo para "gastos"
- Alternativa: usar cores com opacidade adequada para barras (mais saturadas, não os tons de texto)

### Arquivos a modificar

**`src/pages/Index.tsx`**
- Adicionar `<BillReminderBanner />` dentro da aba "financeiro", logo após `<MonthTurnover />`

**`src/components/finance/BillReminderBanner.tsx`**
- Melhorar o useEffect para reagir a mudanças nos dados (não apenas mount)
- Usar intervalo ou subscription para garantir que dados do Supabase carregaram

**`src/components/finance/MonthlyHistory.tsx`**
- Trocar cores das barras do BarChart:
  - Receitas: `hsl(var(--chart-2))` (verde) 
  - Despesas: `hsl(var(--chart-1))` (rosa/vermelho)
- Cores mais vibrantes e intuitivas (verde = entrada, vermelho = saída)

### Resultado
- Banner de contas visível tanto na Dashboard quanto no Meu Financeiro
- Gráfico com cores intuitivas: verde para receitas, rosa/vermelho para despesas

