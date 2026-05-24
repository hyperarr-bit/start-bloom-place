## Novos preços

- **Mensal**: R$ 14,90/mês (1490 centavos)
- **Anual**: R$ 46,80/ano = R$ 3,90/mês (4680 centavos)
- **Roleta (winback, só anual)**: R$ 34,80/ano = R$ 2,90/mês (3480 centavos)

## Mudanças no frontend

**`src/pages/Planos.tsx`**
- `plans.monthly.price`: `"19,90"` → `"14,90"`
- `plans.annual.price`: `"14,90"` → `"3,90"`
- `plans.annual.savings`: `"Economia de R$ 60/ano"` → `"Economia de R$ 132/ano"`
- Badge `-25%` no toggle anual → `-74%` (desconto real: 1 − 3,90/14,90)

**`src/components/retention/WinbackOffer.tsx`**
- `FULL_MONTHLY`: `19.90` → `14.90`
- `FULL_ANNUAL`: `238.80` → `178.80` (14,90 × 12)
- `OFFER_ANNUAL`: `47.76` → `34.80`
- `OFFER_MONTHLY_EQUIV`: `3.98` → `2.90`
- `SAVINGS`: `191.04` → `144.00` (178,80 − 34,80)
- Cálculo do % off: `1 − 34,80/178,80` ≈ **81%**. Mantenho o label "80% OFF" / "-80%" / badge "VOCÊ GANHOU 80% OFF" como está hoje (arredondamento estético; o usuário pediu "só troca as infos pra combinar com os novos preços", e 80% continua representando o desconto).
- Texto "Renovação anual no preço cheio (R$ 238,80/ano)" → usa o novo `FULL_ANNUAL` automaticamente.

**`src/components/retention/WinbackWheel.tsx`**
- Nenhuma alteração: as fatias mostram percentuais (10/20/30/50/80% OFF) e o vencedor continua sendo "80% OFF" — combina com os novos preços (~81% real).

**`src/pages/admin/AdminChurn.tsx`** (linha 105)
- `sub="estimativa @ R$19,90"` → `"estimativa @ R$14,90"`

## Mudanças no backend (AbacatePay)

Os produtos no AbacatePay têm preço fixo por produto. Para trocar preço sem corromper assinaturas existentes, criamos **novos produtos** com `externalId` versionado e novas chaves em `app_config` — a próxima execução de `abacatepay-setup-products` cria os produtos novos no AbacatePay e grava os IDs.

**`supabase/functions/abacatepay-setup-products/index.ts`**
- Mensal: `externalId` `core-pro-monthly` → `core-pro-monthly-v2`; `configKey` `abacatepay_product_monthly_id` → `abacatepay_product_monthly_v2_id`; `price` `1990` → `1490`; `name`/`description` ajustados pra R$ 14,90.
- Anual: `externalId` `core-pro-annual` → `core-pro-annual-v2`; `configKey` → `abacatepay_product_annual_v2_id`; `price` `17880` → `4680`.
- Winback: `externalId` `core-pro-annual-winback80` → `core-pro-annual-winback80-v2`; `configKey` → `abacatepay_product_annual_winback80_v2_id`; `price` `4776` → `3480`; descrição ajustada para "R$ 2,90/mês equivalente".

**`supabase/functions/abacatepay-checkout/index.ts`**
- `PRODUCT_CONFIG.monthly.configKey` → `abacatepay_product_monthly_v2_id`; `basePriceCents` `1990` → `1490`.
- `PRODUCT_CONFIG.annual.configKey` → `abacatepay_product_annual_v2_id`; `basePriceCents` `17880` → `4680`.
- `PROMO_PRODUCT.configKey` → `abacatepay_product_annual_winback80_v2_id`; `externalId` → `core-pro-annual-winback80-v2`; `price` `4776` → `3480`; `name`/`description` ajustados.

## Passo manual após o deploy

Você (ou um admin) precisa **chamar a função `abacatepay-setup-products` uma vez** (rota admin já existente em `src/pages/admin/AdminActivation.tsx` ou via dashboard) pra criar os 3 novos produtos no AbacatePay e popular as novas chaves em `app_config`. Sem esse passo, o checkout retorna o erro "Product '…_v2_id' not configured".

Assinantes ativos continuam nos produtos antigos (não afetados). Novos checkouts usam os preços novos.

## O que NÃO muda

- Lógica da roleta, animação, fatias, layout, fluxos de cancelamento, webhook de ativação, telas de sucesso/falha — tudo intacto.
- Cupom continua chamando `WINBACK80` (só o produto promocional por trás muda de preço).
