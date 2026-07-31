-- 30/07: TEMPO HONESTO + sinais de acompanhamento na aba Pagantes.
--
-- O problema: `duration_seconds` mede "quanto tempo a aba ficou aberta", não
-- uso. Medido em 26.759 visitas: mediana 11s, p90 140s — mas a MAIOR visita
-- tem 81,5 HORAS, e as 5% de visitas acima de 30min respondem por 90% de todo
-- o tempo somado. Ou seja: o ranking de "quem mais usa" estava listando quem
-- esqueceu a aba aberta.
--
-- Correção: LEAST(duration_seconds, 1800) — nenhuma visita conta mais que 30
-- minutos. O teto é generoso (p99 real é 4.476s ≈ 75min, já inflado) e vale
-- pro histórico inteiro sem precisar apagar dado. O gravador (use-module-tracker)
-- também passa a cortar na origem.
--
-- Novos campos por pagante, pros recortes do admin:
--   days_since_last  dias desde o último sinal (NULL = nunca abriu)
--   days_since_buy   dias desde a compra
--   active_today     usou hoje (fuso de São Paulo)
--   last_7d_days     em quantos dos últimos 7 dias apareceu

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
    SELECT s.*,
      COALESCE(NULLIF(s.customer_email, ''), u.email) AS email,
      COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'display_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')
      ) AS meta_name
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
  ),
  prof AS (
    SELECT id, NULLIF(TRIM(display_name), '') AS name
    FROM public.profiles WHERE id IN (SELECT user_id FROM subs)
  ),
  activity AS (
    SELECT user_id,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS days_active,
      -- sinais de acompanhamento: tudo no fuso de SP, que é onde o dono vive
      BOOL_OR((created_at AT TIME ZONE 'America/Sao_Paulo')::date
              = (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS active_today,
      COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date)
        FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d_days
    FROM public.analytics_events
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id
  ),
  acts AS (
    SELECT user_id, array_agg(DISTINCT event_data->>'action_key') AS action_keys
    FROM public.analytics_events
    WHERE event_name = 'key_action_completed'
      AND user_id IN (SELECT user_id FROM subs)
      AND COALESCE(event_data->>'action_key', '') <> ''
    GROUP BY user_id
  ),
  mod_usage AS (
    SELECT user_id, module_id, SUM(LEAST(duration_seconds, 1800)) AS seconds, COUNT(*) AS opens
    FROM public.module_analytics
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id, module_id
  ),
  mod_agg AS (
    SELECT user_id,
      jsonb_agg(jsonb_build_object('id', module_id, 'seconds', seconds, 'opens', opens) ORDER BY seconds DESC) AS modules,
      SUM(seconds) AS total_seconds, SUM(opens) AS total_opens
    FROM mod_usage GROUP BY user_id
  ),
  tab_usage AS (
    SELECT user_id, module_id, tab_id, SUM(LEAST(duration_seconds, 1800)) AS seconds
    FROM public.module_analytics
    WHERE user_id IN (SELECT user_id FROM subs) AND tab_id IS NOT NULL AND tab_id <> ''
    GROUP BY user_id, module_id, tab_id
  ),
  tab_ranked AS (
    SELECT user_id, module_id, tab_id, seconds,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY seconds DESC) AS rn
    FROM tab_usage
  ),
  tab_agg AS (
    SELECT user_id,
      jsonb_agg(jsonb_build_object('module', module_id, 'tab', tab_id, 'seconds', seconds) ORDER BY seconds DESC) AS tabs
    FROM tab_ranked WHERE rn <= 15 GROUP BY user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', s.email,
    'name', COALESCE(p.name, s.meta_name),
    'plan', s.billing_period,
    'status', s.status,
    'subscribed_since', s.created_at,
    'current_period_end', s.current_period_end,
    'first_seen', a.first_seen,
    'last_seen', a.last_seen,
    'sessions', COALESCE(a.sessions, 0),
    'days_active', COALESCE(a.days_active, 0),
    'active_today', COALESCE(a.active_today, false),
    'last_7d_days', COALESCE(a.last_7d_days, 0),
    -- dias inteiros desde o último sinal; NULL quando a pessoa nunca apareceu
    'days_since_last', CASE WHEN a.last_seen IS NULL THEN NULL
                            ELSE FLOOR(EXTRACT(EPOCH FROM (now() - a.last_seen)) / 86400)::int END,
    'days_since_buy', FLOOR(EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400)::int,
    'total_seconds', COALESCE(ma.total_seconds, 0),
    'total_opens', COALESCE(ma.total_opens, 0),
    'actions', COALESCE(to_jsonb(ac.action_keys), '[]'::jsonb),
    'modules', COALESCE(ma.modules, '[]'::jsonb),
    'tabs', COALESCE(ta.tabs, '[]'::jsonb)
  ) ORDER BY s.created_at DESC), '[]'::jsonb) INTO result
  FROM subs s
  LEFT JOIN prof p ON p.id = s.user_id
  LEFT JOIN activity a ON a.user_id = s.user_id
  LEFT JOIN acts ac ON ac.user_id = s.user_id
  LEFT JOIN mod_agg ma ON ma.user_id = s.user_id
  LEFT JOIN tab_agg ta ON ta.user_id = s.user_id;

  RETURN jsonb_build_object('users', result);
END;
$$;
