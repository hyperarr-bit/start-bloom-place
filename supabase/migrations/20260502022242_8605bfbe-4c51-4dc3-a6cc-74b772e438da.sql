-- Backup adicional do que será removido (idempotente: já temos o snapshot completo,
-- mas guardamos o que sobrou pós-correção em uma marca separada caso queira reverter).

DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key NOT IN (
    -- preservar:
    'core-user-name',
    'core-welcome-done',
    'core-onboarding-done',
    'core-module-prefs',
    'core-home-widgets-v2',
    'core-hub-streak',
    'finance-incomes',
    'finance-fixed-expenses',
    'finance-expenses',
    'finance-dueDays',
    'finance-installments',
    'finance-investments',
    'finance-goals',
    'finance-last-seen-month',
    'finance-lastCheckIn',
    'finance-streak'
  );