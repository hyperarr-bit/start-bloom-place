-- Visibilidade dos eventos do gateway (Cakto/AbacatePay) pro admin.
-- webhook_events é service-role-only (idempotência do webhook); este RPC expõe
-- leitura pra admins — é como saber a hora EXATA de compra/reembolso/cancelamento
-- sem depender do e-mail de notificação (que chega com delay).

CREATE OR REPLACE FUNCTION public.admin_webhook_events(_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'source', w.source,
    'event', w.event,
    'processed_at', w.processed_at
  ) ORDER BY w.processed_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT * FROM public.webhook_events
    ORDER BY processed_at DESC
    LIMIT LEAST(GREATEST(_limit, 1), 1000)
  ) w;

  RETURN jsonb_build_object('events', result);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_webhook_events(int) TO authenticated;
