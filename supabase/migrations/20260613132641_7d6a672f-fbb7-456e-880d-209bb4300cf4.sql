
-- Restore original
CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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

-- New dedicated LP funnel
CREATE OR REPLACE FUNCTION public.admin_lp_funnel(_from timestamptz DEFAULT (now() - interval '30 days'), _to timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ev AS (
    SELECT event_name, event_data, session_id, user_id, created_at
    FROM public.analytics_events
    WHERE created_at >= _from AND created_at < _to
      AND (user_id IS NULL OR NOT public.is_test_user(user_id))
  ),
  sess AS (
    SELECT
      session_id,
      bool_or(event_name = 'landing_view') AS had_view,
      bool_or(event_name = 'landing_cta_click') AS had_cta,
      bool_or(event_name = 'pre_signup_tutorial_started') AS had_tut_start,
      bool_or(event_name = 'pre_signup_tutorial_completed') AS had_tut_complete,
      bool_or(event_name = 'quickstart_module_chosen') AS had_module_chosen,
      bool_or(event_name = 'quickstart_completed') AS had_qs_completed,
      bool_or(event_name = 'quicksignup_step_shown') AS had_qsignup_shown,
      bool_or(event_name = 'quicksignup_completed') AS had_qsignup,
      bool_or(event_name = 'signup_completed') AS had_signup,
      bool_or(event_name = 'trial_started') AS had_trial
    FROM ev
    WHERE session_id IS NOT NULL
    GROUP BY session_id
  ),
  cta_breakdown AS (
    SELECT
      COALESCE(event_data->>'cta','(sem cta)') AS cta,
      COUNT(*) AS clicks,
      COUNT(DISTINCT session_id) AS sessions
    FROM ev
    WHERE event_name = 'landing_cta_click'
    GROUP BY 1
    ORDER BY 2 DESC
  ),
  module_breakdown AS (
    SELECT
      COALESCE(event_data->>'module','(sem módulo)') AS module,
      COUNT(*) AS chosen,
      COUNT(DISTINCT COALESCE(user_id::text, session_id)) AS unique_users
    FROM ev
    WHERE event_name = 'quickstart_module_chosen'
    GROUP BY 1
    ORDER BY 2 DESC
  ),
  tutorial_steps AS (
    SELECT
      COALESCE((event_data->>'step')::int, 0) AS step,
      COALESCE(event_data->>'slide','') AS slide,
      COUNT(DISTINCT session_id) AS sessions
    FROM ev
    WHERE event_name = 'pre_signup_tutorial_step'
    GROUP BY 1, 2
    ORDER BY 1
  ),
  source_breakdown AS (
    SELECT
      COALESCE(NULLIF(event_data->>'utm_source',''),'direto') AS source,
      COUNT(DISTINCT session_id) AS visits
    FROM ev
    WHERE event_name = 'landing_view'
    GROUP BY 1
    ORDER BY 2 DESC
  ),
  daily AS (
    SELECT
      date_trunc('day', created_at)::date AS day,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'landing_view') AS visits,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'landing_cta_click') AS cta_clicks,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'signup_completed' OR event_name = 'quicksignup_completed') AS signups,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'trial_started') AS trials
    FROM ev
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to),
    'totals', jsonb_build_object(
      'visits',         (SELECT COUNT(*) FILTER (WHERE had_view) FROM sess),
      'cta_clicks',     (SELECT COUNT(*) FILTER (WHERE had_cta) FROM sess),
      'tutorial_start', (SELECT COUNT(*) FILTER (WHERE had_tut_start) FROM sess),
      'tutorial_complete',(SELECT COUNT(*) FILTER (WHERE had_tut_complete) FROM sess),
      'module_chosen',  (SELECT COUNT(*) FILTER (WHERE had_module_chosen) FROM sess),
      'qs_completed',   (SELECT COUNT(*) FILTER (WHERE had_qs_completed) FROM sess),
      'qsignup_shown',  (SELECT COUNT(*) FILTER (WHERE had_qsignup_shown) FROM sess),
      'quicksignup',    (SELECT COUNT(*) FILTER (WHERE had_qsignup) FROM sess),
      'signups',        (SELECT COUNT(*) FILTER (WHERE had_signup OR had_qsignup) FROM sess),
      'trials',         (SELECT COUNT(*) FILTER (WHERE had_trial) FROM sess),
      'raw_landing_views', (SELECT COUNT(*) FROM ev WHERE event_name = 'landing_view'),
      'raw_cta_clicks',    (SELECT COUNT(*) FROM ev WHERE event_name = 'landing_cta_click')
    ),
    'cta_breakdown',    COALESCE((SELECT jsonb_agg(to_jsonb(cta_breakdown))    FROM cta_breakdown), '[]'::jsonb),
    'module_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(module_breakdown)) FROM module_breakdown), '[]'::jsonb),
    'tutorial_steps',   COALESCE((SELECT jsonb_agg(to_jsonb(tutorial_steps))   FROM tutorial_steps), '[]'::jsonb),
    'source_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(source_breakdown)) FROM source_breakdown), '[]'::jsonb),
    'daily',            COALESCE((SELECT jsonb_agg(to_jsonb(daily))            FROM daily), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_lp_funnel(timestamptz, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_lp_funnel(timestamptz, timestamptz) FROM anon;
