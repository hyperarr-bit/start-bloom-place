-- ============================================================
-- Cancel attempts table
-- ============================================================
CREATE TABLE public.cancel_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT,
  reason_detail TEXT,
  outcome TEXT NOT NULL DEFAULT 'opened',
  subscription_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT cancel_attempts_outcome_check CHECK (
    outcome IN ('opened','reason_given','saved_discount','saved_pause','saved_feedback','churned')
  ),
  CONSTRAINT cancel_attempts_reason_check CHECK (
    reason IS NULL OR reason IN ('too_expensive','not_using','missing_feature','technical_issue','other')
  )
);

ALTER TABLE public.cancel_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cancel attempts"
  ON public.cancel_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own cancel attempts"
  ON public.cancel_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all cancel attempts"
  ON public.cancel_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access cancel attempts"
  ON public.cancel_attempts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_cancel_attempts_user ON public.cancel_attempts(user_id, created_at DESC);
CREATE INDEX idx_cancel_attempts_outcome ON public.cancel_attempts(outcome, created_at DESC);

-- ============================================================
-- Retention offers used table (anti-abuse: 1x per year per type)
-- ============================================================
CREATE TABLE public.retention_offers_used (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  offer_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT retention_offers_type_check CHECK (offer_type IN ('discount','pause'))
);

ALTER TABLE public.retention_offers_used ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own offers used"
  ON public.retention_offers_used FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all offers used"
  ON public.retention_offers_used FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access offers used"
  ON public.retention_offers_used FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_retention_offers_user_type ON public.retention_offers_used(user_id, offer_type, used_at DESC);

-- ============================================================
-- Admin retention stats RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_retention_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  reasons jsonb;
  funnel jsonb;
  save_rate numeric;
  total_attempts bigint;
  saved_count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC)
    INTO reasons
  FROM (
    SELECT reason, COUNT(*)::bigint AS cnt
    FROM public.cancel_attempts
    WHERE created_at > now() - interval '30 days'
      AND reason IS NOT NULL
    GROUP BY reason
  ) r;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::bigint,
    COUNT(*) FILTER (WHERE outcome IN ('saved_discount','saved_pause','saved_feedback')
      AND created_at > now() - interval '30 days')::bigint
    INTO total_attempts, saved_count
  FROM public.cancel_attempts;

  save_rate := CASE WHEN total_attempts > 0
    THEN ROUND((saved_count::numeric / total_attempts) * 100, 2)
    ELSE 0 END;

  SELECT jsonb_build_object(
    'opened', COUNT(*) FILTER (WHERE outcome = 'opened'),
    'reason_given', COUNT(*) FILTER (WHERE outcome != 'opened'),
    'saved_discount', COUNT(*) FILTER (WHERE outcome = 'saved_discount'),
    'saved_pause', COUNT(*) FILTER (WHERE outcome = 'saved_pause'),
    'saved_feedback', COUNT(*) FILTER (WHERE outcome = 'saved_feedback'),
    'churned', COUNT(*) FILTER (WHERE outcome = 'churned')
  ) INTO funnel
  FROM public.cancel_attempts
  WHERE created_at > now() - interval '30 days';

  result := jsonb_build_object(
    'reasons_30d', COALESCE(reasons, '[]'::jsonb),
    'funnel_30d', funnel,
    'save_rate_30d', save_rate,
    'total_attempts_30d', total_attempts,
    'saved_count_30d', saved_count,
    'generated_at', now()
  );

  RETURN result;
END;
$$;