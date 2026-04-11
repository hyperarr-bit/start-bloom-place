

## Plano: Atualizar IDs dos produtos na Edge Function

### Alteração em `supabase/functions/abacatepay-checkout/index.ts`

Atualizar o objeto `PLANS` com os novos IDs e nomes em maiúsculo:

```typescript
const PLANS = {
  monthly: { externalId: "prod_QUxD3yUQYrmWzL4LXGArxm2w", name: "CORE PRO MENSAL", price: 1990 },
  annual: { externalId: "prod_aLJdEEysjhgXc3Raug1dD6N0", name: "CORE PRO ANUAL", price: 17880 },
};
```

### Resultado
- Checkout usa os novos produtos com recorrência automática configurada no dashboard
- Nomes aparecem em maiúsculo
- Nenhuma mudança no frontend

