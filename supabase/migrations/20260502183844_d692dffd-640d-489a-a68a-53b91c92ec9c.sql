-- dp-affirmations: deve ser string[]
UPDATE public.user_data
SET value = '["Eu sou capaz de construir a vida que quero.","Cada dia me aproxima das minhas metas.","Disciplina é liberdade.","Pequenos passos diários geram grandes resultados."]'::jsonb,
    updated_at = now()
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'dp-affirmations';

-- dp-skills: deve ser string[]
UPDATE public.user_data
SET value = '["Edição de vídeo","Inglês","Comunicação","Vendas"]'::jsonb,
    updated_at = now()
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'dp-skills';

-- dp-skills-learn: deve ser string[]
UPDATE public.user_data
SET value = '["Espanhol","Figma avançado","Copywriting","Edição no DaVinci"]'::jsonb,
    updated_at = now()
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'dp-skills-learn';

-- dp-challenges: shape incerto, remove pra cair no default vazio
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'dp-challenges';

-- detox-habits: shape incerto, remove
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'detox-habits';

-- beauty-products: shape personalizado, remove pra evitar mismatch
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'beauty-products';

-- skincare steps shape pode estar errado
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key IN ('skincare-am-steps','skincare-pm-steps','capilar-schedule','capilar-history');

-- dp-future-letter: deve ser objeto {text, openDate, written}, eu botei string
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'dp-future-letter';

-- dp-wheel: shape incerto
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'dp-wheel';

-- saude-workouts-v2: shape complexo, remove pra usar defaultWorkoutPlan
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424' AND key = 'saude-workouts-v2';