UPDATE public.user_data
SET value = to_jsonb(ARRAY(SELECT jsonb_object_keys(value) ORDER BY 1)),
    updated_at = now()
WHERE key = 'saude-workout-log'
  AND jsonb_typeof(value) = 'object';