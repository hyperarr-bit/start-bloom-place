-- UPSELL DE PRESENTE (21/10/2026) — NÃO APLICADA (aplicar só quando o dono mandar ligar).
--
-- Quem acabou de pagar o CORE vitalício na web (/inicio, /hoje) pode dar o CORE pra sempre pra outra pessoa por
-- R$ 14,90 (Pix Asaas, oferta `pv149`). O Pix pago NÃO credita quem pagou: vira UM código aqui (1 por pedido), que a
-- página mostra num cartão pra mandar no WhatsApp (/presente/<código>). Quem abre cria a conta e a função
-- `presente-resgatar` dá o vitalício a quem ganhou (linha própria em subscriptions, payment_method 'presente',
-- abacatepay_billing_id = pedido, amount_cents = valor_centavos).
--
-- Quem escreve: asaas-pix (check), asaas-webhook e pix-reconcile (o código nasce no 1º caminho que vê o pagamento;
-- `pedido` UNIQUE = idempotente) e presente-resgatar (nome do cartão e o resgate). Regras em
-- supabase/functions/_shared/presente.ts.
--
-- RLS: FECHADA. Nenhuma policy — só a service_role (as funções) lê e escreve. anon/authenticated não veem nada.

CREATE TABLE IF NOT EXISTS public.presentes (
  -- 8 letras/números sem I, L, O, 0 e 1 (ALFABETO_PRESENTE)
  codigo text PRIMARY KEY CHECK (codigo ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  -- a conta que pagou (no /hoje é a sessão anônima do Pix; sem FK: a anônima pode ser apagada pela limpeza e o
  -- presente continua valendo)
  comprador_id uuid NOT NULL,
  -- o id do QR da Asaas (= order_id do pix_order_created): 1 pedido = 1 presente
  pedido text NOT NULL UNIQUE,
  valor_centavos integer NOT NULL DEFAULT 1490 CHECK (valor_centavos > 0),
  -- o nome no cartão ("Ana te deu o CORE pra sempre")
  de_nome text CHECK (de_nome IS NULL OR char_length(de_nome) <= 40),
  criado_em timestamptz NOT NULL DEFAULT now(),
  -- quem resgatou (1 vez só: o resgate marca com `WHERE resgatado_por IS NULL`)
  resgatado_por uuid,
  resgatado_em timestamptz,
  -- o link foi pro e-mail de quem comprou (a trava de verdade é webhook_events `presente-email:<pedido>`)
  email_enviado_em timestamptz,
  CHECK ((resgatado_por IS NULL) = (resgatado_em IS NULL))
);

CREATE INDEX IF NOT EXISTS presentes_comprador_idx ON public.presentes (comprador_id);
CREATE INDEX IF NOT EXISTS presentes_resgatado_por_idx ON public.presentes (resgatado_por) WHERE resgatado_por IS NOT NULL;

ALTER TABLE public.presentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.presentes FROM anon, authenticated;
GRANT ALL ON TABLE public.presentes TO service_role;
