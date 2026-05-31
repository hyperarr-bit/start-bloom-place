
DROP FUNCTION IF EXISTS public.admin_pre_signup_funnel(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.admin_pre_signup_funnel(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  cutoff timestamptz;
  upper timestamptz;
  reset_at timestamptz;
  v_landing bigint;
  v_start bigint;
  slides jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper := COALESCE(_to, now());

  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_landing
  FROM public.analytics_events
  WHERE event_name = 'landing_view' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_start
  FROM public.analytics_events
  WHERE event_name = 'start_clicked' AND created_at >= cutoff AND created_at <= upper;

  SELECT jsonb_agg(jsonb_build_object('step', step, 'reached', reached) ORDER BY step)
  INTO slides
  FROM (
    SELECT (event_data->>'step')::int AS step,
           COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS reached
    FROM public.analytics_events
    WHERE event_name = 'onboarding_step_view'
      AND created_at >= cutoff AND created_at <= upper
      AND event_data ? 'step'
    GROUP BY 1
  ) t;

  result := jsonb_build_object(
    'from', _from, 'to', _to, 'cutoff', cutoff, 'upper', upper,
    'landing', v_landing,
    'start_clicked', v_start,
    'slides', COALESCE(slides, '[]'::jsonb),
    'generated_at', now()
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pre_signup_funnel(timestamptz, timestamptz) TO authenticated;
