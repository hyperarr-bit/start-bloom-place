INSERT INTO public.subscriptions (user_id, status, plan, billing_period, payment_method, current_period_start, current_period_end)
SELECT id, 'active', 'premium', 'yearly', 'card', now(), now() + interval '10 years'
FROM auth.users WHERE email = 'hyperarr@gmail.com'
ON CONFLICT DO NOTHING;