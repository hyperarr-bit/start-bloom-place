
-- Insert historical financial data for user jv20101958@gmail.com (Oct 2025 - Feb 2026)
-- Using ON CONFLICT to avoid duplicates if re-run

-- Helper: the user_id
-- 2c896992-6849-4ca6-9a66-5c2414bb9424

-- OUTUBRO incomes
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-outubro-incomes', '[{"id":"hist-oct-i1","description":"Trabalho São Marcos","value":8200,"date":"2025-10-05"},{"id":"hist-oct-i2","description":"Trabalho 2","value":1300,"date":"2025-10-28"},{"id":"hist-oct-i3","description":"Freelance","value":800,"date":"2025-10-15"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-outubro-fixed', '[{"id":"hist-oct-f1","description":"Alimentação","category":"contas_pessoais","value":900,"paymentMethod":"pix"},{"id":"hist-oct-f2","description":"Escola","category":"educacao","value":1500,"paymentMethod":"pix"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-outubro-expenses', '[{"id":"hist-oct-e1","description":"Roupas","category":"vestuario","value":450,"date":"2025-10-10","paymentMethod":"credito","cardName":"nubank"},{"id":"hist-oct-e2","description":"Restaurante","category":"restaurante","value":320,"date":"2025-10-20","paymentMethod":"debito"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-outubro-dueDays', '[{"day":5,"color":"yellow","bills":[]},{"day":10,"color":"slate","bills":[{"id":"hist-oct-b1","name":"Tuauei","paid":true}]},{"day":18,"color":"","bills":[{"id":"hist-oct-b2","name":"Vencimento cartão","paid":true}]}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-outubro-installments', '[]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-outubro-notes', '[{"id":"hist-oct-n1","text":"Mês tranquilo, consegui economizar bem"}]')
ON CONFLICT DO NOTHING;

-- NOVEMBRO
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-novembro-incomes', '[{"id":"hist-nov-i1","description":"Trabalho São Marcos","value":8705,"date":"2025-11-05"},{"id":"hist-nov-i2","description":"Trabalho 2","value":1300,"date":"2025-11-28"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-novembro-fixed', '[{"id":"hist-nov-f1","description":"Alimentação","category":"contas_pessoais","value":1000,"paymentMethod":"pix"},{"id":"hist-nov-f2","description":"Escola","category":"educacao","value":1500,"paymentMethod":"pix"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-novembro-expenses', '[{"id":"hist-nov-e1","description":"Black Friday TV","category":"eletronicos","value":2800,"date":"2025-11-29","paymentMethod":"credito","cardName":"nubank"},{"id":"hist-nov-e2","description":"Uber","category":"transporte","value":380,"date":"2025-11-15","paymentMethod":"credito","cardName":"inter"},{"id":"hist-nov-e3","description":"Presente aniversário","category":"presente","value":250,"date":"2025-11-20","paymentMethod":"pix"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-novembro-dueDays', '[{"day":5,"color":"yellow","bills":[]},{"day":10,"color":"slate","bills":[{"id":"hist-nov-b1","name":"Tuauei","paid":true}]},{"day":18,"color":"","bills":[{"id":"hist-nov-b2","name":"Vencimento cartão","paid":true}]}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-novembro-installments', '[]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-novembro-notes', '[{"id":"hist-nov-n1","text":"Black Friday pesou no orçamento"}]')
ON CONFLICT DO NOTHING;

-- DEZEMBRO
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-dezembro-incomes', '[{"id":"hist-dec-i1","description":"Trabalho São Marcos","value":8705,"date":"2025-12-05"},{"id":"hist-dec-i2","description":"Trabalho 2","value":1300,"date":"2025-12-28"},{"id":"hist-dec-i3","description":"13º Salário","value":4350,"date":"2025-12-20"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-dezembro-fixed', '[{"id":"hist-dec-f1","description":"Alimentação","category":"contas_pessoais","value":1200,"paymentMethod":"pix"},{"id":"hist-dec-f2","description":"Escola","category":"educacao","value":1500,"paymentMethod":"pix"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-dezembro-expenses', '[{"id":"hist-dec-e1","description":"Presentes Natal","category":"presente","value":1500,"date":"2025-12-22","paymentMethod":"credito","cardName":"nubank"},{"id":"hist-dec-e2","description":"Ceia","category":"restaurante","value":600,"date":"2025-12-24","paymentMethod":"pix"},{"id":"hist-dec-e3","description":"Viagem Reveillon","category":"lazer","value":2000,"date":"2025-12-30","paymentMethod":"debito"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-dezembro-dueDays', '[{"day":5,"color":"yellow","bills":[]},{"day":10,"color":"slate","bills":[{"id":"hist-dec-b1","name":"Tuauei","paid":true}]},{"day":18,"color":"","bills":[{"id":"hist-dec-b2","name":"Vencimento cartão","paid":true}]}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-dezembro-installments', '[]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-dezembro-notes', '[{"id":"hist-dec-n1","text":"Mês de festas, gastos maiores mas 13º ajudou"}]')
ON CONFLICT DO NOTHING;

-- JANEIRO
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-incomes', '[{"id":"hist-jan-i1","description":"Trabalho São Marcos","value":8705,"date":"2026-01-05"},{"id":"hist-jan-i2","description":"Trabalho 2","value":1300,"date":"2026-01-28"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-fixed', '[{"id":"hist-jan-f1","description":"Alimentação","category":"contas_pessoais","value":1000,"paymentMethod":"pix"},{"id":"hist-jan-f2","description":"Escola","category":"educacao","value":1500,"paymentMethod":"pix"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-expenses', '[{"id":"hist-jan-e1","description":"Material escolar","category":"educacao","value":650,"date":"2026-01-15","paymentMethod":"pix"},{"id":"hist-jan-e2","description":"Uber","category":"transporte","value":280,"date":"2026-01-10","paymentMethod":"credito","cardName":"inter"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-dueDays', '[{"day":5,"color":"yellow","bills":[]},{"day":10,"color":"slate","bills":[{"id":"hist-jan-b1","name":"Tuauei","paid":true}]},{"day":18,"color":"","bills":[{"id":"hist-jan-b2","name":"Vencimento cartão","paid":true}]}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-installments', '[]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-janeiro-notes', '[{"id":"hist-jan-n1","text":"Volta às aulas, gastos com material"}]')
ON CONFLICT DO NOTHING;

-- FEVEREIRO
INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-incomes', '[{"id":"hist-feb-i1","description":"Trabalho São Marcos","value":8705,"date":"2026-02-05"},{"id":"hist-feb-i2","description":"Trabalho 2","value":1300,"date":"2026-02-28"},{"id":"hist-feb-i3","description":"Freelance","value":1200,"date":"2026-02-15"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-fixed', '[{"id":"hist-feb-f1","description":"Alimentação","category":"contas_pessoais","value":1000,"paymentMethod":"pix"},{"id":"hist-feb-f2","description":"Escola","category":"educacao","value":1500,"paymentMethod":"pix"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-expenses', '[{"id":"hist-feb-e1","description":"Carnaval","category":"lazer","value":1800,"date":"2026-02-16","paymentMethod":"debito"},{"id":"hist-feb-e2","description":"Uber","category":"transporte","value":350,"date":"2026-02-20","paymentMethod":"credito","cardName":"inter"}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-dueDays', '[{"day":5,"color":"yellow","bills":[]},{"day":10,"color":"slate","bills":[{"id":"hist-feb-b1","name":"Tuauei","paid":true}]},{"day":18,"color":"","bills":[{"id":"hist-feb-b2","name":"Vencimento cartão","paid":false}]}]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-installments', '[]')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_data (user_id, key, value) VALUES
('2c896992-6849-4ca6-9a66-5c2414bb9424', 'finance-month-fevereiro-notes', '[{"id":"hist-feb-n1","text":"Carnaval pesou mas freelance compensou"}]')
ON CONFLICT DO NOTHING;
