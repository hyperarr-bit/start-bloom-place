

# Plano: Integrar Stripe completo com checkout e webhook

## Resumo

Salvar a chave secreta do Stripe como secret no Supabase, adicionar a chave publicável no `.env`, criar uma edge function de checkout, criar uma edge function de webhook, e conectar o botão "Assinar" na página de Planos.

## Passos

### 1. Salvar chave secreta como Supabase Secret
- Adicionar `STRIPE_SECRET_KEY` com a chave `sk_live_...` como secret no Supabase (via ferramenta add_secret)

### 2. Adicionar chave publicável no `.env`
- Adicionar `VITE_STRIPE_PUBLISHABLE_KEY` no `.env` (chave pública, seguro no código)

### 3. Criar Edge Function `create-checkout` 
**Arquivo:** `supabase/functions/create-checkout/index.ts`
- Recebe `{ billing: "monthly" | "annual" }` + token do usuário autenticado
- Cria (ou reutiliza) um Stripe Customer com o email do usuário
- Cria uma Checkout Session com:
  - Mensal: R$ 19,90/mês (`price_data` com `recurring.interval: "month"`)
  - Anual: R$ 14,90/mês (`price_data` com `recurring.interval: "year"`, unit_amount: 17880)
- Retorna a `url` do checkout do Stripe
- Inclui CORS headers

### 4. Criar Edge Function `stripe-webhook`
**Arquivo:** `supabase/functions/stripe-webhook/index.ts`
- Recebe eventos do Stripe (sem JWT, verificação por assinatura do webhook)
- Adicionar `STRIPE_WEBHOOK_SECRET` como secret
- Eventos tratados:
  - `checkout.session.completed` → INSERT na tabela `subscriptions` com status "active"
  - `customer.subscription.updated` → UPDATE status
  - `customer.subscription.deleted` → UPDATE status para "canceled"
- Usa `stripe.webhooks.constructEvent()` para validar

### 5. Atualizar `Planos.tsx`
- Importar `supabase` e `useAuth`
- No clique do botão "Assinar":
  - Chamar `supabase.functions.invoke("create-checkout", { body: { billing } })`
  - Redirecionar para `data.url` (Stripe Checkout)
- Adicionar estado de loading no botão

### 6. Configurar webhook no Stripe Dashboard
- Instruir o usuário a criar um webhook no Stripe Dashboard apontando para:
  `https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copiar o signing secret e salvar como `STRIPE_WEBHOOK_SECRET`

## Arquivos criados/alterados

| Arquivo | Tipo |
|---------|------|
| `supabase/functions/create-checkout/index.ts` | Criar |
| `supabase/functions/stripe-webhook/index.ts` | Criar |
| `src/pages/Planos.tsx` | Alterar |
| `.env` | Alterar (adicionar VITE_STRIPE_PUBLISHABLE_KEY) |

## Nota importante
Após aprovar, vou precisar que você:
1. Crie um webhook no painel do Stripe (eu dou o link e instruções)
2. Me passe o **Webhook Signing Secret** para eu salvar como secret

