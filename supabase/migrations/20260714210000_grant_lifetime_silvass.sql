-- 14/07 URGENTE (ordem do dono): cliente sil_vass@hotmail.com pagou (relato
-- dela) mas o acesso não liberou — ativar VITALÍCIO manualmente primeiro,
-- investigar a causa depois. Idempotente: upsert por user_id.
DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = 'sil_vass@hotmail.com' LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'sil_vass@hotmail.com: usuário não encontrado — nada feito';
    RETURN;
  END IF;

  UPDATE public.subscriptions SET
    status = 'active',
    plan = 'lifetime',
    billing_period = 'lifetime',
    payment_method = 'pix',
    customer_email = 'sil_vass@hotmail.com',
    current_period_start = now(),
    current_period_end = now() + interval '100 years'
  WHERE user_id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions
      (user_id, status, plan, billing_period, payment_method, customer_email,
       current_period_start, current_period_end)
    VALUES
      (uid, 'active', 'lifetime', 'lifetime', 'pix', 'sil_vass@hotmail.com',
       now(), now() + interval '100 years');
  END IF;

  RAISE NOTICE 'sil_vass ativada: %', uid;
END $$;
