CREATE OR REPLACE FUNCTION public.admin_landing_funnel(_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb; cutoff timestamptz; upper timestamptz; reset_at timestamptz;
  v_landing bigint; v_start_click bigint; v_tutorial_started bigint; v_tutorial_completed bigint;
  v_quicksignup bigint; v_signups bigint; v_trial_started bigint; v_activated bigint; v_paid bigint;
  by_source jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  reset_at := GREATEST(
    public.admin_card_reset_at('funnel'),
    COALESCE((SELECT (value->>'at')::timestamptz FROM public.app_config WHERE key = 'analytics_reset_at'), 'epoch'::timestamptz)
  );
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), reset_at);
  upper := COALESCE(_to, now());

  SELECT COUNT(DISTINCT session_id) INTO v_landing
  FROM public.analytics_events
  WHERE event_name = 'landing_view' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT session_id) INTO v_start_click
  FROM public.analytics_events
  WHERE event_name IN ('landing_cta_click', 'start_clicked') AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_started
  FROM public.analytics_events
  WHERE event_name = 'pre_signup_tutorial_started' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT session_id) INTO v_tutorial_completed
  FROM public.analytics_events
  WHERE event_name = 'pre_signup_tutorial_completed' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) INTO v_quicksignup
  FROM public.analytics_events
  WHERE event_name = 'quicksignup_completed' AND created_at >= cutoff AND created_at <= upper;

  SELECT COUNT(*) INTO v_signups
  FROM auth.users u
  WHERE u.created_at >= cutoff AND u.created_at <= upper AND NOT public.is_test_user(u.id);

  SELECT COUNT(DISTINCT user_id) INTO v_trial_started
  FROM public.analytics_events
  WHERE event_name = 'trial_started' AND created_at >= cutoff AND created_at <= upper AND (user_id IS NULL OR NOT public.is_test_user(user_id));

  SELECT COUNT(DISTINCT user_id) INTO v_activated
  FROM public.module_analytics
  WHERE entered_at >= cutoff AND entered_at <= upper AND NOT public.is_test_user(user_id);

  SELECT COUNT(*) INTO v_paid
  FROM public.subscriptions
  WHERE status = 'active' AND created_at >= cutoff AND created_at <= upper AND NOT public.is_test_user(user_id);

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