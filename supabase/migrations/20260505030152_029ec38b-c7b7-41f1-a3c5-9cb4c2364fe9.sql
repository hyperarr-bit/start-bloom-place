SELECT cron.schedule(
  'subscription-grace-cleanup-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/subscription-grace-cleanup',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);