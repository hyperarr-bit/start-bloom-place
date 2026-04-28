DELETE FROM public.user_data
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'store.street.brasil@gmail.com')
  AND key IN ('core-user-name', 'heatmap-log', 'finance-last-seen-month');