

## Plano: Migrar checkout para AbacatePay v2 (endpoints corretos)

### Problema
O código está chamando endpoints que **não existem** na v2 (`/v2/products/create`, `/v2/subscriptions/create`). A documentação que você trouxe confirma os endpoints reais da v2:

- `POST /v2/checkouts/create` (antigo `/v1/billing/create`)
- `POST /v2/customers/create` (antigo `/v1/customer/create`)

Não existe sistema de "products" ou "subscriptions" na API. O modelo é simples: cria checkout → usuário paga → webhook notifica.

### O que muda

**1. Edge function `abacatepay-checkout`**
- Remover toda a lógica de `getOrCreateProduct` (não existe esse endpoint)
- Atualizar customer endpoint de `/v1/customer/create` → `/v2/customers/create`
- Substituir a chamada de `/v2/subscriptions/create` por `/v2/checkouts/create`
- O body do checkout segue o formato v2: `products` array com nome/preço, `customer` com dados, `returnUrl`, `completionUrl`, `metadata` com `user_id` e `billing_period`
- Frequência continua `ONE_TIME` por checkout (cada período é um pagamento manual via PIX)

**2. Edge function `abacatepay-webhook`**
- Atualizar para tratar o evento `checkout.completed` (v2) além do `billing.paid` (v1)
- Validar usando header `X-Webhook-Signature` em vez de `x-webhook-secret`
- Manter a lógica de upsert na tabela `subscriptions` com `current_period_end` calculado pelo billing_period

**3. Sem mudanças no frontend**
- `Planos.tsx` continua chamando `supabase.functions.invoke("abacatepay-checkout")` com os mesmos parâmetros
- Nenhuma mudança no banco de dados

### Fluxo final
1. Usuário clica "Assinar" → edge function cria customer via `/v2/customers/create` → cria checkout via `/v2/checkouts/create` → retorna URL de pagamento PIX
2. Usuário paga via PIX
3. AbacatePay envia webhook `checkout.completed` → edge function ativa assinatura por 1 mês ou 1 ano
4. Quando vencer, usuário paga novamente (não há cobrança automática via PIX)

### Arquivos modificados
- `supabase/functions/abacatepay-checkout/index.ts` — simplificar para v2 checkouts
- `supabase/functions/abacatepay-webhook/index.ts` — tratar `checkout.completed` + `X-Webhook-Signature`
- Deploy das duas functions

