CREATE OR REPLACE FUNCTION public.admin_welcome_dropoff(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(
  step int,
  views bigint,
  exits bigint,
  backs bigint,
  unique_users bigint,
  dropoff_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT
      (event_data->>'step')::int AS step,
      event_name,
      COALESCE(user_id::text, session_id) AS who
    FROM public.analytics_events
    WHERE event_name IN ('onboarding_step_view','onboarding_step_exit','onboarding_step_back')
      AND (_from IS NULL OR created_at >= _from)
      AND (_to IS NULL OR created_at <= _to)
      AND (event_data->>'step') IS NOT NULL
  )
  SELECT
    step,
    COUNT(*) FILTER (WHERE event_name='onboarding_step_view')::bigint AS views,
    COUNT(*) FILTER (WHERE event_name='onboarding_step_exit')::bigint AS exits,
    COUNT(*) FILTER (WHERE event_name='onboarding_step_back')::bigint AS backs,
    COUNT(DISTINCT who) FILTER (WHERE event_name='onboarding_step_view')::bigint AS unique_users,
    CASE WHEN COUNT(*) FILTER (WHERE event_name='onboarding_step_view') > 0
      THEN ROUND(100.0 * COUNT(*) FILTER (WHERE event_name='onboarding_step_exit')::numeric
        / COUNT(*) FILTER (WHERE event_name='onboarding_step_view'), 1)
      ELSE 0 END AS dropoff_pct
  FROM ev
  WHERE step IS NOT NULL
  GROUP BY step
  ORDER BY step;
$$;

REVOKE ALL ON FUNCTION public.admin_welcome_dropoff(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_welcome_dropoff(timestamptz, timestamptz) TO authenticated;