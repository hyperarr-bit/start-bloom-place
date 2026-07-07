-- Assinantes: a lista precisa do nome (display_name) e do user_id — o user_id
-- é o que abre a "jornada do pagante" (admin_paying_user_funnel) ao clicar.
-- Só acrescenta campos ao JSON de saída; resto igual.

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
           COALESCE(NULLIF(p.display_name, ''), NULLIF(u.raw_user_meta_data->>'display_name', '')) AS display_name
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
  ),
  activity AS (
    SELECT user_id, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
    FROM public.analytics_events
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id
  ),
  modules AS (
    SELECT user_id, COALESCE(NULLIF(event_data->>'tab', ''), '(sem aba)') AS tab, COUNT(*) AS views
    FROM public.analytics_events
    WHERE event_name = 'finance_card_view' AND user_id IN (SELECT user_id FROM subs)
    GROUP BY 1, 2
  ),
  modules_agg AS (
    SELECT user_id, jsonb_agg(jsonb_build_object('tab', tab, 'views', views) ORDER BY views DESC) AS modules
    FROM modules GROUP BY user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', s.user_id,
    'email', s.email,
    'display_name', s.display_name,
    'plan', s.billing_period,
    'status', s.status,
    'subscribed_since', s.created_at,
    'current_period_end', s.current_period_end,
    'first_seen', a.first_seen,
    'last_seen', a.last_seen,
    'modules', COALESCE(ma.modules, '[]'::jsonb)
  ) ORDER BY s.created_at DESC), '[]'::jsonb) INTO result
  FROM subs s
  LEFT JOIN activity a ON a.user_id = s.user_id
  LEFT JOIN modules_agg ma ON ma.user_id = s.user_id;

  RETURN jsonb_build_object('users', result);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_paying_users_detail() TO authenticated;
