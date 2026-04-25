## Objetivo

Permitir um único checkout com **Cartão recorrente + Pix** usando o endpoint `/v2/subscriptions/create` da AbacatePay, criando os 2 produtos (Mensal/Anual) automaticamente via uma edge function utilitária.

## Etapas

### 1. Migration: tabela `app_config` já existe — usar para guardar os IDs dos produtos
Vamos salvar 2 chaves:
- `abacatepay_product_monthly_id`
- `abacatepay_product_annual_id`

Nenhuma migration nova de schema é necessária.

### 2. Nova edge function `abacatepay-setup-products` (rodar 1 vez)
Função que:
- Lê `ABACATEPAY_API_KEY` dos secrets
- Cria 2 produtos via `POST /v2/products/create`:
  - **CORE Pro Mensal** — R$ 19,90 — frequência mensal
  - **CORE Pro Anual** — R$ 178,80 — frequência anual
- Salva os IDs retornados em `app_config` (via service role)
- Retorna os IDs para confirmação
- Idempotente: se já existir ID em `app_config`, retorna o existente em vez de duplicar

Você chama 1 vez (ex: pelo botão de teste ou via curl) e pronto.

### 3. Refatorar `abacatepay-checkout`
Mudanças:
- Trocar endpoint `/checkouts/create` → `/subscriptions/create`
- Ler os IDs dos produtos de `app_config` (em vez de criar items inline)
- Payload novo:
  ```json
  {
    "frequency": "MONTHLY" | "ANNUAL",
    "methods": ["PIX", "CARD"],
    "products": [{ "productId": "<id>", "quantity": 1 }],
    "returnUrl": "...",
    "completionUrl": "...",
    "customer": {...},
    "metadata": { "user_id": "...", "billing_period": "..." }
  }
  ```
- Se `app_config` não tiver os IDs, retorna erro claro pedindo pra rodar `abacatepay-setup-products`

### 4. Atualizar `abacatepay-webhook`
Adicionar tratamento dos eventos de assinatura:
- `subscription.created` / `subscription.charged` → marcar `subscriptions.status = 'active'`, atualizar `current_period_end`, salvar `abacatepay_subscription_id`
- `subscription.canceled` / `subscription.payment_failed` → marcar `status = 'canceled'` ou `past_due`
- Manter compat com eventos antigos de billing avulso (caso já tenha algum em produção)

### 5. UI (`Planos.tsx`)
Mínima mudança: o texto "Você escolhe Pix ou Cartão na próxima tela" continua válido. Adicionar nota: "Cartão = renovação automática. Pix = você renova manualmente quando quiser." (Pix em assinatura na Abacate ainda exige ação do usuário no vencimento.)

## Detalhes técnicos

- **Endpoint produtos**: `POST https://api.abacatepay.com/v2/products/create` com `{ name, description, price (centavos), externalId, returnUrl?, ... }` — confirmo a forma exata ao implementar consultando a doc, ajusto se diferente
- **Idempotência**: usamos `externalId` `core-pro-monthly` / `core-pro-annual` para evitar duplicação no lado da Abacate também
- **Storage dos IDs**: `app_config` (RLS service-role only) — frontend nunca lê
- **Auth**: setup-products fica protegido — só roda se vier com header de service role OU se ainda não houver IDs salvos (auto-bootstrap seguro)

## Arquivos afetados

- `supabase/functions/abacatepay-setup-products/index.ts` (novo)
- `supabase/functions/abacatepay-checkout/index.ts` (refator)
- `supabase/functions/abacatepay-webhook/index.ts` (estender)
- `src/pages/Planos.tsx` (texto)

## Após aprovar

Eu implemento, deployo, e te passo o comando `curl` (ou uso o `curl_edge_functions`) pra rodar o `abacatepay-setup-products` 1 vez. Depois disso o checkout unificado já funciona.