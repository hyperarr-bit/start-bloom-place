-- 14/07: painel "Campanhas" no admin (estilo UTMify, mas com a NOSSA
-- atribuição — a que sobrevive ao navegador do Instagram). Por campanha:
-- sessões, contas, checkout Pix, vendas (lifetime vs downsell) e receita.
-- Gasto vem do Meta via edge function meta-insights (não daqui).
--
-- Atribuição de venda = primeira UTM vista na jornada do comprador (mesma
-- lógica do backfill da UTMify). Valor real = pedido pago (subscriptions.
-- abacatepay_billing_id casa com pix_generated.order_id → offer).
--
-- utm_campaign pode vir como "id" (anúncios atuais) ou "nome|id" (novos):
-- normalizamos pro id e devolvemos o nome quando existir.

CREATE OR REPLACE FUNCTION public.admin_campaign_metrics(
  _from timestamptz DEFAULT (now() - interval '1 day'),
  _to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ev AS (
    SELECT e.event_name, e.event_data, e.session_id, e.user_id, e.created_at,
      COALESCE(e.event_data->>'utm_source', '')   AS src,
      COALESCE(e.event_data->>'utm_campaign', '') AS camp_raw,
      COALESCE(e.event_data->>'utm_content', '')  AS content
    FROM public.analytics_events e
    LEFT JOIN auth.users u ON u.id = e.user_id
    WHERE e.created_at >= _from AND e.created_at < _to
      AND (e.user_id IS NULL OR NOT public.is_test_user(e.user_id))
      AND (u.email IS NULL OR lower(u.email) IS DISTINCT FROM lower(owner_email))
  ),
  -- chave da campanha: id do meta > orgânico por fonte > sem atribuição
  norm AS (
    SELECT *,
      CASE
        WHEN camp_raw <> '' THEN COALESCE(NULLIF(split_part(camp_raw, '|', 2), ''), camp_raw)
        WHEN src <> '' THEN 'organic:' || src
        ELSE 'none'
      END AS ckey,
      CASE WHEN camp_raw LIKE '%|%' THEN split_part(camp_raw, '|', 1) END AS cname
    FROM ev
  ),
  traffic AS (
    SELECT ckey,
      MAX(cname) AS name_utm,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_view' AND event_data->>'step' = 'start') AS sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success') AS accounts,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open') AS pix_opened,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated') AS pix_generated
    FROM norm
    GROUP BY ckey
  ),
  buyers AS (
    SELECT s.user_id, s.abacatepay_billing_id AS paid_order, s.created_at
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.billing_period = 'lifetime'
      AND s.created_at >= _from AND s.created_at < _to
      AND NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
  ),
  -- primeira UTM da jornada do comprador (qualquer época, não só o período)
  buyer_attr AS (
    SELECT DISTINCT ON (e.user_id) e.user_id,
      CASE
        WHEN COALESCE(e.event_data->>'utm_campaign','') <> ''
          THEN COALESCE(NULLIF(split_part(e.event_data->>'utm_campaign', '|', 2), ''), e.event_data->>'utm_campaign')
        WHEN COALESCE(e.event_data->>'utm_source','') <> '' THEN 'organic:' || (e.event_data->>'utm_source')
        ELSE 'none'
      END AS ckey,
      CASE WHEN e.event_data->>'utm_campaign' LIKE '%|%' THEN split_part(e.event_data->>'utm_campaign', '|', 1) END AS cname,
      COALESCE(e.event_data->>'utm_content', '') AS ad
    FROM public.analytics_events e
    JOIN buyers b ON b.user_id = e.user_id
    WHERE COALESCE(e.event_data->>'utm_source','') <> '' OR COALESCE(e.event_data->>'utm_campaign','') <> ''
    ORDER BY e.user_id, e.created_at ASC
  ),
  -- oferta REALMENTE paga: casa o pedido da assinatura com o pix gerado
  buyer_offer AS (
    SELECT b.user_id,
      COALESCE(
        (SELECT g.event_data->>'offer' FROM public.analytics_events g
          WHERE g.user_id = b.user_id AND g.event_name = 'pix_generated'
            AND g.event_data->>'order_id' = b.paid_order
          ORDER BY g.created_at DESC LIMIT 1),
        (SELECT g.event_data->>'offer' FROM public.analytics_events g
          WHERE g.user_id = b.user_id AND g.event_name = 'pix_generated'
          ORDER BY g.created_at DESC LIMIT 1),
        'lifetime'
      ) AS offer
    FROM buyers b
  ),
  buyer_full AS (
    SELECT b.user_id,
      COALESCE(ba.ckey, 'none') AS ckey,
      ba.cname,
      COALESCE(ba.ad, '') AS ad,
      bo.offer,
      CASE WHEN bo.offer = 'downsell' THEN 1490 ELSE 2790 END AS cents
    FROM buyers b
    LEFT JOIN buyer_attr ba ON ba.user_id = b.user_id
    LEFT JOIN buyer_offer bo ON bo.user_id = b.user_id
  ),
  sales AS (
    SELECT ckey, MAX(cname) AS name_utm,
      COUNT(*) AS sales,
      COUNT(*) FILTER (WHERE offer = 'downsell') AS sales_downsell,
      COUNT(*) FILTER (WHERE offer <> 'downsell') AS sales_lifetime,
      SUM(cents) AS revenue_cents
    FROM buyer_full
    GROUP BY ckey
  ),
  merged AS (
    SELECT COALESCE(t.ckey, s.ckey) AS ckey,
      COALESCE(t.name_utm, s.name_utm) AS name_utm,
      COALESCE(t.sessions, 0) AS sessions,
      COALESCE(t.accounts, 0) AS accounts,
      COALESCE(t.pix_opened, 0) AS pix_opened,
      COALESCE(t.pix_generated, 0) AS pix_generated,
      COALESCE(s.sales, 0) AS sales,
      COALESCE(s.sales_lifetime, 0) AS sales_lifetime,
      COALESCE(s.sales_downsell, 0) AS sales_downsell,
      COALESCE(s.revenue_cents, 0) AS revenue_cents
    FROM traffic t
    FULL OUTER JOIN sales s ON s.ckey = t.ckey
  ),
  ads AS (
    SELECT ckey, ad,
      COUNT(*) AS sales,
      SUM(cents) AS revenue_cents
    FROM buyer_full
    GROUP BY ckey, ad
  )
  SELECT jsonb_build_object(
    'campaigns', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', ckey, 'name_utm', name_utm,
        'sessions', sessions, 'accounts', accounts,
        'pix_opened', pix_opened, 'pix_generated', pix_generated,
        'sales', sales, 'sales_lifetime', sales_lifetime, 'sales_downsell', sales_downsell,
        'revenue_cents', revenue_cents
      ) ORDER BY revenue_cents DESC, sessions DESC), '[]'::jsonb) FROM merged),
    'ads', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', ckey, 'ad', ad, 'sales', sales, 'revenue_cents', revenue_cents
      ) ORDER BY revenue_cents DESC), '[]'::jsonb) FROM ads),
    'totals', jsonb_build_object(
      'sales', (SELECT COALESCE(SUM(sales), 0) FROM merged),
      'revenue_cents', (SELECT COALESCE(SUM(revenue_cents), 0) FROM merged),
      'sessions', (SELECT COALESCE(SUM(sessions), 0) FROM merged)
    ),
    'aliases', COALESCE((SELECT value FROM public.app_config WHERE key = 'campaign_aliases'), '{}'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Apelido de campanha (id → nome legível), salvo em app_config.
CREATE OR REPLACE FUNCTION public.admin_set_campaign_alias(_id text, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.app_config (key, value, updated_at)
  VALUES ('campaign_aliases', jsonb_build_object(_id, _name), now())
  ON CONFLICT (key) DO UPDATE
    SET value = COALESCE(public.app_config.value, '{}'::jsonb) || jsonb_build_object(_id, _name),
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_campaign_metrics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_campaign_alias(text, text) TO authenticated;
