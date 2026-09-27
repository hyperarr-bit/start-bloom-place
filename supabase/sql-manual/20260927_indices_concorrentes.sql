-- ÍNDICES DO ADMIN RÁPIDO (27/09) — rodar ANTES da migração 20260927120000_admin_rapido.sql.
--
-- COMO RODAR (SQL Editor do Supabase):
--   1. Cole este arquivo inteiro no editor.
--   2. Selecione SÓ o bloco "CREATE INDEX CONCURRENTLY ..." (as 3 linhas dele)
--      e aperte Run (ou Cmd+Enter). Com texto selecionado o editor roda só a
--      seleção.
--      Por quê: o editor manda o texto todo numa transação só, e
--      CREATE INDEX CONCURRENTLY recusa rodar dentro de transação
--      ("cannot run inside a transaction block"). Uma instrução por vez.
--   3. Depois selecione a consulta de conferência lá embaixo e rode: o índice
--      novo tem que aparecer com valido = true.
--
-- CONCURRENTLY = o app continua gravando eventos enquanto o índice é montado
-- (sem CONCURRENTLY a tabela de eventos ficaria travada pra escrita até o fim).
-- Leva de segundos a poucos minutos. IF NOT EXISTS = rodar de novo não faz nada.
--
-- O que JÁ EXISTE (criado por migração) e as funções novas usam — não precisa
-- criar de novo, a conferência abaixo mostra:
--   analytics_events (event_name, created_at)  — Campanhas, Funil, Usuários, cards do Uso
--   analytics_events (created_at)              — ROI da web
--   analytics_events (session_id)              — Usuários (sessões da lista), atribuição
--   analytics_events (user_id, created_at)     — (substituído pelo novo abaixo nas leituras do admin)
--   module_analytics (entered_at)              — Uso
--
-- O que FALTA: eventos por pessoa COM a sessão junto. A tela Pagantes conta,
-- pra cada assinante, primeiro/último sinal, sessões e dias ativos — só
-- precisa de (user_id, created_at, session_id). Com o índice abaixo o banco
-- responde lendo só o índice (index-only scan), sem abrir a linha inteira do
-- evento (o event_data é o que pesa). O mesmo índice atende a "sessão do
-- pagante" do Funil e as sessões dos compradores em Campanhas.
-- Parcial (só eventos COM usuário): os eventos anônimos do funil — a maior
-- parte da tabela — ficam de fora, e o índice sai pequeno.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_usuario_tempo_sessao
  ON public.analytics_events (user_id, created_at) INCLUDE (session_id)
  WHERE user_id IS NOT NULL;


-- ------------------------------------------------------------- conferência
-- (selecione daqui até o fim e rode)
SELECT c.relname AS tabela,
       i.relname AS indice,
       x.indisvalid AS valido,
       pg_size_pretty(pg_relation_size(i.oid)) AS tamanho,
       pg_get_indexdef(i.oid) AS definicao
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class c ON c.oid = x.indrelid
WHERE c.relname IN ('analytics_events', 'module_analytics')
ORDER BY c.relname, i.relname;

-- SE O ÍNDICE NOVO APARECER COM valido = false (a criação caiu no meio — o
-- CONCURRENTLY deixa um esqueleto inválido pra trás e o IF NOT EXISTS passa a
-- pular): selecione e rode SÓ a linha abaixo (sem os dois traços), e depois o
-- CREATE INDEX lá de cima de novo. Só apaga o esqueleto do índice novo; nenhum dado.
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_analytics_events_usuario_tempo_sessao;
