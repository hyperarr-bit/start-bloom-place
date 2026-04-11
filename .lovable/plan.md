

## Correção completa: Migrar para assinatura recorrente AbacatePay v2

### Contexto
Hoje o checkout usa `POST /v1/billing/create` com `frequency: "ONE_TIME"` — o usuário paga uma vez e não renova automaticamente. A AbacatePay v2 tem um fluxo próprio de assinatura recorrente.

### O que muda

**1. Criar produtos recorrentes na AbacatePay (via edge function)**

A API v2 exige que produtos de assinatura sejam criados previamente com o campo `cycle`. O checkout de assinatura referencia o produto pelo `id`.

Vou adicionar lógica na edge function de checkout para criar os produtos na AbacatePay (se ainda não existirem) usando `POST /v2/products/create`:
- Produto mensal: `cycle: "MONTHLY"`, preço R$ 19,90
- Produto anual: `cycle: "ANNUALLY"`, preço R$ 178,80

Os IDs dos produtos serão armazenados em cache (tabela `app_config` ou variável de ambiente). Se já existirem, reutiliza.

**2. Refatorar `abacatepay-checkout` para v2 subscriptions**

Trocar de:
```
POST /v1/billing/create  (frequency: ONE_TIME)
```
Para:
```
POST /v2/subscriptions/create
```

Com o body:
```json
{
  "items": [{ "id": "prod_xxx", "quantity": 1 }],
  "returnUrl": "...",
  "completionUrl": "...",
  "customerId": "cust_xxx",
  "metadata": { "user_id": "...", "billing_period": "monthly" }
}
```

O customer continua sendo criado via `/v1/customer/create` (funciona igual).

**3. Refatorar `abacatepay-webhook` para eventos de assinatura**

Os eventos mudam de `billing.paid` / `billing.disputed` para:
- `subscription.completed` — primeira cobrança paga, ativar assinatura
- `subscription.renewed` — renovação automática, estender período
- `subscription.cancelled` — assinatura cancelada

O webhook vai extrair o `metadata` do payload e atualizar a tabela `subscriptions` conforme o evento.

**4. Criar tabela `app_config` para armazenar IDs dos produtos**

Uma tabela simples key-value para guardar os IDs dos produtos criados na AbacatePay, evitando criar duplicados a cada checkout.

```sql
CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
-- RLS: somente service_role pode ler/escrever
```

**5. Frontend — sem mudanças visuais**

A tela de Planos (`Planos.tsx`) já coleta os dados necessários e chama a edge function. Nenhuma mudança visual é necessária — apenas a edge function por trás muda.

### Arquivos modificados
- `supabase/functions/abacatepay-checkout/index.ts` — migrar para v2 subscriptions
- `supabase/functions/abacatepay-webhook/index.ts` — tratar eventos de assinatura
- Nova migration SQL — criar tabela `app_config`

### Arquivos que não mudam
- `src/pages/Planos.tsx` — já está correto
- `src/hooks/use-auth.tsx` — já chama `check-subscription` que lê da tabela `subscriptions`
- `supabase/functions/check-subscription/index.ts` — já consulta `subscriptions` corretamente

### Resultado esperado
- Usuário paga via PIX e a assinatura é ativada automaticamente
- A cada ciclo (mensal ou anual), a AbacatePay cobra automaticamente e envia webhook de renovação
- Se o usuário cancelar, o webhook atualiza o status para cancelado
- O app reflete o status em tempo real via `check-subscription`

