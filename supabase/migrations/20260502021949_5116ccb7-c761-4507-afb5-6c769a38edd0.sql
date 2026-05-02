-- 1. Backup table (apenas dono pode ler)
CREATE TABLE IF NOT EXISTS public.user_data_backup_lucas_seed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  value jsonb,
  original_created_at timestamptz,
  original_updated_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_data_backup_lucas_seed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own backup" ON public.user_data_backup_lucas_seed;
CREATE POLICY "Owner reads own backup"
  ON public.user_data_backup_lucas_seed
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full backup" ON public.user_data_backup_lucas_seed;
CREATE POLICY "Service role full backup"
  ON public.user_data_backup_lucas_seed
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Snapshot atual ANTES de mexer
INSERT INTO public.user_data_backup_lucas_seed (user_id, key, value, original_created_at, original_updated_at)
SELECT user_id, key, value, created_at, updated_at
FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424';

-- 3. Apaga chaves do seed Lucas que estão em formato incompatível /
--    poluindo módulos (transações tx_* sintéticas, financas_*, dados duplicados).
DELETE FROM public.user_data
WHERE user_id = '2c896992-6849-4ca6-9a66-5c2414bb9424'
  AND key IN (
    -- formatos antigos/incompatíveis injetados no seed Lucas
    'financas_transactions',
    'financas_categories',
    -- chaves com formato dueDay/isPaid (não bills[])
    'finance-dueDays'
  );

-- 4. Restaura nome
INSERT INTO public.user_data (user_id, key, value)
VALUES ('2c896992-6849-4ca6-9a66-5c2414bb9424', 'core-user-name', to_jsonb('João Victor'::text))
ON CONFLICT (user_id, key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

-- 5. Restaura finance-dueDays no formato {day,color,bills:[{id,name,paid}]}
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-dueDays', '[
  {"day":5,"color":"yellow","bills":[
    {"id":"b-aluguel","name":"Aluguel","paid":false},
    {"id":"b-cond","name":"Condomínio","paid":false}
  ]},
  {"day":10,"color":"slate","bills":[
    {"id":"b-net","name":"Internet","paid":false},
    {"id":"b-seg","name":"Seguro carro","paid":false}
  ]},
  {"day":15,"color":"indigo","bills":[
    {"id":"b-card-nu","name":"Fatura Nubank","paid":true}
  ]},
  {"day":22,"color":"violet","bills":[
    {"id":"b-card-it","name":"Fatura Inter","paid":false}
  ]},
  {"day":30,"color":"emerald","bills":[]}
]'::jsonb)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 6. Restaura chaves financeiras principais no formato esperado
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-incomes', '[
  {"id":"inc-clt","description":"Salário CLT","source":"CLT","value":12500,"date":"2026-05-05"},
  {"id":"inc-freela","description":"Freelance","source":"Freelance","value":2200,"date":"2026-05-18"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-fixed-expenses', '[
  {"id":"fx-aluguel","description":"Aluguel","category":"moradia","value":2400,"paymentMethod":"pix"},
  {"id":"fx-cond","description":"Condomínio","category":"moradia","value":680,"paymentMethod":"boleto"},
  {"id":"fx-internet","description":"Internet Vivo Fibra","category":"servicos","value":129,"paymentMethod":"credito","cardName":"Nubank"},
  {"id":"fx-spotify","description":"Spotify Family","category":"assinaturas","value":27,"paymentMethod":"credito","cardName":"Nubank"},
  {"id":"fx-netflix","description":"Netflix","category":"assinaturas","value":55,"paymentMethod":"credito","cardName":"Nubank"},
  {"id":"fx-academia","description":"Academia Smart Fit","category":"saude","value":99,"paymentMethod":"credito","cardName":"Nubank"},
  {"id":"fx-saude","description":"Plano de saúde Sulamérica","category":"saude","value":580,"paymentMethod":"boleto"},
  {"id":"fx-luz","description":"Conta de luz Enel","category":"moradia","value":180,"paymentMethod":"boleto"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-expenses', '[
  {"id":"e1","description":"Mercado Pão de Açúcar","category":"mercado","value":520,"date":"2026-05-02"},
  {"id":"e2","description":"Padaria do bairro","category":"alimentacao","value":17,"date":"2026-05-01"},
  {"id":"e3","description":"Uber","category":"transporte","value":28,"date":"2026-04-30"},
  {"id":"e4","description":"Gasolina Shell","category":"transporte","value":215,"date":"2026-04-28"},
  {"id":"e5","description":"Farmácia Drogasil","category":"saude","value":74,"date":"2026-04-27"},
  {"id":"e6","description":"Restaurante japonês","category":"restaurante","value":186,"date":"2026-04-25"},
  {"id":"e7","description":"Cinema iMax","category":"lazer","value":63,"date":"2026-04-22"},
  {"id":"e8","description":"Livro Amazon","category":"educacao","value":88,"date":"2026-04-20"},
  {"id":"e9","description":"Curso Udemy","category":"educacao","value":79,"date":"2026-04-17"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-installments', '[
  {"id":"inst-iphone","description":"iPhone 15","installmentValue":450,"totalInstallments":12,"paidInstallments":7,"startDate":"2025-10-01"},
  {"id":"inst-sofa","description":"Sofá novo","installmentValue":280,"totalInstallments":6,"paidInstallments":6,"startDate":"2025-11-01"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-investments', '[
  {"id":"inv-1","name":"Tesouro Selic","type":"Renda Fixa","investedValue":8000,"currentValue":8650,"date":"2025-06-15"},
  {"id":"inv-2","name":"IVVB11","type":"ETF","investedValue":5000,"currentValue":5780,"date":"2025-08-01"},
  {"id":"inv-3","name":"CDB Inter","type":"Renda Fixa","investedValue":3000,"currentValue":3220,"date":"2025-09-10"},
  {"id":"inv-4","name":"Tesouro IPCA+","type":"Renda Fixa","investedValue":4000,"currentValue":4180,"date":"2026-02-22"},
  {"id":"inv-5","name":"BOVA11","type":"ETF","investedValue":2500,"currentValue":2640,"date":"2026-03-12"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-goals', '[
  {"id":"goal-1","name":"Reserva de emergência","targetValue":35000,"currentValue":18900,"deadline":"2026-12-31"},
  {"id":"goal-2","name":"Viagem Europa","targetValue":15000,"currentValue":5200,"deadline":"2027-06-01"},
  {"id":"goal-3","name":"Entrada apartamento","targetValue":80000,"currentValue":13500,"deadline":"2028-12-31"}
]'::jsonb)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();