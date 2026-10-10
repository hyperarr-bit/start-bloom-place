-- CAPI do app: IP com prazo + varredura só-listar.
--
-- `revenuecat_events` JÁ EXISTE em produção (Melhorias, 09/10, branch
-- rc-eventos-webhook). A PK é `id text` = id do evento do RevenueCat.
-- O tipo mora em `type`. `aliases` e `ids_anonimos` são text[]. O relógio
-- da linha é `received_at`, não created_at. subscriber_attributes e o
-- TRANSFER ficam dentro de `payload`.
--
-- Se a tabela já existe, este arquivo NÃO mexe nela: não cria coluna
-- paralela, não muda o tipo de `id`, não liga RLS por cima do que já está
-- no ar. O bloco abaixo só cria a MESMA forma num banco vazio.
--
-- IP: tabela própria, sem policy de leitura. Não copiar pra analytics_events.
-- Retenção ~10 dias. O cron apaga sozinho.

DO $$
BEGIN
  IF to_regclass('public.revenuecat_events') IS NULL THEN
    CREATE TABLE public.revenuecat_events (
      id text PRIMARY KEY,
      type text NOT NULL,
      user_id uuid,
      app_user_id text,
      original_app_user_id text,
      aliases text[] NOT NULL DEFAULT '{}',
      ids_anonimos text[] NOT NULL DEFAULT '{}',
      environment text,
      store text,
      product_id text,
      period_type text,
      event_at timestamptz,
      purchased_at timestamptz,
      expiration_at timestamptz,
      grace_period_expiration_at timestamptz,
      motivo text,
      price numeric,
      price_in_purchased_currency numeric,
      currency text,
      transaction_id text,
      original_transaction_id text,
      is_trial_conversion boolean NOT NULL DEFAULT false,
      country_code text,
      offer_code text,
      origem text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      received_at timestamptz,
      ligado_em timestamptz
    );
    CREATE INDEX revenuecat_events_purchased_at_idx ON public.revenuecat_events (purchased_at DESC);
    CREATE INDEX revenuecat_events_received_at_idx ON public.revenuecat_events (received_at DESC);
    CREATE INDEX revenuecat_events_app_user_idx ON public.revenuecat_events (app_user_id);
    ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.revenuecat_events FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.revenuecat_events TO service_role;
  END IF;
END $$;

-- IP + UA. Sem leitura pra anon/authenticated. Sem cópia em analytics_events.
CREATE TABLE IF NOT EXISTS public.app_capi_sinais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  rc_app_user_id text,
  client_ip text NOT NULL,
  user_agent text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '10 days')
);

CREATE INDEX IF NOT EXISTS app_capi_sinais_user_idx ON public.app_capi_sinais (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_capi_sinais_rc_idx ON public.app_capi_sinais (rc_app_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_capi_sinais_expira_idx ON public.app_capi_sinais (expira_em);

ALTER TABLE public.app_capi_sinais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_capi_sinais FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.app_capi_sinais TO service_role;

-- Apaga IP vencido. Não passa por função, então o IP não aparece em log de edge.
SELECT cron.unschedule('app-capi-sinais-expira')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'app-capi-sinais-expira');

SELECT cron.schedule(
  'app-capi-sinais-expira',
  '17 4 * * *',
  $$ DELETE FROM public.app_capi_sinais WHERE expira_em < now(); $$
);

-- Varredura diária "enviado × venda". Corpo sem "enviar": SÓ LISTA.
-- Pra mandar de verdade, outro passo: env META_VARREDURA_ENVIAR=1
-- ou POST de admin {"modo":"varredura","enviar":true}.
SELECT cron.unschedule('meta-varredura-enviado')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-varredura-enviado');

SELECT cron.schedule(
  'meta-varredura-enviado',
  '15 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/meta-backfill-app',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := '{"modo":"varredura"}'::jsonb
  );
  $$
);
