-- 1) dieta-meals-config: deve ser array de strings (nomes das refeições)
UPDATE public.user_data
SET value = '["Café da Manhã","Almoço","Lanche","Janta"]'::jsonb,
    updated_at = now()
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'dieta-meals-config';

-- 2) saude-meals: deve ser Record<dia_semana, Record<refeição, string>>
UPDATE public.user_data
SET value = jsonb_build_object(
  'Segunda', jsonb_build_object(
    'Café da Manhã','Pão integral + ovo + café',
    'Almoço','Frango grelhado + arroz + brócolis',
    'Lanche','Iogurte + granola',
    'Janta','Sopa de legumes'
  ),
  'Terça', jsonb_build_object(
    'Café da Manhã','Tapioca com queijo + suco verde',
    'Almoço','Strogonoff de frango + arroz',
    'Lanche','Banana com pasta de amendoim',
    'Janta','Sanduíche natural'
  ),
  'Quarta', jsonb_build_object(
    'Café da Manhã','Vitamina de banana + aveia',
    'Almoço','Macarrão à bolonhesa',
    'Lanche','Mix de castanhas',
    'Janta','Omelete de queijo'
  ),
  'Quinta', jsonb_build_object(
    'Café da Manhã','Ovos mexidos + torrada',
    'Almoço','Peixe assado + batata doce',
    'Lanche','Maçã + iogurte',
    'Janta','Salada caesar'
  ),
  'Sexta', jsonb_build_object(
    'Café da Manhã','Panqueca de aveia',
    'Almoço','Pizza caseira',
    'Lanche','Whey + frutas',
    'Janta','Hambúrguer artesanal'
  ),
  'Sábado', jsonb_build_object(
    'Café da Manhã','Café da manhã reforçado (ovos, pão, frutas)',
    'Almoço','Churrasco',
    'Lanche','Suco natural',
    'Janta','Pastel'
  ),
  'Domingo', jsonb_build_object(
    'Café da Manhã','Pão de queijo + café',
    'Almoço','Lasanha',
    'Lanche','Bolo caseiro',
    'Janta','Sopa creme de abóbora'
  )
),
updated_at = now()
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'saude-meals';

-- 3) Garantir core-home-widgets-v2 com widgets ativados (estava [])
UPDATE public.user_data
SET value = '["finances","habits","water","workout","books","reading","calories","sleep"]'::jsonb,
    updated_at = now()
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'core-home-widgets-v2'
  AND (value = '[]'::jsonb OR value IS NULL);