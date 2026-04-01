INSERT INTO public.subscriptions (user_id, status, plan, billing_period, current_period_start, current_period_end)
VALUES (
  '2c896992-6849-4ca6-9a66-5c2414bb9424',
  'active',
  'premium',
  'lifetime',
  NOW(),
  '2099-12-31T23:59:59Z'
) ON CONFLICT DO NOTHING;