
-- 1. Permitir visitantes anônimos inserirem eventos (somente com user_id NULL)
CREATE POLICY "Anon insert anonymous events"
ON public.analytics_events
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Índices para acelerar queries do funil
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_created
  ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id
  ON public.analytics_events (session_id);

-- 2. Funil de aquisição completo (pré + pós-cadastro)
CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  cutoff timestamptz := now() - make_interval(days => _days);
  v_landing bigint;
  v_start_click bigint;
  v_tutorial_started bigint;
  v_tutorial_completed bigint;
  v_signups bigint;
  v_activated bigint;
  v_trial bigint;
  v_paid bigint;
  by_source jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Visitas únicas por sessão
  SELECT COUNT(DISTINCT session_id) INTO v_landing
    FROM public.analytics_events
    WHERE event_name = 'landing_view' AND created_at >= cutoff;

  SELECT COUNT(DISTINCT session_id) INTO v_start_click
    FROM public.analytics_events
    WHERE event_name = 'start_clicked' AND created_at >= cutoff;

  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_started
    FROM public.analytics_events
    WHERE event_name = 'pre_signup_tutorial_started' AND created_at >= cutoff;

  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_completed
    FROM public.analytics_events
    WHERE event_name = 'pre_signup_tutorial_completed' AND created_at >= cutoff;

  SELECT COUNT(*) INTO v_signups
    FROM auth.users u
    WHERE u.created_at >= cutoff AND NOT public.is_test_user(u.id);

  SELECT COUNT(DISTINCT user_id) INTO v_activated
    FROM public.module_analytics
    WHERE entered_at >= cutoff AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO v_trial FROM public.subscriptions
    WHERE status = 'trialing' AND created_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO v_paid FROM public.subscriptions
    WHERE status = 'active' AND created_at >= cutoff AND NOT public.is_test_user(user_id);

  -- Quebra por utm_source
  SELECT jsonb_agg(jsonb_build_object('source', source, 'visits', visits) ORDER BY visits DESC)
    INTO by_source
  FROM (
    SELECT
      COALESCE(NULLIF(event_data->>'utm_source',''), 'direto') AS source,
      COUNT(DISTINCT session_id)::bigint AS visits
    FROM public.analytics_events
    WHERE event_name = 'landing_view' AND created_at >= cutoff
    GROUP BY 1
  ) s;

  result := jsonb_build_object(
    'days', _days,
    'landing', v_landing,
    'start_clicked', v_start_click,
    'tutorial_started', v_tutorial_started,
    'tutorial_completed', v_tutorial_completed,
    'signups', v_signups,
    'activated', v_activated,
    'trial', v_trial,
    'paid', v_paid,
    'by_source', COALESCE(by_source, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_landing_funnel(int) TO authenticated;

-- 3. Lista de usuários que completaram cada etapa do tutorial pós-cadastro
CREATE OR REPLACE FUNCTION public.admin_tutorial_users(_action_key text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  email text,
  completed_at timestamptz,
  action_key text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    a.user_id,
    u.email::text,
    a.completed_at,
    a.action_key
  FROM public.user_activations a
  JOIN auth.users u ON u.id = a.user_id
  WHERE (_action_key IS NULL OR a.action_key = _action_key)
    AND NOT public.is_test_user(a.user_id)
  ORDER BY a.completed_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_tutorial_users(text) TO authenticated;

-- 4. Dashboard v2 — métricas precisas em uma única chamada
CREATE OR REPLACE FUNCTION public.admin_dashboard_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH u AS (
    SELECT id, created_at FROM auth.users WHERE NOT public.is_test_user(id)
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM u),
    'signups_today', (SELECT COUNT(*) FROM u WHERE created_at::date = now()::date),
    'signups_7d', (SELECT COUNT(*) FROM u WHERE created_at > now() - interval '7 days'),
    'signups_30d', (SELECT COUNT(*) FROM u WHERE created_at > now() - interval '30 days'),
    'active_now', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '15 minutes' AND NOT public.is_test_user(user_id)),
    'active_24h', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '24 hours' AND NOT public.is_test_user(user_id)),
    'active_7d', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '7 days' AND NOT public.is_test_user(user_id)),
    'trial_active', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'trialing' AND NOT public.is_test_user(user_id)),
    'paid_active', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'active' AND NOT public.is_test_user(user_id)),
    'mrr_brl', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'active' AND NOT public.is_test_user(user_id)) * 19.90,
    'visits_today', (SELECT COUNT(DISTINCT session_id) FROM public.analytics_events
                    WHERE event_name = 'landing_view' AND created_at::date = now()::date),
    'visits_7d', (SELECT COUNT(DISTINCT session_id) FROM public.analytics_events
                    WHERE event_name = 'landing_view' AND created_at > now() - interval '7 days'),
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_v2() TO authenticated;
