-- ============================================================
-- Fix demo data shapes for jv20101958@gmail.com
-- user_id: 2c896992-6849-4ca6-9a66-5c2414bb9424
-- ============================================================

-- 1) goals-board-v2 (Metas) — reescrever no shape esperado por GoalsBoardV2
UPDATE public.user_data
SET value = '[
  {
    "id": "gv1",
    "title": "Lançar curso online de Finanças Pessoais",
    "heroImage": "",
    "actionGroups": [
      {
        "id": "ag1",
        "label": "Pré-produção",
        "tasks": [
          {"id":"tx1","text":"Definir grade de aulas","done":true},
          {"id":"tx2","text":"Gravar trailer","done":true},
          {"id":"tx3","text":"Criar landing page","done":false}
        ]
      },
      {
        "id": "ag2",
        "label": "Lançamento",
        "tasks": [
          {"id":"tx4","text":"Anúncios Meta Ads","done":false},
          {"id":"tx5","text":"E-mail marketing","done":false}
        ]
      }
    ],
    "referenceLinks": [],
    "referenceImages": [],
    "vision": {
      "meta": "Lançar até 01/07/2026",
      "objetivo": "Curso online de Finanças Pessoais com 3 módulos",
      "tempo": "2 meses"
    },
    "problems": [
      {"id":"pr1","problem":"Pouco tempo pra gravar","solution":"Bloquear 2 manhãs por semana"}
    ]
  },
  {
    "id": "gv2",
    "title": "Inglês fluente até o fim do ano",
    "heroImage": "",
    "actionGroups": [
      {
        "id": "ag3",
        "label": "Rotina diária",
        "tasks": [
          {"id":"tx6","text":"30min Cambly por dia","done":true},
          {"id":"tx7","text":"1 episódio de série em inglês","done":true}
        ]
      }
    ],
    "referenceLinks": [],
    "referenceImages": [],
    "vision": {
      "meta": "Conversar fluente até 29/10/2026",
      "objetivo": "Atingir nível B2/C1",
      "tempo": "6 meses"
    },
    "problems": []
  }
]'::jsonb
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'goals-board-v2';

-- 2) goals-timeline — chaves corretas (6meses/1ano/3anos/5anos)
UPDATE public.user_data
SET value = '{
  "6meses": {"image":"","items":[
    {"id":"tl1","text":"Lançar curso de finanças","done":false},
    {"id":"tl2","text":"Atingir 10k seguidores no Instagram","done":false}
  ]},
  "1ano":   {"image":"","items":[
    {"id":"tl3","text":"Inglês fluente nível C1","done":false},
    {"id":"tl4","text":"Reserva de emergência completa","done":false}
  ]},
  "3anos":  {"image":"","items":[
    {"id":"tl5","text":"Trocar de carro","done":false},
    {"id":"tl6","text":"Comprar apartamento próprio","done":false}
  ]},
  "5anos":  {"image":"","items":[
    {"id":"tl7","text":"Independência financeira","done":false}
  ]}
}'::jsonb
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'goals-timeline';

-- 3) rotina-habits — deve ser string[]
UPDATE public.user_data
SET value = '["Beber 2L de água","Treinar","Ler 30min","Meditar 10min","Dormir até 23h","Sem celular após 22h"]'::jsonb
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'rotina-habits';

-- 4) rotina-habits-checked — só booleanos, todos os 7 dias preenchidos
UPDATE public.user_data
SET value = '{
  "SEGUNDA": [true,true,false,true,true,true],
  "TERÇA":   [true,true,true,true,false,true],
  "QUARTA":  [false,false,false,false,false,false],
  "QUINTA":  [false,false,false,false,false,false],
  "SEXTA":   [false,false,false,false,false,false],
  "SÁBADO":  [false,false,false,false,false,false],
  "DOMINGO": [false,false,false,false,false,false]
}'::jsonb
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'rotina-habits-checked';

-- 5) Pet routine — chave correta é pet-routine-tasks-<petId>
INSERT INTO public.user_data (user_id, key, value)
VALUES (
  '2c896992-6849-4ca6-9a66-5c2414bb9424',
  'pet-routine-tasks-pet1',
  '[
    {"id":"pr1","label":"Ração manhã","emoji":"🍖"},
    {"id":"pr2","label":"Passeio matinal","emoji":"🐕"},
    {"id":"pr3","label":"Ração tarde","emoji":"🍖"},
    {"id":"pr4","label":"Brincar","emoji":"🎾"}
  ]'::jsonb
)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Remove a chave incorreta (não é lida por nenhum componente)
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'pet-routine';

-- 6) Saude — supplements com campos completos (time, stock, dosesPerDay)
UPDATE public.user_data
SET value = '[
  {"id":"sup1","name":"Vitamina D3 2000UI","time":"08:00","stock":42,"dosesPerDay":1},
  {"id":"sup2","name":"Ômega 3","time":"12:30","stock":18,"dosesPerDay":1},
  {"id":"sup3","name":"Creatina 5g","time":"17:00","stock":60,"dosesPerDay":1}
]'::jsonb
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'core-saude-supplements';

-- 7) Carreira — status "current" não existe; usar "aplicado" + completar campos
UPDATE public.user_data
SET value = '[
  {"id":"cj1","company":"Empresa XYZ","role":"Analista de Marketing","link":"","status":"aplicado","date":"2024-03-01","salary":"R$ 6.500","notes":"Posição atual","favorite":true}
]'::jsonb
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key = 'career-jobs';