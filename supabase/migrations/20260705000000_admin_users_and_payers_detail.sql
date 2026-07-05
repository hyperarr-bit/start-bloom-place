-- Duas telas de detalhe pedidas pelo dono:
--   "Usuários"  — jornada individual de cada sessão do funil (e-mail, até
--                 onde foi, quando criou conta/pagou, quanto tempo levou).
--   "Pagantes"  — cada assinante individualmente (módulos que usa, 1º e
--                 último dia de atividade no app).

CREATE OR REPLACE FUNCTION public.admin_funnel_users(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to   timestamptz DEFAULT now(),
  _limit int DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ev AS (
    SELECT e.event_name, e.event_data, e.session_id, e.user_id, e.created_at
    FROM public.analytics_events e
    LEFT JOIN auth.users u ON u.id = e.user_id
    WHERE e.created_at >= _from AND e.created_at < _to
      AND e.session_id IS NOT NULL
      AND (e.user_id IS NULL OR NOT public.is_test_user(e.user_id))
      AND (u.email IS NULL OR lower(u.email) IS DISTINCT FROM lower(owner_email))
  ),
  step_order(step_key, ord, label) AS (
    VALUES
      ('start', 1, 'Abriu o funil'),
      ('quiz_1', 2, 'Quiz — pergunta 1'),
      ('quiz_2', 3, 'Quiz — pergunta 2'),
      ('quiz_3', 4, 'Quiz — pergunta 3'),
      ('progress', 5, 'Tela de preparação'),
      ('result', 6, 'Viu o resultado'),
      ('demo', 7, 'Abriu a demo'),
      ('signup', 8, 'Chegou no cadastro'),
      ('account', 9, 'Criou a conta'),
      ('offer', 10, 'Viu a oferta'),
      ('paid', 11, 'Assinou')
  ),
  ev_steps AS (
    SELECT session_id, user_id, created_at,
      CASE
        WHEN event_name = 'funnel_view' THEN event_data->>'step'
        WHEN event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success' THEN 'account'
        ELSE NULL
      END AS step_key
    FROM ev
  ),
  ev_steps_ord AS (
    SELECT es.session_id, es.user_id, es.created_at, so.ord, so.label
    FROM ev_steps es
    JOIN step_order so ON so.step_key = es.step_key
  ),
  session_first_user AS (
    SELECT DISTINCT ON (session_id) session_id, user_id
    FROM ev
    WHERE session_id IS NOT NULL AND user_id IS NOT NULL
    ORDER BY session_id, created_at ASC
  ),
  session_email AS (
    SELECT sfu.session_id, u.email
    FROM session_first_user sfu
    JOIN auth.users u ON u.id = sfu.user_id
  ),
  session_paid AS (
    SELECT sfu.session_id, MIN(pe.created_at) AS paid_at
    FROM session_first_user sfu
    JOIN public.analytics_events pe
      ON pe.user_id = sfu.user_id AND pe.event_name IN ('trial_converted', 'subscription_started')
    GROUP BY sfu.session_id
  ),
  session_utm AS (
    SELECT DISTINCT ON (session_id) session_id, NULLIF(event_data->>'utm_source', '') AS utm_source
    FROM ev
    WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start'
    ORDER BY session_id, created_at ASC
  ),
  session_journey AS (
    SELECT
      session_id,
      MIN(created_at) AS started_at,
      MAX(created_at) AS last_event_at,
      (array_agg(label ORDER BY ord DESC))[1] AS furthest_label,
      (array_agg(ord ORDER BY ord DESC))[1] AS furthest_ord,
      MAX(created_at) FILTER (WHERE ord = 9) AS account_created_at
    FROM ev_steps_ord
    GROUP BY session_id
  ),
  ranked AS (
    SELECT
      sj.session_id, sj.started_at, sj.last_event_at, sj.furthest_label, sj.furthest_ord,
      sj.account_created_at, sp.paid_at, se.email, su.utm_source
    FROM session_journey sj
    LEFT JOIN session_email se ON se.session_id = sj.session_id
    LEFT JOIN session_paid sp ON sp.session_id = sj.session_id
    LEFT JOIN session_utm su ON su.session_id = sj.session_id
    ORDER BY sj.started_at DESC
    LIMIT _limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', email,
    'furthest_step', furthest_label,
    'furthest_ord', furthest_ord,
    'started_at', started_at,
    'account_created_at', account_created_at,
    'paid_at', paid_at,
    'last_event_at', last_event_at,
    'utm_source', utm_source
  )), '[]'::jsonb) INTO result
  FROM ranked;

  RETURN jsonb_build_object('users', result);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_paying_users_detail()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH subs AS (
    SELECT s.*, COALESCE(NULLIF(s.customer_email, ''), u.email) AS email
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
  ),
  activity AS (
    SELECT user_id, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
    FROM public.analytics_events
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id
  ),
  modules AS (
    SELECT user_id, COALESCE(NULLIF(event_data->>'tab', ''), '(sem aba)') AS tab, COUNT(*) AS views
    FROM public.analytics_events
    WHERE event_name = 'finance_card_view' AND user_id IN (SELECT user_id FROM subs)
    GROUP BY 1, 2
  ),
  modules_agg AS (
    SELECT user_id, jsonb_agg(jsonb_build_object('tab', tab, 'views', views) ORDER BY views DESC) AS modules
    FROM modules GROUP BY user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', s.email,
    'plan', s.billing_period,
    'status', s.status,
    'subscribed_since', s.created_at,
    'current_period_end', s.current_period_end,
    'first_seen', a.first_seen,
    'last_seen', a.last_seen,
    'modules', COALESCE(ma.modules, '[]'::jsonb)
  ) ORDER BY s.created_at DESC), '[]'::jsonb) INTO result
  FROM subs s
  LEFT JOIN activity a ON a.user_id = s.user_id
  LEFT JOIN modules_agg ma ON ma.user_id = s.user_id;

  RETURN jsonb_build_object('users', result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_funnel_users(timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_paying_users_detail() TO authenticated;
