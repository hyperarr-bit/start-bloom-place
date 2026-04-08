

# Plano: Integração completa com Stripe

## Produtos criados no Stripe

| Plano | Produto | Preço | Price ID |
|-------|---------|-------|----------|
| Mensal | `prod_UIfkhw9OQMoenu` | R$ 19,90/mês | `price_1TK4P7QdjmrIbUhHqpHuNcut` |
| Anual | `prod_UIfkjiyVcm4eTP` | R$ 178,80/ano (R$ 14,90/mês) | `price_1TK4POQdjmrIbUhH518MJrO4` |

## Mudanças

### 1. Edge Function `create-checkout`
- Recebe `{ billing: "monthly" | "annual" }` do frontend
- Autentica o usuário via token JWT
- Verifica se já existe customer no Stripe pelo email
- Cria sessão de checkout com `mode: "subscription"` e o price_id correto
- Retorna URL do Stripe Checkout

### 2. Edge Function `check-subscription`
- Autentica o usuário
- Busca customer no Stripe pelo email
- Verifica se tem subscription ativa
- Retorna `{ subscribed: boolean, subscription_end: string | null }`

### 3. Edge Function `customer-portal`
- Autentica o usuário
- Cria sessão do Stripe Customer Portal (cancelar, trocar plano, etc.)
- Retorna URL do portal

### 4. Atualizar `src/pages/Planos.tsx`
- Preços: mensal R$ 19,90, anual R$ 14,90/mês (desconto ~25%)
- Botão "Assinar" chama `create-checkout` via `supabase.functions.invoke`
- Redireciona para o Stripe Checkout
- Estado de loading no botão

### 5. Atualizar `src/hooks/use-auth.tsx`
- Trocar `checkSubscriptionStatus` para chamar a edge function `check-subscription` (consulta Stripe direto) em vez de consultar tabela `subscriptions`
- Chamar no login, page load, e a cada 60s
- Manter `trialExpired` e `isSubscribed` no contexto

## Arquivos criados/alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/create-checkout/index.ts` | Criar |
| `supabase/functions/check-subscription/index.ts` | Criar |
| `supabase/functions/customer-portal/index.ts` | Criar |
| `src/pages/Planos.tsx` | Atualizar preços + integrar checkout |
| `src/hooks/use-auth.tsx` | Verificar assinatura via Stripe |

