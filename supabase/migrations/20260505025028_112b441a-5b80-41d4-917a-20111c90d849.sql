-- Ativa a assinatura do usuário que pagou mas teve o webhook falhando por payload incompleto
-- Limpa a entrada de webhook_events que falhou (permite retry da AbacatePay)
DELETE FROM public.webhook_events WHERE id = 'log_HzaARF3YLDyaK3cj2bH5YxFG';

-- Ativa subscription mensal CORE PRO para store.street.brasil@gmail.com
INSERT INTO public.subscriptions (
  user_id, status, plan, billing_period, payment_method,
  customer_email, current_period_start, current_period_end
) VALUES (
  'b36a33e3-5412-4692-a796-86bab241c3e0',
  'active',
  'core-pro',
  'monthly',
  'card',
  'store.street.brasil@gmail.com',
  now(),
  now() + interval '1 month'
)
ON CONFLICT DO NOTHING;

-- Registra evento analítico de conversão
INSERT INTO public.analytics_events (user_id, event_name, event_data, trial_day)
VALUES (
  'b36a33e3-5412-4692-a796-86bab241c3e0',
  'subscription_started',
  '{"plan":"core-pro","billing_period":"monthly","payment_method":"card","manual_recovery":true}'::jsonb,
  NULL
);