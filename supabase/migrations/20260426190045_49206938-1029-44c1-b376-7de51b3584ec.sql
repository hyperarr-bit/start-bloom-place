
-- 1) Pause trial emails by default (infra preserved)
INSERT INTO public.app_config (key, value)
VALUES ('trial_emails_enabled', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();

-- 2) RPC: nudge stats per trial_day + nudge_key
CREATE OR REPLACE FUNCTION public.admin_nudge_stats()
RETURNS TABLE(
  trial_day integer,
  nudge_key text,
  shown bigint,
  clicked bigint,
  dismissed bigint,
  completed bigint,
  conversions_48h bigint,
  ctr_pct numeric,
  completion_pct numeric,
  conversion_pct numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  ),
  agg AS (
    SELECT
      s.trial_day,
      s.nudge_key,
      COUNT(*)::bigint AS shown,
      (SELECT COUNT(*) FROM public.analytics_events e2
        WHERE e2.event_name = 'daily_nudge_clicked'
          AND (e2.event_data->>'nudge_key') = s.nudge_key
          AND e2.trial_day = s.trial_day)::bigint AS clicked,
      (SELECT COUNT(*) FROM public.analytics_events e2
        WHERE e2.event_name = 'daily_nudge_dismissed'
          AND (e2.event_data->>'nudge_key') = s.nudge_key
          AND e2.trial_day = s.trial_day)::bigint AS dismissed,
      (SELECT COUNT(DISTINCT e2.user_id) FROM public.analytics_events e2
        WHERE e2.event_name = 'onboarding_step_completed'
          AND (e2.event_data->>'nudge_key') = s.nudge_key
          AND e2.trial_day = s.trial_day)::bigint AS completed,
      (SELECT COUNT(DISTINCT sub.user_id)
         FROM public.subscriptions sub
         JOIN shows sh ON sh.user_id = sub.user_id
        WHERE sub.status = 'active'
          AND sh.nudge_key = s.nudge_key
          AND sh.trial_day = s.trial_day
          AND sub.created_at BETWEEN sh.created_at AND sh.created_at + interval '48 hours')::bigint AS conversions_48h
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
$$;
