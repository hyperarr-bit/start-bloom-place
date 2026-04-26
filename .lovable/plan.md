# Forçar preço promocional no checkout WINBACK80

## Problema
O checkout do AbacatePay está mostrando R$ 178,80 (preço cheio anual) mesmo com o cupom WINBACK80 ativo. O override `price` no item está sendo ignorado porque enviamos junto o `id` do produto cadastrado — nesse caso o AbacatePay usa o preço salvo do produto e descarta o `price` enviado.

## Correção

**`supabase/functions/abacatepay-checkout/index.ts`** (linhas 155-164):

Quando o cupom WINBACK80 for válido, enviar o item como **produto avulso** (sem `id`, com `name` + `description` + `price`) em vez de referenciar o produto cadastrado. Sem `id`, o AbacatePay usa exatamente o preço enviado (R$ 47,76 anual / R$ 3,98 mensal).

Sem cupom, mantém o comportamento atual (referencia o produto pelo `id` com preço cheio).

```typescript
const lineItem = discountedUnitPrice !== null
  ? {
      name: "CORE Pro Anual (Oferta 80% OFF)",
      description: "Oferta exclusiva WINBACK80 - 80% de desconto",
      quantity: 1,
      price: discountedUnitPrice,
    }
  : { id: productId, quantity: 1 };
```

Resultado: o checkout abrirá com R$ 47,76 (anual) e o nome do item indicará a oferta aplicada.
