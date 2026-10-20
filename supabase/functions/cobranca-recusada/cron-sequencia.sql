-- CRON DA SEQUÊNCIA DO CARTÃO RECUSADO (D2/D5/D10) — 20/10/2026.
--
-- NÃO é migration de propósito: fica fora de supabase/migrations pra um
-- `db push` não ligar nada sem querer. Pra ligar (ordem):
--   1. deploy da função:  supabase functions deploy cobranca-recusada
--   2. secret:            supabase secrets set COBRANCA_SEQUENCIA=on
--      (opcional: COBRANCA_SAIR_SECRET=<aleatório>; sem ele o link de sair
--       é assinado com a service role)
--   3. rodar ESTE arquivo no SQL Editor do Supabase (ou copiar pra
--      supabase/migrations/<data>_cron_cobranca_sequencia.sql e dar db push).
-- Desligar: `supabase secrets set COBRANCA_SEQUENCIA=off` (o cron continua
-- chamando e a função responde {desligada:true}) ou o unschedule abaixo.
--
-- De hora em hora, das 9h às 20h de Brasília (12–23 UTC); a função também
-- confere o horário. Mesmo padrão do pix-pendente-email (net.http_post com a
-- chave anon, corpo {"modo":"cron"}): a porta do cron só manda passo devido,
-- idempotente e com o estado conferido no RevenueCat.
SELECT cron.unschedule('cobranca-sequencia')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cobranca-sequencia');

SELECT cron.schedule(
  'cobranca-sequencia',
  '20 12-23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/cobranca-recusada',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{"modo":"cron"}'::jsonb
  );
  $$
);
