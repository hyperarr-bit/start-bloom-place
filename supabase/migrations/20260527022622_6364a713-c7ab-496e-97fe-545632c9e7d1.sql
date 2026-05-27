
CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cutoff timestamptz;
  upper timestamptz;
  reset_at timestamptz;
  v_landing bigint;
  v_start_click bigint;
  v_tutorial_started bigint;
  v_tutorial_completed bigint;
  v_quicksignup bigint;
  v_signups bigint;
  v_trial_started bigint;
  v_activated bigint;
  v_paid bigint;
  by_source jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_tutorial_dropoff(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  cutoff timestamptz;
  upper timestamptz;
  reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper := COALESCE(_to, now());

  WITH all_modules AS (
    SELECT unnest(ARRAY['financas','rotina','dieta','treino']) AS module_id
  ),
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
      COALESCE(event_data->>'label','') AS label,
      session_id, user_id
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
$function$;
