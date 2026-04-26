CREATE OR REPLACE FUNCTION public.admin_winback_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  ANNUAL_PRICE constant numeric := 47.76;

  FUNCTION_BODY_PLACEHOLDER int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT * FROM public.winback_attempts
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE triggered_at IS NOT NULL)::bigint AS triggered,
      COUNT(*) FILTER (WHERE wheel_spun_at IS NOT NULL)::bigint AS wheel_spun,
      COUNT(*) FILTER (WHERE offer_shown_at IS NOT NULL)::bigint AS offer_shown,
      COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::bigint AS accepted,
      COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::bigint AS converted,
      COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL)::bigint AS dismissed
    FROM base
  ),
  agg_30 AS (
    SELECT
      COUNT(*) FILTER (WHERE triggered_at  > now() - interval '30 days')::bigint AS triggered,
      COUNT(*) FILTER (WHERE wheel_spun_at > now() - interval '30 days')::bigint AS wheel_spun,
      COUNT(*) FILTER (WHERE offer_shown_at > now() - interval '30 days')::bigint AS offer_shown,
      COUNT(*) FILTER (WHERE accepted_at   > now() - interval '30 days')::bigint AS accepted,
      COUNT(*) FILTER (WHERE converted_at  > now() - interval '30 days')::bigint AS converted,
      COUNT(*) FILTER (WHERE dismissed_at  > now() - interval '30 days')::bigint AS dismissed
    FROM base
  ),
  agg_7 AS (
    SELECT
      COUNT(*) FILTER (WHERE triggered_at  > now() - interval '7 days')::bigint AS triggered,
      COUNT(*) FILTER (WHERE wheel_spun_at > now() - interval '7 days')::bigint AS wheel_spun,
      COUNT(*) FILTER (WHERE offer_shown_at > now() - interval '7 days')::bigint AS offer_shown,
      COUNT(*) FILTER (WHERE accepted_at   > now() - interval '7 days')::bigint AS accepted,
      COUNT(*) FILTER (WHERE converted_at  > now() - interval '7 days')::bigint AS converted,
      COUNT(*) FILTER (WHERE dismissed_at  > now() - interval '7 days')::bigint AS dismissed
    FROM base
  ),
  by_day AS (
    SELECT jsonb_agg(jsonb_build_object(
      'date', d::date,
      'triggered', COALESCE(t.triggered, 0),
      'converted', COALESCE(t.converted, 0)
    ) ORDER BY d) AS series
    FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
    LEFT JOIN (
      SELECT
        date_trunc('day', triggered_at)::date AS day,
        COUNT(*) FILTER (WHERE triggered_at IS NOT NULL)::bigint AS triggered,
        COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::bigint AS converted
      FROM base
      WHERE triggered_at > now() - interval '30 days'
      GROUP BY 1
    ) t ON t.day = d::date
  )
  SELECT jsonb_build_object(
    'all_time', jsonb_build_object(
      'triggered', a.triggered,
      'wheel_spun', a.wheel_spun,
      'offer_shown', a.offer_shown,
      'accepted', a.accepted,
      'converted', a.converted,
      'dismissed', a.dismissed,
      'spin_rate_pct',         CASE WHEN a.triggered > 0   THEN ROUND((a.wheel_spun::numeric  / a.triggered) * 100, 2) ELSE 0 END,
      'offer_view_rate_pct',   CASE WHEN a.wheel_spun > 0  THEN ROUND((a.offer_shown::numeric / a.wheel_spun) * 100, 2) ELSE 0 END,
      'accept_rate_pct',       CASE WHEN a.offer_shown > 0 THEN ROUND((a.accepted::numeric    / a.offer_shown) * 100, 2) ELSE 0 END,
      'conversion_rate_pct',   CASE WHEN a.offer_shown > 0 THEN ROUND((a.converted::numeric   / a.offer_shown) * 100, 2) ELSE 0 END,
      'global_conversion_pct', CASE WHEN a.triggered > 0   THEN ROUND((a.converted::numeric   / a.triggered) * 100, 2) ELSE 0 END,
      'revenue_recovered_brl', ROUND(a.converted * ANNUAL_PRICE, 2)
    ),
    'last_30d', jsonb_build_object(
      'triggered', a30.triggered,
      'wheel_spun', a30.wheel_spun,
      'offer_shown', a30.offer_shown,
      'accepted', a30.accepted,
      'converted', a30.converted,
      'dismissed', a30.dismissed,
      'conversion_rate_pct',   CASE WHEN a30.offer_shown > 0 THEN ROUND((a30.converted::numeric / a30.offer_shown) * 100, 2) ELSE 0 END,
      'global_conversion_pct', CASE WHEN a30.triggered > 0   THEN ROUND((a30.converted::numeric / a30.triggered) * 100, 2) ELSE 0 END,
      'revenue_recovered_brl', ROUND(a30.converted * ANNUAL_PRICE, 2)
    ),
    'last_7d', jsonb_build_object(
      'triggered', a7.triggered,
      'wheel_spun', a7.wheel_spun,
      'offer_shown', a7.offer_shown,
      'accepted', a7.accepted,
      'converted', a7.converted,
      'dismissed', a7.dismissed,
      'conversion_rate_pct',   CASE WHEN a7.offer_shown > 0 THEN ROUND((a7.converted::numeric / a7.offer_shown) * 100, 2) ELSE 0 END,
      'revenue_recovered_brl', ROUND(a7.converted * ANNUAL_PRICE, 2)
    ),
    'by_day', COALESCE(bd.series, '[]'::jsonb),
    'annual_price_brl', ANNUAL_PRICE,
    'monthly_equiv_brl', 3.98,
    'generated_at', now()
  ) INTO result
  FROM agg a, agg_30 a30, agg_7 a7, by_day bd;

  RETURN result;
END;
$$;