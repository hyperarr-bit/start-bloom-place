-- 1) Helper: identifica usuários de teste
CREATE OR REPLACE FUNCTION public.is_test_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- 2) admin_metrics_overview
CREATE OR REPLACE FUNCTION public.admin_metrics_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT COUNT(*) INTO total_users FROM auth.users u WHERE NOT public.is_test_user(u.id);

  SELECT COUNT(DISTINCT user_id) INTO active_24h
    FROM public.module_analytics WHERE entered_at > now() - interval '1 day' AND NOT public.is_test_user(user_id);
  SELECT COUNT(DISTINCT user_id) INTO active_7d
    FROM public.module_analytics WHERE entered_at > now() - interval '7 days' AND NOT public.is_test_user(user_id);
  SELECT COUNT(DISTINCT user_id) INTO active_30d
    FROM public.module_analytics WHERE entered_at > now() - interval '30 days' AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO signups_30d FROM auth.users u
    WHERE u.created_at > now() - interval '30 days' AND NOT public.is_test_user(u.id);

  SELECT COUNT(*) INTO paid_active
    FROM public.subscriptions WHERE status = 'active' AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO trial_active
    FROM public.subscriptions WHERE status = 'trialing' AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO canceled_30d
    FROM public.subscriptions
    WHERE status = 'canceled' AND created_at > now() - interval '30 days' AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO active_start_30d
    FROM public.subscriptions
    WHERE status IN ('active','trialing') AND created_at < now() - interval '30 days' AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO signups_eligible_30d
    FROM auth.users u
    WHERE u.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'
      AND NOT public.is_test_user(u.id);
  SELECT COUNT(*) INTO conversions_30d
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.status = 'active'
      AND u.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'
      AND NOT public.is_test_user(u.id);

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
$function$;

-- 3) admin_list_users
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, plan text, status text, current_period_end timestamp with time zone, total_sessions bigint, last_session timestamp with time zone, top_module text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE NOT public.is_test_user(u.id)
  ORDER BY u.created_at DESC;
END;
$function$;

-- 4) admin_module_funnel
CREATE OR REPLACE FUNCTION public.admin_module_funnel()
 RETURNS TABLE(module_id text, unique_users bigint, returning_users bigint, total_sessions bigint, total_seconds bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE NOT public.is_test_user(m.user_id)
  GROUP BY m.module_id
  ORDER BY total_seconds DESC;
END;
$function$;

-- 5) admin_at_risk_users
CREATE OR REPLACE FUNCTION public.admin_at_risk_users()
 RETURNS TABLE(user_id uuid, email text, plan text, last_session timestamp with time zone, days_inactive integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND NOT public.is_test_user(u.id)
  ORDER BY days_inactive DESC;
END;
$function$;

-- 6) admin_conversion_by_trial_day
CREATE OR REPLACE FUNCTION public.admin_conversion_by_trial_day()
 RETURNS TABLE(trial_day integer, conversions bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    LEAST(8, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 86400)::int))::int AS trial_day,
    COUNT(*)::bigint AS conversions
  FROM public.subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE s.status = 'active' AND NOT public.is_test_user(u.id)
  GROUP BY 1
  ORDER BY 1;
END; $function$;

-- 7) admin_activation_funnel
CREATE OR REPLACE FUNCTION public.admin_activation_funnel()
 RETURNS TABLE(action_key text, completed_count bigint, total_users bigint, pct numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE total bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO total FROM auth.users u WHERE NOT public.is_test_user(u.id);
  RETURN QUERY
  SELECT
    a.action_key,
    COUNT(DISTINCT a.user_id)::bigint AS completed_count,
    total AS total_users,
    CASE WHEN total > 0 THEN ROUND((COUNT(DISTINCT a.user_id)::numeric / total) * 100, 2) ELSE 0 END AS pct
  FROM public.user_activations a
  WHERE NOT public.is_test_user(a.user_id)
  GROUP BY a.action_key
  ORDER BY completed_count DESC;
END; $function$;

-- 8) admin_nudge_stats
CREATE OR REPLACE FUNCTION public.admin_nudge_stats()
 RETURNS TABLE(trial_day integer, nudge_key text, shown bigint, clicked bigint, dismissed bigint, completed bigint, conversions_48h bigint, ctr_pct numeric, completion_pct numeric, conversion_pct numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH shows AS (
    SELECT
      e.user_id,
      e.trial_day,
      (e.event_data->>'nudge_key') AS nudge_key,
      e.created_at
    FROM public.analytics_events e
    WHERE e.event_name = 'daily_nudge_shown'
      AND (e.user_id IS NULL OR NOT public.is_test_user(e.user_id))
  ),
  agg AS (
    SELECT
      s.trial_day,
      s.nudge_key,
      COUNT(*)::bigint AS shown,
      (SELECT COUNT(*) FROM public.analytics_events e2
        WHERE e2.event_name = 'daily_nudge_clicked'
          AND (e2.event_data->>'nudge_key') = s.nudge_key
          AND e2.trial_day = s.trial_day
          AND (e2.user_id IS NULL OR NOT public.is_test_user(e2.user_id)))::bigint AS clicked,
      (SELECT COUNT(*) FROM public.analytics_events e2
        WHERE e2.event_name = 'daily_nudge_dismissed'
          AND (e2.event_data->>'nudge_key') = s.nudge_key
          AND e2.trial_day = s.trial_day
          AND (e2.user_id IS NULL OR NOT public.is_test_user(e2.user_id)))::bigint AS dismissed,
      (SELECT COUNT(DISTINCT e2.user_id) FROM public.analytics_events e2
        WHERE e2.event_name = 'onboarding_step_completed'
          AND (e2.event_data->>'nudge_key') = s.nudge_key
          AND e2.trial_day = s.trial_day
          AND (e2.user_id IS NULL OR NOT public.is_test_user(e2.user_id)))::bigint AS completed,
      (SELECT COUNT(DISTINCT sub.user_id)
         FROM public.subscriptions sub
         JOIN shows sh ON sh.user_id = sub.user_id
        WHERE sub.status = 'active'
          AND sh.nudge_key = s.nudge_key
          AND sh.trial_day = s.trial_day
          AND sub.created_at BETWEEN sh.created_at AND sh.created_at + interval '48 hours'
          AND NOT public.is_test_user(sub.user_id))::bigint AS conversions_48h
    FROM shows s
    GROUP BY s.trial_day, s.nudge_key
  )
  SELECT
    a.trial_day,
    a.nudge_key,
    a.shown,
    a.clicked,
    a.dismissed,
    a.completed,
    a.conversions_48h,
    CASE WHEN a.shown > 0 THEN ROUND((a.clicked::numeric / a.shown) * 100, 2) ELSE 0 END,
    CASE WHEN a.shown > 0 THEN ROUND((a.completed::numeric / a.shown) * 100, 2) ELSE 0 END,
    CASE WHEN a.shown > 0 THEN ROUND((a.conversions_48h::numeric / a.shown) * 100, 2) ELSE 0 END
  FROM agg a
  ORDER BY a.trial_day, a.nudge_key;
END;
$function$;

-- 9) admin_email_variant_stats
CREATE OR REPLACE FUNCTION public.admin_email_variant_stats()
 RETURNS TABLE(email_key text, variant_key text, sent_count bigint, banner_clicks_after bigint, conversions_48h bigint, ctr_pct numeric, conversion_pct numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH sent AS (
    SELECT s.email_key, COALESCE(s.variant_key, 'default') AS variant_key, s.user_id, s.sent_at
    FROM public.trial_email_schedule s
    WHERE s.status = 'sent' AND s.sent_at IS NOT NULL
      AND NOT public.is_test_user(s.user_id)
  ),
  agg AS (
    SELECT
      sent.email_key,
      sent.variant_key,
      COUNT(*)::bigint AS sent_count,
      COUNT(DISTINCT (
        SELECT 1 FROM public.analytics_events e
        WHERE e.user_id = sent.user_id
          AND e.event_name = 'trial_banner_click'
          AND e.created_at BETWEEN sent.sent_at AND sent.sent_at + interval '48 hours'
      ))::bigint AS banner_clicks_after,
      COUNT(DISTINCT (
        SELECT 1 FROM public.subscriptions sub
        WHERE sub.user_id = sent.user_id
          AND sub.status = 'active'
          AND sub.created_at BETWEEN sent.sent_at AND sent.sent_at + interval '48 hours'
      ))::bigint AS conversions_48h
    FROM sent
    GROUP BY sent.email_key, sent.variant_key
  )
  SELECT
    a.email_key,
    a.variant_key,
    a.sent_count,
    a.banner_clicks_after,
    a.conversions_48h,
    CASE WHEN a.sent_count > 0 THEN ROUND((a.banner_clicks_after::numeric / a.sent_count) * 100, 2) ELSE 0 END AS ctr_pct,
    CASE WHEN a.sent_count > 0 THEN ROUND((a.conversions_48h::numeric / a.sent_count) * 100, 2) ELSE 0 END AS conversion_pct
  FROM agg a
  ORDER BY a.email_key, a.variant_key;
END; $function$;

-- 10) admin_retention_stats
CREATE OR REPLACE FUNCTION public.admin_retention_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  reasons jsonb;
  funnel jsonb;
  save_rate numeric;
  total_attempts bigint;
  saved_count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC)
    INTO reasons
  FROM (
    SELECT reason, COUNT(*)::bigint AS cnt
    FROM public.cancel_attempts
    WHERE created_at > now() - interval '30 days'
      AND reason IS NOT NULL
      AND NOT public.is_test_user(user_id)
    GROUP BY reason
  ) r;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '30 days' AND NOT public.is_test_user(user_id))::bigint,
    COUNT(*) FILTER (WHERE outcome IN ('saved_discount','saved_pause','saved_feedback')
      AND created_at > now() - interval '30 days'
      AND NOT public.is_test_user(user_id))::bigint
    INTO total_attempts, saved_count
  FROM public.cancel_attempts;

  save_rate := CASE WHEN total_attempts > 0
    THEN ROUND((saved_count::numeric / total_attempts) * 100, 2)
    ELSE 0 END;

  SELECT jsonb_build_object(
    'opened', COUNT(*) FILTER (WHERE outcome = 'opened'),
    'reason_given', COUNT(*) FILTER (WHERE outcome != 'opened'),
    'saved_discount', COUNT(*) FILTER (WHERE outcome = 'saved_discount'),
    'saved_pause', COUNT(*) FILTER (WHERE outcome = 'saved_pause'),
    'saved_feedback', COUNT(*) FILTER (WHERE outcome = 'saved_feedback'),
    'churned', COUNT(*) FILTER (WHERE outcome = 'churned')
  ) INTO funnel
  FROM public.cancel_attempts
  WHERE created_at > now() - interval '30 days'
    AND NOT public.is_test_user(user_id);

  result := jsonb_build_object(
    'reasons_30d', COALESCE(reasons, '[]'::jsonb),
    'funnel_30d', funnel,
    'save_rate_30d', save_rate,
    'total_attempts_30d', total_attempts,
    'saved_count_30d', saved_count,
    'generated_at', now()
  );

  RETURN result;
END;
$function$;

-- 11) admin_retention_offers_breakdown
CREATE OR REPLACE FUNCTION public.admin_retention_offers_breakdown()
 RETURNS TABLE(offer_type text, status text, count bigint, pct_of_type numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT offer_type, status, COUNT(*)::bigint AS cnt
    FROM public.retention_offers_used
    WHERE NOT public.is_test_user(user_id)
    GROUP BY offer_type, status
  ),
  totals AS (
    SELECT offer_type, SUM(cnt)::bigint AS total
    FROM base GROUP BY offer_type
  )
  SELECT
    b.offer_type,
    b.status,
    b.cnt,
    CASE WHEN t.total > 0 THEN ROUND((b.cnt::numeric / t.total) * 100, 2) ELSE 0 END
  FROM base b
  JOIN totals t ON t.offer_type = b.offer_type
  ORDER BY b.offer_type, b.status;
END;
$function$;

-- 12) admin_winback_stats
CREATE OR REPLACE FUNCTION public.admin_winback_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  ANNUAL_PRICE constant numeric := 47.76;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT * FROM public.winback_attempts
    WHERE NOT public.is_test_user(user_id)
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE triggered_at IS NOT NULL)::bigint AS triggered,
      COUNT(*) FILTER (WHERE wheel_spun_at IS NOT NULL)::bigint AS wheel_spun,
      COUNT(*) FILTER (WHERE offer_shown_at IS NOT NULL)::bigint AS offer_shown,
      COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::bigint AS accepted,
      COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::bigint AS converted,
      COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL)::bigint AS dismissed
    FROM base
  ),
  agg_30 AS (
    SELECT
      COUNT(*) FILTER (WHERE triggered_at  > now() - interval '30 days')::bigint AS triggered,
      COUNT(*) FILTER (WHERE wheel_spun_at > now() - interval '30 days')::bigint AS wheel_spun,
      COUNT(*) FILTER (WHERE offer_shown_at > now() - interval '30 days')::bigint AS offer_shown,
      COUNT(*) FILTER (WHERE accepted_at   > now() - interval '30 days')::bigint AS accepted,
      COUNT(*) FILTER (WHERE converted_at  > now() - interval '30 days')::bigint AS converted,
      COUNT(*) FILTER (WHERE dismissed_at  > now() - interval '30 days')::bigint AS dismissed
    FROM base
  ),
  agg_7 AS (
    SELECT
      COUNT(*) FILTER (WHERE triggered_at  > now() - interval '7 days')::bigint AS triggered,
      COUNT(*) FILTER (WHERE wheel_spun_at > now() - interval '7 days')::bigint AS wheel_spun,
      COUNT(*) FILTER (WHERE offer_shown_at > now() - interval '7 days')::bigint AS offer_shown,
      COUNT(*) FILTER (WHERE accepted_at   > now() - interval '7 days')::bigint AS accepted,
      COUNT(*) FILTER (WHERE converted_at  > now() - interval '7 days')::bigint AS converted,
      COUNT(*) FILTER (WHERE dismissed_at  > now() - interval '7 days')::bigint AS dismissed
    FROM base
  ),
  by_day AS (
    SELECT jsonb_agg(jsonb_build_object(
      'date', d::date,
      'triggered', COALESCE(t.triggered, 0),
      'converted', COALESCE(t.converted, 0)
    ) ORDER BY d) AS series
    FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
    LEFT JOIN (
      SELECT
        date_trunc('day', triggered_at)::date AS day,
        COUNT(*) FILTER (WHERE triggered_at IS NOT NULL)::bigint AS triggered,
        COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::bigint AS converted
      FROM base
      WHERE triggered_at > now() - interval '30 days'
      GROUP BY 1
    ) t ON t.day = d::date
  )
  SELECT jsonb_build_object(
    'all_time', jsonb_build_object(
      'triggered', a.triggered,
      'wheel_spun', a.wheel_spun,
      'offer_shown', a.offer_shown,
      'accepted', a.accepted,
      'converted', a.converted,
      'dismissed', a.dismissed,
      'spin_rate_pct',         CASE WHEN a.triggered > 0   THEN ROUND((a.wheel_spun::numeric  / a.triggered) * 100, 2) ELSE 0 END,
      'offer_view_rate_pct',   CASE WHEN a.wheel_spun > 0  THEN ROUND((a.offer_shown::numeric / a.wheel_spun) * 100, 2) ELSE 0 END,
      'accept_rate_pct',       CASE WHEN a.offer_shown > 0 THEN ROUND((a.accepted::numeric    / a.offer_shown) * 100, 2) ELSE 0 END,
      'conversion_rate_pct',   CASE WHEN a.offer_shown > 0 THEN ROUND((a.converted::numeric   / a.offer_shown) * 100, 2) ELSE 0 END,
      'global_conversion_pct', CASE WHEN a.triggered > 0   THEN ROUND((a.converted::numeric   / a.triggered) * 100, 2) ELSE 0 END,
      'revenue_recovered_brl', ROUND(a.converted * ANNUAL_PRICE, 2)
    ),
    'last_30d', jsonb_build_object(
      'triggered', a30.triggered,
      'wheel_spun', a30.wheel_spun,
      'offer_shown', a30.offer_shown,
      'accepted', a30.accepted,
      'converted', a30.converted,
      'dismissed', a30.dismissed,
      'conversion_rate_pct',   CASE WHEN a30.offer_shown > 0 THEN ROUND((a30.converted::numeric / a30.offer_shown) * 100, 2) ELSE 0 END,
      'global_conversion_pct', CASE WHEN a30.triggered > 0   THEN ROUND((a30.converted::numeric / a30.triggered) * 100, 2) ELSE 0 END,
      'revenue_recovered_brl', ROUND(a30.converted * ANNUAL_PRICE, 2)
    ),
    'last_7d', jsonb_build_object(
      'triggered', a7.triggered,
      'wheel_spun', a7.wheel_spun,
      'offer_shown', a7.offer_shown,
      'accepted', a7.accepted,
      'converted', a7.converted,
      'dismissed', a7.dismissed,
      'conversion_rate_pct',   CASE WHEN a7.offer_shown > 0 THEN ROUND((a7.converted::numeric / a7.offer_shown) * 100, 2) ELSE 0 END,
      'revenue_recovered_brl', ROUND(a7.converted * ANNUAL_PRICE, 2)
    ),
    'by_day', COALESCE(bd.series, '[]'::jsonb),
    'annual_price_brl', ANNUAL_PRICE,
    'monthly_equiv_brl', 3.98,
    'generated_at', now()
  ) INTO result
  FROM agg a, agg_30 a30, agg_7 a7, by_day bd;

  RETURN result;
END;
$function$;