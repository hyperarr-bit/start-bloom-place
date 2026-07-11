-- Bug reportado pelo dono (12/07): admin mostrava "5 pagantes hoje" com 1
-- venda real. Duas inflações no passo "Assinou":
--   1) (já corrigida em 07/07) contava pagante ANTIGO que só revisitou.
--   2) (esta) contava por SESSÃO — 1 comprador com N sessões no período (a
--      Aline pagou, cancelou, voltou várias vezes) virava N "assinou".
-- Fix: "Assinou" e o paid da UTM/série contam COMPRADORES DISTINTOS
-- (paid_sessions passa a ter 1 sessão por usuário).

CREATE OR REPLACE FUNCTION public.admin_acquisition_funnel(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to   timestamptz DEFAULT now(),
  _granularity text DEFAULT 'day'  -- 'day' | 'hour'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
  bucket_unit text := CASE WHEN _granularity = 'hour' THEN 'hour' ELSE 'day' END;
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
      AND (u.email IS NULL OR lower(u.email) IS DISTINCT FROM lower(owner_email))
  ),
  session_first_user AS (
    SELECT DISTINCT ON (session_id) session_id, user_id, created_at
    FROM ev
    WHERE session_id IS NOT NULL AND user_id IS NOT NULL
    ORDER BY session_id, created_at ASC
  ),
  paid_users AS (
    -- O evento de pagamento precisa ter ocorrido DENTRO do período (fix 07/07).
    SELECT DISTINCT ae.user_id
    FROM public.analytics_events ae
    JOIN auth.users u ON u.id = ae.user_id
    WHERE ae.event_name IN ('trial_converted', 'subscription_started')
      AND ae.user_id IS NOT NULL AND NOT public.is_test_user(ae.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
      AND ae.created_at >= _from AND ae.created_at < _to
  ),
  paid_sessions AS (
    -- FIX 12/07: 1 linha por COMPRADOR (a sessão mais antiga dele no período),
    -- pra 1 pessoa com várias sessões não contar como vários "assinou".
    SELECT DISTINCT ON (sfu.user_id) sfu.session_id, sfu.user_id
    FROM session_first_user sfu
    JOIN paid_users pu ON pu.user_id = sfu.user_id
    ORDER BY sfu.user_id, sfu.created_at ASC
  ),
  steps_raw AS (
    SELECT 1 AS ord, 'start' AS key, 'Abriu o funil' AS label,
           COUNT(DISTINCT session_id) AS sessions
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start'
    UNION ALL
    SELECT 2, 'quiz_1', 'Quiz 1 — o que atrapalha', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_1'
    UNION ALL
    SELECT 3, 'quiz_2', 'Quiz 2 — como controla hoje', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_2'
    UNION ALL
    SELECT 4, 'quiz_3', 'Quiz 3 — quanto some por mês', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_3'
    UNION ALL
    SELECT 5, 'quiz_proof', 'Tela de impacto (R$ anualizado)', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_proof'
    UNION ALL
    SELECT 6, 'quiz_4', 'Quiz 4 — compromisso 5 min/dia', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_4'
    UNION ALL
    SELECT 7, 'quiz_5', 'Quiz 5 — vitória em 7 dias', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_5'
    UNION ALL
    SELECT 8, 'progress', 'Tela de preparação', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'progress'
    UNION ALL
    SELECT 9, 'result', 'Viu o resultado', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'result'
    UNION ALL
    SELECT 10, 'demo', 'Abriu a demo', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'demo'
    UNION ALL
    SELECT 11, 'signup', 'Chegou no cadastro', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'signup'
    UNION ALL
    SELECT 12, 'account', 'Criou a conta', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success'
    UNION ALL
    SELECT 13, 'offer', 'Viu a oferta (paywall)', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'offer'
    UNION ALL
    -- Assinou = COMPRADORES distintos que converteram no período (não sessões).
    SELECT 14, 'paid', 'Assinou', (SELECT COUNT(*) FROM paid_users)
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
      (SELECT COUNT(DISTINCT ps.user_id) FROM paid_sessions ps
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
    SELECT date_trunc(bucket_unit, created_at) AS bucket,
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
    'granularity', bucket_unit,
    'daily', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', bucket, 'sessions', sessions, 'accounts', accounts, 'paid', paid) ORDER BY bucket), '[]'::jsonb) FROM daily)
  ) INTO result;

  RETURN result;
END;
$$;
