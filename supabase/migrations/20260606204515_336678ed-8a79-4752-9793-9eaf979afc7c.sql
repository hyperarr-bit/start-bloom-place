
CREATE OR REPLACE FUNCTION public.admin_top_tabs(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(module_id text, tab_id text, sessions bigint, unique_users bigint, total_seconds bigint, last_used timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cutoff timestamptz;
  upper timestamptz;
  reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper := COALESCE(_to, now());

  RETURN QUERY
  SELECT
    m.module_id::text,
    COALESCE(m.tab_id, '(sem aba)')::text,
    COUNT(*)::bigint,
    COUNT(DISTINCT m.user_id)::bigint,
    COALESCE(SUM(m.duration_seconds),0)::bigint,
    MAX(m.entered_at)
  FROM public.module_analytics m
  WHERE m.entered_at >= cutoff AND m.entered_at <= upper
    AND NOT public.is_test_user(m.user_id)
  GROUP BY m.module_id, m.tab_id
  ORDER BY total_seconds DESC
  LIMIT 50;
END; $$;
