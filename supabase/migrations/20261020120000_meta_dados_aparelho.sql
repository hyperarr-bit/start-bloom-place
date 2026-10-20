-- Dados do aparelho pro CAPI do app (iOS 1.0.17, 20/10/2026).
--
-- O revenuecat-sync grava aqui, uma linha por (transação × mudança do ATT):
--   · sempre: att, plataforma, versão/build do app, versão do iOS;
--   · SÓ com att = 'authorized': IP (header x-forwarded-for), user-agent e IDFA.
-- O meta-backfill-app (ramo meta-capi-dados) lê a linha mais recente da
-- transação e só manda IP/UA/madid + advertiser_tracking_enabled=1 com o aceite.
--
-- Tabela própria e sem policy: anon/authenticated não leem nem escrevem
-- (analytics_events aceita insert do próprio usuário — dava pra forjar um
-- "authorized"). Retenção de 10 dias: a Meta aceita evento de até 7.
-- Regras puras em supabase/functions/_shared/meta-dados-aparelho.ts.

CREATE TABLE IF NOT EXISTS public.meta_dados_aparelho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tx text NOT NULL,
  plataforma text NOT NULL DEFAULT 'ios',
  att text NOT NULL,
  idfa text,
  client_ip text,
  user_agent text,
  app_versao text,
  app_build text,
  os_versao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '10 days'),
  -- Sem aceite do ATT, nada que identifique o aparelho fica guardado.
  CONSTRAINT meta_dados_aparelho_so_com_att CHECK (
    att = 'authorized' OR (idfa IS NULL AND client_ip IS NULL AND user_agent IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS meta_dados_aparelho_tx_idx ON public.meta_dados_aparelho (tx, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_dados_aparelho_expira_idx ON public.meta_dados_aparelho (expira_em);

ALTER TABLE public.meta_dados_aparelho ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meta_dados_aparelho FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.meta_dados_aparelho TO service_role;

-- Apaga o vencido todo dia (direto no banco: o IP não passa por log de função).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('meta-dados-aparelho-expira')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-dados-aparelho-expira');
    PERFORM cron.schedule(
      'meta-dados-aparelho-expira',
      '23 4 * * *',
      $cron$ DELETE FROM public.meta_dados_aparelho WHERE expira_em < now(); $cron$
    );
  END IF;
END $$;
