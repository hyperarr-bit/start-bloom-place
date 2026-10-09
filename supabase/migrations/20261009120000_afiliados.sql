-- PROGRAMA DE AFILIADOS (09/10/2026).
--
-- Cada afiliada tem um CÓDIGO (ex.: BIA) que é, na App Store, uma oferta de
-- código (offer code) do core_anual_97 com 7 dias grátis — criada por
-- scripts/asc-codigo-afiliado.mjs. O revenuecat-webhook lê `offer_code` do
-- evento, casa com `afiliados.codigo` e grava a venda aqui; a função
-- `afiliados` paga as comissões por Pix (Asaas) toda segunda e serve o painel
-- público da afiliada (/afiliado/<token_painel>).
--
-- RLS: NADA é público. Só service_role (as funções) e o papel admin (leitura,
-- pra conferência direta). O painel da afiliada passa pela função, que devolve
-- só agregados — nunca user_id, e-mail ou nome de cliente.

CREATE TABLE IF NOT EXISTS public.afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  -- maiúsculo, só letras e números (a Apple recusa caractere especial no custom code)
  codigo text NOT NULL UNIQUE CHECK (codigo = upper(codigo) AND codigo ~ '^[A-Z0-9]{3,64}$'),
  email text,
  pix_chave text NOT NULL,
  pix_tipo text NOT NULL CHECK (pix_tipo IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  -- 32 bytes aleatórios em base64url (43 chars): é a "senha" do painel
  token_painel text NOT NULL UNIQUE CHECK (length(token_painel) >= 32),
  -- trava do Pix automático: acima disso a semana fica SEGURADA e o dono é avisado
  limite_semanal_cents integer NOT NULL DEFAULT 50000 CHECK (limite_semanal_cents >= 0),
  pausado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.afiliado_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  -- pode ser nulo: a compra na App Store acontece antes da conta CORE existir
  user_id uuid,
  plataforma text NOT NULL CHECK (plataforma IN ('ios', 'android')),
  -- = original_transaction_id do RevenueCat: a MESMA linha acompanha
  -- teste → 1ª cobrança → reembolso (idempotência do webhook)
  transaction_id text NOT NULL UNIQUE,
  -- transaction_id da cobrança que gerou a comissão (a conversão do teste)
  transaction_id_cobranca text,
  produto text NOT NULL,
  valor_bruto_cents integer,
  valor_liquido_cents integer,
  comissao_cents integer NOT NULL DEFAULT 0 CHECK (comissao_cents >= 0),
  status text NOT NULL CHECK (status IN ('em_teste', 'pago', 'reembolsado', 'recusado')),
  -- por que ficou recusado/reembolsado (cartao_recusado, nao_pagou, cancelou_no_teste, reembolso)
  motivo text,
  cobrado_em timestamptz,
  -- preenchido quando a comissão entra num pagamento (enviado OU segurado)
  pagamento_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.afiliado_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  valor_cents integer NOT NULL CHECK (valor_cents > 0),
  asaas_transfer_id text,
  asaas_status text,
  -- enviando = Pix em curso (se ficar assim, conferir no Asaas antes de repetir)
  status text NOT NULL CHECK (status IN ('enviando', 'enviado', 'falhou', 'segurado')),
  motivo text,
  erro text,
  vendas_ids uuid[] NOT NULL DEFAULT '{}',
  -- a semana (segunda-feira, dia de Brasília) a que o pagamento se refere
  semana date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.afiliado_vendas
  ADD CONSTRAINT afiliado_vendas_pagamento_fk FOREIGN KEY (pagamento_id)
  REFERENCES public.afiliado_pagamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_afiliado_vendas_afiliado ON public.afiliado_vendas (afiliado_id, status);
CREATE INDEX IF NOT EXISTS idx_afiliado_vendas_a_pagar ON public.afiliado_vendas (cobrado_em) WHERE status = 'pago' AND pagamento_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_afiliado_pagamentos_afiliado ON public.afiliado_pagamentos (afiliado_id, criado_em DESC);

-- atualizado_em automático
CREATE OR REPLACE FUNCTION public.afiliados_touch_atualizado_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_afiliado_vendas_touch ON public.afiliado_vendas;
CREATE TRIGGER trg_afiliado_vendas_touch BEFORE UPDATE ON public.afiliado_vendas
  FOR EACH ROW EXECUTE FUNCTION public.afiliados_touch_atualizado_em();
DROP TRIGGER IF EXISTS trg_afiliado_pagamentos_touch ON public.afiliado_pagamentos;
CREATE TRIGGER trg_afiliado_pagamentos_touch BEFORE UPDATE ON public.afiliado_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.afiliados_touch_atualizado_em();

-- RLS: nada pro anon/authenticated comum; admin lê; service_role tudo.
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read afiliados" ON public.afiliados
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Service role full access afiliados" ON public.afiliados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read afiliado_vendas" ON public.afiliado_vendas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Service role full access afiliado_vendas" ON public.afiliado_vendas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read afiliado_pagamentos" ON public.afiliado_pagamentos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Service role full access afiliado_pagamentos" ON public.afiliado_pagamentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
