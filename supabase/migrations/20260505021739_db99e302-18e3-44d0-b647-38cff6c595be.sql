DO $$
DECLARE
  uid uuid := '2c896992-6849-4ca6-9a66-5c2414bb9424';
  v jsonb;
  cleaned jsonb;
  k text;
  val jsonb;
  canon text;
BEGIN
  -- 1) dp-gratitude: keep only YYYY-MM-DD keys with array values
  SELECT value INTO v FROM public.user_data WHERE user_id = uid AND key = 'dp-gratitude';
  IF v IS NOT NULL AND jsonb_typeof(v) = 'object' THEN
    cleaned := '{}'::jsonb;
    FOR k, val IN SELECT * FROM jsonb_each(v) LOOP
      IF k ~ '^\d{4}-\d{2}-\d{2}$' THEN
        IF jsonb_typeof(val) = 'array' THEN
          cleaned := cleaned || jsonb_build_object(k, val);
        ELSIF jsonb_typeof(val) = 'object' AND jsonb_typeof(val->'items') = 'array' THEN
          cleaned := cleaned || jsonb_build_object(k, val->'items');
        END IF;
      ELSIF jsonb_typeof(val) = 'object' AND val ? 'date' AND val ? 'items' THEN
        canon := val->>'date';
        IF canon ~ '^\d{4}-\d{2}-\d{2}$' AND NOT (cleaned ? canon) THEN
          cleaned := cleaned || jsonb_build_object(canon, val->'items');
        END IF;
      END IF;
    END LOOP;
    UPDATE public.user_data SET value = cleaned, updated_at = now()
      WHERE user_id = uid AND key = 'dp-gratitude';
  END IF;

  -- 2) core-mood-log: normalize each entry to {value, emoji?, time?}
  SELECT value INTO v FROM public.user_data WHERE user_id = uid AND key = 'core-mood-log';
  IF v IS NOT NULL AND jsonb_typeof(v) = 'object' THEN
    cleaned := '{}'::jsonb;
    FOR k, val IN SELECT * FROM jsonb_each(v) LOOP
      IF k !~ '^\d{4}-\d{2}-\d{2}$' THEN CONTINUE; END IF;
      IF jsonb_typeof(val) = 'number' THEN
        cleaned := cleaned || jsonb_build_object(k, jsonb_build_object('value', val));
      ELSIF jsonb_typeof(val) = 'object' THEN
        IF val ? 'value' AND jsonb_typeof(val->'value') = 'number' THEN
          cleaned := cleaned || jsonb_build_object(k, val);
        ELSIF val ? 'mood' AND jsonb_typeof(val->'mood') = 'number' THEN
          cleaned := cleaned || jsonb_build_object(k,
            jsonb_build_object('value', val->'mood') ||
            (CASE WHEN val ? 'emoji' THEN jsonb_build_object('emoji', val->'emoji') ELSE '{}'::jsonb END) ||
            (CASE WHEN val ? 'time'  THEN jsonb_build_object('time',  val->'time')  ELSE '{}'::jsonb END)
          );
        END IF;
      END IF;
    END LOOP;
    UPDATE public.user_data SET value = cleaned, updated_at = now()
      WHERE user_id = uid AND key = 'core-mood-log';
  END IF;

  -- 3) saude-meals: drop UPPER duplicates of weekday keys
  SELECT value INTO v FROM public.user_data WHERE user_id = uid AND key = 'saude-meals';
  IF v IS NOT NULL AND jsonb_typeof(v) = 'object' THEN
    cleaned := '{}'::jsonb;
    FOR k, val IN SELECT * FROM jsonb_each(v) LOOP
      -- Skip if an exact Title-case version exists alongside an UPPER one
      IF k IN ('SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO','DOMINGO')
         AND v ? initcap(lower(k)) THEN
        CONTINUE;
      END IF;
      cleaned := cleaned || jsonb_build_object(k, val);
    END LOOP;
    UPDATE public.user_data SET value = cleaned, updated_at = now()
      WHERE user_id = uid AND key = 'saude-meals';
  END IF;
END $$;