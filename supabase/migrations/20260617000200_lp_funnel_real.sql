-- Reescreve admin_lp_funnel para refletir a REALIDADE da landing page /lp.
--
-- Contexto: os CTAs da /lp levam direto para /auth?signup=1 (cadastro clássico).
-- A /lp NÃO passa pelo tutorial/quickstart — aqueles eventos (quickstart_*, spotlight_*,
-- quicksignup_*, trial_accepted) vêm de outra tela (source='quickstart') e já são cobertos
-- pela RPC admin_onboarding_funnel_v2. Além disso, o trial não gera registro: é derivado de
-- profiles.created_at — logo, "criar conta" == "iniciar trial".
--
-- Funil real: Visita LP (source='lp') → Clique no CTA → Criou conta (= trial) → Virou pagante.

DROP FUNCTION IF EXISTS public.admin_lp_funnel(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.admin_lp_funnel(
  _from timestamptz DEFAULT (now() - interval '7 days'),
  _to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH ev AS (
    SELECT id, user_id, session_id, event_name, event_data, created_at
    FROM public.analytics_events
    WHERE created_at >= _from AND created_at < _to
      AND session_id IS NOT NULL
  ),
  -- Sessões da landing page real: tocaram a /lp (view source='lp') ou clicaram num CTA dela
  valid_sessions AS (
    SELECT DISTINCT session_id
    FROM ev
    WHERE (event_name = 'landing_view' AND COALESCE(event_data->>'source','') = 'lp')
       OR event_name = 'landing_cta_click'
  ),
  vev AS (
    SELECT e.* FROM ev e JOIN valid_sessions v USING (session_id)
  ),
  s AS (
    SELECT
      session_id,
      bool_or(event_name = 'landing_view' AND COALESCE(event_data->>'source','') = 'lp') AS has_visit,
      bool_or(event_name = 'landing_cta_click') AS has_cta,
      bool_or(event_name = 'signup_completed')  AS has_signup
    FROM vev
    GROUP BY session_id
  ),
  -- usuários que criaram conta a partir de uma sessão da LP
  signup_users AS (
    SELECT DISTINCT user_id
    FROM vev
    WHERE event_name = 'signup_completed' AND user_id IS NOT NULL
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE has_visit)  AS visits,
      count(*) FILTER (WHERE has_cta)    AS cta_clicks,
      count(*) FILTER (WHERE has_signup) AS signups,
      (SELECT count(*) FROM signup_users su
         JOIN public.subscriptions sub ON sub.user_id = su.user_id AND sub.status = 'active') AS paid
    FROM s
  ),
  cta_break AS (
    SELECT
      COALESCE(event_data->>'cta','(sem cta)') AS cta,
      count(*) AS clicks,
      count(DISTINCT session_id) AS sessions
    FROM vev
    WHERE event_name = 'landing_cta_click'
    GROUP BY 1
    ORDER BY clicks DESC
  ),
  src_break AS (
    SELECT
      COALESCE(NULLIF(event_data->>'utm_source',''),'direto') AS source,
      count(DISTINCT session_id) AS visits
    FROM vev
    WHERE event_name = 'landing_view' AND COALESCE(event_data->>'source','') = 'lp'
    GROUP BY 1
    ORDER BY visits DESC
  ),
  daily AS (
    SELECT
      to_char(date_trunc('day', vev.created_at), 'YYYY-MM-DD') AS day,
      count(DISTINCT session_id) FILTER (WHERE event_name='landing_view' AND COALESCE(event_data->>'source','')='lp') AS visits,
      count(DISTINCT session_id) FILTER (WHERE event_name='landing_cta_click')  AS cta_clicks,
      count(DISTINCT session_id) FILTER (WHERE event_name='signup_completed')   AS signups
    FROM vev
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'cta_breakdown',    COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM cta_break c), '[]'::jsonb),
    'source_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(sr)) FROM src_break sr), '[]'::jsonb),
    'daily',            COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_lp_funnel(timestamptz, timestamptz) TO authenticated;
