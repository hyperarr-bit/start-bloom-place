

## Corrigir `frequency` para valor aceito pela API AbacatePay

### Problema
A API AbacatePay v1 (`/v1/billing/create`) aceita apenas dois valores para `frequency`:
- `ONE_TIME` — cobrança única
- `MULTIPLE_PAYMENTS` — cobrança que pode ser paga mais de uma vez

O código atual envia `MONTHLY` / `YEARLY`, que não existem na API.

### Solução
Trocar `frequency` para `ONE_TIME` no body da requisição. A AbacatePay v1 não tem cobrança recorrente automática — cada billing é um pagamento único. Para simular assinatura, o app precisaria criar uma nova cobrança a cada período (isso pode ser feito depois com um cron/webhook).

### Mudança

**Arquivo**: `supabase/functions/abacatepay-checkout/index.ts` (linha 48)

```typescript
// DE:
frequency: billing === "monthly" ? "MONTHLY" : "YEARLY",

// PARA:
frequency: "ONE_TIME",
```

Depois redesplegar a edge function.

### Nota sobre assinaturas
Com `ONE_TIME`, o usuário paga uma vez. Para renovação automática futura, seria necessário criar um job periódico (cron edge function) que gera novas cobranças. Mas primeiro vamos fazer o checkout funcionar.

