CREATE OR REPLACE FUNCTION public.admin_tutorial_users(_action_key text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, email text, completed_at timestamp with time zone, action_key text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reset_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT (value->>'at')::timestamptz INTO reset_at FROM public.app_config WHERE key = 'analytics_reset_at';
  RETURN QUERY
  SELECT
    a.user_id,
    u.email::text,
    a.completed_at,
    a.action_key
  FROM public.user_activations a
  JOIN auth.users u ON u.id = a.user_id
  WHERE (_action_key IS NULL OR a.action_key = _action_key)
    AND NOT public.is_test_user(a.user_id)
    AND (reset_at IS NULL OR a.completed_at >= reset_at)
  ORDER BY a.completed_at DESC;
END;
$function$;