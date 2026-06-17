-- Reformulação do painel /admin: engajamento cross-módulo + correção do MRR.
--
-- 1) admin_module_usage      → uso agregado por módulo (todos os 16), com % de adoção
-- 2) admin_module_tab_usage  → ranking de abas de QUALQUER módulo (generaliza admin_finance_tab_usage)
-- 3) admin_module_card_usage → ranking de cards de QUALQUER módulo (generaliza admin_finance_card_usage)
-- 4) admin_metrics_overview  → recriada com MRR correto (R$14,90 mensal / R$3,90 anual por mês)
--
-- Convenções seguidas (iguais às RPCs existentes):
--   LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
--   guarda has_role(auth.uid(),'admin'); respeita app_config.analytics_reset_at;
--   filtra usuários de teste com is_test_user().

-- ============================================================
-- 1) Uso agregado por módulo
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_module_usage(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  module_id text,
  sessions bigint,
  unique_users bigint,
  total_seconds bigint,
  avg_seconds numeric,
  last_used timestamptz,
  adoption_pct numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cutoff timestamptz;
  upper_bound timestamptz;
  reset_at timestamptz;
  total_active bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper_bound := COALESCE(_to, now());

  -- denominador da adoção: usuários distintos ativos (em qualquer módulo) no período
  SELECT COUNT(DISTINCT m.user_id) INTO total_active
  FROM public.module_analytics m
  WHERE m.entered_at >= cutoff AND m.entered_at <= upper_bound
    AND NOT public.is_test_user(m.user_id);

  RETURN QUERY
  SELECT
    m.module_id::text,
    COUNT(*)::bigint,
    COUNT(DISTINCT m.user_id)::bigint,
    COALESCE(SUM(m.duration_seconds), 0)::bigint,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(m.duration_seconds)::numeric, 1) ELSE 0 END,
    MAX(m.entered_at),
    CASE WHEN total_active > 0
      THEN ROUND((COUNT(DISTINCT m.user_id)::numeric / total_active) * 100, 1)
      ELSE 0 END
  FROM public.module_analytics m
  WHERE m.entered_at >= cutoff AND m.entered_at <= upper_bound
    AND NOT public.is_test_user(m.user_id)
  GROUP BY m.module_id
  ORDER BY 3 DESC, 4 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_module_usage(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_usage(timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 2) Ranking de abas de qualquer módulo
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_module_tab_usage(
  _module text,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  tab_id text,
  sessions bigint,
  unique_users bigint,
  total_seconds bigint,
  avg_seconds numeric,
  last_used timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cutoff timestamptz;
  upper_bound timestamptz;
  reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper_bound := COALESCE(_to, now());

  RETURN QUERY
  SELECT
    COALESCE(m.tab_id, '(sem aba)')::text,
    COUNT(*)::bigint,
    COUNT(DISTINCT m.user_id)::bigint,
    COALESCE(SUM(m.duration_seconds), 0)::bigint,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(m.duration_seconds)::numeric, 1) ELSE 0 END,
    MAX(m.entered_at)
  FROM public.module_analytics m
  WHERE m.module_id = _module
    AND m.entered_at >= cutoff AND m.entered_at <= upper_bound
    AND NOT public.is_test_user(m.user_id)
  GROUP BY 1
  ORDER BY total_seconds DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_module_tab_usage(text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_tab_usage(text, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 3) Ranking de cards de qualquer módulo
--    (eventos finance_card_view / finance_card_interact; event_data->>'card' e ->>'tab')
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_module_card_usage(
  _module text DEFAULT 'financas',
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  card_key text,
  tab_id text,
  views bigint,
  interactions bigint,
  unique_users bigint,
  last_used timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cutoff timestamptz;
  upper_bound timestamptz;
  reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper_bound := COALESCE(_to, now());

  -- Hoje só Finanças instrumenta cards; o filtro por módulo fica pronto p/ quando
  -- outros módulos passarem a disparar eventos *_card_view com event_data->>'module'.
  RETURN QUERY
  SELECT
    COALESCE(e.event_data->>'card', '(sem card)')::text,
    COALESCE(NULLIF(e.event_data->>'tab', ''), '(sem aba)')::text,
    COUNT(*) FILTER (WHERE e.event_name = 'finance_card_view')::bigint,
    COUNT(*) FILTER (WHERE e.event_name = 'finance_card_interact')::bigint,
    COUNT(DISTINCT e.user_id)::bigint,
    MAX(e.created_at)
  FROM public.analytics_events e
  WHERE e.event_name IN ('finance_card_view', 'finance_card_interact')
    AND e.created_at >= cutoff AND e.created_at <= upper_bound
    AND (e.user_id IS NULL OR NOT public.is_test_user(e.user_id))
    AND (
      _module = 'financas'
      OR e.event_data->>'module' = _module
    )
  GROUP BY 1, 2
  ORDER BY 3 DESC, 4 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_module_card_usage(text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_card_usage(text, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 4) admin_metrics_overview com MRR correto
--    Preço real: mensal R$14,90 | anual R$46,80/ano = R$3,90/mês
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_metrics_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  caller_email text;
  result jsonb;
  total_users int;
  active_24h int;
  active_7d int;
  active_30d int;
  signups_30d int;
  paid_active int;
  paid_monthly int;
  paid_annual int;
  trial_active int;
  canceled_30d int;
  active_start_30d int;
  conversions_30d int;
  signups_eligible_30d int;
  mrr numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  caller_email := (auth.jwt() ->> 'email');
  IF caller_email IS DISTINCT FROM 'jv20101958@gmail.com' THEN
    RAISE EXCEPTION 'forbidden_email';
  END IF;

  SELECT COUNT(*) INTO total_users FROM auth.users;

  SELECT COUNT(DISTINCT user_id) INTO active_24h
    FROM public.module_analytics WHERE entered_at > now() - interval '1 day';
  SELECT COUNT(DISTINCT user_id) INTO active_7d
    FROM public.module_analytics WHERE entered_at > now() - interval '7 days';
  SELECT COUNT(DISTINCT user_id) INTO active_30d
    FROM public.module_analytics WHERE entered_at > now() - interval '30 days';

  SELECT COUNT(*) INTO signups_30d FROM auth.users WHERE created_at > now() - interval '30 days';

  SELECT COUNT(*) INTO paid_active
    FROM public.subscriptions WHERE status = 'active';
  SELECT COUNT(*) INTO paid_monthly
    FROM public.subscriptions WHERE status = 'active' AND COALESCE(billing_period, 'monthly') = 'monthly';
  SELECT COUNT(*) INTO paid_annual
    FROM public.subscriptions WHERE status = 'active' AND billing_period = 'annual';
  SELECT COUNT(*) INTO trial_active
    FROM public.subscriptions WHERE status = 'trialing';
  SELECT COUNT(*) INTO canceled_30d
    FROM public.subscriptions
    WHERE status = 'canceled' AND created_at > now() - interval '30 days';

  SELECT COUNT(*) INTO active_start_30d
    FROM public.subscriptions
    WHERE status IN ('active','trialing') AND created_at < now() - interval '30 days';

  SELECT COUNT(*) INTO signups_eligible_30d
    FROM auth.users WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days';
  SELECT COUNT(*) INTO conversions_30d
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.status = 'active'
      AND u.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days';

  -- MRR real: mensal R$14,90 + anual normalizado R$46,80/12 = R$3,90
  mrr := ROUND((paid_monthly * 14.90) + (paid_annual * 3.90), 2);

  result := jsonb_build_object(
    'total_users', total_users,
    'active_24h', active_24h,
    'active_7d', active_7d,
    'active_30d', active_30d,
    'signups_30d', signups_30d,
    'paid_active', paid_active,
    'paid_monthly', paid_monthly,
    'paid_annual', paid_annual,
    'trial_active', trial_active,
    'canceled_30d', canceled_30d,
    'churn_rate_30d', CASE WHEN active_start_30d > 0 THEN ROUND((canceled_30d::numeric / active_start_30d) * 100, 2) ELSE 0 END,
    'conversion_rate_30d', CASE WHEN signups_eligible_30d > 0 THEN ROUND((conversions_30d::numeric / signups_eligible_30d) * 100, 2) ELSE 0 END,
    'mrr_estimated', mrr,
    'generated_at', now()
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_metrics_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_metrics_overview() TO authenticated;
