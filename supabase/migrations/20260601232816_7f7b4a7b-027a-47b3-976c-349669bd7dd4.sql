
-- ============================================================
-- admin_paying_users: 1 row per paying subscriber
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_paying_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  plan text,
  billing_period text,
  status text,
  payment_method text,
  subscribed_at timestamptz,
  current_period_end timestamptz,
  signup_at timestamptz,
  days_trial_to_paid int,
  trial_days_active int,
  total_sessions bigint,
  total_seconds_in_app bigint,
  top_module text,
  tabs_visited_count int,
  cards_filled_count int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH paying AS (
    SELECT DISTINCT ON (s.user_id)
      s.user_id, s.plan, s.billing_period, s.status, s.payment_method,
      s.created_at AS subscribed_at, s.current_period_end
    FROM public.subscriptions s
    WHERE s.status IN ('active','canceled','past_due')
    ORDER BY s.user_id, s.created_at DESC
  ),
  ma_agg AS (
    SELECT
      m.user_id,
      COUNT(*) AS total_sessions,
      COALESCE(SUM(m.duration_seconds),0) AS total_seconds_in_app,
      COUNT(DISTINCT DATE(m.entered_at)) FILTER (WHERE m.duration_seconds >= 30) AS trial_days_active,
      COUNT(DISTINCT m.tab_id) AS tabs_visited_count
    FROM public.module_analytics m
    GROUP BY m.user_id
  ),
  top_mod AS (
    SELECT DISTINCT ON (m.user_id)
      m.user_id, m.module_id AS top_module
    FROM public.module_analytics m
    GROUP BY m.user_id, m.module_id
    ORDER BY m.user_id, SUM(m.duration_seconds) DESC
  ),
  act_agg AS (
    SELECT a.user_id, COUNT(*)::int AS cards_filled_count
    FROM public.user_activations a
    GROUP BY a.user_id
  )
  SELECT
    p.user_id,
    u.email::text,
    p.plan,
    p.billing_period,
    p.status,
    p.payment_method,
    p.subscribed_at,
    p.current_period_end,
    u.created_at AS signup_at,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (p.subscribed_at - u.created_at))/86400)::int) AS days_trial_to_paid,
    COALESCE(ma.trial_days_active, 0)::int,
    COALESCE(ma.total_sessions, 0)::bigint,
    COALESCE(ma.total_seconds_in_app, 0)::bigint,
    tm.top_module,
    COALESCE(ma.tabs_visited_count, 0)::int,
    COALESCE(ac.cards_filled_count, 0)::int
  FROM paying p
  JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN ma_agg ma ON ma.user_id = p.user_id
  LEFT JOIN top_mod tm ON tm.user_id = p.user_id
  LEFT JOIN act_agg ac ON ac.user_id = p.user_id
  ORDER BY p.subscribed_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_paying_users() TO authenticated;

-- ============================================================
-- admin_paying_user_funnel: full funnel for 1 paying user
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_paying_user_funnel(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_signup_at timestamptz;
  v_email text;
  v_sub record;
  v_first_session timestamptz;
  v_first_real_session timestamptz; -- > 30s
  v_d2 timestamptz;
  v_d3 timestamptz;
  v_d7 timestamptz;
  v_first_card timestamptz;
  v_activation_complete timestamptz; -- 3+ activations
  v_checkout timestamptz;
  v_steps jsonb;
  v_tabs jsonb;
  v_cards jsonb;
  v_timeline jsonb;
  v_total_sessions bigint;
  v_total_seconds bigint;
  v_top_module text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT email::text, created_at INTO v_email, v_signup_at FROM auth.users WHERE id = _user_id;
  IF v_signup_at IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  SELECT plan, billing_period, status, payment_method, created_at AS subscribed_at,
         current_period_end
    INTO v_sub
    FROM public.subscriptions
    WHERE user_id = _user_id AND status IN ('active','canceled','past_due')
    ORDER BY created_at DESC LIMIT 1;

  SELECT MIN(entered_at) INTO v_first_session
    FROM public.module_analytics WHERE user_id = _user_id;

  SELECT MIN(entered_at) INTO v_first_real_session
    FROM public.module_analytics WHERE user_id = _user_id AND duration_seconds >= 30;

  SELECT MIN(entered_at) INTO v_d2 FROM public.module_analytics
    WHERE user_id = _user_id AND entered_at >= v_signup_at + interval '1 day';
  SELECT MIN(entered_at) INTO v_d3 FROM public.module_analytics
    WHERE user_id = _user_id AND entered_at >= v_signup_at + interval '2 days';
  SELECT MIN(entered_at) INTO v_d7 FROM public.module_analytics
    WHERE user_id = _user_id AND entered_at >= v_signup_at + interval '6 days';

  SELECT MIN(completed_at) INTO v_first_card FROM public.user_activations WHERE user_id = _user_id;
  SELECT completed_at INTO v_activation_complete FROM (
    SELECT completed_at, ROW_NUMBER() OVER (ORDER BY completed_at) AS rn
    FROM public.user_activations WHERE user_id = _user_id
  ) x WHERE rn = 3;

  SELECT MIN(created_at) INTO v_checkout FROM public.analytics_events
    WHERE user_id = _user_id AND event_name IN ('checkout_started','checkout_opened','paywall_checkout_click');

  SELECT COUNT(*), COALESCE(SUM(duration_seconds),0)
    INTO v_total_sessions, v_total_seconds
    FROM public.module_analytics WHERE user_id = _user_id;

  SELECT module_id INTO v_top_module FROM public.module_analytics
    WHERE user_id = _user_id
    GROUP BY module_id ORDER BY SUM(duration_seconds) DESC LIMIT 1;

  v_steps := jsonb_build_array(
    jsonb_build_object('key','signup',     'label','Cadastrou',                    'at', v_signup_at,            'reached', true),
    jsonb_build_object('key','opened',     'label','Abriu o app',                  'at', v_first_session,        'reached', v_first_session IS NOT NULL),
    jsonb_build_object('key','used_trial', 'label','Usou trial (sessão > 30s)',    'at', v_first_real_session,   'reached', v_first_real_session IS NOT NULL),
    jsonb_build_object('key','d2',         'label','Voltou no D2',                 'at', v_d2,                   'reached', v_d2 IS NOT NULL),
    jsonb_build_object('key','d3',         'label','Voltou no D3',                 'at', v_d3,                   'reached', v_d3 IS NOT NULL),
    jsonb_build_object('key','d7',         'label','Voltou no D7',                 'at', v_d7,                   'reached', v_d7 IS NOT NULL),
    jsonb_build_object('key','first_card', 'label','Preencheu primeiro card',      'at', v_first_card,           'reached', v_first_card IS NOT NULL),
    jsonb_build_object('key','activated',  'label','Activation (3+ ativações)',    'at', v_activation_complete,  'reached', v_activation_complete IS NOT NULL),
    jsonb_build_object('key','checkout',   'label','Iniciou checkout',             'at', v_checkout,             'reached', v_checkout IS NOT NULL),
    jsonb_build_object('key','paid',       'label','Pagou',                        'at', v_sub.subscribed_at,    'reached', v_sub.subscribed_at IS NOT NULL)
  );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'module_id', module_id,
    'tab_id', COALESCE(tab_id,'(sem aba)'),
    'seconds', secs,
    'visits', visits
  ) ORDER BY secs DESC), '[]'::jsonb)
  INTO v_tabs
  FROM (
    SELECT module_id, tab_id, SUM(duration_seconds) AS secs, COUNT(*) AS visits
    FROM public.module_analytics
    WHERE user_id = _user_id
    GROUP BY module_id, tab_id
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action_key', action_key, 'completed_at', completed_at
  ) ORDER BY completed_at), '[]'::jsonb)
  INTO v_cards
  FROM public.user_activations WHERE user_id = _user_id;

  WITH ma AS (
    SELECT
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (entered_at - v_signup_at)) / 86400)::int) AS day,
      tab_id, module_id, duration_seconds
    FROM public.module_analytics WHERE user_id = _user_id
  ),
  ma_day AS (
    SELECT day, SUM(duration_seconds)::bigint AS seconds,
      jsonb_agg(DISTINCT jsonb_build_object('tab', COALESCE(tab_id,'(sem aba)'), 'module', module_id)) AS tabs
    FROM ma GROUP BY day
  ),
  act AS (
    SELECT
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (completed_at - v_signup_at)) / 86400)::int) AS day,
      action_key
    FROM public.user_activations WHERE user_id = _user_id
  ),
  act_agg AS (
    SELECT day, jsonb_agg(action_key) AS activations FROM act GROUP BY day
  ),
  all_days AS (
    SELECT generate_series(0, 7) AS day
  )
  SELECT jsonb_agg(jsonb_build_object(
    'day', d.day,
    'seconds', COALESCE(md.seconds, 0),
    'tabs', COALESCE(md.tabs, '[]'::jsonb),
    'activations', COALESCE(act_agg.activations, '[]'::jsonb),
    'active', (COALESCE(md.seconds,0) > 0 OR act_agg.activations IS NOT NULL)
  ) ORDER BY d.day)
  INTO v_timeline
  FROM all_days d
  LEFT JOIN ma_day md USING (day)
  LEFT JOIN act_agg USING (day);

  result := jsonb_build_object(
    'user_id', _user_id,
    'email', v_email,
    'signup_at', v_signup_at,
    'subscription', jsonb_build_object(
      'plan', v_sub.plan,
      'billing_period', v_sub.billing_period,
      'status', v_sub.status,
      'payment_method', v_sub.payment_method,
      'subscribed_at', v_sub.subscribed_at,
      'current_period_end', v_sub.current_period_end
    ),
    'totals', jsonb_build_object(
      'total_sessions', v_total_sessions,
      'total_seconds', v_total_seconds,
      'top_module', v_top_module,
      'days_trial_to_paid', CASE WHEN v_sub.subscribed_at IS NULL THEN NULL
        ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_sub.subscribed_at - v_signup_at))/86400)::int) END
    ),
    'steps', v_steps,
    'tabs', v_tabs,
    'cards', v_cards,
    'timeline', v_timeline,
    'generated_at', now()
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_paying_user_funnel(uuid) TO authenticated;
