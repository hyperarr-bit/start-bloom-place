DROP FUNCTION IF EXISTS public.admin_reset_analytics();

CREATE OR REPLACE FUNCTION public.admin_reset_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ts timestamptz := now();
  n_events bigint;
  n_modules bigint;
  n_activations bigint;
  n_winback bigint;
  n_cancel bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH d AS (DELETE FROM public.analytics_events RETURNING 1)
    SELECT count(*) INTO n_events FROM d;
  WITH d AS (DELETE FROM public.module_analytics RETURNING 1)
    SELECT count(*) INTO n_modules FROM d;
  WITH d AS (DELETE FROM public.user_activations RETURNING 1)
    SELECT count(*) INTO n_activations FROM d;
  WITH d AS (DELETE FROM public.winback_attempts RETURNING 1)
    SELECT count(*) INTO n_winback FROM d;
  WITH d AS (DELETE FROM public.cancel_attempts RETURNING 1)
    SELECT count(*) INTO n_cancel FROM d;

  INSERT INTO public.app_config (key, value, updated_at)
  VALUES ('analytics_reset_at', jsonb_build_object('at', ts), ts)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'at', ts,
    'deleted', jsonb_build_object(
      'analytics_events', n_events,
      'module_analytics', n_modules,
      'user_activations', n_activations,
      'winback_attempts', n_winback,
      'cancel_attempts', n_cancel
    )
  );
END;
$function$;