
CREATE OR REPLACE FUNCTION public.admin_finance_tab_usage(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(tab_id text, sessions bigint, unique_users bigint, total_seconds bigint, avg_seconds numeric, last_used timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    COALESCE(m.tab_id, '(sem aba)')::text AS tab_id,
    COUNT(*)::bigint AS sessions,
    COUNT(DISTINCT m.user_id)::bigint AS unique_users,
    COALESCE(SUM(m.duration_seconds), 0)::bigint AS total_seconds,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(m.duration_seconds)::numeric, 1) ELSE 0 END AS avg_seconds,
    MAX(m.entered_at) AS last_used
  FROM public.module_analytics m
  WHERE m.module_id = 'financas'
    AND m.entered_at >= cutoff AND m.entered_at <= upper
    AND NOT public.is_test_user(m.user_id)
  GROUP BY 1
  ORDER BY total_seconds DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_card_usage(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(card_key text, tab_id text, views bigint, interactions bigint, unique_users bigint, last_used timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    COALESCE(e.event_data->>'card', '(sem card)')::text AS card_key,
    COALESCE(e.event_data->>'tab', '')::text AS tab_id,
    COUNT(*) FILTER (WHERE e.event_name = 'finance_card_view')::bigint AS views,
    COUNT(*) FILTER (WHERE e.event_name = 'finance_card_interact')::bigint AS interactions,
    COUNT(DISTINCT COALESCE(e.user_id::text, e.session_id))::bigint AS unique_users,
    MAX(e.created_at) AS last_used
  FROM public.analytics_events e
  WHERE e.event_name IN ('finance_card_view','finance_card_interact')
    AND e.created_at >= cutoff AND e.created_at <= upper
    AND (e.user_id IS NULL OR NOT public.is_test_user(e.user_id))
  GROUP BY 1, 2
  ORDER BY interactions DESC, views DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_trial_journey(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result jsonb;
  signup_at timestamptz;
  sub_status text;
  last_active timestamptz;
  last_day int;
  first_inactive int;
  total_active int;
  days jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT created_at INTO signup_at FROM auth.users WHERE id = _user_id;
  IF signup_at IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  SELECT status INTO sub_status FROM public.subscriptions WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1;

  SELECT MAX(entered_at) INTO last_active FROM public.module_analytics WHERE user_id = _user_id;
  last_day := CASE WHEN last_active IS NULL THEN -1
    ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (last_active - signup_at)) / 86400)::int) END;

  WITH ma AS (
    SELECT
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (entered_at - signup_at)) / 86400)::int) AS day,
      tab_id, duration_seconds, entered_at
    FROM public.module_analytics
    WHERE user_id = _user_id AND module_id = 'financas'
  ),
  ma_day AS (
    SELECT day, SUM(duration_seconds)::bigint AS seconds,
      jsonb_agg(DISTINCT jsonb_build_object('tab', COALESCE(tab_id,'(sem aba)'))) AS tabs_raw
    FROM ma GROUP BY day
  ),
  ma_tab AS (
    SELECT day, COALESCE(tab_id,'(sem aba)') AS tab, SUM(duration_seconds)::bigint AS seconds
    FROM ma GROUP BY day, tab_id
  ),
  ma_tab_agg AS (
    SELECT day, jsonb_agg(jsonb_build_object('tab', tab, 'seconds', seconds) ORDER BY seconds DESC) AS tabs
    FROM ma_tab GROUP BY day
  ),
  ev AS (
    SELECT
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (created_at - signup_at)) / 86400)::int) AS day,
      COALESCE(event_data->>'card','?') AS card
    FROM public.analytics_events
    WHERE user_id = _user_id AND event_name = 'finance_card_interact'
  ),
  ev_agg AS (
    SELECT day, jsonb_agg(jsonb_build_object('card', card, 'count', cnt) ORDER BY cnt DESC) AS cards
    FROM (SELECT day, card, COUNT(*) AS cnt FROM ev GROUP BY day, card) s
    GROUP BY day
  ),
  act AS (
    SELECT
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (completed_at - signup_at)) / 86400)::int) AS day,
      action_key
    FROM public.user_activations WHERE user_id = _user_id
  ),
  act_agg AS (
    SELECT day, jsonb_agg(action_key) AS activations FROM act GROUP BY day
  ),
  all_days AS (
    SELECT generate_series(0, GREATEST(7, COALESCE(last_day, 0))) AS day
  )
  SELECT jsonb_agg(jsonb_build_object(
    'day', d.day,
    'seconds', COALESCE(md.seconds, 0),
    'tabs', COALESCE(mt.tabs, '[]'::jsonb),
    'cards', COALESCE(ev_agg.cards, '[]'::jsonb),
    'activations', COALESCE(act_agg.activations, '[]'::jsonb),
    'active', (COALESCE(md.seconds,0) > 0 OR act_agg.activations IS NOT NULL)
  ) ORDER BY d.day) INTO days
  FROM all_days d
  LEFT JOIN ma_day md USING (day)
  LEFT JOIN ma_tab_agg mt USING (day)
  LEFT JOIN ev_agg USING (day)
  LEFT JOIN act_agg USING (day);

  SELECT COUNT(*) INTO total_active
  FROM jsonb_array_elements(days) e WHERE (e->>'active')::boolean;

  SELECT MIN((e->>'day')::int) INTO first_inactive
  FROM jsonb_array_elements(days) e
  WHERE (e->>'day')::int > 0 AND (e->>'active')::boolean = false;

  result := jsonb_build_object(
    'user_id', _user_id,
    'signup_at', signup_at,
    'last_active_at', last_active,
    'last_active_day', last_day,
    'first_inactive_day', first_inactive,
    'total_days_active', total_active,
    'subscription_status', COALESCE(sub_status, 'none'),
    'days', COALESCE(days, '[]'::jsonb),
    'generated_at', now()
  );
  RETURN result;
END;
$$;
