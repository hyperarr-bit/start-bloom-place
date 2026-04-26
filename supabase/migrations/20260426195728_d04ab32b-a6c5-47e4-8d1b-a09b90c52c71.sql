CREATE TABLE public.winback_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  wheel_shown_at timestamptz,
  wheel_spun_at timestamptz,
  offer_shown_at timestamptz,
  accepted_at timestamptz,
  converted_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_winback_attempts_user ON public.winback_attempts(user_id, triggered_at DESC);

ALTER TABLE public.winback_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own winback attempts"
  ON public.winback_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own winback attempts"
  ON public.winback_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own winback attempts"
  ON public.winback_attempts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all winback attempts"
  ON public.winback_attempts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access winback attempts"
  ON public.winback_attempts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);