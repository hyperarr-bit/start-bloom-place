

## Por que o banner de lembretes NÃO aparece

Analisei os dados da sua conta e o código. O banner **funciona corretamente** — o problema é que ele não tem nada para mostrar.

### Diagnóstico

Seus vencimentos (`finance-dueDays`) no mês de Abril:
- Dia 1: sem contas
- Dia 5: sem contas  
- Dia 10: "Tuauei" (não paga) — **9 dias de distância**
- Dia 15: sem contas
- Dia 18: "Vencimento cartão" (não paga) — **17 dias de distância**

O hook `useBillReminders` usa `REMINDER_DAYS_AHEAD = 3`, ou seja, só mostra contas que vencem em **até 3 dias**. Hoje é dia 1, então nenhuma conta se qualifica.

O banner retorna `null` na linha 18: `if (bills.length === 0) return null`.

### Plano de correção

**Arquivo: `src/hooks/use-bill-reminders.ts`**

1. Criar dois modos de filtragem:
   - `getUpcomingBills()` — mantém o filtro de 3 dias (para notificações push)
   - `getAllMonthBills()` — retorna **todas** as contas não pagas do mês, com `daysUntil` calculado

2. Exportar `getAllMonthBills` no retorno do hook

**Arquivo: `src/components/finance/BillReminderBanner.tsx`**

1. Usar `getAllMonthBills()` em vez de `getUpcomingBills()` para decidir se o banner aparece
2. Reorganizar a exibição em seções:
   - **Vencidas** (vermelho) — contas com `daysUntil < 0`
   - **Hoje** (âmbar) — contas com `daysUntil === 0`
   - **Próximos 3 dias** (azul) — contas com `daysUntil` entre 1 e 3
   - **Este mês** (cinza/muted) — contas restantes do mês, em texto mais sutil
3. Manter o banner sempre visível enquanto houver contas não pagas no mês
4. Urgência visual proporcional: se só tem contas distantes, o banner fica discreto (cinza/muted), sem alarme visual
5. Alinhar identidade visual com tokens do design system (mesma correção feita no MonthTurnover)

**Arquivo: `src/pages/Index.tsx`**
- Sem alteração necessária — já renderiza o banner no lugar certo

### Resultado esperado
- No dia 1 de Abril, o banner aparece mostrando "Tuauei (dia 10)" e "Vencimento cartão (dia 18)" de forma discreta
- Conforme as datas se aproximam (3 dias antes), a urgência visual aumenta automaticamente
- Contas vencidas ficam em destaque vermelho

