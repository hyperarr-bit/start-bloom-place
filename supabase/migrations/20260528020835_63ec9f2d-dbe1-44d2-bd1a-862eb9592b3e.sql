
CREATE OR REPLACE FUNCTION public.admin_trials_started(_period text DEFAULT 'all')
RETURNS TABLE(user_id uuid, email text, started_at timestamptz, subscription_status text, days_since_start int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  cutoff := CASE _period
    WHEN 'today' THEN date_trunc('day', now())
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE 'epoch'::timestamptz
  END;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at,
    COALESCE(s.status, 'none')::text,
    EXTRACT(DAY FROM (now() - u.created_at))::int
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT status FROM public.subscriptions s2
    WHERE s2.user_id = u.id ORDER BY s2.created_at DESC LIMIT 1
  ) s ON true
  WHERE NOT public.is_test_user(u.id)
    AND u.created_at >= cutoff
  ORDER BY u.created_at DESC;
END; $$;
