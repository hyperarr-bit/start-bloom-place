-- PIX SEMANAL DOS AFILIADOS — agendamento (09/10/2026). NÃO ESTÁ ATIVO.
--
-- Este arquivo fica FORA de supabase/migrations de propósito: aplicar as
-- migrações não liga o pagamento. Quem liga é o dono, rodando isto no SQL
-- Editor DEPOIS de (1) migração aplicada, (2) função `afiliados` publicada,
-- (3) ASAAS_API_KEY com permissão de transferência e saldo, (4) um
-- `pagar_semana` em ENSAIO conferido na aba Afiliados do /admin.
--
-- Toda segunda às 12:00 UTC = 9h de Brasília (o Brasil não tem horário de
-- verão desde 2019). Mesmo padrão dos outros crons (net.http_post), mas o
-- corpo leva um SEGREDO em vez de só a chave anon: o segredo mora no Vault do
-- Supabase (não neste arquivo — o repositório é público) e tem que ser o
-- mesmo valor de AFILIADOS_CRON_SECRET nos secrets da função.
--
--   1) Vault:   SELECT vault.create_secret('<valor-aleatorio-longo>', 'afiliados_cron_secret');
--   2) Secrets: supabase secrets set AFILIADOS_CRON_SECRET='<o mesmo valor>'
--   3) Este arquivo inteiro no SQL Editor.
--
-- Desligar: SELECT cron.unschedule('afiliados-pagar-semana');

SELECT cron.unschedule('afiliados-pagar-semana')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'afiliados-pagar-semana');

SELECT cron.schedule(
  'afiliados-pagar-semana',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/afiliados',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'action', 'pagar_semana',
      'modo', 'cron',
      'segredo', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'afiliados_cron_secret' LIMIT 1)
    )
  );
  $$
);
