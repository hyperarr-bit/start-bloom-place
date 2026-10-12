-- LEMBRETE DA PORTA (/comece) — agendamento (12/10/2026). NÃO ESTÁ ATIVO.
--
-- Fica FORA de supabase/migrations de propósito: aplicar as migrações não liga
-- nada. Quem liga é o dono, rodando isto no SQL Editor DEPOIS de:
--   (1) porta-handoff publicada com a ação "lembretes"
--       (supabase functions deploy porta-handoff --no-verify-jwt);
--   (2) um ENSAIO conferido (não gera código nem manda e-mail, só conta):
--       curl -s -X POST https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/porta-handoff \
--         -H 'Content-Type: application/json' -H "x-cron-secret: <o segredo>" \
--         -d '{"acao":"lembretes","ensaio":true}'
--       → { n1: { candidatos, enviaria, pulados }, n2: … }
--
-- A cada 15 minutos. O 1º lembrete pega contas criadas há 60–120 min (cada
-- conta passa ~4 vezes pela janela; porta_lembrete_enviado {n:1} garante 1
-- envio). O 2º só manda das 9h às 12h de Brasília, pra contas criadas ontem —
-- a regra de horário mora na função, então o cron pode rodar o dia todo.
--
-- O segredo vai num HEADER (x-cron-secret), lido do Vault do Supabase (não
-- deste arquivo — o repositório é público), e tem que ser o mesmo valor de
-- PORTA_CRON_SECRET nos secrets da função. Sem esse secret na função, ela
-- recusa a ação (403).
--
--   1) Vault:   SELECT vault.create_secret('<valor-aleatorio-longo>', 'porta_cron_secret');
--   2) Secrets: supabase secrets set PORTA_CRON_SECRET='<o mesmo valor>'
--   3) Este arquivo inteiro no SQL Editor.
--
-- Desligar: SELECT cron.unschedule('porta-lembretes');

SELECT cron.unschedule('porta-lembretes')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'porta-lembretes');

SELECT cron.schedule(
  'porta-lembretes',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/porta-handoff',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'porta_cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('acao', 'lembretes'),
    timeout_milliseconds := 60000
  );
  $$
);
