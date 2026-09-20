-- 20/09 (ordem do dono): e-mail de Pix pendente a cada 10 min — ver
-- supabase/functions/pix-pendente-email/index.ts. Mesmo padrão da régua
-- funnel-recovery-emails (net.http_post com a chave anon, corpo {"modo":"cron"}).
SELECT cron.unschedule('pix-pendente-email')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pix-pendente-email');

SELECT cron.schedule(
  'pix-pendente-email',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/pix-pendente-email',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{"modo":"cron"}'::jsonb
  );
  $$
);
