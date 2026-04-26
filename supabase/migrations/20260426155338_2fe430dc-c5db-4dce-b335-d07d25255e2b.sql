-- ============================================
-- SECURITY HARDENING MIGRATION
-- ============================================

-- 1) CRÍTICO: Tornar bucket 'receipts' privado e remover policy pública anon
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
DROP POLICY IF EXISTS "Public can view receipts" ON storage.objects;

-- 2) ALTA: Sistema de roles seguro (user_roles + has_role)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Seed admin existente
INSERT INTO public.user_roles (user_id, role)
VALUES ('2c896992-6849-4ca6-9a66-5c2414bb9424', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Atualizar policy de module_analytics para usar has_role
DROP POLICY IF EXISTS "Admin can read all analytics" ON public.module_analytics;
CREATE POLICY "Admins read all analytics"
  ON public.module_analytics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) ALTA: Tabela de idempotência para webhook do AbacatePay
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'abacatepay',
  event text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem policies para usuários: somente service_role acessa via edge function

-- 4) MÉDIA: Trigger on_auth_user_created (corrigir profiles ausentes)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles para usuários existentes
INSERT INTO public.profiles (id, created_at)
SELECT u.id, u.created_at FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 5) BAIXA: Revogar SELECT de anon nas tabelas privadas
-- (RLS já bloqueia, mas remove da introspecção GraphQL anon)
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.subscriptions FROM anon;
REVOKE SELECT ON public.user_data FROM anon;
REVOKE SELECT ON public.module_analytics FROM anon;
REVOKE SELECT ON public.app_config FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.webhook_events FROM anon;