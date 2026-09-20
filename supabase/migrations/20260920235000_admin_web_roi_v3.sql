-- ROI REAL DA WEB, v3 (20/09/2026, noite) — a v2 estourava o statement timeout: o CTE
-- `toques` varria 8 dias de eventos e o LATERAL por sessão virava sessões × toques.
-- Agora `toques` só olha os usuários que aparecem na janela (uuid, usa o índice).
-- ROI REAL DA WEB, v2 (20/09/2026, noite) — duas correções que o dono pegou olhando o kenny g:
--
-- (1) PAGO = DINHEIRO, não o evento do cliente. A v1 contava "pix pago" só quando o
--     navegador da pessoa emitia `pix_confirmed` — quem gerava o Pix, fechava a aba e
--     pagava no app do banco ficava invisível (2 das 3 vendas do kenny g em 20/09).
--     Agora: o `order_id` do `pix_generated` da sessão casa com
--     `subscriptions.abacatepay_billing_id` (11/11 vendas de 20/09 casam), e a receita
--     é o `amount_cents` real dessa assinatura. O evento fica só como reserva.
-- (2) SESSÃO SEM UTM HERDA O ÚLTIMO CLIQUE PAGO DA MESMA PESSOA nos 7 dias anteriores
--     (o "último clique" que a Meta usa). Quem clicou no anúncio, criou conta e voltou
--     depois pra pagar caía em "(sem utm)". Linha `herdadas` mostra quantas foram assim.
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
  sess AS (
    SELECT session_id, MIN(created_at) AS t0, MAX(user_id::text) FILTER (WHERE user_id IS NOT NULL) AS uid
    FROM web GROUP BY session_id
  ),
  origem_sessao AS (
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
  toques AS (
    -- cliques pagos da mesma pessoa até 7 dias antes da janela (pra herdar)
    SELECT e.user_id::text AS uid, e.created_at,
      NULLIF(e.event_data->>'utm_campaign','') AS camp,
      COALESCE(NULLIF(e.event_data->>'utm_content',''), '') AS ad,
      COALESCE(NULLIF(e.event_data->>'utm_source',''), '') AS src,
      (COALESCE(e.event_data->>'fbclid','') <> '') AS fbclid
    FROM public.analytics_events e
    WHERE e.created_at >= _from - interval '7 days' AND e.created_at < _to
      AND e.user_id IS NOT NULL
      AND e.user_id IN (SELECT s2.uid::uuid FROM sess s2 WHERE s2.uid IS NOT NULL)
      AND COALESCE(e.event_data->>'utm_campaign','') <> ''
      AND e.event_name IN ('origem_usuario','landing_view','funnel_view','porta_vista','pix_generated')
  ),
  origem AS (
    SELECT s.session_id,
      COALESCE(NULLIF(o.camp,''), h.camp, '') AS camp,
      CASE WHEN NULLIF(o.camp,'') IS NOT NULL THEN o.ad ELSE COALESCE(h.ad, '') END AS ad,
      CASE WHEN NULLIF(o.camp,'') IS NOT NULL THEN o.src ELSE COALESCE(h.src, o.src, '') END AS src,
      (COALESCE(o.fbclid, false) OR COALESCE(h.fbclid, false)) AS fbclid,
      (NULLIF(o.camp,'') IS NULL AND h.camp IS NOT NULL) AS herdou
    FROM sess s
    LEFT JOIN origem_sessao o ON o.session_id = s.session_id
    LEFT JOIN LATERAL (
      SELECT t.camp, t.ad, t.src, t.fbclid
      FROM toques t
      WHERE s.uid IS NOT NULL AND t.uid = s.uid
        AND t.created_at < s.t0 AND t.created_at >= s.t0 - interval '7 days'
      ORDER BY t.created_at DESC
      LIMIT 1
    ) h ON true
  ),
  pedidos AS (
    SELECT session_id, event_data->>'order_id' AS order_id, created_at
    FROM web
    WHERE event_name = 'pix_generated' AND COALESCE(event_data->>'order_id','') <> ''
  ),
  pagos AS (
    -- cada pedido pago conta UMA vez, na última sessão que o gerou
    SELECT DISTINCT ON (sub.abacatepay_billing_id)
      p.session_id, sub.amount_cents AS cents, sub.created_at AS pago_em
    FROM pedidos p
    JOIN public.subscriptions sub
      ON sub.abacatepay_billing_id = p.order_id AND sub.payment_method <> 'play_store'
    ORDER BY sub.abacatepay_billing_id, p.created_at DESC
  ),
  pagos_sessao AS (
    SELECT session_id, SUM(cents) AS cents, MIN(pago_em) AS pago_em FROM pagos GROUP BY session_id
  ),
  passos AS (
    SELECT w.session_id,
      bool_or(w.event_name = 'funnel_view' AND w.event_data->>'step' = 'start') AS s_start,
      bool_or(w.event_name = 'funnel_view' AND w.event_data->>'step' = 'quiz_1') AS s_quiz,
      bool_or(w.event_name = 'funnel_click' AND w.event_data->>'cta' = 'signup_success') AS s_conta,
      bool_or((w.event_name = 'funnel_view' AND w.event_data->>'step' = 'offer') OR w.event_name = 'paywall_view') AS s_paywall,
      bool_or(w.event_name = 'pix_generated') AS s_pix,
      bool_or(w.event_name = 'pix_confirmed') AS s_evento_pago,
      MAX(w.event_data->>'offer') FILTER (WHERE w.event_name = 'pix_confirmed') AS oferta
    FROM web w
    GROUP BY w.session_id
  ),
  receita AS (
    SELECT p.session_id,
      COALESCE(
        ps.cents,
        CASE p.oferta
          WHEN 'w27' THEN 2790 WHEN 'w25' THEN 2490 WHEN 'w47' THEN 4790 WHEN 'w97' THEN 9790
          WHEN 'lifetime' THEN 9790 WHEN 'downsell' THEN 1990 ELSE 0 END
      ) AS cents,
      (ps.session_id IS NOT NULL OR p.s_evento_pago) AS pago
    FROM passos p
    LEFT JOIN pagos_sessao ps ON ps.session_id = p.session_id
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
      COUNT(*) FILTER (WHERE r.pago) AS pix_pago,
      COALESCE(SUM(r.cents) FILTER (WHERE r.pago), 0) AS receita_cents,
      COUNT(*) FILTER (WHERE o.fbclid) AS com_fbclid,
      COUNT(*) FILTER (WHERE o.herdou) AS herdadas
    FROM passos p
    LEFT JOIN origem o ON o.session_id = p.session_id
    LEFT JOIN receita r ON r.session_id = p.session_id
    GROUP BY 1, 2, 3
  )
  SELECT jsonb_build_object(
    'linhas', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.receita_cents DESC, l.sessoes DESC) FROM linhas l), '[]'::jsonb),
    'total', (SELECT jsonb_build_object(
        'sessoes', SUM(sessoes), 'start', SUM(start), 'quiz', SUM(quiz), 'contas', SUM(contas),
        'paywall', SUM(paywall), 'pix_gerado', SUM(pix_gerado), 'pix_pago', SUM(pix_pago), 'receita_cents', SUM(receita_cents),
        'herdadas', SUM(herdadas))
      FROM linhas)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_web_roi(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_web_roi(timestamptz, timestamptz) TO authenticated;
