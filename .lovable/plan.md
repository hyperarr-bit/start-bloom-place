

## Substituir Stripe pela AbacatePay

A AbacatePay tem API v2 para assinaturas (`POST /v2/subscriptions/create`) que retorna uma URL de checkout hospedada. O fluxo é similar ao Stripe: criar sessão no backend, redirecionar o usuário.

**Pré-requisito**: Você precisa criar o produto no painel da AbacatePay (com ciclo MONTHLY e YEARLY) e anotar os IDs dos produtos (ex: `prod_xxx`). Também precisa da API Key.

---

### Passo 1 — Adicionar secret `ABACATEPAY_API_KEY`
Usar a ferramenta de secrets do Lovable para armazenar sua chave da AbacatePay como variável de ambiente nas Edge Functions.

### Passo 2 — Criar Edge Function `abacatepay-checkout`
Nova função que substitui `create-checkout`:
- Recebe `billing` (monthly/annual) do frontend
- Autentica o usuário via Supabase
- Chama `POST https://api.abacatepay.com/v2/subscriptions/create` com:
  - `items`: produto mensal ou anual (IDs que você criou no painel)
  - `methods`: `["PIX", "CARD"]`
  - `completionUrl`: URL de sucesso
  - `returnUrl`: URL de volta
  - `customer`: `{ name, email, cellphone, taxId }` — precisaremos do email do usuário
- Retorna a `url` do checkout para redirecionar

### Passo 3 — Criar Edge Function `abacatepay-webhook`
Recebe notificações da AbacatePay quando pagamento é confirmado (`billing.paid`):
- Valida o webhook via query param `webhookSecret`
- Encontra o usuário pelo email/customerId
- Atualiza a tabela `subscriptions` no banco com status `active`

### Passo 4 — Criar/Atualizar tabela `subscriptions`
Verificar se a tabela existente é compatível ou criar migration para garantir campos:
- `user_id`, `status`, `abacatepay_billing_id`, `current_period_end`, `plan` (monthly/annual)

### Passo 5 — Atualizar `check-subscription`
Remover toda a lógica do Stripe. A verificação passa a ser apenas consulta à tabela `subscriptions` local:
- Se tem registro `active` com `current_period_end` no futuro → `subscribed: true`
- Senão → verifica trial (24h desde criação do perfil)

### Passo 6 — Atualizar `src/pages/Planos.tsx`
- Trocar chamada de `create-checkout` para `abacatepay-checkout`
- Remover referência ao portal do Stripe (AbacatePay não tem portal — cancelamento será manual ou via contato)

### Passo 7 — Atualizar `AccountDrawer.tsx`
- Remover chamada ao `customer-portal` do Stripe
- Substituir por link para contato/email para gerenciar assinatura (ou manter botão que mostra info da assinatura)

### Passo 8 — Limpar funções Stripe
- Remover/desativar `create-checkout`, `customer-portal` (manter `check-subscription` refatorado)

---

### Informações que preciso de você antes de implementar

1. **IDs dos produtos** criados no painel AbacatePay (mensal e anual) — ou quer que eu use a API de billing/create que cria o produto inline?
2. **Sua API Key** — vou solicitar via ferramenta de secrets

### Arquivos afetados
- `supabase/functions/abacatepay-checkout/index.ts` (novo)
- `supabase/functions/abacatepay-webhook/index.ts` (novo)
- `supabase/functions/check-subscription/index.ts` (refatorar)
- `src/pages/Planos.tsx`
- `src/components/home/AccountDrawer.tsx`
- `src/hooks/use-auth.tsx` (sem mudanças, já chama check-subscription)
- Migration SQL para tabela `subscriptions`
- Remover `create-checkout` e `customer-portal`

