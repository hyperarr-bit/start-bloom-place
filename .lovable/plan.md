# Renovação automática + grace period de 7 dias

## Como funciona hoje (resumo)

- **Cartão:** AbacatePay cobra automaticamente todo mês/ano. Webhook `subscription.renewed` → `current_period_end` é estendido.
- **PIX recorrente:** AbacatePay gera nova cobrança e notifica o cliente. Mesmo evento de renovação.
- **Falha de pagamento:** AbacatePay dispara `subscription.payment_failed` → hoje marcamos como `past_due` no banco, mas **o frontend não distingue** — o usuário simplesmente perde acesso quando `current_period_end` vence.

## O que muda

### 1. Grace period de 7 dias na `check-subscription`

Quando o `current_period_end` passa, em vez de cortar imediatamente:
- Se faz **≤ 7 dias** desde o vencimento → retorna `subscribed: true` + `in_grace_period: true` + `grace_days_left: N` + `payment_method`.
- Se faz **> 7 dias** → retorna `subscribed: false` (acesso cortado).

Também aceita `status = 'past_due'` como ativo dentro do grace period.

### 2. Banner global de aviso

Componente `GracePeriodBanner` montado no layout principal:
- Aparece quando `in_grace_period === true`.
- Texto: "Não conseguimos processar sua cobrança. Você tem **N dias** para atualizar seu pagamento ou perderá o acesso ao CORE."
- Botão "Atualizar pagamento" → leva pra `/planos` e abre novo checkout.
- Cor: âmbar (warning), não bloqueia uso.

### 3. Edge function `subscription-grace-cleanup` (cron diário)

Roda 1x por dia às 03:00 BRT:
- Busca subscriptions com `status IN ('active','past_due')` e `current_period_end < now() - interval '7 days'`.
- Marca como `canceled`.
- Registra evento analítico `subscription_expired_no_payment`.

Cron via `pg_cron` + `pg_net` (não em migration — usa insert tool com a anon key real).

### 4. Webhook: melhor handling

- `subscription.payment_failed` / `subscription.overdue` → marca `past_due` **mas mantém `current_period_end`** (já faz, só confirmar).
- Adicionar `checkout.refunded` / `subscription.cancelled` → cancela imediato.
- Quando renovação chega depois de `past_due`, volta pra `active`.

### 5. Frontend (`use-auth.tsx`)

Expor 3 novos campos no contexto: `inGracePeriod`, `graceDaysLeft`, `paymentMethod`. Layout principal lê e renderiza o banner.

## Detalhes técnicos

**Arquivos modificados:**
- `supabase/functions/check-subscription/index.ts` — lógica de grace.
- `supabase/functions/abacatepay-webhook/index.ts` — confirmar transições past_due → active na renovação.
- `src/hooks/use-auth.tsx` — novos campos no contexto.
- `src/components/GracePeriodBanner.tsx` — novo.
- `src/App.tsx` (ou layout raiz) — montar o banner.

**Arquivos novos:**
- `supabase/functions/subscription-grace-cleanup/index.ts` — cron job.
- Cron job via insert SQL (não migration).

**Constante compartilhada:** `GRACE_PERIOD_DAYS = 7` no edge function e no banner.

## Limites

- Não há como forçar o AbacatePay a tentar cobrar de novo (a plataforma já faz retentativas próprias antes de mandar `payment_failed`).
- O usuário precisa **fazer um novo checkout** para atualizar cartão (AbacatePay v2 não expõe portal de gerenciamento como Stripe). O botão do banner leva pra isso.
