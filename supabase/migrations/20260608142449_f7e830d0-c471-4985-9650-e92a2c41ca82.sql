
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS source_captured_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan text,
  status text,
  current_period_end timestamptz,
  total_sessions bigint,
  last_session timestamptz,
  top_module text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    u.id, u.email::text, u.created_at, u.last_sign_in_at,
    s.plan, COALESCE(s.status, 'none'), s.current_period_end,
    COALESCE(ma.cnt, 0), ma.last_session, ma.top_module,
    p.utm_source, p.utm_medium, p.utm_campaign, p.referrer
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN LATERAL (
    SELECT plan, status, current_period_end FROM public.subscriptions s2
    WHERE s2.user_id = u.id ORDER BY s2.created_at DESC LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS cnt, MAX(entered_at) AS last_session,
      (SELECT module_id FROM public.module_analytics m2
        WHERE m2.user_id = u.id
        GROUP BY module_id ORDER BY SUM(duration_seconds) DESC LIMIT 1) AS top_module
    FROM public.module_analytics m WHERE m.user_id = u.id
  ) ma ON true
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_lead_sources_summary()
RETURNS TABLE (
  source_label text,
  utm_source text,
  utm_medium text,
  referrer_host text,
  total bigint,
  converted bigint,
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT
      u.id, u.created_at,
      LOWER(COALESCE(p.utm_source, '')) AS us,
      LOWER(COALESCE(p.utm_medium, '')) AS um,
      CASE WHEN p.referrer IS NULL OR p.referrer = '' THEN NULL
        ELSE regexp_replace(regexp_replace(p.referrer, '^https?://(www\.)?', ''), '/.*$', '')
      END AS rh,
      s.status
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN LATERAL (
      SELECT status FROM public.subscriptions s2
      WHERE s2.user_id = u.id ORDER BY s2.created_at DESC LIMIT 1
    ) s ON true
  ),
  labeled AS (
    SELECT
      CASE
        WHEN um IN ('paid','cpc','ppc','ads','social-paid','paidsocial') AND us LIKE '%instagram%' THEN 'Instagram pago'
        WHEN um IN ('paid','cpc','ppc','ads','social-paid','paidsocial') AND us LIKE '%facebook%' THEN 'Facebook pago'
        WHEN um IN ('paid','cpc','ppc','ads','social-paid','paidsocial') AND us LIKE '%meta%' THEN 'Meta pago'
        WHEN um IN ('paid','cpc','ppc','ads','social-paid','paidsocial') AND us LIKE '%tiktok%' THEN 'TikTok pago'
        WHEN um IN ('paid','cpc','ppc','ads','social-paid','paidsocial') AND us LIKE '%google%' THEN 'Google pago'
        WHEN um IN ('paid','cpc','ppc','ads','social-paid','paidsocial') THEN 'Tráfego pago (' || COALESCE(NULLIF(us,''),'?') || ')'
        WHEN us LIKE '%tiktok%' THEN 'TikTok orgânico'
        WHEN us LIKE '%instagram%' THEN 'Instagram orgânico'
        WHEN us LIKE '%youtube%' THEN 'YouTube orgânico'
        WHEN us LIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN us LIKE '%twitter%' OR us LIKE '%x.com%' THEN 'Twitter/X orgânico'
        WHEN us LIKE '%linkedin%' THEN 'LinkedIn orgânico'
        WHEN us <> '' THEN 'UTM: ' || us
        WHEN rh LIKE '%tiktok.com%' THEN 'TikTok orgânico (ref)'
        WHEN rh LIKE '%instagram.com%' THEN 'Instagram orgânico (ref)'
        WHEN rh LIKE '%facebook.com%' OR rh LIKE '%fb.com%' THEN 'Facebook orgânico (ref)'
        WHEN rh LIKE '%youtube.com%' OR rh LIKE '%youtu.be%' THEN 'YouTube orgânico (ref)'
        WHEN rh LIKE '%google.%' THEN 'Google orgânico (ref)'
        WHEN rh LIKE '%bing.%' THEN 'Bing orgânico (ref)'
        WHEN rh LIKE '%whatsapp%' OR rh LIKE '%wa.me%' THEN 'WhatsApp (ref)'
        WHEN rh LIKE '%t.co%' OR rh LIKE '%twitter.com%' OR rh LIKE '%x.com%' THEN 'Twitter/X (ref)'
        WHEN rh LIKE '%linkedin.com%' THEN 'LinkedIn (ref)'
        WHEN rh IS NOT NULL THEN 'Referrer: ' || rh
        ELSE 'Direto / desconhecido'
      END AS source_label,
      us, um, rh, created_at, status
    FROM base
  )
  SELECT
    source_label,
    NULLIF(us,'')::text,
    NULLIF(um,'')::text,
    rh,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE status IN ('active','trialing'))::bigint,
    MIN(created_at), MAX(created_at)
  FROM labeled
  GROUP BY source_label, us, um, rh
  ORDER BY 5 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_lead_sources_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lead_sources_summary() TO authenticated;
