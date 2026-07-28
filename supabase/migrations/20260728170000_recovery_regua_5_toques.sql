-- 28/07: régua de recuperação vira 5 toques (h1, h24, h48, h72, d7).
-- Diagnóstico: 895 pessoas/semana caem no balde, 2 toques recuperavam 1,7%
-- (R$45/dia). Benchmark (Cal AI/win-back/carrinho BR): arco de 3+ atos com
-- deadline ESPECÍFICO no fim converte 2-3x mais; sem desconto no 1º toque
-- (quem volta sem cupom retém 2,6x mais — pesquisa Airbridge).
--
--  h1  (1-24h) : continuidade, preço cheio — sem desconto no 1º toque
--  h24 (24-48h): oferta 14,90 com validade de 48h anunciada
--  h48 (48-72h): prova social + FOMO, oferta ainda vale
--  h72 (72-96h): ÚLTIMA chamada — depois dele nenhum e-mail volta a ofertar ds
--  d7  (7-10d) : winback frio, sem oferta, preço cheio
--
-- O deadline é honesto NO CANAL: após o h72 nenhum e-mail oferece 14,90 de
-- novo (d7 é preço cheio). Kill técnico do link ?oferta=ds exige mudança no
-- front — FICA PRA DEPOIS (freeze de push web de 28/07, fila de 28 commits).

-- 1) constraint aceita os novos estágios
ALTER TABLE public.funnel_recovery_emails DROP CONSTRAINT IF EXISTS funnel_recovery_emails_stage_check;
ALTER TABLE public.funnel_recovery_emails ADD CONSTRAINT funnel_recovery_emails_stage_check
  CHECK (stage IN ('h1', 'h24', 'h48', 'h72', 'd7'));

-- 2) candidatos: mesma seleção, 5 janelas. Janelas FECHADAS (cada estágio só
-- dispara dentro da própria janela) — quem entrou tarde não toma 5 e-mails
-- de uma vez; pega o estágio da janela atual e segue a régua dali.
CREATE OR REPLACE FUNCTION public.recovery_email_candidates()
RETURNS TABLE (user_id uuid, email text, display_name text, stage text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::text,
         COALESCE(p.display_name, split_part(u.email, '@', 1))::text,
         s.stage
  FROM auth.users u
  CROSS JOIN LATERAL (VALUES ('h1'), ('h24'), ('h48'), ('h72'), ('d7')) AS s(stage)
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email IS NOT NULL
    AND NOT public.is_test_user(u.id)
    AND lower(u.email) <> 'jv20101958@gmail.com'
    AND (
      (s.stage = 'h1'  AND u.created_at < now() - interval '1 hour'
                       AND u.created_at > now() - interval '24 hours')
      OR
      (s.stage = 'h24' AND u.created_at < now() - interval '24 hours'
                       AND u.created_at > now() - interval '48 hours')
      OR
      (s.stage = 'h48' AND u.created_at < now() - interval '48 hours'
                       AND u.created_at > now() - interval '72 hours')
      OR
      (s.stage = 'h72' AND u.created_at < now() - interval '72 hours'
                       AND u.created_at > now() - interval '96 hours')
      OR
      (s.stage = 'd7'  AND u.created_at < now() - interval '7 days'
                       AND u.created_at > now() - interval '10 days')
    )
    AND NOT EXISTS (SELECT 1 FROM public.subscriptions sub WHERE sub.user_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.funnel_recovery_emails f
      WHERE f.user_id = u.id AND f.stage = s.stage
    )
  ORDER BY u.created_at
  LIMIT 60;
$$;

REVOKE EXECUTE ON FUNCTION public.recovery_email_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recovery_email_candidates() TO service_role;
