## Excluir contas de teste das analíticas do admin

### Contas a ignorar
- `jv20101958@gmail.com`
- `hyperarr@gmail.com`
- `street.store.brasil@gmail.com`

### Abordagem

Criar uma função SQL helper `public.is_test_user(_user_id uuid)` que retorna `true` se o e-mail do usuário em `auth.users` estiver na lista de testes. Centralizar a lista num só lugar facilita adicionar/remover contas no futuro.

Em seguida, atualizar todas as funções `admin_*` que agregam métricas para filtrar usuários de teste com `WHERE NOT public.is_test_user(user_id)`.

### Funções a atualizar

1. **`admin_metrics_overview`** — total_users, active_24h/7d/30d, signups_30d, paid_active, trial_active, canceled_30d, conversion/churn rates, MRR.
2. **`admin_list_users`** — esconder as 3 contas da listagem.
3. **`admin_module_funnel`** — funil de uso por módulo.
4. **`admin_at_risk_users`** — usuários em risco de churn.
5. **`admin_conversion_by_trial_day`** — conversões por dia do trial.
6. **`admin_activation_funnel`** — funil de ativação.
7. **`admin_nudge_stats`** — estatísticas de nudges.
8. **`admin_email_variant_stats`** — variantes de e-mail.
9. **`admin_retention_stats`** — cancel attempts, save rate.
10. **`admin_retention_offers_breakdown`** — ofertas de retenção.
11. **`admin_winback_stats`** — winback (triggered, converted, etc).

Em todas, o filtro é o mesmo: `AND NOT public.is_test_user(<coluna user_id da tabela base>)`.

### Detalhes técnicos

```sql
-- Helper centralizada
CREATE OR REPLACE FUNCTION public.is_test_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) IN (
        'jv20101958@gmail.com',
        'hyperarr@gmail.com',
        'street.store.brasil@gmail.com'
      )
  );
$$;
```

A migração faz `CREATE OR REPLACE FUNCTION` em cada função admin, mantendo assinatura idêntica (mesmos parâmetros, mesmo retorno) — apenas adicionando os filtros. Nenhum frontend precisa mudar.

### Resultado

Dashboard, Conversão, Churn, Funil, Ativação, Retenção, Winback, Usuários, Onboarding e Emails do admin passam a ignorar essas 3 contas. As contas continuam funcionando normalmente no app — apenas não aparecem nas métricas.
