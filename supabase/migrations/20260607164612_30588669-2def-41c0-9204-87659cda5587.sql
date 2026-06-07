
CREATE OR REPLACE FUNCTION public.admin_onboarding_funnel_v2(
  _from timestamptz DEFAULT NULL,
  _to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reset_at timestamptz;
  lo timestamptz;
  hi timestamptz;
  stages jsonb;
  by_module jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  lo := GREATEST(COALESCE(_from, 'epoch'::timestamptz), COALESCE(reset_at, 'epoch'::timestamptz));
  hi := COALESCE(_to, now());

  WITH ev AS (
    SELECT
      event_name,
      event_data,
      COALESCE(user_id::text, session_id) AS uid
    FROM public.analytics_events
    WHERE created_at >= lo AND created_at <= hi
      AND COALESCE(user_id::text, session_id) IS NOT NULL
  ),
  s AS (
    SELECT
      -- 1
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='landing_view' AND COALESCE(event_data->>'source','')='quickstart') AS s1,
      -- 2
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='start_clicked' AND COALESCE(event_data->>'destination','')='module_choice') AS s2,
      -- 3
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='module_picker_view') AS s3,
      -- 4
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_module_chosen') AS s4,
      -- 5
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_module_opened') AS s5,
      -- 6
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='spotlight_step_view') AS s6,
      -- 7
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_completed') AS s7,
      -- 8
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_module_returned') AS s8,
      -- 9
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_all_completed') AS s9,
      -- 10
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quicksignup_step_shown') AS s10,
      -- 11
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quicksignup_completed') AS s11,
      -- 12
      (SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='trial_accepted') AS s12
  )
  SELECT jsonb_build_array(
    jsonb_build_object('key','landing_view','label','Abriram a página "Organize sua vida em 1 só lugar"','users',s1),
    jsonb_build_object('key','start_clicked','label','Clicaram em "Quero começar"','users',s2),
    jsonb_build_object('key','module_picker_view','label','Entraram na página "Por onde você quer começar?"','users',s3),
    jsonb_build_object('key','quickstart_module_chosen','label','Clicaram em um módulo','users',s4),
    jsonb_build_object('key','quickstart_module_opened','label','Entraram de fato no módulo escolhido','users',s5),
    jsonb_build_object('key','spotlight_step_view','label','Fizeram pelo menos 1 passo do tutorial do módulo','users',s6),
    jsonb_build_object('key','quickstart_completed','label','Finalizaram o módulo','users',s7),
    jsonb_build_object('key','quickstart_module_returned','label','Voltaram pra fazer outro módulo','users',s8),
    jsonb_build_object('key','quickstart_all_completed','label','Finalizaram o tutorial inteiro (4 módulos)','users',s9),
    jsonb_build_object('key','quicksignup_step_shown','label','Apareceu o form de cadastro','users',s10),
    jsonb_build_object('key','quicksignup_completed','label','Terminaram o form','users',s11),
    jsonb_build_object('key','trial_accepted','label','Aceitaram os 7 dias grátis','users',s12)
  )
  INTO stages
  FROM s;

  WITH ev AS (
    SELECT event_name, event_data, COALESCE(user_id::text, session_id) AS uid
    FROM public.analytics_events
    WHERE created_at >= lo AND created_at <= hi
      AND COALESCE(user_id::text, session_id) IS NOT NULL
  ),
  mods AS (SELECT unnest(ARRAY['financas','rotina','dieta','metas']) AS m),
  step_agg AS (
    SELECT
      event_data->>'module' AS m,
      (event_data->>'step')::int AS step,
      COUNT(DISTINCT uid) AS users
    FROM ev
    WHERE event_name='spotlight_step_view'
      AND event_data ? 'module' AND event_data ? 'step'
    GROUP BY 1, 2
  ),
  steps_by_mod AS (
    SELECT m, jsonb_object_agg(step::text, users ORDER BY step) AS steps
    FROM step_agg
    WHERE m IS NOT NULL
    GROUP BY m
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'module', mods.m,
      'clicked',  COALESCE((SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_module_chosen' AND event_data->>'module'=mods.m), 0),
      'opened',   COALESCE((SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_module_opened' AND event_data->>'module'=mods.m), 0),
      'completed',COALESCE((SELECT COUNT(DISTINCT uid) FROM ev WHERE event_name='quickstart_completed'    AND event_data->>'module'=mods.m), 0),
      'steps',    COALESCE((SELECT steps FROM steps_by_mod WHERE m=mods.m), '{}'::jsonb)
    )
  )
  INTO by_module
  FROM mods;

  RETURN jsonb_build_object(
    'from', lo,
    'to', hi,
    'stages', stages,
    'by_module', COALESCE(by_module, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_onboarding_funnel_v2(timestamptz, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_onboarding_funnel_v2(timestamptz, timestamptz) FROM anon;
