-- Fix seeded data shapes for test user that were causing runtime crashes
DO $$
DECLARE
  uid uuid := '2c896992-6849-4ca6-9a66-5c2414bb9424';
BEGIN
  -- 1) Dieta: diary v2 com formato errado (macros) -> reseta vazio para o componente preencher
  UPDATE public.user_data
     SET value = '{}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'dieta-diary-v2';

  -- 2) Dieta: meals-config era array de strings -> garante array de strings limpo (componente usa string[])
  UPDATE public.user_data
     SET value = '["Café da Manhã","Almoço","Lanche","Janta"]'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'dieta-meals-config';

  -- 3) Casa: meal-plan completo com café/lanche
  UPDATE public.user_data
     SET value = jsonb_build_object(
        'Segunda', jsonb_build_object('cafe','Tapioca com queijo','almoco','Frango grelhado + arroz + brócolis','lanche','Iogurte com granola','janta','Sopa de legumes'),
        'Terça',   jsonb_build_object('cafe','Pão integral + ovo','almoco','Strogonoff de frango','lanche','Banana com pasta de amendoim','janta','Sanduíche natural'),
        'Quarta',  jsonb_build_object('cafe','Vitamina de frutas','almoco','Macarrão à bolonhesa','lanche','Mix de castanhas','janta','Omelete de queijo'),
        'Quinta',  jsonb_build_object('cafe','Crepioca','almoco','Peixe assado + batata doce','lanche','Maçã + amêndoas','janta','Salada caesar'),
        'Sexta',   jsonb_build_object('cafe','Panqueca de aveia','almoco','Pizza caseira','lanche','Smoothie verde','janta','Hambúrguer artesanal'),
        'Sábado',  jsonb_build_object('cafe','Café com pão na chapa','almoco','Churrasco','lanche','Frutas','janta','Pastel'),
        'Domingo', jsonb_build_object('cafe','Brunch completo','almoco','Lasanha','lanche','Bolo caseiro','janta','Sopa creme de abóbora')
      ), updated_at = now()
   WHERE user_id = uid AND key = 'casa-meal-plan';

  -- 4) Pet: weight como número
  UPDATE public.user_data
     SET value = '[{"id":"pet1","name":"Thor","species":"Cachorro","breed":"Labrador","birthday":"2023-01-15","weight":32,"photoUrl":""}]'::jsonb,
         updated_at = now()
   WHERE user_id = uid AND key = 'pet-list';

  -- 5) Rotina: log de hábitos antigo usa IDs h1..h5 que não existem no array de strings -> limpa
  UPDATE public.user_data
     SET value = '{}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'core-rotina-habit-log';

  -- 6) Rotina: schedule com chaves "0:00" -> reset para vazio (usuário recria via UI sem crash)
  UPDATE public.user_data
     SET value = '{}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'rotina-schedule';

  -- 7) Rotina: habits-checked com 6 hábitos mas se rotina-habits mudar pode quebrar -> normaliza para vazio
  UPDATE public.user_data
     SET value = '{}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'rotina-habits-checked';

  -- 8) Viagens: garante shape mínimo
  UPDATE public.user_data
     SET value = '{"trips":[],"current":null}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'travel-budget-v2'
     AND (value IS NULL OR jsonb_typeof(value) != 'object');

  UPDATE public.user_data
     SET value = '[]'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'travel-packing-v2'
     AND (value IS NULL OR jsonb_typeof(value) != 'array');

  -- 9) Treino: weekly-volume objeto vazio se não-objeto
  UPDATE public.user_data
     SET value = '{}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'treino-weekly-volume'
     AND (value IS NULL OR jsonb_typeof(value) != 'object');

  -- 10) Saúde: meals-config no shape esperado (mesmo defaultMeals da Dieta)
  UPDATE public.user_data
     SET value = '{}'::jsonb, updated_at = now()
   WHERE user_id = uid AND key = 'saude-meals'
     AND (value IS NULL OR jsonb_typeof(value) != 'object');
END $$;