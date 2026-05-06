-- Save the tutorial cutoff moment (now) so we can compare cohorts before/after the new tutorial
INSERT INTO public.app_config (key, value)
VALUES ('tutorial_cutoff', jsonb_build_object('cutoff', now()))
ON CONFLICT (key) DO NOTHING;

-- Function: compare user cohorts (before vs after cutoff) on confirmation + module usage
CREATE OR REPLACE FUNCTION public.admin_tutorial_compare(_cutoff timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  effective_cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  effective_cutoff := COALESCE(
    _cutoff,
    (SELECT (value->>'cutoff')::timestamptz FROM public.app_config WHERE key = 'tutorial_cutoff'),
    now()
  );

  WITH cohorts AS (
    SELECT u.id, u.email_confirmed_at,
      CASE WHEN u.created_at < effective_cutoff THEN 'before' ELSE 'after' END AS cohort
    FROM auth.users u
    WHERE NOT public.is_test_user(u.id)
  ),
  totals AS (
    SELECT
      cohort,
      COUNT(*)::bigint AS total_signups,
      COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL)::bigint AS confirmed
    FROM cohorts
    GROUP BY cohort
  ),
  usage AS (
    SELECT
      c.cohort,
      COUNT(DISTINCT m.user_id)::bigint AS users_with_use,
      COALESCE(SUM(m.duration_seconds), 0)::bigint AS total_seconds,
      COUNT(*)::bigint AS sessions
    FROM cohorts c
    LEFT JOIN public.module_analytics m ON m.user_id = c.id
    GROUP BY c.cohort
  ),
  per_mod AS (
    SELECT c.cohort, m.module_id,
      COUNT(DISTINCT m.user_id)::bigint AS users,
      SUM(m.duration_seconds)::bigint AS total_seconds
    FROM cohorts c
    JOIN public.module_analytics m ON m.user_id = c.id
    GROUP BY c.cohort, m.module_id
  ),
  mod_before AS (
    SELECT jsonb_agg(jsonb_build_object('module_id', module_id, 'users', users, 'total_seconds', total_seconds) ORDER BY total_seconds DESC) AS arr
    FROM per_mod WHERE cohort = 'before'
  ),
  mod_after AS (
    SELECT jsonb_agg(jsonb_build_object('module_id', module_id, 'users', users, 'total_seconds', total_seconds) ORDER BY total_seconds DESC) AS arr
    FROM per_mod WHERE cohort = 'after'
  )
  SELECT jsonb_build_object(
    'cutoff', effective_cutoff,
    'before', jsonb_build_object(
      'total_signups', COALESCE((SELECT total_signups FROM totals WHERE cohort='before'), 0),
      'confirmed',     COALESCE((SELECT confirmed     FROM totals WHERE cohort='before'), 0),
      'users_with_use',COALESCE((SELECT users_with_use FROM usage WHERE cohort='before'), 0),
      'total_seconds', COALESCE((SELECT total_seconds FROM usage WHERE cohort='before'), 0),
      'sessions',      COALESCE((SELECT sessions      FROM usage WHERE cohort='before'), 0),
      'modules', COALESCE((SELECT arr FROM mod_before), '[]'::jsonb)
    ),
    'after', jsonb_build_object(
      'total_signups', COALESCE((SELECT total_signups FROM totals WHERE cohort='after'), 0),
      'confirmed',     COALESCE((SELECT confirmed     FROM totals WHERE cohort='after'), 0),
      'users_with_use',COALESCE((SELECT users_with_use FROM usage WHERE cohort='after'), 0),
      'total_seconds', COALESCE((SELECT total_seconds FROM usage WHERE cohort='after'), 0),
      'sessions',      COALESCE((SELECT sessions      FROM usage WHERE cohort='after'), 0),
      'modules', COALESCE((SELECT arr FROM mod_after), '[]'::jsonb)
    ),
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;