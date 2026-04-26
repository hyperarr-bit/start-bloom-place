-- 1) Campos de controle em retention_offers_used
ALTER TABLE public.retention_offers_used
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apply_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_apply_error TEXT;

ALTER TABLE public.retention_offers_used
  DROP CONSTRAINT IF EXISTS retention_offers_status_check;
ALTER TABLE public.retention_offers_used
  ADD CONSTRAINT retention_offers_status_check
  CHECK (status IN ('active','applied','failed','expired','consumed'));

CREATE INDEX IF NOT EXISTS idx_retention_offers_pending
  ON public.retention_offers_used(user_id, offer_type, status)
  WHERE status = 'active';

-- 2) RPC: pega desconto pendente de um user
CREATE OR REPLACE FUNCTION public.pending_discount_for_user(_user_id uuid)
RETURNS TABLE(
  id uuid,
  offer_type text,
  metadata jsonb,
  used_at timestamptz,
  apply_attempts int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, offer_type, metadata, used_at, apply_attempts
  FROM public.retention_offers_used
  WHERE user_id = _user_id
    AND offer_type = 'discount'
    AND status = 'active'
  ORDER BY used_at DESC
  LIMIT 1;
$$;

-- 3) RPC: breakdown de ofertas de retention (admin)
CREATE OR REPLACE FUNCTION public.admin_retention_offers_breakdown()
RETURNS TABLE(
  offer_type text,
  status text,
  count bigint,
  pct_of_type numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT offer_type, status, COUNT(*)::bigint AS cnt
    FROM public.retention_offers_used
    GROUP BY offer_type, status
  ),
  totals AS (
    SELECT offer_type, SUM(cnt)::bigint AS total
    FROM base GROUP BY offer_type
  )
  SELECT
    b.offer_type,
    b.status,
    b.cnt,
    CASE WHEN t.total > 0 THEN ROUND((b.cnt::numeric / t.total) * 100, 2) ELSE 0 END
  FROM base b
  JOIN totals t ON t.offer_type = b.offer_type
  ORDER BY b.offer_type, b.status;
END;
$$;

-- 4) Atualiza handle_new_user para emitir trial_started
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, created_at) VALUES (NEW.id, NOW());

  -- Seed 8 onboarding emails (D0 immediate, then D1..D7)
  INSERT INTO public.trial_email_schedule (user_id, email_key, send_at) VALUES
    (NEW.id, 'trial-welcome',         NEW.created_at),
    (NEW.id, 'trial-d1-first-action', NEW.created_at + interval '1 day'),
    (NEW.id, 'trial-d2-finance',      NEW.created_at + interval '2 days'),
    (NEW.id, 'trial-d3-habit',        NEW.created_at + interval '3 days'),
    (NEW.id, 'trial-d4-progress',     NEW.created_at + interval '4 days'),
    (NEW.id, 'trial-d5-value',        NEW.created_at + interval '5 days'),
    (NEW.id, 'trial-d6-convert',      NEW.created_at + interval '6 days'),
    (NEW.id, 'trial-d7-last-call',    NEW.created_at + interval '7 days')
  ON CONFLICT (user_id, email_key) DO NOTHING;

  -- Trial started analytics event
  INSERT INTO public.analytics_events (user_id, event_name, event_data, trial_day)
  VALUES (NEW.id, 'trial_started', jsonb_build_object('source','signup'), 0);

  RETURN NEW;
END;
$$;