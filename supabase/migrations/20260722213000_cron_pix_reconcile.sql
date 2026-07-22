-- 22/07: reconciliação automática de Pix pago-sem-acesso a cada 15 min.
-- A pix-reconcile confere o status DIRETO no gateway (Abacate/Asaas/Pagar.me)
-- pros QRs recentes de quem não tem assinatura e credita o que estiver pago
-- (idempotente; evento pix_reconciled de auditoria). Cobre o buraco achado na
-- auditoria de 22/07: webhook morto = pagante sem acesso até reabrir o modal.
-- Auth: Bearer anon (mesmo padrão do cron do recovery-emails) — a função só
-- credita cobrança confirmada PAID pelo próprio gateway; sem input que cunhe
-- acesso, o endpoint é seguro por construção.
SELECT cron.unschedule('pix-reconcile')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pix-reconcile');

SELECT cron.schedule(
  'pix-reconcile',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/pix-reconcile',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{"hours":48}'::jsonb
  );
  $$
);
