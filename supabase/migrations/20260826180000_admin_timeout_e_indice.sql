-- ADMIN VOLTOU A ABRIR (26/08).
--
-- Sintoma: /admin/funil e /admin/usuarios devolviam 500 com
-- "canceling statement due to statement timeout" (57014) — o corte de 8s do
-- PostgREST. /admin/pagantes respondia, mas em 7,0s: raspando o mesmo limite.
--
-- Duas causas, as duas tratadas aqui.
--
-- 1. FALTAVA ÍNDICE EM created_at. A tabela tem 214k linhas e TODA CTE dessas
--    funções começa com `created_at >= _from AND created_at < _to`. Os índices
--    existentes são (user_id, created_at) e (event_name, created_at) — nenhum
--    serve pra um filtro que não fixa a primeira coluna, então cada janela de
--    30 dias virava varredura sequencial da tabela inteira, várias vezes por
--    chamada (o funil tem 6 CTEs em cima de analytics_events).
--
-- 2. O TETO DE 8s É DO PostgREST, NÃO DA CONSULTA. Painel interno, chamado
--    algumas vezes por dia, pode demorar 30s sem incomodar ninguém. Melhor um
--    relatório que abre em 9s do que um 500. O teto por função não afeta mais
--    nada do banco — não é ALTER ROLE.

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);

ALTER FUNCTION public.admin_acquisition_funnel(timestamptz, timestamptz, text)
  SET statement_timeout = '30s';
ALTER FUNCTION public.admin_funnel_users(timestamptz, timestamptz, int)
  SET statement_timeout = '30s';
ALTER FUNCTION public.admin_paying_users_detail()
  SET statement_timeout = '30s';
