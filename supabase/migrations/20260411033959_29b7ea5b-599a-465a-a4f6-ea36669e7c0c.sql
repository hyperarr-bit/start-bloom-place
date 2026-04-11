
CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- RLS: only service_role can access
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
ON public.app_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
