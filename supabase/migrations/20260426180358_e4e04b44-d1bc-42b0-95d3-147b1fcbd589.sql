DO $$
DECLARE
  uid uuid := '2c896992-6849-4ca6-9a66-5c2414bb9424';
  i int;
  d date;
  rotina_data jsonb := '{}'::jsonb;
  habits_data jsonb;
  fin_tx jsonb := '[]'::jsonb;
  treino_sessions jsonb := '[]'::jsonb;
  dieta_data jsonb := '{}'::jsonb;
  saude_weight jsonb := '[]'::jsonb;
  saude_mood jsonb := '[]'::jsonb;
  hidrat jsonb := '{}'::jsonb;
  hiperfoco_sess jsonb := '[]'::jsonb;
  detox_days jsonb := '[]'::jsonb;
BEGIN
  FOR i IN 0..29 LOOP
    d := (CURRENT_DATE - i);
    rotina_data := rotina_data || jsonb_build_object(d::text, jsonb_build_array(
      jsonb_build_object('id','acordar','title','Acordar 6h','done',true,'time','06:00'),
      jsonb_build_object('id','treino','title','Treinar','done', (i % 7) NOT IN (0,6),'time','07:00'),
      jsonb_build_object('id','ler','title','Ler 30min','done', (i % 4) <> 0,'time','22:00'),
      jsonb_build_object('id','agua','title','Beber 2L água','done',true,'time','all-day'),
      jsonb_build_object('id','meditar','title','Meditar 10min','done', (i % 3) <> 0,'time','06:30')
    ));
  END LOOP;

  habits_data := jsonb_build_array(
    jsonb_build_object('id','h1','name','Treinar','streak',23,'best',45),
    jsonb_build_object('id','h2','name','Ler 30min','streak',12,'best',30),
    jsonb_build_object('id','h3','name','Meditar','streak',18,'best',25),
    jsonb_build_object('id','h4','name','Sem açúcar','streak',7,'best',14)
  );

  FOR i IN 1..40 LOOP
    fin_tx := fin_tx || jsonb_build_array(jsonb_build_object(
      'id', 'tx_' || i,
      'date', (CURRENT_DATE - (i % 30))::text,
      'description', (ARRAY['Mercado','Gasolina','Restaurante','iFood','Uber','Farmácia','Salário','Netflix','Spotify','Academia','Padaria','Cinema','Conta luz','Internet'])[1 + (i % 14)],
      'category', (ARRAY['alimentacao','transporte','lazer','saude','moradia','salario','assinaturas'])[1 + (i % 7)],
      'amount', CASE WHEN i % 14 = 6 THEN 8500.00 ELSE -1 * (20 + (i * 7) % 250) END,
      'type', CASE WHEN i % 14 = 6 THEN 'income' ELSE 'expense' END
    ));
  END LOOP;

  FOR i IN 0..17 LOOP
    treino_sessions := treino_sessions || jsonb_build_array(jsonb_build_object(
      'id','tr_'||i, 'date',(CURRENT_DATE - (i*2))::text,
      'split',(ARRAY['A','B','C'])[1 + (i % 3)], 'duration', 50 + (i % 20),
      'exercises', jsonb_build_array(
        jsonb_build_object('name','Supino','sets',4,'reps',10,'weight',60 + i*0.5),
        jsonb_build_object('name','Agachamento','sets',4,'reps',12,'weight',80 + i*1),
        jsonb_build_object('name','Levantamento Terra','sets',3,'reps',8,'weight',100 + i*1.5)
      )
    ));
  END LOOP;

  FOR i IN 0..29 LOOP
    d := (CURRENT_DATE - i);
    dieta_data := dieta_data || jsonb_build_object(d::text, jsonb_build_object(
      'meals', jsonb_build_array(
        jsonb_build_object('id','cafe','name','Café da manhã','calories',450),
        jsonb_build_object('id','almoco','name','Almoço','calories',750),
        jsonb_build_object('id','lanche','name','Lanche','calories',280),
        jsonb_build_object('id','janta','name','Jantar','calories',620)
      ),
      'totalCalories', 2100, 'targetCalories', 2200
    ));
  END LOOP;

  FOR i IN 0..29 LOOP
    d := (CURRENT_DATE - i);
    hidrat := hidrat || jsonb_build_object(d::text, jsonb_build_object('ml', 2000 + (i*50) % 800, 'goal', 2500));
  END LOOP;

  FOR i IN 0..14 LOOP
    saude_weight := saude_weight || jsonb_build_array(jsonb_build_object('date',(CURRENT_DATE - i*2)::text,'value', 75.0 - (i*0.13)));
    saude_mood := saude_mood || jsonb_build_array(jsonb_build_object('date',(CURRENT_DATE - i*2)::text,'mood',(ARRAY['otimo','bom','neutro','bom','otimo'])[1 + (i%5)]));
  END LOOP;

  FOR i IN 0..24 LOOP
    hiperfoco_sess := hiperfoco_sess || jsonb_build_array(jsonb_build_object(
      'id','pf_'||i,'date',(CURRENT_DATE - (i % 20))::text,'duration',25,'task','Estudo','completed',true
    ));
  END LOOP;

  FOR i IN 0..29 LOOP
    detox_days := detox_days || jsonb_build_array(jsonb_build_object(
      'date',(CURRENT_DATE - i)::text,'alcool',false,'acucar', (i % 5) = 0,'redesSociais', (i % 3) <> 0
    ));
  END LOOP;

  INSERT INTO public.user_data (user_id, key, value) VALUES
    (uid, 'rotina_tasks', rotina_data),
    (uid, 'habits', habits_data),
    (uid, 'financas_transactions', fin_tx),
    (uid, 'financas_categories', jsonb_build_array('alimentacao','transporte','lazer','saude','moradia','salario','assinaturas')),
    (uid, 'treino_sessions', treino_sessions),
    (uid, 'treino_split', '{"A":["Supino","Desenvolvimento","Triceps"],"B":["Agachamento","Leg Press","Panturrilha"],"C":["Terra","Remada","Biceps"]}'::jsonb),
    (uid, 'dieta_meals', dieta_data),
    (uid, 'dieta_macros', '{"protein":180,"carbs":250,"fat":70,"calories":2200}'::jsonb),
    (uid, 'hidratacao', hidrat),
    (uid, 'saude_weight', saude_weight),
    (uid, 'saude_mood', saude_mood),
    (uid, 'saude_pressao', '[{"date":"2026-04-20","sys":120,"dia":80},{"date":"2026-04-15","sys":118,"dia":78}]'::jsonb),
    (uid, 'biblioteca_books', '[
      {"id":"b1","title":"Hábitos Atômicos","author":"James Clear","status":"lido","rating":5},
      {"id":"b2","title":"O Poder do Hábito","author":"Charles Duhigg","status":"lido","rating":4},
      {"id":"b3","title":"Deep Work","author":"Cal Newport","status":"lendo","progress":62},
      {"id":"b4","title":"Pense e Enriqueça","author":"Napoleon Hill","status":"wishlist"}
    ]'::jsonb),
    (uid, 'estudos_courses', '[
      {"id":"c1","name":"React Avançado","progress":75},
      {"id":"c2","name":"Inglês Fluente","progress":42}
    ]'::jsonb),
    (uid, 'estudos_pomodoros', hiperfoco_sess),
    (uid, 'carreira_metas', '[
      {"id":"m1","title":"Promoção a Senior","quarter":"Q2 2026","progress":60},
      {"id":"m2","title":"Networking 20 pessoas","quarter":"Q2 2026","progress":45}
    ]'::jsonb),
    (uid, 'hiperfoco_sessions', hiperfoco_sess),
    (uid, 'beleza_skincare', '[
      {"id":"sk1","step":"Limpeza","time":"manha","done":true},
      {"id":"sk2","step":"Hidratante","time":"manha","done":true},
      {"id":"sk3","step":"Protetor solar","time":"manha","done":true},
      {"id":"sk4","step":"Limpeza noturna","time":"noite","done":true}
    ]'::jsonb),
    (uid, 'casa_tasks', '[
      {"id":"ca1","title":"Limpar quarto","frequency":"semanal","lastDone":"2026-04-23"},
      {"id":"ca2","title":"Lavar roupa","frequency":"semanal","lastDone":"2026-04-22"},
      {"id":"ca3","title":"Pagar condomínio","frequency":"mensal","lastDone":"2026-04-05"}
    ]'::jsonb),
    (uid, 'viagens_planejadas', '[
      {"id":"v1","destination":"Florianópolis","date":"2026-07-15","budget":3500,"status":"planejada"}
    ]'::jsonb),
    (uid, 'relacionamentos_contacts', '[
      {"id":"rel1","name":"Maria (mãe)","lastContact":"2026-04-24","frequency":"semanal"},
      {"id":"rel2","name":"João (irmão)","lastContact":"2026-04-20","frequency":"semanal"},
      {"id":"rel3","name":"Ana","lastContact":"2026-04-18","frequency":"quinzenal"}
    ]'::jsonb),
    (uid, 'pet_data', '{"name":"Thor","species":"cachorro","breed":"Labrador","age":3}'::jsonb),
    (uid, 'detox_log', detox_days),
    (uid, 'conquistas_points', to_jsonb(2400)),
    (uid, 'conquistas_unlocked', '["streak_7","streak_30","first_workout","first_meal","first_finance","reader","focused"]'::jsonb)
  ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  FOR i IN 1..80 LOOP
    INSERT INTO public.module_analytics (user_id, module_id, tab_id, duration_seconds, entered_at)
    VALUES (
      uid,
      (ARRAY['financas','rotina','treino','dieta','saude','hiperfoco','biblioteca','estudos','desenvolvimento','beleza','casa','conquistas'])[1 + (i % 12)],
      (ARRAY['overview','list','add','stats',NULL])[1 + (i % 5)],
      60 + (i * 13) % 600,
      now() - ((i * 9) || ' hours')::interval
    );
  END LOOP;
END $$;