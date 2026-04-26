## 3 entregas: Auto-aplicação de descontos, Painel de Retention e Tracking de Trial

### 1. Auto-aplicar descontos pendentes no AbacatePay

#### 1a. Migration — controle de aplicação
Adicionar à `retention_offers_used`:
- `status TEXT` (`active` | `applied` | `failed` | `expired` | `consumed`)
- `applied_at TIMESTAMPTZ`
- `apply_attempts INT DEFAULT 0`
- `last_apply_error TEXT`

Mais índice parcial em `(user_id, offer_type, status) WHERE status='active'` e RPC `pending_discount_for_user(uuid)`.

#### 1b. Edge function `apply-pending-discounts`
Lógica:
1. Busca ofertas `offer_type='discount' AND status='active' AND apply_attempts<5`
2. Para cada oferta, pega `abacatepay_subscription_id` da `subscriptions` ativa do user
3. Chama AbacatePay (com fallback): `POST /v2/subscriptions/{id}/discount` → se falhar, tenta `POST /v2/billings/{billingId}/discount`
4. Sucesso → marca `status='applied'` + emite evento `retention_discount_applied`
5. Falha → incrementa `apply_attempts`, salva `last_apply_error`; após 5 tentativas vira `status='failed'`

> Como a documentação pública do AbacatePay não confirma o nome exato dos endpoints de desconto, a function tenta dois caminhos comuns e loga a resposta. **Você pode precisar me passar a doc/endpoint correto do AbacatePay** (suporte deles) — aí ajusto numa segunda iteração.

#### 1c. Hook no `abacatepay-webhook`
Quando o evento for `subscription.charged` / `subscription.renewed` / `billing.created`, **antes de gravar** a próxima cobrança, dispara `apply-pending-discounts` com `{ userId, billingId }` (fire-and-forget, não bloqueia a resposta do webhook).

#### 1d. Cron de segurança
Job diário (3h da manhã) que chama `apply-pending-discounts` sem args para varrer ofertas que escaparam (caso webhook tenha falhado).

```sql
select cron.schedule(
  'sweep-pending-discounts',
  '0 3 * * *',
  $$ select net.http_post(
    url:='https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/apply-pending-discounts',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);
```

---

### 2. Painel admin `/admin/retention`

#### Componentes
- **`src/pages/admin/AdminRetention.tsx`**: chama `admin_retention_stats()` e `admin_retention_offers_breakdown()` (RPC nova, ver abaixo)
- 4 cards no topo: Total tentativas (30d), Save rate %, Salvos por desconto, Salvos por pausa
- Gráfico de pizza: motivos de cancelamento (recharts, já no projeto)
- Tabela: funil opened → reason_given → offer_shown → saved/churned
- Tabela: ofertas — desconto vs pausa, quantos aceitaram, status (active/applied/failed)

#### RPC adicional `admin_retention_offers_breakdown()`
Retorna por `offer_type` e `status`: `count`, `apply_success_rate`. Necessária pra mostrar quantos descontos foram **efetivamente aplicados** no AbacatePay (vs só aceitos pelo user).

#### Nav update
Adicionar `{ to: "/admin/retention", label: "Retention", Icon: ShieldCheck }` em `AdminLayout.tsx`.

---

### 3. Tracking de trial — eventos faltantes

| Evento | Onde dispara | Payload |
|---|---|---|
| `trial_started` | Trigger DB no `auth.users` insert (hoje só seeda emails) | `{ source }` |
| `trial_day_X_active` | Cron diário que varre `auth.users` criados há 1-7 dias **com sessão na última 24h** | `{ trial_day }` |
| `trial_converted` | `abacatepay-webhook` quando `status` muda pra `active` (renomeio o atual `subscription_started` → `trial_converted` e mantenho ambos por 30 dias pra compat) | `{ plan, billing_period, trial_day, days_to_convert }` |
| `trial_canceled_reason` | `cancel-subscription-flow` → action `confirm_cancel` (já temos `cancel_confirmed`, adiciono este com `{ reason }` p/ análise por motivo) | `{ reason, trial_day, was_paying }` |

#### 3a. Trigger SQL
Estender `handle_new_user()` para também inserir um row em `analytics_events`:
```sql
INSERT INTO public.analytics_events (user_id, event_name, event_data, trial_day)
VALUES (NEW.id, 'trial_started', jsonb_build_object('source','signup'), 0);
```

#### 3b. Edge function `tick-trial-active-days`
Roda 1x/dia (cron). Para cada user em `auth.users` com `created_at` entre 1-7 dias atrás:
- Se teve `module_analytics` nas últimas 24h → emite `trial_day_X_active` (X = dia do trial)
- Idempotente: checa se já existe esse evento hoje pra esse user

#### 3c. Update `abacatepay-webhook`
No `emitConversionEvent`, **acrescenta** evento `trial_converted` com `days_to_convert` calculado de `auth.users.created_at`. Mantém o `subscription_started` por compat.

#### 3d. Update `cancel-subscription-flow`
No handler `confirm_cancel`, além do `cancel_confirmed`, emite `trial_canceled_reason` com `{ reason: attempt.reason, trial_day, was_paying: subStatus === 'active' }`.

---

### Arquivos
**Novos:**
- `supabase/functions/apply-pending-discounts/index.ts`
- `supabase/functions/tick-trial-active-days/index.ts`
- `src/pages/admin/AdminRetention.tsx`
- 2 migrations (campos da `retention_offers_used` + RPC breakdown; trigger trial_started; cron jobs via insert tool por terem URL/anon)

**Editados:**
- `supabase/functions/abacatepay-webhook/index.ts` (chamar apply-discounts + emitir `trial_converted`)
- `supabase/functions/cancel-subscription-flow/index.ts` (emitir `trial_canceled_reason`)
- `src/pages/admin/AdminLayout.tsx` (nav item)
- `src/App.tsx` (rota `/admin/retention`)

---

### Pergunta antes de implementar
**A doc do AbacatePay** que você tem (ou suporte deles) confirma quais são os endpoints corretos de desconto/cupom? Vou implementar com os caminhos `/subscriptions/{id}/discount` e `/billings/{id}/discount` por padrão e logar qualquer 404 — mas se você já souber o caminho oficial, me passa pra eu acertar de primeira (evita rodar com falha logada).