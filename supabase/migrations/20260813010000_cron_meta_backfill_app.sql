-- 13/08: a Meta passa a receber TODA venda do app, sem depender do caminho ao vivo.
--
-- Achado que motivou: cruzando as vendas desde 11/08, nenhuma compra do fluxo
-- ANÔNIMO (v48+, cadastro depois do pagamento — hoje o caminho padrão) chegou
-- sozinha na Meta: 0 de 5. As 3 de quem já estava logado passaram. Ou seja, a
-- campanha de app estava otimizando sem enxergar a maior parte das vendas —
-- justamente o que o SDK da v49 veio consertar.
--
-- Este cron não tenta adivinhar a causa: a Meta aceita evento de até 7 DIAS,
-- então varrer a cada 15 min recupera o que escapar, qualquer que seja o motivo.
-- A função é idempotente (marcador meta_capi_app_enviado + tx), pula conta de
-- teste e, neste modo, não devolve e-mail de ninguém — mesma justificativa de
-- segurança do cron do pix-reconcile: com chave anônima o pior que se consegue
-- é fazer a Meta receber vendas que de fato aconteceram.
SELECT cron.unschedule('meta-backfill-app')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-backfill-app');

SELECT cron.schedule(
  'meta-backfill-app',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/meta-backfill-app',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{"modo":"cron"}'::jsonb
  );
  $$
);
