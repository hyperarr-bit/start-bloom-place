# Corrigir erro 400 do checkout WINBACK80

## Problema
Logs do edge function mostram:
```
AbacatePay API error: 400 - "Could not find coupons WINBACK80"
```

O AbacatePay exige que cupons sejam pré-cadastrados no painel deles. Como o cupom `WINBACK80` não existe lá, a API rejeita a requisição inteira.

A boa notícia: o desconto já está sendo aplicado corretamente via `price` override no item (R$ 47,76 em vez de R$ 178,80). Não precisamos do cupom no AbacatePay — ele só serviria para exibição visual.

## Correção

**`supabase/functions/abacatepay-checkout/index.ts`**:
- Remover o bloco que envia `checkoutBody.coupons = [couponRaw]`
- Manter o override de preço (`lineItem.price = discountedUnitPrice`) que já garante o valor promocional
- Manter o registro em `retention_offers_used` e `winback_attempts` para rastreamento interno
- Manter `metadata.coupon` para histórico

Resultado: o checkout abrirá com o preço já descontado (R$ 47,76/ano) sem tentar validar um cupom inexistente no AbacatePay.

## Alternativa opcional (não incluída)
Se quiser que o código "WINBACK80" apareça visualmente no checkout, seria necessário criar o cupom manualmente no painel do AbacatePay. Isso pode ser feito depois — a correção atual já entrega o desconto correto ao cliente.
