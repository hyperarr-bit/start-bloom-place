-- 01/08: preço mudou 27,90 → 19,90 (oferta Cakto i9o4ob8) e o pix-reconcile
-- creditou as 2 primeiras vendas do preço novo com a TABELA CHUMBADA antiga
-- (PRECOS_CENTAVOS.lifetime = 2790) em vez do valor real do pedido.
-- Prova por pedido (pix_order_created.amount_cents = 1990):
--   user 8dfd8073-… order f8baa915-… (pago ~19:37)
--   user 023315e4-… order e184f980-… (pago ~14:18)
-- O reconcile já foi corrigido pra usar o amount do create; isto conserta o
-- retrato. Receita real de cada uma: R$ 19,90.

UPDATE public.subscriptions
SET amount_cents = 1990
WHERE user_id IN (
  '8dfd8073-28ce-4797-b6e9-e5f2681bdce2',
  '023315e4-3079-4cd2-b93c-b23ed115cca0'
) AND amount_cents = 2790;
