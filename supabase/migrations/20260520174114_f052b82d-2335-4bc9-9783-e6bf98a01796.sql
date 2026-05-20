
-- Reset RPC: sets analytics_reset_at to now()
CREATE OR REPLACE FUNCTION public.admin_reset_analytics()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts timestamptz := now();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.app_config (key, value, updated_at)
  VALUES ('analytics_reset_at', jsonb_build_object('at', ts), ts)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
  RETURN ts;
END;
$$;

-- Update admin_landing_funnel: respect analytics_reset_at floor
CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cutoff timestamptz;
  reset_at timestamptz;
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

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(now() - make_interval(days => _days), COALESCE(reset_at, 'epoch'::timestamptz));

  SELECT COUNT(DISTINCT session_id) INTO v_landing FROM public.analytics_events WHERE event_name = 'landing_view' AND created_at >= cutoff;
  SELECT COUNT(DISTINCT session_id) INTO v_start_click FROM public.analytics_events WHERE event_name = 'start_clicked' AND created_at >= cutoff;
  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_started FROM public.analytics_events WHERE event_name = 'pre_signup_tutorial_started' AND created_at >= cutoff;
  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_completed FROM public.analytics_events WHERE event_name = 'pre_signup_tutorial_completed' AND created_at >= cutoff;

  SELECT COUNT(*) INTO v_signups FROM auth.users u WHERE u.created_at >= cutoff AND NOT public.is_test_user(u.id);
  SELECT COUNT(DISTINCT user_id) INTO v_activated FROM public.module_analytics WHERE entered_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO v_trial FROM public.subscriptions WHERE status = 'trialing' AND created_at >= cutoff AND NOT public.is_test_user(user_id);
  SELECT COUNT(*) INTO v_paid FROM public.subscriptions WHERE status = 'active' AND created_at >= cutoff AND NOT public.is_test_user(user_id);

  SELECT jsonb_agg(jsonb_build_object('source', source, 'visits', visits) ORDER BY visits DESC) INTO by_source
  FROM (
    SELECT COALESCE(NULLIF(event_data->>'utm_source',''), 'direto') AS source,
           COUNT(DISTINCT session_id)::bigint AS visits
    FROM public.analytics_events
    WHERE event_name = 'landing_view' AND created_at >= cutoff
    GROUP BY 1
  ) s;

  result := jsonb_build_object(
    'days', _days, 'reset_at', reset_at, 'cutoff', cutoff,
    'landing', v_landing, 'start_clicked', v_start_click,
    'tutorial_started', v_tutorial_started, 'tutorial_completed', v_tutorial_completed,
    'signups', v_signups, 'activated', v_activated, 'trial', v_trial, 'paid', v_paid,
    'by_source', COALESCE(by_source, '[]'::jsonb), 'generated_at', now()
  );
  RETURN result;
END;
$function$;

-- Update admin_tutorial_dropoff: respect reset
CREATE OR REPLACE FUNCTION public.admin_tutorial_dropoff(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cutoff timestamptz;
  reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(now() - make_interval(days => _days), COALESCE(reset_at, 'epoch'::timestamptz));

  WITH starts AS (
    SELECT COALESCE(event_data->>'module','') AS module_id, session_id, user_id
    FROM public.analytics_events
    WHERE event_name IN ('spotlight_shown','spotlight_started') AND created_at >= cutoff
  ),
  starts_agg AS (
    SELECT module_id, COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS started
    FROM starts WHERE module_id <> '' GROUP BY module_id
  ),
  steps AS (
    SELECT COALESCE(event_data->>'module','') AS module_id,
      (event_data->>'step')::int AS step_idx,
      (event_data->>'total')::int AS total,
      COALESCE(event_data->>'label','') AS label,
      session_id, user_id
    FROM public.analytics_events
    WHERE event_name = 'spotlight_step_view' AND created_at >= cutoff
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
    WHERE event_name = 'quickstart_completed' AND created_at >= cutoff
    GROUP BY 1
  ),
  by_module AS (
    SELECT m.module_id, COALESCE(sa.started, 0) AS started, COALESCE(c.completed, 0) AS completed,
      jsonb_agg(jsonb_build_object('step', s.step_idx, 'label', s.label, 'total', s.total, 'reached', s.reached) ORDER BY s.step_idx)
        FILTER (WHERE s.step_idx IS NOT NULL) AS steps
    FROM (SELECT DISTINCT module_id FROM steps_agg WHERE module_id <> '') m
    LEFT JOIN starts_agg sa USING (module_id)
    LEFT JOIN completes c USING (module_id)
    LEFT JOIN steps_agg s ON s.module_id = m.module_id
    GROUP BY m.module_id, sa.started, c.completed
  )
  SELECT jsonb_build_object(
    'days', _days, 'reset_at', reset_at,
    'modules', COALESCE(jsonb_agg(jsonb_build_object(
      'module_id', module_id, 'started', started, 'completed', completed,
      'steps', COALESCE(steps, '[]'::jsonb)) ORDER BY module_id), '[]'::jsonb),
    'generated_at', now()
  ) INTO result FROM by_module;
  RETURN result;
END;
$function$;

-- User journey RPC
CREATE OR REPLACE FUNCTION public.admin_user_journey(_user_id uuid DEFAULT NULL, _session_id text DEFAULT NULL, _limit integer DEFAULT 200)
RETURNS TABLE(created_at timestamptz, event_name text, event_data jsonb, session_id text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT e.created_at, e.event_name, e.event_data, e.session_id
  FROM public.analytics_events e
  WHERE (_user_id IS NOT NULL AND e.user_id = _user_id)
     OR (_session_id IS NOT NULL AND e.session_id = _session_id)
  ORDER BY e.created_at ASC
  LIMIT _limit;
END;
$$;

-- Recent anonymous visitors RPC
CREATE OR REPLACE FUNCTION public.admin_recent_visitors(_limit integer DEFAULT 100)
RETURNS TABLE(session_id text, first_seen timestamptz, last_seen timestamptz, events bigint, last_event text, last_module text, last_step text, utm_source text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reset_at timestamptz;
  cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(now() - interval '30 days', COALESCE(reset_at, 'epoch'::timestamptz));

  RETURN QUERY
  WITH base AS (
    SELECT e.session_id, e.created_at, e.event_name, e.event_data
    FROM public.analytics_events e
    WHERE e.user_id IS NULL AND e.session_id IS NOT NULL AND e.created_at >= cutoff
  ),
  last_evt AS (
    SELECT DISTINCT ON (session_id) session_id, event_name, event_data, created_at
    FROM base ORDER BY session_id, created_at DESC
  ),
  agg AS (
    SELECT session_id,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      COUNT(*)::bigint AS events,
      MAX(event_data->>'utm_source') AS utm_source
    FROM base GROUP BY session_id
  )
  SELECT a.session_id, a.first_seen, a.last_seen, a.events,
    l.event_name, l.event_data->>'module', l.event_data->>'label',
    COALESCE(NULLIF(a.utm_source,''), 'direto')
  FROM agg a JOIN last_evt l USING (session_id)
  ORDER BY a.last_seen DESC LIMIT _limit;
END;
$$;
