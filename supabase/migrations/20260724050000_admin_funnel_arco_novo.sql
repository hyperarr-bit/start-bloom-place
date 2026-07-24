-- Arco novo do funil vitrine no admin (24/07): crença, diagnóstico,
-- confiança, ponte e SEU PLANO como passos próprios — conversão passo a
-- passo do funil que está no ar. Clona a versão 20260714120000 e insere
-- os steps novos (crenca / confianca / plano) + relabels.

-- 14/07: o admin pulava de "Viu a oferta" direto pra "Assinou" — cego pro
-- checkout Pix in-app (o motivo de termos trazido a venda pra dentro). Agora
-- o RPC devolve um bloco `pix` com o micro-funil: abriu → gerou QR → copiou →
-- confirmou, + erros. Split funnel/app porque o gate in-app (conta sem trial)
-- e o passo `offer` do /comecar mandam o MESMO comprador por contextos
-- diferentes — sem o split o número engana.
--
-- Mantém tudo que a versão anterior (paid_distinct_users) já fazia.

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
    SELECT DISTINCT ae.user_id
    FROM public.analytics_events ae
    JOIN auth.users u ON u.id = ae.user_id
    WHERE ae.event_name IN ('trial_converted', 'subscription_started')
      AND ae.user_id IS NOT NULL AND NOT public.is_test_user(ae.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
      AND ae.created_at >= _from AND ae.created_at < _to
  ),
  paid_sessions AS (
    SELECT DISTINCT ON (sfu.user_id) sfu.session_id, sfu.user_id
    FROM session_first_user sfu
    JOIN paid_users pu ON pu.user_id = sfu.user_id
    ORDER BY sfu.user_id, sfu.created_at ASC
  ),
  steps_raw AS (
    SELECT 1 AS ord, 'start' AS key, 'Porta — escolheu a área' AS label,
           COUNT(DISTINCT session_id) AS sessions
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start'
    UNION ALL
    SELECT 2, 'crenca', 'Crença — como o CORE funciona', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'crenca'
    UNION ALL
    SELECT 3, 'quiz_1', 'Quiz 1 — o que atrapalha', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_1'
    UNION ALL
    SELECT 4, 'quiz_2', 'Quiz 2 — como controla hoje', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_2'
    UNION ALL
    SELECT 5, 'quiz_3', 'Quiz 3 — quanto some por mês', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_3'
    UNION ALL
    SELECT 6, 'quiz_proof', 'Diagnóstico — relatório', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_proof'
    UNION ALL
    SELECT 7, 'quiz_4', 'Quiz 4 — compromisso 5 min/dia', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_4'
    UNION ALL
    SELECT 8, 'quiz_5', 'Quiz 5 — vitória em 7 dias', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'quiz_5'
    UNION ALL
    SELECT 9, 'confianca', 'Confiança — obrigado', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'confianca'
    UNION ALL
    SELECT 10, 'progress', 'Análise (loading)', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'progress'
    UNION ALL
    SELECT 11, 'result', 'Ponte — análise pronta', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'result'
    UNION ALL
    SELECT 12, 'demo', 'Demo — app real', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'demo'
    UNION ALL
    SELECT 13, 'plano', 'SEU PLANO', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'plano'
    UNION ALL
    SELECT 14, 'signup', 'Chegou no cadastro', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'signup'
    UNION ALL
    SELECT 15, 'account', 'Criou a conta', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success'
    UNION ALL
    SELECT 16, 'offer', 'Viu a oferta (paywall)', COUNT(DISTINCT session_id)
    FROM ev WHERE event_name = 'funnel_view' AND event_data->>'step' = 'offer'
    UNION ALL
    SELECT 17, 'paid', 'Assinou', (SELECT COUNT(*) FROM paid_users)
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
  -- NOVO: micro-funil do checkout Pix in-app (por SESSÃO). Split funnel/app
  -- porque comprador do /comecar (funnel) e do gate in-app (app) são fluxos
  -- distintos; o total soma os dois.
  pix AS (
    SELECT
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open') AS opened,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated')     AS generated,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_copied')        AS copied,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_confirmed')     AS confirmed,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_error')         AS errored,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open' AND event_data->>'context' = 'funnel') AS opened_funnel,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open' AND event_data->>'context' = 'app')    AS opened_app,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated' AND event_data->>'context' = 'funnel')     AS generated_funnel,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated' AND event_data->>'context' = 'app')        AS generated_app
    FROM ev
    WHERE event_name IN ('pix_checkout_open','pix_generated','pix_copied','pix_confirmed','pix_error')
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
    'pix', (SELECT to_jsonb(pix) FROM pix),
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
