-- Admins can read all profiles
CREATE POLICY "Admins read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read all subscriptions
CREATE POLICY "Admins read all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read all module_analytics (already exists but ensure)
-- (already covered by "Admins read all analytics")

-- Function: list all users with aggregated info — admin only
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan text,
  status text,
  current_period_end timestamptz,
  total_sessions bigint,
  last_session timestamptz,
  top_module text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    s.plan,
    COALESCE(s.status, 'none') AS status,
    s.current_period_end,
    COALESCE(ma.cnt, 0) AS total_sessions,
    ma.last_session,
    ma.top_module
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT plan, status, current_period_end
    FROM public.subscriptions s2
    WHERE s2.user_id = u.id
    ORDER BY s2.created_at DESC
    LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::bigint AS cnt,
      MAX(entered_at) AS last_session,
      (SELECT module_id FROM public.module_analytics m2
        WHERE m2.user_id = u.id
        GROUP BY module_id ORDER BY SUM(duration_seconds) DESC LIMIT 1) AS top_module
    FROM public.module_analytics m
    WHERE m.user_id = u.id
  ) ma ON true
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Function: metrics overview — admin + email lock
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

  -- Estimated MRR: R$19.90 per active subscription (placeholder)
  mrr := paid_active * 19.90;

  result := jsonb_build_object(
    'total_users', total_users,
    'active_24h', active_24h,
    'active_7d', active_7d,
    'active_30d', active_30d,
    'signups_30d', signups_30d,
    'paid_active', paid_active,
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

-- Function: per-module funnel data — admin only
CREATE OR REPLACE FUNCTION public.admin_module_funnel()
RETURNS TABLE (
  module_id text,
  unique_users bigint,
  returning_users bigint,
  total_sessions bigint,
  total_seconds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    m.module_id,
    COUNT(DISTINCT m.user_id)::bigint AS unique_users,
    COUNT(DISTINCT CASE WHEN cnt.c >= 3 THEN m.user_id END)::bigint AS returning_users,
    COUNT(*)::bigint AS total_sessions,
    SUM(m.duration_seconds)::bigint AS total_seconds
  FROM public.module_analytics m
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS c FROM public.module_analytics m2
    WHERE m2.user_id = m.user_id AND m2.module_id = m.module_id
  ) cnt ON true
  GROUP BY m.module_id
  ORDER BY total_seconds DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_module_funnel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_funnel() TO authenticated;

-- Function: at-risk paid users (no session in 7 days)
CREATE OR REPLACE FUNCTION public.admin_at_risk_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  plan text,
  last_session timestamptz,
  days_inactive int
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    s.plan,
    ma.last_session,
    EXTRACT(DAY FROM (now() - COALESCE(ma.last_session, u.created_at)))::int AS days_inactive
  FROM auth.users u
  JOIN public.subscriptions s ON s.user_id = u.id AND s.status = 'active'
  LEFT JOIN LATERAL (
    SELECT MAX(entered_at) AS last_session
    FROM public.module_analytics
    WHERE user_id = u.id
  ) ma ON true
  WHERE COALESCE(ma.last_session, u.created_at) < now() - interval '7 days'
  ORDER BY days_inactive DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_at_risk_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_at_risk_users() TO authenticated;