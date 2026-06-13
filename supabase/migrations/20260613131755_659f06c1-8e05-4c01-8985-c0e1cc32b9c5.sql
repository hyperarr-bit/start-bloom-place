
CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_from timestamptz DEFAULT (now() - interval '30 days'), _to timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  ),
  sessions_lv AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'landing_view' AND session_id IS NOT NULL
  ),
  sessions_cta AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'landing_cta_click' AND session_id IS NOT NULL
  ),
  sessions_signup AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'signup_completed' AND session_id IS NOT NULL
  ),
  sessions_qsignup AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'quicksignup_completed' AND session_id IS NOT NULL
  ),
  sessions_tut_start AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'pre_signup_tutorial_started' AND session_id IS NOT NULL
  ),
  sessions_module_chosen AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'quickstart_module_chosen' AND session_id IS NOT NULL
  ),
  sessions_qs_completed AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'quickstart_completed' AND session_id IS NOT NULL
  ),
  sessions_qs_all AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'quickstart_all_completed' AND session_id IS NOT NULL
  ),
  sessions_trial AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'trial_started' AND session_id IS NOT NULL
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
      COUNT(*) AS chosen
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
  spotlight_drop AS (
    SELECT
      COALESCE(event_data->>'module','?') AS module,
      COALESCE((event_data->>'step')::int, 0) AS step,
      COUNT(DISTINCT session_id) AS sessions
    FROM ev
    WHERE event_name = 'spotlight_step_view'
    GROUP BY 1, 2
    ORDER BY 1, 2
  ),
  daily AS (
    SELECT
      date_trunc('day', created_at)::date AS day,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'landing_view') AS visits,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'landing_cta_click') AS cta_clicks,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'signup_completed') AS signups,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'trial_started') AS trials
    FROM ev
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to),
    'totals', jsonb_build_object(
      'visits',         (SELECT COUNT(*) FROM sessions_lv),
      'cta_clicks',     (SELECT COUNT(*) FROM sessions_cta),
      'tutorial_start', (SELECT COUNT(*) FROM sessions_tut_start),
      'module_chosen',  (SELECT COUNT(*) FROM sessions_module_chosen),
      'qs_completed',   (SELECT COUNT(*) FROM sessions_qs_completed),
      'qs_all',         (SELECT COUNT(*) FROM sessions_qs_all),
      'quicksignup',    (SELECT COUNT(*) FROM sessions_qsignup),
      'signups',        (SELECT COUNT(*) FROM sessions_signup),
      'trials',         (SELECT COUNT(*) FROM sessions_trial),
      'raw_landing_views', (SELECT COUNT(*) FROM ev WHERE event_name = 'landing_view'),
      'raw_cta_clicks',    (SELECT COUNT(*) FROM ev WHERE event_name = 'landing_cta_click')
    ),
    'cta_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(cta_breakdown)) FROM cta_breakdown), '[]'::jsonb),
    'module_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(module_breakdown)) FROM module_breakdown), '[]'::jsonb),
    'tutorial_steps', COALESCE((SELECT jsonb_agg(to_jsonb(tutorial_steps)) FROM tutorial_steps), '[]'::jsonb),
    'spotlight_drop', COALESCE((SELECT jsonb_agg(to_jsonb(spotlight_drop)) FROM spotlight_drop), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(daily)) FROM daily), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_landing_funnel(timestamptz, timestamptz) TO authenticated;
