-- INDIQUE E GANHE DA WEB (23/11/2026) — NÃO APLICADA.
--
-- Reaproveita o programa de afiliados de 09/10 (20261009120000_afiliados.sql):
--   * quem indica = uma linha em `afiliados` com origem 'comprador' (criada sob demanda no pós-pago da /oferta,
--     quando a pessoa toca "Quero meu link"; a função `afiliados`, action indique_link);
--   * cada venda pelo link = uma linha em `afiliado_vendas` com plataforma 'web' e transaction_id = id do PaymentIntent
--     (gravada pelo stripe-webhook; reembolso/contestação vira 'reembolsado').
-- A chave Pix de quem indica chega DEPOIS (no painel), por isso pix_chave/pix_tipo passam a aceitar nulo — o Pix semanal
-- pula quem ainda não tem chave (as comissões ficam esperando).
--
-- Tudo idempotente (IF NOT EXISTS / DROP ... IF EXISTS): rodar 2× não quebra.
-- Aplicar com: npx supabase db query --linked -f supabase/migrations/20261123120000_indique_ganhe.sql

ALTER TABLE public.afiliados ALTER COLUMN pix_chave DROP NOT NULL;
ALTER TABLE public.afiliados ALTER COLUMN pix_tipo DROP NOT NULL;

ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'influencer';
ALTER TABLE public.afiliados DROP CONSTRAINT IF EXISTS afiliados_origem_check;
ALTER TABLE public.afiliados ADD CONSTRAINT afiliados_origem_check CHECK (origem IN ('influencer', 'comprador'));
-- a compra (PaymentIntent) que deu direito ao link — 1 link por compra; reembolso dela pausa o link
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS comprador_pi text;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS comprador_user_id uuid;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS comprador_email text;
-- landing_device_id da compra dela (trava: comprar pelo próprio link no mesmo aparelho)
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS aparelho text;
-- IP do checkout e digital do cartão (Stripe card.fingerprint) da compra dela: mesmo cartão = autoindicação; mesmo IP = revisar
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS ip text;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS cartao_fp text;

CREATE UNIQUE INDEX IF NOT EXISTS afiliados_comprador_pi_unico ON public.afiliados (comprador_pi) WHERE comprador_pi IS NOT NULL;
-- (sem índice único por e-mail: o e-mail do checkout não é verificado — 1 link por COMPRA, revisão 23/11 M3)
-- a mesma chave Pix não recebe por dois links (várias contas da mesma pessoa somando a trava semanal)
CREATE UNIQUE INDEX IF NOT EXISTS afiliados_pix_unico_comprador ON public.afiliados (pix_chave) WHERE origem = 'comprador' AND pix_chave IS NOT NULL;

ALTER TABLE public.afiliado_vendas DROP CONSTRAINT IF EXISTS afiliado_vendas_plataforma_check;
ALTER TABLE public.afiliado_vendas ADD CONSTRAINT afiliado_vendas_plataforma_check CHECK (plataforma IN ('ios', 'android', 'web'));
-- sha-256 do e-mail de quem comprou pelo link: só pra recusar uma chave Pix igual (nunca o e-mail em claro)
ALTER TABLE public.afiliado_vendas ADD COLUMN IF NOT EXISTS comprador_email_hash text;
-- quando a comissão libera (web: Pix +7 dias, cartão +30 dias por causa da contestação). Nulo = a régua antiga (cobrado_em + 7)
ALTER TABLE public.afiliado_vendas ADD COLUMN IF NOT EXISTS libera_em timestamptz;
