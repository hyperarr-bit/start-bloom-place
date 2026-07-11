-- Cancelamento in-app agora agenda (status "cancel_scheduled"): a renovação
-- morre, mas o acesso vale até current_period_end — que é o que o diálogo de
-- cancelamento sempre prometeu. "canceled" puro fica reservado pra reembolso/
-- chargeback/fim de período (revoga na hora).
--
-- Correção retroativa: a assinante de 11/07 (mensal via downsell) cancelou a
-- renovação 47min após pagar e foi BLOQUEADA com o mês pago. Devolve o acesso
-- dela até o fim do período. (Reembolsadas continuam canceled — dinheiro
-- devolvido, sem acesso.)
UPDATE public.subscriptions
SET status = 'cancel_scheduled'
WHERE user_id = '67facafb-3464-485f-b0de-e03d12e94e71'
  AND status = 'canceled'
  AND current_period_end > now();
