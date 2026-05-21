INSERT INTO public.app_config (key, value, updated_at)
VALUES ('analytics_reset_at', jsonb_build_object('at', now()), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;