-- 1. user_activations
CREATE TABLE public.user_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, action_key)
);
CREATE INDEX idx_user_activations_user ON public.user_activations(user_id);
ALTER TABLE public.user_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own activations" ON public.user_activations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own activations" ON public.user_activations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all activations" ON public.user_activations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role full access activations" ON public.user_activations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. analytics_events
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  trial_day integer,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name, created_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own events" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins read all events" ON public.analytics_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role full access events" ON public.analytics_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. variant_key on schedule
ALTER TABLE public.trial_email_schedule ADD COLUMN IF NOT EXISTS variant_key text;

-- 4. Backfill activations from existing user_data
INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_transaction', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%financas_transactions%' OR key LIKE '%transaction%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_habit', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%habits%' OR key LIKE '%habit%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_workout', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%treino%' OR key LIKE '%workout%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_meal', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%dieta%' OR key LIKE '%meal%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_task', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%rotina%' OR key LIKE '%task%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_water_log', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%hidratacao%' OR key LIKE '%water%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

INSERT INTO public.user_activations (user_id, action_key, completed_at)
SELECT user_id, 'first_note', MIN(created_at)
FROM public.user_data
WHERE key LIKE '%notes%' OR key LIKE '%note%'
GROUP BY user_id
ON CONFLICT (user_id, action_key) DO NOTHING;

-- 5. Admin RPCs

CREATE OR REPLACE FUNCTION public.admin_activation_funnel()
RETURNS TABLE(action_key text, completed_count bigint, total_users bigint, pct numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE total bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO total FROM auth.users;
  RETURN QUERY
  SELECT
    a.action_key,
    COUNT(DISTINCT a.user_id)::bigint AS completed_count,
    total AS total_users,
    CASE WHEN total > 0 THEN ROUND((COUNT(DISTINCT a.user_id)::numeric / total) * 100, 2) ELSE 0 END AS pct
  FROM public.user_activations a
  GROUP BY a.action_key
  ORDER BY completed_count DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_email_variant_stats()
RETURNS TABLE(
  email_key text,
  variant_key text,
  sent_count bigint,
  banner_clicks_after bigint,
  conversions_48h bigint,
  ctr_pct numeric,
  conversion_pct numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH sent AS (
    SELECT s.email_key, COALESCE(s.variant_key, 'default') AS variant_key, s.user_id, s.sent_at
    FROM public.trial_email_schedule s
    WHERE s.status = 'sent' AND s.sent_at IS NOT NULL
  ),
  agg AS (
    SELECT
      sent.email_key,
      sent.variant_key,
      COUNT(*)::bigint AS sent_count,
      COUNT(DISTINCT (
        SELECT 1 FROM public.analytics_events e
        WHERE e.user_id = sent.user_id
          AND e.event_name = 'trial_banner_click'
          AND e.created_at BETWEEN sent.sent_at AND sent.sent_at + interval '48 hours'
      ))::bigint AS banner_clicks_after,
      COUNT(DISTINCT (
        SELECT 1 FROM public.subscriptions sub
        WHERE sub.user_id = sent.user_id
          AND sub.status = 'active'
          AND sub.created_at BETWEEN sent.sent_at AND sent.sent_at + interval '48 hours'
      ))::bigint AS conversions_48h
    FROM sent
    GROUP BY sent.email_key, sent.variant_key
  )
  SELECT
    a.email_key,
    a.variant_key,
    a.sent_count,
    a.banner_clicks_after,
    a.conversions_48h,
    CASE WHEN a.sent_count > 0 THEN ROUND((a.banner_clicks_after::numeric / a.sent_count) * 100, 2) ELSE 0 END AS ctr_pct,
    CASE WHEN a.sent_count > 0 THEN ROUND((a.conversions_48h::numeric / a.sent_count) * 100, 2) ELSE 0 END AS conversion_pct
  FROM agg a
  ORDER BY a.email_key, a.variant_key;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_conversion_by_trial_day()
RETURNS TABLE(trial_day integer, conversions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT
    LEAST(8, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.created_at - u.created_at)) / 86400)::int))::int AS trial_day,
    COUNT(*)::bigint AS conversions
  FROM public.subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE s.status = 'active'
  GROUP BY 1
  ORDER BY 1;
END; $$;