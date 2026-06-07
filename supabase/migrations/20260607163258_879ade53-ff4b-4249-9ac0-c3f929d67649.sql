
CREATE OR REPLACE FUNCTION public.admin_onboarding_funnel(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz;
  upper timestamptz;
  reset_at timestamptz;
  macro jsonb;
  by_module jsonb;
  final jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  cutoff := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  upper := COALESCE(_to, now());

  WITH ev AS (
    SELECT event_name, event_data, COALESCE(user_id::text, session_id) AS u
    FROM public.analytics_events
    WHERE created_at >= cutoff AND created_at <= upper
  )
  SELECT jsonb_build_array(
    jsonb_build_object('key','landing','label','Abriu a landing inicial','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='landing_view' AND COALESCE(event_data->>'source','') <> 'quickstart')),
    jsonb_build_object('key','tut_started','label','Iniciou o tutorial "Quero começar"','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='pre_signup_tutorial_started')),
    jsonb_build_object('key','slide_1','label','Slide 1 — Tenha controle da sua vida financeira','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='pre_signup_tutorial_step' AND (event_data->>'step')::int=1)),
    jsonb_build_object('key','slide_2','label','Slide 2 — Veja seu mês com clareza','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='pre_signup_tutorial_step' AND (event_data->>'step')::int=2)),
    jsonb_build_object('key','slide_3','label','Slide 3 — Controle seus gastos e limites','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='pre_signup_tutorial_step' AND (event_data->>'step')::int=3)),
    jsonb_build_object('key','slide_4','label','Slide 4 — Planeje seus desejos e objetivos','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='pre_signup_tutorial_step' AND (event_data->>'step')::int=4)),
    jsonb_build_object('key','slide_5','label','Slide 5 — Comece pela sua primeira receita','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='pre_signup_tutorial_step' AND (event_data->>'step')::int=5)),
    jsonb_build_object('key','start_clicked','label','Clicou em "Quero começar"','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='start_clicked')),
    jsonb_build_object('key','quickstart','label','Entrou em "Por onde você quer começar?"','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='landing_view' AND event_data->>'source'='quickstart')),
    jsonb_build_object('key','module_chosen','label','Clicou em um módulo','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='quickstart_module_chosen')),
    jsonb_build_object('key','spotlight_shown','label','Entrou no módulo (tutorial abriu)','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='spotlight_shown')),
    jsonb_build_object('key','module_completed','label','Finalizou o módulo','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='quickstart_completed')),
    jsonb_build_object('key','form_shown','label','Form de cadastro apareceu','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='quicksignup_step_shown')),
    jsonb_build_object('key','form_done','label','Aceitou os 7 dias grátis (form concluído)','users',
      (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='quicksignup_completed'))
  ) INTO macro FROM ev LIMIT 1;

  IF macro IS NULL THEN
    macro := jsonb_build_array();
  END IF;

  WITH ev AS (
    SELECT event_name, event_data, COALESCE(user_id::text, session_id) AS u
    FROM public.analytics_events
    WHERE created_at >= cutoff AND created_at <= upper
      AND event_data ? 'module'
  ),
  mods AS (
    SELECT unnest(ARRAY['financas','rotina','dieta','metas']) AS m
  )
  SELECT jsonb_agg(jsonb_build_object(
    'module', mods.m,
    'clicked', (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='quickstart_module_chosen' AND event_data->>'module'=mods.m),
    'tutorial_opened', (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='spotlight_shown' AND event_data->>'module'=mods.m),
    'completed', (SELECT COUNT(DISTINCT u) FROM ev WHERE event_name='quickstart_completed' AND event_data->>'module'=mods.m),
    'steps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('step', step, 'users', users) ORDER BY step)
      FROM (
        SELECT (event_data->>'step')::int AS step, COUNT(DISTINCT u) AS users
        FROM ev
        WHERE event_name='spotlight_step_view' AND event_data->>'module'=mods.m AND event_data ? 'step'
        GROUP BY 1
      ) s
    ), '[]'::jsonb)
  ))
  INTO by_module
  FROM mods;

  final := jsonb_build_object(
    'from', _from, 'to', _to, 'cutoff', cutoff, 'upper', upper,
    'macro', COALESCE(macro, '[]'::jsonb),
    'by_module', COALESCE(by_module, '[]'::jsonb),
    'generated_at', now()
  );
  RETURN final;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_onboarding_funnel(timestamptz, timestamptz) TO authenticated, service_role;
