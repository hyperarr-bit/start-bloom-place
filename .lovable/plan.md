

## Problema Crítico no Fluxo de Assinatura

### O que está errado

Os links fixos de pagamento (`bill_sLEKFXn23xDfmXm4w0YenBZM` e `bill_tQZey5eLr4JtaKgcMMASu6n1`) **não carregam o `user_id` do usuário**. Quando a AbacatePay envia o webhook após o pagamento, o campo `metadata.user_id` vem **vazio** — e o webhook não consegue associar o pagamento ao usuário correto no banco.

Resultado atual: o webhook salva com `user_id = 00000000-0000-0000-0000-000000000000` (placeholder), e o `check-subscription` nunca encontra assinatura ativa para o usuário real.

### Solução: Associar por e-mail

Como o webhook recebe o e-mail do cliente (`body.data.customer.email`), podemos buscar o usuário no Supabase pelo e-mail usando `auth.admin.listUsers` com o service role.

### Alterações

**1. `supabase/functions/abacatepay-webhook/index.ts`**
- Quando `metadata.user_id` estiver vazio, buscar o usuário pelo e-mail do customer usando `supabaseClient.auth.admin.listUsers()`
- Se encontrar, usar o `id` desse usuário para criar/atualizar a subscription
- Se não encontrar, manter o log de erro (não salvar com placeholder)

**2. Recorrência no cartão**
A recorrência é controlada pelo produto no dashboard da AbacatePay (ciclo mensal/anual). Quando o cartão for cobrado novamente, a AbacatePay envia outro webhook `billing.paid` — o mesmo fluxo se aplica. O webhook precisa funcionar corretamente para renovar a `current_period_end`.

**3. `supabase/functions/abacatepay-checkout/index.ts`**
- Sem alteração — os links fixos continuam funcionando

### Fluxo corrigido

```text
Usuário clica "Assinar" → Edge Function retorna link fixo
→ Usuário paga na AbacatePay
→ AbacatePay envia webhook com email do cliente
→ Webhook busca user por email no Supabase Auth
→ Cria/atualiza subscription com user_id correto
→ check-subscription retorna subscribed: true
→ App desbloqueado
```

### Pré-requisito
Confirmar que a URL do webhook está configurada no dashboard da AbacatePay apontando para:
`https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/abacatepay-webhook`

