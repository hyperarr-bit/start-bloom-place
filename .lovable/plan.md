

## Corrigir erro de `frequency` no checkout AbacatePay

O erro nos logs é claro:
```
Property 'frequency' should be one of: 'string', 'string'
```

O código atual envia `frequency: "SUBSCRIPTION"`, mas a API AbacatePay espera `"MONTHLY"` ou `"YEARLY"`.

### Mudança

**Arquivo**: `supabase/functions/abacatepay-checkout/index.ts`

- Trocar `frequency: "SUBSCRIPTION"` por `frequency: billing === "monthly" ? "MONTHLY" : "YEARLY"`
- Redesplegar a edge function

### Detalhe técnico

Linha ~47 do arquivo atual:
```typescript
// DE:
frequency: "SUBSCRIPTION",

// PARA:
frequency: billing === "monthly" ? "MONTHLY" : "YEARLY",
```

