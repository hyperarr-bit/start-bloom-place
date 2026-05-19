CREATE OR REPLACE FUNCTION public.admin_tutorial_dropoff(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  cutoff timestamptz := now() - make_interval(days => _days);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH starts AS (
    SELECT
      COALESCE(event_data->>'module','') AS module_id,
      session_id,
      user_id
    FROM public.analytics_events
    WHERE event_name IN ('spotlight_shown','spotlight_started')
      AND created_at >= cutoff
  ),
  starts_agg AS (
    SELECT module_id,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS started
    FROM starts
    WHERE module_id <> ''
    GROUP BY module_id
  ),
  steps AS (
    SELECT
      COALESCE(event_data->>'module','') AS module_id,
      (event_data->>'step')::int AS step_idx,
      (event_data->>'total')::int AS total,
      COALESCE(event_data->>'label','') AS label,
      session_id,
      user_id
    FROM public.analytics_events
    WHERE event_name = 'spotlight_step_view'
      AND created_at >= cutoff
      AND event_data ? 'step'
      AND event_data ? 'module'
  ),
  steps_agg AS (
    SELECT module_id, step_idx,
      MAX(total) AS total,
      MAX(label) AS label,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS reached
    FROM steps
    GROUP BY module_id, step_idx
  ),
  completes AS (
    SELECT
      COALESCE(event_data->>'module','') AS module_id,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS completed
    FROM public.analytics_events
    WHERE event_name = 'quickstart_completed'
      AND created_at >= cutoff
    GROUP BY 1
  ),
  by_module AS (
    SELECT
      m.module_id,
      COALESCE(sa.started, 0) AS started,
      COALESCE(c.completed, 0) AS completed,
      jsonb_agg(
        jsonb_build_object(
          'step', s.step_idx,
          'label', s.label,
          'total', s.total,
          'reached', s.reached
        ) ORDER BY s.step_idx
      ) FILTER (WHERE s.step_idx IS NOT NULL) AS steps
    FROM (SELECT DISTINCT module_id FROM steps_agg WHERE module_id <> '') m
    LEFT JOIN starts_agg sa USING (module_id)
    LEFT JOIN completes c USING (module_id)
    LEFT JOIN steps_agg s ON s.module_id = m.module_id
    GROUP BY m.module_id, sa.started, c.completed
  )
  SELECT jsonb_build_object(
    'days', _days,
    'modules', COALESCE(jsonb_agg(
      jsonb_build_object(
        'module_id', module_id,
        'started', started,
        'completed', completed,
        'steps', COALESCE(steps, '[]'::jsonb)
      ) ORDER BY module_id
    ), '[]'::jsonb),
    'generated_at', now()
  ) INTO result
  FROM by_module;

  RETURN result;
END;
$$;