-- AVISO DE VENDA NO iPHONE DO DONO (29/10/2026) — NÃO APLICADA. Aplicar só com ok do dono, DEPOIS do deploy da
-- função avisar-venda (sem ela o gatilho só faz um POST que volta 404 — a venda nunca é afetada).
--
-- 1) push_dono: os aparelhos que recebem o aviso (inscrição Web Push). RLS fechada: só a service role (as funções
--    vendas-push / avisar-venda) lê e grava. Sem policy nenhuma + REVOKE de anon/authenticated.
-- 2) venda_avisada: 1 linha por venda avisada (chave primária = a venda) — é o que impede aviso em dobro (webhook e
--    cron gravando a mesma venda) e dá o "Hoje: N vendas" do corpo do aviso. Mesma RLS fechada.
-- 3) Gatilhos que chamam a função avisar-venda por pg_net (assíncrono: o INSERT/UPDATE não espera nem quebra se a
--    chamada falhar — EXCEPTION engole tudo). Mesmo padrão de autenticação dos crons (chave ANON no Authorization);
--    o corpo leva só o ponteiro (fonte + id) e a função relê a linha com a service role e decide sozinha.
--      · subscriptions INSERT/UPDATE de Pix do site que vira ativo com valor (pedido novo ou status → active);
--      · subscriptions UPDATE de linha da loja já paga cujo fim anda ≥ 20 dias (renovação);
--      · analytics_events INSERT do marcador meta_capi_app_enviado (cobrança da Apple/Play CONFIRMADA no RevenueCat;
--        o teste grátis gera outro marcador, meta_capi_trial_enviado, que não chama nada).

-- 1) ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_dono (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_ok timestamptz,
  falhas integer NOT NULL DEFAULT 0
);
ALTER TABLE public.push_dono ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_dono FROM anon, authenticated;

-- 2) ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venda_avisada (
  chave text PRIMARY KEY,
  origem text NOT NULL,
  valor_cents integer NOT NULL,
  plano text,
  renovacao boolean NOT NULL DEFAULT false,
  titulo text,
  enviados integer,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venda_avisada_criado_em_idx ON public.venda_avisada (criado_em);
ALTER TABLE public.venda_avisada ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venda_avisada FROM anon, authenticated;

-- 3) ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.avisar_venda_chamar(corpo jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/avisar-venda',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg"}'::jsonb,
    body := corpo
  );
EXCEPTION WHEN OTHERS THEN
  -- aviso é luxo: nunca derruba a gravação da venda
  NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.avisar_venda_chamar(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.avisar_venda_subscriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Pix do site: pedido novo ativo com valor (linha nova, pedido novo na linha própria, ou pendente → ativo)
  IF NEW.payment_method = 'pix' AND NEW.status = 'active' AND COALESCE(NEW.amount_cents, 0) > 0 THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.avisar_venda_chamar(jsonb_build_object('fonte', 'pix', 'id', NEW.id));
    ELSIF OLD.abacatepay_billing_id IS DISTINCT FROM NEW.abacatepay_billing_id OR OLD.status IS DISTINCT FROM 'active' THEN
      PERFORM public.avisar_venda_chamar(jsonb_build_object('fonte', 'pix', 'id', NEW.id));
    END IF;
    RETURN NULL;
  END IF;
  -- Loja: renovação de linha já paga (o período antigo tinha ≥ 10 dias, então não era o teste grátis)
  IF TG_OP = 'UPDATE' AND NEW.payment_method = 'play_store' AND NEW.status = 'active'
     AND NEW.revenuecat_subscription_id IS NOT NULL
     AND OLD.current_period_end IS NOT NULL AND NEW.current_period_end IS NOT NULL AND NEW.current_period_start IS NOT NULL
     AND NEW.current_period_end >= OLD.current_period_end + interval '20 days'
     AND OLD.current_period_end >= NEW.current_period_start + interval '10 days'
     AND COALESCE(NEW.billing_period, '') <> 'lifetime' THEN
    PERFORM public.avisar_venda_chamar(jsonb_build_object('fonte', 'renovacao', 'id', NEW.id, 'fim_antigo', OLD.current_period_end));
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- qualquer surpresa aqui (coluna, tipo) nunca derruba a gravação da assinatura
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.avisar_venda_subscriptions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS avisar_venda_ins ON public.subscriptions;
CREATE TRIGGER avisar_venda_ins
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.avisar_venda_subscriptions();

DROP TRIGGER IF EXISTS avisar_venda_upd ON public.subscriptions;
CREATE TRIGGER avisar_venda_upd
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.avisar_venda_subscriptions();

CREATE OR REPLACE FUNCTION public.avisar_venda_marcador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.avisar_venda_chamar(jsonb_build_object('fonte', 'loja', 'id', NEW.id));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.avisar_venda_marcador() FROM PUBLIC, anon, authenticated;

-- WHEN no próprio gatilho: os milhares de eventos comuns do dia nem entram na função
DROP TRIGGER IF EXISTS avisar_venda_marcador ON public.analytics_events;
CREATE TRIGGER avisar_venda_marcador
  AFTER INSERT ON public.analytics_events
  FOR EACH ROW WHEN (NEW.event_name = 'meta_capi_app_enviado')
  EXECUTE FUNCTION public.avisar_venda_marcador();
