-- 22/07 (auditoria de vazamento, ordem do dono): 8 cobranças com pagamento
-- confirmado NO GATEWAY (sonda probeOnly, re-checada 2x) e SEM linha em
-- subscriptions: 6 AbacatePay + 2 Pagar.me (achadas na varredura completa da
-- pix-reconcile). Causa: webhooks mortos desde a migração de gateway ~20/07;
-- o grant do front só roda com o modal aberto — quem copiou, fechou e pagou
-- no banco ficou sem acesso. R$ 171,20 no total (4x 27,90 + 4x 14,90).
-- current_period_start = horário do QR (o Pix paga na janela de 30min) pra
-- não distorcer a série diária de conversão. Idempotente por user_id.
DO $$
DECLARE
  r RECORD;
  uemail text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('a873746f-aa3a-4234-ac0b-6f9ec7e74880'::uuid, 'pix_char_0uEU20rXrrawybfCAJdpudfU', 1490, '2026-07-20T08:08:00Z'::timestamptz),
      ('02c46da2-cc73-4af8-bf1b-d5960168887c'::uuid, 'pix_char_BdgEyuZCmk23WtrNeUjdDbHP', 2790, '2026-07-20T18:54:00Z'::timestamptz),
      ('6e1fb670-ad52-44da-b321-2d805f614737'::uuid, 'pix_char_HRuWMrhTqx6NXJ4RcqhWH5w6', 2790, '2026-07-20T20:23:00Z'::timestamptz),
      ('1fc9c485-75a8-4a36-a704-de21db2f7e73'::uuid, 'pix_char_H4j53XCKKZLehFksKK4b2TFH', 1490, '2026-07-21T01:53:00Z'::timestamptz),
      ('5b9c34de-ecee-438a-bac7-69c72f114633'::uuid, 'pix_char_FnKS5KnBqUhqaLxgpurKL0mR', 2790, '2026-07-21T15:24:00Z'::timestamptz),
      ('dbbd8499-4bc1-44ac-a4cf-5f486a9726a8'::uuid, 'pix_char_Rgja4DZapsRfhkeCLCReLJS0', 1490, '2026-07-22T18:31:25Z'::timestamptz),
      ('7211bb4e-e7c8-4755-b28a-da1449e4293e'::uuid, 'or_zAMEPWQc5sVY4B8p', 1490, '2026-07-21T16:28:45Z'::timestamptz),
      ('32b8c0cc-304e-4785-9f29-5cee406baf5b'::uuid, 'or_kv8rnWZ1SoSMD095', 2790, '2026-07-21T17:23:21Z'::timestamptz)
    ) AS t(uid, billing_id, cents, pago_em)
  LOOP
    SELECT email INTO uemail FROM auth.users WHERE id = r.uid;
    IF uemail IS NULL THEN
      RAISE NOTICE '% sem auth.users — pulado', r.uid;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = r.uid) THEN
      RAISE NOTICE '% já tem assinatura — pulado', r.uid;
      CONTINUE;
    END IF;

    INSERT INTO public.subscriptions
      (user_id, status, plan, billing_period, payment_method, customer_email,
       current_period_start, current_period_end,
       abacatepay_billing_id, abacatepay_subscription_id, amount_cents)
    VALUES
      (r.uid, 'active', 'lifetime', 'lifetime', 'pix', uemail,
       r.pago_em, r.pago_em + interval '100 years',
       r.billing_id, r.billing_id, r.cents);

    RAISE NOTICE 'creditado: % (%) R$ %', r.uid, uemail, r.cents / 100.0;
  END LOOP;
END $$;
