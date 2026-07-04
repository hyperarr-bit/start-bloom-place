-- Fix: admin_subscribers_overview contava a conta interna do dono
-- (jv20101958@gmail.com, plano "lifetime") como assinante pagante real,
-- e o CASE de MRR tratava QUALQUER billing_period != 'annual' como mensal
-- (então "lifetime" entrava com R$14,90/mês, o que é falso — é pagamento
-- único/comped, contribuição recorrente real = R$0).

CREATE OR REPLACE FUNCTION public.admin_subscribers_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  price_monthly constant numeric := 14.90;
  price_annual_monthly_equiv constant numeric := 3.90;
  -- Conta interna do dono (mesma usada no gate de /admin) — nunca é cliente real.
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH subs AS (
    SELECT s.* FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE NOT public.is_test_user(s.user_id)
      AND u.email IS DISTINCT FROM owner_email
  ),
  active AS (
    SELECT * FROM subs WHERE status IN ('active', 'past_due')
  ),
  ended_30d AS (
    SELECT * FROM subs
    WHERE current_period_end >= now() - interval '30 days' AND current_period_end < now()
  ),
  plan_split AS (
    SELECT COALESCE(billing_period, 'monthly') AS plan, COUNT(*) AS count
    FROM active GROUP BY 1
  ),
  mrr AS (
    SELECT COALESCE(SUM(
      CASE billing_period
        WHEN 'annual' THEN price_annual_monthly_equiv
        WHEN 'monthly' THEN price_monthly
        ELSE 0 -- lifetime / outros: não é receita recorrente
      END
    ), 0) AS mrr_estimate
    FROM active
  ),
  engagement AS (
    SELECT
      COALESCE(NULLIF(event_data->>'tab', ''), '(sem aba)') AS tab,
      COALESCE(NULLIF(event_data->>'card', ''), '(sem card)') AS card,
      COUNT(*) FILTER (WHERE event_name = 'finance_card_view') AS views,
      COUNT(*) FILTER (WHERE event_name = 'finance_card_interact') AS interacts
    FROM public.analytics_events
    WHERE event_name IN ('finance_card_view', 'finance_card_interact')
      AND created_at >= now() - interval '30 days'
      AND (user_id IS NULL OR NOT public.is_test_user(user_id))
    GROUP BY 1, 2
  ),
  tab_usage AS (
    SELECT tab, SUM(views) AS views, SUM(interacts) AS interacts
    FROM engagement GROUP BY tab ORDER BY SUM(views) DESC
  ),
  card_usage AS (
    SELECT card, SUM(views) AS views, SUM(interacts) AS interacts
    FROM engagement GROUP BY card ORDER BY SUM(views) DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'active', (SELECT COUNT(*) FROM active),
      'mrr_estimate', (SELECT mrr_estimate FROM mrr),
      'new_30d', (SELECT COUNT(*) FROM subs WHERE created_at >= now() - interval '30 days'),
      'ended_30d', (SELECT COUNT(*) FROM ended_30d),
      'churn_30d_pct', CASE WHEN (SELECT COUNT(*) FROM ended_30d) > 0
        THEN round((SELECT COUNT(*) FROM ended_30d WHERE status = 'canceled')::numeric
                    / (SELECT COUNT(*) FROM ended_30d) * 100, 1)
        ELSE 0 END
    ),
    'plan_split', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'plan', plan, 'count', count,
        'mrr_estimate', count * (CASE plan WHEN 'annual' THEN price_annual_monthly_equiv WHEN 'monthly' THEN price_monthly ELSE 0 END)
      )), '[]'::jsonb) FROM plan_split),
    'tab_usage', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tab', tab, 'views', views, 'interacts', interacts)), '[]'::jsonb) FROM tab_usage),
    'card_usage', (SELECT COALESCE(jsonb_agg(jsonb_build_object('card', card, 'views', views, 'interacts', interacts)), '[]'::jsonb) FROM card_usage)
  ) INTO result;

  RETURN result;
END;
$$;

-- Mesma exclusão no funil de aquisição, por paridade (caso o dono gere
-- eventos de funil logado durante testes).
CREATE OR REPLACE FUNCTION public.admin_acquisition_funnel(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to   timestamptz DEFAULT now()
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
      AND (e.user_id IS NULL OR NOT public.is_test_user(e.user_id))
      AND (u.email IS NULL OR u.email IS DISTINCT FROM owner_email)
  ),
  session_first_user AS (
    SELECT DISTINCT ON (session_id) session_id, user_id
    FROM ev
    WHERE session_id IS NOT NULL AND user_id IS NOT NULL
    ORDER BY session_id, created_at ASC
  ),
  paid_users AS (
    SELECT DISTINCT ae.user_id
    FROM public.analytics_events ae
    JOIN auth.users u ON u.id = ae.user_id
    WHERE ae.event_name IN ('trial_converted', 'subscription_started')
      AND ae.user_id IS NOT NULL AND NOT public.is_test_user(ae.user_id)
      AND u.email IS DISTINCT FROM owner_email
  ),
  paid_sessions AS (
    SELECT sfu.session_id
    FROM session_first_user sfu
    JOIN paid_users pu ON pu.user_id = sfu.user_id
  ),
  steps_raw AS (
    SELECT 1 AS ord, 'start' AS key, 'Abriu o funil' AS label,
           COUNT(DISTINCT session_id) AS sessions
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start'
    UNION ALL
    SELECT 2, 'quiz', 'Começou o quiz', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_1'
    UNION ALL
    SELECT 3, 'result', 'Viu o resultado', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'result'
    UNION ALL
    SELECT 4, 'demo', 'Abriu a demo', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'demo'
    UNION ALL
    SELECT 5, 'signup', 'Chegou no cadastro', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'signup'
    UNION ALL
    SELECT 6, 'account', 'Criou a conta', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success'
    UNION ALL
    SELECT 7, 'offer', 'Viu a oferta (paywall)', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'offer'
    UNION ALL
    SELECT 8, 'paid', 'Assinou', COUNT(DISTINCT session_id)
    FROM paid_sessions
  ),
  steps_calc AS (
    SELECT ord, key, label, sessions,
           FIRST_VALUE(sessions) OVER (ORDER BY ord) AS first_sessions,
           LAG(sessions) OVER (ORDER BY ord) AS prev_sessions
    FROM steps_raw
  ),
  steps_final AS (
    SELECT ord, key, label, sessions,
      CASE WHEN first_sessions > 0 THEN round(sessions::numeric / first_sessions * 100, 1) ELSE 0 END AS pct_of_first,
      CASE
        WHEN prev_sessions IS NULL THEN NULL
        WHEN prev_sessions > 0 THEN round((1 - sessions::numeric / prev_sessions) * 100, 1)
        ELSE NULL
      END AS drop_pct
    FROM steps_calc
  ),
  worst AS (
    SELECT key, label, drop_pct FROM steps_final
    WHERE drop_pct IS NOT NULL AND drop_pct > 0
    ORDER BY drop_pct DESC LIMIT 1
  ),
  clicks AS (
    SELECT event_data->>'cta' AS cta, COUNT(*) AS clicks, COUNT(DISTINCT session_id) AS sessions
    FROM ev WHERE event_name = 'funnel_click' AND event_data->>'cta' IS NOT NULL
    GROUP BY 1
  ),
  quiz AS (
    SELECT event_data->>'q' AS q, event_data->>'answer' AS answer, COUNT(*) AS count
    FROM ev WHERE event_name = 'funnel_quiz_answer' AND event_data->>'answer' IS NOT NULL
    GROUP BY 1, 2
  ),
  quiz_grouped AS (
    SELECT q, jsonb_agg(jsonb_build_object('answer', answer, 'count', count) ORDER BY count DESC) AS answers
    FROM quiz GROUP BY q
  ),
  recovery AS (
    SELECT
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'offer') AS offer_views,
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'wheel') AS wheel_views,
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'downsell') AS downsell_views,
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'downsell_dismiss') AS downsell_dismissed,
      (SELECT COUNT(DISTINCT ps.session_id) FROM paid_sessions ps
        WHERE ps.session_id IN (SELECT session_id FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'downsell')
      ) AS downsell_paid
  ),
  utm AS (
    SELECT COALESCE(NULLIF(event_data->>'utm_source', ''), 'direto/desconhecido') AS source,
           COUNT(DISTINCT session_id) AS sessions,
           COUNT(DISTINCT session_id) FILTER (WHERE session_id IN (SELECT session_id FROM paid_sessions)) AS paid
    FROM ev
    WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start'
    GROUP BY 1
  ),
  daily AS (
    SELECT date_trunc('day', created_at)::date AS day,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start') AS sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success') AS accounts,
      COUNT(DISTINCT session_id) FILTER (WHERE session_id IN (SELECT session_id FROM paid_sessions)) AS paid
    FROM ev
    GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'sessions', (SELECT sessions FROM steps_final WHERE key = 'start'),
      'accounts', (SELECT sessions FROM steps_final WHERE key = 'account'),
      'paid', (SELECT sessions FROM steps_final WHERE key = 'paid'),
      'conversion_pct', CASE WHEN (SELECT sessions FROM steps_final WHERE key = 'start') > 0
        THEN round((SELECT sessions FROM steps_final WHERE key = 'paid')::numeric
                    / (SELECT sessions FROM steps_final WHERE key = 'start') * 100, 2)
        ELSE 0 END
    ),
    'steps', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', key, 'label', label, 'sessions', sessions,
        'pct_of_first', pct_of_first, 'drop_pct', drop_pct
      ) ORDER BY ord), '[]'::jsonb) FROM steps_final),
    'worst_drop', (SELECT to_jsonb(worst) FROM worst),
    'recovery', (SELECT to_jsonb(recovery) FROM recovery),
    'cta_clicks', (SELECT COALESCE(jsonb_agg(jsonb_build_object('cta', cta, 'clicks', clicks, 'sessions', sessions) ORDER BY clicks DESC), '[]'::jsonb) FROM clicks),
    'quiz_answers', (SELECT COALESCE(jsonb_object_agg(q, answers), '{}'::jsonb) FROM quiz_grouped),
    'utm_breakdown', (SELECT COALESCE(jsonb_agg(jsonb_build_object('source', source, 'sessions', sessions, 'paid', paid) ORDER BY sessions DESC), '[]'::jsonb) FROM utm),
    'daily', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'accounts', accounts, 'paid', paid) ORDER BY day), '[]'::jsonb) FROM daily)
  ) INTO result;

  RETURN result;
END;
$$;
