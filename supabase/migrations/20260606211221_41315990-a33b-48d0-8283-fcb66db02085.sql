
-- Helper: per-card reset cutoff (max between global reset and per-card reset)
CREATE OR REPLACE FUNCTION public.admin_card_reset_at(_key text)
RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  global_at timestamptz;
  card_at timestamptz;
BEGIN
  SELECT (value->>'at')::timestamptz INTO global_at FROM public.app_config WHERE key = 'analytics_reset_at';
  SELECT (value->>'at')::timestamptz INTO card_at FROM public.app_config WHERE key = 'card_reset_' || _key;
  RETURN GREATEST(COALESCE(global_at, 'epoch'::timestamptz), COALESCE(card_at, 'epoch'::timestamptz));
END;
$$;

-- Set per-card reset
CREATE OR REPLACE FUNCTION public.admin_set_card_reset(_key text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE ts timestamptz := now();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _key !~ '^[a-z_]+$' THEN RAISE EXCEPTION 'invalid_key'; END IF;
  INSERT INTO public.app_config (key, value, updated_at)
  VALUES ('card_reset_' || _key, jsonb_build_object('at', ts), ts)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
  RETURN ts;
END;
$$;

-- List all card resets
CREATE OR REPLACE FUNCTION public.admin_get_card_resets()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(jsonb_object_agg(substring(key from 12), value->>'at'), '{}'::jsonb)
    INTO result FROM public.app_config WHERE key LIKE 'card_reset_%';
  RETURN result;
END;
$$;

-- Canceled users list
CREATE OR REPLACE FUNCTION public.admin_canceled_users(_days int DEFAULT 30)
RETURNS TABLE(user_id uuid, email text, canceled_at timestamptz, plan text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT s.user_id,
         COALESCE(u.email, s.customer_email)::text,
         GREATEST(s.current_period_end, s.created_at) AS canceled_at,
         s.plan,
         (SELECT ca.reason FROM public.cancel_attempts ca
            WHERE ca.user_id = s.user_id AND ca.reason IS NOT NULL
            ORDER BY ca.created_at DESC LIMIT 1) AS reason
  FROM public.subscriptions s
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE s.status = 'canceled'
    AND s.created_at > now() - make_interval(days => _days)
    AND NOT public.is_test_user(s.user_id)
  ORDER BY canceled_at DESC NULLS LAST
  LIMIT 500;
END;
$$;

-- Patch admin_dashboard_v2 to honor card_reset_overview
CREATE OR REPLACE FUNCTION public.admin_dashboard_v2()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE result jsonb; cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  cutoff := public.admin_card_reset_at('overview');
  WITH u AS (
    SELECT id, created_at FROM auth.users
     WHERE NOT public.is_test_user(id) AND created_at >= cutoff
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM u),
    'signups_today', (SELECT COUNT(*) FROM u WHERE created_at::date = now()::date),
    'signups_7d', (SELECT COUNT(*) FROM u WHERE created_at > now() - interval '7 days'),
    'signups_30d', (SELECT COUNT(*) FROM u WHERE created_at > now() - interval '30 days'),
    'active_now', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '15 minutes' AND entered_at >= cutoff AND NOT public.is_test_user(user_id)),
    'active_24h', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '24 hours' AND entered_at >= cutoff AND NOT public.is_test_user(user_id)),
    'active_7d', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '7 days' AND entered_at >= cutoff AND NOT public.is_test_user(user_id)),
    'active_30d', (SELECT COUNT(DISTINCT user_id) FROM public.module_analytics
                    WHERE entered_at > now() - interval '30 days' AND entered_at >= cutoff AND NOT public.is_test_user(user_id)),
    'trial_active', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'trialing' AND created_at >= cutoff AND NOT public.is_test_user(user_id)),
    'paid_active', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'active' AND created_at >= cutoff AND NOT public.is_test_user(user_id)),
    'canceled_30d', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'canceled' AND created_at > now() - interval '30 days' AND created_at >= cutoff AND NOT public.is_test_user(user_id)),
    'mrr_brl', (SELECT COUNT(*) FROM public.subscriptions
                    WHERE status = 'active' AND created_at >= cutoff AND NOT public.is_test_user(user_id)) * 19.90,
    'visits_today', (SELECT COUNT(DISTINCT session_id) FROM public.analytics_events
                    WHERE event_name = 'landing_view' AND created_at::date = now()::date AND created_at >= cutoff),
    'visits_7d', (SELECT COUNT(DISTINCT session_id) FROM public.analytics_events
                    WHERE event_name = 'landing_view' AND created_at > now() - interval '7 days' AND created_at >= cutoff),
    'reset_at', cutoff,
    'generated_at', now()
  ) INTO result;
  RETURN result;
END;
$$;

-- Patch admin_landing_funnel(_from,_to)
CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_from timestamp with time zone DEFAULT NULL, _to timestamp with time zone DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  result jsonb; cutoff timestamptz; upper timestamptz; reset_at timestamptz;
  v_landing bigint; v_start_click bigint; v_tutorial_started bigint; v_tutorial_completed bigint;
  v_quicksignup bigint; v_signups bigint; v_trial_started bigint; v_activated bigint; v_paid bigint;
  by_source jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  reset_at := public.admin_card_reset_at('funnel');
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), reset_at);
  upper := COALESCE(_to, now());

  SELECT COUNT(DISTINCT session_id) INTO v_landing FROM public.analytics_events WHERE event_name = 'landing_view' AND created_at >= cutoff AND created_at <= upper;
  SELECT COUNT(DISTINCT session_id) INTO v_start_click FROM public.analytics_events WHERE event_name = 'start_clicked' AND created_at >= cutoff AND created_at <= upper;
  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_started FROM public.analytics_events WHERE event_name = 'pre_signup_tutorial_started' AND created_at >= cutoff AND created_at <= upper;
  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_completed FROM public.analytics_events WHERE event_name = 'pre_signup_tutorial_completed' AND created_at >= cutoff AND created_at <= upper;
  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_quicksignup FROM public.analytics_events WHERE event_name = 'quicksignup_completed' AND created_at >= cutoff AND created_at <= upper;
  SELECT COUNT(*) INTO v_signups FROM auth.users u WHERE u.created_at >= cutoff AND u.created_at <= upper AND NOT public.is_test_user(u.id);
  SELECT COUNT(DISTINCT user_id) INTO v_trial_started FROM public.analytics_events WHERE event_name = 'trial_started' AND created_at >= cutoff AND created_at <= upper AND (user_id IS NULL OR NOT public.is_test_user(user_id));
  SELECT COUNT(DISTINCT user_id) INTO v_activated FROM public.module_analytics WHERE entered_at >= cutoff AND entered_at <= upper AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO v_paid FROM public.subscriptions WHERE status = 'active' AND created_at >= cutoff AND created_at <= upper AND NOT public.is_test_user(user_id);

  SELECT jsonb_agg(jsonb_build_object('source', source, 'visits', visits) ORDER BY visits DESC) INTO by_source
  FROM (
    SELECT COALESCE(NULLIF(event_data->>'utm_source',''), 'direto') AS source,
           COUNT(DISTINCT session_id)::bigint AS visits
    FROM public.analytics_events
    WHERE event_name = 'landing_view' AND created_at >= cutoff AND created_at <= upper
    GROUP BY 1
  ) s;

  result := jsonb_build_object(
    'from', _from, 'to', _to, 'reset_at', reset_at, 'cutoff', cutoff, 'upper', upper,
    'landing', v_landing, 'start_clicked', v_start_click,
    'tutorial_started', v_tutorial_started, 'tutorial_completed', v_tutorial_completed,
    'quicksignup_submitted', v_quicksignup,
    'signups', v_signups, 'trial_started', v_trial_started,
    'activated', v_activated, 'paid', v_paid,
    'by_source', COALESCE(by_source, '[]'::jsonb), 'generated_at', now()
  );
  RETURN result;
END;
$$;

-- Patch admin_tutorial_dropoff(_from,_to)
CREATE OR REPLACE FUNCTION public.admin_tutorial_dropoff(_from timestamp with time zone DEFAULT NULL, _to timestamp with time zone DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE result jsonb; cutoff timestamptz; upper timestamptz; reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  reset_at := public.admin_card_reset_at('dropoff');
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), reset_at);
  upper := COALESCE(_to, now());

  WITH all_modules AS (SELECT unnest(ARRAY['financas','rotina','dieta','treino']) AS module_id),
  starts AS (
    SELECT COALESCE(event_data->>'module','') AS module_id, session_id, user_id
    FROM public.analytics_events
    WHERE event_name IN ('spotlight_shown','spotlight_started') AND created_at >= cutoff AND created_at <= upper
  ),
  starts_agg AS (
    SELECT module_id, COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS started
    FROM starts WHERE module_id <> '' GROUP BY module_id
  ),
  steps AS (
    SELECT COALESCE(event_data->>'module','') AS module_id,
      (event_data->>'step')::int AS step_idx,
      (event_data->>'total')::int AS total,
      COALESCE(event_data->>'label','') AS label, session_id, user_id
    FROM public.analytics_events
    WHERE event_name = 'spotlight_step_view' AND created_at >= cutoff AND created_at <= upper
      AND event_data ? 'step' AND event_data ? 'module'
  ),
  steps_agg AS (
    SELECT module_id, step_idx, MAX(total) AS total, MAX(label) AS label,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS reached
    FROM steps GROUP BY module_id, step_idx
  ),
  completes AS (
    SELECT COALESCE(event_data->>'module','') AS module_id,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS completed
    FROM public.analytics_events
    WHERE event_name = 'quickstart_completed' AND created_at >= cutoff AND created_at <= upper
    GROUP BY 1
  ),
  by_module AS (
    SELECT am.module_id, COALESCE(sa.started, 0) AS started, COALESCE(c.completed, 0) AS completed,
      jsonb_agg(jsonb_build_object('step', s.step_idx, 'label', s.label, 'total', s.total, 'reached', s.reached) ORDER BY s.step_idx)
        FILTER (WHERE s.step_idx IS NOT NULL) AS steps
    FROM all_modules am
    LEFT JOIN starts_agg sa ON sa.module_id = am.module_id
    LEFT JOIN completes c ON c.module_id = am.module_id
    LEFT JOIN steps_agg s ON s.module_id = am.module_id
    GROUP BY am.module_id, sa.started, c.completed
  )
  SELECT jsonb_build_object(
    'from', _from, 'to', _to, 'reset_at', reset_at, 'cutoff', cutoff, 'upper', upper,
    'modules', COALESCE(jsonb_agg(jsonb_build_object(
      'module_id', module_id, 'started', started, 'completed', completed,
      'steps', COALESCE(steps, '[]'::jsonb)) ORDER BY module_id), '[]'::jsonb),
    'generated_at', now()
  ) INTO result FROM by_module;
  RETURN result;
END;
$$;

-- Patch admin_module_funnel to honor card_reset_modules
CREATE OR REPLACE FUNCTION public.admin_module_funnel()
RETURNS TABLE(module_id text, unique_users bigint, returning_users bigint, total_sessions bigint, total_seconds bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  cutoff := public.admin_card_reset_at('modules');
  RETURN QUERY
  SELECT m.module_id,
    COUNT(DISTINCT m.user_id)::bigint AS unique_users,
    COUNT(DISTINCT CASE WHEN cnt.c >= 3 THEN m.user_id END)::bigint AS returning_users,
    COUNT(*)::bigint AS total_sessions,
    SUM(m.duration_seconds)::bigint AS total_seconds
  FROM public.module_analytics m
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS c FROM public.module_analytics m2
    WHERE m2.user_id = m.user_id AND m2.module_id = m.module_id AND m2.entered_at >= cutoff
  ) cnt ON true
  WHERE NOT public.is_test_user(m.user_id) AND m.entered_at >= cutoff
  GROUP BY m.module_id
  ORDER BY total_seconds DESC;
END;
$$;

-- Patch admin_top_tabs to honor card_reset_tabs
CREATE OR REPLACE FUNCTION public.admin_top_tabs(_from timestamp with time zone DEFAULT NULL, _to timestamp with time zone DEFAULT NULL)
RETURNS TABLE(module_id text, tab_id text, sessions bigint, unique_users bigint, total_seconds bigint, last_used timestamp with time zone)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cutoff timestamptz; upper timestamptz; reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  reset_at := public.admin_card_reset_at('tabs');
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), reset_at);
  upper := COALESCE(_to, now());
  RETURN QUERY
  SELECT m.module_id::text,
    COALESCE(m.tab_id, '(sem aba)')::text,
    COUNT(*)::bigint,
    COUNT(DISTINCT m.user_id)::bigint,
    COALESCE(SUM(m.duration_seconds),0)::bigint,
    MAX(m.entered_at)
  FROM public.module_analytics m
  WHERE m.entered_at >= cutoff AND m.entered_at <= upper
    AND NOT public.is_test_user(m.user_id)
  GROUP BY m.module_id, m.tab_id
  ORDER BY total_seconds DESC
  LIMIT 50;
END; $$;

-- Patch admin_retention_stats to honor card_reset_retention
CREATE OR REPLACE FUNCTION public.admin_retention_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  result jsonb; reasons jsonb; funnel jsonb;
  save_rate numeric; total_attempts bigint; saved_count bigint; cutoff timestamptz; floor_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  cutoff := public.admin_card_reset_at('retention');
  floor_at := GREATEST(cutoff, now() - interval '30 days');

  SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC) INTO reasons
  FROM (
    SELECT reason, COUNT(*)::bigint AS cnt FROM public.cancel_attempts
    WHERE created_at > floor_at AND reason IS NOT NULL AND NOT public.is_test_user(user_id)
    GROUP BY reason
  ) r;

  SELECT
    COUNT(*) FILTER (WHERE created_at > floor_at AND NOT public.is_test_user(user_id))::bigint,
    COUNT(*) FILTER (WHERE outcome IN ('saved_discount','saved_pause','saved_feedback')
      AND created_at > floor_at AND NOT public.is_test_user(user_id))::bigint
    INTO total_attempts, saved_count FROM public.cancel_attempts;

  save_rate := CASE WHEN total_attempts > 0 THEN ROUND((saved_count::numeric / total_attempts) * 100, 2) ELSE 0 END;

  SELECT jsonb_build_object(
    'opened', COUNT(*) FILTER (WHERE outcome = 'opened'),
    'reason_given', COUNT(*) FILTER (WHERE outcome != 'opened'),
    'saved_discount', COUNT(*) FILTER (WHERE outcome = 'saved_discount'),
    'saved_pause', COUNT(*) FILTER (WHERE outcome = 'saved_pause'),
    'saved_feedback', COUNT(*) FILTER (WHERE outcome = 'saved_feedback'),
    'churned', COUNT(*) FILTER (WHERE outcome = 'churned')
  ) INTO funnel FROM public.cancel_attempts
  WHERE created_at > floor_at AND NOT public.is_test_user(user_id);

  result := jsonb_build_object(
    'reasons_30d', COALESCE(reasons, '[]'::jsonb),
    'funnel_30d', funnel,
    'save_rate_30d', save_rate,
    'total_attempts_30d', total_attempts,
    'saved_count_30d', saved_count,
    'reset_at', cutoff, 'generated_at', now()
  );
  RETURN result;
END;
$$;

-- Patch admin_metrics_overview to honor card_reset_metrics
CREATE OR REPLACE FUNCTION public.admin_metrics_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  caller_email text; result jsonb;
  total_users int; active_24h int; active_7d int; active_30d int;
  signups_30d int; paid_active int; trial_active int; canceled_30d int;
  active_start_30d int; conversions_30d int; signups_eligible_30d int; mrr numeric;
  cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  caller_email := (auth.jwt() ->> 'email');
  IF caller_email IS DISTINCT FROM 'jv20101958@gmail.com' THEN RAISE EXCEPTION 'forbidden_email'; END IF;

  cutoff := public.admin_card_reset_at('metrics');

  SELECT COUNT(*) INTO total_users FROM auth.users u WHERE NOT public.is_test_user(u.id) AND u.created_at >= cutoff;

  SELECT COUNT(DISTINCT user_id) INTO active_24h FROM public.module_analytics
    WHERE entered_at > now() - interval '1 day' AND entered_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(DISTINCT user_id) INTO active_7d FROM public.module_analytics
    WHERE entered_at > now() - interval '7 days' AND entered_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(DISTINCT user_id) INTO active_30d FROM public.module_analytics
    WHERE entered_at > now() - interval '30 days' AND entered_at >= cutoff AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO signups_30d FROM auth.users u
    WHERE u.created_at > GREATEST(now() - interval '30 days', cutoff) AND NOT public.is_test_user(u.id);

  SELECT COUNT(*) INTO paid_active FROM public.subscriptions
    WHERE status = 'active' AND created_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO trial_active FROM public.subscriptions
    WHERE status = 'trialing' AND created_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO canceled_30d FROM public.subscriptions
    WHERE status = 'canceled' AND created_at > GREATEST(now() - interval '30 days', cutoff) AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO active_start_30d FROM public.subscriptions
    WHERE status IN ('active','trialing') AND created_at < now() - interval '30 days' AND created_at >= cutoff AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO signups_eligible_30d FROM auth.users u
    WHERE u.created_at BETWEEN GREATEST(now() - interval '60 days', cutoff) AND now() - interval '30 days'
      AND NOT public.is_test_user(u.id);
  SELECT COUNT(*) INTO conversions_30d FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.status = 'active'
      AND u.created_at BETWEEN GREATEST(now() - interval '60 days', cutoff) AND now() - interval '30 days'
      AND NOT public.is_test_user(u.id);

  mrr := paid_active * 19.90;

  result := jsonb_build_object(
    'total_users', total_users, 'active_24h', active_24h, 'active_7d', active_7d, 'active_30d', active_30d,
    'signups_30d', signups_30d, 'paid_active', paid_active, 'trial_active', trial_active,
    'canceled_30d', canceled_30d,
    'churn_rate_30d', CASE WHEN active_start_30d > 0 THEN ROUND((canceled_30d::numeric / active_start_30d) * 100, 2) ELSE 0 END,
    'conversion_rate_30d', CASE WHEN signups_eligible_30d > 0 THEN ROUND((conversions_30d::numeric / signups_eligible_30d) * 100, 2) ELSE 0 END,
    'mrr_estimated', mrr, 'reset_at', cutoff, 'generated_at', now()
  );
  RETURN result;
END;
$$;
