CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs antigos (idempotência da migration)
SELECT cron.unschedule('tick-trial-active-days') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tick-trial-active-days');
SELECT cron.unschedule('sweep-pending-discounts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-pending-discounts');

-- Daily 06:00 UTC: emit trial_day_X_active events
SELECT cron.schedule(
  'tick-trial-active-days',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/tick-trial-active-days',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Daily 03:00 UTC: sweep pending retention discounts (safety net for webhook)
SELECT cron.schedule(
  'sweep-pending-discounts',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/apply-pending-discounts',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);