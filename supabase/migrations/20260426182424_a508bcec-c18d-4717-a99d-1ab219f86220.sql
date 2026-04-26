-- 1. Trial email schedule
CREATE TABLE public.trial_email_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_key text NOT NULL,
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_key)
);
CREATE INDEX idx_trial_email_schedule_due ON public.trial_email_schedule (send_at) WHERE status = 'pending';
ALTER TABLE public.trial_email_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own schedule" ON public.trial_email_schedule
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role full access trial schedule" ON public.trial_email_schedule
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access push subs" ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Update handle_new_user to also seed the trial email schedule
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (recreate idempotently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill schedule for existing users who don't have it yet
INSERT INTO public.trial_email_schedule (user_id, email_key, send_at)
SELECT u.id, k.email_key,
  u.created_at + (k.day || ' days')::interval
FROM auth.users u
CROSS JOIN (VALUES
  ('trial-welcome', 0),
  ('trial-d1-first-action', 1),
  ('trial-d2-finance', 2),
  ('trial-d3-habit', 3),
  ('trial-d4-progress', 4),
  ('trial-d5-value', 5),
  ('trial-d6-convert', 6),
  ('trial-d7-last-call', 7)
) AS k(email_key, day)
ON CONFLICT (user_id, email_key) DO NOTHING;