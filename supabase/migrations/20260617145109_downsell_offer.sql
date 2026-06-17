-- Permite registrar o uso das ofertas de checkout em retention_offers_used.
-- O CHECK original só aceitava ('discount','pause'), então o insert de
-- offer_type='winback80' (já em produção no abacatepay-checkout) vinha sendo
-- silenciosamente rejeitado pela constraint. Aqui liberamos 'winback80' e
-- adicionamos 'downsell' (roleta de saída da tela de planos), mantendo o
-- controle anti-abuso de "1x por usuário por tipo".
ALTER TABLE public.retention_offers_used
  DROP CONSTRAINT IF EXISTS retention_offers_type_check;

ALTER TABLE public.retention_offers_used
  ADD CONSTRAINT retention_offers_type_check
  CHECK (offer_type IN ('discount','pause','winback80','downsell'));
