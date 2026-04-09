

# Plano: Ativar premium via tabela local do Supabase

## Problema
A edge function `check-subscription` só verifica o Stripe. Como não há assinatura ativa no Stripe para `cus_UIgvO0Jm16y3i8`, retorna `trial_expired: true`.

## Solução em 2 passos

### 1. Alterar `supabase/functions/check-subscription/index.ts`
Adicionar fallback: se não encontrar assinatura ativa no Stripe, verificar a tabela `subscriptions` no Supabase. Se houver registro com `status = 'active'` para o `user_id`, retornar `subscribed: true`.

Trecho a adicionar (após a verificação do Stripe, antes do return final):
```typescript
// Fallback: check local subscriptions table
if (!hasActiveSub) {
  const { data: localSub } = await supabaseClient
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (localSub) {
    return new Response(JSON.stringify({
      subscribed: true,
      trial_expired: false,
      subscription_end: localSub.current_period_end,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
}
```

### 2. Inserir registro na tabela `subscriptions`
Usando a ferramenta de insert do Supabase:
```sql
INSERT INTO subscriptions (user_id, status, plan, billing_period, current_period_start, current_period_end)
VALUES (
  '2c896992-6849-4ca6-9a66-5c2414bb9424',
  'active',
  'premium',
  'lifetime',
  now(),
  '2099-12-31'
);
```

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/check-subscription/index.ts` | Adicionar fallback para tabela local |
| Tabela `subscriptions` | Inserir registro premium para o usuário |

