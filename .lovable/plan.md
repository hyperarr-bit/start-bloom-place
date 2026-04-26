## Problema

A AbacatePay está ignorando o `price` override e cobrando R$ 178/ano (preço cheio do produto registrado). A solução é **criar um produto separado já com o preço promocional** e referenciá-lo no checkout quando o cupom WINBACK80 for válido.

## Solução

### 1. Criar produto promo no AbacatePay

Adicionar um terceiro produto no `abacatepay-setup-products`:

- **Nome**: "CORE Pro Anual — Oferta Winback 80% OFF"
- **External ID**: `core-pro-annual-winback80`
- **Preço**: 4776 centavos (R$ 47,76)
- **Config key**: `abacatepay_product_annual_winback80_id`

Salvo em `app_config` igual aos outros.

### 2. Atualizar checkout para usar o produto promo

Em `supabase/functions/abacatepay-checkout/index.ts`:

- Quando `couponValid === true` (WINBACK80 + annual + nunca usado), buscar o `productId` do `abacatepay_product_annual_winback80_id` em vez do anual normal.
- Enviar `items: [{ id: <promoProductId>, quantity: 1 }]` — sem override de preço, sem campos ad-hoc. AbacatePay usa o preço cadastrado do produto promo (R$ 47,76).
- Manter `metadata.user_id`, `metadata.billing_period: "annual"` e `metadata.coupon: "WINBACK80"` para que o webhook ative a assinatura corretamente.

### 3. Garantir que a assinatura funciona após pagamento

O webhook `abacatepay-webhook` já está preparado:
- Lê `metadata.user_id` → vincula ao usuário certo.
- Lê `metadata.billing_period: "annual"` → calcula `current_period_end` = +1 ano.
- Salva `plan: "core-pro"` e `status: "active"` em `subscriptions`.
- Marca `winback_attempts.converted_at` quando vê `metadata.coupon === "WINBACK80"`.

Nenhuma mudança necessária no webhook — funciona independente de qual produto foi comprado, porque o que importa é o metadata.

### 4. Auto-provisionar o produto promo

Para evitar passo manual: dentro do próprio `abacatepay-checkout`, se a config `abacatepay_product_annual_winback80_id` ainda não existir e o cupom for válido, criar o produto on-the-fly via `/products/create` e salvar em `app_config`. Da próxima vez ele já estará pronto.

Isso elimina a necessidade de rodar `abacatepay-setup-products` de novo manualmente.

## Arquivos modificados

- `supabase/functions/abacatepay-checkout/index.ts` — usar produto promo quando cupom WINBACK80 ativo; auto-criar o produto na primeira execução.
- `supabase/functions/abacatepay-setup-products/index.ts` — adicionar o produto promo à lista (para quem rodar o setup novamente).

## Detalhes técnicos

```ts
// abacatepay-checkout/index.ts (trecho)
const PROMO_PRODUCT = {
  configKey: "abacatepay_product_annual_winback80_id",
  externalId: "core-pro-annual-winback80",
  name: "CORE Pro Anual — Oferta Winback 80% OFF",
  description: "Oferta exclusiva de retenção — 80% de desconto no primeiro ano",
  price: 4776, // R$ 47,76
};

async function getOrCreatePromoProductId(supabaseAdmin, apiKey) {
  const { data: row } = await supabaseAdmin
    .from("app_config").select("value").eq("key", PROMO_PRODUCT.configKey).maybeSingle();
  const existing = (row?.value as { id?: string } | null)?.id;
  if (existing) return existing;

  const resp = await abacateRequest("/products/create", apiKey, {
    name: PROMO_PRODUCT.name,
    description: PROMO_PRODUCT.description,
    price: PROMO_PRODUCT.price,
    currency: "BRL",
    externalId: PROMO_PRODUCT.externalId,
  });
  const newId = resp?.data?.id || resp?.id;
  await supabaseAdmin.from("app_config").upsert({
    key: PROMO_PRODUCT.configKey,
    value: { id: newId, externalId: PROMO_PRODUCT.externalId, name: PROMO_PRODUCT.name },
  });
  return newId;
}

// dentro do handler, depois de validar o cupom:
const productIdToUse = couponValid
  ? await getOrCreatePromoProductId(supabaseAdmin, apiKey)
  : productId;

const lineItem = { id: productIdToUse, quantity: 1 };

// metadata permanece igual — webhook ativa assinatura normalmente
metadata: {
  user_id: userId,
  billing_period: "annual",
  ...(couponValid ? { coupon: "WINBACK80", discount_pct: 80 } : {}),
}
```

O webhook não precisa de alteração: ele lê `metadata.billing_period` e `metadata.user_id`, ativa a assinatura como `core-pro` anual, e o `markWinbackConverted` continua marcando o attempt como convertido pelo `metadata.coupon`.
