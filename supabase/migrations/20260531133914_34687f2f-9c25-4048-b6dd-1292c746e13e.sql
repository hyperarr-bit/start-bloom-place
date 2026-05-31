
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
  v_start_click bigint;
  v_module_chosen bigint;
  v_signup bigint;
  modules jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper := COALESCE(_to, now());

  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_landing
  FROM public.analytics_events
  WHERE event_name = 'landing_view' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_start_click
  FROM public.analytics_events
  WHERE event_name = 'start_clicked' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_module_chosen
  FROM public.analytics_events
  WHERE event_name = 'quickstart_module_chosen' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(*) INTO v_signup
  FROM auth.users
  WHERE created_at >= cutoff AND created_at <= upper;

  SELECT jsonb_agg(jsonb_build_object('module', module, 'reached', reached) ORDER BY module)
  INTO modules
  FROM (
    SELECT COALESCE(event_data->>'module','') AS module,
           COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS reached
    FROM public.analytics_events
    WHERE event_name = 'quickstart_module_chosen' AND created_at >= cutoff AND created_at <= upper
      AND COALESCE(event_data->>'module','') <> ''
    GROUP BY 1
  ) t;

  result := jsonb_build_object(
    'from', _from, 'to', _to, 'cutoff', cutoff, 'upper', upper,
    'slides', jsonb_build_array(
      jsonb_build_object('key', 'landing',        'label', 'Slide 1 — Landing (Organize sua vida em 1 só lugar)', 'reached', v_landing),
      jsonb_build_object('key', 'module_choice',  'label', 'Slide 2 — Por onde você quer começar?',               'reached', v_start_click),
      jsonb_build_object('key', 'module_chosen',  'label', 'Slide 3 — Módulo escolhido',                          'reached', v_module_chosen),
      jsonb_build_object('key', 'signup',         'label', 'Cadastro concluído',                                  'reached', v_signup)
    ),
    'modules', COALESCE(modules, '[]'::jsonb),
    'generated_at', now()
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pre_signup_funnel(timestamptz, timestamptz) TO authenticated;
