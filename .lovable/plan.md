

# Ativar PIX no checkout da AbacatePay

## O que fazer
A linha 271 do `abacatepay-checkout/index.ts` define `methods: ["CARD"]`. Basta adicionar `"PIX"` ao array.

## Alteração

**Arquivo**: `supabase/functions/abacatepay-checkout/index.ts` (linha 271)

Trocar:
```typescript
methods: ["CARD"],
```
Por:
```typescript
methods: ["PIX", "CARD"],
```

Depois, fazer deploy da edge function.

## Observação
Com assinaturas recorrentes, o PIX funciona apenas para o primeiro pagamento. As cobranças seguintes dependem de cartão cadastrado. Se a AbacatePay não suportar PIX recorrente, o checkout mostrará PIX apenas como opção inicial e pedirá cartão para as renovações. Se der erro, basta remover `"PIX"` do array.

