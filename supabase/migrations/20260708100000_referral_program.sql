-- Indique e ganhe: cada usuário tem um código; quem chega por link ?ref=CODE
-- fica marcado; quando o indicado faz a 1ª compra (cakto-webhook), os dois
-- ganham +30 dias de assinatura. referral_rewards garante 1 recompensa por
-- indicado (unique) — idempotente contra reprocessamento de webhook.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE
    DEFAULT substr(md5(gen_random_uuid()::text), 1, 8);

UPDATE public.profiles
SET referral_code = substr(md5(gen_random_uuid()::text), 1, 8)
WHERE referral_code IS NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_code text;

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver as próprias recompensas (como indicador) — escrita só via
-- service role (webhook).
CREATE POLICY "referral_rewards_select_own" ON public.referral_rewards
  FOR SELECT USING (auth.uid() = referrer_id);
