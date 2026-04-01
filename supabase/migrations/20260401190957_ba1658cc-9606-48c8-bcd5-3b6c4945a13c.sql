
-- Populate realistic financial data for user jv20101958@gmail.com
-- User ID: 2c896992-6849-4ca6-9a66-5c2414bb9424

-- ===== JANEIRO =====
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-incomes', '[
  {"id":"jan-inc-1","description":"Salário","source":"CLT","value":5800,"date":"2026-01-05"},
  {"id":"jan-inc-2","description":"Freelance design","source":"Freelance","value":1200,"date":"2026-01-15"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-fixed', '[
  {"id":"jan-fix-1","description":"Aluguel","category":"moradia","value":1800,"paymentMethod":"pix"},
  {"id":"jan-fix-2","description":"Condomínio","category":"moradia","value":450,"paymentMethod":"boleto"},
  {"id":"jan-fix-3","description":"Internet","category":"servicos","value":120,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"jan-fix-4","description":"Spotify + Netflix","category":"lazer","value":65,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"jan-fix-5","description":"Academia","category":"saude","value":110,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"jan-fix-6","description":"Seguro carro","category":"transporte","value":280,"paymentMethod":"boleto"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-expenses', '[
  {"id":"jan-exp-1","description":"Mercado Pão de Açúcar","category":"mercado","value":520,"date":"2026-01-08"},
  {"id":"jan-exp-2","description":"Restaurante japonês","category":"restaurante","value":185,"date":"2026-01-12"},
  {"id":"jan-exp-3","description":"Uber","category":"transporte","value":95,"date":"2026-01-14"},
  {"id":"jan-exp-4","description":"Farmácia","category":"saude","value":78,"date":"2026-01-18"},
  {"id":"jan-exp-5","description":"Cinema + pipoca","category":"lazer","value":85,"date":"2026-01-22"},
  {"id":"jan-exp-6","description":"Mercado Extra","category":"mercado","value":340,"date":"2026-01-25"},
  {"id":"jan-exp-7","description":"Presente aniversário","category":"presente","value":150,"date":"2026-01-28"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-installments', '[
  {"id":"jan-inst-1","description":"iPhone 15","installmentValue":450,"totalInstallments":12,"paidInstallments":3,"startDate":"2025-10-01"},
  {"id":"jan-inst-2","description":"Sofá novo","installmentValue":280,"totalInstallments":6,"paidInstallments":2,"startDate":"2025-11-01"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-dueDays', '[
  {"day":5,"color":"yellow","bills":[{"id":"jan-b1","name":"Aluguel","paid":true},{"id":"jan-b2","name":"Condomínio","paid":true}]},
  {"day":10,"color":"slate","bills":[{"id":"jan-b3","name":"Internet","paid":true},{"id":"jan-b4","name":"Seguro","paid":true}]},
  {"day":20,"color":"indigo","bills":[{"id":"jan-b5","name":"Cartão Nubank","paid":true}]},
  {"day":30,"color":"emerald","bills":[]}
]'::jsonb)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ===== FEVEREIRO =====
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-incomes', '[
  {"id":"fev-inc-1","description":"Salário","source":"CLT","value":5800,"date":"2026-02-05"},
  {"id":"fev-inc-2","description":"Freelance app","source":"Freelance","value":2500,"date":"2026-02-20"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-fixed', '[
  {"id":"fev-fix-1","description":"Aluguel","category":"moradia","value":1800,"paymentMethod":"pix"},
  {"id":"fev-fix-2","description":"Condomínio","category":"moradia","value":450,"paymentMethod":"boleto"},
  {"id":"fev-fix-3","description":"Internet","category":"servicos","value":120,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"fev-fix-4","description":"Spotify + Netflix","category":"lazer","value":65,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"fev-fix-5","description":"Academia","category":"saude","value":110,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"fev-fix-6","description":"Seguro carro","category":"transporte","value":280,"paymentMethod":"boleto"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-expenses', '[
  {"id":"fev-exp-1","description":"Mercado Pão de Açúcar","category":"mercado","value":480,"date":"2026-02-06"},
  {"id":"fev-exp-2","description":"Carnaval - fantasia","category":"lazer","value":220,"date":"2026-02-14"},
  {"id":"fev-exp-3","description":"Restaurante italiano","category":"restaurante","value":165,"date":"2026-02-10"},
  {"id":"fev-exp-4","description":"Uber","category":"transporte","value":130,"date":"2026-02-17"},
  {"id":"fev-exp-5","description":"Mercado Extra","category":"mercado","value":390,"date":"2026-02-22"},
  {"id":"fev-exp-6","description":"Tênis Nike","category":"vestuario","value":450,"date":"2026-02-25"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-installments', '[
  {"id":"fev-inst-1","description":"iPhone 15","installmentValue":450,"totalInstallments":12,"paidInstallments":4,"startDate":"2025-10-01"},
  {"id":"fev-inst-2","description":"Sofá novo","installmentValue":280,"totalInstallments":6,"paidInstallments":3,"startDate":"2025-11-01"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-dueDays', '[
  {"day":5,"color":"yellow","bills":[{"id":"fev-b1","name":"Aluguel","paid":true},{"id":"fev-b2","name":"Condomínio","paid":true}]},
  {"day":10,"color":"slate","bills":[{"id":"fev-b3","name":"Internet","paid":true},{"id":"fev-b4","name":"Seguro","paid":false}]},
  {"day":20,"color":"indigo","bills":[{"id":"fev-b5","name":"Cartão Nubank","paid":true}]},
  {"day":30,"color":"emerald","bills":[]}
]'::jsonb)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ===== MARÇO =====
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-marco-incomes', '[
  {"id":"mar-inc-1","description":"Salário","source":"CLT","value":5800,"date":"2026-03-05"},
  {"id":"mar-inc-2","description":"Freelance landing page","source":"Freelance","value":1800,"date":"2026-03-18"},
  {"id":"mar-inc-3","description":"Venda equipamento usado","source":"Outros","value":600,"date":"2026-03-25"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-marco-fixed', '[
  {"id":"mar-fix-1","description":"Aluguel","category":"moradia","value":1800,"paymentMethod":"pix"},
  {"id":"mar-fix-2","description":"Condomínio","category":"moradia","value":450,"paymentMethod":"boleto"},
  {"id":"mar-fix-3","description":"Internet","category":"servicos","value":120,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"mar-fix-4","description":"Spotify + Netflix","category":"lazer","value":65,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"mar-fix-5","description":"Academia","category":"saude","value":110,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"mar-fix-6","description":"Seguro carro","category":"transporte","value":280,"paymentMethod":"boleto"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-marco-expenses', '[
  {"id":"mar-exp-1","description":"Mercado Pão de Açúcar","category":"mercado","value":550,"date":"2026-03-07"},
  {"id":"mar-exp-2","description":"Restaurante churrascaria","category":"restaurante","value":210,"date":"2026-03-10"},
  {"id":"mar-exp-3","description":"Uber + 99","category":"transporte","value":145,"date":"2026-03-15"},
  {"id":"mar-exp-4","description":"Livros técnicos","category":"educacao","value":180,"date":"2026-03-18"},
  {"id":"mar-exp-5","description":"Mercado Extra","category":"mercado","value":420,"date":"2026-03-23"},
  {"id":"mar-exp-6","description":"Farmácia","category":"saude","value":95,"date":"2026-03-26"},
  {"id":"mar-exp-7","description":"Happy hour","category":"lazer","value":120,"date":"2026-03-28"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-marco-installments', '[
  {"id":"mar-inst-1","description":"iPhone 15","installmentValue":450,"totalInstallments":12,"paidInstallments":5,"startDate":"2025-10-01"},
  {"id":"mar-inst-2","description":"Sofá novo","installmentValue":280,"totalInstallments":6,"paidInstallments":4,"startDate":"2025-11-01"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-marco-dueDays', '[
  {"day":5,"color":"yellow","bills":[{"id":"mar-b1","name":"Aluguel","paid":true},{"id":"mar-b2","name":"Condomínio","paid":true}]},
  {"day":10,"color":"slate","bills":[{"id":"mar-b3","name":"Internet","paid":true},{"id":"mar-b4","name":"Seguro","paid":true}]},
  {"day":20,"color":"indigo","bills":[{"id":"mar-b5","name":"Cartão Nubank","paid":true}]},
  {"day":30,"color":"emerald","bills":[]}
]'::jsonb)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ===== ABRIL (mês atual) - dados parciais =====
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-incomes', '[
  {"id":"abr-inc-1","description":"Salário","source":"CLT","value":5800,"date":"2026-04-05"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-fixed-expenses', '[
  {"id":"abr-fix-1","description":"Aluguel","category":"moradia","value":1800,"paymentMethod":"pix"},
  {"id":"abr-fix-2","description":"Condomínio","category":"moradia","value":450,"paymentMethod":"boleto"},
  {"id":"abr-fix-3","description":"Internet","category":"servicos","value":120,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"abr-fix-4","description":"Spotify + Netflix","category":"lazer","value":65,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"abr-fix-5","description":"Academia","category":"saude","value":110,"paymentMethod":"cartao","cardName":"Nubank"},
  {"id":"abr-fix-6","description":"Seguro carro","category":"transporte","value":280,"paymentMethod":"boleto"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-expenses', '[
  {"id":"abr-exp-1","description":"Mercado Pão de Açúcar","category":"mercado","value":320,"date":"2026-04-01"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-installments', '[
  {"id":"abr-inst-1","description":"iPhone 15","installmentValue":450,"totalInstallments":12,"paidInstallments":6,"startDate":"2025-10-01"},
  {"id":"abr-inst-2","description":"Sofá novo","installmentValue":280,"totalInstallments":6,"paidInstallments":5,"startDate":"2025-11-01"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-dueDays', '[
  {"day":5,"color":"yellow","bills":[{"id":"abr-b1","name":"Aluguel","paid":false},{"id":"abr-b2","name":"Condomínio","paid":false}]},
  {"day":10,"color":"slate","bills":[{"id":"abr-b3","name":"Internet","paid":false},{"id":"abr-b4","name":"Seguro","paid":false}]},
  {"day":20,"color":"indigo","bills":[{"id":"abr-b5","name":"Cartão Nubank","paid":false}]},
  {"day":30,"color":"emerald","bills":[]}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-investments', '[
  {"id":"inv-1","name":"Tesouro Selic","type":"Renda Fixa","investedValue":8000,"currentValue":8450,"date":"2025-06-15"},
  {"id":"inv-2","name":"IVVB11","type":"ETF","investedValue":5000,"currentValue":5680,"date":"2025-08-01"},
  {"id":"inv-3","name":"CDB Nubank","type":"Renda Fixa","investedValue":3000,"currentValue":3180,"date":"2025-09-10"}
]'::jsonb),
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-goals', '[
  {"id":"goal-1","name":"Reserva de emergência","targetValue":35000,"currentValue":17310,"deadline":"2026-12-31"},
  {"id":"goal-2","name":"Viagem Europa","targetValue":15000,"currentValue":4500,"deadline":"2027-06-01"},
  {"id":"goal-3","name":"Entrada apartamento","targetValue":80000,"currentValue":12000,"deadline":"2028-12-31"}
]'::jsonb)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
