## Plano: Migrar checkout para AbacatePay v1 e verificar se tá acontecendo o pagamento recorrente e não pedir os dados do cliente no saas e sim só no checkout além de fazer o redirecionamento ser rápido 

O código está chamando endpoints `/v2/...` com uma chave v1, causando o erro "API key version mismatch". Solução: reverter tudo para a API v1.

### Mudanças no `abacatepay-checkout/index.ts`

1. **Customer**: trocar `/v2/customers/create` → `/v1/customer/create`
2. **Billing**: trocar `/v2/checkouts/create` → `/v1/billing/create` com o formato v1:
  ```json
   {
     "frequency": "MULTIPLE_PAYMENTS",
     "methods": ["PIX"],
     "products": [{ "externalId": "core-pro-monthly", "name": "CORE Pro Mensal", "quantity": 1, "price": 1990 }],
     "returnUrl": "...",
     "completionUrl": "...",
     "customerId": "...",
     "metadata": { "user_id": "...", "billing_period": "monthly" }
   }
  ```
3. Extrair URL de retorno do formato v1 (`data.url`)

### Mudanças no `abacatepay-webhook/index.ts`

- Manter `billing.paid` como evento principal (v1)
- Manter validação via `x-webhook-secret` (v1)
- Remover referências a eventos v2 (`checkout.completed`, `subscription.completed`, `subscription.cancelled`)
- Lógica de upsert na tabela `subscriptions` permanece igual

### Arquivos modificados

- `supabase/functions/abacatepay-checkout/index.ts`
- `supabase/functions/abacatepay-webhook/index.ts`
- Deploy de ambas as functions