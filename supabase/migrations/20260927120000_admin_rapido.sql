-- ADMIN RÁPIDO (27/09) — o /admin voltou a não abrir.
--
-- Sonda de 27/09 (janela de 7 dias):
--   admin_campaign_metrics      500 statement timeout aos 8 s   (Campanhas)
--   admin_acquisition_funnel    400 "field name must not be null" (Funil)
--   admin_paying_users_detail   500 statement timeout aos 30 s  (Pagantes)
--   admin_web_roi               500 statement timeout aos 8,5 s (ROI da web)
--   admin_funnel_users          200, mas em 14,6 s              (Usuários)
--
-- O volume de analytics_events mudou de patamar em setembro: card_view
-- (medição de cards, 12/09) + tráfego pago do funil dão ~30 mil eventos POR
-- DIA. As funções foram escritas quando a janela tinha poucos milhares, e
-- três vícios que eram baratos viraram o gargalo:
--
-- 1. FILTRO DE CONTA DE TESTE LINHA A LINHA. `NOT is_test_user(e.user_id)` +
--    JOIN com auth.users em CADA evento da janela. is_test_user é função
--    SECURITY DEFINER (não entra inline): centenas de milhares de chamadas.
--    Agora a checagem roda UMA vez por usuário distinto (CTE `fora`, que
--    guarda só os poucos excluídos) e vira anti-join.
-- 2. LER A JANELA INTEIRA PRA CONTAR 4 TIPOS DE EVENTO. Campanhas, Funil e
--    Usuários materializavam todo evento da janela (inclusive card_view do
--    app) com o event_data inteiro. Agora cada uma lê só os nomes de evento
--    que conta, pelo índice (event_name, created_at) que já existe, e extrai
--    do JSON só os campos usados.
-- 3. PLANOS QUADRÁTICOS. Em Campanhas, a oferta de cada compra era um CTE
--    juntado de volta por user_id: as duas subconsultas rodavam compradores ×
--    compradores vezes (o timeout em si). No ROI, `session_id NOT IN (SELECT
--    ...)` vira subplano linear quando a lista não cabe no work_mem (toda
--    sessão do app) e o LATERAL da herança varria o CTE inteiro por sessão.
--    Agora: oferta calculada na linha da venda, NOT EXISTS (anti-join com
--    hash) e JOIN + DISTINCT ON.
--
-- O 400 do Funil: o funil de teste grava a resposta do compromisso com
-- `step` no lugar de `q` (ComecarTeste.tsx) — 6,5 mil respostas em 7 dias
-- sem `q`, e jsonb_object_agg recusa chave nula. A pergunta agora é
-- COALESCE(q, step, '(sem pergunta)') e a resposta aceita `answer` ou `a`.
--
-- Mesma assinatura, mesmo JSON de saída e mesma checagem de admin em todas.
-- Diferenças de número, todas documentadas no ponto:
--  - Campanhas: some a linha de campanha que só tinha evento de uso do app
--    (0 sessão, 0 conta, 0 Pix, 0 venda) — era ruído de quem veio de anúncio
--    semanas atrás e segue usando o app. E quem tem 2+ vitalícios criados na
--    janela deixa de valer k² vendas (2 compras contavam 4, com receita em
--    dobro): agora é 1 linha por compra.
--  - Funil: a "sessão do pagante" é a primeira sessão dele na janela (antes:
--    a primeira em que ele era o PRIMEIRO usuário da sessão — só difere em aba
--    compartilhada por duas contas). Quiz passa a mostrar as respostas do
--    funil de teste (antes caíam fora, e derrubavam a função).
--
-- Teto de 60 s em cada função (`SET statement_timeout`), porque CREATE OR
-- REPLACE zera o SET antigo (lição de 26/08) e 8 s é o corte padrão do
-- PostgREST. Painel interno pode esperar; 500 é pior.
--
-- E `SET plan_cache_mode = 'force_custom_plan'`: a partir da 6ª chamada na
-- mesma conexão (o PostgREST reaproveita conexões) o PL/pgSQL passa a usar um
-- plano GENÉRICO, montado sem saber a janela — medido no banco de teste:
-- Usuários de 0,1 s pra 2,4 s na 6ª chamada. É a cara do "30 s · 10,8 s ·
-- 8,7 s na mesma sequência" de 26/08. Replanejar custa milissegundos.
--
-- Função NOVA: admin_uso(_from, _to) — aba "Uso" do /admin (módulos, abas e
-- cards; ver o bloco dela no fim).
--
-- Índices: supabase/sql-manual/20260927_indices_concorrentes.sql (CREATE
-- INDEX CONCURRENTLY não roda dentro da transação de uma migração). As funções
-- funcionam sem eles; com eles, Pagantes lê só o índice.
--
-- Arquivo transacional: o `supabase db push` manda tudo num lote implícito
-- (ou tudo entra, ou nada). Nada aqui apaga dado nem mexe em tabela.


-- ===================================================================
-- 1. CAMPANHAS — admin_campaign_metrics
-- ===================================================================
CREATE OR REPLACE FUNCTION public.admin_campaign_metrics(
  _from timestamptz DEFAULT (now() - interval '1 day'),
  _to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
SET plan_cache_mode = 'force_custom_plan'
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ev_bruto AS MATERIALIZED (
    -- Só os 4 eventos que a tabela conta, já no passo certo — pelo índice
    -- (event_name, created_at). Antes: todo evento da janela.
    SELECT e.event_name, e.session_id, e.user_id,
      COALESCE(e.event_data->>'utm_source', '')   AS src,
      COALESCE(e.event_data->>'utm_campaign', '') AS camp_raw
    FROM public.analytics_events e
    WHERE e.event_name IN ('funnel_view', 'funnel_click', 'pix_checkout_open', 'pix_generated')
      AND e.created_at >= _from AND e.created_at < _to
      AND CASE e.event_name
            WHEN 'funnel_view'  THEN e.event_data->>'step' = 'start'
            WHEN 'funnel_click' THEN e.event_data->>'cta' = 'signup_success'
            ELSE true
          END
  ),
  -- Conta de teste / do dono: checada UMA vez por usuário, não por evento.
  fora AS MATERIALIZED (
    SELECT x.user_id
    FROM (SELECT DISTINCT user_id FROM ev_bruto WHERE user_id IS NOT NULL) x
    LEFT JOIN auth.users u ON u.id = x.user_id
    WHERE public.is_test_user(x.user_id)
       OR lower(u.email) = lower(owner_email)
  ),
  norm AS (
    SELECT b.*,
      CASE
        WHEN b.camp_raw <> '' THEN COALESCE(NULLIF(split_part(b.camp_raw, '|', 2), ''), b.camp_raw)
        WHEN b.src <> '' THEN 'organic:' || b.src
        ELSE 'none'
      END AS ckey,
      CASE WHEN b.camp_raw LIKE '%|%' THEN split_part(b.camp_raw, '|', 1) END AS cname
    FROM ev_bruto b
    WHERE NOT EXISTS (SELECT 1 FROM fora f WHERE f.user_id = b.user_id)
  ),
  traffic AS (
    SELECT ckey,
      MAX(cname) AS name_utm,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_view')       AS sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_click')      AS accounts,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open') AS pix_opened,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated')     AS pix_generated
    FROM norm
    GROUP BY ckey
  ),
  buyers AS MATERIALIZED (
    SELECT s.user_id, s.abacatepay_billing_id AS paid_order, s.created_at, s.amount_cents
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.billing_period = 'lifetime'
      AND s.created_at >= _from AND s.created_at < _to
      AND NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
  ),
  -- sessões que o comprador tocou (pra achar o clique anônimo pré-cadastro)
  buyer_sessions AS (
    SELECT DISTINCT ae.user_id, ae.session_id
    FROM public.analytics_events ae
    JOIN buyers b ON b.user_id = ae.user_id
    WHERE ae.user_id IS NOT NULL AND ae.session_id IS NOT NULL
  ),
  -- candidatos a atribuição: eventos do usuário + anônimos das sessões dele
  attr_candidates AS (
    SELECT e.user_id, e.created_at, e.event_data
    FROM public.analytics_events e
    JOIN buyers b ON b.user_id = e.user_id
    WHERE e.user_id IS NOT NULL
      AND (COALESCE(e.event_data->>'utm_source','') <> '' OR COALESCE(e.event_data->>'utm_campaign','') <> '')
    UNION ALL
    SELECT bs.user_id, e.created_at, e.event_data
    FROM buyer_sessions bs
    JOIN public.analytics_events e ON e.session_id = bs.session_id AND e.user_id IS NULL
    WHERE COALESCE(e.event_data->>'utm_source','') <> '' OR COALESCE(e.event_data->>'utm_campaign','') <> ''
  ),
  -- CAMPANHA ganha de orgânico: entre os candidatos, prefere quem tem
  -- utm_campaign (clique de anúncio) ao "só utm_source" (bio) — depois, o
  -- mais antigo (primeiro toque).
  buyer_attr AS (
    SELECT DISTINCT ON (user_id) user_id,
      CASE
        WHEN COALESCE(event_data->>'utm_campaign','') <> ''
          THEN COALESCE(NULLIF(split_part(event_data->>'utm_campaign', '|', 2), ''), event_data->>'utm_campaign')
        WHEN COALESCE(event_data->>'utm_source','') <> '' THEN 'organic:' || (event_data->>'utm_source')
        ELSE 'none'
      END AS ckey,
      CASE WHEN event_data->>'utm_campaign' LIKE '%|%' THEN split_part(event_data->>'utm_campaign', '|', 1) END AS cname,
      COALESCE(event_data->>'utm_content', '') AS ad
    FROM attr_candidates
    ORDER BY user_id,
      (COALESCE(event_data->>'utm_campaign','') = '') ASC,  -- com campanha primeiro
      created_at ASC
  ),
  -- UMA linha por venda, com a oferta calculada na própria linha. Antes a
  -- oferta era um CTE à parte juntado de volta por user_id: o Postgres
  -- recalculava as duas subconsultas compradores × compradores vezes (era o
  -- que estourava os 8 s — 640 compradores = 409.600 buscas no banco de
  -- teste) e quem comprou 2 vitalícios na janela virava 4 vendas (k²).
  buyer_full AS (
    SELECT b.user_id,
      COALESCE(ba.ckey, 'none') AS ckey,
      ba.cname,
      COALESCE(ba.ad, '') AS ad,
      o.offer,
      -- valor REAL pago (webhook, desde 15/07); fallback = preços da época
      -- antiga (downsell era 1490) pros registros sem amount_cents.
      COALESCE(b.amount_cents,
        CASE WHEN o.offer = 'downsell' THEN 1490 ELSE 2790 END) AS cents
    FROM buyers b
    LEFT JOIN buyer_attr ba ON ba.user_id = b.user_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT g.event_data->>'offer' FROM public.analytics_events g
          WHERE g.user_id = b.user_id AND g.event_name = 'pix_generated'
            AND g.event_data->>'order_id' = b.paid_order
          ORDER BY g.created_at DESC LIMIT 1),
        (SELECT g.event_data->>'offer' FROM public.analytics_events g
          WHERE g.user_id = b.user_id AND g.event_name = 'pix_generated'
          ORDER BY g.created_at DESC LIMIT 1),
        'lifetime'
      ) AS offer
    ) o
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
    SELECT ckey, ad, COUNT(*) AS sales, SUM(cents) AS revenue_cents
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


-- ===================================================================
-- 2. FUNIL — admin_acquisition_funnel
-- ===================================================================
CREATE OR REPLACE FUNCTION public.admin_acquisition_funnel(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to   timestamptz DEFAULT now(),
  _granularity text DEFAULT 'day'  -- 'day' | 'hour'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
SET plan_cache_mode = 'force_custom_plan'
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
  bucket_unit text := CASE WHEN _granularity = 'hour' THEN 'hour' ELSE 'day' END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH bot_sessions AS MATERIALIZED (
    -- O crawler da Play só existiu em 05-10/08: fora dessa faixa, vazio de graça.
    SELECT DISTINCT session_id
    FROM public.analytics_events
    WHERE _from < timestamptz '2026-08-10' AND _to > timestamptz '2026-08-05'
      AND created_at >= _from AND created_at < _to
      AND session_id IS NOT NULL
      AND event_data->>'ua' LIKE '%Pixel 6 Pro%Chrome/95.%'
  ),
  -- Só os eventos que o funil conta, com os campos do JSON já extraídos.
  ev_bruto AS MATERIALIZED (
    SELECT e.event_name, e.session_id, e.user_id, e.created_at,
      CASE WHEN e.event_name = 'funnel_view'  THEN e.event_data->>'step' END AS step,
      CASE WHEN e.event_name = 'funnel_click' THEN e.event_data->>'cta'  END AS cta,
      -- 27/09: o funil de teste grava `step` em vez de `q` (e `a` em vez de
      -- `answer`). Pergunta nula derrubava o jsonb_object_agg do quiz com
      -- "field name must not be null".
      CASE WHEN e.event_name = 'funnel_quiz_answer'
        THEN COALESCE(NULLIF(e.event_data->>'q', ''), NULLIF(e.event_data->>'step', ''), '(sem pergunta)') END AS q,
      CASE WHEN e.event_name = 'funnel_quiz_answer'
        THEN COALESCE(e.event_data->>'answer', e.event_data->>'a') END AS answer,
      CASE WHEN e.event_name IN ('pix_checkout_open', 'pix_generated') THEN e.event_data->>'context' END AS context,
      CASE WHEN e.event_name = 'funnel_view' AND e.event_data->>'step' = 'start'
        THEN COALESCE(NULLIF(e.event_data->>'utm_source', ''), 'direto/desconhecido') END AS utm_source
    FROM public.analytics_events e
    WHERE e.event_name IN ('funnel_view', 'funnel_click', 'funnel_quiz_answer',
                           'pix_checkout_open', 'pix_generated', 'pix_copied', 'pix_confirmed', 'pix_error')
      AND e.created_at >= _from AND e.created_at < _to
      AND NOT EXISTS (SELECT 1 FROM bot_sessions b WHERE b.session_id = e.session_id)
  ),
  fora AS MATERIALIZED (
    SELECT x.user_id
    FROM (SELECT DISTINCT user_id FROM ev_bruto WHERE user_id IS NOT NULL) x
    LEFT JOIN auth.users u ON u.id = x.user_id
    WHERE public.is_test_user(x.user_id)
       OR lower(u.email) = lower(owner_email)
  ),
  ev AS NOT MATERIALIZED (
    SELECT b.* FROM ev_bruto b
    WHERE NOT EXISTS (SELECT 1 FROM fora f WHERE f.user_id = b.user_id)
  ),
  paid_users AS MATERIALIZED (
    SELECT c.user_id
    FROM (
      SELECT DISTINCT ae.user_id
      FROM public.analytics_events ae
      WHERE ae.event_name IN ('trial_converted', 'subscription_started', 'pix_confirmed', 'pix_reconciled')
        AND ae.user_id IS NOT NULL
        AND ae.created_at >= _from AND ae.created_at < _to
    ) c
    JOIN auth.users u ON u.id = c.user_id
    WHERE lower(u.email) IS DISTINCT FROM lower(owner_email)
      AND NOT public.is_test_user(c.user_id)
  ),
  -- A sessão de cada pagante = a primeira dele na janela (1 busca no índice
  -- por pagante, em vez de ordenar todas as sessões da janela).
  paid_sessions AS MATERIALIZED (
    SELECT pu.user_id, f.session_id
    FROM paid_users pu
    CROSS JOIN LATERAL (
      SELECT e.session_id
      FROM public.analytics_events e
      WHERE e.user_id = pu.user_id
        AND e.created_at >= _from AND e.created_at < _to
        AND e.session_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM bot_sessions b WHERE b.session_id = e.session_id)
      ORDER BY e.created_at ASC
      LIMIT 1
    ) f
  ),
  passos_contados AS (
    SELECT step AS chave, COUNT(DISTINCT session_id) AS sessions
    FROM ev WHERE event_name = 'funnel_view' AND step IS NOT NULL
    GROUP BY 1
  ),
  steps_raw AS (
    SELECT d.ord, d.key, d.label,
           COALESCE(
             CASE
               WHEN d.key = 'account' THEN (SELECT COUNT(DISTINCT session_id) FROM ev
                                            WHERE event_name = 'funnel_click' AND cta = 'signup_success')
               WHEN d.key = 'paid'    THEN (SELECT COUNT(*) FROM paid_users)
               ELSE (SELECT pc.sessions FROM passos_contados pc WHERE pc.chave = d.key)
             END, 0) AS sessions
    FROM (VALUES
      (1,'start','Porta — escolheu a área'),
      (2,'crenca','Crença — como o CORE funciona'),
      (3,'quiz_1','Quiz 1 — o que atrapalha'),
      (4,'quiz_2','Quiz 2 — como controla hoje'),
      (5,'quiz_3','Quiz 3 — quanto some por mês'),
      (6,'quiz_proof','Diagnóstico — relatório'),
      (7,'quiz_4','Quiz 4 — compromisso 5 min/dia'),
      (8,'quiz_5','Quiz 5 — vitória em 7 dias'),
      (9,'confianca','Confiança — obrigado'),
      (10,'progress','Análise (loading)'),
      (11,'result','Ponte — análise pronta'),
      (12,'demo','Demo — app real'),
      (13,'plano','SEU PLANO'),
      (14,'signup','Chegou no cadastro'),
      (15,'account','Criou a conta'),
      (16,'offer','Viu a oferta (paywall)'),
      (17,'paid','Assinou')
    ) AS d(ord, key, label)
  ),
  steps_calc AS (
    SELECT ord, key, label, sessions,
           FIRST_VALUE(sessions) OVER (ORDER BY ord) AS first_sessions,
           LAG(sessions) OVER (ORDER BY ord) AS prev_sessions
    FROM steps_raw
  ),
  steps_final AS (
    SELECT ord, key, label, sessions,
      CASE WHEN first_sessions > 0 THEN round(sessions::numeric / first_sessions * 100, 1) ELSE 0 END AS pct_of_first,
      CASE
        WHEN prev_sessions IS NULL THEN NULL
        WHEN prev_sessions > 0 THEN round((1 - sessions::numeric / prev_sessions) * 100, 1)
        ELSE NULL
      END AS drop_pct
    FROM steps_calc
  ),
  worst AS (
    SELECT key, label, drop_pct FROM steps_final
    WHERE drop_pct IS NOT NULL AND drop_pct > 0
    ORDER BY drop_pct DESC LIMIT 1
  ),
  pix AS (
    SELECT
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open') AS opened,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated')     AS generated,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_copied')        AS copied,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_confirmed')     AS confirmed,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_error')         AS errored,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open' AND context = 'funnel') AS opened_funnel,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_checkout_open' AND context = 'app')    AS opened_app,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated' AND context = 'funnel')     AS generated_funnel,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'pix_generated' AND context = 'app')        AS generated_app
    FROM ev
    WHERE event_name IN ('pix_checkout_open','pix_generated','pix_copied','pix_confirmed','pix_error')
  ),
  clicks AS (
    SELECT cta, COUNT(*) AS clicks, COUNT(DISTINCT session_id) AS sessions
    FROM ev WHERE event_name = 'funnel_click' AND cta IS NOT NULL
    GROUP BY 1
  ),
  quiz AS (
    SELECT q, answer, COUNT(*) AS count
    FROM ev WHERE event_name = 'funnel_quiz_answer' AND answer IS NOT NULL
    GROUP BY 1, 2
  ),
  quiz_grouped AS (
    SELECT q, jsonb_agg(jsonb_build_object('answer', answer, 'count', count) ORDER BY count DESC) AS answers
    FROM quiz GROUP BY q
  ),
  recovery AS (
    SELECT
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_view' AND step = 'offer') AS offer_views,
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_view' AND step = 'wheel') AS wheel_views,
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_view' AND step = 'downsell') AS downsell_views,
      (SELECT COUNT(DISTINCT session_id) FROM ev WHERE event_name = 'funnel_click' AND cta = 'downsell_dismiss') AS downsell_dismissed,
      (SELECT COUNT(DISTINCT ps.user_id) FROM paid_sessions ps
        WHERE ps.session_id IN (SELECT session_id FROM ev WHERE event_name = 'funnel_view' AND step = 'downsell')
      ) AS downsell_paid
  ),
  utm AS (
    SELECT utm_source AS source,
           COUNT(DISTINCT session_id) AS sessions,
           COUNT(DISTINCT session_id) FILTER (WHERE session_id IN (SELECT session_id FROM paid_sessions)) AS paid
    FROM ev
    WHERE event_name = 'funnel_view' AND step = 'start'
    GROUP BY 1
  ),
  -- "Pagantes" por dia/hora conta a sessão do pagante em todo balde onde ela
  -- teve QUALQUER evento (como antes) — busca pelas sessões, no índice.
  paid_buckets AS (
    SELECT date_trunc(bucket_unit, e.created_at) AS bucket, COUNT(DISTINCT e.session_id) AS paid
    FROM public.analytics_events e
    WHERE e.session_id IN (SELECT session_id FROM paid_sessions)
      AND e.created_at >= _from AND e.created_at < _to
    GROUP BY 1
  ),
  funnel_buckets AS (
    SELECT date_trunc(bucket_unit, created_at) AS bucket,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_view' AND step = 'start') AS sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'funnel_click' AND cta = 'signup_success') AS accounts
    FROM ev
    GROUP BY 1
  ),
  daily AS (
    SELECT COALESCE(f.bucket, p.bucket) AS bucket,
      COALESCE(f.sessions, 0) AS sessions,
      COALESCE(f.accounts, 0) AS accounts,
      COALESCE(p.paid, 0) AS paid
    FROM funnel_buckets f
    FULL OUTER JOIN paid_buckets p ON p.bucket = f.bucket
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'sessions', (SELECT sessions FROM steps_final WHERE key = 'start'),
      'accounts', (SELECT sessions FROM steps_final WHERE key = 'account'),
      'paid', (SELECT sessions FROM steps_final WHERE key = 'paid'),
      'conversion_pct', CASE WHEN (SELECT sessions FROM steps_final WHERE key = 'start') > 0
        THEN round((SELECT sessions FROM steps_final WHERE key = 'paid')::numeric
                    / (SELECT sessions FROM steps_final WHERE key = 'start') * 100, 2)
        ELSE 0 END
    ),
    'steps', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', key, 'label', label, 'sessions', sessions,
        'pct_of_first', pct_of_first, 'drop_pct', drop_pct
      ) ORDER BY ord), '[]'::jsonb) FROM steps_final),
    'worst_drop', (SELECT to_jsonb(worst) FROM worst),
    'pix', (SELECT to_jsonb(pix) FROM pix),
    'recovery', (SELECT to_jsonb(recovery) FROM recovery),
    'cta_clicks', (SELECT COALESCE(jsonb_agg(jsonb_build_object('cta', cta, 'clicks', clicks, 'sessions', sessions) ORDER BY clicks DESC), '[]'::jsonb) FROM clicks),
    'quiz_answers', (SELECT COALESCE(jsonb_object_agg(q, answers), '{}'::jsonb) FROM quiz_grouped),
    'utm_breakdown', (SELECT COALESCE(jsonb_agg(jsonb_build_object('source', source, 'sessions', sessions, 'paid', paid) ORDER BY sessions DESC), '[]'::jsonb) FROM utm),
    'granularity', bucket_unit,
    'daily', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', bucket, 'sessions', sessions, 'accounts', accounts, 'paid', paid) ORDER BY bucket), '[]'::jsonb) FROM daily)
  ) INTO result;

  RETURN result;
END;
$$;


-- ===================================================================
-- 3. USUÁRIOS — admin_funnel_users
-- ===================================================================
CREATE OR REPLACE FUNCTION public.admin_funnel_users(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to   timestamptz DEFAULT now(),
  _limit int DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
SET plan_cache_mode = 'force_custom_plan'
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH step_order(step_key, ord, label) AS (
    VALUES
      ('start', 1, 'Abriu o funil'),
      ('quiz_1', 2, 'Quiz — pergunta 1'),
      ('quiz_2', 3, 'Quiz — pergunta 2'),
      ('quiz_3', 4, 'Quiz — pergunta 3'),
      ('progress', 5, 'Tela de preparação'),
      ('result', 6, 'Viu o resultado'),
      ('demo', 7, 'Abriu a demo'),
      ('signup', 8, 'Chegou no cadastro'),
      ('account', 9, 'Criou a conta'),
      ('offer', 10, 'Viu a oferta'),
      ('paid', 11, 'Assinou')
  ),
  -- A jornada só depende dos eventos de etapa: funnel_view e o clique de
  -- conta criada. Antes: todo evento da janela, com o filtro de teste em cada um.
  passos_bruto AS MATERIALIZED (
    SELECT e.session_id, e.user_id, e.created_at,
      CASE WHEN e.event_name = 'funnel_view' THEN e.event_data->>'step' ELSE 'account' END AS step_key,
      CASE WHEN e.event_name = 'funnel_view' AND e.event_data->>'step' = 'start'
        THEN NULLIF(e.event_data->>'utm_source', '') END AS utm_source,
      (e.event_name = 'funnel_view' AND e.event_data->>'step' = 'start') AS eh_start
    FROM public.analytics_events e
    WHERE e.event_name IN ('funnel_view', 'funnel_click')
      AND e.created_at >= _from AND e.created_at < _to
      AND e.session_id IS NOT NULL
      AND (e.event_name = 'funnel_view' OR e.event_data->>'cta' = 'signup_success')
  ),
  fora AS MATERIALIZED (
    SELECT x.user_id
    FROM (SELECT DISTINCT user_id FROM passos_bruto WHERE user_id IS NOT NULL) x
    LEFT JOIN auth.users u ON u.id = x.user_id
    WHERE public.is_test_user(x.user_id)
       OR lower(u.email) = lower(owner_email)
  ),
  passos AS MATERIALIZED (
    SELECT p.session_id, p.created_at, p.utm_source, p.eh_start, so.ord, so.label
    FROM passos_bruto p
    JOIN step_order so ON so.step_key = p.step_key
    WHERE NOT EXISTS (SELECT 1 FROM fora f WHERE f.user_id = p.user_id)
  ),
  session_journey AS (
    SELECT
      session_id,
      MIN(created_at) AS started_at,
      MAX(created_at) AS last_event_at,
      (array_agg(label ORDER BY ord DESC))[1] AS furthest_label,
      MAX(ord) AS furthest_ord,
      MAX(created_at) FILTER (WHERE ord = 9) AS account_created_at
    FROM passos
    GROUP BY session_id
  ),
  -- Só as sessões que vão pra tela ganham e-mail, pagamento e origem.
  topo AS MATERIALIZED (
    SELECT * FROM session_journey ORDER BY started_at DESC LIMIT _limit
  ),
  topo_ev AS MATERIALIZED (
    SELECT e.session_id, e.user_id, e.created_at
    FROM public.analytics_events e
    WHERE e.session_id IN (SELECT session_id FROM topo)
      AND e.created_at >= _from AND e.created_at < _to
      AND e.user_id IS NOT NULL
  ),
  topo_fora AS MATERIALIZED (
    SELECT x.user_id
    FROM (SELECT DISTINCT user_id FROM topo_ev) x
    LEFT JOIN auth.users u ON u.id = x.user_id
    WHERE public.is_test_user(x.user_id)
       OR lower(u.email) = lower(owner_email)
  ),
  session_first_user AS (
    SELECT DISTINCT ON (t.session_id) t.session_id, t.user_id
    FROM topo_ev t
    WHERE NOT EXISTS (SELECT 1 FROM topo_fora f WHERE f.user_id = t.user_id)
    ORDER BY t.session_id, t.created_at ASC
  ),
  session_email AS (
    SELECT sfu.session_id, u.email
    FROM session_first_user sfu
    JOIN auth.users u ON u.id = sfu.user_id
  ),
  session_paid AS (
    SELECT sfu.session_id, MIN(pe.created_at) AS paid_at
    FROM session_first_user sfu
    JOIN public.analytics_events pe
      ON pe.user_id = sfu.user_id AND pe.event_name IN ('trial_converted', 'subscription_started')
    GROUP BY sfu.session_id
  ),
  session_utm AS (
    SELECT DISTINCT ON (p.session_id) p.session_id, p.utm_source
    FROM passos p
    WHERE p.eh_start AND p.session_id IN (SELECT session_id FROM topo)
    ORDER BY p.session_id, p.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', se.email,
    'furthest_step', t.furthest_label,
    'furthest_ord', t.furthest_ord,
    'started_at', t.started_at,
    'account_created_at', t.account_created_at,
    'paid_at', sp.paid_at,
    'last_event_at', t.last_event_at,
    'utm_source', su.utm_source
  ) ORDER BY t.started_at DESC), '[]'::jsonb) INTO result
  FROM topo t
  LEFT JOIN session_email se ON se.session_id = t.session_id
  LEFT JOIN session_paid sp ON sp.session_id = t.session_id
  LEFT JOIN session_utm su ON su.session_id = t.session_id;

  RETURN jsonb_build_object('users', result);
END;
$$;


-- ===================================================================
-- 4. PAGANTES — admin_paying_users_detail
-- ===================================================================
-- Mesma consulta de 26/08; o que muda: teto de 60 s e a atividade lê só
-- (user_id, created_at, session_id) — com o índice parcial do arquivo de
-- índices isso vira index-only scan, sem tocar no event_data de ninguém.
CREATE OR REPLACE FUNCTION public.admin_paying_users_detail()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
SET plan_cache_mode = 'force_custom_plan'
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH subs AS MATERIALIZED (
    SELECT DISTINCT ON (s.user_id)
      s.user_id, s.billing_period, s.status, s.created_at, s.current_period_end,
      COALESCE(NULLIF(s.customer_email, ''), u.email) AS email,
      COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'display_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')
      ) AS meta_name
    FROM public.subscriptions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE NOT public.is_test_user(s.user_id)
      AND lower(u.email) IS DISTINCT FROM lower(owner_email)
    -- a assinatura que representa a pessoa: ativa primeiro, depois a mais nova
    ORDER BY s.user_id, (s.status = 'active') DESC, s.created_at DESC
  ),
  prof AS (
    SELECT id, NULLIF(TRIM(display_name), '') AS name
    FROM public.profiles WHERE id IN (SELECT user_id FROM subs)
  ),
  activity AS (
    -- Dia BRT por subtração (BRT = UTC-3 o ano todo desde 2019; ver 26/08).
    SELECT user_id,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(DISTINCT dia_brt) AS days_active,
      BOOL_OR(dia_brt = (now() - interval '3 hours')::date) AS active_today,
      COUNT(DISTINCT dia_brt) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d_days
    FROM (
      SELECT e.user_id, e.session_id, e.created_at,
             (e.created_at - interval '3 hours')::date AS dia_brt
      FROM public.analytics_events e
      WHERE e.user_id IS NOT NULL
        AND e.user_id IN (SELECT user_id FROM subs)
    ) e
    GROUP BY user_id
  ),
  acts AS (
    SELECT user_id, array_agg(DISTINCT event_data->>'action_key') AS action_keys
    FROM public.analytics_events
    WHERE event_name = 'key_action_completed'
      AND user_id IN (SELECT user_id FROM subs)
      AND COALESCE(event_data->>'action_key', '') <> ''
    GROUP BY user_id
  ),
  mod_usage AS (
    SELECT user_id, module_id, SUM(LEAST(duration_seconds, 1800)) AS seconds, COUNT(*) AS opens
    FROM public.module_analytics
    WHERE user_id IN (SELECT user_id FROM subs)
    GROUP BY user_id, module_id
  ),
  mod_agg AS (
    SELECT user_id,
      jsonb_agg(jsonb_build_object('id', module_id, 'seconds', seconds, 'opens', opens) ORDER BY seconds DESC) AS modules,
      SUM(seconds) AS total_seconds, SUM(opens) AS total_opens
    FROM mod_usage GROUP BY user_id
  ),
  tab_usage AS (
    SELECT user_id, module_id, tab_id, SUM(LEAST(duration_seconds, 1800)) AS seconds
    FROM public.module_analytics
    WHERE user_id IN (SELECT user_id FROM subs) AND tab_id IS NOT NULL AND tab_id <> ''
    GROUP BY user_id, module_id, tab_id
  ),
  tab_ranked AS (
    SELECT user_id, module_id, tab_id, seconds,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY seconds DESC) AS rn
    FROM tab_usage
  ),
  tab_agg AS (
    SELECT user_id,
      jsonb_agg(jsonb_build_object('module', module_id, 'tab', tab_id, 'seconds', seconds) ORDER BY seconds DESC) AS tabs
    FROM tab_ranked WHERE rn <= 15 GROUP BY user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', s.user_id,
    'email', s.email,
    'name', COALESCE(p.name, s.meta_name),
    'plan', s.billing_period,
    'status', s.status,
    'subscribed_since', s.created_at,
    'current_period_end', s.current_period_end,
    'first_seen', a.first_seen,
    'last_seen', a.last_seen,
    'sessions', COALESCE(a.sessions, 0),
    'days_active', COALESCE(a.days_active, 0),
    'active_today', COALESCE(a.active_today, false),
    'last_7d_days', COALESCE(a.last_7d_days, 0),
    -- dias inteiros desde o último sinal; NULL quando a pessoa nunca apareceu
    'days_since_last', CASE WHEN a.last_seen IS NULL THEN NULL
                            ELSE FLOOR(EXTRACT(EPOCH FROM (now() - a.last_seen)) / 86400)::int END,
    'days_since_buy', FLOOR(EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400)::int,
    'total_seconds', COALESCE(ma.total_seconds, 0),
    'total_opens', COALESCE(ma.total_opens, 0),
    'actions', COALESCE(to_jsonb(ac.action_keys), '[]'::jsonb),
    'modules', COALESCE(ma.modules, '[]'::jsonb),
    'tabs', COALESCE(ta.tabs, '[]'::jsonb)
  ) ORDER BY s.created_at DESC), '[]'::jsonb) INTO result
  FROM subs s
  LEFT JOIN prof p ON p.id = s.user_id
  LEFT JOIN activity a ON a.user_id = s.user_id
  LEFT JOIN acts ac ON ac.user_id = s.user_id
  LEFT JOIN mod_agg ma ON ma.user_id = s.user_id
  LEFT JOIN tab_agg ta ON ta.user_id = s.user_id;

  RETURN jsonb_build_object('users', result);
END;
$$;


-- ===================================================================
-- 5. ROI DA WEB — admin_web_roi (v4)
-- ===================================================================
-- Mesma regra da v3 (pago = dinheiro na subscriptions; sessão sem utm herda o
-- último clique pago da mesma pessoa em 7 dias). O que muda é a forma:
--  - UMA passada agregando por sessão (antes: `ev` materializado com o JSON
--    inteiro + `web` + `passos` relendo o mesmo material);
--  - sessão do app sai por anti-join (o NOT IN virava subplano linear);
--  - herança por JOIN + DISTINCT ON (o LATERAL varria `toques` por sessão).
CREATE OR REPLACE FUNCTION public.admin_web_roi(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
SET plan_cache_mode = 'force_custom_plan'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH app_sess AS MATERIALIZED (
    SELECT DISTINCT e.session_id
    FROM public.analytics_events e
    WHERE e.event_name = 'app_device_info'
      AND e.created_at >= _from AND e.created_at < _to
      AND e.session_id IS NOT NULL
  ),
  web AS MATERIALIZED (
    SELECT e.session_id,
      MIN(e.created_at) AS t0,
      MAX(e.user_id::text) FILTER (WHERE e.user_id IS NOT NULL) AS uid,
      bool_or(e.event_name = 'funnel_view' AND e.event_data->>'step' = 'start') AS s_start,
      bool_or(e.event_name = 'funnel_view' AND e.event_data->>'step' = 'quiz_1') AS s_quiz,
      bool_or(e.event_name = 'funnel_click' AND e.event_data->>'cta' = 'signup_success') AS s_conta,
      bool_or((e.event_name = 'funnel_view' AND e.event_data->>'step' = 'offer') OR e.event_name = 'paywall_view') AS s_paywall,
      bool_or(e.event_name = 'pix_generated') AS s_pix,
      bool_or(e.event_name = 'pix_confirmed') AS s_evento_pago,
      MAX(e.event_data->>'offer') FILTER (WHERE e.event_name = 'pix_confirmed') AS oferta
    FROM public.analytics_events e
    WHERE e.created_at >= _from AND e.created_at < _to
      AND e.session_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM app_sess a WHERE a.session_id = e.session_id)
    GROUP BY e.session_id
  ),
  origem_sessao AS (
    -- primeiro evento da sessão que trouxe utm (clique) — senão, o primeiro de todos
    SELECT DISTINCT ON (e.session_id)
      e.session_id,
      COALESCE(e.event_data->>'utm_campaign', '') AS camp,
      COALESCE(e.event_data->>'utm_content', '') AS ad,
      COALESCE(e.event_data->>'utm_source', '') AS src,
      (COALESCE(e.event_data->>'fbclid', '') <> '') AS fbclid
    FROM public.analytics_events e
    JOIN web w ON w.session_id = e.session_id
    WHERE e.event_name IN ('origem_usuario', 'landing_view', 'funnel_view', 'porta_vista')
      AND e.created_at >= _from AND e.created_at < _to
    ORDER BY e.session_id,
      (COALESCE(e.event_data->>'utm_campaign', '') = '') ASC,
      e.created_at ASC
  ),
  toques AS MATERIALIZED (
    -- cliques pagos da mesma pessoa até 7 dias antes da janela (pra herdar)
    SELECT e.user_id::text AS uid, e.created_at,
      NULLIF(e.event_data->>'utm_campaign', '') AS camp,
      COALESCE(e.event_data->>'utm_content', '') AS ad,
      COALESCE(e.event_data->>'utm_source', '') AS src,
      (COALESCE(e.event_data->>'fbclid', '') <> '') AS fbclid
    FROM public.analytics_events e
    WHERE e.created_at >= _from - interval '7 days' AND e.created_at < _to
      AND e.user_id IS NOT NULL
      AND e.user_id IN (SELECT w.uid::uuid FROM web w WHERE w.uid IS NOT NULL)
      AND COALESCE(e.event_data->>'utm_campaign', '') <> ''
      AND e.event_name IN ('origem_usuario', 'landing_view', 'funnel_view', 'porta_vista', 'pix_generated')
  ),
  heranca AS (
    SELECT DISTINCT ON (w.session_id) w.session_id, t.camp, t.ad, t.src, t.fbclid
    FROM web w
    JOIN toques t ON t.uid = w.uid
      AND t.created_at < w.t0 AND t.created_at >= w.t0 - interval '7 days'
    WHERE w.uid IS NOT NULL
    ORDER BY w.session_id, t.created_at DESC
  ),
  origem AS (
    SELECT w.session_id,
      COALESCE(NULLIF(o.camp, ''), h.camp, '') AS camp,
      CASE WHEN NULLIF(o.camp, '') IS NOT NULL THEN o.ad ELSE COALESCE(h.ad, '') END AS ad,
      CASE WHEN NULLIF(o.camp, '') IS NOT NULL THEN o.src ELSE COALESCE(h.src, o.src, '') END AS src,
      (COALESCE(o.fbclid, false) OR COALESCE(h.fbclid, false)) AS fbclid,
      (NULLIF(o.camp, '') IS NULL AND h.camp IS NOT NULL) AS herdou
    FROM web w
    LEFT JOIN origem_sessao o ON o.session_id = w.session_id
    LEFT JOIN heranca h ON h.session_id = w.session_id
  ),
  pedidos AS (
    SELECT e.session_id, e.event_data->>'order_id' AS order_id, e.created_at
    FROM public.analytics_events e
    JOIN web w ON w.session_id = e.session_id
    WHERE e.event_name = 'pix_generated'
      AND e.created_at >= _from AND e.created_at < _to
      AND COALESCE(e.event_data->>'order_id', '') <> ''
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
  receita AS (
    SELECT w.session_id,
      COALESCE(
        ps.cents,
        CASE w.oferta
          WHEN 'w27' THEN 2790 WHEN 'w25' THEN 2490 WHEN 'w47' THEN 4790 WHEN 'w97' THEN 9790
          WHEN 'lifetime' THEN 9790 WHEN 'downsell' THEN 1990 ELSE 0 END
      ) AS cents,
      (ps.session_id IS NOT NULL OR w.s_evento_pago) AS pago
    FROM web w
    LEFT JOIN pagos_sessao ps ON ps.session_id = w.session_id
  ),
  linhas AS (
    SELECT
      COALESCE(o.camp, '') AS camp, COALESCE(o.ad, '') AS ad, COALESCE(o.src, '') AS src,
      COUNT(*) AS sessoes,
      COUNT(*) FILTER (WHERE w.s_start) AS start,
      COUNT(*) FILTER (WHERE w.s_quiz) AS quiz,
      COUNT(*) FILTER (WHERE w.s_conta) AS contas,
      COUNT(*) FILTER (WHERE w.s_paywall) AS paywall,
      COUNT(*) FILTER (WHERE w.s_pix) AS pix_gerado,
      COUNT(*) FILTER (WHERE r.pago) AS pix_pago,
      COALESCE(SUM(r.cents) FILTER (WHERE r.pago), 0) AS receita_cents,
      COUNT(*) FILTER (WHERE o.fbclid) AS com_fbclid,
      COUNT(*) FILTER (WHERE o.herdou) AS herdadas
    FROM web w
    LEFT JOIN origem o ON o.session_id = w.session_id
    LEFT JOIN receita r ON r.session_id = w.session_id
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


-- ===================================================================
-- 6. USO (NOVA) — admin_uso: módulos, abas e cards
-- ===================================================================
-- Pedido do dono (27/09): "ver quais as abas mais usadas, quais os módulos
-- mais usados etc. pra ver o que melhorar". Mesma conta do
-- scratchpad/admin/uso.mjs (e do modo reserva da tela, src/pages/admin/uso-contas.ts):
--  - visita = linha de module_analytics; duração com teto de 1800 s (o mesmo
--    do use-module-tracker); aba vazia não entra na conta de aba;
--  - "com assinatura" = status active/trialing/cancel_scheduled HOJE;
--  - mediana = valor do meio da lista ordenada, o de CIMA quando o número de
--    visitas é par (igual ao uso.mjs: s[floor(n/2)]);
--  - "voltou" = usou o módulo/aba em 2+ dias diferentes (dia BRT);
--  - período anterior = a janela do mesmo tamanho logo antes de _from;
--  - cards: card_view / card_interact só de conta logada (a demo do funil é
--    anônima e ficaria misturada com cliente), pessoa = user_id.
-- Devolve os 3 recortes (todos / com / sem assinatura) de uma vez: trocar o
-- recorte na tela não chama o banco de novo.
CREATE OR REPLACE FUNCTION public.admin_uso(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
SET plan_cache_mode = 'force_custom_plan'
SET timezone = 'UTC'
AS $$
DECLARE
  result jsonb;
  owner_email constant text := 'jv20101958@gmail.com';
  _prev_from timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _from IS NULL OR _to IS NULL OR _to <= _from THEN
    RAISE EXCEPTION 'periodo invalido';
  END IF;
  IF _to - _from > interval '400 days' THEN
    RAISE EXCEPTION 'periodo longo demais (maximo 400 dias)';
  END IF;
  _prev_from := _from - (_to - _from);

  WITH visitas_bruto AS MATERIALIZED (
    SELECT m.user_id, m.module_id,
      NULLIF(m.tab_id, '') AS tab_id,
      LEAST(COALESCE(m.duration_seconds, 0), 1800) AS segundos,
      (m.entered_at >= _from) AS atual,
      (m.entered_at - interval '3 hours')::date AS dia
    FROM public.module_analytics m
    WHERE m.entered_at >= _prev_from AND m.entered_at < _to
  ),
  cards_bruto AS MATERIALIZED (
    SELECT e.user_id,
      (e.event_name = 'card_interact') AS usou,
      COALESCE(NULLIF(e.event_data->>'modulo', ''), '?') AS modulo,
      COALESCE(e.event_data->>'aba', '') AS aba,
      COALESCE(NULLIF(e.event_data->>'card', ''), '?') AS card
    FROM public.analytics_events e
    WHERE e.event_name IN ('card_view', 'card_interact')
      AND e.created_at >= _from AND e.created_at < _to
      AND e.user_id IS NOT NULL
  ),
  fora AS MATERIALIZED (
    SELECT x.user_id
    FROM (SELECT user_id FROM visitas_bruto UNION SELECT user_id FROM cards_bruto) x
    LEFT JOIN auth.users u ON u.id = x.user_id
    WHERE public.is_test_user(x.user_id)
       OR lower(u.email) = lower(owner_email)
  ),
  assinantes AS MATERIALIZED (
    SELECT DISTINCT s.user_id
    FROM public.subscriptions s
    WHERE s.status IN ('active', 'trialing', 'cancel_scheduled')
  ),
  segs(segmento) AS (VALUES ('todos'::text), ('com'::text), ('sem'::text)),
  -- cada visita entra em "todos" e no recorte da pessoa
  visitas AS MATERIALIZED (
    SELECT v.user_id, v.module_id, v.tab_id, v.segundos, v.atual, v.dia,
      (a.user_id IS NOT NULL) AS assinante, sg.segmento
    FROM visitas_bruto v
    LEFT JOIN assinantes a ON a.user_id = v.user_id
    CROSS JOIN LATERAL (VALUES ('todos'::text),
      (CASE WHEN a.user_id IS NOT NULL THEN 'com' ELSE 'sem' END)) AS sg(segmento)
    WHERE NOT EXISTS (SELECT 1 FROM fora f WHERE f.user_id = v.user_id)
  ),
  dias AS (
    SELECT g::date AS dia
    FROM generate_series(
      ((_from - interval '3 hours')::date)::timestamp,
      (((_to - interval '3 hours') - interval '1 microsecond')::date)::timestamp,
      interval '1 day') AS g
  ),
  -- ---------- totais do recorte
  totais AS (
    SELECT segmento,
      COUNT(DISTINCT user_id) FILTER (WHERE atual) AS ativos,
      COUNT(DISTINCT user_id) FILTER (WHERE atual AND assinante) AS com_assinatura,
      COUNT(*) FILTER (WHERE atual) AS visitas,
      COALESCE(SUM(segundos) FILTER (WHERE atual), 0) AS seg_total,
      COUNT(DISTINCT user_id) FILTER (WHERE NOT atual) AS ativos_ant,
      COUNT(*) FILTER (WHERE NOT atual) AS visitas_ant,
      COALESCE(SUM(segundos) FILTER (WHERE NOT atual), 0) AS seg_total_ant
    FROM visitas
    GROUP BY segmento
  ),
  totais_volta AS (
    SELECT segmento, COUNT(*) FILTER (WHERE dias >= 2) AS voltaram
    FROM (SELECT segmento, user_id, COUNT(DISTINCT dia) AS dias
          FROM visitas WHERE atual GROUP BY segmento, user_id) x
    GROUP BY segmento
  ),
  -- ---------- módulos
  mod_atual AS (
    SELECT segmento, module_id,
      COUNT(DISTINCT user_id) AS pessoas,
      COUNT(DISTINCT user_id) FILTER (WHERE assinante) AS com_assinatura,
      COUNT(*) AS visitas,
      SUM(segundos) AS seg_total,
      (array_agg(segundos ORDER BY segundos))[(COUNT(*) / 2)::int + 1] AS mediana_seg
    FROM visitas WHERE atual
    GROUP BY segmento, module_id
  ),
  mod_volta AS (
    SELECT segmento, module_id, COUNT(*) FILTER (WHERE dias >= 2) AS voltaram
    FROM (SELECT segmento, module_id, user_id, COUNT(DISTINCT dia) AS dias
          FROM visitas WHERE atual GROUP BY segmento, module_id, user_id) x
    GROUP BY segmento, module_id
  ),
  mod_ant AS (
    SELECT segmento, module_id,
      COUNT(DISTINCT user_id) AS pessoas_ant,
      COUNT(*) AS visitas_ant,
      SUM(segundos) AS seg_total_ant
    FROM visitas WHERE NOT atual
    GROUP BY segmento, module_id
  ),
  mod_json AS (
    SELECT k.segmento, jsonb_agg(jsonb_build_object(
        'modulo', k.module_id,
        'pessoas', COALESCE(a.pessoas, 0),
        'com_assinatura', COALESCE(a.com_assinatura, 0),
        'visitas', COALESCE(a.visitas, 0),
        'seg_total', COALESCE(a.seg_total, 0),
        'mediana_seg', COALESCE(a.mediana_seg, 0),
        'voltaram', COALESCE(v.voltaram, 0),
        'pessoas_ant', COALESCE(p.pessoas_ant, 0),
        'visitas_ant', COALESCE(p.visitas_ant, 0),
        'seg_total_ant', COALESCE(p.seg_total_ant, 0)
      ) ORDER BY COALESCE(a.pessoas, 0) DESC, k.module_id) AS arr
    FROM (SELECT DISTINCT segmento, module_id FROM visitas) k
    LEFT JOIN mod_atual a ON a.segmento = k.segmento AND a.module_id = k.module_id
    LEFT JOIN mod_volta v ON v.segmento = k.segmento AND v.module_id = k.module_id
    LEFT JOIN mod_ant p   ON p.segmento = k.segmento AND p.module_id = k.module_id
    GROUP BY k.segmento
  ),
  -- ---------- abas (só visitas com aba)
  aba_atual AS (
    SELECT segmento, module_id, tab_id,
      COUNT(DISTINCT user_id) AS pessoas,
      COUNT(DISTINCT user_id) FILTER (WHERE assinante) AS com_assinatura,
      COUNT(*) AS visitas,
      SUM(segundos) AS seg_total,
      (array_agg(segundos ORDER BY segundos))[(COUNT(*) / 2)::int + 1] AS mediana_seg
    FROM visitas WHERE atual AND tab_id IS NOT NULL
    GROUP BY segmento, module_id, tab_id
  ),
  aba_volta AS (
    SELECT segmento, module_id, tab_id, COUNT(*) FILTER (WHERE dias >= 2) AS voltaram
    FROM (SELECT segmento, module_id, tab_id, user_id, COUNT(DISTINCT dia) AS dias
          FROM visitas WHERE atual AND tab_id IS NOT NULL
          GROUP BY segmento, module_id, tab_id, user_id) x
    GROUP BY segmento, module_id, tab_id
  ),
  aba_ant AS (
    SELECT segmento, module_id, tab_id,
      COUNT(DISTINCT user_id) AS pessoas_ant,
      COUNT(*) AS visitas_ant,
      SUM(segundos) AS seg_total_ant
    FROM visitas WHERE NOT atual AND tab_id IS NOT NULL
    GROUP BY segmento, module_id, tab_id
  ),
  aba_json AS (
    SELECT k.segmento, jsonb_agg(jsonb_build_object(
        'modulo', k.module_id,
        'aba', k.tab_id,
        'pessoas', COALESCE(a.pessoas, 0),
        'com_assinatura', COALESCE(a.com_assinatura, 0),
        'visitas', COALESCE(a.visitas, 0),
        'seg_total', COALESCE(a.seg_total, 0),
        'mediana_seg', COALESCE(a.mediana_seg, 0),
        'voltaram', COALESCE(v.voltaram, 0),
        'pessoas_ant', COALESCE(p.pessoas_ant, 0),
        'visitas_ant', COALESCE(p.visitas_ant, 0),
        'seg_total_ant', COALESCE(p.seg_total_ant, 0)
      ) ORDER BY k.module_id, COALESCE(a.pessoas, 0) DESC, k.tab_id) AS arr
    FROM (SELECT DISTINCT segmento, module_id, tab_id FROM visitas WHERE tab_id IS NOT NULL) k
    LEFT JOIN aba_atual a ON a.segmento = k.segmento AND a.module_id = k.module_id AND a.tab_id = k.tab_id
    LEFT JOIN aba_volta v ON v.segmento = k.segmento AND v.module_id = k.module_id AND v.tab_id = k.tab_id
    LEFT JOIN aba_ant p   ON p.segmento = k.segmento AND p.module_id = k.module_id AND p.tab_id = k.tab_id
    GROUP BY k.segmento
  ),
  -- ---------- série diária (pessoas por dia, alinhada com `dias`)
  serie_mod AS (
    SELECT segmento, module_id, dia, COUNT(DISTINCT user_id) AS pessoas
    FROM visitas WHERE atual
    GROUP BY segmento, module_id, dia
  ),
  serie_json AS (
    SELECT x.segmento, jsonb_object_agg(x.module_id, x.arr) AS serie
    FROM (
      SELECT s.segmento, m.module_id,
        jsonb_agg(COALESCE(sm.pessoas, 0) ORDER BY d.dia) AS arr
      FROM segs s
      CROSS JOIN (SELECT DISTINCT module_id FROM visitas WHERE atual) m
      CROSS JOIN dias d
      LEFT JOIN serie_mod sm
        ON sm.segmento = s.segmento AND sm.module_id = m.module_id AND sm.dia = d.dia
      GROUP BY s.segmento, m.module_id
    ) x
    GROUP BY x.segmento
  ),
  ativos_dia_json AS (
    SELECT s.segmento, jsonb_agg(COALESCE(st.pessoas, 0) ORDER BY d.dia) AS arr
    FROM segs s
    CROSS JOIN dias d
    LEFT JOIN (
      SELECT segmento, dia, COUNT(DISTINCT user_id) AS pessoas
      FROM visitas WHERE atual GROUP BY segmento, dia
    ) st ON st.segmento = s.segmento AND st.dia = d.dia
    GROUP BY s.segmento
  ),
  -- ---------- cards
  cards AS (
    SELECT c.user_id, c.usou, c.modulo, c.aba, c.card, sg.segmento
    FROM cards_bruto c
    LEFT JOIN assinantes a ON a.user_id = c.user_id
    CROSS JOIN LATERAL (VALUES ('todos'::text),
      (CASE WHEN a.user_id IS NOT NULL THEN 'com' ELSE 'sem' END)) AS sg(segmento)
    WHERE NOT EXISTS (SELECT 1 FROM fora f WHERE f.user_id = c.user_id)
  ),
  cards_json AS (
    SELECT x.segmento, jsonb_agg(jsonb_build_object(
        'modulo', x.modulo, 'aba', x.aba, 'card', x.card,
        'viram', x.viram, 'usaram', x.usaram
      ) ORDER BY x.modulo, x.aba, x.viram DESC, x.usaram DESC, x.card) AS arr
    FROM (
      SELECT segmento, modulo, aba, card,
        COUNT(DISTINCT user_id) FILTER (WHERE NOT usou) AS viram,
        COUNT(DISTINCT user_id) FILTER (WHERE usou) AS usaram
      FROM cards
      GROUP BY segmento, modulo, aba, card
    ) x
    GROUP BY x.segmento
  )
  SELECT jsonb_build_object(
    'fonte', 'sql',
    'periodo', jsonb_build_object('de', _from, 'ate', _to, 'de_anterior', _prev_from),
    'dias', (SELECT COALESCE(jsonb_agg(to_char(dia, 'YYYY-MM-DD') ORDER BY dia), '[]'::jsonb) FROM dias),
    'segmentos', (
      SELECT jsonb_object_agg(s.segmento, jsonb_build_object(
        'totais', jsonb_build_object(
          'ativos', COALESCE(t.ativos, 0),
          'com_assinatura', COALESCE(t.com_assinatura, 0),
          'visitas', COALESCE(t.visitas, 0),
          'seg_total', COALESCE(t.seg_total, 0),
          'voltaram', COALESCE(tv.voltaram, 0),
          'ativos_ant', COALESCE(t.ativos_ant, 0),
          'visitas_ant', COALESCE(t.visitas_ant, 0),
          'seg_total_ant', COALESCE(t.seg_total_ant, 0)
        ),
        'modulos', COALESCE(mj.arr, '[]'::jsonb),
        'abas', COALESCE(aj.arr, '[]'::jsonb),
        'cards', COALESCE(cj.arr, '[]'::jsonb),
        'serie', COALESCE(sj.serie, '{}'::jsonb),
        'ativos_dia', COALESCE(ad.arr, '[]'::jsonb)
      ))
      FROM segs s
      LEFT JOIN totais t           ON t.segmento = s.segmento
      LEFT JOIN totais_volta tv    ON tv.segmento = s.segmento
      LEFT JOIN mod_json mj        ON mj.segmento = s.segmento
      LEFT JOIN aba_json aj        ON aj.segmento = s.segmento
      LEFT JOIN cards_json cj      ON cj.segmento = s.segmento
      LEFT JOIN serie_json sj      ON sj.segmento = s.segmento
      LEFT JOIN ativos_dia_json ad ON ad.segmento = s.segmento
    )
  ) INTO result;

  RETURN result;
END;
$$;


-- ===================================================================
-- Permissões — as mesmas de hoje (CREATE OR REPLACE já as mantém; repetir
-- é inofensivo). A nova segue o padrão da admin_web_roi.
-- ===================================================================
GRANT EXECUTE ON FUNCTION public.admin_campaign_metrics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_acquisition_funnel(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel_users(timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_paying_users_detail() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_web_roi(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_web_roi(timestamptz, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_uso(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_uso(timestamptz, timestamptz) TO authenticated;
