-- admin_paying_user_funnel: a "jornada" de 1 assinante pro sheet do admin.
-- A versão antiga (jun/2026) usava module_analytics/user_activations e etapas
-- de trial — obsoletas no funil pago atual e nunca foram pra este banco.
-- Esta reconstrói o funil REAL do /comecar a partir das sessões do usuário
-- (os passos pré-cadastro vivem em sessões anônimas ligadas ao user pelo
-- session_id) + atividade no app, tudo de analytics_events.

CREATE OR REPLACE FUNCTION public.admin_paying_user_funnel(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_signup_at timestamptz;
  v_sub record;
  v_sessions text[];
  v_total_sessions int;
  v_first_seen timestamptz;
  v_last_seen timestamptz;
  v_steps jsonb;
  v_tabs jsonb;
  v_cards jsonb;
  v_timeline jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT email::text, created_at INTO v_email, v_signup_at FROM auth.users WHERE id = _user_id;
  IF v_signup_at IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  SELECT billing_period AS plan, billing_period, status, payment_method,
         created_at AS subscribed_at, current_period_end
    INTO v_sub
    FROM public.subscriptions
    WHERE user_id = _user_id
    ORDER BY created_at DESC LIMIT 1;

  -- Sessões do usuário (inclui as anônimas de antes do cadastro, pelo session_id)
  v_sessions := ARRAY(
    SELECT DISTINCT session_id FROM public.analytics_events
    WHERE user_id = _user_id AND session_id IS NOT NULL
  );

  SELECT COUNT(DISTINCT session_id), MIN(created_at), MAX(created_at)
    INTO v_total_sessions, v_first_seen, v_last_seen
    FROM public.analytics_events WHERE user_id = _user_id;

  -- Passos do funil /comecar nas sessões do usuário (1º timestamp de cada).
  WITH fv AS (
    SELECT event_data->>'step' AS step, MIN(created_at) AS at
    FROM public.analytics_events
    WHERE event_name = 'funnel_view' AND session_id = ANY(v_sessions)
    GROUP BY 1
  ),
  acct AS (
    SELECT MIN(created_at) AS at FROM public.analytics_events
    WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success'
      AND session_id = ANY(v_sessions)
  ),
  defs(ord, key, label) AS (VALUES
    (1,'start','Abriu o funil'),
    (2,'quiz_1','Quiz 1 — o que atrapalha'),
    (3,'quiz_2','Quiz 2 — como controla'),
    (4,'quiz_3','Quiz 3 — quanto some'),
    (5,'quiz_proof','Tela de impacto'),
    (6,'quiz_4','Quiz 4 — compromisso'),
    (7,'quiz_5','Quiz 5 — vitória'),
    (8,'progress','Preparação'),
    (9,'result','Viu o resultado'),
    (10,'demo','Abriu a demo'),
    (11,'signup','Chegou no cadastro'),
    (13,'offer','Viu o paywall')
  )
  SELECT jsonb_agg(
    jsonb_build_object('key', key, 'label', label, 'at', at, 'reached', at IS NOT NULL)
    ORDER BY ord
  )
  INTO v_steps
  FROM (
    SELECT d.ord, d.key, d.label, fv.at
    FROM defs d LEFT JOIN fv ON fv.step = d.key
    UNION ALL
    SELECT 12, 'account', 'Criou a conta', (SELECT at FROM acct)
    UNION ALL
    SELECT 14, 'paid', 'Assinou', v_sub.subscribed_at
  ) x;

  -- Atividade no app: abas de finanças vistas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'module_id', 'financas',
    'tab_id', tab,
    'seconds', 0,
    'visits', visits
  ) ORDER BY visits DESC), '[]'::jsonb)
  INTO v_tabs
  FROM (
    SELECT COALESCE(NULLIF(event_data->>'tab',''), '(sem aba)') AS tab, COUNT(*) AS visits
    FROM public.analytics_events
    WHERE user_id = _user_id AND event_name = 'finance_card_view'
    GROUP BY 1
  ) t;

  -- Ações-chave concluídas (proxy dos "cards preenchidos")
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action_key', COALESCE(NULLIF(event_data->>'action',''), NULLIF(event_data->>'key',''), event_name),
    'completed_at', created_at
  ) ORDER BY created_at), '[]'::jsonb)
  INTO v_cards
  FROM public.analytics_events
  WHERE user_id = _user_id AND event_name IN ('key_action_completed','finance_card_interact','quickstart_module_opened');

  -- Timeline D0–D7 desde o cadastro (atividade por dia)
  WITH ev AS (
    SELECT GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (created_at - v_signup_at)) / 86400)::int) AS day,
           event_name, event_data->>'tab' AS tab
    FROM public.analytics_events
    WHERE user_id = _user_id
  ),
  by_day AS (
    SELECT day,
      COUNT(*) AS events,
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object('tab', tab, 'module', 'financas'))
               FILTER (WHERE tab IS NOT NULL AND tab <> ''), '[]'::jsonb) AS tabs
    FROM ev GROUP BY day
  ),
  days AS (SELECT generate_series(0,7) AS day)
  SELECT jsonb_agg(jsonb_build_object(
    'day', d.day,
    'seconds', 0,
    'tabs', COALESCE(bd.tabs, '[]'::jsonb),
    'activations', '[]'::jsonb,
    'active', COALESCE(bd.events,0) > 0
  ) ORDER BY d.day)
  INTO v_timeline
  FROM days d LEFT JOIN by_day bd USING (day);

  RETURN jsonb_build_object(
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
      'total_seconds', 0,
      'top_module', 'financas',
      'days_trial_to_paid', CASE WHEN v_sub.subscribed_at IS NULL THEN NULL
        ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_sub.subscribed_at - v_signup_at))/86400)::int) END
    ),
    'steps', COALESCE(v_steps, '[]'::jsonb),
    'tabs', v_tabs,
    'cards', v_cards,
    'timeline', v_timeline,
    'first_seen', v_first_seen,
    'last_seen', v_last_seen
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_paying_user_funnel(uuid) TO authenticated;
