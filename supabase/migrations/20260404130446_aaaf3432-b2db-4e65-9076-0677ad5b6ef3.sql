
CREATE TABLE public.module_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id TEXT NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.module_analytics ENABLE ROW LEVEL SECURITY;

-- Users can insert their own analytics
CREATE POLICY "Users can insert own analytics"
  ON public.module_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only admin can read all analytics
CREATE POLICY "Admin can read all analytics"
  ON public.module_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = '2c896992-6849-4ca6-9a66-5c2414bb9424'::uuid);

-- Index for fast queries
CREATE INDEX idx_module_analytics_user ON public.module_analytics (user_id);
CREATE INDEX idx_module_analytics_module ON public.module_analytics (module_id);
CREATE INDEX idx_module_analytics_entered ON public.module_analytics (entered_at);
