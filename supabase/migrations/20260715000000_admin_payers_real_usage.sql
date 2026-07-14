-- 15/07: a aba Pagantes mostrava "sem uso registrado" errado — lia
-- finance_card_view (quase nunca emitido) em vez da tabela module_analytics,
-- que tem o uso REAL (módulo, aba, tempo em segundos por visita). Reescrito
-- pra: nome real (profiles.display_name), 1º/último acesso COM hora, tempo
-- total no app, nº de sessões, e uso por MÓDULO e por ABA com tempo.

CREATE OR REPLACE FUNCTION public.admin_paying_users_detail()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH subs AS (
    SELECT s.*, COALESCE(NULLIF(s.customer_email, ''), u.email) AS email
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
  ),
  prof AS (
    SELECT id, NULLIF(TRIM(display_name), '') AS name
    FROM public.profiles WHERE id IN (SELECT user_id FROM subs)
  ),
  activity AS (
    SELECT user_id,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      COUNT(DISTINCT session_id) AS sessions
    FROM public.analytics_events
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id
  ),
  -- uso por módulo (tempo + nº de visitas)
  mod_usage AS (
    SELECT user_id, module_id,
      SUM(duration_seconds) AS seconds,
      COUNT(*) AS opens
    FROM public.module_analytics
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id, module_id
  ),
  mod_agg AS (
    SELECT user_id,
      jsonb_agg(jsonb_build_object('id', module_id, 'seconds', seconds, 'opens', opens)
                ORDER BY seconds DESC) AS modules,
      SUM(seconds) AS total_seconds,
      SUM(opens) AS total_opens
    FROM mod_usage GROUP BY user_id
  ),
  -- uso por aba (módulo + aba), top por tempo
  tab_usage AS (
    SELECT user_id, module_id, tab_id, SUM(duration_seconds) AS seconds
    FROM public.module_analytics
    WHERE user_id IN (SELECT user_id FROM subs) AND tab_id IS NOT NULL AND tab_id <> ''
    GROUP BY user_id, module_id, tab_id
  ),
  tab_agg AS (
    SELECT user_id,
      (jsonb_agg(jsonb_build_object('module', module_id, 'tab', tab_id, 'seconds', seconds)
                 ORDER BY seconds DESC))[0:15] AS tabs
    FROM tab_usage GROUP BY user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', s.email,
    'name', p.name,
    'plan', s.billing_period,
    'status', s.status,
    'subscribed_since', s.created_at,
    'current_period_end', s.current_period_end,
    'first_seen', a.first_seen,
    'last_seen', a.last_seen,
    'sessions', COALESCE(a.sessions, 0),
    'total_seconds', COALESCE(ma.total_seconds, 0),
    'total_opens', COALESCE(ma.total_opens, 0),
    'modules', COALESCE(ma.modules, '[]'::jsonb),
    'tabs', COALESCE(ta.tabs, '[]'::jsonb)
  ) ORDER BY s.created_at DESC), '[]'::jsonb) INTO result
  FROM subs s
  LEFT JOIN prof p ON p.id = s.user_id
  LEFT JOIN activity a ON a.user_id = s.user_id
  LEFT JOIN mod_agg ma ON ma.user_id = s.user_id
  LEFT JOIN tab_agg ta ON ta.user_id = s.user_id;

  RETURN jsonb_build_object('users', result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_paying_users_detail() TO authenticated;
