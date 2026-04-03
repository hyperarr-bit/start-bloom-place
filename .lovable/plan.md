

# Notificação de Desejos Baseada na Previsão de Fim do Mês

## Problema
A notificação de compatibilidade dos desejos usa um cálculo simples (`receita - despesas - parcelas`), enquanto o Dashboard tem um card "Previsão Fim do Mês" mais inteligente que considera: gastos fixos já registrados, projeção de gastos variáveis baseada no ritmo diário, e contas pendentes não pagas.

## Solução
Passar `fixedExpenses` e `dueDays` como props para `WishlistItems` e replicar a lógica do forecast do Dashboard para calcular o saldo projetado real. A notificação vai mostrar o saldo projetado de fim de mês em vez do saldo livre simples.

### Nova lógica da notificação:
- **Saldo projetado** = receita − gastos já feitos − contas pendentes − projeção de gastos restantes (mesmo cálculo do Dashboard)
- **Compatível**: se saldo projetado > 0 → "Seus desejos cabem! Saldo projetado: R$ X → R$ Y/mês para desejos (30%)"
- **Incompatível**: se saldo projetado ≤ 0 → "Previsão aponta saldo negativo de R$ X no fim do mês"
- **Tempo estimado** também usa o saldo projetado × 30% em vez do saldo livre simples

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/WishlistItems.tsx` | Adicionar props `fixedExpenses` e `dueDays`; calcular forecast igual ao Dashboard (projeção diária + contas pendentes); atualizar texto da notificação para mostrar "Previsão fim do mês: R$ X" e usar saldo projetado para cálculo de tempo estimado e compatibilidade |
| `src/pages/Index.tsx` | Passar `fixedExpenses` e `dueDays` como props ao `WishlistItems` |

