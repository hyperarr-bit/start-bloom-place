-- Admin: agrega o funil novo (/comecar) a partir de analytics_events.
-- Eventos: funnel_view {step}, funnel_click {cta}, funnel_quiz_answer {q, answer}.
-- Segurança: SECURITY DEFINER + checagem de admin via has_role; só authenticated executa.

CREATE OR REPLACE FUNCTION public.admin_funnel_v1(
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
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ev AS (
    SELECT event_name, event_data, session_id, user_id, created_at
    FROM public.analytics_events
    WHERE created_at >= _from AND created_at < _to
      AND (user_id IS NULL OR NOT public.is_test_user(user_id))
  ),
  steps AS (
    SELECT event_data->>'step' AS step,
           COUNT(DISTINCT session_id) AS sessions,
           COUNT(*) AS views
    FROM ev
    WHERE event_name = 'funnel_view' AND event_data->>'step' IS NOT NULL
    GROUP BY 1
  ),
  clicks AS (
    SELECT event_data->>'cta' AS cta,
           COUNT(*) AS clicks,
           COUNT(DISTINCT session_id) AS sessions
    FROM ev
    WHERE event_name = 'funnel_click' AND event_data->>'cta' IS NOT NULL
    GROUP BY 1
  ),
  quiz AS (
    SELECT event_data->>'q' AS q,
           event_data->>'answer' AS answer,
           COUNT(*) AS count,
           COUNT(DISTINCT session_id) AS sessions
    FROM ev
    WHERE event_name = 'funnel_quiz_answer' AND event_data->>'answer' IS NOT NULL
    GROUP BY 1, 2
  ),
  daily AS (
    SELECT date_trunc('day', created_at)::date AS day,
           COUNT(DISTINCT session_id) FILTER (WHERE event_name='funnel_view'  AND event_data->>'step'='start')          AS started,
           COUNT(DISTINCT session_id) FILTER (WHERE event_name='funnel_view'  AND event_data->>'step'='demo')           AS demo,
           COUNT(DISTINCT session_id) FILTER (WHERE event_name='funnel_click' AND event_data->>'cta'='signup_success')  AS signups,
           COUNT(DISTINCT session_id) FILTER (WHERE event_name='funnel_click' AND event_data->>'cta'='trial_accept')    AS trials
    FROM ev
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range',  jsonb_build_object('from', _from, 'to', _to),
    'steps',  COALESCE((SELECT jsonb_object_agg(step, jsonb_build_object('sessions', sessions, 'views', views)) FROM steps), '{}'::jsonb),
    'clicks', COALESCE((SELECT jsonb_object_agg(cta,  jsonb_build_object('clicks', clicks, 'sessions', sessions)) FROM clicks), '{}'::jsonb),
    'quiz',   COALESCE((SELECT jsonb_agg(to_jsonb(quiz) ORDER BY q, count DESC) FROM quiz), '[]'::jsonb),
    'daily',  COALESCE((SELECT jsonb_agg(to_jsonb(daily)) FROM daily), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_funnel_v1(timestamptz, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_funnel_v1(timestamptz, timestamptz) FROM anon;
