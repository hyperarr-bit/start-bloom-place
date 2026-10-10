-- CAPI do app: eventos do RevenueCat (inclusive anônimo) + IP com prazo.
--
-- O main não tinha `revenuecat_events`. Em 09/10 a Melhorias publicou no
-- projeto (branch rc-eventos-webhook, fora deste git) um webhook que grava
-- anônimo, aliases e TRANSFER. Esta migration cria a tabela se ela não
-- existir e só ACRESCENTA coluna que faltar — não apaga linha e não
-- reescreve created_at antigo com now() (isso faria teste velho parecer de
-- hoje e a Meta receberia StartTrial fora da hora).
--
-- Se o índice único falhar por rc_event_id duplicado, ele é pulado: o
-- webhook loga o erro de upsert e segue. Conferir as colunas no ar antes
-- de publicar a função, se a tabela de 09/10 usar outros nomes.
--
-- IP: tabela própria, sem policy de leitura. Não copiar pra analytics_events.
-- Retenção ~10 dias. O cron apaga sozinho.

CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_event_id text,
  event_type text NOT NULL,
  app_user_id text,
  original_app_user_id text,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_id text,
  store text,
  period_type text,
  transaction_id text,
  original_transaction_id text,
  purchased_at timestamptz,
  expiration_at timestamptz,
  price_cents integer,
  currency text,
  is_trial_conversion boolean NOT NULL DEFAULT false,
  subscriber_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  transferred_from jsonb NOT NULL DEFAULT '[]'::jsonb,
  transferred_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  environment text,
  anonimo boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS rc_event_id text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS app_user_id text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS original_app_user_id text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS aliases jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS product_id text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS store text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS period_type text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS original_transaction_id text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS purchased_at timestamptz;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS expiration_at timestamptz;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS price_cents integer;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS is_trial_conversion boolean DEFAULT false;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS subscriber_attributes jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS transferred_from jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS transferred_to jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS environment text;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS anonimo boolean DEFAULT false;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.revenuecat_events ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'revenuecat_events_rc_event_id_uidx')
     AND NOT EXISTS (
       SELECT 1 FROM (
         SELECT rc_event_id FROM public.revenuecat_events
         WHERE rc_event_id IS NOT NULL
         GROUP BY rc_event_id HAVING count(*) > 1
       ) d
     )
  THEN
    CREATE UNIQUE INDEX revenuecat_events_rc_event_id_uidx ON public.revenuecat_events (rc_event_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS revenuecat_events_purchased_at_idx ON public.revenuecat_events (purchased_at DESC);
CREATE INDEX IF NOT EXISTS revenuecat_events_app_user_idx ON public.revenuecat_events (app_user_id);

ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.revenuecat_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.revenuecat_events TO service_role;

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
