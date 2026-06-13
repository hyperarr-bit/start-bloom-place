DROP FUNCTION IF EXISTS public.admin_lp_funnel(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.admin_lp_funnel(
  _from timestamptz DEFAULT (now() - interval '2 days'),
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
  -- Sessões válidas: as que tocaram a LP (view ou CTA) no período
  valid_sessions AS (
    SELECT DISTINCT session_id
    FROM ev
    WHERE event_name IN ('landing_view','landing_cta_click')
  ),
  vev AS (
    SELECT e.* FROM ev e JOIN valid_sessions v USING (session_id)
  ),
  s AS (
    SELECT
      session_id,
      bool_or(event_name = 'landing_view') AS has_visit,
      bool_or(event_name = 'landing_cta_click') AS has_cta,
      bool_or(event_name IN ('signup_completed','quicksignup_completed')) AS has_signup,
      bool_or(event_name IN ('pre_signup_tutorial_started','quickstart_module_chosen')) AS has_tut_start,
      bool_or(event_name = 'quickstart_module_chosen') AS has_module,
      bool_or(event_name IN ('pre_signup_tutorial_completed','quickstart_completed','quickstart_all_completed')) AS has_tut_done,
      bool_or(event_name IN ('trial_started','trial_accepted')) AS has_trial
    FROM vev
    GROUP BY session_id
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE has_visit)     AS visits,
      count(*) FILTER (WHERE has_cta)       AS cta_clicks,
      count(*) FILTER (WHERE has_signup)    AS signups,
      count(*) FILTER (WHERE has_tut_start) AS tutorial_started,
      count(*) FILTER (WHERE has_module)    AS module_chosen,
      count(*) FILTER (WHERE has_tut_done)  AS tutorial_completed,
      count(*) FILTER (WHERE has_trial)     AS trials
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
  mod_break AS (
    SELECT
      COALESCE(event_data->>'module','(sem)') AS module,
      count(*) AS chosen,
      count(DISTINCT COALESCE(user_id::text, session_id)) AS unique_users
    FROM vev
    WHERE event_name = 'quickstart_module_chosen'
    GROUP BY 1
    ORDER BY chosen DESC
  ),
  src_break AS (
    SELECT
      COALESCE(NULLIF(event_data->>'utm_source',''),'direto') AS source,
      count(DISTINCT session_id) AS visits
    FROM vev
    WHERE event_name = 'landing_view'
    GROUP BY 1
    ORDER BY visits DESC
  ),
  daily AS (
    SELECT
      to_char(date_trunc('day', vev.created_at), 'YYYY-MM-DD') AS day,
      count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')                                              AS visits,
      count(DISTINCT session_id) FILTER (WHERE event_name='landing_cta_click')                                         AS cta_clicks,
      count(DISTINCT session_id) FILTER (WHERE event_name IN ('signup_completed','quicksignup_completed'))             AS signups,
      count(DISTINCT session_id) FILTER (WHERE event_name IN ('pre_signup_tutorial_completed','quickstart_completed','quickstart_all_completed')) AS tutorial_completed,
      count(DISTINCT session_id) FILTER (WHERE event_name IN ('trial_started','trial_accepted'))                       AS trials
    FROM vev
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'cta_breakdown',    COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM cta_break c), '[]'::jsonb),
    'module_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM mod_break m), '[]'::jsonb),
    'source_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(sr)) FROM src_break sr), '[]'::jsonb),
    'daily',            COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_lp_funnel(timestamptz, timestamptz) TO authenticated;