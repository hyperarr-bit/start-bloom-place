-- ROI REAL DA WEB, POR CAMPANHA E POR ANÚNCIO (20/09/2026).
--
-- Pedido do dono: "focar na web, pois é algo certo, eu consigo metrificar de
-- onde vem cada venda". A Meta atribui por modelo; aqui a atribuição é a
-- NOSSA: a sessão que pagou o Pix carrega a utm do clique (utm_campaign =
-- id da campanha, utm_content = id do anúncio, fbclid). Só sessões da WEB —
-- sessão do app (tem app_device_info) fica de fora, senão o funil W do
-- Android/iPhone entra na conta da web.
--
-- Passos por sessão (contados uma vez cada): start → quiz_1 → conta criada
-- (signup_success) → paywall (funnel_view offer ou paywall_view) → pix
-- gerado → pix pago. Receita: a assinatura Pix do mesmo usuário criada até
-- 15 min depois do pix_confirmed (valor real cobrado); sem assinatura casada,
-- cai no preço da oferta.
CREATE OR REPLACE FUNCTION public.admin_web_roi(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ev AS (
    SELECT e.session_id, e.user_id, e.event_name, e.event_data, e.created_at
    FROM public.analytics_events e
    WHERE e.created_at >= _from AND e.created_at < _to AND e.session_id IS NOT NULL
  ),
  app_sess AS (
    SELECT DISTINCT session_id FROM ev WHERE event_name = 'app_device_info'
  ),
  web AS (
    SELECT * FROM ev WHERE session_id NOT IN (SELECT session_id FROM app_sess)
  ),
  origem AS (
    -- primeiro evento da sessão que trouxe utm (clique) — senão, o primeiro de todos
    SELECT DISTINCT ON (session_id)
      session_id,
      COALESCE(NULLIF(event_data->>'utm_campaign',''), '') AS camp,
      COALESCE(NULLIF(event_data->>'utm_content',''), '') AS ad,
      COALESCE(NULLIF(event_data->>'utm_source',''), '') AS src,
      (COALESCE(event_data->>'fbclid','') <> '') AS fbclid
    FROM web
    WHERE event_name IN ('origem_usuario','landing_view','funnel_view','porta_vista')
    ORDER BY session_id,
      (COALESCE(event_data->>'utm_campaign','') = '') ASC,
      created_at ASC
  ),
  passos AS (
    SELECT session_id,
      bool_or(event_name = 'funnel_view' AND event_data->>'step' = 'start') AS s_start,
      bool_or(event_name = 'funnel_view' AND event_data->>'step' = 'quiz_1') AS s_quiz,
      bool_or(event_name = 'funnel_click' AND event_data->>'cta' = 'signup_success') AS s_conta,
      bool_or((event_name = 'funnel_view' AND event_data->>'step' = 'offer') OR event_name = 'paywall_view') AS s_paywall,
      bool_or(event_name = 'pix_generated') AS s_pix,
      bool_or(event_name = 'pix_confirmed') AS s_pago,
      MIN(created_at) FILTER (WHERE event_name = 'pix_confirmed') AS pago_em,
      MAX(user_id::text) FILTER (WHERE user_id IS NOT NULL) AS uid,
      MAX(event_data->>'offer') FILTER (WHERE event_name = 'pix_confirmed') AS oferta
    FROM web
    GROUP BY session_id
  ),
  receita AS (
    SELECT p.session_id,
      COALESCE(
        (SELECT s.amount_cents FROM public.subscriptions s
          WHERE s.user_id::text = p.uid AND s.payment_method = 'pix'
            AND s.created_at BETWEEN p.pago_em - interval '15 minutes' AND p.pago_em + interval '15 minutes'
          ORDER BY s.created_at DESC LIMIT 1),
        CASE p.oferta
          WHEN 'w27' THEN 2790 WHEN 'w25' THEN 2490 WHEN 'w47' THEN 4790 WHEN 'w97' THEN 9790
          WHEN 'lifetime' THEN 9790 WHEN 'downsell' THEN 1990 ELSE 0 END
      ) AS cents
    FROM passos p WHERE p.s_pago
  ),
  linhas AS (
    SELECT
      COALESCE(o.camp, '') AS camp, COALESCE(o.ad, '') AS ad, COALESCE(o.src, '') AS src,
      COUNT(*) AS sessoes,
      COUNT(*) FILTER (WHERE p.s_start) AS start,
      COUNT(*) FILTER (WHERE p.s_quiz) AS quiz,
      COUNT(*) FILTER (WHERE p.s_conta) AS contas,
      COUNT(*) FILTER (WHERE p.s_paywall) AS paywall,
      COUNT(*) FILTER (WHERE p.s_pix) AS pix_gerado,
      COUNT(*) FILTER (WHERE p.s_pago) AS pix_pago,
      COALESCE(SUM(r.cents), 0) AS receita_cents,
      COUNT(*) FILTER (WHERE o.fbclid) AS com_fbclid
    FROM passos p
    LEFT JOIN origem o ON o.session_id = p.session_id
    LEFT JOIN receita r ON r.session_id = p.session_id
    GROUP BY 1, 2, 3
  )
  SELECT jsonb_build_object(
    'linhas', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.receita_cents DESC, l.sessoes DESC) FROM linhas l), '[]'::jsonb),
    'total', (SELECT jsonb_build_object(
        'sessoes', SUM(sessoes), 'start', SUM(start), 'quiz', SUM(quiz), 'contas', SUM(contas),
        'paywall', SUM(paywall), 'pix_gerado', SUM(pix_gerado), 'pix_pago', SUM(pix_pago), 'receita_cents', SUM(receita_cents))
      FROM linhas)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_web_roi(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_web_roi(timestamptz, timestamptz) TO authenticated;
