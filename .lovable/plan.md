

## Simplificar webhook para eventos reais da AbacatePay

A AbacatePay só disponibiliza: `billing.paid`, `billing.disputed`, `withdraw.done`, `withdraw.failed`. O webhook atual trata eventos que não existem (`subscription.completed`, `subscription.cancelled`).

### Mudança

**Arquivo**: `supabase/functions/abacatepay-webhook/index.ts`

- Remover tratamento de `subscription.completed` e `subscription.cancelled`
- Manter apenas `billing.paid` como evento principal para ativar/renovar assinatura
- Adicionar tratamento de `billing.disputed` para marcar assinatura como suspensa (opcional mas útil)

Mudança pequena, apenas limpeza do webhook existente.

