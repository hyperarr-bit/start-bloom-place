-- NÃO RODAR SEM O OK DO DONO. NÃO É MIGRAÇÃO: fica fora de supabase/migrations de propósito.
--
-- Por quê: a trava `grant:<gateway>:<pedido>` ganha event='creditado' quando o crédito grava, e trava com a marca nunca é
-- apagada. As travas de antes dessa versão estão sem marca. Este UPDATE marca só as que têm a LINHA do pedido, ou seja, as
-- que o banco prova que valeram: se a linha for reescrita depois, a marca segura um crédito duplo.
-- Trava sem linha fica SEM marca, de propósito: pode ser pagamento sem crédito, e marcar esconderia isso pra sempre. Essas
-- viram chamado (pix_sem_credito) quando o pedido voltar a passar pelo crédito.
--
-- QUANDO: só DEPOIS do deploy de TODAS as funções que usam grant-pix/trava-grant (função antiga ignora a marca).
-- O corte fixo é o CORTE_MARCA_MS de _shared/trava-grant.ts. Se ele mudar, mudar aqui também.

-- 1) OLHAR ANTES (só leitura): quantas marcam e quantas ficam de fora.
SELECT
  count(*) FILTER (WHERE tem_linha) AS vai_marcar,
  count(*) FILTER (WHERE NOT tem_linha) AS fica_sem_marca
FROM (
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.abacatepay_billing_id = substring(w.id from '^grant:[^:]+:(.*)$')
  ) AS tem_linha
  FROM public.webhook_events w
  WHERE w.source = 'grant'
    AND w.processed_at < TIMESTAMPTZ '2026-11-10 00:00:00+00'
    AND w.processed_at < now() - interval '2 hours'
    AND w.event IS DISTINCT FROM 'creditado'
) t;

-- 2) A MARCA.
UPDATE public.webhook_events w
SET event = 'creditado'
WHERE w.source = 'grant'
  AND w.processed_at < TIMESTAMPTZ '2026-11-10 00:00:00+00'
  AND w.processed_at < now() - interval '2 hours'
  AND w.event IS DISTINCT FROM 'creditado'
  AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.abacatepay_billing_id = substring(w.id from '^grant:[^:]+:(.*)$')
  );
